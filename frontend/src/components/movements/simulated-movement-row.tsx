"use client";

/**
 * Fila del movimiento SIMULADO en la sección Únicos de `/mes` (docs/design.md
 * "Simulación de categoría (`/mes`)" §1, RF-SIM-003). Vive mezclada con las
 * filas reales (`MovementItemRow`) — mismo grid `40px 1fr auto auto auto`,
 * mismo padding `var(--row-pad) 18px`, mismo hairline entre hermanas — pero
 * el TRATAMIENTO cambia, nunca la geometría (regla dura 3: la columna de
 * montos tiene que seguir alineada entre filas reales y simuladas).
 *
 * Señales de la fila (§1, ninguna depende solo del color):
 * - Col 1: caja de ícono HUECA con borde punteado del color del tipo (en vez
 *   del relleno sólido de una fila real) — misma flecha de dirección.
 * - Col 2: nombre = categoría (el simulado no tiene descripción propia);
 *   sublínea = chip "Simulado" (mismo molde que "Anulado") + punto de
 *   categoría + nombre + "· tendencia de 12 meses" (último segmento, trunca
 *   primero al angostarse — §8.1).
 * - Col 3: vacía (sin instante, RF-SIM-003) — mismo precedente que un fijo.
 * - Col 4: monto con prefijo `≈` DENTRO del mismo span mono (no rompe la
 *   alineación tabular con las filas reales).
 * - Col 5: placeholder inerte 32×32 (misma caja que `KebabMenu`) — el hueco
 *   se RESERVA, nunca se colapsa (colapsarlo correría el monto 32px).
 *
 * NO interactiva (§1.6): sin `role="button"`, sin `tabIndex`, sin handler de
 * click/teclado, sin hover tint, `cursor-default`. Única excepción: el fondo
 * ámbar del efecto "fill" de una marca de límite SÍ se aplica (es una marca
 * sobre el dato, no un estado de interacción).
 *
 * NO se atenúa (§1.7): un simulado SUMA a subtotal/contador/totales — atenuar
 * diría lo contrario (ese lenguaje visual está reservado a "no computa").
 *
 * El glifo `GitBranch` (padre de calculados) NUNCA aplica acá: un simulado no
 * puede originar ni ser un calculado (RN-029) — `movement.hasCalculated` es
 * siempre `false` para estos ítems, así que no hace falta un guard extra.
 */

import { ArrowDown, ArrowUp } from "lucide-react";
import type { MovementItem } from "@/types/movement";
import { useSettings } from "@/hooks/use-settings";
import { formatConvertedAmountDisplay } from "@/lib/movements";
import {
  LimitGlyph,
  LimitBadge,
  limitBoldClass,
  limitFillClass,
} from "@/components/limits/limit-mark";
import { describeLimitMark, type EvaluatedLimitMark } from "@/lib/limits/evaluate";
import { cn } from "@/lib/utils";

/** Separador "·" entre segmentos de la sublínea — mismo molde que `MovementItemRow`. */
function IdentitySeparator() {
  return (
    <span
      className="inline-block h-[3px] w-[3px] rounded-full bg-faint shrink-0"
      aria-hidden="true"
    />
  );
}

interface SimulatedMovementRowProps {
  movement: MovementItem;
  /** Marca de límite ya evaluada (mismo motor que una fila real — RN-029: entra en la evaluación pasiva). */
  limitMark?: EvaluatedLimitMark | null;
}

