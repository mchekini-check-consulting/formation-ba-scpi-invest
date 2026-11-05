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
  enregistrer(utilisateurId: string, profil: ProfilValide): Promise<void>;
};

const DEBUT: Avancement = { etapeCourante: 1, reponses: {} };

const DEJA_VALIDE = 'Votre profil investisseur est déjà validé.';
const NON_TERMINE = 'Merci de répondre aux 5 étapes du questionnaire.';
const SANS_CERTIFICATION = 'Merci de certifier l’exactitude de vos réponses.';

// Couche service du formulaire investisseur : reprise et enregistrement étape par étape
// (US-05a), calcul du profil, certification et validation (US-05b)
export function creerQuestionnaireService(depot: DepotQuestionnaires, profils: DepotProfils) {
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

  async function profil(utilisateurId: string): Promise<ProfilAffiche> {
    const { profil: nom, avertissements } = await calculer(utilisateurId);
    return { profil: nom, avertissements };
  }

  // Certification obligatoire ; enregistre profil, score, réponses, avertissements,
  // date et heure (par la base) et version du questionnaire
  async function valider(utilisateurId: string, demande: unknown): Promise<ProfilAffiche> {
    const certifie =
      typeof demande === 'object' &&
      demande !== null &&
      (demande as { certification?: unknown }).certification === true;
    if (!certifie) {
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

  return loggable('QuestionnaireService', {
    lire,
    enregistrerEtape,
    reinitialiserEtape,
    profil,
    valider,
  });
}

export type QuestionnaireService = ReturnType<typeof creerQuestionnaireService>;
