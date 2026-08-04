"use client";

/**
 * Contenido de `/historial` — Historial de cambios (docs/design.md
 * §"Historial de cambios (`/historial`)", RF-HIST-002).
 *
 * Pantalla de consulta con una acción: lista TODAS las entradas de historial
 * del usuario, cronológicas descendentes, en una única tarjeta-lista. Cada
 * entrada expone "Deshacer" (RF-HIST-003) o, si está bloqueada, "Bloqueado"
 * (RF-HIST-004) — los dos casos abren un modal de confirmación, nunca
 * accionan directo.
 *
 * Deshacer muta datos de movimientos: `useUndoHistory` invalida por prefijo
 * `["movements"]` y `["reports"]` además de `["history"]` — la vista del mes,
 * el dashboard y los reportes se refrescan solos.
 *
 * Animación de salida (§4, "Deshaciendo"): al confirmar, las filas afectadas
 * (la entrada y, en cadena, sus posteriores) se mantienen en pantalla con
 * `exiting` (Map id→entry, snapshot tomado ANTES de que la invalidación las
 * saque de `data`) durante 220ms (0 con `prefers-reduced-motion`) con fade +
 * colapso de alto (técnica grid-template-rows), y recién ahí se sueltan —
 * sin este puente, el usuario vería la fila desaparecer de un salto en cuanto
 * React Query refetchea.
 */

import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { useHistory, useUndoHistory } from "@/hooks/use-history";
import { useSettings } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import { HistoryEntryRow } from "@/components/history/history-entry-row";
import { UndoConfirmModal } from "@/components/history/undo-confirm-modal";
import { ChainUndoModal } from "@/components/history/chain-undo-modal";
import { SkeletonBlock, SkeletonLine, SkeletonPill } from "@/components/ui/skeleton";
import type { HistoryEntryResponseDto } from "@/types/history";
import { cn } from "@/lib/utils";

const EXIT_ANIMATION_MS = 220;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Entradas del mismo movimiento con `blockingCount <= target.blockingCount`, de más reciente a más antigua (target al final). */
function computeChainEntries(
  entries: HistoryEntryResponseDto[],
  target: HistoryEntryResponseDto,
): HistoryEntryResponseDto[] {
  return entries
    .filter((e) => e.targetKind === target.targetKind && e.targetId === target.targetId)
    .filter((e) => e.blockingCount <= target.blockingCount)
    .sort((a, b) => a.blockingCount - b.blockingCount);
}

// ─── Skeleton (§7 — carga) ──────────────────────────────────────────────────────

function HistorySkeletonRow({ isFirst }: { isFirst: boolean }) {
  return (
    <div
      className={cn(
        "grid grid-cols-[40px_1fr] @wide:grid-cols-[40px_1fr_auto] gap-x-[14px] gap-y-[10px] items-start",
        !isFirst && "border-t border-hair",
      )}
      style={{ padding: "var(--row-pad) 18px" }}
    >
      <SkeletonBlock height={40} width={40} radius="ctl" />
      <div className="min-w-0 flex flex-col gap-[6px]">
        <div className="flex items-center gap-[8px]">
          <SkeletonLine height={14.5} width="45%" />
          <SkeletonPill height={16} width={60} />
        </div>
        <SkeletonLine height={12} width="32%" />
        <SkeletonBlock height={44} radius="ctl" className="mt-[4px]" />
      </div>
      <div className="hidden @wide:flex flex-col items-end gap-[8px] self-start">
        <SkeletonLine height={12.5} width={80} />
        <SkeletonBlock height={36} width={104} radius="ctl" />
      </div>
    </div>
  );
}

