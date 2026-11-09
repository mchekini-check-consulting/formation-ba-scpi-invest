import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { FournisseurIdentite } from '../auth/fournisseur.js';
import { captureLogs } from '../logging/capture.js';
import { HttpError } from '../logging/http-error.js';
import { routesKyc } from './routes.js';
import type { KycService } from './service.js';

const JEAN = { id: 'u1', email: 'jean@exemple.fr' };
const ETAT = { statut: 'en_cours', etape: 2, reponses: { nom: 'Martin' }, valideLe: null };

function application(service: Partial<KycService>, connecte = true) {
  const fournisseur: FournisseurIdentite = {
    creerCompte: vi.fn(),
    connecter: vi.fn(),
    identifiantDe: vi.fn(),
    utilisateurConnecte: vi.fn().mockResolvedValue(connecte ? JEAN : null),
  };
  const { log, lignes } = captureLogs();
  const app = createApp(vi.fn(), log, {
    routeurs: [routesKyc(service as KycService, fournisseur)],
  });
  return { app, lignes };
}

describe('routes du KYC', () => {
  it('GET /connaissance-client : KYC de l’utilisateur connecté', async () => {
    const lire = vi.fn().mockResolvedValue(ETAT);
    const { app } = application({ lire });
    const res = await request(app)
      .get('/connaissance-client')
      .set('Authorization', 'Bearer j')
      .expect(200);
    expect(res.body).toEqual(ETAT);
    expect(lire).toHaveBeenCalledWith('u1');
  });

  it('PUT /connaissance-client : enregistre l’étape, sans écrire les réponses dans les logs', async () => {
    const enregistrer = vi.fn().mockResolvedValue(ETAT);
    const { app, lignes } = application({ enregistrer });
    const demande = { etape: 2, reponses: { nom: 'Martin' } };
    const res = await request(app).put('/connaissance-client').send(demande).expect(200);
    expect(res.body).toEqual(ETAT);
    expect(enregistrer).toHaveBeenCalledWith('u1', demande);
    expect(lignes.at(-1)).toMatchObject({ layer: 'controller', method: 'enregistrerKyc' });
    expect(JSON.stringify(lignes)).not.toContain('Martin');
  });

  it('POST /connaissance-client/validation : KYC complété', async () => {
    const complete = {
      ...ETAT,
      statut: 'complete',
      etape: 5,
      valideLe: '2026-11-04T10:00:00.000Z',
    };
    const valider = vi.fn().mockResolvedValue(complete);
    const { app } = application({ valider });
    const res = await request(app).post('/connaissance-client/validation').expect(200);
    expect(res.body).toEqual(complete);
    expect(valider).toHaveBeenCalledWith('u1');
  });

  it('règle métier non respectée : statut et message de l’erreur', async () => {
    const valider = vi.fn().mockRejectedValue(new HttpError(409, 'Votre KYC est déjà validé'));
    const { app } = application({ valider });
    const res = await request(app).post('/connaissance-client/validation').expect(409);
    expect(res.body.message).toBe('Votre KYC est déjà validé');
  });

  it('ancienne adresse /kyc : 404', async () => {
    const lire = vi.fn();
    const { app } = application({ lire });
    await request(app).get('/kyc').set('Authorization', 'Bearer j').expect(404);
    expect(lire).not.toHaveBeenCalled();
  });

  it('sans connexion : 401 sur les trois routes', async () => {
    const service = { lire: vi.fn(), enregistrer: vi.fn(), valider: vi.fn() };
    const { app } = application(service, false);
    await request(app).get('/connaissance-client').expect(401);
    await request(app).put('/connaissance-client').send({ etape: 2 }).expect(401);
    await request(app).post('/connaissance-client/validation').expect(401);
    expect(service.lire).not.toHaveBeenCalled();
    expect(service.enregistrer).not.toHaveBeenCalled();
    expect(service.valider).not.toHaveBeenCalled();
  });
});
