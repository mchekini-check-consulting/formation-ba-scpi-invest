import { sql } from 'drizzle-orm';
import { toNodeHandler } from 'better-auth/node';
import type { RequestHandler } from 'express';
import { createApp } from './app.js';
import { creerAuth, fournisseurBetterAuth } from './auth/better-auth.js';
import { routesComptes } from './comptes/routes.js';
import { demarrerImportNocturne } from './csv/planification.js';
import { creerCompteService } from './comptes/service.js';
import { depotAcceptationsCgu, depotKyc, secretDesSessions } from './db/depots.js';
import { createDb, createPool } from './db/index.js';
import { routesKyc } from './kyc/routes.js';
import { creerKycService } from './kyc/service.js';
import { logger } from './logging/logger.js';
import { migrate } from './migrate.js';

// Migrations au démarrage, puis écoute sur 8080 (helm.yaml : containerPort)
const pool = createPool();
await migrate(pool);
const db = createDb(pool);

// Authentification : Better-Auth derrière l'interface FournisseurIdentite (src/auth/)
const auth = creerAuth(db, await secretDesSessions(db));
const fournisseur = fournisseurBetterAuth(auth);
const betterAuth: RequestHandler = toNodeHandler(auth);
const comptes = creerCompteService(fournisseur, depotAcceptationsCgu(db));
const kyc = creerKycService(depotKyc(db));

// US-07a : import du catalogue au démarrage puis chaque nuit à 2h (désactivé sans les variables R2)
demarrerImportNocturne(pool, db);

const port = Number(process.env.PORT ?? 8080);
createApp(() => db.execute(sql`select 1`), logger, {
  auth: betterAuth,
  routeurs: [routesComptes(comptes, fournisseur), routesKyc(kyc, fournisseur)],
}).listen(port, () => logger.info({ port }, 'backend démarré'));
