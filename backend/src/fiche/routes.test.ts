import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { FournisseurIdentite } from '../auth/fournisseur.js';
import { captureLogs } from '../logging/capture.js';
import { HttpError } from '../logging/http-error.js';
import { routesFiche } from './routes.js';
import type { FicheService } from './service.js';

function application(lire: FicheService['lire'], connecte = true) {
  const fournisseur: FournisseurIdentite = {
    creerCompte: vi.fn(),
    connecter: vi.fn(),
    identifiantDe: vi.fn(),
    utilisateurConnecte: vi
      .fn()
      .mockResolvedValue(connecte ? { id: 'u1', email: 'jean@exemple.fr' } : null),
  };
  const { log } = captureLogs();
  return createApp(vi.fn(), log, { routeurs: [routesFiche({ lire }, fournisseur)] });
}

describe('routes de la fiche SCPI (US-02)', () => {
  it('GET /scpis/:id : fiche renvoyée par le service', async () => {
    const fiche = { id: 12, nom: 'Pierval Santé' };
    const lire = vi.fn().mockResolvedValue(fiche);
    await request(application(lire))
      .get('/scpis/12')
      .set('Authorization', 'Bearer jeton')
      .expect(200, fiche);
    expect(lire).toHaveBeenCalledWith('12');
  });

  it('SCPI absente : 404 avec son statut et le message', async () => {
    const lire = vi
      .fn()
      .mockRejectedValue(
        new HttpError(404, 'Cette SCPI n’est plus disponible', { statut: 'supprimee' }),
      );
    await request(application(lire))
      .get('/scpis/40')
      .set('Authorization', 'Bearer jeton')
      .expect(404, { statut: 'supprimee', message: 'Cette SCPI n’est plus disponible' });
  });

  it('sans connexion : 401, service non appelé', async () => {
    const lire = vi.fn();
    await request(application(lire, false)).get('/scpis/12').expect(401);
    expect(lire).not.toHaveBeenCalled();
  });
});
