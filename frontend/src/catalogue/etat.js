// US-02 (règle 7) : page, tri et recherche du Catalogue gardés le temps de la session du
// navigateur, pour les retrouver au retour d'une fiche SCPI (les filtres ont leur propre
// mémoire : filtres.js). Effacés à la déconnexion.
import { OPTIONS_TRI, TRI_PAR_DEFAUT } from './tri.js';

const CLE = 'scpi-invest.catalogue.etat';

export const ETAT_INITIAL = { page: 1, tri: TRI_PAR_DEFAUT, saisie: '' };

function valide(etat) {
  return (
    etat &&
    Number.isInteger(etat.page) &&
    etat.page >= 1 &&
    OPTIONS_TRI.some((o) => o.valeur === etat.tri) &&
    typeof etat.saisie === 'string'
  );
}

export function relireEtat() {
  try {
    const lu = JSON.parse(sessionStorage.getItem(CLE));
    return valide(lu) ? lu : ETAT_INITIAL;
  } catch {
    return ETAT_INITIAL;
  }
}

export function memoriserEtat(etat) {
  try {
    sessionStorage.setItem(CLE, JSON.stringify(etat));
  } catch {
    // stockage indisponible (navigation privée) : retour sur la première page
  }
}

export function oublierEtat() {
  try {
    sessionStorage.removeItem(CLE);
  } catch {
    // stockage indisponible : rien à effacer
  }
}
