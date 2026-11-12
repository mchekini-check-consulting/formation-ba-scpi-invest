// Message lisible de la ligne de log d'une requête (layer controller), en français,
// pour le dashboard Grafana « Logs métier ». Une entrée par route : "<VERBE> <route déclarée>".
//   action : ce que fait l'utilisateur ; succes : message si la requête aboutit (2xx),
//            défaut = action ; {param} est remplacé par la valeur de la route (validée,
//            donc seulement en cas de succès) ;
//   refus  : message par code HTTP refusé (4xx).
// Codes absents de refus : 401 -> session absente ou expirée, autre 4xx -> demande
// refusée, 5xx -> erreur technique. Route absente du dictionnaire : "<VERBE> <route> <code>".
// Paramètres de l'action (detaillerAction, logger.ts) entre parenthèses :
// " (recherche : horizon ; tri : taux-desc ; resultats : 3)".
// Utilisateur connu : son email à la fin (" — jean@exemple.fr"), sinon son userId ;
// aucune autre donnée personnelle ni valeur saisie dans ces messages.
import type { Details } from './logger.js';

type Messages = { action: string; succes?: string; refus?: Record<number, string> };

const MESSAGES: Record<string, Messages> = {
  // Comptes
  'POST /comptes': {
    action: 'Création de compte',
    succes: 'Compte créé',
    refus: {
      400: 'Création de compte refusée : email ou mot de passe invalide',
      409: 'Création de compte refusée : email déjà utilisé',
    },
  },
  'POST /comptes/connexion': {
    action: 'Connexion',
    succes: 'Connexion réussie',
    refus: {
      401: 'Connexion refusée, identifiants incorrects',
      429: 'Connexion bloquée (trop de tentatives)',
    },
  },
  'GET /comptes/moi': { action: 'Lecture du compte connecté' },

  // Catalogue
  'GET /scpis': {
    action: 'Consultation du catalogue SCPI',
    refus: { 400: 'Consultation du catalogue refusée : page, filtre ou tri invalide' },
  },
  'GET /scpis/filtres': { action: 'Chargement des filtres du catalogue' },
  'GET /scpis/recherche': {
    action: 'Recherche dans le catalogue',
    refus: { 400: 'Recherche dans le catalogue refusée : recherche invalide' },
  },
  'GET /adresses': { action: 'Suggestion d’adresses' },

  // Connaissance client (KYC)
  'GET /connaissance-client': { action: 'Lecture du KYC' },
  'PUT /connaissance-client': {
    action: 'Enregistrement du KYC',
    succes: 'KYC enregistré',
    refus: {
      400: 'Enregistrement du KYC refusé : étape invalide',
      409: 'Enregistrement du KYC refusé : KYC déjà validé',
    },
  },
  'POST /connaissance-client/validation': {
    action: 'Validation du KYC',
    succes: 'KYC validé',
    refus: {
      400: 'Validation du KYC refusée : dossier incomplet ou pièces manquantes',
      409: 'Validation du KYC refusée : KYC déjà validé',
    },
  },
  'GET /connaissance-client/pieces': { action: 'Liste des pièces KYC' },
  'PUT /connaissance-client/pieces/:typePiece': {
    action: 'Dépôt de pièce KYC',
    succes: 'Pièce KYC déposée ({typePiece})',
    refus: {
      400: 'Pièce KYC refusée : format invalide ou pièce non demandée',
      404: 'Pièce KYC refusée : type de pièce inconnu',
      409: 'Pièce KYC refusée : KYC déjà validé',
      413: 'Pièce KYC refusée : fichier trop gros',
    },
  },
  'DELETE /connaissance-client/pieces/:typePiece': {
    action: 'Suppression de pièce KYC',
    succes: 'Pièce KYC supprimée ({typePiece})',
    refus: {
      404: 'Suppression de pièce KYC refusée : pièce absente ou inconnue',
      409: 'Suppression de pièce KYC refusée : KYC déjà validé',
    },
  },

  // Questionnaire investisseur
  'GET /formulaire-investisseur': { action: 'Lecture du questionnaire investisseur' },
  'PUT /formulaire-investisseur/etapes/:etape': {
    action: 'Enregistrement d’une étape du questionnaire',
    succes: 'Étape {etape} du questionnaire enregistrée',
    refus: {
      400: 'Étape du questionnaire refusée : réponses manquantes ou étape invalide',
      409: 'Étape du questionnaire refusée : profil déjà validé',
    },
  },
  'DELETE /formulaire-investisseur/etapes/:etape': {
    action: 'Réinitialisation d’une étape du questionnaire',
    succes: 'Étape {etape} du questionnaire réinitialisée',
    refus: {
      400: 'Réinitialisation refusée : étape invalide',
      409: 'Réinitialisation refusée : profil déjà validé',
    },
  },
  'GET /formulaire-investisseur/profil': {
    action: 'Calcul du profil investisseur',
    refus: { 409: 'Calcul du profil refusé : questionnaire non terminé' },
  },
  'POST /formulaire-investisseur/validation': {
    action: 'Validation du profil investisseur',
    succes: 'Profil investisseur validé',
    refus: {
      400: 'Validation du profil refusée : certification manquante',
      409: 'Validation du profil refusée : questionnaire non terminé ou profil déjà validé',
    },
  },
  'POST /formulaire-investisseur/mise-a-jour/apercu': {
    action: 'Aperçu de la mise à jour du profil investisseur',
    refus: {
      400: 'Aperçu de la mise à jour refusé : réponses incomplètes',
      409: 'Aperçu de la mise à jour refusé : profil pas encore validé',
    },
  },
  'POST /formulaire-investisseur/mise-a-jour/validation': {
    action: 'Mise à jour du profil investisseur',
    succes: 'Profil investisseur mis à jour',
    refus: {
      400: 'Mise à jour du profil refusée : réponses incomplètes ou certification manquante',
      409: 'Mise à jour du profil refusée : profil pas encore validé',
    },
  },

  // Outil d'import du catalogue (dev uniquement : 404 ailleurs)
  'GET /outils/import-catalogue/etat': { action: 'Outil import : état consulté' },
  'PUT /outils/import-catalogue/fichier': {
    action: 'Outil import : dépôt de fichier',
    succes: 'Outil import : fichier déposé',
    refus: {
      400: 'Outil import : fichier refusé (vide ou illisible)',
      413: 'Outil import : fichier refusé (trop gros)',
    },
  },
  'POST /outils/import-catalogue/lancement': {
    action: 'Outil import : lancement',
    succes: 'Outil import : import lancé',
    refus: { 409: 'Outil import : lancement refusé, import déjà en cours' },
  },
  'GET /outils/import-catalogue/rapports': { action: 'Outil import : rapports consultés' },
  'GET /outils/import-catalogue/catalogue': { action: 'Outil import : catalogue consulté' },
};

