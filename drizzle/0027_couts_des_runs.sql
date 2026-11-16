CREATE TABLE "couts_des_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tâche" text NOT NULL,
	"organisation" text,
	"organisations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"issue" text NOT NULL,
	"coût_usd" numeric(10, 4) NOT NULL,
	"plafond_usd" numeric(10, 4),
	"durée_ms" integer,
	"tours" integer,
	"par_modèle" jsonb,
	"run_github" bigint,
	"tentative" smallint,
	"lien" text,
	"origine" text DEFAULT 'harnais' NOT NULL,
	"mesuré_le" timestamp with time zone NOT NULL,
	"reçu_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "couts_des_runs_coût" CHECK ("couts_des_runs"."coût_usd" >= 0),
	CONSTRAINT "couts_des_runs_tâche_forme" CHECK ("couts_des_runs"."tâche" ~ '^[a-z][a-z_-]{1,39}$'),
	CONSTRAINT "couts_des_runs_lien_forme" CHECK ("couts_des_runs"."lien" is null or "couts_des_runs"."lien" ~ '^https://github[.]com/'),
	CONSTRAINT "couts_des_runs_origine" CHECK ("couts_des_runs"."origine" in ('harnais', 'onboarding'))
);
--> statement-breakpoint
CREATE INDEX "couts_des_runs_mesuré_le" ON "couts_des_runs" USING btree ("mesuré_le");--> statement-breakpoint
CREATE UNIQUE INDEX "couts_des_runs_github_unique" ON "couts_des_runs" USING btree ("run_github","tentative") WHERE "couts_des_runs"."run_github" is not null;--> statement-breakpoint
-- Reprise, écrite à la main : les runs d'onboarding déjà mesurés (début et fin
-- rapportés par le harnais depuis le 1er novembre 2026) entrent dans le suivi
-- commun, pour que le total du mois ne commence pas à zéro. Une seule fois : à
-- partir de cette migration, le harnais rapporte lui-même chaque run. Un
-- lancement refusé ou échoué avant la session (coût nul) n'est pas un run mesuré.
INSERT INTO "couts_des_runs" ("tâche", "organisation", "organisations", "issue", "coût_usd", "plafond_usd", "durée_ms", "run_github", "tentative", "lien", "origine", "mesuré_le")
SELECT
	replace(r."tâche"::text, '_', '-'),
	o."slug",
	jsonb_build_array(o."slug"),
	CASE WHEN r."état" = 'reussi' THEN 'success' ELSE r."état"::text END,
	r."coût_usd",
	r."plafond_usd",
	CASE WHEN r."début" IS NOT NULL AND r."fin" IS NOT NULL THEN (extract(epoch FROM (r."fin" - r."début")) * 1000)::integer END,
	r."run_github",
	CASE WHEN r."run_github" IS NOT NULL THEN coalesce(r."tentative", 1) END,
	r."lien",
	'onboarding',
	coalesce(r."début", r."créé_le")
FROM "onboarding_runs" r
JOIN "onboardings" o ON o."id" = r."onboarding_id"
WHERE r."coût_usd" > 0
ON CONFLICT DO NOTHING;
