"use client";

/**
 * Fila de una entrada de historial (docs/design.md §2 — anatomía de la entrada,
 * §4 estados, §9 contención responsive).
 *
 * Grid `40px 1fr auto` en régimen amplio (`@wide:`, contenido ≥941px sobre
 * `<main>`); en compacto colapsa a `40px 1fr` y el "momento" + la acción migran
 * DENTRO del flujo de col 2 (mismo idioma dual-render `hidden @wide:flex` /
 * `@wide:hidden` que `default-payment-method-cell.tsx`, en vez de duplicar el
 * árbol entero — solo se duplican las dos piezas que cambian de posición
 * estructural: el momento (inline en la sublínea vs. col 3) y la acción
 * (fila propia vs. col 3).
 *
 * El cuerpo entero es clickeable (`role="button"`) y abre el mismo modal que
 * el botón de acción — "Deshacer" o "Bloqueado" según `entry.canUndo` (§4,
 * "Dos caminos, un mismo destino"). El botón es un `<button>` hermano con
 * `stopPropagation` (mismo mecanismo que el kebab de `/mes`).
 */

import type { KeyboardEvent } from "react";
import { Pencil, Trash2, Undo2, Lock, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HistoryChangesBlock } from "@/components/history/history-changes-block";
import { HISTORY_TARGET_KIND_LABEL, formatHistoryMoment } from "@/lib/history";
import { getBrowserTimezone } from "@/lib/format";
import type { HistoryEntryResponseDto } from "@/types/history";
import type { CurrencyCode } from "@/types/settings";
import { cn } from "@/lib/utils";

function IdentitySeparator() {
  return <span className="inline-block h-[3px] w-[3px] rounded-full bg-faint shrink-0" aria-hidden="true" />;
}

interface HistoryEntryRowProps {
  entry: HistoryEntryResponseDto;
  formulaCurrencyFallback: CurrencyCode;
  /** true mientras esta entrada (o su cadena) se está deshaciendo — opacidad + sin interacción (§4). */
  isBusy: boolean;
  onOpen: (entry: HistoryEntryResponseDto) => void;
}

