'use client'

import { SubmitButton } from '@/components/submit-button'
import { signOutAction } from '@/lib/auth-actions'

/**
 * Выход с подтверждением.
 *
 * Кнопка перенесена вниз и приглушена, но цена промаха остаётся высокой:
 * в установленном приложении вход заново идёт через Google, где нет ни
 * адресной строки, ни автозаполнения. Один вопрос дешевле.
 */
export function SignOut({ email }: { email: string | null | undefined }) {
  return (
    <form
      action={signOutAction}
      onSubmit={(event) => {
        if (!window.confirm('Выйти из аккаунта?\n\nВойти снова придётся через Google.')) {
          event.preventDefault()
        }
      }}
      className="pb-2 text-center"
    >
      <SubmitButton className="text-xs opacity-30 hover:opacity-70">
        Выйти{email ? ` из ${email}` : ''}
      </SubmitButton>
    </form>
  )
}
