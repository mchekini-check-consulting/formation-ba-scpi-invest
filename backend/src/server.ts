import { sql } from 'drizzle-orm';
import { createApp } from './app.js';
import { createDb, createPool } from './db/index.js';
import { migrate } from './migrate.js';

// Migrations au démarrage, puis écoute sur 8080 (helm.yaml : containerPort)
const pool = createPool();
await migrate(pool);
const db = createDb(pool);
const port = Number(process.env.PORT ?? 8080);
createApp(() => db.execute(sql`select 1`)).listen(port, () => console.log(`backend sur :${port}`));
