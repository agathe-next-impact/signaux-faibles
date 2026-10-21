import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_organisations_etat" AS ENUM('prospect', 'a_onboarder', 'en_onboarding', 'active', 'suspendue', 'archivee');
  CREATE TYPE "payload"."enum_filieres_cadence" AS ENUM('hebdomadaire', 'bimensuelle', 'mensuelle');
  CREATE TYPE "payload"."enum_editions_statut" AS ENUM('brouillon', 'publiee', 'retiree');
  CREATE TYPE "payload"."enum_prospects_statut" AS ENUM('a_contacter', 'lettre_1_envoyee', 'lettre_2_envoyee', 'visite', 'essai', 'abonne', 'desinscrit');
  CREATE TYPE "payload"."enum_runs_type" AS ENUM('parution', 'onboarding', 'filiere', 'bloc', 'decouverte');
  CREATE TABLE "payload"."utilisateurs_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "payload"."utilisateurs" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"nom" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."organisations" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"nom" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"site" varchar,
  	"filiere_id" uuid,
  	"contact_nom" varchar,
  	"contact_email" varchar,
  	"etat" "payload"."enum_organisations_etat" DEFAULT 'prospect' NOT NULL,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."filieres" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"nom" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"active" boolean DEFAULT true,
  	"cadence" "payload"."enum_filieres_cadence" DEFAULT 'hebdomadaire',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."referentiels" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"titre" varchar NOT NULL,
  	"markdown" varchar NOT NULL,
  	"version" numeric DEFAULT 1,
  	"organisation_id" uuid,
  	"filiere_id" uuid,
  	"actif" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."editions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"titre" varchar NOT NULL,
  	"organisation_id" uuid,
  	"filiere_id" uuid,
  	"numero" numeric,
  	"date_edition" timestamp(3) with time zone NOT NULL,
  	"statut" "payload"."enum_editions_statut" DEFAULT 'brouillon' NOT NULL,
  	"periode_couverte" varchar,
  	"fenetre_elargie" boolean DEFAULT false,
  	"action_de_la_semaine" varchar,
  	"dossiers_ouverts_suivis" varchar,
  	"markdown" varchar NOT NULL,
  	"blocs" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."prospects" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"organisation_id" uuid NOT NULL,
  	"filiere_id" uuid,
  	"statut" "payload"."enum_prospects_statut" DEFAULT 'a_contacter' NOT NULL,
  	"contact_nom" varchar,
  	"contact_email" varchar,
  	"derniere_lettre_le" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."runs" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"type" "payload"."enum_runs_type" NOT NULL,
  	"organisation_id" uuid,
  	"filiere_id" uuid,
  	"tache" varchar,
  	"accepte" boolean DEFAULT false,
  	"portes" jsonb,
  	"cout" jsonb,
  	"edition_id" uuid,
  	"debut" timestamp(3) with time zone,
  	"fin" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_kv" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"utilisateurs_id" uuid,
  	"organisations_id" uuid,
  	"filieres_id" uuid,
  	"referentiels_id" uuid,
  	"editions_id" uuid,
  	"prospects_id" uuid,
  	"runs_id" uuid
  );
  
  CREATE TABLE "payload"."payload_preferences" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"utilisateurs_id" uuid
  );
  
  CREATE TABLE "payload"."payload_migrations" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."utilisateurs_sessions" ADD CONSTRAINT "utilisateurs_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."organisations" ADD CONSTRAINT "organisations_filiere_id_filieres_id_fk" FOREIGN KEY ("filiere_id") REFERENCES "payload"."filieres"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."referentiels" ADD CONSTRAINT "referentiels_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "payload"."organisations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."referentiels" ADD CONSTRAINT "referentiels_filiere_id_filieres_id_fk" FOREIGN KEY ("filiere_id") REFERENCES "payload"."filieres"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."editions" ADD CONSTRAINT "editions_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "payload"."organisations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."editions" ADD CONSTRAINT "editions_filiere_id_filieres_id_fk" FOREIGN KEY ("filiere_id") REFERENCES "payload"."filieres"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."prospects" ADD CONSTRAINT "prospects_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "payload"."organisations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."prospects" ADD CONSTRAINT "prospects_filiere_id_filieres_id_fk" FOREIGN KEY ("filiere_id") REFERENCES "payload"."filieres"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."runs" ADD CONSTRAINT "runs_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "payload"."organisations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."runs" ADD CONSTRAINT "runs_filiere_id_filieres_id_fk" FOREIGN KEY ("filiere_id") REFERENCES "payload"."filieres"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."runs" ADD CONSTRAINT "runs_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "payload"."editions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_utilisateurs_fk" FOREIGN KEY ("utilisateurs_id") REFERENCES "payload"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_organisations_fk" FOREIGN KEY ("organisations_id") REFERENCES "payload"."organisations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_filieres_fk" FOREIGN KEY ("filieres_id") REFERENCES "payload"."filieres"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_referentiels_fk" FOREIGN KEY ("referentiels_id") REFERENCES "payload"."referentiels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_editions_fk" FOREIGN KEY ("editions_id") REFERENCES "payload"."editions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_prospects_fk" FOREIGN KEY ("prospects_id") REFERENCES "payload"."prospects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_runs_fk" FOREIGN KEY ("runs_id") REFERENCES "payload"."runs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_utilisateurs_fk" FOREIGN KEY ("utilisateurs_id") REFERENCES "payload"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "utilisateurs_sessions_order_idx" ON "payload"."utilisateurs_sessions" USING btree ("_order");
  CREATE INDEX "utilisateurs_sessions_parent_id_idx" ON "payload"."utilisateurs_sessions" USING btree ("_parent_id");
  CREATE INDEX "utilisateurs_updated_at_idx" ON "payload"."utilisateurs" USING btree ("updated_at");
  CREATE INDEX "utilisateurs_created_at_idx" ON "payload"."utilisateurs" USING btree ("created_at");
  CREATE UNIQUE INDEX "utilisateurs_email_idx" ON "payload"."utilisateurs" USING btree ("email");
  CREATE UNIQUE INDEX "organisations_slug_idx" ON "payload"."organisations" USING btree ("slug");
  CREATE INDEX "organisations_filiere_idx" ON "payload"."organisations" USING btree ("filiere_id");
  CREATE INDEX "organisations_etat_idx" ON "payload"."organisations" USING btree ("etat");
  CREATE INDEX "organisations_updated_at_idx" ON "payload"."organisations" USING btree ("updated_at");
  CREATE INDEX "organisations_created_at_idx" ON "payload"."organisations" USING btree ("created_at");
  CREATE UNIQUE INDEX "filieres_slug_idx" ON "payload"."filieres" USING btree ("slug");
  CREATE INDEX "filieres_updated_at_idx" ON "payload"."filieres" USING btree ("updated_at");
  CREATE INDEX "filieres_created_at_idx" ON "payload"."filieres" USING btree ("created_at");
  CREATE INDEX "referentiels_organisation_idx" ON "payload"."referentiels" USING btree ("organisation_id");
  CREATE INDEX "referentiels_filiere_idx" ON "payload"."referentiels" USING btree ("filiere_id");
  CREATE INDEX "referentiels_updated_at_idx" ON "payload"."referentiels" USING btree ("updated_at");
  CREATE INDEX "referentiels_created_at_idx" ON "payload"."referentiels" USING btree ("created_at");
  CREATE INDEX "editions_organisation_idx" ON "payload"."editions" USING btree ("organisation_id");
  CREATE INDEX "editions_filiere_idx" ON "payload"."editions" USING btree ("filiere_id");
  CREATE INDEX "editions_date_edition_idx" ON "payload"."editions" USING btree ("date_edition");
  CREATE INDEX "editions_statut_idx" ON "payload"."editions" USING btree ("statut");
  CREATE INDEX "editions_updated_at_idx" ON "payload"."editions" USING btree ("updated_at");
  CREATE INDEX "editions_created_at_idx" ON "payload"."editions" USING btree ("created_at");
  CREATE INDEX "organisation_statut_dateEdition_idx" ON "payload"."editions" USING btree ("organisation_id","statut","date_edition");
  CREATE INDEX "prospects_organisation_idx" ON "payload"."prospects" USING btree ("organisation_id");
  CREATE INDEX "prospects_filiere_idx" ON "payload"."prospects" USING btree ("filiere_id");
  CREATE INDEX "prospects_statut_idx" ON "payload"."prospects" USING btree ("statut");
  CREATE INDEX "prospects_updated_at_idx" ON "payload"."prospects" USING btree ("updated_at");
  CREATE INDEX "prospects_created_at_idx" ON "payload"."prospects" USING btree ("created_at");
  CREATE INDEX "runs_type_idx" ON "payload"."runs" USING btree ("type");
  CREATE INDEX "runs_organisation_idx" ON "payload"."runs" USING btree ("organisation_id");
  CREATE INDEX "runs_filiere_idx" ON "payload"."runs" USING btree ("filiere_id");
  CREATE INDEX "runs_edition_idx" ON "payload"."runs" USING btree ("edition_id");
  CREATE INDEX "runs_updated_at_idx" ON "payload"."runs" USING btree ("updated_at");
  CREATE INDEX "runs_created_at_idx" ON "payload"."runs" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_utilisateurs_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("utilisateurs_id");
  CREATE INDEX "payload_locked_documents_rels_organisations_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("organisations_id");
  CREATE INDEX "payload_locked_documents_rels_filieres_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("filieres_id");
  CREATE INDEX "payload_locked_documents_rels_referentiels_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("referentiels_id");
  CREATE INDEX "payload_locked_documents_rels_editions_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("editions_id");
  CREATE INDEX "payload_locked_documents_rels_prospects_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("prospects_id");
  CREATE INDEX "payload_locked_documents_rels_runs_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("runs_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_utilisateurs_id_idx" ON "payload"."payload_preferences_rels" USING btree ("utilisateurs_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload"."payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."utilisateurs_sessions" CASCADE;
  DROP TABLE "payload"."utilisateurs" CASCADE;
  DROP TABLE "payload"."organisations" CASCADE;
  DROP TABLE "payload"."filieres" CASCADE;
  DROP TABLE "payload"."referentiels" CASCADE;
  DROP TABLE "payload"."editions" CASCADE;
  DROP TABLE "payload"."prospects" CASCADE;
  DROP TABLE "payload"."runs" CASCADE;
  DROP TABLE "payload"."payload_kv" CASCADE;
  DROP TABLE "payload"."payload_locked_documents" CASCADE;
  DROP TABLE "payload"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload"."payload_preferences" CASCADE;
  DROP TABLE "payload"."payload_preferences_rels" CASCADE;
  DROP TABLE "payload"."payload_migrations" CASCADE;
  DROP TYPE "payload"."enum_organisations_etat";
  DROP TYPE "payload"."enum_filieres_cadence";
  DROP TYPE "payload"."enum_editions_statut";
  DROP TYPE "payload"."enum_prospects_statut";
  DROP TYPE "payload"."enum_runs_type";`)
}
