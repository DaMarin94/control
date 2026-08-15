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
  /**
   * Bajada de la línea informativa cuando `effects.length === 1` (docs/design.md
   * §"Panel de gestión de límites" → §4 "Subset de un solo efecto"). Ignorada
   * cuando hay más de un efecto en el subset (se renderiza el radiogroup).
   */
  singleEffectDescription?: string;
}

/**
 * Cuando el subset de la key tiene UN SOLO efecto válido (hoy:
 * `reporte.cat.gastoMesCategoria` → `ring`), un `radiogroup` de una sola opción
 * no es una elección — sugiere una libertad que no existe y obliga a un click
 * sin consecuencia. Se sirve como línea informativa: mismo preview vivo (nombre
 * del efecto + mark real sobre el dato de muestra) + una bajada que dice qué
 * forma toma la marca. No hay input, no hay `onChange`.
 */
function LimitEffectSingleInfo({
  effect,
  description,
}: {
  effect: LimitEffect;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-[8px]">
      <div className="flex items-center gap-[8px]">
        <span className="text-[13px] font-semibold text-ink">{EFFECT_NAMES[effect]}</span>
        <LimitEffectPreview effect={effect} />
      </div>
      {description && <p className="text-[12.5px] text-muted leading-snug">{description}</p>}
    </div>
  );
}

export function LimitEffectPicker({ effects, value, onChange, singleEffectDescription }: LimitEffectPickerProps) {
  if (effects.length === 1) {
    return <LimitEffectSingleInfo effect={effects[0]!} description={singleEffectDescription} />;
  }
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
