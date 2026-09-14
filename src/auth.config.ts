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
  session: {
    strategy: 'jwt',
    /*
     * 180 дней вместо стандартных 30.
     *
     * Установленное приложение на iOS держит куки в собственном хранилище,
     * изолированном от Safari, — сессию браузера подхватить нельзя, вход
     * делается внутри приложения. Разово это терпимо, но после долгого
     * перерыва пришлось бы вводить пароль Google с телефона заново, причём
     * ровно в тот момент, когда возвращаешься в зал.
     *
     * Кука продлевается при каждом заходе, так что при обычном использовании
     * срок не наступает никогда. Риск ограничен: вход и так закрыт списком
     * разрешённых почт, а внутри — журнал тренировок.
     */
    maxAge: 60 * 60 * 24 * 180,
  },
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
