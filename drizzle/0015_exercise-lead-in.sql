ALTER TABLE "exercise" ADD COLUMN "lead_kg" numeric(7, 2)[];--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "lead_percents" numeric(4, 3)[];--> statement-breakpoint

-- Подводка переезжает с пункта плана на упражнение. Одно и то же упражнение
-- стоит максимум в одном плане, так что перенос однозначен; если бы стояло
-- в двух с разной подводкой, победила бы первая по позиции — но таких нет.
UPDATE "exercise" e SET "lead_kg" = ti."lead_kg"
FROM "template_item" ti
WHERE ti."exercise_id" = e."id" AND ti."lead_kg" IS NOT NULL;
