CREATE TYPE "public"."type_prescripteur" AS ENUM('conseil', 'expertise_comptable', 'juridique', 'chambre_consulaire', 'developpement_economique', 'cluster_federation', 'ess_financeur', 'autre');--> statement-breakpoint
CREATE TABLE "prescripteurs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"code" text NOT NULL,
	"type" "type_prescripteur" NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"créé_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifié_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prescripteurs_organisation_id_unique" UNIQUE("organisation_id"),
	CONSTRAINT "prescripteurs_code_unique" UNIQUE("code"),
	CONSTRAINT "prescripteurs_code_forme" CHECK ("prescripteurs"."code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("prescripteurs"."code") between 3 and 40)
);
--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "recommandée_par" uuid;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "recommandée_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "partage_avec_prescripteur" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "prescripteurs" ADD CONSTRAINT "prescripteurs_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_recommandée_par_prescripteurs_id_fk" FOREIGN KEY ("recommandée_par") REFERENCES "public"."prescripteurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_recommandée_hors_prospection" CHECK (not ("organisations"."entrée_par_prospection" and "organisations"."recommandée_par" is not null));--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_recommandée_datée" CHECK (("organisations"."recommandée_par" is null) = ("organisations"."recommandée_le" is null));