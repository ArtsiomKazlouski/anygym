import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  baseFromLastSession,
  deloadFactor,
  interSessionDelta,
  nextSet,
  prescribe,
  capRamp,
  isFailed,
  reanchorRamp,
  type LoggedSet,
  type Prescription,
} from './prescribe.ts'
import { gridOptions, snapKg, stepKg, type WeightGrid } from './weights.ts'

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

const workingOf = (p: Prescription) => p.sets.filter((s) => s.role === 'working')
const rampOf = (p: Prescription) => p.sets.filter((s) => s.role === 'ramp')

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
        8,
        12,
      ),
      1,
    )
  })

  it('не растит, пока диапазон не закрыт', () => {
    assert.equal(interSessionDelta(sets([50, 12, 'on_target'], [50, 11, 'limit']), 8, 12), 0)
  })

  it('снижает, когда провалена половина подходов', () => {
    // Провал выводится из повторов: 6 при цели от 8 с ответом «на пределе».
    assert.equal(interSessionDelta(sets([50, 6, 'limit'], [50, 8, 'on_target']), 8, 12), -1)
  })

  it('не считает провалом недобор, если подход был лёгким', () => {
    // Прервался по своим причинам — вес тут ни при чём.
    assert.equal(interSessionDelta(sets([50, 6, 'easy'], [50, 11, 'on_target']), 8, 12), 0)
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
      scheme: 'straight',
      grid: stack(5),
      repMin: 8,
      repMax: 12,
      lastSessionSets: sets([50, 12, 'easy'], [50, 12, 'on_target'], [50, 12, 'on_target']),
      daysSincePattern: 4,
      painRecent: false,
    })
    assert.equal(p.source, 'history')
    assert.equal(p.top?.weight, 55)
  })

  it('2. незнакомая модель — разведка от соседнего тренажёра', () => {
    const p = prescribe({
      scheme: 'straight',
      grid: stack(5),
      repMin: 8,
      repMax: 12,
      lastSessionSets: [],
      daysSincePattern: 3,
      painRecent: false,
      probeBaseKg: 60,
    })
    assert.equal(p.source, 'probe')
    assert.equal(p.top?.weight, 35)
  })

  it('3. пауза 30 дней: −10%, и возврат к прежнему весу на фидбеке «легко»', () => {
    const grid = stack(10, 10)
    const p = prescribe({
      scheme: 'straight',
      grid,
      repMin: 8,
      repMax: 12,
      lastSessionSets: sets([120, 10, 'on_target'], [120, 10, 'on_target']),
      daysSincePattern: 30,
      painRecent: false,
    })
    assert.equal(p.source, 'deload')
    assert.equal(p.top?.weight, 110)
    assert.equal(p.preDeloadKg, 120)

    const after = nextSet({
      currentKg: p.top!.weightKg,
      feedback: 'easy',
      grid,
      preDeloadKg: p.preDeloadKg,
    })
    assert.equal(after.action, 'continue')
    assert.equal(after.weight.weight, 120, 'возврат к 120, а не 110 + ступень')
  })

  it('4. боль: снижение и заморозка роста', () => {
    const p = prescribe({
      scheme: 'straight',
      grid: stack(5),
      repMin: 8,
      repMax: 12,
      lastSessionSets: sets([40, 10, 'on_target'], [40, 10, 'on_target']),
      daysSincePattern: 7,
      painRecent: true,
    })
    assert.equal(p.source, 'pain_backoff')
    assert.equal(p.top?.weight, 35)
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
      scheme: 'straight',
      grid: stack(5),
      repMin: 8,
      repMax: 12,
      lastSessionSets: [],
      daysSincePattern: null,
      painRecent: false,
    })
    assert.equal(p.source, 'manual')
    assert.equal(p.top, null)
  })

  it('перерыв больше 90 дней сбрасывает историю в разведку', () => {
    const p = prescribe({
      scheme: 'straight',
      grid: stack(5),
      repMin: 8,
      repMax: 12,
      lastSessionSets: sets([80, 10, 'on_target']),
      daysSincePattern: 200,
      painRecent: false,
      probeBaseKg: 80,
    })
    assert.equal(p.source, 'probe')
    assert.equal(p.top?.weight, 50, '80 * 0.6 = 48 -> ближайшая ступень 50')
  })

  it('на грубой сетке маленький откат не выражается и вес остаётся прежним', () => {
    // Шаг 20 кг при рабочих 100: −5% это 95, а на сетке есть только 80 и 100.
    // Округлить вниз значило бы срезать 20% вместо 5%. Честнее оставить 100:
    // один подход с фидбеком «легко» и так вернул бы вес обратно.
    const p = prescribe({
      scheme: 'straight',
      grid: stack(20, 20),
      repMin: 8,
      repMax: 12,
      lastSessionSets: sets([100, 10, 'on_target']),
      daysSincePattern: 14,
      painRecent: false,
    })
    assert.equal(p.top?.weight, 100)
  })

  it('на той же сетке крупный откат срабатывает', () => {
    // 60 дней это −15%, то есть 15 кг — больше половины шага, сетка это выражает.
    const p = prescribe({
      scheme: 'straight',
      grid: stack(20, 20),
      repMin: 8,
      repMax: 12,
      lastSessionSets: sets([100, 10, 'on_target']),
      daysSincePattern: 60,
      painRecent: false,
    })
    assert.equal(p.top?.weight, 80)
  })

  it('инвариант: откат никогда не поднимает вес выше прежнего рабочего', () => {
    for (const step of [2.5, 5, 10, 20]) {
      for (const base of [20, 47.5, 60, 100, 140]) {
        for (const days of [12, 25, 50, 89]) {
          const grid = stack(step, step)
          const start = snapKg(base, grid, 'nearest').weightKg
          const p = prescribe({
            scheme: 'straight',
            grid,
            repMin: 8,
            repMax: 12,
            lastSessionSets: sets([start, 10, 'on_target']),
            daysSincePattern: days,
            painRecent: false,
          })
          assert.ok(
            p.top!.weightKg <= start + 1e-9,
            `шаг ${step}, вес ${start}, пауза ${days} -> ${p.top!.weight}`,
          )
        }
      }
    }
  })
})

