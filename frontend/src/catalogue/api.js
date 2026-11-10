import { apiBase } from '../api.js';
import { appelAuthentifie } from '../auth.js';
import { FILTRES_VIDES, parametresFiltres } from './filtres.js';

// Catalogue (US-08) : une page de 12 SCPI triées par taux de distribution N-1, restreinte
// aux filtres choisis (US-10, filtres.js)
// { scpis, total, page, taillePage, nombrePages, anneeTaux, misAJourLe }
// (backend/src/catalogue/)
export function listerScpis(page = 1, filtres = FILTRES_VIDES, base = apiBase()) {
  const parametres = parametresFiltres(filtres);
  return appelAuthentifie(`${base}/scpis?page=${page}${parametres ? `&${parametres}` : ''}`);
}

// Valeurs proposées dans le panneau des filtres (US-10a, US-10b) :
// { categories, pays, gerants, capitalisations: [{ code, libelle }], taux, prix, frais,
//   minimum: { min, max }, anneeTaux }
export function lireFiltresCatalogue(base = apiBase()) {
  return appelAuthentifie(`${base}/scpis/filtres`);
}

// Recherche par nom, sur tout le catalogue (sans les filtres) : 20 SCPI au plus, mêmes
// cartes et même tri que listerScpis -> { scpis, anneeTaux }
export function rechercherScpis(texte, base = apiBase()) {
  return appelAuthentifie(`${base}/scpis/recherche?q=${encodeURIComponent(texte)}`);
}
