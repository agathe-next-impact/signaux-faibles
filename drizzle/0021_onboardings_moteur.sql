ALTER TYPE "public"."tâche_onboarding" ADD VALUE 'onboarding';--> statement-breakpoint
ALTER TABLE "onboarding_runs" ADD COLUMN "run_trigger" text;--> statement-breakpoint
ALTER TABLE "onboarding_runs" ADD CONSTRAINT "onboarding_runs_trigger_forme" CHECK ("onboarding_runs"."run_trigger" is null or "onboarding_runs"."run_trigger" ~ '^run_[a-z0-9]{6,40}$');