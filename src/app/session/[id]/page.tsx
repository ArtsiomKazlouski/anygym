import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AddExercise } from '@/components/add-exercise'
import { DeleteSession } from '@/components/delete-session'
import { ItemCard } from '@/components/item-card'
import { SessionHeader } from '@/components/session-header'
import { exercisesPerMuscle } from '@/lib/equipment/queries'
import {
  exercisesInGym,
  modelsOfTypeInGym,
  sessionWithItems,
  typesInGym,
} from '@/lib/session/queries'
import { buildItemPlan } from '@/lib/session/plan'
import { muscleTitle } from '@/lib/muscles'

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/signin')

  const data = await sessionWithItems(userId, id)
  if (!data) redirect('/')

  const [addable, types, muscleCounts] = await Promise.all([
    exercisesInGym(userId, data.session.gymId),
    typesInGym(userId, data.session.gymId),
    exercisesPerMuscle(userId),
  ])
  // Порядок строго по плану: пункт не должен прыгать по списку от смены статуса.
  // «Занято» и так уводит его в конец, меняя позицию.
  const sorted = [...data.items].sort((a, b) => a.item.position - b.item.position)

  // Текущий — тот, на который переключились; иначе первый несделанный.
  const currentId =
    sorted.find((r) => r.item.status === 'active')?.item.id ??
    sorted.find((r) => r.item.status === 'pending')?.item.id

  const cards = await Promise.all(
    sorted.map(async (row) => {
      const logged = data.logsByItem.get(row.item.id) ?? []
      const isCurrent = row.item.id === currentId

      // Исполнения этого типа, стоящие в зале. Нужны, только пока выбор
      // не сделан или ещё можно передумать: список из одного элемента
      // проставился сам при старте и показывать его незачем.
      const models =
        isCurrent && row.exercise && logged.length === 0
          ? await modelsOfTypeInGym(userId, row.exercise.equipmentTypeId, data.session.gymId)
          : []

      const plan =
        isCurrent && row.item.exerciseId && row.item.equipmentModelId
          ? await buildItemPlan({
              userId,
              gymId: data.session.gymId,
              sessionId: data.session.id,
              exerciseId: row.item.exerciseId,
              equipmentModelId: row.item.equipmentModelId,
              sets: row.item.targetSets,
              repMin: row.item.repMin,
              repMax: row.item.repMax,
              extraSets: row.item.extraSets,
              logged,
            })
          : null

      return {
        row,
        logged,
        isCurrent,
        plan,
        models,
        muscleTitle: row.exercise ? muscleTitle(row.exercise.muscleGroup) : '',
      }
    }),
  )

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4 pb-24">
      <SessionHeader session={data.session} />
      {cards.map((c) => (
        <ItemCard key={c.row.item.id} {...c} />
      ))}

      <AddExercise
        sessionId={data.session.id}
        exercises={addable}
        types={types}
        muscleCounts={muscleCounts}
      />

      <DeleteSession
        sessionId={data.session.id}
        summary={`${new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(data.session.startedAt)}, подходов ${[...data.logsByItem.values()].flat().length}`}
      />
    </main>
  )
}
