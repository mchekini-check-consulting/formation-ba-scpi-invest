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
import { importScpis } from './import.js';

// Fausse base : enregistre chaque insertion (table + valeurs) ; la SCPI reçoit l'id 1, 2, ...
function fausseBase() {
  const insertions: { table: unknown; valeurs: unknown }[] = [];
  let id = 0;
  const tx = {
    insert: (table: unknown) => ({
      values: (valeurs: unknown) => {
        insertions.push({ table, valeurs });
        return Object.assign(Promise.resolve(), {
          returning: () => Promise.resolve([{ id: ++id }]),
        });
      },
    }),
  };
  const db = { transaction: (fn: (t: typeof tx) => Promise<void>) => fn(tx) };
  return { db: db as unknown as Db, insertions };
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
    const { db, insertions } = fausseBase();
    await importScpis(
      db,
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
    const { db, insertions } = fausseBase();
    await importScpis(
      db,
      lignes(ligneCsv({ Nom: 'A' }), ligneCsv({ Nom: 'B', taux_distribution: '4' })),
    );

    expect(insertions.map((i) => i.table)).toEqual([
      TABLE_SCPI_CATALOG,
      TABLE_SCPI_CATALOG,
      TABLE_TAUX_DISTRIBUTION,
    ]);
    expect(insertions[2].valeurs).toEqual([{ taux: '4', annee: annee - 1, scpi_id: 2 }]);
  });

  it('valeur invalide : erreur qui nomme la colonne, rien après', async () => {
    const { db, insertions } = fausseBase();
    await expect(
      importScpis(db, lignes(ligneCsv({ Nom: 'A', secteurs: 'Spatial,100' }))),
    ).rejects.toThrow('secteurs : secteur inconnu "Spatial"');
    expect(insertions.map((i) => i.table)).toEqual([TABLE_SCPI_CATALOG]);
  });
});
