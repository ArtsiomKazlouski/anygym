/**
 * Схема БД anygym. Реализует docs/DESIGN.md, раздел 4.
 *
 * Соглашения:
 *  - в БД snake_case, в TypeScript camelCase;
 *  - вся математика движка идёт в weightKg; weight/units хранятся,
 *    чтобы показать пользователю то же число, что написано на стеке;
 *  - таблицы Auth.js имеют префикс auth_, чтобы не путать сессию входа
 *    с сессией тренировки.
 */
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import type { AdapterAccountType } from 'next-auth/adapters'

/** Postgres bytea — превью фото тренажёра (WebP, длинная сторона <= 400px). */
const bytea = customType<{ data: Buffer; default: false }>({
  dataType: () => 'bytea',
})

/* ------------------------------------------------------------------ *
 * Перечисления
 * ------------------------------------------------------------------ */

export const equipmentKind = pgEnum('equipment_kind', [
  'stack',
  'plate_loaded',
  'dumbbell',
  'barbell',
  'cable',
  'bodyweight',
])

export const weightUnits = pgEnum('weight_units', ['kg', 'lb'])

export const sessionItemStatus = pgEnum('session_item_status', [
  'pending',
  'active',
  'done',
  'deferred',
  'skipped',
])

export const setKind = pgEnum('set_kind', ['warmup', 'working'])

/** Четыре кнопки после подхода. Маппинг в RIR — в движке, не в БД. */
export const setFeedback = pgEnum('set_feedback', [
  'easy', // мог ещё 3+
  'on_target', // ещё 1-2
  'limit', // на пределе
  'failed', // не добил
])

/** Откуда взялся предложенный вес — нужно, чтобы потом оценить движок. */
export const prescriptionSource = pgEnum('prescription_source', [
  'history',
  'probe',
  'manual',
  'deload',
  'pain_backoff',
])

/* ------------------------------------------------------------------ *
 * Auth.js
 * ------------------------------------------------------------------ */

export const authUsers = pgTable('auth_user', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const authAccounts = pgTable(
  'auth_account',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
)

export const authSessions = pgTable('auth_session', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
})

export const authVerificationTokens = pgTable(
  'auth_verification_token',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
)

/* ------------------------------------------------------------------ *
 * Справочник паттернов (сидится из src/lib/patterns.ts)
 * ------------------------------------------------------------------ */

export const patterns = pgTable('pattern', {
  code: text('code').primaryKey(),
  title: text('title').notNull(),
  muscleGroup: text('muscle_group').notNull(),
  position: integer('position').notNull().default(0),
})

/* ------------------------------------------------------------------ *
 * Оборудование
 * ------------------------------------------------------------------ */

/**
 * Модель железки — то, что пользователь узнаёт в лицо.
 * Прогрессия висит здесь, а не на зале: одна модель может стоять в трёх залах.
 */
export const equipmentModels = pgTable(
  'equipment_model',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    brand: text('brand'),
    kind: equipmentKind('kind').notNull(),
    patternCode: text('pattern_code')
      .notNull()
      .references(() => patterns.code),
    units: weightUnits('units').notNull().default('kg'),
    /** Шаг дискретизации для stack / plate_loaded / cable. */
    step: numeric('step', { precision: 7, scale: 2, mode: 'number' }),
    minWeight: numeric('min_weight', {
      precision: 7,
      scale: 2,
      mode: 'number',
    }),
    maxWeight: numeric('max_weight', {
      precision: 7,
      scale: 2,
      mode: 'number',
    }),
    /** Явный ряд весов — для гантелей, где шаг неравномерный. */
    ladder: numeric('ladder', {
      precision: 7,
      scale: 2,
      mode: 'number',
    }).array(),
    /** Вес грифа для barbell. */
    barWeight: numeric('bar_weight', {
      precision: 7,
      scale: 2,
      mode: 'number',
    }),
    photo: bytea('photo'),
    photoMime: text('photo_mime'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('equipment_model_user_pattern_idx').on(t.userId, t.patternCode)],
)

export const gyms = pgTable('gym', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  note: text('note'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Экземпляр модели в конкретном зале.
 * Здесь же переопределения: тот же модельный ряд бывает со стеком в фунтах,
 * а гантельный ряд у каждого зала свой.
 */
export const gymEquipment = pgTable(
  'gym_equipment',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'cascade' }),
    equipmentModelId: uuid('equipment_model_id')
      .notNull()
      .references(() => equipmentModels.id, { onDelete: 'cascade' }),
    locationNote: text('location_note'),
    unitsOverride: weightUnits('units_override'),
    stepOverride: numeric('step_override', {
      precision: 7,
      scale: 2,
      mode: 'number',
    }),
    minOverride: numeric('min_override', {
      precision: 7,
      scale: 2,
      mode: 'number',
    }),
    maxOverride: numeric('max_override', {
      precision: 7,
      scale: 2,
      mode: 'number',
    }),
    ladderOverride: numeric('ladder_override', {
      precision: 7,
      scale: 2,
      mode: 'number',
    }).array(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('gym_equipment_unique').on(t.gymId, t.equipmentModelId),
    index('gym_equipment_gym_idx').on(t.gymId),
    index('gym_equipment_model_idx').on(t.equipmentModelId),
  ],
)

