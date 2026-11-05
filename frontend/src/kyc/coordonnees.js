// Règles de vraisemblance des coordonnées du KYC, selon le pays choisi :
// code postal, téléphone (avec son indicatif), adresse, ville.
// Ces règles écartent les saisies manifestement fausses ; elles ne prouvent pas qu'une
// adresse existe (c'est le rôle du justificatif de domicile, US-04c).
import { indicatifDe } from './pays.js';

// Format du code postal par pays (saisie mise en majuscules) et un exemple à afficher.
// Pays absents de la liste : 2 à 10 caractères, lettres, chiffres, espaces ou tirets,
// avec au moins un chiffre.
const CODES_POSTAUX = {
  FR: [/^(0[1-9]|[1-8]\d|9[0-5]|97|98)\d{3}$/, '75008'],
  GP: [/^971\d{2}$/, '97110'],
  MQ: [/^972\d{2}$/, '97200'],
  GF: [/^973\d{2}$/, '97300'],
  RE: [/^974\d{2}$/, '97400'],
  YT: [/^976\d{2}$/, '97600'],
  PM: [/^975\d{2}$/, '97500'],
  BL: [/^977\d{2}$/, '97133'],
  MF: [/^978\d{2}$/, '97150'],
  NC: [/^988\d{2}$/, '98800'],
  PF: [/^987\d{2}$/, '98714'],
  WF: [/^986\d{2}$/, '98600'],
  MC: [/^980\d{2}$/, '98000'],
  BE: [/^[1-9]\d{3}$/, '1000'],
  CH: [/^[1-9]\d{3}$/, '1201'],
  LU: [/^(L-?)?\d{4}$/, '1009'],
  DE: [/^\d{5}$/, '10115'],
  ES: [/^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/, '28013'],
  IT: [/^\d{5}$/, '00184'],
  PT: [/^\d{4}-\d{3}$/, '1100-148'],
  NL: [/^[1-9]\d{3} ?[A-Z]{2}$/, '1012 AB'],
  AT: [/^\d{4}$/, '1010'],
  DK: [/^\d{4}$/, '1050'],
  NO: [/^\d{4}$/, '0150'],
  SE: [/^\d{3} ?\d{2}$/, '111 22'],
  FI: [/^\d{5}$/, '00100'],
  PL: [/^\d{2}-\d{3}$/, '00-001'],
  CZ: [/^\d{3} ?\d{2}$/, '110 00'],
  GR: [/^\d{3} ?\d{2}$/, '105 57'],
  RO: [/^\d{6}$/, '010011'],
  IE: [/^[A-Z]\d[\dW] ?[A-Z\d]{4}$/, 'D02 X285'],
  GB: [/^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}|GIR ?0AA)$/, 'SW1A 1AA'],
  US: [/^\d{5}(-\d{4})?$/, '10001'],
  CA: [/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/, 'H2X 1Y4'],
  MA: [/^\d{5}$/, '20000'],
  DZ: [/^\d{5}$/, '16000'],
  TN: [/^\d{4}$/, '1000'],
  SN: [/^\d{5}$/, '10200'],
  BR: [/^\d{5}-?\d{3}$/, '01310-100'],
  JP: [/^\d{3}-?\d{4}$/, '100-0001'],
  CN: [/^\d{6}$/, '100000'],
  IN: [/^\d{6}$/, '110001'],
  RU: [/^\d{6}$/, '101000'],
  AU: [/^\d{4}$/, '2000'],
  IL: [/^\d{7}$/, '6100000'],
  TR: [/^\d{5}$/, '34000'],
};

// Pays sans code postal : le champ n'est pas demandé
const SANS_CODE_POSTAL = new Set(
  (
    'AE AG AO AW BF BI BJ BO BS BW BZ CD CF CG CI CM DJ DM ER FJ GA GD GH GM GQ GY HK KI ' +
    'KM KN KP LC ML MO MR MW NR NU QA RW SB SC SL SO SR SS ST SY TD TG TK TL TO TV UG VU YE ZW'
  ).split(' '),
);

export function sansCodePostal(pays) {
  return SANS_CODE_POSTAL.has(pays);
}

export function exempleCodePostal(pays) {
  return CODES_POSTAUX[pays]?.[1] ?? null;
}

export function codePostalValide(valeur, pays) {
  const code = valeur.trim().toUpperCase();
  const format = CODES_POSTAUX[pays]?.[0];
  if (format) return format.test(code);
  return /^[A-Z\d][A-Z\d -]{1,9}$/.test(code) && /\d/.test(code);
}

// Longueur du numéro national (sans l'indicatif ni le 0 initial), par indicatif de pays.
// Autres pays : 4 à 14 chiffres, et 15 chiffres au plus avec l'indicatif (norme E.164).
// prettier-ignore
const LONGUEURS = {
  FR: [9, 9], GP: [9, 9], MQ: [9, 9], GF: [9, 9], RE: [9, 9], YT: [9, 9], PM: [6, 6],
  BE: [8, 9], CH: [9, 9], LU: [4, 11], MC: [8, 9], DE: [6, 13], ES: [9, 9], IT: [6, 11],
  PT: [9, 9], NL: [9, 9], AT: [4, 13], GB: [9, 10], IE: [7, 9], US: [10, 10], CA: [10, 10],
  MA: [9, 9], DZ: [8, 9], TN: [8, 8], SN: [9, 9], CI: [10, 10], PL: [9, 9], SE: [7, 9],
  AU: [9, 9], CN: [11, 11],
};
// Pays où le 0 initial fait partie du numéro (on ne le retire pas)
const GARDE_LE_ZERO = new Set(['IT', 'VA', 'SM', 'CI']);

export function chiffresNationaux(numero, pays) {
  let chiffres = numero.replace(/\D/g, '');
  const indicatif = indicatifDe(pays);
  // indicatif retapé dans le numéro (+33 6..., 0033 6...) : retiré
  const avecIndicatif = numero.trim().startsWith('+') ? indicatif : `00${indicatif}`;
  if (indicatif && chiffres.startsWith(avecIndicatif) && /^\s*(\+|00)/.test(numero)) {
    chiffres = chiffres.slice(avecIndicatif.length);
  }
  return GARDE_LE_ZERO.has(pays) ? chiffres : chiffres.replace(/^0/, '');
}

export function telephoneValide(numero, pays) {
  if (!/^\s*\+?[\d\s.()-]+$/.test(numero)) return false;
  const chiffres = chiffresNationaux(numero, pays);
  const [min, max] = LONGUEURS[pays] ?? [4, 14];
  return (
    chiffres.length >= min &&
    chiffres.length <= max &&
    indicatifDe(pays).length + chiffres.length <= 15
  );
}

// Au moins deux mots (numéro et voie, ou voie et lieu-dit), une lettre, 5 caractères
export function adresseValide(valeur) {
  const adresse = valeur.trim();
  const mots = adresse.split(/[\s,]+/).filter((m) => /[\p{L}\d]/u.test(m));
  return (
    adresse.length >= 5 &&
    mots.length >= 2 &&
    /\p{L}/u.test(adresse) &&
    /^[\p{L}\p{M}\d\s,.'’°/#-]+$/u.test(adresse)
  );
}

// Lettres (accents compris), espaces, tirets, apostrophes ; au moins 2 lettres
export function villeValide(valeur) {
  const ville = valeur.trim();
  return /^[\p{L}\p{M}\s'’.()\d-]+$/u.test(ville) && (ville.match(/\p{L}/gu) ?? []).length >= 2;
}
