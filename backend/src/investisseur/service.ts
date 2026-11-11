import type { ReponsesQuestionnaire } from '../db/schema.js';
import { HttpError } from '../logging/http-error.js';
import { loggable } from '../logging/service.js';
import { type Avertissement, type Profil, calculerProfil } from './profil.js';
import { NOMBRE_ETAPES, VERSION_QUESTIONNAIRE, reponsesValides } from './questionnaire.js';

// Avancement du questionnaire d'un utilisateur : etapeCourante = première étape non
// complétée (1 à 5), NOMBRE_ETAPES + 1 = toutes les étapes complétées
export type Avancement = { etapeCourante: number; reponses: ReponsesQuestionnaire };

// Avancement vu par l'écran : valide = profil déjà validé (US-05b), formulaire terminé
export type Etat = Avancement & { valide: boolean };

// Profil affiché à l'écran : jamais le score (US-05b, règle 5)
export type ProfilAffiche = { profil: Profil; avertissements: Avertissement[] };

// Page Profil : date et heure de la dernière validation (ISO), null si pas encore validé ;
// aMettreAJour : rappel de l'US-05d (profil de plus de 24 mois ou questionnaire modifié)
export type ProfilConsulte = ProfilAffiche & { valideLe: string | null; aMettreAJour: boolean };

// Dernière validation d'un utilisateur : date et version du questionnaire alors en vigueur
export type DerniereValidation = { valideLe: Date; versionQuestionnaire: string };

export type ProfilValide = ProfilAffiche & {
  score: number;
  reponses: ReponsesQuestionnaire;
  versionQuestionnaire: string;
};

export type DepotQuestionnaires = {
  lire(utilisateurId: string): Promise<Avancement | null>;
  enregistrer(utilisateurId: string, avancement: Avancement, version: string): Promise<void>;
};

export type DepotProfils = {
  existe(utilisateurId: string): Promise<boolean>;
  // Dernière validation (US-05d : une mise à jour ajoute une ligne), null si aucune
  derniereValidation(utilisateurId: string): Promise<DerniereValidation | null>;
  enregistrer(utilisateurId: string, profil: ProfilValide): Promise<void>;
};

const DEBUT: Avancement = { etapeCourante: 1, reponses: {} };

const DEJA_VALIDE = 'Votre profil investisseur est déjà validé.';
const NON_TERMINE = 'Merci de répondre aux 5 étapes du questionnaire.';
const SANS_CERTIFICATION = 'Merci de certifier l’exactitude de vos réponses.';
const PAS_ENCORE_VALIDE = 'Votre profil investisseur n’est pas encore validé.';
const REPONSES_INCOMPLETES = 'Merci de répondre à toutes les questions des 5 étapes.';

// US-05d : rappel de mise à jour quand le profil a été validé il y a 24 mois ou plus
export const DUREE_VALIDITE_MOIS = 24;

// Profil à mettre à jour : validé il y a au moins 24 mois, ou avec une autre version du
// questionnaire que celle en vigueur
export function aMettreAJour(derniere: DerniereValidation | null, maintenant: Date): boolean {
  if (!derniere) return false;
  const limite = new Date(derniere.valideLe);
  limite.setMonth(limite.getMonth() + DUREE_VALIDITE_MOIS);
  return limite <= maintenant || derniere.versionQuestionnaire !== VERSION_QUESTIONNAIRE;
}

function objet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
}

// Réponses des 5 étapes envoyées d'un coup (mise à jour, US-05d), nettoyées comme à
// l'enregistrement d'une étape ; null si une étape manque ou est invalide
function toutesLesReponses(brutes: unknown): ReponsesQuestionnaire | null {
  if (!objet(brutes)) return null;
  const resultat: ReponsesQuestionnaire = {};
  for (let etape = 1; etape <= NOMBRE_ETAPES; etape += 1) {
    const reponses = brutes[etape];
    const valides = objet(reponses) ? reponsesValides(etape, reponses) : null;
    if (!valides) return null;
    resultat[etape] = valides;
  }
  return resultat;
}

function certifiee(demande: unknown): boolean {
  return objet(demande) && demande.certification === true;
}

