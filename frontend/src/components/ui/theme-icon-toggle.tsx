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

import { useEffect, useState } from "react";
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
  // `resolvedTheme` depende de matchMedia (solo cliente): en SSR siempre es
  // "light" y el cliente puede resolver "dark" → mismatch de hidratación en el
  // aria-label. Hasta montar se usa el label sin el "(ahora: …)".
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const labelTheme = mounted ? resolvedTheme : undefined;

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
      className="relative inline-flex rounded-pill p-0.5"
      style={{ backgroundColor: "var(--panel-3)" }}
    >
      {/* Thumb deslizante — neutro, sin colores semánticos */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-0.5 bottom-0.5 rounded-pill bg-panel shadow-(--shadow-sm)",
          "transition-[left,width] duration-140 ease-out motion-reduce:transition-none",
        )}
        style={{
          left: `calc(${(selectedIndex / N) * 100}% + 2px)`,
          width: `calc(${100 / N}% - 4px)`,
        }}
      />
      {OPTIONS.map((option, i) => {
        const isSelected = option.value === value;
        const { Icon } = option;
        const ariaLabel = option.getAriaLabel(labelTheme);
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
              "relative z-10 flex h-8.5 w-8.5 items-center justify-center rounded-pill",
              "transition-colors duration-140",
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
