/**
 * Tipos del dominio de movimientos — endpoint unificado GET /movements.
 * Reflejan el contrato de la API del backend (Fase 5–7, Fase 1.1.7, Fase 1.2.3).
 *
 * MovementItem es el ítem individual que puede ser "unico", "fijo" o "cuota".
 * - "unico": occurredAt/timezone presentes; installment=null.
 * - "fijo":  occurredAt/timezone=null; installment=null.
 * - "cuota": occurredAt/timezone=null; installment presente con number/total/startMonth.
 *
 * Fase 1.1.7: se agregan `calculated` y `hasCalculated` para movimientos calculados.
 * Fase 1.2.3: se agregan `currency`, `exchangeRate` y `convertedAmountCents`.
 *
 * MonthMovements es la respuesta completa de GET /movements?month=YYYY-MM.
 */

import type { CategoryScope } from "@/types/category";
import type { RecurringFrequency } from "@/types/recurring";
import type { CurrencyCode } from "@/types/settings";

/** Discriminador de origen del movimiento */
export type MovementOrigin = "unico" | "fijo" | "cuota";

/**
 * Operador de fórmula para movimientos calculados (RF-MCALC-002).
 * ADD: origen + operando
 * SUB: origen - operando
 * MUL: origen × operando
 * DIV: origen ÷ operando (operando ≠ 0)
 * PCT: origen × operando ÷ 100
 */
export type FormulaOperator = "ADD" | "SUB" | "MUL" | "DIV" | "PCT";

/**
 * Datos del calculado embebidos en MovementItem cuando el ítem es un movimiento calculado.
 * Presente si el ítem es un calculado (fijo, único o cuota); null en todos los demás casos.
 * (Fase 1.1.7 — RF-MCALC-001..007; Fase 1.1.8 — extendido a único y cuota)
 */
export interface CalculatedInfo {
  /**
   * Tipo de origen del calculado (Fase 1.1.8).
   * 'fijo': derivado de un fijo (cadena recurrente).
   * 'unico': derivado de un movimiento único.
   * 'cuota': derivado de un grupo de cuotas.
   */
  sourceType: "fijo" | "unico" | "cuota";
  /**
   * Id estable del origen:
   * - Para 'fijo': chainId de la cadena recurrente.
   * - Para 'unico': id del Transaction.
   * - Para 'cuota': id del InstallmentGroup.
   */
  sourceId: string;
  /**
   * Id estable de la cadena del fijo de origen (Fase 1.1.7 — solo para 'fijo').
   * null para origen 'unico' o 'cuota' (Fase 1.1.8 — ahora nullable).
   */
  sourceChainId: string | null;
  /** Descripción/nombre del fijo de origen (null si no tiene) */
  sourceDescription: string | null;
  /** Operador de la fórmula */
  formulaOperator: FormulaOperator;
  /**
   * Operando escalado (entero):
   * - ADD/SUB: centavos (ej. $500 → 50000)
   * - MUL/DIV: factor × 1.000.000 (ej. 1.5 → 1500000)
   * - PCT: porcentaje × 100 (ej. 10% → 1000)
   */
  formulaOperand: number;
  /** Signo del resultado: +1 o -1 */
  formulaSign: 1 | -1;
  /**
   * Monto del origen en el mes consultado (entero positivo en centavos).
   * - Para 'fijo': monto del fijo en ese mes.
   * - Para 'cuota': monto por cuota del grupo.
   * - Para 'unico': monto del movimiento único.
   * Presente en modo edición para habilitar el preview en vivo del resultado.
   * null/ausente para no-calculados o cuando no está disponible.
   */
  sourceAmountCents: number | null;
}

/** Tipo de movimiento */
export type MovementType = "EXPENSE" | "INCOME";

/** Categoría embebida en cada MovementItem */
export interface MovementCategory {
  id: string;
  name: string;
  color: string;
  scope: CategoryScope;
}

