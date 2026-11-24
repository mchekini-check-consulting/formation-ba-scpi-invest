import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { importScpis } from '../src/csv/import.js';
import { depotSimulation } from '../src/db/depots.js';
import { createDb, createPool } from '../src/db/index.js';
import { migrate } from '../src/migrate.js';
import { creerSimulationService } from '../src/simulation/service.js';

// US-08 : SCPI de la simulation lues sur un PostgreSQL 16 jetable, alimenté par l'import
// CSV (US-07a). Docker requis.
async function* lignes(...rows: Record<string, string>[]) {
  yield* rows;
}

function scpi(nom: string, autres: Record<string, string> = {}) {
  return {
    Nom: nom,
    taux_distribution: '8.35,7.5',
    minimum_souscription: '5000',
    localisation: 'France,100',
    secteurs: 'Bureaux,100',
    prix_part: '200,190',
    capitalisation: '150000000',
    Gerant: `Gérant ${nom}`,
    frais_souscription: '12',
    frais_gestion: '10',
    delai_jouissance: '5',
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

describe('Simulation (e2e)', () => {
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

  it('SCPI triées par nom, prix et taux les plus récents, décotes, donnée absente à null', async () => {
    const db = createDb(pool);
    await importScpis(
      db,
      lignes(
        scpi('Transitions Europe', { demembrement: 'Oui', decote_demembrement: '10,70,5,80' }),
        scpi('Atlas', { taux_distribution: '' }),
      ),
    );
    const [atlas, transitions] = await creerSimulationService(depotSimulation(db)).lister();

    expect(transitions).toEqual({
      id: expect.any(Number),
      nom: 'Transitions Europe',
      prixPart: 200,
      tauxDistribution: 8.35,
      minimum: 5000,
      delaiJouissance: 5,
      demembrement: true,
      decotes: [
        { duree: 5, decote: 20 },
        { duree: 10, decote: 30 },
      ],
    });
    expect(atlas).toMatchObject({
      nom: 'Atlas',
      tauxDistribution: null,
      demembrement: false,
      decotes: [],
    });
  });
});
