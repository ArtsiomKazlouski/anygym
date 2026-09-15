import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { leadKgFromInput, leadKgToInput, parseNumbers, rangeFromTarget } from './parse.ts'

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

describe('подводка в килограммах', () => {
  it('хранит ровно те числа, что ввели', () => {
    assert.deepEqual(leadKgFromInput('60, 80').values, [60, 80])
  })

  it('туда и обратно сходится без искажений', () => {
    const { values } = leadKgFromInput('20, 60, 80')
    assert.equal(leadKgToInput(values), '20, 60, 80')
  })

  it('пустое поле — подводки нет, а не ошибка', () => {
    assert.deepEqual(leadKgFromInput('  '), { values: null })
  })

  it('требует возрастания', () => {
    assert.ok(leadKgFromInput('60, 80, 70').error)
  })

  it('дробные ступени разбирает: гантели бывают по 2.5', () => {
    assert.deepEqual(leadKgFromInput('12.5, 17.5').values, [12.5, 17.5])
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
