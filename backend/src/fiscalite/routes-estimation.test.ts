import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { FournisseurIdentite } from '../auth/fournisseur.js';
import { captureLogs } from '../logging/capture.js';
import type { EstimationService } from './estimation.js';
import { routesEstimationFiscale } from './routes-estimation.js';

function application(estimerRevenus: EstimationService['estimerRevenus'], connecte = true) {
  const fournisseur: FournisseurIdentite = {
    creerCompte: vi.fn(),
    connecter: vi.fn(),
    identifiantDe: vi.fn(),
    utilisateurConnecte: vi
      .fn()
      .mockResolvedValue(connecte ? { id: 'u1', email: 'jean@exemple.fr' } : null),
  };
  const { log } = captureLogs();
  return createApp(vi.fn(), log, {
    routeurs: [routesEstimationFiscale({ estimerRevenus }, fournisseur)],
  });
}

describe("routes de l'estimation fiscale (US-07, US-09)", () => {
  it('POST /estimation-fiscale : estimation du service pour le corps envoyé', async () => {
    const estimation = { impot: 472 };
    const estimerRevenus = vi.fn().mockResolvedValue(estimation);
    const corps = { lignes: [{ scpiId: 1, revenuAnnuel: 1000 }], taux: 30 };
    await request(application(estimerRevenus))
      .post('/estimation-fiscale')
      .set('Authorization', 'Bearer jeton')
      .send(corps)
      .expect(200, estimation);
    expect(estimerRevenus).toHaveBeenCalledWith('u1', corps);
  });

  it('sans connexion : 401, service non appelé', async () => {
    const estimerRevenus = vi.fn();
    await request(application(estimerRevenus, false)).post('/estimation-fiscale').expect(401);
    expect(estimerRevenus).not.toHaveBeenCalled();
  });
});
