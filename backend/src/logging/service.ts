import type { Logger } from 'pino';
import { decrireErreur } from './erreur.js';
import { HttpError } from './http-error.js';
import { businessLog, elapsedMs, logger } from './logger.js';

// Couche service (layer service) : équivalent de @Loggable. Chaque fonction de l'objet
// est enveloppée : un log à la sortie, avec la durée (jamais les arguments ni le
// retour). Succès : debug (la ligne de la requête, layer controller, raconte déjà
// l'action ; la durée reste visible en dev). HttpError 4xx : warn (règle métier, avec
// son message, destiné à l'utilisateur donc sans donnée personnelle) ; autre erreur :
// error (avec le type de l'erreur seulement). L'erreur est relancée.
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
    businessLog(log, 'debug', 'service', clazz, method, `${clazz}.${method} ok`, {
      durationMs: elapsedMs(start),
    });
    return resultat;
  };
  const echec = (err: unknown): never => {
    const regleMetier = err instanceof HttpError && err.status < 500;
    const erreur = decrireErreur(err);
    businessLog(
      log,
      regleMetier ? 'warn' : 'error',
      'service',
      clazz,
      method,
      regleMetier
        ? `Règle métier non respectée (${clazz}.${method}) : ${erreur.errorMessage}`
        : `Erreur technique (${clazz}.${method}) : ${erreur.error}`,
      // Sans la requête SQL ni ses valeurs (erreur.ts)
      { durationMs: elapsedMs(start), ...erreur },
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
