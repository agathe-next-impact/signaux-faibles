CREATE TYPE "public"."force_porter" AS ENUM('rivalite', 'nouveaux_entrants', 'substituts', 'pouvoir_clients', 'pouvoir_fournisseurs');--> statement-breakpoint
CREATE TYPE "public"."impact_de_fait" AS ENUM('FORT', 'MOYEN');--> statement-breakpoint
CREATE TYPE "public"."ansoff" AS ENUM('penetration', 'developpement_produit', 'developpement_marche', 'diversification');--> statement-breakpoint
CREATE TYPE "public"."nouveauté_de_fait" AS ENUM('nouveau', 'contexte');--> statement-breakpoint
CREATE TYPE "public"."origine_d_élément" AS ENUM('faits', 'declaratif');--> statement-breakpoint
CREATE TYPE "public"."outil_de_position" AS ENUM('groupes', 'mendelow', 'forces', 'ge');--> statement-breakpoint
CREATE TYPE "public"."outil_de_synthèse" AS ENUM('pestel', 'swot', 'tows', 'scenario', 'indice_cycle', 'benchmark', 'ge');--> statement-breakpoint
CREATE TYPE "public"."pestel" AS ENUM('politique', 'economique', 'socioculturel', 'technologique', 'ecologique', 'legal');--> statement-breakpoint
CREATE TYPE "public"."section_de_fait" AS ENUM('axe', 'acteurs');--> statement-breakpoint
CREATE TYPE "public"."tendance_de_force" AS ENUM('hausse', 'stable', 'baisse');--> statement-breakpoint
CREATE TYPE "public"."état_de_publication" AS ENUM('propose', 'publie', 'retire');--> statement-breakpoint
CREATE TYPE "public"."état_d_élément" AS ENUM('nouveau', 'renforce', 'inchange', 'affaibli');--> statement-breakpoint
CREATE TABLE "faits_etiquetes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"édition_notion" text NOT NULL,
	"famille_édition" text,
	"date_édition" date NOT NULL,
	"section" "section_de_fait" NOT NULL,
	"numéro_axe" smallint,
	"rang" smallint NOT NULL,
	"empreinte_titre" text NOT NULL,
	"date_fait" date NOT NULL,
	"source_url" text NOT NULL,
	"pestel" "pestel",
	"force_porter" "force_porter",
	"ansoff" "ansoff",
	"entité" text,
	"rupture" boolean NOT NULL,
	"impact" "impact_de_fait" NOT NULL,
	"nouveauté" "nouveauté_de_fait" NOT NULL,
	"run_id" uuid,
	"créé_le" timestamp with time zone DEFAULT now() NOT NULL,
	"archivée_le" timestamp with time zone,
	CONSTRAINT "faits_etiquetes_edition_forme" CHECK ("faits_etiquetes"."édition_notion" ~ '^[0-9a-f]{32}$'),
	CONSTRAINT "faits_etiquetes_empreinte_forme" CHECK ("faits_etiquetes"."empreinte_titre" ~ '^[0-9a-f]{8}$'),
	CONSTRAINT "faits_etiquetes_axe" CHECK (("faits_etiquetes"."section" = 'axe') = ("faits_etiquetes"."numéro_axe" is not null)),
	CONSTRAINT "faits_etiquetes_rang" CHECK ("faits_etiquetes"."rang" >= 1 and ("faits_etiquetes"."numéro_axe" is null or "faits_etiquetes"."numéro_axe" >= 1)),
	CONSTRAINT "faits_etiquetes_date" CHECK ("faits_etiquetes"."date_fait" <= "faits_etiquetes"."date_édition"),
	CONSTRAINT "faits_etiquetes_un_cadre" CHECK (("faits_etiquetes"."pestel" is null) <> ("faits_etiquetes"."force_porter" is null)),
	CONSTRAINT "faits_etiquetes_ansoff" CHECK ("faits_etiquetes"."ansoff" is null or ("faits_etiquetes"."force_porter" in ('rivalite', 'nouveaux_entrants') and "faits_etiquetes"."entité" is not null)),
	CONSTRAINT "faits_etiquetes_entite" CHECK ("faits_etiquetes"."entité" is null or length("faits_etiquetes"."entité") between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "grilles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"empreinte" text NOT NULL,
	"référentiel_notion" text NOT NULL,
	"axes_groupes" jsonb NOT NULL,
	"familles" jsonb NOT NULL,
	"entités" jsonb NOT NULL,
	"parties_prenantes" jsonb NOT NULL,
	"offres" jsonb,
	"validée_le" timestamp with time zone,
	"créée_le" timestamp with time zone DEFAULT now() NOT NULL,
	"archivée_le" timestamp with time zone,
	CONSTRAINT "grilles_version" CHECK ("grilles"."version" >= 1),
	CONSTRAINT "grilles_empreinte_forme" CHECK ("grilles"."empreinte" ~ '^[0-9a-f]{8}$'),
	CONSTRAINT "grilles_referentiel_forme" CHECK ("grilles"."référentiel_notion" ~ '^[0-9a-f]{32}$')
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"période" text NOT NULL,
	"outil" "outil_de_position" NOT NULL,
	"sujet" text NOT NULL,
	"axe" text NOT NULL,
	"cran" smallint,
	"non_suivi" boolean DEFAULT false NOT NULL,
	"tendance" "tendance_de_force",
	"faits" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"grille_version" integer NOT NULL,
	"état_publication" "état_de_publication" DEFAULT 'propose' NOT NULL,
	"créé_le" timestamp with time zone DEFAULT now() NOT NULL,
	"archivée_le" timestamp with time zone,
	CONSTRAINT "positions_periode_forme" CHECK ("positions"."période" ~ '^[0-9]{4}(-(0[1-9]|1[0-2])|-T[1-4])?$'),
	CONSTRAINT "positions_sujet" CHECK (length("positions"."sujet") between 1 and 80),
	CONSTRAINT "positions_axe" CHECK (length("positions"."axe") between 1 and 40),
	CONSTRAINT "positions_cran" CHECK (("positions"."non_suivi" and "positions"."cran" is null) or (not "positions"."non_suivi" and "positions"."cran" between 1 and 5)),
	CONSTRAINT "positions_tendance" CHECK ("positions"."tendance" is null or "positions"."outil" = 'forces'),
	CONSTRAINT "positions_grille_version" CHECK ("positions"."grille_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "elements_synthese" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"période" text NOT NULL,
	"fenêtre_début" date NOT NULL,
	"fenêtre_fin" date NOT NULL,
	"outil" "outil_de_synthèse" NOT NULL,
	"clé" text NOT NULL,
	"rang" smallint NOT NULL,
	"énoncé" text,
	"état" "état_d_élément",
	"origine" "origine_d_élément" DEFAULT 'faits' NOT NULL,
	"hypothèse" boolean DEFAULT false NOT NULL,
	"filiation" uuid,
	"faits" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"références" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"valeur" jsonb,
	"candidate_recommandation" boolean DEFAULT false NOT NULL,
	"grille_version" integer NOT NULL,
	"état_publication" "état_de_publication" DEFAULT 'propose' NOT NULL,
	"créé_le" timestamp with time zone DEFAULT now() NOT NULL,
	"archivée_le" timestamp with time zone,
	CONSTRAINT "elements_synthese_periode_forme" CHECK ("elements_synthese"."période" ~ '^[0-9]{4}(-(0[1-9]|1[0-2])|-T[1-4])?$'),
	CONSTRAINT "elements_synthese_fenetre" CHECK ("elements_synthese"."fenêtre_début" <= "elements_synthese"."fenêtre_fin"),
	CONSTRAINT "elements_synthese_cle" CHECK (length("elements_synthese"."clé") between 1 and 40),
	CONSTRAINT "elements_synthese_rang" CHECK ("elements_synthese"."rang" >= 1),
	CONSTRAINT "elements_synthese_enonce" CHECK ("elements_synthese"."énoncé" is null or length("elements_synthese"."énoncé") <= case when "elements_synthese"."outil" = 'scenario' then 400 else 240 end),
	CONSTRAINT "elements_synthese_etat_swot" CHECK (("elements_synthese"."outil" = 'swot') = ("elements_synthese"."état" is not null)),
	CONSTRAINT "elements_synthese_declaratif" CHECK ("elements_synthese"."origine" = 'faits' or ("elements_synthese"."outil" = 'swot' and "elements_synthese"."clé" in ('forces', 'faiblesses'))),
	CONSTRAINT "elements_synthese_candidate" CHECK (not "elements_synthese"."candidate_recommandation" or "elements_synthese"."outil" = 'tows'),
	CONSTRAINT "elements_synthese_grille_version" CHECK ("elements_synthese"."grille_version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "outils_strategiques" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "faits_etiquetes" ADD CONSTRAINT "faits_etiquetes_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faits_etiquetes" ADD CONSTRAINT "faits_etiquetes_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grilles" ADD CONSTRAINT "grilles_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elements_synthese" ADD CONSTRAINT "elements_synthese_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elements_synthese" ADD CONSTRAINT "elements_synthese_filiation_elements_synthese_id_fk" FOREIGN KEY ("filiation") REFERENCES "public"."elements_synthese"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "faits_etiquetes_place_unique" ON "faits_etiquetes" USING btree ("édition_notion","section",coalesce("numéro_axe", 0),"rang") WHERE "faits_etiquetes"."archivée_le" is null;--> statement-breakpoint
CREATE INDEX "faits_etiquetes_organisation" ON "faits_etiquetes" USING btree ("organisation_id","date_édition");--> statement-breakpoint
CREATE UNIQUE INDEX "grilles_version_unique" ON "grilles" USING btree ("organisation_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "positions_place_unique" ON "positions" USING btree ("organisation_id","période","outil","sujet","axe") WHERE "positions"."archivée_le" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "elements_synthese_place_unique" ON "elements_synthese" USING btree ("organisation_id","période","outil","clé","rang") WHERE "elements_synthese"."archivée_le" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "elements_synthese_candidate_unique" ON "elements_synthese" USING btree ("organisation_id","période") WHERE "elements_synthese"."candidate_recommandation" and "elements_synthese"."archivée_le" is null;