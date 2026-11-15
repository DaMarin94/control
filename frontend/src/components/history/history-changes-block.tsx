/**
 * Caja recesada "Qué cambió" (docs/design.md §3 — mismo molde que la caja
 * read-only de "Origen" del calculado: `rounded-ctl border border-line
 * bg-panel-2 px-3.25 py-2.5 space-y-2`).
 *
 * Reusado en tres lugares con distinto `heading`/`direction`:
 * - Fila de la lista, edición  → sin heading, `direction="list"`.
 * - Fila de la lista, eliminación → heading "Se eliminó:", direction irrelevante
 *   (modo de valor único, no hay par).
 * - Modal de deshacer, edición → heading "Al deshacer queda así:", `direction="modal"`.
 * - Modal de deshacer, eliminación → heading "Vuelve a la app:".
 */

import type { HistoryChangeDto, HistoryReopenInfo } from "@/types/history";
import type { HistoryChangeDirection } from "@/lib/history";
import { buildHistoryDisplays } from "@/lib/history";
import { HistoryChangeRow } from "@/components/history/history-change-row";
import { cn } from "@/lib/utils";

interface HistoryChangesBlockProps {
  changes: HistoryChangeDto[];
  /** Solo en entradas `REOPEN` — suma la fila "Vigencia" (RF-MF-008). */
  reopen?: HistoryReopenInfo | null;
  direction: HistoryChangeDirection;
  heading?: string;
  className?: string;
}

export function HistoryChangesBlock({ changes, reopen, direction, heading, className }: HistoryChangesBlockProps) {
  return (
    <div className={cn("rounded-ctl border border-line bg-panel-2 px-3.25 py-2.5 space-y-2", className)}>
      {heading && <p className="text-[12.5px] font-medium text-muted">{heading}</p>}
      {buildHistoryDisplays({ changes, reopen }, direction).map((display) => (
        <HistoryChangeRow key={display.label} display={display} />
      ))}
    </div>
  );
}
