import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { equipmentModels, exercises, gymEquipment, setLogs } from '@/db/schema'
import {
  type Prescription,
  type SetPlan,
  type WeightGrid,
  capRamp,
  nextSet,
  prescribe,
  reanchorRamp,
  snapKg,
} from '@/lib/engine'
import { resolveGrid } from './grid'
import { daysSincePattern, lastSessionSets, painRecent, probeBaseKg, setupFor } from './queries'

type LoggedRow = typeof setLogs.$inferSelect

export type ItemPlan = {
  grid: WeightGrid
  prescription: Prescription
  repMin: number
  repMax: number
  /**
   * Веса нет ни в истории, ни со слов — первый подход вводится руками.
   * Отличается от «упражнение закончено», где current тоже null.
   */
  manualEntry: boolean
  /** Весь план подходов целиком, включая уже сделанные — для превью. */
  planned: SetPlan[]
  /** Подход, который нужно сделать прямо сейчас. null = делать нечего. */
  current: SetPlan | null
  /** Остаток плана после текущего подхода — чтобы показать, что впереди. */
  upcoming: SetPlan[]
  /** Запомненные настройки железки. */
  setup: Record<string, string> | null
  setupNote: string | null
  notes: string[]
}

/**
 * Собирает план подходов для пункта сессии: тянет историю, зовёт движок
 * и накладывает уже записанные сегодня подходы.
 */
export async function buildItemPlan(args: {
  userId: string
  gymId: string
  sessionId: string
  exerciseId: string
  patternCode: string
  scheme: 'straight' | 'ramp'
  sets: number
  rampPercents: number[] | null
  rampReps: number[] | null
  repMin: number
  repMax: number
  extraSets: number
  firstForMuscleGroup: boolean
  logged: LoggedRow[]
}): Promise<ItemPlan | null> {
  const [exercise] = await db
    .select({ ex: exercises, model: equipmentModels })
    .from(exercises)
    .innerJoin(equipmentModels, eq(equipmentModels.id, exercises.equipmentModelId))
    .where(and(eq(exercises.id, args.exerciseId), eq(exercises.userId, args.userId)))
  if (!exercise) return null

  const [instance] = await db
    .select()
    .from(gymEquipment)
    .where(
      and(
        eq(gymEquipment.gymId, args.gymId),
        eq(gymEquipment.equipmentModelId, exercise.model.id),
      ),
    )

  const grid = resolveGrid(exercise.model, instance)

  const [last, days, pain, probe, setup] = await Promise.all([
    lastSessionSets(args.userId, args.exerciseId, args.sessionId),
    daysSincePattern(args.userId, args.patternCode),
    painRecent(args.userId, args.exerciseId),
    probeBaseKg(args.userId, args.patternCode, args.exerciseId),
    setupFor(args.userId, exercise.model.id, instance?.id),
  ])

  const prescription = prescribe({
    scheme: args.scheme,
    grid,
    repMin: args.repMin,
    repMax: args.repMax,
    sets: args.sets,
    extraSets: args.extraSets,
    rampPercents: args.rampPercents ?? undefined,
    rampReps: args.rampReps ?? undefined,
    lastSessionSets: last,
    declaredWorkingKg: exercise.ex.declaredWorkingKg,
    daysSincePattern: days,
    painRecent: pain,
    probeBaseKg: probe,
    firstForMuscleGroup: args.firstForMuscleGroup,
  })

  const notes = [...prescription.notes]
  const base = {
    grid,
    prescription,
    repMin: args.repMin,
    repMax: args.repMax,
    setup: setup?.settings ?? null,
    setupNote: setup?.note ?? null,
  }

  // Веса нет ни в истории, ни со слов. Первый подход называешь ты, дальше
  // план достраивается от того, что реально поставил.
  if (!prescription.top) {
    const workingDone = args.logged.filter((l) => l.kind === 'working').length
    const left = Math.max(0, args.sets + args.extraSets - workingDone)
    const last = args.logged[args.logged.length - 1]

    if (!last) {
      return { ...base, manualEntry: true, planned: [], current: null, upcoming: [], notes }
    }
    if (left === 0) {
      return { ...base, manualEntry: false, planned: [], current: null, upcoming: [], notes }
    }

    // Подсказка «поставь вес сам» относится только к первому подходу —
    // дальше ведём от того, что ты реально поставил.
    notes.length = 0
    notes.push('Веду от веса, который ты поставил в первом подходе')

    const nx = last.feedback
      ? nextSet({
          currentKg: last.weightKg,
          feedback: last.feedback,
          grid,
          pain: last.painZone != null,
          reps: last.reps,
          repMin: args.repMin,
          repMax: args.repMax,
        })
      : null
    if (nx?.note) notes.push(nx.note)

    const next: SetPlan = {
      role: 'working',
      weight: nx?.weight ?? snapKg(last.weightKg, grid, 'nearest'),
      reps: [args.repMin, args.repMax],
    }
    return {
      ...base,
      manualEntry: false,
      planned: [],
      current: next,
      upcoming: Array.from({ length: left - 1 }, () => next),
      notes,
    }
  }

  const done = args.logged.length
  const previous = done > 0 ? args.logged[done - 1] : null
  const previousPlan = done > 0 ? prescription.sets[done - 1] : null

  // Поставил не тот вес, что предложен — остаток рампы едет пропорционально.
  let effective = prescription.sets
  if (args.scheme === 'ramp' && previous && previousPlan) {
    const re = reanchorRamp({
      sets: prescription.sets,
      doneIndex: done - 1,
      actualKg: previous.weightKg,
      grid,
    })
    effective = re.sets
    if (re.scale !== 1) {
      notes.push(
        `Ты поставил ${previous.weight} вместо ${previousPlan.weight.weight} — остаток пересчитан`,
      )
    }
  }

  let remaining = effective.slice(done)

  if (previous?.feedback) {
    if (args.scheme === 'ramp' && previous.kind === 'ramp') {
      // Подводящий дался тяжелее ожидаемого — срезаем остаток рампы.
      const capped = capRamp({
        sets: effective,
        doneIndex: done - 1,
        feedback: previous.feedback,
        grid,
        doneKg: previous.weightKg,
      })
      remaining = capped.remaining
      if (capped.note) notes.push(capped.note)
    } else if (previous.kind === 'working' && remaining.length > 0) {
      // Прямая схема: вес следующего подхода ведёт фидбек предыдущего.
      const nx = nextSet({
        currentKg: previous.weightKg,
        feedback: previous.feedback,
        grid,
        preDeloadKg: prescription.preDeloadKg,
        pain: previous.painZone != null,
        reps: previous.reps,
        repMin: args.repMin,
        repMax: args.repMax,
      })
      if (nx.note) notes.push(nx.note)
      if (nx.action === 'stop_or_reduce') {
        remaining = [{ ...remaining[0], weight: nx.weight }]
      } else {
        remaining = remaining.map((s, i) => (i === 0 ? { ...s, weight: nx.weight } : s))
      }
    }
  }

  return {
    ...base,
    manualEntry: false,
    planned: [...effective.slice(0, done), ...remaining],
    current: remaining[0] ?? null,
    upcoming: remaining.slice(1),
    notes,
  }
}
