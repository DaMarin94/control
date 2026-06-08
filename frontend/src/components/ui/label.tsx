import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Primitiva Label.
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
          "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          className,
        )}
        ref={ref}
        {...props}
      >
        {children}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>
    );
  },
);

Label.displayName = "Label";

export { Label };
