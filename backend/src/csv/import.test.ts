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
import { importScpis } from './import.js';

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

// Une ligne du CSV, toutes colonnes vides sauf celles précisées
function ligneCsv(valeurs: Record<string, string>): Record<string, string> {
  const colonnes = [
    'Nom',
    'taux_distribution',
    'minimum_souscription',
    'localisation',
    'secteurs',
    'prix_part',
    'capitalisation',
    'Gerant',
    'frais_souscription',
    'frais_gestion',
    'delai_jouissance',
    'frequence_loyers',
    'valeur_reconstitution',
    'iban',
    'bic',
    'decote_demembrement',
    'demembrement',
    'cashback',
    'versement_programme',
    'publicite',
  ];
  return { ...Object.fromEntries(colonnes.map((c) => [c, ''])), ...valeurs };
}

const annee = new Date().getFullYear();

describe('importScpis', () => {
  it('insère la SCPI puis ses valeurs multiples, rattachées à son id', async () => {
    const base = fausseBase();
    const bilan = await importScpis(
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

    expect(bilan).toEqual({ lues: 1, ajoutees: 1, mises_a_jour: 0, inchangees: 0, supprimees: 0 });
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

  it('cases multiples vides : seule la SCPI est insérée ; chaque SCPI a son id', async () => {
    const base = fausseBase();
    await importScpis(
      base.db,
      lignes(ligneCsv({ Nom: 'A' }), ligneCsv({ Nom: 'B', taux_distribution: '4' })),
    );
    const insertions = base.insertions;

    expect(insertions.map((i) => i.table)).toEqual([
      TABLE_SCPI_CATALOG,
      TABLE_SCPI_CATALOG,
      TABLE_TAUX_DISTRIBUTION,
    ]);
    expect(insertions[2].valeurs).toEqual([{ taux: '4', annee: annee - 1, scpi_id: 2 }]);
  });

  it('valeur invalide : erreur qui nomme la colonne, rien après', async () => {
    const base = fausseBase();
    await expect(
      importScpis(
        base.db,
        lignes(ligneCsv({ Nom: 'A' }), ligneCsv({ Nom: 'B', secteurs: 'Spatial,100' })),
      ),
    ).rejects.toThrow('secteurs : secteur inconnu "Spatial"');
    expect(base.ecritures.map((i) => i.table)).toEqual([TABLE_SCPI_CATALOG]);
  });

  it('SCPI en base avec la même empreinte : inchangée, aucune écriture', async () => {
    const ligne = ligneCsv({ Nom: 'A', prix_part: '200' });
    const base = fausseBase([{ id: 7, nom: 'A', empreinte: empreinte(convertirLigne(ligne)) }]);

    const bilan = await importScpis(base.db, lignes(ligne));

    expect(bilan).toEqual({ lues: 1, ajoutees: 0, mises_a_jour: 0, inchangees: 1, supprimees: 0 });
    expect(base.ecritures).toEqual([]);
  });

  it('SCPI en base avec une autre empreinte : fiche mise à jour, valeurs remplacées', async () => {
    const ancienne = ligneCsv({ Nom: 'A', prix_part: '200' });
    const base = fausseBase([{ id: 7, nom: 'A', empreinte: empreinte(convertirLigne(ancienne)) }]);
    const nouvelle = ligneCsv({ Nom: 'A', prix_part: '210' });

    const bilan = await importScpis(base.db, lignes(nouvelle));

    expect(bilan).toEqual({ lues: 1, ajoutees: 0, mises_a_jour: 1, inchangees: 0, supprimees: 0 });
    expect(base.ecritures.map((e) => [e.op, e.table])).toEqual([
      ['update', TABLE_SCPI_CATALOG],
      ['delete', TABLE_TAUX_DISTRIBUTION],
      ['delete', TABLE_PRIX_PART],
      ['delete', TABLE_VALEUR_RECONSTITUTION],
      ['delete', TABLE_LOCALISATION],
      ['delete', TABLE_SECTEURS],
      ['delete', TABLE_DECOTE_DEMEMBREMENT],
      ['insert', TABLE_PRIX_PART],
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
    const bilan = await importScpis(base.db, lignes(ligneCsv({ Nom: 'A' })));
    expect(bilan).toEqual({ lues: 1, ajoutees: 0, mises_a_jour: 1, inchangees: 0, supprimees: 0 });
  });

  it('même Nom deux fois dans le fichier : la seconde ligne met à jour la première', async () => {
    const base = fausseBase();
    const bilan = await importScpis(
      base.db,
      lignes(ligneCsv({ Nom: 'A' }), ligneCsv({ Nom: 'A', Gerant: 'X' })),
    );
    expect(bilan).toEqual({ lues: 2, ajoutees: 1, mises_a_jour: 1, inchangees: 0, supprimees: 0 });
  });

  it('SCPI en base absentes du fichier : supprimées, comptées au bilan', async () => {
    const base = fausseBase([
      { id: 7, nom: 'A', empreinte: null },
      { id: 8, nom: 'B', empreinte: null },
      { id: 9, nom: 'C', empreinte: null },
    ]);

    const bilan = await importScpis(base.db, lignes(ligneCsv({ Nom: 'B' })));

    expect(bilan).toEqual({ lues: 1, ajoutees: 0, mises_a_jour: 1, inchangees: 0, supprimees: 2 });
    expect(base.ecritures.at(-1)).toEqual({ op: 'delete', table: TABLE_SCPI_CATALOG });
  });

  it('fichier sans aucune SCPI : refusé, rien n’est supprimé', async () => {
    const base = fausseBase([{ id: 7, nom: 'A', empreinte: null }]);
    await expect(importScpis(base.db, lignes())).rejects.toThrow(
      'fichier sans aucune SCPI : catalogue non modifié',
    );
    expect(base.ecritures).toEqual([]);
  });
});
