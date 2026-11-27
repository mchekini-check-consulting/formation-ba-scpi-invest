import {
  Consumer,
  MessagesStreamFallbackModes,
  MessagesStreamModes,
  stringDeserializer,
} from '@platformatic/kafka';
import type { Logger } from 'pino';
import { decrireErreur } from '../logging/erreur.js';
import { logger } from '../logging/logger.js';
import { GROUPE_BACKEND, type KafkaConfig } from './config.js';

// Lecture des messages envoyés par la SCPI partenaire (contrat C3) : le seul point du
// backend qui lit Kafka. Chaque fonctionnalité branche son traitement sur son topic
// (US-13 : accusé de réception ; US-14 : décision...), sans connaître la bibliothèque.
//
// - Un message à la fois, dans l'ordre. Le marque-page du groupe est enregistré dans Kafka
//   (commit) seulement après un traitement réussi : après une erreur (base ou Kafka
//   indisponible), la lecture reprend après un délai, au même message. Les traitements
//   reconnaissent donc un message déjà traité (règle C3 : doublon par idMessage).
// - Premier démarrage du groupe : lecture depuis le début du topic, pour ne perdre aucun
//   message publié avant.
// - Plusieurs réplicas : même groupe, Kafka donne chaque partition à un seul d'entre eux.
// - Logs : état de la lecture seulement, jamais la clé ni le contenu des messages.

// Message tel que lu dans Kafka (clé et valeur en texte)
export type MessageLu = { topic: string; cle: string | null; valeur: string | null };
export type Traitement = (message: MessageLu) => Promise<unknown>;

// Message reçu de la bibliothèque (champs utiles)
type MessageKafka = {
  topic: string;
  key?: string | null;
  value?: string | null;
  commit(): void | Promise<void>;
};
export type Lecteur = {
  consume(options: Record<string, unknown>): Promise<AsyncIterable<MessageKafka>>;
  close(force?: boolean): Promise<void>;
};

export type EtatLecteur = {
  active: boolean;
  connecte: boolean;
  topics: string[];
  erreur: string | null;
};

export const DELAI_REPRISE_MS = 10_000;

function lecteurPlatformatic(config: KafkaConfig): Lecteur {
  return new Consumer({
    clientId: 'scpi-invest-backend',
    groupId: GROUPE_BACKEND,
    bootstrapBrokers: config.brokers,
    // Topic pas encore créé (la SCPI n'a encore rien envoyé) : Kafka le crée, au lieu
    // d'une erreur « Unknown topic » (consigne des devops, comme le producteur)
    autocreateTopics: true,
    deserializers: { key: stringDeserializer, value: stringDeserializer },
    // Réplica arrêté sans prévenir : Kafka donne ses partitions à un autre au bout de 10 s
    sessionTimeout: 10_000,
    rebalanceTimeout: 10_000,
    heartbeatInterval: 3_000,
  }) as unknown as Lecteur;
}

export function lireKafka(
  traitements: Record<string, Traitement>,
  config: KafkaConfig | null,
  log: Logger = logger,
  creerLecteur: (config: KafkaConfig) => Lecteur = lecteurPlatformatic,
  delaiReprise = DELAI_REPRISE_MS,
) {
  const topics = Object.keys(traitements);
  const etat: EtatLecteur = { active: config !== null, connecte: false, topics, erreur: null };
  let lecteur: Lecteur | null = null;
  let minuterie: NodeJS.Timeout | null = null;
  let arrete = false;

  const reprendre = (err: unknown) => {
    const erreur = decrireErreur(err);
    etat.connecte = false;
    etat.erreur = erreur.error;
    log.warn({ ...erreur, delaiMs: delaiReprise }, 'lecture Kafka interrompue, nouvelle tentative');
    void lecteur?.close(true).catch(() => undefined);
    lecteur = null;
    if (!arrete) minuterie = setTimeout(() => void demarrer(), delaiReprise);
  };

  async function demarrer(): Promise<void> {
    if (!config || arrete) return;
    lecteur = creerLecteur(config);
    try {
      const flux = await lecteur.consume({
        topics,
        mode: MessagesStreamModes.COMMITTED,
        fallbackMode: MessagesStreamFallbackModes.EARLIEST,
        autocommit: false,
      });
      etat.connecte = true;
      etat.erreur = null;
      log.info({ topics, groupe: GROUPE_BACKEND }, 'lecture Kafka démarrée');
      for await (const m of flux) {
        if (arrete) return;
        await traitements[m.topic]?.({
          topic: m.topic,
          cle: m.key ?? null,
          valeur: m.value ?? null,
        });
        await m.commit();
      }
      // Flux fermé sans erreur alors que le backend tourne : on relance la lecture
      throw new Error('flux Kafka terminé');
    } catch (err) {
      if (!arrete) reprendre(err);
    }
  }

  if (config) {
    void demarrer();
  } else {
    log.warn('lecture Kafka désactivée : KAFKA_BOOTSTRAP_SERVERS absente');
  }

  return {
    etat: (): EtatLecteur => ({ ...etat, topics: [...topics] }),
    async arreter(): Promise<void> {
      arrete = true;
      if (minuterie) clearTimeout(minuterie);
      await lecteur?.close(true);
    },
  };
}

export type LectureKafka = ReturnType<typeof lireKafka>;
