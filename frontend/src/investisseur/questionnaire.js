// Questionnaire investisseur (US-05a, MIF2) : libellés et règles de saisie. Les clés et
// valeurs reprennent backend/src/investisseur/questionnaire.ts, qui reste la référence :
// toute modification se fait dans les deux fichiers. Aucun texte ne recommande un produit
// (pas de conseil en investissement).

export const MESSAGES = {
  obligatoire: 'Merci de répondre à cette question.',
  montant: 'Merci de saisir un montant en euros supérieur à 0.',
  echec: 'Vos réponses n’ont pas pu être enregistrées. Veuillez réessayer.',
  echecReinitialisation: 'Vos réponses n’ont pas pu être réinitialisées. Veuillez réessayer.',
};

const VRAI_FAUX = [
  { valeur: 'vrai', libelle: 'Vrai' },
  { valeur: 'faux', libelle: 'Faux' },
];
const OUI_NON = [
  { valeur: 'oui', libelle: 'Oui' },
  { valeur: 'non', libelle: 'Non' },
];

export const ETAPES = [
  {
    titre: 'Situation financière',
    questions: [
      {
        cle: 'revenus',
        type: 'choix',
        libelle: 'Revenus annuels nets du foyer',
        options: [
          { valeur: '<30k', libelle: 'Moins de 30 k€' },
          { valeur: '30-60k', libelle: '30 à 60 k€' },
          { valeur: '60-100k', libelle: '60 à 100 k€' },
          { valeur: '100-200k', libelle: '100 à 200 k€' },
          { valeur: '>200k', libelle: 'Plus de 200 k€' },
        ],
      },
      {
        cle: 'patrimoine',
        type: 'choix',
        libelle: 'Patrimoine global',
        options: [
          { valeur: '<50k', libelle: 'Moins de 50 k€' },
          { valeur: '50-150k', libelle: '50 à 150 k€' },
          { valeur: '150-500k', libelle: '150 à 500 k€' },
          { valeur: '500k-1M', libelle: '500 k€ à 1 M€' },
          { valeur: '>1M', libelle: 'Plus de 1 M€' },
        ],
      },
      {
        cle: 'charges',
        type: 'choix',
        libelle: 'Charges régulières (crédits, loyers, pensions) en part de vos revenus',
        options: [
          { valeur: '<20', libelle: 'Moins de 20 %' },
          { valeur: '20-35', libelle: '20 à 35 %' },
          { valeur: '>35', libelle: 'Plus de 35 %' },
        ],
      },
      { cle: 'epargne', type: 'montant', libelle: 'Épargne disponible à investir' },
    ],
  },
  {
    titre: 'Connaissances et expérience',
    questions: [
      {
        cle: 'revente',
        type: 'choix',
        libelle: 'La revente des parts de SCPI peut prendre plusieurs mois et n’est pas garantie.',
        options: VRAI_FAUX,
      },
      {
        cle: 'capitalGaranti',
        type: 'choix',
        libelle: 'Le capital investi en SCPI est garanti.',
        options: VRAI_FAUX,
      },
      {
        cle: 'frais',
        type: 'choix',
        libelle: 'Des frais de souscription sont prélevés à l’achat des parts.',
        options: VRAI_FAUX,
      },
      {
        cle: 'revenusGarantis',
        type: 'choix',
        libelle: 'Les revenus versés par une SCPI sont garantis.',
        options: VRAI_FAUX,
      },
      {
        cle: 'placements',
        type: 'multiple',
        libelle: 'Placements que vous détenez déjà (un ou plusieurs choix)',
        exclusive: 'aucun',
        options: [
          { valeur: 'livrets', libelle: 'Livrets' },
          { valeur: 'fonds-euros', libelle: 'Assurance-vie fonds euros' },
          { valeur: 'unites-de-compte', libelle: 'Assurance-vie unités de compte' },
          { valeur: 'actions', libelle: 'Actions ou fonds' },
          { valeur: 'scpi-immobilier', libelle: 'SCPI ou immobilier locatif' },
          { valeur: 'aucun', libelle: 'Aucun' },
        ],
      },
      {
        cle: 'dejaScpi',
        type: 'choix',
        libelle: 'Avez-vous déjà investi en SCPI ?',
        options: OUI_NON,
      },
    ],
  },
  {
    titre: 'Objectifs',
    questions: [
      {
        cle: 'objectifs',
        type: 'multiple',
        libelle: 'Objectifs de votre placement (un ou plusieurs choix)',
        options: [
          { valeur: 'revenus', libelle: 'Revenus complémentaires' },
          { valeur: 'valorisation', libelle: 'Valorisation du capital' },
          { valeur: 'defiscalisation', libelle: 'Défiscalisation' },
          { valeur: 'retraite', libelle: 'Préparation de la retraite' },
        ],
      },
    ],
  },
  {
    titre: 'Horizon et risque',
    questions: [
      {
        cle: 'horizon',
        type: 'choix',
        libelle: 'Horizon de placement',
        options: [
          { valeur: '<3', libelle: 'Moins de 3 ans' },
          { valeur: '3-8', libelle: '3 à 8 ans' },
          { valeur: '8-15', libelle: '8 à 15 ans' },
          { valeur: '>15', libelle: 'Plus de 15 ans' },
        ],
      },
      {
        cle: 'reactionBaisse',
        type: 'choix',
        libelle: 'Si la valeur de vos parts baissait de 10 %, vous…',
        options: [
          { valeur: 'vendre', libelle: 'Vendriez' },
          { valeur: 'attendre', libelle: 'Attendriez' },
          { valeur: 'investir', libelle: 'Investiriez davantage' },
        ],
      },
      {
        cle: 'perteAcceptee',
        type: 'choix',
        libelle: 'Part de votre patrimoine que vous acceptez de perdre',
        options: [
          { valeur: 'aucune', libelle: 'Aucune' },
          { valeur: '<10', libelle: 'Moins de 10 %' },
          { valeur: '10-25', libelle: '10 à 25 %' },
          { valeur: '>25', libelle: 'Plus de 25 %' },
        ],
      },
    ],
  },
  {
    titre: 'Préférences de durabilité',
    questions: [
      {
        cle: 'esg',
        type: 'choix',
        libelle:
          'Accordez-vous de l’importance aux critères ESG (environnement, social, gouvernance) ?',
        options: [...OUI_NON, { valeur: 'sans-preference', libelle: 'Sans préférence' }],
      },
      {
        cle: 'isr',
        type: 'choix',
        libelle: 'Souhaitez-vous privilégier les SCPI labellisées ISR ? (facultatif)',
        options: OUI_NON,
        facultative: true,
        si: ['esg', 'oui'],
      },
    ],
  },
];

