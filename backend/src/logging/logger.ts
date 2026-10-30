import { pino, type DestinationStream, type Logger } from 'pino';

// Convention de la plateforme (Alloy/Loki) : une ligne JSON par log sur stdout,
// champs time/level/msg, niveau minimal LOG_LEVEL (helm.yaml, envList).
// Seules les lignes avec un champ layer (controller/service) sont collectées dans Loki ;
// les autres (démarrage, câblage) restent visibles avec kubectl logs.
export type Layer = 'controller' | 'service';
export type Level = 'info' | 'warn' | 'error';

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
