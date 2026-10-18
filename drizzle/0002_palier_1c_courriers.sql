CREATE TYPE "public"."sorte_courrier" AS ENUM('lien_acces', 'essai_derniere_parution', 'essai_tronquee', 'alerte_espaces');--> statement-breakpoint
CREATE TYPE "public"."état_courrier" AS ENUM('prevu', 'envoye', 'echec');--> statement-breakpoint
CREATE TABLE "courriers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sorte" "sorte_courrier" NOT NULL,
	"organisation_id" uuid,
	"lecteur_id" uuid,
	"destinataire_empreinte" text NOT NULL,
	"déclencheur" text NOT NULL,
	"état" "état_courrier" DEFAULT 'prevu' NOT NULL,
	"message_gmail" text,
	"erreur" text,
	"prévu_le" timestamp with time zone DEFAULT now() NOT NULL,
	"conclu_le" timestamp with time zone,
	CONSTRAINT "courriers_empreinte_forme" CHECK ("courriers"."destinataire_empreinte" ~ '^[0-9a-f]{8}$')
);
--> statement-breakpoint
ALTER TABLE "courriers" ADD CONSTRAINT "courriers_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courriers" ADD CONSTRAINT "courriers_lecteur_id_lecteurs_id_fk" FOREIGN KEY ("lecteur_id") REFERENCES "public"."lecteurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "courriers_prevu_le" ON "courriers" USING btree ("prévu_le");--> statement-breakpoint
CREATE INDEX "courriers_organisation" ON "courriers" USING btree ("organisation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "courriers_parcours_unique" ON "courriers" USING btree ("sorte","organisation_id",coalesce("lecteur_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "courriers"."sorte" in ('essai_derniere_parution', 'essai_tronquee');