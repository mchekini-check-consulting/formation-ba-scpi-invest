// Schéma Drizzle : une table par export (pgTable). Après une modification :
//   npm run db:generate   ->  nouveau fichier SQL dans drizzle/, appliqué au démarrage
// Tables héritées de l'ancien backend (item, flyway_schema_history) : volontairement
// absentes, Drizzle n'y touche pas.
export {};
