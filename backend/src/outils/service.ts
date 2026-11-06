import type { S3Client } from '@aws-sdk/client-s3';
import type { Logger } from 'pino';
import type { TABLE_IMPORT_RAPPORT } from '../db/schema.js';
import { decrireCsv, deposerCsv, type DescriptionCsv, type S3Config } from '../csv/source.js';
import type { Issue } from '../csv/planification.js';
import { HttpError } from '../logging/http-error.js';
import { logger } from '../logging/logger.js';
import { loggable } from '../logging/service.js';

// Couche service de l'outil de test de l'import du catalogue (dev uniquement,
// environnement.ts) : déposer un CSV sur R2, lancer l'import, et tout montrer pour
// diagnostiquer (fichier sur R2, planification, rapports complets, catalogue en base).

export type RapportImport = typeof TABLE_IMPORT_RAPPORT.$inferSelect;

// Accès aux données (src/db/depots.ts)
export type DepotOutilsImport = {
  rapports(limite: number): Promise<RapportImport[]>;
  dernierRapport(): Promise<RapportImport | null>;
  catalogue(): Promise<unknown[]>;
};

// Le fichier lu par l'import (S3_URL)
export type StockageCsv = {
  endpoint: string;
  bucket: string;
  cle: string;
  supprimerSource: boolean;
  deposer(contenu: Buffer): Promise<void>;
  decrire(): Promise<DescriptionCsv | null>;
};

export type EtatPlanification = { horaire: string; fuseau: string; prochain: string | null };

export type OutilsImportDeps = {
  depot: DepotOutilsImport;
  // null : variables R2 absentes (raison dans stockageAbsent)
  stockage: StockageCsv | null;
  stockageAbsent?: string;
  // Import sous le verrou de planification.ts ; null si R2 n'est pas configuré
  lancer: ((executer: () => Promise<unknown>) => Promise<Issue>) | null;
  executer: () => Promise<unknown>;
  planification: () => EtatPlanification | null;
  maintenant?: () => Date;
  demarreLe?: Date;
  pod?: string | null;
  log?: Logger;
};

export const LIMITE_RAPPORTS = { defaut: 50, max: 200 };

export const MESSAGES = {
  sansR2:
    'Stockage R2 non configuré sur ce backend (variables S3_URL, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY).',
  vide: 'Le fichier envoyé est vide.',
  enCours:
    'Un import est déjà en cours (import planifié ou autre réplica) : réessayez dans un instant.',
};

export function stockageCsvR2(client: Pick<S3Client, 'send'>, config: S3Config): StockageCsv {
  return {
    endpoint: config.endpoint,
    bucket: config.bucket,
    cle: config.key,
    supprimerSource: config.supprimerSource,
    deposer: (contenu) => deposerCsv(client, config.bucket, config.key, contenu),
    decrire: () => decrireCsv(client, config.bucket, config.key),
  };
}

export function creerOutilsImportService(deps: OutilsImportDeps) {
  const { depot, stockage, lancer, executer, planification } = deps;
  const maintenant = deps.maintenant ?? (() => new Date());
  const demarreLe = deps.demarreLe ?? maintenant();

  async function fichier() {
    if (!stockage) return null;
    try {
      const description = await stockage.decrire();
      return description ? { present: true, ...description } : { present: false };
    } catch (err) {
      return { present: null, erreur: message(err) }; // accès refusé, R2 injoignable...
    }
  }

  async function etat() {
    return {
      serveur: {
        heure: maintenant().toISOString(),
        demarreLe: demarreLe.toISOString(),
        pod: deps.pod ?? null,
        fuseau: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      stockage: stockage
        ? {
            configure: true,
            endpoint: stockage.endpoint,
            bucket: stockage.bucket,
            cle: stockage.cle,
            supprimerSource: stockage.supprimerSource,
          }
        : { configure: false, raison: deps.stockageAbsent ?? MESSAGES.sansR2 },
      fichier: await fichier(),
      planification: planification(),
    };
  }

  async function deposer(contenu: unknown) {
    if (!stockage) throw new HttpError(503, MESSAGES.sansR2);
    if (!Buffer.isBuffer(contenu) || contenu.length === 0) throw new HttpError(400, MESSAGES.vide);
    await stockage.deposer(contenu);
    return {
      bucket: stockage.bucket,
      cle: stockage.cle,
      taille: contenu.length,
      deposeLe: maintenant().toISOString(),
    };
  }

  // L'échec de l'import (fichier refusé, erreur technique) n'est pas une erreur de l'outil :
  // il est renvoyé avec le rapport pour être affiché
  async function importer() {
    if (!lancer) throw new HttpError(503, MESSAGES.sansR2);
    const debut = maintenant();
    let erreur: string | null = null;
    const issue = await lancer(() =>
      executer().catch((err: unknown) => {
        erreur = message(err);
      }),
    );
    if (issue === 'deja_en_cours') throw new HttpError(409, MESSAGES.enCours);
    return {
      issue,
      erreur,
      dureeMs: maintenant().getTime() - debut.getTime(),
      rapport: await depot.dernierRapport(),
    };
  }

  async function rapports(limite?: unknown) {
    const n = Number(limite);
    const borne =
      Number.isInteger(n) && n > 0 ? Math.min(n, LIMITE_RAPPORTS.max) : LIMITE_RAPPORTS.defaut;
    return depot.rapports(borne);
  }

  async function catalogue() {
    return depot.catalogue();
  }

  return loggable(
    'OutilsImportService',
    { etat, deposer, importer, rapports, catalogue },
    deps.log ?? logger,
  );
}

export type OutilsImportService = ReturnType<typeof creerOutilsImportService>;

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