describe('рампа', () => {
  /** CityFit Westfield: от 1 до 10 через 1, дальше через 2 до 40. */
  const cityfitDumbbells: WeightGrid = {
    units: 'kg',
    ladder: [
      ...Array.from({ length: 10 }, (_, i) => i + 1),
      ...Array.from({ length: 15 }, (_, i) => 12 + i * 2),
    ],
  }

  const olympicBar: WeightGrid = { units: 'kg', step: 2.5, barWeight: 20, max: 200 }

  it('воспроизводит реальный жим лёжа: гриф, 60, 80, 90, 100', () => {
    const p = prescribe({
      scheme: 'ramp',
      grid: olympicBar,
      repMin: 5,
      repMax: 6,
      rampPercents: [0.2, 0.6, 0.8, 0.9, 1],
      // пять повторов при цели шесть: диапазон не закрыт, вес держим
      lastSessionSets: sets([100, 5, 'on_target']),
      daysSincePattern: 7,
      painRecent: false,
    })

    assert.equal(p.top?.weight, 100)
    assert.deepEqual(
      p.sets.map((s) => s.weight.weight),
      [20, 60, 80, 90, 100],
    )
    assert.deepEqual(
      p.sets.map((s) => s.reps[1]),
      [6, 6, 6, 6, 6],
      'цель повторов одна на упражнение: подводящий отличается весом, а не целью',
    )
    assert.equal(workingOf(p).length, 1, 'в рампе рабочий подход один — верхний')
    assert.equal(rampOf(p).length, 4)
    assert.equal(workingOf(p)[0].weight.weight, 100)
  })

  it('воспроизводит жим гантелей 45°: 22, 26, 32, 36', () => {
    const p = prescribe({
      scheme: 'ramp',
      grid: cityfitDumbbells,
      repMin: 10,
      repMax: 12,
      rampPercents: [0.6, 0.72, 0.89, 1],
      lastSessionSets: sets([36, 10, 'on_target']),
      daysSincePattern: 7,
      painRecent: false,
    })

    assert.deepEqual(
      p.sets.map((s) => s.weight.weight),
      [22, 26, 32, 36],
    )
  })

  it('не предлагает гантелей вне ряда зала', () => {
    const p = prescribe({
      scheme: 'ramp',
      grid: cityfitDumbbells,
      repMin: 10,
      repMax: 12,
      rampPercents: [0.55, 0.7, 0.85, 1],
      lastSessionSets: sets([30, 12, 'easy']),
      daysSincePattern: 5,
      painRecent: false,
    })
    for (const s of p.sets) {
      assert.ok(
        cityfitDumbbells.ladder!.includes(s.weight.weight),
        `${s.weight.weight} кг в ряду нет`,
      )
    }
  })

  it('выбрасывает ступени, схлопнувшиеся на грубой сетке', () => {
    const p = prescribe({
      scheme: 'ramp',
      grid: stack(20, 20),
      repMin: 8,
      repMax: 12,
      rampPercents: [0.8, 0.85, 0.9, 1],
      lastSessionSets: sets([100, 10, 'on_target']),
      daysSincePattern: 5,
      painRecent: false,
    })
    const weights = p.sets.map((s) => s.weight.weight)
    assert.deepEqual(weights, [...new Set(weights)], 'повторяющихся ступеней быть не должно')
    assert.equal(weights[weights.length - 1], 100)
  })

  it('проваленный подводящий отменяет верхний подход', () => {
    const p = prescribe({
      scheme: 'ramp',
      grid: olympicBar,
      repMin: 5,
      repMax: 6,
      rampPercents: [0.6, 0.8, 0.9, 1],
      lastSessionSets: sets([100, 5, 'on_target']),
      daysSincePattern: 7,
      painRecent: false,
    })
    const r = capRamp({ sets: p.sets, doneIndex: 1, feedback: 'failed', grid: olympicBar })
    assert.deepEqual(r.remaining, [])
    assert.ok(r.note)
  })

  it('подводящий на пределе срезает верх, но рабочий подход остаётся', () => {
    const p = prescribe({
      scheme: 'ramp',
      grid: olympicBar,
      repMin: 5,
      repMax: 6,
      rampPercents: [0.6, 0.8, 0.9, 1],
      lastSessionSets: sets([100, 5, 'on_target']),
      daysSincePattern: 7,
      painRecent: false,
    })
    // подводящий 80 дался на пределе -> выше 82.5 сегодня не идём
    const r = capRamp({ sets: p.sets, doneIndex: 1, feedback: 'limit', grid: olympicBar })
    const last = r.remaining[r.remaining.length - 1]
    assert.equal(last.role, 'working', 'без рабочего подхода прогрессии не за что зацепиться')
    assert.ok(last.weight.weight <= 82.5, `получили ${last.weight.weight}`)
    assert.ok(r.remaining.every((s) => s.weight.weight <= 82.5))
  })
})

