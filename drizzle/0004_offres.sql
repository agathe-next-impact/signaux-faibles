CREATE TYPE "public"."offre_organisation" AS ENUM('standard', 'early_adopter', 'gratuite');--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "offre" "offre_organisation" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "parutions_d_essai" smallint DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_parutions_d_essai" CHECK ("organisations"."parutions_d_essai" between 1 and 8);