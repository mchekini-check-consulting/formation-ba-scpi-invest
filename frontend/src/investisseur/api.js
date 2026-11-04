import { apiBase } from '../api.js';
import { appelAuthentifie } from '../auth.js';

// Formulaire investisseur (US-05a) : avancement { etapeCourante, reponses } de
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
