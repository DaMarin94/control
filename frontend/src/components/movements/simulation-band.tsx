"use client";

/**
 * Banda "Simulación" del popover de filtro de la sección Únicos (docs/design.md
 * "Simulación de categoría (`/mes`)" §2/§4/§6.1, RF-SIM-001/004). Tercer bloque
 * del popover, en registro distinto al de filtrar (superficie recesada +
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
 */

import { ChartSpline, Trash2 } from "lucide-react";
import type { SimulationDto } from "@/types/simulation";
import { formatMinDataMotive, formatHorizonBandNote, formatSimulationSpan } from "@/lib/simulations";
import { cn } from "@/lib/utils";

export interface SimulationBandProps {
  /** Mes en curso REAL ("hoy", `getCurrentMonth()`) — resuelve si cada simulación ya arrancó (§4). */
  currentMonth: string;
  simulations: SimulationDto[];
  onOpenCreate: () => void;
  onRequestDelete: (simulation: SimulationDto) => void;
}

export function SimulationBand({
  currentMonth,
  simulations,
  onOpenCreate,
  onRequestDelete,
}: SimulationBandProps) {
  const hasActive = simulations.length > 0;

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
  onDelete: () => void;
}

function SimulationListItem({ simulation, currentMonth, onDelete }: SimulationListItemProps) {
  const isPaused = simulation.paused;
  const categoryName = simulation.category.name;

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

      {/* Chip "Sin datos" — neutro, mismo molde que "Desactivado" del popover de límites */}
      {isPaused && (
        <span className="shrink-0 inline-flex items-center rounded-[var(--r-chip)] bg-panel-3 text-muted px-[6px] py-[1px] text-[10.5px] font-semibold">
          Sin datos
        </span>
      )}

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Eliminar la simulación de ${categoryName}`}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-muted",
          "transition-colors duration-[140ms] hover:bg-expense-soft hover:text-expense-ink",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
        )}
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>

      {/* Segunda línea — pausa (§6.1) si aplica; si no, el TRAMO de esta simulación (§4). Nunca las dos. */}
      {isPaused ? (
        <p className="w-full text-[11.5px] text-muted">
          {formatMinDataMotive(simulation.monthsWithData)}. No proyecta.
        </p>
      ) : (
        <p className="w-full text-[11.5px] text-muted">
          {formatSimulationSpan(simulation.startMonth, simulation.endMonth, currentMonth)}
        </p>
      )}
    </div>
  );
}
