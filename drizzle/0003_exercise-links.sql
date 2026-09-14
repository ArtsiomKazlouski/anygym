ALTER TABLE "session_item" ADD COLUMN "exercise_id" uuid;--> statement-breakpoint
ALTER TABLE "template_item" ADD COLUMN "preferred_exercise_id" uuid;--> statement-breakpoint
ALTER TABLE "template_item" ADD COLUMN "excluded_exercise_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "session_item" ADD CONSTRAINT "session_item_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_item" ADD CONSTRAINT "template_item_preferred_exercise_id_exercise_id_fk" FOREIGN KEY ("preferred_exercise_id") REFERENCES "public"."exercise"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_item_exercise_idx" ON "session_item" USING btree ("exercise_id");