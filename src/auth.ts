import { DrizzleAdapter } from '@auth/drizzle-adapter'
import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { getDb } from './db'
import { authAccounts, authSessions, authUsers, authVerificationTokens } from './db/schema'

/**
 * Конфигурация собирается функцией, а не объектом.
 *
 * DrizzleAdapter обращается к клиенту базы прямо при создании, а сборка Next
 * импортирует этот модуль, чтобы собрать данные о роутах. В объектной форме
 * сборка падала без DATABASE_URL — хотя база нужна только в рантайме.
 *
 * Адаптеру отдаётся настоящий клиент, а не прокси из db: он определяет диалект
 * по типу объекта и на прокси отвечает «Unsupported database type (object)».
 */
export const { handlers, signIn, signOut, auth } = NextAuth(() => ({
  ...authConfig,
  adapter: DrizzleAdapter(getDb(), {
    usersTable: authUsers,
    accountsTable: authAccounts,
    sessionsTable: authSessions,
    verificationTokensTable: authVerificationTokens,
  }),
}))
