import { Router, type RequestHandler } from 'express';
import { exigerConnexion, type FournisseurIdentite } from '../auth/fournisseur.js';
import type { QuestionnaireService } from './service.js';

// Couche contrôleur du formulaire investisseur (US-05a), réservée aux utilisateurs connectés :
//   GET /questionnaire-investisseur             -> { etapeCourante, reponses }
//   PUT /questionnaire-investisseur/etapes/:n   { ...réponses de l'étape n }
//                                               -> { etapeCourante, reponses }, 400 si invalide
export function routesQuestionnaire(
  service: QuestionnaireService,
  fournisseur: FournisseurIdentite,
): Router {
  const routeur = Router();

  const lireQuestionnaire: RequestHandler = async (_req, res) => {
    res.json(await service.lire(res.locals.utilisateur.id));
  };
  const enregistrerEtape: RequestHandler = async (req, res) => {
    res.json(
      await service.enregistrerEtape(
        res.locals.utilisateur.id,
        Number(req.params.etape),
        req.body ?? {},
      ),
    );
  };

  routeur.get('/questionnaire-investisseur', exigerConnexion(fournisseur), lireQuestionnaire);
  routeur.put(
    '/questionnaire-investisseur/etapes/:etape',
    exigerConnexion(fournisseur),
    enregistrerEtape,
  );
  return routeur;
}
