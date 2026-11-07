import express, { Router, type RequestHandler } from 'express';
import { HttpError } from '../logging/http-error.js';
import { seulementEnDev } from './environnement.js';
import type { OutilsImportService } from './service.js';

// Couche contrôleur de l'outil de test de l'import du catalogue, ouverte à tous mais en
// dev et en local seulement (404 ailleurs) :
//   GET  /outils/import-catalogue/etat      -> serveur, stockage R2, fichier déposé, planification
//   PUT  /outils/import-catalogue/fichier   corps = le CSV brut (10 Mo maximum) -> { cle, taille, deposeLe }
//   POST /outils/import-catalogue/lancement -> { issue, erreur, dureeMs, rapport } ; 409 import déjà en cours
//   GET  /outils/import-catalogue/rapports?limite=50 -> rapports d'exécution, du plus récent au plus ancien
//   GET  /outils/import-catalogue/catalogue -> catalogue en base, avec ses tables liées
export const TAILLE_MAX_CSV = 10 * 1024 * 1024;
export const MESSAGE_TROP_GROS = 'Fichier trop volumineux (10 Mo maximum).';

export function routesOutilsImport(service: OutilsImportService): Router {
  const routeur = Router();

  const corpsBrut = express.raw({ type: () => true, limit: TAILLE_MAX_CSV });
  const lireCsv: RequestHandler = (req, res, next) => {
    corpsBrut(req, res, (err?: unknown) => {
      const trop = (err as { status?: number } | undefined)?.status === 413;
      next(
        err
          ? new HttpError(trop ? 413 : 400, trop ? MESSAGE_TROP_GROS : 'Fichier illisible.')
          : undefined,
      );
    });
  };

  const lireEtat: RequestHandler = async (_req, res) => {
    res.json(await service.etat());
  };
  const deposerFichier: RequestHandler = async (req, res) => {
    res.json(await service.deposer(req.body));
  };
  const lancerImport: RequestHandler = async (_req, res) => {
    res.json(await service.importer());
  };
  const listerRapports: RequestHandler = async (req, res) => {
    res.json(await service.rapports(req.query.limite));
  };
  const lireCatalogue: RequestHandler = async (_req, res) => {
    res.json(await service.catalogue());
  };

  const base = '/outils/import-catalogue';
  routeur.get(`${base}/etat`, seulementEnDev, lireEtat);
  routeur.put(`${base}/fichier`, seulementEnDev, lireCsv, deposerFichier);
  routeur.post(`${base}/lancement`, seulementEnDev, lancerImport);
  routeur.get(`${base}/rapports`, seulementEnDev, listerRapports);
  routeur.get(`${base}/catalogue`, seulementEnDev, lireCatalogue);
  return routeur;
}
