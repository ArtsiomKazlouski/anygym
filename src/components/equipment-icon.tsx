import type { equipmentModels } from '@/db/schema'

type Kind = (typeof equipmentModels.$inferSelect)['kind']

/**
 * Значок по типу железки — вместо пустого места, пока нет фото.
 *
 * Линейные, в один цвет: значок должен читаться и в светлой теме, и в тёмной,
 * и в миниатюре размером с ноготь. Это заглушка, а не иллюстрация — узнавать
 * конкретную машину по нему нельзя, для этого есть фото.
 */
const PATHS: Record<Kind, React.ReactNode> = {
  barbell: (
    <>
      <path d="M2 12h20" />
      <rect x="4.5" y="7.5" width="2.6" height="9" rx="1" />
      <rect x="16.9" y="7.5" width="2.6" height="9" rx="1" />
      <rect x="1.2" y="9.8" width="2" height="4.4" rx="0.8" />
      <rect x="20.8" y="9.8" width="2" height="4.4" rx="0.8" />
    </>
  ),
  // Головки массивные, гриф короткий: с пропорциями штанги гантели
  // в миниатюре от неё не отличить.
  dumbbell: (
    <>
      <path d="M8.5 12h7" />
      <rect x="2" y="5.5" width="6.5" height="13" rx="2.6" />
      <rect x="15.5" y="5.5" width="6.5" height="13" rx="2.6" />
    </>
  ),
  stack: (
    <>
      <rect x="4" y="4.5" width="11" height="3" rx="1" />
      <rect x="4" y="9" width="11" height="3" rx="1" />
      <rect x="4" y="13.5" width="11" height="3" rx="1" />
      <rect x="4" y="18" width="11" height="3" rx="1" />
      <path d="M19 3.5v17" />
    </>
  ),
  plate_loaded: (
    <>
      <circle cx="8" cy="12" r="6" />
      <circle cx="8" cy="12" r="1.6" />
      <path d="M14 12h8" />
      <rect x="20" y="9.5" width="2" height="5" rx="0.8" />
    </>
  ),
  // Стойка с балкой, блок, трос и рукоять: без стойки глиф читался
  // как леденец, а не как тренажёр.
  cable: (
    <>
      <path d="M3.5 3v18" />
      <path d="M3.5 4.5h12" />
      <circle cx="15.5" cy="6.8" r="2.1" />
      <path d="M15.5 8.9v6.6" />
      <path d="M12 15.5h7" />
      <path d="M13 15.5v2.6M18 15.5v2.6" />
    </>
  ),
  bodyweight: (
    <>
      <path d="M3 4.5h18" />
      <path d="M9 4.5v3.5M15 4.5v3.5" />
      <circle cx="12" cy="10.5" r="2.2" />
      <path d="M12 12.7v4.6" />
      <path d="M12 17.3 9 21M12 17.3 15 21" />
    </>
  ),
}

export function EquipmentIcon({ kind, className = '' }: { kind: Kind; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[kind]}
    </svg>
  )
}

/** Плашка-заглушка: значок на приглушённом фоне, размером с фото. */
export function EquipmentThumb({ kind, className = '' }: { kind: Kind; className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-lg bg-black/5 dark:bg-white/10 ${className}`}
    >
      <EquipmentIcon kind={kind} className="size-1/2 opacity-40" />
    </span>
  )
}
