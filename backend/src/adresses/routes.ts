import { Router, type RequestHandler } from 'express';
import { exigerConnexion, type FournisseurIdentite } from '../auth/fournisseur.js';
import type { AdressesService } from './service.js';

// Couche contrôleur des suggestions d'adresses, réservée aux utilisateurs connectés (pas
// de relais ouvert à tous vers le service national des adresses) :
//   GET /adresses?recherche=12 rue des lilas  -> { adresses: [{ libelle, adresse, codePostal, ville }] }
//   moins de 3 caractères ou service indisponible -> { adresses: [] }
//   GET /adresses/communes?codePostal=69003   -> { communes: ['Lyon'] }
//   code postal pas à 5 chiffres ou service indisponible -> { communes: [] }
export function routesAdresses(service: AdressesService, fournisseur: FournisseurIdentite): Router {
  const routeur = Router();

  const suggererAdresses: RequestHandler = async (req, res) => {
    res.json({ adresses: await service.suggestions(req.query.recherche) });
  };

  const suggererCommunes: RequestHandler = async (req, res) => {
    res.json({ communes: await service.communes(req.query.codePostal) });
  };

  routeur.get('/adresses', exigerConnexion(fournisseur), suggererAdresses);
  routeur.get('/adresses/communes', exigerConnexion(fournisseur), suggererCommunes);
  return routeur;
}
