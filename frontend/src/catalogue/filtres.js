// Filtres du Catalogue (US-10a, US-10b, US-10c) : état des filtres choisis, paramètres
// envoyés au backend (GET /scpis, backend/src/catalogue/filtres.ts), pastilles des filtres
// actifs. Gardés le temps de la session du navigateur (sessionStorage), effacés à la
// déconnexion : « les filtres restent actifs tant que l'utilisateur ne quitte pas
// l'application ».

const CLE = 'scpi-invest.catalogue.filtres';

// Combinaison des cases d'un même filtre. Seuls la catégorie et le pays (une SCPI en a
// plusieurs) laissent choisir ; les autres filtres sont toujours en « au moins un » (OU).
// Uniquement : secteurs (pays) de 25 % ou moins ignorés (backend, SEUIL_PRINCIPAL).
export const MODES = [
  { code: 'au-moins-un', libelle: 'Au moins un', liaison: 'ou' },
  { code: 'tous', libelle: 'Tous', liaison: 'et' },
  { code: 'uniquement', libelle: 'Uniquement', liaison: 'ou' },
];
export const MODE_PAR_DEFAUT = 'au-moins-un';

// Règle affichée sous un filtre à choix multiple, selon son mode
export function regle(code, nom) {
  if (code === 'tous') return 'Plusieurs cases : toutes présentes (ET)';
  if (code === 'uniquement') {
    return `Seulement ces ${nom}, sans compter ceux de 25 % ou moins (exclusif)`;
  }
  return 'Plusieurs cases : au moins une (OU)';
}

// Filtres à choix multiple : clé de l'état, paramètre de l'URL, titre du panneau ;
// mode : clé de l'état du mode, son paramètre d'URL et le nom des valeurs (règle) ;
// colonnes : cases sur deux colonnes (noms courts) ; recherche : longue liste, avec un
// champ de recherche et seulement les NOMBRE_VISIBLE premières valeurs au départ
export const CHOIX = [
  {
    cle: 'categories',
    parametre: 'categorie',
    titre: 'Catégorie',
    colonnes: true,
    mode: { cle: 'modeCategories', parametre: 'categorieMode', nom: 'secteurs' },
  },
  {
    cle: 'pays',
    parametre: 'pays',
    titre: 'Pays',
    colonnes: true,
    mode: { cle: 'modePays', parametre: 'paysMode', nom: 'pays' },
  },
  { cle: 'capitalisations', parametre: 'capitalisation', titre: 'Capitalisation' },
  {
    cle: 'gerants',
    parametre: 'gerant',
    titre: 'Société de gestion',
    court: 'Gestion',
    recherche: true,
  },
  {
    cle: 'frequences',
    parametre: 'frequence',
    titre: 'Fréquence de versement',
    court: 'Fréquence',
  },
];

// Filtres à plage (curseurs min/max) : pas du curseur et unité
export const PLAGES = [
  // Crans : 1 % pour les pourcentages, 10 € pour les montants, 1 mois pour la jouissance
  // (sa plage, 0 à 6 mois, est trop courte pour 10) ; extrémités alignées sur les crans
  { cle: 'taux', titre: 'Taux de distribution', unite: '%', pas: 1 },
  { cle: 'prix', titre: 'Prix de la part', unite: '€', pas: 10 },
  { cle: 'frais', titre: 'Frais de souscription', unite: '%', pas: 1 },
  { cle: 'fraisGestion', titre: 'Frais de gestion', unite: '%', pas: 1 },
  { cle: 'jouissance', titre: 'Délai de jouissance', unite: 'mois', pas: 1 },
  { cle: 'minimum', titre: 'Investissement minimum', unite: '€', pas: 10 },
];

// Cases « possible » : seulement les SCPI qui proposent l'option (paramètre <cle>=oui)
export const OPTIONS = [
  { cle: 'demembrement', titre: 'Démembrement possible' },
  { cle: 'versementProgramme', titre: 'Versement programmé possible' },
];

export const FILTRES_VIDES = Object.freeze({
  categories: [],
  modeCategories: MODE_PAR_DEFAUT,
  pays: [],
  modePays: MODE_PAR_DEFAUT,
  capitalisations: [],
  gerants: [],
  frequences: [],
  taux: { min: null, max: null },
  prix: { min: null, max: null },
  frais: { min: null, max: null },
  minimum: { min: null, max: null },
  fraisGestion: { min: null, max: null },
  jouissance: { min: null, max: null },
  demembrement: false,
  versementProgramme: false,
});

const nombreFr = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export function formaterValeur(valeur, unite) {
  return `${nombreFr.format(valeur)} ${unite}`;
}

// Paramètres de l'URL de GET /scpis (sans la page) ; vide sans filtre
export function parametresFiltres(filtres) {
  const parametres = new URLSearchParams();
  for (const { cle, parametre, mode } of CHOIX) {
    for (const valeur of filtres[cle]) parametres.append(parametre, valeur);
    if (mode && filtres[cle].length > 0 && filtres[mode.cle] !== MODE_PAR_DEFAUT) {
      parametres.append(mode.parametre, filtres[mode.cle]);
    }
  }
  for (const { cle } of PLAGES) {
    const { min, max } = filtres[cle];
    if (min !== null) parametres.append(`${cle}Min`, String(min));
    if (max !== null) parametres.append(`${cle}Max`, String(max));
  }
  for (const { cle } of OPTIONS) {
    if (filtres[cle]) parametres.append(cle, 'oui');
  }
  return parametres.toString();
}

