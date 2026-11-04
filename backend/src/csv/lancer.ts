import { createDb, createPool } from '../db/index.js';
import { creerImportService } from './service.js';
import { s3Client, s3Config, sourceR2 } from './source.js';

// Lancement manuel d'un import (npx tsx --env-file=.env src/csv/lancer.ts) ;
// rien ne s'exécute quand un test importe ce fichier
if (import.meta.main) {
  const config = s3Config();
  const pool = createPool();
  try {
    await creerImportService(createDb(pool), sourceR2(s3Client(config), config)).executer();
  } finally {
    await pool.end(); // sinon le script ne se termine pas
  }
}
