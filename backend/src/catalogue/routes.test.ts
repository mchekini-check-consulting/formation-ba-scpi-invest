import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { FournisseurIdentite } from '../auth/fournisseur.js';
import { captureLogs } from '../logging/capture.js';
import { HttpError } from '../logging/http-error.js';
import { routesCatalogue } from './routes.js';
import type { CatalogueService } from './service.js';

function application(
  lister: CatalogueService['lister'],
  connecte = true,
  filtres: CatalogueService['filtres'] = vi.fn(),
  rechercher: CatalogueService['rechercher'] = vi.fn(),
) {
  const fournisseur: FournisseurIdentite = {
    creerCompte: vi.fn(),
    connecter: vi.fn(),
    identifiantDe: vi.fn(),
    utilisateurConnecte: vi
      .fn()
      .mockResolvedValue(connecte ? { id: 'u1', email: 'jean@exemple.fr' } : null),
  };
  const { log, lignes } = captureLogs();
  const app = createApp(vi.fn(), log, {
    routeurs: [routesCatalogue({ lister, filtres, rechercher }, fournisseur)],
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
    expect(lister).toHaveBeenCalledWith('2', {});
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

  it('US-10 : filtres de l’URL transmis au service, valeurs répétées en liste', async () => {
    const lister = vi.fn().mockResolvedValue(PAGE);
    const { app } = application(lister);
    await request(app)
      .get('/scpis?page=1&categorie=Sant%C3%A9&categorie=Bureaux&tauxMin=4')
      .expect(200);
    expect(lister).toHaveBeenCalledWith('1', { categorie: ['Santé', 'Bureaux'], tauxMin: '4' });
  });

  it('US-10 : GET /scpis/filtres renvoie les valeurs du panneau', async () => {
    const options = { categories: ['Santé'], anneeTaux: 2025 };
    const filtres = vi.fn().mockResolvedValue(options);
    const { app, lignes } = application(vi.fn(), true, filtres);
    await request(app).get('/scpis/filtres').expect(200, options);
    expect(lignes.at(-1)).toMatchObject({ layer: 'controller', method: 'filtresScpis' });
  });

  it('US-10 : GET /scpis/filtres sans session -> 401', async () => {
    const filtres = vi.fn();
    const { app } = application(vi.fn(), false, filtres);
    await request(app).get('/scpis/filtres').expect(401);
    expect(filtres).not.toHaveBeenCalled();
  });

  it('GET /scpis/recherche : texte q transmis au service, résultat renvoyé', async () => {
    const resultat = { scpis: [{ id: 1, nom: 'Pierre Plus' }], anneeTaux: 2025 };
    const rechercher = vi.fn().mockResolvedValue(resultat);
    const { app, lignes } = application(vi.fn(), true, vi.fn(), rechercher);
    await request(app)
      .get('/scpis/recherche?q=pierre')
      .set('Authorization', 'Bearer jeton')
      .expect(200, resultat);
    expect(rechercher).toHaveBeenCalledWith('pierre', {});
    expect(lignes.at(-1)).toMatchObject({ layer: 'controller', method: 'rechercherScpis' });
  });

  it('GET /scpis/recherche : recherche invalide -> 400 avec le message du service', async () => {
    const rechercher = vi.fn().mockRejectedValue(new HttpError(400, 'Recherche invalide'));
    const { app } = application(vi.fn(), true, vi.fn(), rechercher);
    const res = await request(app).get('/scpis/recherche').expect(400);
    expect(res.body.message).toBe('Recherche invalide');
    expect(rechercher).toHaveBeenCalledWith(undefined, {});
  });

  it('GET /scpis/recherche : filtres et tri transmis avec le texte (US-12)', async () => {
    const rechercher = vi.fn().mockResolvedValue({ scpis: [], anneeTaux: 2025 });
    const { app } = application(vi.fn(), true, vi.fn(), rechercher);
    await request(app)
      .get('/scpis/recherche?q=pierre&tri=nom-asc&pays=France&tauxMin=4')
      .set('Authorization', 'Bearer jeton')
      .expect(200);
    expect(rechercher).toHaveBeenCalledWith('pierre', {
      tri: 'nom-asc',
      pays: 'France',
      tauxMin: '4',
    });
  });

  it('GET /scpis/recherche sans session -> 401, le service n’est pas appelé', async () => {
    const rechercher = vi.fn();
    const { app } = application(vi.fn(), false, vi.fn(), rechercher);
    await request(app).get('/scpis/recherche?q=pierre').expect(401);
    expect(rechercher).not.toHaveBeenCalled();
  });
});
