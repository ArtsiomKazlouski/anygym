import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { equipmentModels, exercises, templateItems, templates } from '@/db/schema'

export async function templatesWithCounts(userId: string) {
  return db
    .select({
      id: templates.id,
      name: templates.name,
      items: sql<number>`count(${templateItems.id})::int`,
    })
    .from(templates)
    .leftJoin(templateItems, eq(templateItems.templateId, templates.id))
    .where(and(eq(templates.userId, userId), eq(templates.isActive, true)))
    .groupBy(templates.id)
    .orderBy(templates.name)
}

export async function templateWithItems(userId: string, templateId: string) {
  const [template] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.userId, userId)))
  if (!template) return null

  const items = await db
    .select({
      item: templateItems,
      exerciseName: exercises.name,
      targetReps: exercises.targetReps,
    })
    .from(templateItems)
    .leftJoin(exercises, eq(exercises.id, templateItems.preferredExerciseId))
    .where(eq(templateItems.templateId, templateId))
    .orderBy(templateItems.position)

  const catalog = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      patternCode: exercises.patternCode,
      targetReps: exercises.targetReps,
      modelName: equipmentModels.name,
    })
    .from(exercises)
    .innerJoin(equipmentModels, eq(equipmentModels.id, exercises.equipmentModelId))
    .where(and(eq(exercises.userId, userId), eq(exercises.isActive, true)))
    .orderBy(exercises.name)

  return { template, items, catalog }
}
