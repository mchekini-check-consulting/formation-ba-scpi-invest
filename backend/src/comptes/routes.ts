import { Router, type RequestHandler } from 'express';
import { exigerConnexion, type FournisseurIdentite } from '../auth/fournisseur.js';
import type { CompteService } from './service.js';

// Couche contrôleur des comptes :
//   POST /comptes  { email, motDePasse, confirmation, cguAcceptees }
//                  -> 201 { utilisateur: { id, email }, jeton }  (jeton = session, 7 jours)
//   POST /connexions  { email, motDePasse }
//                  -> 200 { utilisateur: { id, email }, jeton }
//                  -> 401 { message: 'Email ou mot de passe incorrect' }
//   GET  /moi      (Authorization: Bearer <jeton>) -> { id, email }, 401 sinon
export function routesComptes(service: CompteService, fournisseur: FournisseurIdentite): Router {
  const routeur = Router();

  const creerCompte: RequestHandler = async (req, res) => {
    res.status(201).json(await service.creer(req.body ?? {}));
  };
  const connecter: RequestHandler = async (req, res) => {
    res.json(await service.connecter(req.body ?? {}));
  };
  const moi: RequestHandler = (_req, res) => {
    res.json(res.locals.utilisateur);
  };

  routeur.post('/comptes', creerCompte);
  routeur.post('/connexions', connecter);
  routeur.get('/moi', exigerConnexion(fournisseur), moi);
  return routeur;
}
