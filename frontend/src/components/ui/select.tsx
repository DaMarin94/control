import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Primitiva Select nativa.
 * Para los formularios de la app donde el selector es simple (no Radix UI).
 */

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Mensaje de error para mostrar bajo el select */
  error?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        <select
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500 focus-visible:ring-red-500",
            className,
          )}
          ref={ref}
          aria-invalid={error ? "true" : undefined}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";

export { Select };
