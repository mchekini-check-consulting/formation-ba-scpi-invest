-- Règle du 27/11/2026 (SCPI-256) : le barème de l'impôt sur le revenu est dans le code
-- (src/fiscalite/bareme.ts) ; la table tranche_bareme (0015, 0016) ne sert plus.
DROP TABLE "tranche_bareme" CASCADE;