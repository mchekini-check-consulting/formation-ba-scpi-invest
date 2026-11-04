import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { importScpis } from '../src/csv/import.js';
import { lancerSurUnSeulReplica } from '../src/csv/planification.js';
import { creerImportService, type SourceCsv } from '../src/csv/service.js';
import { captureLogs } from '../src/logging/capture.js';
import { createDb, createPool, type Db } from '../src/db/index.js';
import { migrate } from '../src/migrate.js';

// US-07a (SCPI-24), scénarios 1 à 3, sur un PostgreSQL 16 jetable. Docker requis.
async function* lignes(...rows: Record<string, string>[]) {
  yield* rows;
}

function scpi(nom: string, prix_part = '200'): Record<string, string> {
  return {
    Nom: nom,
    taux_distribution: '5.1,4.9',
    minimum_souscription: '1000',
    localisation: 'France,100',
    secteurs: 'Bureaux,60,Sante,40',
    prix_part,
    capitalisation: '150000000',
    Gerant: `Gérant ${nom}`,
    frais_souscription: '10',
    frais_gestion: '12',
    delai_jouissance: '4',
    frequence_loyers: 'Trimestrielle',
    valeur_reconstitution: '215.5',
    iban: '',
    bic: '',
    decote_demembrement: '5,80',
    demembrement: 'Oui',
    cashback: '',
    versement_programme: 'Oui',
    publicite: '',
  };
}

