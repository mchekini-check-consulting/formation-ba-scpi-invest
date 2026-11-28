import { afterEach, describe, expect, it, vi } from 'vitest';
import { creerDemande, lireDemande } from './api.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function reponse(corps, status = 200) {
  return vi.fn().mockResolvedValue({ ok: true, status, json: () => Promise.resolve(corps) });
}

describe('API des demandes d’investissement (US-11)', () => {
  it('creerDemande : POST /demandes avec la saisie et la session', async () => {
    sessionStorage.setItem('scpi-invest.session', 'jeton-1');
    const fetchMock = reponse({ id: 42 }, 201);
    vi.stubGlobal('fetch', fetchMock);
    const saisie = { scpiId: 7, nombreParts: 5, type: 'pleine_propriete' };

    expect(await creerDemande(saisie, '/api')).toEqual({ id: 42 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/demandes');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual(saisie);
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer jeton-1',
    });
  });

  it('lireDemande : GET /demandes/<id>', async () => {
    const fetchMock = reponse({ id: 42 });
    vi.stubGlobal('fetch', fetchMock);
    expect(await lireDemande('42', '/api')).toEqual({ id: 42 });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/demandes/42');
  });
});
