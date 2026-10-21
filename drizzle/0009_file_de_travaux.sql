CREATE TYPE "public"."type_travail" AS ENUM('referentiel', 'premiere_lettre', 'lettre', 'revue');--> statement-breakpoint
CREATE TYPE "public"."état_travail" AS ENUM('a_faire', 'pris', 'accepte', 'refuse', 'abandonne');--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"travail_id" uuid NOT NULL,
	"début" timestamp with time zone,
	"fin" timestamp with time zone,
	"exécuteur" text NOT NULL,
	"résultat" jsonb NOT NULL,
	"portes" jsonb NOT NULL,
	"accepté" boolean NOT NULL,
	"page_notion" text,
	"coût" jsonb,
	"créé_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runs_page_notion_forme" CHECK ("runs"."page_notion" is null or "runs"."page_notion" ~ '^[0-9a-f]{32}$')
);
--> statement-breakpoint
CREATE TABLE "travaux" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "type_travail" NOT NULL,
	"organisation_id" uuid NOT NULL,
	"veille_id" uuid,
	"échéance" timestamp with time zone NOT NULL,
	"état" "état_travail" DEFAULT 'a_faire' NOT NULL,
	"pris_le" timestamp with time zone,
	"pris_par" text,
	"tentatives" smallint DEFAULT 0 NOT NULL,
	"contexte" jsonb NOT NULL,
	"résultat_run_id" uuid,
	"créé_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "travaux_tentatives" CHECK ("travaux"."tentatives" between 0 and 3)
);
--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_travail_id_travaux_id_fk" FOREIGN KEY ("travail_id") REFERENCES "public"."travaux"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travaux" ADD CONSTRAINT "travaux_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travaux" ADD CONSTRAINT "travaux_veille_id_veilles_id_fk" FOREIGN KEY ("veille_id") REFERENCES "public"."veilles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "runs_travail" ON "runs" USING btree ("travail_id");--> statement-breakpoint
CREATE INDEX "travaux_échéance" ON "travaux" USING btree ("état","échéance");--> statement-breakpoint
CREATE INDEX "travaux_organisation" ON "travaux" USING btree ("organisation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "travaux_ouvert_unique" ON "travaux" USING btree ("organisation_id",coalesce("veille_id", '00000000-0000-0000-0000-000000000000'::uuid),"type") WHERE "travaux"."état" in ('a_faire', 'pris', 'refuse');