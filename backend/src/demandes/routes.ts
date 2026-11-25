import { Router, type RequestHandler } from 'express';
import { exigerConnexion, type FournisseurIdentite } from '../auth/fournisseur.js';
import type { DemandesService } from './service.js';

// Couche contrôleur des demandes d'investissement (US-11, SCPI-259), réservée à
// l'investisseur connecté :
//   POST /demandes      { scpiId, nombreParts, type } -> 201 dossier créé (statut
//                        demande_envoyee) ; 400 { message, erreurs } si saisie invalide ou
//                        minimum non atteint ; 403 KYC non validé ; 404 SCPI absente ;
//                        422 prix de part inconnu
//   GET  /demandes/:id  -> dossier de l'investisseur ; 404 « Cette demande est introuvable. »
// Valeurs saisies : jamais dans les logs.
export function routesDemandes(service: DemandesService, fournisseur: FournisseurIdentite): Router {
  const routeur = Router();
  const connecte = exigerConnexion(fournisseur);

  // Un handler nommé par action : son nom est la « method » des logs du contrôleur
  const creerDemande: RequestHandler = async (req, res) => {
    res.status(201).json(await service.creer(res.locals.utilisateur.id, req.body ?? {}));
  };
  const lireDemande: RequestHandler = async (req, res) => {
    res.json(await service.lire(res.locals.utilisateur.id, req.params.id));
  };

  routeur.post('/demandes', connecte, creerDemande);
  routeur.get('/demandes/:id', connecte, lireDemande);
  return routeur;
}
