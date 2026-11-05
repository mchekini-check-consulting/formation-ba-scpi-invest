// Textes du profil investisseur (US-05b, règles 4 et 5), repris mot pour mot de l'US.
// Le score n'est jamais affiché ; aucune SCPI n'est recommandée.

export const PROFILS = {
  prudent: {
    nom: 'Prudent',
    explication:
      'Vous privilégiez la préservation de votre capital et acceptez peu de variations de la valeur de vos placements.',
  },
  equilibre: {
    nom: 'Équilibré',
    explication:
      'Vous recherchez un compromis entre sécurité et rendement et acceptez des variations modérées de la valeur de vos placements sur le moyen ou long terme.',
  },
  dynamique: {
    nom: 'Dynamique',
    explication:
      'Vous visez un rendement potentiel plus élevé et acceptez des variations importantes de la valeur de vos placements, y compris une perte en capital, sur le long terme.',
  },
};

export const AVERTISSEMENTS = {
  connaissances:
    'Les SCPI présentent des risques : le capital investi et les revenus ne sont pas garantis, la revente des parts peut prendre du temps et des frais sont prélevés à la souscription.',
  horizon: 'La durée de placement recommandée pour une SCPI est d’au moins 8 ans.',
};

export const CERTIFICATION = 'Je certifie l’exactitude de mes réponses';

export const ECHEC_VALIDATION =
  'La validation de votre profil n’a pas pu être enregistrée. Veuillez réessayer.';
