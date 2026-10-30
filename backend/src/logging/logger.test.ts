import { describe, expect, it } from 'vitest';
import { captureLogs } from './capture.js';
import { businessLog, createLogger } from './logger.js';

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

  it('écrit sur stdout par défaut', () => {
    expect(createLogger().level).toBe((process.env.LOG_LEVEL ?? 'info').toLowerCase());
  });
});
