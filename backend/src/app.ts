import express, { type Express } from 'express';
import type { Pool } from 'pg';
import { itemsRouter } from './items/items.routes.js';

// Application sans listen : testable avec supertest
export function createApp(pool: Pool): Express {
  const app = express();
  // Ne pas annoncer Express (en-tête X-Powered-By, hotspot SonarQube)
  app.disable('x-powered-by');
  app.use(express.json());
  app.get('/', (_req, res) => {
    res.send('Hello, World !');
  });
  app.use('/items', itemsRouter(pool));
  return app;
}
