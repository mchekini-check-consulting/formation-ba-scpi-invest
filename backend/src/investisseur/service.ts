import type { ReponsesQuestionnaire } from '../db/schema.js';
import { HttpError } from '../logging/http-error.js';
import { loggable } from '../logging/service.js';
import { NOMBRE_ETAPES, VERSION_QUESTIONNAIRE, reponsesValides } from './questionnaire.js';

// Avancement du questionnaire d'un utilisateur : etapeCourante = première étape non
// complétée (1 à 5), NOMBRE_ETAPES + 1 = toutes les étapes complétées
export type Avancement = { etapeCourante: number; reponses: ReponsesQuestionnaire };

export type DepotQuestionnaires = {
  lire(utilisateurId: string): Promise<Avancement | null>;
  enregistrer(utilisateurId: string, avancement: Avancement, version: string): Promise<void>;
};

const DEBUT: Avancement = { etapeCourante: 1, reponses: {} };

// Couche service de l'US-05a : reprise du questionnaire et enregistrement étape par étape
export function creerQuestionnaireService(depot: DepotQuestionnaires) {
  async function lire(utilisateurId: string): Promise<Avancement> {
    return (await depot.lire(utilisateurId)) ?? DEBUT;
  }

  // Enregistre les réponses d'une étape déjà atteinte (on ne saute pas d'étape) ;
  // revenir sur une étape précédente ne fait pas reculer l'avancement.
  async function enregistrerEtape(
    utilisateurId: string,
    etape: number,
    reponses: unknown,
  ): Promise<Avancement> {
    const actuel = await lire(utilisateurId);
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
    const avancement: Avancement = {
      etapeCourante: Math.max(actuel.etapeCourante, etape + 1),
      reponses: { ...actuel.reponses, [etape]: valides },
    };
    await depot.enregistrer(utilisateurId, avancement, VERSION_QUESTIONNAIRE);
    return avancement;
  }

  return loggable('QuestionnaireService', { lire, enregistrerEtape });
}

export type QuestionnaireService = ReturnType<typeof creerQuestionnaireService>;
