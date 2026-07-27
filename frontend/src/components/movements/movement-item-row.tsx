"use client";

/**
 * Fila de un movimiento en la lista del mes (RF-VM-001).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * Actualizado en Fase 1.1.1: frecuencia dinámica, ítem anulado, acción toggle skip.
 *
 * Layout: grid 40px 1fr auto auto auto
 *   1. Ícono 40×40 tintado (expense-soft/expense-ink o income-soft/income-ink)
 *   2. Texto: nombre + sub-línea en dos zonas (identidad · estados — ver docs/design.md
 *      "Sublínea del ítem de /mes — dos zonas")
 *   3. Un solo discriminador: fecha DD Mmm (único, sin hora) / "Cuota X/N" (cuota) /
 *      vacía (fijo — el arranque migró a la card de detalle)
 *   4. Monto mono 15.5px, SIEMPRE una sola línea (gastos con −$, ingresos con +$ en
 *      income-ink) — sin badge de moneda ni segunda línea de valor original (migraron
 *      a la card de detalle)
 *   5. KebabMenu de acciones (aparece en hover de la fila)
 *
 * Acciones editar/borrar: via KebabMenu (portal+fixed por overflow-hidden de la tarjeta).
 * Fijos añaden "Anular este mes" / "Des-anular este mes" (toggle skip — P1, Fase 1.1.1).
 * P3: el toggle de skip se extiende a únicos ("Anular"/"Des-anular", sin alcance temporal)
 *   y a cuotas ("Anular este mes"/"Des-anular este mes"). Calculados de único/cuota NO
 *   ofrecen el toggle (heredan el skip del origen desde el backend); calculados de fijo sí
 *   (comportamiento previo, sin cambios).
 * Fase 1.1.8: "Crear movimiento calculado" (ex "Crear movimiento desde este") habilitado
 *   también en únicos y cuotas. Marca padre (GitBranch) ya no restringida a fijos —
 *   aplica a cualquier origen con hasCalculated.
 * Duplicar movimiento (docs/design.md §"Duplicar movimiento"): ítem "Duplicar" (ícono
 *   Copy, neutro) — 3.ª posición, entre el toggle de anular y "Crear movimiento
 *   calculado" (ex "Crear movimiento desde este", renombrado para desambiguar con
 *   Duplicar). Mismo gate !isCalculated; no aplica a calculados.
 *
 * Card de detalle de movimiento (docs/design.md §"Card de detalle de movimiento"):
 *   - Fila adelgazada: se retiran de acá (migran a la card) el método de pago, el
 *     glifo Zap de débito automático, el badge de código de moneda + 2da línea de
 *     valor original, y el arranque del fijo (startMonth, ex "desde Mmm AAAA" de col 3).
 *   - El CUERPO de la fila (cols 1–4) abre la card de detalle: `role="button"`,
 *     `tabIndex=0`, `onKeyDown` Enter/Espacio, `aria-label="Ver detalle de {nombre}"`.
 *   - El KebabMenu (col 5) sigue siendo un botón hermano — ya hace `stopPropagation`
 *     en su trigger y en cada ítem del menú (kebab-menu.tsx), así que su clic nunca
 *     abre la card (un solo overlay a la vez).
 *   - La card es read-only pura (sin footer ni acción de edición) — "Editar" vive
 *     únicamente en el kebab, que llama a `onEdit(movement)` del padre.
 *
 * Rediseño de la sublínea (docs/design.md, "Sublínea del ítem de /mes — dos zonas"):
 *   - El tipo (gasto/ingreso) NO se rotula en texto — lo comunican el ícono 40×40 tintado
 *     (col 1) y el signo/color del monto (col 4).
 *   - Zona de identidad (izquierda, flex-1 min-w-0, trunca): [badge Anulado] [● color de
 *     categoría] Categoría · [Repeat frecuencia, fijos] · [CornerDownRight "desde
 *     {Origen}", calculados] — el chip boxeado "Calculado" se eliminó: se fusiona en el
 *     segmento "↳ desde {Origen}".
 *   - Zona de estados (derecha, shrink-0, nunca trunca): cluster de glifos neutros
 *     --muted con aria-label + title — GitBranch (padre) y marca de límite. No se
 *     renderiza si ninguna bandera aplica.
 *
 * Ítem anulado (skipped=true):
 *   - Contenido de la fila a opacity 0.55 (no el fondo ni el KebabMenu)
 *   - Monto con line-through conservando color semántico
 *   - Badge "Anulado" como primer segmento de la zona de identidad de la sublínea
 */

