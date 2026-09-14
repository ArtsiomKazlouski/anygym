/**
 * Справочник паттернов движений (docs/DESIGN.md, раздел 3).
 *
 * Паттерн определяет три вещи:
 *  1. какие модели оборудования взаимозаменяемы в пункте плана;
 *  2. какая мышечная группа — отсюда работает разминка и «давно не делал»;
 *  3. по чему считается откат за паузу (именно по паттерну, а не по модели:
 *     если ты жал грудь три дня назад на другом тренажёре, мышца не детренирована).
 */

export const MUSCLE_GROUPS = [
  'chest',
  'shoulders',
  'triceps',
  'back',
  'biceps',
  'traps',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'calves',
  'core',
] as const

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export type PatternDef = {
  code: string
  title: string
  muscleGroup: MuscleGroup
}

export const PATTERNS: PatternDef[] = [
  { code: 'horizontal_press', title: 'Жим горизонтальный', muscleGroup: 'chest' },
  { code: 'incline_press', title: 'Жим наклонный', muscleGroup: 'chest' },
  { code: 'vertical_press', title: 'Жим вертикальный', muscleGroup: 'shoulders' },
  { code: 'chest_fly', title: 'Сведение', muscleGroup: 'chest' },
  { code: 'lateral_raise', title: 'Махи в стороны', muscleGroup: 'shoulders' },
  { code: 'triceps_extension', title: 'Разгибание на трицепс', muscleGroup: 'triceps' },
  { code: 'vertical_pull', title: 'Тяга вертикальная', muscleGroup: 'back' },
  { code: 'horizontal_pull', title: 'Тяга горизонтальная', muscleGroup: 'back' },
  { code: 'rear_delt', title: 'Задняя дельта', muscleGroup: 'shoulders' },
  { code: 'biceps_curl', title: 'Сгибание на бицепс', muscleGroup: 'biceps' },
  { code: 'shrug', title: 'Шраги', muscleGroup: 'traps' },
  { code: 'squat', title: 'Присед / жим ногами', muscleGroup: 'quads' },
  { code: 'hinge', title: 'Тазобедренный шарнир', muscleGroup: 'hamstrings' },
  { code: 'knee_extension', title: 'Разгибание ног', muscleGroup: 'quads' },
  { code: 'knee_flexion', title: 'Сгибание ног', muscleGroup: 'hamstrings' },
  { code: 'hip_abduction', title: 'Отведение бедра', muscleGroup: 'glutes' },
  { code: 'hip_adduction', title: 'Приведение бедра', muscleGroup: 'adductors' },
  { code: 'calf_raise', title: 'Голень', muscleGroup: 'calves' },
  { code: 'trunk_flexion', title: 'Сгибание корпуса', muscleGroup: 'core' },
  { code: 'anti_extension', title: 'Антиразгибание', muscleGroup: 'core' },
  { code: 'rotation', title: 'Ротация корпуса', muscleGroup: 'core' },
]

const byCode = new Map(PATTERNS.map((p) => [p.code, p]))

export function getPattern(code: string): PatternDef | undefined {
  return byCode.get(code)
}

export function muscleGroupOf(code: string): MuscleGroup | undefined {
  return byCode.get(code)?.muscleGroup
}
