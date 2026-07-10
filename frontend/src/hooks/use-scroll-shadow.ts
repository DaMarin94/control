"use client";

/**
 * Affordance de corte para superficies con scroll horizontal interno
 * (docs/design.md §"Superficies con scroll interno" → "Regla transversal —
 * el scroll horizontal vive en la card…" → punto 3, "Affordance de 'hay
 * más'"). Usado por `unique-grid-card` y `cuotas-gantt-card`: ambas cards
 * envuelven su tabla/canvas ancho en un carril `overflow-x-auto` de 768–796px
 * mínimos que desborda en pantalla compacta.
 *
 * Calcula, vía listener de scroll (no CSS `mask`, que taparía las cifras
 * `mono` de las celdas/barras), si hay contenido oculto a la izquierda y/o
 * a la derecha del carril, para pintar el `box-shadow` de borde
 * correspondiente. Se re-evalúa en scroll, resize del carril (ResizeObserver)
 * y resize de ventana.
 */

import { useEffect, useState, type RefObject } from "react";

export interface ScrollShadowState {
  /** true = hay contenido oculto a la izquierda (ya se scrolleó). */
  showLeft: boolean;
  /** true = hay contenido oculto a la derecha (falta scrollear). */
  showRight: boolean;
}

const NONE: ScrollShadowState = { showLeft: false, showRight: false };

export function useScrollShadow(ref: RefObject<HTMLElement | null>): ScrollShadowState {
  const [state, setState] = useState<ScrollShadowState>(NONE);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function update() {
      if (!el) return;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const maxScroll = scrollWidth - clientWidth;
      // Tolerancia de 1px por redondeo de subpíxel.
      setState({
        showLeft: scrollLeft > 1,
        showRight: maxScroll > 1 && scrollLeft < maxScroll - 1,
      });
    }

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(el);
    }

    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      resizeObserver?.disconnect();
    };
  }, [ref]);

  return state;
}

// ─── Estilo del box-shadow de corte ────────────────────────────────────────

const SHADOW_COLOR_LIGHT = "oklch(0.18 0.02 270 / 0.18)";
const SHADOW_COLOR_DARK = "oklch(0 0 0 / 0.4)";

/**
 * `box-shadow` interior de borde derecho/izquierdo según qué lado tiene
 * contenido oculto. Valores del spec (docs/design.md): `inset -14px 0 12px
 * -12px <color>` (derecho) y su espejo `inset 14px 0 12px -12px <color>`
 * (izquierdo); ambos pueden convivir (se scrolleó parcialmente).
 */
export function getScrollShadowStyle(
  { showLeft, showRight }: ScrollShadowState,
  isDark: boolean,
): string | undefined {
  const color = isDark ? SHADOW_COLOR_DARK : SHADOW_COLOR_LIGHT;
  const shadows: string[] = [];
  if (showRight) shadows.push(`inset -14px 0 12px -12px ${color}`);
  if (showLeft) shadows.push(`inset 14px 0 12px -12px ${color}`);
  return shadows.length > 0 ? shadows.join(", ") : undefined;
}
