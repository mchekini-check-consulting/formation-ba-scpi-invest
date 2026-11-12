// US-06 (SCPI-235), variante « prise en compte directe » : blocs modifiables de la page
// Mon profil et appels au backend (backend/src/informations/) :
//   GET  /informations-personnelles                -> { email, reponses, historique }
//   POST /informations-personnelles/justificatifs  fichier -> { id, nomFichier }
//   PUT  /informations-personnelles/<bloc>         -> informations à jour
// Un bloc à la fois ; la modification est appliquée dès l'enregistrement. Champs, libellés
// et contrôles repris du KYC (kyc/etapes.js).
import { appelConnecte, envoyerFichierConnecte } from '../auth.js';
import { ETAPES, PAYS_RESIDENCE, champsVisibles, erreursEtape } from '../kyc/etapes.js';
import { MESSAGE_FORMAT, MESSAGE_PIECE_MANQUANTE, PIECES, erreurFichier } from '../kyc/pieces.js';

// Justificatifs : mêmes règles que les pièces du KYC (kyc/pieces.js) : PDF, JPG ou PNG,
// 10 Mo maximum, mêmes messages et mêmes aides
export const MESSAGE_FICHIER = MESSAGE_FORMAT;
export const MESSAGE_JUSTIFICATIF = MESSAGE_PIECE_MANQUANTE;
export const MESSAGE_MOT_DE_PASSE = 'Merci de saisir votre mot de passe.';
export const MESSAGE_ECHEC =
  'Vos modifications n’ont pas pu être enregistrées. Veuillez réessayer.';
export const MESSAGE_ANNULEE =
  'Modification annulée : mot de passe incorrect 3 fois. Vos coordonnées n’ont pas changé.';
export const ESSAIS_MOT_DE_PASSE = 3;

function champ(nom) {
  return ETAPES.flatMap((etape) => etape.champs).find((c) => c.nom === nom);
}

const EMAIL = { nom: 'email', libelle: 'Adresse e-mail', type: 'email', autoComplete: 'email' };

// Blocs modifiables : champs (définitions du KYC), justificatif demandé, mot de passe
export const BLOCS = {
  coordonnees: {
    titre: 'Coordonnées',
    champs: [champ('telephone'), EMAIL],
    motDePasse: true,
  },
  adresse: {
    titre: 'Adresse',
    champs: ['pays', 'adresse', 'codePostal', 'ville'].map(champ),
    justificatif: {
      libelle: PIECES.domicile.libelle,
      aide: PIECES.domicile.aide,
      exige: () => true,
    },
  },
  situation: {
    titre: 'Situation professionnelle et familiale',
    champs: ['nom', 'situationFamiliale', 'profession', 'categorie', 'secteur'].map(champ),
    justificatif: {
      libelle: 'Pièce justificative d’état civil',
      aide: 'Obligatoire si votre nom change : acte de mariage, livret de famille ou jugement.',
      exige: (valeurs, initiales) => (valeurs.nom ?? '').trim() !== (initiales.nom ?? '').trim(),
    },
    // Message après l'enregistrement : la situation a changé, le profil peut-être aussi
    invitationProfil: true,
  },
};

// Valeurs du bloc tirées des réponses du KYC et de l'e-mail du compte
export function valeursBloc(bloc, reponses = {}, email = '') {
  const valeurs = {};
  for (const { nom } of BLOCS[bloc].champs) {
    valeurs[nom] = nom === 'email' ? email : (reponses[nom] ?? '');
  }
  if (bloc === 'coordonnees' && reponses.indicatif) valeurs.indicatif = reponses.indicatif;
  // Pays de l'adresse : toujours France (résidents en France uniquement), non modifiable ;
  // il sert aussi au contrôle du code postal et du téléphone
  if (bloc === 'coordonnees' || bloc === 'adresse') valeurs.pays = PAYS_RESIDENCE;
  return valeurs;
}

// Erreurs des champs du bloc (mêmes règles que le KYC), par nom de champ
export function erreursBloc(bloc, valeurs, aujourdhui = new Date()) {
  const etape = { champs: BLOCS[bloc].champs };
  const erreurs = erreursEtape(etape, valeurs, aujourdhui);
  if (bloc === 'coordonnees' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeurs.email ?? '')) {
    erreurs.email = 'Merci de saisir une adresse e-mail valide.';
  }
  return erreurs;
}

// Erreurs du formulaire d'un bloc : champs, justificatif et mot de passe quand ils sont
// demandés (undefined : non demandé ; null ou '' : manquant)
export function erreursFormulaire(bloc, valeurs, { fichier, motDePasse } = {}) {
  const erreurs = erreursBloc(bloc, valeurs);
  if (fichier !== undefined) {
    erreurs.justificatif = fichier ? erreurJustificatif(fichier) : MESSAGE_JUSTIFICATIF;
  }
  if (motDePasse !== undefined && !motDePasse) erreurs.motDePasse = MESSAGE_MOT_DE_PASSE;
  return erreurs;
}

export function champsAffiches(bloc, valeurs) {
  return champsVisibles({ champs: BLOCS[bloc].champs }, valeurs);
}

// Contrôle avant l'envoi, comme au KYC (le backend vérifie aussi le contenu) : message,
// ou null si accepté
export const erreurJustificatif = erreurFichier;

// Demande envoyée au backend pour un bloc
export function demandeBloc(bloc, valeurs, { justificatif, motDePasse } = {}) {
  const demande = {};
  for (const { nom } of BLOCS[bloc].champs) demande[nom] = (valeurs[nom] ?? '').trim();
  if (bloc === 'coordonnees') {
    if (valeurs.indicatif) demande.indicatif = valeurs.indicatif;
    demande.motDePasse = motDePasse;
  }
  if (justificatif) demande.justificatif = justificatif;
  return demande;
}

// Libellés de l'historique
const LIBELLES_HISTORIQUE = {
  email: 'Adresse e-mail',
  indicatif: 'Indicatif du téléphone',
  identite: 'Pièce d’identité (recto)',
  identite_verso: 'Pièce d’identité (verso)',
};

export function libelleHistorique(nom) {
  return LIBELLES_HISTORIQUE[nom] ?? champ(nom)?.libelle ?? nom;
}

const DATE_HEURE = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

// « 11/11/2026 10:42 » ; '' si la date est illisible
export function dateHeure(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : DATE_HEURE.format(date).replace(',', '');
}

export function lireInformations() {
  return appelConnecte('/informations-personnelles');
}

export function deposerJustificatif(fichier) {
  const nom = encodeURIComponent(fichier.name);
  return envoyerFichierConnecte(`/informations-personnelles/justificatifs?nom=${nom}`, fichier, {
    methode: 'POST',
  });
}

export function modifierInformations(bloc, demande) {
  return appelConnecte(`/informations-personnelles/${bloc}`, { methode: 'PUT', corps: demande });
}
