import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { FournisseurIdentite } from '../auth/fournisseur.js';
import { captureLogs } from '../logging/capture.js';
import { HttpError } from '../logging/http-error.js';
import { routesDemandes } from './routes.js';
import type { DemandesService } from './service.js';

const UTILISATEUR = { id: 'u1', email: 'jean@exemple.fr' };
const SAISIE = { scpiId: 7, nombreParts: 5, type: 'pleine_propriete' };
const DOSSIER = {
  id: 42,
  numero: 'D-42',
  scpiId: 7,
  scpiNom: 'SCPI Exemple',
  gerant: 'Gestion Exemple',
  nombreParts: 5,
  prixPart: 200,
  montant: 1000,
  type: 'pleine_propriete',
  statut: 'demande_envoyee',
  demandeLe: '2026-11-24T10:00:00.000Z',
};

function application(service: Partial<DemandesService>, connecte = true) {
  const fournisseur: FournisseurIdentite = {
    creerCompte: vi.fn(),
    connecter: vi.fn(),
    identifiantDe: vi.fn(),
    utilisateurConnecte: vi.fn().mockResolvedValue(connecte ? UTILISATEUR : null),
  };
  const { log, lignes } = captureLogs();
  const app = createApp(vi.fn(), log, {
    routeurs: [routesDemandes(service as DemandesService, fournisseur)],
  });
  return { app, lignes };
}

describe('routes des demandes d’investissement (US-11, SCPI-259)', () => {
  it('POST : crée le dossier, 201, sans valeur saisie dans les logs', async () => {
    const creer = vi.fn().mockResolvedValue(DOSSIER);
    const { app, lignes } = application({ creer });

    await request(app)
      .post('/demandes')
      .set('Authorization', 'Bearer jeton')
      .send(SAISIE)
      .expect(201, DOSSIER);

    expect(creer).toHaveBeenCalledWith('u1', SAISIE);
    expect(lignes.at(-1)).toMatchObject({ layer: 'controller', method: 'creerDemande' });
    expect(JSON.stringify(lignes)).not.toContain('pleine_propriete');
  });

  it('POST sans corps : saisie vide transmise au service', async () => {
    const creer = vi.fn().mockResolvedValue(DOSSIER);
    const { app } = application({ creer });
    await request(app).post('/demandes').set('Authorization', 'Bearer jeton');
    expect(creer).toHaveBeenCalledWith('u1', {});
  });

  it('POST minimum non atteint : 400 avec le message', async () => {
    const message = 'Le minimum à investir pour cette SCPI est de 1 000 €, soit 5 parts.';
    const creer = vi
      .fn()
      .mockRejectedValue(new HttpError(400, message, { erreurs: { nombreParts: message } }));
    const { app } = application({ creer });

    await request(app)
      .post('/demandes')
      .set('Authorization', 'Bearer jeton')
      .send({ ...SAISIE, nombreParts: 4 })
      .expect(400, { erreurs: { nombreParts: message }, message });
  });

  it('GET : dossier de l’investisseur connecté', async () => {
    const lire = vi.fn().mockResolvedValue(DOSSIER);
    const { app, lignes } = application({ lire });

    await request(app)
      .get('/demandes/42')
      .set('Authorization', 'Bearer jeton')
      .expect(200, DOSSIER);

    expect(lire).toHaveBeenCalledWith('u1', '42');
    expect(lignes.at(-1)).toMatchObject({ layer: 'controller', method: 'lireDemande' });
  });

  it('GET d’un dossier introuvable : 404', async () => {
    const lire = vi.fn().mockRejectedValue(new HttpError(404, 'Cette demande est introuvable.'));
    const { app } = application({ lire });
    const res = await request(app)
      .get('/demandes/43')
      .set('Authorization', 'Bearer jeton')
      .expect(404);
    expect(res.body.message).toBe('Cette demande est introuvable.');
  });

  it('non connecté : 401, service non appelé', async () => {
    const creer = vi.fn();
    const lire = vi.fn();
    const { app } = application({ creer, lire }, false);
    await request(app).post('/demandes').send(SAISIE).expect(401);
    await request(app).get('/demandes/42').expect(401);
    expect(creer).not.toHaveBeenCalled();
    expect(lire).not.toHaveBeenCalled();
  });
});
