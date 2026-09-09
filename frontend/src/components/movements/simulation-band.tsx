"use client";

/**
 * Banda "Simulación" del popover de filtro de la sección Únicos (docs/design.md
 * "Simulación de categoría (`/mes`)" §2/§4/§4.1/§6.1, RF-SIM-001/004). Tercer
 * bloque del popover, en registro distinto al de filtrar (superficie recesada +
 * divisor fuerte) — SOLO se monta en el popover de Únicos (RN-029: la
 * simulación alcanza solo movimientos únicos).
 *
 * El botón "Simular categoría" está SIEMPRE presente (es el único punto de
 * entrada de la feature); la lista de activas y la nota general solo con ≥1
 * simulación activa (§0 — cero-impacto).
 *
 * El tramo dejó de ser único (§0, cambio 1): cada simulación declara el suyo
 * en su fila (§4, segunda línea) — la nota general de la banda pasó a ser una
 * constante que declara la REGLA ("de dónde sale el arranque"), no un tramo.
 *
 * EXTENDER EL TRAMO (§4.1) vive entero acá, en la línea 2 de la fila: revelado
 * en el lugar ("inline disclosure"), sin un segundo overlay anidado dentro del
 * popover. El estado de "eligiendo" es ÚNICO para toda la banda (nunca dos
 * filas eligiendo a la vez), por eso vive en este componente y no en la fila.
 */

import { Fragment, useEffect, useRef, useState } from "react";
import { ChartSpline, ChevronDown, Trash2 } from "lucide-react";
import type { ExtendSimulationMonths, SimulationDto } from "@/types/simulation";
import {
  EXTEND_MONTH_OPTIONS,
  formatExtendErrorToast,
  formatExtendSuccessToast,
  formatMinDataMotive,
  formatHorizonBandNote,
  formatSimulationSpan,
} from "@/lib/simulations";
import { useExtendSimulation } from "@/hooks/use-simulations";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/** Estado del revelado de extender — a lo sumo UNA fila a la vez en toda la banda (§4.1). */
interface ExtendState {
  simulationId: string;
  /** `choosing` = las cuatro opciones a la vista (b) · `pending` = "Extendiendo…" (c). */
  phase: "choosing" | "pending";
}

/**
 * Selector del contenedor de las cuatro opciones (atributo `data-extend-options`
 * en el JSX de más abajo) — lo usa el click-afuera para no colapsarse a sí
 * mismo. Sirve un selector y no un ref porque a lo sumo hay UN contenedor
 * montado a la vez en toda la banda.
 */
const EXTEND_OPTIONS_SELECTOR = "[data-extend-options]";

export interface SimulationBandProps {
  /** Mes en curso REAL ("hoy", `getCurrentMonth()`) — resuelve si cada simulación ya arrancó (§4). */
  currentMonth: string;
  /**
   * Mes VISUALIZADO en `/mes` (el param de ruta) — NO es `currentMonth`.
   * Resuelve la condición de aparición del disparador de extender (§4.1,
   * decisión 1): el link "Extender" sale SOLO en la fila cuya simulación
   * termina justo en el mes que se está mirando.
   */
  viewedMonth: string;
  simulations: SimulationDto[];
  onOpenCreate: () => void;
  onRequestDelete: (simulation: SimulationDto) => void;
}

