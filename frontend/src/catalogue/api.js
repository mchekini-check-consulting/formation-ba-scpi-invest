import { apiBase } from '../api.js';
import { appelAuthentifie } from '../auth.js';
import { FILTRES_VIDES, parametresFiltres } from './filtres.js';
import { TRI_PAR_DEFAUT, parametreTri } from './tri.js';

// Catalogue (US-08) : une page de 12 SCPI dans l'ordre du tri choisi (US-11, tri.js ; par
// défaut taux de distribution N-1 décroissant), restreinte aux filtres choisis (US-10,
// filtres.js)
// { scpis, total, page, taillePage, nombrePages, anneeTaux, misAJourLe }
// (backend/src/catalogue/)
export function listerScpis(
  page = 1,
  filtres = FILTRES_VIDES,
  tri = TRI_PAR_DEFAUT,
  base = apiBase(),
) {
  const parametres = [`page=${page}`, parametreTri(tri), parametresFiltres(filtres)];
  return appelAuthentifie(`${base}/scpis?${parametres.filter(Boolean).join('&')}`);
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
