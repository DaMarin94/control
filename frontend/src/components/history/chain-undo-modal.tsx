"use client";

/**
 * Modal de entrada bloqueada — desbloqueo en cadena (docs/design.md §6,
 * RF-HIST-004). Único camino para deshacer una entrada bloqueada; se abre por
 * dos vías equivalentes (cuerpo de la fila o botón "Bloqueado", ver
 * `HistoryEntryRow`).
 *
 * `chainEntries` viene ya resuelto por el padre: las entradas del mismo
 * movimiento con `blockingCount <= entry.blockingCount`, ordenadas de más
 * reciente a más antigua (ascendente por `blockingCount`) — la entrada
 * abierta queda última (es la de `blockingCount` más alto del grupo).
 */

import { Info, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell, ModalShellHeader, ModalShellBody, ModalShellFooter } from "@/components/ui/modal-shell";
import { formatHistoryMoment, getHistoryEntryName, pickSummaryChange, summarizeHistoryChange } from "@/lib/history";
import { getBrowserTimezone } from "@/lib/format";
import type { HistoryEntryResponseDto } from "@/types/history";
import type { CurrencyCode } from "@/types/settings";
import { cn } from "@/lib/utils";

interface ChainUndoModalProps {
  entry: HistoryEntryResponseDto;
  chainEntries: HistoryEntryResponseDto[];
  formulaCurrencyFallback: CurrencyCode;
  isSubmitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ChainUndoModal({
  entry,
  chainEntries,
  formulaCurrencyFallback,
  isSubmitting,
  onConfirm,
  onClose,
}: ChainUndoModalProps) {
  const titleId = "chain-undo-title";
  const rowLabel = getHistoryEntryName(entry);
  const timezone = getBrowserTimezone();

  return (
    <ModalShell variant="dialog" onClose={onClose} labelledBy={titleId}>
      <ModalShellHeader titleId={titleId} title="Hay cambios posteriores" onClose={onClose} />

      <ModalShellBody>
        <div className="flex items-start gap-[10px] rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px]">
          <Info size={16} className="text-ink-2 shrink-0 mt-[1px]" aria-hidden="true" />
          <p className="text-[13px] text-ink-2">
            Este no es el cambio más reciente de <b className="font-semibold">{rowLabel}</b>. Para deshacerlo hay
            que deshacer antes{" "}
            {entry.blockingCount === 1 ? (
              <b className="font-semibold">el cambio posterior</b>
            ) : (
              <>
                los <b className="font-semibold">{entry.blockingCount}</b> cambios posteriores
              </>
            )}
            .
          </p>
        </div>

        <div>
          <p className="text-[12.5px] font-medium text-muted mb-[8px]">Se van a deshacer, en este orden:</p>
          <div className="rounded-ctl border border-line overflow-hidden">
            {chainEntries.map((chainEntry, index) => {
              const isThisEntry = chainEntry.id === entry.id;
              const Icon = chainEntry.action === "EDIT" ? Pencil : Trash2;
              const summaryChange = pickSummaryChange(chainEntry.changes);
              const summary = summaryChange
                ? summarizeHistoryChange(summaryChange, formulaCurrencyFallback)
                : undefined;
              return (
                <div
                  key={chainEntry.id}
                  className={cn(
                    "flex flex-wrap items-center gap-x-[8px] gap-y-[2px] px-[10px] py-[8px] text-[12px]",
                    index > 0 && "border-t border-hair",
                    isThisEntry && "bg-panel-3",
                  )}
                >
                  <Icon size={14} className="text-muted shrink-0" aria-hidden="true" />
                  <span className="mono text-muted whitespace-nowrap shrink-0">
                    {formatHistoryMoment(chainEntry.createdAt, timezone)}
                  </span>
                  <span className="text-faint shrink-0" aria-hidden="true">
                    ·
                  </span>
                  <span className="inline-flex items-center rounded-[var(--r-chip)] bg-panel text-muted px-[6px] py-[1px] text-[10.5px] font-semibold tracking-[0.04em] shrink-0">
                    {chainEntry.action === "EDIT" ? "Editado" : "Eliminado"}
                  </span>
                  {summary &&
                    (summary.nowrap ? (
                      // Cifra indivisible (§6.2 prioridad 2): nunca trunca — si no
                      // entra en la línea, el resumen entero envuelve a la siguiente.
                      <span className="inline-flex items-center gap-[6px] shrink-0">
                        <span className="text-faint" aria-hidden="true">
                          ·
                        </span>
                        <span className="whitespace-nowrap text-muted">{summary.text}</span>
                      </span>
                    ) : (
                      // Valor de texto (§6.2 prioridad 4): puede truncar con elipsis.
                      <span className="inline-flex min-w-0 items-center gap-[6px]">
                        <span className="text-faint shrink-0" aria-hidden="true">
                          ·
                        </span>
                        <span className="min-w-0 truncate text-muted">{summary.text}</span>
                      </span>
                    ))}
                  {isThisEntry && <span className="text-faint shrink-0 ml-auto">(esta)</span>}
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[12.5px] text-muted">Todas se borran del historial.</p>
      </ModalShellBody>

      <ModalShellFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="button" variant="default" size="sm" onClick={onConfirm} disabled={isSubmitting}>
          {isSubmitting
            ? "Deshaciendo…"
            : chainEntries.length === 1
              ? "Deshacer el cambio"
              : `Deshacer los ${chainEntries.length} cambios`}
        </Button>
      </ModalShellFooter>
    </ModalShell>
  );
}
