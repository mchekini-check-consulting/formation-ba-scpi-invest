import { APIError } from 'better-auth/api';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/index.js';
import { captureLogs } from '../logging/capture.js';
import { type Auth, creerAuth, fournisseurBetterAuth, originesDeConfiance } from './better-auth.js';
import { EmailDejaUtilise } from './fournisseur.js';

// Faux mot de passe d'exemple, utilisé seulement par les tests
const EXEMPLE = 'Tr0pBien!Choisi';

function fauxAuth(api: Record<string, unknown>): Auth {
  return { api } as unknown as Auth;
}

describe('creerAuth', () => {
  const auth = creerAuth(
    {} as Db,
    'secret-de-test-suffisamment-long-0123456789',
    captureLogs().log,
  );

  it('US-03b : sessions de 45 minutes, prolongées au plus une fois par minute', () => {
    expect(auth.options.session).toEqual({ expiresIn: 2_700, updateAge: 60 });
  });

  it('mot de passe de 12 caractères minimum, connexion automatique après inscription', () => {
    expect(auth.options.emailAndPassword).toMatchObject({
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 12,
    });
  });

  it('inscription directe désactivée (passe par POST /comptes)', () => {
    expect(auth.options.disabledPaths).toEqual(['/sign-up/email']);
  });

  it('origines de confiance déduites de l’adresse appelée', async () => {
    const trusted = auth.options.trustedOrigins as (r?: Request) => Promise<string[]>;
    const req = new Request('http://x/auth/sign-out', {
      headers: { host: 'gateway.projet.dev.exemple.net' },
    });
    expect(await trusted(req)).toEqual(['https://frontend.projet.dev.exemple.net']);
    expect(await trusted()).toEqual([]);
  });

  it('logs de Better-Auth en JSON, sans layer', () => {
    const { log, lignes } = captureLogs();
    const avecLog = creerAuth({} as Db, 'secret-de-test-suffisamment-long-0123456789', log);
    avecLog.options.logger?.log?.('error', 'panne');
    avecLog.options.logger?.log?.('warn', 'attention');
    expect(lignes).toMatchObject([
      { level: 'ERROR', module: 'better-auth', msg: 'panne' },
      { level: 'WARN', module: 'better-auth', msg: 'attention' },
    ]);
    expect(lignes[0].layer).toBeUndefined();
  });
});

