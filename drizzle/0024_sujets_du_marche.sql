-- Ce que l'écran « Concurrents » montre (7 novembre 2026, lib/domaine/sujets-du-marche.ts) :
-- concurrents par défaut, entreprises pour une veille adaptée aux mouvements du territoire (CCI du Cantal).
ALTER TABLE "organisations" ADD COLUMN "sujets_du_marche" text DEFAULT 'concurrents' NOT NULL;--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_sujets_du_marche" CHECK ("organisations"."sujets_du_marche" in ('concurrents', 'entreprises'));