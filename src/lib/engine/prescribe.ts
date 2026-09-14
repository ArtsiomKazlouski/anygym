/**
 * Движок веса (docs/DESIGN.md, раздел 5).
 *
 * Функции чистые: на вход — факты из истории, на выход — назначение.
 * Никаких обращений к БД, поэтому всё поведение проверяется тестами.
 */

import { type SnappedWeight, type WeightGrid, snapKg, stepKg } from './weights.ts'

export type SetFeedback = 'easy' | 'on_target' | 'limit' | 'failed'

export type PrescriptionSource = 'history' | 'probe' | 'manual' | 'deload' | 'pain_backoff'

export type LoggedSet = {
  weightKg: number
  reps: number
  feedback: SetFeedback
}

/** Коэффициенты вынесены сюда, чтобы калибровать их по накопленным данным. */
export const PROBE_FACTOR = 0.6
export const WARMUP_FACTOR = 0.55
export const PAIN_BACKOFF_FACTOR = 0.9
export const WARMUP_REPS: readonly [number, number] = [8, 10]
export const RESET_AFTER_DAYS = 90

/** Откат за паузу: дни без работы на ПАТТЕРН -> множитель. */
export const DELOAD_TABLE: readonly { upToDays: number; factor: number }[] = [
  { upToDays: 10, factor: 1.0 },
  { upToDays: 21, factor: 0.95 },
  { upToDays: 42, factor: 0.9 },
  { upToDays: RESET_AFTER_DAYS, factor: 0.85 },
]

export type PrescribeContext = {
  grid: WeightGrid
  repMin: number
  repMax: number
  /** Рабочие подходы последней сессии на ЭТОЙ МОДЕЛИ, по порядку. Пусто = модель незнакома. */
  lastSessionSets: LoggedSet[]
  /**
   * Дней с последней работы на ЭТОТ ПАТТЕРН, включая текущую сессию.
   * Второе упражнение на ту же группу в один день даёт 0 и отката не получает.
   * null — паттерн не делался никогда.
   */
  daysSincePattern: number | null
  /** Была ли отмечена боль на этой модели в последних двух сессиях. */
  painRecent: boolean
  /** Рабочий вес на другой модели того же паттерна — база для разведки. */
  probeBaseKg?: number | null
  /** Первое ли это упражнение на данную мышечную группу в текущей сессии. */
  firstForMuscleGroup: boolean
}

export type Warmup = {
  weight: number
  weightKg: number
  units: WeightGrid['units']
  reps: readonly [number, number]
}

export type Prescription = {
  /** null — истории нет вообще, вес вводится руками. */
  working: SnappedWeight | null
  repMin: number
  repMax: number
  source: PrescriptionSource
  /**
   * Вес до отката за паузу. Если первый подход получит 'easy',
   * следующий возвращается сюда, а не растёт на ступень от откаченного.
   */
  preDeloadKg: number | null
  warmup: Warmup | null
  /** Человекочитаемые пояснения — их показывает UI, чтобы подсказка не выглядела магией. */
  notes: string[]
}

/** Множитель отката за паузу. null во втором поле = полный сброс в разведку. */
export function deloadFactor(days: number | null): {
  factor: number
  reset: boolean
} {
  if (days == null) return { factor: 1, reset: false }
  if (days > RESET_AFTER_DAYS) return { factor: 1, reset: true }
  for (const row of DELOAD_TABLE) {
    if (days <= row.upToDays) return { factor: row.factor, reset: false }
  }
  return { factor: 1, reset: false }
}

/**
 * Опорный вес по прошлой сессии.
 *
 * Берём последний подход, который НЕ был провален: рост внутри сессии
 * (50 -> 55 по фидбеку 'легко') должен переноситься, а финальный
 * проваленный подход не должен опускать базу дважды — за него уже
 * отвечает межсессионная прогрессия.
 */
export function baseFromLastSession(sets: LoggedSet[]): number | null {
  if (sets.length === 0) return null
  for (let i = sets.length - 1; i >= 0; i--) {
    if (sets[i].feedback !== 'failed') return sets[i].weightKg
  }
  return sets[sets.length - 1].weightKg
}

/** Межсессионная прогрессия (раздел 5.4): -1 вниз, 0 держим, +1 вверх. */
export function interSessionDelta(sets: LoggedSet[], repMax: number): -1 | 0 | 1 {
  if (sets.length === 0) return 0

  const reachedMax = sets.every((s) => s.reps >= repMax)
  const anyHard = sets.some((s) => s.feedback === 'limit' || s.feedback === 'failed')
  if (reachedMax && !anyHard) return 1

  const failed = sets.filter((s) => s.feedback === 'failed').length
  if (failed * 2 >= sets.length) return -1

  return 0
}

