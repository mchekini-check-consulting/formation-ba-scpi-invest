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
  const health: express.RequestHandler = (_req, res) => {
    res.json({ status: 'ok' });
  };
  app.get('/health', health);
  // Log écrit par une autre couche pendant la requête, après lecture du corps (JSON ou brut)
  const tracer: express.RequestHandler = async (_req, res) => {
    await new Promise((fin) => setTimeout(fin, 1));
    log.info({ layer: 'service' }, 'dans le service');
    res.status(204).end();
  };
  app.post('/json', tracer);
  app.post('/brut', express.raw({ type: () => true }), tracer);
  app.use(errorHandler(log));
  return { app, lignes };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('requestLogger (layer controller)', () => {
  it('un log INFO avec la route déclarée, sans les valeurs ni le corps', async () => {
    const { app, lignes } = appTest();
    await request(app).get('/clients/422ABC?nom=dupont').expect(200);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({
      level: 'INFO',
      layer: 'controller',
      class: 'clients',
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
    expect(lignes[0]).toMatchObject({
      route: '/items/',
      class: 'items',
      method: 'anonymous',
      status: 201,
    });
    expect(JSON.stringify(lignes)).not.toContain('secret');
  });

  it('404 sans route : WARN, route "unmatched", class "app"', async () => {
    const { app, lignes } = appTest();
    await request(app).get('/nexiste/pas').expect(404);
    expect(lignes[0]).toMatchObject({
      level: 'WARN',
      route: 'unmatched',
      class: 'app',
      status: 404,
    });
  });

  it('/health qui répond : DEBUG (sondes), absent au niveau info', async () => {
    const { app, lignes } = appTest();
    await request(app).get('/health').expect(200);
    expect(lignes).toEqual([]);

    const debug = captureLogs('debug');
    const appDebug = express();
    appDebug.use(requestLogger(debug.log));
    appDebug.get('/health', (_req, res) => {
      res.json({ status: 'ok' });
    });
    await request(appDebug).get('/health').expect(200);
    expect(debug.lignes[0]).toMatchObject({ level: 'DEBUG', class: 'app', route: '/health' });
  });

  it('/health en échec : toujours visible (WARN/ERROR)', async () => {
    const { log, lignes } = captureLogs();
    const app = express();
    app.use(requestLogger(log));
    app.get('/health', (_req, res) => {
      res.status(503).json({ status: 'ko' });
    });
    await request(app).get('/health').expect(503);
    expect(lignes[0]).toMatchObject({ level: 'ERROR', status: 503 });
  });

  it('HttpError 4xx : statut et message renvoyés, log WARN', async () => {
    const { app, lignes } = appTest();
    const res = await request(app).get('/introuvable').expect(404);
    expect(res.body).toEqual({ message: 'client introuvable' });
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ level: 'WARN', status: 404 });
  });

  it('HttpError 4xx avec détails : ajoutés au corps, sans écraser le message', async () => {
    const { app } = appTest();
    app.get('/bloque', () => {
      throw new HttpError(429, 'trop de tentatives', { debloqueA: 'demain', message: 'ignoré' });
    });
    app.use(errorHandler(captureLogs().log));
    const res = await request(app).get('/bloque').expect(429);
    expect(res.body).toEqual({ debloqueA: 'demain', message: 'trop de tentatives' });
  });

  it('erreur : 500 sans détail, trace hors Loki (sans layer), log ERROR', async () => {
    const { app, lignes } = appTest();
    const res = await request(app).get('/panne').expect(500);
    expect(res.body).toEqual({ message: 'erreur interne' });
    const [trace, requete] = lignes;
    expect(trace).toMatchObject({ level: 'ERROR', msg: 'erreur non gérée' });
    expect(trace.layer).toBeUndefined();
    expect(requete).toMatchObject({ level: 'ERROR', layer: 'controller', status: 500 });
    // La trace et le log de la requête sont reliés par le même requestId
    expect(trace.requestId).toEqual(expect.stringMatching(UUID));
    expect(trace.requestId).toBe(requete.requestId);
  });
});

describe('requestId', () => {
  it('généré pour chaque requête, renvoyé dans l’en-tête X-Request-Id', async () => {
    const { app, lignes } = appTest();
    const r1 = await request(app).get('/clients/1').expect(200);
    const r2 = await request(app).get('/clients/2').expect(200);
    expect(r1.headers['x-request-id']).toMatch(UUID);
    expect(r1.headers['x-request-id']).not.toBe(r2.headers['x-request-id']);
    expect(lignes.map((l) => l.requestId)).toEqual([
      r1.headers['x-request-id'],
      r2.headers['x-request-id'],
    ]);
  });

  it('X-Request-Id reçu et bien formé : repris tel quel', async () => {
    const { app, lignes } = appTest();
    const res = await request(app).get('/clients/1').set('X-Request-Id', 'abc-123_XYZ').expect(200);
    expect(res.headers['x-request-id']).toBe('abc-123_XYZ');
    expect(lignes[0].requestId).toBe('abc-123_XYZ');
  });

  it.each([
    ['trop court', 'abc'],
    ['caractères interdits', 'abc def","level":"ERROR'],
    ['trop long', 'a'.repeat(65)],
  ])('X-Request-Id reçu %s : remplacé par un identifiant généré', async (_cas, valeur) => {
    const { app, lignes } = appTest();
    const res = await request(app).get('/clients/1').set('X-Request-Id', valeur).expect(200);
    expect(res.headers['x-request-id']).toMatch(UUID);
    expect(lignes[0].requestId).toBe(res.headers['x-request-id']);
  });

  it.each(['/json', '/brut'])(
    'présent sur les logs des autres couches, après lecture du corps (%s)',
    async (route) => {
      const { app, lignes } = appTest();
      const res = await request(app).post(route).send({ a: 1 }).expect(204);
      const [service, controleur] = lignes;
      expect(service).toMatchObject({ layer: 'service', requestId: res.headers['x-request-id'] });
      expect(controleur).toMatchObject({ layer: 'controller', requestId: service.requestId });
    },
  );

  it('une ligne n’hérite pas des champs des lignes précédentes de la même requête', async () => {
    const { log, lignes } = captureLogs();
    const app = express();
    app.use(requestLogger(log));
    app.get('/panne', () => {
      log.warn({ layer: 'service', class: 'X', error: 'HttpError' }, 'dans le service');
      throw new Error('base indisponible');
    });
    app.use(errorHandler(log));
    await request(app).get('/panne').expect(500);

    const [, trace, controleur] = lignes;
    expect(trace).toMatchObject({ msg: 'erreur non gérée' });
    expect(trace).not.toHaveProperty('layer'); // reste hors Loki
    expect(trace).not.toHaveProperty('class');
    expect(controleur).toMatchObject({ layer: 'controller', class: 'panne' });
    expect(controleur).not.toHaveProperty('error');
    expect(controleur).not.toHaveProperty('err');
  });

  it('hors requête (démarrage, import de nuit) : pas de requestId', () => {
    const { log, lignes } = captureLogs();
    log.info('démarrage');
    expect(lignes[0]).not.toHaveProperty('requestId');
  });
});
