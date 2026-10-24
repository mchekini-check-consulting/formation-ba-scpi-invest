import { createApp } from './app.js';
import { createPool } from './db.js';
import { migrate } from './migrate.js';

// Migrations au démarrage, puis écoute sur 8080 (helm.yaml : containerPort)
const pool = createPool();
await migrate(pool);
const port = Number(process.env.PORT ?? 8080);
createApp(pool).listen(port, () => console.log(`backend sur :${port}`));
