import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../logging/http-error.js';
import { REPONSES_EXEMPLE as REPONSES } from './reponses-exemple.js';
import { VERSION_QUESTIONNAIRE } from './questionnaire.js';
import { type Avancement, creerQuestionnaireService } from './service.js';

function preparer(existant: Avancement | null = null) {
  const depot = {
    lire: vi.fn().mockResolvedValue(existant),
    enregistrer: vi.fn().mockResolvedValue(undefined),
  };
  return { service: creerQuestionnaireService(depot), depot };
}

async function erreurDe(promesse: Promise<unknown>): Promise<HttpError> {
  const err = await promesse.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(HttpError);
  return err as HttpError;
}

describe('QuestionnaireService (US-05a)', () => {
  it('lire : questionnaire jamais commencé -> étape 1, aucune réponse', async () => {
    expect(await preparer().service.lire('u1')).toEqual({ etapeCourante: 1, reponses: {} });
  });

  it('lire : reprise à la première étape non complétée, réponses conservées', async () => {
    const existant = { etapeCourante: 3, reponses: { 1: REPONSES[1], 2: REPONSES[2] } };
    expect(await preparer(existant).service.lire('u1')).toEqual(existant);
  });

  it('enregistrerEtape : réponses enregistrées, étape suivante débloquée', async () => {
    const { service, depot } = preparer();
    const avancement = await service.enregistrerEtape('u1', 1, REPONSES[1]);
    expect(avancement).toEqual({ etapeCourante: 2, reponses: { 1: REPONSES[1] } });
    expect(depot.enregistrer).toHaveBeenCalledWith('u1', avancement, VERSION_QUESTIONNAIRE);
  });

  it('enregistrerEtape : revenir sur une étape précédente ne fait pas reculer', async () => {
    const existant = { etapeCourante: 4, reponses: { 1: REPONSES[1] } };
    const { service } = preparer(existant);
    const nouvelles = { ...REPONSES[1], epargne: 500 };
    expect(await service.enregistrerEtape('u1', 1, nouvelles)).toEqual({
      etapeCourante: 4,
      reponses: { 1: nouvelles },
    });
  });

  it('enregistrerEtape : dernière étape -> questionnaire complété (6)', async () => {
    const { service } = preparer({ etapeCourante: 5, reponses: {} });
    expect((await service.enregistrerEtape('u1', 5, REPONSES[5])).etapeCourante).toBe(6);
  });

  it('enregistrerEtape : étape pas encore atteinte ou inexistante -> 400', async () => {
    const { service, depot } = preparer();
    for (const etape of [2, 0, 6, Number.NaN]) {
      expect((await erreurDe(service.enregistrerEtape('u1', etape, REPONSES[2]))).status).toBe(400);
    }
    expect(depot.enregistrer).not.toHaveBeenCalled();
  });

  it('enregistrerEtape : réponses incomplètes ou mal formées -> 400, rien enregistré', async () => {
    const { service, depot } = preparer();
    for (const reponses of [{}, null, [], 'texte']) {
      const err = await erreurDe(service.enregistrerEtape('u1', 1, reponses));
      expect([err.status, err.message]).toEqual([
        400,
        'Merci de répondre à toutes les questions de l’étape.',
      ]);
    }
    expect(depot.enregistrer).not.toHaveBeenCalled();
  });
});
