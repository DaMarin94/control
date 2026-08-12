/**
 * Aritmética RN-016 replicada en el cliente para el modal de alcance de la
 * anulación de un fijo (RF-MF-005, `docs/design.md` §"Modal de alcance de la
 * anulación de un fijo"). El modal no hace fetch al abrir — todo sale del
 * `MovementItem` que la lista ya tiene (arranque, fin y frecuencia del fijo
 * lógico) — por eso este cálculo vive acá en vez de pedirle el conteo al
 * backend antes de confirmar.
 *
 * RN-016: un fijo con mes de inicio S y frecuencia N aparece en el mes M sii
 * `S <= M && monthDiff(S, M) % N === 0`. Acá "aparece" no vuelve a chequear
 * `deletedFrom` por separado: el techo de vigencia ya llega resuelto en
 * `MovementItem.endMonth` (exclusivo) — ver `types/movement.ts`.
 */

/** "YYYY-MM" → índice absoluto de mes (para aritmética simple, sin Date) */
function monthIndex(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return y * 12 + (m - 1);
}

/** índice absoluto de mes → "YYYY-MM" */
function monthFromIndex(index: number): string {
  const y = Math.floor(index / 12);
  const m = index - y * 12 + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Diferencia en meses entre dos "YYYY-MM" (b − a) */
export function monthDiff(a: string, b: string): number {
  return monthIndex(b) - monthIndex(a);
}

/** Suma (o resta, con n negativo) n meses a un "YYYY-MM" */
export function addMonthsToKey(month: string, n: number): string {
  return monthFromIndex(monthIndex(month) + n);
}

/** true si `month` es una aparición real del fijo (RN-016), sin considerar el techo de vigencia */
export function isAppearance(startMonth: string, frequency: number, month: string): boolean {
  if (month < startMonth) return false;
  return monthDiff(startMonth, month) % frequency === 0;
}

/**
 * Último mes < `exclusiveEnd` que es una aparición real — mismo criterio que
 * `lastAppearanceBefore` del backend (`recurring.service.ts`), replicado acá
 * para el cálculo sin fetch. `null` si no hay ninguna aparición antes de
 * `exclusiveEnd` (caso degenerado que no debería darse en un fijo vivo).
 */
export function lastAppearanceBefore(
  startMonth: string,
  frequency: number,
  exclusiveEnd: string,
): string | null {
  const lastMonth = addMonthsToKey(exclusiveEnd, -1);
  const diff = monthDiff(startMonth, lastMonth);
  if (diff < 0) return null;
  const steps = Math.floor(diff / frequency);
  return addMonthsToKey(startMonth, steps * frequency);
}

/** Lista contigua de meses [from, to] inclusive, ambos "YYYY-MM" */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  for (let m = from; m <= to; m = addMonthsToKey(m, 1)) {
    months.push(m);
  }
  return months;
}

/** Largo máximo, en meses inclusive, de un rango de anulación (RF-MF-005) */
export const MAX_SKIP_RANGE_MONTHS = 24;

/**
 * Techo del fijo lógico: último mes de aparición real, si tiene fin de
 * vigencia (`endMonth` exclusivo); `null` si es indefinido (sin techo propio).
 */
export function computeChainCeiling(
  startMonth: string,
  frequency: number,
  endMonth: string | null,
): string | null {
  if (endMonth === null) return null;
  return lastAppearanceBefore(startMonth, frequency, endMonth);
}

/**
 * Universo de opciones de "Desde" (docs/design.md §2.4, RF-MF-005 §Reglas del
 * rango). Piso: arranque del fijo lógico. Techo: último mes de aparición si
 * hay fin de vigencia; si es indefinido, se extiende `MAX_SKIP_RANGE_MONTHS`
 * meses más allá del mes visualizado — que por precondición del RF ya es una
 * aparición dentro de la vigencia — así el catálogo siempre incluye el
 * default (Desde = mes visualizado) y queda acotado para un `<select>` nativo.
 */
export function buildDesdeOptions(
  startMonth: string,
  frequency: number,
  endMonth: string | null,
  viewMonth: string,
): string[] {
  const ceiling =
    computeChainCeiling(startMonth, frequency, endMonth) ??
    addMonthsToKey(viewMonth, MAX_SKIP_RANGE_MONTHS - 1);
  return monthsBetween(startMonth, ceiling);
}

/**
 * Universo de opciones de "Hasta" — recalculado a partir de "Desde"
 * (docs/design.md §2.4): primera opción = Desde; última = min(techo del
 * fijo, Desde + 23). Máximo 24 opciones. El rango invertido es irrepresentable.
 */
export function buildHastaOptions(
  desde: string,
  startMonth: string,
  frequency: number,
  endMonth: string | null,
): string[] {
  const chainCeiling = computeChainCeiling(startMonth, frequency, endMonth);
  const byMaxLength = addMonthsToKey(desde, MAX_SKIP_RANGE_MONTHS - 1);
  const ceiling =
    chainCeiling !== null && chainCeiling < byMaxLength ? chainCeiling : byMaxLength;
  return monthsBetween(desde, ceiling);
}

/** Resultado del conteo de apariciones dentro de [from, to] (ambos inclusive) */
export interface AppearanceCount {
  count: number;
  /** Primera aparición real dentro del rango; null si count === 0 */
  first: string | null;
  /** Última aparición real dentro del rango; null si count === 0 */
  last: string | null;
}

const ZERO_APPEARANCES: AppearanceCount = { count: 0, first: null, last: null };

/**
 * Cuenta las apariciones reales del fijo (RN-016) dentro de [from, to], ambos
 * inclusive — aritmética cerrada (sin loop mes a mes): la primera aparición
 * ≥ `from` es `start + ceil((windowStart − start) / frequency) × frequency`,
 * y de ahí en más son múltiplos regulares del paso de frecuencia hasta `to`.
 */
export function countAppearances(
  startMonth: string,
  frequency: number,
  from: string,
  to: string,
): AppearanceCount {
  const windowStart = from < startMonth ? startMonth : from;
  if (windowStart > to) return ZERO_APPEARANCES;

  const diffToWindowStart = monthDiff(startMonth, windowStart);
  const stepsToFirst = Math.ceil(diffToWindowStart / frequency);
  const first = addMonthsToKey(startMonth, stepsToFirst * frequency);
  if (first > to) return ZERO_APPEARANCES;

  const diffToTo = monthDiff(startMonth, to);
  const lastSteps = Math.floor(diffToTo / frequency);
  const last = addMonthsToKey(startMonth, lastSteps * frequency);

  const count = Math.floor(monthDiff(first, last) / frequency) + 1;
  return { count, first, last };
}
