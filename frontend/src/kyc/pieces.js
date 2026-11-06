// Pièces justificatives du KYC (US-04c, SCPI-44) : libellés, pièces demandées selon les
// réponses des étapes 1 à 4 et fichiers acceptés. Mêmes règles que
// backend/src/kyc/pieces.ts, qui refait tous les contrôles.

export const TAILLE_MAX = 10 * 1024 * 1024; // 10 Mo par fichier

export const MESSAGE_FORMAT =
  'Format non accepté ou fichier trop volumineux (PDF, JPG ou PNG, 10 Mo maximum)';
export const MESSAGE_PIECE_MANQUANTE = 'Cette pièce est obligatoire : déposez un fichier.';
export const MESSAGE_ENVOI = 'Le fichier n’a pas pu être envoyé. Veuillez réessayer.';
export const MESSAGE_SUPPRESSION = 'La pièce n’a pas pu être supprimée. Veuillez réessayer.';

// Identifiant du champ fichier d'une pièce (focus sur la première pièce manquante)
export const idPiece = (type) => `kyc-piece-${type}`;

export const FORMATS_ACCEPTES = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

export const PIECES = {
  identite: {
    libelle: 'Pièce d’identité',
    aide: 'Carte nationale d’identité (recto et verso) ou passeport, en cours de validité. Recto et verso peuvent être dans un seul fichier.',
  },
  identite_verso: {
    libelle: 'Verso de la carte d’identité',
    aide: 'Seulement si le verso de votre carte est dans un fichier séparé.',
  },
  titre_sejour: {
    libelle: 'Titre de séjour',
    aide: 'En cours de validité.',
  },
  domicile: {
    libelle: 'Justificatif de domicile',
    aide: 'De moins de 3 mois : facture d’énergie, de téléphone ou d’internet, quittance de loyer, attestation d’assurance habitation. Un avis d’imposition de moins d’un an est aussi accepté.',
  },
  rib: {
    libelle: 'RIB',
    aide: 'À votre nom : il sert au versement des revenus de vos SCPI.',
  },
  origine_fonds: {
    libelle: 'Justificatif d’origine des fonds',
    aide: 'Par exemple : acte de vente, attestation de donation ou de succession, relevé d’épargne.',
  },
  ppe: {
    libelle: 'Pièce justificative complémentaire',
    aide: 'Demandée car vous vous êtes déclaré(e) personne politiquement exposée.',
  },
};

export const STATUTS = {
  deposee: 'Déposée',
  en_verification: 'En cours de vérification',
  validee: 'Vérifiée',
  refusee: 'Refusée',
};

// Seule origine des fonds qui ne demande pas de justificatif (règle provisoire, à
// confirmer avec la conformité)
const ORIGINE_SANS_JUSTIFICATIF = 'Épargne issue de mes revenus';

// Pays de l'Union européenne et nationalités (masculin et féminin), sans accents
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

// prettier-ignore
// Codes ISO des 27 pays de l'Union européenne (nationalité choisie dans la liste des pays)
const CODES_UNION_EUROPEENNE = [
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU',
  'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
];

// Vrai si l'une des nationalités saisies est celle d'un pays de l'Union européenne
export function nationaliteUnionEuropeenne(nationalite) {
  // Code pays (« FR ») : liste des pays ; sinon ancienne saisie libre (« Française »)
  if (/^[A-Z]{2}$/.test(nationalite)) return CODES_UNION_EUROPEENNE.includes(nationalite);
  const texte = nationalite.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (texte.includes('pays-bas') || texte.includes('pays bas')) return true;
  const mots = texte.split(/[^a-z]+/).filter(Boolean);
  return mots.some((mot) => UNION_EUROPEENNE.includes(mot) || mot === 'franco');
}

// Pièces demandées, dans l'ordre d'affichage : [{ type, libelle, aide, obligatoire }]
export function piecesAttendues(reponses) {
  const types = [
    ['identite', true],
    ['identite_verso', false],
  ];
  const nationalite = (reponses.nationalite ?? '').trim();
  if (nationalite && !nationaliteUnionEuropeenne(nationalite)) types.push(['titre_sejour', true]);
  types.push(['domicile', true], ['rib', true]);
  const origines = Array.isArray(reponses.origineFonds) ? reponses.origineFonds : [];
  if (origines.some((o) => o !== ORIGINE_SANS_JUSTIFICATIF)) types.push(['origine_fonds', true]);
  if (reponses.ppe === 'Oui') types.push(['ppe', true]);
  return types.map(([type, obligatoire]) => ({ type, obligatoire, ...PIECES[type] }));
}

// Erreurs de l'étape, par type de pièce : pièces obligatoires sans fichier déposé
export function piecesManquantes(reponses, pieces) {
  const deposees = pieces.map((p) => p.type);
  const erreurs = {};
  for (const piece of piecesAttendues(reponses)) {
    if (piece.obligatoire && !deposees.includes(piece.type)) {
      erreurs[piece.type] = MESSAGE_PIECE_MANQUANTE;
    }
  }
  return erreurs;
}

const TYPES_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

// Contrôle avant l'envoi (le backend vérifie aussi le contenu) : message, ou null si accepté
export function erreurFichier(fichier) {
  const extensionAcceptee = /\.(pdf|jpe?g|png)$/i.test(fichier.name);
  const formatAccepte = TYPES_MIME.includes(fichier.type) || (!fichier.type && extensionAcceptee);
  return formatAccepte && fichier.size > 0 && fichier.size <= TAILLE_MAX ? null : MESSAGE_FORMAT;
}
