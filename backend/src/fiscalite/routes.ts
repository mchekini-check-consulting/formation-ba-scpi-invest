import { Router, type RequestHandler } from 'express';
import { exigerConnexion, type FournisseurIdentite } from '../auth/fournisseur.js';
import type { FiscaliteService } from './service.js';

// Couche contrôleur des informations fiscales (US-06, SCPI-255), réservée à
// l'investisseur connecté (KYC non exigé) :
//   GET    /informations-fiscales  -> { revenuNetImposable, situationFamiliale,
//                                       nombreEnfants } ou null si aucune
//   PUT    /informations-fiscales  { revenuNetImposable, situationFamiliale, nombreEnfants }
//                                  -> les informations enregistrées ; 400 { message,
//                                     erreurs: { <champ>: message } } si saisie incomplète
//   DELETE /informations-fiscales  « Effacer mes informations » -> 204
// Valeurs saisies : jamais dans les logs.
export function routesFiscalite(
  service: FiscaliteService,
  fournisseur: FournisseurIdentite,
): Router {
  const routeur = Router();
  const connecte = exigerConnexion(fournisseur);

  // Un handler nommé par action : son nom est la « method » des logs du contrôleur
  const lireInformationsFiscales: RequestHandler = async (_req, res) => {
    res.json(await service.lire(res.locals.utilisateur.id));
  };
  const enregistrerInformationsFiscales: RequestHandler = async (req, res) => {
    res.json(await service.enregistrer(res.locals.utilisateur.id, req.body ?? {}));
  };
  const effacerInformationsFiscales: RequestHandler = async (_req, res) => {
    await service.effacer(res.locals.utilisateur.id);
    res.status(204).end();
  };

  routeur.get('/informations-fiscales', connecte, lireInformationsFiscales);
  routeur.put('/informations-fiscales', connecte, enregistrerInformationsFiscales);
  routeur.delete('/informations-fiscales', connecte, effacerInformationsFiscales);
  return routeur;
}
