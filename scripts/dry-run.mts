/**
 * Прогоняет движок по всем пунктам шаблона на реальных данных из базы.
 * Ничего не пишет — только читает и печатает, что приложение предложит в зале.
 *
 * Запуск: npm run dry-run
 */
import { eq } from 'drizzle-orm'
import { db } from '../src/db/index.ts'
import { authUsers, exercises, gyms, templateItems, templates } from '../src/db/schema.ts'
import { muscleGroupOf } from '../src/lib/patterns.ts'
import { rangeFromTarget } from '../src/lib/templates/parse.ts'
import { buildItemPlan } from '../src/lib/session/plan.ts'
import { patternTitles } from '../src/lib/session/queries.ts'

const email = (process.env.ALLOWED_EMAILS ?? '').split(',')[0]?.trim()
const [user] = await db.select().from(authUsers).where(eq(authUsers.email, email!))
const [gym] = await db.select().from(gyms).where(eq(gyms.userId, user.id))
const [tpl] = await db.select().from(templates).where(eq(templates.userId, user.id))
const items = await db
  .select()
  .from(templateItems)
  .where(eq(templateItems.templateId, tpl.id))
  .orderBy(templateItems.position)
const titles = await patternTitles()

console.log(`Зал: ${gym.name}   Тренировка: ${tpl.name}\n`)

const workedGroups = new Set<string>()

for (const it of items) {
  const [ex] = await db
    .select()
    .from(exercises)
    .where(eq(exercises.id, it.preferredExerciseId!))
  const group = muscleGroupOf(it.patternCode)!
  const first = !workedGroups.has(group)

  const plan = await buildItemPlan({
    userId: user.id,
    gymId: gym.id,
    sessionId: '00000000-0000-0000-0000-000000000000',
    exerciseId: ex.id,
    patternCode: it.patternCode,
    scheme: it.scheme,
    sets: it.sets,
    rampPercents: it.rampPercents,
    ...rangeFromTarget(ex.targetReps),
    extraSets: 0,
    firstForMuscleGroup: first,
    logged: [],
  })
  workedGroups.add(group)

  const head = `${it.position + 1}. ${ex.name}`
  console.log(head)
  console.log(
    `   ${titles.get(it.patternCode)?.title} · ${it.scheme === 'ramp' ? 'рампа' : 'прямая'}`,
  )

  if (!plan?.prescription.top) {
    console.log(`   → ${plan?.notes.join('; ')}\n`)
    continue
  }

  const line = plan.prescription.sets
    .map((s) => {
      const r = s.reps[0] === s.reps[1] ? `${s.reps[0]}` : `${s.reps[0]}-${s.reps[1]}`
      const tag = s.role === 'working' ? '' : s.role === 'ramp' ? '~' : '°'
      return `${tag}${s.weight.weight}×${r}`
    })
    .join('  ')
  console.log(`   → ${line}`)
  console.log(`   источник: ${plan.prescription.source}; ${plan.notes.join('; ')}\n`)
}

console.log('° разминка   ~ подводящий   без значка — рабочий')
