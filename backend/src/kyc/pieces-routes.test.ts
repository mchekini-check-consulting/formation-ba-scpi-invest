import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { FournisseurIdentite } from '../auth/fournisseur.js';
import { captureLogs } from '../logging/capture.js';
import { HttpError } from '../logging/http-error.js';
import { PDF } from './exemple.js';
import { MESSAGE_FORMAT, TAILLE_MAX } from './pieces.js';
import { routesPiecesKyc } from './pieces-routes.js';
import type { PiecesKycService } from './pieces-service.js';

const JEAN = { id: 'u1', email: 'jean@exemple.fr' };
const RIB = { type: 'rib', nomFichier: 'rib.pdf', statut: 'deposee' };

function application(service: Partial<PiecesKycService>, connecte = true) {
  const fournisseur: FournisseurIdentite = {
    creerCompte: vi.fn(),
    connecter: vi.fn(),
    utilisateurConnecte: vi.fn().mockResolvedValue(connecte ? JEAN : null),
  };
  const { log, lignes } = captureLogs();
  const app = createApp(vi.fn(), log, {
    routeurs: [routesPiecesKyc(service as PiecesKycService, fournisseur)],
  });
  return { app, lignes };
}

describe('routes des pièces justificatives', () => {
  it('GET /kyc/pieces : pièces de l’utilisateur connecté', async () => {
    const lister = vi.fn().mockResolvedValue([RIB]);
    const { app } = application({ lister });
    const res = await request(app).get('/kyc/pieces').expect(200);
    expect(res.body).toEqual([RIB]);
    expect(lister).toHaveBeenCalledWith('u1');
  });

  it('PUT /kyc/pieces/:type : fichier brut et nom, sans nom de fichier dans les logs', async () => {
    const deposer = vi.fn().mockResolvedValue(RIB);
    const { app, lignes } = application({ deposer });
    const res = await request(app)
      .put('/kyc/pieces/rib')
      .query({ nom: 'rib-claire-martin.pdf' })
      .set('Content-Type', 'application/pdf')
      .send(PDF)
      .expect(200);
    expect(res.body).toEqual(RIB);
    const [utilisateur, type, fichier] = deposer.mock.calls[0];
    expect([utilisateur, type, fichier.nom]).toEqual(['u1', 'rib', 'rib-claire-martin.pdf']);
    expect(Buffer.compare(fichier.contenu, PDF)).toBe(0);
    expect(lignes.at(-1)).toMatchObject({ layer: 'controller', method: 'deposerPiece' });
    expect(JSON.stringify(lignes)).not.toContain('claire');
  });

  it('PUT : fichier de plus de 10 Mo refusé (413) sans appeler le service', async () => {
    const deposer = vi.fn();
    const { app } = application({ deposer });
    const res = await request(app)
      .put('/kyc/pieces/rib')
      .set('Content-Type', 'application/pdf')
      .send(Buffer.alloc(TAILLE_MAX + 1))
      .expect(413);
    expect(res.body.message).toBe(MESSAGE_FORMAT);
    expect(deposer).not.toHaveBeenCalled();
  });

  it('PUT : corps illisible (encodage inconnu) : 400', async () => {
    const deposer = vi.fn();
    const { app } = application({ deposer });
    await request(app)
      .put('/kyc/pieces/rib')
      .set('Content-Encoding', 'inconnu')
      .send(PDF)
      .expect(400);
    expect(deposer).not.toHaveBeenCalled();
  });

  it('DELETE /kyc/pieces/:type : 204', async () => {
    const supprimer = vi.fn().mockResolvedValue(undefined);
    const { app } = application({ supprimer });
    await request(app).delete('/kyc/pieces/rib').expect(204);
    expect(supprimer).toHaveBeenCalledWith('u1', 'rib');
  });

  it('règle métier non respectée : statut et message', async () => {
    const supprimer = vi.fn().mockRejectedValue(new HttpError(409, 'KYC validé'));
    const { app } = application({ supprimer });
    const res = await request(app).delete('/kyc/pieces/rib').expect(409);
    expect(res.body.message).toBe('KYC validé');
  });

  it('sans connexion : 401 sur les trois routes', async () => {
    const service = { lister: vi.fn(), deposer: vi.fn(), supprimer: vi.fn() };
    const { app } = application(service, false);
    await request(app).get('/kyc/pieces').expect(401);
    await request(app).put('/kyc/pieces/rib').send(PDF).expect(401);
    await request(app).delete('/kyc/pieces/rib').expect(401);
    expect(service.deposer).not.toHaveBeenCalled();
  });
});
