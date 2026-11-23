import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { FournisseurIdentite } from '../auth/fournisseur.js';
import { captureLogs } from '../logging/capture.js';
import { routesComparaison } from './routes.js';
import type { ComparaisonService } from './service.js';

function application(lister: ComparaisonService['lister'], connecte = true) {
  const fournisseur: FournisseurIdentite = {
    creerCompte: vi.fn(),
    connecter: vi.fn(),
    identifiantDe: vi.fn(),
    utilisateurConnecte: vi
      .fn()
      .mockResolvedValue(connecte ? { id: 'u1', email: 'jean@exemple.fr' } : null),
  };
  const { log } = captureLogs();
  return createApp(vi.fn(), log, { routeurs: [routesComparaison({ lister }, fournisseur)] });
}

describe('routes du comparateur (US-04)', () => {
  it('GET /scpis/comparables : SCPI renvoyées par le service', async () => {
    const scpis = [{ id: 3, nom: 'Comète' }];
    const lister = vi.fn().mockResolvedValue(scpis);
    await request(application(lister))
      .get('/scpis/comparables')
      .set('Authorization', 'Bearer jeton')
      .expect(200, scpis);
    expect(lister).toHaveBeenCalledOnce();
  });

  it('sans connexion : 401, service non appelé', async () => {
    const lister = vi.fn();
    await request(application(lister, false)).get('/scpis/comparables').expect(401);
    expect(lister).not.toHaveBeenCalled();
  });
});
