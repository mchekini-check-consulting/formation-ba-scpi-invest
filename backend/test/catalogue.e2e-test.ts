import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { creerCatalogueService } from '../src/catalogue/service.js';
import { importScpis } from '../src/csv/import.js';
import { depotCatalogue } from '../src/db/depots.js';
import { createDb, createPool } from '../src/db/index.js';
import { migrate } from '../src/migrate.js';

// US-08 (SCPI-25) : liste du Catalogue lue sur un PostgreSQL 16 jetable, alimenté par
// l'import CSV (US-07a). Docker requis.
async function* lignes(...rows: Record<string, string>[]) {
  yield* rows;
}

function scpi(nom: string, taux: string, autres: Record<string, string> = {}) {
  return {
    Nom: nom,
    taux_distribution: taux,
    minimum_souscription: '1000',
    localisation: 'Allemagne,30,France,70',
    secteurs: 'Bureaux,40,Sante,60',
    prix_part: '200',
    capitalisation: '150000000',
    Gerant: `Gérant ${nom}`,
    frais_souscription: '10',
    frais_gestion: '12',
    delai_jouissance: '4',
    frequence_loyers: 'Trimestrielle',
    valeur_reconstitution: '215.5',
    iban: '',
    bic: '',
    decote_demembrement: '',
    demembrement: 'Non',
    cashback: '',
    versement_programme: 'Non',
    publicite: '',
    ...autres,
  };
}

describe('Catalogue (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let pool: Pool;
  let service: ReturnType<typeof creerCatalogueService>;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16').start();
    pool = createPool(postgres.getConnectionUri());
    await migrate(pool);
    const db = createDb(pool);
    service = creerCatalogueService(depotCatalogue(db));
  });

  afterAll(async () => {
    await pool?.end();
    await postgres?.stop();
  });

  it('catalogue vide : aucune SCPI, date de mise à jour non renseignée', async () => {
    expect(await service.lister()).toMatchObject({
      scpis: [],
      total: 0,
      nombrePages: 1,
      misAJourLe: null,
    });
  });

  it('scénarios 1 à 4 : tri par taux N-1, 12 par page, N/C en fin de liste', async () => {
    const db = createDb(pool);
    // 13 SCPI avec un taux (de 1 % à 13 %) + 1 SCPI récente sans taux ni données facultatives
    const avecTaux = Array.from({ length: 13 }, (_, i) => scpi(`SCPI ${i + 1}`, `${i + 1},0.5`));
    const recente = scpi('Nouvelle', '', {
      capitalisation: '',
      Gerant: '',
      localisation: '',
      secteurs: '',
    });
    await importScpis(db, lignes(recente, ...avecTaux));
    const fin = new Date('2026-11-05T02:00:00Z');
    await pool.query(
      `insert into import_rapport (statut, fin) values ('reussi', $1), ('echec', now())`,
      [fin],
    );

    const page1 = await service.lister();
    expect(page1).toMatchObject({ total: 14, nombrePages: 2, misAJourLe: fin });
    expect(page1.scpis).toHaveLength(12);
    expect(page1.scpis.map((s) => s.tauxDistribution)).toEqual([
      13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2,
    ]);
    expect(page1.scpis[0]).toEqual({
      id: expect.any(Number),
      nom: 'SCPI 13',
      gerant: 'Gérant SCPI 13',
      tauxDistribution: 13,
      capitalisation: 150000000,
      categorie: 'Santé',
      zoneGeographique: 'France',
    });

    const page2 = await service.lister('2');
    expect(page2.scpis.map((s) => s.nom)).toEqual(['SCPI 1', 'Nouvelle']);
    // Données manquantes : null (affichées N/C), jamais 0
    expect(page2.scpis[1]).toMatchObject({
      tauxDistribution: null,
      capitalisation: null,
      gerant: null,
      categorie: null,
      zoneGeographique: null,
    });
  });
});
