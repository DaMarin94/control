"use client";

/**
 * Checkbox "Débito automático" — atributo del MOVIMIENTO (P4, corrección de alcance),
 * no del método de pago. Se renderiza en los forms de único/fijo/cuotas SOLO cuando el
 * método de pago seleccionado en el form es de tipo DEBIT (docs/design.md, §Débito
 * automático — control condicional en el form de carga).
 *
 * Checkbox del DS — mismo molde visual que el de CategoryFilterPopover, en fila con el
 * label a la derecha. Sin `Label` arriba (propio del checkbox).
 */

import { cn } from "@/lib/utils";

export interface AutoDebitCheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function AutoDebitCheckbox({ id, checked, onChange }: AutoDebitCheckboxProps) {
  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-fit items-center gap-[9px] rounded-sm cursor-pointer focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-[140ms]",
          checked ? "border-accent bg-accent" : "border-line bg-panel group-hover:border-line-strong",
        )}
        aria-hidden="true"
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="text-[13px] font-medium text-ink-2">Débito automático</span>
    </button>
  );
}
