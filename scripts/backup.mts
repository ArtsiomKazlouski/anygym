/**
 * Дамп всех таблиц в один JSON-файл.
 *
 * Не экспорт для человека, а страховка перед миграцией: снимок ровно того,
 * что лежит в базе, в том же виде, в каком его можно залить обратно.
 * Фото тренажёров — bytea, поэтому они кодируются base64.
 *
 * Запуск: npm run db:backup [путь]
 */
import { neon } from '@neondatabase/serverless'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL не задан (нужен .env.local)')

const query = neon(url)

// Порядок важен: при восстановлении таблицы заливаются сверху вниз,
// и ссылающаяся таблица не должна идти раньше той, на которую ссылается.
const TABLES = [
  'auth_user',
  'auth_account',
  'auth_session',
  'auth_verification_token',
  'equipment_model',
  'gym',
  'gym_equipment',
  'equipment_setup',
  'exercise',
  'template',
  'template_item',
  'workout_session',
  'session_item',
  'set_log',
]

const existing = new Set<string>(
  (
    (await query.query(
      `select table_name from information_schema.tables where table_schema = 'public'`,
    )) as { table_name: string }[]
  ).map((r) => r.table_name),
)

const dump: Record<string, unknown[]> = {}
for (const table of TABLES) {
  if (!existing.has(table)) continue
  const rows = (await query.query(`select * from ${table}`)) as Record<string, unknown>[]
  dump[table] = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [
        k,
        Buffer.isBuffer(v) ? { $bytea: v.toString('base64') } : v,
      ]),
    ),
  )
  console.log(`${table}: ${rows.length}`)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
const out = resolve(process.argv[2] ?? `backups/${stamp}.json`)
await mkdir(dirname(out), { recursive: true })
await writeFile(
  out,
  JSON.stringify({ takenAt: new Date().toISOString(), tables: dump }, null, 2),
)
console.log(`\n${out}`)
