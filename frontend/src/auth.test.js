import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ErreurApi,
  DELAI_DECONNEXION_MS,
  EVENEMENT_SESSION_EXPIREE,
  appelAuthentifie,
  appelConnecte,
  connecter,
  creerCompte,
  deconnecter,
  envoyerFichierConnecte,
  jeton,
  oublierSessionExpiree,
  sessionExpiree,
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
  it('POST /comptes/connexion, mémorise le jeton de session', async () => {
    const utilisateur = { id: 'u1', email: 'jean@exemple.fr' };
    fetchMock.mockResolvedValue(reponse(200, { utilisateur, jeton: 'jeton-2' }));
    const demande = { email: 'jean@exemple.fr', motDePasse: 'x' };

    expect(await connecter(demande, '/api')).toEqual(utilisateur);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/comptes/connexion');
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

  it('GET /comptes/moi avec le jeton en Authorization: Bearer', async () => {
    sessionStorage.setItem('scpi-invest.session', 'jeton-1');
    fetchMock.mockResolvedValue(reponse(200, { id: 'u1', email: 'jean@exemple.fr' }));
    expect(await utilisateurConnecte('/api')).toEqual({ id: 'u1', email: 'jean@exemple.fr' });
    expect(fetchMock).toHaveBeenCalledWith('/api/comptes/moi', {
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

  it('oublie aussi les filtres du Catalogue (US-10a)', async () => {
    sessionStorage.setItem('scpi-invest.catalogue.filtres', '{}');
    fetchMock.mockResolvedValue(reponse(200, { success: true }));
    await deconnecter('/api');
    expect(sessionStorage.getItem('scpi-invest.catalogue.filtres')).toBeNull();
  });

  it('oublie aussi le rappel de mise à jour du profil fermé (US-05d)', async () => {
    sessionStorage.setItem('scpi-invest.rappel-profil.ferme', '1');
    fetchMock.mockResolvedValue(reponse(200, { success: true }));
    await deconnecter('/api');
    expect(sessionStorage.getItem('scpi-invest.rappel-profil.ferme')).toBeNull();
  });

  it('serveur injoignable : jeton oublié quand même, sans erreur (l’écran peut quitter)', async () => {
    sessionStorage.setItem('scpi-invest.session', 'jeton-1');
    fetchMock.mockRejectedValue(new TypeError('réseau'));
    await expect(deconnecter('/api')).resolves.toBeUndefined();
    expect(jeton()).toBeNull();
  });

  it('serveur qui ne répond pas : abandon après 5 secondes, jeton oublié', async () => {
    vi.useFakeTimers();
    try {
      sessionStorage.setItem('scpi-invest.session', 'jeton-1');
      fetchMock.mockReturnValue(new Promise(() => {}));
      let fini = false;
      const enCours = deconnecter('/api').then(() => {
        fini = true;
      });
      await vi.advanceTimersByTimeAsync(4_999);
      expect(fini).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await enCours;
      expect([fini, jeton(), DELAI_DECONNEXION_MS]).toEqual([true, null, 5_000]);
    } finally {
      vi.useRealTimers();
    }
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

describe('appelConnecte', () => {
  it('erreur serveur (5xx) : message générique', async () => {
    fetchMock.mockResolvedValue(reponse(500, { message: 'détail interne' }));
    const err = await appelConnecte('/connaissance-client', {}, '/api').catch((e) => e);
    expect(err).toBeInstanceOf(ErreurApi);
    expect(err.message).toContain('momentanément indisponible');
  });
});

describe('appelConnecte : réponse sans contenu (204)', () => {
  it('renvoie null sans lire de corps', async () => {
    fetchMock.mockResolvedValue(reponse(204));
    await expect(
      appelConnecte('/connaissance-client/pieces/rib', { methode: 'DELETE' }, '/api'),
    ).resolves.toBe(null);
  });
});

// Faux XMLHttpRequest : garde la dernière requête ; repondre(status, corps) la termine
class FauxXhr {
  static derniere = null;
  constructor() {
    this.entetes = {};
    this.upload = {};
    FauxXhr.derniere = this;
  }
  open(methode, url) {
    Object.assign(this, { methode, url });
  }
  setRequestHeader(nom, valeur) {
    this.entetes[nom] = valeur;
  }
  send(corps) {
    this.corps = corps;
  }
  avancer(loaded, total, lengthComputable = true) {
    this.upload.onprogress({ loaded, total, lengthComputable });
  }
  repondre(status, corps) {
    this.status = status;
    this.responseText = corps === undefined ? '' : JSON.stringify(corps);
    this.onload();
  }
}

describe('envoyerFichierConnecte (US-04c)', () => {
  beforeEach(() => vi.stubGlobal('XMLHttpRequest', FauxXhr));

  it('PUT du fichier tel quel, avec son type, la session et l’avancement', async () => {
    sessionStorage.setItem('scpi-invest.session', 'jeton-1');
    const progression = vi.fn();
    const fichier = new File(['%PDF-'], 'rib.pdf', { type: 'application/pdf' });
    const envoi = envoyerFichierConnecte(
      '/connaissance-client/pieces/rib',
      fichier,
      { progression },
      '/api',
    );
    const xhr = FauxXhr.derniere;
    expect([xhr.methode, xhr.url, xhr.corps]).toEqual([
      'PUT',
      '/api/connaissance-client/pieces/rib',
      fichier,
    ]);
    expect(xhr.entetes).toEqual({
      Authorization: 'Bearer jeton-1',
      'Content-Type': 'application/pdf',
    });
    xhr.avancer(25, 100);
    xhr.avancer(0, 0, false); // taille inconnue : ignoré
    expect(progression.mock.calls).toEqual([[0.25]]);
    xhr.repondre(200, { type: 'rib' });
    expect(await envoi).toEqual({ type: 'rib' });
  });

  it('type inconnu : octet-stream ; refus -> message du backend', async () => {
    const envoi = envoyerFichierConnecte(
      '/connaissance-client/pieces/rib',
      new File(['x'], 'scan'),
      {},
      '/api',
    );
    expect(FauxXhr.derniere.entetes['Content-Type']).toBe('application/octet-stream');
    FauxXhr.derniere.repondre(400, { message: 'Format non accepté' });
    const err = await envoi.catch((e) => e);
    expect(err).toBeInstanceOf(ErreurApi);
    expect([err.status, err.message]).toEqual([400, 'Format non accepté']);
  });

  it('erreur serveur, réponse illisible ou réseau coupé : message générique', async () => {
    const fichier = new File(['x'], 'a.pdf');
    const serveur = envoyerFichierConnecte('/p', fichier, {}, '/api');
    FauxXhr.derniere.status = 500;
    FauxXhr.derniere.responseText = 'pas du JSON';
    FauxXhr.derniere.onload();
    expect((await serveur.catch((e) => e)).message).toContain('momentanément indisponible');
    const reseau = envoyerFichierConnecte('/p', fichier);
    FauxXhr.derniere.onerror();
    const err = await reseau.catch((e) => e);
    expect([err.status, err.message]).toEqual([0, expect.stringContaining('indisponible')]);
  });

  it('US-03b : 401 pendant l’envoi avec une session : session expirée', async () => {
    sessionStorage.setItem('scpi-invest.session', 'jeton-1');
    const envoi = envoyerFichierConnecte('/p', new File(['x'], 'a.pdf'), {}, '/api');
    FauxXhr.derniere.repondre(401, { message: 'connexion requise' });
    expect((await envoi.catch((e) => e)).status).toBe(401);
    expect([jeton(), sessionExpiree()]).toEqual([null, true]);
  });
});

describe('US-03b : compte bloqué à la connexion', () => {
  it('429 : message du backend et heure de déblocage', async () => {
    fetchMock.mockResolvedValue(
      reponse(429, { message: 'Trop de tentatives', debloqueA: '2026-11-09T13:32:00.000Z' }),
    );
    const err = await connecter({ email: 'a@b.fr', motDePasse: 'x' }, '/api').catch((e) => e);
    expect([err.status, err.message, err.debloqueA]).toEqual([
      429,
      'Trop de tentatives',
      '2026-11-09T13:32:00.000Z',
    ]);
  });

  it('identifiants refusés (401) à la connexion : pas une session expirée', async () => {
    sessionStorage.setItem('scpi-invest.session', 'ancien');
    fetchMock.mockResolvedValue(reponse(401, { message: 'Email ou mot de passe incorrect' }));
    await connecter({ email: 'a@b.fr', motDePasse: 'x' }, '/api').catch(() => {});
    expect(sessionExpiree()).toBe(false);
  });
});

describe('US-03b : session expirée', () => {
  let prevenu;
  beforeEach(() => {
    prevenu = vi.fn();
    window.addEventListener(EVENEMENT_SESSION_EXPIREE, prevenu);
  });
  afterEach(() => window.removeEventListener(EVENEMENT_SESSION_EXPIREE, prevenu));

  it('401 avec une session : session oubliée, retenue comme expirée, routeur prévenu', async () => {
    sessionStorage.setItem('scpi-invest.session', 'jeton-1');
    fetchMock.mockResolvedValue(reponse(401, { message: 'connexion requise' }));
    const err = await appelAuthentifie('/api/scpis').catch((e) => e);
    expect(err.status).toBe(401);
    expect([jeton(), sessionExpiree()]).toEqual([null, true]);
    expect(prevenu).toHaveBeenCalledOnce();
  });

  it('401 sans session : ni message ni redirection (écran public ou jamais connecté)', async () => {
    fetchMock.mockResolvedValue(reponse(401, { message: 'connexion requise' }));
    await appelConnecte('/connaissance-client', {}, '/api').catch(() => {});
    expect(sessionExpiree()).toBe(false);
    expect(prevenu).not.toHaveBeenCalled();
  });

  it('utilisateurConnecte : 401 -> null et session expirée', async () => {
    sessionStorage.setItem('scpi-invest.session', 'jeton-1');
    fetchMock.mockResolvedValue(reponse(401, {}));
    expect(await utilisateurConnecte('/api')).toBeNull();
    expect(sessionExpiree()).toBe(true);
    expect(prevenu).toHaveBeenCalledOnce();
  });

  it('autre erreur (403, 500) : session gardée', async () => {
    sessionStorage.setItem('scpi-invest.session', 'jeton-1');
    fetchMock.mockResolvedValue(reponse(500, {}));
    await appelAuthentifie('/api/scpis').catch(() => {});
    expect([jeton(), sessionExpiree()]).toEqual(['jeton-1', false]);
  });

  it('nouvelle connexion ou oubli explicite : plus de « session expirée »', async () => {
    sessionStorage.setItem('scpi-invest.session-expiree', '1');
    fetchMock.mockResolvedValue(reponse(200, { utilisateur: { id: 'u1' }, jeton: 'j' }));
    await connecter({ email: 'a@b.fr', motDePasse: 'x' }, '/api');
    expect(sessionExpiree()).toBe(false);
    sessionStorage.setItem('scpi-invest.session-expiree', '1');
    oublierSessionExpiree();
    expect(sessionExpiree()).toBe(false);
  });

  it('stockage indisponible : pas d’erreur', async () => {
    sessionStorage.setItem('scpi-invest.session', 'jeton-1');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    fetchMock.mockResolvedValue(reponse(401, {}));
    await appelAuthentifie('/api/scpis').catch(() => {});
    expect(prevenu).toHaveBeenCalledOnce();
    expect(() => oublierSessionExpiree()).not.toThrow();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    expect(sessionExpiree()).toBe(false);
  });
});
