/**
 * Скелет на время перехода.
 *
 * Страница тренировки рендерится на сервере: между тапом по ссылке
 * и появлением экрана есть заметная пауза, в которую раньше не происходило
 * ничего. Вжатие ссылки тут не помогает — нужен именно немедленный отклик
 * на уровне маршрута.
 *
 * Полоса сверху та же, что и у серверных действий: один и тот же знак
 * «приложение занято» на все случаи, чтобы его не приходилось узнавать
 * заново. Она на чистом CSS и не ждёт ни гидратации, ни JS вообще.
 */
export default function Loading() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 z-50 h-1 overflow-hidden"
        style={{ top: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="anygym-running h-full bg-emerald-500" />
      </div>
      <main className="mx-auto flex min-h-dvh w-full max-w-md animate-pulse flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="h-5 w-28 rounded bg-black/10 dark:bg-white/15" />
          <div className="h-8 w-24 rounded-full bg-black/10 dark:bg-white/15" />
        </div>
        <div className="h-6 w-44 rounded bg-black/10 dark:bg-white/15" />

        <div className="mt-2 h-44 rounded-2xl bg-black/5 dark:bg-white/10" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-2xl bg-black/5 dark:bg-white/10" />
        ))}
      </main>
    </>
  )
}
