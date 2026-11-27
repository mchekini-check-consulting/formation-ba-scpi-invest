CREATE TABLE "message_recu" (
	"id_message" text PRIMARY KEY NOT NULL,
	"topic" text NOT NULL,
	"traite_le" timestamp with time zone DEFAULT now() NOT NULL
);
