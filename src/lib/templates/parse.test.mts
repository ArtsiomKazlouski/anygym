import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseNumbers, rampPercentsFromWeights, rampWeightsFromPercents } from './parse.ts'

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
  it('переводит реальный жим в доли', () => {
    const { percents } = rampPercentsFromWeights('20, 60, 80, 90, 100')
    assert.deepEqual(percents, [0.2, 0.6, 0.8, 0.9, 1])
  })

  it('верхняя ступень всегда единица', () => {
    const { percents } = rampPercentsFromWeights('22, 26, 32, 36')
    assert.equal(percents?.at(-1), 1)
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
