CREATE TYPE "public"."set_scheme" AS ENUM('straight', 'ramp');--> statement-breakpoint
ALTER TYPE "public"."set_kind" ADD VALUE 'ramp' BEFORE 'working';--> statement-breakpoint
ALTER TABLE "template_item" ADD COLUMN "scheme" "set_scheme" DEFAULT 'straight' NOT NULL;--> statement-breakpoint
ALTER TABLE "template_item" ADD COLUMN "ramp_percents" numeric(4, 3)[];--> statement-breakpoint
ALTER TABLE "template_item" ADD COLUMN "ramp_reps" integer[];