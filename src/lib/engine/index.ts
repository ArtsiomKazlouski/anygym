/**
 * Публичная поверхность движка.
 *
 * Имена перечислены явно, а не через `export *`: у проекта нет
 * "type": "module", поэтому Node читает .ts как CommonJS, и при таком чтении
 * звёздочные реэкспорты теряются — статический анализатор не видит имён
 * в соседнем модуле. Сборщик Next это переживает, а скрипты на tsx — нет,
 * и ломались бы молча.
 */
export type { SnapDirection, SnappedWeight, Units, WeightGrid } from './weights.ts'
export { KG_PER_LB, fromKg, gridOptions, rampGrid, snapKg, stepKg, toKg } from './weights.ts'

export type {
  LoggedSet,
  NextSet,
  PrescribeContext,
  Prescription,
  PrescriptionSource,
  Scheme,
  SetFeedback,
  SetPlan,
  SetRole,
} from './prescribe.ts'
export {
  DELOAD_TABLE,
  PAIN_BACKOFF_FACTOR,
  PROBE_FACTOR,
  RESET_AFTER_DAYS,
  RE_ANCHOR_MIN_PERCENT,
  baseFromLastSession,
  capRamp,
  deloadFactor,
  interSessionDelta,
  isFailed,
  nextSet,
  prescribe,
  reanchorRamp,
} from './prescribe.ts'
