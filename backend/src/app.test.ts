import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { captureLogs } from './logging/capture.js';

describe('app', () => {
  it('GET / répond Hello', async () => {
    await request(createApp(vi.fn(), captureLogs().log)).get('/').expect(200, 'Hello, World!');
  });

  it('GET /health : ok quand la base répond', async () => {
    const ping = vi.fn().mockResolvedValue(undefined);
    const res = await request(createApp(ping, captureLogs().log)).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(ping).toHaveBeenCalledOnce();
  });

  it('/auth/... : transmis au module d’authentification, corps brut intact', async () => {
    const auth = vi.fn((req, res) => {
      res.json({ chemin: req.originalUrl, corpsLu: req.body !== undefined });
    });
    const app = createApp(vi.fn(), captureLogs().log, { auth });
    const res = await request(app).post('/auth/sign-out').send({ a: 1 }).expect(200);
    expect(res.body).toEqual({ chemin: '/auth/sign-out', corpsLu: false });
  });

  it('GET /health : 503 quand la base ne répond pas', async () => {
    const ping = vi.fn().mockRejectedValue(new Error('connexion refusée'));
    const res = await request(createApp(ping, captureLogs().log)).get('/health').expect(503);
    expect(res.body).toEqual({ status: 'ko' });
  });
});
