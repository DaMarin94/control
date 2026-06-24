"use client";

/**
 * Fila de un movimiento en la lista del mes (RF-VM-001).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * Actualizado en Fase 1.1.1: frecuencia dinámica, ítem anulado, acción toggle skip.
 *
 * Layout: grid 40px 1fr auto auto auto
 *   1. Ícono 40×40 tintado (expense-soft/expense-ink o income-soft/income-ink)
 *   2. Texto: nombre + sub-línea (categoría · tipo · [frecuencia para fijos])
 *   3. Fecha en mono (DD Mmm); en cuotas "Cuota X/N"; fijos: vacío
 *   4. Monto mono 15.5px (gastos con −$, ingresos con +$ en income-ink)
 *   5. KebabMenu de acciones (aparece en hover de la fila)
 *
 * Acciones editar/borrar: via KebabMenu (portal+fixed por overflow-hidden de la tarjeta).
 * Fijos añaden "Anular este mes" / "Des-anular este mes" (toggle skip — P1, Fase 1.1.1).
 * Fase 1.1.8: "Crear movimiento desde este" habilitado también en únicos y cuotas.
 *   Marca padre (GitBranch) ya no restringida a fijos — aplica a cualquier origen con hasCalculated.
 *
 * Ítem anulado (skipped=true):
 *   - Contenido de la fila a opacity 0.55 (no el fondo ni el KebabMenu)
 *   - Monto con line-through conservando color semántico
 *   - Badge "Anulado" como primer segmento de la sublínea
 */

import { type MovementItem } from "@/types/movement";
import { type RecurringFrequency } from "@/types/recurring";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowDown, ArrowUp, Repeat, Pencil, Trash2, CalendarOff, CalendarPlus, Link2, GitBranch, Calculator } from "lucide-react";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { useRecurring } from "@/hooks/use-recurring";
import { useSettings } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";

/** Etiqueta en minúscula por valor de frequency (para la sublínea del ítem) */
const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  MONTHLY: "mensual",
  BIMONTHLY: "bimestral",
  QUARTERLY: "trimestral",
  BIANNUAL: "semestral",
  ANNUAL: "anual",
};

interface MovementItemRowProps {
  movement: MovementItem;
  /** Mes que se está visualizando en formato YYYY-MM (necesario para el toggle de skip) */
  viewMonth: string;
  onEdit: (movement: MovementItem) => void;
  onDelete: (movement: MovementItem) => void;
  /** Handler para "Crear movimiento desde este" — para cualquier ítem NO calculado (Fase 1.1.8) */
  onCreateCalculated?: (movement: MovementItem) => void;
}

