/**
 * Мышечные группы (docs/DESIGN.md, раздел 3).
 *
 * Группа отвечает за две вещи:
 *  1. откат за паузу — если группа не работала три недели, она детренирована,
 *     и неважно, на каком тренажёре её тренировали в прошлый раз;
 *  2. объём — сколько упражнений и подходов пришлось на группу за тренировку.
 *
 * Чего группа НЕ делает: не подбирает замену занятому тренажёру. Одна мышца —
 * это разные движения (жим и сведение оба «грудь»), и подставлять одно вместо
 * другого нельзя. Замена делается руками: убрать пункт, добавить другой.
 *
 * Группа одна на упражнение — главная. Жим лёжа грузит и трицепс, но считать
 * его и в грудь, и в трицепс значит удвоить объём и потерять смысл счёта.
 */

/**
 * Порядок — сверху вниз по телу: так список проще просматривать.
 * Он же задаёт порядок колонок enum в базе, поэтому менять его местами
 * без миграции нельзя — только дописывать в конец.
 */
export const MUSCLE_CODES = [
  'chest',
  'back',
  'traps',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'calves',
] as const

export type MuscleCode = (typeof MUSCLE_CODES)[number]

const TITLES: Record<MuscleCode, string> = {
  chest: 'Грудь',
  back: 'Спина',
  traps: 'Трапеции',
  shoulders: 'Плечи',
  biceps: 'Бицепс',
  triceps: 'Трицепс',
  forearms: 'Предплечья',
  core: 'Пресс и корпус',
  glutes: 'Ягодицы',
  quads: 'Квадрицепс',
  hamstrings: 'Бицепс бедра',
  adductors: 'Приводящие',
  calves: 'Голень',
}

export const MUSCLES = MUSCLE_CODES.map((code) => ({ code, title: TITLES[code] }))

export function muscleTitle(code: string): string {
  return TITLES[code as MuscleCode] ?? code
}
