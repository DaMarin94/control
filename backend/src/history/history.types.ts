import { Currency, FormulaOperator, MovementType } from '@prisma/client';

// ---------------------------------------------------------------------------
// Historial de cambios (Módulo 3.14 — RF-HIST-001..006) — shapes de snapshot.
//
// targetKind mapea 1:1 a la tabla de almacenamiento (no al tipo "conceptual" del
// movimiento): UNICO -> Transaction, FIJO -> Recurring (fijo normal O calculado,
// de cualquier origen), CUOTA -> InstallmentGroup. Ver docs/backend.md, §Historial.
//
// Cada combinación targetKind × action tiene una forma de snapshot distinta,
// documentada acá. Prisma persiste `snapshot` como `Json` sin tipar — estos tipos
// son el contrato de aplicación entre los services de dominio (que lo escriben al
// capturar el cambio) y HistoryService (que lo lee para el diff y el undo).
// ---------------------------------------------------------------------------

/**
 * Snapshot de un movimiento único (Transaction), usado tanto para EDIT como
 * para DELETE. El delete nunca muta estos campos (solo marca deletedAt), así
 * que el mismo shape sirve para las dos acciones.
 */
export interface UnicoSnapshot {
  type: MovementType;
  amountCents: number;
  categoryId: string;
  description: string | null;
  /** ISO 8601 */
  occurredAt: string;
  timezone: string;
  currency: Currency;
  exchangeRate: number;
  anchorCurrency: Currency;
  paymentMethodId: string | null;
  autoDebit: boolean | null;
}

/**
 * Snapshot de un grupo de cuotas (InstallmentGroup), usado tanto para EDIT
 * como para DELETE (mismo motivo que UnicoSnapshot).
 */
export interface CuotaSnapshot {
  type: MovementType;
  amountCents: number;
  categoryId: string;
  description: string | null;
  startMonth: string;
  totalInstallments: number;
  currency: Currency;
  exchangeRate: number;
  anchorCurrency: Currency;
  paymentMethodId: string | null;
  autoDebit: boolean | null;
}

/**
 * Snapshot completo de UNA fila Recurring (fijo normal o calculado, de
 * cualquier origen). Se usa como bloque elemental tanto del snapshot de EDIT
 * (la fila antes del PATCH) como del snapshot de DELETE (cada fila de cada
 * cadena afectada, antes del boundary).
 */
export interface RecurringRowSnapshot {
  id: string;
  chainId: string;
  startMonth: string;
  deletedFrom: string | null;
  /** ISO 8601 o null. Previo a la mutación (siempre null salvo bug de datos). */
  deletedAt: string | null;
  type: MovementType;
  amountCents: number;
  categoryId: string;
  description: string | null;
  frequency: number;
  currency: Currency;
  exchangeRate: number;
  anchorCurrency: Currency;
  paymentMethodId: string | null;
  autoDebit: boolean | null;
  sourceChainId: string | null;
  sourceMovementId: string | null;
  sourceInstallmentGroupId: string | null;
  formulaOperator: FormulaOperator | null;
  formulaOperand: number | null;
  formulaSign: number | null;
}

/**
 * Snapshot de una edición de fijo/calculado (RF-MF-003 / RF-MCALC-006).
 *
 * `row`: estado COMPLETO de la fila editada, tal como estaba ANTES del PATCH.
 * `newRowId`: si el PATCH hizo split (RN-005), el id de la fila nueva (R2)
 * creada por el split; `null` si fue edición in-place (misma fila).
 *
 * Deshacer: si newRowId != null → hard-delete esa fila (nunca existió antes de
 * este cambio) y restaurar SOLO `deletedFrom` de `row.id` a `row.deletedFrom`
 * (es el único campo que el split toca en la fila vieja). Si newRowId == null →
 * restaurar TODOS los campos de `row` en `row.id` (edición in-place: los campos
 * de negocio se sobreescribieron directamente en la misma fila).
 */
export interface FijoEditSnapshot {
  kind: 'edit';
  row: RecurringRowSnapshot;
  newRowId: string | null;
}

/** Snapshot de UNA cadena afectada por un DELETE de fijo (origen o cascada). */
export interface FijoChainSnapshot {
  chainId: string;
  rows: RecurringRowSnapshot[];
}

/**
 * Snapshot de una eliminación de fijo/calculado (RF-MF-004 / RF-MCALC-005/009).
 *
 * `chains[0]` es SIEMPRE la cadena eliminada directamente (el fijo normal, o el
 * calculado, sobre el que se llamó DELETE). `chains[1..]`, si están presentes,
 * son las cadenas de calculados de FIJO que cayeron en cascada (RN-024: la
 * cascada NO genera entradas propias, viaja dentro de esta misma entrada).
 *
 * Deshacer: por cada fila de cada cadena, restaurar `deletedFrom` y `deletedAt`
 * a los valores capturados (son los únicos dos campos que un DELETE puede
 * tocar; el resto de los campos de negocio nunca cambian en un delete).
 */
export interface FijoDeleteSnapshot {
  kind: 'delete';
  chains: FijoChainSnapshot[];
}

