import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Primitiva Button con variantes tipadas via cva.
 * Re-estilada contra tokens del design system "Precise Ledger" (Fase 2).
 *
 * Variantes de modo actual → tokens DS:
 *   default     → btn primario: bg-accent, texto blanco, inset highlight, hover translateY
 *   ghost       → btn secundario: bg-panel, borde border-line, hover bg-panel-2
 *   destructive → semántica expense: bg-expense-soft, texto expense-ink, borde expense
 *   outline     → variante neutra con borde (bg-panel, border-line-strong)
 *   secondary   → alias de ghost (bg-panel-2 base)
 *   link        → texto accent-ink, subrayado offset
 *
 * Prop `asChild`: delega el render a otro elemento (ej: Link de Next.js) via Radix Slot.
 * Export `buttonVariants` preservado para uso externo.
 */

const buttonVariants = cva(
  // Base styles: fuente UI, cursor, flex, transición, disabled, íconos 16px
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-ui font-semibold cursor-pointer",
    "rounded-ctl",
    "transition-all duration-[140ms]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        /**
         * Primario — bg-accent, blanco, inset highlight superior, hover translateY + shadow-md.
         * El inset highlight (inset 0 1px 0 oklch(1 0 0 / 0.2)) se aplica con style inline
         * en el componente porque Tailwind v4 no puede componer box-shadow con inset arbitrary
         * sobre var() dinámicas. Se aplica mediante la clase CSS `btn-primary-shadow`.
         */
        default: [
          "bg-accent text-white border border-transparent",
          "shadow-[var(--shadow-sm),inset_0_1px_0_oklch(1_0_0_/_0.2)]",
          "hover:bg-accent-press hover:-translate-y-px hover:shadow-[var(--shadow-md)]",
        ],
        /**
         * Ghost / secundario — panel con borde, hover a panel-2.
         */
        ghost: [
          "bg-panel text-ink border border-line",
          "shadow-[var(--shadow-sm)]",
          "hover:bg-panel-2 hover:border-line-strong",
        ],
        /**
         * Destructive — semántica expense (rojo).
         * Mantiene la variante para no romper usos en Fase 3.
         */
        destructive: [
          "bg-expense-soft text-expense-ink border border-expense",
          "shadow-[var(--shadow-sm)]",
          "hover:bg-expense hover:text-white hover:-translate-y-px",
        ],
        /**
         * Outline — borde fuerte, fondo panel.
         */
        outline: [
          "bg-panel text-ink border border-line-strong",
          "shadow-[var(--shadow-sm)]",
          "hover:bg-panel-2 hover:-translate-y-px",
        ],
        /**
         * Secondary — sinónimo de ghost pero con base panel-2.
         */
        secondary: [
          "bg-panel-2 text-ink border border-line",
          "shadow-[var(--shadow-sm)]",
          "hover:bg-panel-3 hover:border-line-strong",
        ],
        /**
         * Link — texto accent-ink subrayado.
         */
        link: [
          "bg-transparent text-accent-ink border-transparent shadow-none",
          "underline underline-offset-4 hover:text-accent",
        ],
      },
      size: {
        /**
         * Tamaños del DS: padding (vertical horizontal), font-size
         *   default: 10px 16px / 14px
         *   sm:      7px 12px  / 13px
         *   lg:      13px 20px / 15px
         *   icon:    cuadrado 36px
         */
        default: "px-4 py-[10px] text-sm",
        sm: "px-3 py-[7px] text-[13px]",
        lg: "px-5 py-[13px] text-[15px]",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Si es true, el componente delega el render a su hijo via Radix Slot */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
