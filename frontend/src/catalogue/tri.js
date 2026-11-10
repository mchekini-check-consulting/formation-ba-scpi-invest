// Tri du Catalogue (US-11, SCPI-28) : 6 critères, chacun dans les deux sens. Le tri est
// fait par le backend sur tout le catalogue (paramètre tri=<critère>-<sens> de GET /scpis,
// backend/src/catalogue/tri.ts) : égalité -> ordre alphabétique, valeur manquante -> fin
// de liste quel que soit le sens.

export const TRI_PAR_DEFAUT = 'taux-desc';

export const OPTIONS_TRI = [
  { valeur: 'taux-desc', libelle: 'Taux de distribution — décroissant' },
  { valeur: 'taux-asc', libelle: 'Taux de distribution — croissant' },
  { valeur: 'capitalisation-desc', libelle: 'Capitalisation — décroissant' },
  { valeur: 'capitalisation-asc', libelle: 'Capitalisation — croissant' },
  { valeur: 'pays-asc', libelle: 'Zone géographique A → Z' },
  { valeur: 'pays-desc', libelle: 'Zone géographique Z → A' },
  { valeur: 'secteur-asc', libelle: 'Catégorie A → Z' },
  { valeur: 'secteur-desc', libelle: 'Catégorie Z → A' },
  { valeur: 'gerant-asc', libelle: 'Société de gestion A → Z' },
  { valeur: 'gerant-desc', libelle: 'Société de gestion Z → A' },
  { valeur: 'nom-asc', libelle: 'Nom A → Z' },
  { valeur: 'nom-desc', libelle: 'Nom Z → A' },
];

// Paramètre de l'URL : rien pour le tri par défaut (même résultat côté backend)
export function parametreTri(tri) {
  return tri && tri !== TRI_PAR_DEFAUT ? `tri=${encodeURIComponent(tri)}` : '';
}
