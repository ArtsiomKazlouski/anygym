CREATE TABLE "exercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"pattern_code" text NOT NULL,
	"equipment_model_id" uuid NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "equipment_model" DROP CONSTRAINT "equipment_model_pattern_code_pattern_code_fk";
--> statement-breakpoint
ALTER TABLE "session_item" DROP CONSTRAINT "session_item_gym_equipment_id_gym_equipment_id_fk";
--> statement-breakpoint
ALTER TABLE "template_item" DROP CONSTRAINT "template_item_preferred_model_id_equipment_model_id_fk";
--> statement-breakpoint
DROP INDEX "equipment_model_user_pattern_idx";--> statement-breakpoint
DROP INDEX "session_item_equipment_idx";--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_pattern_code_pattern_code_fk" FOREIGN KEY ("pattern_code") REFERENCES "public"."pattern"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_equipment_model_id_equipment_model_id_fk" FOREIGN KEY ("equipment_model_id") REFERENCES "public"."equipment_model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_user_pattern_idx" ON "exercise" USING btree ("user_id","pattern_code");--> statement-breakpoint
CREATE INDEX "exercise_model_idx" ON "exercise" USING btree ("equipment_model_id");--> statement-breakpoint
CREATE INDEX "equipment_model_user_idx" ON "equipment_model" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "equipment_model" DROP COLUMN "pattern_code";--> statement-breakpoint
ALTER TABLE "session_item" DROP COLUMN "gym_equipment_id";--> statement-breakpoint
ALTER TABLE "template_item" DROP COLUMN "preferred_model_id";--> statement-breakpoint
ALTER TABLE "template_item" DROP COLUMN "excluded_model_ids";