import { apiBase } from './api.js';

// Seul fichier du frontend qui connaît le fournisseur d'identité (Better-Auth via le
// backend aujourd'hui). La session est un jeton envoyé dans l'en-tête
// "Authorization: Bearer", comme un jeton d'accès OIDC : passer à Keycloak revient à
// réécrire ces fonctions (par exemple avec oidc-client-ts), sans toucher aux écrans.
const CLE_JETON = 'scpi-invest.session';

export function jeton() {
  try {
    return localStorage.getItem(CLE_JETON);
  } catch {
    return null;
  }
}

function memoriser(valeur) {
  try {
    if (valeur) {
      localStorage.setItem(CLE_JETON, valeur);
    } else {
      localStorage.removeItem(CLE_JETON);
    }
  } catch {
    // stockage indisponible (navigation privée stricte) : session limitée à la page
  }
}

function enTetes(json = false) {
  const entetes = {};
  if (json) entetes['Content-Type'] = 'application/json';
  const valeur = jeton();
  if (valeur) entetes.Authorization = `Bearer ${valeur}`;
  return entetes;
}

// Erreur lisible par l'utilisateur : message renvoyé par le backend, sinon générique
export class ErreurApi extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function erreur(reponse) {
  const corps = await reponse.json().catch(() => ({}));
  const message =
    reponse.status < 500 && corps.message
      ? corps.message
      : 'Le service est momentanément indisponible, réessayez dans quelques instants.';
  return new ErreurApi(reponse.status, message);
}

// Envoie la demande, mémorise la session (7 jours) renvoyée par le backend
async function ouvrirSession(url, demande) {
  const reponse = await fetch(url, {
    method: 'POST',
    headers: enTetes(true),
    body: JSON.stringify(demande),
  });
  if (!reponse.ok) {
    throw await erreur(reponse);
  }
  const { utilisateur, jeton: nouveau } = await reponse.json();
  memoriser(nouveau);
  return utilisateur;
}

// US-02a : crée le compte et ouvre la session
export function creerCompte(demande, base = apiBase()) {
  return ouvrirSession(`${base}/comptes`, demande);
}

// US-03a : connexion par email et mot de passe ; identifiants incorrects -> ErreurApi 401
// « Email ou mot de passe incorrect »
export function connecter(demande, base = apiBase()) {
  return ouvrirSession(`${base}/connexions`, demande);
}

// Appel d'une route réservée aux utilisateurs connectés (session dans l'en-tête
// Authorization) : réponse JSON, ou ErreurApi (401 si la session est absente ou expirée)
export async function appelAuthentifie(url, { method = 'GET', corps } = {}) {
  const avecCorps = corps !== undefined;
  const reponse = await fetch(url, {
    method,
    headers: enTetes(avecCorps),
    body: avecCorps ? JSON.stringify(corps) : undefined,
  });
  if (!reponse.ok) {
    throw await erreur(reponse);
  }
  return reponse.json();
}

// Utilisateur de la session en cours, null si personne n'est connecté
export async function utilisateurConnecte(base = apiBase()) {
  if (!jeton()) {
    return null;
  }
  const reponse = await fetch(`${base}/moi`, { headers: enTetes() });
  if (reponse.status === 401) {
    memoriser(null); // session expirée ou fermée
    return null;
  }
  if (!reponse.ok) {
    throw await erreur(reponse);
  }
  return reponse.json();
}

export async function deconnecter(base = apiBase()) {
  try {
    await fetch(`${base}/auth/sign-out`, { method: 'POST', headers: enTetes(true), body: '{}' });
  } finally {
    memoriser(null);
  }
}
