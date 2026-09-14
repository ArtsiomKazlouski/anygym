import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  baseFromLastSession,
  deloadFactor,
  interSessionDelta,
  nextSet,
  prescribe,
  type LoggedSet,
} from './prescribe.ts'
import { snapKg, stepKg, type WeightGrid } from './weights.ts'

/** Грузоблок: равномерный шаг от минимума. */
const stack = (step: number, min = step, max = 200): WeightGrid => ({
  units: 'kg',
  step,
  min,
  max,
})

/** Гантельный ряд: шаг неравномерный, поэтому задан явно. */
const dumbbells: WeightGrid = {
  units: 'kg',
  ladder: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 34, 38, 42],
}

const sets = (...s: [number, number, LoggedSet['feedback']][]): LoggedSet[] =>
  s.map(([weightKg, reps, feedback]) => ({ weightKg, reps, feedback }))

describe('дискретизация', () => {
  it('никогда не называет вес вне сетки', () => {
    const g = stack(5)
    for (const target of [1, 7.3, 33.4, 47.5, 96.1, 500]) {
      for (const dir of ['down', 'up', 'nearest'] as const) {
        const w = snapKg(target, g, dir).weight
        assert.equal(w % 5, 0, `${target} ${dir} -> ${w}`)
        assert.ok(w >= 5 && w <= 200)
      }
    }
  })

  it('идёт по ряду гантелей, а не прибавляет шаг', () => {
    // В ряду после 30 идёт 34: равномерная прибавка дала бы несуществующие 32.
    assert.equal(stepKg(30, dumbbells, 1).weight, 34)
    assert.equal(stepKg(34, dumbbells, -1).weight, 30)
    assert.equal(stepKg(42, dumbbells, 1).weight, 42, 'выше ряда не поднимаемся')
    assert.equal(stepKg(2, dumbbells, -1).weight, 2, 'ниже ряда не опускаемся')
  })

  it('считает фунтовый стек в килограммах', () => {
    const lbStack: WeightGrid = { units: 'lb', step: 10, min: 20, max: 300 }
    const w = snapKg(45, lbStack, 'nearest')
    assert.equal(w.units, 'lb')
    assert.equal(w.weight % 10, 0)
    assert.ok(Math.abs(w.weightKg - 45) < 2.3, `${w.weight} lb = ${w.weightKg} kg`)
  })

  it('отсчитывает штангу от грифа', () => {
    const barbell: WeightGrid = { units: 'kg', step: 2.5, barWeight: 20, max: 200 }
    assert.equal(snapKg(20, barbell, 'nearest').weight, 20, 'пустой гриф достижим')
    assert.equal(snapKg(61, barbell, 'nearest').weight, 60)
    assert.equal(snapKg(10, barbell, 'down').weight, 20, 'легче грифа не бывает')
  })
})

describe('межсессионная прогрессия', () => {
  it('растит, когда закрыт верх диапазона без надрыва', () => {
    assert.equal(
      interSessionDelta(
        sets([50, 12, 'easy'], [50, 12, 'on_target'], [50, 12, 'on_target']),
        12,
      ),
      1,
    )
  })

  it('не растит, если хоть один подход был на пределе', () => {
    assert.equal(interSessionDelta(sets([50, 12, 'on_target'], [50, 12, 'limit']), 12), 0)
  })

  it('снижает, когда провалена половина подходов', () => {
    assert.equal(interSessionDelta(sets([50, 6, 'failed'], [50, 8, 'on_target']), 12), -1)
  })

  it('переносит рост, случившийся внутри сессии', () => {
    // 50 -> 55 по фидбеку 'легко'; финальный провал не должен опускать базу дважды.
    assert.equal(baseFromLastSession(sets([50, 12, 'easy'], [55, 9, 'on_target'])), 55)
    assert.equal(baseFromLastSession(sets([50, 12, 'easy'], [55, 4, 'failed'])), 50)
  })
})

describe('откат за паузу', () => {
  it('следует таблице из DESIGN.md', () => {
    assert.equal(deloadFactor(4).factor, 1)
    assert.equal(deloadFactor(10).factor, 1)
    assert.equal(deloadFactor(14).factor, 0.95)
    assert.equal(deloadFactor(30).factor, 0.9)
    assert.equal(deloadFactor(60).factor, 0.85)
    assert.equal(deloadFactor(120).reset, true)
  })

  it('не трогает второе упражнение на ту же группу в один день', () => {
    assert.equal(deloadFactor(0).factor, 1)
  })
})

