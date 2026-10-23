ALTER TYPE "public"."sorte_courrier" ADD VALUE 'essai_rappel_j7';--> statement-breakpoint
ALTER TYPE "public"."sorte_courrier" ADD VALUE 'essai_suspendu';--> statement-breakpoint
ALTER TYPE "public"."sorte_courrier" ADD VALUE 'abonnement_confirme';--> statement-breakpoint
ALTER TYPE "public"."sorte_courrier" ADD VALUE 'paiement_echec';--> statement-breakpoint
ALTER TYPE "public"."sorte_courrier" ADD VALUE 'abonnement_renouvellement';--> statement-breakpoint
ALTER TYPE "public"."sorte_courrier" ADD VALUE 'abonnement_resilie';--> statement-breakpoint
ALTER TYPE "public"."état_courrier" ADD VALUE 'brouillon';--> statement-breakpoint
ALTER TABLE "courriers" ADD COLUMN "clé" text;--> statement-breakpoint
CREATE UNIQUE INDEX "courriers_commerciaux_unique" ON "courriers" USING btree ("sorte","organisation_id",coalesce("lecteur_id", '00000000-0000-0000-0000-000000000000'::uuid),"clé") WHERE "courriers"."clé" is not null and "courriers"."état" <> 'echec';