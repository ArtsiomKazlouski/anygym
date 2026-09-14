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

## Деплой

Vercel собирает по `git push` в `main` — GitHub Actions не нужны, секретов
в GitHub нет.

### Разовая настройка

1. **Vercel** → New Project → импортировать `ArtsiomKazlouski/anygym`.
   Next.js определится сам, настройки сборки менять не надо.

2. **Переменные окружения** проекта (Settings → Environment Variables),
   для всех сред:

   | Переменная | Откуда взять |
   |---|---|
   | `DATABASE_URL` | из `.env.local` — та же база Neon |
   | `DATABASE_URL_UNPOOLED` | из `.env.local` |
   | `AUTH_SECRET` | сгенерировать заново: `openssl rand -base64 33` |
   | `AUTH_GOOGLE_ID` | из `.env.local` |
   | `AUTH_GOOGLE_SECRET` | из `.env.local` |
   | `ALLOWED_EMAILS` | почты через запятую |

   `AUTH_SECRET` на проде должен отличаться от локального: это разные среды,
   и утечка одного не должна открывать другую.

   **`ALLOWED_EMAILS` обязателен.** Пустой список не пускает никого — приложение
   при потерянной переменной закрывается, а не открывается.

3. **Google Cloud Console** → APIs & Services → Credentials → OAuth client →
   Authorized redirect URIs, добавить рядом с локальным:

   ```
   https://<домен>.vercel.app/api/auth/callback/google
   ```

4. Redeploy. Если вход падает на колбэке — добавить `AUTH_TRUST_HOST=true`.

### Миграции

`.env.local` смотрит на ту же ветку Neon, что и прод. Значит миграции
применяются локально и попадают на прод сразу:

```bash
npm run db:generate   # сгенерировать из src/db/schema.ts
npm run db:migrate    # применить
```

Отдельного шага в сборке нет намеренно: билд запускается на каждый деплой,
и прогонять DDL оттуда — лишний способ выстрелить себе в ногу.

**Локальная разработка идёт на боевой базе.** Для приложения на одного человека
это осознанный выбор: одна история тренировок, никакой синхронизации между
средами. Если понадобится разделить — завести отдельную ветку Neon для локали
(`neon branch create`) и переключить на неё `.env.local`.

### Установка на телефон

Приложение отдаёт манифест и иконки, ставится с домашнего экрана как обычное
приложение и открывается без адресной строки. iOS: Поделиться → На экран
«Домой». Android: меню → Установить приложение.

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
