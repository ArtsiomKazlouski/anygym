/**
 * Разбор подводки и целевых повторов.
 *
 * Подводка вводится и хранится в килограммах: «60, 80» — это то, что
 * вешается на штангу перед рабочими подходами.
 */

export type NumbersResult = { values: number[]; error?: string }

export function parseNumbers(input: string): NumbersResult {
  const text = input.trim()
  if (!text) return { values: [] }

  const values: number[] = []
  for (const raw of text.split(/[,;\s]+/)) {
    const part = raw.trim().replace(',', '.')
    if (!part) continue
    const n = Number(part)
    if (!Number.isFinite(n) || n <= 0) return { values: [], error: `Не разобрал «${raw}»` }
    values.push(Math.round(n * 100) / 100)
  }
  return { values }
}

/**
 * Строка поля -> веса ступеней подводки.
 *
 * Что человек ввёл, то и хранится: «60, 80» остаётся шестьюдесятью
 * и восемьюдесятью. Раньше здесь считались доли рабочего веса — они ехали
 * вместе с ним, но на экране превращались в 66.7 и 88.9, и человек переставал
 * узнавать собственный ввод. Цена отказа от долей известна: когда рабочий вес
 * заметно вырастет, подводку придётся поправить руками. Это одно поле раз
 * в несколько месяцев против нечитаемых чисел каждый раз.
 */
export function leadKgFromInput(input: string): {
  values: number[] | null
  error?: string
} {
  const { values, error } = parseNumbers(input)
  if (error) return { values: null, error }
  if (values.length === 0) return { values: null }

  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) {
      return { values: null, error: 'Ступени должны расти: 60, 80' }
    }
  }
  return { values }
}

/** Обратно в строку поля — ровно те числа, что лежат в базе. */
export function leadKgToInput(values: number[] | null | undefined): string {
  return (values ?? []).join(', ')
}

/**
 * Буфер под целевыми повторами.
 *
 * В интерфейсе задаётся одно число — столько, сколько человек собирается
 * сделать. Но движку нужен диапазон: пока повторы растут внутри него, вес
 * стоит, а закрыл верх — прибавился. Без буфера прогрессия становится
 * линейной, то есть каждый раз либо плюс вес, либо ничего, и потолок
 * приходит за пару месяцев.
 *
 * Два повтора — компромисс: заметный запас, но цель остаётся узнаваемой.
 */
export const REP_BUFFER = 2

export function rangeFromTarget(target: number): { repMin: number; repMax: number } {
  const repMax = Math.max(1, Math.round(target))
  return { repMin: Math.max(1, repMax - REP_BUFFER), repMax }
}
