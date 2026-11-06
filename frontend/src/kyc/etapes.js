// Contenu du formulaire KYC (US-04a, SCPI-21) : 4 étapes, leurs champs et les règles de
// saisie, puis l'étape des pièces justificatives (US-04c, SCPI-44, règles dans pieces.js).
// Tous les champs sont obligatoires, sauf `facultatif: true`. Un champ avec `visible` n'est
// affiché (et contrôlé) que si la condition est vraie. Nationalité : liste de pays (pays.js).
// L'enregistrement, la reprise et la validation relèvent de l'US-04b (SCPI-37).

import { paysParNom } from './pays.js';

export const MESSAGE_OBLIGATOIRE = 'Ce champ est obligatoire.';
export const MESSAGE_MAJEUR = 'Vous devez être majeur pour ouvrir un compte.';
export const MESSAGE_DATE = 'Merci de saisir une date de naissance valide.';
export const MESSAGE_PAYS = 'Merci de choisir un pays dans la liste.';
export const MESSAGE_TELEPHONE =
  'Merci de saisir un numéro de téléphone valide (10 chiffres minimum).';

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
      {
        nom: 'adresse',
        libelle: 'Adresse postale',
        type: 'texte',
        autoComplete: 'street-address',
      },
      { nom: 'codePostal', libelle: 'Code postal', type: 'texte', autoComplete: 'postal-code' },
      { nom: 'ville', libelle: 'Ville', type: 'texte', autoComplete: 'address-level2' },
      { nom: 'pays', libelle: 'Pays', type: 'texte', autoComplete: 'country-name' },
      { nom: 'telephone', libelle: 'Téléphone', type: 'tel', autoComplete: 'tel' },
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
      },
      {
        nom: 'paysResidenceFiscale',
        libelle: 'Pays de résidence fiscale',
        type: 'texte',
        visible: (reponses) => reponses.residenceFiscale === 'Autre pays',
      },
      {
        nom: 'usPerson',
        libelle: 'Êtes-vous une « US Person » au sens de la réglementation FATCA ?',
        type: 'choix',
        options: OUI_NON,
        aide: 'C’est le cas si vous avez la nationalité américaine, une carte verte, êtes né aux États-Unis ou y êtes résident fiscal.',
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

export function telephoneValide(valeur) {
  const chiffres = valeur.replace(/\D/g, '');
  return /^\+?[\d\s.()-]+$/.test(valeur.trim()) && chiffres.length >= 10 && chiffres.length <= 15;
}

// Réponses à enregistrer (US-04b) : seulement les champs affichés (un pays de résidence
// fiscale saisi puis masqué n'est pas gardé), sans l'email, qui est celui du compte
export function reponsesAEnregistrer(reponses) {
  const aGarder = {};
  for (const etape of ETAPES) {
    for (const champ of champsVisibles(etape, reponses)) {
      if (champ.nom !== 'email' && reponses[champ.nom] !== undefined) {
        aGarder[champ.nom] = reponses[champ.nom];
      }
    }
  }
  return aGarder;
}

// Libellé d'une réponse pour le récapitulatif : date en JJ/MM/AAAA, choix multiples
// séparés par des virgules, « Non renseigné » si vide
export function reponseLisible(champ, valeur) {
  if (Array.isArray(valeur)) return valeur.length ? valeur.join(', ') : 'Non renseigné';
  if (!valeur || valeur.toString().trim() === '') return 'Non renseigné';
  if (champ.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(valeur)) {
    const [annee, mois, jour] = valeur.split('-');
    return `${jour}/${mois}/${annee}`;
  }
  return valeur;
}

// Erreurs de l'étape, par nom de champ ; objet vide si l'étape est complète
export function erreursEtape(etape, reponses, aujourdhui = new Date()) {
  const erreurs = {};
  for (const champ of champsVisibles(etape, reponses)) {
    const valeur = reponses[champ.nom];
    if (vide(valeur)) {
      if (!champ.facultatif) erreurs[champ.nom] = MESSAGE_OBLIGATOIRE;
    } else if (champ.type === 'date') {
      const message = erreurDateNaissance(valeur, aujourdhui);
      if (message) erreurs[champ.nom] = message;
    } else if (champ.type === 'tel' && !telephoneValide(valeur)) {
      erreurs[champ.nom] = MESSAGE_TELEPHONE;
    } else if (champ.type === 'pays' && !paysParNom(valeur)) {
      erreurs[champ.nom] = MESSAGE_PAYS;
    }
  }
  return erreurs;
}
