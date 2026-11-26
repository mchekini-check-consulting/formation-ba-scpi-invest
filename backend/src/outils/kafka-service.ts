import type { Accuse, CanalKafka } from '../kafka/producteur.js';
import { loggable } from '../logging/service.js';

// Outil de test du canal Kafka (dev et poste uniquement) : envoie un message de test sur
// un topic dédié, jamais sur celui des dossiers lu par la SCPI partenaire (US-12).
export type OutilsKafkaDeps = {
  canal: CanalKafka;
  topic: string;
  pod: string | null;
  maintenant?: () => Date;
};

export function creerOutilsKafkaService(deps: OutilsKafkaDeps) {
  const maintenant = deps.maintenant ?? (() => new Date());
  return loggable('OutilsKafkaService', {
    etat() {
      return { active: deps.canal.active, topic: deps.topic };
    },
    envoyerTest(): Promise<Accuse> {
      return deps.canal.publier(deps.topic, 'test', {
        type: 'test',
        envoyeLe: maintenant().toISOString(),
        pod: deps.pod,
      });
    },
  });
}

export type OutilsKafkaService = ReturnType<typeof creerOutilsKafkaService>;
