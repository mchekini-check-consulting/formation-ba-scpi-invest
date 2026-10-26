import express, { type Express } from 'express';

// Vérifie que la base répond (select 1) ; injectée pour les tests unitaires
export type Ping = () => Promise<unknown>;

// Application sans listen : testable avec supertest
export function createApp(ping: Ping): Express {
  const app = express();
  // Ne pas annoncer Express (en-tête X-Powered-By, hotspot SonarQube)
  app.disable('x-powered-by');
  app.use(express.json());
  app.get('/', (_req, res) => {
    res.send('Hello, World!');
  });
  app.get('/health', async (_req, res) => {
    try {
      await ping();
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'ko' });
    }
  });
  return app;
}
