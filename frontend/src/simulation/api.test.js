import { afterEach, describe, expect, it, vi } from 'vitest';
import { lireSimulables } from './api.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('API de la simulation (US-08)', () => {
  it('lireSimulables : GET /scpis/simulables avec la session', async () => {
    sessionStorage.setItem('scpi-invest.session', 'jeton-1');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: 3 }]),
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await lireSimulables('/api')).toEqual([{ id: 3 }]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/scpis/simulables');
    expect(options.headers).toEqual({ Authorization: 'Bearer jeton-1' });
  });
});
