/**
 * Прогоняет движок по всем пунктам шаблона на реальных данных из базы.
 * Ничего не пишет — только читает и печатает, что приложение предложит в зале.
 *
 * Запуск: npm run dry-run
 */
import { eq } from 'drizzle-orm'
import { db } from '../src/db/index.ts'
import { authUsers, exercises, gyms, templateItems, templates } from '../src/db/schema.ts'
import { rangeFromTarget } from '../src/lib/templates/parse.ts'
import { buildItemPlan } from '../src/lib/session/plan.ts'
import { muscleTitle } from '../src/lib/muscles.ts'

const email = (process.env.ALLOWED_EMAILS ?? '').split(',')[0]?.trim()
const [user] = await db.select().from(authUsers).where(eq(authUsers.email, email!))
const [gym] = await db.select().from(gyms).where(eq(gyms.userId, user.id))
const [tpl] = await db.select().from(templates).where(eq(templates.userId, user.id))
const items = await db
  .select()
  .from(templateItems)
  .where(eq(templateItems.templateId, tpl.id))
  .orderBy(templateItems.position)

console.log(`Зал: ${gym.name}   Тренировка: ${tpl.name}\n`)

for (const it of items) {
  const [ex] = await db.select().from(exercises).where(eq(exercises.id, it.exerciseId))

  const plan = await buildItemPlan({
    userId: user.id,
    gymId: gym.id,
    sessionId: '00000000-0000-0000-0000-000000000000',
    exerciseId: ex.id,
    sets: it.sets,
    leadKg: it.leadKg ?? undefined,
    ...rangeFromTarget(ex.targetReps),
    extraSets: 0,
    logged: [],
  })

  const head = `${it.position + 1}. ${ex.name}`
  console.log(head)
  const lead = it.leadKg?.length ?? 0
  console.log(
    `   ${muscleTitle(ex.muscleGroup)} · ${lead > 0 ? `подводка ${lead} + ` : ''}${it.sets} рабочих`,
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
