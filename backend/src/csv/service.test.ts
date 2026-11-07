import { DrizzleQueryError } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { Db } from '../db/index.js';
import { captureLogs } from '../logging/capture.js';
import type { Alerter } from './alerte.js';
import { FichierInvalide, type BilanImport } from './import.js';
import { creerImportService, type SourceCsv } from './service.js';

const BILAN: BilanImport = {
  lues: 4,
  ajoutees: 1,
  mises_a_jour: 1,
  inchangees: 1,
  supprimees: 1,
  rejetees: 0,
  rejets: [],
};
const { rejets: _sansRejets, ...COMPTEURS } = BILAN;
const REJET = { ligne: 3, nom: 'B', motif: 'iban : format invalide' };
const DEBUT = new Date('2026-11-04T01:00:00Z');
const FIN = new Date('2026-11-04T01:00:05Z');
const FICHIER = 'scpi_catalogue.csv';
const ARCHIVE = 'archives/scpi_catalogue_20261104.csv';

// Fausse base : enregistre l'ouverture et la clôture du rapport (id 42)
function fausseBase(clotureEnEchec = false) {
  const ecritures: { op: string; valeurs: unknown }[] = [];
  const db = {
    insert: () => ({
      values: (valeurs: unknown) => {
        ecritures.push({ op: 'ouverture', valeurs });
        return { returning: () => Promise.resolve([{ id: 42 }]) };
      },
    }),
    update: () => ({
      set: (valeurs: unknown) => ({
        where: () => {
          ecritures.push({ op: 'cloture', valeurs });
          return clotureEnEchec ? Promise.reject(new Error('base injoignable')) : Promise.resolve();
        },
      }),
    }),
  };
  return { db: db as unknown as Db, ecritures };
}

async function* aucuneLigne() {}

// Fausse source R2 : fichier présent par défaut, archivage réussi
function fausseSource(surcharge: Partial<SourceCsv> = {}) {
  const appels: string[] = [];
  const source: SourceCsv = {
    fichier: FICHIER,
    lire: async () => {
      appels.push('lire');
      return aucuneLigne();
    },
    archiver: async () => {
      appels.push('archiver');
      return ARCHIVE;
    },
    ...surcharge,
  };
  return { source, appels };
}

function service(
  importer: () => Promise<BilanImport>,
  {
    base = fausseBase(),
    source = fausseSource().source,
    alerter = (async () => {}) as Alerter,
  } = {},
) {
  const { log, lignes } = captureLogs();
  const horloge = [DEBUT, FIN];
  const alertes: [string, string][] = [];
  const s = creerImportService(
    base.db,
    source,
    log,
    () => horloge.shift()!,
    importer,
    (sujet, motif) => {
      alertes.push([sujet, motif]);
      return alerter(sujet, motif);
    },
  );
  return { executer: () => s.executer(), base, lignes, alertes };
}

