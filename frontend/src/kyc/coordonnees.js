// Règles de saisie de l'étape « Coordonnées » du KYC : code postal selon le pays et
// téléphone selon l'indicatif choisi. Les caractères non acceptés sont retirés dès la frappe (filtrer...), puis le
// format est contrôlé au « Suivant » (...Valide).
import { indicatifDe } from './indicatifs.js';
import { paysParNom } from './pays.js';

// Pays dont le code postal ne contient que des chiffres -> nombre de chiffres attendu
// (codes ISO des pays, en minuscules comme dans pays.js). Les autres pays (Royaume-Uni,
// Canada, Pays-Bas, Portugal…) gardent lettres, chiffres, espaces et tirets.
// prettier-ignore
const CODES_NUMERIQUES = {
  fr: 5, gp: 5, mq: 5, gf: 5, re: 5, yt: 5, pm: 5, bl: 5, mf: 5, nc: 5, pf: 5, wf: 5, mc: 5,
  de: 5, es: 5, it: 5, fi: 5, gr: 5, hr: 5, ee: 5, se: 5, cz: 5, sk: 5, cy: 4, bg: 4,
  be: 4, ch: 4, li: 4, lu: 4, at: 4, dk: 4, no: 4, hu: 4, si: 4, au: 4, za: 4, tn: 4,
  us: 5, mx: 5, ma: 5, dz: 5, sn: 5, tr: 5, ua: 5,
  ru: 6, in: 6, cn: 6, ro: 6, sg: 6, kz: 6,
};

const LONGUEUR_MAX_CODE_POSTAL = 10;
const LONGUEUR_MAX_TELEPHONE = 20;

// Nombre de chiffres du code postal du pays choisi (nom en français), sinon null
export function chiffresCodePostal(nomPays) {
  const code = paysParNom(nomPays)?.code;
  return CODES_NUMERIQUES[code] ?? null;
}

// Code postal tel qu'il est tapé : chiffres seuls (et pas plus que la longueur attendue)
// pour un pays à code numérique ; sinon lettres en majuscules, chiffres, espaces, tirets
export function filtrerCodePostal(valeur, nomPays) {
  const chiffres = chiffresCodePostal(nomPays);
  if (chiffres) return valeur.replace(/\D/g, '').slice(0, chiffres);
  return valeur
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, '')
    .slice(0, LONGUEUR_MAX_CODE_POSTAL);
}

export function codePostalValide(valeur, nomPays) {
  const chiffres = chiffresCodePostal(nomPays);
  if (chiffres) return new RegExp(`^\\d{${chiffres}}$`).test(valeur);
  return /^(?=.*\d)[A-Z0-9 -]{2,10}$/.test(valeur.trim());
}

export function messageCodePostal(nomPays) {
  const chiffres = chiffresCodePostal(nomPays);
  return chiffres
    ? `Code postal invalide : ${chiffres} chiffres attendus pour ce pays.`
    : 'Code postal invalide : lettres, chiffres, espaces ou tirets, avec au moins un chiffre.';
}

// Téléphone tel qu'il est tapé : chiffres et espaces seulement (l'indicatif se choisit
// dans le menu à côté)
export function filtrerTelephone(valeur) {
  return valeur.replace(/[^\d ]/g, '').slice(0, LONGUEUR_MAX_TELEPHONE);
}

// Longueur du numéro national (sans l'indicatif ni le 0 initial), par pays de l'indicatif.
// Autres pays : 4 à 14 chiffres, et 15 chiffres au plus avec l'indicatif (norme E.164).
// prettier-ignore
const LONGUEURS = {
  fr: [9, 9], gp: [9, 9], mq: [9, 9], gf: [9, 9], re: [9, 9], yt: [9, 9], pm: [6, 6],
  be: [8, 9], ch: [9, 9], lu: [4, 11], mc: [8, 9], de: [6, 13], es: [9, 9], it: [6, 11],
  pt: [9, 9], nl: [9, 9], at: [4, 13], gb: [9, 10], ie: [7, 9], us: [10, 10], ca: [10, 10],
  ma: [9, 9], dz: [8, 9], tn: [8, 8], sn: [9, 9], ci: [10, 10], pl: [9, 9], se: [7, 9],
  au: [9, 9], cn: [11, 11],
};
// Pays où le 0 initial fait partie du numéro (on ne le retire pas)
const GARDE_LE_ZERO = new Set(['it', 'va', 'sm', 'ci']);

// Chiffres du numéro national : sans l'indicatif retapé en tête (0033 6…) ni le 0 initial
export function chiffresNationaux(numero, nomPays) {
  const indicatif = indicatifDe(nomPays);
  let chiffres = numero.replace(/\D/g, '');
  if (indicatif && chiffres.startsWith(`00${indicatif}`)) {
    chiffres = chiffres.slice(indicatif.length + 2);
  }
  const code = paysParNom(nomPays)?.code;
  return GARDE_LE_ZERO.has(code) ? chiffres : chiffres.replace(/^0/, '');
}

// Chiffres et espaces seulement, nombre de chiffres attendu pour le pays de l'indicatif
export function telephoneValide(numero, nomPays) {
  if (!/^[\d ]+$/.test(numero.trim())) return false;
  const chiffres = chiffresNationaux(numero, nomPays);
  const [min, max] = LONGUEURS[paysParNom(nomPays)?.code] ?? [4, 14];
  return (
    chiffres.length >= min &&
    chiffres.length <= max &&
    indicatifDe(nomPays).length + chiffres.length <= 15
  );
}
