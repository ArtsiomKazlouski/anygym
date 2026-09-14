'use client'

import { deleteSession } from '@/lib/session/actions'
import { SubmitButton } from '@/components/submit-button'

/**
 * Удаление необратимо и стирает подходы, по которым движок считает прогрессию.
 * Поэтому подтверждение называет, что именно исчезнет, а сама кнопка живёт
 * внутри тренировки: чтобы удалить, надо сначала открыть и увидеть содержимое.
 */
export function DeleteSession({ sessionId, summary }: { sessionId: string; summary: string }) {
  return (
    <form
      action={deleteSession}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Удалить тренировку ${summary}?\n\nПодходы исчезнут вместе с ней, и движок перестанет их учитывать. Отменить нельзя.`,
          )
        ) {
          event.preventDefault()
        }
      }}
      className="pt-6 text-center"
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <SubmitButton className="text-xs text-red-600/70 hover:text-red-600 dark:text-red-400/70 dark:hover:text-red-400">
        Удалить тренировку
      </SubmitButton>
    </form>
  )
}