export function MovementItemRow({ movement, viewMonth, onEdit, onDelete, onCreateCalculated }: MovementItemRowProps) {
  const { skipRecurring } = useRecurring();
  const { toast } = useToast();
  const { defaultCurrency } = useSettings();

  // Fase 1.2.3: mostrar badge y valor original solo cuando moneda ≠ default
  const isCrossRate = movement.currency !== defaultCurrency;

  const isExpense = movement.type === "EXPENSE";
  const isFijo = movement.origin === "fijo";
  const isCuota = movement.origin === "cuota";
  const isSkipped = movement.skipped;

  // Fase 1.1.7/1.1.8 — calculado / padre
  const isCalculated = Boolean(movement.calculated);
  // La marca padre aplica a cualquier origen (fijo, único o cuota) — Fase 1.1.8
  // Un calculado nunca puede ser padre (RF-MCALC-001), por eso !isCalculated
  const isParent = !isCalculated && movement.hasCalculated;

  // Fecha formateada "02 Jun" (solo para únicos)
  const dateFormatted =
    !isFijo && !isCuota && movement.occurredAt && movement.timezone
      ? formatDate(movement.occurredAt, movement.timezone)
      : null;

  // Monto principal: convertedAmountCents (en la moneda default del usuario) como CIFRA;
  // el SIGNO se deriva de amountCents (con signo real; negativo ⇒ EXPENSE con signo −).
  // Para calculados: el backend devuelve convertedAmountCents como magnitud absoluta (≥ 0);
  // el signo real vive en amountCents (negativo cuando formulaSign=-1).
  // Para no calculados: gastos con −$, ingresos con +$.
  // Fase 1.2.3 / 1.2.3-ext: usar convertedAmountCents como cifra dominante;
  // símbolo de la moneda default (todos los convertidos van en la default del usuario).
  function buildAmountDisplay(): string {
    if (isCalculated) {
      // convertedAmountCents es siempre magnitud (≥ 0) para calculados;
      // el signo real lo indica amountCents (con signo).
      const magnitude = Math.abs(movement.convertedAmountCents);
      const signedCents = movement.amountCents;
      if (signedCents === 0) return formatCurrency(0, defaultCurrency); // "$0,00" sin signo
      if (signedCents < 0) return `−${formatCurrency(magnitude, defaultCurrency)}`; // "−$1.234,56"
      return formatCurrency(magnitude, defaultCurrency); // positivo sin prefijo (valor derivado)
    }
    // Movimiento normal: gastos con −$, ingresos con +$ (Math.abs de convertedAmountCents)
    const cents = movement.convertedAmountCents;
    const amountFormatted = formatCurrency(Math.abs(cents), defaultCurrency);
    return isExpense ? `−${amountFormatted}` : `+${amountFormatted}`;
  }
  const amountDisplay = buildAmountDisplay();

  // Fase 1.2.3 / 1.2.3-ext: valor original (monto en la moneda original) — solo si cross-rate.
  // Formato: símbolo de la moneda original + cifra, sin signo, en --muted.
  // Ej: "US$15,00" cuando currency="USD". El badge de código "USD" sigue presente
  // junto al monto convertido; esta línea usa el símbolo para la cifra original.
  function buildOriginalAmountDisplay(): string {
    // amountCents puede ser negativo en calculados — mostrar abs (solo es referencia)
    const originalCents = Math.abs(movement.amountCents);
    return formatCurrency(originalCents, movement.currency);
  }
  const originalAmountDisplay = isCrossRate ? buildOriginalAmountDisplay() : null;

  // Ícono y clases de color por tipo
  const IconComponent = isExpense ? ArrowDown : ArrowUp;
  const iconBg = isExpense ? "bg-expense-soft" : "bg-income-soft";
  const iconColor = isExpense ? "text-expense-ink" : "text-income-ink";

  // Sublínea: "Categoría · tipo · [repeat <frecuencia>]"
  const typeLabel = isExpense ? "gasto" : "ingreso";
  const categoryName = movement.category.name;

  // Cuota label: "Cuota X/N"
  const installmentLabel =
    isCuota && movement.installment
      ? `Cuota ${movement.installment.number}/${movement.installment.total}`
      : null;

  // Etiqueta de frecuencia para fijos
  const frequencyLabel =
    isFijo && movement.frequency
      ? (FREQUENCY_LABEL[movement.frequency] ?? "mensual")
      : "mensual";

  // Handler para el toggle de anular/des-anular
  async function handleSkipToggle() {
    const result = await skipRecurring(movement.id, viewMonth);
    if (!result.success) {
      toast.error(result.error ?? "No se pudo cambiar el estado del movimiento.");
    }
    // Si tiene éxito, React Query invalida la query del mes y la lista se refresca sola
  }

  // Ítems del KebabMenu — para fijos (incluidos calculados de fijo) se añade el toggle skip
  // entre Editar y Eliminar (RF-MF-005). Un calculado de fijo puede anularse por su cuenta
  // (su skipped = skip propio OR skip del padre); los calculados de único/cuota no tienen skip.
  // "Crear movimiento desde este" solo en ítems NO calculados (spec sección 2).
  const menuItems = [
    {
      label: "Editar",
      icon: Pencil,
      onSelect: () => onEdit(movement),
    },
    ...(isFijo
      ? [
          {
            label: isSkipped ? "Des-anular este mes" : "Anular este mes",
            icon: isSkipped ? CalendarPlus : CalendarOff,
            onSelect: handleSkipToggle,
          },
        ]
      : []),
    // "Crear movimiento desde este" — en cualquier ítem NO calculado (Fase 1.1.8)
    // Un calculado no puede ser origen de otro calculado (RF-MCALC-001)
    ...(!isCalculated && onCreateCalculated
      ? [
          {
            label: "Crear movimiento desde este",
            icon: Calculator,
            onSelect: () => onCreateCalculated(movement),
          },
        ]
      : []),
    {
      label: "Eliminar",
      icon: Trash2,
      danger: true as const,
      onSelect: () => onDelete(movement),
    },
  ];

  return (
    <div
      className="group relative grid items-center gap-[14px] px-[18px] cursor-pointer transition-colors duration-[120ms] hover:bg-panel-2 [&+&]:border-t [&+&]:border-hair"
      style={{ gridTemplateColumns: "40px 1fr auto auto auto", padding: `var(--row-pad) 18px` }}
    >
      {/* Col 1: Ícono tintado — afectado por la opacidad del contenido si está anulado */}
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] ${iconBg} ${iconColor} ${isSkipped ? "opacity-[0.55]" : ""}`}
        aria-hidden="true"
      >
        <IconComponent size={19} strokeWidth={2.2} />
      </span>

      {/* Col 2: Nombre + sublínea — atenuado si anulado */}
      <div className={`min-w-0 ${isSkipped ? "opacity-[0.55]" : ""}`}>
        <b className="block text-[14.5px] font-semibold tracking-[-0.01em] text-ink leading-snug truncate">
          {movement.description ?? categoryName}
        </b>
        <span className="flex items-center gap-[7px] text-[12.5px] text-muted flex-wrap">
          {/* Badge "Anulado" — primer segmento (spec 1.1.1 / 1.1.7 orden: Anulado primero) */}
          {isSkipped && (
            <>
              <span
                className="inline-flex items-center rounded-[var(--r-chip)] bg-panel-3 text-muted px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em]"
                aria-label="Movimiento anulado para este mes"
              >
                Anulado
              </span>
              <span
                className="inline-block h-[3px] w-[3px] rounded-full bg-faint shrink-0"
                aria-hidden="true"
              />
            </>
          )}
          {/* Chip "Calculado" — segundo segmento si es calculado (spec 1.a Fase 1.1.7) */}
          {isCalculated && (
            <>
              <span
                className="inline-flex items-center gap-[3px] rounded-[var(--r-chip)] bg-panel-3 text-muted px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em]"
              >
                <Link2 size={11} aria-hidden="true" />
                Calculado
              </span>
              <span
                className="inline-block h-[3px] w-[3px] rounded-full bg-faint shrink-0"
                aria-hidden="true"
              />
            </>
          )}
          <span>{categoryName}</span>
          <span
            className="inline-block h-[3px] w-[3px] rounded-full bg-faint shrink-0"
            aria-hidden="true"
          />
          <span>{typeLabel}</span>
          {isFijo && (
            <>
              <span
                className="inline-block h-[3px] w-[3px] rounded-full bg-faint shrink-0"
                aria-hidden="true"
              />
              <span className="inline-flex items-center gap-[4px]">
                <Repeat size={12} className="opacity-60" aria-hidden="true" />
                {frequencyLabel}
              </span>
            </>
          )}
          {/* "desde {Origen}" — solo si es calculado y el origen tiene nombre (spec 1.a) */}
          {isCalculated && movement.calculated?.sourceDescription && (
            <>
              <span
                className="inline-block h-[3px] w-[3px] rounded-full bg-faint shrink-0"
                aria-hidden="true"
              />
              <span className="text-[12.5px]">
                <span className="text-muted">desde </span>
                <span className="text-ink-2">{movement.calculated.sourceDescription}</span>
              </span>
            </>
          )}
          {/* Indicador padre: GitBranch + contador (spec 1.b) — último segmento */}
          {isParent && (
            <>
              <span
                className="inline-block h-[3px] w-[3px] rounded-full bg-faint shrink-0"
                aria-hidden="true"
              />
              {/* No tenemos conteo de derivados en el ítem; hasCalculated es bool.
                  Mostramos solo el ícono (no podemos saber cuántos hay sin el conteo).
                  Si el backend expone el conteo en el futuro, agregar el número aquí. */}
              <span
                className="inline-flex items-center gap-[3px] text-muted"
                title="Tiene movimiento(s) calculado(s)"
              >
                <GitBranch size={13} aria-hidden="true" />
              </span>
            </>
          )}
        </span>
      </div>

      {/* Col 3: Fecha / cuota — fijos: vacío — atenuado si anulado */}
      <div className={`text-right ${isSkipped ? "opacity-[0.55]" : ""}`}>
        {!isFijo && (
          <span className="block text-[12.5px] text-muted mono whitespace-nowrap">
            {isCuota ? (installmentLabel ?? "") : (dateFormatted ?? "")}
          </span>
        )}
      </div>

      {/* Col 4: Monto mono — tachado si anulado, conservando color semántico */}
      {/* Fase 1.2.3: si cross-rate, la celda se convierte en columna (flex-col) */}
      <div
        className={`flex flex-col items-end text-right min-w-[100px] ${
          isSkipped ? "opacity-[0.55]" : ""
        }`}
      >
        {/* Fila principal del monto: badge de moneda (si cross-rate) + cifra convertida */}
        <span className="inline-flex items-center gap-[7px] justify-end">
          {/* Badge de moneda original (solo si cross-rate) */}
          {isCrossRate && (
            <span
              className="inline-flex items-center rounded-[var(--r-chip)] bg-panel-3 text-muted px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em] mono"
              aria-label={`Moneda original: ${movement.currency}`}
            >
              {movement.currency}
            </span>
          )}
          {/* Monto convertido — dominante */}
          <span
            className={`text-[15.5px] font-semibold mono ${
              isExpense ? "text-ink" : "text-income-ink"
            } ${isSkipped ? "line-through" : ""}`}
          >
            {amountDisplay}
          </span>
        </span>

        {/* Valor original (segunda línea, solo si cross-rate) */}
        {isCrossRate && originalAmountDisplay && (
          <span className="text-[12.5px] font-medium text-muted mono mt-[2px]">
            {originalAmountDisplay}
          </span>
        )}
      </div>

      {/* Col 5: KebabMenu de acciones (portal+fixed — ver CLAUDE.md) */}
      {/* El KebabMenu va a opacidad plena incluso en ítems anulados (es la acción de des-anular) */}
      <KebabMenu
        ariaLabel={`Acciones de ${movement.description ?? categoryName}`}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        items={menuItems}
      />
    </div>
  );
}
