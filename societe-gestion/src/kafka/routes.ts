import { Router, type RequestHandler } from 'express';
import { seulementEnDev } from '../environnement.js';
import type { Boite } from './boite.js';
import type { Ecoute } from './ecoute.js';

// Écran « Boîte de réception de la SCPI » (frontend, outils de test), dev et poste seulement :
//   GET /messages -> { kafka: état de la lecture, compteurs, messages (plus récent d'abord) }
// Ouvert sans connexion, comme l'outil d'import ; fermé (404) ailleurs qu'en dev.
export function routesBoite(boite: Boite, ecoute: Pick<Ecoute, 'etat'>): Router {
  const routeur = Router();
  const lireMessages: RequestHandler = (_req, res) => {
    res.json({ kafka: ecoute.etat(), compteurs: boite.compteurs(), messages: boite.liste() });
  };
  routeur.get('/messages', seulementEnDev, lireMessages);
  return routeur;
}
