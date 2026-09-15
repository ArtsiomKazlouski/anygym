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
import { MUSCLE_CODES } from '../lib/muscles'

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

/**
 * Мышечная группа упражнения. Список и подписи — в src/lib/muscles.ts.
 * Дописывать значения можно только в конец: порядок хранится в типе.
 */
export const muscleGroup = pgEnum('muscle_group', MUSCLE_CODES)

export const sessionItemStatus = pgEnum('session_item_status', [
  'pending',
  'active',
  'done',
  'deferred',
  'skipped',
])

export const setKind = pgEnum('set_kind', ['warmup', 'ramp', 'working'])

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
  // Заявленного веса больше нет: число приходилось угадывать заранее, вне зала.
  // Значение оставлено — на него ссылаются старые записи.
  'declared',
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
    units: weightUnits('units').notNull().default('kg'),
    /** Шаг дискретизации для stack / plate_loaded / cable. */
    step: numeric('step', { precision: 7, scale: 2, mode: 'number' }),
    /**
     * Шаг для подводящих и разминочных подходов, если он грубее рабочего.
     * Штанга растёт по 2.5, но вешать 82.5 ради разминки — возня с блинами
     * по 1.25 на сторону. Пусто — берётся step.
     */
    rampStep: numeric('ramp_step', { precision: 7, scale: 2, mode: 'number' }),
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
  (t) => [index('equipment_model_user_idx').on(t.userId)],
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
    rampStepOverride: numeric('ramp_step_override', {
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

/**
 * Упражнение — то, на чём висит прогрессия.
 *
 * Железка сама по себе недостаточна: на одних и тех же гантелях делается
 * и жим под 45°, и жим под 30°, и бицепс, и молоточки — рабочие веса у них
 * разные, и слипаться их истории не должны. Поэтому ключ прогрессии — это
 * упражнение, а не модель оборудования.
 */
export const exercises = pgTable(
  'exercise',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    /** Как ты его называешь: «жим гантелей под наклоном 45°». */
    name: text('name').notNull(),
    /**
     * Какая мышца главная. Нужна для отката за паузу и для счёта объёма —
     * заменой упражнений группа не занимается, для этого она слишком груба.
     */
    muscleGroup: muscleGroup('muscle_group').notNull(),
    equipmentModelId: uuid('equipment_model_id')
      .notNull()
      .references(() => equipmentModels.id, { onDelete: 'cascade' }),
    /**
     * Целевые повторы — свойство упражнения, а не плана.
     * «Тяга гантелей — двенадцать» верно в любом плане и в любом зале;
     * то, что вышло десять, — результат, а не другая цель.
     */
    targetReps: integer('target_reps').notNull().default(12),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('exercise_user_muscle_idx').on(t.userId, t.muscleGroup),
    index('exercise_model_idx').on(t.equipmentModelId),
  ],
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
 * Пункт шаблона — это упражнение и то, как его делать: подводка и рабочие
 * подходы.
 *
 * Схемы («прямая» / «рампа») больше нет: это были не два способа, а один
 * с пустой подводкой и один с непустой. Рабочих подходов всегда хотя бы один,
 * подводки может не быть вовсе.
 *
 * Упражнение названо прямо, а не выведено из группы: подстановка «чего-нибудь
 * на грудь» вместо занятого тренажёра давала не замену, а другое упражнение.
 * Если в зале занято — пункт убирается руками, на его место добавляется другой.
 */
export const templateItems = pgTable(
  'template_item',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    /** Сколько рабочих подходов — все на одном весе. */
    sets: integer('sets').notNull().default(3),
    /* Целевых повторов здесь нет: это свойство упражнения (exercise.target_reps). */
    /**
     * Подводка: доли рабочего веса по возрастанию, все строго меньше 1.
     * Пусто — упражнение начинается сразу с рабочего веса.
     *
     * Долями, а не килограммами, чтобы лестница ехала вместе с рабочим весом.
     * На удобные для блинов ступени её кладёт грубый шаг железки (ramp_step).
     */
    rampPercents: numeric('ramp_percents', { precision: 4, scale: 3, mode: 'number' }).array(),
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
    /** null остаётся возможным: упражнение могли удалить из каталога. */
    exerciseId: uuid('exercise_id').references(() => exercises.id, { onDelete: 'set null' }),
    status: sessionItemStatus('status').notNull().default('pending'),
    targetSets: integer('target_sets').notNull(),
    repMin: integer('rep_min').notNull(),
    repMax: integer('rep_max').notNull(),
    /** Подходы, добавленные сверх плана прямо на тренировке. */
    extraSets: integer('extra_sets').notNull().default(0),
    deferredCount: integer('deferred_count').notNull().default(0),
  },
  (t) => [
    index('session_item_session_idx').on(t.sessionId, t.position),
    index('session_item_exercise_idx').on(t.exerciseId),
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
