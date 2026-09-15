'use server'

import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/db'
import { exercises, templateItems, templates } from '@/db/schema'
import { leadKgFromInput } from './parse'

async function requireUser() {
  const session = await auth()
  const id = session?.user?.id
  if (!id) redirect('/signin')
  return id
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim()

async function ownedTemplate(userId: string, templateId: string) {
  const [row] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.userId, userId)))
  if (!row) throw new Error('План не найден')
  return row
}

async function ownedItem(userId: string, itemId: string) {
  const [row] = await db
    .select({ item: templateItems, template: templates })
    .from(templateItems)
    .innerJoin(templates, eq(templates.id, templateItems.templateId))
    .where(and(eq(templateItems.id, itemId), eq(templates.userId, userId)))
  if (!row) throw new Error('Пункт не найден')
  return row
}

export async function createTemplate(formData: FormData) {
  const userId = await requireUser()
  const name = str(formData, 'name')
  if (!name) throw new Error('Нужно название плана')

  const [tpl] = await db.insert(templates).values({ userId, name }).returning()
  redirect(`/templates/${tpl.id}`)
}

export async function renameTemplate(formData: FormData) {
  const userId = await requireUser()
  const id = str(formData, 'templateId')
  const name = str(formData, 'name')
  if (!name) throw new Error('Нужно название плана')

  await ownedTemplate(userId, id)
  await db.update(templates).set({ name }).where(eq(templates.id, id))
  revalidatePath(`/templates/${id}`)
}

export async function archiveTemplate(formData: FormData) {
  const userId = await requireUser()
  const id = str(formData, 'templateId')
  await ownedTemplate(userId, id)
  await db.update(templates).set({ isActive: false }).where(eq(templates.id, id))
  redirect('/templates')
}

/**
 * Разбор полей пункта.
 *
 * Пустая подводка — это «её нет», а не ошибка: большинству упражнений
 * она не нужна.
 */
function itemFieldsFrom(formData: FormData) {
  // Целевых повторов здесь нет: это свойство упражнения, а не плана.
  const { values, error } = leadKgFromInput(str(formData, 'rampWeights'))
  if (error) throw new Error(error)

  return {
    sets: Number(str(formData, 'sets')) || 3,
    leadKg: values,
    note: str(formData, 'note') || null,
  }
}

export async function addTemplateItem(formData: FormData) {
  const userId = await requireUser()
  const templateId = str(formData, 'templateId')
  const exerciseId = str(formData, 'exerciseId')
  if (!exerciseId) throw new Error('Не выбрано упражнение')

  await ownedTemplate(userId, templateId)

  const [exercise] = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), eq(exercises.userId, userId)))
  if (!exercise) throw new Error('Упражнение не найдено')

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${templateItems.position}), -1)` })
    .from(templateItems)
    .where(eq(templateItems.templateId, templateId))

  await db.insert(templateItems).values({
    templateId,
    position: max + 1,
    exerciseId: exercise.id,
    ...itemFieldsFrom(formData),
  })
  revalidatePath(`/templates/${templateId}`)
}

export async function updateTemplateItem(formData: FormData) {
  const userId = await requireUser()
  const itemId = str(formData, 'itemId')
  const { item } = await ownedItem(userId, itemId)

  const exerciseId = str(formData, 'exerciseId')
  const patch: Record<string, unknown> = itemFieldsFrom(formData)

  if (exerciseId && exerciseId !== item.exerciseId) {
    const [exercise] = await db
      .select()
      .from(exercises)
      .where(and(eq(exercises.id, exerciseId), eq(exercises.userId, userId)))
    if (!exercise) throw new Error('Упражнение не найдено')
    patch.exerciseId = exercise.id
  }

  await db.update(templateItems).set(patch).where(eq(templateItems.id, itemId))
  revalidatePath(`/templates/${item.templateId}`)
}

export async function removeTemplateItem(formData: FormData) {
  const userId = await requireUser()
  const itemId = str(formData, 'itemId')
  const { item } = await ownedItem(userId, itemId)
  await db.delete(templateItems).where(eq(templateItems.id, itemId))
  revalidatePath(`/templates/${item.templateId}`)
}

/** Меняет пункт местами с соседом. Позиции внутри плана не обязаны быть плотными. */
export async function moveTemplateItem(formData: FormData) {
  const userId = await requireUser()
  const itemId = str(formData, 'itemId')
  const direction = str(formData, 'direction') === 'up' ? -1 : 1
  const { item } = await ownedItem(userId, itemId)

  const siblings = await db
    .select()
    .from(templateItems)
    .where(eq(templateItems.templateId, item.templateId))
    .orderBy(templateItems.position)

  const index = siblings.findIndex((s) => s.id === itemId)
  const neighbour = siblings[index + direction]
  if (!neighbour) return

  await db
    .update(templateItems)
    .set({ position: neighbour.position })
    .where(eq(templateItems.id, item.id))
  await db
    .update(templateItems)
    .set({ position: item.position })
    .where(eq(templateItems.id, neighbour.id))

  revalidatePath(`/templates/${item.templateId}`)
}
