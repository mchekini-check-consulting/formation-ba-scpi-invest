import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { importScpis } from '../src/csv/import.js';
import { depotEstimation, depotFiscalite, depotSimulation } from '../src/db/depots.js';
import { createDb, createPool } from '../src/db/index.js';
import { migrate } from '../src/migrate.js';
import { creerEstimationService } from '../src/fiscalite/estimation.js';
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
        scpi('Transitions Europe', {
          demembrement: 'Oui',
          decote_demembrement: '10,70,5,80',
          localisation: 'Espagne,30,France,70',
          secteurs: 'Santé,40,Bureaux,60',
        }),
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
      pays: [
        { libelle: 'France', part: 70 },
        { libelle: 'Espagne', part: 30 },
      ],
      secteurs: [
        { libelle: 'Bureaux', part: 60 },
        { libelle: 'Santé', part: 40 },
      ],
    });
    expect(atlas).toMatchObject({
      nom: 'Atlas',
      tauxDistribution: null,
      demembrement: false,
      decotes: [],
    });
  });

  // US-07 / US-09 : barème 2026 (constantes du code), paramètres posés par la migration,
  // part France lue en base
  it('estimation fiscale : barème 2026, paramètres de la migration, part France, informations fiscales', async () => {
    const db = createDb(pool);
    const depot = depotEstimation(db);
    expect(await depot.lireParametres()).toEqual({
      bareme: [
        { plafond: 11600, taux: 0 },
        { plafond: 29579, taux: 11 },
        { plafond: 84577, taux: 30 },
        { plafond: 181917, taux: 41 },
        { plafond: null, taux: 45 },
      ],
      prelevementsSociaux: 17.2,
      tauxForfaitaire: 30,
    });
    await importScpis(
      db,
      lignes(
        scpi('Europa', { localisation: 'Espagne,80,France,20' }),
        scpi('Ibérique', { localisation: 'Espagne,100' }),
        scpi('Sans pays'),
      ),
    );
    const ids = new Map(
      (await creerSimulationService(depotSimulation(db)).lister()).map((s) => [s.nom, s.id]),
    );
    // Répartition géographique retirée (l'import exige une localisation)
    await pool.query('delete from scpi_localisation where scpi_id = $1', [ids.get('Sans pays')]);
    const parts = await depot.partsFrance([
      ids.get('Europa')!,
      ids.get('Ibérique')!,
      ids.get('Sans pays')!,
      999999,
    ]);
    expect([...parts.values()]).toEqual(expect.arrayContaining([20, 0, null]));
    expect(parts.get(ids.get('Europa')!)).toBe(20);
    expect(parts.get(ids.get('Ibérique')!)).toBe(0);
    expect(parts.get(ids.get('Sans pays')!)).toBeNull();
    expect(parts.has(999999)).toBe(false);
    expect(await depot.partsFrance([])).toEqual(new Map());

    const fiscalite = depotFiscalite(db);
    await fiscalite.enregistrer('e2e-fiscal', {
      revenuNetImposable: 40000,
      situationFamiliale: 'seul',
      nombreEnfants: 0,
    });
    const resultat = await creerEstimationService(depot, fiscalite).estimerRevenus('e2e-fiscal', {
      lignes: [{ scpiId: ids.get('Europa')!, revenuAnnuel: 1000 }],
    });
    expect(resultat).toMatchObject({ foyer: { tmi: 30, tauxMoyen: 12.76 }, impot: 228.96 });
  });
});
