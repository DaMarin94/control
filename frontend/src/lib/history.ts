/**
 * Helpers puros del Historial de cambios (docs/design.md §"Historial de cambios
 * (`/historial`)"). Traducen un `HistoryChangeDto` del contrato de la API a los
 * textos/tonos que pinta la fila del bloque "Qué cambió" — tanto en la lista
 * (`previous → next`) como en el modal de deshacer (`next → previous`, espejo,
 * ver §5).
 *
 * Reusa `lib/formula.ts` (builder de expresión legible, forma abstracta) y
 * `lib/format.ts` (moneda, fechas, cotización) — ningún formateador nuevo salvo
 * lo estrictamente propio de este dominio (verbos de transición, unidad de
 * cuotas, etc.).
 */

import type { MovementType } from "@/types/movement";
import type {
  HistoryChangeDto,
  HistoryFieldId,
  HistoryTargetKind,
  HistoryAmountValue,
  HistoryFormulaValue,
  HistoryDateValue,
  HistoryEntryResponseDto,
  HistoryAction,
  HistoryReopenInfo,
} from "@/types/history";
import { descaleOperand, buildFormulaExpression, sourceMonthOffsetLabel } from "@/lib/formula";
import {
  formatCurrency,
  formatExchangeRate,
  formatDate,
  formatTime,
  formatMonthShort,
  formatDayMonth,
  prevMonth,
} from "@/lib/format";

// ─── Rótulos ────────────────────────────────────────────────────────────────────

/** Mapeo `field` → rótulo (docs/design.md §3.1, contrato del backend). */
export const HISTORY_FIELD_LABELS: Record<HistoryFieldId, string> = {
  amount: "Monto",
  formula: "Fórmula",
  currency: "Moneda",
  exchangeRate: "Cotización",
  type: "Tipo",
  category: "Categoría",
  description: "Descripción",
  date: "Fecha",
  startMonth: "Mes de inicio",
  installments: "Cuotas",
  paymentMethod: "Método de pago",
  autoDebit: "Débito automático",
};

/** Chip de operación de la entrada (docs/design.md §2 + "Reabrir un fijo terminado" §7.1). */
export const HISTORY_ACTION_CHIP_LABEL: Record<HistoryAction, string> = {
  EDIT: "Editado",
  DELETE: "Eliminado",
  REOPEN: "Reabierto",
};

/** Rótulo de la fila de reapertura "Vigencia" (RF-MF-008 — docs/design.md §7.2). */
export const HISTORY_VIGENCIA_LABEL = "Vigencia";

/** Rótulo de estructura para la sublínea de identidad de la entrada (§2). */
export const HISTORY_TARGET_KIND_LABEL: Record<HistoryTargetKind, string> = {
  UNICO: "Único",
  FIJO: "Fijo",
  CUOTA: "Cuotas",
};

/**
 * Nombre único de la entrada (`rowLabel`) — fuente única para la línea de
 * identidad de la fila, su `aria-label`, la caja de identidad del modal de
 * deshacer y el callout del modal de cadena (docs/design.md §2).
 */
export function getHistoryEntryName(entry: HistoryEntryResponseDto): string {
  return entry.description ?? entry.category?.name ?? "Movimiento";
}

// ─── Momento (col 3 / caja de identidad de los modales) ────────────────────────

/**
 * Formatea `createdAt` (instante de sistema en que se registró la entrada) como
 * `{DD Mmm} · {HH:MM}`, en la zona horaria del navegador — `createdAt` no es un
 * instante "de negocio" con su propia zona (a diferencia de `occurredAt` de un
 * único, RN-011): es cuándo el usuario hizo el cambio, en su propio dispositivo.
 */
export function formatHistoryMoment(createdAt: string, timezone: string): string {
  return `${formatDayMonth(createdAt, timezone)} · ${formatTime(createdAt, timezone)}`;
}

// ─── Formato de valores por campo ──────────────────────────────────────────────

/** Cifra con signo + símbolo + color por tipo (gasto `--ink` / ingreso `--income-ink`). */
export function formatHistoryAmount(value: HistoryAmountValue): { text: string; colorClass: string } {
  const isExpense = value.type === "EXPENSE";
  const cents = Math.abs(value.amountCents);
  const text = `${isExpense ? "−" : "+"}${formatCurrency(cents, value.currency)}`;
  return { text, colorClass: isExpense ? "text-ink" : "text-income-ink" };
}

