// Tri du Catalogue (US-11, SCPI-28) : 6 critères, chacun dans les deux sens. Le tri est
// fait par le backend sur tout le catalogue (paramètre tri=<critère>-<sens> de GET /scpis,
// backend/src/catalogue/tri.ts) : égalité -> ordre alphabétique, valeur manquante -> fin
// de liste quel que soit le sens.

export const TRI_PAR_DEFAUT = 'taux-desc';

// Critères du menu (MenuTri.jsx), affichés en groupes : titre du critère, puis ses deux
// sens. Nombres : décroissant / croissant ; textes : A → Z / Z → A.
const NOMBRE = [
  ['desc', 'Décroissant'],
  ['asc', 'Croissant'],
];
const TEXTE = [
  ['asc', 'A → Z'],
  ['desc', 'Z → A'],
];

export const GROUPES_TRI = [
  { critere: 'taux', titre: 'Taux de distribution', sens: NOMBRE },
  { critere: 'capitalisation', titre: 'Capitalisation', sens: NOMBRE },
  { critere: 'pays', titre: 'Zone géographique', sens: TEXTE },
  { critere: 'secteur', titre: 'Catégorie', sens: TEXTE },
  { critere: 'gerant', titre: 'Société de gestion', sens: TEXTE },
  { critere: 'nom', titre: 'Nom', sens: TEXTE },
].map(({ critere, titre, sens }) => ({
  critere,
  titre,
  options: sens.map(([code, court]) => ({
    valeur: `${critere}-${code}`,
    // libellé complet, lu par les lecteurs d'écran et affiché sur le bouton du menu :
    // « Capitalisation — croissant », « Nom A → Z »
    libelle: sens === NOMBRE ? `${titre} — ${court.toLowerCase()}` : `${titre} ${court}`,
    court,
  })),
}));

export const OPTIONS_TRI = GROUPES_TRI.flatMap((groupe) => groupe.options);

export function libelleTri(valeur) {
  return (OPTIONS_TRI.find((o) => o.valeur === valeur) ?? OPTIONS_TRI[0]).libelle;
}

// Paramètre de l'URL : rien pour le tri par défaut (même résultat côté backend)
export function parametreTri(tri) {
  return tri && tri !== TRI_PAR_DEFAUT ? `tri=${encodeURIComponent(tri)}` : '';
}
