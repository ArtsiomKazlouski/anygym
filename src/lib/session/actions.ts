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
    const items = await db
      .select()
      .from(templateItems)
      .where(eq(templateItems.templateId, templateId))
      .orderBy(templateItems.position)

    if (items.length > 0) {
      await db.insert(sessionItems).values(
        items.map((it) => ({
          sessionId: session.id,
          position: it.position,
          templateItemId: it.id,
          patternCode: it.patternCode,
          exerciseId: it.preferredExerciseId,
          targetSets: it.sets,
          repMin: it.repMin,
          repMax: it.repMax,
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
    prescribedWeightKg: prescribed != null ? Number(prescribed) : null,
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

export async function resumeItem(formData: FormData) {
  const userId = await requireUser()
  const itemId = String(formData.get('itemId') ?? '')
  const { item } = await ownedItem(userId, itemId)
  await db.update(sessionItems).set({ status: 'active' }).where(eq(sessionItems.id, item.id))
  revalidatePath(`/session/${item.sessionId}`)
}

export async function finishItem(formData: FormData) {
  const userId = await requireUser()
  const itemId = String(formData.get('itemId') ?? '')
  const { item } = await ownedItem(userId, itemId)
  await db.update(sessionItems).set({ status: 'done' }).where(eq(sessionItems.id, item.id))
  revalidatePath(`/session/${item.sessionId}`)
}

export async function finishSession(formData: FormData) {
  const userId = await requireUser()
  const sessionId = String(formData.get('sessionId') ?? '')

  await db
    .update(sessionItems)
    .set({ status: 'skipped' })
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
