import type { Tranche } from './bareme.js';
import type { InformationsFiscales } from './service.js';

// US-07 (SCPI-256) : règles du calcul de l'impôt estimé sur des revenus de SCPI, sans accès
// aux données (paramètres et informations fiscales fournis). Réutilisé par la simulation
// (US-09, SCPI-258) : aucune règle fiscale n'est réécrite ailleurs. Taux en %.

export type { Tranche } from './bareme.js';

export type Parametres = {
  // du plus petit plafond au plus grand, dernière tranche (plafond null) à la fin
  // (BAREME_2026 de bareme.ts)
  bareme: Tranche[];
  prelevementsSociaux: number;
  tauxForfaitaire: number;
};

// Revenu annuel brut d'une SCPI ; partFrance : part « France » de sa répartition
// géographique en %, null sans répartition (revenu traité comme français, règle 6)
export type Revenu = { scpiId: number; revenuAnnuel: number; partFrance: number | null };

export type ImpotLigne = {
  scpiId: number;
  revenuAnnuel: number;
  revenuFrance: number;
  revenuEtranger: number;
  impot: number;
};

export type Foyer = { parts: number; tmi: number; impotFoyer: number; tauxMoyen: number };

// Impôt d'un ensemble de revenus SCPI perçus la même année (ou par an pendant une période).
// Avec informations fiscales : impotRevenu (impôt sur le revenu dû aux SCPI, méthode du
// taux effectif) = impotRevenuFrance (part française) + impotRevenuEtranger (effet des
// revenus étrangers sur le taux), et prelevementsSociaux (revenus français) ; null sans
// informations fiscales.
export type ImpotGroupe = {
  revenus: number;
  impotRevenu: number | null;
  impotRevenuFrance: number | null;
  impotRevenuEtranger: number | null;
  prelevementsSociaux: number | null;
  impot: number;
  net: number;
  lignes: ImpotLigne[];
  // TMI et taux moyen du foyer avec ces revenus SCPI (null sans informations fiscales)
  avecScpi: AvecScpi | null;
};

// Détail de l'impôt dû aux SCPI sur toute la durée (somme des années demandées, l'année 1
// avec son propre calcul) : revenus SCPI français et étrangers, impôt sur le revenu de
// chaque part et prélèvements sociaux (part française)
export type DetailCumul = {
  revenuFrance: number;
  revenuEtranger: number;
  impotRevenuFrance: number;
  impotRevenuEtranger: number;
  prelevementsSociaux: number;
};

// TMI et taux moyen du foyer une fois tous les revenus SCPI ajoutés (français et
// étrangers) ; depassement : la part du revenu (foyer + SCPI) au-dessus du plafond de la
// tranche sans SCPI, quand la TMI change. Détail par an affiché sous le taux moyen (tableau
// « Part française / Part étrangère ») : revenus SCPI français et étrangers, impôt sur le
// revenu de chaque part (impotRevenuEtranger : effet des revenus étrangers sur le taux) et
// prélèvements sociaux (part française seulement)
export type AvecScpi = {
  tmi: number;
  tauxMoyen: number;
  depassement: { plafond: number; montant: number } | null;
  revenuFrance: number;
  revenuEtranger: number;
  impotRevenuFrance: number;
  impotRevenuEtranger: number;
  prelevementsSociaux: number;
};

export type Estimation = ImpotGroupe & {
  avecInformations: boolean;
  // avec informations fiscales seulement (null sinon) : foyer sans les revenus SCPI
  foyer: Foyer | null;
  // TMI et taux moyen avec les revenus SCPI de la période la plus haute (null sans
  // informations fiscales)
  avecScpi: AvecScpi | null;
  // sans informations fiscales : taux appliqué à tout le revenu (null sinon)
  tauxApplique: number | null;
  // une estimation par période demandée (revenus par an pendant la période)
  periodes: ImpotGroupe[];
  // somme des années demandées (année par année : l'année 1 a son propre calcul)
  cumul: { revenus: number; impot: number; net: number };
  // détail de ce cumul (null sans informations fiscales)
  detailCumul: DetailCumul | null;
};

// Revenus SCPI groupés : par période (revenus d'une année pleine de la période) et par
// année de placement (revenus réellement perçus cette année-là)
export type Groupes = { periodes?: Revenu[][]; annees?: Revenu[][] };

const arrondir = (n: number) => Math.round(n * 100) / 100;

// Règle 2 : 1 part (seul) ou 2 (en couple), + 0,5 par enfant pour les deux premiers,
// + 1 par enfant à partir du troisième
export function partsFiscales({ situationFamiliale, nombreEnfants }: InformationsFiscales) {
  const base = situationFamiliale === 'couple' ? 2 : 1;
  return base + 0.5 * Math.min(nombreEnfants, 2) + Math.max(nombreEnfants - 2, 0);
}