describe('import du catalogue (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Db;

  const catalogue = async () =>
    (
      await pool.query(
        `select c.id, c.nom, c.gerant, c.mise_a_jour,
                array(select prix::text from scpi_prix_part p where p.scpi_id = c.id order by annee desc) as prix,
                array(select taux::text from scpi_taux_distribution t where t.scpi_id = c.id order by annee desc) as taux,
                array(select secteur::text from scpi_secteurs s where s.scpi_id = c.id order by secteur) as secteurs
         from scpi_catalog c order by c.nom`,
      )
    ).rows;

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

  it('scénario 1 : 3 SCPI absentes de la base sont ajoutées', async () => {
    const bilan = await importScpis(db, lignes(scpi('A'), scpi('B'), scpi('C')));

    expect(bilan).toEqual({ lues: 3, ajoutees: 3, mises_a_jour: 0, inchangees: 0, supprimees: 0 });
    const scpis = await catalogue();
    expect(scpis.map((s) => s.nom)).toEqual(['A', 'B', 'C']);
    expect(scpis[0]).toMatchObject({
      gerant: 'Gérant A',
      prix: ['200.00'],
      taux: ['5.10', '4.90'],
      secteurs: ['Bureaux', 'Santé'],
    });
  });

  it('scénario 3 : fichier identique à la base, aucune donnée modifiée', async () => {
    const avant = await catalogue();

    const bilan = await importScpis(db, lignes(scpi('A'), scpi('B'), scpi('C')));

    expect(bilan).toEqual({ lues: 3, ajoutees: 0, mises_a_jour: 0, inchangees: 3, supprimees: 0 });
    expect(await catalogue()).toEqual(avant);
  });

  it('scénario 2 : prix de part changé, seule cette SCPI est mise à jour', async () => {
    const avant = await catalogue();

    const bilan = await importScpis(db, lignes(scpi('A'), scpi('B', '210'), scpi('C')));

    expect(bilan).toEqual({ lues: 3, ajoutees: 0, mises_a_jour: 1, inchangees: 2, supprimees: 0 });
    const apres = await catalogue();
    expect(apres[1]).toEqual({
      ...avant[1],
      prix: ['210.00'],
      mise_a_jour: expect.any(Date),
    });
    expect(apres[1].mise_a_jour.getTime()).toBeGreaterThan(avant[1].mise_a_jour.getTime());
    expect([apres[0], apres[2]]).toEqual([avant[0], avant[2]]); // autres SCPI intactes
  });

  it('ligne invalide : rien n’est enregistré (une seule transaction)', async () => {
    const avant = await catalogue();
    await expect(
      importScpis(db, lignes(scpi('D'), { ...scpi('E'), capitalisation: 'abc' })),
    ).rejects.toThrow('capitalisation');
    expect(await catalogue()).toEqual(avant);
  });

  it('fichier vide : refusé, catalogue intact', async () => {
    const avant = await catalogue();
    await expect(importScpis(db, lignes())).rejects.toThrow('fichier sans aucune SCPI');
    expect(await catalogue()).toEqual(avant);
  });

  it('SCPI en base absentes du fichier : supprimées avec leurs valeurs', async () => {
    const bilan = await importScpis(db, lignes(scpi('A')));

    expect(bilan).toEqual({ lues: 1, ajoutees: 0, mises_a_jour: 0, inchangees: 1, supprimees: 2 });
    expect((await catalogue()).map((s) => s.nom)).toEqual(['A']);
    const { rows } = await pool.query(
      `select count(*)::int as n from scpi_prix_part p
       where not exists (select 1 from scpi_catalog c where c.id = p.scpi_id)`,
    );
    expect(rows).toEqual([{ n: 0 }]); // aucune valeur orpheline
  });

  describe('rapport d’exécution', () => {
    const dernierRapport = async () =>
      (
        await pool.query(
          `select fichier, statut, lues, ajoutees, mises_a_jour, inchangees, supprimees,
                  erreur, fin >= debut as termine
           from import_rapport order by id desc limit 1`,
        )
      ).rows[0];

    // Source en mémoire à la place de R2 (archivage testé dans source.test.ts)
    const source = (fichier: string, contenu: Record<string, string>[] | null): SourceCsv => ({
      fichier,
      lire: async () => (contenu ? lignes(...contenu) : null),
      archiver: async () => `archives/${fichier}`,
    });

    it('import réussi : rapport "reussi" avec le bilan', async () => {
      const service = creerImportService(
        db,
        source('scpi_catalogue_20261104.csv', [scpi('A'), scpi('F')]),
        captureLogs().log,
      );
      await service.executer();

      expect(await dernierRapport()).toEqual({
        fichier: 'scpi_catalogue_20261104.csv',
        statut: 'reussi',
        lues: 2,
        ajoutees: 1,
        mises_a_jour: 0,
        inchangees: 1,
        supprimees: 0,
        erreur: null,
        termine: true,
      });
    });

    it('import en échec : rapport "echec" conservé, catalogue intact', async () => {
      const avant = await catalogue();
      const service = creerImportService(
        db,
        source('scpi_catalogue_20261105.csv', [{ ...scpi('G'), cashback: 'x' }]),
        captureLogs().log,
      );

      await expect(service.executer()).rejects.toThrow('cashback');

      expect(await dernierRapport()).toMatchObject({
        fichier: 'scpi_catalogue_20261105.csv',
        statut: 'echec',
        lues: 0,
        erreur: 'cashback : nombre attendu, reçu "x"',
        termine: true,
      });
      expect(await catalogue()).toEqual(avant);
    });

    it('aucun fichier : rapport "aucun_fichier", catalogue intact', async () => {
      const avant = await catalogue();
      const service = creerImportService(db, source('scpi.csv', null), captureLogs().log);

      expect(await service.executer()).toBeNull();

      expect(await dernierRapport()).toMatchObject({
        fichier: 'scpi.csv',
        statut: 'aucun_fichier',
        lues: 0,
        termine: true,
      });
      expect(await catalogue()).toEqual(avant);
    });
  });

  it('deux réplicas déclenchent à 2h en même temps : un seul importe', async () => {
    await pool.query('delete from import_rapport');
    const imports: string[] = [];
    // Import factice qui dure 300 ms et ouvre son rapport, comme ImportService
    const executer = (replica: string) => async () => {
      imports.push(replica);
      await pool.query(`insert into import_rapport (fichier) values ('scpi.csv')`);
      await new Promise((fin) => setTimeout(fin, 300));
    };

    const issues = await Promise.all([
      lancerSurUnSeulReplica(pool, executer('replica-1')),
      lancerSurUnSeulReplica(pool, executer('replica-2')),
    ]);

    expect(issues.sort()).toEqual(['deja_en_cours', 'lance']);
    expect(imports).toHaveLength(1);

    // Réplica en retard de quelques secondes (verrou libéré entre-temps) : pas de second import
    expect(await lancerSurUnSeulReplica(pool, executer('replica-3'))).toBe('deja_fait');
    expect(imports).toHaveLength(1);
  });
});
