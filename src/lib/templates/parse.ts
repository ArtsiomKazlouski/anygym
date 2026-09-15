/**
 * Разбор подводки и целевых повторов.
 *
 * Подводка вводится в килограммах — «20, 40, 60, 80, 90», как человек её и
 * держит в голове, — а хранится долями рабочего веса, чтобы ехать вместе с ним
 * при прогрессии.
 *
 * Последнее число в строке — рабочий вес. Он задаёт масштаб и сам в подводку
 * не попадает: иначе пришлось бы знать рабочий вес заранее, а его знает
 * история, а не человек у формы.
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
 * Килограммы ступеней -> доли рабочего веса, строго меньше единицы.
 *
 * Последнее число — рабочий вес, оно задаёт масштаб и в подводку не входит.
 * Одно число означает «подводки нет»: назвали только рабочий вес.
 * Значения должны идти по возрастанию — подводка на то и подводка.
 */
export function rampPercentsFromWeights(input: string): {
  percents: number[] | null
  error?: string
} {
  const { values, error } = parseNumbers(input)
  if (error) return { percents: null, error }
  if (values.length <= 1) return { percents: null }

  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) {
      return { percents: null, error: 'Ступени должны расти: 20, 40, 60, 80, 90' }
    }
  }

  const top = values[values.length - 1]
  return {
    percents: values.slice(0, -1).map((w) => Math.round((w / top) * 1000) / 1000),
  }
}

const round = (w: number) => Math.round(w * 10) / 10

/**
 * Доли обратно в килограммы — ступени подводки без рабочего веса.
 *
 * Число приблизительное: точный вес зависит от сетки конкретной железки,
 * а план не привязан к залу. В зале движок положит ступени на реальные
 * ступени сетки.
 */
export function leadWeights(
  percents: number[] | null | undefined,
  topKg: number | null | undefined,
): number[] {
  if (!percents || percents.length === 0) return []
  const top = topKg && topKg > 0 ? topKg : 100
  return percents.map((p) => round(p * top))
}

/**
 * То же самое строкой для поля ввода: рабочий вес дописывается последним,
 * чтобы человек видел ту же строку, которую туда вводил.
 */
export function rampWeightsFromPercents(
  percents: number[] | null | undefined,
  topKg: number | null | undefined,
): string {
  const lead = leadWeights(percents, topKg)
  if (lead.length === 0) return ''
  return [...lead, round(topKg && topKg > 0 ? topKg : 100)].join(', ')
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
