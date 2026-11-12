import { describe, expect, it } from 'vitest';
import { captureLogs } from './capture.js';
import {
  type ContexteRequete,
  avecContexte,
  businessLog,
  createLogger,
  detaillerAction,
  identifierUtilisateur,
} from './logger.js';

describe('logger', () => {
  it('une ligne JSON time/level/msg, sans pid ni hostname', () => {
    const { log, lignes } = captureLogs();
    log.info('démarrage');
    expect(lignes).toHaveLength(1);
    expect(Object.keys(lignes[0]).sort()).toEqual(['level', 'msg', 'time']);
    expect(lignes[0]).toMatchObject({ level: 'INFO', msg: 'démarrage' });
    expect(new Date(lignes[0].time as string).toISOString()).toBe(lignes[0].time);
  });

  it('respecte le niveau minimal (LOG_LEVEL, insensible à la casse)', () => {
    const { log, lignes } = captureLogs('WARN');
    log.info('ignoré');
    log.warn('gardé');
    expect(lignes.map((l) => l.level)).toEqual(['WARN']);
  });

  it('businessLog : layer, class et method en champs JSON', () => {
    const { log, lignes } = captureLogs();
    businessLog(log, 'error', 'service', 'ItemService', 'creer', 'échec', { durationMs: 3 });
    expect(lignes[0]).toMatchObject({
      level: 'ERROR',
      layer: 'service',
      class: 'ItemService',
      method: 'creer',
      msg: 'échec',
      durationMs: 3,
    });
  });

  it('identifierUtilisateur : sans effet hors requête', () => {
    const { log, lignes } = captureLogs();
    identifierUtilisateur({ userId: 'u-1' });
    log.info('import de nuit');
    expect(lignes[0]).not.toHaveProperty('userId');
  });

  it('identifierUtilisateur : sur les lignes suivantes de la requête', () => {
    const { log, lignes } = captureLogs();
    avecContexte({ requestId: 'req-1' }, () => {
      log.info('avant');
      identifierUtilisateur({ userId: 'u-1' });
      log.info('après');
    });
    expect(lignes[0]).toEqual(expect.not.objectContaining({ userId: expect.anything() }));
    expect(lignes[1]).toMatchObject({ requestId: 'req-1', userId: 'u-1' });
  });

  it('detaillerAction : cumulé dans le contexte, absent des lignes des autres couches', () => {
    const { log, lignes } = captureLogs();
    const enCours: ContexteRequete = { requestId: 'req-1' };
    avecContexte(enCours, () => {
      detaillerAction({ recherche: 'pierre' });
      detaillerAction({ resultats: 2 });
      log.info({ layer: 'service' }, 'dans le service');
    });
    expect(enCours.details).toEqual({ recherche: 'pierre', resultats: 2 });
    expect(lignes[0]).not.toHaveProperty('details');
    expect(lignes[0]).not.toHaveProperty('recherche');
    expect(lignes[0]).toMatchObject({ requestId: 'req-1' });
  });

  it('detaillerAction : sans effet hors requête', () => {
    expect(() => detaillerAction({ page: 1 })).not.toThrow();
  });

  it('écrit sur stdout par défaut', () => {
    expect(createLogger().level).toBe((process.env.LOG_LEVEL ?? 'info').toLowerCase());
  });
});
