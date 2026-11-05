// Carte d'identité de la sidebar (US-06) : nom de l'investisseur (réponses du KYC) et
// profil investisseur (US-05b). Une information absente ou indisponible n'empêche pas
// l'affichage : la carte se contente de ce qui est connu.
import { utilisateurConnecte } from '../auth.js';
import { lireProfil } from '../investisseur/api.js';
import { PROFILS } from '../investisseur/profils.js';
import { lireKyc } from '../kyc/api.js';

export async function lireIdentite({
  lireUtilisateur = utilisateurConnecte,
  lireLeKyc = lireKyc,
  lireLeProfil = lireProfil,
} = {}) {
  const [utilisateur, kyc, profil] = await Promise.all([
    lireUtilisateur().catch(() => null),
    lireLeKyc().catch(() => null),
    lireLeProfil().catch(() => null),
  ]);
  const reponses = kyc?.reponses ?? {};
  const prenom = typeof reponses.prenom === 'string' ? reponses.prenom.trim() : '';
  const nom = typeof reponses.nom === 'string' ? reponses.nom.trim() : '';
  return {
    nomComplet: [prenom, nom].filter(Boolean).join(' '),
    email: utilisateur?.email ?? '',
    profil: PROFILS[profil?.profil] ? profil.profil : null,
  };
}

// Initiales affichées dans la pastille : prénom et nom, sinon début de l'email
export function initiales({ nomComplet, email }) {
  const mots = nomComplet.split(/[\s-]+/).filter(Boolean);
  if (mots.length > 0) {
    return (mots[0][0] + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase();
  }
  return email ? email[0].toUpperCase() : '';
}
