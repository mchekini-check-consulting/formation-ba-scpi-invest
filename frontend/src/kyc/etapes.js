// Contenu du formulaire KYC (US-04a, SCPI-21) : 4 étapes, leurs champs et les règles de
// saisie, puis l'étape des pièces justificatives (US-04c, SCPI-44, règles dans pieces.js).
// Tous les champs sont obligatoires, sauf `facultatif: true`. Un champ avec `visible` n'est
// affiché (et contrôlé) que si la condition est vraie. Type `pays` : liste de pays avec
// recherche (ChoixPays.jsx, pays.js). Coordonnées : pays fixé à France (seuls les résidents
// en France peuvent investir), adresse avec suggestions (ChampAdresse.jsx), code postal et
// téléphone filtrés à la frappe (coordonnees.js).
// L'enregistrement, la reprise et la validation relèvent de l'US-04b (SCPI-37).

import { codePostalValide, messageCodePostal, telephoneValide } from './coordonnees.js';
import { indicatifDe } from './indicatifs.js';
import { paysParNom } from './pays.js';

export { telephoneValide } from './coordonnees.js';

export const MESSAGE_OBLIGATOIRE = 'Ce champ est obligatoire.';
export const MESSAGE_MAJEUR = 'Vous devez être majeur pour ouvrir un compte.';
export const MESSAGE_DATE = 'Merci de saisir une date de naissance valide.';
export const MESSAGE_PAYS = 'Merci de choisir un pays dans la liste.';
// Seuls les résidents en France peuvent investir : pays de l'adresse fixé, et résidence
// fiscale « Autre pays » refusée (même règle côté backend, backend/src/kyc/champs.ts)
export const PAYS_RESIDENCE = 'France';
// Indicatif du téléphone : toujours celui de la France (+33), affiché en lecture seule
export const PAYS_INDICATIF = PAYS_RESIDENCE;
export const MESSAGE_RESIDENCE =
  'Seuls les résidents fiscaux en France peuvent investir sur notre plateforme.';
// Les US Persons (FATCA) ne peuvent pas investir, même résidentes en France : réponse
// « Oui » refusée (même règle côté backend, backend/src/kyc/champs.ts)
export const MESSAGE_US_PERSON =
  'Les « US Persons » au sens de la réglementation FATCA ne peuvent pas investir sur notre plateforme.';
export const MESSAGE_TELEPHONE =
  'Numéro de téléphone invalide pour cet indicatif : vérifiez le nombre de chiffres.';

const OUI_NON = ['Oui', 'Non'];