export function SimulationBand({
  currentMonth,
  viewedMonth,
  simulations,
  onOpenCreate,
  onRequestDelete,
}: SimulationBandProps) {
  const hasActive = simulations.length > 0;
  const { toast } = useToast();
  const { extendSimulation } = useExtendSimulation();

  const [extendState, setExtendState] = useState<ExtendState | null>(null);
  /** Fila cuyo link "Extender" tiene que recuperar el foco tras colapsar con Escape (§4.1). */
  const [restoreFocusId, setRestoreFocusId] = useState<string | null>(null);

  // Escape colapsa la elección SIN cerrar el popover (§4.1 — lo más interno se
  // cierra primero). El listener del popover vive en `document` en burbuja;
  // este va en CAPTURA sobre el mismo nodo y corta la propagación entera, así
  // que sin ninguna fila eligiendo Escape sigue cerrando el popover como hoy.
  useEffect(() => {
    if (extendState?.phase !== "choosing") return;
    const { simulationId } = extendState;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      setRestoreFocusId(simulationId);
      setExtendState(null);
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [extendState]);

  // Click en cualquier punto del popover que no sean las cuatro opciones
  // colapsa al estado (a) (§4.1). Click fuera del popover entero lo cierra
  // completo (comportamiento existente) y desmonta esto con él.
  useEffect(() => {
    if (extendState?.phase !== "choosing") return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target;
      if (target instanceof Element && target.closest(EXTEND_OPTIONS_SELECTOR)) return;
      setExtendState(null);
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [extendState]);

  async function handleExtend(simulation: SimulationDto, months: ExtendSimulationMonths) {
    setExtendState({ simulationId: simulation.id, phase: "pending" });
    const result = await extendSimulation(simulation.id, months);
    if (result.success) {
      // La fila recalcula su `endMonth` al revalidarse la query y deja de
      // cumplir la condición 1 por sí sola: vuelve al tramo, sin disparador y
      // sin ninguna marca de "recién extendida". El popover no se cierra.
      setExtendState(null);
      toast.success(formatExtendSuccessToast());
      return;
    }
    // Error: vuelve al estado (b), no al (a) — reintentar es un solo clic.
    setExtendState({ simulationId: simulation.id, phase: "choosing" });
    toast.error(result.error ?? formatExtendErrorToast());
  }

  return (
    <div className="shrink-0 border-t border-line bg-panel-2 px-3 py-[10px] flex flex-col gap-[8px]">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        Simulación
      </span>

      <button
        type="button"
        onClick={onOpenCreate}
        className={cn(
          "flex w-full items-center justify-center gap-[6px] min-h-[34px] rounded-ctl",
          "bg-panel border border-line text-[12.5px] font-semibold text-ink-2",
          "transition-colors duration-[140ms] hover:bg-panel-3 hover:text-ink",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
        )}
      >
        <ChartSpline size={15} aria-hidden="true" />
        Simular categoría
      </button>

      {!hasActive ? (
        <p className="text-[11.5px] text-muted">Proyecta categorías desde el mes que estás viendo.</p>
      ) : (
        <>
          <div className="flex flex-col max-h-[176px] overflow-y-auto">
            {simulations.map((simulation) => (
              <SimulationListItem
                key={simulation.id}
                simulation={simulation}
                currentMonth={currentMonth}
                canExtend={simulation.endMonth === viewedMonth}
                extendPhase={
                  extendState?.simulationId === simulation.id ? extendState.phase : "idle"
                }
                shouldRestoreFocus={restoreFocusId === simulation.id}
                onFocusRestored={() => setRestoreFocusId(null)}
                onStartExtend={() =>
                  setExtendState({ simulationId: simulation.id, phase: "choosing" })
                }
                onChooseExtend={(months) => void handleExtend(simulation, months)}
                onDelete={() => onRequestDelete(simulation)}
              />
            ))}
          </div>
          <p className="text-[11.5px] text-muted">{formatHorizonBandNote()}</p>
        </>
      )}
    </div>
  );
}

// ─── Fila de la lista de activas (§4) — con el estado "pausada" (§6.1) ─────────

interface SimulationListItemProps {
  simulation: SimulationDto;
  currentMonth: string;
  /** Condición 1 de §4.1: el `endMonth` de esta simulación es el mes visualizado. */
  canExtend: boolean;
  extendPhase: "idle" | "choosing" | "pending";
  shouldRestoreFocus: boolean;
  onFocusRestored: () => void;
  onStartExtend: () => void;
  onChooseExtend: (months: ExtendSimulationMonths) => void;
  onDelete: () => void;
}

function SimulationListItem({
  simulation,
  currentMonth,
  canExtend,
  extendPhase,
  shouldRestoreFocus,
  onFocusRestored,
  onStartExtend,
  onChooseExtend,
  onDelete,
}: SimulationListItemProps) {
  const isPaused = simulation.paused;
  const categoryName = simulation.category.name;
  const isPending = extendPhase === "pending";

  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  // Foco al revelarse: pasa al primer valor ("1 mes") — patrón estándar de
  // disclosure. Aplica también al volver al estado (b) tras un error.
  useEffect(() => {
    if (extendPhase === "choosing") firstOptionRef.current?.focus();
  }, [extendPhase]);

  // Al colapsar con Escape el foco vuelve al link "Extender" de esta fila (§4.1).
  useEffect(() => {
    if (!shouldRestoreFocus) return;
    triggerRef.current?.focus();
    onFocusRestored();
  }, [shouldRestoreFocus, onFocusRestored]);

  // Texto base de la línea 2: pausa (§6.1) si aplica; si no, el TRAMO de esta
  // simulación (§4). Nunca las dos.
  const baseLine = isPaused
    ? `${formatMinDataMotive(simulation.monthsWithData)}. No proyecta.`
    : formatSimulationSpan(simulation.startMonth, simulation.endMonth, currentMonth);

  // Molde compartido del link "Extender" y de los cuatro valores (§4.1): texto
  // tenue accionable, sin peso extra, tamaño heredado de la línea (11.5px).
  const textLinkClass = cn(
    "cursor-pointer text-muted",
    "hover:text-ink-2 hover:underline hover:underline-offset-[2px]",
    "transition-colors duration-[140ms]",
    "rounded-[var(--r-chip)]",
    "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
  );

  return (
    <div className="flex flex-wrap items-center gap-[8px] py-[6px]">
      <span
        className="h-[8px] w-[8px] rounded-full shrink-0"
        style={{ background: simulation.category.color }}
        aria-hidden="true"
      />
      <span
        className={cn(
          "flex-1 min-w-0 truncate text-[12.5px]",
          isPaused ? "text-muted" : "text-ink",
        )}
      >
        {categoryName}
      </span>

      {/* Chip "Sin datos" — neutro, mismo molde que "Desactivado" del popover de límites.
          Extender no lo toca en ningún momento del flujo (§4.1). */}
      {isPaused && (
        <span className="shrink-0 inline-flex items-center rounded-[var(--r-chip)] bg-panel-3 text-muted px-[6px] py-[1px] text-[10.5px] font-semibold">
          Sin datos
        </span>
      )}

      <button
        type="button"
        onClick={onDelete}
        disabled={isPending}
        aria-label={`Eliminar la simulación de ${categoryName}`}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-muted",
          "transition-colors duration-[140ms] hover:bg-expense-soft hover:text-expense-ink",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
          // En vuelo: previene la carrera entre eliminar y extender la MISMA
          // simulación (§4.1 c). Las demás filas no se ven afectadas.
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>

      {/* Línea 2 — tres estados excluyentes (§4.1): reposo (tramo/pausa, con el
          disparador si corresponde), eligiendo, o en vuelo. */}
      <div
        className="w-full text-[11.5px] text-muted"
        aria-live="polite"
        aria-atomic="true"
      >
        {extendPhase === "pending" ? (
          <p>Extendiendo…</p>
        ) : extendPhase === "choosing" ? (
          <div
            data-extend-options=""
            className="flex flex-wrap items-center gap-x-[6px] gap-y-[2px]"
          >
            {EXTEND_MONTH_OPTIONS.map((option, index) => (
              <Fragment key={option.months}>
                {index > 0 && (
                  <span className="text-faint" aria-hidden="true">
                    ·
                  </span>
                )}
                <button
                  ref={index === 0 ? firstOptionRef : undefined}
                  type="button"
                  onClick={() => onChooseExtend(option.months)}
                  aria-label={option.ariaLabel}
                  // Hit area: el margen negativo cancela el efecto visual del
                  // padding — amplía el alto de clic sin separar los valores.
                  className={cn(textLinkClass, "whitespace-nowrap py-[3px] -my-[3px]")}
                >
                  {option.label}
                </button>
              </Fragment>
            ))}
          </div>
        ) : (
          <p>
            {baseLine}
            {canExtend && (
              <>
                {" "}
                <button
                  ref={triggerRef}
                  type="button"
                  onClick={onStartExtend}
                  className={cn(textLinkClass, "inline-flex items-center gap-[3px]")}
                >
                  Extender
                  <ChevronDown size={11} aria-hidden="true" />
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
