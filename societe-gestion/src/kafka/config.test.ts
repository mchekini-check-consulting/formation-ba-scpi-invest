import { describe, expect, it } from 'vitest';
import { GROUPE, kafkaConfig, TOPIC_DOSSIER } from './config.js';

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
    });
    expect(
      kafkaConfig({ KAFKA_BOOTSTRAP_SERVERS: 'a:9092', KAFKA_TOPIC_DOSSIER: 't' })?.topic,
    ).toBe('t');
  });
});