describe('fournisseurBetterAuth', () => {
  it('creerCompte : inscription Better-Auth, renvoie l’utilisateur et le jeton', async () => {
    const signUpEmail = vi.fn().mockResolvedValue({
      user: { id: 'u1', email: 'jean@exemple.fr', name: '' },
      token: 'jeton',
    });
    const compte = await fournisseurBetterAuth(fauxAuth({ signUpEmail })).creerCompte(
      'jean@exemple.fr',
      EXEMPLE,
    );
    expect(compte).toEqual({ utilisateur: { id: 'u1', email: 'jean@exemple.fr' }, jeton: 'jeton' });
    expect(signUpEmail).toHaveBeenCalledWith({
      body: { email: 'jean@exemple.fr', password: EXEMPLE, name: '' },
    });
  });

  it('creerCompte : email déjà utilisé -> EmailDejaUtilise', async () => {
    const existe = new APIError('UNPROCESSABLE_ENTITY', {
      code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
      message: 'User already exists',
    });
    const fournisseur = fournisseurBetterAuth(
      fauxAuth({ signUpEmail: vi.fn().mockRejectedValue(existe) }),
    );
    await expect(fournisseur.creerCompte('a@b.fr', 'x')).rejects.toBeInstanceOf(EmailDejaUtilise);
  });

  it('creerCompte : autre erreur relancée, session absente = erreur', async () => {
    const panne = new Error('panne');
    const enPanne = fournisseurBetterAuth(
      fauxAuth({ signUpEmail: vi.fn().mockRejectedValue(panne) }),
    );
    await expect(enPanne.creerCompte('a@b.fr', 'x')).rejects.toBe(panne);

    const sansJeton = fournisseurBetterAuth(
      fauxAuth({ signUpEmail: vi.fn().mockResolvedValue({ user: { id: 'u1' }, token: null }) }),
    );
    await expect(sansJeton.creerCompte('a@b.fr', 'x')).rejects.toThrow('session non créée');
  });

  it('connecter : connexion Better-Auth, renvoie l’utilisateur et le jeton', async () => {
    const signInEmail = vi.fn().mockResolvedValue({
      user: { id: 'u1', email: 'jean@exemple.fr', name: '' },
      token: 'jeton',
    });
    const compte = await fournisseurBetterAuth(fauxAuth({ signInEmail })).connecter(
      'jean@exemple.fr',
      EXEMPLE,
    );
    expect(compte).toEqual({ utilisateur: { id: 'u1', email: 'jean@exemple.fr' }, jeton: 'jeton' });
    expect(signInEmail).toHaveBeenCalledWith({
      body: { email: 'jean@exemple.fr', password: EXEMPLE },
    });
  });

  it('connecter : identifiants refusés -> null, autre erreur relancée', async () => {
    const refus = (code: string) =>
      new APIError('UNAUTHORIZED', { code, message: 'Invalid email or password' });
    const signInEmail = vi
      .fn()
      .mockRejectedValueOnce(refus('INVALID_EMAIL_OR_PASSWORD'))
      .mockRejectedValueOnce(refus('INVALID_EMAIL'))
      .mockRejectedValueOnce(refus('PASSWORD_TOO_LONG'))
      .mockRejectedValueOnce(refus('FAILED_TO_CREATE_SESSION'));
    const fournisseur = fournisseurBetterAuth(fauxAuth({ signInEmail }));

    expect(await fournisseur.connecter('a@b.fr', 'x')).toBeNull();
    expect(await fournisseur.connecter('a', 'x')).toBeNull();
    expect(await fournisseur.connecter('a@b.fr', 'x'.repeat(200))).toBeNull();
    await expect(fournisseur.connecter('a@b.fr', 'x')).rejects.toBeInstanceOf(APIError);
  });

  it('utilisateurConnecte : session lue depuis les en-têtes de la requête', async () => {
    const getSession = vi
      .fn()
      .mockResolvedValueOnce({ user: { id: 'u1', email: 'jean@exemple.fr' }, session: {} })
      .mockResolvedValueOnce(null);
    const fournisseur = fournisseurBetterAuth(fauxAuth({ getSession }));

    expect(await fournisseur.utilisateurConnecte({ authorization: 'Bearer jeton' })).toEqual({
      id: 'u1',
      email: 'jean@exemple.fr',
    });
    expect(getSession.mock.calls[0][0].headers.get('authorization')).toBe('Bearer jeton');
    expect(await fournisseur.utilisateurConnecte({})).toBeNull();
  });

  it('identifiantDe : identifiant du compte de cet email, null sans compte', async () => {
    const findUserByEmail = vi
      .fn()
      .mockResolvedValueOnce({ user: { id: 'u1' }, accounts: [] })
      .mockResolvedValueOnce(null);
    const auth = {
      api: {},
      $context: Promise.resolve({ internalAdapter: { findUserByEmail } }),
    } as unknown as Auth;
    const fournisseur = fournisseurBetterAuth(auth);

    expect(await fournisseur.identifiantDe('jean@exemple.fr')).toBe('u1');
    expect(findUserByEmail).toHaveBeenCalledWith('jean@exemple.fr');
    expect(await fournisseur.identifiantDe('inconnu@exemple.fr')).toBeNull();
  });

  it('verifierMotDePasse (US-06) : mot de passe du compte « credential »', async () => {
    const findAccounts = vi
      .fn()
      .mockResolvedValueOnce([
        { providerId: 'google', password: null },
        { providerId: 'credential', password: 'hache' },
      ])
      .mockResolvedValueOnce([]);
    const verify = vi.fn().mockResolvedValue(true);
    const auth = {
      api: {},
      $context: Promise.resolve({ internalAdapter: { findAccounts }, password: { verify } }),
    } as unknown as Auth;
    const fournisseur = fournisseurBetterAuth(auth);

    expect(await fournisseur.verifierMotDePasse('u1', EXEMPLE)).toBe(true);
    expect(verify).toHaveBeenCalledWith({ hash: 'hache', password: EXEMPLE });
    // Pas de compte à mot de passe : refusé
    expect(await fournisseur.verifierMotDePasse('u2', EXEMPLE)).toBe(false);
  });

  it('changerEmail (US-06) : nouvel e-mail ; déjà pris par un autre compte -> EmailDejaUtilise', async () => {
    const findUserByEmail = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ user: { id: 'u1' } })
      .mockResolvedValueOnce({ user: { id: 'u2' } });
    const updateUser = vi.fn().mockResolvedValue({});
    const auth = {
      api: {},
      $context: Promise.resolve({ internalAdapter: { findUserByEmail, updateUser } }),
    } as unknown as Auth;
    const fournisseur = fournisseurBetterAuth(auth);

    await fournisseur.changerEmail('u1', 'nouveau@exemple.fr');
    expect(updateUser).toHaveBeenCalledWith('u1', {
      email: 'nouveau@exemple.fr',
      emailVerified: false,
    });
    // Même compte : accepté
    await fournisseur.changerEmail('u1', 'nouveau@exemple.fr');
    await expect(fournisseur.changerEmail('u1', 'pris@exemple.fr')).rejects.toBeInstanceOf(
      EmailDejaUtilise,
    );
    expect(updateUser).toHaveBeenCalledTimes(2);
  });
});

describe('originesDeConfiance', () => {
  it('cluster : le frontend du même projet et du même environnement', () => {
    expect(
      originesDeConfiance('gateway.formation-ba-scpi-invest.qualif.check-consulting.net'),
    ).toEqual(['https://frontend.formation-ba-scpi-invest.qualif.check-consulting.net']);
  });

  it('poste de dev : l’adresse du serveur de dev', () => {
    expect(originesDeConfiance('localhost:5173')).toEqual(['http://localhost:5173']);
    expect(originesDeConfiance('127.0.0.1:8081')).toEqual(['http://127.0.0.1:8081']);
  });

  it('autre adresse : aucune origine', () => {
    expect(originesDeConfiance('exemple.net')).toEqual([]);
    expect(originesDeConfiance('')).toEqual([]);
  });
});
