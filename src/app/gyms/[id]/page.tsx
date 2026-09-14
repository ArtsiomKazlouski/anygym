import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { EquipmentForm } from '@/components/equipment-form'
import { GymEquipmentOverride } from '@/components/gym-equipment-override'
import { SubmitButton } from '@/components/submit-button'
import { createEquipment, linkEquipment, unlinkEquipment } from '@/lib/equipment/actions'
import { gymWithEquipment } from '@/lib/equipment/queries'

export default async function GymPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/signin')

  const data = await gymWithEquipment(userId, id)
  if (!data) redirect('/gyms')

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-5">
      <Link
        href="/gyms"
        className="-ml-2 self-start rounded-full px-2 py-1.5 text-sm opacity-60 transition duration-75 active:scale-95"
      >
        ← Залы
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight">{data.gym.name}</h1>

      <section className="flex flex-col gap-1">
        {data.equipment.length === 0 && (
          <p className="text-sm opacity-50">Оборудования пока нет.</p>
        )}
        {data.equipment.map(({ link, model, exercises }) => {
          const ladder = link.ladderOverride ?? model.ladder
          const step = link.stepOverride ?? model.step
          return (
            <div
              key={link.id}
              className="rounded-2xl border border-black/10 px-3 py-2 dark:border-white/15"
            >
              <div className="flex items-center gap-2">
                <Link
                  href={`/equipment/${model.id}`}
                  className="min-w-0 flex-1 rounded-xl py-1 transition duration-75 active:scale-[0.98]"
                >
                  <div className="truncate text-sm font-medium">{model.name}</div>
                  <div className="text-xs opacity-45">
                    {ladder?.length
                      ? `ряд из ${ladder.length}`
                      : step
                        ? `шаг ${step}`
                        : 'сетка не задана'}
                    {' · '}
                    {exercises} упр.
                    {link.locationNote && ` · ${link.locationNote}`}
                  </div>
                </Link>
                <form action={unlinkEquipment}>
                  <input type="hidden" name="linkId" value={link.id} />
                  <input type="hidden" name="gymId" value={data.gym.id} />
                  <SubmitButton className="rounded-full px-2 py-1.5 text-xs opacity-35 hover:opacity-100">
                    Убрать
                  </SubmitButton>
                </form>
              </div>
              <GymEquipmentOverride link={link} model={model} gymId={data.gym.id} />
            </div>
          )
        })}
      </section>

      {data.others.length > 0 && (
        <details className="rounded-2xl border border-dashed border-black/15 px-4 py-3 dark:border-white/20">
          <summary className="cursor-pointer text-sm opacity-60">
            Здесь стоит такая же железка
          </summary>
          <p className="mt-2 text-xs opacity-45">
            Если модель уже заведена в другом зале, привяжи её сюда — история и настройки
            перенесутся, калиброваться заново не придётся.
          </p>
          <form action={linkEquipment} className="mt-2 flex flex-col gap-2">
            <input type="hidden" name="gymId" value={data.gym.id} />
            <select
              name="equipmentModelId"
              required
              defaultValue=""
              className="w-full rounded-xl border border-black/15 bg-transparent px-3 py-2.5 text-base dark:border-white/20"
            >
              <option value="" disabled>
                выбери модель
              </option>
              {data.others.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <SubmitButton className="rounded-xl bg-black py-3 text-sm font-medium text-white dark:bg-white dark:text-black">
              Привязать
            </SubmitButton>
          </form>
        </details>
      )}

      <details className="rounded-2xl border border-dashed border-black/15 px-4 py-3 dark:border-white/20">
        <summary className="cursor-pointer text-sm opacity-60">Новый тренажёр</summary>
        <div className="mt-3">
          <EquipmentForm action={createEquipment} gymId={data.gym.id} submitLabel="Создать" />
        </div>
      </details>
    </main>
  )
}
