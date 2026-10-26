import type { ErrorRequestHandler, Request, RequestHandler } from 'express';
import type { Logger } from 'pino';
import { businessLog, elapsedMs, type Level } from './logger.js';
import { HttpError } from './http-error.js';

// Couche contrôleur (layer controller) : un log par requête HTTP, avec la route
// déclarée (jamais l'URL avec ses valeurs, ni le corps), le statut et la durée.
// 4xx : warn ; 5xx : error.
export function requestLogger(log: Logger): RequestHandler {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const route = declaredRoute(req);
      const status = res.statusCode;
      businessLog(
        log,
        levelOf(status),
        'controller',
        'app',
        handlerName(req),
        `${req.method} ${route} ${status}`,
        { httpMethod: req.method, route, status, durationMs: elapsedMs(start) },
      );
    });
    next();
  };
}

// Erreur non rattrapée par une route : 500 (ou le statut d'une HttpError), et la
// trace complète en log sans layer (kubectl logs), hors Loki.
export function errorHandler(log: Logger): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) {
      log.error({ err }, 'erreur non gérée');
    }
    res.status(status).json({ message: status >= 500 ? 'erreur interne' : err.message });
  };
}

function levelOf(status: number): Level {
  if (status >= 500) {
    return 'error';
  }
  return status >= 400 ? 'warn' : 'info';
}

function declaredRoute(req: Request): string {
  return req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
}

// Nom de la fonction de la route (const hello = ...), comme la méthode du contrôleur en Java
function handlerName(req: Request): string {
  const stack: { handle: { name: string } }[] = req.route?.stack ?? [];
  return stack.at(-1)?.handle.name || 'anonymous';
}
