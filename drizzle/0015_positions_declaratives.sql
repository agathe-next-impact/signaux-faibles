-- Positions déclaratives (30 octobre 2026, docs/proposition-reorganisation-espace.md, §2) :
-- une position de la carte des groupes ou de Mendelow peut être lue dans le
-- corpus du référentiel, sans fait daté, avec la référence de sa ligne. Les
-- positions existantes restent appuyées sur des faits (`faits` par défaut).
ALTER TABLE "positions" ADD COLUMN "origine" "origine_d_élément" DEFAULT 'faits' NOT NULL;--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "référence" text;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_reference" CHECK ("positions"."référence" is null or length("positions"."référence") between 1 and 120);