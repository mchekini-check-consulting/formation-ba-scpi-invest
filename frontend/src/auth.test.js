import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ErreurApi,
  connecter,
  creerCompte,
  deconnecter,
  jeton,
  utilisateurConnecte,
} from './auth.js';

function reponse(status, corps) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => (corps === undefined ? Promise.reject(new Error('vide')) : Promise.resolve(corps)),
  };
}

let fetchMock;

beforeEach(() => {
  sessionStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('connecter (US-03a)', () => {
  it('POST /connexions, mémorise le jeton de session', async () => {
    const utilisateur = { id: 'u1', email: 'jean@exemple.fr' };
    fetchMock.mockResolvedValue(reponse(200, { utilisateur, jeton: 'jeton-2' }));
    const demande = { email: 'jean@exemple.fr', motDePasse: 'x' };

    expect(await connecter(demande, '/api')).toEqual(utilisateur);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/connexions');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual(demande);
    expect(jeton()).toBe('jeton-2');
  });

  it('identifiants incorrects : 401 avec le message du backend, pas de session', async () => {
    fetchMock.mockResolvedValue(reponse(401, { message: 'Email ou mot de passe incorrect' }));
    const err = await connecter({}, '/api').catch((e) => e);
    expect([err.status, err.message]).toEqual([401, 'Email ou mot de passe incorrect']);
    expect(jeton()).toBeNull();
  });
});

describe('creerCompte', () => {
  it('POST /comptes, mémorise le jeton de session', async () => {
    const utilisateur = { id: 'u1', email: 'jean@exemple.fr' };
    fetchMock.mockResolvedValue(reponse(201, { utilisateur, jeton: 'jeton-1' }));
    const demande = {
      email: 'jean@exemple.fr',
      motDePasse: 'x',
      confirmation: 'x',
      cguAcceptees: true,
    };

    expect(await creerCompte(demande, '/api')).toEqual(utilisateur);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/comptes');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options.body)).toEqual(demande);
    expect(jeton()).toBe('jeton-1');
  });

  it('refus métier : message du backend', async () => {
    fetchMock.mockResolvedValue(reponse(409, { message: 'Un compte existe déjà avec cet email' }));
    const err = await creerCompte({}, '/api').catch((e) => e);
    expect(err).toBeInstanceOf(ErreurApi);
    expect([err.status, err.message]).toEqual([409, 'Un compte existe déjà avec cet email']);
    expect(jeton()).toBeNull();
  });

  it('panne du serveur : message générique', async () => {
    fetchMock.mockResolvedValue(reponse(500, { message: 'erreur interne' }));
    await expect(creerCompte({}, '/api')).rejects.toThrow('momentanément indisponible');
    fetchMock.mockResolvedValue(reponse(502));
    await expect(creerCompte({}, '/api')).rejects.toThrow('momentanément indisponible');
  });
});

describe('utilisateurConnecte', () => {
  it('sans jeton : personne, aucun appel', async () => {
    expect(await utilisateurConnecte('/api')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GET /moi avec le jeton en Authorization: Bearer', async () => {
    sessionStorage.setItem('scpi-invest.session', 'jeton-1');
    fetchMock.mockResolvedValue(reponse(200, { id: 'u1', email: 'jean@exemple.fr' }));
    expect(await utilisateurConnecte('/api')).toEqual({ id: 'u1', email: 'jean@exemple.fr' });
    expect(fetchMock).toHaveBeenCalledWith('/api/moi', {
      headers: { Authorization: 'Bearer jeton-1' },
    });
  });

  it('session expirée (401) : jeton oublié', async () => {
    sessionStorage.setItem('scpi-invest.session', 'jeton-1');
    fetchMock.mockResolvedValue(reponse(401, { message: 'connexion requise' }));
    expect(await utilisateurConnecte('/api')).toBeNull();
    expect(jeton()).toBeNull();
  });

  it('panne : erreur', async () => {
    sessionStorage.setItem('scpi-invest.session', 'jeton-1');
    fetchMock.mockResolvedValue(reponse(503, {}));
    await expect(utilisateurConnecte('/api')).rejects.toBeInstanceOf(ErreurApi);
  });
});

describe('deconnecter', () => {
  it('ferme la session côté serveur et oublie le jeton', async () => {
    sessionStorage.setItem('scpi-invest.session', 'jeton-1');
    fetchMock.mockResolvedValue(reponse(200, { success: true }));
    await deconnecter('/api');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/sign-out');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer jeton-1');
    expect(jeton()).toBeNull();
  });

  it('serveur injoignable : jeton oublié quand même', async () => {
    sessionStorage.setItem('scpi-invest.session', 'jeton-1');
    fetchMock.mockRejectedValue(new TypeError('réseau'));
    await expect(deconnecter('/api')).rejects.toThrow('réseau');
    expect(jeton()).toBeNull();
  });
});

describe('stockage indisponible', () => {
  it('pas d’erreur, pas de session mémorisée', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    expect(jeton()).toBeNull();
    fetchMock.mockResolvedValue(reponse(201, { utilisateur: { id: 'u1' }, jeton: 'j' }));
    await expect(creerCompte({}, '/api')).resolves.toEqual({ id: 'u1' });
  });
});
