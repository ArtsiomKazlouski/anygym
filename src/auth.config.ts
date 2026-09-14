import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'

/**
 * Edge-безопасная часть конфигурации Auth.js: провайдеры, allowlist и колбэки.
 * Без адаптера БД — её импортирует middleware, который крутится на edge-рантайме
 * и не должен тянуть за собой драйвер Postgres.
 */

function allowlist(): string[] {
  return (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export const authConfig = {
  providers: [Google],
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin' },
  callbacks: {
    /** Пускаем только почты из ALLOWED_EMAILS. Пустой список = не пускаем никого. */
    signIn({ user }) {
      const email = user.email?.toLowerCase()
      const allowed = allowlist()
      if (!email || allowed.length === 0) return false
      return allowed.includes(email)
    },
    authorized({ auth }) {
      return Boolean(auth?.user)
    },
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id
      return token
    },
    session({ session, token }) {
      if (typeof token.uid === 'string') session.user.id = token.uid
      return session
    },
  },
} satisfies NextAuthConfig
