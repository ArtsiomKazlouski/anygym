ALTER TABLE "equipment_model" ADD COLUMN "ramp_step" numeric(7, 2);--> statement-breakpoint
ALTER TABLE "gym_equipment" ADD COLUMN "ramp_step_override" numeric(7, 2);