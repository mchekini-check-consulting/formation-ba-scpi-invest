import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

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

// US-03b : échecs de connexion à la suite, par email (y compris un email sans compte).
// cle = empreinte SHA-256 de l'email normalisé : aucune adresse stockée en clair.
// Ligne supprimée à la connexion réussie, effacée une fois périmée. Un essai est compté
// dès son arrivée (avant la vérification du mot de passe) : echecs et dernier_echec
// incluent donc un essai en cours de vérification.
export const tentativeConnexion = pgTable('tentative_connexion', {
  cle: text('cle').primaryKey(),
  echecs: integer('echecs').notNull(),
  dernierEchec: horodatage('dernier_echec').notNull(),
  bloqueJusqua: horodatage('bloque_jusqua'),
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

// US-05a : réponses du formulaire investisseur (MIF2), une ligne par utilisateur,
// enregistrées à chaque étape pour la reprise. etape_courante = première étape non
// complétée (1 à 5), 6 = les 5 étapes sont complétées. reponses = { "1": {...}, ... }
// (une entrée par étape) ; version_questionnaire pour la traçabilité (US-05b).
export type ReponsesQuestionnaire = Record<string, Record<string, unknown>>;

export const questionnaireInvestisseur = pgTable('questionnaire_investisseur', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  utilisateurId: text('utilisateur_id').notNull().unique(),
  etapeCourante: integer('etape_courante').notNull().default(1),
  reponses: jsonb('reponses').$type<ReponsesQuestionnaire>().notNull().default({}),
  versionQuestionnaire: text('version_questionnaire').notNull(),
  creeLe: horodatage('cree_le').notNull().defaultNow(),
  misAJourLe: horodatage('mis_a_jour_le').notNull().defaultNow(),
});

// US-05b : profil investisseur validé (traçabilité réglementaire MIF2) : profil, score,
// réponses, avertissements affichés, date et heure de validation, version du
// questionnaire. Plusieurs lignes possibles par utilisateur : une mise à jour (US-05d)
// ajoute une ligne, l'ancienne est conservée (jamais écrasée).
export const profilInvestisseur = pgTable(
  'profil_investisseur',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    utilisateurId: text('utilisateur_id').notNull(),
    profil: text('profil').notNull(),
    score: integer('score').notNull(),
    reponses: jsonb('reponses').$type<ReponsesQuestionnaire>().notNull(),
    avertissements: jsonb('avertissements').$type<string[]>().notNull().default([]),
    versionQuestionnaire: text('version_questionnaire').notNull(),
    valideLe: horodatage('valide_le').notNull().defaultNow(),
  },
  (t) => [index('profil_investisseur_utilisateur_id_idx').on(t.utilisateurId)],
);

// US-04b : formulaire KYC d'un utilisateur (une ligne par utilisateur). Réponses
// enregistrées à chaque « Suivant » (reprise), figées à la validation (statut complete).
// etape = étape atteinte : 1 à 4, 5 = pièces justificatives (US-04c), 6 = récapitulatif.
export const statutKyc = pgEnum('statut_kyc', ['en_cours', 'complete']);

export type ReponsesKyc = Record<string, string | string[]>;

export const kyc = pgTable('kyc', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  utilisateurId: text('utilisateur_id').notNull().unique(),
  etape: integer('etape').notNull().default(1),
  reponses: jsonb('reponses').$type<ReponsesKyc>().notNull().default({}),
  statut: statutKyc('statut').notNull().default('en_cours'),
  valideLe: horodatage('valide_le'),
  creeLe: horodatage('cree_le').notNull().defaultNow(),
  modifieLe: horodatage('modifie_le').notNull().defaultNow(),
});

// US-04c : pièces justificatives du KYC, une ligne par pièce déposée (au plus une par
// type et par utilisateur : un nouveau dépôt remplace l'ancien). Le fichier est dans R2
// sous la clé `cle` (kyc/<utilisateur>/<type>), jamais en base.
// Statut : deposee (KYC en cours, modifiable) -> en_verification (à la validation du KYC)
// -> validee ou refusee, écrits par l'agent de vérification asynchrone (hors backend).
export const typePieceKyc = pgEnum('type_piece_kyc', [
  'identite',
  'identite_verso',
  'titre_sejour',
  'domicile',
  'rib',
  'origine_fonds',
  'ppe',
]);

