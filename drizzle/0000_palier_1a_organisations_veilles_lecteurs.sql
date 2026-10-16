CREATE TYPE "public"."cadence_veille" AS ENUM('hebdomadaire', 'bimensuelle', 'mensuelle');--> statement-breakpoint
CREATE TYPE "public"."rôle_lecteur" AS ENUM('lecteur', 'relecteur', 'operateur');--> statement-breakpoint
CREATE TYPE "public"."état_organisation" AS ENUM('demande', 'generation', 'essai', 'abonnee', 'suspendue', 'ecartee', 'test');--> statement-breakpoint
CREATE TYPE "public"."état_veille" AS ENUM('active', 'suspendue', 'archivée');--> statement-breakpoint
CREATE TABLE "lecteurs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid,
	"nom" text NOT NULL,
	"email" text,
	"identifiant_acces" text NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"tous_les_espaces" boolean DEFAULT false NOT NULL,
	"rôle" "rôle_lecteur" DEFAULT 'lecteur' NOT NULL,
	"créé_le" timestamp with time zone DEFAULT now() NOT NULL,
	"dernière_visite_le" timestamp with time zone,
	CONSTRAINT "lecteurs_identifiant_acces_unique" UNIQUE("identifiant_acces"),
	CONSTRAINT "lecteurs_identifiant_non_vide" CHECK (length(trim("lecteurs"."identifiant_acces")) > 0)
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nom" text NOT NULL,
	"url_site" text,
	"page_organisation_notion" text,
	"registre_notion" text,
	"état" "état_organisation" NOT NULL,
	"demandée_le" timestamp with time zone,
	"activée_le" timestamp with time zone,
	"suspendue_le" timestamp with time zone,
	"relecture_requise" boolean DEFAULT true NOT NULL,
	"email_relecture" text,
	"créée_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifiée_le" timestamp with time zone DEFAULT now() NOT NULL,
	"archivée_le" timestamp with time zone,
	CONSTRAINT "organisations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organisations_registre_notion_unique" UNIQUE("registre_notion"),
	CONSTRAINT "organisations_slug_non_vide" CHECK (length(trim("organisations"."slug")) > 0),
	CONSTRAINT "organisations_registre_notion_forme" CHECK ("organisations"."registre_notion" is null or "organisations"."registre_notion" ~ '^[0-9a-f]{32}$')
);
--> statement-breakpoint
CREATE TABLE "veilles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"type" text NOT NULL,
	"libellé" text NOT NULL,
	"referentiel_notion" text,
	"jour_parution" smallint NOT NULL,
	"heure_parution" time NOT NULL,
	"cadence" "cadence_veille" NOT NULL,
	"numéro_courant" integer DEFAULT 0 NOT NULL,
	"état" "état_veille" DEFAULT 'active' NOT NULL,
	CONSTRAINT "veilles_jour_parution" CHECK ("veilles"."jour_parution" between 1 and 7)
);
--> statement-breakpoint
ALTER TABLE "lecteurs" ADD CONSTRAINT "lecteurs_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "veilles" ADD CONSTRAINT "veilles_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lecteurs_organisation_email" ON "lecteurs" USING btree ("organisation_id",lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "veilles_organisation_type" ON "veilles" USING btree ("organisation_id","type");