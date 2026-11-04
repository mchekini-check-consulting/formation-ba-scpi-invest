import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import {
  TABLE_SCPI_CATALOG,
  TABLE_TAUX_DISTRIBUTION,
  TABLE_DECOTE_DEMEMBREMENT,
  TABLE_LOCALISATION,
  TABLE_PRIX_PART,
  TABLE_SECTEURS,
  TABLE_VALEUR_RECONSTITUTION,
} from '../db/schema.js';
import { convertirLigne, empreinte, type ScpiConvertie } from './convert.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

// Compteurs du rapport d'exécution (US-07a)
export type BilanImport = {
  lues: number;
  ajoutees: number;
  mises_a_jour: number;
  inchangees: number;
  supprimees: number;
};

// Tables des valeurs multiples d'une SCPI : vidées puis réécrites à chaque mise à jour
const TABLES_VALEURS = [
  TABLE_TAUX_DISTRIBUTION,
  TABLE_PRIX_PART,
  TABLE_VALEUR_RECONSTITUTION,
  TABLE_LOCALISATION,
  TABLE_SECTEURS,
  TABLE_DECOTE_DEMEMBREMENT,
] as const;

// Écrit en base les lignes du CSV des SCPI (une ligne = une SCPI et ses valeurs multiples).
// Clé = Nom. SCPI absente : ajoutée ; même empreinte qu'en base : inchangée, rien n'est
// écrit ; empreinte différente : fiche mise à jour, valeurs multiples remplacées.
// SCPI en base absentes du fichier : supprimées, avec leurs valeurs multiples (cascade).
// Fichier sans aucune SCPI : refusé, pour ne jamais vider le catalogue par erreur.
// Exportée pour les tests : reçoit la connexion et les lignes, sans R2 ni pool.
export async function importScpis(
  db: Db,
  rows: AsyncIterable<Record<string, string>>,
): Promise<BilanImport> {
  const bilan: BilanImport = {
    lues: 0,
    ajoutees: 0,
    mises_a_jour: 0,
    inchangees: 0,
    supprimees: 0,
  };

  // Une seule transaction pour tout le fichier :
  // si une ligne est en erreur, rien n'est enregistré (rollback)
  await db.transaction(async (tx) => {
    // Empreintes des SCPI déjà en base, en une requête (catalogue de quelques centaines de SCPI)
    const existantes = new Map(
      (
        await tx
          .select({
            id: TABLE_SCPI_CATALOG.id,
            nom: TABLE_SCPI_CATALOG.nom,
            empreinte: TABLE_SCPI_CATALOG.empreinte,
          })
          .from(TABLE_SCPI_CATALOG)
      ).map((s) => [s.nom, s]),
    );

    const presentes = new Set<string>(); // Noms lus dans le fichier

    for await (const row of rows) {
      bilan.lues++;
      const scpi = convertirLigne(row);
      const signature = empreinte(scpi);
      const existante = existantes.get(scpi.fiche.nom);
      presentes.add(scpi.fiche.nom);

      if (existante?.empreinte === signature) {
        bilan.inchangees++;
        continue;
      }

      let id: number;
      if (existante) {
        await tx
          .update(TABLE_SCPI_CATALOG)
          .set({ ...scpi.fiche, empreinte: signature, mise_a_jour: new Date() })
          .where(eq(TABLE_SCPI_CATALOG.id, existante.id));
        for (const table of TABLES_VALEURS) {
          await tx.delete(table).where(eq(table.scpi_id, existante.id));
        }
        id = existante.id;
        bilan.mises_a_jour++;
      } else {
        const [ajoutee] = await tx
          .insert(TABLE_SCPI_CATALOG)
          .values({ ...scpi.fiche, empreinte: signature })
          .returning({ id: TABLE_SCPI_CATALOG.id }); // pour récupérer l'id créé
        id = ajoutee.id;
        bilan.ajoutees++;
      }
      // Même Nom plus loin dans le fichier : traité comme une mise à jour (rejet : US-07b)
      existantes.set(scpi.fiche.nom, { id, nom: scpi.fiche.nom, empreinte: signature });

      await insererValeurs(tx, id, scpi);
    }

    if (bilan.lues === 0) {
      throw new Error('fichier sans aucune SCPI : catalogue non modifié');
    }

    const absentes = [...existantes.values()].filter((s) => !presentes.has(s.nom));
    if (absentes.length > 0) {
      await tx.delete(TABLE_SCPI_CATALOG).where(
        inArray(
          TABLE_SCPI_CATALOG.id,
          absentes.map((s) => s.id),
        ),
      );
      bilan.supprimees = absentes.length;
    }
  });

  return bilan;
}

async function insererValeurs(tx: Tx, scpi_id: number, scpi: ScpiConvertie) {
  // Colonnes numeric : Drizzle attend du texte (pas d'arrondi en nombre flottant)
  if (scpi.taux.length > 0) {
    await tx
      .insert(TABLE_TAUX_DISTRIBUTION)
      .values(scpi.taux.map((t) => ({ taux: String(t.valeur), annee: t.annee, scpi_id })));
  }
  if (scpi.prix.length > 0) {
    await tx
      .insert(TABLE_PRIX_PART)
      .values(scpi.prix.map((p) => ({ prix: String(p.valeur), annee: p.annee, scpi_id })));
  }
  if (scpi.valeurs.length > 0) {
    await tx
      .insert(TABLE_VALEUR_RECONSTITUTION)
      .values(scpi.valeurs.map((v) => ({ valeur: String(v.valeur), annee: v.annee, scpi_id })));
  }
  if (scpi.localisations.length > 0) {
    await tx.insert(TABLE_LOCALISATION).values(
      scpi.localisations.map((l) => ({
        pays: l.pays,
        pourcentage: String(l.pourcentage),
        scpi_id,
      })),
    );
  }
  if (scpi.secteurs.length > 0) {
    await tx.insert(TABLE_SECTEURS).values(
      scpi.secteurs.map((s) => ({
        secteur: s.secteur,
        pourcentage: String(s.pourcentage),
        scpi_id,
      })),
    );
  }
  if (scpi.decotes.length > 0) {
    await tx.insert(TABLE_DECOTE_DEMEMBREMENT).values(scpi.decotes.map((d) => ({ ...d, scpi_id })));
  }
}
