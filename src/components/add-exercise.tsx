import { SubmitButton } from '@/components/submit-button'
import { MuscleSelect } from '@/components/muscle-select'
import { addSessionItem, createExerciseAndAdd } from '@/lib/session/actions'

type Exercise = { id: string; name: string; modelName: string }
type Equipment = { id: string; name: string }

/**
 * Добавление упражнения в идущую тренировку.
 *
 * Шаблон — это пресет, а не обязательство: разгибания по одной ноге после
 * травмы делаются не всегда, заводить их в план на постоянной основе незачем,
 * но записывать нужно. Отсюда же и замена занятого тренажёра: пункт убирается,
 * на его место добавляется другое упражнение.
 *
 * Свёрнуто по умолчанию: во время тренировки нужно редко, а место занимает.
 */
export function AddExercise({
  sessionId,
  exercises,
  equipment,
  muscleCounts,
}: {
  sessionId: string
  exercises: Exercise[]
  equipment: Equipment[]
  muscleCounts: Map<string, number>
}) {
  const control =
    'w-full rounded-xl border border-black/15 bg-transparent px-3 py-3 text-base dark:border-white/20'

  return (
    <details className="rounded-2xl border border-dashed border-black/15 px-4 py-3 dark:border-white/20">
      <summary className="cursor-pointer text-sm opacity-60">Добавить упражнение</summary>

      {exercises.length > 0 && (
        <form action={addSessionItem} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="sessionId" value={sessionId} />
          <select name="exerciseId" required defaultValue="" className={control}>
            <option value="" disabled>
              из тех, что уже есть
            </option>
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.modelName}
              </option>
            ))}
          </select>
          <SubmitButton className="rounded-xl bg-black py-3 text-sm font-medium text-white dark:bg-white dark:text-black">
            Добавить
          </SubmitButton>
        </form>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs opacity-50">
          или завести новое упражнение
        </summary>
        <form action={createExerciseAndAdd} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="sessionId" value={sessionId} />
          <input
            name="name"
            required
            placeholder="Название, например «Разгибание ног по одной»"
            className={control}
          />
          <select name="equipmentModelId" required defaultValue="" className={control}>
            <option value="" disabled>
              на чём делается
            </option>
            {equipment.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <MuscleSelect counts={muscleCounts} className={control} />
          <input
            name="targetReps"
            inputMode="numeric"
            placeholder="Целевые повторы, обычно 12"
            className={control}
          />
          <SubmitButton className="rounded-xl bg-black py-3 text-sm font-medium text-white dark:bg-white dark:text-black">
            Завести и добавить
          </SubmitButton>
          <p className="text-xs opacity-45">
            Нового тренажёра тут не завести: ему нужны сетка весов и шаг, это отдельный экран.
          </p>
        </form>
      </details>
    </details>
  )
}
