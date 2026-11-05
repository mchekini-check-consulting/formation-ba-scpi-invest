// Appels du KYC au backend (US-04b), pour l'utilisateur connecté :
//   GET /kyc -> { statut: 'en_cours' | 'complete', etape (1 à 6), reponses, valideLe }
// Pièces justificatives (US-04c) :
//   GET /kyc/pieces -> [{ type, nomFichier, format, taille, statut, deposeLe }]
import { appelConnecte, envoyerFichierConnecte } from '../auth.js';

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

export function listerPieces() {
  return appelConnecte('/kyc/pieces');
}

// Le nom du fichier part dans l'adresse (?nom=…), le fichier dans le corps ;
// progression(part de 0 à 1) pendant l'envoi
export function deposerPiece(type, fichier, progression) {
  const nom = encodeURIComponent(fichier.name);
  return envoyerFichierConnecte(`/kyc/pieces/${type}?nom=${nom}`, fichier, { progression });
}

export function supprimerPiece(type) {
  return appelConnecte(`/kyc/pieces/${type}`, { methode: 'DELETE' });
}
