// Règles de l'écran « Investir » (US-11, SCPI-259), refaites par le backend
// (backend/src/demandes/service.ts) : l'écran ne fait que guider la saisie.
import { formaterEuros } from '../utils/format.js';

export const TYPES = [
  {
    id: 'pleine_propriete',
    libelle: 'Pleine propriété',
    texte: 'Les parts et leurs revenus. Choix par défaut.',
  },
  {
    id: 'nue_propriete',
    libelle: 'Nue-propriété',
    texte: 'Les parts, sans les revenus pendant une durée.',
  },
  { id: 'usufruit', libelle: 'Usufruit', texte: 'Les revenus pendant une durée, sans les parts.' },
];

export const TYPE_PAR_DEFAUT = 'pleine_propriete';

export const STATUTS = {
  demande_envoyee: 'Demande envoyée',
  demande_recue: 'Demande reçue',
  acceptee_attente_paiement: 'Acceptée, en attente de paiement',
  refusee: 'Refusée',
  investissement_actif: 'Investissement actif',
};

export const PARTS_INVALIDES = 'Saisissez un nombre entier de parts supérieur à 0.';
export const PRIX_INCONNU =
  'Le prix de part de cette SCPI n’est pas connu : la demande ne peut pas être enregistrée.';
// Refus du backend (403) : KYC pas encore validé, la demande n'est pas enregistrée
export const KYC_NON_VALIDE =
  'Votre KYC doit être validé avant de pouvoir investir. Complétez-le pour envoyer votre demande.';

export const libelleType = (id) => TYPES.find((t) => t.id === id)?.libelle ?? id;
export const libelleStatut = (id) => STATUTS[id] ?? id;

// Règle 2 : le champ n'accepte que des chiffres (virgule, point, signe, lettre ignorés) ;
// les zéros en tête disparaissent, sauf « 0 » seul (pour afficher son message)
export function chiffresSeulement(saisie) {
  return String(saisie)
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '');
}

// Contrôle et calcul pendant la saisie (règles 2, 4 et 5). fiche : réponse de
// GET /scpis/<id> (prixPart { valeur, annee } ou null, minimum, minimumParts).
//   montant : nombre de parts × prix de part (0 sans saisie)
//   erreur : message à afficher, '' si la demande peut être validée
//   progression : part du minimum atteinte, de 0 à 100 (null sans minimum connu)
export function evaluer(parts, fiche) {
  const nombre = parts === '' ? 0 : Number(parts);
  const prix = fiche.prixPart?.valeur ?? null;
  const montant = prix === null ? 0 : Math.round(nombre * prix * 100) / 100;
  const minimum = fiche.minimum ?? null;
  let erreur = '';
  if (prix === null || prix <= 0) erreur = PRIX_INCONNU;
  else if (nombre <= 0) erreur = PARTS_INVALIDES;
  else if (minimum !== null && montant < minimum) erreur = messageMinimum(fiche);
  return {
    nombre,
    montant,
    erreur,
    minimumAtteint: minimum === null || montant >= minimum,
    progression: minimum ? Math.min(100, Math.round((montant / minimum) * 100)) : null,
  };
}

export function messageMinimum(fiche) {
  return `Le minimum à investir pour cette SCPI est de ${formaterEuros(fiche.minimum)}, soit ${fiche.minimumParts} parts.`;
}

// Nombre de parts proposé à l'ouverture : celui du minimum (1 sans minimum connu)
export function partsInitiales(fiche) {
  return String(fiche.minimumParts ?? 1);
}

// « 24/11/2026 »
export function formaterDate(iso) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris' }).format(new Date(iso));
}

// US-16 (SCPI-264), règle 2 : étapes du parcours C2, dans l'ordre. Un dossier refusé
// s'arrête à « Refusée », juste après « Demande reçue ».
const PARCOURS = [
  'demande_envoyee',
  'demande_recue',
  'acceptee_attente_paiement',
  'investissement_actif',
];
const PARCOURS_REFUSE = ['demande_envoyee', 'demande_recue', 'refusee'];

// Frise du suivi : chaque étape avec son état, franchie, en_cours (le statut du dossier)
// ou a_venir. Statut inconnu : toutes les étapes à venir.
export function etapesFrise(statut) {
  const etapes = statut === 'refusee' ? PARCOURS_REFUSE : PARCOURS;
  const courante = etapes.indexOf(statut);
  return etapes.map((id, i) => {
    let etat = 'a_venir';
    if (courante >= 0 && i < courante) etat = 'franchie';
    else if (i === courante) etat = 'en_cours';
    return { id, libelle: libelleStatut(id), etat };
  });
}

// Carte « Prochaine étape » (correction de l'US-16, maquettes validées par le BA) : ce qui
// va se passer, un texte et des étapes numérotées par statut. La carte du centre donne les
// faits du dossier (dates, montant, motif, coordonnées) : les deux ne se répètent pas.
export const PROCHAINE_ETAPE = {
  demande_envoyee: {
    texte: 'La SCPI va confirmer la réception de votre demande, puis l’étudier.',
    consignes: [
      'La SCPI confirme la réception de votre demande.',
      'Elle étudie votre dossier.',
      'Vous recevez sa décision par mail.',
    ],
  },
  demande_recue: {
    texte: 'Vous serez informé par mail de la décision de la SCPI.',
    consignes: [
      'La SCPI étudie votre dossier.',
      'Vous recevez sa décision par mail.',
      'Si elle accepte, les coordonnées du virement s’affichent sur cet écran.',
    ],
  },
  acceptee_attente_paiement: {
    texte:
      'Votre demande a été acceptée par la SCPI. Faites le virement indiqué : dès sa réception, votre investissement deviendra actif.',
    consignes: [
      'Faites un virement depuis votre banque vers l’IBAN de la SCPI.',
      'Indiquez la référence du virement dans son libellé.',
      'À réception, votre investissement devient actif.',
    ],
  },
  refusee: {
    texte: 'Cette demande est close. Vous pouvez investir dans une autre SCPI.',
    consignes: [
      'Lisez le motif du refus indiqué par la SCPI.',
      'Choisissez une autre SCPI dans le catalogue.',
      'Envoyez une nouvelle demande.',
    ],
  },
  investissement_actif: {
    texte: 'Cette demande est terminée : il n’y a plus rien à faire.',
    consignes: [
      'Vos parts sont à votre nom depuis la date d’entrée en jouissance.',
      'Vous pouvez investir dans une autre SCPI du catalogue.',
    ],
  },
};

export const texteProchaineEtape = (statut) => PROCHAINE_ETAPE[statut]?.texte ?? '';
export const consignesProchaineEtape = (statut) => PROCHAINE_ETAPE[statut]?.consignes ?? [];

export const AUCUNE_ACTION = 'Aucune action de votre part n’est nécessaire pour le moment.';
