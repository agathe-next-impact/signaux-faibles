import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Le statut « à publier » d'une édition (1er novembre 2026, aperçu avant
 * envoi) : une lettre acceptée par le moteur, qui attend que l'opératrice la
 * lise dans l'espace puis la publie depuis la fiche de l'organisation. Écrite à
 * la main, sur le modèle de `payload migrate:create` : une valeur d'énumération
 * de plus, en `IF NOT EXISTS` pour rester rejouable.
 *
 * Le retour en arrière ramène les éditions « à publier » en brouillon : Postgres
 * ne retire pas une valeur d'énumération, le type est donc recréé.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "payload"."enum_editions_statut" ADD VALUE IF NOT EXISTS 'a_publier' BEFORE 'publiee';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "payload"."editions" SET "statut" = 'brouillon' WHERE "statut" = 'a_publier';
  ALTER TABLE "payload"."editions" ALTER COLUMN "statut" DROP DEFAULT;
  ALTER TYPE "payload"."enum_editions_statut" RENAME TO "enum_editions_statut_ancien";
  CREATE TYPE "payload"."enum_editions_statut" AS ENUM('brouillon', 'publiee', 'retiree');
  ALTER TABLE "payload"."editions" ALTER COLUMN "statut" TYPE "payload"."enum_editions_statut" USING "statut"::text::"payload"."enum_editions_statut";
  ALTER TABLE "payload"."editions" ALTER COLUMN "statut" SET DEFAULT 'brouillon';
  DROP TYPE "payload"."enum_editions_statut_ancien";`)
}
