import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ItemCard } from '@/components/item-card'
import { SessionHeader } from '@/components/session-header'
import { muscleGroupOf } from '@/lib/patterns'
import {
  alternativesFor,
  historyVolume,
  patternTitles,
  sessionWithItems,
} from '@/lib/session/queries'
import { buildItemPlan } from '@/lib/session/plan'

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/signin')

  const data = await sessionWithItems(userId, id)
  if (!data) redirect('/')

  const patterns = await patternTitles()
  const order = { active: 0, pending: 1, deferred: 2, done: 3, skipped: 4 } as const
  const sorted = [...data.items].sort(
    (a, b) => order[a.item.status] - order[b.item.status] || a.item.position - b.item.position,
  )

  // Текущий пункт — первый незакрытый. Отложенные уезжают вниз, но остаются доступны.
  const currentId = sorted.find(
    (r) => r.item.status === 'active' || r.item.status === 'pending',
  )?.item.id

  // Разминка привязана к мышечной группе: смотрим, работали ли её уже сегодня.
  const workedGroups = new Set(
    data.items
      .filter((r) => (data.logsByItem.get(r.item.id)?.length ?? 0) > 0)
      .map((r) => muscleGroupOf(r.item.patternCode))
      .filter(Boolean),
  )

  const cards = await Promise.all(
    sorted.map(async (row) => {
      const logged = data.logsByItem.get(row.item.id) ?? []
      const isCurrent = row.item.id === currentId
      const alternatives = isCurrent
        ? await alternativesFor(userId, data.session.gymId, row.item.patternCode)
        : []
      const volume = isCurrent
        ? await historyVolume(
            userId,
            alternatives.map((a) => a.id),
          )
        : new Map()

      const plan =
        isCurrent && row.item.exerciseId
          ? await buildItemPlan({
              userId,
              gymId: data.session.gymId,
              sessionId: data.session.id,
              exerciseId: row.item.exerciseId,
              patternCode: row.item.patternCode,
              scheme: row.templateItem?.scheme ?? 'straight',
              sets: row.item.targetSets,
              rampPercents: row.templateItem?.rampPercents ?? null,
              rampReps: row.templateItem?.rampReps ?? null,
              repMin: row.item.repMin,
              repMax: row.item.repMax,
              firstForMuscleGroup: !workedGroups.has(muscleGroupOf(row.item.patternCode)),
              logged,
            })
          : null

      return {
        row,
        logged,
        isCurrent,
        plan,
        alternatives: alternatives
          .map((a) => ({ ...a, volume: volume.get(a.id) ?? 0 }))
          .sort((a, b) => {
            const pref = row.templateItem?.preferredExerciseId
            if (a.id === pref) return -1
            if (b.id === pref) return 1
            return b.volume - a.volume
          }),
        patternTitle: patterns.get(row.item.patternCode)?.title ?? row.item.patternCode,
      }
    }),
  )

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4 pb-24">
      <SessionHeader session={data.session} />
      {cards.map((c) => (
        <ItemCard key={c.row.item.id} {...c} />
      ))}
    </main>
  )
}
