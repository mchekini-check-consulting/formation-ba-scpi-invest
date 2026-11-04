import { eq } from 'drizzle-orm';
import type { Logger } from 'pino';
import type { Db } from '../db/index.js';
import { TABLE_IMPORT_RAPPORT } from '../db/schema.js';
import { businessLog, logger } from '../logging/logger.js';
import { loggable } from '../logging/service.js';
import { importScpis, type BilanImport } from './import.js';

type Lignes = AsyncIterable<Record<string, string>>;

// D'où vient le CSV (R2 aujourd'hui, source.ts) : le service ne connaît que ce contrat
export type SourceCsv = {
  fichier: string;
  lire(): Promise<Lignes | null>; // null : aucun fichier déposé
  archiver(): Promise<string>; // renvoie le nom de l'archive
};

// Couche service de l'import du catalogue (US-07a) : une ligne dans import_rapport par
// exécution, ouverte "en_cours" puis terminée :
//   - "aucun_fichier" : rien à importer, catalogue inchangé ;
//   - "echec" (avec le motif) : import annulé, erreur journalisée par loggable et relancée ;
//   - "reussi" (avec le bilan) : puis archivage du fichier ; un archivage impossible
//     n'annule pas l'import (déjà enregistré), il est noté dans le rapport et les logs.
// Le rapport est écrit hors de la transaction de l'import : il reste même si l'import est
// annulé. Une ligne de log résume chaque exécution (Grafana « Logs métier »).
export function creerImportService(
  db: Db,
  source: SourceCsv,
  log: Logger = logger,
  maintenant: () => Date = () => new Date(),
  importer: (db: Db, lignes: Lignes) => Promise<BilanImport> = importScpis,
) {
  const { fichier } = source;
  const terminer = (id: number, valeurs: Partial<typeof TABLE_IMPORT_RAPPORT.$inferInsert>) =>
    db
      .update(TABLE_IMPORT_RAPPORT)
      .set({ fin: maintenant(), ...valeurs })
      .where(eq(TABLE_IMPORT_RAPPORT.id, id));
  const resumer = (level: 'info' | 'warn', msg: string, champs: Record<string, unknown>) =>
    businessLog(log, level, 'service', 'ImportService', 'executer', msg, { fichier, ...champs });

  async function executer(): Promise<BilanImport | null> {
    const [rapport] = await db
      .insert(TABLE_IMPORT_RAPPORT)
      .values({ fichier, debut: maintenant() })
      .returning({ id: TABLE_IMPORT_RAPPORT.id });

    let bilan: BilanImport;
    try {
      const lignes = await source.lire();
      if (!lignes) {
        await terminer(rapport.id, { statut: 'aucun_fichier' });
        resumer('warn', 'aucun fichier à importer', {});
        return null;
      }
      bilan = await importer(db, lignes);
    } catch (err) {
      // Base injoignable : le rapport reste "en_cours", l'erreur d'origine est relancée
      await terminer(rapport.id, { statut: 'echec', erreur: message(err) }).catch(() => undefined);
      throw err;
    }

    let archive: string | null = null;
    let erreur: string | null = null;
    try {
      archive = await source.archiver();
    } catch (err) {
      erreur = `archivage impossible : ${message(err)}`;
    }

    await terminer(rapport.id, { statut: 'reussi', ...bilan, erreur });
    resumer(erreur ? 'warn' : 'info', 'import du catalogue terminé', {
      archive,
      ...bilan,
      ...(erreur && { erreur }),
    });
    return bilan;
  }

  return loggable('ImportService', { executer }, log);
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
