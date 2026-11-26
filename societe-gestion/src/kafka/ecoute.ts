import { Consumer, MessagesStreamModes, stringDeserializer } from '@platformatic/kafka';
import type { Logger } from 'pino';
import { logger, nomErreur } from '../logging/logger.js';
import type { Boite } from './boite.js';
import type { KafkaConfig } from './config.js';

// Lecture du topic des dossiers par la société de gestion : depuis le début à chaque
// démarrage (mode earliest, marque-page jamais enregistré), puis en continu. Kafka
// injoignable ou lecture interrompue : nouvelle tentative après un délai, le backend
// continue de répondre. Logs : état de la lecture seulement, jamais le contenu.

// Message reçu de la bibliothèque (champs utiles)
type MessageKafka = {
  partition: number;
  offset: bigint;
  key?: string | null;
  value?: string | null;
  timestamp?: bigint;
};
type Flux = { on(evenement: string, ecouteur: (arg: never) => void): unknown };
export type Lecteur = {
  consume(options: Record<string, unknown>): Promise<Flux>;
  close(force?: boolean): Promise<void>;
};

export type EtatLecture = {
  active: boolean;
  connecte: boolean;
  topic: string | null;
  groupe: string | null;
  erreur: string | null;
};

export const DELAI_REPRISE_MS = 10_000;

function lecteurPlatformatic(config: KafkaConfig): Lecteur {
  return new Consumer({
    clientId: 'societe-gestion',
    groupId: config.groupe,
    bootstrapBrokers: config.brokers,
    deserializers: { key: stringDeserializer, value: stringDeserializer },
    // Lecteur arrêté sans prévenir (redémarrage brutal) : Kafka le déclare absent au bout
    // de 10 s au lieu d'une minute, et le nouveau lecteur du groupe démarre plus vite
    sessionTimeout: 10_000,
    rebalanceTimeout: 10_000,
    heartbeatInterval: 3_000,
  }) as unknown as Lecteur;
}

export function ecouterKafka(
  boite: Boite,
  config: KafkaConfig | null,
  log: Logger = logger,
  creerLecteur: (config: KafkaConfig) => Lecteur = lecteurPlatformatic,
  delaiReprise = DELAI_REPRISE_MS,
) {
  const etat: EtatLecture = {
    active: config !== null,
    connecte: false,
    topic: config?.topic ?? null,
    groupe: config?.groupe ?? null,
    erreur: null,
  };
  let lecteur: Lecteur | null = null;
  let minuterie: NodeJS.Timeout | null = null;
  let arrete = false;

  const reprendre = (err: unknown) => {
    etat.connecte = false;
    etat.erreur = nomErreur(err);
    log.warn(
      { erreur: etat.erreur, delaiMs: delaiReprise },
      'lecture Kafka interrompue, nouvelle tentative',
    );
    void lecteur?.close(true).catch(() => undefined);
    lecteur = null;
    if (!arrete) minuterie = setTimeout(() => void demarrer(), delaiReprise);
  };

  async function demarrer(): Promise<void> {
    if (!config || arrete) return;
    lecteur = creerLecteur(config);
    try {
      const flux = await lecteur.consume({
        topics: [config.topic],
        mode: MessagesStreamModes.EARLIEST,
        autocommit: false,
      });
      etat.connecte = true;
      etat.erreur = null;
      log.info(
        { topic: config.topic, groupe: config.groupe },
        'lecture Kafka démarrée depuis le début',
      );
      flux.on('data', (m: MessageKafka) => {
        boite.ajouter({
          partition: m.partition,
          offset: m.offset,
          cle: m.key ?? null,
          valeur: m.value ?? null,
          horodatage: m.timestamp ?? null,
        });
      });
      flux.on('error', (err: unknown) => reprendre(err));
    } catch (err) {
      reprendre(err);
    }
  }

  if (config) {
    void demarrer();
  } else {
    log.warn('lecture Kafka désactivée : KAFKA_BOOTSTRAP_SERVERS absente');
  }

  return {
    etat: (): EtatLecture => ({ ...etat }),
    async arreter(): Promise<void> {
      arrete = true;
      if (minuterie) clearTimeout(minuterie);
      await lecteur?.close(true);
    },
  };
}

export type Ecoute = ReturnType<typeof ecouterKafka>;