export function prescribe(ctx: PrescribeContext): Prescription {
  const { grid, repMin, repMax } = ctx
  const notes: string[] = []

  const { factor: pauseFactor, reset } = deloadFactor(ctx.daysSincePattern)
  const historyBase = reset ? null : baseFromLastSession(ctx.lastSessionSets)

  let source: PrescriptionSource
  let weightKg: number | null

  if (historyBase != null) {
    source = 'history'
    const delta = interSessionDelta(ctx.lastSessionSets, repMax)
    if (delta === 1) {
      weightKg = stepKg(historyBase, grid, 1).weightKg
      notes.push('Прошлый раз закрыл верх диапазона — прибавка на ступень')
    } else if (delta === -1) {
      weightKg = stepKg(historyBase, grid, -1).weightKg
      notes.push('Прошлый раз не добил — минус ступень')
    } else {
      weightKg = historyBase
      notes.push('Вес держим, растём в повторах')
    }
  } else if (ctx.probeBaseKg != null) {
    source = 'probe'
    weightKg = ctx.probeBaseKg * PROBE_FACTOR
    notes.push(
      reset
        ? `Перерыв больше ${RESET_AFTER_DAYS} дней — тренажёр считаем незнакомым, это разведка`
        : 'Незнакомый тренажёр — это разведочный подход, не рабочий',
    )
  } else {
    return {
      working: null,
      repMin,
      repMax,
      source: 'manual',
      preDeloadKg: null,
      warmup: null,
      notes: ['Истории по этому движению нет — поставь вес сам, дальше подхвачу'],
    }
  }

  // Откат за паузу — только поверх истории; разведка и так занижена.
  let preDeloadKg: number | null = null
  if (source === 'history' && pauseFactor < 1) {
    preDeloadKg = weightKg
    weightKg = weightKg * pauseFactor
    source = 'deload'
    notes.push(
      `Перерыв ${ctx.daysSincePattern} дн. — минус ${Math.round((1 - pauseFactor) * 100)}% на первый подход`,
    )
  }

  if (ctx.painRecent) {
    if (preDeloadKg == null) preDeloadKg = weightKg
    weightKg = weightKg * PAIN_BACKOFF_FACTOR
    source = 'pain_backoff'
    notes.push('В прошлый раз на этом движении была боль — рост заморожен, вес снижен')
  }

  // Рост идёт вверх по сетке, откаты — к ближайшей ступени.
  //
  // Именно к ближайшей, а не строго вниз: на грубой сетке (шаг 20 кг при рабочих 100)
  // округление вниз превратило бы откат в −20% вместо запрошенных −5%. Побочный
  // эффект осознанный: если снижение меньше половины шага, сетка его не выражает
  // и вес остаётся прежним. Это безопасно — один подход с фидбеком «легко»
  // вернул бы его туда же.
  //
  // Ограничение сверху — страховка на случай, когда прежний вес не лежит на текущей
  // сетке (история пришла с экземпляра с другим шагом или в других единицах).
  let working = snapKg(weightKg, grid, 'nearest')
  if (preDeloadKg != null && working.weightKg > preDeloadKg) {
    working = snapKg(weightKg, grid, 'down')
  }

  const needsExtraWarmup =
    source === 'probe' || source === 'deload' || source === 'pain_backoff'
  const warmup =
    ctx.firstForMuscleGroup || needsExtraWarmup
      ? (() => {
          const w = snapKg(working.weightKg * WARMUP_FACTOR, grid, 'down')
          return { ...w, reps: WARMUP_REPS }
        })()
      : null

  return { working, repMin, repMax, source, preDeloadKg, warmup, notes }
}

export type NextSet =
  | { action: 'continue'; weight: SnappedWeight; note?: string }
  | { action: 'stop_or_reduce'; weight: SnappedWeight; note: string }

/**
 * Авторегуляция внутри упражнения (раздел 5.5).
 * preDeloadKg — вес до отката за паузу: на фидбеке 'легко' возвращаемся
 * к нему, а не прибавляем ступень к заниженному.
 */
export function nextSet(args: {
  currentKg: number
  feedback: SetFeedback
  grid: WeightGrid
  preDeloadKg?: number | null
  pain?: boolean
}): NextSet {
  const { currentKg, feedback, grid, preDeloadKg, pain } = args

  if (pain) {
    return {
      action: 'stop_or_reduce',
      weight: stepKg(stepKg(currentKg, grid, -1).weightKg, grid, -1),
      note: 'Была боль — упражнение лучше завершить; если продолжаешь, то отсюда',
    }
  }

  switch (feedback) {
    case 'easy': {
      if (preDeloadKg != null && preDeloadKg > currentKg) {
        return {
          action: 'continue',
          weight: snapKg(preDeloadKg, grid, 'nearest'),
          note: 'Разведка прошла легко — возвращаемся к прежнему рабочему весу',
        }
      }
      return { action: 'continue', weight: stepKg(currentKg, grid, 1) }
    }
    case 'on_target':
      return { action: 'continue', weight: snapKg(currentKg, grid, 'nearest') }
    case 'limit':
      return {
        action: 'continue',
        weight: snapKg(currentKg, grid, 'nearest'),
        note: 'На пределе — в следующий раз вес не растим',
      }
    case 'failed':
      return { action: 'continue', weight: stepKg(currentKg, grid, -1) }
  }
}
