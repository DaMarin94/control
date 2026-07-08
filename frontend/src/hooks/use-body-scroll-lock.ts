"use client";

/**
 * Bloquea el scroll del body mientras haya al menos un modal/diálogo abierto
 * (contrato de shell, docs/design.md §"Overflow de modales y bloqueo del
 * fondo"). Ref-count a nivel de módulo: soporta apilamiento — si una
 * confirmación se abre sobre un modal ya abierto, el lock persiste hasta que
 * se cierra el último (no se libera cuando cierra el de encima).
 *
 * Sin salto de layout: la clase `body-scroll-locked` (globals.css) solo aplica
 * `overflow: hidden`; el espacio de la scrollbar del documento queda siempre
 * reservado vía `scrollbar-gutter: stable` en `html` (globals.css), así que
 * ocultar la barra al bloquear no corre el contenido de fondo.
 *
 * Uso: llamar `useBodyScrollLock()` sin condicionales, al tope de cualquier
 * componente de modal montado por portal, ANTES del guard `if (!mounted)
 * return null` (reglas de hooks) — el propio ciclo de mount/unmount del
 * componente (controlado por el padre que decide si el modal está abierto)
 * ya arma y libera el lock en el momento correcto.
 */

import { useEffect } from "react";

const LOCK_CLASS = "body-scroll-locked";

let lockCount = 0;

export function useBodyScrollLock(): void {
  useEffect(() => {
    lockCount += 1;
    document.body.classList.add(LOCK_CLASS);

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.classList.remove(LOCK_CLASS);
      }
    };
  }, []);
}
