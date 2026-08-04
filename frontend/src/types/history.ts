/**
 * Tipos del dominio de Historial de cambios — GET /history, POST /history/:id/undo.
 * Reflejan el contrato de la API del backend (Módulo 3.14, RF-HIST-001..006).
 * No hay paquete de tipos compartido con el backend — el frontend define los suyos.
 *
 * Ver docs/design.md, "Historial de cambios (`/historial`)" y
 * docs/requirements.md RF-HIST-001..006 / RN-024/025/026.
 */

import type { CurrencyCode } from "@/types/settings";
import type { MovementType, FormulaOperator } from "@/types/movement";

/** Discriminador de la estructura del movimiento al que pertenece la entrada. */
export type HistoryTargetKind = "UNICO" | "FIJO" | "CUOTA";

/** Operación registrada por la entrada. */
export type HistoryAction = "EDIT" | "DELETE";

/**
 * Identificador cerrado de campo del bloque "Qué cambió" — 1:1 con las 12 filas
 * de docs/design.md §3.1. El backend ya emite `changes` en este orden fijo;
 * el frontend no reordena.
 */
export type HistoryFieldId =
  | "amount"
  | "formula"
  | "currency"
  | "exchangeRate"
  | "type"
  | "category"
  | "description"
  | "date"
  | "startMonth"
  | "installments"
  | "paymentMethod"
  | "autoDebit";

/** Valor del campo `Monto` — monto + moneda + tipo (el frontend pinta signo/símbolo/color). */
export interface HistoryAmountValue {
  amountCents: number;
  currency: CurrencyCode;
  type: MovementType;
}

/**
 * Valor del campo `Fórmula` — operador, operando (escalado, mismo formato que
 * `CalculatedInfo.formulaOperand`) y signo por separado. El frontend arma la
 * expresión legible reusando `lib/formula.ts` en su forma abstracta (sin el
 * monto del origen, docs/design.md §3.2.a).
 */
export interface HistoryFormulaValue {
  operator: FormulaOperator;
  operand: number;
  sign: number;
}

/** Valor del campo `Categoría` — id, nombre y color (punto de 6px). */
export interface HistoryCategoryValue {
  id: string;
  name: string;
  color: string;
}

/** Valor del campo `Método de pago` — al menos el nombre. */
export interface HistoryPaymentMethodValue {
  id: string;
  name: string;
}

/** Valor del campo `Fecha` — instante + zona horaria del registro (fecha y hora juntas). */
export interface HistoryDateValue {
  /** ISO 8601 */
  occurredAt: string;
  /** Nombre IANA de la zona horaria en que ocurrió el movimiento. */
  timezone: string;
}

/** Shape de valor por campo — usado tanto por `previous` como por `next`. */
export interface HistoryFieldValueMap {
  amount: HistoryAmountValue;
  formula: HistoryFormulaValue;
  currency: CurrencyCode;
  exchangeRate: number;
  type: MovementType;
  category: HistoryCategoryValue;
  description: string | null;
  date: HistoryDateValue;
  startMonth: string;
  installments: number;
  paymentMethod: HistoryPaymentMethodValue | null;
  autoDebit: boolean;
}

/**
 * Una fila del bloque "Qué cambió".
 *
 * `next` está AUSENTE (no `null`) en las entradas de eliminación — modo de
 * "valor único" (docs/design.md §3.3): solo hay `previous`. Discriminar SIEMPRE
 * con `"next" in change`, nunca con `next === null` ni con truthiness —
 * `description` y `paymentMethod` pueden ser `null` como valor real legítimo.
 */
export type HistoryChangeDto = {
  [F in HistoryFieldId]: {
    field: F;
    previous: HistoryFieldValueMap[F];
    next?: HistoryFieldValueMap[F];
  };
}[HistoryFieldId];

/** Categoría embebida a nivel de entrada (identidad del movimiento, no del bloque de cambios). */
export interface HistoryEntryCategory {
  id: string;
  name: string;
  color: string;
  scope: string;
}

/** Entrada de historial tal como la devuelve GET /history. */
export interface HistoryEntryResponseDto {
  id: string;
  targetKind: HistoryTargetKind;
  /** Clave estable de agrupación del movimiento (RN-024). */
  targetId: string;
  action: HistoryAction;
  /** ISO 8601 — instante en que se registró la entrada. */
  createdAt: string;
  description: string | null;
  category: HistoryEntryCategory | null;
  type: MovementType;
  /** `null` para calculados — su monto es la fórmula, no una cifra propia (docs/design.md §3.2.a). */
  amount: HistoryAmountValue | null;
  /** `true` solo puede darse cuando `targetKind === "FIJO"`. */
  isCalculated: boolean;
  changes: HistoryChangeDto[];
  /** `true` si es la entrada más reciente de su movimiento (deshacible sin cadena). */
  canUndo: boolean;
  /** Cantidad de entradas posteriores del mismo movimiento que bloquean el undo (RF-HIST-004). */
  blockingCount: number;
}

/** Respuesta de POST /history/:id/undo. */
export interface UndoHistoryResponse {
  undone: true;
}
