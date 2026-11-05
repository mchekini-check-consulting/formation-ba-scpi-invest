import { Router, type RequestHandler } from 'express';
import { exigerConnexion, type FournisseurIdentite } from '../auth/fournisseur.js';
import type { CommunesService } from './service.js';

// Couche contrôleur des communes, réservée aux utilisateurs connectés (pas de relais
// ouvert à tous vers l'API Géo) :
//   GET /communes?pays=FR&codePostal=69003  -> { communes: ['Lyon'] }
//   autre pays, code incomplet ou service indisponible -> { communes: [] }
export function routesCommunes(service: CommunesService, fournisseur: FournisseurIdentite): Router {
  const routeur = Router();

  const listerCommunes: RequestHandler = async (req, res) => {
    res.json({ communes: await service.communes(req.query.pays, req.query.codePostal) });
  };

  routeur.get('/communes', exigerConnexion(fournisseur), listerCommunes);
  return routeur;
}
