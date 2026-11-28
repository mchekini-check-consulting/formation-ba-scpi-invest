import { afterEach, describe, expect, it, vi } from 'vitest';
import { estimerFiscalite, lireSimulables } from './api.js';

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

  it('estimerFiscalite : POST /estimation-fiscale avec les lignes, périodes et années, et le taux s’il est choisi', async () => {
    sessionStorage.setItem('scpi-invest.session', 'jeton-1');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ impot: 300 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const lignes = [{ scpiId: 3, revenuAnnuel: 1000 }];
    const demande = { lignes, periodes: [lignes], annees: [lignes] };
    expect(await estimerFiscalite(demande, null, '/api')).toEqual({ impot: 300 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/estimation-fiscale');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual(demande);
    await estimerFiscalite(demande, 11, '/api');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ ...demande, taux: 11 });
  });
});
