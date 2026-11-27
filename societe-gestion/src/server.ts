import { sql } from 'drizzle-orm';
import { createApp } from './app.js';
import { createDb, createPool } from './db/index.js';
import { creerEnvoiAccuses, producteurKafka } from './kafka/accuses.js';
import { creerBoite } from './kafka/boite.js';
import { kafkaConfig } from './kafka/config.js';
import { ecouterKafka } from './kafka/ecoute.js';
import { routesBoite } from './kafka/routes.js';
import { logger } from './logging/logger.js';
import { migrate } from './migrate.js';

// Migrations au démarrage, puis écoute sur PORT : 8081 en local,
// 8080 dans l'image (Dockerfile ; helm.yaml : containerPort)
const pool = createPool();
await migrate(pool);
const db = createDb(pool);

// SCPI partenaire simulée : lecture du topic des dossiers (US-12) depuis le début, en
// mémoire, pour l'écran de test « Boîte de réception de la SCPI »
const config = kafkaConfig();
const boite = creerBoite();
const ecoute = ecouterKafka(boite, config);

// US-13 : envoi des accusés de réception à SCPI Invest (bouton de l'écran de test)
const producteur = producteurKafka(config);
const accuses = creerEnvoiAccuses(producteur?.publier ?? null, config?.topicAccuse ?? '');

// Arrêt (redéploiement, redémarrage en dev) : le lecteur quitte proprement son groupe
// Kafka, pour que le suivant démarre sans attendre ; arrêt forcé au bout de 5 s
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    setTimeout(() => process.exit(0), 5000).unref();
    void Promise.allSettled([ecoute.arreter(), producteur?.fermer()]).finally(() =>
      process.exit(0),
    );
  });
}

const port = Number(process.env.PORT ?? 8081);
createApp(() => db.execute(sql`select 1`), logger, [routesBoite(boite, ecoute, accuses)]).listen(
  port,
  () => logger.info({ port }, 'backend démarré'),
);
