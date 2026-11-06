import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { parse } from 'csv-parse';
// pipeline de Node : transmet les erreurs du flux au parseur
import { pipeline, Transform, type Readable } from 'node:stream';
import { numeroter } from './import.js';
import type { SourceCsv } from './service.js';

// Lecture du CSV des SCPI dans un stockage compatible S3 (Cloudflare R2 aujourd'hui).
// Configuration par variables d'environnement (.env.example), jamais dans le code.
export type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  // Interrupteur : supprimer le fichier déposé après l'avoir archivé (sinon, copie seule)
  supprimerSource: boolean;
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
    supprimerSource: env.CSV_ARCHIVE_DELETE_SOURCE === 'true',
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

// ---- Outil de test de l'import (dev uniquement, outils-service.ts)

// Remplace le fichier lu par l'import par le contenu envoyé, tel quel (un fichier mal
// encodé doit arriver intact pour vérifier que l'import le refuse)
export async function deposerCsv(
  client: Pick<S3Client, 'send'>,
  bucket: string,
  key: string,
  contenu: Buffer,
): Promise<void> {
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: contenu, ContentType: 'text/csv' }),
  );
}

export type DescriptionCsv = {
  taille: number | null;
  modifieLe: string | null;
  etag: string | null;
  typeContenu: string | null;
};

// Métadonnées du fichier déposé, sans le lire ; null : aucun fichier
export async function decrireCsv(
  client: Pick<S3Client, 'send'>,
  bucket: string,
  key: string,
): Promise<DescriptionCsv | null> {
  try {
    const r = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return {
      taille: r.ContentLength ?? null,
      modifieLe: r.LastModified?.toISOString() ?? null,
      etag: r.ETag ?? null,
      typeContenu: r.ContentType ?? null,
    };
  } catch (err) {
    if (err instanceof Error && (err.name === 'NotFound' || err.name === 'NoSuchKey')) return null;
    throw err;
  }
}

// ---- Archivage (US-07a, scénario 4)

// AAAAMMJJ du jour à Paris (le serveur peut être à l'heure universelle)
export function dateFichier(date: Date): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replaceAll('-', '');
}

// R2 n'a pas de vrais dossiers : "archives/" est le début du nom du fichier
export function cleArchive(date: Date): string {
  return `archives/scpi_catalogue_${dateFichier(date)}.csv`;
}

// R2 ne sait pas déplacer : copie sous le nouveau nom, puis suppression si demandée
export async function archiverCsv(
  client: Pick<S3Client, 'send'>,
  bucket: string,
  key: string,
  archive: string,
  supprimerSource: boolean,
): Promise<void> {
  const source = `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  await client.send(new CopyObjectCommand({ Bucket: bucket, Key: archive, CopySource: source }));
  if (supprimerSource) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}

// Décode le fichier en UTF-8 et refuse le fichier entier (US-07b, scénario 2) dès qu'un
// octet n'est pas de l'UTF-8 (fichier enregistré en Latin-1 / Windows-1252 par exemple),
// au lieu de le remplacer en silence par "�". Un "�" écrit tel quel dans un fichier UTF-8
// valide reste accepté : c'est une donnée, pas un problème d'encodage.
export function decoderUtf8(): Transform {
  const decodeur = new TextDecoder('utf-8', { fatal: true }); // retire aussi le BOM
  const decoder = (fn: () => string, done: (err?: Error | null, texte?: string) => void) => {
    try {
      done(null, fn());
    } catch {
      done(new Error('encodage invalide (UTF-8 attendu)'));
    }
  };
  return new Transform({
    readableObjectMode: true, // pousse du texte, pas des octets
    // texte déjà décodé (tests) : transmis tel quel
    transform: (chunk: Buffer | string, _encoding, done) =>
      decoder(
        () => (typeof chunk === 'string' ? chunk : decodeur.decode(chunk, { stream: true })),
        done,
      ),
    flush: (done) => decoder(() => decodeur.decode(), done),
  });
}

// Lignes du CSV (en-tête = noms des colonnes), lues au fil du flux. Chaque ligne porte
// son numéro dans le fichier (NUMERO_LIGNE, en-tête = 1), pour le rapport des rejets.
export function lignesCsv(body: Readable): AsyncIterable<Record<string, string>> {
  return pipeline(
    body,
    decoderUtf8(),
    parse({
      columns: true,
      trim: true,
      skip_empty_lines: true,
      bom: true,
      on_record: (record: Record<string, string>, { lines }) => numeroter(record, lines),
    }),
    () => {},
  ) as AsyncIterable<Record<string, string>>;
}

// Source du service d'import : le fichier fixe de S3_URL dans R2
export function sourceR2(
  client: Pick<S3Client, 'send'>,
  config: S3Config,
  maintenant: () => Date = () => new Date(),
): SourceCsv {
  return {
    fichier: config.key,
    async lire() {
      try {
        return lignesCsv(await streamCsv(client, config.bucket, config.key));
      } catch (err) {
        if (err instanceof Error && err.name === 'NoSuchKey') return null; // aucun fichier déposé
        throw err;
      }
    },
    async archiver() {
      const archive = cleArchive(maintenant());
      await archiverCsv(client, config.bucket, config.key, archive, config.supprimerSource);
      return archive;
    },
  };
}
