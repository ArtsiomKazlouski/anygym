'use server'

import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  equipmentModels,
  exercises,
  gymEquipment,
  sessionItems,
  setLogs,
  templateItems,
  workoutSessions,
} from '@/db/schema'
import { toKg } from '@/lib/engine'
import { rangeFromTarget } from '@/lib/templates/parse'
import { resolveGrid } from './grid'

async function requireUser() {
  const session = await auth()
  const id = session?.user?.id
  if (!id) redirect('/signin')
  return id
}

/** Проверяет, что пункт принадлежит пользователю, и заодно отдаёт сессию. */
async function ownedItem(userId: string, itemId: string) {
  const [row] = await db
    .select({ item: sessionItems, session: workoutSessions })
    .from(sessionItems)
    .innerJoin(workoutSessions, eq(workoutSessions.id, sessionItems.sessionId))
    .where(and(eq(sessionItems.id, itemId), eq(workoutSessions.userId, userId)))
  if (!row) throw new Error('Пункт не найден')
  return row
}

export async function startSession(formData: FormData) {
  const userId = await requireUser()
  const gymId = String(formData.get('gymId') ?? '')
  const templateId = String(formData.get('templateId') ?? '')
  if (!gymId) throw new Error('Не выбран зал')

  const [session] = await db
    .insert(workoutSessions)
    .values({ userId, gymId, templateId: templateId || null })
    .returning()

  if (templateId) {
    // Целевые повторы живут на упражнении, поэтому берём их оттуда и кладём
    // в пункт сессии снимком: изменение цели не должно задним числом
    // переписывать уже проведённые тренировки.
    const items = await db
      .select({ item: templateItems, targetReps: exercises.targetReps })
      .from(templateItems)
      .leftJoin(exercises, eq(exercises.id, templateItems.preferredExerciseId))
      .where(eq(templateItems.templateId, templateId))
      .orderBy(templateItems.position)

    if (items.length > 0) {
      await db.insert(sessionItems).values(
        items.map(({ item, targetReps }) => ({
          sessionId: session.id,
          position: item.position,
          templateItemId: item.id,
          patternCode: item.patternCode,
          exerciseId: item.preferredExerciseId,
          targetSets: item.sets,
          ...rangeFromTarget(targetReps ?? DEFAULT_TARGET_REPS),
        })),
      )
    }
  }

  redirect(`/session/${session.id}`)
}

export async function pickExercise(formData: FormData) {
  const userId = await requireUser()
  const itemId = String(formData.get('itemId') ?? '')
  const exerciseId = String(formData.get('exerciseId') ?? '')
  const { item } = await ownedItem(userId, itemId)

  // Упражнение выбирается до первого подхода. Дальше смена означала бы, что
  // подходы, записанные на одну железку, приписаны другой. Чтобы передумать,
  // надо удалить записанное — тогда замок снимется сам.
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(setLogs)
    .where(eq(setLogs.sessionItemId, item.id))
  if (n > 0) {
    throw new Error('Подходы уже записаны — удали их, если нужно сменить упражнение')
  }

  await db
    .update(sessionItems)
    .set({ exerciseId, status: 'active' })
    .where(eq(sessionItems.id, item.id))

  revalidatePath(`/session/${item.sessionId}`)
}

