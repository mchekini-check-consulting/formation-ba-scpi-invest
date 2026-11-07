import { Router, type RequestHandler } from 'express';
import { exigerConnexion, type FournisseurIdentite } from '../auth/fournisseur.js';
import type { CatalogueService } from './service.js';

// Couche contrôleur du Catalogue, réservée aux utilisateurs connectés (US-08) :
//   GET /scpis?page=n   -> { scpis, total, page, taillePage, nombrePages, anneeTaux,
//                            misAJourLe }, 12 SCPI par page, 400 si la page est invalide
export function routesCatalogue(service: CatalogueService, fournisseur: FournisseurIdentite) {
  const routeur = Router();

  const listerScpis: RequestHandler = async (req, res) => {
    res.json(await service.lister(req.query.page));
  };

  routeur.get('/scpis', exigerConnexion(fournisseur), listerScpis);
  return routeur;
}
