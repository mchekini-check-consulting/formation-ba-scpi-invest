import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listerScpis } from './api.js';

let fetchMock;

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem('scpi-invest.session', 'jeton-1');
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ scpis: [], total: 0 }),
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('API du Catalogue (US-08)', () => {
  it('listerScpis : GET de la page demandée avec la session', async () => {
    expect(await listerScpis(2, '/api')).toEqual({ scpis: [], total: 0 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/scpis?page=2');
    expect(options.headers).toEqual({ Authorization: 'Bearer jeton-1' });
  });

  it('listerScpis : première page par défaut', async () => {
    await listerScpis(undefined, '/api');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/scpis?page=1');
  });
});
