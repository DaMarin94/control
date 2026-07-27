"use client";

/**
 * PaymentMethodSelect — selector de método de pago opcional del form de carga
 * (RF-PM-006). Análogo al selector de categoría, pero renderiza glifos (ícono +
 * nombre + chip de tipo) que un `<select>` nativo no puede mostrar dentro de sus
 * `<option>` — por eso es un listbox custom (trigger + panel por portal), con el
 * mismo cromo que la primitiva `Select` (docs/design.md, §Métodos de pago —
 * render en el selector del form).
 *
 * Cierra por clic afuera / Esc / re-clic — mismo comportamiento que los demás
 * popovers del proyecto (docs/design.md, §Cierre de overlays). Posicionamiento
 * (flip vertical) y cierre ante scroll vía `useListboxPosition` /
 * `useListboxDismiss` (docs/design.md, §Posicionamiento de popovers/listbox
 * por portal).
 *
 * Lista solo los métodos ACTIVOS (ya es lo que devuelve GET /payment-methods).
 * Sin botón "+ Nueva" inline (a diferencia de categorías, RF-PM-006).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { PaymentMethodIcon } from "@/components/ui/payment-method-icon";
import { PAYMENT_METHOD_TYPE_LABELS } from "@/types/payment-method";
import { useListboxPosition, useListboxDismiss } from "@/hooks/use-listbox-popover";

/** Tope intrínseco de alto del panel cuando hay espacio de sobra. */
const INTRINSIC_MAX_HEIGHT = 260;

export interface PaymentMethodSelectProps {
  id?: string;
  /** Id del método seleccionado; "" = ninguno (default) */
  value: string;
  onChange: (value: string) => void;
}

const NONE_LABEL = "Sin método de pago";

export function PaymentMethodSelect({ id, value, onChange }: PaymentMethodSelectProps) {
  const { paymentMethods } = usePaymentMethods();
  const options = paymentMethods ?? [];

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useListboxDismiss(open, close, triggerRef, panelRef);
  const pos = useListboxPosition(open, triggerRef, panelRef, INTRINSIC_MAX_HEIGHT);

  function handleTriggerClick() {
    setOpen((o) => !o);
  }

  function handleSelect(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  const selected = options.find((pm) => pm.id === value) ?? null;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={handleTriggerClick}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2 rounded-ctl border-[1.5px] border-line bg-panel",
          "py-[11px] pl-[13px] pr-10 relative",
          "text-[15px] text-left transition-all duration-[140ms] cursor-pointer",
          "focus-visible:outline-none focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]",
        )}
      >
        {selected ? (
          <>
            <PaymentMethodIcon icon={selected.icon} size={16} className="shrink-0 text-ink-2" />
            <span className="text-ink truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-faint truncate">{NONE_LABEL}</span>
        )}
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
          size={16}
          aria-hidden="true"
        />
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-label="Método de pago"
            className="animate-modal-pop"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 80,
              maxHeight: pos.maxHeight,
              overflowY: "auto",
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-ctl)",
              boxShadow: "var(--shadow-lg)",
              padding: "4px",
            }}
          >
            {/* "Sin método de pago" — encabeza la lista, sin glifo */}
            <button
              type="button"
              role="option"
              aria-selected={value === ""}
              onClick={() => handleSelect("")}
              className={cn(
                "flex w-full items-center rounded-[7px] px-3 py-[8px] text-left text-[13.5px]",
                value === "" ? "bg-panel-2 text-ink font-medium" : "text-muted hover:bg-panel-2",
              )}
            >
              {NONE_LABEL}
            </button>

            {options.map((pm) => (
              <button
                key={pm.id}
                type="button"
                role="option"
                aria-selected={value === pm.id}
                onClick={() => handleSelect(pm.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[7px] px-3 py-[8px] text-left text-[13.5px]",
                  value === pm.id ? "bg-panel-2 text-ink" : "text-ink hover:bg-panel-2",
                )}
              >
                <PaymentMethodIcon icon={pm.icon} size={16} className="shrink-0 text-ink-2" />
                <span className="flex-1 truncate">{pm.name}</span>
                <span className="shrink-0 rounded-chip bg-panel-3 text-muted px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em]">
                  {PAYMENT_METHOD_TYPE_LABELS[pm.type]}
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
