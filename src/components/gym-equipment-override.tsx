import { SubmitButton } from '@/components/submit-button'
import { formatLadder } from '@/lib/equipment/ladder'
import { updateGymEquipment } from '@/lib/equipment/actions'
import type { equipmentModels, gymEquipment } from '@/db/schema'

type Link = typeof gymEquipment.$inferSelect
type Model = typeof equipmentModels.$inferSelect

const field =
  'w-full rounded-xl border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20'

function Labelled({
  label,
  modelValue,
  children,
}: {
  label: string
  modelValue?: string | number | null
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs opacity-55">
        {label}
        {modelValue != null && modelValue !== '' && (
          <span className="opacity-60"> · у модели {modelValue}</span>
        )}
      </span>
      {children}
    </label>
  )
}

/**
 * Сетка этой железки именно в этом зале.
 *
 * Одна модель стоит в нескольких залах — так и задумано, ради переноса истории.
 * Но сетка у неё может отличаться: тот же модельный ряд бывает со стеком
 * в фунтах, у гантельного ряда другой верх. Пустое поле значит «как у модели».
 */
export function GymEquipmentOverride({
  link,
  model,
  gymId,
}: {
  link: Link
  model: Model
  gymId: string
}) {
  const hasOverride =
    link.unitsOverride != null ||
    link.stepOverride != null ||
    link.rampStepOverride != null ||
    link.minOverride != null ||
    link.maxOverride != null ||
    (link.ladderOverride?.length ?? 0) > 0

  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs opacity-45">
        В этом зале{hasOverride ? ' · есть отличия' : ''}
      </summary>

      <form
        key={JSON.stringify([
          link.locationNote,
          link.unitsOverride,
          link.stepOverride,
          link.rampStepOverride,
          link.minOverride,
          link.maxOverride,
          link.ladderOverride,
        ])}
        action={updateGymEquipment}
        className="mt-2 flex flex-col gap-2"
      >
        <input type="hidden" name="linkId" value={link.id} />
        <input type="hidden" name="gymId" value={gymId} />

        <Labelled label="Где стоит">
          <input
            name="locationNote"
            placeholder="у окна, второй ряд"
            defaultValue={link.locationNote ?? ''}
            className={field}
          />
        </Labelled>

        <div className="grid grid-cols-2 gap-2">
          <Labelled label="Единицы" modelValue={model.units === 'kg' ? 'кг' : 'фунты'}>
            <select
              name="unitsOverride"
              defaultValue={link.unitsOverride ?? ''}
              className={field}
            >
              <option value="">как у модели</option>
              <option value="kg">кг</option>
              <option value="lb">фунты</option>
            </select>
          </Labelled>
          <Labelled label="Шаг" modelValue={model.step}>
            <input
              name="stepOverride"
              inputMode="decimal"
              defaultValue={link.stepOverride ?? ''}
              className={field}
            />
          </Labelled>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Labelled label="Подводящие" modelValue={model.rampStep}>
            <input
              name="rampStepOverride"
              inputMode="decimal"
              defaultValue={link.rampStepOverride ?? ''}
              className={field}
            />
          </Labelled>
          <Labelled label="Минимум" modelValue={model.minWeight}>
            <input
              name="minOverride"
              inputMode="decimal"
              defaultValue={link.minOverride ?? ''}
              className={field}
            />
          </Labelled>
          <Labelled label="Максимум" modelValue={model.maxWeight}>
            <input
              name="maxOverride"
              inputMode="decimal"
              defaultValue={link.maxOverride ?? ''}
              className={field}
            />
          </Labelled>
        </div>

        <Labelled label="Ряд весов" modelValue={formatLadder(model.ladder) || null}>
          <input
            name="ladderOverride"
            placeholder="как у модели"
            defaultValue={formatLadder(link.ladderOverride)}
            className={field}
          />
        </Labelled>

        <SubmitButton className="rounded-xl border border-black/15 py-2.5 text-sm dark:border-white/20">
          Сохранить для этого зала
        </SubmitButton>
        <p className="text-xs opacity-40">
          Пустое поле — «как у модели». История и настройки при этом общие: в том и смысл, чтобы
          не калиброваться заново. Меняешь единицы — задай и шаг с границами: числа модели
          записаны в её единицах и иначе будут прочитаны как чужие.
        </p>
      </form>
    </details>
  )
}
