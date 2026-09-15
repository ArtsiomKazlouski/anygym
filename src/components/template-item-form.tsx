import { SubmitButton } from '@/components/submit-button'
import { leadKgToInput } from '@/lib/templates/parse'
import type { templateItems } from '@/db/schema'

type Item = typeof templateItems.$inferSelect
type Exercise = { id: string; name: string; modelName: string }

const field =
  'w-full rounded-xl border border-black/15 bg-transparent px-3 py-2.5 text-base dark:border-white/20'

/**
 * Пункт плана. Одна форма на добавление и на правку.
 *
 * Подводка вводится и хранится в килограммах: что ввёл, то и увидишь.
 */
export function TemplateItemForm({
  action,
  templateId,
  item,
  catalog,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>
  templateId: string
  item?: Item
  catalog: Exercise[]
  submitLabel: string
}) {
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="templateId" value={templateId} />
      {item && <input type="hidden" name="itemId" value={item.id} />}

      <select
        name="exerciseId"
        required
        defaultValue={item?.exerciseId ?? ''}
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

      <label className="flex flex-col gap-1">
        <span className="text-xs opacity-55">Рабочих подходов</span>
        <input
          name="sets"
          inputMode="numeric"
          defaultValue={item?.sets ?? 3}
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs opacity-55">Подводка, кг</span>
        <input
          name="rampWeights"
          placeholder="60, 80"
          defaultValue={leadKgToInput(item?.leadKg)}
          className={field}
        />
        <span className="text-xs opacity-40">
          Ступени до рабочего веса, последним числом — сам рабочий вес: он задаёт масштаб и в
          подводку не входит. Пусто — упражнение начинается сразу с рабочего. Повторы на
          подводке те же, что в упражнении. Числа показаны для текущего рабочего веса и поедут
          вместе с ним; в зале движок положит их на удобные для блинов ступени.
        </span>
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