describe('примеры из DESIGN.md, раздел 6', () => {
  it('1. знакомая железка, штатный рост', () => {
    const p = prescribe({
      grid: stack(5),
      repMin: 8,
      repMax: 12,
      lastSessionSets: sets([50, 12, 'easy'], [50, 12, 'on_target'], [50, 12, 'on_target']),
      daysSincePattern: 4,
      painRecent: false,
      firstForMuscleGroup: true,
    })
    assert.equal(p.source, 'history')
    assert.equal(p.working?.weight, 55)
    assert.equal(p.warmup?.weight, 30)
  })

  it('2. незнакомая модель — разведка от соседнего тренажёра', () => {
    const p = prescribe({
      grid: stack(5),
      repMin: 8,
      repMax: 12,
      lastSessionSets: [],
      daysSincePattern: 3,
      painRecent: false,
      probeBaseKg: 60,
      firstForMuscleGroup: false,
    })
    assert.equal(p.source, 'probe')
    assert.equal(p.working?.weight, 35)
    assert.ok(p.warmup, 'на незнакомой железке разминка предлагается всегда')
  })

  it('3. пауза 30 дней: −10%, и возврат к прежнему весу на фидбеке «легко»', () => {
    const grid = stack(10, 10)
    const p = prescribe({
      grid,
      repMin: 8,
      repMax: 12,
      lastSessionSets: sets([120, 10, 'on_target'], [120, 10, 'on_target']),
      daysSincePattern: 30,
      painRecent: false,
      firstForMuscleGroup: true,
    })
    assert.equal(p.source, 'deload')
    assert.equal(p.working?.weight, 110)
    assert.equal(p.preDeloadKg, 120)

    const after = nextSet({
      currentKg: p.working!.weightKg,
      feedback: 'easy',
      grid,
      preDeloadKg: p.preDeloadKg,
    })
    assert.equal(after.action, 'continue')
    assert.equal(after.weight.weight, 120, 'возврат к 120, а не 110 + ступень')
  })

  it('4. боль: снижение и заморозка роста', () => {
    const p = prescribe({
      grid: stack(5),
      repMin: 8,
      repMax: 12,
      lastSessionSets: sets([40, 10, 'on_target'], [40, 10, 'on_target']),
      daysSincePattern: 7,
      painRecent: true,
      firstForMuscleGroup: false,
    })
    assert.equal(p.source, 'pain_backoff')
    assert.equal(p.working?.weight, 35)
  })
})

describe('авторегуляция внутри упражнения', () => {
  const grid = stack(5)

  it('«легко» добавляет ступень', () => {
    assert.equal(nextSet({ currentKg: 50, feedback: 'easy', grid }).weight.weight, 55)
  })

  it('«в точку» держит вес', () => {
    assert.equal(nextSet({ currentKg: 50, feedback: 'on_target', grid }).weight.weight, 50)
  })

  it('«на пределе» держит вес и предупреждает', () => {
    const r = nextSet({ currentKg: 50, feedback: 'limit', grid })
    assert.equal(r.weight.weight, 50)
    assert.ok(r.note)
  })

  it('«не добил» снимает ступень', () => {
    assert.equal(nextSet({ currentKg: 50, feedback: 'failed', grid }).weight.weight, 45)
  })

  it('боль останавливает упражнение', () => {
    const r = nextSet({ currentKg: 50, feedback: 'on_target', grid, pain: true })
    assert.equal(r.action, 'stop_or_reduce')
    assert.equal(r.weight.weight, 40, 'минус две ступени')
  })
})

describe('граничные случаи', () => {
  it('без истории и без базы для разведки просит ввести вес руками', () => {
    const p = prescribe({
      grid: stack(5),
      repMin: 8,
      repMax: 12,
      lastSessionSets: [],
      daysSincePattern: null,
      painRecent: false,
      firstForMuscleGroup: true,
    })
    assert.equal(p.source, 'manual')
    assert.equal(p.working, null)
  })

  it('перерыв больше 90 дней сбрасывает историю в разведку', () => {
    const p = prescribe({
      grid: stack(5),
      repMin: 8,
      repMax: 12,
      lastSessionSets: sets([80, 10, 'on_target']),
      daysSincePattern: 200,
      painRecent: false,
      probeBaseKg: 80,
      firstForMuscleGroup: true,
    })
    assert.equal(p.source, 'probe')
    assert.equal(p.working?.weight, 50, '80 * 0.6 = 48 -> ближайшая ступень 50')
  })

  it('на грубой сетке маленький откат не выражается и вес остаётся прежним', () => {
    // Шаг 20 кг при рабочих 100: −5% это 95, а на сетке есть только 80 и 100.
    // Округлить вниз значило бы срезать 20% вместо 5%. Честнее оставить 100:
    // один подход с фидбеком «легко» и так вернул бы вес обратно.
    const p = prescribe({
      grid: stack(20, 20),
      repMin: 8,
      repMax: 12,
      lastSessionSets: sets([100, 10, 'on_target']),
      daysSincePattern: 14,
      painRecent: false,
      firstForMuscleGroup: false,
    })
    assert.equal(p.working?.weight, 100)
  })

  it('на той же сетке крупный откат срабатывает', () => {
    // 60 дней это −15%, то есть 15 кг — больше половины шага, сетка это выражает.
    const p = prescribe({
      grid: stack(20, 20),
      repMin: 8,
      repMax: 12,
      lastSessionSets: sets([100, 10, 'on_target']),
      daysSincePattern: 60,
      painRecent: false,
      firstForMuscleGroup: false,
    })
    assert.equal(p.working?.weight, 80)
  })

  it('инвариант: откат никогда не поднимает вес выше прежнего рабочего', () => {
    for (const step of [2.5, 5, 10, 20]) {
      for (const base of [20, 47.5, 60, 100, 140]) {
        for (const days of [12, 25, 50, 89]) {
          const grid = stack(step, step)
          const start = snapKg(base, grid, 'nearest').weightKg
          const p = prescribe({
            grid,
            repMin: 8,
            repMax: 12,
            lastSessionSets: sets([start, 10, 'on_target']),
            daysSincePattern: days,
            painRecent: false,
            firstForMuscleGroup: false,
          })
          assert.ok(
            p.working!.weightKg <= start + 1e-9,
            `шаг ${step}, вес ${start}, пауза ${days} -> ${p.working!.weight}`,
          )
        }
      }
    }
  })
})
