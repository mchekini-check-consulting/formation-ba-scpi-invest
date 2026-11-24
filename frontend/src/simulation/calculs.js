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

// Durée de placement (règle 2) : années entières de 1 à 30, 10 par défaut
export const DUREE_MIN = 1;
export const DUREE_MAX = 30;
export const DUREE_PAR_DEFAUT = 10;

const arrondir = (montant) => Math.round(montant * 100) / 100;

let compteur = 0;
// Nouvelle ligne : SCPI (null : pas encore choisie), parts saisies (texte du champ), type,
// durée de démembrement (null en pleine propriété)
export function nouvelleLigne(scpi = null, parts = '1') {
  compteur += 1;
  return { cle: compteur, scpi, parts, type: PLEINE_PROPRIETE, dureeDemembrement: null };
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
  return {
    ...ligne,
    type,
    dureeDemembrement: garde ? ligne.dureeDemembrement : scpi.decotes[0].duree,
  };
}

// Nombre de mois, sur la durée de placement, où la ligne produit un revenu (règles 5 et 6) :
// jamais pendant le délai de jouissance (compté depuis le début du placement) ; usufruit :
// seulement pendant le démembrement ; nue-propriété : seulement après.
export function moisProductifs({ type, delai, demembrement }, duree) {
  const fin = duree * 12;
  let debut = delai;
  let arret = fin;
  if (type === USUFRUIT) arret = Math.min(fin, demembrement * 12);
  if (type === NUE_PROPRIETE) debut = Math.max(delai, demembrement * 12);
  return Math.max(0, arret - debut);
}

// Résultat d'une ligne. etat :
//   vide           : SCPI pas encore choisie
//   partsInvalides : nombre de parts qui n'est pas un entier > 0
//   nonCommunique  : prix de part ou taux de distribution absent du référentiel
//   sousMinimum    : valeur en pleine propriété sous le minimum de la SCPI (règle 8)
//   ok             : prise en compte dans le résultat
// Seules les lignes « ok » comptent dans le montant simulé et les revenus.
export function calculerLigne(ligne, scpi, duree) {
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
    // En année pleine : une nue-propriété ne produit aucun revenu (C6, décision BA)
    annuelAnneePleine: ligne.type === NUE_PROPRIETE ? 0 : revenuAnnuel,
    cumul: (revenuAnnuel / 12) * mois,
    delai,
    demembrement,
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
