-- Les écrans de l'espace client masqués par l'opératrice (18 novembre 2026, lib/domaine/ecrans-de-l-espace.ts).
-- Vide par défaut : aucune organisation existante ne change.
ALTER TABLE "organisations" ADD COLUMN "ecrans_masques" text[] DEFAULT '{}'::text[] NOT NULL;
