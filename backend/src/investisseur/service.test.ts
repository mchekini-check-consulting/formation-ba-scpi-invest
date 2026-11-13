import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../logging/http-error.js';
import { REPONSES_EXEMPLE as REPONSES } from './reponses-exemple.js';
import { VERSION_QUESTIONNAIRE } from './questionnaire.js';
import {
  type Avancement,
  type DerniereValidation,
  aMettreAJour,
  creerQuestionnaireService,
  prochaineMiseAJour,
} from './service.js';

// Horloge des tests : 10 novembre 2026
const MAINTENANT = new Date('2026-11-10T10:00:00.000Z');

function preparer(
  existant: Avancement | null = null,
  valide = false,
  derniereValidation: DerniereValidation | null = null,
) {
  const depot = {
    lire: vi.fn().mockResolvedValue(existant),
    enregistrer: vi.fn().mockResolvedValue(undefined),
  };
  const profils = {
    existe: vi.fn().mockResolvedValue(valide),
    derniereValidation: vi.fn().mockResolvedValue(derniereValidation),
    enregistrer: vi.fn().mockResolvedValue(undefined),
  };
  return {
    service: creerQuestionnaireService(depot, profils, () => MAINTENANT),
    depot,
    profils,
  };
}

// Questionnaire aux 5 étapes complétées (réponses d’exemple : score 4, Équilibré)
const TERMINE = { etapeCourante: 6, reponses: REPONSES };

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
    expect(await preparer().service.lire('u1')).toEqual({
      etapeCourante: 1,
      reponses: {},
      valide: false,
    });
  });

  it('lire : reprise à la première étape non complétée, réponses conservées', async () => {
    const existant = { etapeCourante: 3, reponses: { 1: REPONSES[1], 2: REPONSES[2] } };
    expect(await preparer(existant).service.lire('u1')).toEqual({ ...existant, valide: false });
  });

  it('enregistrerEtape : réponses enregistrées, étape suivante débloquée', async () => {
    const { service, depot } = preparer();
    const avancement = await service.enregistrerEtape('u1', 1, REPONSES[1]);
    expect(avancement).toEqual({ etapeCourante: 2, reponses: { 1: REPONSES[1] } });
    expect(depot.enregistrer).toHaveBeenCalledWith('u1', avancement, VERSION_QUESTIONNAIRE);
  });

  it('reinitialiserEtape : efface en base l’étape seule, reprise à cette étape', async () => {
    const existant = { etapeCourante: 4, reponses: { 1: REPONSES[1], 2: REPONSES[2] } };
    const { service, depot } = preparer(existant);
    const avancement = await service.reinitialiserEtape('u1', 2);
    expect(avancement).toEqual({ etapeCourante: 2, reponses: { 1: REPONSES[1] } });
    expect(depot.enregistrer).toHaveBeenCalledWith('u1', avancement, VERSION_QUESTIONNAIRE);
  });

  it('reinitialiserEtape : étape pas encore atteinte -> avancement inchangé', async () => {
    const existant = { etapeCourante: 2, reponses: { 1: REPONSES[1] } };
    expect(await preparer(existant).service.reinitialiserEtape('u1', 4)).toEqual(existant);
  });

  it('reinitialiserEtape : questionnaire jamais commencé -> rien à effacer', async () => {
    const { service, depot } = preparer();
    expect(await service.reinitialiserEtape('u1', 1)).toEqual({ etapeCourante: 1, reponses: {} });
    expect(depot.enregistrer).not.toHaveBeenCalled();
  });

  it.each([0, 6, Number.NaN])('reinitialiserEtape : étape %s invalide -> 400', async (etape) => {
    const { service, depot } = preparer({ etapeCourante: 3, reponses: {} });
    expect((await erreurDe(service.reinitialiserEtape('u1', etape))).status).toBe(400);
    expect(depot.enregistrer).not.toHaveBeenCalled();
  });

  it('reinitialiserEtape : profil déjà validé -> 409, rien effacé', async () => {
    const { service, depot } = preparer(TERMINE, true);
    expect((await erreurDe(service.reinitialiserEtape('u1', 1))).status).toBe(409);
    expect(depot.enregistrer).not.toHaveBeenCalled();
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

describe('QuestionnaireService (US-05b)', () => {
  it('lire : profil déjà validé signalé (formulaire terminé)', async () => {
    expect((await preparer(TERMINE, true).service.lire('u1')).valide).toBe(true);
  });

  it('profil : affiché sans le score, avec les avertissements, pas encore validé', async () => {
    expect(await preparer(TERMINE).service.profil('u1')).toEqual({
      profil: 'equilibre',
      avertissements: [],
      valideLe: null,
      aMettreAJour: false,
      miseAJourPossibleLe: null,
    });
  });

  it('profil : date de la dernière validation (page Profil), profil récent', async () => {
    const derniere = {
      valideLe: new Date('2026-11-04T09:30:00.000Z'),
      versionQuestionnaire: VERSION_QUESTIONNAIRE,
    };
    const { service, profils } = preparer(TERMINE, true, derniere);
    expect(await service.profil('u1')).toMatchObject({
      valideLe: '2026-11-04T09:30:00.000Z',
      aMettreAJour: false,
    });
    expect(profils.derniereValidation).toHaveBeenCalledWith('u1');
  });

  it('profil : questionnaire pas terminé -> 409', async () => {
    const err = await erreurDe(preparer({ etapeCourante: 5, reponses: {} }).service.profil('u1'));
    expect([err.status, err.message]).toEqual([
      409,
      'Merci de répondre aux 5 étapes du questionnaire.',
    ]);
    expect((await erreurDe(preparer().service.profil('u1'))).status).toBe(409);
  });

  it('valider : enregistre profil, score, réponses, avertissements et version', async () => {
    const { service, profils } = preparer(TERMINE);
    expect(await service.valider('u1', { certification: true })).toEqual({
      profil: 'equilibre',
      avertissements: [],
    });
    expect(profils.enregistrer).toHaveBeenCalledWith('u1', {
      profil: 'equilibre',
      score: 4,
      reponses: REPONSES,
      avertissements: [],
      versionQuestionnaire: VERSION_QUESTIONNAIRE,
    });
  });

  it('valider : certification absente ou non cochée -> 400, rien enregistré', async () => {
    const { service, profils } = preparer(TERMINE);
    for (const demande of [{}, { certification: 'oui' }, { certification: false }, null]) {
      const err = await erreurDe(service.valider('u1', demande));
      expect([err.status, err.message]).toEqual([
        400,
        'Merci de certifier l’exactitude de vos réponses.',
      ]);
    }
    expect(profils.enregistrer).not.toHaveBeenCalled();
  });

  it('valider : questionnaire pas terminé ou profil déjà validé -> 409', async () => {
    const enCours = preparer({ etapeCourante: 3, reponses: {} });
    expect((await erreurDe(enCours.service.valider('u1', { certification: true }))).status).toBe(
      409,
    );
    const valide = preparer(TERMINE, true);
    const err = await erreurDe(valide.service.valider('u1', { certification: true }));
    expect([err.status, err.message]).toEqual([409, 'Votre profil investisseur est déjà validé.']);
    expect(valide.profils.enregistrer).not.toHaveBeenCalled();
  });

  it('enregistrerEtape : après validation, les réponses ne changent plus (409)', async () => {
    const { service, depot } = preparer(TERMINE, true);
    expect((await erreurDe(service.enregistrerEtape('u1', 1, REPONSES[1]))).status).toBe(409);
    expect(depot.enregistrer).not.toHaveBeenCalled();
  });
});

describe('QuestionnaireService (US-05d)', () => {
  const valide = (valideLe: string, versionQuestionnaire = VERSION_QUESTIONNAIRE) => ({
    valideLe: new Date(valideLe),
    versionQuestionnaire,
  });

  it('aMettreAJour : 24 mois ou plus, ou questionnaire modifié (scénarios 5 à 7)', () => {
    expect(aMettreAJour(null, MAINTENANT)).toBe(false);
    expect(aMettreAJour(valide('2024-11-11T10:00:00.000Z'), MAINTENANT)).toBe(false);
    expect(aMettreAJour(valide('2024-11-10T10:00:00.000Z'), MAINTENANT)).toBe(true);
    expect(aMettreAJour(valide('2023-01-01T00:00:00.000Z'), MAINTENANT)).toBe(true);
    expect(aMettreAJour(valide('2026-11-01T00:00:00.000Z', '0.9'), MAINTENANT)).toBe(true);
  });

  it('profil : rappel signalé pour un profil de plus de 24 mois', async () => {
    const { service } = preparer(TERMINE, true, valide('2024-10-01T08:00:00.000Z'));
    expect((await service.profil('u1')).aMettreAJour).toBe(true);
  });

  it('apercuMiseAJour : nouveau profil calculé, rien enregistré', async () => {
    const { service, depot, profils } = preparer(TERMINE, true);
    const reponses = { ...REPONSES, 4: { ...REPONSES[4], horizon: '<3' } };
    expect(await service.apercuMiseAJour('u1', { reponses })).toEqual({
      profil: 'prudent',
      avertissements: ['horizon'],
    });
    expect(depot.enregistrer).not.toHaveBeenCalled();
    expect(profils.enregistrer).not.toHaveBeenCalled();
  });

  it('apercuMiseAJour : réponses manquantes ou invalides -> 400', async () => {
    const { service } = preparer(TERMINE, true);
    const incompletes = { 1: REPONSES[1], 2: REPONSES[2] };
    const invalides = { ...REPONSES, 3: { objectifs: [] } };
    for (const demande of [
      {},
      null,
      { reponses: [] },
      { reponses: incompletes },
      { reponses: invalides },
    ]) {
      const err = await erreurDe(service.apercuMiseAJour('u1', demande));
      expect([err.status, err.message]).toEqual([
        400,
        'Merci de répondre à toutes les questions des 5 étapes.',
      ]);
    }
  });

  it('apercuMiseAJour : aucun profil validé -> 409', async () => {
    const err = await erreurDe(
      preparer(TERMINE).service.apercuMiseAJour('u1', { reponses: REPONSES }),
    );
    expect([err.status, err.message]).toEqual([
      409,
      'Votre profil investisseur n’est pas encore validé.',
    ]);
  });

  it('validerMiseAJour : nouveau profil ajouté (ancien gardé), réponses du questionnaire mises à jour', async () => {
    const { service, depot, profils } = preparer(TERMINE, true);
    const reponses = { ...REPONSES, 4: { ...REPONSES[4], horizon: '<3' } };
    expect(await service.validerMiseAJour('u1', { reponses, certification: true })).toEqual({
      profil: 'prudent',
      avertissements: ['horizon'],
    });
    expect(profils.enregistrer).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        profil: 'prudent',
        reponses,
        avertissements: ['horizon'],
        versionQuestionnaire: VERSION_QUESTIONNAIRE,
      }),
    );
    expect(depot.enregistrer).toHaveBeenCalledWith(
      'u1',
      { etapeCourante: 6, reponses },
      VERSION_QUESTIONNAIRE,
    );
  });

  it('validerMiseAJour : sans certification -> 400, rien enregistré', async () => {
    const { service, depot, profils } = preparer(TERMINE, true);
    const err = await erreurDe(service.validerMiseAJour('u1', { reponses: REPONSES }));
    expect([err.status, err.message]).toEqual([
      400,
      'Merci de certifier l’exactitude de vos réponses.',
    ]);
    expect(profils.enregistrer).not.toHaveBeenCalled();
    expect(depot.enregistrer).not.toHaveBeenCalled();
  });

  it('validerMiseAJour : aucun profil validé -> 409, rien enregistré', async () => {
    const { service, profils } = preparer(TERMINE);
    const demande = { reponses: REPONSES, certification: true };
    expect((await erreurDe(service.validerMiseAJour('u1', demande))).status).toBe(409);
    expect(profils.enregistrer).not.toHaveBeenCalled();
  });
});

