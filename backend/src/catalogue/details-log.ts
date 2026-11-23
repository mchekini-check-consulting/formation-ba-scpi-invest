import type { Details } from '../logging/logger.js';
import type { FiltresCatalogue, Plage } from './filtres.js';
import type { TriCatalogue } from './tri.js';

// Paramètres d'une consultation ou d'une recherche du Catalogue, pour la ligne de log de
// la requête (detaillerAction) : filtres actifs seulement, valeurs déjà validées.
// Textes libres (recherche, catégories, pays, gérants) bornés : ils viennent de l'URL.
export const LONGUEUR_MAX = 100;

export function borner(texte: string): string {
  return texte.slice(0, LONGUEUR_MAX);
}

function bornes({ min, max }: Plage): string {
  if (min !== null && max !== null) return `${min} à ${max}`;
  return min !== null ? `≥ ${min}` : `≤ ${max}`;
}

export function detailsCatalogue(filtres: FiltresCatalogue, tri: TriCatalogue): Details {
  const details: Details = {};
  const listes = {
    categories: filtres.categories,
    pays: filtres.pays,
    gerants: filtres.gerants,
    capitalisations: filtres.capitalisations,
    cashback: filtres.cashback.map(String),
  };
  for (const [nom, valeurs] of Object.entries(listes)) {
    if (valeurs.length > 0) details[nom] = borner(valeurs.join(','));
  }
  // Mode choisi (tous, uniquement), seulement s'il n'est pas celui par défaut
  if (filtres.categories.length > 0 && filtres.modeCategories !== 'au-moins-un') {
    details.modeCategories = filtres.modeCategories;
  }
  if (filtres.pays.length > 0 && filtres.modePays !== 'au-moins-un') {
    details.modePays = filtres.modePays;
  }
  for (const nom of ['taux', 'prix', 'frais', 'minimum'] as const) {
    const plage = filtres[nom];
    if (plage.min !== null || plage.max !== null) details[nom] = bornes(plage);
  }
  details.tri = `${tri.critere}-${tri.sens}`;
  return details;
}
