import { Router, type RequestHandler } from 'express';
import { exigerConnexion, type FournisseurIdentite } from '../auth/fournisseur.js';
import type { ComparaisonService } from './service.js';

// Couche contrôleur du comparateur (US-04), réservée aux utilisateurs connectés :
//   GET /scpis/comparables -> toutes les SCPI, triées par nom, avec les critères comparés
export function routesComparaison(service: ComparaisonService, fournisseur: FournisseurIdentite) {
  const routeur = Router();

  const listerComparables: RequestHandler = async (_req, res) => {
    res.json(await service.lister());
  };

  routeur.get('/scpis/comparables', exigerConnexion(fournisseur), listerComparables);
  return routeur;
}
