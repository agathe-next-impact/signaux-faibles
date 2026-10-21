import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."gels" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"organisation_id" uuid,
  	"filiere_id" uuid,
  	"url" varchar NOT NULL,
  	"empreinte" varchar NOT NULL,
  	"phrases" jsonb,
  	"lu_le" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."organisations" ADD COLUMN "fiche" varchar;
  ALTER TABLE "payload"."prospects" ADD COLUMN "bloc" jsonb;
  ALTER TABLE "payload"."prospects" ADD COLUMN "bloc_le" timestamp(3) with time zone;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "gels_id" uuid;
  ALTER TABLE "payload"."gels" ADD CONSTRAINT "gels_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "payload"."organisations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."gels" ADD CONSTRAINT "gels_filiere_id_filieres_id_fk" FOREIGN KEY ("filiere_id") REFERENCES "payload"."filieres"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "gels_organisation_idx" ON "payload"."gels" USING btree ("organisation_id");
  CREATE INDEX "gels_filiere_idx" ON "payload"."gels" USING btree ("filiere_id");
  CREATE INDEX "gels_url_idx" ON "payload"."gels" USING btree ("url");
  CREATE INDEX "gels_updated_at_idx" ON "payload"."gels" USING btree ("updated_at");
  CREATE INDEX "gels_created_at_idx" ON "payload"."gels" USING btree ("created_at");
  CREATE INDEX "organisation_url_idx" ON "payload"."gels" USING btree ("organisation_id","url");
  CREATE INDEX "filiere_url_idx" ON "payload"."gels" USING btree ("filiere_id","url");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gels_fk" FOREIGN KEY ("gels_id") REFERENCES "payload"."gels"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_gels_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("gels_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."gels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."gels" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_gels_fk";
  
  DROP INDEX "payload"."payload_locked_documents_rels_gels_id_idx";
  ALTER TABLE "payload"."organisations" DROP COLUMN "fiche";
  ALTER TABLE "payload"."prospects" DROP COLUMN "bloc";
  ALTER TABLE "payload"."prospects" DROP COLUMN "bloc_le";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "gels_id";`)
}
