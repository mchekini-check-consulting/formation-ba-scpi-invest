// Règles du comparateur (US-04), sans affichage
import { absent } from '../utils/format.js';

export const EMPLACEMENTS = 3;

const arrondir = (montant) => Math.round(montant * 100) / 100;

// ?scpi=3,7 -> [3, 7, null] : SCPI connues seulement, sans doublon, 3 au plus
export function lireSelection(parametre, scpis) {
  const connues = new Set(scpis.map((s) => s.id));
  const ids = (parametre ?? '').split(',').map(Number);
  const retenues = [...new Set(ids)].filter((id) => connues.has(id)).slice(0, EMPLACEMENTS);
  return Array.from({ length: EMPLACEMENTS }, (_, i) => retenues[i] ?? null);
}

// Revenu annuel brut estimé pour le montant saisi (règles 9 et 10, C6) :
// parts entières = montant ÷ prix de part (arrondi en dessous), montant investi = parts ×
// prix, revenu = montant investi × taux, en année pleine
export function revenuEstime(montant, scpi) {
  if (montant === null) return { etat: 'sansMontant' };
  if (absent(scpi.prixPart) || absent(scpi.tauxDistribution)) return { etat: 'nonCommunique' };
  const parts = Math.floor(montant / scpi.prixPart);
  const investi = arrondir(parts * scpi.prixPart);
  if (parts === 0 || (!absent(scpi.minimum) && investi < scpi.minimum)) {
    // Sans minimum dans le référentiel, le seuil est le prix d'une part
    return { etat: 'sousMinimum', seuil: scpi.minimum ?? scpi.prixPart };
  }
  const annuel = (investi * scpi.tauxDistribution) / 100;
  return { etat: 'ok', parts, investi, annuel: arrondir(annuel), mensuel: arrondir(annuel / 12) };
}

// Plus petit montant (en euros entiers) qui atteint le minimum de chaque SCPI choisie en
// parts entières : pour une SCPI, le minimum arrondi au nombre de parts supérieur
// (minimum 1 000 €, part à 610 € -> 2 parts -> 1 220 €). null si aucun prix n'est connu.
export function montantMinimalCommun(scpis) {
  const montants = scpis
    .filter((s) => !absent(s.prixPart))
    .map((s) => {
      const parts = Math.max(1, Math.ceil((s.minimum ?? 0) / s.prixPart - 1e-9));
      return Math.ceil(arrondir(parts * s.prixPart));
    });
  return montants.length ? Math.max(...montants) : null;
}

// Meilleure valeur d'une ligne (sens 'max' ou 'min') : au moins 2 valeurs connues, une
// seule SCPI en tête (pas d'égalité) ; sinon null, rien n'est mis en évidence
export function meilleureValeur(valeurs, sens) {
  const connues = valeurs.filter((v) => !absent(v));
  if (connues.length < 2) return null;
  const meilleure = sens === 'max' ? Math.max(...connues) : Math.min(...connues);
  return connues.filter((v) => v === meilleure).length === 1 ? meilleure : null;
}
