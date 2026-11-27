import { Router, type RequestHandler } from 'express';
import { seulementEnDev } from '../environnement.js';
import { ErreurEnvoi, type EnvoiAccuses } from './accuses.js';
import type { Boite } from './boite.js';
import type { Ecoute } from './ecoute.js';

// Écran « Boîte de réception de la SCPI » (frontend, outils de test), dev et poste seulement :
//   GET  /messages -> { kafka: état de la lecture, compteurs, messages (plus récent d'abord) }
//   POST /accuses  { idDossier, variante: normal | doublon | invalide } -> 201 { message }
//                  (US-13) ; 400 demande invalide, 409 doublon sans accusé, 503 sans Kafka
// Ouvert sans connexion, comme l'outil d'import ; fermé (404) ailleurs qu'en dev.
export function routesBoite(
  boite: Boite,
  ecoute: Pick<Ecoute, 'etat'>,
  accuses: EnvoiAccuses,
): Router {
  const routeur = Router();
  const lireMessages: RequestHandler = (_req, res) => {
    res.json({ kafka: ecoute.etat(), compteurs: boite.compteurs(), messages: boite.liste() });
  };
  const envoyerAccuse: RequestHandler = async (req, res) => {
    const { idDossier, variante } = (req.body ?? {}) as Record<string, unknown>;
    try {
      res.status(201).json({ message: await accuses.envoyer(idDossier, variante) });
    } catch (err) {
      if (!(err instanceof ErreurEnvoi)) throw err;
      res.status(err.status).json({ message: err.message });
    }
  };
  routeur.get('/messages', seulementEnDev, lireMessages);
  routeur.post('/accuses', seulementEnDev, envoyerAccuse);
  return routeur;
}
