import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { FournisseurIdentite } from '../auth/fournisseur.js';
import { captureLogs } from '../logging/capture.js';
import { HttpError } from '../logging/http-error.js';
import { routesQuestionnaire } from './routes.js';
import type { QuestionnaireService } from './service.js';

const UTILISATEUR = { id: 'u1', email: 'jean@exemple.fr' };

function application(service: Partial<QuestionnaireService>, connecte = true) {
  const fournisseur: FournisseurIdentite = {
    creerCompte: vi.fn(),
    connecter: vi.fn(),
    utilisateurConnecte: vi.fn().mockResolvedValue(connecte ? UTILISATEUR : null),
  };
  const { log, lignes } = captureLogs();
  const app = createApp(vi.fn(), log, {
    routeurs: [routesQuestionnaire(service as QuestionnaireService, fournisseur)],
  });
  return { app, lignes };
}

describe('routes du questionnaire investisseur', () => {
  it('GET : avancement de l’utilisateur connecté', async () => {
    const avancement = { etapeCourante: 2, reponses: { 1: { revenus: '<30k' } } };
    const lire = vi.fn().mockResolvedValue(avancement);
    const { app, lignes } = application({ lire });

    const res = await request(app)
      .get('/questionnaire-investisseur')
      .set('Authorization', 'Bearer jeton')
      .expect(200);

    expect(res.body).toEqual(avancement);
    expect(lire).toHaveBeenCalledWith('u1');
    expect(lignes.at(-1)).toMatchObject({ layer: 'controller', method: 'lireQuestionnaire' });
  });

  it('PUT : enregistre l’étape de l’utilisateur connecté, sans réponse dans les logs', async () => {
    const enregistrerEtape = vi.fn().mockResolvedValue({ etapeCourante: 4, reponses: {} });
    const { app, lignes } = application({ enregistrerEtape });

    await request(app)
      .put('/questionnaire-investisseur/etapes/3')
      .set('Authorization', 'Bearer jeton')
      .send({ objectifs: ['retraite'] })
      .expect(200, { etapeCourante: 4, reponses: {} });

    expect(enregistrerEtape).toHaveBeenCalledWith('u1', 3, { objectifs: ['retraite'] });
    expect(JSON.stringify(lignes)).not.toContain('retraite');
  });

  it('PUT : réponses invalides -> 400 avec le message du service', async () => {
    const enregistrerEtape = vi
      .fn()
      .mockRejectedValue(
        new HttpError(400, 'Merci de répondre à toutes les questions de l’étape.'),
      );
    const { app } = application({ enregistrerEtape });
    const res = await request(app).put('/questionnaire-investisseur/etapes/1').expect(400);
    expect(res.body.message).toBe('Merci de répondre à toutes les questions de l’étape.');
    expect(enregistrerEtape).toHaveBeenCalledWith('u1', 1, {});
  });

  it('sans session : 401, le service n’est pas appelé', async () => {
    const lire = vi.fn();
    const { app } = application({ lire }, false);
    await request(app).get('/questionnaire-investisseur').expect(401);
    await request(app).put('/questionnaire-investisseur/etapes/1').expect(401);
    expect(lire).not.toHaveBeenCalled();
  });
});
