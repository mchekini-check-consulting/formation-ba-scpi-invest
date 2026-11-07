import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { captureLogs } from '../logging/capture.js';
import { HttpError } from '../logging/http-error.js';
import { MESSAGE_TROP_GROS, routesOutilsImport, TAILLE_MAX_CSV } from './routes.js';
import type { OutilsImportService } from './service.js';

const DEV = 'gateway.formation-ba-scpi-invest.dev.check-consulting.net';
const QUALIF = 'gateway.formation-ba-scpi-invest.qualif.check-consulting.net';
const BASE = '/outils/import-catalogue';

function application(service: Partial<OutilsImportService>) {
  const { log, lignes } = captureLogs();
  const app = createApp(vi.fn(), log, {
    routeurs: [routesOutilsImport(service as OutilsImportService)],
  });
  return { app, lignes };
}

describe('routes de l’outil d’import (dev)', () => {
  it('GET /etat : état complet', async () => {
    const etat = vi.fn().mockResolvedValue({ stockage: { configure: true } });
    const { app } = application({ etat });
    const res = await request(app).get(`${BASE}/etat`).set('Host', DEV).expect(200);
    expect(res.body).toEqual({ stockage: { configure: true } });
  });

  it('PUT /fichier : le CSV brut arrive tel quel au service', async () => {
    const deposer = vi.fn().mockResolvedValue({ cle: 'scpi.csv', taille: 12 });
    const { app, lignes } = application({ deposer });
    const csv = Buffer.from('Nom\nHorizon\n', 'latin1');
    const res = await request(app)
      .put(`${BASE}/fichier`)
      .set('Host', 'localhost:8080')
      .set('Content-Type', 'text/csv')
      .send(csv)
      .expect(200);
    expect(res.body).toEqual({ cle: 'scpi.csv', taille: 12 });
    expect(Buffer.compare(deposer.mock.calls[0][0], csv)).toBe(0);
    expect(lignes.at(-1)).toMatchObject({ layer: 'controller', method: 'deposerFichier' });
    expect(JSON.stringify(lignes)).not.toContain('Horizon');
  });

  it('PUT /fichier : plus de 10 Mo refusé (413) sans appeler le service', async () => {
    const deposer = vi.fn();
    const { app } = application({ deposer });
    const res = await request(app)
      .put(`${BASE}/fichier`)
      .set('Host', DEV)
      .set('Content-Type', 'text/csv')
      .send(Buffer.alloc(TAILLE_MAX_CSV + 1))
      .expect(413);
    expect(res.body.message).toBe(MESSAGE_TROP_GROS);
    expect(deposer).not.toHaveBeenCalled();
  });

  it('PUT /fichier : corps illisible (400)', async () => {
    const deposer = vi.fn();
    const { app } = application({ deposer });
    const res = await request(app)
      .put(`${BASE}/fichier`)
      .set('Host', DEV)
      .set('Content-Type', 'text/csv')
      .set('Content-Encoding', 'inconnu')
      .send('x')
      .expect(400);
    expect(res.body.message).toBe('Fichier illisible.');
    expect(deposer).not.toHaveBeenCalled();
  });

  it('POST /lancement : résultat et rapport ; 409 si déjà en cours', async () => {
    const importer = vi
      .fn()
      .mockResolvedValueOnce({ issue: 'lance', rapport: { id: 1 } })
      .mockRejectedValueOnce(new HttpError(409, 'déjà en cours'));
    const { app } = application({ importer });
    const lance = await request(app).post(`${BASE}/lancement`).set('Host', DEV).expect(200);
    expect(lance.body).toEqual({ issue: 'lance', rapport: { id: 1 } });
    const refus = await request(app).post(`${BASE}/lancement`).set('Host', DEV).expect(409);
    expect(refus.body.message).toBe('déjà en cours');
  });

  it('GET /rapports : limite transmise au service', async () => {
    const rapports = vi.fn().mockResolvedValue([{ id: 1 }]);
    const { app } = application({ rapports });
    await request(app).get(`${BASE}/rapports?limite=20`).set('Host', DEV).expect(200);
    expect(rapports).toHaveBeenCalledWith('20');
  });

  it('GET /catalogue : catalogue en base', async () => {
    const catalogue = vi.fn().mockResolvedValue([{ nom: 'Horizon' }]);
    const { app } = application({ catalogue });
    const res = await request(app).get(`${BASE}/catalogue`).set('Host', DEV).expect(200);
    expect(res.body).toEqual([{ nom: 'Horizon' }]);
  });

  it('anciennes adresses (/import, /scpi) : 404', async () => {
    const service = { importer: vi.fn(), catalogue: vi.fn() };
    const { app } = application(service);
    await request(app).post(`${BASE}/import`).set('Host', DEV).expect(404);
    await request(app).get(`${BASE}/scpi`).set('Host', DEV).expect(404);
    Object.values(service).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it.each([
    ['get', 'etat'],
    ['put', 'fichier'],
    ['post', 'lancement'],
    ['get', 'rapports'],
    ['get', 'catalogue'],
  ] as const)('qualif : %s /%s répond 404, sans rien appeler', async (methode, route) => {
    const service = {
      etat: vi.fn(),
      deposer: vi.fn(),
      importer: vi.fn(),
      rapports: vi.fn(),
      catalogue: vi.fn(),
    };
    const { app } = application(service);
    await request(app)[methode](`${BASE}/${route}`).set('Host', QUALIF).expect(404);
    Object.values(service).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it('X-Forwarded-Host ignoré : impossible de se faire passer pour dev', async () => {
    const etat = vi.fn();
    const { app } = application({ etat });
    await request(app)
      .get(`${BASE}/etat`)
      .set('Host', QUALIF)
      .set('X-Forwarded-Host', DEV)
      .expect(404);
    expect(etat).not.toHaveBeenCalled();
  });
});
