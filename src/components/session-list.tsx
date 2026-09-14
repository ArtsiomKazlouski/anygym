import Link from 'next/link'

type Row = {
  id: string
  startedAt: Date
  endedAt: Date | null
  gymName: string
  templateName: string | null
  sets: number
}

const dayFormat = new Intl.DateTimeFormat('ru', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function SessionRow({ row, primary }: { row: Row; primary?: boolean }) {
  const live = row.endedAt == null
  const meta = [
    row.gymName,
    row.templateName,
    `${row.sets} ${plural(row.sets, 'подход', 'подхода', 'подходов')}`,
  ]
    .filter(Boolean)
    .join(' · ')

  if (primary) {
    return (
      <Link
        href={`/session/${row.id}`}
        className={
          'block rounded-2xl px-5 py-4 text-white transition duration-75 active:scale-[0.99] dark:text-black ' +
          (live ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-black dark:bg-white')
        }
      >
        <div className="text-base font-medium">
          {live ? 'Продолжить тренировку' : 'Последняя тренировка'}
        </div>
        <div className="mt-0.5 text-xs opacity-70">
          {dayFormat.format(row.startedAt)} · {meta}
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={`/session/${row.id}`}
      className="flex items-baseline justify-between gap-3 rounded-xl px-1 py-2 transition duration-75 hover:bg-black/5 active:scale-[0.99] dark:hover:bg-white/10"
    >
      <span className="shrink-0 text-sm tabular-nums">{dayFormat.format(row.startedAt)}</span>
      <span className="min-w-0 flex-1 truncate text-right text-xs opacity-50">
        {live && (
          <span className="text-emerald-600 dark:text-emerald-400">не завершена · </span>
        )}
        {meta}
      </span>
    </Link>
  )
}
