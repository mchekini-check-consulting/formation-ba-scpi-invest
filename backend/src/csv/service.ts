import { eq } from 'drizzle-orm';
import type { Logger } from 'pino';
import type { Db } from '../db/index.js';
import { TABLE_IMPORT_RAPPORT } from '../db/schema.js';
import { messageSansDonnees } from '../logging/erreur.js';
import { businessLog, elapsedMs, logger } from '../logging/logger.js';
import { alerteAdministrateur, type Alerter } from './alerte.js';
import { texteAlerte } from './erreurs.js';
import { FichierInvalide, importScpis, type BilanImport } from './import.js';

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
//   - "echec" (avec le motif ; en blocs dans erreur_detail si le fichier est refusé) :
//     import annulé, alerte à l'administrateur (US-07b, ligne de log error), erreur
//     relancée ;
//   - "reussi" (avec le bilan et les lignes rejetées) : puis archivage du fichier ; un
//     archivage impossible
//     n'annule pas l'import (déjà enregistré), il est noté dans le rapport et les logs.
// Le rapport est écrit hors de la transaction de l'import : il reste même si l'import est
// annulé. Une ligne de log résume chaque exécution (Grafana « Logs métier »).
export function creerImportService(
  db: Db,
  source: SourceCsv,
  log: Logger = logger,
  maintenant: () => Date = () => new Date(),
  importer: (db: Db, lignes: Lignes) => Promise<BilanImport> = importScpis,
  alerter: Alerter = alerteAdministrateur(log),
) {
  const { fichier } = source;
  const terminer = (id: number, valeurs: Partial<typeof TABLE_IMPORT_RAPPORT.$inferInsert>) =>
    db
      .update(TABLE_IMPORT_RAPPORT)
      .set({ fin: maintenant(), ...valeurs })
      .where(eq(TABLE_IMPORT_RAPPORT.id, id));
  // Pas de loggable ici : il ajouterait une 2e ligne (« ok » / « en échec ») à chaque
  // exécution, déjà résumée par cette ligne ou par l'alerte.
  const resumer = (
    level: 'info' | 'warn',
    msg: string,
    debut: bigint,
    champs: Record<string, unknown>,
  ) =>
    businessLog(log, level, 'service', 'ImportService', 'executer', msg, {
      fichier,
      durationMs: elapsedMs(debut),
      ...champs,
    });

  async function executer(): Promise<BilanImport | null> {
    const debut = process.hrtime.bigint();
    const [rapport] = await db
      .insert(TABLE_IMPORT_RAPPORT)
      .values({ fichier, debut: maintenant() })
      .returning({ id: TABLE_IMPORT_RAPPORT.id });

    let bilan: BilanImport;
    try {
      const lignes = await source.lire();
      if (!lignes) {
        await terminer(rapport.id, { statut: 'aucun_fichier' });
        resumer('warn', 'aucun fichier à importer', debut, {});
        return null;
      }
      bilan = await importer(db, lignes);
    } catch (err) {
      const refuse = err instanceof FichierInvalide;
      // Lignes rejetées quand le fichier est refusé faute de ligne valide
      const rejets = refuse ? err.rejets : [];
      // Base injoignable : le rapport reste "en_cours", l'erreur d'origine est relancée
      await terminer(rapport.id, {
        statut: 'echec',
        erreur: message(err),
        // motif en blocs pour l'écran du rapport ; vide pour une erreur technique
        erreur_detail: refuse ? err.detail : null,
        ...(rejets.length > 0 && { rejetees: rejets.length, rejets }),
      }).catch(() => undefined);
      const [sujet, motif] = refuse
        ? [`fichier du catalogue rejeté : ${fichier}`, texteAlerte(fichier, err.detail)]
        : // motif journalisé : sans requête SQL ni valeurs (erreur.ts)
          [`import du catalogue annulé (erreur technique) : ${fichier}`, messageSansDonnees(err)];
      // Une alerte impossible à envoyer ne doit pas masquer l'erreur d'origine
      await alerter(sujet, motif).catch(() => undefined);
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
    // Le détail des rejets reste dans le rapport : seuls les compteurs vont dans les logs
    const { rejets: _rejets, ...compteurs } = bilan;
    resumer(erreur || bilan.rejetees > 0 ? 'warn' : 'info', 'import du catalogue terminé', debut, {
      archive,
      ...compteurs,
      ...(erreur && { erreur }),
    });
    return bilan;
  }

  return { executer };
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
