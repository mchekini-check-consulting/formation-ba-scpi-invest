// Appels du KYC au backend (US-04b), pour l'utilisateur connecté :
//   GET /connaissance-client -> { statut: 'en_cours' | 'complete', etape (1 à 6), reponses, valideLe }
// Suggestions d'adresses (étape « Coordonnées », France) :
//   GET /adresses?recherche=… -> { adresses: [{ libelle, adresse, codePostal, ville }] }
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

// Liste vide si le service des adresses ne répond pas : la saisie reste libre
export async function suggererAdresses(recherche) {
  const parametres = new URLSearchParams({ recherche });
  const { adresses } = await appelConnecte(`/adresses?${parametres}`);
  return adresses;
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
