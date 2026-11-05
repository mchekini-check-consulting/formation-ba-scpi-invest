import express, { Router, type RequestHandler } from 'express';
import {
  exigerConnexion,
  type FournisseurIdentite,
  type Utilisateur,
} from '../auth/fournisseur.js';
import { HttpError } from '../logging/http-error.js';
import { MESSAGE_FORMAT, TAILLE_MAX } from './pieces.js';
import type { PiecesKycService } from './pieces-service.js';

// Couche contrôleur des pièces justificatives (US-04c), sur le KYC de l'utilisateur connecté :
//   GET    /kyc/pieces              -> [{ type, nomFichier, format, taille, statut, deposeLe }]
//   PUT    /kyc/pieces/:type?nom=…  corps = le fichier brut (PDF, JPG ou PNG, 10 Mo maximum)
//                                   -> la pièce déposée ; 400 format, 409 KYC déjà validé
//   DELETE /kyc/pieces/:type        -> 204 ; 404 aucune pièce, 409 KYC déjà validé
export function routesPiecesKyc(
  service: PiecesKycService,
  fournisseur: FournisseurIdentite,
): Router {
  const routeur = Router();
  const utilisateur = (res: { locals: Record<string, unknown> }) =>
    (res.locals.utilisateur as Utilisateur).id;

  // Corps lu tel quel, quel que soit son type ; au-delà de 10 Mo : 413 avec le message
  // de l'US (le fichier n'est pas lu en entier)
  const corpsBrut = express.raw({ type: () => true, limit: TAILLE_MAX });
  const lireFichier: RequestHandler = (req, res, next) => {
    corpsBrut(req, res, (err?: unknown) => {
      if (err) {
        const trop = (err as { status?: number }).status === 413;
        next(new HttpError(trop ? 413 : 400, MESSAGE_FORMAT));
        return;
      }
      next();
    });
  };

  const listerPieces: RequestHandler = async (_req, res) => {
    res.json(await service.lister(utilisateur(res)));
  };
  const deposerPiece: RequestHandler = async (req, res) => {
    const piece = await service.deposer(utilisateur(res), req.params.type, {
      nom: req.query.nom,
      contenu: req.body,
    });
    res.json(piece);
  };
  const supprimerPiece: RequestHandler = async (req, res) => {
    await service.supprimer(utilisateur(res), req.params.type);
    res.status(204).end();
  };

  const connecte = exigerConnexion(fournisseur);
  routeur.get('/kyc/pieces', connecte, listerPieces);
  routeur.put('/kyc/pieces/:type', connecte, lireFichier, deposerPiece);
  routeur.delete('/kyc/pieces/:type', connecte, supprimerPiece);
  return routeur;
}
