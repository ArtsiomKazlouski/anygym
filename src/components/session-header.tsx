import { finishSession } from '@/lib/session/actions'

export function SessionHeader({
  session,
}: {
  session: { id: string; gymName: string; startedAt: Date }
}) {
  const started = new Intl.DateTimeFormat('ru', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(session.startedAt)

  return (
    <header className="flex items-center justify-between gap-3 pb-1">
      <div>
        <div className="text-lg font-semibold tracking-tight">{session.gymName}</div>
        <div className="text-xs opacity-50">начата в {started}</div>
      </div>
      <form action={finishSession}>
        <input type="hidden" name="sessionId" value={session.id} />
        <button
          type="submit"
          className="rounded-full border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          Завершить
        </button>
      </form>
    </header>
  )
}
