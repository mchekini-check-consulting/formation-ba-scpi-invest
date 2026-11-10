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

  it('US-11 : tri dans les deux sens, égalité alphabétique, valeur manquante en fin', async () => {
    const db = createDb(pool);
    await pool.query('delete from scpi_catalog');
    // Alpha et Delta : mêmes valeurs partout (égalité) ; Gamma : aucune valeur renseignée
    const commun = { localisation: 'France,100', secteurs: 'Bureaux,100' };
    await importScpis(
      db,
      lignes(
        scpi('Delta', '5', { ...commun, capitalisation: '300000000', Gerant: 'Zeta Gestion' }),
        scpi('Gamma', ''),
        scpi('Alpha', '5', { ...commun, capitalisation: '300000000', Gerant: 'Zeta Gestion' }),
        scpi('Beta', '7', {
          localisation: 'Espagne,100',
          secteurs: 'Commerces,100',
          capitalisation: '100000000',
          Gerant: 'Abc Gestion',
        }),
      ),
    );
    await pool.query(
      `update scpi_catalog set gerant = ' ', capitalisation = null where nom = 'Gamma'`,
    );
    for (const table of ['scpi_secteurs', 'scpi_localisation']) {
      await pool.query(
        `delete from ${table} where scpi_id = (select id from scpi_catalog where nom = 'Gamma')`,
      );
    }
    const noms = async (requete: Record<string, unknown>) =>
      (await service.lister('1', requete)).scpis.map((s) => s.nom);

    // Scénario 1 : par défaut, taux N-1 décroissant
    expect(await noms({})).toEqual(['Beta', 'Alpha', 'Delta', 'Gamma']);
    // Scénarios 2, 3, 5 et 6 : les deux sens, égalité -> A à Z, manquant toujours en fin
    const attendus: Record<string, string[]> = {
      'taux-asc': ['Alpha', 'Delta', 'Beta', 'Gamma'],
      'taux-desc': ['Beta', 'Alpha', 'Delta', 'Gamma'],
      'capitalisation-asc': ['Beta', 'Alpha', 'Delta', 'Gamma'],
      'capitalisation-desc': ['Alpha', 'Delta', 'Beta', 'Gamma'],
      'pays-asc': ['Beta', 'Alpha', 'Delta', 'Gamma'],
      'pays-desc': ['Alpha', 'Delta', 'Beta', 'Gamma'],
      'secteur-asc': ['Alpha', 'Delta', 'Beta', 'Gamma'],
      'secteur-desc': ['Beta', 'Alpha', 'Delta', 'Gamma'],
      'gerant-asc': ['Beta', 'Alpha', 'Delta', 'Gamma'],
      'gerant-desc': ['Alpha', 'Delta', 'Beta', 'Gamma'],
      // Scénario 4 : par nom
      'nom-asc': ['Alpha', 'Beta', 'Delta', 'Gamma'],
      'nom-desc': ['Gamma', 'Delta', 'Beta', 'Alpha'],
    };
    for (const [tri, ordre] of Object.entries(attendus)) {
      expect({ tri, ordre: await noms({ tri }) }).toEqual({ tri, ordre });
    }
    // Filtres actifs conservés
    expect(await noms({ tri: 'capitalisation-desc', pays: 'France' })).toEqual(['Alpha', 'Delta']);
  });

  it('recherche : nom qui contient le texte, majuscules ignorées, % et _ cherchés tels quels', async () => {
    const db = createDb(pool);
    await pool.query('delete from scpi_catalog');
    await importScpis(
      db,
      lignes(
        scpi('Pierre Plus', '4'),
        scpi('Rivoli Pierre', '6'),
        scpi('Epargne 100%', '5'),
        scpi('Autre', '5'),
      ),
    );
    const noms = async (q: string) => (await service.rechercher(q)).scpis.map((s) => s.nom);

    // Même tri que le Catalogue : taux N-1 décroissant
    expect(await noms('PIERRE')).toEqual(['Rivoli Pierre', 'Pierre Plus']);
    // Même carte que le Catalogue, avec l'année du taux
    expect(await service.rechercher('rivoli')).toEqual({
      scpis: [
        {
          id: expect.any(Number),
          nom: 'Rivoli Pierre',
          gerant: 'Gérant Rivoli Pierre',
          tauxDistribution: 6,
          capitalisation: 150000000,
          categorie: 'Santé',
          zoneGeographique: 'France',
        },
      ],
      anneeTaux: new Date().getFullYear() - 1,
    });
    expect(await noms('100%')).toEqual(['Epargne 100%']);
    expect(await noms('%')).toEqual(['Epargne 100%']);
    expect(await noms('_')).toEqual([]);
    expect(await noms('introuvable')).toEqual([]);
  });

  it('recherche : 20 SCPI au plus ; à taux égal, triées par nom', async () => {
    const db = createDb(pool);
    await pool.query('delete from scpi_catalog');
    const nombreuses = Array.from({ length: 25 }, (_, i) =>
      scpi(`SCPI ${String(i + 1).padStart(2, '0')}`, '5'),
    );
    await importScpis(db, lignes(...nombreuses));
    const trouvees = (await service.rechercher('scpi')).scpis;
    expect(trouvees).toHaveLength(20);
    expect(trouvees[0].nom).toBe('SCPI 01');
    expect(trouvees[19].nom).toBe('SCPI 20');
    // US-12 : la limite de 20 s'applique après le tri choisi
    const parNomDecroissant = (await service.rechercher('scpi', { tri: 'nom-desc' })).scpis;
    expect(parNomDecroissant[0].nom).toBe('SCPI 25');
    expect(parNomDecroissant[19].nom).toBe('SCPI 06');
  });

  it('US-12 : recherche combinée aux filtres et au tri', async () => {
    const db = createDb(pool);
    await pool.query('delete from scpi_catalog');
    await importScpis(
      db,
      lignes(
        scpi('Pierre Alpha', '6', { localisation: 'France,100', capitalisation: '300000000' }),
        scpi('Pierre Beta', '4', { localisation: 'France,100', capitalisation: '100000000' }),
        scpi('Pierre Gamma', '8', { localisation: 'Espagne,100', capitalisation: '50000000' }),
        scpi('Pierre Delta', '', { localisation: 'France,100', capitalisation: '200000000' }),
        scpi('Rivoli', '9', { localisation: 'France,100' }),
      ),
    );
    const noms = async (requete: Record<string, unknown>) =>
      (await service.rechercher('pierre', requete)).scpis.map((s) => s.nom);

    // Scénario 1 : recherche + filtres + tri ; Gamma (Espagne) et Rivoli (nom) exclues
    expect(await noms({ pays: 'France', tri: 'capitalisation-asc' })).toEqual([
      'Pierre Beta',
      'Pierre Delta',
      'Pierre Alpha',
    ]);
    // Scénario 4 : changer de tri réordonne seulement les résultats filtrés ; valeur
    // manquante (Delta sans taux) en fin dans les deux sens
    expect(await noms({ pays: 'France', tri: 'taux-asc' })).toEqual([
      'Pierre Beta',
      'Pierre Alpha',
      'Pierre Delta',
    ]);
    expect(await noms({ pays: 'France', tri: 'taux-desc' })).toEqual([
      'Pierre Alpha',
      'Pierre Beta',
      'Pierre Delta',
    ]);
    // Scénario 2 : sans tri choisi, taux N-1 décroissant ; un filtre restreint la recherche
    expect(await noms({})).toEqual(['Pierre Gamma', 'Pierre Alpha', 'Pierre Beta', 'Pierre Delta']);
    expect(await noms({ tauxMin: '5' })).toEqual(['Pierre Gamma', 'Pierre Alpha']);
  });
});
