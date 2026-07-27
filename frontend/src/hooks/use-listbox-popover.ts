"use client";

/**
 * Posicionamiento + comportamiento de cierre compartido por los listbox/popover
 * portaleados a `document.body` (docs/design.md §"Posicionamiento de popovers/
 * listbox por portal — flip vertical y comportamiento ante scroll"). Usado por
 * `PaymentMethodSelect`, `LimitCategorySelect` y `LimitAnchorPicker` (mismo
 * molde: disparador + panel listbox por portal). La referencia canónica del
 * cálculo de posición es `reportes/page.tsx` (`calcPosition`); este hook la
 * generaliza para paneles anclados al ancho del disparador (en vez de ancho
 * fijo) y le agrega el `maxHeight` clampeado.
 *
 * El panel hace flip vertical (abajo por defecto, arriba si no entra abajo)
 * para no abrirse fuera del viewport cerca del borde inferior, y el cierre
 * por scroll excluye el scroll interno del propio panel para que la lista
 * siga siendo scrolleable con la rueda.
 */

import { useState, useEffect, useCallback, type RefObject } from "react";

/** Separación entre disparador y panel. */
export const POPOVER_GAP = 6;
/** Respiro mínimo a cualquier borde del viewport. */
export const VIEWPORT_MARGIN = 12;

export interface ListboxPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

/**
 * Calcula la posición `fixed` de un listbox portaleado, anclado a
 * `triggerRef`, con flip vertical (abajo por defecto, arriba si no entra
 * abajo, y clamp + `maxHeight` recortado si no entra en ningún lado) y clamp
 * horizontal. `intrinsicMaxHeight` es el tope de alto del panel cuando hay
 * espacio de sobra (p. ej. 260px).
 *
 * Medición en dos pasadas: al abrir, primero se estima con
 * `intrinsicMaxHeight` (antes de que el panel pinte), y luego se recalcula
 * con el alto real (`panelRef.getBoundingClientRect().height`) una vez
 * montado, para que el flip no produzca un salto visible.
 */
export function useListboxPosition(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  intrinsicMaxHeight: number,
): ListboxPosition {
  const [pos, setPos] = useState<ListboxPosition>({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: intrinsicMaxHeight,
  });

  const calcPosition = useCallback(
    (panelHeight: number) => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;

      const espacioAbajo = vh - rect.bottom - VIEWPORT_MARGIN;
      const espacioArriba = rect.top - VIEWPORT_MARGIN;

      let top: number;
      let maxHeight = intrinsicMaxHeight;

      if (panelHeight + POPOVER_GAP <= espacioAbajo) {
        // Preferencia: abajo del disparador.
        top = rect.bottom + POPOVER_GAP;
      } else if (panelHeight + POPOVER_GAP <= espacioArriba) {
        // Flip: arriba del disparador.
        top = rect.top - panelHeight - POPOVER_GAP;
      } else {
        // No entra en ningún lado: lado con más espacio, clampeado; la lista
        // scrollea internamente (maxHeight recortado al espacio disponible).
        const espacioDisponible = Math.max(espacioArriba, espacioAbajo);
        maxHeight = Math.min(intrinsicMaxHeight, espacioDisponible - POPOVER_GAP - VIEWPORT_MARGIN);
        const topCandidate =
          espacioArriba > espacioAbajo
            ? rect.top - panelHeight - POPOVER_GAP
            : rect.bottom + POPOVER_GAP;
        top = Math.max(VIEWPORT_MARGIN, Math.min(topCandidate, vh - panelHeight - VIEWPORT_MARGIN));
      }

      const width = rect.width;
      const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, vw - width - VIEWPORT_MARGIN));

      setPos({ top, left, width, maxHeight });
    },
    [triggerRef, intrinsicMaxHeight],
  );

  // Primera pasada: estimado, antes de que el panel pinte (evita el salto).
  useEffect(() => {
    if (!open) return;
    calcPosition(intrinsicMaxHeight);
  }, [open, calcPosition, intrinsicMaxHeight]);

  // Segunda pasada: alto real del panel, una vez montado.
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const realHeight = panelRef.current.getBoundingClientRect().height;
    if (realHeight > 0) calcPosition(realHeight);
  }, [open, calcPosition, panelRef]);

  return pos;
}

/**
 * Cierre del listbox por clic afuera / `Esc` (con retorno de foco al
 * disparador) / scroll externo (captura, incluye el cuerpo de un modal) /
 * resize. El scroll **interno** del panel (`panelRef`) está exento del cierre:
 * el listener corre en captura sobre `window`, así que sin este guard también
 * dispararía al rodar la rueda sobre la propia lista, haciéndola imposible de
 * scrollear.
 */
export function useListboxDismiss(
  open: boolean,
  close: () => void,
  triggerRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return;

    function handleMouseDown(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      close();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    }

    function handleScrollClose(e: Event) {
      // Scroll originado dentro del panel (p. ej. rueda sobre la lista) no cierra.
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) {
        return;
      }
      close();
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollClose, { capture: true });
    window.addEventListener("resize", close);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollClose, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open, close, triggerRef, panelRef]);
}
