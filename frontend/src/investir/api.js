import { apiBase } from '../api.js';
import { appelAuthentifie } from '../auth.js';

// Demandes d'investissement (US-11, SCPI-259), backend/src/demandes/ :
//   creerDemande({ scpiId, nombreParts, type }) -> dossier créé (statut demande_envoyee) ;
//     erreur 400 avec le message à afficher si la saisie est refusée, 403 si le KYC
//     n'est pas validé
//   lireDemande(id) -> dossier de l'investisseur ; erreur 404 « Cette demande est introuvable. »
export function creerDemande(saisie, base = apiBase()) {
  return appelAuthentifie(`${base}/demandes`, { method: 'POST', corps: saisie });
}

export function lireDemande(id, base = apiBase()) {
  return appelAuthentifie(`${base}/demandes/${encodeURIComponent(id)}`);
}
