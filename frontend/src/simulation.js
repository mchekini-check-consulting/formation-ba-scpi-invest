// Calculs et formats du simulateur de revenus SCPI (indicatif, avant fiscalité)

const euros = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export const formatEuros = (montant) => euros.format(montant);

export const formatPourcent = (taux) =>
  `${taux.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

export const formatDuree = (annees) => `${annees} ${annees > 1 ? 'ans' : 'an'}`;

// Revenus calculés sur le montant souscrit ; les frais réduisent le capital réellement investi
export function simuler({ montant, taux, frais, duree }) {
  const annuel = (montant * taux) / 100;
  return {
    net: montant * (1 - frais / 100),
    mensuel: annuel / 12,
    cumul: annuel * duree,
  };
}
