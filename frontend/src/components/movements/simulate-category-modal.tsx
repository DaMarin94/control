"use client";

/**
 * Modal "Simular categoría" (docs/design.md "Simulación de categoría (`/mes`)"
 * §3, RF-SIM-001). Selector de UNA categoría con el motivo de deshabilitado
 * SIEMPRE visible (nunca un tooltip, nunca truncado) — universo = catálogo de
 * categorías ACTIVAS del usuario, en el orden del catálogo (las deshabilitadas
 * NO se mandan al fondo).
 *
 * `ModalShell variant="dialog"`: cierra con ✕ y `Esc`; el clic en el scrim NO
 * cierra (modal de decisión, default de `ModalShell`).
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ModalShell, ModalShellHeader, ModalShellBody, ModalShellFooter } from "@/components/ui/modal-shell";
import { SkeletonCircle, SkeletonBlock, SkeletonLine } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useSimulationCandidates, useCreateSimulation } from "@/hooks/use-simulations";
import { formatMinDataMotive, formatHorizonReach } from "@/lib/simulations";
import type { SimulationCandidate } from "@/types/simulation";
import { cn } from "@/lib/utils";

interface SimulateCategoryModalProps {
  onClose: () => void;
}

export function SimulateCategoryModal({ onClose }: SimulateCategoryModalProps) {
  const { toast } = useToast();
  const { data, isLoading, isError } = useSimulationCandidates(true);
  const { createSimulation, isCreating } = useCreateSimulation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function handleConfirm() {
    if (!selectedId) return;
    const result = await createSimulation(selectedId);
    if (!result.success) {
      // El modal queda abierto con la selección intacta (RNF-008).
      toast.error(result.error ?? "No se pudo crear la simulación.");
      return;
    }
    toast.success("Simulación creada.");
    onClose();
  }

  return (
    <ModalShell variant="dialog" onClose={onClose} labelledBy="simulate-category-title">
      <ModalShellHeader titleId="simulate-category-title" title="Simular categoría" onClose={onClose} />

      <ModalShellBody>
        <p className="text-[13px] text-muted max-w-[46ch]">
          Se proyecta una categoría a los meses futuros a partir de sus últimos 12 meses.
          {data ? ` ${formatHorizonReach(data.horizonEndMonth)}` : ""}
        </p>

        {isLoading ? (
          <div role="status" aria-label="Cargando categorías" className="flex flex-col gap-[2px]">
            {[0, 1, 2, 3].map((i) => (
              <CandidateSkeletonRow key={i} />
            ))}
          </div>
        ) : isError ? (
          <p className="text-[13px] text-expense-ink">
            No se pudieron cargar las categorías. Cerrá y volvé a intentar.
          </p>
        ) : !data || data.categories.length === 0 ? (
          <div className="rounded-ctl border border-dashed border-line bg-panel-2 px-4 py-6 text-center">
            <p className="text-[12.5px] text-muted">No tenés categorías activas.</p>
          </div>
        ) : (
          <div role="radiogroup" aria-label="Categoría a simular" className="flex flex-col gap-[2px]">
            {data.categories.map((candidate) => (
              <CandidateRow
                key={candidate.categoryId}
                candidate={candidate}
                selected={selectedId === candidate.categoryId}
                onSelect={() => setSelectedId(candidate.categoryId)}
              />
            ))}
          </div>
        )}
      </ModalShellBody>

      <ModalShellFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isCreating}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={handleConfirm}
          disabled={!selectedId || isCreating}
        >
          {isCreating ? "Simulando…" : "Simular"}
        </Button>
      </ModalShellFooter>
    </ModalShell>
  );
}

// ─── Fila de categoría — habilitada o deshabilitada con motivo visible ────────

interface CandidateRowProps {
  candidate: SimulationCandidate;
  selected: boolean;
  onSelect: () => void;
}

function CandidateRow({ candidate, selected, onSelect }: CandidateRowProps) {
  const disabled = candidate.alreadySimulated || candidate.monthsWithData < 3;
  const motive = candidate.alreadySimulated
    ? "Ya la estás simulando"
    : candidate.monthsWithData < 3
      ? formatMinDataMotive(candidate.monthsWithData)
      : null;
  const motiveId = `simulate-candidate-motive-${candidate.categoryId}`;

  function handleActivate() {
    if (disabled) return;
    onSelect();
  }

  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      aria-describedby={motive ? motiveId : undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate();
        }
      }}
      className={cn(
        "flex flex-wrap items-center gap-[10px] px-[10px] py-[8px] rounded-ctl min-h-[38px]",
        disabled
          ? "cursor-not-allowed"
          : cn(
              "cursor-pointer transition-colors duration-[140ms]",
              "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
              selected ? "bg-panel-2" : "hover:bg-panel-2",
            ),
      )}
    >
      {/* Radio 16px — el color NO se atenúa (identidad), lo condicionado es la selección */}
      <span
        aria-hidden="true"
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
          disabled
            ? "border-faint"
            : selected
              ? "border-accent bg-accent"
              : "border-line-strong",
        )}
      >
        {selected && !disabled && <span className="h-[6px] w-[6px] rounded-full bg-white" aria-hidden="true" />}
      </span>

      {/* Punto de color de categoría — NUNCA se atenúa, aunque la fila esté deshabilitada */}
      <span
        className="h-[10px] w-[10px] shrink-0 rounded-[3px]"
        style={{ backgroundColor: candidate.color }}
        aria-hidden="true"
      />

      <span className={cn("text-[13px]", disabled ? "text-muted" : "text-ink")}>{candidate.name}</span>

      {motive && (
        <span id={motiveId} className="ml-auto text-right text-[12px] text-muted">
          {motive}
        </span>
      )}
    </div>
  );
}

// ─── Estado de carga — 4 filas fantasma ────────────────────────────────────────

function CandidateSkeletonRow() {
  return (
    <div className="flex items-center gap-[10px] px-[10px] py-[8px] min-h-[38px]">
      <SkeletonCircle diameter={16} />
      <SkeletonBlock height={10} width={10} radius="custom" className="rounded-[3px]" />
      <SkeletonLine height={13} width="40%" />
    </div>
  );
}
