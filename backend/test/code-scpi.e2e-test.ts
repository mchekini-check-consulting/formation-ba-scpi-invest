import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { importScpis } from '../src/csv/import.js';
import { createDb, createPool, type Db } from '../src/db/index.js';
import { migrate } from '../src/migrate.js';

// Code SCPI généré par l'import (src/csv/code-scpi.ts), sur un PostgreSQL 16 jetable :
// même nom, même code d'un import à l'autre. Docker requis.
async function* lignes(...rows: Record<string, string>[]) {
  yield* rows;
}

function scpi(nom: string, prix_part = '200'): Record<string, string> {
  return {
    Nom: nom,
    taux_distribution: '5',
    minimum_souscription: '1000',
    localisation: 'France,100',
    secteurs: 'Bureaux,100',
    prix_part,
    capitalisation: '150000000',
    Gerant: 'Gérant',
    frais_souscription: '10',
    frais_gestion: '12',
    delai_jouissance: '4',
    frequence_loyers: 'Trimestrielle',
    valeur_reconstitution: '',
    iban: 'FR7630001007941234567890185',
    bic: 'BNPAFRPPXXX',
    decote_demembrement: '',
    demembrement: 'Non',
    cashback: '',
    versement_programme: 'Non',
    publicite: 'Texte',
  };
}

describe('code SCPI (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Db;

  const codes = async () =>
    Object.fromEntries(
      (await pool.query('select nom, code from scpi_catalog order by nom')).rows.map((r) => [
        r.nom,
        r.code,
      ]),
    );

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

  const fichier = () =>
    lignes(scpi('Iroko Zen'), scpi('Epargne Pierre Europe'), scpi('Epargne Pierre'));

  it('premier import : un code par SCPI, sans doublon', async () => {
    await importScpis(db, fichier());
    expect(await codes()).toEqual({
      'Epargne Pierre': 'EPPI',
      'Epargne Pierre Europe': 'EPPE',
      'Iroko Zen': 'IRZE',
    });
  });

  it('même fichier, puis fiche modifiée : mêmes codes', async () => {
    const avant = await codes();
    await importScpis(db, fichier());
    await importScpis(
      db,
      lignes(scpi('Iroko Zen', '210'), scpi('Epargne Pierre Europe'), scpi('Epargne Pierre')),
    );
    expect(await codes()).toEqual(avant);
  });

  it('SCPI importée avant le code (code vide) : code ajouté au prochain import', async () => {
    await pool.query(`update scpi_catalog set code = null where nom = 'Iroko Zen'`);
    const bilan = await importScpis(
      db,
      lignes(scpi('Iroko Zen', '210'), scpi('Epargne Pierre Europe'), scpi('Epargne Pierre')),
    );
    expect(bilan).toMatchObject({ inchangees: 3 });
    expect((await codes())['Iroko Zen']).toBe('IRZE');
  });

  it('la base refuse deux SCPI avec le même code', async () => {
    await expect(
      pool.query(`update scpi_catalog set code = 'IRZE' where nom = 'Epargne Pierre'`),
    ).rejects.toThrow(/scpi_catalog_code_unique/);
  });
});
