import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import type { Db } from '../db/index.js';
import { COLONNES } from './convert.js';
import { importScpis } from './import.js';
import {
  archiverCsv,
  cleArchive,
  dateFichier,
  decrireCsv,
  deposerCsv,
  downloadCsv,
  lignesCsv,
  s3Client,
  s3Config,
  sourceR2,
  streamCsv,
} from './source.js';

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
      supprimerSource: false,
    });
  });

  it.each([
    ['true', true],
    ['false', false],
    ['oui', false],
  ])('CSV_ARCHIVE_DELETE_SOURCE=%s -> supprimerSource %s', (valeur, attendu) => {
    expect(s3Config({ ...env, CSV_ARCHIVE_DELETE_SOURCE: valeur }).supprimerSource).toBe(attendu);
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

describe('outil de test : dépôt et description du fichier', () => {
  it('deposerCsv : écrit le contenu tel quel à la place du fichier lu par l’import', async () => {
    const send = vi.fn().mockResolvedValue({});
    const contenu = Buffer.from('Nom\nHorizon\n');
    await deposerCsv({ send }, 'scpi', 'scpi.csv', contenu);

    const envoi = send.mock.calls[0][0] as PutObjectCommand;
    expect(envoi).toBeInstanceOf(PutObjectCommand);
    expect(envoi.input).toEqual({
      Bucket: 'scpi',
      Key: 'scpi.csv',
      Body: contenu,
      ContentType: 'text/csv',
    });
  });

  it('decrireCsv : taille, date, etag et type, sans lire le fichier', async () => {
    const send = vi.fn().mockResolvedValue({
      ContentLength: 4096,
      LastModified: new Date('2026-11-06T13:32:00Z'),
      ETag: '"abc"',
      ContentType: 'text/csv',
    });
    expect(await decrireCsv({ send }, 'scpi', 'scpi.csv')).toEqual({
      taille: 4096,
      modifieLe: '2026-11-06T13:32:00.000Z',
      etag: '"abc"',
      typeContenu: 'text/csv',
    });
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
  });

  it('decrireCsv : métadonnées absentes -> null champ par champ', async () => {
    const send = vi.fn().mockResolvedValue({});
    expect(await decrireCsv({ send }, 'scpi', 'scpi.csv')).toEqual({
      taille: null,
      modifieLe: null,
      etag: null,
      typeContenu: null,
    });
  });

  it('decrireCsv : aucun fichier -> null', async () => {
    const absent = Object.assign(new Error('NotFound'), { name: 'NotFound' });
    expect(await decrireCsv({ send: vi.fn().mockRejectedValue(absent) }, 'scpi', 'x')).toBeNull();
  });

  it('decrireCsv : autre erreur (accès refusé) relancée', async () => {
    const send = vi.fn().mockRejectedValue(new Error('AccessDenied'));
    await expect(decrireCsv({ send }, 'scpi', 'x')).rejects.toThrow('AccessDenied');
  });
});

describe('archivage', () => {
  it('dateFichier : jour à Paris, pas en heure universelle', () => {
    expect(dateFichier(new Date('2026-11-03T23:30:00Z'))).toBe('20261104'); // 0h30 à Paris
    expect(dateFichier(new Date('2026-07-01T10:00:00Z'))).toBe('20260701');
  });

  it('cleArchive : archives/scpi_catalogue_AAAAMMJJ.csv', () => {
    expect(cleArchive(new Date('2026-11-04T01:00:00Z'))).toBe(
      'archives/scpi_catalogue_20261104.csv',
    );
  });

  it('copie sans supprimer l’original (interrupteur à false)', async () => {
    const send = vi.fn().mockResolvedValue({});
    await archiverCsv({ send }, 'scpi', 'depot/scpi du jour.csv', 'archives/a.csv', false);

    expect(send).toHaveBeenCalledTimes(1);
    const copie = send.mock.calls[0][0] as CopyObjectCommand;
    expect(copie).toBeInstanceOf(CopyObjectCommand);
    expect(copie.input).toEqual({
      Bucket: 'scpi',
      Key: 'archives/a.csv',
      CopySource: 'scpi/depot/scpi%20du%20jour.csv',
    });
  });

  it('copie puis supprime l’original (interrupteur à true)', async () => {
    const send = vi.fn().mockResolvedValue({});
    await archiverCsv({ send }, 'scpi', 'scpi.csv', 'archives/a.csv', true);

    const commandes = send.mock.calls.map((c) => c[0]);
    expect(commandes[0]).toBeInstanceOf(CopyObjectCommand);
    expect(commandes[1]).toBeInstanceOf(DeleteObjectCommand);
    expect((commandes[1] as DeleteObjectCommand).input).toEqual({
      Bucket: 'scpi',
      Key: 'scpi.csv',
    });
  });

  it('copie en échec : l’original n’est jamais supprimé', async () => {
    const send = vi.fn().mockRejectedValue(new Error('AccessDenied'));
    await expect(archiverCsv({ send }, 'scpi', 'scpi.csv', 'archives/a.csv', true)).rejects.toThrow(
      'AccessDenied',
    );
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('lignesCsv', () => {
  it('une ligne par SCPI, colonnes nommées par l’en-tête, BOM et espaces retirés', async () => {
    const lignes = [];
    for await (const l of lignesCsv(Readable.from(['\uFEFFNom, taux\n', 'A,"8.35,8.16"\n\n']))) {
      lignes.push(l);
    }
    expect(lignes).toEqual([{ Nom: 'A', taux: '8.35,8.16' }]);
  });

  it('chaque ligne porte son numéro dans le fichier, lignes vides comprises', async () => {
    const base = fausseBaseVide();
    const csv = Readable.from([
      `${ENTETE}\n`,
      `${ligneValide('A')}\n`,
      '\n',
      `${ligneValide('B').replace('BNPAFRPPXXX', 'X')}\n`,
    ]);
    const bilan = await importScpis(base, lignesCsv(csv));
    expect(bilan.rejets).toEqual([
      { ligne: 4, nom: 'B', motif: 'bic : format invalide (8 ou 11 caractères attendus)' },
    ]);
  });

  // Octets tels que lus dans R2 (Buffer), découpés au milieu d'un caractère accentué
  const octets = (...morceaux: Buffer[]) => Readable.from(morceaux, { objectMode: false });

  it('fichier UTF-8 : accents corrects même coupés entre deux morceaux, BOM retiré', async () => {
    const utf8 = Buffer.from('﻿Nom,Gerant\nA,Gérant\n', 'utf8');
    const lignes = [];
    for await (const l of lignesCsv(octets(utf8.subarray(0, 18), utf8.subarray(18)))) {
      lignes.push(l);
    }
    expect(lignes).toEqual([{ Nom: 'A', Gerant: 'Gérant' }]);
  });

  it('« � » écrit tel quel dans un fichier UTF-8 : accepté (donnée, pas encodage)', async () => {
    const lignes = [];
    for await (const l of lignesCsv(octets(Buffer.from('Nom\nm�tropoles\n', 'utf8')))) {
      lignes.push(l);
    }
    expect(lignes).toEqual([{ Nom: 'm�tropoles' }]);
  });

  // US-07b, scénario 2
  it('fichier en Latin-1 (pas en UTF-8) : fichier entier refusé, motif « encodage »', async () => {
    const latin1 = Buffer.from(`${ENTETE}\n${ligneValide('Métropoles')}\n`, 'latin1');
    await expect(importScpis(fausseBaseVide(), lignesCsv(octets(latin1)))).rejects.toThrow(
      'fichier illisible : encodage invalide (UTF-8 attendu)',
    );
  });

  it('caractère UTF-8 tronqué en fin de fichier : refusé', async () => {
    const tronque = Buffer.from('Nom\né', 'utf8').subarray(0, -1);
    await expect(async () => {
      for await (const _ of lignesCsv(octets(tronque))) {
        // lecture jusqu'à l'erreur
      }
    }).rejects.toThrow('encodage invalide (UTF-8 attendu)');
  });
});

// Fichier CSV complet, lu puis importé dans une fausse base sans SCPI existante
const ENTETE = COLONNES.join(',');
function ligneValide(nom: string) {
  return `${nom},,1000,"France,100","Bureaux,100",200,1000000,G,10,10,3,Mensuelle,,FR7630001007941234567890185,BNPAFRPPXXX,,Non,,Non,Texte`;
}
function fausseBaseVide(): Db {
  const tx = {
    select: () => ({ from: () => Promise.resolve([]) }),
    insert: () => ({
      values: () =>
        Object.assign(Promise.resolve(), { returning: () => Promise.resolve([{ id: 1 }]) }),
    }),
  };
  return { transaction: (fn: (t: typeof tx) => Promise<void>) => fn(tx) } as unknown as Db;
}

describe('sourceR2', () => {
  const config = s3Config({ ...env, CSV_ARCHIVE_DELETE_SOURCE: 'true' });

  it('fichier = clé de S3_URL ; lire renvoie les lignes', async () => {
    const send = vi.fn().mockResolvedValue({ Body: Readable.from(['Nom\nA\n']) });
    const source = sourceR2({ send }, config);

    expect(source.fichier).toBe('scpi.csv');
    const lignes = [];
    for await (const l of (await source.lire())!) lignes.push(l);
    expect(lignes).toEqual([{ Nom: 'A' }]);
  });

  it('fichier absent (NoSuchKey) : null', async () => {
    const send = vi.fn().mockRejectedValue(new NoSuchKey({ message: 'absent', $metadata: {} }));
    expect(await sourceR2({ send }, config).lire()).toBeNull();
  });

  it('autre erreur de lecture : relancée', async () => {
    const send = vi.fn().mockRejectedValue(new Error('AccessDenied'));
    await expect(sourceR2({ send }, config).lire()).rejects.toThrow('AccessDenied');
  });

  it('archiver : copie datée du jour, original supprimé selon la configuration', async () => {
    const send = vi.fn().mockResolvedValue({});
    const source = sourceR2({ send }, config, () => new Date('2026-11-04T01:00:00Z'));

    expect(await source.archiver()).toBe('archives/scpi_catalogue_20261104.csv');
    expect(send.mock.calls.map((c) => c[0].constructor)).toEqual([
      CopyObjectCommand,
      DeleteObjectCommand,
    ]);
  });
});
