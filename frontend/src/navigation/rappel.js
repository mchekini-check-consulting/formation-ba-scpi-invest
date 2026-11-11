// Rappel de mise à jour du profil investisseur (US-05d) : fermé par l'utilisateur, il
// ne revient pas avant la prochaine connexion (sessionStorage, effacé à la déconnexion).

const CLE = 'scpi-invest.rappel-profil.ferme';

// Écran de la mise à jour du profil investisseur (MiseAJourProfil.jsx)
export const CHEMIN_MISE_A_JOUR = '/profil-investisseur/mise-a-jour';

export function rappelFerme() {
  try {
    return sessionStorage.getItem(CLE) === '1';
  } catch {
    return false;
  }
}

export function fermerRappel() {
  try {
    sessionStorage.setItem(CLE, '1');
  } catch {
    // stockage indisponible (navigation privée) : fermé jusqu'au rechargement
  }
}

export function oublierRappelFerme() {
  try {
    sessionStorage.removeItem(CLE);
  } catch {
    // stockage indisponible : rien à effacer
  }
}
