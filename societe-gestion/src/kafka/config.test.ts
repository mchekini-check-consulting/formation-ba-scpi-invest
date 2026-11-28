import { describe, expect, it } from 'vitest';
import { GROUPE, kafkaConfig, TOPIC_ACCUSE_RECEPTION, TOPIC_DOSSIER } from './config.js';

describe('configuration Kafka de la société de gestion', () => {
  it('sans KAFKA_BOOTSTRAP_SERVERS : désactivée', () => {
    expect(kafkaConfig({})).toBeNull();
    expect(kafkaConfig({ KAFKA_BOOTSTRAP_SERVERS: ' , ' })).toBeNull();
  });

  it('adresses, topic des dossiers par défaut, groupe propre', () => {
    expect(kafkaConfig({ KAFKA_BOOTSTRAP_SERVERS: 'a:9092, b:9092' })).toEqual({
      brokers: ['a:9092', 'b:9092'],
      topic: TOPIC_DOSSIER,
      groupe: GROUPE,
      topicAccuse: TOPIC_ACCUSE_RECEPTION,
    });
    expect(
      kafkaConfig({
        KAFKA_BOOTSTRAP_SERVERS: 'a:9092',
        KAFKA_TOPIC_DOSSIER: 't',
        KAFKA_TOPIC_ACCUSE_RECEPTION: 'a',
      }),
    ).toMatchObject({ topic: 't', topicAccuse: 'a' });
  });
});
