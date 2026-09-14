/**
 * Наполняет справочник паттернов из src/lib/patterns.ts.
 * Идемпотентно: повторный запуск обновляет названия и порядок, ничего не дублируя.
 *
 * Запуск: npm run db:seed
 */
import { neon } from '@neondatabase/serverless'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'
import { patterns } from '../src/db/schema.ts'
import { PATTERNS } from '../src/lib/patterns.ts'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL не задан (нужен .env.local)')

const db = drizzle(neon(url))

const rows = PATTERNS.map((p, i) => ({
  code: p.code,
  title: p.title,
  muscleGroup: p.muscleGroup,
  position: i,
}))

await db
  .insert(patterns)
  .values(rows)
  .onConflictDoUpdate({
    target: patterns.code,
    set: {
      title: sql`excluded.title`,
      muscleGroup: sql`excluded.muscle_group`,
      position: sql`excluded.position`,
    },
  })

console.log(`Паттернов записано: ${rows.length}`)
