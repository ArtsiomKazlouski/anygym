import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth, signOut } from '@/auth'
import { BuildFooter } from '@/components/build-footer'
import { startSession } from '@/lib/session/actions'
import { activeSession, listGyms, listTemplates } from '@/lib/session/queries'

/** На Vercel — короткий хэш коммита, локально — «локально». */
function buildVersion(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
  return sha ? sha.slice(0, 7) : 'локально'
}

export default async function Home() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/signin')

  const [gyms, templates, active] = await Promise.all([
    listGyms(userId),
    listTemplates(userId),
    activeSession(userId),
  ])

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
          <button type="submit" className="text-sm opacity-50 hover:opacity-100">
            Выйти
          </button>
        </form>
      </header>

      {active && (
        <Link
          href={`/session/${active.id}`}
          className="rounded-2xl bg-emerald-600 px-5 py-4 text-center text-base font-medium text-white"
        >
          Продолжить тренировку
        </Link>
      )}

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

          <button
            type="submit"
            className="rounded-2xl bg-black px-5 py-4 text-base font-medium text-white dark:bg-white dark:text-black"
          >
            {active ? 'Начать новую' : 'Начать тренировку'}
          </button>
        </form>
      )}

      <BuildFooter version={buildVersion()} />
    </main>
  )
}
