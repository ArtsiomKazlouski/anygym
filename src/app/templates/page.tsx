import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AppNav } from '@/components/app-nav'
import { SubmitButton } from '@/components/submit-button'
import { createTemplate } from '@/lib/templates/actions'
import { templatesWithCounts } from '@/lib/templates/queries'

export default async function TemplatesPage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/signin')

  const list = await templatesWithCounts(userId)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-5">
      <AppNav current="/templates" />

      <p className="text-sm opacity-50">
        План — это заготовка на посещение: набор упражнений в том порядке, в каком ты их
        делаешь. В зале он разворачивается в тренировку, где каждый пункт можно отложить,
        заменить или пропустить.
      </p>

      <section className="flex flex-col gap-1">
        {list.length === 0 && <p className="text-sm opacity-50">Планов пока нет.</p>}
        {list.map((t) => (
          <Link
            key={t.id}
            href={`/templates/${t.id}`}
            className="flex items-baseline justify-between gap-3 rounded-xl px-2 py-3 transition duration-75 hover:bg-black/5 active:scale-[0.97] active:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/15"
          >
            <span className="min-w-0 truncate font-medium">{t.name}</span>
            <span className="shrink-0 text-xs opacity-45">{t.items} упр.</span>
          </Link>
        ))}
      </section>

      <details className="rounded-2xl border border-dashed border-black/15 px-4 py-3 dark:border-white/20">
        <summary className="cursor-pointer text-sm opacity-60">Новый план</summary>
        <form action={createTemplate} className="mt-3 flex flex-col gap-2">
          <input
            name="name"
            required
            placeholder="Например «Грудь + бицепс»"
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
