// Filtres du Catalogue (US-10a, US-10b, US-10c) : état des filtres choisis, paramètres
// envoyés au backend (GET /scpis, backend/src/catalogue/filtres.ts), pastilles des filtres
// actifs. Gardés le temps de la session du navigateur (sessionStorage), effacés à la
// déconnexion : « les filtres restent actifs tant que l'utilisateur ne quitte pas
// l'application ».

const CLE = 'scpi-invest.catalogue.filtres';

// Filtres à choix multiple : clé de l'état, paramètre de l'URL, titre du panneau
export const CHOIX = [
  { cle: 'categories', parametre: 'categorie', titre: 'Catégorie' },
  { cle: 'pays', parametre: 'pays', titre: 'Pays' },
  { cle: 'capitalisations', parametre: 'capitalisation', titre: 'Capitalisation' },
  { cle: 'gerants', parametre: 'gerant', titre: 'Société de gestion' },
];

// Filtres à plage (curseurs min/max) : pas du curseur et unité
export const PLAGES = [
  { cle: 'taux', titre: 'Taux de distribution', unite: '%', pas: 0.01 },
  { cle: 'prix', titre: 'Prix de la part', unite: '€', pas: 1 },
  { cle: 'frais', titre: 'Frais de souscription', unite: '%', pas: 0.1 },
  { cle: 'minimum', titre: 'Investissement minimum', unite: '€', pas: 10 },
];

export const FILTRES_VIDES = Object.freeze({
  categories: [],
  pays: [],
  capitalisations: [],
  gerants: [],
  taux: { min: null, max: null },
  prix: { min: null, max: null },
  frais: { min: null, max: null },
  minimum: { min: null, max: null },
});

const nombreFr = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export function formaterValeur(valeur, unite) {
  return `${nombreFr.format(valeur)} ${unite}`;
}

// Paramètres de l'URL de GET /scpis (sans la page) ; vide sans filtre
export function parametresFiltres(filtres) {
  const parametres = new URLSearchParams();
  for (const { cle, parametre } of CHOIX) {
    for (const valeur of filtres[cle]) parametres.append(parametre, valeur);
  }
  for (const { cle } of PLAGES) {
    const { min, max } = filtres[cle];
    if (min !== null) parametres.append(`${cle}Min`, String(min));
    if (max !== null) parametres.append(`${cle}Max`, String(max));
  }
  return parametres.toString();
}

// Ajoute ou retire une valeur d'un filtre à choix multiple
export function basculer(filtres, cle, valeur) {
  const valeurs = filtres[cle];
  return {
    ...filtres,
    [cle]: valeurs.includes(valeur) ? valeurs.filter((v) => v !== valeur) : [...valeurs, valeur],
  };
}

// Nouvelle plage ; une borne laissée à la valeur extrême du curseur ne filtre pas
export function changerPlage(filtres, cle, { min, max }, bornes) {
  return {
    ...filtres,
    [cle]: {
      min: min === null || min <= bornes.min ? null : min,
      max: max === null || max >= bornes.max ? null : max,
    },
  };
}

function libelleCapitalisation(code, options) {
  return options?.capitalisations?.find((t) => t.code === code)?.libelle ?? code;
}

function libellePlage(titre, unite, { min, max }) {
  if (min !== null && max !== null) {
    return `${titre} : ${formaterValeur(min, unite)} à ${formaterValeur(max, unite)}`;
  }
  if (min !== null) return `${titre} : ${formaterValeur(min, unite)} minimum`;
  return `${titre} : ${formaterValeur(max, unite)} maximum`;
}

// Une pastille par filtre actif : une par valeur choisie, une par plage (US-10c)
export function pastilles(filtres, options) {
  const liste = [];
  for (const { cle } of CHOIX) {
    for (const valeur of filtres[cle]) {
      liste.push({
        id: `${cle}:${valeur}`,
        libelle: cle === 'capitalisations' ? libelleCapitalisation(valeur, options) : valeur,
        retirer: (f) => basculer(f, cle, valeur),
      });
    }
  }
  for (const { cle, titre, unite } of PLAGES) {
    const plage = filtres[cle];
    if (plage.min === null && plage.max === null) continue;
    liste.push({
      id: cle,
      libelle: libellePlage(titre, unite, plage),
      retirer: (f) => ({ ...f, [cle]: { min: null, max: null } }),
    });
  }
  return liste;
}

function valide(filtres) {
  return (
    filtres !== null &&
    typeof filtres === 'object' &&
    CHOIX.every(({ cle }) => Array.isArray(filtres[cle])) &&
    PLAGES.every(({ cle }) => filtres[cle] && 'min' in filtres[cle] && 'max' in filtres[cle])
  );
}

export function relireFiltres() {
  try {
    const filtres = JSON.parse(sessionStorage.getItem(CLE));
    return valide(filtres) ? filtres : FILTRES_VIDES;
  } catch {
    return FILTRES_VIDES;
  }
}

export function memoriserFiltres(filtres) {
  try {
    sessionStorage.setItem(CLE, JSON.stringify(filtres));
  } catch {
    // stockage indisponible (navigation privée) : filtres gardés jusqu'au rechargement
  }
}

export function oublierFiltres() {
  try {
    sessionStorage.removeItem(CLE);
  } catch {
    // stockage indisponible : rien à effacer
  }
}
