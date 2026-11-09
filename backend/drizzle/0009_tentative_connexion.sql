CREATE TABLE "tentative_connexion" (
	"cle" text PRIMARY KEY NOT NULL,
	"echecs" integer NOT NULL,
	"dernier_echec" timestamp with time zone NOT NULL,
	"bloque_jusqua" timestamp with time zone
);
