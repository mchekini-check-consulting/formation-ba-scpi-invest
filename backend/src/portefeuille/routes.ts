import { Router, type RequestHandler } from 'express';
import { exigerConnexion, type FournisseurIdentite } from '../auth/fournisseur.js';
import type { PortefeuilleService } from './service.js';

// Couche contrôleur du portefeuille (US-20, SCPI-267), réservée à l'investisseur connecté :
//   GET /portefeuille/investissements -> { scpis: [...] } : ses dossiers regroupés par SCPI,
//     triés par montant investi décroissant (liste vide s'il n'a aucun dossier)
export function routesPortefeuille(
  service: PortefeuilleService,
  fournisseur: FournisseurIdentite,
): Router {
  const routeur = Router();

  // Handler nommé : son nom est la « method » des logs du contrôleur
  const listerInvestissements: RequestHandler = async (_req, res) => {
    res.json(await service.lister(res.locals.utilisateur.id));
  };

  routeur.get('/portefeuille/investissements', exigerConnexion(fournisseur), listerInvestissements);
  return routeur;
}
