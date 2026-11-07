import { AsyncLocalStorage } from 'node:async_hooks';
import { pino, type DestinationStream, type Logger } from 'pino';
import { serialiserErreur } from './erreur.js';

// Convention de la plateforme (Alloy/Loki) : une ligne JSON par log sur stdout,
// champs time/level/msg, niveau minimal LOG_LEVEL (helm.yaml, envList).
// Seules les lignes avec un champ layer (controller/service) sont collectées dans Loki ;
// les autres (démarrage, câblage) restent visibles avec kubectl logs.
export type Layer = 'controller' | 'service';
export type Level = 'debug' | 'info' | 'warn' | 'error';

// Contexte de la requête HTTP en cours (requestLogger, controller.ts) : toutes les
// lignes écrites pendant la requête, quelle que soit la couche, portent son requestId,
// ce qui permet de retrouver dans Grafana tous les logs d'une même requête.
const contexte = new AsyncLocalStorage<{ requestId: string }>();

export function avecRequestId<T>(requestId: string, fn: () => T): T {
  return contexte.run({ requestId }, fn);
}

export function createLogger(
  destination: DestinationStream = pino.destination(1),
  level = process.env.LOG_LEVEL ?? 'info',
): Logger {
  return pino(
    {
      level: level.toLowerCase(),
      base: undefined, // ni pid ni hostname
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label.toUpperCase() }) },
      // Une copie : pino ajoute les champs de la ligne dans l'objet renvoyé ; renvoyer le
      // contexte lui-même ferait hériter chaque ligne des champs des lignes précédentes.
      mixin: () => {
        const enCours = contexte.getStore();
        return enCours ? { requestId: enCours.requestId } : {};
      },
      serializers: { err: serialiserErreur },
    },
    destination,
  );
}

export const logger = createLogger();

// Log "métier" : layer, class et method en champs JSON, jamais dans le message
export function businessLog(
  log: Logger,
  level: Level,
  layer: Layer,
  clazz: string,
  method: string,
  msg: string,
  fields: Record<string, unknown> = {},
): void {
  log[level]({ layer, class: clazz, method, ...fields }, msg);
}

export function elapsedMs(start: bigint): number {
  return Number((process.hrtime.bigint() - start) / 1_000_000n);
}
