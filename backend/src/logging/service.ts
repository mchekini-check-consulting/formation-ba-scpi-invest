import type { Logger } from 'pino';
import { decrireErreur } from './erreur.js';
import { HttpError } from './http-error.js';
import { businessLog, elapsedMs, logger } from './logger.js';

// Couche service (layer service) : équivalent de @Loggable. Chaque fonction de l'objet
// est enveloppée : un log à la sortie, avec la durée (jamais les arguments ni le
// retour). HttpError 4xx : warn (règle métier) ; autre erreur : error. L'erreur est relancée.
//   export const itemService = loggable('ItemService', { lister, creer });
export function loggable<T extends object>(clazz: string, service: T, log: Logger = logger): T {
  const enveloppe = { ...service } as Record<string, unknown>;
  for (const [method, fn] of Object.entries(service)) {
    if (typeof fn === 'function') {
      enveloppe[method] = (...args: unknown[]) =>
        appeler(log, clazz, method, () => fn.apply(service, args));
    }
  }
  return enveloppe as T;
}

function appeler(log: Logger, clazz: string, method: string, fn: () => unknown): unknown {
  const start = process.hrtime.bigint();
  const succes = (resultat: unknown) => {
    businessLog(log, 'info', 'service', clazz, method, `${clazz}.${method} ok`, {
      durationMs: elapsedMs(start),
    });
    return resultat;
  };
  const echec = (err: unknown): never => {
    const regleMetier = err instanceof HttpError && err.status < 500;
    businessLog(
      log,
      regleMetier ? 'warn' : 'error',
      'service',
      clazz,
      method,
      `${clazz}.${method} en échec`,
      // Sans la requête SQL ni ses valeurs (erreur.ts)
      { durationMs: elapsedMs(start), ...decrireErreur(err) },
    );
    throw err;
  };
  try {
    const resultat = fn();
    return resultat instanceof Promise ? resultat.then(succes, echec) : succes(resultat);
  } catch (err) {
    return echec(err);
  }
}
