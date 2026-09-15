/**
 * Движок веса (docs/DESIGN.md, раздел 5).
 *
 * Функции чистые: на вход — факты из истории, на выход — план подходов.
 * Никаких обращений к БД, поэтому всё поведение проверяется тестами.
 */

import { type SnappedWeight, type WeightGrid, rampGrid, snapKg, stepKg } from './weights.ts'

export type SetFeedback = 'easy' | 'on_target' | 'limit' | 'failed'

/**
 * 'declared' и 'probe' больше не выдаются: заявленный вес убран, а разведка
 * от соседнего упражнения не пережила отказ от паттернов. Значения оставлены —
 * на них ссылаются старые записи подходов.
 */
export type PrescriptionSource =
  'history' | 'declared' | 'probe' | 'manual' | 'deload' | 'pain_backoff'

/** 'ramp' — подводящий подход, в прогрессии не участвует, как и разминка. */
export type SetRole = 'warmup' | 'ramp' | 'working'

export type LoggedSet = {
  weightKg: number
  reps: number
  feedback: SetFeedback
}

/** Коэффициенты вынесены сюда, чтобы калибровать их по накопленным данным. */
export const PAIN_BACKOFF_FACTOR = 0.9
export const RESET_AFTER_DAYS = 90

/** Откат за паузу: дни без работы на МЫШЕЧНУЮ ГРУППУ -> множитель. */
export const DELOAD_TABLE: readonly { upToDays: number; factor: number }[] = [
  { upToDays: 10, factor: 1.0 },
  { upToDays: 21, factor: 0.95 },
  { upToDays: 42, factor: 0.9 },
  { upToDays: RESET_AFTER_DAYS, factor: 0.85 },
]

