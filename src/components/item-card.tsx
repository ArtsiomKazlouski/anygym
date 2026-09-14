import type { setLogs } from '@/db/schema'
import { gridOptions } from '@/lib/engine'
import type { ItemPlan } from '@/lib/session/plan'
import { SubmitButton } from '@/components/submit-button'
import {
  addSet,
  deferItem,
  deleteSet,
  finishItem,
  logSet,
  pickExercise,
  removeSessionItem,
  resumeItem,
  skipItem,
} from '@/lib/session/actions'

type Logged = typeof setLogs.$inferSelect

type Alternative = {
  id: string
  name: string
  notes: string | null
  volume: number
}

type Props = {
  row: {
    item: {
      id: string
      status: 'pending' | 'active' | 'done' | 'deferred' | 'skipped'
      targetSets: number
      repMin: number
      repMax: number
      exerciseId: string | null
      extraSets: number
      deferredCount: number
    }
    templateItem: { note: string | null; scheme: 'straight' | 'ramp' } | null
    exercise: { id: string; name: string } | null
  }
  logged: Logged[]
  isCurrent: boolean
  plan: ItemPlan | null
  alternatives: Alternative[]
  patternTitle: string
}

const ROLE_LABEL = {
  warmup: 'разминка',
  ramp: 'подводящий',
  working: 'рабочий',
} as const

/**
 * Промежуток между записями подходов.
 *
 * Метка времени ставится в момент записи, то есть в конце подхода — значит
 * в промежуток входит и отдых, и сам следующий подход. Поэтому подпись
 * говорит «между подходами», а не «отдых»: приложение не должно называть
 * величину точнее, чем умеет её измерить.
 */
