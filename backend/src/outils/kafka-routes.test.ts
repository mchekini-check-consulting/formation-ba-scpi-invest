import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { KAFKA_DESACTIVE } from '../kafka/producteur.js';
import { captureLogs } from '../logging/capture.js';
import { HttpError } from '../logging/http-error.js';
import { routesOutilsKafka } from './kafka-routes.js';
import type { OutilsKafkaService } from './kafka-service.js';

const DEV = 'gateway.formation-ba-scpi-invest.dev.check-consulting.net';
const QUALIF = 'gateway.formation-ba-scpi-invest.qualif.check-consulting.net';

function application(service: Partial<OutilsKafkaService>) {
  const { log } = captureLogs();
  return createApp(vi.fn(), log, {
    routeurs: [routesOutilsKafka(service as OutilsKafkaService)],
  });
}

describe('routes de l’outil de test Kafka (dev)', () => {
  it('GET /etat', async () => {
    const etat = vi.fn().mockReturnValue({ active: true, topic: 'scpi.outils.test.v1' });
    const res = await request(application({ etat }))
      .get('/outils/kafka/etat')
      .set('Host', DEV)
      .expect(200);
    expect(res.body).toEqual({ active: true, topic: 'scpi.outils.test.v1' });
  });

  it('POST /test : accusé de Kafka', async () => {
    const envoyerTest = vi.fn().mockResolvedValue({ topic: 't', partition: 0, offset: '1' });
    const res = await request(application({ envoyerTest }))
      .post('/outils/kafka/test')
      .set('Host', 'localhost:8080')
      .expect(200);
    expect(res.body).toEqual({ topic: 't', partition: 0, offset: '1' });
  });

  // Erreur 5xx : message générique côté client (app.ts) ; la raison se lit dans GET /etat
  it('POST /test : Kafka désactivé (503)', async () => {
    const envoyerTest = vi.fn().mockRejectedValue(new HttpError(503, KAFKA_DESACTIVE));
    await request(application({ envoyerTest }))
      .post('/outils/kafka/test')
      .set('Host', DEV)
      .expect(503);
  });

  it('fermé en qualif (404), sans appeler le service', async () => {
    const envoyerTest = vi.fn();
    await request(application({ envoyerTest }))
      .post('/outils/kafka/test')
      .set('Host', QUALIF)
      .expect(404);
    expect(envoyerTest).not.toHaveBeenCalled();
  });
});