// Barème appliqué à un revenu par part : impôt par part, taux de sa tranche (TMI) et
// plafond de cette tranche (null pour la dernière). Un revenu égal à un plafond reste dans
// la tranche inférieure.
function bareme(revenuParPart: number, tranches: Tranche[]) {
  let impot = 0;
  let plancher = 0;
  for (const { plafond, taux } of tranches) {
    const haut = plafond ?? Infinity;
    impot += (Math.max(0, Math.min(revenuParPart, haut) - plancher) * taux) / 100;
    if (revenuParPart <= haut) return { impot, tmi: taux, plafond };
    plancher = haut;
  }
  return { impot, tmi: tranches.at(-1)?.taux ?? 0, plafond: null };
}

// Impôt du foyer (barème appliqué par part, multiplié par le nombre de parts)
function baremeFoyer(revenu: number, parts: number, tranches: Tranche[]) {
  const resultat = bareme(revenu / parts, tranches);
  return { ...resultat, impot: resultat.impot * parts };
}

// Règles 3 et 4 : TMI = taux de la tranche du revenu par part ; impôt du foyer = barème
// appliqué au revenu par part × nombre de parts (revenu déclaré, hors SCPI) ; taux moyen
// = impôt ÷ revenu (0 % pour un revenu nul), arrondi à 2 décimales comme affiché
export function foyer(informations: InformationsFiscales, tranches: Tranche[]): Foyer {
  const parts = partsFiscales(informations);
  const revenu = informations.revenuNetImposable;
  const { impot, tmi } = bareme(revenu / parts, tranches);
  const impotFoyer = arrondir(impot * parts);
  const tauxMoyen = revenu > 0 ? arrondir((impotFoyer / revenu) * 100) : 0;
  return { parts, tmi, impotFoyer, tauxMoyen };
}

const somme = (valeurs: number[]) => valeurs.reduce((s, v) => s + v, 0);

type Contexte = {
  parametres: Parametres;
  informations: InformationsFiscales | null;
  leFoyer: Foyer | null;
  tauxApplique: number | null;
};

// Revenu d'une ligne réparti entre France et étranger (sans répartition : France, règle 6)
function repartir({ revenuAnnuel, partFrance }: Revenu) {
  const part = partFrance === null ? 100 : Math.min(Math.max(partFrance, 0), 100);
  const revenuFrance = (revenuAnnuel * part) / 100;
  return { revenuFrance, revenuEtranger: revenuAnnuel - revenuFrance };
}

// Impôt d'un groupe de revenus perçus la même année, non arrondi. R = revenu du foyer,
// FR / ET = revenus SCPI français / étrangers, impôt(x) = barème appliqué à x ÷ parts, × parts.
// Avec informations fiscales (règles du 27/11/2026) :
//   - impôt sur le revenu dû aux SCPI = impôt(R + FR + ET) × (R + FR) ÷ (R + FR + ET)
//     − impôt(R) : méthode du taux effectif, les revenus étrangers ne sont pas imposés en
//     France mais font monter le taux ; la part au-dessus d'un plafond est taxée au taux de
//     la tranche suivante ;
//   - détail : part française = impôt(R + FR) − impôt(R), effet des revenus étrangers = le
//     reste ; chacun réparti entre les lignes au prorata de leurs revenus FR (ou ET) ;
//   - prélèvements sociaux : FR × 17,2 %, rien sur ET ;
//   - TMI et taux moyen avec SCPI : sur R + FR + ET.
// Sans : revenu × taux (forfaitaire, ou celui choisi dans la simulation, US-09).
function calculerGroupe(revenus: Revenu[], contexte: Contexte) {
  const { parametres, informations, leFoyer, tauxApplique } = contexte;
  const reparties = revenus.map((r) => ({ ...r, ...repartir(r) }));
  const total = somme(revenus.map((r) => r.revenuAnnuel));
  if (!informations || !leFoyer) {
    const lignes = reparties.map((r) => ({
      ...r,
      impot: (r.revenuAnnuel * (tauxApplique as number)) / 100,
    }));
    const impot = somme(lignes.map((l) => l.impot));
    return {
      total,
      lignes,
      impot,
      impotRevenu: null,
      impotRevenuFrance: null,
      impotRevenuEtranger: null,
      prelevementsSociaux: null,
      avecScpi: null,
    };
  }
  const { parts } = leFoyer;
  const revenu = informations.revenuNetImposable;
  const france = somme(reparties.map((r) => r.revenuFrance));
  const etranger = total - france;
  const base = revenu + total;
  const sans = baremeFoyer(revenu, parts, parametres.bareme);
  const avecFrance = baremeFoyer(revenu + france, parts, parametres.bareme);
  const avec = baremeFoyer(base, parts, parametres.bareme);
  const impotRevenu = base > 0 ? (avec.impot * (revenu + france)) / base - sans.impot : 0;
  const impotRevenuFrance = avecFrance.impot - sans.impot;
  const impotRevenuEtranger = impotRevenu - impotRevenuFrance;
  const prorata = (part: number, ensemble: number, montant: number) =>
    ensemble > 0 ? (montant * part) / ensemble : 0;
  const lignes = reparties.map((r) => {
    const irFrance = prorata(r.revenuFrance, france, impotRevenuFrance);
    const irEtranger = prorata(r.revenuEtranger, etranger, impotRevenuEtranger);
    const ps = (r.revenuFrance * parametres.prelevementsSociaux) / 100;
    return { ...r, impot: irFrance + irEtranger + ps };
  });
  const prelevementsSociaux = (france * parametres.prelevementsSociaux) / 100;
  const plafondFoyer = sans.plafond === null ? null : sans.plafond * parts;
  const avecScpi: AvecScpi = {
    tmi: avec.tmi,
    tauxMoyen: base > 0 ? arrondir((avec.impot / base) * 100) : 0,
    depassement:
      avec.tmi > sans.tmi && plafondFoyer !== null
        ? { plafond: plafondFoyer, montant: arrondir(base - plafondFoyer) }
        : null,
    revenuFrance: arrondir(france),
    revenuEtranger: arrondir(etranger),
    impotRevenuFrance: arrondir(impotRevenuFrance),
    impotRevenuEtranger: arrondir(impotRevenuEtranger),
    prelevementsSociaux: arrondir(prelevementsSociaux),
  };
  return {
    total,
    lignes,
    impot: impotRevenu + prelevementsSociaux,
    impotRevenu,
    impotRevenuFrance,
    impotRevenuEtranger,
    prelevementsSociaux,
    avecScpi,
  };
}

