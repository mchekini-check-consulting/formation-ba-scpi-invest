import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Pool } from 'pg';

// Remplace Flyway : migrations/*.sql appliquées au démarrage dans l'ordre V1, V2...,
// une seule fois chacune. Verrou consultatif : deux réplicas démarrant ensemble
// ne les appliquent pas deux fois.
const DOSSIER = path.resolve(import.meta.dirname, '../migrations');

export async function migrate(pool: Pool): Promise<void> {
  const fichiers = (await readdir(DOSSIER))
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(724001)');
    await client.query(
      'create table if not exists schema_migrations (nom text primary key, applique_le timestamptz not null default now())',
    );
    // Base créée par l'ancien backend Spring : reprendre l'historique Flyway
    // (mêmes fichiers V1__, V2__...) pour ne pas rejouer des migrations déjà appliquées
    const { rows: flyway } = await client.query<{ existe: boolean }>(
      "select to_regclass('flyway_schema_history') is not null as existe",
    );
    if (flyway[0].existe) {
      await client.query(
        `insert into schema_migrations (nom)
         select script from flyway_schema_history where success and script like 'V%.sql'
         on conflict do nothing`,
      );
    }
    const { rows } = await client.query<{ nom: string }>('select nom from schema_migrations');
    const appliquees = new Set(rows.map((r) => r.nom));
    for (const fichier of fichiers.filter((f) => !appliquees.has(f))) {
      await client.query(await readFile(path.join(DOSSIER, fichier), 'utf8'));
      await client.query('insert into schema_migrations (nom) values ($1)', [fichier]);
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}
