import { MUSCLES } from '@/lib/muscles'

/**
 * Выбор мышечной группы упражнения.
 *
 * Группа — не замена упражнению и не его пересказ: она отвечает на вопрос
 * «что будет уставшим», а не «что делать». Отсюда две её работы: откат веса,
 * когда группа давно не работала, и счёт объёма по тренировке.
 *
 * Счётчик рядом показывает перекос каталога — четыре упражнения на бицепс
 * и ни одного на спину видно ровно в тот момент, когда это можно поправить.
 */
export function MuscleSelect({
  counts,
  defaultValue,
  className,
}: {
  counts: Map<string, number>
  defaultValue?: string
  className: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs opacity-55">Какая мышца главная</span>
      <select
        name="muscleGroup"
        required
        defaultValue={defaultValue ?? ''}
        className={className}
      >
        {defaultValue == null && (
          <option value="" disabled>
            выбери группу
          </option>
        )}
        {MUSCLES.map((m) => {
          const n = counts.get(m.code) ?? 0
          return (
            <option key={m.code} value={m.code}>
              {m.title}
              {n > 0 ? ` · уже ${n}` : ''}
            </option>
          )
        })}
      </select>
      <span className="text-xs opacity-40">
        Одна, главная: жим лёжа грузит и трицепс, но считать его дважды значит удвоить объём. От
        группы работает откат веса после перерыва — если грудь не работала три недели, вес
        снизится на всей груди.
      </span>
    </label>
  )
}
