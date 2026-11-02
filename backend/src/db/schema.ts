import { bigint, boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// Schéma Drizzle : une table par export (pgTable). Après une modification :
//   npm run db:generate   ->  nouveau fichier SQL dans drizzle/, appliqué au démarrage
// Tables héritées de l'ancien backend (item, flyway_schema_history) : volontairement
// absentes, Drizzle n'y touche pas.

const horodatage = (nom: string) => timestamp(nom, { withTimezone: true });

// ---- Authentification (Better-Auth) : tables préfixées auth_, utilisées seulement par
// src/auth/. Passage à Keycloak / OIDC : ces tables disparaissent, les tables métier
// ci-dessous ne gardent que l'identifiant de l'utilisateur (sub OIDC).

export const authUser = pgTable('auth_user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: horodatage('created_at').notNull().defaultNow(),
  updatedAt: horodatage('updated_at').notNull().defaultNow(),
});

// Sessions en base : une ligne par connexion, supprimée à la déconnexion
export const authSession = pgTable(
  'auth_session',
  {
    id: text('id').primaryKey(),
    expiresAt: horodatage('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: horodatage('created_at').notNull().defaultNow(),
    updatedAt: horodatage('updated_at').notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
  },
  (t) => [index('auth_session_user_id_idx').on(t.userId)],
);

// Moyens de connexion d'un utilisateur : ici email + mot de passe (haché, scrypt)
export const authAccount = pgTable(
  'auth_account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: horodatage('access_token_expires_at'),
    refreshTokenExpiresAt: horodatage('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: horodatage('created_at').notNull().defaultNow(),
    updatedAt: horodatage('updated_at').notNull().defaultNow(),
  },
  (t) => [index('auth_account_user_id_idx').on(t.userId)],
);

export const authVerification = pgTable(
  'auth_verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: horodatage('expires_at').notNull(),
    createdAt: horodatage('created_at').notNull().defaultNow(),
    updatedAt: horodatage('updated_at').notNull().defaultNow(),
  },
  (t) => [index('auth_verification_identifier_idx').on(t.identifier)],
);

// Paramètres techniques générés au premier démarrage (clé de signature des sessions)
export const parametre = pgTable('parametre', {
  cle: text('cle').primaryKey(),
  valeur: text('valeur').notNull(),
});

// ---- Métier

// US-02a : date d'acceptation et version des CGU, à chaque acceptation.
// utilisateur_id = identifiant de l'utilisateur chez le fournisseur d'identité
// (Better-Auth aujourd'hui, sub Keycloak demain) : pas de clé étrangère vers auth_user.
export const acceptationCgu = pgTable(
  'acceptation_cgu',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    utilisateurId: text('utilisateur_id').notNull(),
    versionCgu: text('version_cgu').notNull(),
    accepteeLe: horodatage('acceptee_le').notNull().defaultNow(),
  },
  (t) => [index('acceptation_cgu_utilisateur_id_idx').on(t.utilisateurId)],
);
