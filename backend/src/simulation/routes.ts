import { Router, type RequestHandler } from 'express';
import { exigerConnexion, type FournisseurIdentite } from '../auth/fournisseur.js';
import type { SimulationService } from './service.js';

// Couche contrôleur de la simulation (US-08), réservée aux utilisateurs connectés :
//   GET /scpis/simulables -> toutes les SCPI, triées par nom, avec prix de part, taux,
//                            minimum, délai de jouissance et décotes de démembrement
export function routesSimulation(service: SimulationService, fournisseur: FournisseurIdentite) {
  const routeur = Router();

  const listerSimulables: RequestHandler = async (_req, res) => {
    res.json(await service.lister());
  };

  routeur.get('/scpis/simulables', exigerConnexion(fournisseur), listerSimulables);
  return routeur;
}
