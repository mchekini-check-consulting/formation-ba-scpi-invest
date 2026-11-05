// Conversions de la date de naissance (ChampDate.jsx) : saisie « JJ/MM/AAAA » <-> valeur
// « AAAA-MM-JJ », celle des règles de etapes.js et du backend.

export const deux = (n) => String(n).padStart(2, '0');
export const iso = (annee, mois, jour) => `${annee}-${deux(mois + 1)}-${deux(jour)}`;

// « 15011980 » ou « 15/01/1980 » -> « 15/01/1980 » ; les « / » n'apparaissent qu'avant
// un chiffre, pour que l'effacement fonctionne normalement
export function masquer(saisie) {
  const chiffres = saisie.replace(/\D/g, '').slice(0, 8);
  return [chiffres.slice(0, 2), chiffres.slice(2, 4), chiffres.slice(4)].filter(Boolean).join('/');
}

// « 15/01/1980 » -> « 1980-01-15 » ; null si la date est incomplète ou n'existe pas
export function texteVersIso(texte) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texte);
  if (!m) return null;
  const [jour, mois, annee] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const date = new Date(annee, mois, jour);
  const existe =
    date.getFullYear() === annee && date.getMonth() === mois && date.getDate() === jour;
  return existe ? iso(annee, mois, jour) : null;
}

export function isoVersTexte(valeur) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (valeur ?? '');
}

export function lireIso(valeur) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur ?? '');
  return m ? { annee: Number(m[1]), mois: Number(m[2]) - 1, jour: Number(m[3]) } : null;
}
