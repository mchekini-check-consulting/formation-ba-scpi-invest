-- Point de départ Drizzle : aucun changement de schéma.
-- Les bases existantes (dev, qualif) gardent leurs tables (item, flyway_schema_history),
-- que Drizzle ignore. Règles : une migration appliquée ne se modifie plus ; écrire
-- les migrations de façon idempotente (IF NOT EXISTS) et compatible avec la version
-- précédente (2 réplicas en preprod/prod pendant un déploiement).
SELECT 1;
