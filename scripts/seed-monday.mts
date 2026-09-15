/**
 * Заливает зал CityFit Westfield и шаблон «грудь + бицепс» по docs/inventory.md.
 *
 * Идемпотентно: всё ищется по имени, существующее не трогается.
 * Запуск: npm run db:seed:monday
 */
import { neon } from '@neondatabase/serverless'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'
import {
  authUsers,
  equipmentModels,
  exercises,
  gymEquipment,
  gyms,
  templateItems,
  templates,
} from '../src/db/schema.ts'
import type { MuscleCode } from '../src/lib/muscles.ts'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL не задан (нужен .env.local)')

const email = (process.env.ALLOWED_EMAILS ?? '').split(',')[0]?.trim()
if (!email) throw new Error('ALLOWED_EMAILS пуст — непонятно, кому принадлежат данные')

const db = drizzle(neon(url))

const [user] = await db.select().from(authUsers).where(eq(authUsers.email, email))
if (!user) throw new Error(`Пользователь ${email} не найден — сначала войди в приложение`)
const userId = user.id

/** Ряд гантелей CityFit: 1..10 через 1, дальше через 2 до 40. */
const CITYFIT_DUMBBELLS = [
  ...Array.from({ length: 10 }, (_, i) => i + 1),
  ...Array.from({ length: 15 }, (_, i) => 12 + i * 2),
]

type ModelSeed = typeof equipmentModels.$inferInsert
type ExerciseSeed = {
  key: string
  name: string
  muscle: MuscleCode
  model: string
  /** Целевые повторы — свойство упражнения, а не плана. */
  targetReps: number
  notes?: string
}

const MODELS: (Omit<ModelSeed, 'userId'> & { key: string })[] = [
  {
    key: 'barbell',
    name: 'Олимпийская штанга',
    kind: 'barbell',
    barWeight: 20,
    step: 2.5,
    // Подводящие округляются до пятёрки: вешать 82.5 ради разминки — возня
    // с блинами по 1.25 на сторону, а точность там ничего не даёт.
    rampStep: 5,
    maxWeight: 200,
    notes: 'Шаг 2.5 принят по умолчанию — проверить, есть ли блины 1.25',
  },
  {
    key: 'dumbbells',
    name: 'Гантели',
    kind: 'dumbbell',
    ladder: CITYFIT_DUMBBELLS,
    notes: 'Ряд: 1..10 через 1, дальше через 2 до 40. Проверить верх ряда',
  },
  {
    key: 'ez',
    name: 'EZ-гриф',
    kind: 'barbell',
    barWeight: 5,
    step: 2.5,
    maxWeight: 60,
    notes: 'Вес грифа под вопросом: обычный EZ весит 7-10. На 45 кг это разница в 10%',
  },
  { key: 'pec_deck', name: 'Бабочка', kind: 'stack', step: 5, minWeight: 5, maxWeight: 100 },
  { key: 'cable', name: 'Кроссовер', kind: 'cable', step: 5, minWeight: 5, maxWeight: 100 },
  {
    key: 'ab',
    name: 'Тренажёр на пресс',
    kind: 'stack',
    step: 5,
    minWeight: 5,
    maxWeight: 100,
  },
]

const EXERCISES: ExerciseSeed[] = [
  {
    key: 'bench',
    targetReps: 6,
    name: 'Жим лёжа',
    muscle: 'chest',
    model: 'barbell',
  },
  {
    key: 'db45',
    targetReps: 12,
    name: 'Жим гантелей под наклоном 45°',
    muscle: 'chest',
    model: 'dumbbells',
  },
  // 30° и альтернативы сведения — вес не назывался, заполнится с первой тренировки
  {
    key: 'db30',
    targetReps: 12,
    name: 'Жим гантелей под наклоном 30°',
    muscle: 'chest',
    model: 'dumbbells',
  },
  {
    key: 'pec',
    targetReps: 12,
    name: 'Сведение в бабочке',
    muscle: 'chest',
    model: 'pec_deck',
    notes: 'Вес не помнит: называл 30-70',
  },
  {
    key: 'cross',
    targetReps: 12,
    name: 'Сведение на кроссовере',
    muscle: 'chest',
    model: 'cable',
  },
  {
    key: 'db_fly',
    targetReps: 12,
    name: 'Разводка гантелями лёжа',
    muscle: 'chest',
    model: 'dumbbells',
  },
  {
    key: 'curl_seated',
    targetReps: 15,
    name: 'Бицепс гантелями сидя',
    muscle: 'biceps',
    model: 'dumbbells',
  },
  {
    key: 'curl_ez',
    targetReps: 15,
    name: 'Бицепс с EZ-грифом стоя',
    muscle: 'biceps',
    model: 'ez',
  },
  {
    key: 'hammer',
    targetReps: 15,
    name: 'Молоточки',
    muscle: 'biceps',
    model: 'dumbbells',
  },
  {
    key: 'abs',
    targetReps: 15,
    name: 'Пресс в тренажёре',
    muscle: 'core',
    model: 'ab',
  },
]

