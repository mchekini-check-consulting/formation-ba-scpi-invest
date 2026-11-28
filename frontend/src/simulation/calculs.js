// Règles de la simulation (US-08, SCPI-257), sans affichage. Revenus bruts (C6) :
// parts × prix de part × dernier taux de distribution connu, par an.
import { absent } from '../utils/format.js';

export const PLEINE_PROPRIETE = 'pleine-propriete';
export const NUE_PROPRIETE = 'nue-propriete';
export const USUFRUIT = 'usufruit';

export const TYPES = [
  { code: PLEINE_PROPRIETE, libelle: 'Pleine propriété' },
  { code: NUE_PROPRIETE, libelle: 'Nue-propriété' },
  { code: USUFRUIT, libelle: 'Usufruit' },
];

// Durée de placement (règle 2) : années entières de 1 à 30, 10 par défaut. Décision BA
// (US-09) : une durée par ligne, l'investisseur ne place pas forcément toutes ses SCPI sur
// la même période.
export const DUREE_MIN = 1;
export const DUREE_MAX = 30;
export const DUREE_PAR_DEFAUT = 10;

const arrondir = (montant) => Math.round(montant * 100) / 100;

let compteur = 0;
// Nouvelle ligne : SCPI (null : pas encore choisie), parts saisies (texte du champ), type,
// durée de démembrement (null en pleine propriété), durée de placement (en années)
export function nouvelleLigne(scpi = null, parts = '1') {
  compteur += 1;
  return {
    cle: compteur,
    scpi,
    parts,
    type: PLEINE_PROPRIETE,
    dureeDemembrement: null,
    duree: DUREE_PAR_DEFAUT,
  };
}

// ?scpi=3:10,7:5 (C1) -> une ligne par SCPI connue, en pleine propriété (règle 1). Parts
// absentes ou invalides : 1. Aucune SCPI : une ligne vide, à remplir.
export function lireLignes(parametre, scpis) {
  const connues = new Set(scpis.map((s) => s.id));
  const lignes = (parametre ?? '')
    .split(',')
    .map((morceau) => morceau.split(':'))
    .filter(([id]) => connues.has(Number(id)))
    .map(([id, parts]) =>
      nouvelleLigne(Number(id), /^\d+$/.test(parts ?? '') && Number(parts) > 0 ? parts : '1'),
    );
  return lignes.length ? lignes : [nouvelleLigne()];
}

// Types proposés pour une SCPI (règle 3) : démembrement seulement s'il est autorisé et
// qu'au moins une durée existe dans le référentiel
export function typesProposes(scpi) {
  const demembrement = scpi?.demembrement === true && scpi.decotes?.length > 0;
  return demembrement ? TYPES : TYPES.slice(0, 1);
}

// Nouveau type choisi : la première durée de démembrement est proposée par défaut
export function changerType(ligne, type, scpi) {
  if (type === PLEINE_PROPRIETE) return { ...ligne, type, dureeDemembrement: null };
  const garde = scpi.decotes.some((d) => d.duree === ligne.dureeDemembrement);
  return changerDemembrement(
    { ...ligne, type },
    garde ? ligne.dureeDemembrement : scpi.decotes[0].duree,
  );
}

// Durée du démembrement choisie. Usufruit (décision BA) : plus aucun revenu après le
// démembrement, la durée de placement (champ caché) est donc celle du démembrement.
export function changerDemembrement(ligne, dureeDemembrement) {
  const duree = ligne.type === USUFRUIT ? dureeDemembrement : ligne.duree;
  return { ...ligne, dureeDemembrement, duree };
}

// Nombre de mois, sur la durée de placement, où la ligne produit un revenu (règles 5 et 6) :
// jamais pendant le délai de jouissance (compté depuis le début du placement) ; usufruit :
// seulement pendant le démembrement ; nue-propriété : seulement après.
// Mois (comptés depuis le début du placement) où la ligne produit : [debut, arret[
function intervalleProductif({ type, delai, demembrement }, duree) {
  const fin = duree * 12;
  let debut = delai;
  let arret = fin;
  if (type === USUFRUIT) arret = Math.min(fin, demembrement * 12);
  if (type === NUE_PROPRIETE) debut = Math.max(delai, demembrement * 12);
  return [debut, arret];
}

export function moisProductifs(ligne, duree) {
  const [debut, arret] = intervalleProductif(ligne, duree);
  return Math.max(0, arret - debut);
}

