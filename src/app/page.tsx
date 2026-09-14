import { redirect } from 'next/navigation'
import { auth, signOut } from '@/auth'
import { BuildFooter } from '@/components/build-footer'
import { SessionRow } from '@/components/session-list'
import { startSession } from '@/lib/session/actions'
import { listGyms, listTemplates, recentSessions } from '@/lib/session/queries'
import { SubmitButton } from '@/components/submit-button'

/** На Vercel — короткий хэш коммита, локально — «локально». */
function buildVersion(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
  return sha ? sha.slice(0, 7) : 'локально'
}

export default async function Home() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/signin')

  const [gyms, templates, sessions] = await Promise.all([
    listGyms(userId),
    listTemplates(userId),
    recentSessions(userId),
  ])

  // Последняя тренировка доступна всегда, а не только пока она не завершена:
  // раньше кнопка исчезала после «Завершить», и попасть в неё было нечем.
  const [latest, ...earlier] = sessions

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 p-5">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">anygym</h1>
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/signin' })
          }}
        >
          <SubmitButton className="text-sm opacity-50 hover:opacity-100">Выйти</SubmitButton>
        </form>
      </header>

      {latest && <SessionRow row={latest} primary />}

      {gyms.length === 0 ? (
        <p className="text-sm opacity-60">
          Залов пока нет. Залей инвентарь командой <code>npm run db:seed:monday</code>.
        </p>
      ) : (
        <form action={startSession} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm opacity-60">Зал</span>
            <select
              name="gymId"
              defaultValue={gyms[0]?.id}
              className="rounded-xl border border-black/15 bg-transparent px-4 py-3 text-base dark:border-white/20"
            >
              {gyms.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm opacity-60">Тренировка</span>
            <select
              name="templateId"
              defaultValue={templates[0]?.id}
              className="rounded-xl border border-black/15 bg-transparent px-4 py-3 text-base dark:border-white/20"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              <option value="">Без плана</option>
            </select>
          </label>

          <SubmitButton className="rounded-2xl bg-black px-5 py-4 text-base font-medium text-white dark:bg-white dark:text-black">
            {latest && latest.endedAt == null ? 'Начать новую' : 'Начать тренировку'}
          </SubmitButton>
        </form>
      )}

      {earlier.length > 0 && (
        <section>
          <h2 className="mb-1 text-xs uppercase tracking-wide opacity-40">История</h2>
          <div className="flex flex-col">
            {earlier.map((row) => (
              <SessionRow key={row.id} row={row} />
            ))}
          </div>
        </section>
      )}

      <BuildFooter version={buildVersion()} />
    </main>
  )
}
