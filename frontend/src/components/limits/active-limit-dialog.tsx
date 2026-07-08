"use client";

/**
 * ActiveLimitDialog — aviso de confirmación de la naturaleza ACTIVA de límites
 * (docs/design.md §"Aviso de alerta activa de límites — P2, fase 2").
 *
 * Diálogo de confirmación APILADO (z-50) sobre el modal de movimiento (z-40):
 * al pulsar Guardar, si el resultado proyectado cruzaría ≥1 límite activo, se
 * muestra este aviso EN VEZ de persistir directo. "Cancelar" (foco inicial)
 * cierra solo el aviso — el modal de movimiento queda abierto con el form
 * intacto. "Guardar igual" (primario, índigo — NO destructive/ámbar) persiste
 * (D10/D11: avisa y deja continuar, no bloquea).
 *
 * Reusa el molde de los `delete-*-dialog` (scrim, diálogo, header/cuerpo/footer)
 * y el callout ámbar del borrado en cascada — mismo registro `--warning`.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAnchorDef, formatThreshold } from "@/lib/limits/catalog";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import type { LimitConfig, LimitOperator } from "@/types/limit";

/**
 * Verbo de la condición cruzada, derivado del operador (docs/design.md).
 * Redacción de contenido — el copy definitivo lo confirma el analista.
 */
const CROSSING_VERB: Record<LimitOperator, string> = {
  gt: "supera",
  gte: "alcanza o supera",
  lt: "queda por debajo de",
  lte: "queda por debajo de",
  eq: "llega a",
};

export interface ActiveLimitDialogProps {
  /** Límites activos que se cruzarían con el guardado (D18: enumera TODOS). */
  crossed: LimitConfig[];
  /** Cierra solo el aviso; el modal de movimiento queda abierto e intacto. */
  onCancel: () => void;
  /** Persiste el movimiento (mismo save-path de hoy) y cierra ambos diálogos. */
  onConfirm: () => void;
  /** true mientras se persiste tras "Guardar igual" (deshabilita los botones). */
  isConfirming?: boolean;
}

export function ActiveLimitDialog({ crossed, onCancel, onConfirm, isConfirming = false }: ActiveLimitDialogProps) {
  const [mounted, setMounted] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useBodyScrollLock();

  useEffect(() => setMounted(true), []);

  // Foco inicial en "Cancelar" (D11 + a11y): un Enter reflejo del click en
  // Guardar que disparó la intercepción no debe saltar el aviso por accidente.
  // Depende de `mounted`: recién en el render posterior al mount (patrón SSR-safe
  // de createPortal) existe el nodo real de "Cancelar" al que enfocar.
  useEffect(() => {
    if (mounted) cancelButtonRef.current?.focus();
  }, [mounted]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  if (!mounted) return null;

  const count = crossed.length;
  const title = count === 1 ? "Este movimiento cruza un límite" : `Este movimiento cruza ${count} límites`;
  const guideLine =
    count === 1
      ? "Al guardar, este movimiento cruzaría un límite que definiste:"
      : `Al guardar, este movimiento cruzaría estos ${count} límites que definiste:`;

  return createPortal(
    /* Scrim — z-50: por encima del modal de movimiento (z-40) */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "oklch(0.18 0.02 270 / 0.46)", backdropFilter: "blur(3px)" }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="active-limit-dialog-title"
      aria-describedby="active-limit-dialog-description"
    >
      {/* Diálogo */}
      <div
        className="w-full max-w-[420px] bg-panel border border-line overflow-hidden animate-modal-pop max-h-[calc(100dvh-48px)] flex flex-col"
        style={{ borderRadius: "18px", boxShadow: "var(--shadow-lg)" }}
      >
        {/* Header */}
        <div className="px-[22px] pt-5 pb-4 shrink-0">
          <h2
            id="active-limit-dialog-title"
            className="text-[18px] font-bold tracking-[-0.01em] text-ink m-0"
          >
            {title}
          </h2>
        </div>

        {/* Cuerpo */}
        <div
          id="active-limit-dialog-description"
          className="flex-1 min-h-0 overflow-y-auto px-[22px] pb-[22px] space-y-[14px]"
        >
          <p className="text-[14px] text-ink">{guideLine}</p>

          {/* Callout ámbar — UN solo AlertTriangle (regla de colisión de la marca pasiva) */}
          <div
            className="rounded-ctl px-[14px] py-[13px] flex items-start gap-[11px]"
            style={{ background: "var(--warning-soft)", border: "1px solid var(--warning)" }}
          >
            <AlertTriangle
              size={16}
              strokeWidth={2}
              aria-hidden="true"
              style={{ color: "var(--warning-ink)", flexShrink: 0, marginTop: "1px" }}
            />
            <ul className="flex-1 min-w-0 list-none m-0 p-0 space-y-2">
              {crossed.map((limit) => {
                const anchorDef = getAnchorDef(limit.anchorKey);
                const unit = anchorDef?.unit ?? "money";
                // Placeholder = métrica legible SOLA (sin condición embebida): la
                // condición ya se enuncia por separado a continuación (verb + umbral).
                // NO reusa `deriveLimitLabel` (ese helper embebe la condición, pensado
                // para el label de una sola línea en la lista del panel).
                const label = limit.label ?? anchorDef?.label ?? limit.anchorKey;
                const verb = CROSSING_VERB[limit.operator];
                const thresholdLabel = formatThreshold(unit, limit.threshold);
                return (
                  <li key={limit.id} className="text-[13.5px] leading-snug" style={{ color: "var(--warning-ink)" }}>
                    {count > 1 && (
                      <span aria-hidden="true" className="mr-1">
                        •
                      </span>
                    )}
                    <span className="font-semibold">{label}</span>
                    <span className="font-medium"> · {verb} </span>
                    <span className="font-medium mono tabular-nums">{thresholdLabel}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="text-[12.5px] font-medium text-muted">
            Podés guardarlo igual — Control solo te avisa.
          </p>
        </div>

        {/* Footer — idéntico al de los delete-*-dialog */}
        <div className="flex items-center justify-end gap-3 px-[22px] py-4 border-t border-hair bg-panel-2 shrink-0">
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isConfirming}
          >
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={onConfirm} disabled={isConfirming}>
            {isConfirming ? "Guardando..." : "Guardar igual"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
