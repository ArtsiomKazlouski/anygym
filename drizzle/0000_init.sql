CREATE TYPE "public"."equipment_kind" AS ENUM('stack', 'plate_loaded', 'dumbbell', 'barbell', 'cable', 'bodyweight');--> statement-breakpoint
CREATE TYPE "public"."prescription_source" AS ENUM('history', 'probe', 'manual', 'deload', 'pain_backoff');--> statement-breakpoint
CREATE TYPE "public"."session_item_status" AS ENUM('pending', 'active', 'done', 'deferred', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."set_feedback" AS ENUM('easy', 'on_target', 'limit', 'failed');--> statement-breakpoint
CREATE TYPE "public"."set_kind" AS ENUM('warmup', 'working');--> statement-breakpoint
CREATE TYPE "public"."weight_units" AS ENUM('kg', 'lb');--> statement-breakpoint
CREATE TABLE "auth_account" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "auth_account_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verification_token" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "auth_verification_token_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "equipment_model" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"kind" "equipment_kind" NOT NULL,
	"pattern_code" text NOT NULL,
	"units" "weight_units" DEFAULT 'kg' NOT NULL,
	"step" numeric(7, 2),
	"min_weight" numeric(7, 2),
	"max_weight" numeric(7, 2),
	"ladder" numeric(7, 2)[],
	"bar_weight" numeric(7, 2),
	"photo" "bytea",
	"photo_mime" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_setup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"equipment_model_id" uuid NOT NULL,
	"gym_equipment_id" uuid,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_setup_unique" UNIQUE("user_id","equipment_model_id","gym_equipment_id")
);
--> statement-breakpoint
CREATE TABLE "gym_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"equipment_model_id" uuid NOT NULL,
	"location_note" text,
	"units_override" "weight_units",
	"step_override" numeric(7, 2),
	"min_override" numeric(7, 2),
	"max_override" numeric(7, 2),
	"ladder_override" numeric(7, 2)[],
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gym_equipment_unique" UNIQUE("gym_id","equipment_model_id")
);
--> statement-breakpoint
CREATE TABLE "gym" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pattern" (
	"code" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"muscle_group" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"template_item_id" uuid,
	"pattern_code" text NOT NULL,
	"gym_equipment_id" uuid,
	"status" "session_item_status" DEFAULT 'pending' NOT NULL,
	"target_sets" integer NOT NULL,
	"rep_min" integer NOT NULL,
	"rep_max" integer NOT NULL,
	"deferred_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "set_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_item_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" "set_kind" DEFAULT 'working' NOT NULL,
	"weight" numeric(7, 2) NOT NULL,
	"units" "weight_units" NOT NULL,
	"weight_kg" numeric(7, 2) NOT NULL,
	"reps" integer,
	"feedback" "set_feedback",
	"pain_zone" text,
	"prescribed_weight_kg" numeric(7, 2),
	"prescription_source" "prescription_source",
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"pattern_code" text NOT NULL,
	"preferred_model_id" uuid,
	"excluded_model_ids" uuid[] DEFAULT '{}' NOT NULL,
	"sets" integer DEFAULT 3 NOT NULL,
	"rep_min" integer DEFAULT 8 NOT NULL,
	"rep_max" integer DEFAULT 12 NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"gym_id" uuid NOT NULL,
	"template_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_model" ADD CONSTRAINT "equipment_model_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_model" ADD CONSTRAINT "equipment_model_pattern_code_pattern_code_fk" FOREIGN KEY ("pattern_code") REFERENCES "public"."pattern"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_setup" ADD CONSTRAINT "equipment_setup_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_setup" ADD CONSTRAINT "equipment_setup_equipment_model_id_equipment_model_id_fk" FOREIGN KEY ("equipment_model_id") REFERENCES "public"."equipment_model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_setup" ADD CONSTRAINT "equipment_setup_gym_equipment_id_gym_equipment_id_fk" FOREIGN KEY ("gym_equipment_id") REFERENCES "public"."gym_equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_equipment" ADD CONSTRAINT "gym_equipment_gym_id_gym_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gym"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_equipment" ADD CONSTRAINT "gym_equipment_equipment_model_id_equipment_model_id_fk" FOREIGN KEY ("equipment_model_id") REFERENCES "public"."equipment_model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym" ADD CONSTRAINT "gym_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_item" ADD CONSTRAINT "session_item_session_id_workout_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_item" ADD CONSTRAINT "session_item_template_item_id_template_item_id_fk" FOREIGN KEY ("template_item_id") REFERENCES "public"."template_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_item" ADD CONSTRAINT "session_item_pattern_code_pattern_code_fk" FOREIGN KEY ("pattern_code") REFERENCES "public"."pattern"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_item" ADD CONSTRAINT "session_item_gym_equipment_id_gym_equipment_id_fk" FOREIGN KEY ("gym_equipment_id") REFERENCES "public"."gym_equipment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_log" ADD CONSTRAINT "set_log_session_item_id_session_item_id_fk" FOREIGN KEY ("session_item_id") REFERENCES "public"."session_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_item" ADD CONSTRAINT "template_item_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_item" ADD CONSTRAINT "template_item_pattern_code_pattern_code_fk" FOREIGN KEY ("pattern_code") REFERENCES "public"."pattern"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_item" ADD CONSTRAINT "template_item_preferred_model_id_equipment_model_id_fk" FOREIGN KEY ("preferred_model_id") REFERENCES "public"."equipment_model"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template" ADD CONSTRAINT "template_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_gym_id_gym_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gym"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "equipment_model_user_pattern_idx" ON "equipment_model" USING btree ("user_id","pattern_code");--> statement-breakpoint
CREATE INDEX "gym_equipment_gym_idx" ON "gym_equipment" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "gym_equipment_model_idx" ON "gym_equipment" USING btree ("equipment_model_id");--> statement-breakpoint
CREATE INDEX "session_item_session_idx" ON "session_item" USING btree ("session_id","position");--> statement-breakpoint
CREATE INDEX "session_item_equipment_idx" ON "session_item" USING btree ("gym_equipment_id");--> statement-breakpoint
CREATE INDEX "set_log_item_idx" ON "set_log" USING btree ("session_item_id","position");--> statement-breakpoint
CREATE INDEX "set_log_kind_logged_idx" ON "set_log" USING btree ("kind","logged_at");--> statement-breakpoint
CREATE INDEX "template_item_template_idx" ON "template_item" USING btree ("template_id","position");--> statement-breakpoint
CREATE INDEX "workout_session_user_started_idx" ON "workout_session" USING btree ("user_id","started_at");