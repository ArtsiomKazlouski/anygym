import { signIn } from '@/auth'
import { SubmitButton } from '@/components/submit-button'

export default function SignInPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">anygym</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Тренировки в любом зале, вес — по твоей истории
        </p>
      </div>

      <form
        action={async () => {
          'use server'
          await signIn('google', { redirectTo: '/' })
        }}
      >
        <SubmitButton className="rounded-full border border-black/10 px-6 py-3 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
          Войти через Google
        </SubmitButton>
      </form>
    </main>
  )
}