export const statutPieceKyc = pgEnum('statut_piece_kyc', [
  'deposee',
  'en_verification',
  'validee',
  'refusee',
]);

export const kycPiece = pgTable(
  'kyc_piece',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    utilisateurId: text('utilisateur_id').notNull(),
    type: typePieceKyc('type').notNull(),
    nomFichier: text('nom_fichier').notNull(),
    format: text('format').notNull(), // application/pdf, image/jpeg ou image/png
    taille: integer('taille').notNull(), // en octets
    cle: text('cle').notNull(),
    statut: statutPieceKyc('statut').notNull().default('deposee'),
    deposeLe: horodatage('depose_le').notNull().defaultNow(),
    modifieLe: horodatage('modifie_le').notNull().defaultNow(),
  },
  (t) => [unique('kyc_piece_utilisateur_type_unique').on(t.utilisateurId, t.type)],
);

// US-06 : justificatifs déposés pour une mise à jour des informations personnelles
// (justificatif de domicile, pièce d'état civil, nouvelle pièce d'identité). Fichier dans
// R2 sous la clé `cle` (informations/<utilisateur>/<identifiant aléatoire>), jamais en base ;
// conservé même après une nouvelle modification (contrôle a posteriori par la conformité).
export const justificatif = pgTable(
  'justificatif',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    utilisateurId: text('utilisateur_id').notNull(),
    nomFichier: text('nom_fichier').notNull(),
    format: text('format').notNull(), // application/pdf, image/jpeg ou image/png
    taille: integer('taille').notNull(), // en octets
    cle: text('cle').notNull(),
    deposeLe: horodatage('depose_le').notNull().defaultNow(),
  },
  (t) => [index('justificatif_utilisateur_id_idx').on(t.utilisateurId)],
);

// US-06 : historique des modifications des informations personnelles, une ligne par champ
// modifié (ancienne et nouvelle valeur, date et heure), avec le justificatif fourni
export const historiqueInformation = pgTable(
  'historique_information',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    utilisateurId: text('utilisateur_id').notNull(),
    bloc: text('bloc').notNull(), // coordonnees, adresse, situation, identite
    champ: text('champ').notNull(),
    ancienneValeur: text('ancienne_valeur'),
    nouvelleValeur: text('nouvelle_valeur'),
    justificatifId: bigint('justificatif_id', { mode: 'number' }).references(() => justificatif.id),
    modifieLe: horodatage('modifie_le').notNull().defaultNow(),
  },
  (t) => [index('historique_information_utilisateur_id_idx').on(t.utilisateurId)],
);

// ---- Catalogue SCPI (import CSV, src/csv/)

export const frequence = pgEnum('frequence', [
  'Trimestrielle',
  'Mensuelle',
  'Annuelle',
  'Semestrielle',
  'Bimestrielle',
]);

export const secteur = pgEnum('secteur', [
  'Bureaux',
  'Commerces',
  'Hôtels',
  'Locaux d’activité',
  'Logistique',
  'Résidentiel',
  'Santé',
  'Transport',
  'Autre',
]);

export const TABLE_SCPI_CATALOG = pgTable('scpi_catalog', {
  id: serial('id').primaryKey(),
  nom: text().unique().notNull(),
  // taux de distributon
  minimum_souscription: integer(),
  // localisation
  // secteurs
  // prix_part
  capitalisation: bigint({ mode: 'number' }), // mode : number, sinon quand converti en JSON, ça passe pas!
  gerant: text(),
  frais_souscription: real(),
  frais_gestion: real(),
  delai_jouissance: integer(),
  frequence: frequence(),
  // valeur_reconstitution
  iban: text(),
  bic: text(),
  // decote_demembrement
  demembrement: boolean(),
  cashback: integer(),
  versement_programme: boolean(),
  publicite: text(),
  mise_a_jour: timestamp('mise_a_jour').notNull().defaultNow(),
  // US-07a : empreinte sha256 des valeurs converties de la ligne CSV ; même empreinte au
  // prochain import = SCPI inchangée, rien n'est écrit. Vide pour les SCPI importées avant.
  empreinte: text(),
});

