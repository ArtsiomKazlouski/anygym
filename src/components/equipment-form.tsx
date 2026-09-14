import { SubmitButton } from '@/components/submit-button'
import { formatLadder } from '@/lib/equipment/ladder'
import type { equipmentModels } from '@/db/schema'

type Model = typeof equipmentModels.$inferSelect

const KINDS = [
  { value: 'stack', label: 'Грузоблок' },
  { value: 'plate_loaded', label: 'Блины' },
  { value: 'dumbbell', label: 'Гантели' },
  { value: 'barbell', label: 'Штанга' },
  { value: 'cable', label: 'Трос' },
  { value: 'bodyweight', label: 'Свой вес' },
] as const

const field =
  'w-full rounded-xl border border-black/15 bg-transparent px-3 py-2.5 text-base dark:border-white/20'

function Labelled({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs opacity-55">{label}</span>
      {children}
      {hint && <span className="text-xs opacity-40">{hint}</span>}
    </label>
  )
}

/**
 * Карточка железки. Одна форма на создание и на правку — поля те же.
 *
 * Сетка весов здесь не украшение: по ней движок решает, какой вес вообще
 * можно назвать, и из неё же строится барабан выбора. Пустое поле означает
 * «не знаю» и оставляет ручной ввод, а не ноль.
 */
export function EquipmentForm({
  action,
  model,
  gymId,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>
  model?: Model
  gymId?: string
  submitLabel: string
}) {
  return (
    <form action={action} className="flex flex-col gap-3">
      {model && <input type="hidden" name="modelId" value={model.id} />}
      {gymId && <input type="hidden" name="gymId" value={gymId} />}

      <Labelled label="Название" hint="Как ты его узнаёшь: «жим от груди Technogym, синий»">
        <input name="name" required defaultValue={model?.name ?? ''} className={field} />
      </Labelled>

      <div className="grid grid-cols-2 gap-3">
        <Labelled label="Тип">
          <select name="kind" defaultValue={model?.kind ?? 'stack'} className={field}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled label="Единицы">
          <select name="units" defaultValue={model?.units ?? 'kg'} className={field}>
            <option value="kg">кг</option>
            <option value="lb">фунты</option>
          </select>
        </Labelled>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Labelled label="Шаг" hint="на сколько меняется вес за ступень">
          <input
            name="step"
            inputMode="decimal"
            defaultValue={model?.step ?? ''}
            className={field}
          />
        </Labelled>
        <Labelled label="Шаг подводящих" hint="пусто — как обычный">
          <input
            name="rampStep"
            inputMode="decimal"
            defaultValue={model?.rampStep ?? ''}
            className={field}
          />
        </Labelled>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Labelled label="Минимум">
          <input
            name="minWeight"
            inputMode="decimal"
            defaultValue={model?.minWeight ?? ''}
            className={field}
          />
        </Labelled>
        <Labelled label="Максимум">
          <input
            name="maxWeight"
            inputMode="decimal"
            defaultValue={model?.maxWeight ?? ''}
            className={field}
          />
        </Labelled>
        <Labelled label="Гриф">
          <input
            name="barWeight"
            inputMode="decimal"
            defaultValue={model?.barWeight ?? ''}
            className={field}
          />
        </Labelled>
      </div>

      <Labelled
        label="Ряд весов"
        hint="Для гантелей. Короткой записью: «1-10, 12-40 через 2». Заполнено — шаг и границы не нужны"
      >
        <input
          name="ladder"
          defaultValue={formatLadder(model?.ladder)}
          placeholder="1-10, 12-40 через 2"
          className={field}
        />
      </Labelled>

      <Labelled label="Заметка">
        <input name="notes" defaultValue={model?.notes ?? ''} className={field} />
      </Labelled>

      <SubmitButton className="rounded-2xl bg-black py-3.5 text-base font-medium text-white dark:bg-white dark:text-black">
        {submitLabel}
      </SubmitButton>
    </form>
  )
}
