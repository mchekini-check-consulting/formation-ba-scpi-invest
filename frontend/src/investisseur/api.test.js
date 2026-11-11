import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apercuMiseAJour,
  enregistrerEtape,
  lireProfil,
  lireQuestionnaire,
  reinitialiserEtape,
  validerMiseAJour,
  validerProfil,
} from './api.js';

let fetchMock;

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem('scpi-invest.session', 'jeton-1');
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
    expect(url).toBe('/api/formulaire-investisseur');
    expect(options.method).toBe('GET');
    expect(options.headers).toEqual({ Authorization: 'Bearer jeton-1' });
    expect(options.body).toBeUndefined();
  });

  it('enregistrerEtape : PUT des réponses de l’étape', async () => {
    await enregistrerEtape(3, { objectifs: ['retraite'] }, '/api');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/formulaire-investisseur/etapes/3');
    expect(options.method).toBe('PUT');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ objectifs: ['retraite'] });
  });

  it('reinitialiserEtape : DELETE de l’étape', async () => {
    await reinitialiserEtape(2, '/api');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/formulaire-investisseur/etapes/2');
    expect(options.method).toBe('DELETE');
    expect(options.body).toBeUndefined();
  });

  it('lireProfil : GET du profil calculé (US-05b)', async () => {
    await lireProfil('/api');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/formulaire-investisseur/profil');
    expect(options.method).toBe('GET');
  });

  it('validerProfil : POST avec la certification (US-05b)', async () => {
    await validerProfil('/api');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/formulaire-investisseur/validation');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ certification: true });
  });

  it('apercuMiseAJour : POST des réponses des 5 étapes (US-05d)', async () => {
    await apercuMiseAJour({ 1: { revenus: '>200k' } }, '/api');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/formulaire-investisseur/mise-a-jour/apercu');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ reponses: { 1: { revenus: '>200k' } } });
  });

  it('validerMiseAJour : POST des réponses avec la certification (US-05d)', async () => {
    await validerMiseAJour({ 3: { objectifs: ['retraite'] } }, '/api');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/formulaire-investisseur/mise-a-jour/validation');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      reponses: { 3: { objectifs: ['retraite'] } },
      certification: true,
    });
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