/**
 * Expresión legible de la fórmula, forma abstracta (sin cifra de origen, §3.2.a)
 * con el signo del resultado como prefijo (`+`/`−`, §3.2.a "el signo viaja
 * dentro de la expresión").
 *
 * `value.currency` es la moneda PROPIA del calculado (la del `Recurring`) —
 * se usa para formatear el operando solo cuando el operador lo vuelve un
 * monto (ADD/SUB); el resto de los operadores no formatean moneda.
 *
 * `value.sourceMonthOffset` (0..12, "Mes del monto base del calculado",
 * docs/design.md) se agrega como cola `· {etiqueta}` cuando es `> 0` — así
 * una edición que cambia SOLO el desfasaje (misma fórmula, mismo signo) se
 * lee como un cambio real en la fila `formula`, no como un no-op.
 */
export function formatHistoryFormula(value: HistoryFormulaValue): string {
  const userOperand = descaleOperand(value.operand, value.operator);
  const expression = buildFormulaExpression(null, value.operator, userOperand, value.currency);
  const base = `${value.sign < 0 ? "−" : "+"}${expression}`;
  if (value.sourceMonthOffset > 0) {
    return `${base} · ${sourceMonthOffsetLabel(value.sourceMonthOffset)}`;
  }
  return base;
}

/** `dd/mm/aaaa · HH:MM` — fecha y hora como un solo campo (§3.2.f). */
export function formatHistoryDate(value: HistoryDateValue): string {
  return `${formatDate(value.occurredAt, value.timezone)} · ${formatTime(value.occurredAt, value.timezone)}`;
}

/** `{n} cuota` / `{n} cuotas` — unidad singular/plural. */
export function formatInstallmentsUnit(n: number): string {
  return `${n} ${n === 1 ? "cuota" : "cuotas"}`;
}

export { formatMonthShort, formatExchangeRate };

// ─── Descripción genérica de un cambio (fila del bloque "Qué cambió") ──────────

/** Dirección de lectura del par (docs/design.md §5 — "es el espejo de la fila"). */
export type HistoryChangeDirection = "list" | "modal";

/**
 * Forma neutra (sin JSX) de UNA fila del bloque "Qué cambió", lista tanto para
 * pintar la fila real (`HistoryChangeRow`) como para el resumen corto de una
 * línea del modal de cadena (§6.2: "el campo de monto si cambió, si no el
 * primer campo del orden fijo").
 *
 * - `leftText === null` → sin par: entrada de eliminación (modo de valor único,
 *   §3.3) o el campo `autoDebit` (nunca tiene par, §3.2.d) — solo se pinta `rightText`.
 * - `isState` decide el tono por defecto del lado derecho cuando no hay `next`
 *   real: `--ink-2` en vez de `--ink` (§3.3), salvo el override de color por
 *   tipo (dinero).
 * - `mono` / `promoted` / `truncatable` gobiernan tipografía (regla dura 3 y
 *   §3 "el monto manda").
 */
export interface HistoryChangeDisplay {
  field: HistoryFieldId;
  label: string;
  isState: boolean;
  leftText: string | null;
  leftDotColor?: string;
  rightText: string;
  rightDotColor?: string;
  /** Override de tono — solo `amount` lo usa (color por tipo, nunca `--muted`/`--ink`/`--ink-2` planos). */
  rightColorClass?: string;
  mono: boolean;
  /** Verdadero únicamente para `amount` — escala 15.5px/600, siempre la primera fila (§3, "el monto manda"). */
  promoted: boolean;
  /** Preposición en `--faint` que antecede a `leftText` (solo la fila "Vigencia": "hasta" / "desde"). */
  leftPrefix?: string;
  /** Ídem para `rightText`. */
  rightPrefix?: string;
  /** Verdadero para campos de texto (Categoría/Descripción/Método de pago/Moneda/Tipo) — truncan con elipsis en vez de envolver (§9). */
  truncatable: boolean;
}

/**
 * Resuelve qué valor va a la izquierda (muted, "no manda") y cuál a la derecha
 * (gana la fila) según la dirección de lectura. `undefined` en `next` (modo de
 * valor único) SIEMPRE produce `left: undefined` — nunca confundir con un
 * valor real `null` (ver el tipo `T` de cada campo, que puede incluir `null`
 * legítimamente: `description`, `paymentMethod`).
 */
