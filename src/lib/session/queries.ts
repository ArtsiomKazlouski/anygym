import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  equipmentModels,
  equipmentSetups,
  exercises,
  gymEquipment,
  gyms,
  sessionItems,
  setLogs,
  templateItems,
  templates,
  workoutSessions,
} from '@/db/schema'
import type { LoggedSet } from '@/lib/engine'
import type { MuscleCode } from '@/lib/muscles'

const MS_PER_DAY = 86_400_000

export async function listGyms(userId: string) {
  return db
    .select()
    .from(gyms)
    .where(and(eq(gyms.userId, userId), eq(gyms.isActive, true)))
    .orderBy(gyms.name)
}

export async function listTemplates(userId: string) {
  return db
    .select()
    .from(templates)
    .where(and(eq(templates.userId, userId), eq(templates.isActive, true)))
    .orderBy(templates.name)
}

export async function activeSession(userId: string) {
  const [row] = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), isNull(workoutSessions.endedAt)))
    .orderBy(desc(workoutSessions.startedAt))
    .limit(1)
  return row ?? null
}

/**
 * Последние тренировки с названием зала и числом записанных подходов.
 * Незавершённая — та, у которой нет endedAt; она же идёт первой по времени.
 */
export async function recentSessions(userId: string, limit = 10) {
  return db
    .select({
      id: workoutSessions.id,
      startedAt: workoutSessions.startedAt,
      endedAt: workoutSessions.endedAt,
      gymName: gyms.name,
      templateName: templates.name,
      sets: sql<number>`(
        select count(*)::int from ${setLogs}
        join ${sessionItems} on ${sessionItems.id} = ${setLogs.sessionItemId}
        where ${sessionItems.sessionId} = ${workoutSessions.id}
          and ${setLogs.kind} = 'working'
      )`,
    })
    .from(workoutSessions)
    .innerJoin(gyms, eq(gyms.id, workoutSessions.gymId))
    .leftJoin(templates, eq(templates.id, workoutSessions.templateId))
    .where(eq(workoutSessions.userId, userId))
    .orderBy(desc(workoutSessions.startedAt))
    .limit(limit)
}

/** Все упражнения пользователя, чья железка есть в этом зале. */
export async function exercisesInGym(userId: string, gymId: string) {
  return db
    .select({
      id: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      modelName: equipmentModels.name,
    })
    .from(exercises)
    .innerJoin(equipmentModels, eq(equipmentModels.id, exercises.equipmentModelId))
    .innerJoin(
      gymEquipment,
      and(eq(gymEquipment.equipmentModelId, equipmentModels.id), eq(gymEquipment.gymId, gymId)),
    )
    .where(
      and(
        eq(exercises.userId, userId),
        eq(exercises.isActive, true),
        eq(gymEquipment.isActive, true),
      ),
    )
    .orderBy(exercises.name)
}

/** Оборудование этого зала — для заведения нового упражнения на месте. */
export async function equipmentInGym(userId: string, gymId: string) {
  return db
    .select({ id: equipmentModels.id, name: equipmentModels.name })
    .from(gymEquipment)
    .innerJoin(equipmentModels, eq(equipmentModels.id, gymEquipment.equipmentModelId))
    .where(
      and(
        eq(gymEquipment.gymId, gymId),
        eq(gymEquipment.isActive, true),
        eq(equipmentModels.userId, userId),
      ),
    )
    .orderBy(equipmentModels.name)
}

/**
 * Рабочие подходы последней сессии по этому упражнению — и её дата.
 *
 * Берётся последняя сессия, где упражнение ДЕЛАЛОСЬ, а не последняя
 * тренировка вообще: иначе один пропуск обнулял бы прогресс. Дата нужна,
 * чтобы подсказка не говорила «прошлый раз» про тренировку двухнедельной
 * давности, которую человек не помнит.
 *
 * Сессия берётся целиком, а не последние N подходов: межсессионная
 * прогрессия смотрит на сессию как на единицу.
 */
export async function lastSessionSets(
  userId: string,
  exerciseId: string,
  excludeSessionId?: string,
): Promise<{ sets: LoggedSet[]; at: Date | null }> {
  const where = and(
    eq(workoutSessions.userId, userId),
    eq(sessionItems.exerciseId, exerciseId),
    eq(setLogs.kind, 'working'),
    excludeSessionId ? sql`${sessionItems.sessionId} <> ${excludeSessionId}` : undefined,
  )

  const [latest] = await db
    .select({ sessionId: sessionItems.sessionId, at: setLogs.loggedAt })
    .from(setLogs)
    .innerJoin(sessionItems, eq(sessionItems.id, setLogs.sessionItemId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, sessionItems.sessionId))
    .where(where)
    .orderBy(desc(setLogs.loggedAt))
    .limit(1)

  if (!latest) return { sets: [], at: null }

  const rows = await db
    .select({ weightKg: setLogs.weightKg, reps: setLogs.reps, feedback: setLogs.feedback })
    .from(setLogs)
    .innerJoin(sessionItems, eq(sessionItems.id, setLogs.sessionItemId))
    .where(
      and(
        eq(sessionItems.sessionId, latest.sessionId),
        eq(sessionItems.exerciseId, exerciseId),
        eq(setLogs.kind, 'working'),
      ),
    )
    .orderBy(setLogs.position)

  return {
    sets: rows
      .filter((r) => r.reps != null && r.feedback != null)
      .map((r) => ({ weightKg: r.weightKg, reps: r.reps!, feedback: r.feedback! })),
    at: latest.at,
  }
}

