CREATE TYPE "public"."frequence" AS ENUM('Trimestrielle', 'Mensuelle', 'Annuelle', 'Semestrielle', 'Bimestrielle');--> statement-breakpoint
CREATE TYPE "public"."secteur" AS ENUM('Bureaux', 'Commerces', 'Hôtels', 'Locaux d’activité', 'Logistique', 'Résidentiel', 'Santé', 'Transport', 'Autre');--> statement-breakpoint
CREATE TABLE "scpi_decote_demembrement" (
	"id" serial PRIMARY KEY NOT NULL,
	"duree" integer NOT NULL,
	"decote" integer NOT NULL,
	"scpi_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scpi_localisation" (
	"id" serial PRIMARY KEY NOT NULL,
	"pays" text NOT NULL,
	"pourcentage" numeric(5, 2) NOT NULL,
	"scpi_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scpi_prix_part" (
	"id" serial PRIMARY KEY NOT NULL,
	"prix" numeric(10, 2) NOT NULL,
	"annee" integer NOT NULL,
	"scpi_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scpi_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"minimum_souscription" integer,
	"capitalisation" bigint,
	"gerant" text,
	"frais_souscription" real,
	"frais_gestion" real,
	"delai_jouissance" integer,
	"frequence" "frequence",
	"iban" text,
	"bic" text,
	"demembrement" boolean,
	"cashback" integer,
	"versement_programme" boolean,
	"publicite" text,
	"mise_a_jour" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scpi_catalog_nom_unique" UNIQUE("nom")
);
--> statement-breakpoint
CREATE TABLE "scpi_secteurs" (
	"id" serial PRIMARY KEY NOT NULL,
	"secteur" "secteur" NOT NULL,
	"pourcentage" numeric(5, 2) NOT NULL,
	"scpi_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scpi_taux_distribution" (
	"id" serial PRIMARY KEY NOT NULL,
	"taux" numeric(5, 2) NOT NULL,
	"annee" integer,
	"scpi_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scpi_valeur_recon" (
	"id" serial PRIMARY KEY NOT NULL,
	"valeur" numeric(10, 3) NOT NULL,
	"annee" integer NOT NULL,
	"scpi_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scpi_decote_demembrement" ADD CONSTRAINT "scpi_decote_demembrement_scpi_id_scpi_catalog_id_fk" FOREIGN KEY ("scpi_id") REFERENCES "public"."scpi_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scpi_localisation" ADD CONSTRAINT "scpi_localisation_scpi_id_scpi_catalog_id_fk" FOREIGN KEY ("scpi_id") REFERENCES "public"."scpi_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scpi_prix_part" ADD CONSTRAINT "scpi_prix_part_scpi_id_scpi_catalog_id_fk" FOREIGN KEY ("scpi_id") REFERENCES "public"."scpi_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scpi_secteurs" ADD CONSTRAINT "scpi_secteurs_scpi_id_scpi_catalog_id_fk" FOREIGN KEY ("scpi_id") REFERENCES "public"."scpi_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scpi_taux_distribution" ADD CONSTRAINT "scpi_taux_distribution_scpi_id_scpi_catalog_id_fk" FOREIGN KEY ("scpi_id") REFERENCES "public"."scpi_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scpi_valeur_recon" ADD CONSTRAINT "scpi_valeur_recon_scpi_id_scpi_catalog_id_fk" FOREIGN KEY ("scpi_id") REFERENCES "public"."scpi_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scpi_decote_demembrement_scpi_id_idx" ON "scpi_decote_demembrement" USING btree ("scpi_id");--> statement-breakpoint
CREATE INDEX "scpi_localisation_scpi_id_idx" ON "scpi_localisation" USING btree ("scpi_id");--> statement-breakpoint
CREATE INDEX "scpi_prix_part_scpi_id_idx" ON "scpi_prix_part" USING btree ("scpi_id");--> statement-breakpoint
CREATE INDEX "scpi_secteurs_scpi_id_idx" ON "scpi_secteurs" USING btree ("scpi_id");--> statement-breakpoint
CREATE INDEX "scpi_taux_distribution_scpi_id_idx" ON "scpi_taux_distribution" USING btree ("scpi_id");--> statement-breakpoint
CREATE INDEX "scpi_valeur_recon_scpi_id_idx" ON "scpi_valeur_recon" USING btree ("scpi_id");