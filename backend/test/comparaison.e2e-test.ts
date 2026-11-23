import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { creerComparaisonService } from '../src/comparaison/service.js';
import { importScpis } from '../src/csv/import.js';
import { depotComparaison } from '../src/db/depots.js';
import { createDb, createPool } from '../src/db/index.js';
import { migrate } from '../src/migrate.js';

// US-04 : SCPI du comparateur lues sur un PostgreSQL 16 jetable, alimenté par l'import
// CSV (US-07a). Docker requis.
async function* lignes(...rows: Record<string, string>[]) {
  yield* rows;
}

function scpi(nom: string, autres: Record<string, string> = {}) {
  return {
    Nom: nom,
    taux_distribution: '8,7.5',
    minimum_souscription: '5000',
    localisation: 'Allemagne,30,France,70',
    secteurs: 'Bureaux,40,Sante,60',
    prix_part: '250,240,230,220,210,200,190',
    capitalisation: '150000000',
    Gerant: `Gérant ${nom}`,
    frais_souscription: '12',
    frais_gestion: '10',
    delai_jouissance: '6',
    frequence_loyers: 'Trimestrielle',
    valeur_reconstitution: '215.5',
    iban: 'FR7630001007941234567890185',
    bic: 'BNPAFRPPXXX',
    decote_demembrement: '',
    demembrement: 'Non',
    cashback: '',
    versement_programme: 'Oui',
    publicite: `Texte ${nom}`,
    ...autres,
  };
}

describe('Comparateur (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let pool: Pool;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16').start();
    pool = createPool(postgres.getConnectionUri());
    await migrate(pool);
  });

  afterAll(async () => {
    await pool?.end();
    await postgres?.stop();
  });

  it('critères lus en base, SCPI triées par nom, donnée absente à null', async () => {
    const db = createDb(pool);
    await importScpis(
      db,
      lignes(scpi('Comète'), scpi('Atlas', { taux_distribution: '', prix_part: '1135' })),
    );
    const annee = new Date().getFullYear() - 1;
    const [atlas, comete] = await creerComparaisonService(depotComparaison(db)).lister();

    expect(comete).toEqual({
      id: expect.any(Number),
      nom: 'Comète',
      tauxDistribution: 8,
      anneeTaux: annee,
      prixPart: 250,
      evolutionPrix: {
        debut: { annee: annee - 5, prix: 200 },
        fin: { annee, prix: 250 },
        variation: 25,
      },
      minimum: 5000,
      capitalisation: 150000000,
      fraisSouscription: 12,
      fraisGestion: 10,
      delaiJouissance: 6,
      frequence: 'Trimestrielle',
      demembrement: false,
      versementProgramme: true,
      paysPrincipal: { libelle: 'France', part: 70 },
      secteurPrincipal: { libelle: 'Santé', part: 60 },
    });
    expect(atlas).toMatchObject({
      nom: 'Atlas',
      tauxDistribution: null,
      anneeTaux: null,
      prixPart: 1135,
      evolutionPrix: null,
    });
  });
});
