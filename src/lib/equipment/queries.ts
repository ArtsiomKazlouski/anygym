import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { equipmentModels, equipmentSetups, exercises, gymEquipment, gyms } from '@/db/schema'
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
        declaredWorkingKg: exercises.declaredWorkingKg,
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
