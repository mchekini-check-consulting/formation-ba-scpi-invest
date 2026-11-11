import { apiBase } from '../api.js';
import { appelAuthentifie } from '../auth.js';

// Formulaire investisseur (US-05a) : avancement { etapeCourante, reponses, valide } de
// l'utilisateur connecté, enregistré à chaque passage d'étape (backend/src/investisseur/)
export function lireQuestionnaire(base = apiBase()) {
  return appelAuthentifie(`${base}/formulaire-investisseur`);
}

export function enregistrerEtape(etape, reponses, base = apiBase()) {
  return appelAuthentifie(`${base}/formulaire-investisseur/etapes/${etape}`, {
    method: 'PUT',
    corps: reponses,
  });
}

// « Réinitialiser » : efface en base les réponses de l'étape
export function reinitialiserEtape(etape, base = apiBase()) {
  return appelAuthentifie(`${base}/formulaire-investisseur/etapes/${etape}`, {
    method: 'DELETE',
  });
}

// US-05b : profil calculé sur les réponses enregistrées (sans le score), puis validation
export function lireProfil(base = apiBase()) {
  return appelAuthentifie(`${base}/formulaire-investisseur/profil`);
}

export function validerProfil(base = apiBase()) {
  return appelAuthentifie(`${base}/formulaire-investisseur/validation`, {
    method: 'POST',
    corps: { certification: true },
  });
}

// US-05d : mise à jour d'un profil déjà validé. Les réponses des 5 étapes sont envoyées
// d'un coup : nouveau profil calculé sans rien enregistrer, puis validation (le nouveau
// profil devient actif, l'ancien est archivé)
export function apercuMiseAJour(reponses, base = apiBase()) {
  return appelAuthentifie(`${base}/formulaire-investisseur/mise-a-jour/apercu`, {
    method: 'POST',
    corps: { reponses },
  });
}

export function validerMiseAJour(reponses, base = apiBase()) {
  return appelAuthentifie(`${base}/formulaire-investisseur/mise-a-jour/validation`, {
    method: 'POST',
    corps: { reponses, certification: true },
  });
}
