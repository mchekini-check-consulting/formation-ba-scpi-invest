import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../logging/http-error.js';
import { PDF } from './exemple.js';
import { STOCKAGE_INDISPONIBLE, stockagePieces, stockageR2 } from './stockage.js';

describe('stockage des pièces dans R2', () => {
  it('dépôt : PutObject dans le bucket, avec le format', async () => {
    const client = { send: vi.fn().mockResolvedValue({}) };
    await stockageR2(client, 'kyc-docs').deposer('kyc/u1/rib', PDF, 'application/pdf');
    const commande = client.send.mock.calls[0][0];
    expect(commande).toBeInstanceOf(PutObjectCommand);
    expect(commande.input).toEqual({
      Bucket: 'kyc-docs',
      Key: 'kyc/u1/rib',
      Body: PDF,
      ContentType: 'application/pdf',
    });
  });

  it('suppression : DeleteObject', async () => {
    const client = { send: vi.fn().mockResolvedValue({}) };
    await stockageR2(client, 'kyc-docs').supprimer('kyc/u1/rib');
    const commande = client.send.mock.calls[0][0];
    expect(commande).toBeInstanceOf(DeleteObjectCommand);
    expect(commande.input).toEqual({ Bucket: 'kyc-docs', Key: 'kyc/u1/rib' });
  });

  it('sans variables R2 : dépôt et suppression répondent 503', async () => {
    const stockage = stockagePieces({});
    for (const appel of [stockage.deposer('c', PDF, 'image/png'), stockage.supprimer('c')]) {
      const err = await appel.catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(503);
      expect((err as HttpError).message).toBe(STOCKAGE_INDISPONIBLE);
    }
  });

  it('avec les variables R2 : stockage R2 configuré', () => {
    const stockage = stockagePieces({
      S3_URL: 'https://compte.r2.cloudflarestorage.com/scpi/scpi.csv',
      S3_ACCESS_KEY_ID: 'id',
      S3_SECRET_ACCESS_KEY: 'secret',
      KYC_S3_BUCKET: 'kyc-docs',
    });
    expect(typeof stockage.deposer).toBe('function');
  });
});
