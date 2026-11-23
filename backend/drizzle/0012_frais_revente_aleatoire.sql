ALTER TABLE "scpi_catalog" ALTER COLUMN "frais_a_la_revente" DROP DEFAULT;--> statement-breakpoint
-- SCPI déjà en base : tirage au sort (35 % de "true")
UPDATE "scpi_catalog" SET "frais_a_la_revente" = random() < 0.35;
