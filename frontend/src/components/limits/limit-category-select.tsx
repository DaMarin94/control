"use client";

/**
 * LimitCategorySelect — listbox rico para el refinamiento por categoría del
 * modal de creación (docs/design.md §"Panel de gestión de límites" → 3.2):
 * molde `PaymentMethodSelect` con swatch de color de categoría (6px
 * rounded-full) + nombre, reusando el picker de categoría del DS.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCategories } from "@/hooks/use-categories";

export interface LimitCategorySelectProps {
  id?: string;
  /** categoryId seleccionado; "" = ninguno */
  value: string;
  onChange: (categoryId: string) => void;
}

const NONE_LABEL = "Elegí una categoría";

export function LimitCategorySelect({ id, value, onChange }: LimitCategorySelectProps) {
  const { categories } = useCategories();
  const options = categories ?? [];

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    function handleMouseDown(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      close();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", close, { capture: true });
    window.addEventListener("resize", close);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  function handleTriggerClick() {
    if (open) {
      setOpen(false);
      return;
    }
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    setOpen(true);
  }

  function handleSelect(categoryId: string) {
    onChange(categoryId);
    setOpen(false);
  }

  const selected = options.find((c) => c.id === value) ?? null;

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
            <span
              className="h-[6px] w-[6px] rounded-full shrink-0"
              style={{ background: selected.color }}
              aria-hidden="true"
            />
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
            aria-label="Categoría"
            className="animate-modal-pop"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 80,
              maxHeight: 260,
              overflowY: "auto",
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-ctl)",
              boxShadow: "var(--shadow-lg)",
              padding: "4px",
            }}
          >
            {options.map((category) => (
              <button
                key={category.id}
                type="button"
                role="option"
                aria-selected={value === category.id}
                onClick={() => handleSelect(category.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[7px] px-3 py-[8px] text-left text-[13.5px]",
                  value === category.id ? "bg-panel-2 text-ink" : "text-ink hover:bg-panel-2",
                )}
              >
                <span
                  className="h-[6px] w-[6px] rounded-full shrink-0"
                  style={{ background: category.color }}
                  aria-hidden="true"
                />
                <span className="flex-1 truncate">{category.name}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
