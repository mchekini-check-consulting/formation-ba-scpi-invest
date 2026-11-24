import { Router, type RequestHandler } from 'express';
import { exigerConnexion, type FournisseurIdentite } from '../auth/fournisseur.js';
import type { FicheService } from './service.js';

// Couche contrôleur de la fiche SCPI (US-02), réservée aux utilisateurs connectés :
//   GET /scpis/:id -> fiche de la SCPI (sans IBAN ni BIC) ;
//                     404 { statut: 'supprimee' | 'introuvable', message } si elle est absente
// Déclarée après les routes /scpis/filtres, /scpis/recherche et /scpis/comparables
// (server.ts) : ces adresses ne sont jamais prises pour un identifiant.
export function routesFiche(service: FicheService, fournisseur: FournisseurIdentite) {
  const routeur = Router();

  const lireFiche: RequestHandler = async (req, res) => {
    res.json(await service.lire(req.params.id));
  };

  routeur.get('/scpis/:id', exigerConnexion(fournisseur), lireFiche);
  return routeur;
}
