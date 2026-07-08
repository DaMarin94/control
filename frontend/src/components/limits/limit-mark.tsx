"use client";

/**
 * Primitivas de render de la marca visual pasiva de límites (P2 — Fase 1).
 *
 * Implementa el vocabulario de 7 efectos de docs/design.md §"Marca visual
 * pasiva de límites" → "Vocabulario de efectos (primitivas)". Cada primitiva
 * reusa un molde ya vigente del DS (glifo de la zona de estados, badge
 * "Anulado", color de texto, box-shadow del focus ring) — sin cromo nuevo.
 *
 * Todo nodo/clase de acá se renderiza SOLO cuando `evaluateLimits` devolvió una
 * marca (nunca incondicionalmente) — es lo que garantiza el "cero impacto" con
 * `limits: []` (docs/design.md, restricción rectora).
 *
 * `glyph`/`badge` son nodos ADITIVOS (para slots que ya colapsan). `bold`/`tint`/
 * `fill`/`ring` son swaps de clase/estilo sobre el elemento existente — los
 * helpers de abajo devuelven la clase/valor a aplicar condicionalmente, el
 * caller decide dónde.
 */

import type { ReactElement } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LimitEffect } from "@/types/limit";
import { describeLimitMark, type EvaluatedLimitMark } from "@/lib/limits/evaluate";

// ─── Nodos aditivos ─────────────────────────────────────────────────────────────

interface LimitGlyphProps {
  /** Texto accesible — enumera los límites cruzados (describeLimitMark). */
  tooltip: string;
  size?: number;
  className?: string;
}

/** Efecto `glyph` — AlertTriangle ámbar, mismo molde que GitBranch/Zap de la zona de estados. */
export function LimitGlyph({ tooltip, size = 13, className }: LimitGlyphProps) {
  return (
    <span
      className={cn("inline-flex shrink-0 text-warning-ink", className)}
      aria-label={tooltip}
      title={tooltip}
    >
      <AlertTriangle size={size} aria-hidden="true" />
    </span>
  );
}

interface LimitBadgeProps {
  /** Texto accesible — enumera los límites cruzados (describeLimitMark). */
  tooltip: string;
  /** Label corto visible en el chip (default "Límite"). */
  label?: string;
  className?: string;
}

/** Efecto `badge` — chip ámbar, mismo molde que el badge "Anulado" recoloreado. */
export function LimitBadge({ tooltip, label = "Límite", className }: LimitBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-[4px] rounded-[var(--r-chip)]",
        "bg-warning-soft text-warning-ink px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em]",
        className,
      )}
      aria-label={tooltip}
      title={tooltip}
    >
      <AlertTriangle size={11} aria-hidden="true" />
      {label}
    </span>
  );
}

// ─── Swaps de clase / estilo ────────────────────────────────────────────────────

/** Efecto `bold` — sube el peso tipográfico de la cifra (neutro, sin hue). */
export function limitBoldClass(effect: LimitEffect | null | undefined): string | undefined {
  return effect === "bold" ? "font-bold" : undefined;
}

/**
 * Efecto `tint` — tiñe la cifra en `--warning-ink`. SOLO ofrecido por el catálogo
 * sobre keys cuya cifra se renderiza neutra (ver docs/lib/limits/catalog.ts) —
 * nunca se ofrece para montos tipados (income/expense).
 */
export function limitTintClass(effect: LimitEffect | null | undefined): string | undefined {
  return effect === "tint" ? "text-warning-ink" : undefined;
}

/**
 * Efecto `fill` — fondo tenue ámbar. Nunca va solo (a11y): el caller SIEMPRE
 * combina esta clase con un <LimitGlyph> o <LimitBadge> adyacente.
 */
export function limitFillClass(effect: LimitEffect | null | undefined): string | undefined {
  return effect === "fill" ? "bg-warning-soft" : undefined;
}

