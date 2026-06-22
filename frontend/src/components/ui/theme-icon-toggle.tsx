"use client";

/**
 * ThemeIconToggle — Toggle compacto de 3 iconos para el modo de color.
 *
 * Spec visual: docs/design.md §"Selector de modo de color (chrome global)".
 *
 * Opciones (orden fijo): Monitor (Sistema) · Sun (Claro) · Moon (Oscuro)
 * - Track: --panel-3, radio --r-pill, padding 2px. inline-flex (ancho intrínseco ~108px).
 * - Segmentos: 3 botones cuadrados ~32–34px, ícono lucide size 16, centrado.
 * - Thumb deslizante: --panel + --shadow-sm, transición [left,width] 140ms ease-out.
 *   Instantánea con prefers-reduced-motion.
 * - Ícono seleccionado: --ink. No seleccionado: --muted → --ink-2 hover.
 * - Foco: ring --accent-soft 3px.
 * - A11y: role="radiogroup" + role="radio" + aria-checked + ←/→ ciclan.
 *   aria-label por segmento; Sistema incluye el modo resuelto.
 * - Sin color semántico ni índigo en los iconos (cromo neutro).
 * - Sin label visible (el ícono es el control; el texto vive en aria-label).
 */

import { Monitor, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThemeValue, ResolvedTheme } from "@/hooks/use-theme";

const OPTIONS: {
  value: ThemeValue;
  Icon: typeof Monitor;
  getAriaLabel: (resolved?: ResolvedTheme) => string;
}[] = [
  {
    value: "system",
    Icon: Monitor,
    getAriaLabel: (resolved) => {
      if (!resolved) return "Tema del sistema";
      const nowLabel = resolved === "dark" ? "oscuro" : "claro";
      return `Tema del sistema (ahora: ${nowLabel})`;
    },
  },
  {
    value: "light",
    Icon: Sun,
    getAriaLabel: () => "Tema claro",
  },
  {
    value: "dark",
    Icon: Moon,
    getAriaLabel: () => "Tema oscuro",
  },
];

const N = OPTIONS.length; // 3

interface ThemeIconToggleProps {
  value: ThemeValue;
  onChange: (value: ThemeValue) => void;
  disabled?: boolean;
  /** Modo efectivo resuelto — para el aria-label de "Sistema (ahora: claro/oscuro)". */
  resolvedTheme?: ResolvedTheme;
}

export function ThemeIconToggle({
  value,
  onChange,
  disabled = false,
  resolvedTheme,
}: ThemeIconToggleProps) {
  const selectedIndex = OPTIONS.findIndex((o) => o.value === value);

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onChange(OPTIONS[(index + 1) % N]!.value);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onChange(OPTIONS[(index - 1 + N) % N]!.value);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Modo de color"
      className="relative inline-flex rounded-pill p-[2px]"
      style={{ backgroundColor: "var(--panel-3)" }}
    >
      {/* Thumb deslizante — neutro, sin colores semánticos */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-[2px] bottom-[2px] rounded-pill bg-panel shadow-[var(--shadow-sm)]",
          "transition-[left,width] duration-[140ms] ease-out motion-reduce:transition-none",
        )}
        style={{
          left: `calc(${(selectedIndex / N) * 100}% + 2px)`,
          width: `calc(${100 / N}% - 4px)`,
        }}
      />
      {OPTIONS.map((option, i) => {
        const isSelected = option.value === value;
        const { Icon } = option;
        const ariaLabel = option.getAriaLabel(resolvedTheme);
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "relative z-10 flex h-[34px] w-[34px] items-center justify-center rounded-pill",
              "transition-colors duration-[140ms]",
              "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isSelected ? "text-ink" : "text-muted hover:text-ink-2",
            )}
          >
            <Icon size={16} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
