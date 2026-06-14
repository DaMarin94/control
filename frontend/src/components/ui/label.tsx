import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Primitiva Label.
 * Re-estilada contra tokens del design system "Precise Ledger" (Fase 2).
 *
 * Spec DS (.f label):
 *   - 12.5px, font-weight 600, text-ink-2, letter-spacing .01em
 *   - Prop `required` agrega asterisco visual en text-expense-ink
 */

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Indica si el campo es requerido (agrega * visual) */
  required?: boolean;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, ...props }, ref) => {
    return (
      <label
        className={cn(
          "text-[12.5px] font-semibold leading-none tracking-[0.01em] text-ink-2",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          className,
        )}
        ref={ref}
        {...props}
      >
        {children}
        {required && (
          <span className="ml-0.5 text-expense-ink" aria-hidden="true">
            *
          </span>
        )}
      </label>
    );
  },
);

Label.displayName = "Label";

export { Label };