describe('пересчёт рампы под фактический вес', () => {
  const olympicBar: WeightGrid = { units: 'kg', step: 2.5, barWeight: 20, max: 200 }

  const benchPlan = () =>
    prescribe({
      scheme: 'ramp',
      grid: olympicBar,
      repMin: 5,
      repMax: 6,
      rampPercents: [0.2, 0.6, 0.8, 0.9, 1],
      lastSessionSets: sets([100, 5, 'on_target']),
      daysSincePattern: 7,
      painRecent: false,
    }).sets

  it('двигает остаток, когда вес изменён на показательной ступени', () => {
    const plan = benchPlan() // 20, 60, 80, 90, 100
    // вместо 80 поставил 88 -> остаток едет на 10%
    const re = reanchorRamp({ sets: plan, doneIndex: 2, actualKg: 88, grid: olympicBar })
    assert.equal(re.scale, 1.1)
    assert.deepEqual(
      re.sets.map((s) => s.weight.weight),
      [20, 60, 80, 100, 110],
    )
  })

  it('тянет остаток вниз так же, как вверх', () => {
    const plan = benchPlan()
    // вместо 90 поставил 85
    const re = reanchorRamp({ sets: plan, doneIndex: 3, actualKg: 85, grid: olympicBar })
    assert.equal(re.sets[4].weight.weight, 95, 'верх опустился вместе с подводящим')
  })

  it('игнорирует отклонение на разминочной ступени', () => {
    const plan = benchPlan()
    // 20 -> 25 на ступени 0.2: пустой гриф ничего не говорит о верхе
    const re = reanchorRamp({ sets: plan, doneIndex: 0, actualKg: 25, grid: olympicBar })
    assert.equal(re.scale, 1)
    assert.deepEqual(
      re.sets.map((s) => s.weight.weight),
      [20, 60, 80, 90, 100],
    )
  })

  it('ничего не трогает, когда вес совпал с планом', () => {
    const plan = benchPlan()
    const re = reanchorRamp({ sets: plan, doneIndex: 2, actualKg: 80, grid: olympicBar })
    assert.equal(re.scale, 1)
    assert.deepEqual(re.sets, plan)
  })

  it('не двигает уже сделанные подходы', () => {
    const plan = benchPlan()
    const re = reanchorRamp({ sets: plan, doneIndex: 2, actualKg: 88, grid: olympicBar })
    assert.deepEqual(
      re.sets.slice(0, 3).map((s) => s.weight.weight),
      [20, 60, 80],
    )
  })
})

