"use client";

/**
 * CaptureSessionChip — chrome de sesión de la superficie de captura
 * (RF-APP-003/RF-AUTH-004, docs/design.md §Superficie de captura → "5.
 * Cabecera A — chrome de la sesión").
 *
 * Chip con avatar + email (siempre visible, identidad de la cuenta activa)
 * + popover de UN SOLO ítem ("Cerrar sesión") — la única capacidad de esta
 * superficie además de crear un movimiento (RF-APP-003). Portaleado a
 * `document.body` (mismo patrón que `KebabMenu` / `PaymentMethodSelect`,
 * docs/frontend.md §"Portal para overlays anclados...") y posicionado con el
 * hook canónico `use-listbox-popover`.
 */

import { useEffect, useRef, useState, useId } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useListboxPosition, useListboxDismiss } from "@/hooks/use-listbox-popover";

export interface CaptureSessionChipProps {
  email: string;
}

const PANEL_INTRINSIC_HEIGHT = 48 + 12; // un solo ítem de 48px + gap

export function CaptureSessionChip({ email }: CaptureSessionChipProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  const pos = useListboxPosition(open, triggerRef, panelRef, PANEL_INTRINSIC_HEIGHT);
  useListboxDismiss(open, () => setOpen(false), triggerRef, panelRef);

  const initial = email.charAt(0).toUpperCase() || "?";

  function handleSignOut() {
    setOpen(false);
    signOut({ callbackUrl: "/login" });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="flex max-w-full items-center gap-[7px] rounded-ctl px-2 py-[7px] transition-colors duration-[140ms] data-[open=true]:bg-panel-2 hover:bg-panel-2 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
        data-open={open}
      >
        <span
          aria-hidden="true"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold text-white"
          style={{
            background: "linear-gradient(140deg, oklch(0.7 0.1 264), oklch(0.55 0.13 304))",
          }}
        >
          {initial}
        </span>
        <span className="min-w-0 truncate text-[13px] font-medium text-ink-2">{email}</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`shrink-0 text-muted transition-transform duration-[140ms] ${open ? "rotate-180" : ""}`}
        />
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role="menu"
            aria-label="Sesión"
            className="fixed z-40 rounded-ctl border border-line bg-panel shadow-[var(--shadow-md)] overflow-hidden"
            style={{
              top: pos.top,
              left: pos.left,
              width: "min(240px, calc(100vw - 32px))",
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-3 py-[13px] text-[15px] font-medium text-ink-2 transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink"
            >
              <LogOut size={16} className="shrink-0 text-muted" aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
