import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Primitiva Input tipada.
 * Re-estilada contra tokens del design system "Precise Ledger" (Fase 2).
 *
 * Spec DS (.input):
 *   - bg-panel, border 1.5px border-line, rounded-ctl
 *   - padding 11px 13px, font-ui 15px, text-ink
 *   - placeholder: text-faint
 *   - focus-visible: border-accent + ring 3px var(--accent-soft)
 *   - error: border-expense + texto text-expense-ink; ring expense-soft
 *
 * Nunca se usa <input> HTML crudo en los formularios — todo pasa por aquí.
 */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Mensaje de error para mostrar bajo el input */
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        <input
          type={type}
          className={cn(
            // Layout y tipografía base
            "flex w-full font-ui text-[15px] text-ink",
            // Superficie y borde
            "rounded-ctl border-[1.5px] border-line bg-panel",
            // Padding DS: 11px vertical, 13px horizontal
            "px-[13px] py-[11px]",
            // Transición
            "transition-all duration-[140ms]",
            // Placeholder
            "placeholder:text-faint",
            // Focus: borde accent + ring 3px accent-soft
            "focus-visible:outline-none focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
            // Disabled
            "disabled:cursor-not-allowed disabled:opacity-50",
            // File inputs
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
            // Estado error: borde expense, ring expense-soft
            error && [
              "border-expense",
              "focus-visible:border-expense focus-visible:shadow-[0_0_0_3px_var(--expense-soft)]",
            ],
            className,
          )}
          ref={ref}
          aria-invalid={error ? "true" : undefined}
          {...props}
        />
        {error && (
          <p className="text-xs text-expense-ink" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };
