// Appels du KYC au backend (US-04b), pour l'utilisateur connecté :
//   GET /connaissance-client -> { statut: 'en_cours' | 'complete', etape (1 à 6), reponses, valideLe }
// Pièces justificatives (US-04c) :
//   GET /connaissance-client/pieces -> [{ type, nomFichier, format, taille, statut, deposeLe }]
import { appelConnecte, envoyerFichierConnecte } from '../auth.js';

// Écran qui suit la validation du KYC : le formulaire investisseur (US-05a)
export const ECRAN_APRES_KYC = '/formulaire-investisseur';

export function lireKyc() {
  return appelConnecte('/connaissance-client');
}

export function enregistrerKyc(etape, reponses) {
  return appelConnecte('/connaissance-client', { methode: 'PUT', corps: { etape, reponses } });
}

export function validerKyc() {
  return appelConnecte('/connaissance-client/validation', { methode: 'POST', corps: {} });
}

// Communes d'un code postal (France) ; liste vide pour les autres pays ou si le service
// ne répond pas : la ville reste alors en saisie libre
export async function chercherCommunes(pays, codePostal) {
  const parametres = new URLSearchParams({ pays, codePostal });
  const { communes } = await appelConnecte(`/communes?${parametres}`);
  return communes;
}

export function listerPieces() {
  return appelConnecte('/connaissance-client/pieces');
}

// Le nom du fichier part dans l'adresse (?nom=…), le fichier dans le corps ;
// progression(part de 0 à 1) pendant l'envoi
export function deposerPiece(type, fichier, progression) {
  const nom = encodeURIComponent(fichier.name);
  return envoyerFichierConnecte(`/connaissance-client/pieces/${type}?nom=${nom}`, fichier, {
    progression,
  });
}

export function supprimerPiece(type) {
  return appelConnecte(`/connaissance-client/pieces/${type}`, { methode: 'DELETE' });
}
