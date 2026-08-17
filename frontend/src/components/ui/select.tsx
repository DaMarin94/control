import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Primitiva Select nativa.
 * Re-estilada contra tokens del design system "Precise Ledger" (Fase 2).
 *
 * Spec DS (.input.select):
 *   - Misma caja que .input: bg-panel, border 1.5px border-line, rounded-ctl
 *   - padding 11px 13px, font-ui 15px, text-ink
 *   - Chevron a la derecha (text-muted), cursor pointer
 *   - focus: border-accent + ring 3px var(--accent-soft)
 *   - error: border-expense + texto text-expense-ink
 *
 * Para los formularios de la app donde el selector es simple (no Radix UI).
 */

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Mensaje de error para mostrar bajo el select */
  error?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <div className="flex w-full min-w-0 flex-col gap-1">
        {/* Wrapper relativo para posicionar el chevron */}
        <div className="relative min-w-0">
          <select
            className={cn(
              // Layout y tipografía base
              "flex w-full min-w-0 appearance-none font-ui text-[15px] text-ink",
              // Superficie y borde
              "rounded-ctl border-[1.5px] border-line bg-panel",
              // Padding DS: 11px vertical, 13px horizontal; pr extra para el ícono
              "py-[11px] pl-[13px] pr-10",
              // Cursor y transición
              "cursor-pointer transition-all duration-[140ms]",
              // Focus: borde accent + ring 3px accent-soft
              "focus-visible:outline-none focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]",
              // Disabled
              "disabled:cursor-not-allowed disabled:opacity-50",
              // Estado error: borde expense
              error && [
                "border-expense",
                "focus:border-expense focus:shadow-[0_0_0_3px_var(--expense-soft)]",
              ],
              className,
            )}
            ref={ref}
            aria-invalid={error ? "true" : undefined}
            {...props}
          >
            {children}
          </select>

          {/* Chevron decorativo — pointer-events-none para no interferir con clicks */}
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            size={16}
            aria-hidden="true"
          />
        </div>

        {error && (
          <p className="text-xs text-expense-ink" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";

export { Select };
