/**
 * Движок веса (docs/DESIGN.md, раздел 5).
 *
 * Функции чистые: на вход — факты из истории, на выход — план подходов.
 * Никаких обращений к БД, поэтому всё поведение проверяется тестами.
 */

import { type SnappedWeight, type WeightGrid, rampGrid, snapKg, stepKg } from './weights.ts'

export type SetFeedback = 'easy' | 'on_target' | 'limit' | 'failed'

export type PrescriptionSource =
  'history' | 'declared' | 'probe' | 'manual' | 'deload' | 'pain_backoff'

/**
 * Схема подходов.
 *  straight — один рабочий вес на все подходы, корректируется фидбеком;
 *  ramp     — восходящая пирамида к верхнему подходу. Прогрессия висит
 *             только на верхнем: подводящие считаются от него процентами.
 */
export type Scheme = 'straight' | 'ramp'

/** 'ramp' — подводящий подход, в прогрессии не участвует, как и разминка. */
export type SetRole = 'warmup' | 'ramp' | 'working'

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
  scheme: Scheme
  /** Диапазон повторов рабочего (для рампы — верхнего) подхода. */
  repMin: number
  repMax: number
  /** Сколько рабочих подходов. Для рампы длину задаёт rampPercents. */
  sets?: number
  /** Подходы сверх плана, добавленные на тренировке. Для рампы идут по верхнему весу. */
  extraSets?: number
  /** Доли от верхнего веса, по возрастанию, последняя = 1. Только для рампы. */
  rampPercents?: number[]
  /** Рабочие подходы последней сессии на ЭТОЙ МОДЕЛИ. Подводящие и разминку не передавать. */
  lastSessionSets: LoggedSet[]
  /**
   * Дней с последней работы на ЭТОТ ПАТТЕРН, включая текущую сессию.
   * Второе упражнение на ту же группу в один день даёт 0 и отката не получает.
   * null — паттерн не делался никогда.
   */
  daysSincePattern: number | null
  /** Была ли отмечена боль на этой модели в последних двух сессиях. */
  painRecent: boolean
  /**
   * Рабочий вес со слов пользователя. Используется, пока нет истории:
   * названный им самим вес точнее, чем 60% от другого упражнения.
   */
  declaredWorkingKg?: number | null
  /** Рабочий вес на другом упражнении того же паттерна — база для разведки. */
  probeBaseKg?: number | null
  /** Первое ли это упражнение на данную мышечную группу в текущей сессии. */
  firstForMuscleGroup: boolean
}

export type SetPlan = {
  role: SetRole
  weight: SnappedWeight
  reps: readonly [number, number]
  /** Доля от верхнего веса. Есть только у ступеней рампы и у верхнего подхода. */
  percent?: number
}

/**
 * Ниже этой доли ступень не считается показательной: подход пустым грифом
 * на 20% ничего не говорит о том, каким будет твой верх сегодня.
 */
export const RE_ANCHOR_MIN_PERCENT = 0.5

export type Prescription = {
  scheme: Scheme
  /** Верхний (рабочий) вес — на нём висит прогрессия. null = истории нет. */
  top: SnappedWeight | null
  /** Полный план подходов по порядку, включая разминку и подводящие. */
  sets: SetPlan[]
  source: PrescriptionSource
  /**
   * Вес до отката за паузу. Если первый подход получит 'easy',
   * следующий возвращается сюда, а не растёт на ступень от откаченного.
   */
  preDeloadKg: number | null
  /** Человекочитаемые пояснения — их показывает UI, чтобы подсказка не выглядела магией. */
  notes: string[]
}

