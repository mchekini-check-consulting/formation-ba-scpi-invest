-- US-07 (SCPI-256), règles 3 et 10 : valeurs initiales des paramètres de l'estimation
-- fiscale. Les modifier ensuite directement en base (sans nouveau développement).
INSERT INTO "tranche_bareme" ("plafond", "taux") VALUES
	(11600, 0),
	(29579, 11),
	(84577, 30),
	(181917, 41),
	(NULL, 45);
--> statement-breakpoint
INSERT INTO "parametre_fiscal" ("cle", "valeur") VALUES
	('prelevements_sociaux', 17.2),
	('taux_forfaitaire', 30);
