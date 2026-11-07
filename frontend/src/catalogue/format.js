// Mise en forme des données du Catalogue (US-08). Donnée non renseignée -> « N/C »,
// jamais 0.
export const NON_COMMUNIQUE = 'N/C';

const ESPACE = ' '; // espace insécable : « 5,10 % » ne se coupe pas en fin de ligne

const absent = (valeur) => valeur === null || valeur === undefined || valeur === '';

// 5.1 -> « 5,10 % »
export function formaterTaux(taux) {
  if (absent(taux)) return NON_COMMUNIQUE;
  return `${Number(taux).toFixed(2).replace('.', ',')}${ESPACE}%`;
}

// 1234567 -> « 1 234 567 »
function grouper(entier) {
  return String(entier).replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE);
}

// En euros : 1 250 000 000 -> « 1,25 Md€ », 289 000 000 -> « 289 M€ », 850 000 -> « 850 000 € »
export function formaterCapitalisation(montant) {
  if (absent(montant)) return NON_COMMUNIQUE;
  const n = Number(montant);
  if (n >= 1e9) return `${(n / 1e9).toFixed(2).replace('.', ',')}${ESPACE}Md€`;
  if (n >= 1e6) return `${grouper(Math.round(n / 1e6))}${ESPACE}M€`;
  return `${grouper(Math.round(n))}${ESPACE}€`;
}

// Jauge du taux : 10 segments de 1 %, arrondi au plus proche, bornée à 0..10.
// Taux non renseigné -> jauge vide (jamais assimilé à 0 % dans le texte : « N/C »).
export const SEGMENTS = 10;

export function segmentsPleins(taux) {
  if (absent(taux)) return 0;
  return Math.min(SEGMENTS, Math.max(0, Math.round(Number(taux))));
}

export function formaterTexte(texte) {
  return absent(texte) ? NON_COMMUNIQUE : texte;
}

// Date ISO -> « 05/11/2026 » (heure de Paris)
export function formaterDate(iso) {
  if (absent(iso)) return NON_COMMUNIQUE;
  return new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
}
