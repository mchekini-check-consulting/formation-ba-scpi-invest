import { apiBase } from './api.js';
import { oublierFiltres } from './catalogue/filtres.js';

// Seul fichier du frontend qui connaît le fournisseur d'identité (Better-Auth via le
// backend aujourd'hui). La session est un jeton envoyé dans l'en-tête
// "Authorization: Bearer", comme un jeton d'accès OIDC : passer à Keycloak revient à
// réécrire ces fonctions (par exemple avec oidc-client-ts), sans toucher aux écrans.
// Jeton gardé le temps de la session du navigateur (sessionStorage) : fermer le
// navigateur déconnecte l'utilisateur.
const CLE_JETON = 'scpi-invest.session';

export function jeton() {
  try {
    return sessionStorage.getItem(CLE_JETON);
  } catch {
    return null;
  }
}

function memoriser(valeur) {
  try {
    if (valeur) {
      sessionStorage.setItem(CLE_JETON, valeur);
    } else {
      sessionStorage.removeItem(CLE_JETON);
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

// Erreur lisible par l'utilisateur : message renvoyé par le backend, sinon générique.
// debloqueA : fin du blocage du compte (429 à la connexion, US-03b), sinon undefined
export class ErreurApi extends Error {
  constructor(status, message, debloqueA) {
    super(message);
    this.status = status;
    this.debloqueA = debloqueA;
  }
}

const INDISPONIBLE = 'Le service est momentanément indisponible, réessayez dans quelques instants.';

function erreurDe(status, corps) {
  const message = status > 0 && status < 500 && corps?.message ? corps.message : INDISPONIBLE;
  return new ErreurApi(status, message, corps?.debloqueA);
}

// US-03b : session expirée (45 minutes sans appel au backend) ou fermée ailleurs.
// Une réponse 401 alors qu'une session existait : session oubliée, « session expirée »
// retenu pour l'écran de connexion, et l'évènement EVENEMENT_SESSION_EXPIREE prévient le routeur
// qui y renvoie. Sans session au départ : rien (l'écran gère l'accès non connecté).
export const EVENEMENT_SESSION_EXPIREE = 'scpi-invest:session-expiree';
const CLE_EXPIREE = 'scpi-invest.session-expiree';

function siSessionPerdue(status) {
  if (status !== 401 || !jeton()) return;
  memoriser(null);
  try {
    sessionStorage.setItem(CLE_EXPIREE, '1');
  } catch {
    // stockage indisponible : redirection sans le message
  }
  window.dispatchEvent(new Event(EVENEMENT_SESSION_EXPIREE));
}

// Vrai si la dernière session a expiré (message à afficher sur l'écran de connexion)
export function sessionExpiree() {
  try {
    return sessionStorage.getItem(CLE_EXPIREE) === '1';
  } catch {
    return false;
  }
}

export function oublierSessionExpiree() {
  try {
    sessionStorage.removeItem(CLE_EXPIREE);
  } catch {
    // stockage indisponible : rien à oublier
  }
}

async function erreur(reponse) {
  return erreurDe(reponse.status, await reponse.json().catch(() => ({})));
}

// Envoie la demande, mémorise la session renvoyée par le backend (jusqu'à la fermeture
// du navigateur ; côté backend, 45 minutes prolongées à chaque appel connecté)
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
  oublierSessionExpiree();
  return utilisateur;
}

// US-02a : crée le compte et ouvre la session
export function creerCompte(demande, base = apiBase()) {
  return ouvrirSession(`${base}/comptes`, demande);
}

// US-03a : connexion par email et mot de passe ; identifiants incorrects -> ErreurApi 401
// « Email ou mot de passe incorrect »
export function connecter(demande, base = apiBase()) {
  return ouvrirSession(`${base}/comptes/connexion`, demande);
}

// Appel d'une route réservée aux utilisateurs connectés (session dans l'en-tête
// Authorization), adresse complète : réponse JSON (null si 204), ou ErreurApi avec le
// message du backend (401 si la session est absente ou expirée : voir siSessionPerdue)
export async function appelAuthentifie(url, { method = 'GET', corps } = {}) {
  const avecCorps = corps !== undefined;
  const reponse = await fetch(url, {
    method,
    headers: enTetes(avecCorps),
    body: avecCorps ? JSON.stringify(corps) : undefined,
  });
  if (!reponse.ok) {
    siSessionPerdue(reponse.status);
    throw await erreur(reponse);
  }
  return reponse.status === 204 ? null : reponse.json();
}

// Utilisateur de la session en cours, null si personne n'est connecté
export async function utilisateurConnecte(base = apiBase()) {
  if (!jeton()) {
    return null;
  }
  const reponse = await fetch(`${base}/comptes/moi`, { headers: enTetes() });
  if (reponse.status === 401) {
    siSessionPerdue(401); // session expirée ou fermée
    return null;
  }
  if (!reponse.ok) {
    throw await erreur(reponse);
  }
  return reponse.json();
}

// Ne lève jamais d'erreur et n'attend pas plus de DELAI_DECONNEXION_MS : la session est
// oubliée dans le navigateur même si le serveur est en panne ou ne répond pas (elle y
// expire seule), et l'écran renvoie toujours à l'accueil.
export const DELAI_DECONNEXION_MS = 5_000;

export async function deconnecter(base = apiBase(), delaiMs = DELAI_DECONNEXION_MS) {
  let minuteur;
  const delaiEcoule = new Promise((fin) => {
    minuteur = setTimeout(fin, delaiMs);
  });
  try {
    await Promise.race([
      fetch(`${base}/auth/sign-out`, { method: 'POST', headers: enTetes(true), body: '{}' }),
      delaiEcoule,
    ]);
  } catch {
    // serveur injoignable : rien d'autre à faire
  } finally {
    clearTimeout(minuteur);
    memoriser(null);
    // Filtres du Catalogue gardés jusqu'à la déconnexion (US-10a)
    oublierFiltres();
  }
}

// Même appel qu'appelAuthentifie, avec un chemin relatif au backend
export function appelConnecte(chemin, { methode = 'GET', corps } = {}, base = apiBase()) {
  return appelAuthentifie(`${base}${chemin}`, { method: methode, corps });
}

// Envoi d'un fichier (US-04c) à une route réservée aux utilisateurs connectés : corps =
// le fichier tel quel, avec son type ; erreur -> ErreurApi avec le message du backend.
// XMLHttpRequest plutôt que fetch : lui seul indique l'avancement de l'envoi.
// progression(part) : part envoyée, de 0 à 1
export function envoyerFichierConnecte(
  chemin,
  fichier,
  { progression = () => {} } = {},
  base = apiBase(),
) {
  const entetes = enTetes();
  entetes['Content-Type'] = fichier.type || 'application/octet-stream';
  return new Promise((resoudre, rejeter) => {
    const requete = new XMLHttpRequest();
    requete.open('PUT', `${base}${chemin}`);
    for (const [nom, valeur] of Object.entries(entetes)) requete.setRequestHeader(nom, valeur);
    requete.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) progression(e.loaded / e.total);
    };
    requete.onload = () => {
      let corps = {};
      try {
        corps = JSON.parse(requete.responseText);
      } catch {
        // réponse vide ou illisible : message générique
      }
      if (requete.status >= 200 && requete.status < 300) {
        resoudre(corps);
      } else {
        siSessionPerdue(requete.status);
        rejeter(erreurDe(requete.status, corps));
      }
    };
    requete.onerror = () => rejeter(erreurDe(0, {}));
    requete.send(fichier);
  });
}
