// Fiche SCPI (US-02) : mise en forme des données renvoyées par le backend
// (backend/src/fiche/). Donnée absente -> « Non communiqué » (convention C4), jamais 0.
import { formaterCapitalisation } from '../catalogue/format.js';
import { absent, formaterEuros, formaterTaux, NON_COMMUNIQUE } from '../utils/format.js';

const ESPACE = ' '; // insécable

export const DONNEES_NON_DISPONIBLES = 'Données non disponibles';
export const VERSEMENT_NON_DISPONIBLE = 'Versements programmés non disponibles';

// Pays tels qu'écrits dans le référentiel (CSV) -> nom affiché et code ISO 3166 numérique
// (identifiant des pays de la carte, paquet world-atlas). Pays inconnu : nom du
// référentiel, absent de la carte mais présent dans la liste.
const PAYS = {
  France: { nom: 'France', iso: 250 },
  Allemagne: { nom: 'Allemagne', iso: 276 },
  Espagne: { nom: 'Espagne', iso: 724 },
  'Pays-Bas': { nom: 'Pays-Bas', iso: 528 },
  Irlande: { nom: 'Irlande', iso: 372 },
  'Gde Bretagne': { nom: 'Royaume-Uni', iso: 826 },
  GdeBretagne: { nom: 'Royaume-Uni', iso: 826 },
  'Royaume-Uni': { nom: 'Royaume-Uni', iso: 826 },
  Italie: { nom: 'Italie', iso: 380 },
  Portugal: { nom: 'Portugal', iso: 620 },
  Belgique: { nom: 'Belgique', iso: 56 },
  Pologne: { nom: 'Pologne', iso: 616 },
};

export function pays(libelle) {
  return PAYS[libelle?.trim()] ?? { nom: libelle, iso: null };
}

// Couleur d'un pays (carte et barre de la liste) selon sa part
export function couleurPays(part) {
  if (part >= 25) return '#5b2ee6';
  if (part >= 10) return '#3d6ef0';
  if (part >= 5) return '#1fb5d1';
  return '#6fdcbf';
}

// Couleurs des secteurs, dans l'ordre de la répartition (du plus fort au plus faible)
const COULEURS_SECTEURS = ['#e0457a', '#3d6ef0', '#8a5cf5', '#0f8f77', '#e86a1a', '#f2b33d'];
export const couleurSecteur = (rang) => COULEURS_SECTEURS[rang % COULEURS_SECTEURS.length];

// 30.28 -> « 30,28 % », 91 -> « 91 % »
export function formaterPart(part) {
  const decimales = Number.isInteger(part) ? 0 : 2;
  return `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(part)}${ESPACE}%`;
}

export function formaterMois(mois) {
  return absent(mois) ? NON_COMMUNIQUE : `${mois}${ESPACE}mois`;
}

export function formaterCapital(montant) {
  return absent(montant) ? NON_COMMUNIQUE : formaterCapitalisation(montant);
}

// Cashback (en %) : absent -> « Non communiqué », 0 -> « Aucun »
export function formaterCashback(cashback) {
  if (absent(cashback)) return NON_COMMUNIQUE;
  return Number(cashback) === 0 ? 'Aucun' : formaterPart(Number(cashback));
}

// Règle 3 : « dès X € », X = prix d'une part (un prélèvement = un nombre entier de parts)
export function texteVersement(fiche) {
  if (!fiche.versementProgramme) return VERSEMENT_NON_DISPONIBLE;
  return absent(fiche.prixPart) ? NON_COMMUNIQUE : `dès ${formaterEuros(fiche.prixPart.valeur)}`;
}

export function texteParts(parts) {
  if (absent(parts)) return null;
  return `soit ${parts} part${parts > 1 ? 's' : ''}`;
}

const REVENUS = {
  Mensuelle: 'mensuels',
  Bimestrielle: 'bimestriels',
  Trimestrielle: 'trimestriels',
  Semestrielle: 'semestriels',
  Annuelle: 'annuels',
};

// Pastilles sous le nom : fréquence des revenus, diversification, versement programmé
export function pastilles(fiche) {
  const liste = [];
  if (REVENUS[fiche.frequence]) liste.push(`Revenus ${REVENUS[fiche.frequence]}`);
  // « Autres » et pays inconnus ne comptent pas
  const nombrePays = listePays(fiche.repartitionGeographique).filter((p) => p.iso !== null).length;
  if (nombrePays > 1) liste.push(`Diversifiée · ${nombrePays} pays`);
  if (fiche.versementProgramme && fiche.prixPart) {
    liste.push(`Versement programmé dès ${formaterEuros(fiche.prixPart.valeur)}`);
  }
  return liste;
}

// Libellé d'une valeur annuelle d'historique
export const texteTaux = (v) => formaterTaux(v.valeur);
export const textePrix = (v) => formaterEuros(v.valeur);

// Règle 6 : adresses des boutons (convention C1)
export function liens(fiche) {
  return {
    investir: `/investir/${fiche.id}`,
    comparer: `/comparaison?scpi=${fiche.id}`,
    simuler: `/simulation?scpi=${fiche.id}:1`,
    versement: fiche.versementProgramme ? `/versements/nouveau?scpi=${fiche.id}` : null,
  };
}

// Pays de la liste : nom affiché, part et couleur ; deux libellés du référentiel pour un
// même pays (« Gde Bretagne », « GdeBretagne ») sont réunis
export function listePays(repartition) {
  const parNom = new Map();
  for (const { libelle, part } of repartition) {
    const { nom, iso } = pays(libelle);
    const existant = parNom.get(nom);
    parNom.set(nom, { nom, iso, part: Math.round(((existant?.part ?? 0) + part) * 100) / 100 });
  }
  return [...parNom.values()]
    .sort((a, b) => b.part - a.part || a.nom.localeCompare(b.nom, 'fr'))
    .map((p) => ({ ...p, couleur: couleurPays(p.part) }));
}

// Échelle resserrée autour des taux (les écarts restent visibles, graduations écrites) :
// pas de 0,2 %, 0,5 % ou 1 % selon l'écart entre le plus petit et le plus grand taux
export function echelleTaux(valeurs) {
  const taux = valeurs.map((v) => v.valeur);
  const [min, max] = [Math.min(...taux), Math.max(...taux)];
  let pas = 1;
  if (max - min <= 1.2) pas = 0.2;
  else if (max - min <= 3) pas = 0.5;
  const arrondi = (t) => Math.round(t * 10) / 10;
  const bas = Math.max(0, arrondi(Math.floor((min - pas * 1.5) / pas) * pas));
  const haut = arrondi(Math.ceil((max + pas * 0.75) / pas) * pas);
  const graduations = [];
  for (let i = 1; arrondi(bas + i * pas) <= haut; i++) graduations.push(arrondi(bas + i * pas));
  return { domaine: [bas, haut], graduations };
}
