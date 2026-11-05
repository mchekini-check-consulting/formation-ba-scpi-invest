import type { ReponsesQuestionnaire } from '../db/schema.js';

// Calcul du profil investisseur (US-05b, règles de gestion 1 à 4). Le score n'est
// jamais renvoyé à l'écran : il est seulement enregistré à la validation.

export type Profil = 'prudent' | 'equilibre' | 'dynamique';
export type Avertissement = 'connaissances' | 'horizon';
export type ResultatProfil = { profil: Profil; score: number; avertissements: Avertissement[] };

// 1. Score de risque, sur 8
const POINTS: Record<string, Record<string, number>> = {
  horizon: { '<3': 0, '3-8': 1, '8-15': 2, '>15': 3 },
  reactionBaisse: { vendre: 0, attendre: 1, investir: 2 },
  perteAcceptee: { aucune: 0, '<10': 1, '10-25': 2, '>25': 3 },
};

// Questions Vrai / Faux de l'étape 2 et réponse attendue
const BONNES_REPONSES: Record<string, string> = {
  revente: 'vrai',
  capitalGaranti: 'faux',
  frais: 'vrai',
  revenusGarantis: 'faux',
};

export function calculerProfil(reponses: ReponsesQuestionnaire): ResultatProfil {
  const connaissances = reponses[2] ?? {};
  const risque = reponses[4] ?? {};

  const score = Object.entries(POINTS).reduce(
    (total, [cle, points]) => total + (points[String(risque[cle])] ?? 0),
    0,
  );

  // 2. Profil selon le score
  let profil: Profil = score >= 7 ? 'dynamique' : score >= 4 ? 'equilibre' : 'prudent';

  // 3. Plafonnements à Prudent
  const bonnes = Object.entries(BONNES_REPONSES).filter(
    ([cle, attendue]) => connaissances[cle] === attendue,
  ).length;
  const connaissancesInsuffisantes = bonnes < 3;
  if (connaissancesInsuffisantes || risque.horizon === '<3' || risque.perteAcceptee === 'aucune') {
    profil = 'prudent';
  }

  // 4. Avertissements (non bloquants)
  const avertissements: Avertissement[] = [];
  if (connaissancesInsuffisantes) avertissements.push('connaissances');
  if (risque.horizon === '<3' || risque.horizon === '3-8') avertissements.push('horizon');

  return { profil, score, avertissements };
}