/** Множитель отката за паузу. reset = полный сброс в разведку. */
export function deloadFactor(days: number | null): { factor: number; reset: boolean } {
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

/**
 * Подход считается проваленным, если повторов вышло меньше нижней границы
 * диапазона.
 *
 * Отдельной кнопки «не добил» нет намеренно: она дублировала бы число повторов.
 * Кнопка отвечает на то, чего число сказать не может — чего подход стоил.
 * Поэтому «8 повторов при цели 10-12 + на пределе» это провал, а те же
 * 8 повторов с ответом «легко» — просто ты прервался по своим причинам,
 * и вес тут ни при чём.
 */
export function isFailed(set: LoggedSet, repMin: number): boolean {
  if (set.feedback === 'failed') return true // данные, записанные старой формой
  return set.reps < repMin && set.feedback !== 'easy'
}

/** Межсессионная прогрессия (раздел 5.4): -1 вниз, 0 держим, +1 вверх. */
export function interSessionDelta(
  sets: LoggedSet[],
  repMin: number,
  repMax: number,
): -1 | 0 | 1 {
  if (sets.length === 0) return 0

  const failed = sets.filter((s) => isFailed(s, repMin)).length
  if (failed * 2 >= sets.length) return -1

  const reachedMax = sets.every((s) => s.reps >= repMax)
  const anyHard = sets.some((s) => s.feedback === 'limit' || failed > 0)
  if (reachedMax && !anyHard) return 1

  return 0
}

/** Строит план подходов от верхнего веса. */
function buildSets(ctx: PrescribeContext, top: SnappedWeight, extraWarmup: boolean): SetPlan[] {
  const { grid, repMin, repMax } = ctx
  const coarse = rampGrid(grid)
  const plan: SetPlan[] = []

  if (ctx.scheme === 'ramp') {
    const percents = (ctx.rampPercents ?? [1]).slice().sort((a, b) => a - b)
    let previousKg = -Infinity
    percents.forEach((p, i) => {
      const isTop = i === percents.length - 1
      const weight = isTop ? top : snapKg(top.weightKg * p, coarse, 'nearest')

      // На грубой сетке соседние доли схлопываются: 0.85 и 0.9 от 100 при шаге 20
      // дают 80 и 100. Подводящая ступень обязана быть строго выше предыдущей
      // и строго ниже верхней — иначе это не подводка, а повтор.
      if (!isTop && (weight.weightKg <= previousKg || weight.weightKg >= top.weightKg)) return
      previousKg = weight.weightKg

      // Цель повторов одна на всё упражнение: подводящий отличается весом,
      // а не тем, сколько раз ты собираешься поднять.
      plan.push({
        role: isTop ? 'working' : 'ramp',
        weight,
        reps: [repMin, repMax],
        percent: p,
      })
    })

    // Подходы сверх плана идут по верхнему весу: рампа своё уже отработала.
    for (let i = 0; i < (ctx.extraSets ?? 0); i++) {
      plan.push({ role: 'working', weight: top, reps: [repMin, repMax] })
    }

    // Рампа обычно сама себе разминка. Отдельный подход нужен только если
    // она начинается высоко — а это бывает на гантелях с редким рядом.
    const first = plan[0]
    if (extraWarmup && first && first.weight.weightKg > top.weightKg * WARMUP_FACTOR) {
      plan.unshift({
        role: 'warmup',
        weight: snapKg(top.weightKg * WARMUP_FACTOR, coarse, 'down'),
        reps: WARMUP_REPS,
      })
    }

    return plan
  }

  if (extraWarmup) {
    plan.push({
      role: 'warmup',
      weight: snapKg(top.weightKg * WARMUP_FACTOR, coarse, 'down'),
      reps: WARMUP_REPS,
    })
  }

  for (let i = 0; i < (ctx.sets ?? 3) + (ctx.extraSets ?? 0); i++) {
    plan.push({ role: 'working', weight: top, reps: [repMin, repMax] })
  }

  return plan
}

export function prescribe(ctx: PrescribeContext): Prescription {
  const { grid, repMax } = ctx
  const notes: string[] = []

  const { factor: pauseFactor, reset } = deloadFactor(ctx.daysSincePattern)
  const historyBase = reset ? null : baseFromLastSession(ctx.lastSessionSets)

  let source: PrescriptionSource
  let topKg: number

  if (historyBase != null) {
    source = 'history'
    const delta = interSessionDelta(ctx.lastSessionSets, ctx.repMin, repMax)
    if (delta === 1) {
      topKg = stepKg(historyBase, grid, 1).weightKg
      notes.push('Прошлый раз закрыл верх диапазона — прибавка на ступень')
    } else if (delta === -1) {
      topKg = stepKg(historyBase, grid, -1).weightKg
      notes.push('Прошлый раз не добил — минус ступень')
    } else {
      topKg = historyBase
      notes.push('Вес держим, растём в повторах')
    }
  } else if (ctx.declaredWorkingKg != null && !reset) {
    source = 'declared'
    topKg = ctx.declaredWorkingKg
    notes.push('Стартуем с веса, который ты назвал сам — дальше поведёт история')
  } else if (ctx.probeBaseKg != null) {
    source = 'probe'
    topKg = ctx.probeBaseKg * PROBE_FACTOR
    notes.push(
      reset
        ? `Перерыв больше ${RESET_AFTER_DAYS} дней — тренажёр считаем незнакомым, это разведка`
        : 'Незнакомый тренажёр — это разведочный подход, не рабочий',
    )
  } else {
    return {
      scheme: ctx.scheme,
      top: null,
      sets: [],
      source: 'manual',
      preDeloadKg: null,
      notes: ['Истории по этому движению нет — поставь вес сам, дальше подхвачу'],
    }
  }

  // Откат за паузу — только поверх истории; разведка и так занижена.
  let preDeloadKg: number | null = null
  if (source === 'history' && pauseFactor < 1) {
    preDeloadKg = topKg
    topKg = topKg * pauseFactor
    source = 'deload'
    notes.push(
      `Перерыв ${ctx.daysSincePattern} дн. — минус ${Math.round((1 - pauseFactor) * 100)}% на верхний подход`,
    )
  }

  if (ctx.painRecent) {
    if (preDeloadKg == null) preDeloadKg = topKg
    topKg = topKg * PAIN_BACKOFF_FACTOR
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
  let top = snapKg(topKg, grid, 'nearest')
  if (preDeloadKg != null && top.weightKg > preDeloadKg) {
    top = snapKg(topKg, grid, 'down')
  }

  const needsExtraWarmup =
    ctx.firstForMuscleGroup ||
    source === 'probe' ||
    source === 'deload' ||
    source === 'pain_backoff'

  return {
    scheme: ctx.scheme,
    top,
    sets: buildSets(ctx, top, needsExtraWarmup),
    source,
    preDeloadKg,
    notes,
  }
}

export type NextSet =
  | { action: 'continue'; weight: SnappedWeight; note?: string }
  | { action: 'stop_or_reduce'; weight: SnappedWeight; note: string }

/**
 * Авторегуляция внутри упражнения при прямой схеме (раздел 5.5).
 * preDeloadKg — вес до отката за паузу: на фидбеке 'легко' возвращаемся
 * к нему, а не прибавляем ступень к заниженному.
 */
export function nextSet(args: {
  currentKg: number
  feedback: SetFeedback
  grid: WeightGrid
  preDeloadKg?: number | null
  pain?: boolean
  /** Повторы и границы диапазона: вместе они перевешивают кнопку. */
  reps?: number | null
  repMin?: number | null
  repMax?: number | null
}): NextSet {
  const { currentKg, feedback, grid, preDeloadKg, pain, reps, repMin, repMax } = args

  if (pain) {
    return {
      action: 'stop_or_reduce',
      weight: stepKg(stepKg(currentKg, grid, -1).weightKg, grid, -1),
      note: 'Была боль — упражнение лучше завершить; если продолжаешь, то отсюда',
    }
  }

  // Провал выводится из повторов, а не из отдельной кнопки.
  if (reps != null && repMin != null && reps < repMin && feedback !== 'easy') {
    return {
      action: 'continue',
      weight: stepKg(currentKg, grid, -1),
      note: `Повторов вышло ${reps} при цели от ${repMin} — минус ступень`,
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
    case 'on_target': {
      // Двойная прогрессия: закрыл верх диапазона — вес растёт, что бы
      // ни говорила кнопка. Пятнадцать повторов при цели двенадцать это
      // не «в точку», это лёгкий вес.
      if (reps != null && repMax != null && reps >= repMax) {
        return {
          action: 'continue',
          weight: stepKg(currentKg, grid, 1),
          note: `Повторы закрыты (${reps} при цели до ${repMax}) — вес растёт`,
        }
      }
      return { action: 'continue', weight: snapKg(currentKg, grid, 'nearest') }
    }
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

/**
 * Разминка тяжелее рабочего веса означает, что рабочий занижен.
 *
 * Разминаются легче, чем работают — иначе это не разминка. Если движок
 * предложил рабочие 10, а человек размялся на 12, спорить с ним бессмысленно:
 * двенадцать он только что поднял, а десять ему навязывают из-за неудачной
 * прошлой тренировки. Остаток подтягивается к фактическому весу разминки.
 *
 * Обратное неверно: лёгкая разминка ничего не говорит о рабочем весе
 * и вниз его не тянет.
 */
export function liftAfterWarmup(args: {
  sets: SetPlan[]
  warmupKg: number
  grid: WeightGrid
}): { sets: SetPlan[]; lifted: boolean } {
  const { sets, warmupKg, grid } = args
  const working = sets.filter((s) => s.role !== 'warmup')
  if (working.length === 0) return { sets, lifted: false }

  const lightest = Math.min(...working.map((s) => s.weight.weightKg))
  if (warmupKg <= lightest + 1e-9) return { sets, lifted: false }

  const raised = snapKg(warmupKg, grid, 'nearest')
  return {
    sets: sets.map((s) =>
      s.role === 'warmup' || s.weight.weightKg >= warmupKg - 1e-9
        ? s
        : { ...s, weight: raised },
    ),
    lifted: true,
  }
}

/**
 * Пересчёт остатка рампы под фактически поставленный вес.
 *
 * Ты поставил не то, что предложено — значит сегодня рампа идёт по другой
 * траектории, и остаток должен поехать вместе с ней. Ступени ниже
 * RE_ANCHOR_MIN_PERCENT ничего не пересчитывают: подход пустым грифом
 * не говорит о том, каким будет твой верх.
 */
export function reanchorRamp(args: {
  sets: SetPlan[]
  doneIndex: number
  actualKg: number
  grid: WeightGrid
}): { sets: SetPlan[]; scale: number } {
  const { sets, doneIndex, actualKg, grid } = args
  const done = sets[doneIndex]
  const planned = done?.weight.weightKg ?? 0

  if (done?.percent == null || done.percent < RE_ANCHOR_MIN_PERCENT) return { sets, scale: 1 }
  if (planned <= 0 || Math.abs(actualKg - planned) < 1e-6) return { sets, scale: 1 }

  const scale = actualKg / planned
  return {
    sets: sets.map((s, i) =>
      i <= doneIndex ? s : { ...s, weight: snapKg(s.weight.weightKg * scale, grid, 'nearest') },
    ),
    scale,
  }
}

/**
 * Ограничение рампы по ходу дела.
 *
 * Подводящий подход прошёл тяжелее ожидаемого — значит запланированный верх
 * сегодня не твой. Срезаем остаток, вместо того чтобы вести тебя в подход,
 * к которому ты явно не готов. Это ровно тот момент, где «страшновато»
 * обычно решается на глаз.
 *
 * Возвращает остаток плана после подхода с индексом doneIndex.
 */
export function capRamp(args: {
  sets: SetPlan[]
  doneIndex: number
  feedback: SetFeedback
  grid: WeightGrid
  /** Фактический вес сделанного подхода, если он отличается от плана. */
  doneKg?: number
}): { remaining: SetPlan[]; note?: string } {
  const { sets, doneIndex, feedback, grid } = args
  const rest = sets.slice(doneIndex + 1)
  if (rest.length === 0) return { remaining: [] }

  const doneKg = args.doneKg ?? sets[doneIndex].weight.weightKg

  if (feedback === 'failed') {
    return {
      remaining: [],
      note: 'Подводящий не добит — верхний подход сегодня пропускаем',
    }
  }

  if (feedback === 'limit') {
    const capKg = stepKg(doneKg, grid, 1).weightKg
    const planned = rest[rest.length - 1]
    const topKg = Math.min(capKg, planned.weight.weightKg)

    // Верхний подход остаётся всегда — иначе за подход не зацепится прогрессия.
    const topSet: SetPlan = {
      ...planned,
      role: 'working',
      weight: snapKg(topKg, grid, 'nearest'),
    }
    const lead = rest
      .slice(0, -1)
      .filter((x) => x.weight.weightKg < topSet.weight.weightKg)
      .map((x): SetPlan => ({ ...x, role: 'ramp' }))

    return {
      remaining: [...lead, topSet],
      note: 'Подводящий был на пределе — верх срезан на одну ступень',
    }
  }

  return { remaining: rest }
}
