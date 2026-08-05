// ---------------------------------------------------------------------------
// Helpers de aritmética de mes (string "YYYY-MM") — transversales.
//
// Movidos desde movements.repository.ts (Fase Simulación de categoría) para que
// otros módulos que necesiten operar sobre meses (ej. `simulations`) los reusen
// sin importar directamente el repositorio de otro módulo. movements.repository.ts
// re-exporta estos tres símbolos para no romper sus consumidores existentes
// (`import { addMonths, monthDiff, isOnFrequency } from './movements.repository'`).
//
// "Cualquier cambio al cálculo de fijos por mes debe pasar por estos helpers,
// no re-duplicarse" (docs/backend.md, §Cálculo de aparición de fijos por mes).
// ---------------------------------------------------------------------------

/**
 * Devuelve true si el fijo aparece en el mes dado según su frecuencia.
 * frequency es un entero 1..12 (meses de paso), anclado al startMonth:
 * monthDiff(startMonth, month) % frequency === 0.
 */
export function isOnFrequency(
  startMonth: string,
  frequency: number,
  month: string,
): boolean {
  const diff = monthDiff(startMonth, month);
  return diff % frequency === 0;
}

/**
 * Suma N meses a un string YYYY-MM con rollover de año correcto.
 *
 * GOTCHA: soporta offsets negativos que cruzan el límite de año vía módulo
 * verdadero (`((month % 12) + 12) % 12`, no el `%` de JS, que devuelve
 * negativos): con eso `addMonths('2026-03', -3) = '2025-12'`.
 */
export function addMonths(yyyyMM: string, n: number): string {
  const [yearStr, monthStr] = yyyyMM.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1; // 0-based

  month += n;

  // Math.floor handles negative n correctly for year rollover.
  // Use true modulo ((x%12)+12)%12 to avoid the double-year-subtraction
  // bug that occurs when month%12 is negative and we subsequently do year-=1.
  year += Math.floor(month / 12);
  month = ((month % 12) + 12) % 12;

  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/**
 * Calcula la diferencia en meses entre dos strings YYYY-MM (b - a).
 */
export function monthDiff(a: string, b: string): number {
  const [yearA, monthA] = a.split('-').map(Number);
  const [yearB, monthB] = b.split('-').map(Number);
  return (yearB - yearA) * 12 + (monthB - monthA);
}
