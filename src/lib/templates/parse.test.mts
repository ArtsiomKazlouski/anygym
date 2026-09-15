import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  parseNumbers,
  rampPercentsFromWeights,
  rampWeightsFromPercents,
  rangeFromTarget,
} from './parse.ts'

describe('разбор списка чисел', () => {
  it('понимает запятые и пробелы', () => {
    assert.deepEqual(parseNumbers('12, 12 10  10').values, [12, 12, 10, 10])
  })

  it('пустая строка — пусто, а не ошибка', () => {
    assert.deepEqual(parseNumbers('   '), { values: [] })
  })

  it('называет то, что не разобрал', () => {
    assert.ok(parseNumbers('12, ой').error?.includes('ой'))
  })
})

describe('ступени рампы из килограммов', () => {
  it('переводит реальный жим в доли, рабочий вес не считая подводкой', () => {
    const { percents } = rampPercentsFromWeights('20, 40, 60, 80, 90')
    assert.deepEqual(percents, [0.222, 0.444, 0.667, 0.889])
  })

  it('все ступени строго легче рабочего веса', () => {
    const { percents } = rampPercentsFromWeights('22, 26, 32, 36')
    assert.ok(percents?.every((p) => p < 1))
    assert.equal(percents?.length, 3, 'последнее число — рабочий вес, а не ступень')
  })

  it('одно число означает, что подводки нет', () => {
    assert.equal(rampPercentsFromWeights('90').percents, null)
  })

  it('требует возрастания', () => {
    assert.ok(rampPercentsFromWeights('60, 80, 70').error)
  })

  it('туда и обратно сходится', () => {
    const { percents } = rampPercentsFromWeights('20, 60, 80, 90, 100')
    assert.equal(rampWeightsFromPercents(percents, 100), '20, 60, 80, 90, 100')
  })

  it('пересчитывает под новый верх', () => {
    const { percents } = rampPercentsFromWeights('20, 60, 80, 90, 100')
    assert.equal(rampWeightsFromPercents(percents, 110), '22, 66, 88, 99, 110')
  })
})

describe('диапазон из целевых повторов', () => {
  it('цель становится верхом диапазона', () => {
    assert.deepEqual(rangeFromTarget(15), { repMin: 13, repMax: 15 })
  })

  it('на низких повторах не уходит в ноль', () => {
    assert.deepEqual(rangeFromTarget(2), { repMin: 1, repMax: 2 })
    assert.deepEqual(rangeFromTarget(1), { repMin: 1, repMax: 1 })
  })

  it('жим на шесть даёт осмысленный запас', () => {
    assert.deepEqual(rangeFromTarget(6), { repMin: 4, repMax: 6 })
  })
})
