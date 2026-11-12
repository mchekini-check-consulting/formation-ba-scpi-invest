import { randomUUID } from 'node:crypto';
import type { ErrorRequestHandler, Request, RequestHandler } from 'express';
import type { Logger } from 'pino';
import {
  avecContexte,
  businessLog,
  elapsedMs,
  type ContexteRequete,
  type Level,
} from './logger.js';
import { HttpError } from './http-error.js';
import { messageRequete } from './messages.js';

// Couche contrôleur (layer controller) : un log par requête HTTP, avec la route
// déclarée (jamais l'URL avec ses valeurs, ni le corps), le statut et la durée,
// un message lisible (messages.ts) et l'identifiant de l'utilisateur s'il est connu.
// 4xx : warn ; 5xx : error ; /health qui répond : debug (appelé en boucle par les sondes).
// Chaque requête reçoit un requestId (en-tête X-Request-Id reçu s'il est bien formé,
// sinon généré), présent sur toutes ses lignes de log et renvoyé dans la réponse.
export function requestLogger(log: Logger): RequestHandler {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    const requestId = requestIdRecu(req.get('x-request-id')) ?? randomUUID();
    res.setHeader('X-Request-Id', requestId);
    // Complété pendant la requête (identifierUtilisateur, logger.ts)
    const enCours: ContexteRequete = { requestId };
    res.on('finish', () => {
      const route = declaredRoute(req);
      const status = res.statusCode;
      const { userId, email, details } = enCours;
      businessLog(
        log,
        levelOf(route, status),
        'controller',
        controllerName(route),
        handlerName(req),
        messageRequete({
          httpMethod: req.method,
          route,
          chemin: req.path,
          status,
          params: req.params,
          userId,
          email,
          details,
        }),
        {
          ...details, // en premier : ne remplace jamais un champ obligatoire
          requestId,
          httpMethod: req.method,
          route,
          status,
          durationMs: elapsedMs(start),
          ...(userId && { userId }),
          ...(email && { email }),
        },
      );
    });
    avecContexte(enCours, next);
  };
}

// Valeur reçue d'un client : gardée seulement si elle ne peut pas fausser les logs
const REQUEST_ID_VALIDE = /^[\w-]{8,64}$/;

function requestIdRecu(valeur: string | undefined): string | undefined {
  return valeur && REQUEST_ID_VALIDE.test(valeur) ? valeur : undefined;
}

// Erreur non rattrapée par une route : 500 (ou le statut d'une HttpError), et la
// trace complète en log sans layer (kubectl logs), hors Loki.
export function errorHandler(log: Logger): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) {
      log.error({ err }, 'erreur non gérée');
    }
    res
      .status(status)
      .json(
        status >= 500 ? { message: 'erreur interne' } : { ...err.details, message: err.message },
      );
  };
}

function levelOf(route: string, status: number): Level {
  if (status >= 500) {
    return 'error';
  }
  if (status >= 400) {
    return 'warn';
  }
  return route === '/health' ? 'debug' : 'info';
}

// Premier segment de la route (/connaissance-client/pieces/:typePiece -> connaissance-client), comme la classe du
// contrôleur en Java ; "app" pour les routes de app.ts (/, /health) et les 404.
function controllerName(route: string): string {
  const segment = route.split('/')[1]; // undefined pour "unmatched"
  return !segment || route === '/health' ? 'app' : segment;
}

function declaredRoute(req: Request): string {
  return req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
}

// Nom de la fonction de la route (const hello = ...), comme la méthode du contrôleur en Java
function handlerName(req: Request): string {
  const stack: { handle: { name: string } }[] = req.route?.stack ?? [];
  return stack.at(-1)?.handle.name || 'anonymous';
}