import { useState } from "react";
import { type MovementItem } from "@/types/movement";
import { formatDate } from "@/lib/format";
import { formatConvertedAmountDisplay, FREQUENCY_LABEL } from "@/lib/movements";
import {
  ArrowDown,
  ArrowUp,
  Repeat,
  Pencil,
  Trash2,
  CalendarOff,
  CalendarPlus,
  CornerDownRight,
  GitBranch,
  Calculator,
  Copy,
} from "lucide-react";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { useRecurring } from "@/hooks/use-recurring";
import { useTransactions } from "@/hooks/use-transactions";
import { useInstallments } from "@/hooks/use-installments";
import { useSettings } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import { LimitGlyph, LimitBadge, limitBoldClass, limitFillClass } from "@/components/limits/limit-mark";
import { describeLimitMark, type EvaluatedLimitMark } from "@/lib/limits/evaluate";
import { MovementDetailCard } from "@/components/movements/movement-detail-card";
import { cn } from "@/lib/utils";

/** Separador "·" entre segmentos de la zona de identidad — punto 3px, --faint, aria-hidden */
function IdentitySeparator() {
  return (
    <span
      className="inline-block h-[3px] w-[3px] rounded-full bg-faint shrink-0"
      aria-hidden="true"
    />
  );
}

interface MovementItemRowProps {
  movement: MovementItem;
  /** Mes que se está visualizando en formato YYYY-MM (necesario para el toggle de skip) */
  viewMonth: string;
  onEdit: (movement: MovementItem) => void;
  onDelete: (movement: MovementItem) => void;
  /** Handler para "Crear movimiento calculado" — para cualquier ítem NO calculado (Fase 1.1.8) */
  onCreateCalculated?: (movement: MovementItem) => void;
  /** Handler para "Duplicar" (docs/design.md) — para cualquier ítem NO calculado */
  onDuplicate?: (movement: MovementItem) => void;
  /**
   * Marca de límite ya evaluada para este ítem (P2 — Fase 1), combinando
   * `mes.item.monto` y `mes.categoria.gastoMes`. undefined/null = sin marca
   * (comportamiento idéntico al de hoy — cero impacto con `limits` vacío).
   */
  limitMark?: EvaluatedLimitMark | null;
}

