import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { captureLogs } from '../logging/capture.js';
import { requestLogger } from '../logging/controller.js';
import { exigerConnexion, type FournisseurIdentite } from './fournisseur.js';

function appTest(utilisateur: { id: string; email: string } | null) {
  const fournisseur: FournisseurIdentite = {
    creerCompte: vi.fn(),
    connecter: vi.fn(),
    utilisateurConnecte: vi.fn().mockResolvedValue(utilisateur),
    identifiantDe: vi.fn(),
    verifierMotDePasse: vi.fn(),
    changerEmail: vi.fn(),
  };
  const { log, lignes } = captureLogs();
  const app = express();
  app.use(requestLogger(log));
  app.get('/comptes/moi', exigerConnexion(fournisseur), (_req, res) => {
    res.json(res.locals.utilisateur);
  });
  return { app, lignes };
}

describe('exigerConnexion', () => {
  it('connecté : utilisateur dans res.locals, son identifiant et son email dans les logs', async () => {
    const { app, lignes } = appTest({ id: 'u1', email: 'jean@exemple.fr' });
    const res = await request(app).get('/comptes/moi').expect(200);
    expect(res.body).toEqual({ id: 'u1', email: 'jean@exemple.fr' });
    expect(lignes[0]).toMatchObject({
      msg: 'Lecture du compte connecté — jean@exemple.fr',
      userId: 'u1',
      email: 'jean@exemple.fr',
    });
  });

  it('non connecté : 401, sans identifiant', async () => {
    const { app, lignes } = appTest(null);
    await request(app).get('/comptes/moi').expect(401);
    expect(lignes[0]).toMatchObject({
      msg: 'Lecture du compte connecté : accès refusé, session absente ou expirée',
    });
    expect(lignes[0]).not.toHaveProperty('userId');
  });
});