export const TABLE_TAUX_DISTRIBUTION = pgTable(
  'scpi_taux_distribution',
  {
    id: serial('id').primaryKey(),
    taux: numeric({ precision: 5, scale: 2 }).notNull(),
    annee: integer(),
    scpi_id: integer('scpi_id')
      .notNull()
      .references(() => TABLE_SCPI_CATALOG.id, { onDelete: 'cascade' }),
  },
  (table) => [index('scpi_taux_distribution_scpi_id_idx').on(table.scpi_id)],
);

export const TABLE_LOCALISATION = pgTable(
  'scpi_localisation',
  {
    id: serial('id').primaryKey(),
    pays: text().notNull(),
    pourcentage: numeric({ precision: 5, scale: 2 }).notNull(),
    scpi_id: integer('scpi_id')
      .notNull()
      .references(() => TABLE_SCPI_CATALOG.id, { onDelete: 'cascade' }),
  },
  (table) => [index('scpi_localisation_scpi_id_idx').on(table.scpi_id)],
);

export const TABLE_SECTEURS = pgTable(
  'scpi_secteurs',
  {
    id: serial('id').primaryKey(),
    secteur: secteur().notNull(),
    pourcentage: numeric({ precision: 5, scale: 2 }).notNull(),
    scpi_id: integer('scpi_id')
      .notNull()
      .references(() => TABLE_SCPI_CATALOG.id, { onDelete: 'cascade' }),
  },
  (table) => [index('scpi_secteurs_scpi_id_idx').on(table.scpi_id)],
);

export const TABLE_PRIX_PART = pgTable(
  'scpi_prix_part',
  {
    id: serial('id').primaryKey(),
    prix: numeric({ precision: 10, scale: 2 }).notNull(),
    annee: integer().notNull(),
    scpi_id: integer('scpi_id')
      .notNull()
      .references(() => TABLE_SCPI_CATALOG.id, { onDelete: 'cascade' }),
  },
  (table) => [index('scpi_prix_part_scpi_id_idx').on(table.scpi_id)],
);

export const TABLE_VALEUR_RECONSTITUTION = pgTable(
  'scpi_valeur_recon',
  {
    id: serial('id').primaryKey(),
    valeur: numeric({ precision: 10, scale: 3 }).notNull(),
    annee: integer().notNull(),
    scpi_id: integer('scpi_id')
      .notNull()
      .references(() => TABLE_SCPI_CATALOG.id, { onDelete: 'cascade' }),
  },
  (table) => [index('scpi_valeur_recon_scpi_id_idx').on(table.scpi_id)],
);

export const TABLE_DECOTE_DEMEMBREMENT = pgTable(
  'scpi_decote_demembrement',
  {
    id: serial('id').primaryKey(),
    duree: integer().notNull(),
    decote: integer().notNull(),
    scpi_id: integer('scpi_id')
      .notNull()
      .references(() => TABLE_SCPI_CATALOG.id, { onDelete: 'cascade' }),
  },
  (table) => [index('scpi_decote_demembrement_scpi_id_idx').on(table.scpi_id)],
);

// US-07a : une ligne par exécution de l'import (rapport d'exécution). La date du dernier
// import réussi (US-08) = fin de la dernière ligne au statut "reussi".
export const statutImport = pgEnum('statut_import', [
  'en_cours',
  'reussi',
  'echec',
  'aucun_fichier',
]);

// Motif de rejet d'une ligne du CSV (rempli par les contrôles de l'US-07b)
export type RejetImport = { ligne: number; nom: string | null; motif: string };

