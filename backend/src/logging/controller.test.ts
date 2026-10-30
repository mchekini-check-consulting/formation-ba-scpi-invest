import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { captureLogs } from './capture.js';
import { errorHandler, requestLogger } from './controller.js';
import { HttpError } from './http-error.js';

function appTest() {
  const { log, lignes } = captureLogs();
  const app = express();
  app.use(requestLogger(log));
  app.use(express.json());
  const lire: express.RequestHandler = (_req, res) => {
    res.json({ ok: true });
  };
  app.get('/clients/:id', lire);
  const routeur = express.Router();
  routeur.post('/', (_req, res) => {
    res.status(201).end();
  });
  app.use('/items', routeur);
  app.get('/introuvable', () => {
    throw new HttpError(404, 'client introuvable');
  });
  app.get('/panne', () => {
    throw new Error('base indisponible');
  });
  app.use(errorHandler(log));
  return { app, lignes };
}

describe('requestLogger (layer controller)', () => {
  it('un log INFO avec la route déclarée, sans les valeurs ni le corps', async () => {
    const { app, lignes } = appTest();
    await request(app).get('/clients/422ABC?nom=dupont').expect(200);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({
      level: 'INFO',
      layer: 'controller',
      class: 'app',
      method: 'lire',
      msg: 'GET /clients/:id 200',
      httpMethod: 'GET',
      route: '/clients/:id',
      status: 200,
    });
    expect(lignes[0].durationMs).toEqual(expect.any(Number));
    expect(JSON.stringify(lignes)).not.toMatch(/422ABC|dupont/);
  });

  it('route d’un sous-routeur, fonction anonyme', async () => {
    const { app, lignes } = appTest();
    await request(app).post('/items').send({ secret: 'x' }).expect(201);
    expect(lignes[0]).toMatchObject({ route: '/items/', method: 'anonymous', status: 201 });
    expect(JSON.stringify(lignes)).not.toContain('secret');
  });

  it('404 sans route : WARN, route "unmatched"', async () => {
    const { app, lignes } = appTest();
    await request(app).get('/nexiste/pas').expect(404);
    expect(lignes[0]).toMatchObject({ level: 'WARN', route: 'unmatched', status: 404 });
  });

  it('HttpError 4xx : statut et message renvoyés, log WARN', async () => {
    const { app, lignes } = appTest();
    const res = await request(app).get('/introuvable').expect(404);
    expect(res.body).toEqual({ message: 'client introuvable' });
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ level: 'WARN', status: 404 });
  });

  it('erreur : 500 sans détail, trace hors Loki (sans layer), log ERROR', async () => {
    const { app, lignes } = appTest();
    const res = await request(app).get('/panne').expect(500);
    expect(res.body).toEqual({ message: 'erreur interne' });
    const [trace, requete] = lignes;
    expect(trace).toMatchObject({ level: 'ERROR', msg: 'erreur non gérée' });
    expect(trace.layer).toBeUndefined();
    expect(requete).toMatchObject({ level: 'ERROR', layer: 'controller', status: 500 });
  });
});
