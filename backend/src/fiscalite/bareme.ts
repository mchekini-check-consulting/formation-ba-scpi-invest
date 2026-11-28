// Barème de l'impôt sur le revenu 2026 (revenus 2025), par part de quotient familial
// (US-07 SCPI-256, règle du 27/11/2026). Pour passer à un nouveau barème : changer les
// limites et taux ci-dessous (les tests « barème » de calcul.test.ts le décrivent).

// Tranche du barème : plafond = limite haute par part, null pour la dernière tranche. Un
// revenu par part exactement égal à une limite reste dans la tranche inférieure.
export type Tranche = { plafond: number | null; taux: number };

// Limites hautes des tranches, en euros par part
export const LIMITE_TRANCHE_0 = 11_600;
export const LIMITE_TRANCHE_11 = 29_579;
export const LIMITE_TRANCHE_30 = 84_577;
export const LIMITE_TRANCHE_41 = 181_917;

// Taux des tranches, en %
export const TAUX_TRANCHE_1 = 0;
export const TAUX_TRANCHE_2 = 11;
export const TAUX_TRANCHE_3 = 30;
export const TAUX_TRANCHE_4 = 41;
export const TAUX_TRANCHE_5 = 45;

export const BAREME_2026: Tranche[] = [
  { plafond: LIMITE_TRANCHE_0, taux: TAUX_TRANCHE_1 },
  { plafond: LIMITE_TRANCHE_11, taux: TAUX_TRANCHE_2 },
  { plafond: LIMITE_TRANCHE_30, taux: TAUX_TRANCHE_3 },
  { plafond: LIMITE_TRANCHE_41, taux: TAUX_TRANCHE_4 },
  { plafond: null, taux: TAUX_TRANCHE_5 },
];
