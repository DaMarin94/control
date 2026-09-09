"use client";

/**
 * Modal "Simular categoría" (docs/design.md "Simulación de categoría (`/mes`)"
 * §3, RF-SIM-001). Selector MÚLTIPLE de categorías (`role="group"` +
 * `role="checkbox"` por fila) que muestra SOLO las categorías SIMULABLES
 * (≥3 meses con datos y sin simulación activa) — las no elegibles se
 * OCULTAN, no se muestran deshabilitadas con motivo (reversión de una
 * decisión anterior). El backend sigue mandando el catálogo completo con sus
 * dos flags (`monthsWithData`, `alreadySimulated`); el filtro es de
 * PRESENTACIÓN, y esos flags son los que permiten distinguir la CAUSA de un
 * vacío (§3.8, cuatro estados) y armar la nota de elegibilidad (§3.1b).
 *
 * EL UNIVERSO SE CONGELA AL ABRIR (§3): la lista de candidatas se fija con el
 * primer payload que llega y ninguna fila desaparece mientras el modal vive
 * — en particular, las que se crean en un intento con fallo parcial se
 * quedan en su lugar, destildadas y deshabilitadas. Se implementa con un
 * `ref` mutado durante el render (guardado solo la primera vez que `data`
 * llega): cada apertura del modal es un mount nuevo (se desmonta al cerrar),
 * así que el freeze arranca de cero en cada apertura sin necesitar un efecto.
 *
 * El checkbox 16px reusa LITERAL el molde del filtro de categorías
 * (`CategoryFilterPopover`, `@/components/ui/category-filter.tsx`) — misma
 * forma, mismo tick SVG.
 *
 * El TRAMO es propio del lote (§0, cambio 1): se ancla al mes visualizado en
 * `/mes` (`startMonth`, prop) — se lo manda tal cual al crear y se usa para
 * pedir a `/simulations/candidates` el tramo hipotético que la bajada anuncia.
 *
 * Batch tolerante a fallo parcial (POST /simulations con `categoryIds` +
 * `startMonth`, 201 SIEMPRE con `{ created, failed }`) — tres desenlaces (§3.7):
 * (a) éxito total → cierra + toast success.
 * (b) fallo total (0 de N) → modal abierto, selección intacta, toast error,
 *     SIN caja de resumen.
 * (c) fallo parcial (K de N) → modal abierto, toast warning, caja de resumen
 *     neutra; las K creadas se destildan y quedan deshabilitadas con el
 *     desenlace "Simulación creada." EN SU LUGAR (nunca "Ya la estás
 *     simulando" — ese motivo quedó derogado junto con el resto); las
 *     fallidas siguen tildadas con su error (`--expense-ink`) en el slot de
 *     desenlace. El slot ya NO tiene tabla de precedencia: sus dos
 *     contenidos son excluyentes por construcción (§3.4).
 *
 * `ModalShell variant="dialog"`: cierra con ✕ y `Esc`; el clic en el scrim NO
 * cierra (modal de decisión, default de `ModalShell`).
 */

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ModalShell, ModalShellHeader, ModalShellBody, ModalShellFooter } from "@/components/ui/modal-shell";
import { SkeletonCircle, SkeletonBlock, SkeletonLine } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useSimulationCandidates, useCreateSimulation } from "@/hooks/use-simulations";
import {
  formatHorizonReach,
  formatEligibilityNote,
  isEligibleCandidate,
  getCandidatesEmptyCause,
  formatCandidatesEmpty,
  formatSimulateCta,
  formatBatchSuccessToast,
  formatBatchPartialToast,
  formatBatchPartialSummary,
} from "@/lib/simulations";
import type { SimulationCandidate, SimulationCandidatesResponse } from "@/types/simulation";
import { cn } from "@/lib/utils";

interface SimulateCategoryModalProps {
  /** Mes visualizado en `/mes` ("YYYY-MM") — ancla del tramo del lote (§0, cambio 1). */
  startMonth: string;
  onClose: () => void;
}

