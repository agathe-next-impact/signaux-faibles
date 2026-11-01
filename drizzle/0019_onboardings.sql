CREATE TYPE "public"."exécuteur_onboarding" AS ENUM('api', 'cowork');--> statement-breakpoint
CREATE TYPE "public"."tâche_onboarding" AS ENUM('balayage', 'premiere_lettre');--> statement-breakpoint
CREATE TYPE "public"."état_run_onboarding" AS ENUM('demande', 'lance', 'en_cours', 'reussi', 'bloque', 'echec', 'refuse');--> statement-breakpoint
CREATE TABLE "onboarding_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"onboarding_id" uuid NOT NULL,
	"tâche" "tâche_onboarding" NOT NULL,
	"état" "état_run_onboarding" NOT NULL,
	"run_github" bigint,
	"tentative" smallint,
	"lien" text,
	"plafond_usd" numeric(10, 4),
	"coût_usd" numeric(10, 4),
	"début" timestamp with time zone,
	"fin" timestamp with time zone,
	"créé_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_runs_lien_forme" CHECK ("onboarding_runs"."lien" is null or "onboarding_runs"."lien" ~ '^https://github[.]com/'),
	CONSTRAINT "onboarding_runs_coût" CHECK ("onboarding_runs"."coût_usd" is null or "onboarding_runs"."coût_usd" >= 0)
);
--> statement-breakpoint
CREATE TABLE "onboardings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nom" text,
	"site" text,
	"exécuteur" "exécuteur_onboarding" DEFAULT 'api' NOT NULL,
	"registre_notion" text,
	"statut_rapporté" smallint,
	"statut_rapporté_le" timestamp with time zone,
	"motif_de_blocage" text,
	"intake" jsonb,
	"créé_par" text NOT NULL,
	"créé_le" timestamp with time zone DEFAULT now() NOT NULL,
	"mis_à_jour_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboardings_slug_unique" UNIQUE("slug"),
	CONSTRAINT "onboardings_slug_forme" CHECK ("onboardings"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "onboardings_registre_forme" CHECK ("onboardings"."registre_notion" is null or "onboardings"."registre_notion" ~ '^[0-9a-f]{32}$'),
	CONSTRAINT "onboardings_statut" CHECK ("onboardings"."statut_rapporté" is null or "onboardings"."statut_rapporté" between 1 and 6),
	CONSTRAINT "onboardings_motif_taille" CHECK ("onboardings"."motif_de_blocage" is null or length("onboardings"."motif_de_blocage") <= 300),
	CONSTRAINT "onboardings_nom_taille" CHECK ("onboardings"."nom" is null or length("onboardings"."nom") <= 200),
	CONSTRAINT "onboardings_site_taille" CHECK ("onboardings"."site" is null or length("onboardings"."site") <= 500),
	CONSTRAINT "onboardings_intake_taille" CHECK ("onboardings"."intake" is null or length("onboardings"."intake"::text) <= 4000)
);
--> statement-breakpoint
ALTER TABLE "onboarding_runs" ADD CONSTRAINT "onboarding_runs_onboarding_id_onboardings_id_fk" FOREIGN KEY ("onboarding_id") REFERENCES "public"."onboardings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "onboarding_runs_onboarding" ON "onboarding_runs" USING btree ("onboarding_id","créé_le");--> statement-breakpoint
CREATE INDEX "onboarding_runs_créé_le" ON "onboarding_runs" USING btree ("créé_le");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_runs_github_unique" ON "onboarding_runs" USING btree ("run_github","tentative") WHERE "onboarding_runs"."run_github" is not null;