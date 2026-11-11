import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { fromNodeHeaders } from 'better-auth/node';
import { bearer } from 'better-auth/plugins';
import type { Logger } from 'pino';
import type { Db } from '../db/index.js';
import { authAccount, authSession, authUser, authVerification } from '../db/schema.js';
import { logger as loggerParDefaut } from '../logging/logger.js';
import { EmailDejaUtilise, type FournisseurIdentite } from './fournisseur.js';

const MINUTE = 60;

// US-03b : session valable 45 minutes, repoussée à 45 minutes à chaque appel d'une route
// réservée aux utilisateurs connectés (exigerConnexion -> getSession). Une écriture en
// base au plus par minute : la session expire après 44 à 45 minutes sans activité.
export const DUREE_SESSION = 45 * MINUTE;
export const PROLONGATION_SESSION = MINUTE;

// Better-Auth : email + mot de passe (haché scrypt), sessions stockées en base
// (table auth_session), prolongées par l'activité (voir DUREE_SESSION).
// Routes Better-Auth sous /auth (get-session, sign-out...) ; l'inscription passe par
// POST /comptes (règles métier : CGU, mot de passe), d'où /sign-up/email désactivée.
export function creerAuth(db: Db, secret: string, log: Logger = loggerParDefaut) {
  return betterAuth({
    secret,
    basePath: '/auth',
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: authUser,
        session: authSession,
        account: authAccount,
        verification: authVerification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true, // US-02a : connecté dès la création du compte
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    session: { expiresIn: DUREE_SESSION, updateAge: PROLONGATION_SESSION },
    disabledPaths: ['/sign-up/email'],
    // Session transmise par "Authorization: Bearer <jeton>" (frontend et gateway sur
    // deux adresses différentes ; même principe qu'un jeton OIDC)
    plugins: [bearer()],
    trustedOrigins: (request) => originesDeConfiance(hoteDe(request)),
    telemetry: { enabled: false },
    // Logs techniques de Better-Auth : JSON sans layer (kubectl logs, hors Loki)
    logger: {
      level: 'warn',
      log: (niveau, message) =>
        log[niveau === 'error' ? 'error' : 'warn']({ module: 'better-auth' }, message),
    },
  });
}

export type Auth = ReturnType<typeof creerAuth>;

// Refus de Better-Auth à la connexion qui signifient « identifiants incorrects »
// (compte inconnu, mauvais mot de passe, email mal formé, mot de passe trop long)
const IDENTIFIANTS_REFUSES = new Set([
  'INVALID_EMAIL_OR_PASSWORD',
  'INVALID_EMAIL',
  'PASSWORD_TOO_LONG',
]);

export function fournisseurBetterAuth(auth: Auth): FournisseurIdentite {
  return {
    async creerCompte(email, motDePasse) {
      try {
        const { user, token } = await auth.api.signUpEmail({
          body: { email, password: motDePasse, name: '' },
        });
        if (!token) {
          throw new Error('session non créée après l’inscription');
        }
        return { utilisateur: { id: user.id, email: user.email }, jeton: token };
      } catch (err) {
        if (err instanceof APIError && err.body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
          throw new EmailDejaUtilise();
        }
        throw err;
      }
    },
    async connecter(email, motDePasse) {
      try {
        const { user, token } = await auth.api.signInEmail({
          body: { email, password: motDePasse },
        });
        return { utilisateur: { id: user.id, email: user.email }, jeton: token };
      } catch (err) {
        if (err instanceof APIError && IDENTIFIANTS_REFUSES.has(String(err.body?.code))) {
          return null;
        }
        throw err;
      }
    },
    async utilisateurConnecte(headers) {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(headers) });
      return session ? { id: session.user.id, email: session.user.email } : null;
    },
    async identifiantDe(email) {
      const { internalAdapter } = await auth.$context;
      return (await internalAdapter.findUserByEmail(email))?.user.id ?? null;
    },
    // Compte « credential » (email + mot de passe haché) de l'utilisateur
    async verifierMotDePasse(utilisateurId, motDePasse) {
      const { internalAdapter, password } = await auth.$context;
      const comptes = await internalAdapter.findAccounts(utilisateurId);
      const hache = comptes.find((c) => c.providerId === 'credential')?.password;
      return hache ? password.verify({ hash: hache, password: motDePasse }) : false;
    },
    async changerEmail(utilisateurId, email) {
      const { internalAdapter } = await auth.$context;
      const existant = await internalAdapter.findUserByEmail(email);
      if (existant && existant.user.id !== utilisateurId) throw new EmailDejaUtilise();
      await internalAdapter.updateUser(utilisateurId, { email, emailVerified: false });
    },
  };
}

function hoteDe(request?: Request): string {
  return request?.headers.get('x-forwarded-host') ?? request?.headers.get('host') ?? '';
}

// Origines autorisées à appeler /auth avec des cookies, déduites de l'adresse appelée
// (aucune URL écrite en dur, comme apiBase côté frontend) :
//   gateway.<projet>.<env>.<domaine>  ->  https://frontend.<projet>.<env>.<domaine>
//   localhost:5173 (relais du serveur de dev)  ->  http://localhost:5173
export function originesDeConfiance(hote: string): string[] {
  const [premier, ...reste] = hote.split('.');
  if (premier === 'gateway' && reste.length > 0) {
    return [`https://frontend.${reste.join('.')}`];
  }
  const nom = hote.split(':')[0];
  if (nom === 'localhost' || /^[\d.]+$/.test(nom)) {
    return [`http://${hote}`];
  }
  return [];
}
