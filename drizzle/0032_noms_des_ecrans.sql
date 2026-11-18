-- Les noms donnés par l'opératrice aux écrans de l'espace (18 novembre 2026, lib/domaine/ecrans-de-l-espace.ts).
-- Vide par défaut : chaque écran garde son nom.
ALTER TABLE "organisations" ADD COLUMN "noms_des_ecrans" jsonb DEFAULT '{}'::jsonb NOT NULL;
