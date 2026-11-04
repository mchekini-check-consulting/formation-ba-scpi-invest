-- Table de démonstration /items de l'ancien backend (Spring sur dev et qualif, première
-- version Express en local) : plus utilisée depuis le retrait de /items.
-- IF EXISTS : sans effet sur une base neuve. Jouée une seule fois par base
-- (drizzle.__drizzle_migrations) : une future table item créée par une migration
-- ultérieure ne sera pas supprimée.
DROP TABLE IF EXISTS item;