function sidesOf<T>(
  previous: T,
  next: T | undefined,
  direction: HistoryChangeDirection,
): { left: T | undefined; right: T } {
  if (next === undefined) return { left: undefined, right: previous };
  return direction === "list" ? { left: previous, right: next } : { left: next, right: previous };
}

function movementTypeLabel(type: MovementType): string {
  return type === "EXPENSE" ? "Gasto" : "Ingreso";
}

/**
 * Traduce un `HistoryChangeDto` a su forma de presentación (docs/design.md §3).
 */
export function describeHistoryChange(
  change: HistoryChangeDto,
  direction: HistoryChangeDirection,
): HistoryChangeDisplay {
  const label = HISTORY_FIELD_LABELS[change.field];
  const isState = !("next" in change);

  switch (change.field) {
    case "amount": {
      const { left, right } = sidesOf(change.previous, change.next, direction);
      const rightFmt = formatHistoryAmount(right);
      return {
        field: "amount",
        label,
        isState,
        mono: true,
        promoted: true,
        truncatable: false,
        leftText: left ? formatHistoryAmount(left).text : null,
        rightText: rightFmt.text,
        rightColorClass: rightFmt.colorClass,
      };
    }

    case "formula": {
      const { left, right } = sidesOf(change.previous, change.next, direction);
      return {
        field: "formula",
        label,
        isState,
        mono: true,
        promoted: false,
        truncatable: false,
        leftText: left ? formatHistoryFormula(left) : null,
        rightText: formatHistoryFormula(right),
      };
    }

    case "currency": {
      const { left, right } = sidesOf(change.previous, change.next, direction);
      return {
        field: "currency",
        label,
        isState,
        mono: false,
        promoted: false,
        truncatable: true,
        leftText: left ?? null,
        rightText: right,
      };
    }

    case "exchangeRate": {
      const { left, right } = sidesOf(change.previous, change.next, direction);
      return {
        field: "exchangeRate",
        label,
        isState,
        mono: true,
        promoted: false,
        truncatable: false,
        leftText: left !== undefined ? formatExchangeRate(left) : null,
        rightText: formatExchangeRate(right),
      };
    }

    case "type": {
      const { left, right } = sidesOf(change.previous, change.next, direction);
      return {
        field: "type",
        label,
        isState,
        mono: false,
        promoted: false,
        truncatable: true,
        leftText: left ? movementTypeLabel(left) : null,
        rightText: movementTypeLabel(right),
      };
    }

    case "category": {
      const { left, right } = sidesOf(change.previous, change.next, direction);
      return {
        field: "category",
        label,
        isState,
        mono: false,
        promoted: false,
        truncatable: true,
        leftText: left ? left.name : null,
        leftDotColor: left?.color,
        rightText: right.name,
        rightDotColor: right.color,
      };
    }

    case "description": {
      const { left, right } = sidesOf(change.previous, change.next, direction);
      return {
        field: "description",
        label,
        isState,
        mono: false,
        promoted: false,
        truncatable: true,
        leftText: left === undefined ? null : (left ?? "—"),
        rightText: right ?? "—",
      };
    }

    case "date": {
      const { left, right } = sidesOf(change.previous, change.next, direction);
      return {
        field: "date",
        label,
        isState,
        mono: true,
        promoted: false,
        truncatable: false,
        leftText: left ? formatHistoryDate(left) : null,
        rightText: formatHistoryDate(right),
      };
    }

    case "startMonth": {
      const { left, right } = sidesOf(change.previous, change.next, direction);
      return {
        field: "startMonth",
        label,
        isState,
        mono: true,
        promoted: false,
        truncatable: false,
        leftText: left ? formatMonthShort(left) : null,
        rightText: formatMonthShort(right),
      };
    }

    case "installments": {
      const { left, right } = sidesOf(change.previous, change.next, direction);
      return {
        field: "installments",
        label,
        isState,
        mono: true,
        promoted: false,
        truncatable: false,
        // Bare, SIN unidad — la palabra "cuota(s)" va una sola vez, en el valor que gana (§3.2.c).
        leftText: left !== undefined ? String(left) : null,
        rightText: formatInstallmentsUnit(right),
      };
    }

    case "paymentMethod": {
      const { left, right } = sidesOf(change.previous, change.next, direction);
      return {
        field: "paymentMethod",
        label,
        isState,
        mono: false,
        promoted: false,
        truncatable: true,
        leftText: left === undefined ? null : (left?.name ?? "—"),
        rightText: right?.name ?? "—",
      };
    }

    case "autoDebit": {
      if (isState) {
        // Modo de valor único (§3.3) — el backend solo emite esta fila cuando está activo.
        return {
          field: "autoDebit",
          label,
          isState,
          mono: false,
          promoted: false,
          truncatable: false,
          leftText: null,
          rightText: change.previous ? "Activado" : "Desactivado",
        };
      }
      // Booleano sin par (§3.2.d): list = verbo pasado según `next`; modal = verbo
      // presente según `previous` (lo que va a quedar tras deshacer — espejo de §5).
      const rightText =
        direction === "list"
          ? change.next
            ? "Se activó"
            : "Se desactivó"
          : change.previous
            ? "Se activa"
            : "Se desactiva";
      return {
        field: "autoDebit",
        label,
        isState,
        mono: false,
        promoted: false,
        truncatable: false,
        leftText: null,
        rightText,
      };
    }
  }
}

