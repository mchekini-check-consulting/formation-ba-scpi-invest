import express, { type Express, type RequestHandler } from 'express';
import type { Logger } from 'pino';
import { errorHandler, requestLogger } from './logging/controller.js';
import { logger } from './logging/logger.js';

// Vérifie que la base répond (select 1) ; injectée pour les tests unitaires
export type Ping = () => Promise<unknown>;

// Application sans listen : testable avec supertest.
// Routes nommées (const hello = ...) : le nom apparaît dans le log (champ method).
export function createApp(ping: Ping, log: Logger = logger): Express {
  const app = express();
  // Ne pas annoncer Express (en-tête X-Powered-By, hotspot SonarQube)
  app.disable('x-powered-by');
  app.use(requestLogger(log));
  app.use(express.json());

  const hello: RequestHandler = (_req, res) => {
    res.send('Hello, World!');
  };
  const health: RequestHandler = async (_req, res) => {
    try {
      await ping();
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'ko' });
    }
  };
  app.get('/', hello);
  app.get('/health', health);

  app.use(errorHandler(log));
  return app;
}
