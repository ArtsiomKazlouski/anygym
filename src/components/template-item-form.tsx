import { SubmitButton } from '@/components/submit-button'
import { rampWeightsFromPercents } from '@/lib/templates/parse'
import type { templateItems } from '@/db/schema'

type Item = typeof templateItems.$inferSelect
type Exercise = { id: string; name: string; modelName: string }

const field =
  'w-full rounded-xl border border-black/15 bg-transparent px-3 py-2.5 text-base dark:border-white/20'

/**
 * Пункт плана. Одна форма на добавление и на правку.
 *
 * Ступени рампы вводятся в килограммах — «20, 60, 80, 90, 100», как человек их
 * и держит в голове. Хранятся долями от верхнего веса, чтобы ехать вместе
 * с ним при прогрессии: вырос верх — вся подводка поехала за ним.
 */
export function TemplateItemForm({
  action,
  templateId,
  item,
  declaredKg,
  catalog,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>
  templateId: string
  item?: Item
  declaredKg?: number | null
  catalog: Exercise[]
  submitLabel: string
}) {
  const isRamp = item?.scheme === 'ramp'

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="templateId" value={templateId} />
      {item && <input type="hidden" name="itemId" value={item.id} />}

      <select
        name="exerciseId"
        required
        defaultValue={item?.preferredExerciseId ?? ''}
        className={field}
      >
        <option value="" disabled>
          упражнение
        </option>
        {catalog.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} · {e.modelName}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs opacity-55">Схема</span>
          <select name="scheme" defaultValue={item?.scheme ?? 'straight'} className={field}>
            <option value="straight">прямая</option>
            <option value="ramp">рампа</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs opacity-55">Подходы</span>
          <input
            name="sets"
            inputMode="numeric"
            defaultValue={item?.sets ?? 3}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs opacity-55">Повторы</span>
          <input
            name="reps"
            inputMode="numeric"
            defaultValue={item?.repMax ?? 12}
            className={field}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs opacity-55">Ступени рампы, кг</span>
        <input
          name="rampWeights"
          placeholder="20, 60, 80, 90, 100"
          defaultValue={isRamp ? rampWeightsFromPercents(item?.rampPercents, declaredKg) : ''}
          className={field}
        />
        <span className="text-xs opacity-40">
          Только для рампы. Верхняя ступень — рабочий подход; остальные поедут за ним, когда он
          вырастет, поэтому число подходов при рампе берётся отсюда, а не из поля выше. Показаны
          для текущего рабочего веса и могут выйти дробными — в зале движок округлит их по сетке
          железки.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs opacity-55">Повторы по ступеням</span>
        <input
          name="rampReps"
          placeholder="12, 12, 10, 10"
          defaultValue={isRamp ? (item?.rampReps ?? []).join(', ') : ''}
          className={field}
        />
      </label>

      <input
        name="note"
        placeholder="Заметка"
        defaultValue={item?.note ?? ''}
        className={field}
      />

      <SubmitButton className="rounded-xl bg-black py-3 text-sm font-medium text-white dark:bg-white dark:text-black">
        {submitLabel}
      </SubmitButton>
    </form>
  )
}
