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
    iban: 'FR7630001007941234567890185',
    bic: 'BNPAFRPPXXX',
    decote_demembrement: '',
    demembrement: 'Non',
    cashback: '',
    versement_programme: 'Non',
    publicite: `Texte ${nom}`,
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
    // 13 SCPI avec un taux (de 1 % à 13 %) + 1 SCPI récente sans taux (seule donnée
    // facultative à l'import, US-07c)
    const avecTaux = Array.from({ length: 13 }, (_, i) => scpi(`SCPI ${i + 1}`, `${i + 1},0.5`));
    await importScpis(db, lignes(scpi('Nouvelle', ''), ...avecTaux));
    // Société de gestion, capitalisation, secteurs et pays absents en base (données
    // antérieures aux contrôles de l'import) : affichés N/C, jamais 0
    await pool.query(
      `update scpi_catalog set gerant = ' ', capitalisation = null where nom = 'Nouvelle'`,
    );
    for (const table of ['scpi_secteurs', 'scpi_localisation']) {
      await pool.query(
        `delete from ${table} where scpi_id = (select id from scpi_catalog where nom = 'Nouvelle')`,
      );
    }
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

  it('US-10 : filtres combinés, valeurs du panneau, donnée manquante jamais égale à 0', async () => {
    const db = createDb(pool);
    await pool.query('delete from scpi_catalog');
    await importScpis(
      db,
      lignes(
        scpi('Alpha', '5,4', {
          secteurs: 'Bureaux,80,Sante,20',
          localisation: 'France,100',
          capitalisation: '50000000',
          prix_part: '180,190',
          Gerant: 'Gestion A',
        }),
        scpi('Beta', '6,5', {
          secteurs: 'Commerces,100',
          localisation: 'Espagne,100',
          capitalisation: '4000000000',
          frais_souscription: '0',
          minimum_souscription: '5000',
          Gerant: 'Gestion B',
        }),
        scpi('Gamma', '', {
          secteurs: 'Sante,100',
          localisation: 'France,50,Espagne,50',
          capitalisation: '700000000',
          Gerant: 'Gestion A',
        }),
      ),
    );
    const noms = async (requete: Record<string, unknown>) =>
      (await service.lister('1', requete)).scpis.map((s) => s.nom);

    // Secteur présent, même minoritaire (Alpha : 20 % Santé)
    expect(await noms({ categorie: 'Santé' })).toEqual(['Alpha', 'Gamma']);
    // Plusieurs valeurs d'un même filtre : OU
    expect(await noms({ categorie: ['Santé', 'Commerces'] })).toEqual(['Beta', 'Alpha', 'Gamma']);
    // Plusieurs filtres : ET ; pays présent, même à 50 %
    expect(await noms({ categorie: 'Santé', pays: 'Espagne' })).toEqual(['Gamma']);
    expect(await noms({ gerant: 'Gestion A' })).toEqual(['Alpha', 'Gamma']);
    expect(await noms({ capitalisation: ['moins-100m', 'plus-3md'] })).toEqual(['Beta', 'Alpha']);
    // Bornes incluses ; Gamma sans taux N-1 exclue d'un filtre sur le taux
    expect(await noms({ tauxMin: '4', tauxMax: '6' })).toEqual(['Beta', 'Alpha']);
    expect(await noms({ tauxMax: '5' })).toEqual(['Alpha']);
    // Prix de la part le plus récent : première valeur du CSV (Alpha : 180 €)
    expect(await noms({ prixMax: '179' })).toEqual([]);
    expect(await noms({ prixMin: '180', prixMax: '180' })).toEqual(['Alpha']);
    expect(await noms({ fraisMax: '0' })).toEqual(['Beta']);
    expect(await noms({ minimumMin: '2000' })).toEqual(['Beta']);
    expect(await service.lister('1', { categorie: 'Logistique' })).toMatchObject({
      scpis: [],
      total: 0,
    });
    expect((await service.lister('1', { categorie: 'Santé' })).total).toBe(2);

    expect(await service.filtres()).toEqual({
      categories: ['Bureaux', 'Commerces', 'Santé'],
      pays: ['Espagne', 'France'],
      gerants: ['Gestion A', 'Gestion B'],
      taux: { min: 5, max: 6 },
      prix: { min: 180, max: 200 },
      frais: { min: 0, max: 10 },
      minimum: { min: 1000, max: 5000 },
      capitalisations: expect.any(Array),
      anneeTaux: new Date().getFullYear() - 1,
    });
  });
});
