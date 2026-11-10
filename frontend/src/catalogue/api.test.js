import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lireFiltresCatalogue, listerScpis, rechercherScpis } from './api.js';
import { FILTRES_VIDES } from './filtres.js';

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
    expect(await listerScpis(2, FILTRES_VIDES, '/api')).toEqual({ scpis: [], total: 0 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/scpis?page=2');
    expect(options.headers).toEqual({ Authorization: 'Bearer jeton-1' });
  });

  it('listerScpis : première page par défaut', async () => {
    await listerScpis(undefined, undefined, '/api');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/scpis?page=1');
  });

  it('listerScpis : filtres ajoutés à l’URL (US-10)', async () => {
    await listerScpis(
      1,
      { ...FILTRES_VIDES, categories: ['Santé'], taux: { min: 4, max: null } },
      '/api',
    );
    expect(fetchMock.mock.calls[0][0]).toBe('/api/scpis?page=1&categorie=Sant%C3%A9&tauxMin=4');
  });

  it('lireFiltresCatalogue : GET des valeurs du panneau avec la session', async () => {
    await lireFiltresCatalogue('/api');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/scpis/filtres');
    expect(options.headers).toEqual({ Authorization: 'Bearer jeton-1' });
  });

  it('rechercherScpis : GET de la recherche avec la session, texte encodé dans l’URL', async () => {
    await rechercherScpis('Épargne 100% & co', '/api');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/scpis/recherche?q=%C3%89pargne%20100%25%20%26%20co');
    expect(options.headers).toEqual({ Authorization: 'Bearer jeton-1' });
  });
});