// ─── Fila "Vigencia" de una reapertura (RF-MF-008) ─────────────────────────────

/**
 * Fila `Vigencia` de una entrada `REOPEN` (docs/design.md "Reabrir un fijo
 * terminado" §7.2/§7.3). No viaja en `changes`: sale de `entry.reopen`.
 * - `list`: `hasta {último mes} → desde {X}` (terminaba acá → vuelve acá).
 * - `modal`: invertido, `desde {X} → hasta {último mes}` (el estado que queda).
 * "hasta" = último mes de aparición = `prevMonth(endMonth)` (el fin es exclusivo).
 */
export function describeReopenVigencia(
  reopen: HistoryReopenInfo,
  direction: HistoryChangeDirection,
): HistoryChangeDisplay {
  const until = formatMonthShort(prevMonth(reopen.endMonth));
  const from = formatMonthShort(reopen.reopenMonth);
  const isList = direction === "list";
  return {
    field: "startMonth",
    label: HISTORY_VIGENCIA_LABEL,
    isState: false,
    leftPrefix: isList ? "hasta" : "desde",
    leftText: isList ? until : from,
    rightPrefix: isList ? "desde" : "hasta",
    rightText: isList ? from : until,
    mono: true,
    promoted: false,
    truncatable: false,
  };
}

/**
 * Fila `Tramo anulado` (valor único; §7.2/§7.3). Solo si hubo relleno
 * (`skippedCount > 0`). En el modal pasa a verbo en presente.
 * Lista: `{N} apariciones · {Mmm AAAA} – {Mmm AAAA}` / `una aparición · {Mmm AAAA}`
 * (rango de `skippedFrom`/`skippedTo`; si faltan, solo el conteo).
 */
function describeReopenSkipped(reopen: HistoryReopenInfo, direction: HistoryChangeDirection): HistoryChangeDisplay | null {
  const n = reopen.skippedCount ?? 0;
  if (n <= 0) return null;
  const count = n === 1 ? "una aparición" : `${n} apariciones`;
  const { skippedFrom, skippedTo } = reopen;
  let listText = count;
  if (n === 1) {
    const only = skippedFrom ?? skippedTo;
    if (only) listText = `${count} · ${formatMonthShort(only)}`;
  } else if (skippedFrom && skippedTo) {
    listText = `${count} · ${formatMonthShort(skippedFrom)} – ${formatMonthShort(skippedTo)}`;
  }
  return {
    field: "startMonth",
    label: "Tramo anulado",
    isState: true,
    leftText: null,
    rightText: direction === "list" ? listText : "Vuelve a quedar fuera de vigencia",
    mono: direction === "list",
    promoted: false,
    truncatable: false,
  };
}

/** Fila `Calculados` (valor único; §7.2/§7.3). Solo si se reabrieron calculados. */
function describeReopenCalculated(reopen: HistoryReopenInfo, direction: HistoryChangeDirection): HistoryChangeDisplay | null {
  const n = reopen.reopenedCalculated?.length ?? 0;
  if (n <= 0) return null;
  const text =
    direction === "list"
      ? n === 1
        ? "1 reabierto"
        : `${n} reabiertos`
      : n === 1
        ? "1 vuelve a terminar"
        : `${n} vuelven a terminar`;
  return {
    field: "startMonth",
    label: "Calculados",
    isState: true,
    leftText: null,
    rightText: text,
    mono: false,
    promoted: false,
    truncatable: false,
  };
}

