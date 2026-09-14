/**
 * Разбор ступеней рампы и целевых повторов.
 *
 * Рампа вводится в килограммах — «20, 60, 80, 90, 100», как человек её и держит
 * в голове, — а хранится долями от верхнего веса, чтобы ехать вместе с ним
 * при прогрессии.
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
 * Килограммы ступеней -> доли от верхнего веса. Верхняя ступень всегда 1.
 * Значения должны идти по возрастанию: рампа на то и рампа.
 */
export function rampPercentsFromWeights(input: string): {
  percents: number[] | null
  error?: string
} {
  const { values, error } = parseNumbers(input)
  if (error) return { percents: null, error }
  if (values.length === 0) return { percents: null }
  if (values.length === 1) return { percents: [1] }

  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) {
      return { percents: null, error: 'Ступени должны расти: 20, 60, 80, 90, 100' }
    }
  }

  const top = values[values.length - 1]
  return { percents: values.map((w) => Math.round((w / top) * 1000) / 1000) }
}

/** Доли обратно в килограммы — чтобы показать при редактировании. */
export function rampWeightsFromPercents(
  percents: number[] | null | undefined,
  topKg: number | null | undefined,
): string {
  if (!percents || percents.length === 0) return ''
  const top = topKg && topKg > 0 ? topKg : 100
  return percents
    .map((p) => {
      const w = p * top
      return Math.round(w * 10) / 10
    })
    .join(', ')
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