export const ETAPES = [
  {
    id: 'identite',
    titre: 'Identité',
    champs: [
      { nom: 'civilite', libelle: 'Civilité', type: 'choix', options: ['Madame', 'Monsieur'] },
      { nom: 'nom', libelle: 'Nom', type: 'texte', autoComplete: 'family-name' },
      { nom: 'prenom', libelle: 'Prénom', type: 'texte', autoComplete: 'given-name' },
      {
        nom: 'nomNaissance',
        libelle: 'Nom de naissance',
        type: 'texte',
        facultatif: true,
        aide: 'À renseigner s’il est différent de votre nom actuel.',
      },
      { nom: 'dateNaissance', libelle: 'Date de naissance', type: 'date', autoComplete: 'bday' },
      {
        nom: 'lieuNaissance',
        libelle: 'Lieu de naissance',
        type: 'texte',
        aide: 'Ville et pays, par exemple : Lyon, France.',
      },
      {
        nom: 'nationalite',
        libelle: 'Nationalité',
        type: 'pays',
        aide: 'Tapez le nom du pays pour le trouver.',
      },
    ],
  },
  {
    id: 'coordonnees',
    titre: 'Coordonnées',
    champs: [
      // Toujours France (PAYS_RESIDENCE), affiché sans pouvoir être modifié
      { nom: 'pays', libelle: 'Pays', type: 'texte', lectureSeule: true },
      {
        nom: 'adresse',
        libelle: 'Adresse postale',
        type: 'adresse',
        autoComplete: 'street-address',
        aide: 'Numéro et nom de la voie. Choisissez votre adresse dans les suggestions : code postal et ville se remplissent seuls.',
      },
      {
        nom: 'codePostal',
        libelle: 'Code postal',
        type: 'codePostal',
        autoComplete: 'postal-code',
      },
      {
        nom: 'ville',
        libelle: 'Ville',
        type: 'ville',
        autoComplete: 'address-level2',
        aide: 'La ville est proposée d’après le code postal.',
      },
      {
        nom: 'telephone',
        libelle: 'Téléphone',
        type: 'tel',
        autoComplete: 'tel-national',
        indicatif: 'indicatif',
        aide: 'Tapez votre numéro (chiffres uniquement), par exemple : 06 12 34 56 78.',
      },
      {
        nom: 'email',
        libelle: 'Adresse e-mail',
        type: 'email',
        lectureSeule: true,
      },
    ],
  },
  {
    id: 'situation',
    titre: 'Situation personnelle et professionnelle',
    champs: [
      {
        nom: 'situationFamiliale',
        libelle: 'Situation familiale',
        type: 'liste',
        options: [
          'Célibataire',
          'Marié(e)',
          'Pacsé(e)',
          'En concubinage',
          'Divorcé(e)',
          'Veuf ou veuve',
        ],
      },
      {
        nom: 'profession',
        libelle: 'Profession',
        type: 'texte',
        autoComplete: 'organization-title',
      },
      {
        nom: 'categorie',
        libelle: 'Catégorie socio-professionnelle',
        type: 'liste',
        options: [
          'Agriculteur exploitant',
          'Artisan, commerçant, chef d’entreprise',
          'Cadre, profession intellectuelle supérieure',
          'Profession intermédiaire',
          'Employé',
          'Ouvrier',
          'Retraité',
          'Sans activité professionnelle',
        ],
      },
      {
        nom: 'secteur',
        libelle: 'Secteur d’activité',
        type: 'liste',
        options: [
          'Agriculture',
          'Industrie',
          'Construction, BTP',
          'Commerce',
          'Transports, logistique',
          'Hôtellerie, restauration',
          'Information, communication',
          'Informatique',
          'Banque, finance, assurance',
          'Immobilier',
          'Conseil, activités juridiques et techniques',
          'Fonction publique',
          'Enseignement',
          'Santé, action sociale',
          'Arts, culture, loisirs',
          'Autre secteur',
          'Sans objet (sans activité)',
        ],
      },
    ],
  },
  {
    id: 'declarations',
    titre: 'Déclarations réglementaires',
    champs: [
      {
        nom: 'origineFonds',
        libelle: 'Origine des fonds que vous allez investir',
        type: 'cases',
        aide: 'Plusieurs choix possibles.',
        options: [
          'Épargne issue de mes revenus',
          'Vente d’un bien immobilier',
          'Héritage ou succession',
          'Donation',
          'Cession d’entreprise ou de parts sociales',
          'Indemnité (licenciement, assurance…)',
          'Gains au jeu',
          'Autre origine',
        ],
      },
      {
        nom: 'ppe',
        libelle: 'Êtes-vous une personne politiquement exposée (PPE) ?',
        type: 'choix',
        options: OUI_NON,
        aide: 'Vous exercez, ou avez exercé depuis moins d’un an, une fonction politique, juridictionnelle ou administrative importante (ministre, parlementaire, magistrat d’une haute juridiction, ambassadeur, dirigeant d’une entreprise publique…), ou vous êtes un proche d’une telle personne.',
      },
      {
        nom: 'residenceFiscale',
        libelle: 'Résidence fiscale',
        type: 'choix',
        options: ['France', 'Autre pays'],
        refus: { valeur: 'Autre pays', message: MESSAGE_RESIDENCE },
      },
      {
        nom: 'usPerson',
        libelle: 'Êtes-vous une « US Person » au sens de la réglementation FATCA ?',
        type: 'choix',
        options: OUI_NON,
        aide: 'C’est le cas si vous avez la nationalité américaine, une carte verte, êtes né aux États-Unis ou y êtes résident fiscal.',
        refus: { valeur: 'Oui', message: MESSAGE_US_PERSON },
      },
    ],
  },
  // US-04c : dépôt des fichiers (EtapePieces.jsx), pas de champ de saisie
  { id: 'pieces', titre: 'Pièces justificatives', champs: [] },
];

