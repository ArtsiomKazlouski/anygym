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
 * Настоящий клиент. Создаётся при первом вызове, а не при импорте модуля:
 * сборка Next импортирует роуты, чтобы собрать о них данные, и не должна
 * зависеть от боевого секрета.
 *
 * Нужен там, где объект базы отдаётся библиотеке, которая его типизирует:
 * DrizzleAdapter определяет диалект по типу объекта, и прокси эту проверку
 * не проходит.
 */
export function getDb(): Db {
  instance ??= drizzle(neon(connectionString()), { schema })
  return instance
}

/**
 * Прокси для прикладного кода: `db.select()` читается привычнее, чем
 * `getDb().select()`, а отложенность сохраняется.
 *
 * Трап getPrototypeOf обязателен — без него `instanceof` видит пустой объект,
 * и библиотеки, проверяющие тип, падают.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb()
    const value = Reflect.get(real, prop, real)
    return typeof value === 'function' ? value.bind(real) : value
  },
  getPrototypeOf() {
    return Object.getPrototypeOf(getDb())
  },
  has(_target, prop) {
    return prop in getDb()
  },
})

export { schema }
