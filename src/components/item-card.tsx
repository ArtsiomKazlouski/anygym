import type { setLogs } from '@/db/schema'
import type { ItemPlan } from '@/lib/session/plan'
import {
  deferItem,
  deleteSet,
  finishItem,
  logSet,
  pickExercise,
  resumeItem,
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

const FEEDBACK = [
  { value: 'easy', label: 'Легко', hint: 'мог ещё 3+' },
  { value: 'on_target', label: 'В точку', hint: 'ещё 1–2' },
  { value: 'limit', label: 'На пределе', hint: 'без запаса' },
  { value: 'failed', label: 'Не добил', hint: 'меньше цели' },
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
                `${item.targetSets} × ${item.repMin}–${item.repMax}`}
            </div>
          </div>
          {item.status === 'deferred' && (
            <form action={resumeItem}>
              <input type="hidden" name="itemId" value={item.id} />
              <button
                type="submit"
                className="shrink-0 rounded-full border border-black/15 px-3 py-1.5 text-xs dark:border-white/20"
              >
                Вернуться
              </button>
            </form>
          )}
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
        <form action={deferItem}>
          <input type="hidden" name="itemId" value={item.id} />
          <button
            type="submit"
            className="shrink-0 rounded-full border border-black/15 px-3 py-1.5 text-xs dark:border-white/20"
          >
            Занято
          </button>
        </form>
      </div>

      {row.templateItem?.note && (
        <p className="mt-2 text-xs opacity-50">{row.templateItem.note}</p>
      )}

      {alternatives.length > 1 && (
        <form action={pickExercise} className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <input type="hidden" name="itemId" value={item.id} />
          {alternatives.map((a) => {
            const chosen = a.id === item.exerciseId
            return (
              <button
                key={a.id}
                type="submit"
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
              </button>
            )
          })}
        </form>
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
          {logged.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <span className="w-24 shrink-0 tabular-nums opacity-70">
                {s.weight} {s.units}
              </span>
              <span className="shrink-0 tabular-nums opacity-70">{s.reps} повт</span>
              <span className="min-w-0 flex-1 truncate text-xs opacity-45">
                {ROLE_LABEL[s.kind]}
                {s.painZone && ' · боль'}
              </span>
              <form action={deleteSet}>
                <input type="hidden" name="setId" value={s.id} />
                <button
                  type="submit"
                  aria-label="Удалить подход"
                  className="shrink-0 rounded-full border border-black/15 px-2.5 py-1 text-xs opacity-50 hover:opacity-100 dark:border-white/20"
                >
                  Удалить
                </button>
              </form>
            </li>
          ))}
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
        <SetForm itemId={item.id} plan={plan} />
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
            <form action={finishItem}>
              <input type="hidden" name="itemId" value={item.id} />
              <button
                type="submit"
                className="w-full rounded-2xl bg-black py-4 text-base font-medium text-white dark:bg-white dark:text-black"
              >
                Дальше
              </button>
            </form>
          )}
        </div>
      )}

      {plan && plan.upcoming.length > 0 && (
        <p className="mt-3 text-xs opacity-40">
          Дальше: {plan.upcoming.map((s) => `${s.weight.weight}`).join(' → ')}
        </p>
      )}
    </section>
  )
}

function SetForm({ itemId, plan }: { itemId: string; plan: ItemPlan }) {
  const current = plan.current
  const role = current?.role ?? 'working'
  // Фидбек спрашиваем и на подводящих: по нему срезается остаток рампы.
  // На разминке не спрашиваем — она ни на что не влияет.
  const wantsFeedback = role !== 'warmup'
  const [repLo, repHi] = current?.reps ?? [plan.repMin, plan.repMax]
  const repTarget = repLo === repHi ? `${repLo}` : `${repLo}–${repHi}`
  const units = current?.weight.units ?? plan.grid.units

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
            Вес, {units} · {ROLE_LABEL[role]}
          </span>
          <input
            name="weight"
            type="number"
            inputMode="decimal"
            step="0.5"
            required
            placeholder="—"
            defaultValue={current?.weight.weight ?? ''}
            className="w-full rounded-xl border border-black/15 bg-transparent px-3 py-3 text-3xl font-semibold tabular-nums dark:border-white/20"
          />
        </label>
        <label className="flex w-28 flex-col gap-1">
          <span className="text-xs opacity-50">Повторы · цель {repTarget}</span>
          <input
            name="reps"
            type="number"
            inputMode="numeric"
            defaultValue={repHi}
            className="w-full rounded-xl border border-black/15 bg-transparent px-3 py-3 text-3xl font-semibold tabular-nums dark:border-white/20"
          />
        </label>
      </div>

      {wantsFeedback ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            {FEEDBACK.map((f) => (
              <button
                key={f.value}
                type="submit"
                name="feedback"
                value={f.value}
                className="rounded-2xl border border-black/15 px-3 py-3 text-left dark:border-white/20"
              >
                <span className="block text-sm font-medium">{f.label}</span>
                <span className="block text-xs opacity-50">{f.hint}</span>
              </button>
            ))}
          </div>
          {role === 'ramp' && (
            <p className="text-xs opacity-45">
              Это подводящий подход — в прогрессию он не идёт. Ответ нужен, чтобы понять, брать
              ли запланированный верх.
            </p>
          )}
        </>
      ) : (
        <button
          type="submit"
          className="rounded-2xl bg-black py-4 text-base font-medium text-white dark:bg-white dark:text-black"
        >
          Записал
        </button>
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
