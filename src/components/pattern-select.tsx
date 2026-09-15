import { PATTERNS } from '@/lib/patterns'

/**
 * Выбор группы взаимозаменяемых упражнений.
 *
 * Поле называется не «движение», а тем, что делает: оно решает, что приложение
 * предложит взамен, когда тренажёр занят. С названием «движение» значения
 * читались как пересказ названия упражнения — и поле выглядело дублированием.
 *
 * Счётчик рядом показывает, во что вступаешь: «Сведение · 3» значит, что
 * в этой группе уже три упражнения и они станут заменами друг другу.
 */
export function PatternSelect({
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
      <span className="text-xs opacity-55">Чем можно заменить</span>
      <select
        name="patternCode"
        required
        defaultValue={defaultValue ?? ''}
        className={className}
      >
        {defaultValue == null && (
          <option value="" disabled>
            выбери группу
          </option>
        )}
        {PATTERNS.map((p) => {
          const n = counts.get(p.code) ?? 0
          return (
            <option key={p.code} value={p.code}>
              {p.title}
              {n > 0 ? ` · уже ${n}` : ''}
            </option>
          )
        })}
      </select>
      <span className="text-xs opacity-40">
        Группа решает, что приложение предложит, когда тренажёр занят. Сведение в бабочке, на
        кроссовере и разводка гантелями — одна группа, потому что заменяют друг друга. Мышечная
        группа из неё выводится сама, отдельно её задавать не надо.
      </span>
    </label>
  )
}
