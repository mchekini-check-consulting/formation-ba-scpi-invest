import type { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';

function fauxPool(rows: unknown[] = []) {
  const query = vi.fn().mockResolvedValue({ rows });
  return { app: createApp({ query } as unknown as Pool), query };
}

describe('app', () => {
  it('GET / répond Hello', async () => {
    const { app } = fauxPool();
    await request(app).get('/').expect(200, 'Hello, World !');
  });
});

describe('/items', () => {
  it('GET liste les items', async () => {
    const { app } = fauxPool([{ id: 1, nom: 'a', description: null, creeLe: '2026-01-01' }]);
    const res = await request(app).get('/items').expect(200);
    expect(res.body).toEqual([{ id: 1, nom: 'a', description: null, creeLe: '2026-01-01' }]);
  });

  it('POST crée un item (nom et description nettoyés)', async () => {
    const { app, query } = fauxPool([{ id: 2, nom: 'b', description: null }]);
    await request(app).post('/items').send({ nom: ' b ', description: '  ' }).expect(201);
    expect(query.mock.calls[0][1]).toEqual(['b', null]);
  });

  it('POST refuse un nom vide', async () => {
    const { app, query } = fauxPool();
    await request(app).post('/items').send({ nom: ' ' }).expect(400);
    expect(query).not.toHaveBeenCalled();
  });
});