export function champsVisibles(etape, reponses) {
  return etape.champs.filter((c) => !c.visible || c.visible(reponses));
}

function vide(valeur) {
  if (Array.isArray(valeur)) return valeur.length === 0;
  return (valeur ?? '').toString().trim() === '';
}

// Âge révolu à la date du jour, à partir d'une date « AAAA-MM-JJ » (champ date)
export function age(dateIso, aujourdhui = new Date()) {
  const [annee, mois, jour] = dateIso.split('-').map(Number);
  let ans = aujourdhui.getFullYear() - annee;
  const moisCourant = aujourdhui.getMonth() + 1;
  if (moisCourant < mois || (moisCourant === mois && aujourdhui.getDate() < jour)) {
    ans -= 1;
  }
  return ans;
}

function erreurDateNaissance(valeur, aujourdhui) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return MESSAGE_DATE;
  const ans = age(valeur, aujourdhui);
  if (ans < 0 || ans > 120) return MESSAGE_DATE;
  if (ans < 18) return MESSAGE_MAJEUR;
  return null;
}

// Réponses à enregistrer (US-04b) : seulement les champs affichés (un champ saisi puis
// masqué n'est pas gardé), sans l'email, qui est celui du compte
export function reponsesAEnregistrer(reponses) {
  const aGarder = {};
  for (const etape of ETAPES) {
    for (const champ of champsVisibles(etape, reponses)) {
      if (champ.nom !== 'email' && reponses[champ.nom] !== undefined) {
        aGarder[champ.nom] = reponses[champ.nom];
      }
      if (champ.indicatif && reponses[champ.nom] !== undefined) {
        aGarder[champ.indicatif] = PAYS_INDICATIF;
      }
    }
  }
  return aGarder;
}

// Libellé d'une réponse pour le récapitulatif : date en JJ/MM/AAAA, choix multiples
// séparés par des virgules, téléphone précédé de son indicatif, « Non renseigné » si vide
export function reponseLisible(champ, valeur) {
  if (Array.isArray(valeur)) return valeur.length ? valeur.join(', ') : 'Non renseigné';
  if (!valeur || valeur.toString().trim() === '') return 'Non renseigné';
  if (champ.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(valeur)) {
    const [annee, mois, jour] = valeur.split('-');
    return `${jour}/${mois}/${annee}`;
  }
  if (champ.type === 'tel') return `+${indicatifDe(PAYS_INDICATIF)} ${valeur}`;
  return valeur;
}

// Contrôle de format d'un champ rempli, selon son type ; null si la valeur est correcte
const FORMATS = {
  date: (valeur, _reponses, aujourdhui) => erreurDateNaissance(valeur, aujourdhui),
  tel: (valeur) => (telephoneValide(valeur, PAYS_INDICATIF) ? null : MESSAGE_TELEPHONE),
  pays: (valeur) => (paysParNom(valeur) ? null : MESSAGE_PAYS),
  codePostal: (valeur, reponses) =>
    codePostalValide(valeur, reponses.pays) ? null : messageCodePostal(reponses.pays),
};

// Réponse refusée par une règle métier (résidence fiscale hors de France, US Person),
// sinon format
function erreurFormat(champ, valeur, reponses, aujourdhui) {
  if (champ.refus && valeur === champ.refus.valeur) return champ.refus.message;
  return FORMATS[champ.type]?.(valeur, reponses, aujourdhui) ?? null;
}

// Erreurs de l'étape, par nom de champ ; objet vide si l'étape est complète
export function erreursEtape(etape, reponses, aujourdhui = new Date()) {
  const erreurs = {};
  for (const champ of champsVisibles(etape, reponses)) {
    const valeur = reponses[champ.nom];
    const message = vide(valeur)
      ? !champ.facultatif && MESSAGE_OBLIGATOIRE
      : erreurFormat(champ, valeur, reponses, aujourdhui);
    if (message) erreurs[champ.nom] = message;
  }
  return erreurs;
}
