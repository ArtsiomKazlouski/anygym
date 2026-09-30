import { SubmitButton } from '@/components/submit-button'
import type { templateItems } from '@/db/schema'

type Item = typeof templateItems.$inferSelect
type Exercise = { id: string; name: string; modelName: string }

const field =
  'w-full rounded-xl border border-black/15 bg-transparent px-3 py-2.5 text-base dark:border-white/20'

/**
 * Пункт плана: упражнение и сколько его делать сегодня.
 *
 * Подводка и цель повторов сюда не входят — это свойства упражнения,
 * одинаковые в любом плане. Здесь только то, что зависит от дня.
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
