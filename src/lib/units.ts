import type { Units } from '@/lib/engine'

/**
 * Подпись единиц для показа рядом с числом.
 *
 * В базе лежит 'kg' / 'lb' — это значения типа, а не текст для человека.
 * Напечатанные как есть, они давали «Вес, kg» и «18 kg» посреди русского
 * интерфейса. Форма выбора единиц — другое дело: там это подписи вариантов,
 * и там они словами.
 */
const LABEL: Record<Units, string> = { kg: 'кг', lb: 'фнт' }

export function unitsLabel(units: Units): string {
  return LABEL[units] ?? units
}
