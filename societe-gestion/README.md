# societe-gestion

Société de gestion : backend Express (TypeScript, Node 24) du projet formation-ba-scpi-invest, base PostgreSQL
`societe_gestion` (Drizzle).

Via le gateway : `https://gateway.formation-ba-scpi-invest.<env>.check-consulting.net/societe-gestion/...`
(préfixe `/societe-gestion` retiré par le gateway).

## Structure

```
src/
  server.ts      # point d'entrée (migrations puis écoute)
  app.ts         # application Express : routes / et /health, routeurs métier
  db/schema.ts   # tables (Drizzle) ; npm run db:generate -> drizzle/*.sql
  logging/       # logs métier (logMetier, logRoute ; skill logs-metier) : ne pas modifier
test/            # tests d'intégration (*.e2e-test.ts)
```

## En local

```bash
docker compose up -d   # base locale, port 5434
npm install
npm run dev            # http://localhost:8081/ (santé : /health)
```

## Contrôles (comme la CI)

`make lint` (oxlint + tsc), `make test-unit` (vitest + couverture), `make test-integration`
(PostgreSQL jetable, Docker requis).
