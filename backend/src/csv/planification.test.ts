import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Cron } from 'croner';
import type { Db } from '../db/index.js';
import { captureLogs } from '../logging/capture.js';
import {
  demarrerImportNocturne,
  HORAIRE,
  lancerSurUnSeulReplica,
  planifierImport,
} from './planification.js';

// Faux pool : verrou libre ou non, import déjà fait dans l'heure ou non
function fauxPool({ libre = true, recent = false, connexion = true } = {}) {
  const requetes: string[] = [];
  const client = {
    query: vi.fn(async (sql: string) => {
      requetes.push(sql);
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ libre }] };
      if (sql.includes('import_rapport')) return { rows: recent ? [{}] : [] };
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  const pool = {
    connect: () =>
      connexion ? Promise.resolve(client) : Promise.reject(new Error('base injoignable')),
  };
  return { pool: pool as never, client, requetes };
}

const deverrouille = (requetes: string[]) => requetes.some((r) => r.includes('advisory_unlock'));

describe('lancerSurUnSeulReplica', () => {
  it('verrou libre, pas d’import récent : lance, puis libère verrou et connexion', async () => {
    const { pool, client, requetes } = fauxPool();
    const executer = vi.fn().mockResolvedValue(undefined);

    expect(await lancerSurUnSeulReplica(pool, executer)).toBe('lance');

    expect(executer).toHaveBeenCalledOnce();
    expect(deverrouille(requetes)).toBe(true);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('verrou pris par un autre réplica : deja_en_cours, sans importer', async () => {
    const { pool, client, requetes } = fauxPool({ libre: false });
    const executer = vi.fn();

    expect(await lancerSurUnSeulReplica(pool, executer)).toBe('deja_en_cours');

    expect(executer).not.toHaveBeenCalled();
    expect(deverrouille(requetes)).toBe(false); // pas notre verrou
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('import déjà démarré dans l’heure : deja_fait, verrou libéré', async () => {
    const { pool, requetes } = fauxPool({ recent: true });
    const executer = vi.fn();

    expect(await lancerSurUnSeulReplica(pool, executer)).toBe('deja_fait');

    expect(executer).not.toHaveBeenCalled();
    expect(deverrouille(requetes)).toBe(true);
  });

  it('import en échec : erreur relancée, verrou et connexion libérés', async () => {
    const { pool, client, requetes } = fauxPool();

    await expect(
      lancerSurUnSeulReplica(pool, () => Promise.reject(new Error('cashback'))),
    ).rejects.toThrow('cashback');

    expect(deverrouille(requetes)).toBe(true);
    expect(client.release).toHaveBeenCalledOnce();
  });
});

describe('planifierImport', () => {
  let tache: Cron | undefined;
  afterEach(() => tache?.stop());

  it.each([
    ['hiver (UTC+1)', '2026-11-03T12:00:00Z', '2026-11-04T01:00:00.000Z'],
    ['été (UTC+2)', '2026-07-01T12:00:00Z', '2026-07-02T00:00:00.000Z'],
    // 2h existe deux fois (3h -> 2h) : lancé une seule fois, à la première
    ['passage à l’heure d’hiver', '2026-10-24T12:00:00Z', '2026-10-25T00:00:00.000Z'],
    // 2h n'existe pas (2h -> 3h) : lancé à 3h, la nuit n'est pas sautée
    ['passage à l’heure d’été', '2026-03-28T12:00:00Z', '2026-03-29T01:00:00.000Z'],
  ])('chaque nuit à 2h heure de Paris : %s', (_cas, maintenant, attendu) => {
    tache = planifierImport(fauxPool().pool, vi.fn(), captureLogs().log);
    expect(tache.nextRun(new Date(maintenant))?.toISOString()).toBe(attendu);
  });

  it('déclenchement : lance l’import et journalise l’issue', async () => {
    const { log, lignes } = captureLogs();
    const executer = vi.fn().mockResolvedValue(undefined);
    tache = planifierImport(fauxPool().pool, executer, log);

    await tache.trigger();

    expect(executer).toHaveBeenCalledOnce();
    expect(lignes).toEqual([
      expect.objectContaining({ issue: 'lance', msg: 'import planifié du catalogue : lance' }),
    ]);
  });

  it('erreur (base injoignable) : journalisée, jamais propagée', async () => {
    const { log, lignes } = captureLogs();
    tache = planifierImport(fauxPool({ connexion: false }).pool, vi.fn(), log);

    await expect(tache.trigger()).resolves.not.toThrow();

    expect(lignes).toEqual([
      expect.objectContaining({
        level: 'ERROR',
        error: 'base injoignable',
        msg: 'import planifié du catalogue en échec',
      }),
    ]);
  });

  it('erreur qui n’est pas une Error : journalisée en texte', async () => {
    const { log, lignes } = captureLogs();
    tache = planifierImport(fauxPool().pool, () => Promise.reject('coupure'), log);
    await tache.trigger();
    expect(lignes[0]).toMatchObject({ level: 'ERROR', error: 'coupure' });
  });

  it('horaire 2h par défaut', () => {
    expect(HORAIRE).toBe('0 2 * * *');
  });
});

describe('demarrerImportNocturne', () => {
  const env = {
    S3_URL: 'https://compte.r2.cloudflarestorage.com/scpi/scpi.csv',
    S3_ACCESS_KEY_ID: 'id-test',
    S3_SECRET_ACCESS_KEY: 'secret-test',
  };
  let tache: Cron | null = null;
  afterEach(() => tache?.stop());

  it('variables R2 absentes : désactivé, le backend démarre quand même', () => {
    const { log, lignes } = captureLogs();

    tache = demarrerImportNocturne(fauxPool().pool, {} as Db, log, {});

    expect(tache).toBeNull();
    expect(lignes).toEqual([
      expect.objectContaining({
        level: 'WARN',
        msg: 'import nocturne du catalogue désactivé',
        raison: expect.stringContaining('S3_URL'),
      }),
    ]);
  });

  it('variables R2 présentes : planifié à 2h, prochain lancement journalisé', () => {
    const { log, lignes } = captureLogs();

    tache = demarrerImportNocturne(fauxPool({ recent: true }).pool, {} as Db, log, env);

    expect(tache?.getPattern()).toBe('0 2 * * *');
    expect(lignes[0]).toMatchObject({
      level: 'INFO',
      msg: 'import nocturne du catalogue planifié',
      horaire: '0 2 * * *',
      fuseau: 'Europe/Paris',
      prochain: expect.stringMatching(/T0[01]:00:00\.000Z$/),
    });
  });

  it('au démarrage : import lancé tout de suite, sans attendre 2h', async () => {
    const { log, lignes } = captureLogs();
    const { pool, requetes } = fauxPool({ recent: true });

    tache = demarrerImportNocturne(pool, {} as Db, log, env);

    await vi.waitFor(() =>
      expect(lignes).toContainEqual(
        expect.objectContaining({
          issue: 'deja_fait',
          msg: 'import planifié du catalogue : deja_fait',
        }),
      ),
    );
    expect(requetes.some((r) => r.includes('pg_try_advisory_lock'))).toBe(true);
  });

  it('CSV_IMPORT_CRON : autre horaire', () => {
    tache = demarrerImportNocturne(fauxPool({ recent: true }).pool, {} as Db, captureLogs().log, {
      ...env,
      CSV_IMPORT_CRON: '*/5 * * * *',
    });
    expect(tache?.getPattern()).toBe('*/5 * * * *');
  });
});