/**
 * Efecto `ring` — anillo ámbar 1.5px vía box-shadow (mecanismo del focus ring,
 * no reflowea), para envolver un BLOQUE de tarjeta (ej. la card de total del
 * mes) que ya trae `shadow-[var(--shadow-sm)]`. Compone ambas sombras en una
 * sola clase arbitraria (mismo patrón que el inset-highlight de Button)
 * — twMerge la deduplica contra la clase `shadow-[var(--shadow-sm)]` base.
 * Nunca va solo (a11y): el caller SIEMPRE combina con un <LimitGlyph>/<LimitBadge>.
 */
export function limitRingCardClass(
  effect: LimitEffect | null | undefined,
  baseShadowVar: "--shadow-sm" | "--shadow-md" = "--shadow-sm",
): string | undefined {
  return effect === "ring" ? `shadow-[0_0_0_1.5px_var(--warning),var(${baseShadowVar})]` : undefined;
}

/**
 * Efecto `ring` para envolver un fragmento de TEXTO inline (ej. el subtotal de
 * una sección, que no es un bloque de tarjeta) — mismo anillo, con un pequeño
 * padding para que no quede pegado al glifo/número.
 */
export function limitRingInlineClass(effect: LimitEffect | null | undefined): string | undefined {
  return effect === "ring"
    ? "rounded-[var(--r-chip)] shadow-[0_0_0_1.5px_var(--warning)] px-[5px]"
    : undefined;
}

interface LimitMarkAdornerProps {
  mark: EvaluatedLimitMark | null | undefined;
  /** Tamaño del glyph cuando el efecto ganador es "glyph"/"ring" (ring exige compañía de glyph). */
  glyphSize?: number;
}

/**
 * Nodo adorno para anclajes de tipo "total/subtotal de mes": renderiza el
 * badge o el glyph de compañía según el efecto ganador. `bold`/`tint` NO
 * producen nodo — son swaps de clase que el caller aplica sobre la propia
 * cifra vía `limitBoldClass`/`limitTintClass`. null si no hay marca.
 */
export function LimitMarkAdorner({ mark, glyphSize = 14 }: LimitMarkAdornerProps) {
  if (!mark) return null;
  const tooltip = describeLimitMark(mark);
  if (mark.effect === "badge") return <LimitBadge tooltip={tooltip} />;
  if (mark.effect === "glyph" || mark.effect === "ring") {
    return <LimitGlyph tooltip={tooltip} size={glyphSize} />;
  }
  return null;
}

// ─── Marcador de punto de serie en charts Recharts (P2 — Tramo 2) ──────────────

/**
 * Render custom del `dot` de un `<Area>`/`<Line>` de Recharts — devuelve un
 * marcador SVG ámbar cuando el punto (mes) tiene una marca de límite, o un
 * `<g/>` vacío (cero impacto) cuando no. Anclaje tipo "series-point"
 * (docs/design.md): efectos válidos `dot`/`ring`. El texto accesible vive en
 * el tooltip del chart (portador de a11y), no en el marcador — un nodo SVG
 * suelto no porta aria.
 *
 * Reusado por `report-card.tsx` (income-expense) e `inflation-income-card.tsx`
 * (las 3 series) — mismo mecanismo, un solo lugar.
 *
 * Gotcha (docs/frontend.md): el tipo de `dot` en Recharts 3.x es `boolean`,
 * aunque en runtime acepta una función de render — cast `as unknown as boolean`
 * en el caller.
 */
export function renderSeriesPointMark(
  props: { cx?: number; cy?: number; index?: number },
  marks: (EvaluatedLimitMark | null)[] | undefined,
): ReactElement {
  const { cx, cy, index } = props;
  const mark = index !== undefined ? (marks?.[index] ?? null) : null;
  if (!mark || cx === undefined || cy === undefined) {
    return <g key={`pt-${index}`} />;
  }
  if (mark.effect === "ring") {
    return (
      <circle key={`pt-${index}`} cx={cx} cy={cy} r={5.5} fill="none" stroke="var(--warning)" strokeWidth={1.75} />
    );
  }
  // default: "dot"
  return (
    <circle key={`pt-${index}`} cx={cx} cy={cy} r={4} fill="var(--warning)" stroke="var(--panel)" strokeWidth={1.5} />
  );
}
