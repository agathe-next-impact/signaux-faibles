CREATE TABLE "mesures_de_marche" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"période" text NOT NULL,
	"clé" text NOT NULL,
	"segments_version" integer NOT NULL,
	"valeur" jsonb NOT NULL,
	"état_publication" "état_de_publication" DEFAULT 'propose' NOT NULL,
	"calculée_le" timestamp with time zone DEFAULT now() NOT NULL,
	"archivée_le" timestamp with time zone,
	CONSTRAINT "mesures_de_marche_periode_forme" CHECK ("mesures_de_marche"."période" ~ '^[0-9]{4}-T[1-4]$'),
	CONSTRAINT "mesures_de_marche_cle" CHECK ("mesures_de_marche"."clé" ~ '^[a-z][a-z0-9_]{0,39}$'),
	CONSTRAINT "mesures_de_marche_version" CHECK ("mesures_de_marche"."segments_version" >= 1),
	CONSTRAINT "mesures_de_marche_taille" CHECK (length("mesures_de_marche"."valeur"::text) <= 8000)
);
--> statement-breakpoint
CREATE TABLE "segments_de_marche" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"empreinte" text NOT NULL,
	"grille_version" integer NOT NULL,
	"contenu" jsonb NOT NULL,
	"créée_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "segments_de_marche_version" CHECK ("segments_de_marche"."version" >= 1),
	CONSTRAINT "segments_de_marche_grille_version" CHECK ("segments_de_marche"."grille_version" >= 1),
	CONSTRAINT "segments_de_marche_empreinte_forme" CHECK ("segments_de_marche"."empreinte" ~ '^[0-9a-f]{8}$'),
	CONSTRAINT "segments_de_marche_taille" CHECK (length("segments_de_marche"."contenu"::text) <= 60000)
);
--> statement-breakpoint
ALTER TABLE "mesures_de_marche" ADD CONSTRAINT "mesures_de_marche_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments_de_marche" ADD CONSTRAINT "segments_de_marche_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mesures_de_marche_place_unique" ON "mesures_de_marche" USING btree ("organisation_id","période","clé") WHERE "mesures_de_marche"."archivée_le" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "segments_de_marche_version_unique" ON "segments_de_marche" USING btree ("organisation_id","version");