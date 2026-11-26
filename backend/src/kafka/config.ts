// Kafka partagé de la plateforme (helm.yaml, envList du backend) :
//   KAFKA_BOOTSTRAP_SERVERS  adresse(s) du cluster, séparées par des virgules
//                            (dev : kafka-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092)
//   KAFKA_TOPIC_*            noms des topics, créés par Kafka au premier envoi
// Variable absente ou vide (poste sans Kafka, qualif...) : envoi désactivé, le reste du
// backend fonctionne.
export type KafkaConfig = { brokers: string[] };

export function kafkaConfig(env: NodeJS.ProcessEnv = process.env): KafkaConfig | null {
  const brokers = (env.KAFKA_BOOTSTRAP_SERVERS ?? '')
    .split(',')
    .map((adresse) => adresse.trim())
    .filter(Boolean);
  return brokers.length > 0 ? { brokers } : null;
}

// Topics : <application>.<domaine>.<objet>.v<version> (Kafka partagé entre projets)
export const TOPIC_TEST = 'scpi.outils.test.v1';
// US-12 (SCPI-260) : dossiers transmis à la SCPI partenaire
export const TOPIC_DOSSIER = 'scpi.souscription.dossier.v1';

export function topics(env: NodeJS.ProcessEnv = process.env) {
  return {
    test: env.KAFKA_TOPIC_TEST || TOPIC_TEST,
    dossier: env.KAFKA_TOPIC_DOSSIER || TOPIC_DOSSIER,
  };
}
