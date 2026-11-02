import { Router, type RequestHandler } from 'express';
import { exigerConnexion, type FournisseurIdentite } from '../auth/fournisseur.js';
import type { CompteService } from './service.js';

// Couche contrôleur des comptes :
//   POST /comptes  { email, motDePasse, confirmation, cguAcceptees }
//                  -> 201 { utilisateur: { id, email }, jeton }  (jeton = session, 7 jours)
//   GET  /moi      (Authorization: Bearer <jeton>) -> { id, email }, 401 sinon
export function routesComptes(service: CompteService, fournisseur: FournisseurIdentite): Router {
  const routeur = Router();

  const creerCompte: RequestHandler = async (req, res) => {
    res.status(201).json(await service.creer(req.body ?? {}));
  };
  const moi: RequestHandler = (_req, res) => {
    res.json(res.locals.utilisateur);
  };

  routeur.post('/comptes', creerCompte);
  routeur.get('/moi', exigerConnexion(fournisseur), moi);
  return routeur;
}
