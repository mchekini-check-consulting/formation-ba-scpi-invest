import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { FournisseurIdentite } from '../auth/fournisseur.js';
import { captureLogs } from '../logging/capture.js';
import { HttpError } from '../logging/http-error.js';
import { routesFiscalite } from './routes.js';
import type { FiscaliteService } from './service.js';

const UTILISATEUR = { id: 'u1', email: 'jean@exemple.fr' };
const INFORMATIONS = { revenuNetImposable: 40123, situationFamiliale: 'seul', nombreEnfants: 0 };

function application(service: Partial<FiscaliteService>, connecte = true) {
  const fournisseur: FournisseurIdentite = {
    creerCompte: vi.fn(),
    connecter: vi.fn(),
    identifiantDe: vi.fn(),
    utilisateurConnecte: vi.fn().mockResolvedValue(connecte ? UTILISATEUR : null),
  };
  const { log, lignes } = captureLogs();
  const app = createApp(vi.fn(), log, {
    routeurs: [routesFiscalite(service as FiscaliteService, fournisseur)],
  });
  return { app, lignes };
}

describe('routes des informations fiscales (US-06, SCPI-255)', () => {
  it('GET : informations de l’utilisateur connecté', async () => {
    const lire = vi.fn().mockResolvedValue(INFORMATIONS);
    const { app, lignes } = application({ lire });

    await request(app)
      .get('/informations-fiscales')
      .set('Authorization', 'Bearer jeton')
      .expect(200, INFORMATIONS);

    expect(lire).toHaveBeenCalledWith('u1');
    expect(lignes.at(-1)).toMatchObject({
      layer: 'controller',
      method: 'lireInformationsFiscales',
    });
    expect(JSON.stringify(lignes)).not.toContain('40123');
  });

  it('GET sans informations : null', async () => {
    const { app } = application({ lire: vi.fn().mockResolvedValue(null) });
    const res = await request(app)
      .get('/informations-fiscales')
      .set('Authorization', 'Bearer jeton')
      .expect(200);
    expect(res.body).toBeNull();
  });

  it('PUT : enregistre la saisie, sans valeur dans les logs', async () => {
    const enregistrer = vi.fn().mockResolvedValue(INFORMATIONS);
    const { app, lignes } = application({ enregistrer });

    await request(app)
      .put('/informations-fiscales')
      .set('Authorization', 'Bearer jeton')
      .send(INFORMATIONS)
      .expect(200, INFORMATIONS);

    expect(enregistrer).toHaveBeenCalledWith('u1', INFORMATIONS);
    expect(JSON.stringify(lignes)).not.toContain('40123');
  });

  it('PUT sans corps : saisie vide transmise au service', async () => {
    const enregistrer = vi.fn().mockResolvedValue(INFORMATIONS);
    const { app } = application({ enregistrer });
    await request(app).put('/informations-fiscales').set('Authorization', 'Bearer jeton');
    expect(enregistrer).toHaveBeenCalledWith('u1', {});
  });

  it('PUT invalide : 400 avec les erreurs par champ', async () => {
    const erreurs = { revenuNetImposable: 'Ce champ est obligatoire.' };
    const enregistrer = vi
      .fn()
      .mockRejectedValue(new HttpError(400, 'Merci de corriger les champs signalés.', { erreurs }));
    const { app } = application({ enregistrer });

    await request(app)
      .put('/informations-fiscales')
      .set('Authorization', 'Bearer jeton')
      .send({})
      .expect(400, { erreurs, message: 'Merci de corriger les champs signalés.' });
  });

  it('DELETE : efface les informations, 204', async () => {
    const effacer = vi.fn().mockResolvedValue(undefined);
    const { app } = application({ effacer });

    await request(app)
      .delete('/informations-fiscales')
      .set('Authorization', 'Bearer jeton')
      .expect(204);

    expect(effacer).toHaveBeenCalledWith('u1');
  });

  it('non connecté : 401, service non appelé', async () => {
    const lire = vi.fn();
    const { app } = application({ lire }, false);
    await request(app).get('/informations-fiscales').expect(401);
    expect(lire).not.toHaveBeenCalled();
  });
});
