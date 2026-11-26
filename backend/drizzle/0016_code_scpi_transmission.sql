ALTER TABLE "scpi_catalog" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "dossier_investissement" ADD COLUMN "transmis_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scpi_catalog" ADD CONSTRAINT "scpi_catalog_code_unique" UNIQUE("code");