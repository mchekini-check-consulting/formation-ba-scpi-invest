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
    identifiantDe: vi.fn(),
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
      .get('/formulaire-investisseur')
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
      .put('/formulaire-investisseur/etapes/3')
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
    const res = await request(app).put('/formulaire-investisseur/etapes/1').expect(400);
    expect(res.body.message).toBe('Merci de répondre à toutes les questions de l’étape.');
    expect(enregistrerEtape).toHaveBeenCalledWith('u1', 1, {});
  });

  it('DELETE : « Réinitialiser » efface l’étape de l’utilisateur connecté', async () => {
    const reinitialiserEtape = vi.fn().mockResolvedValue({ etapeCourante: 2, reponses: {} });
    const { app, lignes } = application({ reinitialiserEtape });

    await request(app)
      .delete('/formulaire-investisseur/etapes/2')
      .set('Authorization', 'Bearer jeton')
      .expect(200, { etapeCourante: 2, reponses: {} });

    expect(reinitialiserEtape).toHaveBeenCalledWith('u1', 2);
    expect(lignes.at(-1)).toMatchObject({ layer: 'controller', method: 'reinitialiserEtape' });
  });

  it('DELETE sans session : 401', async () => {
    const reinitialiserEtape = vi.fn();
    const { app } = application({ reinitialiserEtape }, false);
    await request(app).delete('/formulaire-investisseur/etapes/1').expect(401);
    expect(reinitialiserEtape).not.toHaveBeenCalled();
  });

  it('GET profil : profil calculé de l’utilisateur connecté (US-05b)', async () => {
    const profil = vi.fn().mockResolvedValue({ profil: 'prudent', avertissements: ['horizon'] });
    const { app } = application({ profil });
    await request(app)
      .get('/formulaire-investisseur/profil')
      .set('Authorization', 'Bearer jeton')
      .expect(200, { profil: 'prudent', avertissements: ['horizon'] });
    expect(profil).toHaveBeenCalledWith('u1');
  });

  it('POST validation : 201 avec le profil validé (US-05b)', async () => {
    const valider = vi.fn().mockResolvedValue({ profil: 'dynamique', avertissements: [] });
    const { app, lignes } = application({ valider });
    await request(app)
      .post('/formulaire-investisseur/validation')
      .set('Authorization', 'Bearer jeton')
      .send({ certification: true })
      .expect(201, { profil: 'dynamique', avertissements: [] });
    expect(valider).toHaveBeenCalledWith('u1', { certification: true });
    expect(lignes.at(-1)).toMatchObject({ layer: 'controller', method: 'validerProfil' });
  });

  it('POST validation sans corps : demande vide transmise au service', async () => {
    const valider = vi
      .fn()
      .mockRejectedValue(new HttpError(400, 'Merci de certifier l’exactitude de vos réponses.'));
    const { app } = application({ valider });
    await request(app)
      .post('/formulaire-investisseur/validation')
      .set('Authorization', 'Bearer jeton')
      .expect(400);
    expect(valider).toHaveBeenCalledWith('u1', {});
  });

  it('POST mise-a-jour/apercu : nouveau profil, sans réponse dans les logs (US-05d)', async () => {
    const apercuMiseAJour = vi.fn().mockResolvedValue({ profil: 'prudent', avertissements: [] });
    const { app, lignes } = application({ apercuMiseAJour });
    const reponses = { 3: { objectifs: ['retraite'] } };
    await request(app)
      .post('/formulaire-investisseur/mise-a-jour/apercu')
      .set('Authorization', 'Bearer jeton')
      .send({ reponses })
      .expect(200, { profil: 'prudent', avertissements: [] });
    expect(apercuMiseAJour).toHaveBeenCalledWith('u1', { reponses });
    expect(JSON.stringify(lignes)).not.toContain('retraite');
  });

  it('POST mise-a-jour/validation : 201, demande vide transmise sans corps (US-05d)', async () => {
    const validerMiseAJour = vi.fn().mockResolvedValue({ profil: 'dynamique', avertissements: [] });
    const { app } = application({ validerMiseAJour });
    await request(app)
      .post('/formulaire-investisseur/mise-a-jour/validation')
      .set('Authorization', 'Bearer jeton')
      .send({ reponses: {}, certification: true })
      .expect(201, { profil: 'dynamique', avertissements: [] });
    expect(validerMiseAJour).toHaveBeenCalledWith('u1', { reponses: {}, certification: true });
    await request(app)
      .post('/formulaire-investisseur/mise-a-jour/validation')
      .set('Authorization', 'Bearer jeton')
      .expect(201);
    expect(validerMiseAJour).toHaveBeenLastCalledWith('u1', {});
  });

  it('POST mise-a-jour sans corps : demande vide transmise au service', async () => {
    const apercuMiseAJour = vi.fn().mockResolvedValue({ profil: 'prudent', avertissements: [] });
    const { app } = application({ apercuMiseAJour });
    await request(app)
      .post('/formulaire-investisseur/mise-a-jour/apercu')
      .set('Authorization', 'Bearer jeton')
      .expect(200);
    expect(apercuMiseAJour).toHaveBeenCalledWith('u1', {});
  });

  it('anciennes adresses (/questionnaire-investisseur, /questionnaire) : 404', async () => {
    const lire = vi.fn();
    const { app } = application({ lire });
    await request(app).get('/questionnaire-investisseur').expect(404);
    await request(app).get('/questionnaire').expect(404);
    expect(lire).not.toHaveBeenCalled();
  });

  it('sans session : 401, le service n’est pas appelé', async () => {
    const lire = vi.fn();
    const { app } = application({ lire }, false);
    await request(app).get('/formulaire-investisseur').expect(401);
    await request(app).put('/formulaire-investisseur/etapes/1').expect(401);
    await request(app).get('/formulaire-investisseur/profil').expect(401);
    await request(app).post('/formulaire-investisseur/validation').expect(401);
    await request(app).post('/formulaire-investisseur/mise-a-jour/apercu').expect(401);
    await request(app).post('/formulaire-investisseur/mise-a-jour/validation').expect(401);
    expect(lire).not.toHaveBeenCalled();
  });
});
