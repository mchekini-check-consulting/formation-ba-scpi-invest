// Écran où reprendre le parcours après la connexion (US-03a, scénarios 1 à 3 ;
// US-05b, scénario 11) :
// - formulaire investisseur validé -> Catalogue ;
// - sinon, dernier écran du parcours ouvert avant la déconnexion (fermeture du
//   navigateur comprise) : KYC ou formulaire investisseur (le Catalogue n'est
//   accessible qu'une fois le profil validé : formulaire investisseur à la place) ;
// - à défaut -> /kyc (qui renvoie au formulaire investisseur une fois le KYC validé ;
//   les écrans suivants exigent un KYC validé : ExigerKycComplete, US-04b).
// avancement = réponse de lireQuestionnaire, null si indisponible.
const CLE_PAGE = 'scpi-invest.derniere-page';
export const PAGES_DU_PARCOURS = ['/kyc', '/formulaire-investisseur', '/catalogue'];

// Gardé après la fermeture du navigateur (localStorage) : seulement une adresse
// d'écran, aucune donnée personnelle
export function memoriserPage(chemin) {
  if (!PAGES_DU_PARCOURS.includes(chemin)) return;
  try {
    localStorage.setItem(CLE_PAGE, chemin);
  } catch {
    // stockage indisponible : reprise par défaut sur /kyc
  }
}

export function pageMemorisee() {
  try {
    return localStorage.getItem(CLE_PAGE);
  } catch {
    return null;
  }
}

export function destinationApresConnexion(avancement, derniere = pageMemorisee()) {
  if (avancement?.valide) return '/catalogue';
  if (derniere === '/formulaire-investisseur' || derniere === '/catalogue') {
    return '/formulaire-investisseur';
  }
  return '/kyc';
}
