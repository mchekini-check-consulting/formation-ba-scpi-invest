import { Router, type RequestHandler } from 'express';
import { exigerConnexion, type FournisseurIdentite } from '../auth/fournisseur.js';
import type { QuestionnaireService } from './service.js';

// Couche contrôleur du formulaire investisseur, réservée aux utilisateurs connectés :
//   GET    /formulaire-investisseur             -> { etapeCourante, reponses, valide }
//   PUT    /formulaire-investisseur/etapes/:n   { ...réponses de l'étape n }    (US-05a)
//                                               -> { etapeCourante, reponses }, 400 si invalide
//   DELETE /formulaire-investisseur/etapes/:n   « Réinitialiser » : efface les réponses
//                                               de l'étape n -> { etapeCourante, reponses }
//   GET    /formulaire-investisseur/profil      -> { profil, avertissements }    (US-05b)
//                                               409 si les 5 étapes ne sont pas complétées
//   POST   /formulaire-investisseur/validation  { certification: true }        (US-05b)
//                                               -> { profil, avertissements }
export function routesQuestionnaire(
  service: QuestionnaireService,
  fournisseur: FournisseurIdentite,
): Router {
  const routeur = Router();
  const connecte = exigerConnexion(fournisseur);

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
  const reinitialiserEtape: RequestHandler = async (req, res) => {
    res.json(await service.reinitialiserEtape(res.locals.utilisateur.id, Number(req.params.etape)));
  };
  const lireProfil: RequestHandler = async (_req, res) => {
    res.json(await service.profil(res.locals.utilisateur.id));
  };
  const validerProfil: RequestHandler = async (req, res) => {
    res.status(201).json(await service.valider(res.locals.utilisateur.id, req.body ?? {}));
  };

  routeur.get('/formulaire-investisseur', connecte, lireQuestionnaire);
  routeur.put('/formulaire-investisseur/etapes/:etape', connecte, enregistrerEtape);
  routeur.delete('/formulaire-investisseur/etapes/:etape', connecte, reinitialiserEtape);
  routeur.get('/formulaire-investisseur/profil', connecte, lireProfil);
  routeur.post('/formulaire-investisseur/validation', connecte, validerProfil);
  return routeur;
}
