import Link from 'next/link'

/**
 * Разделов пока два, поэтому это строка ссылок, а не выдвижное меню:
 * шторка с двумя пунктами добавляет жест и состояние, не давая ничего.
 */
const SECTIONS = [
  { href: '/', label: 'Тренировки' },
  { href: '/gyms', label: 'Залы' },
] as const

export function AppNav({ current }: { current: string }) {
  return (
    <nav className="flex gap-1 text-sm">
      {SECTIONS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className={
            'rounded-full px-3 py-1.5 transition duration-75 active:scale-95 ' +
            (s.href === current
              ? 'bg-black text-white dark:bg-white dark:text-black'
              : 'opacity-50')
          }
        >
          {s.label}
        </Link>
      ))}
    </nav>
  )
}
