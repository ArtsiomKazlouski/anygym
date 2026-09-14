import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: '.env.local' })

// Миграции идут через прямое (непулленное) соединение: пулер PgBouncer
// не держит сессионное состояние, которое нужно DDL-операциям.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL

if (!url) {
  throw new Error('DATABASE_URL_UNPOOLED / DATABASE_URL не найдены в .env.local')
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  casing: 'snake_case',
})
