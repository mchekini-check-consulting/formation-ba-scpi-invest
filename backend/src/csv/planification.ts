import { Cron } from 'croner';
import type { Pool } from 'pg';
import type { Logger } from 'pino';
import type { Db } from '../db/index.js';
import { logger } from '../logging/logger.js';
import { creerImportService } from './service.js';
import { s3Client, s3Config, sourceR2 } from './source.js';

// US-07a : import du catalogue chaque nuit à 2h, heure de Paris (changements d'heure
// compris). CSV_IMPORT_CRON permet un autre horaire (ex. "*/5 * * * *" pour essayer).
export const HORAIRE = '0 2 * * *';
export const FUSEAU = 'Europe/Paris';

// Verrou consultatif PostgreSQL propre à l'import (724001 : migrations, src/migrate.ts)
const VERROU = 724002;

export type Issue = 'lance' | 'deja_en_cours' | 'deja_fait';

// Plusieurs réplicas (preprod, prod : 2) déclenchent tous à 2h : un seul importe.
// - verrou pris par un autre réplica : "deja_en_cours" ;
// - import déjà démarré dans l'heure (horloges décalées de quelques secondes) : "deja_fait".
export async function lancerSurUnSeulReplica(
  pool: Pick<Pool, 'connect'>,
  executer: () => Promise<unknown>,
): Promise<Issue> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('select pg_try_advisory_lock($1) as libre', [VERROU]);
    if (!rows[0].libre) return 'deja_en_cours';
    try {
      const recent = await client.query(
        `select 1 from import_rapport where debut > now() - interval '1 hour' limit 1`,
      );
      if (recent.rows.length > 0) return 'deja_fait';
      await executer();
      return 'lance';
    } finally {
      await client.query('select pg_advisory_unlock($1)', [VERROU]);
    }
  } finally {
    client.release();
  }
}

// Tâche planifiée ; une erreur n'arrête jamais le backend. Les échecs de l'import sont
// déjà dans le rapport et les logs métier (ImportService) ; ce log couvre le reste
// (base injoignable avant l'import...).
export function planifierImport(
  pool: Pick<Pool, 'connect'>,
  executer: () => Promise<unknown>,
  log: Logger = logger,
  horaire = HORAIRE,
): Cron {
  return new Cron(
    horaire,
    { name: 'import-catalogue', timezone: FUSEAU, protect: true },
    async () => {
      try {
        const issue = await lancerSurUnSeulReplica(pool, executer);
        log.info({ issue }, `import planifié du catalogue : ${issue}`);
      } catch (err) {
        log.error(
          { error: err instanceof Error ? err.message : String(err) },
          'import planifié du catalogue en échec',
        );
      }
    },
  );
}

// Câblage au démarrage du backend (server.ts). Variables R2 absentes (poste de dev,
// environnement pas encore configuré) : planification désactivée, le backend démarre.
export function demarrerImportNocturne(
  pool: Pick<Pool, 'connect'>,
  db: Db,
  log: Logger = logger,
  env: NodeJS.ProcessEnv = process.env,
): Cron | null {
  let config;
  try {
    config = s3Config(env);
  } catch (err) {
    log.warn(
      { raison: err instanceof Error ? err.message : String(err) },
      'import nocturne du catalogue désactivé',
    );
    return null;
  }
  const service = creerImportService(db, sourceR2(s3Client(config), config), log);
  const horaire = env.CSV_IMPORT_CRON ?? HORAIRE;
  const tache = planifierImport(pool, () => service.executer(), log, horaire);
  log.info(
    { horaire, fuseau: FUSEAU, prochain: tache.nextRun()?.toISOString() },
    'import nocturne du catalogue planifié',
  );
  return tache;
}
