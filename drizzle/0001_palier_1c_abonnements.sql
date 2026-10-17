CREATE TABLE "abonnements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"client_stripe" text NOT NULL,
	"abonnement_stripe" text NOT NULL,
	"état" text NOT NULL,
	"formule" text,
	"période_fin" timestamp with time zone,
	"dernier_événement" text NOT NULL,
	"événement_le" timestamp with time zone NOT NULL,
	"reçu_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "abonnements_organisation_id_unique" UNIQUE("organisation_id"),
	CONSTRAINT "abonnements_client_stripe_forme" CHECK ("abonnements"."client_stripe" ~ '^cus_'),
	CONSTRAINT "abonnements_abonnement_stripe_forme" CHECK ("abonnements"."abonnement_stripe" ~ '^sub_')
);
--> statement-breakpoint
ALTER TABLE "abonnements" ADD CONSTRAINT "abonnements_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;