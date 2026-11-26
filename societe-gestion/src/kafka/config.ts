// Kafka partagé de la plateforme (helm.yaml, envList de societe-gestion) :
//   KAFKA_BOOTSTRAP_SERVERS  adresse(s) du cluster, séparées par des virgules (dev seulement)
//   KAFKA_TOPIC_DOSSIER      topic des dossiers publiés par SCPI Invest (US-12, contrat C3)
// Variable absente ou vide (poste sans Kafka, qualif...) : lecture désactivée, le backend
// démarre quand même.
export const TOPIC_DOSSIER = 'scpi.souscription.dossier.v1';
// Groupe de lecture propre à la société de gestion : ne gêne aucun autre lecteur du topic
export const GROUPE = 'societe-gestion';

export type KafkaConfig = { brokers: string[]; topic: string; groupe: string };

export function kafkaConfig(env: NodeJS.ProcessEnv = process.env): KafkaConfig | null {
  const brokers = (env.KAFKA_BOOTSTRAP_SERVERS ?? '')
    .split(',')
    .map((adresse) => adresse.trim())
    .filter(Boolean);
  if (brokers.length === 0) return null;
  return { brokers, topic: env.KAFKA_TOPIC_DOSSIER || TOPIC_DOSSIER, groupe: GROUPE };
}
