// Contenu du formulaire KYC (US-04a, SCPI-21) : 4 étapes, leurs champs et les règles de
// saisie, puis l'étape des pièces justificatives (US-04c, SCPI-44, règles dans pieces.js).
// Tous les champs sont obligatoires, sauf `facultatif: true`. Un champ avec `visible` n'est
// affiché (et contrôlé) que si la condition est vraie. `regle` : contrôle de vraisemblance
// (coordonnees.js). Type `pays` : liste des pays avec recherche (ChoixPays.jsx, pays.js),
// valeur = code ISO à 2 lettres. Type `tel` : numéro + liste d'indicatifs (valeur de
// l'indicatif dans le champ nommé par `indicatif`).
// L'enregistrement, la reprise et la validation relèvent de l'US-04b (SCPI-37).
import {
  adresseValide,
  codePostalValide,
  exempleCodePostal,
  sansCodePostal,
  telephoneValide,
  villeValide,
} from './coordonnees.js';
import { indicatifDe, nomPays, paysConnu } from './pays.js';

export const MESSAGE_OBLIGATOIRE = 'Ce champ est obligatoire.';
export const MESSAGE_MAJEUR = 'Vous devez être majeur pour ouvrir un compte.';
export const MESSAGE_DATE = 'Merci de saisir une date de naissance valide.';
export const MESSAGE_TELEPHONE =
  'Numéro de téléphone invalide pour cet indicatif : vérifiez le nombre de chiffres.';
export const MESSAGE_PAYS = 'Merci de choisir un pays dans la liste.';
export const MESSAGE_ADRESSE =
  'Merci de saisir une adresse complète : numéro et nom de la voie (ou lieu-dit).';
export const MESSAGE_VILLE = 'Merci de saisir un nom de ville valide.';
export const messageCodePostal = (pays) => {
  const exemple = exempleCodePostal(pays);
  return exemple
    ? `Code postal invalide pour ${nomPays(pays)} (exemple : ${exemple}).`
    : 'Code postal invalide : lettres, chiffres, espaces ou tirets, avec au moins un chiffre.';
};

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
        nom: 'pays',
        libelle: 'Pays',
        type: 'pays',
        autoComplete: 'country',
      },
      {
        nom: 'adresse',
        libelle: 'Adresse postale',
        type: 'texte',
        regle: 'adresse',
        autoComplete: 'street-address',
        aide: 'Numéro et nom de la voie, par exemple : 12 rue des Lilas.',
      },
      {
        nom: 'codePostal',
        libelle: 'Code postal',
        type: 'texte',
        regle: 'codePostal',
        autoComplete: 'postal-code',
        visible: (reponses) => !sansCodePostal(reponses.pays),
        aide: (reponses) => {
          const exemple = exempleCodePostal(reponses.pays);
          return exemple ? `Par exemple : ${exemple}.` : undefined;
        },
      },
      {
        nom: 'ville',
        libelle: 'Ville',
        type: 'texte',
        regle: 'ville',
        autoComplete: 'address-level2',
      },
      {
        nom: 'telephone',
        libelle: 'Téléphone',
        type: 'tel',
        indicatif: 'indicatif',
        autoComplete: 'tel-national',
        aide: 'Choisissez l’indicatif du pays, puis saisissez votre numéro.',
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
        type: 'pays',
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

// Texte d'aide d'un champ : fixe, ou calculé selon les réponses (exemple de code postal)
export function aideDe(champ, reponses) {
  return typeof champ.aide === 'function' ? champ.aide(reponses) : champ.aide;
}

// Indicatif choisi pour un téléphone : celui saisi, sinon celui du pays de l'adresse,
// sinon la France
export function indicatifChoisi(champ, reponses) {
  const choisi = reponses[champ.indicatif];
  if (paysConnu(choisi)) return choisi;
  return paysConnu(reponses.pays) ? reponses.pays : 'FR';
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
      if (champ.indicatif && reponses[champ.nom] !== undefined) {
        aGarder[champ.indicatif] = indicatifChoisi(champ, reponses);
      }
    }
  }
  return aGarder;
}

// Libellé d'une réponse pour le récapitulatif : date en JJ/MM/AAAA, nom du pays,
// téléphone avec son indicatif, choix multiples séparés par des virgules,
// « Non renseigné » si vide
export function reponseLisible(champ, valeur, reponses = {}) {
  if (Array.isArray(valeur)) return valeur.length ? valeur.join(', ') : 'Non renseigné';
  if (!valeur || valeur.toString().trim() === '') return 'Non renseigné';
  if (champ.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(valeur)) {
    const [annee, mois, jour] = valeur.split('-');
    return `${jour}/${mois}/${annee}`;
  }
  if (champ.type === 'pays') return nomPays(valeur);
  if (champ.type === 'tel') {
    return `+${indicatifDe(indicatifChoisi(champ, reponses))} ${valeur}`;
  }
  return valeur;
}

// Contrôle de vraisemblance d'un champ rempli ; null s'il est correct
function erreurFormat(champ, valeur, reponses) {
  if (champ.type === 'pays') return paysConnu(valeur) ? null : MESSAGE_PAYS;
  if (champ.type === 'tel') {
    return telephoneValide(valeur, indicatifChoisi(champ, reponses)) ? null : MESSAGE_TELEPHONE;
  }
  if (champ.regle === 'adresse') return adresseValide(valeur) ? null : MESSAGE_ADRESSE;
  if (champ.regle === 'ville') return villeValide(valeur) ? null : MESSAGE_VILLE;
  if (champ.regle === 'codePostal') {
    return codePostalValide(valeur, reponses.pays) ? null : messageCodePostal(reponses.pays);
  }
  return null;
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
    } else {
      const message = erreurFormat(champ, valeur, reponses);
      if (message) erreurs[champ.nom] = message;
    }
  }
  return erreurs;
}
