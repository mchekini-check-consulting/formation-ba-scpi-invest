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
// Dès que l'utilisateur est connu (route réservée aux connectés, connexion, création
// de compte), ses lignes portent aussi son identifiant technique (userId) et son email,
// pour le débogage (exception à la règle « pas de donnée personnelle », validée par le
// référent technique, CLAUDE.md). Connexion : l'email saisi, même sans compte.
export type Utilisateur = { userId?: string; email?: string };
// Paramètres de l'action (recherche, filtres, tri...), déjà validés par le service :
// écrits seulement sur la ligne de la requête (layer controller), pas sur les autres.
export type Details = Record<string, string | number>;
export type ContexteRequete = { requestId: string; details?: Details } & Utilisateur;

const contexte = new AsyncLocalStorage<ContexteRequete>();

export function avecContexte<T>(enCours: ContexteRequete, fn: () => T): T {
  return contexte.run(enCours, fn);
}

// Hors requête (démarrage, import de nuit) : sans effet
export function identifierUtilisateur(utilisateur: Utilisateur): void {
  const enCours = contexte.getStore();
  if (enCours) {
    Object.assign(enCours, utilisateur);
  }
}

// Hors requête : sans effet. Plusieurs appels : les détails s'ajoutent.
export function detaillerAction(details: Details): void {
  const enCours = contexte.getStore();
  if (enCours) {
    enCours.details = { ...enCours.details, ...details };
  }
}

function champsDuContexte(): Record<string, unknown> {
  const enCours = contexte.getStore();
  if (!enCours) {
    return {};
  }
  const { details: _details, ...champs } = enCours;
  return champs;
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
      mixin: champsDuContexte,
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
