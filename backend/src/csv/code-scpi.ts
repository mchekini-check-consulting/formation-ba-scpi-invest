// Code de la SCPI (4 lettres majuscules, unique) utilisé dans les échanges avec la SCPI
// partenaire (US-12). Il n'est pas dans le CSV : l'import le génère à partir du nom, une
// seule fois, puis il ne change plus (même nom, même code ; src/csv/import.ts).
//
// Règle :
//   - accents retirés, majuscules, seulement les lettres ; mots vides ignorés ;
//   - 2 premières lettres des 2 premiers mots (Iroko Zen -> IRZE), ou 4 premières lettres
//     s'il n'y a qu'un mot (Upéka -> UPEK) ; complété par X si le nom est trop court ;
//   - code déjà pris par une autre SCPI : on garde les 3 premières lettres et on essaie
//     comme 4e lettre les lettres suivantes du nom, puis A à Z
//     (Epargne Pierre -> EPPI, Epargne Pierre Europe -> EPPE) ; puis 2 lettres + AA à ZZ.
const MOTS_VIDES = new Set(['D', 'L', 'DE', 'DES', 'DU', 'LA', 'LE', 'LES', 'ET', 'SCPI']);
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const FORMAT_CODE = /^[A-Z]{4}$/;

function mots(nom: string): string[] {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((mot) => mot && !MOTS_VIDES.has(mot));
}

// Lettres dans l'ordre où le code les prend : les 4 premières forment le code candidat
function lettresDuCode(nom: string): string {
  const [premier = '', second, ...autres] = mots(nom);
  const lettres = second === undefined ? premier : premier.slice(0, 2) + second + autres.join('');
  return lettres.padEnd(4, 'X');
}

export function codeCandidat(nom: string): string {
  return lettresDuCode(nom).slice(0, 4);
}

function* propositions(nom: string): Generator<string> {
  const lettres = lettresDuCode(nom);
  yield lettres.slice(0, 4);
  for (const lettre of lettres.slice(3) + ALPHABET) {
    yield lettres.slice(0, 3) + lettre;
  }
  for (const a of ALPHABET) {
    for (const b of ALPHABET) {
      yield lettres.slice(0, 2) + a + b;
    }
  }
}

// Premier code libre pour ce nom ; codesPris n'est pas modifié
export function attribuerCode(nom: string, codesPris: ReadonlySet<string>): string {
  for (const code of propositions(nom)) {
    if (!codesPris.has(code)) {
      return code;
    }
  }
  throw new Error(`aucun code libre pour la SCPI ${nom}`);
}

// Codes de plusieurs SCPI, attribués par ordre alphabétique du nom (même résultat quel
// que soit l'ordre des lignes du fichier) ; codesPris reçoit les codes attribués
export function attribuerCodes(noms: string[], codesPris: Set<string>): Map<string, string> {
  const codes = new Map<string, string>();
  for (const nom of [...noms].sort((a, b) => a.localeCompare(b, 'fr'))) {
    const code = attribuerCode(nom, codesPris);
    codesPris.add(code);
    codes.set(nom, code);
  }
  return codes;
}
