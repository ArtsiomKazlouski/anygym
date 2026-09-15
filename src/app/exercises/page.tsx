import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AppNav } from '@/components/app-nav'
import { EquipmentIcon } from '@/components/equipment-icon'
import { SubmitButton } from '@/components/submit-button'
import { createExerciseOn, updateExercise } from '@/lib/equipment/actions'
import {
  allEquipment,
  allExercises,
  exercisesPerMuscle,
  lastWorkingSets,
} from '@/lib/equipment/queries'
import { MuscleSelect } from '@/components/muscle-select'
import { muscleTitle } from '@/lib/muscles'

const field =
  'w-full rounded-xl border border-black/15 bg-transparent px-3 py-2.5 text-base dark:border-white/20'

export default async function ExercisesPage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/signin')

  const [list, lastSets, equipment, counts] = await Promise.all([
    allExercises(userId),
    lastWorkingSets(userId),
    allEquipment(userId),
    exercisesPerMuscle(userId),
  ])
  const day = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' })

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-5">
      <AppNav current="/exercises" />

      <p className="text-sm opacity-50">
        Цель повторов и рабочий вес принадлежат упражнению, а не плану: «тяга гантелей —
        двенадцать» верно в любом плане и в любом зале.
      </p>

      <section className="flex flex-col gap-2">
        {list.length === 0 && (
          <p className="text-sm opacity-50">
            Упражнений пока нет — они заводятся на карточке тренажёра в разделе «Залы».
          </p>
        )}

        {list.map((e) => {
          const last = lastSets.get(e.id)
          return (
            <details
              key={e.id}
              className="rounded-2xl border border-black/10 px-4 py-3 dark:border-white/15"
            >
              <summary className="flex cursor-pointer items-center gap-3">
                <EquipmentIcon kind={e.modelKind} className="size-5 shrink-0 opacity-35" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{e.name}</span>
                  <span className="block truncate text-xs opacity-45">
                    {e.modelName} · {muscleTitle(e.muscleGroup)}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm tabular-nums opacity-60">
                  {last && (
                    <span className="block">
                      {last.weight} {last.units}
                    </span>
                  )}
                  <span className="block text-xs opacity-70">{e.targetReps} повт</span>
                </span>
              </summary>

              <form
                key={`${e.name}-${e.muscleGroup}-${e.targetReps}`}
                action={updateExercise}
                className="mt-3 flex flex-col gap-2"
              >
                <input type="hidden" name="exerciseId" value={e.id} />
                <input type="hidden" name="modelId" value={e.modelId} />
                <label className="flex flex-col gap-1">
                  <span className="text-xs opacity-55">Название</span>
                  <input name="name" required defaultValue={e.name} className={field} />
                </label>
                <MuscleSelect counts={counts} defaultValue={e.muscleGroup} className={field} />
                <label className="flex flex-col gap-1">
                  <span className="text-xs opacity-55">Целевые повторы</span>
                  <input
                    name="targetReps"
                    inputMode="numeric"
                    defaultValue={e.targetReps}
                    className={field}
                  />
                </label>

                <p className="text-xs opacity-45">
                  {last ? (
                    <>
                      Сейчас по истории:{' '}
                      <b>
                        {last.weight} {last.units}
                      </b>
                      , {day.format(last.at)}. Стартовый вес больше не используется — движок
                      ведёт по записям.
                    </>
                  ) : (
                    <>
                      Записей ещё нет: с этого веса и начнём. Дальше движок поведёт по истории,
                      и стартовый больше смотреть не будет.
                    </>
                  )}
                </p>
                <SubmitButton className="rounded-xl bg-black py-3 text-sm font-medium text-white dark:bg-white dark:text-black">
                  Сохранить
                </SubmitButton>
                <Link
                  href={`/equipment/${e.modelId}`}
                  className="text-center text-xs opacity-45 underline-offset-4 hover:underline"
                >
                  Тренажёр: настройки, сетка весов, фото
                </Link>
              </form>
            </details>
          )
        })}
      </section>

      <details className="rounded-2xl border border-dashed border-black/15 px-4 py-3 dark:border-white/20">
        <summary className="cursor-pointer text-sm opacity-60">Новое упражнение</summary>

        {equipment.length === 0 ? (
          <p className="mt-3 text-sm opacity-50">
            Сначала нужен тренажёр —{' '}
            <Link href="/gyms" className="underline underline-offset-4">
              заведи его в разделе «Залы»
            </Link>
            . Упражнение всегда делается на чём-то, и от железки зависит сетка весов.
          </p>
        ) : (
          <form action={createExerciseOn} className="mt-3 flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs opacity-55">Название</span>
              <input
                name="name"
                required
                placeholder="Например «Тяга гантели в наклоне»"
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs opacity-55">На чём делается</span>
              <select name="modelId" required defaultValue="" className={field}>
                <option value="" disabled>
                  выбери тренажёр
                </option>
                {equipment.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <MuscleSelect counts={counts} className={field} />
            <label className="flex flex-col gap-1">
              <span className="text-xs opacity-55">Целевые повторы</span>
              <input
                name="targetReps"
                inputMode="numeric"
                defaultValue={12}
                className={field}
              />
            </label>
            <SubmitButton className="rounded-xl bg-black py-3 text-sm font-medium text-white dark:bg-white dark:text-black">
              Создать
            </SubmitButton>
            <p className="text-xs opacity-40">
              Мышечная группа нужна для отката веса после перерыва и для счёта объёма по
              тренировке. Замену занятому тренажёру приложение не подбирает: на одну группу
              приходятся разные движения, и жим вместо сведения — не замена.
            </p>
          </form>
        )}
      </details>
    </main>
  )
}
