/**
 * Caja recesada "Qué cambió" (docs/design.md §3 — mismo molde que la caja
 * read-only de "Origen" del calculado: `rounded-ctl border border-line
 * bg-panel-2 px-[13px] py-[10px] space-y-[8px]`).
 *
 * Reusado en tres lugares con distinto `heading`/`direction`:
 * - Fila de la lista, edición  → sin heading, `direction="list"`.
 * - Fila de la lista, eliminación → heading "Se eliminó:", direction irrelevante
 *   (modo de valor único, no hay par).
 * - Modal de deshacer, edición → heading "Al deshacer queda así:", `direction="modal"`.
 * - Modal de deshacer, eliminación → heading "Vuelve a la app:".
 */

import type { HistoryChangeDto } from "@/types/history";
import type { HistoryChangeDirection } from "@/lib/history";
import { describeHistoryChange } from "@/lib/history";
import { HistoryChangeRow } from "@/components/history/history-change-row";
import { cn } from "@/lib/utils";

interface HistoryChangesBlockProps {
  changes: HistoryChangeDto[];
  direction: HistoryChangeDirection;
  heading?: string;
  className?: string;
}

export function HistoryChangesBlock({ changes, direction, heading, className }: HistoryChangesBlockProps) {
  return (
    <div className={cn("rounded-ctl border border-line bg-panel-2 px-[13px] py-[10px] space-y-[8px]", className)}>
      {heading && <p className="text-[12.5px] font-medium text-muted">{heading}</p>}
      {changes.map((change) => (
        <HistoryChangeRow key={change.field} display={describeHistoryChange(change, direction)} />
      ))}
    </div>
  );
}