// Calcul de l'impôt année par année : revenus réellement perçus chaque année de 1 à la fin
// de la simulation (année 1 : seulement les mois après le délai de jouissance), envoyés à
// l'estimation fiscale ; une année = [{ scpiId, revenuAnnuel }] (lignes qui produisent).
// lignes : { scpi, type, delai, demembrement, duree, revenuAnnuel }
export function revenusParAnnee(lignes) {
  return Array.from({ length: horizon(lignes) }, (_, i) =>
    lignes.flatMap((l) => {
      const [debut, arret] = intervalleProductif(l, l.duree);
      const mois = Math.max(0, Math.min(arret, (i + 1) * 12) - Math.max(debut, i * 12));
      return mois > 0
        ? [{ scpiId: l.scpi.id, revenuAnnuel: arrondir((l.revenuAnnuel / 12) * mois) }]
        : [];
    }),
  );
}

// Résultat d'une ligne. etat :
//   vide           : SCPI pas encore choisie
//   partsInvalides : nombre de parts qui n'est pas un entier > 0
//   nonCommunique  : prix de part ou taux de distribution absent du référentiel
//   sousMinimum    : valeur en pleine propriété sous le minimum de la SCPI (règle 8)
//   ok             : prise en compte dans le résultat
// Seules les lignes « ok » comptent dans le montant simulé et les revenus.
export function calculerLigne(ligne, scpi, duree = ligne.duree) {
  if (!scpi) return { etat: 'vide' };
  if (!/^\d+$/.test(ligne.parts) || Number(ligne.parts) <= 0) return { etat: 'partsInvalides' };
  if (absent(scpi.prixPart) || absent(scpi.tauxDistribution)) return { etat: 'nonCommunique' };
  const parts = Number(ligne.parts);
  const valeur = parts * scpi.prixPart;
  if (!absent(scpi.minimum) && valeur < scpi.minimum) {
    return { etat: 'sousMinimum', minimum: scpi.minimum };
  }
  // Délai absent du référentiel : 0 mois (règle 6)
  const delai = scpi.delaiJouissance ?? 0;
  const demembrement = ligne.type === PLEINE_PROPRIETE ? 0 : ligne.dureeDemembrement;
  const decote = scpi.decotes?.find((d) => d.duree === demembrement)?.decote ?? 0;
  // Montant (règle 4)
  let montant = valeur;
  if (ligne.type === NUE_PROPRIETE) montant = (valeur * (100 - decote)) / 100;
  if (ligne.type === USUFRUIT) montant = (valeur * decote) / 100;
  // Revenus (règle 5, C6)
  const revenuAnnuel = (valeur * scpi.tauxDistribution) / 100;
  const mois = moisProductifs({ type: ligne.type, delai, demembrement }, duree);
  return {
    etat: 'ok',
    montant: arrondir(montant),
    // Revenu d'une année productive, envoyé à l'estimation fiscale (US-09)
    revenuAnnuel,
    // En année pleine : une nue-propriété ne produit aucun revenu (C6, décision BA)
    annuelAnneePleine: ligne.type === NUE_PROPRIETE ? 0 : revenuAnnuel,
    cumul: (revenuAnnuel / 12) * mois,
    delai,
    demembrement,
    duree,
  };
}

// Résultat de la simulation (règle 7) : somme des lignes prises en compte
export function calculerSimulation(resultats) {
  const ok = resultats.filter((r) => r.etat === 'ok');
  const somme = (cle) => ok.reduce((total, r) => total + r[cle], 0);
  const annuel = somme('annuelAnneePleine');
  return {
    lignes: ok.length,
    montant: arrondir(somme('montant')),
    annuel: arrondir(annuel),
    mensuel: arrondir(annuel / 12),
    cumul: arrondir(somme('cumul')),
  };
}

// US-09 (SCPI-258) : revenus après fiscalité, à partir de l'estimation du backend (calcul
// US-07). Impôt et net annuels : ceux de la première période (une seule période quand le
// tableau s'affiche) ; cumul : somme des nets de chaque année, calculés séparément par le
// backend (l'année 1 a son propre impôt, changement de TMI compris).
export function apresFiscalite({ periodes: estimees, cumul }) {
  const premiere = estimees[0];
  const annuel = premiere?.net ?? 0;
  return {
    impot: premiere?.impot ?? 0,
    annuel,
    mensuel: arrondir(annuel / 12),
    cumul: cumul.net,
  };
}

