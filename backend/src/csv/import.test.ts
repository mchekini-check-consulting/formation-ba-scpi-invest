import { describe, expect, it } from 'vitest';
import type { Db } from '../db/index.js';
import {
  TABLE_DECOTE_DEMEMBREMENT,
  TABLE_LOCALISATION,
  TABLE_PRIX_PART,
  TABLE_SCPI_CATALOG,
  TABLE_SECTEURS,
  TABLE_TAUX_DISTRIBUTION,
  TABLE_VALEUR_RECONSTITUTION,
} from '../db/schema.js';
import { convertirLigne, empreinte } from './convert.js';
import { FichierInvalide, importScpis, numeroter, type BilanImport } from './import.js';

// Fausse base : enregistre chaque écriture (opération + table + valeurs) ; les SCPI déjà
// en base sont passées en paramètre ; une SCPI ajoutée reçoit l'id 1, 2, ...
type Existante = { id: number; nom: string; empreinte: string | null };

function fausseBase(existantes: Existante[] = []) {
  const ecritures: { op: 'insert' | 'update' | 'delete'; table: unknown; valeurs?: unknown }[] = [];
  let id = 0;
  const tx = {
    select: () => ({ from: () => Promise.resolve(existantes) }),
    insert: (table: unknown) => ({
      values: (valeurs: unknown) => {
        ecritures.push({ op: 'insert', table, valeurs });
        return Object.assign(Promise.resolve(), {
          returning: () => Promise.resolve([{ id: ++id }]),
        });
      },
    }),
    update: (table: unknown) => ({
      set: (valeurs: unknown) => ({
        where: () => {
          ecritures.push({ op: 'update', table, valeurs });
          return Promise.resolve();
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: () => {
        ecritures.push({ op: 'delete', table });
        return Promise.resolve();
      },
    }),
  };
  const db = { transaction: (fn: (t: typeof tx) => Promise<void>) => fn(tx) };
  return {
    db: db as unknown as Db,
    ecritures,
    get insertions() {
      return ecritures.filter((e) => e.op === 'insert');
    },
  };
}

async function* lignes(...rows: Record<string, string>[]) {
  yield* rows;
}

// Une ligne valide du CSV : colonnes obligatoires remplies, facultatives vides, sauf
// celles précisées
function ligneCsv(valeurs: Record<string, string>): Record<string, string> {
  return {
    Nom: 'SCPI',
    taux_distribution: '',
    minimum_souscription: '1000',
    localisation: 'France,100',
    secteurs: 'Bureaux,100',
    prix_part: '200',
    capitalisation: '1000000',
    Gerant: 'Gérant',
    frais_souscription: '10',
    frais_gestion: '10',
    delai_jouissance: '3',
    frequence_loyers: 'Mensuelle',
    valeur_reconstitution: '',
    iban: 'FR7630001007941234567890185',
    bic: 'BNPAFRPPXXX',
    decote_demembrement: '',
    demembrement: 'Non',
    cashback: '',
    versement_programme: 'Non',
    publicite: 'Texte',
    ...valeurs,
  };
}

// Bilan sans rejet, compteurs précisés
const bilan = (compteurs: Partial<BilanImport>): BilanImport => ({
  lues: 1,
  ajoutees: 0,
  mises_a_jour: 0,
  inchangees: 0,
  supprimees: 0,
  rejetees: 0,
  rejets: [],
  ...compteurs,
});

const annee = new Date().getFullYear();

describe('importScpis', () => {
  it('insère la SCPI puis ses valeurs multiples, rattachées à son id', async () => {
    const base = fausseBase();
    const resultat = await importScpis(
      base.db,
      lignes(
        ligneCsv({
          Nom: 'Transitions Europe',
          taux_distribution: '8.35,8.16',
          minimum_souscription: '5000',
          localisation: 'Pays-Bas,47,Espagne,53',
          secteurs: 'Bureaux,46,Hotels,54',
          prix_part: '200,198.5',
          capitalisation: '289000000',
          Gerant: 'Arkea REIM',
          frais_souscription: '10',
          frais_gestion: '10.5',
          delai_jouissance: '5',
          frequence_loyers: 'Trimestrielle',
          valeur_reconstitution: '205.37',
          decote_demembrement: '3,90,4,85',
          demembrement: 'Oui',
          cashback: '5',
          versement_programme: 'Non',
        }),
      ),
    );

    expect(resultat).toEqual(bilan({ ajoutees: 1 }));
    const insertions = base.insertions;
    expect(insertions.map((i) => i.table)).toEqual([
      TABLE_SCPI_CATALOG,
      TABLE_TAUX_DISTRIBUTION,
      TABLE_PRIX_PART,
      TABLE_VALEUR_RECONSTITUTION,
      TABLE_LOCALISATION,
      TABLE_SECTEURS,
      TABLE_DECOTE_DEMEMBREMENT,
    ]);
    expect(insertions[0].valeurs).toMatchObject({
      nom: 'Transitions Europe',
      minimum_souscription: 5000,
      capitalisation: 289000000,
      frais_gestion: 10.5,
      frequence: 'Trimestrielle',
      demembrement: true,
      versement_programme: false,
    });
    expect((insertions[0].valeurs as { empreinte: string }).empreinte).toMatch(/^[0-9a-f]{64}$/);
    expect(insertions[1].valeurs).toEqual([
      { taux: '8.35', annee: annee - 1, scpi_id: 1 },
      { taux: '8.16', annee: annee - 2, scpi_id: 1 },
    ]);
    expect(insertions[2].valeurs).toEqual([
      { prix: '200', annee: annee - 1, scpi_id: 1 },
      { prix: '198.5', annee: annee - 2, scpi_id: 1 },
    ]);
    expect(insertions[3].valeurs).toEqual([{ valeur: '205.37', annee: annee - 1, scpi_id: 1 }]);
    expect(insertions[4].valeurs).toEqual([
      { pays: 'Pays-Bas', pourcentage: '47', scpi_id: 1 },
      { pays: 'Espagne', pourcentage: '53', scpi_id: 1 },
    ]);
    expect(insertions[5].valeurs).toEqual([
      { secteur: 'Bureaux', pourcentage: '46', scpi_id: 1 },
      { secteur: 'Hôtels', pourcentage: '54', scpi_id: 1 },
    ]);
    expect(insertions[6].valeurs).toEqual([
      { duree: 3, decote: 90, scpi_id: 1 },
      { duree: 4, decote: 85, scpi_id: 1 },
    ]);
  });

  it('colonnes facultatives vides : inconnues, rien d’inséré ; chaque SCPI a son id', async () => {
    const base = fausseBase();
    await importScpis(
      base.db,
      lignes(ligneCsv({ Nom: 'A' }), ligneCsv({ Nom: 'B', taux_distribution: '4' })),
    );
    const insertions = base.insertions;

    expect(insertions[0].valeurs).toMatchObject({ nom: 'A', cashback: null });
    expect(insertions.map((i) => i.table)).toEqual([
      TABLE_SCPI_CATALOG,
      TABLE_PRIX_PART,
      TABLE_LOCALISATION,
      TABLE_SECTEURS,
      TABLE_SCPI_CATALOG,
      TABLE_TAUX_DISTRIBUTION,
      TABLE_PRIX_PART,
      TABLE_LOCALISATION,
      TABLE_SECTEURS,
    ]);
    expect(insertions[5].valeurs).toEqual([{ taux: '4', annee: annee - 1, scpi_id: 2 }]);
  });

  // US-07b, scénario 3
  it('ligne invalide : rejetée avec son numéro et son motif, les autres importées', async () => {
    const base = fausseBase();
    const resultat = await importScpis(
      base.db,
      lignes(
        ligneCsv({ Nom: 'A' }),
        ligneCsv({ Nom: 'B', taux_distribution: 'abc' }),
        ligneCsv({ Nom: 'C', iban: 'FR76123' }),
        ligneCsv({ Nom: 'D', demembrement: 'Oui' }),
        ligneCsv({ Nom: '' }),
        ligneCsv({ Nom: 'E' }),
      ),
    );

    expect(resultat).toEqual(
      bilan({
        lues: 6,
        ajoutees: 2,
        rejetees: 4,
        rejets: [
          { ligne: 3, nom: 'B', motif: 'taux_distribution : nombre attendu, reçu "abc"' },
          { ligne: 4, nom: 'C', motif: 'iban : format invalide' },
          {
            ligne: 5,
            nom: 'D',
            motif: 'decote_demembrement : obligatoire quand demembrement = Oui',
          },
          { ligne: 6, nom: null, motif: 'Nom : champ obligatoire vide' },
        ],
      }),
    );
    const noms = base.insertions
      .filter((i) => i.table === TABLE_SCPI_CATALOG)
      .map((i) => (i.valeurs as { nom: string }).nom);
    expect(noms).toEqual(['A', 'E']);
  });

  it('numéro de ligne : celui posé à la lecture du fichier (lignes vides sautées)', async () => {
    const base = fausseBase();
    const resultat = await importScpis(
      base.db,
      lignes(numeroter(ligneCsv({ Nom: 'A' }), 2), numeroter(ligneCsv({ Nom: 'B', bic: 'X' }), 9)),
    );
    expect(resultat.rejets).toEqual([
      { ligne: 9, nom: 'B', motif: 'bic : format invalide (8 ou 11 caractères attendus)' },
    ]);
  });

  it('ligne rejetée d’une SCPI déjà en base : gardée telle quelle, ni modifiée ni supprimée', async () => {
    const base = fausseBase([
      { id: 7, nom: 'A', empreinte: null },
      { id: 8, nom: 'B', empreinte: null },
    ]);
    const resultat = await importScpis(
      base.db,
      lignes(ligneCsv({ Nom: 'A', prix_part: '' }), ligneCsv({ Nom: 'B' })),
    );

    expect(resultat).toMatchObject({ lues: 2, mises_a_jour: 1, supprimees: 0, rejetees: 1 });
    expect(base.ecritures.filter((e) => e.table === TABLE_SCPI_CATALOG)).toEqual([
      { op: 'update', table: TABLE_SCPI_CATALOG, valeurs: expect.objectContaining({ nom: 'B' }) },
    ]);
  });

  // US-07b, scénario 4
  it('même Nom sur deux lignes : les deux rejetées, doublon signalé', async () => {
    const base = fausseBase();
    const resultat = await importScpis(
      base.db,
      lignes(ligneCsv({ Nom: 'A' }), ligneCsv({ Nom: 'B' }), ligneCsv({ Nom: 'A', Gerant: 'X' })),
    );

    expect(resultat).toEqual(
      bilan({
        lues: 3,
        ajoutees: 1,
        rejetees: 2,
        rejets: [
          { ligne: 2, nom: 'A', motif: 'Nom en double dans le fichier (aussi ligne 4)' },
          { ligne: 4, nom: 'A', motif: 'Nom en double dans le fichier (aussi ligne 2)' },
        ],
      }),
    );
  });

  it('aucune ligne valide : fichier refusé avec les rejets, rien n’est écrit', async () => {
    const base = fausseBase([{ id: 7, nom: 'Z', empreinte: null }]);
    const erreur = await importScpis(base.db, lignes(ligneCsv({ Nom: 'A', bic: '' }))).catch(
      (e: unknown) => e,
    );

    expect(erreur).toBeInstanceOf(FichierInvalide);
    expect(erreur).toMatchObject({
      message: 'Aucune ligne valide : la seule ligne est rejetée, catalogue non modifié',
      detail: { ligne: null, constat: expect.stringMatching(/^Aucune ligne valide/) },
      rejets: [{ ligne: 2, nom: 'A', motif: 'bic : champ obligatoire vide' }],
    });
    expect(base.ecritures).toEqual([]);
  });

  // US-07b, scénario 2 (motifs détaillés : erreurs.test.ts)
  it.each([
    [
      'colonnes absentes',
      { Nom: 'A', prix_part: '200' },
      'Ligne 1 : colonnes absentes de l’en-tête : taux_distribution, minimum_souscription',
    ],
    [
      'mauvais séparateur',
      { 'Nom;taux_distribution': 'A;5' },
      'Ligne 1 : séparateur incorrect : point-virgule détecté dans l’en-tête, virgule attendue',
    ],
  ])('fichier invalide (%s) : refusé entier, rien n’est écrit', async (_cas, ligne, motif) => {
    const base = fausseBase([{ id: 7, nom: 'A', empreinte: null }]);
    const erreur = importScpis(base.db, lignes(ligne));
    await expect(erreur).rejects.toBeInstanceOf(FichierInvalide);
    await expect(erreur).rejects.toThrow(motif);
    expect(base.ecritures).toEqual([]);
  });

  it('fichier illisible (erreur de lecture du CSV) : refusé entier', async () => {
    const base = fausseBase();
    async function* illisible() {
      yield ligneCsv({ Nom: 'A' });
      throw Object.assign(new Error('Invalid Record Length: expect 20, got 3 on line 3'), {
        code: 'CSV_RECORD_INCONSISTENT_FIELDS_LENGTH',
        lines: 3,
        record: ['A', 'B', 'C'],
      });
    }
    const erreur = await importScpis(base.db, illisible()).catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(FichierInvalide);
    expect(erreur).toMatchObject({
      message: expect.stringMatching(/^Ligne 3 : 3 valeurs au lieu de 20\. Cause probable : /),
      detail: { technique: 'Invalid Record Length: expect 20, got 3 on line 3' },
    });
    expect(base.ecritures).toEqual([]);
  });

  // US-07b, scénario 5
  it('erreur technique pendant l’écriture : erreur d’origine relancée, pas FichierInvalide', async () => {
    // L'annulation elle-même est faite par PostgreSQL (transaction) : testée par la
    // fausse transaction qui échoue
    const db = {
      transaction: () => Promise.reject(new Error('connexion perdue')),
    } as unknown as Db;
    const erreur = await importScpis(db, lignes(ligneCsv({ Nom: 'A' }))).catch((e: unknown) => e);
    expect(erreur).toEqual(new Error('connexion perdue'));
    expect(erreur).not.toBeInstanceOf(FichierInvalide);
  });

  it('SCPI en base avec la même empreinte : inchangée, aucune écriture', async () => {
    const ligne = ligneCsv({ Nom: 'A', prix_part: '200' });
    const base = fausseBase([{ id: 7, nom: 'A', empreinte: empreinte(convertirLigne(ligne)) }]);

    const resultat = await importScpis(base.db, lignes(ligne));

    expect(resultat).toEqual(bilan({ inchangees: 1 }));
    expect(base.ecritures).toEqual([]);
  });

  it('SCPI en base avec une autre empreinte : fiche mise à jour, valeurs remplacées', async () => {
    const ancienne = ligneCsv({ Nom: 'A', prix_part: '200' });
    const base = fausseBase([{ id: 7, nom: 'A', empreinte: empreinte(convertirLigne(ancienne)) }]);
    const nouvelle = ligneCsv({ Nom: 'A', prix_part: '210' });

    const resultat = await importScpis(base.db, lignes(nouvelle));

    expect(resultat).toEqual(bilan({ mises_a_jour: 1 }));
    expect(base.ecritures.map((e) => [e.op, e.table])).toEqual([
      ['update', TABLE_SCPI_CATALOG],
      ['delete', TABLE_TAUX_DISTRIBUTION],
      ['delete', TABLE_PRIX_PART],
      ['delete', TABLE_VALEUR_RECONSTITUTION],
      ['delete', TABLE_LOCALISATION],
      ['delete', TABLE_SECTEURS],
      ['delete', TABLE_DECOTE_DEMEMBREMENT],
      ['insert', TABLE_PRIX_PART],
      ['insert', TABLE_LOCALISATION],
      ['insert', TABLE_SECTEURS],
    ]);
    expect(base.ecritures[0].valeurs).toMatchObject({
      nom: 'A',
      empreinte: empreinte(convertirLigne(nouvelle)),
      mise_a_jour: expect.any(Date),
    });
    expect(base.ecritures[7].valeurs).toEqual([{ prix: '210', annee: annee - 1, scpi_id: 7 }]);
  });

  it('SCPI importée avant l’empreinte (vide en base) : mise à jour', async () => {
    const base = fausseBase([{ id: 7, nom: 'A', empreinte: null }]);
    const resultat = await importScpis(base.db, lignes(ligneCsv({ Nom: 'A' })));
    expect(resultat).toEqual(bilan({ mises_a_jour: 1 }));
  });

  it('SCPI en base absentes du fichier : supprimées, comptées au bilan', async () => {
    const base = fausseBase([
      { id: 7, nom: 'A', empreinte: null },
      { id: 8, nom: 'B', empreinte: null },
      { id: 9, nom: 'C', empreinte: null },
    ]);

    const resultat = await importScpis(base.db, lignes(ligneCsv({ Nom: 'B' })));

    expect(resultat).toEqual(bilan({ mises_a_jour: 1, supprimees: 2 }));
    expect(base.ecritures.at(-1)).toEqual({ op: 'delete', table: TABLE_SCPI_CATALOG });
  });

  // US-07b, scénario 2 (cas du fichier vide, US-07a)
  it('fichier sans aucune SCPI : refusé, rien n’est supprimé', async () => {
    const base = fausseBase([{ id: 7, nom: 'A', empreinte: null }]);
    const erreur = importScpis(base.db, lignes());
    await expect(erreur).rejects.toBeInstanceOf(FichierInvalide);
    await expect(erreur).rejects.toThrow('Fichier vide : aucune SCPI, catalogue non modifié');
    expect(base.ecritures).toEqual([]);
  });
});