/** Texto plano de un valor de la fila (preposición + valor), para resúmenes. */
function displayValueText(display: HistoryChangeDisplay): string {
  return display.rightPrefix ? `${display.rightPrefix} ${display.rightText}` : display.rightText;
}

/** Campos que, en el orden fijo, van DESPUÉS de `Vigencia` (que se inserta tras `Mes de inicio`). */
const FIELDS_AFTER_VIGENCIA: ReadonlySet<HistoryFieldId> = new Set(["installments", "paymentMethod", "autoDebit"]);

/**
 * Filas del bloque "Qué cambió" de una entrada, en el orden fijo de la pantalla.
 * Una reapertura suma `Vigencia` (siempre) entre `Mes de inicio` y `Cuotas`; el
 * resto de las filas son las de `changes`, tal como las emite el backend.
 * También `Tramo anulado` y `Calculados` cuando aplican (valor único).
 */
export function buildHistoryDisplays(
  entry: Pick<HistoryEntryResponseDto, "changes" | "reopen">,
  direction: HistoryChangeDirection,
): HistoryChangeDisplay[] {
  const displays = entry.changes.map((c) => describeHistoryChange(c, direction));
  if (!entry.reopen) return displays;
  const extra = [
    describeReopenVigencia(entry.reopen, direction),
    describeReopenSkipped(entry.reopen, direction),
    describeReopenCalculated(entry.reopen, direction),
  ].filter((d): d is HistoryChangeDisplay => d !== null);
  const insertAt = entry.changes.findIndex((c) => FIELDS_AFTER_VIGENCIA.has(c.field));
  if (insertAt === -1) displays.push(...extra);
  else displays.splice(insertAt, 0, ...extra);
  return displays;
}

/**
 * Campos cuyo valor en el resumen del modal de cadena es una cifra
 * indivisible (§6.2, prioridad de contención 2): nunca truncan — si no
 * entran, el resumen entero envuelve a una segunda línea. El resto de los
 * campos son texto y truncan con elipsis (prioridad 4).
 */
const HISTORY_SUMMARY_NOWRAP_FIELDS: ReadonlySet<HistoryFieldId> = new Set([
  "amount",
  "exchangeRate",
  "installments",
  "date",
  "startMonth",
  "formula",
]);

/**
 * Resumen corto de UNA fila del modal de cadena (§6.2): **un solo valor**,
 * `{Rótulo}: {valor resultante}` — el "después" en una edición, el valor que
 * el movimiento tenía en una eliminación. NUNCA el par `anterior → nuevo`:
 * esa lista responde "cuáles se van a deshacer", no "qué cambió en cada
 * una" (para eso está la entrada completa en la lista principal), y el par
 * duplicaba el ancho justo donde causaba las cifras cortadas en QA.
 *
 * `nowrap` distingue cifra indivisible (nunca trunca, envuelve entera) de
 * texto (trunca con elipsis) — ver prioridad de contención de §6.2.
 */
export function summarizeHistoryChange(change: HistoryChangeDto): { text: string; nowrap: boolean } {
  const display = describeHistoryChange(change, "list");
  return {
    text: `${display.label}: ${display.rightText}`,
    nowrap: HISTORY_SUMMARY_NOWRAP_FIELDS.has(change.field),
  };
}

/** Elige el campo a resumir en una fila del modal de cadena: `amount` si cambió, si no el primero (§6.2). */
export function pickSummaryChange(changes: HistoryChangeDto[]): HistoryChangeDto | undefined {
  return changes.find((c) => c.field === "amount") ?? changes[0];
}

/**
 * Resumen de una entrada completa para el modal de cadena (§6.2): `Monto` si
 * participa; si no, el primer campo del orden fijo (en una reapertura sin cambio
 * de monto, `Vigencia: desde Sep 2026`).
 */
export function summarizeHistoryEntry(
  entry: Pick<HistoryEntryResponseDto, "changes" | "reopen">,
): { text: string; nowrap: boolean } | undefined {
  const displays = buildHistoryDisplays(entry, "list");
  const pick = displays.find((d) => d.field === "amount") ?? displays[0];
  if (!pick) return undefined;
  const isVigencia = pick.label === HISTORY_VIGENCIA_LABEL;
  return {
    text: `${pick.label}: ${displayValueText(pick)}`,
    nowrap: isVigencia || HISTORY_SUMMARY_NOWRAP_FIELDS.has(pick.field),
  };
}
