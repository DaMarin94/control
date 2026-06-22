/**
 * Primitivas de skeleton — sistema unificado de estados de carga (Ola 1, P5).
 *
 * Spec visual: docs/design.md §"Skeletons — sistema unificado de estados de carga".
 *
 * Primitivas exportadas:
 *   - SkeletonLine   → línea de texto (alto = font-size real; radio --r-chip)
 *   - SkeletonBlock  → superficie rectangular (card, canvas, input, botón; radio --r-card por default)
 *   - SkeletonCircle → avatar / swatch circular (radio 50%)
 *   - SkeletonPill   → pill / stepper / segmented (radio --r-pill)
 *
 * Animación: pulse simple via animate-pulse + bg-panel-3 (Tailwind respeta prefers-reduced-motion).
 * Accesibilidad: los placeholders llevan aria-hidden="true"; el contenedor externo
 * (en el sitio de uso) debe llevar role="status" + aria-label descriptivo.
 */

import { cn } from "@/lib/utils";

// ─── SkeletonLine ──────────────────────────────────────────────────────────────

interface SkeletonLineProps {
  /** Alto en px — igual al font-size del texto real que reemplaza. */
  height: number;
  /** Ancho: string CSS (p.ej. "60%", "144px") o número en px. Default "100%". */
  width?: number | string;
  className?: string;
}

export function SkeletonLine({ height, width = "100%", className }: SkeletonLineProps) {
  const w = typeof width === "number" ? `${width}px` : width;
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse bg-panel-3 rounded-chip", className)}
      style={{ height, width: w }}
    />
  );
}

// ─── SkeletonBlock ─────────────────────────────────────────────────────────────

interface SkeletonBlockProps {
  /** Alto en px o string CSS. */
  height: number | string;
  /** Ancho en px o string CSS. Default "100%". */
  width?: number | string;
  /**
   * Radio del borde. Default "card" (--r-card 14px).
   * "ctl" = --r-ctl 10px (controles / botones / inputs).
   * "custom" = no aplica radio desde el token; usar className para el radio deseado.
   */
  radius?: "card" | "ctl" | "custom";
  className?: string;
}

export function SkeletonBlock({
  height,
  width = "100%",
  radius = "card",
  className,
}: SkeletonBlockProps) {
  const h = typeof height === "number" ? `${height}px` : height;
  const w = typeof width === "number" ? `${width}px` : width;
  const r =
    radius === "ctl"
      ? "var(--r-ctl)"
      : radius === "custom"
        ? undefined
        : "var(--r-card)";
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse bg-panel-3", className)}
      style={{ height: h, width: w, ...(r !== undefined ? { borderRadius: r } : {}) }}
    />
  );
}

// ─── SkeletonCircle ────────────────────────────────────────────────────────────

interface SkeletonCircleProps {
  /** Diámetro en px — igual al del círculo real. */
  diameter: number;
  className?: string;
}

export function SkeletonCircle({ diameter, className }: SkeletonCircleProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse bg-panel-3 shrink-0", className)}
      style={{ width: diameter, height: diameter, borderRadius: "50%" }}
    />
  );
}

// ─── SkeletonPill ──────────────────────────────────────────────────────────────

interface SkeletonPillProps {
  /** Alto en px — igual al del pill/stepper/segmented real. */
  height: number;
  /** Ancho en px o string CSS. */
  width: number | string;
  className?: string;
}

export function SkeletonPill({ height, width, className }: SkeletonPillProps) {
  const w = typeof width === "number" ? `${width}px` : width;
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse bg-panel-3 shrink-0", className)}
      style={{ height, width: w, borderRadius: "var(--r-pill)" }}
    />
  );
}
