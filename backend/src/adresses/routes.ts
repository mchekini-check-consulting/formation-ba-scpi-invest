import { Router, type RequestHandler } from 'express';
import { exigerConnexion, type FournisseurIdentite } from '../auth/fournisseur.js';
import type { AdressesService } from './service.js';

// Couche contrôleur des suggestions d'adresses, réservée aux utilisateurs connectés (pas
// de relais ouvert à tous vers le service national des adresses) :
//   GET /adresses?recherche=12 rue des lilas  -> { adresses: [{ libelle, adresse, codePostal, ville }] }
//   moins de 3 caractères ou service indisponible -> { adresses: [] }
export function routesAdresses(service: AdressesService, fournisseur: FournisseurIdentite): Router {
  const routeur = Router();

  const suggererAdresses: RequestHandler = async (req, res) => {
    res.json({ adresses: await service.suggestions(req.query.recherche) });
  };

  routeur.get('/adresses', exigerConnexion(fournisseur), suggererAdresses);
  return routeur;
}
