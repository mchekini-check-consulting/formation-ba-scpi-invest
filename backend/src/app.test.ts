import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';

describe('app', () => {
  it('GET / répond Hello', async () => {
    await request(createApp(vi.fn())).get('/').expect(200, 'Hello, World!');
  });

  it('GET /health : ok quand la base répond', async () => {
    const ping = vi.fn().mockResolvedValue(undefined);
    const res = await request(createApp(ping)).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(ping).toHaveBeenCalledOnce();
  });

  it('GET /health : 503 quand la base ne répond pas', async () => {
    const ping = vi.fn().mockRejectedValue(new Error('connexion refusée'));
    const res = await request(createApp(ping)).get('/health').expect(503);
    expect(res.body).toEqual({ status: 'ko' });
  });
});
