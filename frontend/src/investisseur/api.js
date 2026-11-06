import { apiBase } from '../api.js';
import { appelAuthentifie } from '../auth.js';

// Formulaire investisseur (US-05a) : avancement { etapeCourante, reponses, valide } de
// l'utilisateur connecté, enregistré à chaque passage d'étape (backend/src/investisseur/)
export function lireQuestionnaire(base = apiBase()) {
  return appelAuthentifie(`${base}/questionnaire-investisseur`);
}

export function enregistrerEtape(etape, reponses, base = apiBase()) {
  return appelAuthentifie(`${base}/questionnaire-investisseur/etapes/${etape}`, {
    method: 'PUT',
    corps: reponses,
  });
}

// « Réinitialiser » : efface en base les réponses de l'étape
export function reinitialiserEtape(etape, base = apiBase()) {
  return appelAuthentifie(`${base}/questionnaire-investisseur/etapes/${etape}`, {
    method: 'DELETE',
  });
}

// US-05b : profil calculé sur les réponses enregistrées (sans le score), puis validation
export function lireProfil(base = apiBase()) {
  return appelAuthentifie(`${base}/questionnaire-investisseur/profil`);
}

export function validerProfil(base = apiBase()) {
  return appelAuthentifie(`${base}/questionnaire-investisseur/validation`, {
    method: 'POST',
    corps: { certification: true },
  });
}