/**
 * Дней с последней работы на мышечную группу — включая текущую сессию.
 *
 * Именно группа, а не упражнение: если грудь жали три дня назад, она не
 * детренирована, и неважно, что конкретно эту разводку не делали месяц.
 * Второе упражнение на ту же группу в один день даёт 0 и отката не получает.
 * null = группа не тренировалась никогда.
 */
export async function daysSinceMuscle(userId: string, muscleGroup: MuscleCode) {
  const [row] = await db
    .select({ at: sql<string | null>`max(${setLogs.loggedAt})` })
    .from(setLogs)
    .innerJoin(sessionItems, eq(sessionItems.id, setLogs.sessionItemId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, sessionItems.sessionId))
    .innerJoin(exercises, eq(exercises.id, sessionItems.exerciseId))
    .where(
      and(
        eq(workoutSessions.userId, userId),
        eq(exercises.muscleGroup, muscleGroup),
        eq(setLogs.kind, 'working'),
      ),
    )

  if (!row?.at) return null
  return Math.floor((Date.now() - new Date(row.at).getTime()) / MS_PER_DAY)
}

/** Была ли боль на этом упражнении в двух последних сессиях. */
export async function painRecent(userId: string, exerciseId: string) {
  const recentSessions = await db
    .selectDistinct({ sessionId: sessionItems.sessionId, at: workoutSessions.startedAt })
    .from(sessionItems)
    .innerJoin(workoutSessions, eq(workoutSessions.id, sessionItems.sessionId))
    .where(and(eq(workoutSessions.userId, userId), eq(sessionItems.exerciseId, exerciseId)))
    .orderBy(desc(workoutSessions.startedAt))
    .limit(2)

  if (recentSessions.length === 0) return false

  const ids = recentSessions.map((s) => s.sessionId)
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(setLogs)
    .innerJoin(sessionItems, eq(sessionItems.id, setLogs.sessionItemId))
    .where(
      and(
        eq(sessionItems.exerciseId, exerciseId),
        sql`${sessionItems.sessionId} = any(${sql.raw(`array[${ids.map((id) => `'${id}'`).join(',')}]::uuid[]`)})`,
        sql`${setLogs.painZone} is not null`,
      ),
    )
  return (row?.n ?? 0) > 0
}

/** Запомненные настройки железки: на модель вообще либо на экземпляр в зале. */
export async function setupFor(
  userId: string,
  equipmentModelId: string,
  gymEquipmentId?: string,
) {
  const rows = await db
    .select()
    .from(equipmentSetups)
    .where(
      and(
        eq(equipmentSetups.userId, userId),
        eq(equipmentSetups.equipmentModelId, equipmentModelId),
      ),
    )
  return (
    rows.find((r) => gymEquipmentId && r.gymEquipmentId === gymEquipmentId) ??
    rows.find((r) => r.gymEquipmentId == null) ??
    null
  )
}

export async function templateItemsOf(templateId: string) {
  return db
    .select()
    .from(templateItems)
    .where(eq(templateItems.templateId, templateId))
    .orderBy(templateItems.position)
}

export async function sessionWithItems(userId: string, sessionId: string) {
  const [found] = await db
    .select({ session: workoutSessions, gym: gyms })
    .from(workoutSessions)
    .innerJoin(gyms, eq(gyms.id, workoutSessions.gymId))
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)))
  if (!found) return null
  const session = { ...found.session, gymName: found.gym.name }

  const items = await db
    .select({
      item: sessionItems,
      templateItem: templateItems,
      exercise: exercises,
    })
    .from(sessionItems)
    .leftJoin(templateItems, eq(templateItems.id, sessionItems.templateItemId))
    .leftJoin(exercises, eq(exercises.id, sessionItems.exerciseId))
    .where(eq(sessionItems.sessionId, sessionId))
    .orderBy(sessionItems.position)

  const logs = await db
    .select()
    .from(setLogs)
    .innerJoin(sessionItems, eq(sessionItems.id, setLogs.sessionItemId))
    .where(eq(sessionItems.sessionId, sessionId))
    .orderBy(setLogs.position)

  return {
    session,
    items,
    logsByItem: logs.reduce<Map<string, (typeof logs)[number]['set_log'][]>>((acc, row) => {
      const list = acc.get(row.set_log.sessionItemId) ?? []
      list.push(row.set_log)
      acc.set(row.set_log.sessionItemId, list)
      return acc
    }, new Map()),
  }
}
