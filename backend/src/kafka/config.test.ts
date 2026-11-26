import { describe, expect, it } from 'vitest';
import { kafkaConfig, TOPIC_DOSSIER, TOPIC_TEST, topics } from './config.js';

describe('configuration Kafka', () => {
  it('sans KAFKA_BOOTSTRAP_SERVERS : désactivé', () => {
    expect(kafkaConfig({})).toBeNull();
    expect(kafkaConfig({ KAFKA_BOOTSTRAP_SERVERS: ' ' })).toBeNull();
  });

  it('une ou plusieurs adresses, espaces retirés', () => {
    expect(kafkaConfig({ KAFKA_BOOTSTRAP_SERVERS: 'kafka:9092' })).toEqual({
      brokers: ['kafka:9092'],
    });
    expect(kafkaConfig({ KAFKA_BOOTSTRAP_SERVERS: 'a:9092, b:9092,' })).toEqual({
      brokers: ['a:9092', 'b:9092'],
    });
  });

  it('topics : valeurs par défaut, remplaçables par les variables', () => {
    expect(topics({})).toEqual({ test: TOPIC_TEST, dossier: TOPIC_DOSSIER });
    expect(topics({ KAFKA_TOPIC_TEST: 't', KAFKA_TOPIC_DOSSIER: 'd' })).toEqual({
      test: 't',
      dossier: 'd',
    });
  });
});
