import express, { Router, type RequestHandler } from 'express';
import {
  exigerConnexion,
  type FournisseurIdentite,
  type Utilisateur,
} from '../auth/fournisseur.js';
import { HttpError } from '../logging/http-error.js';
import { MESSAGE_FICHIER, TAILLE_MAX_JUSTIFICATIF, type InformationsService } from './service.js';

// Couche contrôleur des informations personnelles (US-06), utilisateur connecté, KYC validé :
//   GET  /informations-personnelles                 -> { email, reponses, historique }
//   POST /informations-personnelles/justificatifs?nom=…  corps = le fichier brut
//                                                   (PDF, JPG ou PNG, 10 Mo maximum)
//                                                   -> 201 { id, nomFichier }
//   PUT  /informations-personnelles/adresse         { adresse, codePostal, ville, pays,
//                                                     justificatif }
//   PUT  /informations-personnelles/situation       { nom, situationFamiliale, profession,
//                                                     categorie, secteur, justificatif? }
//   PUT  /informations-personnelles/coordonnees     { telephone, indicatif?, email, motDePasse }
//   PUT  /informations-personnelles/identite        { recto, verso? } (identifiants de justificatifs)
// Chaque PUT renvoie les informations à jour. 400 champ ou justificatif manquant, 403 mot de
// passe incorrect, 409 KYC non validé ou e-mail déjà utilisé.
export function routesInformations(
  service: InformationsService,
  fournisseur: FournisseurIdentite,
): Router {
  const routeur = Router();
  const connecte = exigerConnexion(fournisseur);
  const utilisateur = (res: { locals: Record<string, unknown> }) =>
    res.locals.utilisateur as Utilisateur;

  // Fichier lu tel quel ; au-delà de 10 Mo : 413 avec le message du KYC
  const corpsBrut = express.raw({ type: () => true, limit: TAILLE_MAX_JUSTIFICATIF });
  const lireFichier: RequestHandler = (req, res, next) => {
    corpsBrut(req, res, (err?: unknown) => {
      if (err) {
        const trop = (err as { status?: number }).status === 413;
        next(new HttpError(trop ? 413 : 400, MESSAGE_FICHIER));
        return;
      }
      next();
    });
  };

  const lireInformations: RequestHandler = async (_req, res) => {
    const { id, email } = utilisateur(res);
    res.json(await service.lire(id, email));
  };
  const deposerJustificatif: RequestHandler = async (req, res) => {
    const depose = await service.deposerJustificatif(utilisateur(res).id, {
      nom: req.query.nom,
      contenu: req.body,
    });
    res.status(201).json(depose);
  };
  // Un handler nommé par bloc : son nom est la « method » des logs du contrôleur
  const modifierAdresse: RequestHandler = async (req, res) => {
    const { id, email } = utilisateur(res);
    res.json(await service.modifierAdresse(id, email, req.body ?? {}));
  };
  const modifierSituation: RequestHandler = async (req, res) => {
    const { id, email } = utilisateur(res);
    res.json(await service.modifierSituation(id, email, req.body ?? {}));
  };
  const modifierCoordonnees: RequestHandler = async (req, res) => {
    const { id, email } = utilisateur(res);
    res.json(await service.modifierCoordonnees(id, email, req.body ?? {}));
  };
  const modifierIdentite: RequestHandler = async (req, res) => {
    const { id, email } = utilisateur(res);
    res.json(await service.modifierIdentite(id, email, req.body ?? {}));
  };

  routeur.get('/informations-personnelles', connecte, lireInformations);
  routeur.post(
    '/informations-personnelles/justificatifs',
    connecte,
    lireFichier,
    deposerJustificatif,
  );
  routeur.put('/informations-personnelles/adresse', connecte, modifierAdresse);
  routeur.put('/informations-personnelles/situation', connecte, modifierSituation);
  routeur.put('/informations-personnelles/coordonnees', connecte, modifierCoordonnees);
  routeur.put('/informations-personnelles/identite', connecte, modifierIdentite);
  return routeur;
}
