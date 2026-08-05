"use client";

/**
 * Modal de deshacer una entrada (docs/design.md §5). Se abre desde una entrada
 * DESHACIBLE (`entry.canUndo`). Para una entrada bloqueada, el modal es
 * `ChainUndoModal` (desbloqueo en cadena).
 *
 * `ModalShell variant="dialog"` — cierre con ✕ y `Esc` (el clic en el scrim
 * NO cierra: es un modal de decisión).
 *
 * El bloque "Al deshacer" reusa `HistoryChangesBlock` con `direction="modal"`:
 * el par sale INVERTIDO respecto de la fila (`actual → restaurado`, espejo,
 * ver docs/design.md §5 — "es el espejo de la fila, nunca dos reglas").
 */

import { Button } from "@/components/ui/button";
import { ModalShell, ModalShellHeader, ModalShellBody, ModalShellFooter } from "@/components/ui/modal-shell";
import { HistoryChangesBlock } from "@/components/history/history-changes-block";
import { HISTORY_TARGET_KIND_LABEL, formatHistoryMoment, getHistoryEntryName } from "@/lib/history";
import { getBrowserTimezone } from "@/lib/format";
import type { HistoryEntryResponseDto } from "@/types/history";
import type { CurrencyCode } from "@/types/settings";

interface UndoConfirmModalProps {
  entry: HistoryEntryResponseDto;
  formulaCurrencyFallback: CurrencyCode;
  isSubmitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function UndoConfirmModal({
  entry,
  formulaCurrencyFallback,
  isSubmitting,
  onConfirm,
  onClose,
}: UndoConfirmModalProps) {
  const titleId = "undo-confirm-title";
  const isEdit = entry.action === "EDIT";
  const rowLabel = getHistoryEntryName(entry);
  const structureLabel = HISTORY_TARGET_KIND_LABEL[entry.targetKind];
  const momento = formatHistoryMoment(entry.createdAt, getBrowserTimezone());

  return (
    <ModalShell variant="dialog" onClose={onClose} labelledBy={titleId}>
      <ModalShellHeader titleId={titleId} title="Deshacer cambio" onClose={onClose} />

      <ModalShellBody>
        <p className="text-[14px] text-ink">
          Se va a restaurar <b className="font-semibold">{rowLabel}</b> al estado que tenía antes de este cambio.
        </p>

        <div className="rounded-ctl border border-line bg-panel-2 px-4 py-3 text-[13px]">
          <p className="font-semibold text-ink">{rowLabel}</p>
          <p className="mt-0.5 text-muted flex items-center gap-[6px]">
            {entry.category && (
              <span
                className="h-[6px] w-[6px] rounded-full shrink-0"
                style={{ background: entry.category.color }}
                aria-hidden="true"
              />
            )}
            {entry.category?.name}
            {entry.category && " · "}
            {structureLabel} · <span className="mono">{momento}</span>
          </p>
        </div>

        <HistoryChangesBlock
          changes={entry.changes}
          direction="modal"
          formulaCurrencyFallback={formulaCurrencyFallback}
          heading={isEdit ? "Al deshacer queda así:" : "Vuelve a la app:"}
        />

        <p className="text-[12.5px] text-muted">Esta entrada se borra del historial.</p>
      </ModalShellBody>

      <ModalShellFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="button" variant="default" size="sm" onClick={onConfirm} disabled={isSubmitting}>
          {isSubmitting ? "Deshaciendo…" : "Deshacer"}
        </Button>
      </ModalShellFooter>
    </ModalShell>
  );
}