function gapLabel(prev: Date, next: Date): string | null {
  const sec = Math.round((next.getTime() - prev.getTime()) / 1000)
  if (sec < 5 || sec > 60 * 60) return null
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s} с`
}

const FEEDBACK_LABEL = {
  easy: 'легко',
  on_target: 'в точку',
  limit: 'на пределе',
  failed: 'не добил',
} as const

/** Рабочий подход: вопрос «сколько осталось в запасе» — от него растёт вес. */
const FEEDBACK_WORKING = [
  { value: 'easy', label: 'Легко', hint: 'мог ещё 3+' },
  { value: 'on_target', label: 'В точку', hint: 'ещё 1–2' },
  { value: 'limit', label: 'На пределе', hint: 'без запаса' },
] as const

/**
 * Подводящий подход обязан быть лёгким — спрашивать про запас бессмысленно.
 * Вопрос здесь один: идём к запланированному верху или срезаем. Подписи
 * называют последствие, а не ощущение.
 */
const FEEDBACK_RAMP = [
  { value: 'on_target', label: 'По плану', hint: 'идём к верху' },
  { value: 'limit', label: 'Тяжелее, чем ждал', hint: 'верх срежем' },
] as const

export function ItemCard({ row, logged, isCurrent, plan, alternatives, patternTitle }: Props) {
  const { item, exercise } = row
  const title = exercise?.name ?? patternTitle
  const muted = item.status === 'done' || item.status === 'skipped'

  if (!isCurrent) {
    return (
      <section
        className={`rounded-2xl border border-black/10 px-4 py-3 dark:border-white/15 ${muted ? 'opacity-45' : ''}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{title}</div>
            <div className="text-xs opacity-50">
              {item.status === 'done' && `сделано, подходов ${logged.length}`}
              {item.status === 'skipped' && 'пропущено'}
              {item.status === 'deferred' &&
                `занято${logged.length ? `, подходов ${logged.length}` : ''}`}
              {item.status === 'pending' &&
                (row.templateItem?.scheme === 'ramp'
                  ? `рампа · ${item.repMax} повт`
                  : `${item.targetSets} подх. × ${item.repMax}`)}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {item.status === 'deferred' && (
              <form action={resumeItem}>
                <input type="hidden" name="itemId" value={item.id} />
                <SubmitButton className="rounded-full border border-black/15 px-3 py-1.5 text-xs dark:border-white/20">
                  Вернуться
                </SubmitButton>
              </form>
            )}
            {/*
              Убрать можно только пока ничего не записано: у начатого
              упражнения есть подходы, и удаление молча стёрло бы их.
              Для такого случая есть «Пропустить».
            */}
            {logged.length === 0 && item.status !== 'done' && (
              <form action={removeSessionItem}>
                <input type="hidden" name="itemId" value={item.id} />
                <SubmitButton className="rounded-full px-2 py-1.5 text-xs opacity-40 hover:opacity-100">
                  Убрать
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border-2 border-black/80 px-4 py-4 dark:border-white/80">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide opacity-40">{patternTitle}</div>
          <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        </div>
        <div className="flex shrink-0 gap-2">
          <form action={deferItem}>
            <input type="hidden" name="itemId" value={item.id} />
            <SubmitButton className="rounded-full border border-black/15 px-3 py-1.5 text-xs dark:border-white/20">
              {logged.length > 0 ? 'Прервали' : 'Занято'}
            </SubmitButton>
          </form>
          <form action={skipItem}>
            <input type="hidden" name="itemId" value={item.id} />
            <SubmitButton className="rounded-full border border-black/15 px-3 py-1.5 text-xs opacity-60 dark:border-white/20">
              Пропустить
            </SubmitButton>
          </form>
        </div>
      </div>

      {row.templateItem?.note && (
        <p className="mt-2 text-xs opacity-50">{row.templateItem.note}</p>
      )}

      {alternatives.length > 1 && logged.length === 0 && (
        <form action={pickExercise} className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <input type="hidden" name="itemId" value={item.id} />
          {alternatives.map((a) => {
            const chosen = a.id === item.exerciseId
            return (
              <SubmitButton
                key={a.id}
                name="exerciseId"
                value={a.id}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${
                  chosen
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'border border-black/15 dark:border-white/20'
                }`}
              >
                {a.name}
                <span className="ml-1 opacity-50">
                  {a.volume > 0 ? `· ${a.volume}` : '· нет данных'}
                </span>
              </SubmitButton>
            )
          })}
        </form>
      )}

      {plan && plan.planned.length > 0 && (
        <div className="mt-3">
          <div className="text-xs opacity-40">
            {plan.prescription.scheme === 'ramp'
              ? `План: ${plan.planned.length} подх., верх ${plan.planned[plan.planned.length - 1].weight.weight} ${plan.grid.units}`
              : `План: ${plan.planned.length} подх. × ${plan.repMax}`}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {plan.planned.map((s, i) => {
              const actual = logged[i]
              const state = actual ? 'done' : i === logged.length ? 'now' : 'next'
              const mark = s.role === 'warmup' ? '°' : s.role === 'ramp' ? '~' : ''
              const isRamp = plan.prescription.scheme === 'ramp'

              // Сделанный подход показывает факт. Запланированный — ориентир:
              // в прямой схеме это один и тот же вес, повторять его цифрами
              // в каждой плашке нечего, цель уже написана в шапке.
              const text = actual
                ? `${actual.weight}×${actual.reps}`
                : isRamp
                  ? `${s.weight.weight}×${s.reps[1]}`
                  : `${s.weight.weight}`

              return (
                <span
                  key={`${i}-${s.weight.weight}`}
                  className={
                    'rounded-lg px-2 py-1 text-xs tabular-nums ' +
                    (state === 'done'
                      ? 'bg-black/5 opacity-45 dark:bg-white/10'
                      : state === 'now'
                        ? 'bg-black font-semibold text-white dark:bg-white dark:text-black'
                        : 'border border-black/15 opacity-60 dark:border-white/20')
                  }
                >
                  {mark}
                  {text}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {plan?.setup && Object.keys(plan.setup).length > 0 && (
        <div className="mt-3 rounded-xl bg-black/5 px-3 py-2 text-sm dark:bg-white/10">
          <span className="opacity-50">Настройки: </span>
          {Object.entries(plan.setup)
            .map(([k, v]) => `${k} ${v}`)
            .join(', ')}
        </div>
      )}

      {logged.length > 0 && (
        <ol className="mt-3 flex flex-col gap-1">
          {logged.map((s, i) => {
            const gap = i > 0 ? gapLabel(logged[i - 1].loggedAt, s.loggedAt) : null
            return (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 tabular-nums opacity-70">
                  {s.weight} {s.units}
                </span>
                <span className="shrink-0 tabular-nums opacity-70">{s.reps} повт</span>
                <span className="min-w-0 flex-1 truncate text-xs opacity-45">
                  {s.feedback ? FEEDBACK_LABEL[s.feedback] : ROLE_LABEL[s.kind]}
                  {gap && ` · через ${gap}`}
                  {s.painZone && ' · боль'}
                </span>
                <form action={deleteSet}>
                  <input type="hidden" name="setId" value={s.id} />
                  <SubmitButton
                    aria-label="Удалить подход"
                    className="shrink-0 rounded-full border border-black/15 px-2.5 py-1 text-xs opacity-50 hover:opacity-100 dark:border-white/20"
                  >
                    Удалить
                  </SubmitButton>
                </form>
              </li>
            )
          })}
        </ol>
      )}

      {plan?.notes && plan.notes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {plan.notes.map((n) => (
            <li key={n} className="text-xs opacity-55">
              {n}
            </li>
          ))}
        </ul>
      )}

      {plan && (plan.current || plan.manualEntry) ? (
        /*
          key обязателен. Поля формы неуправляемые, а defaultValue применяется
          только при первом появлении элемента в DOM: после серверного действия
          React видит тот же select на том же месте и оставляет старое значение.
          Лента плана при этом перерисовывается — и поле расходится с подсказкой
          ровно на один подход. Ключ заставляет пересоздать поля.
        */
        <SetForm
          key={`${logged.length}-${plan.current?.weight.weight ?? 'manual'}`}
          itemId={item.id}
          plan={plan}
          lastReps={logged[logged.length - 1]?.reps ?? null}
        />
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm opacity-60">
            {!item.exerciseId
              ? 'Выбери, на чём делаешь.'
              : logged.length > 0
                ? `Все подходы записаны — ${logged.length} из ${item.targetSets}.`
                : 'Подходов в плане нет.'}
          </p>
          {item.exerciseId && (
            <div className="flex gap-2">
              <form action={addSet} className="flex-1">
                <input type="hidden" name="itemId" value={item.id} />
                <SubmitButton className="w-full rounded-2xl border border-black/15 py-4 text-base dark:border-white/20">
                  Ещё подход
                </SubmitButton>
              </form>
              <form action={finishItem} className="flex-1">
                <input type="hidden" name="itemId" value={item.id} />
                <SubmitButton className="w-full rounded-2xl bg-black py-4 text-base font-medium text-white dark:bg-white dark:text-black">
                  Дальше
                </SubmitButton>
              </form>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function SetForm({
  itemId,
  plan,
  lastReps,
}: {
  itemId: string
  plan: ItemPlan
  lastReps: number | null
}) {
  const current = plan.current
  const role = current?.role ?? 'working'
  // Фидбек спрашиваем и на подводящих: по нему срезается остаток рампы.
  // На разминке не спрашиваем — она ни на что не влияет.
  const wantsFeedback = role !== 'warmup'
  const repHi = (current?.reps ?? [plan.repMin, plan.repMax])[1]
  // В цели показываем одно число — верх диапазона. Нижняя граница выводится
  // приложением и всплывает только в пояснении, когда вес снижается.
  const repTarget = `${repHi}`
  const units = current?.weight.units ?? plan.grid.units

  // Вес выбирается барабаном из того, что на этой железке физически есть:
  // список строится из той же сетки, что и подсказки движка, поэтому
  // несуществующий вес выбрать невозможно.
  const weights = gridOptions(plan.grid, { around: current?.weight.weightKg })
  const repChoices = Array.from({ length: Math.max(30, repHi + 10) }, (_, i) => i + 1)

  const field =
    'w-full rounded-xl border border-black/15 bg-transparent px-3 py-3 text-3xl ' +
    'font-semibold tabular-nums dark:border-white/20'

  return (
    <form action={logSet} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="kind" value={role} />
      <input type="hidden" name="prescribedKg" value={current?.weight.weightKg ?? ''} />
      <input type="hidden" name="source" value={plan.prescription.source} />

      {plan.manualEntry && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs opacity-80">
          Веса по этому упражнению я ещё не знаю. Поставь сам и запиши подход — дальше буду
          вести сам, и в следующий раз вспомню.
        </p>
      )}

      <div className="flex items-end gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs opacity-50">
            Вес, {units} · <span className="whitespace-nowrap">{ROLE_LABEL[role]}</span>
          </span>
          {weights.length > 0 ? (
            <select
              name="weight"
              required
              defaultValue={current?.weight.weight ?? ''}
              className={field}
            >
              {current == null && <option value="">—</option>}
              {weights.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          ) : (
            // Сетка железки неизвестна — остаётся ввод руками.
            <input
              name="weight"
              type="number"
              inputMode="decimal"
              step="0.5"
              required
              placeholder="—"
              defaultValue={current?.weight.weight ?? ''}
              className={field}
            />
          )}
        </label>
        <label className="flex w-32 flex-col gap-1">
          <span className="text-xs opacity-50">
            Повторы · цель <span className="whitespace-nowrap">{repTarget}</span>
          </span>
          {/* Сколько вышло в прошлом подходе — вероятнее, чем верх диапазона. */}
          <select name="reps" required defaultValue={lastReps ?? repHi} className={field}>
            {repChoices.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>

      {wantsFeedback ? (
        <>
          <p className="text-xs opacity-45">
            {role === 'ramp'
              ? 'Подводящий. Идём дальше по плану?'
              : 'Сколько осталось в запасе?'}
          </p>
          <div className="flex flex-col gap-2">
            {(role === 'ramp' ? FEEDBACK_RAMP : FEEDBACK_WORKING).map((f) => (
              <SubmitButton
                key={f.value}
                name="feedback"
                value={f.value}
                className="rounded-2xl border border-black/15 px-3 py-3 text-left dark:border-white/20"
              >
                <span className="text-sm font-medium">{f.label}</span>
                <span className="ml-2 text-xs opacity-50">{f.hint}</span>
              </SubmitButton>
            ))}
          </div>
        </>
      ) : (
        <SubmitButton className="rounded-2xl bg-black py-4 text-base font-medium text-white dark:bg-white dark:text-black">
          Записал
        </SubmitButton>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer opacity-40">Было больно</summary>
        <input
          name="painZone"
          placeholder="где именно: плечо, поясница…"
          className="mt-2 w-full rounded-xl border border-red-500/40 bg-transparent px-3 py-2 text-sm"
        />
        <p className="mt-1 opacity-50">
          Заполни поле и нажми любую кнопку — подход запишется с отметкой. Прогрессия по этому
          упражнению встанет на паузу.
        </p>
      </details>
    </form>
  )
}
