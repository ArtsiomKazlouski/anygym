ALTER TABLE "exercise" DROP CONSTRAINT "exercise_equipment_model_id_equipment_model_id_fk";
--> statement-breakpoint
DROP INDEX "exercise_model_idx";--> statement-breakpoint
ALTER TABLE "equipment_model" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "exercise" DROP COLUMN "equipment_model_id";