type ItemSeed = {
  exercise: string
  scheme: 'straight' | 'ramp'
  sets?: number
  rampPercents?: number[]
  note?: string
}

const ITEMS: ItemSeed[] = [
  {
    exercise: 'bench',
    scheme: 'ramp',
    rampPercents: [0.2, 0.6, 0.8, 0.9, 1],
    note: 'Потолок был 100, выше не шёл. Теперь верх ведёт фидбек',
  },
  {
    exercise: 'db45',
    scheme: 'ramp',
    rampPercents: [0.6, 0.72, 0.89, 1],
  },
  {
    exercise: 'db30',
    scheme: 'straight',
    sets: 2,
  },
  {
    exercise: 'pec',
    scheme: 'straight',
    sets: 4,
  },
  {
    exercise: 'curl_seated',
    scheme: 'straight',
    sets: 4,
  },
  {
    exercise: 'curl_ez',
    scheme: 'straight',
    sets: 4,
  },
  {
    exercise: 'hammer',
    scheme: 'straight',
    sets: 3,
  },
  {
    exercise: 'abs',
    scheme: 'ramp',
    rampPercents: [0.6, 0.8, 1],
  },
]

const GYM_NAME = 'CityFit Westfield'
const TEMPLATE_NAME = 'Грудь + бицепс'

async function findOrCreateGym() {
  const [found] = await db
    .select()
    .from(gyms)
    .where(and(eq(gyms.userId, userId), eq(gyms.name, GYM_NAME)))
  if (found) return { gym: found, created: false }
  const [gym] = await db.insert(gyms).values({ userId, name: GYM_NAME }).returning()
  return { gym, created: true }
}

const { gym, created: gymCreated } = await findOrCreateGym()

const modelIds = new Map<string, string>()
for (const { key, ...m } of MODELS) {
  const [found] = await db
    .select()
    .from(equipmentModels)
    .where(and(eq(equipmentModels.userId, userId), eq(equipmentModels.name, m.name)))
  const row =
    found ??
    (
      await db
        .insert(equipmentModels)
        .values({ ...m, userId })
        .returning()
    )[0]
  modelIds.set(key, row.id)

  // Сетку весов на уже заведённых моделях подтягиваем: это справочные
  // величины про саму железку, истории они не касаются.
  if (found) {
    await db
      .update(equipmentModels)
      .set({
        step: m.step ?? null,
        rampStep: m.rampStep ?? null,
        minWeight: m.minWeight ?? null,
        maxWeight: m.maxWeight ?? null,
        barWeight: m.barWeight ?? null,
        ladder: m.ladder ?? null,
        updatedAt: new Date(),
      })
      .where(eq(equipmentModels.id, found.id))
  }

  const [link] = await db
    .select()
    .from(gymEquipment)
    .where(and(eq(gymEquipment.gymId, gym.id), eq(gymEquipment.equipmentModelId, row.id)))
  if (!link) {
    await db.insert(gymEquipment).values({ gymId: gym.id, equipmentModelId: row.id })
  }
}

const exerciseIds = new Map<string, string>()
for (const e of EXERCISES) {
  const [found] = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.userId, userId), eq(exercises.name, e.name)))
  const row =
    found ??
    (
      await db
        .insert(exercises)
        .values({
          userId,
          name: e.name,
          muscleGroup: e.muscle,
          equipmentModelId: modelIds.get(e.model)!,
          targetReps: e.targetReps,
          notes: e.notes,
        })
        .returning()
    )[0]
  exerciseIds.set(e.key, row.id)
}

const [existingTemplate] = await db
  .select()
  .from(templates)
  .where(and(eq(templates.userId, userId), eq(templates.name, TEMPLATE_NAME)))

let templateCreated = false
if (!existingTemplate) {
  const [tpl] = await db.insert(templates).values({ userId, name: TEMPLATE_NAME }).returning()
  await db.insert(templateItems).values(
    ITEMS.map((it, i) => ({
      templateId: tpl.id,
      position: i,
      exerciseId: exerciseIds.get(it.exercise)!,
      scheme: it.scheme,
      sets: it.sets ?? 3,
      rampPercents: it.rampPercents,
      note: it.note,
    })),
  )
  templateCreated = true
}

console.log(`Пользователь:  ${email}`)
console.log(`Зал:           ${GYM_NAME} ${gymCreated ? '(создан)' : '(уже был)'}`)
console.log(`Оборудование:  ${MODELS.length}`)
console.log(`Упражнения:    ${EXERCISES.length}`)
console.log(
  `Шаблон:        ${TEMPLATE_NAME} ${templateCreated ? '(создан)' : '(уже был)'}, пунктов ${ITEMS.length}`,
)
