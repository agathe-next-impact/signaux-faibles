-- Les forfaits par nombre de lecteurs (19 novembre 2026, lib/domaine/offre.ts).
-- Toute organisation existante reste au forfait de base, trois lecteurs ; un abonnement Stripe
-- existant n'a pas de forfait (nul), et le forfait de son organisation fait foi.
CREATE TYPE "public"."forfait_lecteurs" AS ENUM('trois', 'dix', 'cent', 'illimite');--> statement-breakpoint
ALTER TABLE "abonnements" ADD COLUMN "forfait" "forfait_lecteurs";--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "forfait" "forfait_lecteurs" DEFAULT 'trois' NOT NULL;
