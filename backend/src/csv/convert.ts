import { createHash } from 'node:crypto';
import { frequence as FREQUENCES, secteur as SECTEURS } from '../db/schema.js';

export type Frequence = (typeof FREQUENCES.enumValues)[number];
export type Secteur = (typeof SECTEURS.enumValues)[number];

// Le CSV ne contient que du texte : conversions avant l'insertion
export function toNumber(value: string, colonne: string): number | null {
  if (value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) throw new Error(`${colonne} : nombre attendu, reçu "${value}"`);
  return n;
}

// Colonnes integer / bigint : refuse les décimales plutôt que d'arrondir en silence
export function toInteger(value: string, colonne: string): number | null {
  const n = toNumber(value, colonne);
  if (n !== null && !Number.isSafeInteger(n)) {
    throw new Error(`${colonne} : nombre entier attendu, reçu "${value}"`);
  }
  return n;
}

export function toBoolean(value: string, colonne: string): boolean | null {
  if (value === '') return null;
  if (value.toLowerCase() === 'oui') return true;
  if (value.toLowerCase() === 'non') return false;
  throw new Error(`${colonne} : Oui ou Non attendu, reçu "${value}"`);
}

export function toFrequence(value: string): Frequence | null {
  if (value === '') return null;
  if (!(FREQUENCES.enumValues as readonly string[]).includes(value)) {
    throw new Error(`frequence_loyers : valeur inconnue "${value}"`);
  }
  return value as Frequence;
}

// fonctions de conversions des colonnes à plusieurs valeurs
const anneeCourante = new Date().getFullYear();

export function toValeursAnnuelles(value: string, colonne: string) {
  if (value === '') return [];
  return value.split(',').map((morceau, i) => {
    const valeur = toNumber(morceau.trim(), colonne);
    if (valeur === null) throw new Error(`${colonne} : valeur vide dans la liste "${value}"`);
    return { valeur, annee: anneeCourante - 1 - i };
  });
}

// "Pays-Bas,47,Espagne,24" -> [{ libelle: 'Pays-Bas', nombre: 47 }, { libelle: 'Espagne', nombre: 24 }]
// Découpage commun aux colonnes en paires (localisation, secteurs, décote du démembrement)
export function toPaires(value: string, colonne: string) {
  if (value === '') return [];

  const items = value.split(',');
  if (items.length % 2 !== 0)
    throw new Error(`${colonne} : couple libellé + nombre non respecté "${value}"`);

  const paires: { libelle: string; nombre: number }[] = [];

  for (let index = 0; index < items.length; index += 2) {
    const libelle = items[index].trim();
    const nombre = toNumber(items[index + 1].trim(), colonne);
    if (nombre === null || libelle === '')
      throw new Error(`${colonne} : entité vide dans la liste "${value}"`);

    paires.push({ libelle, nombre });
  }

  return paires;
}

export function toLocalisation(value: string, colonne: string) {
  return toPaires(value, colonne).map(({ libelle, nombre }) => ({
    pays: libelle,
    pourcentage: nombre,
  }));
}

// Écritures du CSV (sans accents, singulier / pluriel, variantes) -> valeur de l'enum secteur
const SECTEURS_CSV = new Map<string, Secteur>([
  ['Bureaux', 'Bureaux'],
  ['Bureau', 'Bureaux'],
  ['Commerces', 'Commerces'],
  ['Commerce', 'Commerces'],
  ['Hotels', 'Hôtels'],
  ['Hotel', 'Hôtels'],
  ["Locaux d'activite", 'Locaux d’activité'],
  ['Locaux', 'Locaux d’activité'],
  ['Logistique', 'Logistique'],
  ['Residentiel', 'Résidentiel'],
  ['Sante', 'Santé'],
  ['Transport', 'Transport'],
  ['Autre', 'Autre'],
  ['Autres', 'Autre'],
  ['Reste', 'Autre'],
  ['Restant', 'Autre'],
]);

export function toSecteur(value: string, colonne: string) {
  return toPaires(value, colonne).map(({ libelle, nombre }) => {
    // les valeurs de l'enum elles-mêmes (avec accents) sont aussi acceptées
    const secteur =
      SECTEURS_CSV.get(libelle) ?? SECTEURS.enumValues.find((valeur) => valeur === libelle);
    if (!secteur) throw new Error(`${colonne} : secteur inconnu "${libelle}"`);
    return { secteur, pourcentage: nombre };
  });
}

// ---- Contrôles de l'US-07b

