# formation-ba-scpi-invest

Monorepo contenant le backend Express (TypeScript) et l'application frontend React.

```
backend/                  # API Express scpi-invest (TypeScript)
  src/
    app.ts                # application Express : GET "/" -> "Hello, World !", /items
    server.ts             # migrations puis écoute sur 8080
    items/                # GET/POST /items
  migrations/             # V1__init.sql, V2__item.sql... appliquées au démarrage
  test/                   # tests d'intégration (PostgreSQL jetable, Docker requis)
frontend/                 # application React (Vite)
compose.yaml              # local : PostgreSQL seul, ou pile complète (profil full)
helm.yaml                 # déploiement par formation-ba-gitops
```

## Versions

### Backend

| Composant  | Version |
| ---------- | ------- |
| Node.js    | 24      |
| Express    | 5.3     |
| TypeScript | 7.0     |
| PostgreSQL | 16      |

### Frontend

| Composant | Version |
| --------- | ------- |
| Node.js   | 24      |
| React     | 19.3    |
| Vite      | 8.3     |

Node.js 24 : même version que la CI (formation-ba-gitops/ci-template/setup) et les images Docker.

## Mise en place du poste

Une fois après le clone, à la racine du dépôt :

```bash
npm install               # prettier, husky, lint-staged ; active le hook pre-commit
```

Le hook pre-commit formate les fichiers indexés (Prettier), puis lance le lint et les tests
unitaires du projet touché (`backend/` ou `frontend/`). Les tests d'intégration restent en CI.

```bash
npm run format            # formater tout le dépôt
npm run format:check      # vérifier sans modifier
```

IntelliJ : Settings → Languages & Frameworks → JavaScript → Prettier → **Automatic Prettier
configuration** et **Run on save**. Le fichier `.editorconfig` est lu sans plugin.

## Lancer en local

### Base de données

```bash
docker compose up -d      # depuis la racine : PostgreSQL seul (port 5432)
```

### Backend

```bash
cd backend
npm install
npm run dev
```

Disponible sur http://localhost:8080/ (http://localhost:8080/items)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Disponible sur http://localhost:5173/ ; `/api` est relayé vers le backend sur 8080.

### Tout dans Docker

Pour vérifier les images construites comme en CI (nginx, Node.js distroless, migrations au démarrage) :

```bash
docker compose --profile full up --build    # depuis la racine
```

Disponible sur http://localhost:8081/ ; `docker compose --profile full down` pour arrêter
(`-v` vide la base).

## Tests

Mêmes commandes que la CI, dans `backend/` ou `frontend/` :

```bash
make lint                 # oxlint (+ tsc --noEmit pour le backend)
make test-unit            # tests unitaires + couverture -> coverage/lcov.info (SonarQube)
make test-integration     # backend : PostgreSQL jetable via testcontainers, Docker requis
```
