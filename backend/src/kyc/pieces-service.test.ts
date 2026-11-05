import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../logging/http-error.js';
import { KYC_COMPLET, PDF, PNG } from './exemple.js';
import { MESSAGE_FORMAT, TAILLE_MAX } from './pieces.js';
import {
  PIECE_ABSENTE,
  PIECE_INCONNUE,
  PIECE_NON_DEMANDEE,
  PIECES_FIGEES,
  creerPiecesService,
  type DepotPieces,
  type PieceKyc,
  type StockagePieces,
} from './pieces-service.js';
import type { EtatKyc } from './service.js';

const LE = new Date(2026, 10, 5, 10, 0);
const EN_COURS: EtatKyc = { statut: 'en_cours', etape: 5, reponses: KYC_COMPLET, valideLe: null };
const RIB: PieceKyc = {
  type: 'rib',
  nomFichier: 'rib.pdf',
  format: 'application/pdf',
  taille: PDF.length,
  statut: 'deposee',
  deposeLe: LE,
};

function preparer(etat: EtatKyc | null = EN_COURS, deposees: PieceKyc[] = []) {
  const depotKyc = { lire: vi.fn().mockResolvedValue(etat) };
  const depot = {
    lister: vi.fn().mockResolvedValue(deposees),
    enregistrer: vi.fn().mockImplementation(async (_u, piece) => ({
      ...RIB,
      ...piece,
      cle: undefined,
    })),
    supprimer: vi.fn().mockResolvedValue(undefined),
  } satisfies DepotPieces;
  const stockage = {
    deposer: vi.fn().mockResolvedValue(undefined),
    supprimer: vi.fn().mockResolvedValue(undefined),
  } satisfies StockagePieces;
  return { service: creerPiecesService(depotKyc, depot, stockage, () => LE), depot, stockage };
}

async function erreurDe(promesse: Promise<unknown>): Promise<HttpError> {
  const err = await promesse.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(HttpError);
  return err as HttpError;
}

describe('PiecesKycService.deposer', () => {
  it('fichier accepté : envoyé dans R2 sous kyc/<utilisateur>/<pièce>, puis enregistré', async () => {
    const { service, depot, stockage } = preparer();
    await service.deposer('u1', 'rib', { nom: 'mon rib.pdf', contenu: PDF });
    expect(stockage.deposer).toHaveBeenCalledWith('kyc/u1/rib', PDF, 'application/pdf');
    expect(depot.enregistrer).toHaveBeenCalledWith(
      'u1',
      {
        type: 'rib',
        nomFichier: 'mon rib.pdf',
        format: 'application/pdf',
        taille: PDF.length,
        cle: 'kyc/u1/rib',
      },
      LE,
    );
  });

  it('format d’après le contenu, pas d’après le nom', async () => {
    const { service, stockage } = preparer();
    await service.deposer('u1', 'domicile', { nom: 'facture.pdf', contenu: PNG });
    expect(stockage.deposer).toHaveBeenCalledWith('kyc/u1/domicile', PNG, 'image/png');
  });

  it.each([
    ['autre format', Buffer.from('GIF89a')],
    ['fichier vide', Buffer.alloc(0)],
    ['plus de 10 Mo', Buffer.concat([PDF, Buffer.alloc(TAILLE_MAX)])],
    ['pas de fichier', undefined],
  ])('%s : 400 avec le message de l’US, rien n’est envoyé', async (_cas, contenu) => {
    const { service, stockage, depot } = preparer();
    const err = await erreurDe(service.deposer('u1', 'rib', { nom: 'x', contenu }));
    expect(err.status).toBe(400);
    expect(err.message).toBe(MESSAGE_FORMAT);
    expect(stockage.deposer).not.toHaveBeenCalled();
    expect(depot.enregistrer).not.toHaveBeenCalled();
  });

  it('pièce inconnue : 404 ; pièce non demandée pour ce dossier : 400', async () => {
    const { service } = preparer();
    expect(
      (await erreurDe(service.deposer('u1', 'photo', { nom: 'x', contenu: PDF }))).message,
    ).toBe(PIECE_INCONNUE);
    const nonDemandee = await erreurDe(service.deposer('u1', 'ppe', { nom: 'x', contenu: PDF }));
    expect(nonDemandee.status).toBe(400);
    expect(nonDemandee.message).toBe(PIECE_NON_DEMANDEE);
  });

  it('pièce demandée par une réponse (PPE) : acceptée', async () => {
    const { service, stockage } = preparer({
      ...EN_COURS,
      reponses: { ...KYC_COMPLET, ppe: 'Oui' },
    });
    await service.deposer('u1', 'ppe', { nom: 'x.pdf', contenu: PDF });
    expect(stockage.deposer).toHaveBeenCalled();
  });

  it('KYC jamais commencé : pièces de base acceptées', async () => {
    const { service, stockage } = preparer(null);
    await service.deposer('u1', 'identite', { nom: 'cni.pdf', contenu: PDF });
    expect(stockage.deposer).toHaveBeenCalled();
  });

  it('KYC déjà validé : 409, rien n’est modifié', async () => {
    const { service, stockage } = preparer({ ...EN_COURS, statut: 'complete', valideLe: LE });
    const err = await erreurDe(service.deposer('u1', 'rib', { nom: 'x', contenu: PDF }));
    expect(err.status).toBe(409);
    expect(err.message).toBe(PIECES_FIGEES);
    expect(stockage.deposer).not.toHaveBeenCalled();
  });
});

describe('PiecesKycService.supprimer', () => {
  it('pièce déposée : fichier supprimé de R2 puis la ligne', async () => {
    const { service, stockage, depot } = preparer(EN_COURS, [RIB]);
    await service.supprimer('u1', 'rib');
    expect(stockage.supprimer).toHaveBeenCalledWith('kyc/u1/rib');
    expect(depot.supprimer).toHaveBeenCalledWith('u1', 'rib');
  });

  it('aucune pièce de ce type : 404', async () => {
    const { service, stockage } = preparer(EN_COURS, []);
    const err = await erreurDe(service.supprimer('u1', 'rib'));
    expect(err.status).toBe(404);
    expect(err.message).toBe(PIECE_ABSENTE);
    expect(stockage.supprimer).not.toHaveBeenCalled();
  });

  it('KYC déjà validé : 409', async () => {
    const { service, depot } = preparer({ ...EN_COURS, statut: 'complete', valideLe: LE }, [RIB]);
    expect((await erreurDe(service.supprimer('u1', 'rib'))).status).toBe(409);
    expect(depot.supprimer).not.toHaveBeenCalled();
  });
});

describe('PiecesKycService.lister', () => {
  it('pièces de l’utilisateur', async () => {
    const { service, depot } = preparer(EN_COURS, [RIB]);
    expect(await service.lister('u1')).toEqual([RIB]);
    expect(depot.lister).toHaveBeenCalledWith('u1');
  });
});
