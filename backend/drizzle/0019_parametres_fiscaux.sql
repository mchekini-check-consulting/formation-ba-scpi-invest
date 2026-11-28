-- US-07 (SCPI-256), règle 10 : paramètres de l'estimation fiscale, modifiables ensuite
-- directement en base (sans nouveau développement). Le barème de l'impôt sur le revenu est
-- dans le code (src/fiscalite/bareme.ts, règle du 27/11/2026).
CREATE TABLE "parametre_fiscal" (
	"cle" text PRIMARY KEY NOT NULL,
	"valeur" numeric(5, 2) NOT NULL
);
--> statement-breakpoint
INSERT INTO "parametre_fiscal" ("cle", "valeur") VALUES
	('prelevements_sociaux', 17.2),
	('taux_forfaitaire', 30);
