import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { EquipmentForm } from '@/components/equipment-form'
import { SubmitButton } from '@/components/submit-button'
import {
  archiveExercise,
  createExerciseOn,
  saveSetup,
  updateEquipment,
} from '@/lib/equipment/actions'
import { equipmentCard } from '@/lib/equipment/queries'
import { PATTERNS, getPattern } from '@/lib/patterns'

const SETUP_FIELDS = ['сиденье', 'спинка', 'хват', 'упор'] as const
const field =
  'w-full rounded-xl border border-black/15 bg-transparent px-3 py-2.5 text-base dark:border-white/20'

export default async function EquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/signin')

  const data = await equipmentCard(userId, id)
  if (!data) redirect('/gyms')

  const settings = data.setup?.settings ?? {}

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-5">
      <Link
        href={data.inGyms[0] ? `/gyms/${data.inGyms[0].id}` : '/gyms'}
        className="-ml-2 self-start rounded-full px-2 py-1.5 text-sm opacity-60 transition duration-75 active:scale-95"
      >
        ← {data.inGyms[0]?.name ?? 'Залы'}
      </Link>

      <header>
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">
          {data.model.name}
        </h1>
        <p className="mt-1 text-xs opacity-45">
          {data.inGyms.length > 0
            ? `Стоит в: ${data.inGyms.map((g) => g.name).join(', ')}`
            : 'Ни в одном зале не отмечен'}
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-xs uppercase tracking-wide opacity-40">Настройки под тебя</h2>
        <p className="mb-3 text-xs opacity-45">
          То, что ты каждый раз выставляешь на глаз. Неверная высота сиденья — это не
          неудобство, а плечо.
        </p>
        {/* key — чтобы поля подхватили сохранённое: см. комментарий в item-card. */}
        <form
          key={data.setup?.updatedAt.toISOString() ?? 'new'}
          action={saveSetup}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="modelId" value={data.model.id} />
          <div className="grid grid-cols-2 gap-3">
            {SETUP_FIELDS.map((key) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-xs opacity-55">{key}</span>
                <input name={key} defaultValue={settings[key] ?? ''} className={field} />
              </label>
            ))}
          </div>
          <input
            name="note"
            placeholder="Что ещё стоит помнить"
            defaultValue={data.setup?.note ?? ''}
            className={field}
          />
          <SubmitButton className="rounded-xl border border-black/15 py-3 text-sm dark:border-white/20">
            Сохранить настройки
          </SubmitButton>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-xs uppercase tracking-wide opacity-40">Упражнения</h2>
        <p className="mb-2 text-xs opacity-45">
          Прогрессия висит на упражнении, а не на железке: на одних и тех же гантелях жим под
          45° и бицепс — разные веса, и смешивать их истории нельзя.
        </p>

        <div className="mb-3 flex flex-col gap-1">
          {data.exercises.length === 0 && <p className="text-sm opacity-50">Пока ни одного.</p>}
          {data.exercises.map((e) => (
            <div key={e.id} className="flex items-baseline justify-between gap-2 px-2 py-1.5">
              <span className="min-w-0 truncate text-sm">{e.name}</span>
              <span className="shrink-0 text-xs opacity-40">
                {getPattern(e.patternCode)?.title ?? e.patternCode}
              </span>
              <form action={archiveExercise}>
                <input type="hidden" name="exerciseId" value={e.id} />
                <input type="hidden" name="modelId" value={data.model.id} />
                <SubmitButton className="rounded-full px-2 py-1 text-xs opacity-35 hover:opacity-100">
                  Убрать
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>

        <details className="rounded-2xl border border-dashed border-black/15 px-4 py-3 dark:border-white/20">
          <summary className="cursor-pointer text-sm opacity-60">Новое упражнение</summary>
          <form action={createExerciseOn} className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="modelId" value={data.model.id} />
            <input name="name" required placeholder="Название" className={field} />
            <select name="patternCode" required defaultValue="" className={field}>
              <option value="" disabled>
                какое это движение
              </option>
              {PATTERNS.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.title}
                </option>
              ))}
            </select>
            <input
              name="declaredWorkingKg"
              inputMode="decimal"
              placeholder="Рабочий вес, если знаешь — с него начнём"
              className={field}
            />
            <SubmitButton className="rounded-xl bg-black py-3 text-sm font-medium text-white dark:bg-white dark:text-black">
              Создать
            </SubmitButton>
          </form>
        </details>
      </section>

      <section>
        <h2 className="mb-2 text-xs uppercase tracking-wide opacity-40">Сетка весов</h2>
        <p className="mb-3 text-xs opacity-45">
          По ней движок решает, какой вес вообще можно назвать, и из неё же строится барабан
          выбора. Пустое поле означает «не знаю» и оставляет ручной ввод.
        </p>
        <EquipmentForm
          key={data.model.updatedAt.toISOString()}
          action={updateEquipment}
          model={data.model}
          submitLabel="Сохранить тренажёр"
        />
      </section>
    </main>
  )
}