export function SimulatedMovementRow({ movement, limitMark }: SimulatedMovementRowProps) {
  const { defaultCurrency } = useSettings();

  const isExpense = movement.type === "EXPENSE";
  const categoryName = movement.category.name;

  const limitEffect = limitMark?.effect ?? null;
  const limitTooltip = limitMark
    ? describeLimitMark(limitMark, { categoryName })
    : null;
  const limitShowsGlyphInStates = limitEffect === "glyph" || limitEffect === "fill";
  const limitShowsBadgeInIdentity = limitEffect === "badge";
  const hasStatesZone = limitShowsGlyphInStates;

  const amountDisplay = formatConvertedAmountDisplay(movement, defaultCurrency);

  const IconComponent = isExpense ? ArrowDown : ArrowUp;
  const iconInk = isExpense ? "text-expense-ink" : "text-income-ink";
  const iconBorder = isExpense ? "border-expense" : "border-income";

  // Efecto "fill" (§1.6, excepción): el fondo ámbar SÍ se aplica; fuera de eso,
  // sin hover tint (la fila no responde — "acá no hay nada que tocar").
  const rowFillClass = limitFillClass(limitEffect);

  return (
    <div
      className={cn(
        "grid items-center gap-[14px] px-[18px] cursor-default [&+&]:border-t [&+&]:border-hair",
        rowFillClass,
      )}
      style={{ gridTemplateColumns: "40px 1fr auto auto auto", padding: "var(--row-pad) 18px" }}
    >
      {/* Col 1: caja HUECA con borde punteado del color del tipo — misma flecha que una fila real */}
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border-[1.5px] border-dashed bg-transparent",
          iconBorder,
          iconInk,
        )}
        aria-hidden="true"
      >
        <IconComponent size={19} strokeWidth={2.2} />
      </span>

      {/* Col 2: nombre = categoría + sublínea */}
      <div className="min-w-0">
        <b className="block text-[14.5px] font-semibold tracking-[-0.01em] text-ink leading-snug truncate">
          {categoryName}
        </b>

        <span className="flex items-center gap-[10px] mt-[1px]">
          {/* Zona de identidad */}
          <span className="flex flex-1 min-w-0 items-center gap-[6px] overflow-hidden text-[12px] text-muted">
            {/* Chip "Simulado" — mismo molde que "Anulado", primer segmento */}
            <span className="inline-flex items-center rounded-[var(--r-chip)] bg-panel-3 text-muted px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em] shrink-0">
              Simulado
            </span>

            {/* Badge de límite — efecto "badge", mismo slot que ocuparía "Anulado" en una fila real */}
            {limitShowsBadgeInIdentity && limitTooltip && <LimitBadge tooltip={limitTooltip} />}

            {/* Punto de color de categoría — nunca protagonista de un truncado, siempre visible */}
            <span
              className="h-[6px] w-[6px] rounded-full shrink-0"
              style={{ background: movement.category.color }}
              aria-hidden="true"
            />
            <span className="shrink-0 whitespace-nowrap text-ink-2">{categoryName}</span>

            {/* "· tendencia de 12 meses" — último segmento, trunca PRIMERO al angostarse (§8.1) */}
            <IdentitySeparator />
            <span className="min-w-0 truncate">tendencia de 12 meses</span>
          </span>

          {/* Zona de estados — solo marca de límite (GitBranch nunca aplica, RN-029) */}
          {hasStatesZone && (
            <>
              <span className="h-[12px] w-px bg-hair shrink-0" aria-hidden="true" />
              <span className="flex items-center gap-[8px] shrink-0">
                {limitShowsGlyphInStates && limitTooltip && <LimitGlyph tooltip={limitTooltip} />}
              </span>
            </>
          )}
        </span>
      </div>

      {/* Col 3: vacía — el simulado no tiene instante (mismo precedente que un fijo) */}
      <div className="text-right">
        <span className="block text-[12.5px] text-muted mono whitespace-nowrap">{""}</span>
      </div>

      {/* Col 4: monto con prefijo "≈" DENTRO del mismo span mono — no rompe la alineación tabular */}
      <div className="flex items-center justify-end text-right min-w-[100px]">
        <span
          className={cn(
            "text-[15.5px] mono",
            limitBoldClass(limitEffect) ?? "font-semibold",
            isExpense ? "text-ink" : "text-income-ink",
          )}
        >
          <span className="text-muted mr-[3px]">≈</span>
          {amountDisplay}
        </span>
      </div>

      {/* Col 5: placeholder inerte 32×32 — el hueco del kebab se RESERVA (§1.5), nunca se colapsa */}
      <span className="h-8 w-8 shrink-0" aria-hidden="true" style={{ pointerEvents: "none" }} />
    </div>
  );
}
