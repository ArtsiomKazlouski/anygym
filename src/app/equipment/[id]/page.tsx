import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { EquipmentForm } from '@/components/equipment-form'
import { PhotoUpload } from '@/components/photo-upload'
import { photoUrl } from '@/lib/equipment/columns'
import { SubmitButton } from '@/components/submit-button'
import {
  archiveExercise,
  createExerciseOn,
  saveSetup,
  updateEquipment,
  updateExercise,
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
          45° и бицепс — разные веса, и смешивать их истории нельзя. Целевые повторы тоже здесь:
          «тяга гантелей — двенадцать» верно в любом плане и в любом зале.
        </p>

        <div className="mb-3 flex flex-col gap-1">
          {data.exercises.length === 0 && <p className="text-sm opacity-50">Пока ни одного.</p>}
          {data.exercises.map((e) => (
            <details
              key={e.id}
              className="rounded-xl border border-black/10 px-3 py-2 dark:border-white/15"
            >
              <summary className="cursor-pointer">
                <span className="text-sm">{e.name}</span>
                <span className="ml-2 text-xs opacity-40">
                  {getPattern(e.patternCode)?.title ?? e.patternCode} · {e.targetReps} повт
                </span>
              </summary>

              <form
                key={`${e.name}-${e.patternCode}-${e.targetReps}`}
                action={updateExercise}
                className="mt-2 flex flex-col gap-2"
              >
                <input type="hidden" name="exerciseId" value={e.id} />
                <input type="hidden" name="modelId" value={data.model.id} />
                <label className="flex flex-col gap-1">
                  <span className="text-xs opacity-55">Название</span>
                  <input name="name" required defaultValue={e.name} className={field} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs opacity-55">Движение</span>
                  <select
                    name="patternCode"
                    required
                    defaultValue={e.patternCode}
                    className={field}
                  >
                    {PATTERNS.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs opacity-55">Целевые повторы</span>
                  <input
                    name="targetReps"
                    inputMode="numeric"
                    defaultValue={e.targetReps}
                    className={field}
                  />
                </label>
                <SubmitButton className="rounded-xl border border-black/15 py-2.5 text-sm dark:border-white/20">
                  Сохранить
                </SubmitButton>
              </form>

              <form action={archiveExercise} className="mt-1 text-right">
                <input type="hidden" name="exerciseId" value={e.id} />
                <input type="hidden" name="modelId" value={data.model.id} />
                <SubmitButton className="px-2 py-1 text-xs opacity-35 hover:opacity-100">
                  Убрать упражнение
                </SubmitButton>
              </form>
            </details>
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
              name="targetReps"
              inputMode="numeric"
              placeholder="Повторы, обычно 12"
              className={field}
            />
            <SubmitButton className="rounded-xl bg-black py-3 text-sm font-medium text-white dark:bg-white dark:text-black">
              Создать
            </SubmitButton>
          </form>
        </details>
      </section>

      <section>
        <h2 className="mb-2 text-xs uppercase tracking-wide opacity-40">Фото</h2>
        <p className="mb-3 text-xs opacity-45">
          Не для красоты: это способ узнать в новом зале, что тренажёр тот же самый. Без
          узнавания не работает перенос истории между залами.
        </p>
        <PhotoUpload
          modelId={data.model.id}
          kind={data.model.kind}
          currentUrl={data.model.hasPhoto ? photoUrl(data.model) : null}
        />
      </section>
    </main>
  )
}
