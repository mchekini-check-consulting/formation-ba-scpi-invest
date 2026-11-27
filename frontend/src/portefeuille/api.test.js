import { afterEach, describe, expect, it, vi } from 'vitest';
import { listerInvestissements } from './api.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('API du portefeuille (US-20)', () => {
  it('listerInvestissements : GET /portefeuille/investissements avec la session', async () => {
    sessionStorage.setItem('scpi-invest.session', 'jeton-1');
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ scpis: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    expect(await listerInvestissements('/api')).toEqual({ scpis: [] });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/portefeuille/investissements');
    expect(options.headers.Authorization).toBe('Bearer jeton-1');
  });

  it('adresse par défaut : celle du backend (apiBase)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ scpis: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    await listerInvestissements();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/portefeuille/investissements');
  });
});
