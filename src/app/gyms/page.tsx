import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AppNav } from '@/components/app-nav'
import { SubmitButton } from '@/components/submit-button'
import { createGym } from '@/lib/equipment/actions'
import { gymsWithCounts } from '@/lib/equipment/queries'

export default async function GymsPage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/signin')

  const list = await gymsWithCounts(userId)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-5">
      <AppNav current="/gyms" />

      <section className="flex flex-col gap-1">
        {list.length === 0 && <p className="text-sm opacity-50">Залов пока нет.</p>}
        {list.map((g) => (
          <Link
            key={g.id}
            href={`/gyms/${g.id}`}
            className="flex items-baseline justify-between gap-3 rounded-xl px-2 py-3 transition duration-75 hover:bg-black/5 active:scale-[0.97] active:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/15"
          >
            <span className="min-w-0 truncate font-medium">{g.name}</span>
            <span className="shrink-0 text-xs opacity-45">{g.equipment} ед.</span>
          </Link>
        ))}
      </section>

      <details className="rounded-2xl border border-dashed border-black/15 px-4 py-3 dark:border-white/20">
        <summary className="cursor-pointer text-sm opacity-60">Добавить зал</summary>
        <form action={createGym} className="mt-3 flex flex-col gap-2">
          <input
            name="name"
            required
            placeholder="Как ты его называешь"
            className="w-full rounded-xl border border-black/15 bg-transparent px-3 py-2.5 text-base dark:border-white/20"
          />
          <input
            name="note"
            placeholder="Заметка, например адрес"
            className="w-full rounded-xl border border-black/15 bg-transparent px-3 py-2.5 text-base dark:border-white/20"
          />
          <SubmitButton className="rounded-xl bg-black py-3 text-sm font-medium text-white dark:bg-white dark:text-black">
            Создать
          </SubmitButton>
        </form>
      </details>
    </main>
  )
}
