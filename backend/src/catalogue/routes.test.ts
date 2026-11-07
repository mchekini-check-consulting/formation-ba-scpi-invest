import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { FournisseurIdentite } from '../auth/fournisseur.js';
import { captureLogs } from '../logging/capture.js';
import { HttpError } from '../logging/http-error.js';
import { routesCatalogue } from './routes.js';
import type { CatalogueService } from './service.js';

function application(lister: CatalogueService['lister'], connecte = true) {
  const fournisseur: FournisseurIdentite = {
    creerCompte: vi.fn(),
    connecter: vi.fn(),
    utilisateurConnecte: vi
      .fn()
      .mockResolvedValue(connecte ? { id: 'u1', email: 'jean@exemple.fr' } : null),
  };
  const { log, lignes } = captureLogs();
  const app = createApp(vi.fn(), log, {
    routeurs: [routesCatalogue({ lister }, fournisseur)],
  });
  return { app, lignes };
}

const PAGE = {
  scpis: [],
  total: 0,
  page: 2,
  taillePage: 12,
  nombrePages: 1,
  anneeTaux: 2025,
  misAJourLe: null,
};

describe('routes du Catalogue (US-08)', () => {
  it('GET /scpis : page demandée transmise au service', async () => {
    const lister = vi.fn().mockResolvedValue(PAGE);
    const { app, lignes } = application(lister);
    await request(app).get('/scpis?page=2').set('Authorization', 'Bearer jeton').expect(200, PAGE);
    expect(lister).toHaveBeenCalledWith('2');
    expect(lignes.at(-1)).toMatchObject({ layer: 'controller', method: 'listerScpis' });
  });

  it('page invalide : 400 avec le message du service', async () => {
    const lister = vi.fn().mockRejectedValue(new HttpError(400, 'Numéro de page invalide'));
    const { app } = application(lister);
    const res = await request(app).get('/scpis?page=0').expect(400);
    expect(res.body.message).toBe('Numéro de page invalide');
  });

  it('sans session : 401, le service n’est pas appelé', async () => {
    const lister = vi.fn();
    const { app } = application(lister, false);
    await request(app).get('/scpis').expect(401);
    expect(lister).not.toHaveBeenCalled();
  });
});
