CREATE TYPE "public"."muscle_group" AS ENUM('chest', 'back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms', 'core', 'glutes', 'quads', 'hamstrings', 'adductors', 'calves');--> statement-breakpoint

-- Мышечная группа переносится из справочника паттернов: у каждого паттерна
-- она уже была проставлена, так что перенос механический и объяснимый.
-- Где паттерн был выбран неудачно, группа унаследует эту неудачу — это видно
-- глазами в каталоге и правится там же одним выбором.
ALTER TABLE "exercise" ADD COLUMN "muscle_group" "muscle_group";--> statement-breakpoint
UPDATE "exercise" SET "muscle_group" = "pattern"."muscle_group"::"muscle_group"
  FROM "pattern" WHERE "pattern"."code" = "exercise"."pattern_code";--> statement-breakpoint
ALTER TABLE "exercise" ALTER COLUMN "muscle_group" SET NOT NULL;--> statement-breakpoint

-- Пункт плана больше не «паттерн с любимым упражнением», а прямо упражнение.
-- preferred_exercise_id и так был заполнен всегда: пункт без упражнения
-- завести было нельзя.
ALTER TABLE "template_item" ADD COLUMN "exercise_id" uuid;--> statement-breakpoint
UPDATE "template_item" SET "exercise_id" = "preferred_exercise_id";--> statement-breakpoint
ALTER TABLE "template_item" ALTER COLUMN "exercise_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "template_item" ADD CONSTRAINT "template_item_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "exercise_user_muscle_idx" ON "exercise" USING btree ("user_id","muscle_group");