export const NOMBRE_ETAPES = ETAPES.length;

// Questions affichées pour les réponses en cours (ISR seulement si ESG = oui)
export function questionsVisibles(etape, reponses) {
  return ETAPES[etape - 1].questions.filter((q) => !q.si || reponses[q.si[0]] === q.si[1]);
}

const vide = (valeur) =>
  valeur === undefined || valeur === '' || (Array.isArray(valeur) && valeur.length === 0);

// Messages d'erreur de l'étape, par question ({} si tout est valide)
export function erreursEtape(etape, reponses) {
  const erreurs = {};
  for (const question of questionsVisibles(etape, reponses)) {
    const valeur = reponses[question.cle];
    if (question.type === 'montant') {
      if (!/^\d+$/.test(String(valeur ?? '').trim()) || Number(valeur) <= 0) {
        erreurs[question.cle] = MESSAGES.montant;
      }
    } else if (vide(valeur) && !question.facultative) {
      erreurs[question.cle] = MESSAGES.obligatoire;
    }
  }
  return erreurs;
}

// Réponses à envoyer au backend : questions visibles seulement, montants en nombre
export function reponsesAEnvoyer(etape, reponses) {
  const resultat = {};
  for (const question of questionsVisibles(etape, reponses)) {
    const valeur = reponses[question.cle];
    if (vide(valeur)) continue;
    resultat[question.cle] = question.type === 'montant' ? Number(String(valeur).trim()) : valeur;
  }
  return resultat;
}

// Coche ou décoche un choix multiple ; le choix exclusif (« Aucun ») retire les autres
export function basculer(question, selection = [], valeur) {
  if (selection.includes(valeur)) {
    return selection.filter((v) => v !== valeur);
  }
  return valeur === question.exclusive ? [valeur] : [...selection, valeur];
}

// Les montants sont saisis comme du texte : ceux reçus du backend repassent en texte
export function pourSaisie(reponses) {
  const resultat = {};
  for (const [etape, valeurs] of Object.entries(reponses ?? {})) {
    resultat[etape] = Object.fromEntries(
      Object.entries(valeurs).map(([cle, v]) => [cle, typeof v === 'number' ? String(v) : v]),
    );
  }
  return resultat;
}
