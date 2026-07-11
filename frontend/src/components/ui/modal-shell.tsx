"use client";

/**
 * ModalShell — shell de modal compartido, pieza única (docs/design.md
 * §"Overflow de modales y bloqueo del fondo" → "Shell de modal compartido
 * (ModalShell) — pieza única, no convención copiada").
 *
 * Encapsula lo que hoy vive copiado a mano en cada modal/diálogo: portal a
 * `document.body`, scrim, gate de montado (SSR-safe), cierre con `Esc`,
 * `useBodyScrollLock` y el panel de 3 zonas (header pineado / cuerpo
 * scrolleable / footer pineado) con `max-height: calc(100dvh - 48px)`
 * (`dvh`, nunca `vh`) atado al padding del scrim (`p-6` = 24px).
 *
 * El modal concreto NO vuelve a armar scrim ni a llamar `useBodyScrollLock`
 * por su cuenta: aporta solo su contenido (`ModalShellHeader` / children /
 * `ModalShellFooter`) y sus acciones.
 *
 * Dos variantes (anatomía y contrato idénticos, difieren en tamaño/densidad):
 * - "dialog" — confirmación / diálogo chico (borrados, reactivación,
 *   active-limit-dialog): max-w-[440px].
 * - "form" — formulario largo (transaction-modal, category-form-modal,
 *   método de pago, crear/editar límite): max-w-[460px], puede llevar tabs
 *   en el header.
 *
 * Apilamiento (invariante 3 / RN de overlays): `stacked` monta el scrim en
 * z-50 en vez de z-40, para el único caso de un diálogo que se abre ENCIMA
 * de un modal ya abierto (ActiveLimitDialog sobre TransactionModal). El
 * body-lock es ref-counted (`useBodyScrollLock`) — soporta el apilamiento
 * sin liberar el lock hasta que se cierra el último.
 */

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

export type ModalShellVariant = "dialog" | "form";

const VARIANT_MAX_WIDTH: Record<ModalShellVariant, string> = {
  dialog: "max-w-[440px]",
  form: "max-w-[460px]",
};

export interface ModalShellProps {
  /** "dialog" (confirmación chica) | "form" (formulario largo, puede llevar tabs). */
  variant: ModalShellVariant;
  /** Cierra el modal — disparado por `Esc` (click en el scrim NO cierra, por diseño). */
  onClose: () => void;
  /** id del `<h2>` de título (o equivalente) — para `aria-labelledby` del rol dialog. */
  labelledBy: string;
  /** id del contenido descriptivo — para `aria-describedby` (ej: ActiveLimitDialog). */
  describedBy?: string;
  /** Rol de accesibilidad. Default "dialog"; "alertdialog" para avisos que interrumpen. */
  role?: "dialog" | "alertdialog";
  /** true = este shell se abre ENCIMA de otro modal ya montado (z-50 en vez de z-40). */
  stacked?: boolean;
  /**
   * true = el clic en el scrim cierra el modal (excepción del cierre tipo
   * popover — ver docs/design.md §"Card de detalle de movimiento": read-only
   * y auxiliar, no demanda una decisión explícita). Default false: el resto
   * de los modales (confirmaciones, forms) NO cierran por clic afuera.
   */
  closeOnScrimClick?: boolean;
  children: ReactNode;
}

export function ModalShell({
  variant,
  onClose,
  labelledBy,
  describedBy,
  role = "dialog",
  stacked = false,
  closeOnScrimClick = false,
  children,
}: ModalShellProps) {
  const [mounted, setMounted] = useState(false);

  // Ref-count a nivel de módulo (ver hook): soporta apilamiento sin liberar
  // el lock hasta que se cierra el último modal abierto.
  useBodyScrollLock();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    /*
     * Scrim — por default el click afuera NO cierra: son superficies que
     * demandan una decisión explícita. `closeOnScrimClick` es la excepción
     * opt-in (card de detalle de movimiento, read-only/auxiliar).
     *
     * stopPropagation SIEMPRE (no solo cuando closeOnScrimClick): el shell se
     * monta vía portal a `document.body`, pero el evento sintético de React
     * burbujea por el árbol de REACT (donde el shell sigue siendo hijo del
     * componente que lo abre), no por el árbol de DOM. Sin este corte, un
     * click en el scrim sigue de largo hasta el `onClick` del disparador (ej:
     * la fila que abre la card con `onClick={() => setIsDetailOpen(true)}`),
     * reabriéndolo en el mismo tick y neutralizando el cierre.
     */
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center p-6",
        stacked ? "z-50" : "z-40",
      )}
      style={{ background: "oklch(0.18 0.02 270 / 0.46)", backdropFilter: "blur(3px)" }}
      role={role}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={(e) => {
        e.stopPropagation();
        if (closeOnScrimClick) onClose();
      }}
    >
      {/* Panel — columna flex acotada al alto del viewport. El padding del
          scrim (p-6 = 24px) y el max-height (calc(100dvh-48px)) están atados:
          48px = 2 × 24px. Si el padding del scrim cambia, este calc lo sigue
          por construcción (única fuente: este componente).
          stopPropagation: el clic DENTRO del panel nunca debe burbujear al
          scrim (evitaría cerrar por error un modal con closeOnScrimClick). */}
      <div
        className={cn(
          "w-full bg-panel border border-line overflow-hidden animate-modal-pop max-h-[calc(100dvh-48px)] flex flex-col",
          VARIANT_MAX_WIDTH[variant],
        )}
        style={{ borderRadius: "18px", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ─── Zona 1 — Header (pineado, shrink-0) ───────────────────────────────────

export interface ModalShellHeaderProps {
  titleId: string;
  title: string;
  /** Si se pasa, renderiza el botón ✕ de cierre. Las confirmaciones sin ✕ (solo Cancelar/Confirmar en el footer) lo omiten. */
  onClose?: () => void;
}

export function ModalShellHeader({ titleId, title, onClose }: ModalShellHeaderProps) {
  return (
    <div className="flex items-center justify-between px-[22px] pt-5 pb-4 shrink-0">
      <h2 id={titleId} className="text-[18px] font-bold tracking-[-0.01em] text-ink m-0 min-w-0 flex-1 truncate">
        {title}
      </h2>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// ─── Zona 2 — Cuerpo (única región que scrollea) ───────────────────────────

export interface ModalShellBodyProps {
  id?: string;
  className?: string;
  children: ReactNode;
}

export function ModalShellBody({ id, className, children }: ModalShellBodyProps) {
  return (
    <div
      id={id}
      className={cn(
        "flex-1 min-h-0 overflow-y-auto px-[22px] pb-[22px] space-y-[14px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ─── Zona 3 — Footer (pineado, hermano del cuerpo, no hijo) ────────────────

export interface ModalShellFooterProps {
  className?: string;
  children: ReactNode;
}

export function ModalShellFooter({ className, children }: ModalShellFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 px-[22px] py-4 border-t border-hair bg-panel-2 shrink-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