describe('повторы перевешивают кнопку', () => {
  const grid = stack(5)

  it('«в точку» с закрытым верхом диапазона растит вес', () => {
    // Реальный случай: 50 × 15 при цели 10-12, нажато «в точку».
    // Пятнадцать повторов при цели двенадцать — это лёгкий вес, а не «в точку».
    const r = nextSet({ currentKg: 50, feedback: 'on_target', grid, reps: 15, repMax: 12 })
    assert.equal(r.weight.weight, 55)
    assert.ok(r.note)
  })

  it('«в точку» ровно на верхе диапазона тоже растит', () => {
    const r = nextSet({ currentKg: 50, feedback: 'on_target', grid, reps: 12, repMax: 12 })
    assert.equal(r.weight.weight, 55)
  })

  it('«в точку» внутри диапазона держит вес', () => {
    const r = nextSet({ currentKg: 50, feedback: 'on_target', grid, reps: 11, repMax: 12 })
    assert.equal(r.weight.weight, 50)
  })

  it('«на пределе» держит вес даже при закрытом верхе', () => {
    // Запаса не было — значит вес по делу, просто диапазон подобран широко.
    const r = nextSet({ currentKg: 50, feedback: 'limit', grid, reps: 15, repMax: 12 })
    assert.equal(r.weight.weight, 50)
  })

  it('без данных о повторах ведёт себя как раньше', () => {
    const r = nextSet({ currentKg: 50, feedback: 'on_target', grid })
    assert.equal(r.weight.weight, 50)
  })
})

describe('провал выводится из повторов, а не из кнопки', () => {
  const grid = stack(5)

  it('недобор с ответом «на пределе» снимает ступень', () => {
    const r = nextSet({
      currentKg: 50,
      feedback: 'limit',
      grid,
      reps: 7,
      repMin: 10,
      repMax: 12,
    })
    assert.equal(r.weight.weight, 45)
    assert.ok(r.note)
  })

  it('недобор с ответом «легко» вес не трогает вниз', () => {
    // Прервался сам: очередь, время, конец тренировки. Вес тут ни при чём.
    const r = nextSet({
      currentKg: 50,
      feedback: 'easy',
      grid,
      reps: 7,
      repMin: 10,
      repMax: 12,
    })
    assert.equal(r.weight.weight, 55)
  })

  it('недобор с ответом «в точку» тоже снимает ступень', () => {
    const r = nextSet({
      currentKg: 50,
      feedback: 'on_target',
      grid,
      reps: 7,
      repMin: 10,
      repMax: 12,
    })
    assert.equal(r.weight.weight, 45)
  })

  it('старая запись с кнопкой «не добил» по-прежнему читается', () => {
    assert.equal(isFailed({ weightKg: 50, reps: 12, feedback: 'failed' }, 10), true)
  })
})

