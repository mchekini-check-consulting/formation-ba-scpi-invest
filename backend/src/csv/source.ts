import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';

// Lecture du CSV des SCPI dans un stockage compatible S3 (Cloudflare R2 aujourd'hui).
// Configuration par variables d'environnement (.env.example), jamais dans le code.
export type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
};

const REQUIRED = ['S3_URL', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const;

// S3_URL = https://<service>/<bucket>/<fichier> (forme affichée par R2, acceptée par AWS S3)
export function s3Config(env: NodeJS.ProcessEnv = process.env): S3Config {
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`variables d'environnement manquantes : ${missing.join(', ')}`);
  }
  const url = URL.parse(env.S3_URL!);
  const [bucket, ...path] = url?.pathname.split('/').filter(Boolean) ?? [];
  if (!url || !bucket || path.length === 0) {
    throw new Error('S3_URL invalide : attendu https://<service>/<bucket>/<fichier>');
  }
  return {
    endpoint: url.origin,
    region: env.S3_REGION ?? 'auto', // R2 : toujours "auto"
    bucket,
    key: path.join('/'),
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
  };
}

export function s3Client(config: S3Config): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
}

// Contenu texte du fichier ; seule fonction qui sait d’où vient le CSV (import.ts reçoit le texte)
export async function downloadCsv(
  client: Pick<S3Client, 'send'>,
  bucket: string,
  key: string,
): Promise<string> {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) {
    throw new Error(`fichier vide ou introuvable : ${bucket}/${key}`);
  }
  return response.Body.transformToString('utf-8');
}

// Même fichier, lu en flux (gros fichiers) : à brancher sur csv-parse avec .pipe(parse(...))
export async function streamCsv(
  client: Pick<S3Client, 'send'>,
  bucket: string,
  key: string,
): Promise<Readable> {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) {
    throw new Error(`fichier vide ou introuvable : ${bucket}/${key}`);
  }
  return response.Body as Readable; // en Node.js, Body est un flux Readable
}