export async function logSet(formData: FormData) {
  const userId = await requireUser()
  const itemId = String(formData.get('itemId') ?? '')
  const { item, session } = await ownedItem(userId, itemId)
  if (!item.exerciseId) throw new Error('Упражнение не выбрано')

  const kind = String(formData.get('kind') ?? 'working') as 'warmup' | 'ramp' | 'working'
  const weight = Number(formData.get('weight'))
  const reps = Number(formData.get('reps'))
  const feedbackRaw = String(formData.get('feedback') ?? '')
  const painZone = String(formData.get('painZone') ?? '').trim() || null
  const prescribed = formData.get('prescribedKg')
  const source = String(formData.get('source') ?? '') || null

  if (!Number.isFinite(weight) || weight <= 0) throw new Error('Некорректный вес')
  if (!Number.isFinite(reps) || reps <= 0) throw new Error('Некорректные повторы')

  const [exercise] = await db
    .select({ model: equipmentModels })
    .from(exercises)
    .innerJoin(equipmentModels, eq(equipmentModels.id, exercises.equipmentModelId))
    .where(eq(exercises.id, item.exerciseId))

  const [instance] = await db
    .select()
    .from(gymEquipment)
    .where(
      and(
        eq(gymEquipment.gymId, session.gymId),
        eq(gymEquipment.equipmentModelId, exercise.model.id),
      ),
    )

  const grid = resolveGrid(exercise.model, instance)

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${setLogs.position}), -1) + 1` })
    .from(setLogs)
    .where(eq(setLogs.sessionItemId, item.id))

  await db.insert(setLogs).values({
    sessionItemId: item.id,
    position: next,
    kind,
    weight,
    units: grid.units,
    weightKg: toKg(weight, grid.units),
    reps,
    // Фидбек собирается и на подводящих: по нему срезается остаток рампы.
    // В прогрессии они всё равно не участвуют — та смотрит только на kind='working'.
    feedback: kind !== 'warmup' && feedbackRaw ? (feedbackRaw as never) : null,
    painZone,
    prescribedWeightKg: prescribed ? Number(prescribed) : null,
    prescriptionSource: source ? (source as never) : null,
  })

  if (item.status === 'pending') {
    await db.update(sessionItems).set({ status: 'active' }).where(eq(sessionItems.id, item.id))
  }

  revalidatePath(`/session/${item.sessionId}`)
}

export async function deleteSet(formData: FormData) {
  const userId = await requireUser()
  const setId = String(formData.get('setId') ?? '')

  const [row] = await db
    .select({ set: setLogs, item: sessionItems })
    .from(setLogs)
    .innerJoin(sessionItems, eq(sessionItems.id, setLogs.sessionItemId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, sessionItems.sessionId))
    .where(and(eq(setLogs.id, setId), eq(workoutSessions.userId, userId)))
  if (!row) throw new Error('Подход не найден')

  await db.delete(setLogs).where(eq(setLogs.id, setId))
  revalidatePath(`/session/${row.item.sessionId}`)
}

const DEFAULT_SETS = 3
const DEFAULT_TARGET_REPS = 12

/** Добавляет упражнение в идущую тренировку, не трогая шаблон. */
export async function addSessionItem(formData: FormData) {
  const userId = await requireUser()
  const sessionId = String(formData.get('sessionId') ?? '')
  const exerciseId = String(formData.get('exerciseId') ?? '')
  if (!exerciseId) throw new Error('Не выбрано упражнение')

  const [session] = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)))
  if (!session) throw new Error('Тренировка не найдена')

  const [exercise] = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), eq(exercises.userId, userId)))
  if (!exercise) throw new Error('Упражнение не найдено')

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${sessionItems.position}), -1)` })
    .from(sessionItems)
    .where(eq(sessionItems.sessionId, sessionId))

  await db.insert(sessionItems).values({
    sessionId,
    position: max + 1,
    patternCode: exercise.patternCode,
    exerciseId: exercise.id,
    targetSets: DEFAULT_SETS,
    ...rangeFromTarget(exercise.targetReps ?? DEFAULT_TARGET_REPS),
  })

  revalidatePath(`/session/${sessionId}`)
}

/**
 * Заводит упражнение и сразу ставит его в тренировку.
 *
 * Железка выбирается из того, что в этом зале уже известно: у нового
 * оборудования нужны сетка весов, шаг и фото, а это отдельный экран.
 */