export function HistoryEntryRow({ entry, formulaCurrencyFallback, isBusy, onOpen }: HistoryEntryRowProps) {
  const isEdit = entry.action === "EDIT";
  const Icon = isEdit ? Pencil : Trash2;
  const chipLabel = isEdit ? "Editado" : "Eliminado";

  const rowLabel = entry.description ?? entry.category?.name ?? "Movimiento";
  const structureLabel = HISTORY_TARGET_KIND_LABEL[entry.targetKind];
  const momento = formatHistoryMoment(entry.createdAt, getBrowserTimezone());

  function handleOpen() {
    if (isBusy) return;
    onOpen(entry);
  }

  function handleRowKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleOpen();
    }
  }

  function handleActionClick(e: React.MouseEvent) {
    e.stopPropagation();
    handleOpen();
  }

  // El botón y el motivo se renderizan dos veces (compacto inline / amplio col
  // 3, ver docstring) con distinto ORDEN relativo (compacto: motivo a la
  // izquierda del botón, misma fila — §9; amplio: motivo debajo del botón —
  // §2). `variant` distingue los `id` para no duplicar ids en el DOM.
  function ActionButton({ variant }: { variant: "compact" | "wide" }) {
    const motiveId = `history-blocked-motive-${entry.id}-${variant}`;
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[36px] whitespace-nowrap"
        onClick={handleActionClick}
        aria-describedby={entry.canUndo ? undefined : motiveId}
      >
        {entry.canUndo ? (
          <>
            <Undo2 size={15} aria-hidden="true" />
            Deshacer
          </>
        ) : (
          <>
            <Lock size={15} aria-hidden="true" />
            Bloqueado
          </>
        )}
      </Button>
    );
  }

  function BlockedMotive({ variant }: { variant: "compact" | "wide" }) {
    if (entry.canUndo) return null;
    const motiveId = `history-blocked-motive-${entry.id}-${variant}`;
    return (
      <span id={motiveId} className="text-[12px] text-muted whitespace-nowrap">
        Hay {entry.blockingCount} {entry.blockingCount === 1 ? "cambio posterior" : "cambios posteriores"}
      </span>
    );
  }

  return (
    <div
      role="button"
      tabIndex={isBusy ? -1 : 0}
      aria-label={`Ver cambio de ${rowLabel}, ${momento}`}
      onClick={handleOpen}
      onKeyDown={handleRowKeyDown}
      className={cn(
        "grid grid-cols-[40px_1fr] @wide:grid-cols-[40px_1fr_auto] gap-x-[14px] gap-y-[10px] items-start",
        "cursor-pointer transition-colors duration-[120ms]",
        "hover:bg-panel-2 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--accent-soft)]",
        isBusy && "opacity-[0.55] pointer-events-none",
      )}
      style={{ padding: "var(--row-pad) 18px" }}
    >
      {/* Col 1 — ícono de operación, 40×40, neutro (regla dura 1: nunca rojo por ser eliminación) */}
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-panel-3 text-ink-2"
        aria-hidden="true"
      >
        <Icon size={18} aria-hidden="true" />
      </span>

      {/* Col 2 — cuerpo */}
      <div className="min-w-0">
        {/* Línea de identidad */}
        <div className="flex items-center gap-[8px] min-w-0 leading-[21px]">
          <span className="text-[14.5px] font-semibold tracking-[-0.01em] text-ink truncate flex-1 min-w-0">
            {rowLabel}
          </span>
          <span className="inline-flex items-center rounded-[var(--r-chip)] bg-panel-3 text-muted px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em] shrink-0">
            {chipLabel}
          </span>
        </div>

        {/* Sublínea de identidad del movimiento */}
        <div className="flex flex-wrap items-center gap-[6px] mt-[1px] text-[12px] text-muted min-w-0">
          {entry.category && (
            <>
              <span
                className="h-[6px] w-[6px] rounded-full shrink-0"
                style={{ background: entry.category.color }}
                aria-hidden="true"
              />
              <span className="min-w-0 truncate text-ink-2">{entry.category.name}</span>
              <IdentitySeparator />
            </>
          )}
          <span className="shrink-0">{structureLabel}</span>
          {entry.isCalculated && (
            <>
              <IdentitySeparator />
              <span className="inline-flex items-center gap-[4px] shrink-0">
                <CornerDownRight size={12} className="text-muted shrink-0" aria-hidden="true" />
                calculado
              </span>
            </>
          )}
          {/* Momento — SOLO compacto, último segmento de la sublínea (§9) */}
          <span className="@wide:hidden inline-flex items-center gap-[6px] shrink-0">
            <IdentitySeparator />
            <span className="mono whitespace-nowrap">{momento}</span>
          </span>
        </div>

        {/* Bloque "Qué cambió" */}
        <div className="mt-[10px]">
          <HistoryChangesBlock
            changes={entry.changes}
            direction="list"
            formulaCurrencyFallback={formulaCurrencyFallback}
            heading={isEdit ? undefined : "Se eliminó:"}
          />
        </div>

        {/* Acción — SOLO compacto, fila propia alineada a la derecha; motivo a la izquierda del botón (§9) */}
        <div className="@wide:hidden flex items-center justify-end gap-[10px] mt-[10px]">
          <BlockedMotive variant="compact" />
          <ActionButton variant="compact" />
        </div>
      </div>

      {/* Col 3 — SOLO amplio: momento, botón, motivo debajo (§2) */}
      <div className="hidden @wide:flex flex-col items-end gap-[8px] shrink-0 self-start text-right">
        <span className="mono text-[12.5px] leading-[21px] text-muted whitespace-nowrap">{momento}</span>
        <ActionButton variant="wide" />
        <BlockedMotive variant="wide" />
      </div>
    </div>
  );
}
