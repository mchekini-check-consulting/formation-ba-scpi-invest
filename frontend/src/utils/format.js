// Mise en forme commune des écrans du sprint 2 (convention C4 du backlog) :
// - montant calculé (revenu, gain, impôt, cumul) : toujours deux décimales, « 4 175,00 € » ;
// - autre montant (prix de part, minimum, montant investi) : « 1 090 € », « 2 085,50 € » ;
// - taux : « 8,35 % » ;
// - donnée absente du référentiel : « Non communiqué », jamais 0.
export const NON_COMMUNIQUE = 'Non communiqué';

const ESPACE = ' '; // insécable : « 8,35 % » ne se coupe pas en fin de ligne

export const absent = (valeur) => valeur === null || valeur === undefined || valeur === '';

function nombre(valeur, decimalesMin, decimalesMax) {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimalesMin,
    maximumFractionDigits: decimalesMax,
  }).format(valeur);
}

// 1090 -> « 1 090 € », 2085.5 -> « 2 085,50 € »
export function formaterEuros(montant) {
  if (absent(montant)) return NON_COMMUNIQUE;
  const decimales = Number.isInteger(Number(montant)) ? 0 : 2;
  return `${nombre(montant, decimales, decimales)}${ESPACE}€`;
}

// 800 -> « 800,00 € », 549.335 -> « 549,34 € »
export function formaterMontantCalcule(montant) {
  if (absent(montant)) return NON_COMMUNIQUE;
  return `${nombre(montant, 2, 2)}${ESPACE}€`;
}

// 8.35 -> « 8,35 % », 0 -> « 0,00 % »
export function formaterTaux(taux) {
  if (absent(taux)) return NON_COMMUNIQUE;
  return `${nombre(taux, 2, 2)}${ESPACE}%`;
}
