"use client";

/**
 * useVisualViewportInset — sigue el `window.visualViewport` para calcular
 * cuánto del viewport de layout queda tapado por el teclado virtual (u otro
 * widget interactivo) y lo publica como una CSS var (`--capture-keyboard-inset`)
 * en el elemento indicado.
 *
 * Por qué existe (docs/design.md §Superficie de captura → "3.
 * Teclado virtual abierto"; ver también el comentario de `viewport` en
 * app/layout.tsx): declaramos `interactive-widget: overlays-content` en el
 * viewport meta a propósito — el viewport de LAYOUT (y por lo tanto `dvh` y
 * cualquier media query de alto, incluido `--bp-short`) queda estable sin
 * importar el teclado. Eso evita que abrir el teclado dispare por error el
 * layout apaisado, pero como contrapartida el layout NO se encoge solo: hay
 * que empujar el footer manualmente por encima del teclado. Este hook hace
 * exactamente eso, y SOLO eso — no decide superficie ni dispara ningún
 * branching de dispositivo (ese es 100% CSS, ver globals.css).
 *
 * Solo lo consume `CaptureShell`. No pisa ninguna media query: es una
 * CSS custom property de INSTANCIA (seteada inline en el nodo, no en :root),
 * así que nunca compite con `--bp-short`.
 */
import { useEffect, useRef } from "react";

export function useVisualViewportInset<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const node = ref.current;
    if (!vv || !node) return;

    function update() {
      if (!vv || !node) return;
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      node.style.setProperty("--capture-keyboard-inset", `${inset}px`);
    }

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      node.style.removeProperty("--capture-keyboard-inset");
    };
  }, []);

  return ref;
}
