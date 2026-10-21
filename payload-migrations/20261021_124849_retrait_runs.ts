import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Généré par `payload migrate:create`, puis corrigé à la main : `DROP TABLE
 * … CASCADE` emporte déjà la contrainte de clé étrangère de
 * `payload_locked_documents_rels`, et le `DROP CONSTRAINT` qui suivait
 * faisait échouer toute la migration (build de production du 22 octobre 2026,
 * « constraint … does not exist »). Chaque geste est en `IF EXISTS` : la
 * migration est rejouable quel que soit l'état où la précédente tentative l'a
 * laissée.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE IF EXISTS "payload"."runs" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_runs_fk";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_runs_id_idx";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "runs_id";
  DROP TYPE IF EXISTS "payload"."enum_runs_type";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_runs_type" AS ENUM('parution', 'onboarding', 'filiere', 'bloc', 'decouverte');
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
  
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "runs_id" uuid;
  ALTER TABLE "payload"."runs" ADD CONSTRAINT "runs_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "payload"."organisations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."runs" ADD CONSTRAINT "runs_filiere_id_filieres_id_fk" FOREIGN KEY ("filiere_id") REFERENCES "payload"."filieres"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."runs" ADD CONSTRAINT "runs_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "payload"."editions"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "runs_type_idx" ON "payload"."runs" USING btree ("type");
  CREATE INDEX "runs_organisation_idx" ON "payload"."runs" USING btree ("organisation_id");
  CREATE INDEX "runs_filiere_idx" ON "payload"."runs" USING btree ("filiere_id");
  CREATE INDEX "runs_edition_idx" ON "payload"."runs" USING btree ("edition_id");
  CREATE INDEX "runs_updated_at_idx" ON "payload"."runs" USING btree ("updated_at");
  CREATE INDEX "runs_created_at_idx" ON "payload"."runs" USING btree ("created_at");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_runs_fk" FOREIGN KEY ("runs_id") REFERENCES "payload"."runs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_runs_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("runs_id");`)
}
