import { parse } from 'csv-parse';
// On utilise la pipeline de Node car elle permet de passer à les erreurs
// au parseur
import { pipeline } from 'node:stream';
import { s3Client, s3Config, streamCsv } from './source.js';

import { createDb, createPool, type Db } from '../db/index.js';
import {
  TABLE_SCPI_CATALOG,
  TABLE_TAUX_DISTRIBUTION,
  TABLE_DECOTE_DEMEMBREMENT,
  TABLE_LOCALISATION,
  TABLE_PRIX_PART,
  TABLE_SECTEURS,
  TABLE_VALEUR_RECONSTITUTION,
} from '../db/schema.js';
import {
  toBoolean,
  toFrequence,
  toInteger,
  toLocalisation,
  toNumber,
  toPaires,
  toSecteur,
  toValeursAnnuelles,
} from './convert.js';

// Écrit en base les lignes du CSV des SCPI (une ligne = une SCPI et ses valeurs multiples).
// Exportée pour les tests : reçoit la connexion et les lignes, sans R2 ni pool.
export async function importScpis(db: Db, rows: AsyncIterable<Record<string, string>>) {
  // Une seule transaction pour tout le fichier :
  // si une ligne est en erreur, rien n'est enregistré (rollback)
  await db.transaction(async (tx) => {
    for await (const row of rows) {
      const {
        Nom,
        minimum_souscription,
        capitalisation,
        Gerant,
        frais_souscription,
        frais_gestion,
        delai_jouissance,
        frequence_loyers,
        iban,
        bic,
        demembrement,
        cashback,
        versement_programme,
        publicite,
      } = row;

      const [scpi] = await tx
        .insert(TABLE_SCPI_CATALOG)
        .values({
          nom: Nom,
          minimum_souscription: toInteger(minimum_souscription, 'minimum_souscription'),
          capitalisation: toInteger(capitalisation, 'capitalisation'),
          gerant: Gerant,
          frais_souscription: toNumber(frais_souscription, 'frais_souscription'),
          frais_gestion: toNumber(frais_gestion, 'frais_gestion'),
          delai_jouissance: toInteger(delai_jouissance, 'delai_jouissance'),
          frequence: toFrequence(frequence_loyers),
          iban,
          bic,
          demembrement: toBoolean(demembrement, 'demembrement'),
          cashback: toInteger(cashback, 'cashback'),
          versement_programme: toBoolean(versement_programme, 'versement_programme'),
          publicite,
        })
        .returning({ id: TABLE_SCPI_CATALOG.id }); // pour récuperer l'id créé

      const taux = toValeursAnnuelles(row.taux_distribution, 'taux_distribution');
      if (taux.length > 0) {
        await tx
          .insert(TABLE_TAUX_DISTRIBUTION)
          .values(taux.map((t) => ({ taux: String(t.valeur), annee: t.annee, scpi_id: scpi.id })));
      }

      const prix = toValeursAnnuelles(row.prix_part, 'prix_part');
      if (prix.length > 0) {
        await tx
          .insert(TABLE_PRIX_PART)
          .values(prix.map((p) => ({ prix: String(p.valeur), annee: p.annee, scpi_id: scpi.id })));
      }

      const valeurs = toValeursAnnuelles(row.valeur_reconstitution, 'valeur_reconstitution');
      if (valeurs.length > 0) {
        await tx
          .insert(TABLE_VALEUR_RECONSTITUTION)
          .values(
            valeurs.map((v) => ({ valeur: String(v.valeur), annee: v.annee, scpi_id: scpi.id })),
          );
      }

      const localisations = toLocalisation(row.localisation, 'localisation');
      if (localisations.length > 0) {
        await tx.insert(TABLE_LOCALISATION).values(
          localisations.map((l) => ({
            pays: l.pays,
            pourcentage: String(l.pourcentage),
            scpi_id: scpi.id,
          })),
        );
      }

      const secteurs = toSecteur(row.secteurs, 'secteurs');
      if (secteurs.length > 0) {
        await tx.insert(TABLE_SECTEURS).values(
          secteurs.map((s) => ({
            secteur: s.secteur,
            pourcentage: String(s.pourcentage),
            scpi_id: scpi.id,
          })),
        );
      }

      // "3,90,4,85" : durée du démembrement (nombre d'années) -> décote, deux entiers
      const decotes = toPaires(row.decote_demembrement, 'decote_demembrement');
      if (decotes.length > 0) {
        await tx.insert(TABLE_DECOTE_DEMEMBREMENT).values(
          decotes.map((d) => ({
            duree: toInteger(d.libelle, 'decote_demembrement')!,
            decote: toInteger(String(d.nombre), 'decote_demembrement')!,
            scpi_id: scpi.id,
          })),
        );
      }
    }
  });
}

// Lancement direct (npx tsx --env-file=.env src/csv/import.ts) ;
// rien ne s'exécute quand un test importe ce fichier
if (import.meta.main) {
  const config = s3Config();
  const body = await streamCsv(s3Client(config), config.bucket, config.key);

  const rows = pipeline(
    body,
    parse({ columns: true, trim: true, skip_empty_lines: true, bom: true }),
    () => {},
  );

  const pool = createPool();
  const db = createDb(pool);

  try {
    await importScpis(db, rows as AsyncIterable<Record<string, string>>);
  } finally {
    await pool.end(); // sinon le script ne se termine pas
  }
}