/**
 * Datos de cuota embebidos en MovementItem cuando origin === "cuota".
 * number: número de cuota dentro del grupo (ej: 3).
 * total: cantidad total de cuotas del grupo (ej: 12).
 * startMonth: mes de inicio del grupo en formato YYYY-MM.
 */
export interface InstallmentInfo {
  number: number;
  total: number;
  startMonth: string;
}

/**
 * Ítem individual de movimiento tal como lo devuelve GET /movements.
 * Para "unico": todos los campos están presentes; installment=null; frequency=null; skipped=false.
 * Para "fijo": occurredAt y timezone son null; installment=null; frequency=su frecuencia; skipped según el mes.
 * Para "cuota": occurredAt y timezone son null; installment tiene number/total/startMonth; frequency=null; skipped=false.
 */
export interface MovementItem {
  id: string;
  origin: MovementOrigin;
  type: MovementType;
  amountCents: number;
  description: string | null;
  /**
   * Instante en UTC (ISO 8601) para únicos.
   * null para fijos y cuotas (no tienen instante específico).
   */
  occurredAt: string | null;
  /**
   * Nombre de zona IANA (ej: "America/Argentina/Buenos_Aires") para únicos.
   * null para fijos y cuotas.
   */
  timezone: string | null;
  /**
   * Datos de cuota (number, total, startMonth).
   * Presente para origin==="cuota"; null para "unico" y "fijo".
   */
  installment: InstallmentInfo | null;
  /**
   * Frecuencia de recurrencia (P2 — Fase 1.1.1).
   * Presente solo para origin==="fijo" (su frecuencia: MONTHLY, BIMONTHLY, etc.).
   * null para "unico" y "cuota".
   */
  frequency: RecurringFrequency | null;
  /**
   * Indica si el fijo está anulado para el mes consultado (P1 — Fase 1.1.1).
   * Solo puede ser true para origin==="fijo".
   * Siempre false para "unico" y "cuota".
   * Los ítems anulados se siguen mostrando en la lista pero NO suman a los totales.
   */
  skipped: boolean;
  category: MovementCategory;
  /**
   * Datos del calculado — Fase 1.1.7/1.1.8 (RF-MCALC-001..007).
   * Presente si este ítem es un movimiento calculado (de origen fijo, único o cuota).
   * null si no es calculado.
   */
  calculated: CalculatedInfo | null;
  /**
   * Indica si este ítem tiene al menos un movimiento calculado derivado en el mes.
   * Relevante para cualquier origen (fijo, único o cuota) cuando calculated===null.
   * En ítems que son calculados: false (no pueden ser padres, RF-MCALC-001).
   */
  hasCalculated: boolean;
  /**
   * Moneda original del ítem (Fase 1.2.3).
   * "ARS" por defecto (back-compat — movimientos anteriores son ARS).
   */
  currency: CurrencyCode;
  /**
   * Cotización del ítem: ARS por 1 USD (Fase 1.2.3).
   * 1 para ítems en ARS (cotización 1:1).
   */
  exchangeRate: number;
  /**
   * Monto convertido a la moneda default vigente del usuario (Fase 1.2.3).
   * Si currency === defaultCurrency, coincide con amountCents.
   * El front muestra este valor como monto principal (el que entra al total).
   */
  convertedAmountCents: number;
}

/** Totales del mes */
export interface MonthTotals {
  expenseCents: number;
  incomeCents: number;
  /** Puede ser negativo */
  balanceCents: number;
}

/** Movimientos agrupados por origen */
export interface MovementsByOrigin {
  unicos: MovementItem[];
  /** Poblado desde Fase 6 — los fijos activos en el mes */
  fijos: MovementItem[];
  /** Poblado desde Fase 7 — las cuotas que caen en el mes */
  cuotas: MovementItem[];
}

/**
 * Respuesta completa de GET /movements?month=YYYY-MM.
 * data de la respuesta del backend.
 */
export interface MonthMovements {
  month: string;
  totals: MonthTotals;
  movements: MovementsByOrigin;
}