// Routes Better-Auth (/auth/*chemin) : le chemin réel, fixé par Better-Auth, dit l'action
const AUTH: Record<string, string> = {
  '/auth/sign-out': 'Déconnexion',
  '/auth/get-session': 'Vérification de session',
};

export type Requete = {
  httpMethod: string;
  route: string; // route déclarée (/comptes/:id)
  chemin: string; // chemin réel, lu seulement pour /auth/*
  status: number;
  params: Record<string, string | string[]>; // string[] : paramètre joker (*chemin)
  userId?: string;
  email?: string;
  details?: Details;
};

export function messageRequete(r: Requete): string {
  const parametres = Object.entries(r.details ?? {})
    .map(([nom, valeur]) => `${nom} : ${valeur}`)
    .join(' ; ');
  const message = parametres ? `${phrase(r)} (${parametres})` : phrase(r);
  const qui = r.email ?? (r.userId && `utilisateur ${r.userId}`);
  return qui ? `${message} — ${qui}` : message;
}

function phrase({ httpMethod, route, chemin, status, params }: Requete): string {
  const messages =
    route === '/auth/*chemin'
      ? { action: AUTH[chemin] ?? 'Appel d’authentification' }
      : MESSAGES[`${httpMethod} ${route}`];
  if (!messages) {
    return `${httpMethod} ${route} ${status}`;
  }
  const { action, succes = action, refus = {} } = messages;
  if (status >= 500) {
    return `${action} : erreur technique (${status})`;
  }
  if (status >= 400) {
    return (
      refus[status] ??
      (status === 401
        ? `${action} : accès refusé, session absente ou expirée`
        : `${action} : demande refusée (${status})`)
    );
  }
  return succes.replace(/\{(\w+)\}/g, (modele, nom: string) => {
    const valeur = params[nom];
    return typeof valeur === 'string' ? valeur : modele;
  });
}