// Colonnes attendues dans l'en-tête du fichier ; une colonne absente rejette tout le fichier
export const COLONNES = [
  'Nom',
  'taux_distribution',
  'minimum_souscription',
  'localisation',
  'secteurs',
  'prix_part',
  'capitalisation',
  'Gerant',
  'frais_souscription',
  'frais_gestion',
  'delai_jouissance',
  'frequence_loyers',
  'valeur_reconstitution',
  'iban',
  'bic',
  'decote_demembrement',
  'demembrement',
  'cashback',
  'versement_programme',
  'publicite',
] as const;

// Colonnes qui ne peuvent pas être vides (US-07c). Facultatives : taux_distribution,
// valeur_reconstitution, cashback ; decote_demembrement : obligatoire si demembrement = Oui.
// Une donnée facultative vide reste inconnue (null), jamais remplacée par zéro.
export const COLONNES_OBLIGATOIRES = COLONNES.filter(
  (c) =>
    !['taux_distribution', 'valeur_reconstitution', 'cashback', 'decote_demembrement'].includes(c),
);

// Forme de l'IBAN : code pays, 2 chiffres de clé, puis 11 à 30 lettres ou chiffres ; 27
// caractères pour la France. La clé (modulo 97) n'est pas vérifiée : le fichier actuel
// contient des IBAN fictifs. Espaces acceptés (IBAN écrit par groupes de 4).
export function verifierIban(value: string): void {
  const iban = value.replaceAll(' ', '').toUpperCase();
  const forme = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban);
  if (!forme || (iban.startsWith('FR') && iban.length !== 27)) {
    // valeur jamais recopiée dans le motif (rapport et logs)
    throw new Error('iban : format invalide');
  }
}

// BIC : 4 lettres (banque), 2 lettres (pays), 2 lettres ou chiffres (ville), agence facultative
export function verifierBic(value: string): void {
  if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value.toUpperCase())) {
    throw new Error('bic : format invalide (8 ou 11 caractères attendus)');
  }
}

// Contrôles d'une ligne qui ne relèvent pas de la conversion d'une colonne
function verifierLigne(row: Record<string, string>): void {
  for (const colonne of COLONNES_OBLIGATOIRES) {
    if (!row[colonne]) throw new Error(`${colonne} : champ obligatoire vide`);
  }
  verifierIban(row.iban);
  verifierBic(row.bic);
  if (toBoolean(row.demembrement, 'demembrement') && !row.decote_demembrement) {
    throw new Error('decote_demembrement : obligatoire quand demembrement = Oui');
  }
}

// Une ligne du CSV convertie : la fiche de la SCPI et ses valeurs multiples.
// Ligne invalide : erreur dont le message (colonne : motif) devient le motif du rejet.
export function convertirLigne(row: Record<string, string>) {
  verifierLigne(row);
  return {
    fiche: {
      nom: row.Nom,
      minimum_souscription: toInteger(row.minimum_souscription, 'minimum_souscription'),
      capitalisation: toInteger(row.capitalisation, 'capitalisation'),
      gerant: row.Gerant,
      frais_souscription: toNumber(row.frais_souscription, 'frais_souscription'),
      frais_gestion: toNumber(row.frais_gestion, 'frais_gestion'),
      delai_jouissance: toInteger(row.delai_jouissance, 'delai_jouissance'),
      frequence: toFrequence(row.frequence_loyers),
      iban: row.iban,
      bic: row.bic,
      demembrement: toBoolean(row.demembrement, 'demembrement'),
      cashback: toInteger(row.cashback, 'cashback'),
      versement_programme: toBoolean(row.versement_programme, 'versement_programme'),
      publicite: row.publicite,
    },
    taux: toValeursAnnuelles(row.taux_distribution, 'taux_distribution'),
    prix: toValeursAnnuelles(row.prix_part, 'prix_part'),
    valeurs: toValeursAnnuelles(row.valeur_reconstitution, 'valeur_reconstitution'),
    localisations: toLocalisation(row.localisation, 'localisation'),
    secteurs: toSecteur(row.secteurs, 'secteurs'),
    // "3,90,4,85" : durée du démembrement (nombre d'années) -> décote, deux entiers
    decotes: toPaires(row.decote_demembrement, 'decote_demembrement').map((d) => ({
      duree: toInteger(d.libelle, 'decote_demembrement')!,
      decote: toInteger(String(d.nombre), 'decote_demembrement')!,
    })),
  };
}

export type ScpiConvertie = ReturnType<typeof convertirLigne>;

// Empreinte sha256 des valeurs converties (et non du texte brut) : les années des taux et
// prix sont déduites de l'année en cours, une même ligne change donc au 1er janvier.
// Clés toujours produites dans le même ordre par convertirLigne : JSON stable.
export function empreinte(scpi: ScpiConvertie): string {
  return createHash('sha256').update(JSON.stringify(scpi)).digest('hex');
}
