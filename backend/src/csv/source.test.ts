import { GetObjectCommand } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import { downloadCsv, s3Client, s3Config, streamCsv } from './source.js';

const env = {
  S3_URL: 'https://compte.r2.cloudflarestorage.com/scpi/scpi.csv',
  S3_ACCESS_KEY_ID: 'id-test',
  S3_SECRET_ACCESS_KEY: 'secret-test',
};

describe('s3Config', () => {
  it('découpe S3_URL en service, bucket et fichier ; région "auto" par défaut (R2)', () => {
    expect(s3Config(env)).toEqual({
      endpoint: 'https://compte.r2.cloudflarestorage.com',
      region: 'auto',
      bucket: 'scpi',
      key: 'scpi.csv',
      accessKeyId: 'id-test',
      secretAccessKey: 'secret-test',
    });
  });

  it('région explicite (AWS S3)', () => {
    expect(s3Config({ ...env, S3_REGION: 'eu-west-3' }).region).toBe('eu-west-3');
  });

  it('fichier dans un sous-dossier du bucket', () => {
    const config = s3Config({
      ...env,
      S3_URL: 'https://compte.r2.cloudflarestorage.com/scpi/2026/scpi.csv',
    });
    expect(config.bucket).toBe('scpi');
    expect(config.key).toBe('2026/scpi.csv');
  });

  it('erreur listant toutes les variables manquantes', () => {
    expect(() => s3Config({ S3_ACCESS_KEY_ID: 'id-test' })).toThrow(
      "variables d'environnement manquantes : S3_URL, S3_SECRET_ACCESS_KEY",
    );
  });

  it.each([
    ['pas une URL', 'scpi/scpi.csv'],
    ['sans bucket ni fichier', 'https://compte.r2.cloudflarestorage.com'],
    [
      'bucket sans fichier (adresse affichée par R2)',
      'https://compte.r2.cloudflarestorage.com/scpi',
    ],
  ])('S3_URL invalide : %s', (_cas, url) => {
    expect(() => s3Config({ ...env, S3_URL: url })).toThrow(
      'S3_URL invalide : attendu https://<service>/<bucket>/<fichier>',
    );
  });
});

describe('s3Client', () => {
  it("pointe vers l'endpoint configuré", async () => {
    const client = s3Client(s3Config(env));
    const endpoint = await client.config.endpoint!();
    expect(endpoint.hostname).toBe('compte.r2.cloudflarestorage.com');
    expect(await client.config.region()).toBe('auto');
  });
});

describe('downloadCsv', () => {
  it('renvoie le texte du fichier demandé', async () => {
    const send = vi.fn().mockResolvedValue({
      Body: { transformToString: () => Promise.resolve('Nom,taux\nA,"8.35,8.16"\n') },
    });
    const texte = await downloadCsv({ send }, 'scpi', 'scpi.csv');
    expect(texte).toBe('Nom,taux\nA,"8.35,8.16"\n');
    const commande = send.mock.calls[0][0] as GetObjectCommand;
    expect(commande.input).toEqual({ Bucket: 'scpi', Key: 'scpi.csv' });
  });

  it('erreur si le fichier est vide', async () => {
    const send = vi.fn().mockResolvedValue({});
    await expect(downloadCsv({ send }, 'scpi', 'scpi.csv')).rejects.toThrow(
      'fichier vide ou introuvable : scpi/scpi.csv',
    );
  });
});

describe('streamCsv', () => {
  it('renvoie le flux du fichier demandé', async () => {
    const flux = Readable.from(['Nom,taux\n', 'A,"8.35,8.16"\n']);
    const send = vi.fn().mockResolvedValue({ Body: flux });
    expect(await streamCsv({ send }, 'scpi', 'scpi.csv')).toBe(flux);
    const commande = send.mock.calls[0][0] as GetObjectCommand;
    expect(commande.input).toEqual({ Bucket: 'scpi', Key: 'scpi.csv' });
  });

  it('erreur si le fichier est vide', async () => {
    const send = vi.fn().mockResolvedValue({});
    await expect(streamCsv({ send }, 'scpi', 'scpi.csv')).rejects.toThrow(
      'fichier vide ou introuvable : scpi/scpi.csv',
    );
  });
});
