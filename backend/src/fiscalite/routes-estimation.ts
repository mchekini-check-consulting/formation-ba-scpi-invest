import { Router, type RequestHandler } from 'express';
import { exigerConnexion, type FournisseurIdentite } from '../auth/fournisseur.js';
import type { EstimationService } from './estimation.js';

// Couche contrôleur de l'estimation fiscale (calcul US-07, utilisé par la simulation
// US-09), réservée à l'investisseur connecté :
//   POST /estimation-fiscale { lignes: [{ scpiId, revenuAnnuel }], taux?,
//                              periodes?: [[{ scpiId, revenuAnnuel }]], annees?: [[...]] }
//     -> { avecInformations, foyer: { parts, tmi, impotFoyer, tauxMoyen } | null,
//          avecScpi: { tmi, tauxMoyen, depassement: { plafond, montant } | null,
//                     impotRevenuFrance, impotRevenuEtranger } | null,
//          tauxApplique, lignes: [{ scpiId, revenuAnnuel, revenuFrance, revenuEtranger,
//          impot }], revenus, impotRevenu, impotRevenuFrance, impotRevenuEtranger,
//          prelevementsSociaux, impot, net,
//          periodes: [{ revenus, impot, net, lignes, ... }], cumul: { revenus, impot, net },
//          tauxProposes, tauxParDefaut }
//     400 { message } si la demande est invalide, une SCPI inconnue ou le taux hors barème
// POST et non GET : la liste des lignes est dans le corps. Rien n'est enregistré.
export function routesEstimationFiscale(
  service: EstimationService,
  fournisseur: FournisseurIdentite,
): Router {
  const routeur = Router();

  const estimerRevenus: RequestHandler = async (req, res) => {
    res.json(await service.estimerRevenus(res.locals.utilisateur.id, req.body));
  };

  routeur.post('/estimation-fiscale', exigerConnexion(fournisseur), estimerRevenus);
  return routeur;
}