// Couche service du formulaire investisseur : reprise et enregistrement étape par étape
// (US-05a), calcul du profil, certification et validation (US-05b), mise à jour du
// profil après validation (US-05d). maintenant : horloge, remplacée dans les tests.
export function creerQuestionnaireService(
  depot: DepotQuestionnaires,
  profils: DepotProfils,
  maintenant: () => Date = () => new Date(),
) {
  async function avancement(utilisateurId: string): Promise<Avancement> {
    return (await depot.lire(utilisateurId)) ?? DEBUT;
  }

  async function lire(utilisateurId: string): Promise<Etat> {
    const [actuel, valide] = await Promise.all([
      avancement(utilisateurId),
      profils.existe(utilisateurId),
    ]);
    return { ...actuel, valide };
  }

  // Enregistre les réponses d'une étape déjà atteinte (on ne saute pas d'étape) ;
  // revenir sur une étape précédente ne fait pas reculer l'avancement. Après la
  // validation, les réponses ne changent plus ici (mise à jour : US-05d).
  async function enregistrerEtape(
    utilisateurId: string,
    etape: number,
    reponses: unknown,
  ): Promise<Avancement> {
    if (await profils.existe(utilisateurId)) {
      throw new HttpError(409, DEJA_VALIDE);
    }
    const actuel = await avancement(utilisateurId);
    if (
      !Number.isInteger(etape) ||
      etape < 1 ||
      etape > Math.min(actuel.etapeCourante, NOMBRE_ETAPES)
    ) {
      throw new HttpError(400, 'Étape du questionnaire invalide');
    }
    const valides =
      typeof reponses === 'object' && reponses !== null && !Array.isArray(reponses)
        ? reponsesValides(etape, reponses as Record<string, unknown>)
        : null;
    if (!valides) {
      throw new HttpError(400, 'Merci de répondre à toutes les questions de l’étape.');
    }
    const nouveau: Avancement = {
      etapeCourante: Math.max(actuel.etapeCourante, etape + 1),
      reponses: { ...actuel.reponses, [etape]: valides },
    };
    await depot.enregistrer(utilisateurId, nouveau, VERSION_QUESTIONNAIRE);
    return nouveau;
  }

  // « Réinitialiser » : efface en base les réponses d'une étape (1 à 5). L'étape redevient
  // la première non complétée (reprise à cette étape) ; les autres étapes sont conservées.
  async function reinitialiserEtape(utilisateurId: string, etape: number): Promise<Avancement> {
    if (await profils.existe(utilisateurId)) {
      throw new HttpError(409, DEJA_VALIDE);
    }
    if (!Number.isInteger(etape) || etape < 1 || etape > NOMBRE_ETAPES) {
      throw new HttpError(400, 'Étape du questionnaire invalide');
    }
    const existant = await depot.lire(utilisateurId);
    if (!existant) {
      return DEBUT;
    }
    const reponses = { ...existant.reponses };
    delete reponses[etape];
    const nouveau: Avancement = {
      etapeCourante: Math.min(existant.etapeCourante, etape),
      reponses,
    };
    await depot.enregistrer(utilisateurId, nouveau, VERSION_QUESTIONNAIRE);
    return nouveau;
  }

  // Profil calculé sur les réponses enregistrées, une fois les 5 étapes complétées
  async function calculer(utilisateurId: string) {
    const actuel = await avancement(utilisateurId);
    if (actuel.etapeCourante <= NOMBRE_ETAPES) {
      throw new HttpError(409, NON_TERMINE);
    }
    return { ...calculerProfil(actuel.reponses), reponses: actuel.reponses };
  }

  async function profil(utilisateurId: string): Promise<ProfilConsulte> {
    const [{ profil: nom, avertissements }, derniere] = await Promise.all([
      calculer(utilisateurId),
      profils.derniereValidation(utilisateurId),
    ]);
    return {
      profil: nom,
      avertissements,
      valideLe: derniere?.valideLe.toISOString() ?? null,
      aMettreAJour: aMettreAJour(derniere, maintenant()),
    };
  }

  // Certification obligatoire ; enregistre profil, score, réponses, avertissements,
  // date et heure (par la base) et version du questionnaire
  async function valider(utilisateurId: string, demande: unknown): Promise<ProfilAffiche> {
    if (!certifiee(demande)) {
      throw new HttpError(400, SANS_CERTIFICATION);
    }
    if (await profils.existe(utilisateurId)) {
      throw new HttpError(409, DEJA_VALIDE);
    }
    const calcule = await calculer(utilisateurId);
    await profils.enregistrer(utilisateurId, {
      ...calcule,
      versionQuestionnaire: VERSION_QUESTIONNAIRE,
    });
    return { profil: calcule.profil, avertissements: calcule.avertissements };
  }

  // US-05d : mise à jour d'un profil déjà validé. Les réponses en cours restent dans
  // l'écran (rien n'est enregistré avant la validation : un abandon ne laisse aucune
  // trace) ; le nouveau profil est calculé sur les 5 étapes envoyées d'un coup.
  async function reponsesDeMiseAJour(utilisateurId: string, demande: unknown) {
    if (!(await profils.existe(utilisateurId))) {
      throw new HttpError(409, PAS_ENCORE_VALIDE);
    }
    const reponses = toutesLesReponses(objet(demande) ? demande.reponses : undefined);
    if (!reponses) {
      throw new HttpError(400, REPONSES_INCOMPLETES);
    }
    return reponses;
  }

  // Nouveau profil calculé, sans rien enregistrer (écran de fin de la mise à jour)
  async function apercuMiseAJour(utilisateurId: string, demande: unknown): Promise<ProfilAffiche> {
    const { profil: nom, avertissements } = calculerProfil(
      await reponsesDeMiseAJour(utilisateurId, demande),
    );
    return { profil: nom, avertissements };
  }

  // Certification obligatoire ; le nouveau profil est ajouté (l'ancien reste archivé avec
  // ses réponses et sa date, jamais écrasé) et ses réponses deviennent celles du
  // questionnaire (pré-remplissage de la prochaine mise à jour)
  async function validerMiseAJour(utilisateurId: string, demande: unknown): Promise<ProfilAffiche> {
    if (!certifiee(demande)) {
      throw new HttpError(400, SANS_CERTIFICATION);
    }
    const reponses = await reponsesDeMiseAJour(utilisateurId, demande);
    const calcule = calculerProfil(reponses);
    await profils.enregistrer(utilisateurId, {
      ...calcule,
      reponses,
      versionQuestionnaire: VERSION_QUESTIONNAIRE,
    });
    await depot.enregistrer(
      utilisateurId,
      { etapeCourante: NOMBRE_ETAPES + 1, reponses },
      VERSION_QUESTIONNAIRE,
    );
    return { profil: calcule.profil, avertissements: calcule.avertissements };
  }

  return loggable('QuestionnaireService', {
    lire,
    enregistrerEtape,
    reinitialiserEtape,
    profil,
    valider,
    apercuMiseAJour,
    validerMiseAJour,
  });
}

export type QuestionnaireService = ReturnType<typeof creerQuestionnaireService>;
