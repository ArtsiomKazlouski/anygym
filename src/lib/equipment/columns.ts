import { sql } from 'drizzle-orm'
import { equipmentModels } from '@/db/schema'

/**
 * Колонки модели оборудования без байтов фото.
 *
 * `select()` тянет таблицу целиком, а фото лежит в bytea прямо в ней: каждый
 * рендер тренировки волочил бы за собой картинки всех железок. Наличие фото
 * отдаётся флагом, сами байты — отдельным маршрутом.
 */
export const MODEL_COLUMNS = {
  id: equipmentModels.id,
  userId: equipmentModels.userId,
  name: equipmentModels.name,
  brand: equipmentModels.brand,
  kind: equipmentModels.kind,
  units: equipmentModels.units,
  step: equipmentModels.step,
  rampStep: equipmentModels.rampStep,
  minWeight: equipmentModels.minWeight,
  maxWeight: equipmentModels.maxWeight,
  ladder: equipmentModels.ladder,
  barWeight: equipmentModels.barWeight,
  notes: equipmentModels.notes,
  createdAt: equipmentModels.createdAt,
  updatedAt: equipmentModels.updatedAt,
  hasPhoto: sql<boolean>`${equipmentModels.photo} is not null`,
} as const

export type ModelCard = {
  [K in keyof typeof MODEL_COLUMNS]: K extends 'hasPhoto'
    ? boolean
    : (typeof equipmentModels.$inferSelect)[Exclude<K, 'hasPhoto'>]
}

/** Адрес фото с версией: меняется вместе с updatedAt, поэтому кэш не залипает. */
export function photoUrl(model: { id: string; updatedAt: Date }): string {
  return `/equipment/${model.id}/photo?v=${model.updatedAt.getTime()}`
}
