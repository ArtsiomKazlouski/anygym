import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

type Db = ReturnType<typeof drizzle<typeof schema>>

let instance: Db | null = null

function connectionString(): string {
  const raw = process.env.DATABASE_URL

  if (!raw || raw.trim() === '') {
    throw new Error(
      'DATABASE_URL не задан. Локально он подтягивается командой `neon link`, ' +
        'на Vercel задаётся в Settings -> Environment Variables.',
    )
  }

  const url = raw.trim()

  // Самая частая ошибка при вставке в панель Vercel — кавычки вокруг значения
  // или скопированный вместе со значением префикс `DATABASE_URL=`.
  if (/^["']|["']$/.test(url)) {
    throw new Error('DATABASE_URL взят в кавычки. В панели Vercel кавычки не нужны.')
  }
  if (url.startsWith('DATABASE_URL=')) {
    throw new Error(
      'В DATABASE_URL попало имя переменной. Нужно только значение, после знака =.',
    )
  }
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw new Error(
      `DATABASE_URL не похож на строку подключения Postgres: ожидается postgresql://…, ` +
        `а начинается на «${url.slice(0, 12)}…».`,
    )
  }

  return url
}

/**
 * Подключение создаётся при первом обращении, а не при импорте модуля.
 *
 * Сборка Next импортирует роуты, чтобы собрать о них данные. Если клиент
 * создавался на верхнем уровне, сборка падала при отсутствующем или битом
 * DATABASE_URL — хотя база нужна только в рантайме. Сборка не должна зависеть
 * от боевого секрета.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    instance ??= drizzle(neon(connectionString()), { schema })
    const value = Reflect.get(instance, prop, instance)
    return typeof value === 'function' ? value.bind(instance) : value
  },
})

export { schema }
