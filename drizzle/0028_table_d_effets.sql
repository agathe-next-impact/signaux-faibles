CREATE TABLE "tables_d_effets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"empreinte" text NOT NULL,
	"contenu" jsonb NOT NULL,
	"état_publication" "état_de_publication" DEFAULT 'propose' NOT NULL,
	"créée_le" timestamp with time zone DEFAULT now() NOT NULL,
	"publiée_le" timestamp with time zone,
	CONSTRAINT "tables_d_effets_version" CHECK ("tables_d_effets"."version" >= 1),
	CONSTRAINT "tables_d_effets_empreinte_forme" CHECK ("tables_d_effets"."empreinte" ~ '^[0-9a-f]{8}$'),
	CONSTRAINT "tables_d_effets_taille" CHECK (length("tables_d_effets"."contenu"::text) <= 60000)
);
--> statement-breakpoint
ALTER TABLE "tables_d_effets" ADD CONSTRAINT "tables_d_effets_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tables_d_effets_version_unique" ON "tables_d_effets" USING btree ("organisation_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "tables_d_effets_publiee_unique" ON "tables_d_effets" USING btree ("organisation_id") WHERE "tables_d_effets"."état_publication" = 'publie';