describe('ImportService.executer', () => {
  it('import réussi : rapport "reussi" avec le bilan, puis archivage', async () => {
    const { source, appels } = fausseSource();
    const { executer, base } = service(() => Promise.resolve(BILAN), { source });

    expect(await executer()).toEqual(BILAN);

    expect(appels).toEqual(['lire', 'archiver']);
    expect(base.ecritures).toEqual([
      { op: 'ouverture', valeurs: { fichier: FICHIER, debut: DEBUT } },
      { op: 'cloture', valeurs: { fin: FIN, statut: 'reussi', ...BILAN, erreur: null } },
    ]);
  });

  it('import réussi : une ligne de log métier résume le bilan et l’archive', async () => {
    const { executer, lignes } = service(() => Promise.resolve(BILAN));
    await executer();

    expect(lignes[0]).toMatchObject({
      level: 'INFO',
      layer: 'service',
      class: 'ImportService',
      method: 'executer',
      msg: 'import du catalogue terminé',
      fichier: FICHIER,
      archive: ARCHIVE,
      ...COMPTEURS,
    });
    expect(lignes[0].durationMs).toEqual(expect.any(Number));
    expect(lignes[0]).not.toHaveProperty('erreur');
    expect(lignes[0]).not.toHaveProperty('rejets');
    // Une seule ligne par exécution (pas de doublon « ImportService.executer ok »)
    expect(lignes).toHaveLength(1);
  });

  it('aucun fichier déposé : rapport "aucun_fichier", ni import ni archivage', async () => {
    const { source, appels } = fausseSource({ lire: async () => null });
    let importe = false;
    const { executer, base, lignes } = service(
      async () => {
        importe = true;
        return BILAN;
      },
      { source },
    );

    expect(await executer()).toBeNull();

    expect(importe).toBe(false);
    expect(appels).toEqual([]);
    expect(base.ecritures[1]).toEqual({
      op: 'cloture',
      valeurs: { fin: FIN, statut: 'aucun_fichier' },
    });
    expect(lignes[0]).toMatchObject({ level: 'WARN', msg: 'aucun fichier à importer' });
  });

  it('archivage impossible : import conservé "reussi", motif dans le rapport et le log', async () => {
    const { source } = fausseSource({
      archiver: () => Promise.reject(new Error('AccessDenied')),
    });
    const { executer, base, lignes } = service(() => Promise.resolve(BILAN), { source });

    expect(await executer()).toEqual(BILAN);

    expect(base.ecritures[1].valeurs).toMatchObject({
      statut: 'reussi',
      erreur: 'archivage impossible : AccessDenied',
    });
    expect(lignes[0]).toMatchObject({
      level: 'WARN',
      archive: null,
      erreur: 'archivage impossible : AccessDenied',
    });
  });

  it('import en échec : rapport "echec" avec le motif, pas d’archivage, erreur relancée', async () => {
    const { source, appels } = fausseSource();
    const { executer, base, lignes, alertes } = service(
      () => Promise.reject(new Error('capitalisation : nombre attendu, reçu "abc"')),
      { source },
    );

    await expect(executer()).rejects.toThrow('capitalisation');

    expect(appels).toEqual(['lire']);
    expect(base.ecritures[1]).toEqual({
      op: 'cloture',
      valeurs: {
        fin: FIN,
        statut: 'echec',
        erreur: 'capitalisation : nombre attendu, reçu "abc"',
        erreur_detail: null, // erreur technique : pas de motif en blocs
      },
    });
    // L'alerte (ligne error, alerte.ts) est la seule trace : pas de 2e ligne en échec
    expect(alertes).toHaveLength(1);
    expect(lignes).toEqual([]);
  });

  it('erreur SQL : l’alerte journalisée ne contient ni la requête ni ses valeurs', async () => {
    const { executer, alertes } = service(() =>
      Promise.reject(
        new DrizzleQueryError(
          'insert into scpi values ($1)',
          ['valeur'],
          undefined as unknown as Error,
        ),
      ),
    );
    await expect(executer()).rejects.toBeInstanceOf(DrizzleQueryError);
    expect(alertes).toEqual([
      [`import du catalogue annulé (erreur technique) : ${FICHIER}`, 'requête SQL en échec'],
    ]);
  });

  it('lecture du fichier en échec : rapport "echec"', async () => {
    const { source } = fausseSource({ lire: () => Promise.reject(new Error('AccessDenied')) });
    const { executer, base } = service(() => Promise.resolve(BILAN), { source });
    await expect(executer()).rejects.toThrow('AccessDenied');
    expect(base.ecritures[1].valeurs).toMatchObject({ statut: 'echec', erreur: 'AccessDenied' });
  });

  it('erreur qui n’est pas une Error : motif en texte', async () => {
    const { executer, base } = service(() => Promise.reject('coupure'));
    await expect(executer()).rejects.toBe('coupure');
    expect(base.ecritures[1].valeurs).toMatchObject({ statut: 'echec', erreur: 'coupure' });
  });

  // US-07b, scénario 3
  it('lignes rejetées : rapport "reussi" avec les rejets, log au niveau warn sans le détail', async () => {
    const avecRejet = { ...BILAN, rejetees: 1, rejets: [REJET] };
    const { executer, base, lignes, alertes } = service(() => Promise.resolve(avecRejet));

    await executer();

    expect(base.ecritures[1].valeurs).toMatchObject({
      statut: 'reussi',
      rejetees: 1,
      rejets: [REJET],
    });
    expect(lignes[0]).toMatchObject({ level: 'WARN', rejetees: 1 });
    expect(lignes[0]).not.toHaveProperty('rejets');
    expect(alertes).toEqual([]);
  });

  it('import réussi ou aucun fichier : pas d’alerte', async () => {
    const reussi = service(() => Promise.resolve(BILAN));
    await reussi.executer();
    const vide = service(() => Promise.resolve(BILAN), {
      source: fausseSource({ lire: async () => null }).source,
    });
    await vide.executer();
    expect([...reussi.alertes, ...vide.alertes]).toEqual([]);
  });

  // US-07b, scénario 2
  it('fichier rejeté : motif en blocs au rapport et dans l’alerte ; rejets s’il y en a', async () => {
    const detail = {
      ligne: null,
      constat: 'Aucune ligne valide',
      cause: null,
      action: 'Corriger les lignes rejetées',
      technique: null,
    };
    const { executer, base, alertes } = service(() =>
      Promise.reject(new FichierInvalide(detail, [REJET])),
    );

    await expect(executer()).rejects.toThrow('Aucune ligne valide');

    expect(base.ecritures[1].valeurs).toEqual({
      fin: FIN,
      statut: 'echec',
      erreur: 'Aucune ligne valide',
      erreur_detail: detail,
      rejetees: 1,
      rejets: [REJET],
    });
    expect(alertes).toEqual([
      [
        `fichier du catalogue rejeté : ${FICHIER}`,
        `Où : ${FICHIER}, fichier entier\nConstat : Aucune ligne valide\nÀ faire : Corriger les lignes rejetées`,
      ],
    ]);
  });

  it('fichier rejeté sans ligne rejetée : motif en blocs, compteurs de rejets inchangés', async () => {
    const detail = {
      ligne: 3,
      constat: '21 valeurs au lieu de 20',
      cause: 'virgule sans guillemets',
      action: 'Corriger cette ligne',
      technique: 'Invalid Record Length',
    };
    const { executer, base } = service(() => Promise.reject(new FichierInvalide(detail)));

    await expect(executer()).rejects.toThrow(
      'Ligne 3 : 21 valeurs au lieu de 20. Cause probable : virgule sans guillemets',
    );
    expect(base.ecritures[1].valeurs).toEqual({
      fin: FIN,
      statut: 'echec',
      erreur: 'Ligne 3 : 21 valeurs au lieu de 20. Cause probable : virgule sans guillemets',
      erreur_detail: detail,
    });
  });

  // US-07b, scénario 5
  it('erreur technique : alerte "import annulé", erreur d’origine relancée', async () => {
    const { executer, alertes } = service(() => Promise.reject(new Error('connexion perdue')));
    await expect(executer()).rejects.toThrow('connexion perdue');
    expect(alertes).toEqual([
      [`import du catalogue annulé (erreur technique) : ${FICHIER}`, 'connexion perdue'],
    ]);
  });

  it('alerte impossible à envoyer : l’erreur d’origine est relancée', async () => {
    const { executer } = service(() => Promise.reject(new Error('connexion perdue')), {
      alerter: () => Promise.reject(new Error('SMTP injoignable')),
    });
    await expect(executer()).rejects.toThrow('connexion perdue');
  });

  it('rapport impossible à clore : l’erreur d’origine est relancée', async () => {
    const { executer } = service(() => Promise.reject(new Error('connexion perdue')), {
      base: fausseBase(true),
    });
    await expect(executer()).rejects.toThrow('connexion perdue');
  });
});
