'use client'

import { useFormStatus } from 'react-dom'

/**
 * Кнопка отправки с откликом на касание и состоянием «работаю».
 *
 * Отклик нужен двух разных видов. Мгновенный — на само касание, чистым CSS,
 * без ожидания сети: палец коснулся, кнопка вжалась. И на время запроса —
 * серверное действие идёт через сеть, и без индикации экран выглядит мёртвым.
 *
 * useFormStatus даёт pending на все кнопки формы сразу, поэтому нажатую
 * отличаем по отправленным данным: у формы с четырьмя кнопками фидбека
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
        'transition duration-75 active:scale-[0.97]',
        // Форма занята, но нажали не эту кнопку — гасим, чтобы было видно,
        // что запрос уже ушёл.
        pending && !busy ? 'opacity-35' : '',
        busy ? `animate-pulse ${busyClassName}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  )
}
