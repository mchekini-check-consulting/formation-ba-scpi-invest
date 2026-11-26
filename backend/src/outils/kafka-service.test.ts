import { describe, expect, it, vi } from 'vitest';
import type { CanalKafka } from '../kafka/producteur.js';
import { creerOutilsKafkaService } from './kafka-service.js';

function canal(active = true): CanalKafka {
  return {
    active,
    publier: vi.fn().mockResolvedValue({ topic: 'scpi.outils.test.v1', partition: 0, offset: '3' }),
    fermer: vi.fn(),
  };
}

describe('outil de test Kafka', () => {
  it('état : actif ou non, et le topic de test', () => {
    const service = creerOutilsKafkaService({ canal: canal(false), topic: 'tt', pod: null });
    expect(service.etat()).toEqual({ active: false, topic: 'tt' });
  });

  it('envoi : message de test sur le topic de test', async () => {
    const c = canal();
    const service = creerOutilsKafkaService({
      canal: c,
      topic: 'scpi.outils.test.v1',
      pod: 'backend-1',
      maintenant: () => new Date('2026-11-25T10:00:00Z'),
    });
    await expect(service.envoyerTest()).resolves.toEqual({
      topic: 'scpi.outils.test.v1',
      partition: 0,
      offset: '3',
    });
    expect(c.publier).toHaveBeenCalledWith('scpi.outils.test.v1', 'test', {
      type: 'test',
      envoyeLe: '2026-11-25T10:00:00.000Z',
      pod: 'backend-1',
    });
  });

  it('heure courante par défaut', async () => {
    const c = canal();
    await creerOutilsKafkaService({ canal: c, topic: 't', pod: null }).envoyerTest();
    const message = vi.mocked(c.publier).mock.calls[0][2] as { envoyeLe: string };
    expect(Date.parse(message.envoyeLe)).not.toBeNaN();
  });
});