describe('QuestionnaireService : une mise à jour au plus par 24 heures', () => {
  const validation = (valideLe: string) => ({
    valideLe: new Date(valideLe),
    versionQuestionnaire: VERSION_QUESTIONNAIRE,
  });

  it('prochaineMiseAJour : 24 heures après la dernière validation ; null sinon', () => {
    expect(prochaineMiseAJour(null, MAINTENANT)).toBeNull();
    expect(prochaineMiseAJour(validation('2026-11-10T09:00:00.000Z'), MAINTENANT)).toEqual(
      new Date('2026-11-11T09:00:00.000Z'),
    );
    expect(prochaineMiseAJour(validation('2026-11-09T10:00:00.000Z'), MAINTENANT)).toBeNull();
    expect(prochaineMiseAJour(validation('2026-11-01T00:00:00.000Z'), MAINTENANT)).toBeNull();
  });

  it('profil : date de la prochaine mise à jour possible', async () => {
    const { service } = preparer(TERMINE, true, validation('2026-11-10T09:00:00.000Z'));
    expect((await service.profil('u1')).miseAJourPossibleLe).toBe('2026-11-11T09:00:00.000Z');
  });

  it('validerMiseAJour : moins de 24 heures après la dernière validation -> 409, rien enregistré', async () => {
    const { service, depot, profils } = preparer(
      TERMINE,
      true,
      validation('2026-11-10T09:00:00.000Z'),
    );
    const err = await erreurDe(
      service.validerMiseAJour('u1', { reponses: REPONSES, certification: true }),
    );
    expect([err.status, err.message]).toEqual([
      409,
      'Votre profil a été validé il y a moins de 24 heures. Réessayez plus tard.',
    ]);
    expect(profils.enregistrer).not.toHaveBeenCalled();
    expect(depot.enregistrer).not.toHaveBeenCalled();
  });

  it('validerMiseAJour : 24 heures ou plus après -> accepté', async () => {
    const { service, profils } = preparer(TERMINE, true, validation('2026-11-09T10:00:00.000Z'));
    await service.validerMiseAJour('u1', { reponses: REPONSES, certification: true });
    expect(profils.enregistrer).toHaveBeenCalled();
  });
});
