import { auth, signOut } from '@/auth'

export default async function Home() {
  const session = await auth()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">anygym</h1>
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/signin' })
          }}
        >
          <button
            type="submit"
            className="text-sm text-black/50 underline-offset-4 hover:underline dark:text-white/50"
          >
            Выйти
          </button>
        </form>
      </header>

      <p className="text-sm text-black/60 dark:text-white/60">
        Вход выполнен: {session?.user?.email}
      </p>

      <p className="text-sm text-black/40 dark:text-white/40">
        Каркас поднят. Дальше: залы, карточки оборудования, движок веса.
      </p>
    </main>
  )
}
