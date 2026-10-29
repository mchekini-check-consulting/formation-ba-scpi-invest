# formation-ba-scpi-invest

Backend Express/TypeScript (`backend/`, PostgreSQL via Drizzle) et frontend React/Vite
(`frontend/`). Détails techniques : `README.md`.

Les utilisateurs de ce dépôt sont souvent des Business Analysts, pas des développeurs :
expliquer en langage simple, et demander avant toute action risquée.

## Parcours

- Commencer une fonctionnalité : skill `/nouvelle-fonctionnalite` (branche `feature/<nom>`).
- Ajouter un backend : skill `/nouveau-backend`.
- Mettre en ligne : skill `/deploy`. Merger sur `main` déploie **automatiquement en dev**
  (CI → ECR → Kargo → Argo CD) ; qualif se promeut à la main dans Kargo.

## Appeler le backend depuis le frontend

Toujours construire l'URL avec `apiBase()` (`frontend/src/api.js`) :
``fetch(`${apiBase()}/health`)``. Jamais `/api/...` ni une URL écrite en dur : en dev et en
qualif, le backend n'est joignable que par la passerelle du projet.

## Ne jamais faire sans un référent technique

- Modifier `helm.yaml` (les lignes `tag:` sont écrites par Kargo), `gateway.yaml`,
  `.github/` ou `.claude/`.
- `git push --force` sur `main`, `git reset --hard`, `git commit --no-verify`.
- Changer la version de PostgreSQL (16, fixée par la plateforme).

## Avant chaque commit

Dans chaque dossier modifié (`backend/`, `frontend/`) : `make lint`, `make test-unit`.
Le hook pre-commit formate (Prettier) et relance lint et tests unitaires : ne pas le contourner.

## En local

Base : `docker compose up -d` à la racine (port 5432). Puis `npm install` et `npm run dev`
dans `backend/` (8080) et `frontend/` (5173).
