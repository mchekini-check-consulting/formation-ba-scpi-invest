import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { importScpis } from '../src/csv/import.js';
import { depotFiche } from '../src/db/depots.js';
import { createDb, createPool, type Db } from '../src/db/index.js';
import { creerFicheService } from '../src/fiche/service.js';
import { migrate } from '../src/migrate.js';

// US-02 : fiche d'une SCPI lue sur un PostgreSQL 16 jetable, alimenté par l'import CSV.
// Docker requis.
async function* lignes(...rows: Record<string, string>[]) {
  yield* rows;
}

function scpi(nom: string, autres: Record<string, string> = {}) {
  return {
    Nom: nom,
    taux_distribution: '5.10,5.35',
    minimum_souscription: '1020',
    localisation: 'Allemagne,30,France,70',
    secteurs: 'Bureaux,9,Sante,91',
    prix_part: '204,200',
    capitalisation: '3200000000',
    Gerant: 'Euryale AM',
    frais_souscription: '10.51',
    frais_gestion: '8.4',
    delai_jouissance: '4',
    frequence_loyers: 'Trimestrielle',
    valeur_reconstitution: '199.14',
    iban: 'FR7630001007941234567890185',
    bic: 'BNPAFRPPXXX',
    decote_demembrement: '',
    demembrement: 'Non',
    cashback: '3',
    versement_programme: 'Non',
    publicite: `Texte ${nom}`,
    ...autres,
  };
}

describe('Fiche SCPI (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Db;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16').start();
    pool = createPool(postgres.getConnectionUri());
    await migrate(pool);
    db = createDb(pool);
  });

  afterAll(async () => {
    await pool?.end();
    await postgres?.stop();
  });

  const idDe = async (nom: string) =>
    (await pool.query<{ id: number }>('select id from scpi_catalog where nom = $1', [nom])).rows[0]
      .id;

  it('fiche complète lue en base, sans IBAN ni BIC', async () => {
    await importScpis(db, lignes(scpi('Pierval Santé'), scpi('Vide')));
    // L'import refuse les données obligatoires vides : on vide donc la SCPI « Vide » en base,
    // comme pour une ancienne SCPI dont les informations seraient absentes.
    const idVide = await idDe('Vide');
    for (const table of [
      'scpi_taux_distribution',
      'scpi_localisation',
      'scpi_secteurs',
      'scpi_prix_part',
      'scpi_valeur_recon',
    ]) {
      await pool.query(`delete from ${table} where scpi_id = $1`, [idVide]);
    }
    await pool.query(
      'update scpi_catalog set minimum_souscription = null, publicite = null where id = $1',
      [idVide],
    );
    const annee = new Date().getFullYear() - 1;
    const fiche = await creerFicheService(depotFiche(db)).lire(String(await idDe('Pierval Santé')));

    expect(fiche).toEqual({
      id: expect.any(Number),
      nom: 'Pierval Santé',
      gerant: 'Euryale AM',
      capitalisation: 3_200_000_000,
      minimum: 1020,
      minimumParts: 5,
      fraisSouscription: 10.51,
      fraisGestion: 8.4,
      delaiJouissance: 4,
      frequence: 'Trimestrielle',
      cashback: 3,
      versementProgramme: false,
      publicite: 'Texte Pierval Santé',
      prixPart: { annee, valeur: 204 },
      tauxDistribution: { annee, valeur: 5.1 },
      valeurReconstitution: { annee, valeur: 199.14 },
      historiquePrix: [
        { annee: annee - 1, valeur: 200 },
        { annee, valeur: 204 },
      ],
      historiqueTaux: [
        { annee: annee - 1, valeur: 5.35 },
        { annee, valeur: 5.1 },
      ],
      repartitionGeographique: [
        { libelle: 'France', part: 70 },
        { libelle: 'Allemagne', part: 30 },
      ],
      repartitionSectorielle: [
        { libelle: 'Santé', part: 91 },
        { libelle: 'Bureaux', part: 9 },
      ],
    });
    expect(JSON.stringify(fiche)).not.toMatch(/FR76|BNPA/);
  });

  it('données absentes : null et listes vides', async () => {
    const fiche = await creerFicheService(depotFiche(db)).lire(String(await idDe('Vide')));
    expect(fiche).toMatchObject({
      minimum: null,
      minimumParts: null,
      publicite: null,
      prixPart: null,
      tauxDistribution: null,
      valeurReconstitution: null,
      historiquePrix: [],
      historiqueTaux: [],
      repartitionGeographique: [],
      repartitionSectorielle: [],
    });
  });

  it('SCPI retirée par un import : « plus disponible » ; inconnue : « pas disponible »', async () => {
    const id = await idDe('Vide');
    await importScpis(db, lignes(scpi('Pierval Santé')));
    const service = creerFicheService(depotFiche(db));

    await expect(service.lire(String(id))).rejects.toMatchObject({
      status: 404,
      details: { statut: 'supprimee' },
    });
    await expect(service.lire('99999')).rejects.toMatchObject({
      status: 404,
      details: { statut: 'introuvable' },
    });
  });
});
