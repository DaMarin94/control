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
 *   3. Fecha en mono (DD Mmm); en cuotas "Cuota X/N"; fijos: vacío
 *   4. Monto mono 15.5px (gastos con −$, ingresos con +$ en income-ink)
 *   5. KebabMenu de acciones (aparece en hover de la fila)
 *
 * Acciones editar/borrar: via KebabMenu (portal+fixed por overflow-hidden de la tarjeta).
 * Fijos añaden "Anular este mes" / "Des-anular este mes" (toggle skip — P1, Fase 1.1.1).
 * P3: el toggle de skip se extiende a únicos ("Anular"/"Des-anular", sin alcance temporal)
 *   y a cuotas ("Anular este mes"/"Des-anular este mes"). Calculados de único/cuota NO
 *   ofrecen el toggle (heredan el skip del origen desde el backend); calculados de fijo sí
 *   (comportamiento previo, sin cambios).
 * Fase 1.1.8: "Crear movimiento desde este" habilitado también en únicos y cuotas.
 *   Marca padre (GitBranch) ya no restringida a fijos — aplica a cualquier origen con hasCalculated.
 *
 * Rediseño de la sublínea (docs/design.md, "Sublínea del ítem de /mes — dos zonas"):
 *   - El tipo (gasto/ingreso) NO se rotula en texto — lo comunican el ícono 40×40 tintado
 *     (col 1) y el signo/color del monto (col 4).
 *   - Zona de identidad (izquierda, flex-1 min-w-0, trunca): [badge Anulado] [● color de
 *     categoría] Categoría · [glifo + nombre método de pago] · [Repeat frecuencia, fijos] ·
 *     [CornerDownRight "desde {Origen}", calculados] — el chip boxeado "Calculado" se
 *     eliminó: se fusiona en el segmento "↳ desde {Origen}".
 *   - Zona de estados (derecha, shrink-0, nunca trunca): cluster de glifos neutros
 *     --muted con aria-label + title — GitBranch (padre) y Zap (débito automático, sin
 *     texto visible). No se renderiza si ninguna bandera aplica.
 *
 * Ítem anulado (skipped=true):
 *   - Contenido de la fila a opacity 0.55 (no el fondo ni el KebabMenu)
 *   - Monto con line-through conservando color semántico
 *   - Badge "Anulado" como primer segmento de la zona de identidad de la sublínea
 */

import { type MovementItem } from "@/types/movement";
import { type RecurringFrequency } from "@/types/recurring";
import { formatCurrency, formatDate } from "@/lib/format";
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
  Zap,
} from "lucide-react";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { PaymentMethodIcon } from "@/components/ui/payment-method-icon";
import { useRecurring } from "@/hooks/use-recurring";
import { useTransactions } from "@/hooks/use-transactions";
import { useInstallments } from "@/hooks/use-installments";
import { useSettings } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import { LimitGlyph, LimitBadge, limitBoldClass, limitFillClass } from "@/components/limits/limit-mark";
import { describeLimitMark, type EvaluatedLimitMark } from "@/lib/limits/evaluate";
import { cn } from "@/lib/utils";

/** Etiqueta en minúscula por valor de frequency (para la sublínea del ítem) */
const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  MONTHLY: "mensual",
  BIMONTHLY: "bimestral",
  QUARTERLY: "trimestral",
  BIANNUAL: "semestral",
  ANNUAL: "anual",
};

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
  /** Handler para "Crear movimiento desde este" — para cualquier ítem NO calculado (Fase 1.1.8) */
  onCreateCalculated?: (movement: MovementItem) => void;
  /**
   * Marca de límite ya evaluada para este ítem (P2 — Fase 1), combinando
   * `mes.item.monto` y `mes.categoria.gastoMes`. undefined/null = sin marca
   * (comportamiento idéntico al de hoy — cero impacto con `limits` vacío).
   */
  limitMark?: EvaluatedLimitMark | null;
}

export function MovementItemRow({ movement, viewMonth, onEdit, onDelete, onCreateCalculated, limitMark }: MovementItemRowProps) {
  const { skipRecurring } = useRecurring();
  const { skipTransaction } = useTransactions();
  const { skipInstallment } = useInstallments();
  const { toast } = useToast();
  const { defaultCurrency } = useSettings();

  // Fase 1.2.3: mostrar badge y valor original solo cuando moneda ≠ default
  const isCrossRate = movement.currency !== defaultCurrency;

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
  const hasAutoDebit = movement.autoDebit === true;

  // P2 — Fase 1: marca visual pasiva de límites (mes.item.monto / mes.categoria.gastoMes).
  // limitMark es undefined/null cuando ningún límite cruza — cero impacto (restricción rectora).
  const limitEffect = limitMark?.effect ?? null;
  const limitTooltip = limitMark
    ? describeLimitMark(limitMark, { categoryName: movement.category.name })
    : null;
  // "fill" siempre va acompañado de un glyph en la zona de estados (a11y — nunca solo color).
  const limitShowsGlyphInStates = limitEffect === "glyph" || limitEffect === "fill";
  const limitShowsBadgeInIdentity = limitEffect === "badge";

  // Zona de estados solo se renderiza si hay al menos una bandera (spec: "sin renderizar" si ninguna aplica)
  const hasStatesZone = isParent || hasAutoDebit || limitShowsGlyphInStates;

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

  // Ítems del KebabMenu — el toggle skip va entre Editar y Eliminar (spec de posición).
  // "Crear movimiento desde este" solo en ítems NO calculados (spec sección 2).
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

  // Efecto "fill" reemplaza el hover tint condicionalmente (docs/design.md) — la fila
  // toma el fondo ámbar estático en lugar del hover panel-2.
  const rowFillClass = limitFillClass(limitEffect);

  return (
    <div
      className={cn(
        "group relative grid items-center gap-[14px] px-[18px] cursor-pointer transition-colors duration-[120ms] [&+&]:border-t [&+&]:border-hair",
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

            {/* Método de pago — solo si el movimiento lo tiene asociado (RF-PM-006) */}
            {movement.paymentMethod && (
              <>
                <IdentitySeparator />
                <span className="inline-flex items-center gap-[4px] shrink-0">
                  <PaymentMethodIcon icon={movement.paymentMethod.icon} size={12} className="text-muted shrink-0" />
                  {movement.paymentMethod.name}
                </span>
              </>
            )}

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
                {hasAutoDebit && (
                  <span
                    className="inline-flex text-muted"
                    aria-label="Débito automático"
                    title="Débito automático"
                  >
                    <Zap size={13} aria-hidden="true" />
                  </span>
                )}
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
