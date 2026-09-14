ALTER TYPE "public"."prescription_source" ADD VALUE 'declared' BEFORE 'probe';--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "declared_working_kg" numeric(7, 2);