export function HistoryClient() {
  const { data: entries = [], isLoading, isError } = useHistory();
  const { undo, isUndoing } = useUndoHistory();
  const { defaultCurrency } = useSettings();
  const { toast } = useToast();

  const [openTarget, setOpenTarget] = useState<HistoryEntryResponseDto | null>(null);
  const [exiting, setExiting] = useState<Map<string, HistoryEntryResponseDto>>(new Map());

  const chainEntries = useMemo(
    () => (openTarget ? computeChainEntries(entries, openTarget) : []),
    [entries, openTarget],
  );

  const busyIds = useMemo(() => {
    if (!isUndoing || !openTarget) return new Set<string>();
    return new Set(computeChainEntries(entries, openTarget).map((e) => e.id));
  }, [isUndoing, openTarget, entries]);

  // Entradas visibles: `entries` (dato fresco) + cualquiera en `exiting` que
  // ya haya salido del dato fresco (todavía animando su salida).
  const displayEntries = useMemo(() => {
    if (exiting.size === 0) return entries;
    const presentIds = new Set(entries.map((e) => e.id));
    const merged = [...entries];
    for (const [id, snapshot] of exiting) {
      if (!presentIds.has(id)) merged.push(snapshot);
    }
    merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return merged;
  }, [entries, exiting]);

  function handleOpen(entry: HistoryEntryResponseDto) {
    setOpenTarget(entry);
  }

  function handleClose() {
    setOpenTarget(null);
  }

  async function handleConfirm() {
    if (!openTarget) return;
    const idsToRemove = computeChainEntries(entries, openTarget).map((e) => e.id);

    const result = await undo(openTarget.id);
    if (!result.success) {
      toast.error(result.error ?? "No se pudo deshacer el cambio. Intentá de nuevo.");
      return;
    }

    setOpenTarget(null);
    toast.success(idsToRemove.length > 1 ? `${idsToRemove.length} cambios deshechos.` : "Cambio deshecho.");

    setExiting((prev) => {
      const next = new Map(prev);
      for (const id of idsToRemove) {
        const found = entries.find((e) => e.id === id);
        if (found) next.set(id, found);
      }
      return next;
    });

    const delay = prefersReducedMotion() ? 0 : EXIT_ANIMATION_MS;
    setTimeout(() => {
      setExiting((prev) => {
        const next = new Map(prev);
        for (const id of idsToRemove) next.delete(id);
        return next;
      });
    }, delay);
  }

  return (
    <div className="px-10 py-[34px] pb-20 max-w-[1120px] mx-auto animate-screen-fade">
      <div className="mb-6">
        <h1 className="text-[32px] font-bold tracking-[-0.02em] leading-[1.05] text-ink m-0">Historial</h1>
        <p className="text-[14px] text-muted mt-2">
          Se guardan los últimos 5 cambios de cada movimiento, durante 31 días.
        </p>
      </div>

      {isLoading ? (
        <div role="status" aria-label="Cargando historial">
          <div className="rounded-card border border-line bg-panel shadow-[var(--shadow-sm)] overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <HistorySkeletonRow key={i} isFirst={i === 0} />
            ))}
          </div>
        </div>
      ) : isError ? (
        <div className="rounded-card border border-line bg-panel shadow-[var(--shadow-sm)] px-6 py-6">
          <p className="text-[13px] text-expense-ink">No se pudo cargar el historial. Recargá la página.</p>
        </div>
      ) : displayEntries.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-[10px] rounded-card border border-dashed border-line bg-panel-2 px-6 py-10">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-panel-3">
            <History size={22} className="text-muted" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[14.5px] font-semibold text-ink">Todavía no hay cambios registrados.</p>
            <p className="text-[13px] text-muted mt-1 max-w-[42ch] mx-auto">
              Cuando edites o elimines un movimiento, el cambio aparece acá y lo vas a poder deshacer.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-card border border-line bg-panel shadow-[var(--shadow-sm)] overflow-hidden">
          {displayEntries.map((entry, index) => {
            const isExiting = exiting.has(entry.id);
            return (
              <div
                key={entry.id}
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-[220ms] ease-out motion-reduce:transition-none",
                  index > 0 && "border-t border-hair",
                )}
                style={{ gridTemplateRows: isExiting ? "0fr" : "1fr", opacity: isExiting ? 0 : 1 }}
              >
                <div className="overflow-hidden min-h-0">
                  <HistoryEntryRow
                    entry={entry}
                    formulaCurrencyFallback={defaultCurrency}
                    isBusy={busyIds.has(entry.id)}
                    onOpen={handleOpen}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openTarget &&
        (openTarget.canUndo ? (
          <UndoConfirmModal
            entry={openTarget}
            formulaCurrencyFallback={defaultCurrency}
            isSubmitting={isUndoing}
            onConfirm={handleConfirm}
            onClose={handleClose}
          />
        ) : (
          <ChainUndoModal
            entry={openTarget}
            chainEntries={chainEntries}
            formulaCurrencyFallback={defaultCurrency}
            isSubmitting={isUndoing}
            onConfirm={handleConfirm}
            onClose={handleClose}
          />
        ))}
    </div>
  );
}
