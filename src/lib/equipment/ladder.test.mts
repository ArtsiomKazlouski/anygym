import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatLadder, parseLadder } from './ladder.ts'

describe('разбор ряда весов', () => {
  it('понимает реальный ряд CityFit', () => {
    const { values } = parseLadder('1-10 через 1, 12-40 через 2')
    assert.equal(values.length, 25)
    assert.equal(values[0], 1)
    assert.equal(values[9], 10)
    assert.equal(values[10], 12)
    assert.equal(values.at(-1), 40)
  })

  it('принимает разные способы записать шаг', () => {
    const a = parseLadder('2-10 через 2').values
    assert.deepEqual(parseLadder('2-10 шаг 2').values, a)
    assert.deepEqual(parseLadder('2-10/2').values, a)
    assert.deepEqual(parseLadder('2–10 через 2').values, a, 'длинное тире тоже')
  })

  it('принимает перечисление', () => {
    assert.deepEqual(parseLadder('5, 10, 15').values, [5, 10, 15])
  })

  it('сортирует и убирает повторы', () => {
    assert.deepEqual(parseLadder('10, 5, 10, 1').values, [1, 5, 10])
  })

  it('пустая строка — пустой ряд, а не ошибка', () => {
    assert.deepEqual(parseLadder('  '), { values: [] })
  })

  it('объясняет, что именно не разобрал', () => {
    const r = parseLadder('1-10, абра')
    assert.ok(r.error?.includes('абра'))
    assert.deepEqual(r.values, [])
  })

  it('не даёт построить бесконечный ряд', () => {
    assert.ok(parseLadder('1-100000 через 0.1').error)
    assert.ok(parseLadder('1-10 через 0').error)
    assert.ok(parseLadder('10-1 через 1').error)
  })
})

describe('сборка короткой записи', () => {
  it('сворачивает ряд обратно', () => {
    const { values } = parseLadder('1-10 через 1, 12-40 через 2')
    assert.equal(formatLadder(values), '1-10, 12-40 через 2')
  })

  it('разбор и сборка сходятся', () => {
    for (const spec of ['1-10, 12-40 через 2', '5-100 через 5', '2, 7, 19']) {
      const first = parseLadder(spec).values
      const second = parseLadder(formatLadder(first)).values
      assert.deepEqual(second, first, spec)
    }
  })

  it('короткие куски не сворачивает — так длиннее', () => {
    assert.equal(formatLadder([12, 14]), '12, 14')
  })

  it('пустой ряд даёт пустую строку', () => {
    assert.equal(formatLadder([]), '')
    assert.equal(formatLadder(null), '')
  })
})
