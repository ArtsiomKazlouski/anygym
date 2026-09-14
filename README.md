# anygym

Трекер тренировок для тех, кто ходит по разным залам.

Килограммы на грузоблоке одного производителя не сравнимы с килограммами на другом.
Поэтому anygym не пересчитывает вес между тренажёрами — он ведёт историю по **модели
оборудования** и переносит между залами только относительную нагрузку: целевые повторы,
запас и шаг прогрессии. Плюс помнит, как настроить каждую железку под тебя.

Проектные решения и алгоритм движка веса: [docs/DESIGN.md](docs/DESIGN.md).

## Стек

| Слой | Что |
|---|---|
| Приложение | Next.js 16 (App Router), React 19, Tailwind 4 |
| База | Neon Postgres + Drizzle ORM |
| Вход | Auth.js v5, Google, доступ по allowlist |
| Хостинг | Vercel, деплой через Git-интеграцию |

## Запуск

```bash
npm install
npm run dev
```

Нужен заполненный `.env.local` — образец в [.env.example](.env.example).

`DATABASE_URL` и `DATABASE_URL_UNPOOLED` подтягиваются автоматически:

```bash
neon link --project-id <id> --branch production
```

`AUTH_GOOGLE_ID` и `AUTH_GOOGLE_SECRET` заводятся вручную в Google Cloud Console
(APIs & Services → Credentials → OAuth client ID → Web application). Redirect URI:

```
http://localhost:3000/api/auth/callback/google
https://<домен>/api/auth/callback/google
```

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | Дев-сервер |
| `npm run build` | Продакшн-сборка |
| `npm run typecheck` | Проверка типов без сборки |
| `npm run lint` | ESLint |
| `npm run db:generate` | Сгенерировать миграцию из `src/db/schema.ts` |
| `npm run db:migrate` | Применить миграции |
| `npm run db:seed` | Залить справочник паттернов |
| `npm run db:studio` | Drizzle Studio |

## Доступ

Вход ограничен списком `ALLOWED_EMAILS`. **Пустой список не пускает никого** — это
намеренно: при потерянной переменной окружения приложение закрывается, а не открывается.

## Структура

```
src/
  app/            маршруты App Router
  auth.ts         Auth.js с адаптером Drizzle
  auth.config.ts  edge-безопасная часть конфигурации (её берёт proxy.ts)
  proxy.ts        проверка входа на каждом запросе (бывший middleware)
  db/
    schema.ts     схема БД — реализует docs/DESIGN.md, раздел 4
    index.ts      клиент Drizzle поверх Neon
  lib/
    patterns.ts   справочник паттернов движений
drizzle/          сгенерированные миграции
scripts/          обслуживающие скрипты
docs/DESIGN.md    схема данных и движок веса
```
