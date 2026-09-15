ALTER TABLE "template_item" ADD COLUMN "lead_kg" numeric(7, 2)[];--> statement-breakpoint

-- Доли рабочего веса переводятся в килограммы по последнему рабочему подходу
-- этого упражнения — другой опоры у базы нет, рабочий вес нигде не хранится,
-- он выводится из истории.
--
-- Числа выйдут некруглыми: доли и брались из некруглого веса. Это видно
-- в плане и правится там же одним полем.
WITH last_working AS (
  SELECT DISTINCT ON (si.exercise_id) si.exercise_id, sl.weight_kg
  FROM set_log sl
  JOIN session_item si ON si.id = sl.session_item_id
  WHERE sl.kind = 'working' AND si.exercise_id IS NOT NULL
  ORDER BY si.exercise_id, sl.logged_at DESC
)
UPDATE "template_item" ti SET "lead_kg" = (
  SELECT array_agg(round(p * lw.weight_kg, 1) ORDER BY p)
  FROM unnest(ti."ramp_percents") p
)
FROM last_working lw
WHERE lw.exercise_id = ti."exercise_id" AND ti."ramp_percents" IS NOT NULL;
