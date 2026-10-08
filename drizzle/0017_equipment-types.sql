CREATE TABLE "equipment_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "equipment_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_type_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
ALTER TABLE "equipment_type" ADD CONSTRAINT "equipment_type_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Колонки добавляются пустыми: сначала их надо заполнить.
ALTER TABLE "equipment_model" ADD COLUMN "type_id" uuid;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "equipment_type_id" uuid;--> statement-breakpoint
ALTER TABLE "session_item" ADD COLUMN "equipment_model_id" uuid;--> statement-breakpoint

-- Типы выводятся из уже заведённых железок. Две пары схлопываются в один тип:
-- «Блок передний» и «Передний блок» — это один передний блок в двух залах,
-- «Пресс» и «Тренажёр на пресс» — один пресс. Ровно из-за них и пришлось
-- заводить по два одинаковых упражнения.
INSERT INTO "equipment_type" ("user_id", "name", "kind")
SELECT DISTINCT m."user_id", map."type_name", m."kind"
FROM "equipment_model" m
JOIN (VALUES
  ('EZ-гриф',             'EZ-гриф'),
  ('Бабочка',             'Бабочка'),
  ('Блок передний',       'Передний блок'),
  ('Передний блок',       'Передний блок'),
  ('Верхний блок',        'Верхний блок'),
  ('Гантели',             'Гантели'),
  ('Жим ногами SportsArt','Жим ногами'),
  ('Кроссовер',           'Кроссовер'),
  ('Лавка зад пов бедра', 'Сгибание ног'),
  ('Олимпийская штанга',  'Олимпийская штанга'),
  ('Пресс',               'Пресс'),
  ('Тренажёр на пресс',   'Пресс'),
  ('Приседания BB',       'Приседания'),
  ('Разгибание ног',      'Разгибание ног'),
  ('Сгибание на бицепс',  'Бицепс'),
  ('Турник',              'Турник')
) AS map("model_name", "type_name") ON map."model_name" = m."name";--> statement-breakpoint

UPDATE "equipment_model" m SET "type_id" = t."id"
FROM (VALUES
  ('EZ-гриф',             'EZ-гриф'),
  ('Бабочка',             'Бабочка'),
  ('Блок передний',       'Передний блок'),
  ('Передний блок',       'Передний блок'),
  ('Верхний блок',        'Верхний блок'),
  ('Гантели',             'Гантели'),
  ('Жим ногами SportsArt','Жим ногами'),
  ('Кроссовер',           'Кроссовер'),
  ('Лавка зад пов бедра', 'Сгибание ног'),
  ('Олимпийская штанга',  'Олимпийская штанга'),
  ('Пресс',               'Пресс'),
  ('Тренажёр на пресс',   'Пресс'),
  ('Приседания BB',       'Приседания'),
  ('Разгибание ног',      'Разгибание ног'),
  ('Сгибание на бицепс',  'Бицепс'),
  ('Турник',              'Турник')
) AS map("model_name", "type_name")
JOIN "equipment_type" t ON t."name" = map."type_name"
WHERE map."model_name" = m."name" AND t."user_id" = m."user_id";--> statement-breakpoint

UPDATE "exercise" e SET "equipment_type_id" = m."type_id"
FROM "equipment_model" m WHERE m."id" = e."equipment_model_id";--> statement-breakpoint

-- На каком исполнении делалось: до сих пор оно было одно на упражнение,
-- поэтому берётся оттуда. Записать это НАДО до склейки дубликатов — иначе
-- подходы потеряют, на какой именно машине они сделаны.
UPDATE "session_item" si SET "equipment_model_id" = e."equipment_model_id"
FROM "exercise" e WHERE e."id" = si."exercise_id";--> statement-breakpoint

-- Склейка дубликатов. Выживает тот, у кого больше истории и кто стоит в планах;
-- подходы проигравшего переезжают к нему и расходятся по исполнениям.
UPDATE "session_item" si SET "exercise_id" = win."id"
FROM "exercise" win, "exercise" lose, "equipment_model" wm, "equipment_model" lm
WHERE si."exercise_id" = lose."id"
  AND wm."id" = win."equipment_model_id" AND lm."id" = lose."equipment_model_id"
  AND ((win."name" = 'Тяга' AND wm."name" = 'Блок передний'
        AND lose."name" = 'Тяга' AND lm."name" = 'Передний блок')
    OR (win."name" = 'Пресс в тренажёре' AND wm."name" = 'Тренажёр на пресс'
        AND lose."name" = 'Пресс' AND lm."name" = 'Пресс'));--> statement-breakpoint

UPDATE "template_item" ti SET "exercise_id" = win."id"
FROM "exercise" win, "exercise" lose, "equipment_model" wm, "equipment_model" lm
WHERE ti."exercise_id" = lose."id"
  AND wm."id" = win."equipment_model_id" AND lm."id" = lose."equipment_model_id"
  AND ((win."name" = 'Тяга' AND wm."name" = 'Блок передний'
        AND lose."name" = 'Тяга' AND lm."name" = 'Передний блок')
    OR (win."name" = 'Пресс в тренажёре' AND wm."name" = 'Тренажёр на пресс'
        AND lose."name" = 'Пресс' AND lm."name" = 'Пресс'));--> statement-breakpoint

DELETE FROM "exercise" e USING "equipment_model" m
WHERE m."id" = e."equipment_model_id"
  AND ((e."name" = 'Тяга' AND m."name" = 'Передний блок')
    OR (e."name" = 'Пресс' AND m."name" = 'Пресс'));--> statement-breakpoint

-- Старые колонки пока остаются, но перестают быть обязательными: между этой
-- миграцией и выкладкой кода в базе живут обе формы, и ни старый код, ни новый
-- не должны падать. Убираются они следующей миграцией, уже после выкладки.
ALTER TABLE "exercise" ALTER COLUMN "equipment_model_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_model" ALTER COLUMN "kind" DROP NOT NULL;--> statement-breakpoint

ALTER TABLE "equipment_model" ALTER COLUMN "type_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise" ALTER COLUMN "equipment_type_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "equipment_model" ADD CONSTRAINT "equipment_model_type_id_equipment_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."equipment_type"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_equipment_type_id_equipment_type_id_fk" FOREIGN KEY ("equipment_type_id") REFERENCES "public"."equipment_type"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_item" ADD CONSTRAINT "session_item_equipment_model_id_equipment_model_id_fk" FOREIGN KEY ("equipment_model_id") REFERENCES "public"."equipment_model"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "equipment_model_type_idx" ON "equipment_model" USING btree ("type_id");--> statement-breakpoint
CREATE INDEX "exercise_type_idx" ON "exercise" USING btree ("equipment_type_id");
