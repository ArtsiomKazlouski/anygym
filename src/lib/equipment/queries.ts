import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  equipmentModels,
  equipmentSetups,
  exercises,
  gymEquipment,
  gyms,
  sessionItems,
  setLogs,
  workoutSessions,
} from '@/db/schema'
import { MODEL_COLUMNS } from './columns'

/**
 * Счёт оборудования делается соединением, а не коррелированным подзапросом.
 *
 * В запросе по одной таблице Drizzle рендерит колонки без имени таблицы,
 * и внутри подзапроса «id» разрешался в gym_equipment.id вместо gym.id —
 * условие всегда ложно, счёт всегда ноль. Соединение от такой эвристики
 * не зависит.
 */
export async function gymsWithCounts(userId: string) {
  return db
    .select({
      id: gyms.id,
      name: gyms.name,
      note: gyms.note,
      equipment: sql<number>`count(${gymEquipment.id})::int`,
    })
    .from(gyms)
    .leftJoin(
      gymEquipment,
      and(eq(gymEquipment.gymId, gyms.id), eq(gymEquipment.isActive, true)),
    )
    .where(and(eq(gyms.userId, userId), eq(gyms.isActive, true)))
    .groupBy(gyms.id)
    .orderBy(gyms.name)
}

/**
 * Последний рабочий подход по каждому упражнению.
 *
 * Нужен, чтобы показать настоящий текущий вес рядом со стартовым: стартовый
 * задаётся один раз и с тех пор не меняется, а человек читает его как
 * «мой рабочий вес» и удивляется расхождению.
 *
 * DISTINCT ON — расширение Postgres: одна строка на упражнение, самая свежая.
 * Через построитель запросов он не выражается, отсюда сырой SQL.
 */
export async function lastWorkingSets(userId: string) {
  const result = await db.execute(sql`
    select distinct on (si.exercise_id)
      si.exercise_id as exercise_id,
      sl.weight      as weight,
      sl.units       as units,
      sl.logged_at   as logged_at
    from ${setLogs} sl
    join ${sessionItems} si on si.id = sl.session_item_id
    join ${workoutSessions} ws on ws.id = si.session_id
    where ws.user_id = ${userId}
      and sl.kind = 'working'
      and si.exercise_id is not null
    order by si.exercise_id, sl.logged_at desc
  `)

  const rows = (Array.isArray(result) ? result : (result.rows ?? [])) as {
    exercise_id: string
    weight: string
    units: 'kg' | 'lb'
    logged_at: string
  }[]

  return new Map(
    rows.map((r) => [
      r.exercise_id,
      { weight: Number(r.weight), units: r.units, at: new Date(r.logged_at) },
    ]),
  )
}

/**
 * Сколько упражнений уже в каждой группе взаимозаменяемых.
 *
 * Показывается прямо в выборе: без этого поле читается как пересказ названия
 * упражнения, а не как «вот с чем оно встанет в один ряд».
 */
export async function exercisesPerPattern(userId: string) {
  const rows = await db
    .select({ patternCode: exercises.patternCode, n: sql<number>`count(*)::int` })
    .from(exercises)
    .where(and(eq(exercises.userId, userId), eq(exercises.isActive, true)))
    .groupBy(exercises.patternCode)
  return new Map(rows.map((r) => [r.patternCode, r.n]))
}

/** Всё оборудование пользователя — для выбора при заведении упражнения. */
export async function allEquipment(userId: string) {
  return db
    .select({
      id: equipmentModels.id,
      name: equipmentModels.name,
      kind: equipmentModels.kind,
    })
    .from(equipmentModels)
    .where(eq(equipmentModels.userId, userId))
    .orderBy(equipmentModels.name)
}

/** Весь каталог упражнений: цель повторов правится здесь. */
export async function allExercises(userId: string) {
  return db
    .select({
      id: exercises.id,
      name: exercises.name,
      patternCode: exercises.patternCode,
      targetReps: exercises.targetReps,
      modelId: equipmentModels.id,
      modelName: equipmentModels.name,
      modelKind: equipmentModels.kind,
    })
    .from(exercises)
    .innerJoin(equipmentModels, eq(equipmentModels.id, exercises.equipmentModelId))
    .where(and(eq(exercises.userId, userId), eq(exercises.isActive, true)))
    .orderBy(exercises.name)
}

export async function gymWithEquipment(userId: string, gymId: string) {
  const [gym] = await db
    .select()
    .from(gyms)
    .where(and(eq(gyms.id, gymId), eq(gyms.userId, userId)))
  if (!gym) return null

  const equipment = await db
    .select({
      link: gymEquipment,
      model: MODEL_COLUMNS,
      exercises: sql<number>`(
        select count(*)::int from ${exercises}
        where ${exercises.equipmentModelId} = ${equipmentModels.id} and ${exercises.isActive}
      )`,
    })
    .from(gymEquipment)
    .innerJoin(equipmentModels, eq(equipmentModels.id, gymEquipment.equipmentModelId))
    .where(and(eq(gymEquipment.gymId, gymId), eq(gymEquipment.isActive, true)))
    .orderBy(equipmentModels.name)

  const linkedIds = new Set(equipment.map((e) => e.model.id))
  const others = (
    await db
      .select({
        id: equipmentModels.id,
        name: equipmentModels.name,
        kind: equipmentModels.kind,
        notes: equipmentModels.notes,
        updatedAt: equipmentModels.updatedAt,
        hasPhoto: sql<boolean>`${equipmentModels.photo} is not null`,
      })
      .from(equipmentModels)
      .where(eq(equipmentModels.userId, userId))
      .orderBy(equipmentModels.name)
  ).filter((m) => !linkedIds.has(m.id))

  return { gym, equipment, others }
}

export async function equipmentCard(userId: string, modelId: string) {
  const [model] = await db
    .select(MODEL_COLUMNS)
    .from(equipmentModels)
    .where(and(eq(equipmentModels.id, modelId), eq(equipmentModels.userId, userId)))
  if (!model) return null

  const [inGyms, onIt, setups] = await Promise.all([
    db
      .select({ id: gyms.id, name: gyms.name, linkId: gymEquipment.id })
      .from(gymEquipment)
      .innerJoin(gyms, eq(gyms.id, gymEquipment.gymId))
      .where(and(eq(gymEquipment.equipmentModelId, modelId), eq(gymEquipment.isActive, true)))
      .orderBy(gyms.name),
    db
      .select({
        id: exercises.id,
        name: exercises.name,
        patternCode: exercises.patternCode,
        targetReps: exercises.targetReps,
      })
      .from(exercises)
      .where(and(eq(exercises.equipmentModelId, modelId), eq(exercises.isActive, true)))
      .orderBy(exercises.name),
    db
      .select()
      .from(equipmentSetups)
      .where(
        and(eq(equipmentSetups.userId, userId), eq(equipmentSetups.equipmentModelId, modelId)),
      ),
  ])

  // Настройка на модель вообще; переопределения на конкретный зал — отдельно.
  const setup = setups.find((s) => s.gymEquipmentId == null) ?? null
  return { model, inGyms, exercises: onIt, setup }
}