export type PrescribeContext = {
  grid: WeightGrid
  /** Диапазон повторов. Один на всё упражнение, включая подводящие. */
  repMin: number
  repMax: number
  /** Сколько рабочих подходов — все на одном весе. */
  sets?: number
  /** Подходы сверх плана, добавленные на тренировке. Идут тем же весом. */
  extraSets?: number
  /**
   * Подводка: доли от рабочего веса, по возрастанию, все строго меньше 1.
   * Пусто — упражнение начинается сразу с рабочего веса.
   */
  rampPercents?: number[]
  /** Рабочие подходы последней сессии на ЭТОЙ МОДЕЛИ. Подводящие и разминку не передавать. */
  lastSessionSets: LoggedSet[]
  /**
   * Дней с последней работы на ЭТУ МЫШЕЧНУЮ ГРУППУ, включая текущую сессию.
   * Второе упражнение на ту же группу в один день даёт 0 и отката не получает.
   * null — группа не тренировалась никогда.
   */
  daysSinceMuscle: number | null
  /** Была ли отмечена боль на этой модели в последних двух сессиях. */
  painRecent: boolean
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
  /** Рабочий вес — на нём висит прогрессия. null = истории нет. */
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

/**
 * Межсессионная прогрессия (раздел 5.4): -1 вниз, 0 держим, +1 вверх.
 *
 * Решает ПЕРВЫЙ рабочий подход, а не все сразу.
 *
 * Второй и третий подходы на том же весе всегда слабее первого — это
 * накопленная усталость, а не приговор весу. Требовать верх диапазона от всех
 * трёх значило бы не дать вырасти никогда, особенно когда перед работой есть
 * подводка; считать проваленными все, кто не дотянул, — наоборот, утягивать
 * вес вниз каждую тренировку. Первый рабочий подход — единственный, который
 * из недели в неделю делается в одинаковых условиях, поэтому сравнивать можно
 * только его.
 *
 * Между тренировками решают повторы, а не кнопка. Раньше ответ «на пределе»
 * хоть на одном подходе блокировал рост — и прогресс становился невозможен:
 * последний подход на верхней границе диапазона почти всегда ощущается
 * предельным, в этом и смысл границы.
 *
 * Кнопка по-прежнему правит вес внутри тренировки — там она к месту.
 */
export function interSessionDelta(
  sets: LoggedSet[],
  repMin: number,
  repMax: number,
): -1 | 0 | 1 {
  const first = sets[0]
  if (!first) return 0

  if (isFailed(first, repMin)) return -1
  return first.reps >= repMax ? 1 : 0
}

/**
 * Строит план подходов от рабочего веса: сначала подводка, потом работа.
 *
 * Подводка и рабочие подходы — не две разные схемы, а две части одного
 * упражнения. Подводки может не быть вовсе, и тогда упражнение начинается
 * сразу с рабочего веса; рабочих подходов всегда хотя бы один.
 *
 * Отдельного вида «разминка» нет: подводка и есть разминка, просто
 * записанная, а не подразумеваемая.
 */
function buildSets(ctx: PrescribeContext, top: SnappedWeight): SetPlan[] {
  const { grid, repMin, repMax } = ctx
  const coarse = rampGrid(grid)
  const plan: SetPlan[] = []

  // Подводка округляется своим, грубым шагом: на штанге рабочий вес растёт
  // по 2.5, но вешать 42.5 ради подводящего — возня с мелкими блинами.
  // Поэтому вес подводки задан долями (едет вместе с рабочим), а ложится
  // на те ступени, которые реально удобно собрать из блинов.
  const percents = (ctx.rampPercents ?? []).slice().sort((a, b) => a - b)
  let previousKg = -Infinity
  for (const p of percents) {
    if (p >= 1) continue // подводящий не может быть тяжелее рабочего
    const weight = snapKg(top.weightKg * p, coarse, 'nearest')

    // На грубой сетке соседние доли схлопываются: 0.85 и 0.9 от 100 при шаге 20
    // дают обе 80. Ступень обязана быть строго выше предыдущей и строго ниже
    // рабочего веса — иначе это не подводка, а повтор.
    if (weight.weightKg <= previousKg || weight.weightKg >= top.weightKg) continue
    previousKg = weight.weightKg

    // Повторы на подводке те же, что в упражнении. Считать их отдельно значит
    // решать за человека, как ему разминаться, — а этого приложение не знает.
    plan.push({ role: 'ramp', weight, reps: [repMin, repMax], percent: p })
  }

  for (let i = 0; i < Math.max(1, ctx.sets ?? 3) + (ctx.extraSets ?? 0); i++) {
    plan.push({ role: 'working', weight: top, reps: [repMin, repMax] })
  }

  return plan
}

export function prescribe(ctx: PrescribeContext): Prescription {
  const { grid, repMax } = ctx
  const notes: string[] = []

  const { factor: pauseFactor, reset } = deloadFactor(ctx.daysSinceMuscle)
  const historyBase = reset ? null : baseFromLastSession(ctx.lastSessionSets)

  let source: PrescriptionSource
  let topKg: number

  if (historyBase != null) {
    source = 'history'
    const delta = interSessionDelta(ctx.lastSessionSets, ctx.repMin, repMax)
    if (delta === 1) {
      topKg = stepKg(historyBase, grid, 1).weightKg
      notes.push('Верх диапазона закрыт — прибавка на ступень')
    } else if (delta === -1) {
      topKg = stepKg(historyBase, grid, -1).weightKg
      notes.push('Повторы не добраны — минус ступень')
    } else {
      topKg = historyBase
      notes.push('Вес держим, растём в повторах')
    }
  } else {
    // Веса нет — и угадывать его не от чего.
    //
    // Раньше он брался от соседнего упражнения того же паттерна с коэффициентом.
    // По мышечной группе так делать нельзя: жим и сведение — одна грудь, но
    // сотня в жиме не означает сотню в разводке. Ошибиться здесь вверх
    // означает подсунуть травмоопасный вес на незнакомой железке.
    return {
      top: null,
      sets: [],
      source: 'manual',
      preDeloadKg: null,
      notes: [
        reset
          ? `Перерыв больше ${RESET_AFTER_DAYS} дней — начинаем заново, поставь вес сам`
          : 'Истории по этому упражнению нет — поставь вес сам, дальше подхвачу',
      ],
    }
  }

  // Откат за паузу — только поверх истории; разведка и так занижена.
  let preDeloadKg: number | null = null
  if (source === 'history' && pauseFactor < 1) {
    preDeloadKg = topKg
    topKg = topKg * pauseFactor
    source = 'deload'
    notes.push(
      `Перерыв ${ctx.daysSinceMuscle} дн. — минус ${Math.round((1 - pauseFactor) * 100)}% на верхний подход`,
    )
  }

  if (ctx.painRecent) {
    if (preDeloadKg == null) preDeloadKg = topKg
    topKg = topKg * PAIN_BACKOFF_FACTOR
    source = 'pain_backoff'
    notes.push('В прошлый раз на этом упражнении была боль — рост заморожен, вес снижен')
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

  return {
    top,
    sets: buildSets(ctx, top),
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
      // Вес растёт посреди упражнения только если повторов вышло БОЛЬШЕ цели:
      // пятнадцать при цели двенадцать — это лёгкий вес, ждать следующей
      // тренировки незачем.
      //
      // Ровно по цели — не повод: рабочие подходы делаются одним весом, чтобы
      // их можно было сравнить между собой и с прошлой неделей. Прибавку за
      // закрытую цель выдаст межсессионная прогрессия, и выдаст один раз,
      // а не дважды за ту же работу.
      if (reps != null && repMax != null && reps > repMax) {
        return {
          action: 'continue',
          weight: stepKg(currentKg, grid, 1),
          note: `Повторов вышло ${reps} при цели ${repMax} — вес растёт уже сейчас`,
        }
      }
      return { action: 'continue', weight: snapKg(currentKg, grid, 'nearest') }
    }
    case 'limit':
      return {
        action: 'continue',
        weight: snapKg(currentKg, grid, 'nearest'),
        note: 'На пределе — вес в следующем подходе держим',
      }
    case 'failed':
      return { action: 'continue', weight: stepKg(currentKg, grid, -1) }
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
 * Срезает остаток упражнения, если подводящий дался тяжелее ожидаемого.
 *
 * Это и есть «переходим выше или нет»: подводка существует затем, чтобы
 * решение о рабочем весе принималось по сегодняшнему самочувствию, а не
 * по записи недельной давности.
 *
 * Срезается рабочий вес — и сразу для всех оставшихся рабочих подходов:
 * если 80 пошло на пределе, то 90 не станет легче к третьему подходу.
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
      note: 'Подводящий не добит — рабочие подходы сегодня пропускаем',
    }
  }

  if (feedback !== 'limit') return { remaining: rest }

  const working = rest.filter((x) => x.role === 'working')
  if (working.length === 0) return { remaining: rest }

  const capKg = stepKg(doneKg, grid, 1).weightKg
  const topKg = Math.min(capKg, working[working.length - 1].weight.weightKg)
  const top = snapKg(topKg, grid, 'nearest')

  // Рабочие подходы остаются всегда — иначе за упражнение не зацепится
  // прогрессия. Подводящие, которые после среза оказались не легче рабочего
  // веса, отпадают: подводить уже не к чему.
  const lead = rest.filter((x) => x.role === 'ramp' && x.weight.weightKg < top.weightKg)
  const capped = working.map((x): SetPlan => ({ ...x, weight: top }))

  return {
    remaining: [...lead, ...capped],
    note: 'Подводящий был на пределе — рабочий вес срезан на ступень',
  }
}
