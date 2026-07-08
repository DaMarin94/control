"use client";

/**
 * LimitEffectPicker — grupo de option-cards para elegir el efecto visual de un
 * límite (docs/design.md §"Panel de gestión de límites" → 4. "Efecto — subset
 * por anclaje, default y preview").
 *
 * Consumidor puro del subset "effects"/"defaultEffect" del catálogo (§2 del
 * roadmap / lib/limits/catalog.ts) — NUNCA ofrece un efecto fuera del subset.
 * Cada card muestra su preview vivo con las primitivas reales de marca (mismos
 * tokens `warning` que se ven en /mes), para que list ↔ create hablen el mismo
 * idioma visual (misma <LimitEffectPreview> se usa en la fila de la lista).
 */

import { cn } from "@/lib/utils";
import type { LimitEffect } from "@/types/limit";
import {
  LimitGlyph,
  LimitBadge,
  limitBoldClass,
  limitTintClass,
  limitFillClass,
  limitRingInlineClass,
} from "@/components/limits/limit-mark";

const EFFECT_NAMES: Record<LimitEffect, string> = {
  bold: "Peso",
  tint: "Tinte",
  glyph: "Glifo",
  dot: "Punto",
  badge: "Badge",
  fill: "Fondo",
  ring: "Ring",
};

const SAMPLE_TOOLTIP = "Supera el límite: Gasto del mes > 300.000";
const SAMPLE_FIGURE = "$300.000";

/**
 * Preview vivo de UN efecto sobre un dato de muestra representativo (cifra
 * mono tabular). Se usa tanto en las option-cards del picker como en el
 * identificador de efecto de la fila de la lista (§2 del design) — mismo
 * idioma visual en ambos lugares.
 */
export function LimitEffectPreview({ effect }: { effect: LimitEffect }) {
  // "dot" no se ofrece hoy sobre ninguna key `mes.*` (solo reportes, Tramo 2),
  // pero se soporta acá para que el picker no rompa si el catálogo lo habilita.
  if (effect === "dot") {
    return (
      <span className="inline-flex items-center gap-[6px]">
        <span className="h-[6px] w-[6px] rounded-full bg-warning shrink-0" aria-hidden="true" />
        <span className="text-[13px] mono tabular-nums text-ink-2">{SAMPLE_FIGURE}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-[6px] rounded-[7px]",
        limitFillClass(effect) && "px-[6px] py-[2px]",
        limitRingInlineClass(effect),
      )}
    >
      {/* fill/ring nunca van solos — siempre acompañados de un glyph (a11y) */}
      {(effect === "glyph" || effect === "fill" || effect === "ring") && (
        <LimitGlyph tooltip={SAMPLE_TOOLTIP} size={13} />
      )}
      {effect === "badge" ? (
        <LimitBadge tooltip={SAMPLE_TOOLTIP} />
      ) : (
        <span
          className={cn(
            "text-[13px] mono tabular-nums text-ink-2",
            limitBoldClass(effect) ?? "font-semibold",
            limitTintClass(effect),
          )}
        >
          {SAMPLE_FIGURE}
        </span>
      )}
    </span>
  );
}

export interface LimitEffectPickerProps {
  /** Subset de efectos válidos para la key elegida (catálogo). */
  effects: LimitEffect[];
  value: LimitEffect;
  onChange: (effect: LimitEffect) => void;
}

export function LimitEffectPicker({ effects, value, onChange }: LimitEffectPickerProps) {
  return (
    <div role="radiogroup" aria-label="Efecto visual" className="grid grid-cols-2 gap-2">
      {effects.map((effect) => {
        const isSelected = effect === value;
        return (
          <button
            key={effect}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(effect)}
            className={cn(
              "flex flex-col items-start gap-[8px] rounded-ctl border bg-panel px-3 py-[10px] text-left",
              "transition-all duration-[140ms]",
              "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
              isSelected
                ? "border-accent shadow-[0_0_0_3px_var(--accent-soft)]"
                : "border-line hover:border-line-strong",
            )}
          >
            <span className="text-[13px] font-semibold text-ink">{EFFECT_NAMES[effect]}</span>
            <LimitEffectPreview effect={effect} />
          </button>
        );
      })}
    </div>
  );
}
