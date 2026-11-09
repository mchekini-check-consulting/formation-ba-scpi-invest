import { Router, type RequestHandler } from 'express';
import { exigerConnexion, type FournisseurIdentite } from '../auth/fournisseur.js';
import type { CatalogueService } from './service.js';

// Couche contrôleur du Catalogue, réservée aux utilisateurs connectés (US-08, US-10) :
//   GET /scpis?page=n&<filtres>  -> { scpis, total, page, taillePage, nombrePages, anneeTaux,
//                                   misAJourLe }, 12 SCPI par page, 400 si la page ou un
//                                   filtre est invalide (filtres : catalogue/filtres.ts)
//   GET /scpis/filtres           -> valeurs proposées dans le panneau des filtres
export function routesCatalogue(service: CatalogueService, fournisseur: FournisseurIdentite) {
  const routeur = Router();

  const listerScpis: RequestHandler = async (req, res) => {
    const { page, ...filtres } = req.query;
    res.json(await service.lister(page, filtres));
  };

  const filtresScpis: RequestHandler = async (_req, res) => {
    res.json(await service.filtres());
  };

  routeur.get('/scpis', exigerConnexion(fournisseur), listerScpis);
  routeur.get('/scpis/filtres', exigerConnexion(fournisseur), filtresScpis);
  return routeur;
}
