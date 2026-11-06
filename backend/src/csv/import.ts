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
import type { RejetImport } from '../db/schema.js';
import { COLONNES, convertirLigne, empreinte, type ScpiConvertie } from './convert.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Lignes = AsyncIterable<Record<string, string>>;

// Compteurs du rapport d'exécution (US-07a) et lignes rejetées avec leur motif (US-07b)
export type BilanImport = {
  lues: number;
  ajoutees: number;
  mises_a_jour: number;
  inchangees: number;
  supprimees: number;
  rejetees: number;
  rejets: RejetImport[];
};

// Fichier entier refusé (US-07b, scénario 2) : catalogue non modifié. rejets : lignes
// rejetées quand c'est parce qu'aucune n'est valide.
export class FichierInvalide extends Error {
  constructor(
    message: string,
    readonly rejets: RejetImport[] = [],
  ) {
    super(message);
    this.name = 'FichierInvalide';
  }
}

// Numéro de la ligne dans le fichier (en-tête = 1), posé par la lecture du CSV (source.ts).
// Propriété cachée : n'apparaît ni dans les colonnes ni dans les comparaisons des tests.
const NUMERO_LIGNE = Symbol('numéro de ligne');

export function numeroter(record: Record<string, string>, numero: number) {
  return Object.defineProperty(record, NUMERO_LIGNE, { value: numero, enumerable: false });
}

type Ligne = { numero: number; row: Record<string, string> };

// Lit tout le fichier (quelques centaines de SCPI au plus) avant d'écrire quoi que ce
// soit : les doublons ne se voient qu'une fois toutes les lignes lues.
// Refuse le fichier entier : illisible (guillemets, nombre de valeurs, encodage autre
// qu'UTF-8 : erreurs levées par la lecture, source.ts), colonnes absentes (souvent un
// mauvais séparateur), aucune SCPI.
async function lireFichier(rows: Lignes): Promise<Ligne[]> {
  const lignes: Ligne[] = [];
  try {
    for await (const row of rows) {
      const numero = (row as { [NUMERO_LIGNE]?: number })[NUMERO_LIGNE] ?? lignes.length + 2;
      lignes.push({ numero, row });
    }
  } catch (err) {
    throw new FichierInvalide(`fichier illisible : ${err instanceof Error ? err.message : err}`);
  }

  if (lignes.length === 0) {
    throw new FichierInvalide('fichier sans aucune SCPI : catalogue non modifié');
  }
  const absentes = COLONNES.filter((c) => !(c in lignes[0].row));
  if (absentes.length > 0) {
    throw new FichierInvalide(
      `colonnes absentes (séparateur attendu : virgule) : ${absentes.join(', ')}`,
    );
  }
  return lignes;
}

// Noms présents sur plusieurs lignes -> numéros de ces lignes
function doublons(lignes: Ligne[]): Map<string, number[]> {
  const parNom = new Map<string, number[]>();
  for (const { numero, row } of lignes) {
    if (row.Nom) parNom.set(row.Nom, [...(parNom.get(row.Nom) ?? []), numero]);
  }
  return new Map([...parNom].filter(([, numeros]) => numeros.length > 1));
}

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
// US-07b : ligne invalide ou Nom en double : ligne rejetée (numéro et motif au bilan), les
// autres sont importées ; une SCPI déjà en base dont la ligne est rejetée est gardée telle
// quelle. Fichier invalide, ou sans aucune ligne valide : FichierInvalide, rien n'est écrit.
// Exportée pour les tests : reçoit la connexion et les lignes, sans R2 ni pool.
export async function importScpis(db: Db, rows: Lignes): Promise<BilanImport> {
  const lignes = await lireFichier(rows);
  const enDouble = doublons(lignes);

  const bilan: BilanImport = {
    lues: lignes.length,
    ajoutees: 0,
    mises_a_jour: 0,
    inchangees: 0,
    supprimees: 0,
    rejetees: 0,
    rejets: [],
  };
  const presentes = new Set<string>(); // Noms lus dans le fichier, lignes rejetées comprises
  const valides: ScpiConvertie[] = [];

  // Contrôles avant la transaction : une ligne rejetée n'annule pas l'import
  for (const { numero, row } of lignes) {
    if (row.Nom) presentes.add(row.Nom);
    const autres = enDouble.get(row.Nom)?.filter((n) => n !== numero);
    try {
      if (autres)
        throw new Error(`Nom en double dans le fichier (aussi ligne ${autres.join(', ')})`);
      valides.push(convertirLigne(row));
    } catch (err) {
      bilan.rejets.push({ ligne: numero, nom: row.Nom || null, motif: (err as Error).message });
    }
  }
  bilan.rejetees = bilan.rejets.length;
  if (valides.length === 0) {
    throw new FichierInvalide('aucune ligne valide : catalogue non modifié', bilan.rejets);
  }

  // Une seule transaction pour tout le fichier : sur une erreur technique (connexion
  // perdue...), rien n'est enregistré (rollback, US-07b scénario 5)
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

    for (const scpi of valides) {
      const signature = empreinte(scpi);
      const existante = existantes.get(scpi.fiche.nom);

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
      await insererValeurs(tx, id, scpi);
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
