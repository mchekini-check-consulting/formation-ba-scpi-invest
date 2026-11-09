import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { FournisseurIdentite } from '../auth/fournisseur.js';
import { captureLogs } from '../logging/capture.js';
import { routesAdresses } from './routes.js';
import type { AdressesService } from './service.js';

const LILAS = {
  libelle: '12 Rue des Lilas 69008 Lyon',
  adresse: '12 Rue des Lilas',
  codePostal: '69008',
  ville: 'Lyon',
};

function application(suggestions = vi.fn().mockResolvedValue([LILAS]), connecte = true) {
  const fournisseur: FournisseurIdentite = {
    creerCompte: vi.fn(),
    connecter: vi.fn(),
    identifiantDe: vi.fn(),
    utilisateurConnecte: vi
      .fn()
      .mockResolvedValue(connecte ? { id: 'u1', email: 'jean@exemple.fr' } : null),
  };
  const { log, lignes } = captureLogs();
  const service = { suggestions } as unknown as AdressesService;
  const app = createApp(vi.fn(), log, { routeurs: [routesAdresses(service, fournisseur)] });
  return { app, lignes, suggestions };
}

describe('routes des adresses', () => {
  it('GET /adresses : suggestions, sans écrire l’adresse cherchée dans les logs', async () => {
    const { app, lignes, suggestions } = application();
    const res = await request(app)
      .get('/adresses')
      .query({ recherche: '12 rue des lilas' })
      .set('Authorization', 'Bearer j')
      .expect(200);
    expect(res.body).toEqual({ adresses: [LILAS] });
    expect(suggestions).toHaveBeenCalledWith('12 rue des lilas');
    expect(lignes.at(-1)).toMatchObject({ layer: 'controller', method: 'suggererAdresses' });
    expect(JSON.stringify(lignes)).not.toContain('lilas');
  });

  it('GET /adresses sans être connecté : 401', async () => {
    const { app, suggestions } = application(vi.fn(), false);
    await request(app).get('/adresses').query({ recherche: '12 rue' }).expect(401);
    expect(suggestions).not.toHaveBeenCalled();
  });
});