// Refus du fichier entier expliqué en blocs (US-07b), pour l'écran du rapport :
// où (ligne du fichier, null = fichier entier), constat, cause probable, à faire, et le
// message d'origine de la lecture du CSV (détail technique). Jamais le contenu d'une ligne.
export type DetailErreurImport = {
  ligne: number | null;
  constat: string;
  cause: string | null;
  action: string | null;
  technique: string | null;
};

export const TABLE_IMPORT_RAPPORT = pgTable('import_rapport', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  debut: horodatage('debut').notNull().defaultNow(),
  fin: horodatage('fin'),
  fichier: text('fichier'), // vide quand aucun fichier n'a été trouvé
  statut: statutImport('statut').notNull().default('en_cours'),
  lues: integer('lues').notNull().default(0),
  ajoutees: integer('ajoutees').notNull().default(0),
  mises_a_jour: integer('mises_a_jour').notNull().default(0),
  inchangees: integer('inchangees').notNull().default(0),
  supprimees: integer('supprimees').notNull().default(0), // en base, absentes du fichier
  rejetees: integer('rejetees').notNull().default(0),
  rejets: jsonb('rejets').$type<RejetImport[]>().notNull().default([]),
  erreur: text('erreur'), // motif d'un échec du fichier entier
  // même motif en blocs, quand c'est le fichier qui est refusé (vide sinon)
  erreur_detail: jsonb('erreur_detail').$type<DetailErreurImport>(),
});

// DRIZZLE RELATIONS : pour simplifier les appels one-to-many avec une seule requête drizzle
// simplifie le code, améliore typescript def, le SQL final est le même

// Une SCPI -> plusieurs lignes dans chaque table enfant
export const scpiCatalogRelations = relations(TABLE_SCPI_CATALOG, ({ many }) => ({
  taux_distribution: many(TABLE_TAUX_DISTRIBUTION),
  localisation: many(TABLE_LOCALISATION),
  secteurs: many(TABLE_SECTEURS),
  prix_part: many(TABLE_PRIX_PART),
  valeur_reconstitution: many(TABLE_VALEUR_RECONSTITUTION),
  decote_demembrement: many(TABLE_DECOTE_DEMEMBREMENT),
}));

// Chaque ligne enfant -> sa SCPI (via scpi_id)
export const tauxDistributionRelations = relations(TABLE_TAUX_DISTRIBUTION, ({ one }) => ({
  scpi: one(TABLE_SCPI_CATALOG, {
    fields: [TABLE_TAUX_DISTRIBUTION.scpi_id],
    references: [TABLE_SCPI_CATALOG.id],
  }),
}));

export const localisationRelations = relations(TABLE_LOCALISATION, ({ one }) => ({
  scpi: one(TABLE_SCPI_CATALOG, {
    fields: [TABLE_LOCALISATION.scpi_id],
    references: [TABLE_SCPI_CATALOG.id],
  }),
}));

export const secteursRelations = relations(TABLE_SECTEURS, ({ one }) => ({
  scpi: one(TABLE_SCPI_CATALOG, {
    fields: [TABLE_SECTEURS.scpi_id],
    references: [TABLE_SCPI_CATALOG.id],
  }),
}));

export const prixPartRelations = relations(TABLE_PRIX_PART, ({ one }) => ({
  scpi: one(TABLE_SCPI_CATALOG, {
    fields: [TABLE_PRIX_PART.scpi_id],
    references: [TABLE_SCPI_CATALOG.id],
  }),
}));

export const valeurReconstitutionRelations = relations(TABLE_VALEUR_RECONSTITUTION, ({ one }) => ({
  scpi: one(TABLE_SCPI_CATALOG, {
    fields: [TABLE_VALEUR_RECONSTITUTION.scpi_id],
    references: [TABLE_SCPI_CATALOG.id],
  }),
}));

export const decoteDemembrementRelations = relations(TABLE_DECOTE_DEMEMBREMENT, ({ one }) => ({
  scpi: one(TABLE_SCPI_CATALOG, {
    fields: [TABLE_DECOTE_DEMEMBREMENT.scpi_id],
    references: [TABLE_SCPI_CATALOG.id],
  }),
}));
