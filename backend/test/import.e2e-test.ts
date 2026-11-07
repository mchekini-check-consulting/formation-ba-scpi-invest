import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Readable } from 'node:stream';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { importScpis, type BilanImport } from '../src/csv/import.js';
import { lancerSurUnSeulReplica } from '../src/csv/planification.js';
import { creerImportService, type SourceCsv } from '../src/csv/service.js';
import { lignesCsv } from '../src/csv/source.js';
import { depotOutilsImport } from '../src/db/depots.js';
import { captureLogs } from '../src/logging/capture.js';
import { createDb, createPool, type Db } from '../src/db/index.js';
import { migrate } from '../src/migrate.js';

// US-07a (SCPI-24), scénarios 1 à 3, et US-07b (SCPI-39), sur un PostgreSQL 16 jetable.
// Docker requis.
async function* lignes(...rows: Record<string, string>[]) {
  yield* rows;
}

// Bilan sans rejet, compteurs précisés
const bilan = (compteurs: Partial<BilanImport>): BilanImport => ({
  lues: 0,
  ajoutees: 0,
  mises_a_jour: 0,
  inchangees: 0,
  supprimees: 0,
  rejetees: 0,
  rejets: [],
  ...compteurs,
});

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
    iban: 'FR7630001007941234567890185',
    bic: 'BNPAFRPPXXX',
    decote_demembrement: '5,80',
    demembrement: 'Oui',
    cashback: '',
    versement_programme: 'Oui',
    publicite: `Texte ${nom}`,
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
    const resultat = await importScpis(db, lignes(scpi('A'), scpi('B'), scpi('C')));

    expect(resultat).toEqual(bilan({ lues: 3, ajoutees: 3 }));
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

    const resultat = await importScpis(db, lignes(scpi('A'), scpi('B'), scpi('C')));

    expect(resultat).toEqual(bilan({ lues: 3, inchangees: 3 }));
    expect(await catalogue()).toEqual(avant);
  });

  it('scénario 2 : prix de part changé, seule cette SCPI est mise à jour', async () => {
    const avant = await catalogue();

    const resultat = await importScpis(db, lignes(scpi('A'), scpi('B', '210'), scpi('C')));

    expect(resultat).toEqual(bilan({ lues: 3, mises_a_jour: 1, inchangees: 2 }));
    const apres = await catalogue();
    expect(apres[1]).toEqual({
      ...avant[1],
      prix: ['210.00'],
      mise_a_jour: expect.any(Date),
    });
    expect(apres[1].mise_a_jour.getTime()).toBeGreaterThan(avant[1].mise_a_jour.getTime());
    expect([apres[0], apres[2]]).toEqual([avant[0], avant[2]]); // autres SCPI intactes
  });

  // US-07b, scénario 3
  it('ligne invalide : seule cette ligne est rejetée, les autres importées', async () => {
    const avant = await catalogue();

    const resultat = await importScpis(
      db,
      lignes(scpi('A'), scpi('B', '210'), scpi('C'), { ...scpi('E'), capitalisation: 'abc' }),
    );

    expect(resultat).toEqual(
      bilan({
        lues: 4,
        inchangees: 3,
        rejetees: 1,
        rejets: [{ ligne: 5, nom: 'E', motif: 'capitalisation : nombre attendu, reçu "abc"' }],
      }),
    );
    expect(await catalogue()).toEqual(avant);
  });

  it('ligne rejetée d’une SCPI déjà en base : gardée telle quelle', async () => {
    const avant = await catalogue();

    const resultat = await importScpis(
      db,
      lignes(scpi('A'), { ...scpi('B', '999'), iban: 'FR76' }, scpi('C')),
    );

    expect(resultat).toMatchObject({ inchangees: 2, supprimees: 0, rejetees: 1 });
    expect(await catalogue()).toEqual(avant); // B garde son prix de 210, rien n'est supprimé
  });

  // US-07b, scénario 4
  it('même Nom sur deux lignes : les deux rejetées, la SCPI en base est gardée', async () => {
    const avant = await catalogue();

    const resultat = await importScpis(
      db,
      lignes(scpi('A'), scpi('B', '210'), scpi('C'), scpi('C', '300')),
    );

    expect(resultat).toMatchObject({ inchangees: 2, supprimees: 0, rejetees: 2 });
    expect(resultat.rejets.map((r) => r.ligne)).toEqual([4, 5]);
    expect(await catalogue()).toEqual(avant);
  });

  it('fichier vide : refusé, catalogue intact', async () => {
    const avant = await catalogue();
    await expect(importScpis(db, lignes())).rejects.toThrow('Fichier vide : aucune SCPI');
    expect(await catalogue()).toEqual(avant);
  });

  it('SCPI en base absentes du fichier : supprimées avec leurs valeurs', async () => {
    const resultat = await importScpis(db, lignes(scpi('A')));

    expect(resultat).toEqual(bilan({ lues: 1, inchangees: 1, supprimees: 2 }));
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
                  rejetees, rejets, erreur, erreur_detail, fin >= debut as termine
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
        rejetees: 0,
        rejets: [],
        erreur: null,
        erreur_detail: null,
        termine: true,
      });
    });

    // US-07b, scénario 3
    it('lignes rejetées : rapport "reussi" avec le numéro et le motif de chaque rejet', async () => {
      const service = creerImportService(
        db,
        source('scpi_catalogue_20261106.csv', [scpi('A'), scpi('F'), { ...scpi('H'), bic: 'X' }]),
        captureLogs().log,
      );
      await service.executer();

      expect(await dernierRapport()).toMatchObject({
        statut: 'reussi',
        lues: 3,
        inchangees: 2,
        rejetees: 1,
        rejets: [
          { ligne: 4, nom: 'H', motif: 'bic : format invalide (8 ou 11 caractères attendus)' },
        ],
      });
    });

    // US-07b, scénario 2
    it('aucune ligne valide : rapport "echec" avec les rejets, alerte, catalogue intact', async () => {
      const avant = await catalogue();
      const { log, lignes: logs } = captureLogs();
      const service = creerImportService(
        db,
        source('scpi_catalogue_20261105.csv', [{ ...scpi('G'), cashback: 'x' }]),
        log,
      );

      await expect(service.executer()).rejects.toThrow('Aucune ligne valide');

      expect(await dernierRapport()).toMatchObject({
        fichier: 'scpi_catalogue_20261105.csv',
        statut: 'echec',
        lues: 0,
        rejetees: 1,
        rejets: [{ ligne: 2, nom: 'G', motif: 'cashback : nombre attendu, reçu "x"' }],
        erreur: 'Aucune ligne valide : la seule ligne est rejetée, catalogue non modifié',
        erreur_detail: {
          ligne: null,
          constat: 'Aucune ligne valide : la seule ligne est rejetée, catalogue non modifié',
          cause: null,
          action:
            'Corriger les lignes rejetées (numéro et motif dans la liste des lignes rejetées), puis déposer à nouveau le fichier',
          technique: null,
        },
        termine: true,
      });
      expect(logs).toContainEqual(
        expect.objectContaining({
          level: 'ERROR',
          class: 'AlerteAdministrateur',
          msg: 'fichier du catalogue rejeté : scpi_catalogue_20261105.csv',
        }),
      );
      expect(await catalogue()).toEqual(avant);
    });

    // US-07b, scénario 2 : vrai fichier CSV lu comme dans R2 (lignesCsv)
    it('fichier illisible : rapport "echec" avec le motif en blocs (erreur_detail)', async () => {
      const avant = await catalogue();
      const entete = Object.keys(scpi('X')).join(',');
      const valeurs = (nom: string) =>
        Object.values(scpi(nom))
          .map((v) => (v.includes(',') ? `"${v}"` : v))
          .join(',');
      const contenu = `${entete}\n${valeurs('A')}\n${valeurs('I').replace('"5.1,4.9"', '5.1,4.9')}\n`;
      const service = creerImportService(
        db,
        {
          fichier: 'scpi_catalogue_20261107.csv',
          lire: async () => lignesCsv(Readable.from([contenu])),
          archiver: async () => 'archives/scpi_catalogue_20261107.csv',
        },
        captureLogs().log,
      );

      await expect(service.executer()).rejects.toThrow('Ligne 3 : 21 valeurs au lieu de 20');

      expect(await dernierRapport()).toMatchObject({
        statut: 'echec',
        erreur:
          'Ligne 3 : 21 valeurs au lieu de 20. Cause probable : une valeur contient une virgule sans être entourée de guillemets (taux, secteurs, localisation…)',
        erreur_detail: {
          ligne: 3,
          constat: '21 valeurs au lieu de 20',
          cause:
            'une valeur contient une virgule sans être entourée de guillemets (taux, secteurs, localisation…)',
          action: expect.stringContaining('elle doit compter 20 valeurs'),
          technique: 'Invalid Record Length: columns length is 20, got 21 on line 3',
        },
        rejetees: 0,
        termine: true,
      });
      expect(await catalogue()).toEqual(avant);
    });

    it('erreur technique : rapport "echec" sans motif en blocs', async () => {
      const service = creerImportService(
        db,
        source('scpi.csv', [scpi('A')]),
        captureLogs().log,
        undefined,
        () => Promise.reject(new Error('connexion perdue')),
      );
      await expect(service.executer()).rejects.toThrow('connexion perdue');
      expect(await dernierRapport()).toMatchObject({
        statut: 'echec',
        erreur: 'connexion perdue',
        erreur_detail: null,
      });
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

  it('outil de test (dev) : lancement à la main malgré un import récent', async () => {
    const imports: string[] = [];
    const executer = async () => {
      imports.push('manuel');
    };
    expect(await lancerSurUnSeulReplica(pool, executer, false)).toBe('lance');
    expect(imports).toEqual(['manuel']);
  });

  it('outil de test (dev) : rapports du plus récent au plus ancien, catalogue complet', async () => {
    await pool.query('delete from import_rapport');
    await pool.query(
      `insert into import_rapport (fichier, statut, debut, erreur) values
         ('ancien.csv', 'echec', now() - interval '2 hours', 'encodage invalide'),
         ('recent.csv', 'reussi', now(), null)`,
    );
    await importScpis(db, lignes(scpi('A'), scpi('B')));
    const depot = depotOutilsImport(db);

    const rapports = await depot.rapports(10);
    expect(rapports.map((r) => [r.fichier, r.statut, r.erreur])).toEqual([
      ['recent.csv', 'reussi', null],
      ['ancien.csv', 'echec', 'encodage invalide'],
    ]);
    expect(rapports[0]).toMatchObject({
      rejets: [],
      lues: 0,
      debut: expect.any(Date),
      erreur_detail: null,
    });
    expect(await depot.rapports(1)).toHaveLength(1);
    expect((await depot.dernierRapport())?.fichier).toBe('recent.csv');

    const scpis = await depot.catalogue();
    expect(scpis.map((s) => s.nom)).toEqual(['A', 'B']);
    expect(scpis[0]).toMatchObject({
      gerant: 'Gérant A',
      empreinte: expect.any(String),
      taux_distribution: expect.arrayContaining([
        expect.objectContaining({ taux: '5.1', annee: 2025 }),
      ]),
      localisation: [expect.objectContaining({ pays: 'France' })],
      secteurs: expect.any(Array),
      prix_part: [expect.objectContaining({ prix: '200' })],
      valeur_reconstitution: [expect.objectContaining({ valeur: '215.5' })],
      decote_demembrement: [expect.objectContaining({ duree: 5, decote: 80 })],
    });

    await pool.query('delete from import_rapport');
    expect(await depot.dernierRapport()).toBeNull();
  });
});
