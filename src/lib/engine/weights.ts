/**
 * Дискретизация веса: движок не имеет права назвать вес, которого
 * на этой железке физически нет.
 *
 * Вся математика идёт в килограммах, а сетка доступных весов задана
 * в единицах железки — поэтому каждое обращение к сетке проходит
 * через конвертацию туда и обратно.
 */

export type Units = 'kg' | 'lb'

export type WeightGrid = {
  units: Units
  /** Шаг стека или блинов. Для штанги — минимальная прибавка (два блина). */
  step?: number | null
  /**
   * Шаг для подводящих и разминочных подходов, если он грубее рабочего.
   * Пусто — берётся step.
   */
  rampStep?: number | null
  min?: number | null
  max?: number | null
  /** Явный ряд весов — гантели, где шаг неравномерный. */
  ladder?: number[] | null
  /** Вес грифа: от него отсчитывается сетка для штанги. */
  barWeight?: number | null
}

export type SnapDirection = 'down' | 'up' | 'nearest'

export type SnappedWeight = {
  /** В единицах железки — это число пользователь выставляет на стеке. */
  weight: number
  units: Units
  /** Нормализовано; по этой величине работает вся остальная логика. */
  weightKg: number
}

export const KG_PER_LB = 0.45359237

/**
 * Сетка для подводящих и разминочных подходов.
 *
 * Шаг отвечает за две разные задачи: точность прибавки при прогрессии
 * и округление подводящих. Рабочему весу точность нужна, подводящему — нет,
 * и возня с мелкими блинами ради разминки ничего не даёт.
 */
export function rampGrid(grid: WeightGrid): WeightGrid {
  return grid.rampStep ? { ...grid, step: grid.rampStep } : grid
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function toKg(weight: number, units: Units): number {
  return round2(units === 'kg' ? weight : weight * KG_PER_LB)
}

export function fromKg(kg: number, units: Units): number {
  return round2(units === 'kg' ? kg : kg / KG_PER_LB)
}

function make(nativeWeight: number, grid: WeightGrid): SnappedWeight {
  const weight = round2(nativeWeight)
  return { weight, units: grid.units, weightKg: toKg(weight, grid.units) }
}

/** Отсортированный ряд доступных весов, если он задан явно. */
function ladderOf(grid: WeightGrid): number[] | null {
  if (!grid.ladder || grid.ladder.length === 0) return null
  return [...grid.ladder].sort((a, b) => a - b)
}

/** Нижняя точка арифметической сетки: гриф, либо минимум стека, либо сам шаг. */
function gridBase(grid: WeightGrid): number {
  return grid.barWeight ?? grid.min ?? grid.step ?? 0
}

function clampNative(w: number, grid: WeightGrid): number {
  let out = w
  if (grid.min != null && out < grid.min) out = grid.min
  if (grid.max != null && out > grid.max) out = grid.max
  return out
}

/**
 * Ближайший достижимый вес.
 *
 * Направление имеет значение: ошибка вниз стоит одного лёгкого подхода,
 * ошибка вверх стоит травмы. Поэтому рост идёт 'up' (следующая ступень
 * сетки), а откаты — 'nearest' с последующим ограничением сверху:
 * на грубой сетке (шаг 10 кг при рабочих 120) округление строго вниз
 * превращает откат в −17% вместо задуманных −10%.
 */
export function snapKg(
  targetKg: number,
  grid: WeightGrid,
  direction: SnapDirection = 'nearest',
): SnappedWeight {
  const target = fromKg(targetKg, grid.units)
  const ladder = ladderOf(grid)

  if (ladder) {
    const below = [...ladder].reverse().find((w) => w <= target + 1e-9)
    const above = ladder.find((w) => w >= target - 1e-9)

    if (direction === 'down') return make(below ?? ladder[0], grid)
    if (direction === 'up') return make(above ?? ladder[ladder.length - 1], grid)

    if (below == null) return make(ladder[0], grid)
    if (above == null) return make(ladder[ladder.length - 1], grid)
    return make(target - below <= above - target ? below : above, grid)
  }

  if (!grid.step || grid.step <= 0) {
    // Сетка неизвестна — отдаём как есть, но уважаем границы.
    return make(clampNative(target, grid), grid)
  }

  const base = gridBase(grid)
  const rawSteps = (target - base) / grid.step
  const steps =
    direction === 'down'
      ? Math.floor(rawSteps + 1e-9)
      : direction === 'up'
        ? Math.ceil(rawSteps - 1e-9)
        : Math.round(rawSteps)

  return make(clampNative(base + Math.max(0, steps) * grid.step, grid), grid)
}

/**
 * Сдвиг на одну ступень сетки. Для гантелей ступень неравномерная,
 * поэтому идём по ряду, а не прибавляем шаг.
 */
export function stepKg(currentKg: number, grid: WeightGrid, direction: 1 | -1): SnappedWeight {
  const current = fromKg(currentKg, grid.units)
  const ladder = ladderOf(grid)

  if (ladder) {
    let idx = 0
    let best = Infinity
    ladder.forEach((w, i) => {
      const d = Math.abs(w - current)
      if (d < best) {
        best = d
        idx = i
      }
    })
    const next = Math.min(ladder.length - 1, Math.max(0, idx + direction))
    return make(ladder[next], grid)
  }

  if (!grid.step || grid.step <= 0) return make(clampNative(current, grid), grid)

  return snapKg(
    toKg(current + direction * grid.step, grid.units),
    grid,
    direction === 1 ? 'up' : 'down',
  )
}

/**
 * Все достижимые веса этой железки — для выбора барабаном вместо ввода руками.
 *
 * Список строится из той же сетки, что и подсказки движка, поэтому выбрать
 * несуществующий вес невозможно в принципе.
 *
 * `around` — вес, вокруг которого окно, если сетка не ограничена сверху или
 * вариантов слишком много. `limit` — сколько вариантов максимум.
 */
export function gridOptions(
  grid: WeightGrid,
  opts: { around?: number | null; limit?: number } = {},
): number[] {
  const limit = opts.limit ?? 160
  const ladder = ladderOf(grid)
  if (ladder) return ladder

  if (!grid.step || grid.step <= 0) return []

  const base = gridBase(grid)
  const step = grid.step

  // Считаем в индексах ступеней, а не строим список целиком: сетка бывает
  // огромной (шаг 1 кг до двухсот), и обрезать её до центрирования нельзя —
  // окно уедет в начало и текущий вес из него выпадет.
  const lastIndex =
    grid.max != null ? Math.max(0, Math.floor((grid.max - base) / step + 1e-9)) : null
  const total = lastIndex != null ? lastIndex + 1 : Infinity

  let from = 0
  if (total > limit) {
    const center = opts.around != null ? fromKg(opts.around, grid.units) : base
    const centerIndex = Math.max(0, Math.round((center - base) / step))
    from = Math.max(0, centerIndex - Math.floor(limit / 2))
    if (lastIndex != null) from = Math.min(from, lastIndex - limit + 1)
  }

  const count = Math.min(limit, total)
  return Array.from(
    { length: count },
    (_, i) => Math.round((base + (from + i) * step) * 100) / 100,
  )
}
