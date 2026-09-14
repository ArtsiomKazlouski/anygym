'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/db'
import { equipmentModels, equipmentSetups, exercises, gymEquipment, gyms } from '@/db/schema'
import { parseLadder } from './ladder'

async function requireUser() {
  const session = await auth()
  const id = session?.user?.id
  if (!id) redirect('/signin')
  return id
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim()

/** Пустое поле — это «не знаю», а не ноль: движок отличает одно от другого. */
function num(f: FormData, k: string): number | null {
  const raw = str(f, k).replace(',', '.')
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) throw new Error(`Не число в поле «${k}»: ${raw}`)
  return n
}

export async function createGym(formData: FormData) {
  const userId = await requireUser()
  const name = str(formData, 'name')
  if (!name) throw new Error('Нужно название зала')

  const [gym] = await db
    .insert(gyms)
    .values({ userId, name, note: str(formData, 'note') || null })
    .returning()
  redirect(`/gyms/${gym.id}`)
}

export async function renameGym(formData: FormData) {
  const userId = await requireUser()
  const id = str(formData, 'gymId')
  const name = str(formData, 'name')
  if (!name) throw new Error('Нужно название зала')

  await db
    .update(gyms)
    .set({ name, note: str(formData, 'note') || null })
    .where(and(eq(gyms.id, id), eq(gyms.userId, userId)))
  revalidatePath(`/gyms/${id}`)
}

/** Сетка весов из формы. Ряд задаётся короткой записью: «1-10, 12-40 через 2». */
function gridFrom(formData: FormData) {
  const spec = str(formData, 'ladder')
  const { values, error } = parseLadder(spec)
  if (error) throw new Error(error)

  return {
    kind: str(formData, 'kind') as
      'stack' | 'plate_loaded' | 'dumbbell' | 'barbell' | 'cable' | 'bodyweight',
    units: (str(formData, 'units') || 'kg') as 'kg' | 'lb',
    step: num(formData, 'step'),
    rampStep: num(formData, 'rampStep'),
    minWeight: num(formData, 'minWeight'),
    maxWeight: num(formData, 'maxWeight'),
    barWeight: num(formData, 'barWeight'),
    ladder: values.length > 0 ? values : null,
    notes: str(formData, 'notes') || null,
  }
}

export async function createEquipment(formData: FormData) {
  const userId = await requireUser()
  const gymId = str(formData, 'gymId')
  const name = str(formData, 'name')
  if (!name) throw new Error('Нужно название тренажёра')

  const [model] = await db
    .insert(equipmentModels)
    .values({ userId, name, ...gridFrom(formData) })
    .returning()

  if (gymId) {
    await db.insert(gymEquipment).values({ gymId, equipmentModelId: model.id })
  }
  revalidatePath(`/gyms/${gymId}`)
  redirect(`/equipment/${model.id}`)
}

export async function updateEquipment(formData: FormData) {
  const userId = await requireUser()
  const id = str(formData, 'modelId')
  const name = str(formData, 'name')
  if (!name) throw new Error('Нужно название тренажёра')

  await db
    .update(equipmentModels)
    .set({ name, ...gridFrom(formData), updatedAt: new Date() })
    .where(and(eq(equipmentModels.id, id), eq(equipmentModels.userId, userId)))
  revalidatePath(`/equipment/${id}`)
}

export async function linkEquipment(formData: FormData) {
  await requireUser()
  const gymId = str(formData, 'gymId')
  const equipmentModelId = str(formData, 'equipmentModelId')
  if (!equipmentModelId) throw new Error('Не выбран тренажёр')

  const [existing] = await db
    .select()
    .from(gymEquipment)
    .where(
      and(eq(gymEquipment.gymId, gymId), eq(gymEquipment.equipmentModelId, equipmentModelId)),
    )

  if (existing) {
    await db
      .update(gymEquipment)
      .set({ isActive: true })
      .where(eq(gymEquipment.id, existing.id))
  } else {
    await db.insert(gymEquipment).values({ gymId, equipmentModelId })
  }
  revalidatePath(`/gyms/${gymId}`)
}

/**
 * Убирает железку из зала, не удаляя модель: история подходов висит на
 * упражнении и модели, и терять её из-за того, что тренажёр вынесли,
 * нельзя — в другом зале такой же может стоять.
 */
export async function unlinkEquipment(formData: FormData) {
  await requireUser()
  const linkId = str(formData, 'linkId')
  const gymId = str(formData, 'gymId')
  await db.update(gymEquipment).set({ isActive: false }).where(eq(gymEquipment.id, linkId))
  revalidatePath(`/gyms/${gymId}`)
}

/** Запомненные настройки: сиденье, спинка, хват. Пустые поля не сохраняются. */
export async function saveSetup(formData: FormData) {
  const userId = await requireUser()
  const equipmentModelId = str(formData, 'modelId')

  const settings: Record<string, string> = {}
  for (const key of ['сиденье', 'спинка', 'хват', 'упор'] as const) {
    const value = str(formData, key)
    if (value) settings[key] = value
  }
  const note = str(formData, 'note') || null

  const [existing] = await db
    .select()
    .from(equipmentSetups)
    .where(
      and(
        eq(equipmentSetups.userId, userId),
        eq(equipmentSetups.equipmentModelId, equipmentModelId),
      ),
    )

  if (existing) {
    await db
      .update(equipmentSetups)
      .set({ settings, note, updatedAt: new Date() })
      .where(eq(equipmentSetups.id, existing.id))
  } else {
    await db.insert(equipmentSetups).values({ userId, equipmentModelId, settings, note })
  }
  revalidatePath(`/equipment/${equipmentModelId}`)
}

export async function createExerciseOn(formData: FormData) {
  const userId = await requireUser()
  const equipmentModelId = str(formData, 'modelId')
  const name = str(formData, 'name')
  const patternCode = str(formData, 'patternCode')
  if (!name || !patternCode) throw new Error('Нужны название и движение')

  await db.insert(exercises).values({
    userId,
    name,
    patternCode,
    equipmentModelId,
    targetReps: Math.round(num(formData, 'targetReps') ?? 12),
    declaredWorkingKg: num(formData, 'declaredWorkingKg'),
  })
  revalidatePath(`/equipment/${equipmentModelId}`)
}

export async function updateExercise(formData: FormData) {
  const userId = await requireUser()
  const id = str(formData, 'exerciseId')
  const modelId = str(formData, 'modelId')
  const name = str(formData, 'name')
  const patternCode = str(formData, 'patternCode')
  const targetReps = num(formData, 'targetReps')

  if (!name || !patternCode) throw new Error('Нужны название и движение')
  if (targetReps == null || targetReps < 1) throw new Error('Нужны целевые повторы')

  await db
    .update(exercises)
    .set({
      name,
      patternCode,
      targetReps: Math.round(targetReps),
      declaredWorkingKg: num(formData, 'declaredWorkingKg'),
    })
    .where(and(eq(exercises.id, id), eq(exercises.userId, userId)))
  revalidatePath(`/equipment/${modelId}`)
}

export async function archiveExercise(formData: FormData) {
  const userId = await requireUser()
  const id = str(formData, 'exerciseId')
  const modelId = str(formData, 'modelId')
  await db
    .update(exercises)
    .set({ isActive: false })
    .where(and(eq(exercises.id, id), eq(exercises.userId, userId)))
  revalidatePath(`/equipment/${modelId}`)
}
