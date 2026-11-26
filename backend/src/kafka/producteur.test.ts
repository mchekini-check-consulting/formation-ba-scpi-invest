import { describe, expect, it, vi } from 'vitest';
import { captureLogs } from '../logging/capture.js';
import { HttpError } from '../logging/http-error.js';
import {
  canalIndisponible,
  canalKafka,
  creerCanalKafka,
  KAFKA_DESACTIVE,
  type ProducteurKafka,
} from './producteur.js';

function fauxProducteur(
  send = vi.fn().mockResolvedValue({ offsets: [{ topic: 't', partition: 2, offset: 7n }] }),
) {
  return { send, close: vi.fn().mockResolvedValue(undefined) };
}

const canal = (producteur: ReturnType<typeof fauxProducteur>, log = captureLogs().log) =>
  canalKafka(producteur as unknown as ProducteurKafka, log);

describe('canal Kafka', () => {
  it('publie le message avec sa clé et renvoie l’accusé', async () => {
    const producteur = fauxProducteur();
    const accuse = await canal(producteur).publier('t', 'D-1041', { idDossier: 'D-1041' });
    expect(accuse).toEqual({ topic: 't', partition: 2, offset: '7' });
    expect(producteur.send).toHaveBeenCalledWith({
      messages: [{ topic: 't', key: 'D-1041', value: { idDossier: 'D-1041' } }],
    });
    expect(canal(producteur).active).toBe(true);
  });

  it('accusé sans offsets : partition et offset à null', async () => {
    const producteur = fauxProducteur(vi.fn().mockResolvedValue({}));
    const accuse = await canal(producteur).publier('t', 'a', {});
    expect(accuse).toEqual({ topic: 't', partition: null, offset: null });
  });

  it('Kafka injoignable : erreur relancée', async () => {
    const producteur = fauxProducteur(vi.fn().mockRejectedValue(new Error('Connection refused')));
    await expect(canal(producteur).publier('t', 'a', {})).rejects.toThrow('Connection refused');
  });

  it('jamais le contenu ni la clé du message dans les logs (US-12 RG5)', async () => {
    const { log, lignes } = captureLogs('debug');
    const producteur = fauxProducteur(vi.fn().mockRejectedValue(new Error('refusé')));
    await expect(
      canal(producteur, log).publier('t', 'D-1041', { nom: 'Martin' }),
    ).rejects.toThrow();
    expect(lignes.at(-1)).toMatchObject({
      layer: 'service',
      class: 'KafkaService',
      method: 'publier',
    });
    const texte = JSON.stringify(lignes);
    expect(texte).not.toContain('Martin');
    expect(texte).not.toContain('D-1041');
  });

  it('fermer : ferme le producteur', async () => {
    const producteur = fauxProducteur();
    await canal(producteur).fermer();
    expect(producteur.close).toHaveBeenCalledTimes(1);
  });
});

describe('canal indisponible', () => {
  it('sans configuration : 503 à l’envoi', async () => {
    const indisponible = canalIndisponible();
    expect(indisponible.active).toBe(false);
    const erreur = await indisponible.publier('t', 'a', {}).catch((err: unknown) => err);
    expect(erreur).toBeInstanceOf(HttpError);
    expect(erreur).toMatchObject({ status: 503, message: KAFKA_DESACTIVE });
    await expect(indisponible.fermer()).resolves.toBeUndefined();
  });
});

describe('creerCanalKafka', () => {
  it('choisit le canal selon KAFKA_BOOTSTRAP_SERVERS, sans se connecter', async () => {
    expect(creerCanalKafka({}).active).toBe(false);
    const actif = creerCanalKafka({ KAFKA_BOOTSTRAP_SERVERS: 'localhost:1' });
    expect(actif.active).toBe(true);
    await actif.fermer();
  });
});
