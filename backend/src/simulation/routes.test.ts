import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { FournisseurIdentite } from '../auth/fournisseur.js';
import { captureLogs } from '../logging/capture.js';
import { routesSimulation } from './routes.js';
import type { SimulationService } from './service.js';

function application(lister: SimulationService['lister'], connecte = true) {
  const fournisseur: FournisseurIdentite = {
    creerCompte: vi.fn(),
    connecter: vi.fn(),
    identifiantDe: vi.fn(),
    utilisateurConnecte: vi
      .fn()
      .mockResolvedValue(connecte ? { id: 'u1', email: 'jean@exemple.fr' } : null),
  };
  const { log } = captureLogs();
  return createApp(vi.fn(), log, { routeurs: [routesSimulation({ lister }, fournisseur)] });
}

describe('routes de la simulation (US-08)', () => {
  it('GET /scpis/simulables : SCPI renvoyées par le service', async () => {
    const scpis = [{ id: 3, nom: 'Comète' }];
    const lister = vi.fn().mockResolvedValue(scpis);
    await request(application(lister))
      .get('/scpis/simulables')
      .set('Authorization', 'Bearer jeton')
      .expect(200, scpis);
    expect(lister).toHaveBeenCalledOnce();
  });

  it('sans connexion : 401, service non appelé', async () => {
    const lister = vi.fn();
    await request(application(lister, false)).get('/scpis/simulables').expect(401);
    expect(lister).not.toHaveBeenCalled();
  });
});
