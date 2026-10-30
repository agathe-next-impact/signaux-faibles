CREATE TABLE "fiches_de_veille" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"grille_version" integer NOT NULL,
	"contenu" jsonb NOT NULL,
	"état_publication" "état_de_publication" DEFAULT 'propose' NOT NULL,
	"reçue_le" timestamp with time zone DEFAULT now() NOT NULL,
	"publiée_le" timestamp with time zone,
	CONSTRAINT "fiches_de_veille_version" CHECK ("fiches_de_veille"."version" >= 1),
	CONSTRAINT "fiches_de_veille_grille_version" CHECK ("fiches_de_veille"."grille_version" >= 1),
	CONSTRAINT "fiches_de_veille_taille" CHECK (length("fiches_de_veille"."contenu"::text) <= 40000)
);
--> statement-breakpoint
ALTER TABLE "fiches_de_veille" ADD CONSTRAINT "fiches_de_veille_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fiches_de_veille_version_unique" ON "fiches_de_veille" USING btree ("organisation_id","version");