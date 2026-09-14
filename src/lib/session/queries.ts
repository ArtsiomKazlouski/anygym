import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  equipmentModels,
  equipmentSetups,
  exercises,
  gymEquipment,
  gyms,
  patterns,
  sessionItems,
  setLogs,
  templateItems,
  templates,
  workoutSessions,
} from '@/db/schema'
import type { LoggedSet } from '@/lib/engine'

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

/** Упражнения, доступные в этом зале под заданный паттерн. */
export async function alternativesFor(userId: string, gymId: string, patternCode: string) {
  return db
    .select({
      id: exercises.id,
      name: exercises.name,
      patternCode: exercises.patternCode,
      notes: exercises.notes,
      model: equipmentModels,
      instance: gymEquipment,
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
        eq(exercises.patternCode, patternCode),
        eq(gymEquipment.isActive, true),
      ),
    )
    .orderBy(exercises.name)
}

/** Сколько рабочих подходов накоплено по упражнению — этим ранжируются альтернативы. */
export async function historyVolume(userId: string, exerciseIds: string[]) {
  if (exerciseIds.length === 0) return new Map<string, number>()
  const rows = await db
    .select({ exerciseId: sessionItems.exerciseId, n: sql<number>`count(*)::int` })
    .from(setLogs)
    .innerJoin(sessionItems, eq(sessionItems.id, setLogs.sessionItemId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, sessionItems.sessionId))
    .where(
      and(
        eq(workoutSessions.userId, userId),
        eq(setLogs.kind, 'working'),
        sql`${sessionItems.exerciseId} = any(${sql.raw(`array[${exerciseIds.map((id) => `'${id}'`).join(',')}]::uuid[]`)})`,
      ),
    )
    .groupBy(sessionItems.exerciseId)
  return new Map(rows.map((r) => [r.exerciseId!, r.n]))
}

/**
 * Рабочие подходы последней сессии по этому упражнению.
 * Берётся именно последняя сессия целиком, а не последние N подходов:
 * межсессионная прогрессия смотрит на сессию как на единицу.
 */
export async function lastSessionSets(
  userId: string,
  exerciseId: string,
  excludeSessionId?: string,
): Promise<LoggedSet[]> {
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

  if (!latest) return []

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

  return rows
    .filter((r) => r.reps != null && r.feedback != null)
    .map((r) => ({ weightKg: r.weightKg, reps: r.reps!, feedback: r.feedback! }))
}

/**
 * Дней с последней работы на паттерн — включая текущую сессию.
 * Второе упражнение на ту же группу в один день даёт 0 и отката не получает.
 * null = паттерн не делался никогда.
 */
export async function daysSincePattern(userId: string, patternCode: string) {
  const [row] = await db
    .select({ at: sql<string | null>`max(${setLogs.loggedAt})` })
    .from(setLogs)
    .innerJoin(sessionItems, eq(sessionItems.id, setLogs.sessionItemId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, sessionItems.sessionId))
    .where(
      and(
        eq(workoutSessions.userId, userId),
        eq(sessionItems.patternCode, patternCode),
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

/**
 * База для разведки: рабочий вес на другом упражнении того же паттерна,
 * у которого больше всего истории.
 */
export async function probeBaseKg(
  userId: string,
  patternCode: string,
  excludeExerciseId: string,
) {
  const [row] = await db
    .select({ weightKg: setLogs.weightKg })
    .from(setLogs)
    .innerJoin(sessionItems, eq(sessionItems.id, setLogs.sessionItemId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, sessionItems.sessionId))
    .where(
      and(
        eq(workoutSessions.userId, userId),
        eq(sessionItems.patternCode, patternCode),
        eq(setLogs.kind, 'working'),
        sql`${sessionItems.exerciseId} <> ${excludeExerciseId}`,
      ),
    )
    .orderBy(desc(setLogs.loggedAt))
    .limit(1)
  return row?.weightKg ?? null
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

export async function patternTitles() {
  const rows = await db.select().from(patterns)
  return new Map(rows.map((p) => [p.code, p]))
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
