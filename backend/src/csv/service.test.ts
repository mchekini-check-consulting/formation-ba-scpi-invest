import { describe, expect, it } from 'vitest';
import type { Db } from '../db/index.js';
import { captureLogs } from '../logging/capture.js';
import type { BilanImport } from './import.js';
import { creerImportService, type SourceCsv } from './service.js';

const BILAN: BilanImport = {
  lues: 4,
  ajoutees: 1,
  mises_a_jour: 1,
  inchangees: 1,
  supprimees: 1,
};
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
  { base = fausseBase(), source = fausseSource().source } = {},
) {
  const { log, lignes } = captureLogs();
  const horloge = [DEBUT, FIN];
  const s = creerImportService(base.db, source, log, () => horloge.shift()!, importer);
  return { executer: () => s.executer(), base, lignes };
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
      ...BILAN,
    });
    expect(lignes[0]).not.toHaveProperty('erreur');
    expect(lignes[1]).toMatchObject({ level: 'INFO', msg: 'ImportService.executer ok' });
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
    const { executer, base, lignes } = service(
      () => Promise.reject(new Error('capitalisation : nombre attendu, reçu "abc"')),
      { source },
    );

    await expect(executer()).rejects.toThrow('capitalisation');

    expect(appels).toEqual(['lire']);
    expect(base.ecritures[1]).toEqual({
      op: 'cloture',
      valeurs: { fin: FIN, statut: 'echec', erreur: 'capitalisation : nombre attendu, reçu "abc"' },
    });
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ level: 'ERROR', msg: 'ImportService.executer en échec' });
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

  it('rapport impossible à clore : l’erreur d’origine est relancée', async () => {
    const { executer } = service(() => Promise.reject(new Error('connexion perdue')), {
      base: fausseBase(true),
    });
    await expect(executer()).rejects.toThrow('connexion perdue');
  });
});
