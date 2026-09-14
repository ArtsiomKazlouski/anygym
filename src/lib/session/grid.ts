import type { WeightGrid } from '@/lib/engine'
import type { equipmentModels, gymEquipment } from '@/db/schema'

type Model = typeof equipmentModels.$inferSelect
type Instance = typeof gymEquipment.$inferSelect

/**
 * Сетка весов для конкретной железки в конкретном зале.
 *
 * Модель задаёт значения по умолчанию, экземпляр в зале их переопределяет:
 * один и тот же модельный ряд бывает со стеком в фунтах, а гантельный ряд
 * у каждого зала свой.
 */
export function resolveGrid(model: Model, instance?: Instance | null): WeightGrid {
  return {
    units: instance?.unitsOverride ?? model.units,
    step: instance?.stepOverride ?? model.step,
    min: instance?.minOverride ?? model.minWeight,
    max: instance?.maxOverride ?? model.maxWeight,
    ladder: instance?.ladderOverride ?? model.ladder,
    barWeight: model.barWeight,
  }
}
