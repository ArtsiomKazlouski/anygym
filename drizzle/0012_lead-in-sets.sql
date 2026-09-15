-- Схемы «прямая / рампа» больше нет: это были не два способа, а один с пустой
-- подводкой и один с непустой.
--
-- В рампе последняя доля равнялась единице — это был верхний, он же
-- единственный рабочий подход. Теперь ramp_percents описывает только подводку,
-- поэтому единица из массива убирается, а число рабочих подходов, которое
-- при рампе игнорировалось, становится честной единицей.
UPDATE "template_item" SET
  "ramp_percents" = (
    select array_agg(p order by p) from unnest("ramp_percents") p where p < 1
  ),
  "sets" = 1
WHERE "scheme" = 'ramp';--> statement-breakpoint

ALTER TABLE "template_item" DROP COLUMN "scheme";--> statement-breakpoint
DROP TYPE "public"."set_scheme";