export function SimulateCategoryModal({ startMonth, onClose }: SimulateCategoryModalProps) {
  const { toast } = useToast();
  const { data, isLoading, isError } = useSimulationCandidates(true, startMonth);
  const { createSimulation, isCreating } = useCreateSimulation();

  // Universo CONGELADO al abrir (§3) — se fija con el primer payload y no se
  // vuelve a tocar mientras el modal vive (ver comentario de cabecera).
  const frozenRef = useRef<SimulationCandidatesResponse | null>(null);
  if (frozenRef.current === null && data) {
    frozenRef.current = data;
  }
  const frozen = frozenRef.current;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Categorías creadas en un intento previo de ESTA sesión del modal — pasan
  // a deshabilitadas con "Simulación creada." sin esperar el refetch (§3.7 c:
  // la reconciliación es inmediata, con el resultado del batch).
  const [createdIds, setCreatedIds] = useState<Set<string>>(new Set());
  // Errores del ÚLTIMO intento, por categoryId — persisten hasta que la fila
  // se destilda, hay un nuevo intento, o se cierra el modal (§3.4).
  const [attemptErrors, setAttemptErrors] = useState<Map<string, string>>(new Map());
  // Caja de resumen del fallo parcial — solo ese desenlace la monta (§3.7 c).
  const [partialSummary, setPartialSummary] = useState<{ created: number; total: number } | null>(null);

  function toggleCategory(categoryId: string, currentlyChecked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (currentlyChecked) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
    // Destildar una fila con error: ya no forma parte del pedido, el error deja de aplicar.
    if (currentlyChecked && attemptErrors.has(categoryId)) {
      setAttemptErrors((prev) => {
        const next = new Map(prev);
        next.delete(categoryId);
        return next;
      });
    }
  }

  async function handleConfirm() {
    const categoryIds = Array.from(selectedIds);
    const total = categoryIds.length;
    if (total === 0) return;

    const result = await createSimulation(categoryIds, startMonth);
    const createdCount = result.created.length;

    if (createdCount === total) {
      // (a) Éxito total — cierra + toast.
      toast.success(formatBatchSuccessToast(createdCount));
      onClose();
      return;
    }

    // Recalcula errores del intento — reemplaza cualquier error previo.
    const newErrors = new Map<string, string>();
    for (const failure of result.failed) {
      newErrors.set(failure.categoryId, failure.message);
    }
    setAttemptErrors(newErrors);

    if (createdCount === 0) {
      // (b) Fallo total — modal abierto, selección intacta, SIN caja de resumen.
      setPartialSummary(null);
      toast.error(
        total === 1
          ? (result.failed[0]?.message ?? "No se pudo crear la simulación.")
          : "No se pudo crear ninguna simulación.",
      );
      return;
    }

    // (c) Fallo parcial — las creadas se destildan y pasan a "Simulación creada." EN SU LUGAR.
    const createdCategoryIds = result.created.map((s) => s.categoryId);
    setCreatedIds((prev) => {
      const next = new Set(prev);
      for (const id of createdCategoryIds) next.add(id);
      return next;
    });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of createdCategoryIds) next.delete(id);
      return next;
    });
    setPartialSummary({ created: createdCount, total });
    toast.warning(formatBatchPartialToast(createdCount, total));
  }

  const count = selectedIds.size;
  const eligibleCandidates = frozen ? frozen.categories.filter(isEligibleCandidate) : [];
  const emptyCause = frozen ? getCandidatesEmptyCause(frozen.categories) : null;

  return (
    <ModalShell variant="dialog" onClose={onClose} labelledBy="simulate-category-title">
      <ModalShellHeader titleId="simulate-category-title" title="Simular categoría" onClose={onClose} />

      <ModalShellBody>
        <p className="text-[13px] text-muted max-w-[46ch]">
          Se proyecta cada categoría elegida a partir de sus últimos 12 meses.
          {frozen ? ` ${formatHorizonReach(frozen.startMonth, frozen.endMonth)}` : ""} En cada mes se
          simula solo lo que falta para llegar a lo proyectado.
        </p>

        {partialSummary && (
          <p className="rounded-ctl border border-line bg-panel-2 px-3 py-[8px] text-[12.5px] text-ink-2">
            {formatBatchPartialSummary(partialSummary.created, partialSummary.total)}
          </p>
        )}

        {!frozen && isLoading ? (
          <div role="status" aria-label="Cargando categorías" className="flex flex-col gap-[2px]">
            {[0, 1, 2, 3].map((i) => (
              <CandidateSkeletonRow key={i} />
            ))}
          </div>
        ) : !frozen && isError ? (
          <p className="text-[13px] text-expense-ink">
            No se pudieron cargar las categorías. Cerrá y volvé a intentar.
          </p>
        ) : eligibleCandidates.length === 0 && emptyCause ? (
          <CandidatesEmpty cause={emptyCause} />
        ) : (
          <>
            <div role="group" aria-label="Categorías a simular" className="flex flex-col gap-[2px]">
              {eligibleCandidates.map((candidate) => (
                <CandidateRow
                  key={candidate.categoryId}
                  candidate={candidate}
                  checked={selectedIds.has(candidate.categoryId)}
                  alreadyCreatedThisSession={createdIds.has(candidate.categoryId)}
                  error={attemptErrors.get(candidate.categoryId) ?? null}
                  onToggle={toggleCategory}
                />
              ))}
            </div>
            <p className="mt-[10px] text-[12px] text-muted">{formatEligibilityNote()}</p>
          </>
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
          disabled={count === 0 || isCreating}
          className="min-w-[164px] whitespace-nowrap"
        >
          {isCreating ? "Simulando…" : formatSimulateCta(count)}
        </Button>
      </ModalShellFooter>
    </ModalShell>
  );
}

// ─── Vacío del selector — cuatro causas, cuatro copys (§3.8) ───────────────────

function CandidatesEmpty({ cause }: { cause: NonNullable<ReturnType<typeof getCandidatesEmptyCause>> }) {
  const { line1, line2 } = formatCandidatesEmpty(cause);
  return (
    <div className="rounded-ctl border border-dashed border-line bg-panel-2 px-4 py-6 text-center">
      <p className="text-[12.5px] text-ink-2">{line1}</p>
      {line2 && <p className="mt-[4px] text-[12px] text-muted">{line2}</p>}
    </div>
  );
}

// ─── Fila de categoría — solo simulables; slot de DESENLACE tras un intento ────

interface CandidateRowProps {
  candidate: SimulationCandidate;
  checked: boolean;
  /** Creada en un intento previo de esta sesión del modal (fallo parcial) — única causa vigente de deshabilitado (§3.2). */
  alreadyCreatedThisSession: boolean;
  /** Mensaje de error del último intento para esta fila (§3.4). */
  error: string | null;
  onToggle: (categoryId: string, currentlyChecked: boolean) => void;
}

function CandidateRow({ candidate, checked, alreadyCreatedThisSession, error, onToggle }: CandidateRowProps) {
  const disabled = alreadyCreatedThisSession;

  // Slot de DESENLACE (§3.4) — un único inquilino posible, sin precedencia
  // que arbitrar: o la fila falló en el último intento, o se creó en uno
  // anterior. Nunca las dos a la vez (son excluyentes por construcción).
  const outcome = error ? error : alreadyCreatedThisSession ? "Simulación creada." : null;
  const outcomeId = `simulate-candidate-outcome-${candidate.categoryId}`;

  function handleActivate() {
    if (disabled) return;
    onToggle(candidate.categoryId, checked);
  }

  return (
    <div
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      aria-describedby={outcome ? outcomeId : undefined}
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
              checked ? "bg-panel-2" : "hover:bg-panel-2",
            ),
      )}
    >
      {/* Checkbox 16px — molde exacto del filtro de categorías (CategoryFilterPopover) */}
      <span
        aria-hidden="true"
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-[140ms]",
          disabled
            ? "border-faint bg-panel"
            : checked
              ? "border-accent bg-accent"
              : "border-line-strong bg-panel",
        )}
      >
        {checked && !disabled && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>

      {/* Punto de color de categoría — NUNCA se atenúa, aunque la fila esté deshabilitada */}
      <span
        className="h-[10px] w-[10px] shrink-0 rounded-[3px]"
        style={{ backgroundColor: candidate.color }}
        aria-hidden="true"
      />

      <span className={cn("text-[13px]", disabled ? "text-muted" : "text-ink")}>{candidate.name}</span>

      {outcome && (
        <span
          id={outcomeId}
          className={cn("ml-auto text-right text-[12px]", error ? "text-expense-ink" : "text-muted")}
        >
          {outcome}
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
