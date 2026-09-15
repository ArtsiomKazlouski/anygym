import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { SubmitButton } from '@/components/submit-button'
import { TemplateItemForm } from '@/components/template-item-form'
import { getPattern } from '@/lib/patterns'
import {
  addTemplateItem,
  archiveTemplate,
  moveTemplateItem,
  removeTemplateItem,
  renameTemplate,
  updateTemplateItem,
} from '@/lib/templates/actions'
import { lastWorkingSets } from '@/lib/equipment/queries'
import { templateWithItems } from '@/lib/templates/queries'
import { rampWeightsFromPercents } from '@/lib/templates/parse'

const field =
  'w-full rounded-xl border border-black/15 bg-transparent px-3 py-2.5 text-base dark:border-white/20'
const chip = 'rounded-full px-2.5 py-1 text-xs opacity-45 hover:opacity-100'

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/signin')

  const [data, lastSets] = await Promise.all([
    templateWithItems(userId, id),
    lastWorkingSets(userId),
  ])
  if (!data) redirect('/templates')

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-5">
      <Link
        href="/templates"
        className="-ml-2 self-start rounded-full px-2 py-1.5 text-sm opacity-60 transition duration-75 active:scale-95"
      >
        ← Планы
      </Link>

      <form action={renameTemplate} className="flex gap-2">
        <input type="hidden" name="templateId" value={data.template.id} />
        <input name="name" defaultValue={data.template.name} className={field} />
        <SubmitButton className="shrink-0 rounded-xl border border-black/15 px-4 text-sm dark:border-white/20">
          Имя
        </SubmitButton>
      </form>

      <section className="flex flex-col gap-2">
        {data.items.length === 0 && (
          <p className="text-sm opacity-50">Пунктов пока нет — добавь первое упражнение.</p>
        )}

        {data.items.map(({ item, exerciseName, targetReps }, index) => {
          const summary =
            item.scheme === 'ramp'
              ? `рампа ${rampWeightsFromPercents(item.rampPercents, lastSets.get(item.preferredExerciseId ?? '')?.weight) || '—'} · ${targetReps} повт`
              : `${item.sets} подх. × ${targetReps}`

          return (
            <details
              key={item.id}
              className="rounded-2xl border border-black/10 px-4 py-3 dark:border-white/15"
            >
              <summary className="cursor-pointer">
                <span className="text-sm font-medium">
                  {index + 1}. {exerciseName ?? getPattern(item.patternCode)?.title}
                </span>
                <span className="ml-2 text-xs opacity-45">{summary}</span>
              </summary>

              <div className="mt-2 flex gap-1">
                <form action={moveTemplateItem}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="direction" value="up" />
                  <SubmitButton className={chip} disabled={index === 0}>
                    ↑ выше
                  </SubmitButton>
                </form>
                <form action={moveTemplateItem}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="direction" value="down" />
                  <SubmitButton className={chip} disabled={index === data.items.length - 1}>
                    ↓ ниже
                  </SubmitButton>
                </form>
                <form action={removeTemplateItem} className="ml-auto">
                  <input type="hidden" name="itemId" value={item.id} />
                  <SubmitButton className={chip}>Убрать</SubmitButton>
                </form>
              </div>

              <div className="mt-2">
                <TemplateItemForm
                  key={JSON.stringify([
                    item.preferredExerciseId,
                    item.scheme,
                    item.sets,
                    item.rampPercents,
                    item.note,
                  ])}
                  action={updateTemplateItem}
                  templateId={data.template.id}
                  item={item}
                  declaredKg={lastSets.get(item.preferredExerciseId ?? '')?.weight ?? null}
                  catalog={data.catalog}
                  submitLabel="Сохранить пункт"
                />
              </div>
            </details>
          )
        })}
      </section>

      <details className="rounded-2xl border border-dashed border-black/15 px-4 py-3 dark:border-white/20">
        <summary className="cursor-pointer text-sm opacity-60">Добавить упражнение</summary>
        <div className="mt-3">
          {data.catalog.length === 0 ? (
            <p className="text-sm opacity-50">
              Сначала заведи упражнения — они создаются на карточке тренажёра в разделе «Залы».
            </p>
          ) : (
            <>
              <TemplateItemForm
                action={addTemplateItem}
                templateId={data.template.id}
                catalog={data.catalog}
                submitLabel="Добавить"
              />
              <p className="mt-2 text-xs opacity-40">
                Нужного упражнения нет в списке?{' '}
                <Link href="/exercises" className="underline underline-offset-4">
                  Заведи его в «Упражнениях»
                </Link>{' '}
                и вернись сюда.
              </p>
            </>
          )}
        </div>
      </details>

      <form action={archiveTemplate} className="pt-4 text-center">
        <input type="hidden" name="templateId" value={data.template.id} />
        <SubmitButton className="text-xs text-red-600/70 hover:text-red-600 dark:text-red-400/70">
          Убрать план
        </SubmitButton>
      </form>
    </main>
  )
}
