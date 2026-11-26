import { jsonSerializer, Producer, stringSerializer } from '@platformatic/kafka';
import type { Logger } from 'pino';
import { HttpError } from '../logging/http-error.js';
import { logger } from '../logging/logger.js';
import { loggable } from '../logging/service.js';
import { kafkaConfig } from './config.js';

// Canal d'envoi vers Kafka : le seul point du backend qui connaît la bibliothèque
// @platformatic/kafka. Les fonctionnalités (US-12 : transmission du dossier) n'appellent
// que publier().
//
// - Le contenu et la clé des messages ne sont jamais journalisés (données de
//   l'investisseur, US-12 RG5) : seulement la méthode, la durée et le résultat.
// - Kafka injoignable : publier() lève une erreur après les tentatives de la bibliothèque,
//   sans rien garder en mémoire. La reprise jusqu'au succès (US-12 RG3) se fait à partir de
//   la base (dossier « non transmis »), pas ici.
// - Connexion au premier envoi (faite par la bibliothèque) : le backend démarre même si
//   Kafka est injoignable.
export type Accuse = { topic: string; partition: number | null; offset: string | null };

export type CanalKafka = {
  active: boolean;
  publier(topic: string, cle: string, message: object): Promise<Accuse>;
  fermer(): Promise<void>;
};

export type ProducteurKafka = Pick<Producer<string, object, string, string>, 'send' | 'close'>;

export const KAFKA_DESACTIVE =
  'Envoi Kafka désactivé : KAFKA_BOOTSTRAP_SERVERS absente dans cet environnement.';

export function canalKafka(producteur: ProducteurKafka, log: Logger = logger): CanalKafka {
  return loggable(
    'KafkaService',
    {
      active: true,
      async publier(topic: string, cle: string, message: object): Promise<Accuse> {
        const { offsets } = await producteur.send({
          messages: [{ topic, key: cle, value: message }],
        });
        const [resultat] = offsets ?? [];
        return {
          topic,
          partition: resultat?.partition ?? null,
          offset: resultat ? String(resultat.offset) : null,
        };
      },
      fermer(): Promise<void> {
        return producteur.close();
      },
    },
    log,
  );
}

// Sans configuration : le reste du backend fonctionne, l'envoi répond 503
export function canalIndisponible(): CanalKafka {
  return {
    active: false,
    async publier() {
      throw new HttpError(503, KAFKA_DESACTIVE);
    },
    async fermer() {},
  };
}

export function creerCanalKafka(
  env: NodeJS.ProcessEnv = process.env,
  log: Logger = logger,
): CanalKafka {
  const config = kafkaConfig(env);
  if (!config) {
    return canalIndisponible();
  }
  const producteur = new Producer<string, object, string, string>({
    clientId: 'scpi-invest-backend',
    bootstrapBrokers: config.brokers,
    // Le topic est créé par Kafka au premier envoi (consigne des devops)
    autocreateTopics: true,
    // Pas de doublon si la bibliothèque renvoie un message après une coupure réseau
    idempotent: true,
    serializers: { key: stringSerializer, value: jsonSerializer },
  });
  return canalKafka(producteur, log);
}
