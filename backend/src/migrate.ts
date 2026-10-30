import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator';
import type { Pool } from 'pg';

// Migrations Drizzle (drizzle/*.sql) appliquées au démarrage, une seule fois chacune
// (suivi : table drizzle.__drizzle_migrations). Verrou consultatif : deux réplicas
// démarrant ensemble ne les appliquent pas en même temps.
const DOSSIER = path.resolve(import.meta.dirname, '../drizzle');
const VERROU = 724001;

export async function migrate(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('select pg_advisory_lock($1)', [VERROU]);
    await drizzleMigrate(drizzle(client), { migrationsFolder: DOSSIER });
  } finally {
    await client.query('select pg_advisory_unlock($1)', [VERROU]);
    client.release();
  }
}
