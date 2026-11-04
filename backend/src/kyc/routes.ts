import { Router, type RequestHandler } from 'express';
import {
  exigerConnexion,
  type FournisseurIdentite,
  type Utilisateur,
} from '../auth/fournisseur.js';
import type { KycService } from './service.js';

// Couche contrôleur du KYC (US-04b), réservée à l'utilisateur connecté, sur son propre KYC :
//   GET  /kyc             -> { statut, etape, reponses, valideLe }  (nouveau : étape 1, vide)
//   PUT  /kyc             { etape, reponses } -> état enregistré ; 409 si déjà validé
//   POST /kyc/validation  -> état complété avec la date ; 400 si incomplet, 409 si déjà validé
export function routesKyc(service: KycService, fournisseur: FournisseurIdentite): Router {
  const routeur = Router();
  const utilisateur = (res: { locals: Record<string, unknown> }) =>
    (res.locals.utilisateur as Utilisateur).id;

  const lireKyc: RequestHandler = async (_req, res) => {
    res.json(await service.lire(utilisateur(res)));
  };
  const enregistrerKyc: RequestHandler = async (req, res) => {
    res.json(await service.enregistrer(utilisateur(res), req.body ?? {}));
  };
  const validerKyc: RequestHandler = async (_req, res) => {
    res.json(await service.valider(utilisateur(res)));
  };

  const connecte = exigerConnexion(fournisseur);
  routeur.get('/kyc', connecte, lireKyc);
  routeur.put('/kyc', connecte, enregistrerKyc);
  routeur.post('/kyc/validation', connecte, validerKyc);
  return routeur;
}