export const NOMBRE_VISIBLE = 7;

function sansAccent(texte) {
  return texte
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr');
}

// Cases affichées d'une longue liste (société de gestion), sans appel au backend :
// - texte saisi : les valeurs dont le libellé le contient (majuscules et accents ignorés)
// - sinon, liste repliée : les NOMBRE_VISIBLE premières, plus celles déjà cochées
// cachees : nombre de valeurs non affichées (lien « Voir les … »)
export function valeursVisibles(valeurs, { choisies, texte = '', tout, libelle = (v) => v }) {
  const cherche = sansAccent(texte.trim());
  let visibles;
  if (cherche) visibles = valeurs.filter((v) => sansAccent(libelle(v)).includes(cherche));
  else if (tout) visibles = valeurs;
  else visibles = valeurs.filter((v, i) => i < NOMBRE_VISIBLE || choisies.includes(v));
  return { visibles, cachees: cherche ? 0 : valeurs.length - visibles.length };
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

function modeDe(filtres, mode) {
  const code = mode ? filtres[mode.cle] : MODE_PAR_DEFAUT;
  return MODES.find((m) => m.code === code) ?? MODES[0];
}

// Filtres actifs regroupés par critère, dans l'ordre du panneau : un groupe par filtre à
// choix multiple (une pastille par valeur, titre et nom court du critère), un par plage,
// un par case « possible » (sans titre : une seule pastille qui se suffit)
export function groupesActifs(filtres, options) {
  const liste = [];
  for (const { cle, titre, court = titre, mode } of CHOIX) {
    if (filtres[cle].length === 0) continue;
    const libelle = (v) => (cle === 'capitalisations' ? libelleCapitalisation(v, options) : v);
    liste.push({
      id: cle,
      titre,
      court,
      mode: modeDe(filtres, mode),
      pastilles: filtres[cle].map((valeur) => ({
        id: `${cle}:${valeur}`,
        libelle: libelle(valeur),
        retirer: (f) => basculer(f, cle, valeur),
      })),
    });
  }
  for (const { cle, titre, unite } of PLAGES) {
    const plage = filtres[cle];
    if (plage.min === null && plage.max === null) continue;
    const libelle = libellePlage(titre, unite, plage);
    liste.push({
      id: cle,
      pastilles: [
        { id: cle, libelle, retirer: (f) => ({ ...f, [cle]: { min: null, max: null } }) },
      ],
    });
  }
  for (const { cle, titre } of OPTIONS) {
    if (!filtres[cle]) continue;
    liste.push({
      id: cle,
      pastilles: [{ id: cle, libelle: titre, retirer: (f) => ({ ...f, [cle]: false }) }],
    });
  }
  return liste;
}

// Une pastille par filtre actif : une par valeur choisie, une par plage (US-10c)
export function pastilles(filtres, options) {
  return groupesActifs(filtres, options).flatMap((groupe) => groupe.pastilles);
}

// Phrase « Votre recherche » : une partie par critère actif (reliées par ET à l'écran).
// Chaque partie est une suite de morceaux : du texte, ou { liaison: 'ou' | 'et' } entre
// les valeurs d'un même critère (coloré à l'écran)
export function phraseRecherche(filtres, options) {
  return groupesActifs(filtres, options).map(({ titre, mode, pastilles: liste }) => {
    if (!titre) return [liste[0].libelle];
    const valeurs = liste.map((p) => p.libelle);
    const morceaux = [`${titre} : ${mode.code === 'uniquement' ? 'uniquement ' : ''}${valeurs[0]}`];
    valeurs.slice(1).forEach((valeur, i) => {
      if (i < valeurs.length - 2) morceaux.push(`, ${valeur}`);
      else morceaux.push(' ', { liaison: mode.liaison }, ` ${valeur}`);
    });
    if (mode.code === 'tous' && valeurs.length > 1) morceaux.push(' (tous)');
    return morceaux;
  });
}

function valide(filtres) {
  return (
    filtres !== null &&
    typeof filtres === 'object' &&
    CHOIX.every(({ cle }) => Array.isArray(filtres[cle])) &&
    CHOIX.every(({ mode }) => !mode || MODES.some((m) => m.code === filtres[mode.cle])) &&
    PLAGES.every(({ cle }) => filtres[cle] && 'min' in filtres[cle] && 'max' in filtres[cle]) &&
    OPTIONS.every(({ cle }) => typeof filtres[cle] === 'boolean')
  );
}

export function relireFiltres() {
  try {
    const lus = JSON.parse(sessionStorage.getItem(CLE));
    // Filtres gardés avant l'ajout de nouveaux filtres : ceux-ci démarrent vides
    const filtres = lus && typeof lus === 'object' ? { ...FILTRES_VIDES, ...lus } : null;
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
