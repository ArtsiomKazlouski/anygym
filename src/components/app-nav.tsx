import Link from 'next/link'

/**
 * Строка ссылок, а не выдвижное меню: разделов три, они помещаются в шапку.
 * Шторка добавила бы жест и состояние, не давая взамен ничего.
 */
const SECTIONS = [
  { href: '/', label: 'Тренировки' },
  { href: '/templates', label: 'Планы' },
  { href: '/exercises', label: 'Упражнения' },
  { href: '/gyms', label: 'Залы' },
] as const

export function AppNav({ current }: { current: string }) {
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 text-sm">
      {SECTIONS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className={
            'shrink-0 rounded-full px-3 py-1.5 transition duration-75 active:scale-95 ' +
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
