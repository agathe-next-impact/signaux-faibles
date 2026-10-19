CREATE TYPE "public"."statut_prospection" AS ENUM('envoye', 'actif', 'abonne', 'expire', 'resilie', 'rebondi', 'desinscrit');--> statement-breakpoint
CREATE TABLE "prospections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid,
	"lecteur_id" uuid,
	"destinataire_empreinte" text NOT NULL,
	"campagne_lemlist" text,
	"lead_lemlist" text,
	"contact_lemlist" text,
	"statut" "statut_prospection" DEFAULT 'envoye' NOT NULL,
	"statut_le" timestamp with time zone DEFAULT now() NOT NULL,
	"séquence_arrêtée_le" timestamp with time zone,
	"synchronisé_statut" "statut_prospection",
	"synchronisé_le" timestamp with time zone,
	"erreur_synchro" text,
	"dernier_événement_le" timestamp with time zone,
	"créée_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifiée_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prospections_lead_lemlist_unique" UNIQUE("lead_lemlist"),
	CONSTRAINT "prospections_empreinte_forme" CHECK ("prospections"."destinataire_empreinte" ~ '^[0-9a-f]{8}$'),
	CONSTRAINT "prospections_lead_forme" CHECK ("prospections"."lead_lemlist" is null or "prospections"."lead_lemlist" ~ '^lea_'),
	CONSTRAINT "prospections_campagne_forme" CHECK ("prospections"."campagne_lemlist" is null or "prospections"."campagne_lemlist" ~ '^cam_')
);
--> statement-breakpoint
CREATE TABLE "événements_prospection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospection_id" uuid NOT NULL,
	"activité_lemlist" text NOT NULL,
	"type" text NOT NULL,
	"étape" smallint,
	"survenu_le" timestamp with time zone NOT NULL,
	"reçu_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "événements_prospection_activité_lemlist_unique" UNIQUE("activité_lemlist")
);
--> statement-breakpoint
ALTER TABLE "prospections" ADD CONSTRAINT "prospections_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospections" ADD CONSTRAINT "prospections_lecteur_id_lecteurs_id_fk" FOREIGN KEY ("lecteur_id") REFERENCES "public"."lecteurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "événements_prospection" ADD CONSTRAINT "événements_prospection_prospection_id_prospections_id_fk" FOREIGN KEY ("prospection_id") REFERENCES "public"."prospections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prospections_empreinte" ON "prospections" USING btree ("destinataire_empreinte");--> statement-breakpoint
CREATE INDEX "prospections_organisation" ON "prospections" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "événements_prospection_prospection" ON "événements_prospection" USING btree ("prospection_id");