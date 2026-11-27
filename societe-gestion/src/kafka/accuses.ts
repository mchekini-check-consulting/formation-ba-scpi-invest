import { randomUUID } from 'node:crypto';
import { jsonSerializer, Producer, stringSerializer } from '@platformatic/kafka';
import type { KafkaConfig } from './config.js';

// Outil de test (EN-04 RG2, US-13) : la SCPI simulée envoie à SCPI Invest l'accusé de
// réception d'un dossier, sur scpi.souscription.accuse-reception.v1 (contrat C3 :
// idMessage, idDossier, dateReception). Trois variantes pour démontrer les règles C3 :
//   normal   -> nouvel idMessage, date de maintenant
//   doublon  -> renvoie à l'identique le dernier accusé envoyé pour ce dossier
//   invalide -> sans dateReception (champ obligatoire absent)
// Le message ne contient aucune donnée de l'investisseur.
export const VARIANTES = ['normal', 'doublon', 'invalide'] as const;
export type Variante = (typeof VARIANTES)[number];

export type MessageAccuse = { idMessage: string; idDossier: string; dateReception?: string };
export type Publier = (topic: string, cle: string, message: object) => Promise<unknown>;

// Erreur à renvoyer telle quelle à l'écran (code HTTP + message en français)
export class ErreurEnvoi extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ErreurEnvoi';
  }
}

export const KAFKA_DESACTIVE =
  'Envoi Kafka désactivé : KAFKA_BOOTSTRAP_SERVERS absente dans cet environnement.';
const FORMAT_DOSSIER = /^D-\d+$/;

export function creerEnvoiAccuses(
  publier: Publier | null,
  topic: string,
  maintenant = () => new Date(),
  nouvelId: () => string = randomUUID,
) {
  // Dernier accusé envoyé par dossier (mémoire, comme la boîte) : pour la variante doublon
  const derniers = new Map<string, MessageAccuse>();

  return {
    async envoyer(idDossier: unknown, variante: unknown): Promise<MessageAccuse> {
      if (typeof idDossier !== 'string' || !FORMAT_DOSSIER.test(idDossier)) {
        throw new ErreurEnvoi(400, 'idDossier attendu au format D-<numéro>.');
      }
      if (!VARIANTES.includes(variante as Variante)) {
        throw new ErreurEnvoi(400, `variante attendue : ${VARIANTES.join(', ')}.`);
      }
      if (!publier) throw new ErreurEnvoi(503, KAFKA_DESACTIVE);

      let message: MessageAccuse;
      if (variante === 'doublon') {
        const dernier = derniers.get(idDossier);
        if (!dernier) {
          throw new ErreurEnvoi(409, 'Aucun accusé déjà envoyé pour ce dossier : rien à renvoyer.');
        }
        message = dernier;
      } else {
        message = { idMessage: nouvelId(), idDossier };
        if (variante === 'normal') message.dateReception = maintenant().toISOString();
      }
      await publier(topic, idDossier, message);
      if (variante === 'normal') derniers.set(idDossier, message);
      return message;
    },
  };
}

export type EnvoiAccuses = ReturnType<typeof creerEnvoiAccuses>;

// Producteur Kafka réel ; null sans configuration (envoi désactivé, 503)
export function producteurKafka(config: KafkaConfig | null) {
  if (!config) return null;
  const producteur = new Producer<string, object, string, string>({
    clientId: 'societe-gestion',
    bootstrapBrokers: config.brokers,
    autocreateTopics: true,
    idempotent: true,
    serializers: { key: stringSerializer, value: jsonSerializer },
  });
  const publier: Publier = (topic, cle, message) =>
    producteur.send({ messages: [{ topic, key: cle, value: message }] });
  return { publier, fermer: () => producteur.close() };
}
