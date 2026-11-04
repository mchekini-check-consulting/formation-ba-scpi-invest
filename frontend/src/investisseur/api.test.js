import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enregistrerEtape, lireQuestionnaire } from './api.js';

let fetchMock;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('scpi-invest.session', 'jeton-1');
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ etapeCourante: 2, reponses: {} }),
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('API du formulaire investisseur', () => {
  it('lireQuestionnaire : GET avec la session', async () => {
    expect(await lireQuestionnaire('/api')).toEqual({ etapeCourante: 2, reponses: {} });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/questionnaire-investisseur');
    expect(options.method).toBe('GET');
    expect(options.headers).toEqual({ Authorization: 'Bearer jeton-1' });
    expect(options.body).toBeUndefined();
  });

  it('enregistrerEtape : PUT des réponses de l’étape', async () => {
    await enregistrerEtape(3, { objectifs: ['retraite'] }, '/api');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/questionnaire-investisseur/etapes/3');
    expect(options.method).toBe('PUT');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ objectifs: ['retraite'] });
  });

  it('session absente ou expirée : erreur 401', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'connexion requise' }),
    });
    const err = await lireQuestionnaire('/api').catch((e) => e);
    expect(err.status).toBe(401);
  });
});
