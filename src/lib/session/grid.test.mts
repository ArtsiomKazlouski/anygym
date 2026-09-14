import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { equipmentModels, gymEquipment } from '../../db/schema.ts'
import { snapKg } from '../engine/index.ts'
import { resolveGrid } from './grid.ts'

type Model = typeof equipmentModels.$inferSelect
type Link = typeof gymEquipment.$inferSelect

const model = (over: Partial<Model> = {}) =>
  ({
    units: 'kg',
    step: 5,
    rampStep: null,
    minWeight: 5,
    maxWeight: 100,
    ladder: null,
    barWeight: null,
    ...over,
  }) as Model

const link = (over: Partial<Link> = {}) =>
  ({
    unitsOverride: null,
    stepOverride: null,
    rampStepOverride: null,
    minOverride: null,
    maxOverride: null,
    ladderOverride: null,
    ...over,
  }) as Link

describe('сетка железки в конкретном зале', () => {
  it('без переопределений берёт сетку модели', () => {
    const g = resolveGrid(model(), link())
    assert.equal(g.step, 5)
    assert.equal(g.max, 100)
    assert.equal(g.units, 'kg')
  })

  it('экземпляра нет вовсе — тоже берёт модель', () => {
    assert.equal(resolveGrid(model()).step, 5)
  })

  it('тот же модельный ряд со стеком в фунтах', () => {
    // Единицы меняются вместе с границами: числа модели заданы в её единицах
    // и, оставшись, были бы прочитаны как чужие. Форма это требует.
    const g = resolveGrid(
      model(),
      link({ unitsOverride: 'lb', stepOverride: 10, minOverride: 20, maxOverride: 300 }),
    )
    assert.equal(g.units, 'lb')
    const w = snapKg(45, g, 'nearest')
    assert.equal(w.units, 'lb')
    assert.equal((w.weight - 20) % 10, 0, 'вес обязан лечь на фунтовый стек')
    assert.ok(Math.abs(w.weightKg - 45) < 2.5, `${w.weight} lb = ${w.weightKg} kg`)
  })

  it('у гантельного ряда в другом зале другой верх', () => {
    const ladder = [2, 4, 6, 8, 10]
    const g = resolveGrid(model({ ladder: [2, 4, 6] }), link({ ladderOverride: ladder }))
    assert.deepEqual(g.ladder, ladder)
    assert.equal(snapKg(9, g, 'nearest').weight, 8)
  })

  it('переопределения независимы: одно не тянет за собой остальные', () => {
    const g = resolveGrid(model({ step: 5, rampStep: 10 }), link({ stepOverride: 2.5 }))
    assert.equal(g.step, 2.5, 'шаг переопределён')
    assert.equal(g.rampStep, 10, 'шаг подводящих остался от модели')
    assert.equal(g.max, 100, 'максимум остался от модели')
  })

  it('вес грифа берётся только от модели: гриф ездит вместе с железкой', () => {
    const g = resolveGrid(model({ barWeight: 20 }), link({ minOverride: 25 }))
    assert.equal(g.barWeight, 20)
    assert.equal(g.min, 25)
  })
})
