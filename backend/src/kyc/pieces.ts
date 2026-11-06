import { typePieceKyc, type ReponsesKyc } from '../db/schema.js';

// Pièces justificatives du KYC (US-04c, SCPI-44) : quelles pièces sont demandées selon les
// réponses des étapes 1 à 4, et quels fichiers sont acceptés. Même liste et mêmes règles
// que frontend/src/kyc/pieces.js.

export type TypePiece = (typeof typePieceKyc.enumValues)[number];

export const TYPES_PIECES: readonly TypePiece[] = typePieceKyc.enumValues;

export type PieceAttendue = { type: TypePiece; obligatoire: boolean };

export const TAILLE_MAX = 10 * 1024 * 1024; // 10 Mo par fichier

export const MESSAGE_FORMAT =
  'Format non accepté ou fichier trop volumineux (PDF, JPG ou PNG, 10 Mo maximum)';

// Seule origine des fonds qui ne demande pas de justificatif (règle provisoire, à
// confirmer avec la conformité) : toute autre origine cochée en demande un.
const ORIGINE_SANS_JUSTIFICATIF = 'Épargne issue de mes revenus';

// Pays de l'Union européenne et nationalités correspondantes (masculin et féminin), sans
// accents ni majuscules : la nationalité est saisie en texte libre.
const UNION_EUROPEENNE = [
  'allemagne allemand allemande',
  'autriche autrichien autrichienne',
  'belgique belge',
  'bulgarie bulgare',
  'chypre chypriote cypriote',
  'croatie croate',
  'danemark danois danoise',
  'espagne espagnol espagnole',
  'estonie estonien estonienne',
  'finlande finlandais finlandaise',
  'france francais francaise',
  'grece grec grecque',
  'hongrie hongrois hongroise',
  'irlande irlandais irlandaise',
  'italie italien italienne',
  'lettonie letton lettone lettonne',
  'lituanie lituanien lituanienne',
  'luxembourg luxembourgeois luxembourgeoise',
  'malte maltais maltaise',
  'pays-bas neerlandais neerlandaise hollandais hollandaise',
  'pologne polonais polonaise',
  'portugal portugais portugaise',
  'tcheque tchequie',
  'roumanie roumain roumaine',
  'slovaquie slovaque',
  'slovenie slovene',
  'suede suedois suedoise',
].flatMap((ligne) => ligne.split(' '));

function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// prettier-ignore
// Codes ISO des 27 pays de l'Union européenne (nationalité choisie dans la liste des pays)
const CODES_UNION_EUROPEENNE = [
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU',
  'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
];

// Vrai si l'une des nationalités saisies (« Française », « franco-algérienne »,
// « Italienne et marocaine »…) est celle d'un pays de l'Union européenne
export function nationaliteUnionEuropeenne(nationalite: string): boolean {
  // Code pays (« FR ») : liste des pays ; sinon ancienne saisie libre (« Française »)
  if (/^[A-Z]{2}$/.test(nationalite)) return CODES_UNION_EUROPEENNE.includes(nationalite);
  const texte = normaliser(nationalite);
  if (texte.includes('pays-bas') || texte.includes('pays bas')) return true;
  const mots = texte.split(/[^a-z]+/).filter(Boolean);
  // « franco-algérienne » : le préfixe « franco » vaut nationalité française
  return mots.some((mot) => UNION_EUROPEENNE.includes(mot) || mot === 'franco');
}

function texte(valeur: string | string[] | undefined): string {
  return typeof valeur === 'string' ? valeur.trim() : '';
}

// Pièces demandées, dans l'ordre d'affichage, adaptées aux réponses du KYC
export function piecesAttendues(reponses: ReponsesKyc): PieceAttendue[] {
  const pieces: PieceAttendue[] = [
    { type: 'identite', obligatoire: true },
    { type: 'identite_verso', obligatoire: false },
  ];
  const nationalite = texte(reponses.nationalite);
  if (nationalite && !nationaliteUnionEuropeenne(nationalite)) {
    pieces.push({ type: 'titre_sejour', obligatoire: true });
  }
  pieces.push({ type: 'domicile', obligatoire: true }, { type: 'rib', obligatoire: true });
  const origines = Array.isArray(reponses.origineFonds) ? reponses.origineFonds : [];
  if (origines.some((origine) => origine !== ORIGINE_SANS_JUSTIFICATIF)) {
    pieces.push({ type: 'origine_fonds', obligatoire: true });
  }
  if (reponses.ppe === 'Oui') {
    pieces.push({ type: 'ppe', obligatoire: true });
  }
  return pieces;
}

// Pièces obligatoires pas encore déposées
export function piecesManquantes(reponses: ReponsesKyc, deposees: readonly string[]): TypePiece[] {
  return piecesAttendues(reponses)
    .filter((piece) => piece.obligatoire && !deposees.includes(piece.type))
    .map((piece) => piece.type);
}

export function typePiece(valeur: unknown): TypePiece | null {
  return TYPES_PIECES.find((type) => type === valeur) ?? null;
}

export type FormatPiece = 'application/pdf' | 'image/jpeg' | 'image/png';

// Format reconnu d'après les premiers octets du fichier (et non d'après son nom, qu'il
// suffit de renommer) ; null pour tout autre format
export function formatDuFichier(contenu: Buffer): FormatPiece | null {
  if (contenu.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (contenu.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (
    contenu.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  return null;
}

const EXTENSIONS: Record<FormatPiece, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

// Nom affiché en face de la pièce : sans chemin ni caractères de contrôle, 200 caractères
// au plus ; à défaut, le type de la pièce et l'extension du format
export function nomFichierAffiche(nom: unknown, type: TypePiece, format: FormatPiece): string {
  const brut = typeof nom === 'string' ? nom : '';
  const sansChemin = brut.split(/[/\\]/).at(-1) ?? '';
  const propre = [...sansChemin]
    .filter((c) => c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) !== 0x7f)
    .join('')
    .trim()
    .slice(0, 200);
  return propre || `${type}.${EXTENSIONS[format]}`;
}

// Emplacement du fichier dans R2 : kyc/<utilisateur>/<type de pièce> (un nouveau dépôt
// écrase le précédent)
export function clePiece(utilisateurId: string, type: TypePiece): string {
  return `kyc/${utilisateurId}/${type}`;
}
