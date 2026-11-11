import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { FournisseurIdentite } from '../auth/fournisseur.js';
import { PDF } from '../kyc/exemple.js';
import { captureLogs } from '../logging/capture.js';
import { HttpError } from '../logging/http-error.js';
import { routesInformations } from './routes.js';
import type { InformationsService } from './service.js';

const UTILISATEUR = { id: 'u1', email: 'claire.martin@exemple.fr' };
const INFORMATIONS = { email: UTILISATEUR.email, reponses: { ville: 'Paris' }, historique: [] };

function application(service: Partial<InformationsService>, connecte = true) {
  const fournisseur = {
    utilisateurConnecte: vi.fn().mockResolvedValue(connecte ? UTILISATEUR : null),
  } as unknown as FournisseurIdentite;
  const { log, lignes } = captureLogs();
  const app = createApp(vi.fn(), log, {
    routeurs: [routesInformations(service as InformationsService, fournisseur)],
  });
  return { app, lignes };
}

describe('routes des informations personnelles (US-06)', () => {
  it('GET : informations de l’utilisateur connecté', async () => {
    const lire = vi.fn().mockResolvedValue(INFORMATIONS);
    const { app } = application({ lire });
    await request(app)
      .get('/informations-personnelles')
      .set('Authorization', 'Bearer jeton')
      .expect(200, INFORMATIONS);
    expect(lire).toHaveBeenCalledWith('u1', UTILISATEUR.email);
  });

  it('POST justificatif : fichier brut transmis, 201, sans nom ni contenu dans les logs', async () => {
    const deposerJustificatif = vi.fn().mockResolvedValue({ id: 3, nomFichier: 'quittance.pdf' });
    const { app, lignes } = application({ deposerJustificatif });
    await request(app)
      .post('/informations-personnelles/justificatifs')
      .query({ nom: 'quittance.pdf' })
      .set('Authorization', 'Bearer jeton')
      .set('Content-Type', 'application/pdf')
      .send(PDF)
      .expect(201, { id: 3, nomFichier: 'quittance.pdf' });
    const [id, fichier] = deposerJustificatif.mock.calls[0];
    expect(id).toBe('u1');
    expect(fichier.nom).toBe('quittance.pdf');
    expect(Buffer.compare(fichier.contenu, PDF)).toBe(0);
    expect(JSON.stringify(lignes)).not.toContain('quittance');
  });

  it('POST justificatif : plus de 5 Mo -> 413 avec le message de l’US', async () => {
    const deposerJustificatif = vi.fn();
    const { app } = application({ deposerJustificatif });
    const res = await request(app)
      .post('/informations-personnelles/justificatifs')
      .set('Authorization', 'Bearer jeton')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.alloc(10 * 1024 * 1024 + 10))
      .expect(413);
    expect(res.body.message).toBe(
      'Format non accepté ou fichier trop volumineux (PDF, JPG ou PNG, 10 Mo maximum)',
    );
    expect(deposerJustificatif).not.toHaveBeenCalled();
  });

  it.each([
    ['adresse', 'modifierAdresse'],
    ['situation', 'modifierSituation'],
    ['coordonnees', 'modifierCoordonnees'],
    ['identite', 'modifierIdentite'],
  ] as const)(
    'PUT %s : demande transmise, informations à jour renvoyées',
    async (bloc, methode) => {
      const action = vi.fn().mockResolvedValue(INFORMATIONS);
      const { app, lignes } = application({ [methode]: action });
      await request(app)
        .put(`/informations-personnelles/${bloc}`)
        .set('Authorization', 'Bearer jeton')
        .send({ ville: 'Paris', motDePasse: 'secret' })
        .expect(200, INFORMATIONS);
      expect(action).toHaveBeenCalledWith('u1', UTILISATEUR.email, {
        ville: 'Paris',
        motDePasse: 'secret',
      });
      expect(lignes.at(-1)).toMatchObject({ layer: 'controller', method: methode });
      expect(JSON.stringify(lignes)).not.toContain('secret');
    },
  );

  it('PUT sans corps : demande vide ; erreur du service transmise', async () => {
    const modifierCoordonnees = vi
      .fn()
      .mockRejectedValue(new HttpError(403, 'Mot de passe incorrect.'));
    const { app } = application({ modifierCoordonnees });
    const res = await request(app)
      .put('/informations-personnelles/coordonnees')
      .set('Authorization', 'Bearer jeton')
      .expect(403);
    expect(res.body.message).toBe('Mot de passe incorrect.');
    expect(modifierCoordonnees).toHaveBeenCalledWith('u1', UTILISATEUR.email, {});
  });

  it('sans session : 401, le service n’est pas appelé', async () => {
    const lire = vi.fn();
    const { app } = application({ lire }, false);
    await request(app).get('/informations-personnelles').expect(401);
    await request(app).post('/informations-personnelles/justificatifs').expect(401);
    await request(app).put('/informations-personnelles/adresse').expect(401);
    expect(lire).not.toHaveBeenCalled();
  });
});
