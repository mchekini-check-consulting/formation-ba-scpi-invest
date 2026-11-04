// Questionnaire investisseur (US-05a) : questions de chaque étape et valeurs admises,
// vérifiées ici (source de vérité). Le frontend en reprend une copie avec les libellés
// (frontend/src/investisseur/questionnaire.js) : toute modification se fait dans les deux
// fichiers, et toute modification des questions change VERSION_QUESTIONNAIRE.

export const VERSION_QUESTIONNAIRE = '1.0';
export const NOMBRE_ETAPES = 5;

type Question =
  | { cle: string; type: 'choix'; valeurs: string[]; facultative?: boolean; si?: [string, string] }
  | { cle: string; type: 'multiple'; valeurs: string[]; exclusive?: string }
  | { cle: string; type: 'montant' };

const VRAI_FAUX = ['vrai', 'faux'];
const OUI_NON = ['oui', 'non'];

export const ETAPES: Record<number, Question[]> = {
  // Étape 1 — Situation financière
  1: [
    { cle: 'revenus', type: 'choix', valeurs: ['<30k', '30-60k', '60-100k', '100-200k', '>200k'] },
    {
      cle: 'patrimoine',
      type: 'choix',
      valeurs: ['<50k', '50-150k', '150-500k', '500k-1M', '>1M'],
    },
    { cle: 'charges', type: 'choix', valeurs: ['<20', '20-35', '>35'] },
    { cle: 'epargne', type: 'montant' },
  ],
  // Étape 2 — Connaissances et expérience
  2: [
    { cle: 'revente', type: 'choix', valeurs: VRAI_FAUX },
    { cle: 'capitalGaranti', type: 'choix', valeurs: VRAI_FAUX },
    { cle: 'frais', type: 'choix', valeurs: VRAI_FAUX },
    { cle: 'revenusGarantis', type: 'choix', valeurs: VRAI_FAUX },
    {
      cle: 'placements',
      type: 'multiple',
      valeurs: [
        'livrets',
        'fonds-euros',
        'unites-de-compte',
        'actions',
        'scpi-immobilier',
        'aucun',
      ],
      exclusive: 'aucun',
    },
    { cle: 'dejaScpi', type: 'choix', valeurs: OUI_NON },
  ],
  // Étape 3 — Objectifs
  3: [
    {
      cle: 'objectifs',
      type: 'multiple',
      valeurs: ['revenus', 'valorisation', 'defiscalisation', 'retraite'],
    },
  ],
  // Étape 4 — Horizon et risque
  4: [
    { cle: 'horizon', type: 'choix', valeurs: ['<3', '3-8', '8-15', '>15'] },
    { cle: 'reactionBaisse', type: 'choix', valeurs: ['vendre', 'attendre', 'investir'] },
    { cle: 'perteAcceptee', type: 'choix', valeurs: ['aucune', '<10', '10-25', '>25'] },
  ],
  // Étape 5 — Préférences de durabilité (ISR seulement si ESG = oui, facultative)
  5: [
    { cle: 'esg', type: 'choix', valeurs: ['oui', 'non', 'sans-preference'] },
    { cle: 'isr', type: 'choix', valeurs: OUI_NON, facultative: true, si: ['esg', 'oui'] },
  ],
};

// Réponses d'une étape nettoyées (questions inconnues ou masquées retirées), ou null si
// une réponse obligatoire manque ou n'est pas une valeur admise.
export function reponsesValides(
  etape: number,
  reponses: Record<string, unknown>,
): Record<string, unknown> | null {
  const resultat: Record<string, unknown> = {};
  for (const question of ETAPES[etape] ?? []) {
    const valeur = reponses[question.cle];
    if (question.type === 'choix' && question.si && reponses[question.si[0]] !== question.si[1]) {
      continue;
    }
    if (valeur === undefined || valeur === null || valeur === '') {
      if (question.type === 'choix' && question.facultative) continue;
      return null;
    }
    if (!valeurAdmise(question, valeur)) {
      return null;
    }
    resultat[question.cle] = valeur;
  }
  return resultat;
}

function valeurAdmise(question: Question, valeur: unknown): boolean {
  if (question.type === 'montant') {
    return Number.isInteger(valeur) && (valeur as number) > 0;
  }
  if (question.type === 'choix') {
    return typeof valeur === 'string' && question.valeurs.includes(valeur);
  }
  if (!Array.isArray(valeur) || valeur.length === 0 || new Set(valeur).size !== valeur.length) {
    return false;
  }
  const toutesAdmises = valeur.every((v) => question.valeurs.includes(v));
  const exclusiveSeule = !question.exclusive || !valeur.includes(question.exclusive);
  return toutesAdmises && (exclusiveSeule || valeur.length === 1);
}