export function MovementItemRow({ movement, viewMonth, onEdit, onDelete, onCreateCalculated, onDuplicate, limitMark }: MovementItemRowProps) {
  const { skipRecurring } = useRecurring();
  const { skipTransaction } = useTransactions();
  const { skipInstallment } = useInstallments();
  const { toast } = useToast();
  const { defaultCurrency } = useSettings();

  // Card de detalle de movimiento (docs/design.md §"Card de detalle de movimiento") —
  // abierta por el cuerpo de la fila, cerrada por ✕/Esc/clic en el scrim o al pasar a Editar.
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const isExpense = movement.type === "EXPENSE";
  const isFijo = movement.origin === "fijo";
  const isUnico = movement.origin === "unico";
  const isCuota = movement.origin === "cuota";
  const isSkipped = movement.skipped;

  // Fase 1.1.7/1.1.8 — calculado / padre
  const isCalculated = Boolean(movement.calculated);
  // La marca padre aplica a cualquier origen (fijo, único o cuota) — Fase 1.1.8
  // Un calculado nunca puede ser padre (RF-MCALC-001), por eso !isCalculated
  const isParent = !isCalculated && movement.hasCalculated;

  // P2 — Fase 1: marca visual pasiva de límites (mes.item.monto / mes.categoria.gastoMes).
  // limitMark es undefined/null cuando ningún límite cruza — cero impacto (restricción rectora).
  const limitEffect = limitMark?.effect ?? null;
  const limitTooltip = limitMark
    ? describeLimitMark(limitMark, { categoryName: movement.category.name })
    : null;
  // "fill" siempre va acompañado de un glyph en la zona de estados (a11y — nunca solo color).
  const limitShowsGlyphInStates = limitEffect === "glyph" || limitEffect === "fill";
  const limitShowsBadgeInIdentity = limitEffect === "badge";

  // Zona de estados — reducida a límite + GitBranch (padre). El débito automático
  // migró a la card de detalle (P4 — Card de detalle de movimiento), ya no aplica acá.
  // Sin renderizar si ninguna bandera aplica (spec).
  const hasStatesZone = isParent || limitShowsGlyphInStates;

  // Fecha formateada "02 Jun" (solo para únicos)
  const dateFormatted =
    !isFijo && !isCuota && movement.occurredAt && movement.timezone
      ? formatDate(movement.occurredAt, movement.timezone)
      : null;

  // Monto principal: convertedAmountCents (en la moneda default del usuario) como CIFRA;
  // el SIGNO se deriva de amountCents (con signo real; negativo ⇒ EXPENSE con signo −).
  // Helper compartido con MovementDetailCard (lib/movements.ts) — mismo cálculo, dos lugares.
  // Col 4 SIEMPRE una sola línea (P4 — Card de detalle: sin badge de moneda ni 2da línea
  // de valor original, migraron a la card).
  const amountDisplay = formatConvertedAmountDisplay(movement, defaultCurrency);

  // Ícono y clases de color por tipo
  const IconComponent = isExpense ? ArrowDown : ArrowUp;
  const iconBg = isExpense ? "bg-expense-soft" : "bg-income-soft";
  const iconColor = isExpense ? "text-expense-ink" : "text-income-ink";

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

  // Handler para el toggle de anular/des-anular — enruta por origen (P3)
  async function handleSkipToggle() {
    const result = isFijo
      ? await skipRecurring(movement.id, viewMonth)
      : isCuota
        ? await skipInstallment(movement.id, viewMonth)
        : await skipTransaction(movement.id, viewMonth);
    if (!result.success) {
      toast.error(result.error ?? "No se pudo cambiar el estado del movimiento.");
    }
    // Si tiene éxito, React Query invalida la query del mes y la lista se refresca sola
  }

  // Toggle skip visible en: fijos (incluidos calculados de fijo — RF-MF-005; un calculado
  // de fijo puede anularse por su cuenta, su skipped = skip propio OR skip del padre) y en
  // únicos/cuotas NO calculados (P3). Los calculados de único/cuota no ofrecen el toggle
  // porque heredan el skip del origen desde el backend.
  const showSkipToggle = isFijo || ((isUnico || isCuota) && !isCalculated);
  // Rótulo: fijo y cuota llevan "este mes" (alcance temporal); único no (P3 spec).
  const skipLabel = isUnico
    ? isSkipped
      ? "Des-anular"
      : "Anular"
    : isSkipped
      ? "Des-anular este mes"
      : "Anular este mes";

  // Ítems del KebabMenu — orden: Editar → Anular/Des-anular → Duplicar →
  // Crear movimiento calculado → Eliminar (docs/design.md §"Duplicar movimiento").
  // Duplicar y "Crear movimiento calculado" comparten el gate !isCalculated —
  // el grupo aparece o desaparece completo (un calculado no puede ser origen
  // de otro calculado, RF-MCALC-001, ni duplicarse — no aplica a calculados).
  const menuItems = [
    {
      label: "Editar",
      icon: Pencil,
      onSelect: () => onEdit(movement),
    },
    ...(showSkipToggle
      ? [
          {
            label: skipLabel,
            icon: isSkipped ? CalendarPlus : CalendarOff,
            onSelect: handleSkipToggle,
          },
        ]
      : []),
    // "Duplicar" — crea un movimiento nuevo e independiente precargado con los
    // valores de este (POST, no vínculo). En cualquier ítem NO calculado.
    ...(!isCalculated && onDuplicate
      ? [
          {
            label: "Duplicar",
            icon: Copy,
            onSelect: () => onDuplicate(movement),
          },
        ]
      : []),
    // "Crear movimiento calculado" (ex "Crear movimiento desde este") — en
    // cualquier ítem NO calculado (Fase 1.1.8). Un calculado no puede ser
    // origen de otro calculado (RF-MCALC-001).
    ...(!isCalculated && onCreateCalculated
      ? [
          {
            label: "Crear movimiento calculado",
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

  // Efecto "fill" reemplaza el hover tint condicionalmente (docs/design.md) — la fila
  // toma el fondo ámbar estático en lugar del hover panel-2.
  const rowFillClass = limitFillClass(limitEffect);

  const rowLabel = movement.description ?? categoryName;

  // Card de detalle — el cuerpo de la fila abre la card (docs/design.md §"Conflicto de
  // invocación — cuerpo abre card, kebab abre menú"). El kebab ya hace stopPropagation
  // en su trigger y en cada ítem (kebab-menu.tsx), así que su clic nunca llega acá.
  function handleRowKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsDetailOpen(true);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Ver detalle de ${rowLabel}`}
      onClick={() => setIsDetailOpen(true)}
      onKeyDown={handleRowKeyDown}
      className={cn(
        "group relative grid items-center gap-[14px] px-[18px] cursor-pointer transition-colors duration-[120ms] [&+&]:border-t [&+&]:border-hair",
        "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--accent-soft)]",
        rowFillClass ? rowFillClass : "hover:bg-panel-2",
      )}
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

        {/* Sublínea — dos zonas: identidad (izquierda, trunca) · estados (derecha, cluster) */}
        <span className="flex items-center gap-[10px] mt-[1px]">
          {/* Zona de identidad */}
          <span className="flex flex-1 min-w-0 items-center gap-[6px] overflow-hidden text-[12px] text-muted">
            {/* Badge "Anulado" — primer segmento cuando skipped */}
            {isSkipped && (
              <span
                className="inline-flex items-center rounded-[var(--r-chip)] bg-panel-3 text-muted px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em] shrink-0"
                aria-label="Movimiento anulado para este mes"
              >
                Anulado
              </span>
            )}

            {/* Badge de límite — efecto "badge" (P2 — Fase 1), mismo slot que "Anulado" */}
            {limitShowsBadgeInIdentity && limitTooltip && <LimitBadge tooltip={limitTooltip} />}

            {/* Punto de color de categoría — ancla de identidad, inmediatamente antes del nombre */}
            <span
              className="h-[6px] w-[6px] rounded-full shrink-0"
              style={{ background: movement.category.color }}
              aria-hidden="true"
            />
            <span className="min-w-0 truncate text-ink-2">{categoryName}</span>

            {/* Frecuencia — fijos y calculados de origen fijo (la cuota X/N no vive acá, va en col 3) */}
            {isFijo && (
              <>
                <IdentitySeparator />
                <span className="inline-flex items-center gap-[4px] shrink-0">
                  <Repeat size={12} className="text-muted shrink-0" aria-hidden="true" />
                  {frequencyLabel}
                </span>
              </>
            )}

            {/* "↳ desde {Origen}" — fusiona la marca de "es calculado" y la referencia a su
                origen en un único segmento; último segmento de identidad. Sin chip "Calculado" separado. */}
            {isCalculated && movement.calculated?.sourceDescription && (
              <>
                <IdentitySeparator />
                <span className="inline-flex min-w-0 items-center gap-[4px]">
                  <CornerDownRight size={12} className="text-muted shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">
                    <span className="text-muted">desde </span>
                    <span className="text-ink-2">{movement.calculated.sourceDescription}</span>
                  </span>
                </span>
              </>
            )}
          </span>

          {/* Zona de estados — cluster de glifos neutros, derecha, nunca trunca. No se
              renderiza si ninguna bandera aplica. */}
          {hasStatesZone && (
            <>
              <span className="h-[12px] w-px bg-hair shrink-0" aria-hidden="true" />
              <span className="flex items-center gap-[8px] shrink-0">
                {/* Marca de límite — efecto "glyph"/"fill" (P2 — Fase 1), primero del cluster */}
                {limitShowsGlyphInStates && limitTooltip && <LimitGlyph tooltip={limitTooltip} />}
                {isParent && (
                  <span
                    className="inline-flex text-muted"
                    aria-label="Tiene movimiento(s) calculado(s)"
                    title="Tiene movimiento(s) calculado(s)"
                  >
                    <GitBranch size={13} aria-hidden="true" />
                  </span>
                )}
              </span>
            </>
          )}
        </span>
      </div>

      {/* Col 3: un solo discriminador — fecha (único, sin hora) / Cuota X/N / vacía (fijo) */}
      <div className={`text-right ${isSkipped ? "opacity-[0.55]" : ""}`}>
        <span className="block text-[12.5px] text-muted mono whitespace-nowrap">
          {isFijo ? "" : isCuota ? (installmentLabel ?? "") : (dateFormatted ?? "")}
        </span>
      </div>

      {/* Col 4: Monto mono — SIEMPRE una sola línea, tachado si anulado, color semántico */}
      <div
        className={`flex items-center justify-end text-right min-w-[100px] ${
          isSkipped ? "opacity-[0.55]" : ""
        }`}
      >
        {/* Monto convertido — dominante. Efecto "bold" (P2 — Fase 1) sube 600→700. */}
        <span
          className={cn(
            "text-[15.5px] mono",
            limitBoldClass(limitEffect) ?? "font-semibold",
            isExpense ? "text-ink" : "text-income-ink",
            isSkipped ? "line-through" : "",
          )}
        >
          {amountDisplay}
        </span>
      </div>

      {/* Col 5: KebabMenu de acciones (portal+fixed — ver CLAUDE.md) */}
      {/* El KebabMenu va a opacidad plena incluso en ítems anulados (es la acción de des-anular) */}
      <KebabMenu
        ariaLabel={`Acciones de ${movement.description ?? categoryName}`}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        items={menuItems}
      />

      {/* Card de detalle de movimiento — read-only, cierra con ✕/Esc/clic en el scrim */}
      {isDetailOpen && <MovementDetailCard movement={movement} onClose={() => setIsDetailOpen(false)} />}
    </div>
  );
}
