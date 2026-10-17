'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/**
 * Общий индикатор работы: полоса поверх экрана, пока идёт серверное действие,
 * и зелёная вспышка, когда оно закончилось.
 *
 * Почему это живёт в разметке страницы, а не внутри кнопки. Кнопка знает
 * про своё действие через useFormStatus, но она же и перерождается в ответ
 * на него: карточка упражнения пересоздаёт форму после каждого записанного
 * подхода, чтобы поля не остались со старыми значениями. Состояние «готово»
 * внутри кнопки умирало бы ровно в тот момент, когда его надо показать.
 * Поэтому счётчик держится здесь, снаружи, и переживает любые перерисовки.
 */
type Activity = { begin: () => () => void }

const ActivityContext = createContext<Activity | null>(null)

export function useActivity(): Activity {
  // Кнопка может оказаться вне провайдера (тест, изолированный рендер) —
  // тогда она просто не сообщает ни о чём.
  return useContext(ActivityContext) ?? NOOP
}

const NOOP: Activity = { begin: () => () => {} }

export function ActivityProvider({ children }: { children: ReactNode }) {
  const [busy, setBusy] = useState(0)
  const [done, setDone] = useState(false)
  const previous = useRef(0)

  const begin = useCallback(() => {
    setBusy((n) => n + 1)
    let released = false
    return () => {
      if (released) return
      released = true
      setBusy((n) => Math.max(0, n - 1))
    }
  }, [])

  // Переход «было занято → свободно» и есть момент, когда действие дошло.
  useEffect(() => {
    const wasBusy = previous.current > 0
    previous.current = busy
    if (!wasBusy || busy > 0) return
    setDone(true)
    const timer = setTimeout(() => setDone(false), 900)
    return () => clearTimeout(timer)
  }, [busy])

  return (
    <ActivityContext.Provider value={{ begin }}>
      <ActivityBar busy={busy > 0} done={done} />
      {children}
    </ActivityContext.Provider>
  )
}

/**
 * Полоса в самом верху экрана. Пока запрос идёт — бегущий отрезок, потому что
 * сколько он займёт, никто не знает. Дошёл — полоса на всю ширину и гаснет.
 *
 * Поверх выреза и чёлки: отступ берётся из безопасной зоны, иначе на телефоне
 * полоса прячется под часами.
 */
function ActivityBar({ busy, done }: { busy: boolean; done: boolean }) {
  if (!busy && !done) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 z-50 h-1.5 overflow-hidden"
      style={{ top: 'env(safe-area-inset-top, 0px)' }}
    >
      <div
        className={'h-full bg-emerald-500 ' + (busy ? 'anygym-running' : 'anygym-done w-full')}
      />
    </div>
  )
}
