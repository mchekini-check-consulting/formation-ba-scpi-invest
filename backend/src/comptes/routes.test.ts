import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { FournisseurIdentite } from '../auth/fournisseur.js';
import { HttpError } from '../logging/http-error.js';
import { captureLogs } from '../logging/capture.js';
import { routesComptes } from './routes.js';
import type { CompteService } from './service.js';

function application(creer = vi.fn(), utilisateurConnecte = vi.fn(), connecter = vi.fn()) {
  const service = { creer, connecter } as CompteService;
  const fournisseur: FournisseurIdentite = {
    creerCompte: vi.fn(),
    connecter: vi.fn(),
    utilisateurConnecte,
  };
  const { log, lignes } = captureLogs();
  const app = createApp(vi.fn(), log, { routeurs: [routesComptes(service, fournisseur)] });
  return { app, lignes };
}

describe('routes des comptes', () => {
  it('POST /comptes : 201 avec l’utilisateur et le jeton de session', async () => {
    const compte = { utilisateur: { id: 'u1', email: 'jean@exemple.fr' }, jeton: 'jeton' };
    const creer = vi.fn().mockResolvedValue(compte);
    const { app, lignes } = application(creer);
    const demande = {
      email: 'jean@exemple.fr',
      motDePasse: 'x',
      confirmation: 'x',
      cguAcceptees: true,
    };

    const res = await request(app).post('/comptes').send(demande).expect(201);

    expect(res.body).toEqual(compte);
    expect(creer).toHaveBeenCalledWith(demande);
    expect(lignes.at(-1)).toMatchObject({
      layer: 'controller',
      method: 'creerCompte',
      status: 201,
    });
    // jamais le corps de la requête dans les logs
    expect(JSON.stringify(lignes)).not.toContain('jean@exemple.fr');
  });

  it('POST /comptes : règle métier non respectée -> statut et message de l’erreur', async () => {
    const creer = vi
      .fn()
      .mockRejectedValue(new HttpError(409, 'Un compte existe déjà avec cet email'));
    const res = await request(application(creer).app).post('/comptes').send({}).expect(409);
    expect(res.body).toEqual({ message: 'Un compte existe déjà avec cet email' });
  });

  it('POST /comptes sans corps JSON : demande vide transmise au service', async () => {
    const creer = vi.fn().mockRejectedValue(new HttpError(400, 'Format d’email invalide'));
    await request(application(creer).app).post('/comptes').expect(400);
    expect(creer).toHaveBeenCalledWith({});
  });

  it('POST /connexions : 200 avec l’utilisateur et le jeton de session', async () => {
    const compte = { utilisateur: { id: 'u1', email: 'jean@exemple.fr' }, jeton: 'jeton' };
    const connecter = vi.fn().mockResolvedValue(compte);
    const { app, lignes } = application(vi.fn(), vi.fn(), connecter);
    const demande = { email: 'jean@exemple.fr', motDePasse: 'x' };

    const res = await request(app).post('/connexions').send(demande).expect(200);

    expect(res.body).toEqual(compte);
    expect(connecter).toHaveBeenCalledWith(demande);
    expect(lignes.at(-1)).toMatchObject({ layer: 'controller', method: 'connecter', status: 200 });
    expect(JSON.stringify(lignes)).not.toContain('jean@exemple.fr');
  });

  it('POST /connexions : identifiants incorrects -> 401 et message unique', async () => {
    const connecter = vi
      .fn()
      .mockRejectedValue(new HttpError(401, 'Email ou mot de passe incorrect'));
    const { app } = application(vi.fn(), vi.fn(), connecter);
    const res = await request(app).post('/connexions').expect(401);
    expect(res.body).toEqual({ message: 'Email ou mot de passe incorrect' });
    expect(connecter).toHaveBeenCalledWith({});
  });

  it('GET /moi : utilisateur connecté', async () => {
    const utilisateur = { id: 'u1', email: 'jean@exemple.fr' };
    const { app } = application(vi.fn(), vi.fn().mockResolvedValue(utilisateur));
    const res = await request(app).get('/moi').set('Authorization', 'Bearer jeton').expect(200);
    expect(res.body).toEqual(utilisateur);
  });

  it('GET /moi : 401 sans session', async () => {
    const { app } = application(vi.fn(), vi.fn().mockResolvedValue(null));
    const res = await request(app).get('/moi').expect(401);
    expect(res.body).toEqual({ message: 'connexion requise' });
  });
});
