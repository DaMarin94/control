"use client";

/**
 * ActiveLimitDialog — aviso de confirmación de la naturaleza ACTIVA de límites
 * (docs/design.md §"Aviso de alerta activa de límites — P2, fase 2").
 *
 * Diálogo de confirmación APILADO (`stacked`, z-50) sobre el modal de
 * movimiento (z-40): al pulsar Guardar, si el resultado proyectado cruzaría
 * ≥1 límite activo, se muestra este aviso EN VEZ de persistir directo.
 * "Cancelar" (foco inicial) cierra solo el aviso — el modal de movimiento
 * queda abierto con el form intacto. "Guardar igual" (primario, índigo — NO
 * destructive/ámbar) persiste (D10/D11: avisa y deja continuar, no bloquea).
 *
 * Consume el shell compartido `ModalShell` (variant="dialog", stacked,
 * role="alertdialog") y el callout ámbar del borrado en cascada — mismo
 * registro `--warning`.
 */

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAnchorDef, formatThreshold } from "@/lib/limits/catalog";
import { ModalShell, ModalShellHeader, ModalShellBody, ModalShellFooter } from "@/components/ui/modal-shell";
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
  // Foco inicial en "Cancelar" (D11 + a11y): un Enter reflejo del click en
  // Guardar que disparó la intercepción no debe saltar el aviso por accidente.
  // `ModalShell` gatea su propio mount (portal SSR-safe) antes de montar los
  // children — por eso el foco se dispara desde un ref callback (corre justo
  // cuando el botón real entra al DOM) en vez de un efecto con dependencia de
  // `mounted` local (ese estado ya no vive acá, vive dentro de `ModalShell`).
  function focusCancelOnMount(el: HTMLButtonElement | null) {
    el?.focus();
  }

  const count = crossed.length;
  const title = count === 1 ? "Este movimiento cruza un límite" : `Este movimiento cruza ${count} límites`;
  const guideLine =
    count === 1
      ? "Al guardar, este movimiento cruzaría un límite que definiste:"
      : `Al guardar, este movimiento cruzaría estos ${count} límites que definiste:`;

  return (
    <ModalShell
      variant="dialog"
      stacked
      role="alertdialog"
      onClose={onCancel}
      labelledBy="active-limit-dialog-title"
      describedBy="active-limit-dialog-description"
    >
      <ModalShellHeader titleId="active-limit-dialog-title" title={title} />

      <ModalShellBody id="active-limit-dialog-description">
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
      </ModalShellBody>

      <ModalShellFooter>
        <Button
          ref={focusCancelOnMount}
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
      </ModalShellFooter>
    </ModalShell>
  );
}
