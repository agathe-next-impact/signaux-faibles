CREATE TABLE "appels_a_projets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"édition_notion" text NOT NULL,
	"date_édition" date NOT NULL,
	"clé" text NOT NULL,
	"rang" smallint NOT NULL,
	"intitulé" text NOT NULL,
	"financeur" text,
	"clôture" date NOT NULL,
	"adresse" text,
	"impact" text NOT NULL,
	"à_vérifier" boolean NOT NULL,
	"relevé_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appels_a_projets_édition_forme" CHECK ("appels_a_projets"."édition_notion" ~ '^[0-9a-f]{32}$'),
	CONSTRAINT "appels_a_projets_clé_taille" CHECK (length("appels_a_projets"."clé") between 1 and 300),
	CONSTRAINT "appels_a_projets_intitulé_taille" CHECK (length("appels_a_projets"."intitulé") between 1 and 120),
	CONSTRAINT "appels_a_projets_financeur_taille" CHECK ("appels_a_projets"."financeur" is null or length("appels_a_projets"."financeur") between 1 and 80),
	CONSTRAINT "appels_a_projets_adresse_forme" CHECK ("appels_a_projets"."adresse" is null or ("appels_a_projets"."adresse" ~ '^https?://' and length("appels_a_projets"."adresse") <= 500)),
	CONSTRAINT "appels_a_projets_impact" CHECK ("appels_a_projets"."impact" in ('fort', 'moyen')),
	CONSTRAINT "appels_a_projets_rang" CHECK ("appels_a_projets"."rang" >= 1)
);
--> statement-breakpoint
ALTER TABLE "appels_a_projets" ADD CONSTRAINT "appels_a_projets_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appels_a_projets_unique" ON "appels_a_projets" USING btree ("édition_notion","clé");--> statement-breakpoint
CREATE INDEX "appels_a_projets_organisation" ON "appels_a_projets" USING btree ("organisation_id","date_édition");