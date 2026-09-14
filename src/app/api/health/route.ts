import { sql } from 'drizzle-orm'
import { db } from '@/db'

/**
 * Диагностика деплоя: что доехало до рантайма.
 *
 * Отдаёт только факт наличия переменной, никогда значение. Про базу — только
 * «ok» либо короткую причину; текст ошибки драйвера наружу не пускаем, в нём
 * может оказаться часть строки подключения.
 */
export const dynamic = 'force-dynamic'

const REQUIRED = [
  'DATABASE_URL',
  'AUTH_SECRET',
  'AUTH_GOOGLE_ID',
  'AUTH_GOOGLE_SECRET',
  'ALLOWED_EMAILS',
] as const

export async function GET() {
  const env = Object.fromEntries(
    REQUIRED.map((key) => [key, Boolean(process.env[key]?.trim())]),
  )

  let database = 'ok'
  try {
    await db.execute(sql`select 1`)
  } catch (error) {
    database = error instanceof Error ? error.message.slice(0, 120) : 'unknown error'
  }

  const ok = Object.values(env).every(Boolean) && database === 'ok'
  return Response.json({ ok, env, database }, { status: ok ? 200 : 503 })
}