export async function createExerciseAndAdd(formData: FormData) {
  const userId = await requireUser()
  const sessionId = String(formData.get('sessionId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const patternCode = String(formData.get('patternCode') ?? '')
  const equipmentModelId = String(formData.get('equipmentModelId') ?? '')

  if (!name) throw new Error('Нужно название упражнения')
  if (!patternCode || !equipmentModelId) throw new Error('Не выбраны движение или тренажёр')

  const targetReps = Number(String(formData.get('targetReps') ?? '').trim())
  const [exercise] = await db
    .insert(exercises)
    .values({
      userId,
      name,
      patternCode,
      equipmentModelId,
      targetReps: Number.isFinite(targetReps) && targetReps > 0 ? Math.round(targetReps) : 12,
    })
    .returning()

  const next = new FormData()
  next.set('sessionId', sessionId)
  next.set('exerciseId', exercise.id)
  await addSessionItem(next)
}

/**
 * Убирает пункт из тренировки насовсем.
 *
 * Только пока по нему ничего не записано: у начатого упражнения есть подходы,
 * и удаление молча стёрло бы их. Для такого случая есть «Пропустить» — оно
 * сохраняет факт, что упражнение планировалось и не было сделано.
 */
export async function removeSessionItem(formData: FormData) {
  const userId = await requireUser()
  const itemId = String(formData.get('itemId') ?? '')
  const { item } = await ownedItem(userId, itemId)

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(setLogs)
    .where(eq(setLogs.sessionItemId, item.id))
  if (n > 0) throw new Error('По упражнению есть подходы — используй «Пропустить»')

  await db.delete(sessionItems).where(eq(sessionItems.id, item.id))
  revalidatePath(`/session/${item.sessionId}`)
}

/** Ещё один подход сверх плана — план пункта растёт на единицу. */
export async function addSet(formData: FormData) {
  const userId = await requireUser()
  const itemId = String(formData.get('itemId') ?? '')
  const { item } = await ownedItem(userId, itemId)

  await db
    .update(sessionItems)
    .set({ extraSets: item.extraSets + 1, status: 'active' })
    .where(eq(sessionItems.id, item.id))

  revalidatePath(`/session/${item.sessionId}`)
}

/**
 * Переводит внимание на этот пункт.
 *
 * Заменяет и «вернуться к отложенному», и попытки переставлять упражнения
 * местами: к любому можно просто перейти тапом. Активным может быть только
 * один пункт, поэтому прежний возвращается в очередь.
 */
export async function focusItem(formData: FormData) {
  const userId = await requireUser()
  const itemId = String(formData.get('itemId') ?? '')
  const { item } = await ownedItem(userId, itemId)

  // Прежний активный возвращается в очередь — но если в нём есть подходы,
  // он сделан, а не «ожидает»: иначе переход по списку стирал бы результат.
  await db
    .update(sessionItems)
    .set({
      status: sql`case when exists (
        select 1 from ${setLogs} where ${setLogs.sessionItemId} = ${sessionItems.id}
      ) then 'done'::session_item_status else 'pending'::session_item_status end`,
    })
    .where(and(eq(sessionItems.sessionId, item.sessionId), eq(sessionItems.status, 'active')))

  await db.update(sessionItems).set({ status: 'active' }).where(eq(sessionItems.id, item.id))
  revalidatePath(`/session/${item.sessionId}`)
}

/** Занято: пункт уезжает в конец, к нему предложим вернуться позже. */
export async function deferItem(formData: FormData) {
  const userId = await requireUser()
  const itemId = String(formData.get('itemId') ?? '')
  const { item } = await ownedItem(userId, itemId)

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${sessionItems.position}), 0)` })
    .from(sessionItems)
    .where(eq(sessionItems.sessionId, item.sessionId))

  await db
    .update(sessionItems)
    .set({ status: 'deferred', position: max + 1, deferredCount: item.deferredCount + 1 })
    .where(eq(sessionItems.id, item.id))

  revalidatePath(`/session/${item.sessionId}`)
}

export async function finishItem(formData: FormData) {
  const userId = await requireUser()
  const itemId = String(formData.get('itemId') ?? '')
  const { item } = await ownedItem(userId, itemId)
  await db.update(sessionItems).set({ status: 'done' }).where(eq(sessionItems.id, item.id))
  revalidatePath(`/session/${item.sessionId}`)
}

/**
 * Удаляет тренировку вместе с подходами — внешние ключи каскадные.
 *
 * Действие необратимое и меняет будущие подсказки: движок считает прогрессию
 * по записанным подходам, и удаление сессии убирает их из истории.
 */
export async function deleteSession(formData: FormData) {
  const userId = await requireUser()
  const sessionId = String(formData.get('sessionId') ?? '')

  const [found] = await db
    .select({ id: workoutSessions.id })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)))
  if (!found) throw new Error('Тренировка не найдена')

  await db.delete(workoutSessions).where(eq(workoutSessions.id, sessionId))
  redirect('/')
}

export async function finishSession(formData: FormData) {
  const userId = await requireUser()
  const sessionId = String(formData.get('sessionId') ?? '')

  // Что записано — сделано, что пусто — пропущено. Раньше незакрытые пункты
  // помечались пропущенными скопом, и упражнение с подходами теряло свой
  // статус только оттого, что по нему не нажали «Дальше».
  await db
    .update(sessionItems)
    .set({
      status: sql`case when exists (
        select 1 from ${setLogs} where ${setLogs.sessionItemId} = ${sessionItems.id}
      ) then 'done'::session_item_status else 'skipped'::session_item_status end`,
    })
    .where(
      and(
        eq(sessionItems.sessionId, sessionId),
        sql`${sessionItems.status} in ('pending','deferred','active')`,
      ),
    )

  await db
    .update(workoutSessions)
    .set({ endedAt: new Date() })
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)))

  redirect('/')
}