/**
 * Запомненные настройки тренажёра.
 * По умолчанию на модель (разметка сиденья на одинаковых железках совпадает),
 * при необходимости переопределяются для конкретного экземпляра.
 */
export const equipmentSetups = pgTable(
  'equipment_setup',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    equipmentModelId: uuid('equipment_model_id')
      .notNull()
      .references(() => equipmentModels.id, { onDelete: 'cascade' }),
    /** null = настройка на модель вообще, иначе — на экземпляр в зале. */
    gymEquipmentId: uuid('gym_equipment_id').references(() => gymEquipment.id, {
      onDelete: 'cascade',
    }),
    /** { "seat": "4", "back": "2", "grip": "широкий" } */
    settings: jsonb('settings').$type<Record<string, string>>().notNull().default({}),
    note: text('note'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('equipment_setup_unique').on(t.userId, t.equipmentModelId, t.gymEquipmentId)],
)

/* ------------------------------------------------------------------ *
 * Шаблоны тренировок
 * ------------------------------------------------------------------ */

export const templates = pgTable('template', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Пункт шаблона написан в терминах паттерна, а не железки — иначе он
 * не переносится между залами. Список альтернатив не хранится: он
 * вычисляется как «всё оборудование текущего зала с тем же паттерном»
 * минус excludedModelIds.
 */
export const templateItems = pgTable(
  'template_item',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    patternCode: text('pattern_code')
      .notNull()
      .references(() => patterns.code),
    /** Привычная железка — поднимается в списке наверх. */
    preferredModelId: uuid('preferred_model_id').references(() => equipmentModels.id, {
      onDelete: 'set null',
    }),
    /** «Никогда не предлагай мне этот кроссовер». */
    excludedModelIds: uuid('excluded_model_ids').array().notNull().default([]),
    sets: integer('sets').notNull().default(3),
    repMin: integer('rep_min').notNull().default(8),
    repMax: integer('rep_max').notNull().default(12),
    note: text('note'),
  },
  (t) => [index('template_item_template_idx').on(t.templateId, t.position)],
)

/* ------------------------------------------------------------------ *
 * Тренировки
 * ------------------------------------------------------------------ */

export const workoutSessions = pgTable(
  'workout_session',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'restrict' }),
    /** null = тренировка без шаблона. */
    templateId: uuid('template_id').references(() => templates.id, {
      onDelete: 'set null',
    }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    note: text('note'),
  },
  (t) => [index('workout_session_user_started_idx').on(t.userId, t.startedAt)],
)

export const sessionItems = pgTable(
  'session_item',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => workoutSessions.id, { onDelete: 'cascade' }),
    /** Перестраивается, когда пункт откладывается кнопкой «занято». */
    position: integer('position').notNull(),
    /** null = упражнение добавлено на ходу, вне шаблона. */
    templateItemId: uuid('template_item_id').references(() => templateItems.id, {
      onDelete: 'set null',
    }),
    patternCode: text('pattern_code')
      .notNull()
      .references(() => patterns.code),
    /** Выбранная железка; null, пока пользователь не выбрал. */
    gymEquipmentId: uuid('gym_equipment_id').references(() => gymEquipment.id, {
      onDelete: 'set null',
    }),
    status: sessionItemStatus('status').notNull().default('pending'),
    targetSets: integer('target_sets').notNull(),
    repMin: integer('rep_min').notNull(),
    repMax: integer('rep_max').notNull(),
    deferredCount: integer('deferred_count').notNull().default(0),
  },
  (t) => [
    index('session_item_session_idx').on(t.sessionId, t.position),
    index('session_item_equipment_idx').on(t.gymEquipmentId),
  ],
)

export const setLogs = pgTable(
  'set_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionItemId: uuid('session_item_id')
      .notNull()
      .references(() => sessionItems.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    kind: setKind('kind').notNull().default('working'),
    /** Как написано на стеке — это число пользователь видит и выставляет. */
    weight: numeric('weight', {
      precision: 7,
      scale: 2,
      mode: 'number',
    }).notNull(),
    units: weightUnits('units').notNull(),
    /** Нормализовано. Вся математика движка идёт по этой колонке. */
    weightKg: numeric('weight_kg', {
      precision: 7,
      scale: 2,
      mode: 'number',
    }).notNull(),
    reps: integer('reps'),
    /** null для разминочных подходов — они не участвуют в прогрессии. */
    feedback: setFeedback('feedback'),
    /** null, если боли не было. */
    painZone: text('pain_zone'),
    /** Что предложил движок — хранится, чтобы потом его откалибровать. */
    prescribedWeightKg: numeric('prescribed_weight_kg', {
      precision: 7,
      scale: 2,
      mode: 'number',
    }),
    prescriptionSource: prescriptionSource('prescription_source'),
    loggedAt: timestamp('logged_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('set_log_item_idx').on(t.sessionItemId, t.position),
    index('set_log_kind_logged_idx').on(t.kind, t.loggedAt),
  ],
)
