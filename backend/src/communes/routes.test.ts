import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { FournisseurIdentite } from '../auth/fournisseur.js';
import { captureLogs } from '../logging/capture.js';
import { routesCommunes } from './routes.js';
import type { CommunesService } from './service.js';

function application(communes = vi.fn(), connecte = true) {
  const fournisseur: FournisseurIdentite = {
    creerCompte: vi.fn(),
    connecter: vi.fn(),
    utilisateurConnecte: vi
      .fn()
      .mockResolvedValue(connecte ? { id: 'u1', email: 'jean@exemple.fr' } : null),
  };
  const { log } = captureLogs();
  const service = { communes, lister: vi.fn() } as CommunesService;
  return createApp(vi.fn(), log, { routeurs: [routesCommunes(service, fournisseur)] });
}

describe('routes des communes', () => {
  it('GET /communes : communes du code postal', async () => {
    const communes = vi.fn().mockResolvedValue(['Lyon']);
    const res = await request(application(communes))
      .get('/communes?pays=FR&codePostal=69003')
      .expect(200);
    expect(res.body).toEqual({ communes: ['Lyon'] });
    expect(communes).toHaveBeenCalledWith('FR', '69003');
  });

  it('sans connexion : 401, aucune recherche', async () => {
    const communes = vi.fn();
    await request(application(communes, false))
      .get('/communes?pays=FR&codePostal=69003')
      .expect(401);
    expect(communes).not.toHaveBeenCalled();
  });
});
