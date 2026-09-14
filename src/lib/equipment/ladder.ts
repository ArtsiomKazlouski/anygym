/**
 * Разбор и сборка ряда доступных весов.
 *
 * Гантельный ряд CityFit — это двадцать пять чисел. Вбивать их руками никто
 * не станет, поэтому ряд записывается коротко: «1-10 через 1, 12-40 через 2».
 * Обратная сборка нужна, чтобы при редактировании показать ту же короткую
 * запись, а не простыню цифр.
 */

const RANGE = /^(-?[\d.]+)\s*(?:-|–|—|\.\.)\s*(-?[\d.]+)(?:\s*(?:через|шаг|\/)\s*([\d.]+))?$/i

export type LadderParseResult = { values: number[]; error?: string }

export function parseLadder(input: string): LadderParseResult {
  const text = input.trim()
  if (!text) return { values: [] }

  const values: number[] = []

  for (const rawPart of text.split(/[,;\n]+/)) {
    const part = rawPart.trim()
    if (!part) continue

    const range = RANGE.exec(part)
    if (range) {
      const from = Number(range[1])
      const to = Number(range[2])
      const step = range[3] ? Number(range[3]) : 1

      if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(step)) {
        return { values: [], error: `Не разобрал «${part}»` }
      }
      if (step <= 0) return { values: [], error: `Шаг должен быть больше нуля: «${part}»` }
      if (to < from) return { values: [], error: `Конец меньше начала: «${part}»` }
      if ((to - from) / step > 500) {
        return { values: [], error: `Слишком много значений в «${part}»` }
      }

      for (let w = from; w <= to + 1e-9; w += step) {
        values.push(Math.round(w * 100) / 100)
      }
      continue
    }

    const single = Number(part.replace(',', '.'))
    if (!Number.isFinite(single)) return { values: [], error: `Не разобрал «${part}»` }
    values.push(Math.round(single * 100) / 100)
  }

  const unique = [...new Set(values)].sort((a, b) => a - b)
  if (unique.some((v) => v <= 0)) return { values: [], error: 'Вес должен быть больше нуля' }
  return { values: unique }
}

/**
 * Собирает короткую запись обратно: подряд идущие значения с одинаковым шагом
 * сворачиваются в диапазон. Одиночки и пары остаются как есть — «12-14 через 2»
 * длиннее, чем «12, 14».
 */
export function formatLadder(values: number[] | null | undefined): string {
  if (!values || values.length === 0) return ''
  const v = [...new Set(values)].sort((a, b) => a - b)

  const parts: string[] = []
  let i = 0

  while (i < v.length) {
    const step = i + 1 < v.length ? Math.round((v[i + 1] - v[i]) * 100) / 100 : null
    let j = i

    if (step != null) {
      while (j + 1 < v.length && Math.abs(v[j + 1] - v[j] - step) < 1e-9) j++
    }

    const count = j - i + 1
    if (count >= 3 && step != null) {
      parts.push(step === 1 ? `${v[i]}-${v[j]}` : `${v[i]}-${v[j]} через ${step}`)
      i = j + 1
    } else {
      parts.push(String(v[i]))
      i++
    }
  }

  return parts.join(', ')
}
