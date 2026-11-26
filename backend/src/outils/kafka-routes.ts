import { Router, type RequestHandler } from 'express';
import { seulementEnDev } from './environnement.js';
import type { OutilsKafkaService } from './kafka-service.js';

// Couche contrôleur de l'outil de test du canal Kafka, en dev et en local seulement
// (404 ailleurs) :
//   GET  /outils/kafka/etat -> { active, topic } (sans l'adresse du cluster)
//   POST /outils/kafka/test -> { topic, partition, offset } ; 503 si Kafka désactivé
export function routesOutilsKafka(service: OutilsKafkaService): Router {
  const routeur = Router();

  const lireEtat: RequestHandler = (_req, res) => {
    res.json(service.etat());
  };
  const envoyerTest: RequestHandler = async (_req, res) => {
    res.json(await service.envoyerTest());
  };

  routeur.get('/outils/kafka/etat', seulementEnDev, lireEtat);
  routeur.post('/outils/kafka/test', seulementEnDev, envoyerTest);
  return routeur;
}
