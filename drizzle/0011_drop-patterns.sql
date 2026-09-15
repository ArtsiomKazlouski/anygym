-- Сначала снимаются ссылки, потом удаляется справочник: DROP TABLE ... CASCADE
-- унёс бы внешние ключи сам, и следующие DROP CONSTRAINT упали бы на пустом месте.
ALTER TABLE "exercise" DROP CONSTRAINT "exercise_pattern_code_pattern_code_fk";--> statement-breakpoint
ALTER TABLE "session_item" DROP CONSTRAINT "session_item_pattern_code_pattern_code_fk";--> statement-breakpoint
ALTER TABLE "template_item" DROP CONSTRAINT "template_item_pattern_code_pattern_code_fk";--> statement-breakpoint
ALTER TABLE "template_item" DROP CONSTRAINT "template_item_preferred_exercise_id_exercise_id_fk";--> statement-breakpoint
DROP INDEX "exercise_user_pattern_idx";--> statement-breakpoint
ALTER TABLE "exercise" DROP COLUMN "pattern_code";--> statement-breakpoint
ALTER TABLE "session_item" DROP COLUMN "pattern_code";--> statement-breakpoint
ALTER TABLE "template_item" DROP COLUMN "pattern_code";--> statement-breakpoint
ALTER TABLE "template_item" DROP COLUMN "preferred_exercise_id";--> statement-breakpoint
ALTER TABLE "template_item" DROP COLUMN "excluded_exercise_ids";--> statement-breakpoint
DROP TABLE "pattern";