// Groupe arrondi au centime, pour la réponse
function arrondirGroupe(g: ReturnType<typeof calculerGroupe>): ImpotGroupe {
  const ouNull = (n: number | null) => (n === null ? null : arrondir(n));
  return {
    revenus: arrondir(g.total),
    impotRevenu: ouNull(g.impotRevenu),
    impotRevenuFrance: ouNull(g.impotRevenuFrance),
    impotRevenuEtranger: ouNull(g.impotRevenuEtranger),
    prelevementsSociaux: ouNull(g.prelevementsSociaux),
    impot: arrondir(g.impot),
    net: arrondir(g.total - g.impot),
    lignes: g.lignes.map((l) => ({
      scpiId: l.scpiId,
      revenuAnnuel: arrondir(l.revenuAnnuel),
      revenuFrance: arrondir(l.revenuFrance),
      revenuEtranger: arrondir(l.revenuEtranger),
      impot: arrondir(l.impot),
    })),
    avecScpi: g.avecScpi,
  };
}

// Somme des années : revenus SCPI français / étrangers, IR de chaque part et PS
function detailCumul(annees: ReturnType<typeof calculerGroupe>[]): DetailCumul | null {
  if (annees.some((a) => a.impotRevenu === null)) return null;
  const total = (lire: (a: (typeof annees)[number]) => number) => arrondir(somme(annees.map(lire)));
  const revenus = (a: (typeof annees)[number], cle: 'revenuFrance' | 'revenuEtranger') =>
    somme(a.lignes.map((l) => l[cle]));
  return {
    revenuFrance: total((a) => revenus(a, 'revenuFrance')),
    revenuEtranger: total((a) => revenus(a, 'revenuEtranger')),
    impotRevenuFrance: total((a) => a.impotRevenuFrance ?? 0),
    impotRevenuEtranger: total((a) => a.impotRevenuEtranger ?? 0),
    prelevementsSociaux: total((a) => a.prelevementsSociaux ?? 0),
  };
}

// Règles 5 à 8 et changement de tranche. revenus : toutes les lignes en année pleine ;
// groupes.periodes : revenus par an de chaque période ; groupes.annees : revenus perçus
// chaque année (cumul = somme des nets annuels, chaque année calculée séparément, sans
// reporter ses revenus sur l'année suivante). TMI et taux moyen « avec SCPI » : ceux de la
// période aux revenus les plus hauts (sans période : toutes les lignes).
export function estimer(
  revenus: Revenu[],
  parametres: Parametres,
  informations: InformationsFiscales | null,
  tauxChoisi?: number,
  groupes: Groupes = {},
): Estimation {
  const leFoyer = informations ? foyer(informations, parametres.bareme) : null;
  const tauxApplique = leFoyer ? null : (tauxChoisi ?? parametres.tauxForfaitaire);
  const contexte: Contexte = { parametres, informations, leFoyer, tauxApplique };
  const principal = calculerGroupe(revenus, contexte);
  const periodes = (groupes.periodes ?? []).map((g) => calculerGroupe(g, contexte));
  const annees = (groupes.annees ?? []).map((g) => calculerGroupe(g, contexte));
  const reference = periodes.reduce(
    (haute, p) => (p.total > haute.total ? p : haute),
    periodes[0] ?? principal,
  );
  const cumulRevenus = somme(annees.map((a) => a.total));
  const cumulImpot = somme(annees.map((a) => a.impot));
  return {
    avecInformations: leFoyer !== null,
    foyer: leFoyer,
    tauxApplique,
    ...arrondirGroupe(principal),
    avecScpi: reference.avecScpi,
    periodes: periodes.map(arrondirGroupe),
    cumul: {
      revenus: arrondir(cumulRevenus),
      impot: arrondir(cumulImpot),
      net: arrondir(cumulRevenus - cumulImpot),
    },
    detailCumul: detailCumul(annees),
  };
}
