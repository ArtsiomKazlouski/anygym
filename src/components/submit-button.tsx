'use client'

import { useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { useActivity } from '@/components/activity'

/**
 * Кнопка отправки с откликом на касание и состоянием «работаю».
 *
 * Отклик нужен трёх разных видов, и все три по разным причинам.
 *
 * Мгновенный — на само касание, чистым CSS, без ожидания сети: палец
 * коснулся, кнопка вжалась. На время запроса — он идёт через сеть, и без
 * индикации экран выглядит мёртвым. И по завершении — иначе непонятно,
 * сохранилось ли: страница перерисовывается, но в зале на потном телефоне
 * это легко не заметить.
 *
 * Раньше занятость показывалась мерцанием (animate-pulse). Мерцание читается
 * как «кнопка выключена», а не как «идёт работа», и в зале его попросту
 * не видно. Теперь кнопка на время запроса становится зелёной, а поверх
 * экрана бежит полоса — её видно боковым зрением, куда бы ты ни смотрел.
 *
 * useFormStatus даёт pending на все кнопки формы сразу, поэтому нажатую
 * отличаем по отправленным данным: у формы с тремя кнопками фидбека
 * подсветиться должна одна.
 */
export function SubmitButton({
  children,
  className = '',
  busyClassName = '',
  name,
  value,
  ...rest
}: React.ComponentProps<'button'> & { busyClassName?: string }) {
  const { pending, data } = useFormStatus()
  const isThisOne = !name || value == null || data?.get(name) === String(value)
  const busy = pending && isThisOne
  const activity = useActivity()

  // Пока кнопка занята, о ней знает общий индикатор. Отписка срабатывает
  // и когда запрос дошёл, и когда кнопку снесло перерисовкой, — для полосы
  // наверху это одно и то же событие.
  useEffect(() => {
    if (!busy) return
    return activity.begin()
  }, [busy, activity])

  return (
    <button
      {...rest}
      type="submit"
      name={name}
      value={value}
      disabled={pending || rest.disabled}
      data-busy={busy || undefined}
      className={[
        className,
        'relative transition duration-75 active:scale-[0.97]',
        // Форма занята, но нажали не эту кнопку — гасим, чтобы было видно,
        // что запрос уже ушёл.
        pending && !busy ? 'opacity-35' : '',
        busy
          ? `bg-emerald-600! text-white! border-emerald-600! dark:bg-emerald-500! ${busyClassName}`
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  )
}
