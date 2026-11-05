// Appels du KYC au backend (US-04b), pour l'utilisateur connecté :
//   GET /kyc -> { statut: 'en_cours' | 'complete', etape (1 à 5), reponses, valideLe }
import { appelConnecte } from '../auth.js';

// Écran qui suit la validation du KYC : le formulaire investisseur (US-05a)
export const ECRAN_APRES_KYC = '/formulaire-investisseur';

export function lireKyc() {
  return appelConnecte('/kyc');
}

export function enregistrerKyc(etape, reponses) {
  return appelConnecte('/kyc', { methode: 'PUT', corps: { etape, reponses } });
}

export function validerKyc() {
  return appelConnecte('/kyc/validation', { methode: 'POST', corps: {} });
}

// Communes d'un code postal (France) ; liste vide pour les autres pays ou si le service
// ne répond pas : la ville reste alors en saisie libre
export async function chercherCommunes(pays, codePostal) {
  const parametres = new URLSearchParams({ pays, codePostal });
  const { communes } = await appelConnecte(`/communes?${parametres}`);
  return communes;
}