// Taux d'impôt de chaque ligne (impôt ÷ revenu), pour le détail par SCPI et les graphiques :
// celui de sa part de l'impôt dans la première période où elle produit ; 0 si elle ne
// produit jamais ; null tant que l'estimation n'est pas connue.
export function tauxParLigne(nombre, lesPeriodes, estimees) {
  return Array.from({ length: nombre }, (_, k) => {
    if (!estimees) return null;
    const i = lesPeriodes.findIndex((p) => p.indices.includes(k));
    if (i < 0) return 0;
    const estimee = estimees[i]?.lignes[lesPeriodes[i].indices.indexOf(k)];
    return estimee?.revenuAnnuel > 0 ? estimee.impot / estimee.revenuAnnuel : 0;
  });
}

// Lignes envoyées à l'estimation fiscale : SCPI et revenu des lignes « ok », dans l'ordre
export function lignesAEstimer(lignes, resultats) {
  return lignes
    .map((l, i) => ({ ligne: l, resultat: resultats[i] }))
    .filter(({ resultat }) => resultat.etat === 'ok')
    .map(({ ligne, resultat }) => ({
      scpiId: ligne.scpi,
      revenuAnnuel: Math.round(resultat.revenuAnnuel * 100) / 100,
    }));
}

// Durée la plus longue des lignes : fin de la simulation (année 0 sans ligne)
export function horizon(lignes) {
  return lignes.reduce((max, l) => Math.max(max, l.duree), 0);
}

// Décision BA (US-09) : les revenus changent au fil des années. Les années sont découpées
// en périodes, une nouvelle à chaque changement :
//   - fin d'un usufruit pendant son placement : ses revenus s'arrêtent ;
//   - fin d'une nue-propriété pendant son placement : ses revenus commencent ;
//   - fin du placement d'une SCPI qui rapporte encore : ses revenus s'arrêtent.
// lignes : lignes « ok » { scpi, nom, type, demembrement (ans), duree (ans), revenuAnnuel }.
// Montants en année pleine (le délai de jouissance ne joue que sur le cumul). estimees :
// estimation du backend de chaque période (impôt sur le total de ses revenus), null tant
// qu'elle n'est pas connue. Chaque période : années (debut, fin), SCPI qui rapportent,
// changements qui l'ouvrent (evenements), revenus bruts, impôt et nets.
export function periodes(lignes, estimees = null) {
  const rapporte = (l, annee) => {
    if (annee > l.duree) return false;
    if (l.type === USUFRUIT) return annee <= l.demembrement;
    if (l.type === NUE_PROPRIETE) return annee > l.demembrement;
    return true;
  };
  const fin = horizon(lignes);
  const evenements = new Map([[1, []]]);
  const ajouter = (annee, evenement) =>
    evenements.set(annee, [...(evenements.get(annee) ?? []), evenement]);
  for (const l of lignes) {
    if (l.type !== PLEINE_PROPRIETE && l.demembrement < l.duree) {
      ajouter(l.demembrement + 1, { type: l.type, nom: l.nom, annee: l.demembrement });
    }
    if (l.duree < fin && rapporte(l, l.duree)) {
      ajouter(l.duree + 1, { type: 'fin', nom: l.nom, annee: l.duree });
    }
  }
  const debuts = [...evenements.keys()].sort((a, b) => a - b);
  return debuts.map((debut, i) => {
    const indices = lignes.flatMap((l, k) => (rapporte(l, debut) ? [k] : []));
    const actives = indices.map((k) => lignes[k]);
    const brut = actives.reduce((s, l) => s + l.revenuAnnuel, 0);
    // Impôt de la période : calculé par le backend sur le total de ses revenus par an
    const impot = estimees?.[i]?.impot ?? null;
    return {
      debut,
      fin: (debuts[i + 1] ?? fin + 1) - 1,
      scpis: [...new Set(actives.map((l) => l.nom))],
      evenements: evenements.get(debut),
      // Lignes qui produisent (positions dans lignes) et leurs revenus par an, envoyés à
      // l'estimation fiscale
      indices,
      revenus: actives.map((l) => ({ scpiId: l.scpi.id, revenuAnnuel: arrondir(l.revenuAnnuel) })),
      brut: arrondir(brut),
      mensuel: arrondir(brut / 12),
      impot,
      net: impot === null ? null : arrondir(brut - impot),
      netMensuel: impot === null ? null : arrondir((brut - impot) / 12),
      // TMI et taux moyen du foyer avec les revenus de la période (informations fiscales
      // renseignées seulement)
      avecScpi: estimees?.[i]?.avecScpi ?? null,
    };
  });
}

// « Années 1 à 5 », « Années 6 et 7 », « Année 8 »
export function annees({ debut, fin }) {
  if (debut === fin) return `Année ${debut}`;
  return `Années ${debut} ${fin === debut + 1 ? 'et' : 'à'} ${fin}`;
}