export type FijoSnapshot = FijoEditSnapshot | FijoDeleteSnapshot;

export type HistorySnapshot = UnicoSnapshot | CuotaSnapshot | FijoSnapshot;

/** Campos de negocio "comparables" extraídos de un snapshot, para el diff de GET /history. */
export interface ComparableFields {
  type?: MovementType;
  amountCents?: number;
  categoryId?: string;
  description?: string | null;
  currency?: Currency;
  exchangeRate?: number;
  /** Moneda default del usuario al momento de guardar (RF-HIST-002 §3.3: omite `Cotización` cuando currency === anchorCurrency). */
  anchorCurrency?: Currency;
  paymentMethodId?: string | null;
  autoDebit?: boolean | null;
  occurredAt?: string;
  timezone?: string;
  startMonth?: string;
  totalInstallments?: number;
  formulaOperator?: FormulaOperator | null;
  formulaOperand?: number | null;
  formulaSign?: number | null;
  /**
   * Origen del calculado (solo presentes/relevantes en filas Recurring calculadas —
   * ver invariante en el schema, Recurring). Usados EXCLUSIVAMENTE para resolver la
   * moneda real del campo `formula` (la del origen, no la de esta fila — ver
   * HistoryFormulaValue.currency). No participan de ningún otro campo.
   */
  sourceChainId?: string | null;
  sourceMovementId?: string | null;
  sourceInstallmentGroupId?: string | null;
}

// ---------------------------------------------------------------------------
// Contrato de GET /history — set cerrado de campos del bloque "Qué cambió"
// (docs/design.md, Historial de cambios, §3.1). Ver history.service.ts para
// el mapeo de aplicabilidad por targetKind/calculado y las reglas de omisión
// de la entrada de eliminación (§3.3).
// ---------------------------------------------------------------------------

/**
 * Identificador cerrado de campo del bloque "Qué cambió" — 1:1 con las 12 filas
 * de docs/design.md §3.1. Orden de presentación fijo: ver `HISTORY_FIELD_ORDER`.
 *
 * Mapeo identificador → rótulo del spec:
 *   amount         → "Monto"
 *   formula        → "Fórmula"
 *   currency       → "Moneda"
 *   exchangeRate   → "Cotización"
 *   type           → "Tipo"
 *   category       → "Categoría"
 *   description    → "Descripción"
 *   date           → "Fecha"
 *   startMonth     → "Mes de inicio"
 *   installments   → "Cuotas"
 *   paymentMethod  → "Método de pago"
 *   autoDebit      → "Débito automático"
 */
export type HistoryFieldId =
  | 'amount'
  | 'formula'
  | 'currency'
  | 'exchangeRate'
  | 'type'
  | 'category'
  | 'description'
  | 'date'
  | 'startMonth'
  | 'installments'
  | 'paymentMethod'
  | 'autoDebit';

/** Orden fijo, único para toda la pantalla (docs/design.md §3.1). */
export const HISTORY_FIELD_ORDER: readonly HistoryFieldId[] = [
  'amount',
  'formula',
  'currency',
  'exchangeRate',
  'type',
  'category',
  'description',
  'date',
  'startMonth',
  'installments',
  'paymentMethod',
  'autoDebit',
];

/** Valor del campo `Monto` — monto + moneda + tipo (el frontend pinta signo/símbolo/color). */
export interface HistoryAmountValue {
  amountCents: number;
  currency: Currency;
  type: MovementType;
}

/**
 * Valor del campo `Fórmula` — operador, operando y signo por separado. El
 * frontend arma la expresión legible reusando su builder (misma forma
 * abstracta que la card de detalle cuando `sourceAmountCents === null`),
 * SIN el monto del origen (docs/design.md §3.2.a).
 *
 * `currency`: moneda del ORIGEN del calculado (fijo/único/cuota vigente
 * apuntado por sourceChainId/sourceMovementId/sourceInstallmentGroupId), NO
 * la `currency` guardada en la fila Recurring del calculado — esa es un
 * PLACEHOLDER sin significado (igual que `amountCents`/`exchangeRate`/
 * `anchorCurrency` en esa fila: el monto y la moneda reales de un calculado
 * siempre se derivan del origen, en runtime, nunca de la fila propia — ver
 * docs/backend.md §Movimientos calculados). Es con la que el frontend debe
 * formatear `operand` cuando `operator` lo vuelve un monto (suma/resta).
 */
export interface HistoryFormulaValue {
  operator: FormulaOperator;
  operand: number;
  sign: number;
  currency: Currency;
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
  currency: Currency;
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
 * Una fila del bloque "Qué cambió" (docs/design.md §3).
 *
 * `next` está AUSENTE (no `null`) en las entradas de eliminación — modo de
 * "valor único" del §3.3: solo hay `previous` (el estado del movimiento tal
 * como estaba). En una entrada de edición, `next` siempre está presente.
 */
export type HistoryChangeDto = {
  [F in HistoryFieldId]: {
    field: F;
    previous: HistoryFieldValueMap[F];
    next?: HistoryFieldValueMap[F];
  };
}[HistoryFieldId];
