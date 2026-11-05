import { DeleteObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { s3Client, s3Config } from '../csv/source.js';
import { HttpError } from '../logging/http-error.js';
import type { StockagePieces } from './pieces-service.js';

// Fichiers des pièces justificatives (US-04c) dans Cloudflare R2, avec la clé d'API du
// catalogue (variables S3_* du Secret backend-s3). Bucket : celui de S3_URL, ou
// KYC_S3_BUCKET s'il est renseigné. R2 chiffre tous les fichiers au repos ; le bucket
// n'est pas public : seul le backend (et l'agent de vérification) y accède avec la clé.

export const STOCKAGE_INDISPONIBLE =
  'Le dépôt des pièces est momentanément indisponible, réessayez dans quelques instants.';

export function stockageR2(client: Pick<S3Client, 'send'>, bucket: string): StockagePieces {
  return {
    async deposer(cle, contenu, format) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: cle, Body: contenu, ContentType: format }),
      );
    },
    async supprimer(cle) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: cle }));
    },
  };
}

// Sans variables R2 (poste sans .env) : le reste du KYC fonctionne, le dépôt répond 503
export function stockageIndisponible(): StockagePieces {
  const refuser = async () => {
    throw new HttpError(503, STOCKAGE_INDISPONIBLE);
  };
  return { deposer: refuser, supprimer: refuser };
}

export function stockagePieces(env: NodeJS.ProcessEnv = process.env): StockagePieces {
  try {
    const config = s3Config(env);
    return stockageR2(s3Client(config), env.KYC_S3_BUCKET || config.bucket);
  } catch {
    return stockageIndisponible();
  }
}
