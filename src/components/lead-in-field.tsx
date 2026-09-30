import { leadToInput } from '@/lib/templates/parse'

type Lead = { leadKg: number[] | null; leadPercents: number[] | null }

/**
 * Подводка упражнения: чем греешься перед рабочими подходами.
 *
 * Два режима, и выбор между ними не про вкус, а про железку.
 * Килограммы — там, где ступень стоит блинов: на штанге хочется назвать
 * 60 и 80, а не получить 63.7. Проценты — там, где любая ступень бесплатна
 * (грузоблок, гантели): точное число неважно, а подводка едет за рабочим
 * весом сама, и править её руками не приходится.
 */
export function LeadInField({ item, className }: { item?: Lead | null; className: string }) {
  const mode = item?.leadKg?.length ? 'kg' : item?.leadPercents?.length ? 'percent' : ''

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs opacity-55">Подводка</span>
      <div className="flex gap-2">
        <select name="leadMode" defaultValue={mode} className={`${className} w-32 shrink-0`}>
          <option value="">нет</option>
          <option value="kg">в кг</option>
          <option value="percent">в %</option>
        </select>
        <input
          name="lead"
          inputMode="decimal"
          placeholder="60, 80"
          defaultValue={leadToInput(item)}
          className={className}
        />
      </div>
      <span className="text-xs opacity-40">
        Ступени перед рабочими подходами, по возрастанию. Повторы на них те же, что в
        упражнении. «В кг» — числа твои, приложение их не трогает; ставь там, где вес собирается
        из блинов. «В %» — доли рабочего веса, приложение считает само и кладёт на удобные
        ступени; ставь на грузоблоках и гантелях. Пусто в поле при выбранном режиме — подставлю
        60, 80.
      </span>
    </label>
  )
}
