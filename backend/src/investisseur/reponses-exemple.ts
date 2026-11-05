// Réponses complètes et valides de chaque étape du questionnaire (US-05a), pour les tests
export const REPONSES_EXEMPLE: Record<number, Record<string, unknown>> = {
  1: { revenus: '30-60k', patrimoine: '50-150k', charges: '<20', epargne: 15000 },
  2: {
    revente: 'vrai',
    capitalGaranti: 'faux',
    frais: 'vrai',
    revenusGarantis: 'faux',
    placements: ['livrets', 'actions'],
    dejaScpi: 'non',
  },
  3: { objectifs: ['revenus', 'retraite'] },
  4: { horizon: '8-15', reactionBaisse: 'attendre', perteAcceptee: '<10' },
  5: { esg: 'oui', isr: 'oui' },
};