describe('грубый шаг для подводящих', () => {
  // Штанга: прогрессия по 2.5, подводящие округляются до пятёрки.
  const bar: WeightGrid = { units: 'kg', step: 2.5, rampStep: 5, barWeight: 20, max: 200 }

  const plan = (topKg: number) =>
    prescribe({
      scheme: 'ramp',
      grid: bar,
      repMin: 5,
      repMax: 6,
      rampPercents: [0.2, 0.6, 0.8, 0.9, 1],
      // пять повторов при цели шесть: диапазон не закрыт, верх остаётся
      lastSessionSets: sets([topKg, 5, 'on_target']),
      daysSincePattern: 7,
      painRecent: false,
    })

  it('подводящие идут по пятёркам, верхний сохраняет точность', () => {
    const p = plan(102.5)
    assert.deepEqual(
      p.sets.map((s) => s.weight.weight),
      [20, 60, 80, 90, 102.5],
      'вешать 82.5 ради разминки — возня с блинами по 1.25 на сторону',
    )
  })

  it('прогрессия по-прежнему идёт мелким шагом', () => {
    // Закрыл верх диапазона -> +2.5, а не +5.
    const p = prescribe({
      scheme: 'ramp',
      grid: bar,
      repMin: 5,
      repMax: 6,
      rampPercents: [0.6, 1],
      lastSessionSets: sets([100, 6, 'on_target']),
      daysSincePattern: 7,
      painRecent: false,
    })
    assert.equal(p.top?.weight, 102.5)
  })

  it('без rampStep ведёт себя как раньше', () => {
    const fine: WeightGrid = { units: 'kg', step: 2.5, barWeight: 20, max: 200 }
    const p = prescribe({
      scheme: 'ramp',
      grid: fine,
      repMin: 5,
      repMax: 6,
      rampPercents: [0.6, 0.8, 1],
      lastSessionSets: sets([102.5, 5, 'on_target']),
      daysSincePattern: 7,
      painRecent: false,
    })
    assert.deepEqual(
      p.sets.map((s) => s.weight.weight),
      [62.5, 82.5, 102.5],
    )
  })
})

describe('список достижимых весов', () => {
  it('для гантелей отдаёт ряд как есть', () => {
    const grid: WeightGrid = { units: 'kg', ladder: [2, 4, 6, 8, 10] }
    assert.deepEqual(gridOptions(grid), [2, 4, 6, 8, 10])
  })

  it('для стека перечисляет от минимума до максимума', () => {
    assert.deepEqual(gridOptions(stack(5, 5, 30)), [5, 10, 15, 20, 25, 30])
  })

  it('для штанги начинает с грифа', () => {
    const bar: WeightGrid = { units: 'kg', step: 2.5, barWeight: 20, max: 30 }
    assert.deepEqual(gridOptions(bar), [20, 22.5, 25, 27.5, 30])
  })

  it('в списке нет весов вне сетки', () => {
    for (const w of gridOptions(stack(5, 5, 200))) {
      assert.equal(w % 5, 0, `${w} не кратен шагу`)
    }
  })

  it('при длинном списке даёт окно вокруг текущего веса', () => {
    const opts = gridOptions(stack(1, 1, 5000), { around: 100, limit: 20 })
    assert.equal(opts.length, 20)
    assert.ok(opts.includes(100), 'текущий вес обязан быть в списке')
  })

  it('без потолка строит окно от текущего веса', () => {
    const grid: WeightGrid = { units: 'kg', step: 5, min: 5 }
    const opts = gridOptions(grid, { around: 60, limit: 10 })
    assert.equal(opts.length, 10)
    assert.ok(opts.includes(60))
  })

  it('при неизвестной сетке отдаёт пусто — остаётся ввод руками', () => {
    assert.deepEqual(gridOptions({ units: 'kg' }), [])
  })
})

describe('между тренировками решают повторы, а не кнопка', () => {
  it('закрыл диапазон во всех подходах — вес растёт, даже если было тяжело', () => {
    // Реальный случай: 15, 15, 15 при цели 15, последний «на пределе».
    // Верхняя граница диапазона почти всегда ощущается предельной —
    // иначе прогресс невозможен в принципе.
    assert.equal(
      interSessionDelta(
        sets([14, 15, 'on_target'], [14, 15, 'on_target'], [14, 15, 'limit']),
        13,
        15,
      ),
      1,
    )
  })

  it('не закрыл диапазон — держим, как бы легко ни было', () => {
    assert.equal(
      interSessionDelta(sets([14, 14, 'easy'], [14, 15, 'easy'], [14, 13, 'easy']), 13, 15),
      0,
    )
  })

  it('один провал держит вес, даже если остальные закрыли диапазон', () => {
    assert.equal(
      interSessionDelta(
        sets([14, 15, 'on_target'], [14, 15, 'on_target'], [14, 9, 'limit']),
        13,
        15,
      ),
      0,
      'провал не должен соседствовать с прибавкой',
    )
  })

  it('половина провалена — вниз', () => {
    assert.equal(interSessionDelta(sets([14, 9, 'limit'], [14, 15, 'on_target']), 13, 15), -1)
  })
})
