import { Maximize2 } from "lucide-react";

/**
 * ViewportGate — gate por debajo del ancho mínimo soportado (RF-APP-002).
 *
 * Por debajo del piso (`--breakpoint-floor`, ver globals.css) la app no es
 * usable: este gate cubre TODA la app (incluido login/registro, ver montaje
 * en el root layout) y la bloquea — no hay "continuar igual" ni forma de
 * saltearlo.
 *
 * CSS puro (decisión estructural, no cosmética — RF-APP-002 / docs/design.md
 * §Contención responsive): la aparición/desaparición se decide con una media
 * query sobre el ancho del viewport (variante `max-floor:`, generada a partir
 * de `--breakpoint-floor` en globals.css). Nada de listener de `resize`,
 * estado en JS ni chequeo de `window`: así, al cruzar el piso (rotar,
 * redimensionar), la app aparece o desaparece sin recargar y sin parpadeo de
 * hidratación.
 *
 * El bloqueo real (no solo visual) del resto de la app —incluidos los
 * portales de modal, que se montan como hijos directos de `document.body`
 * fuera del árbol de React de esta página— se logra en el root layout
 * (`app/layout.tsx`) con `visibility:hidden` + `overflow:hidden` en `<body>`
 * por debajo del piso: `visibility:hidden` se hereda a TODO el subárbol del
 * DOM (sin importar dónde se haya portado) y saca a esos elementos del orden
 * de foco de teclado. Este componente revierte esa herencia sobre sí mismo
 * (`max-floor:visible`) para ser lo único visible.
 */
export function ViewportGate() {
  return (
    <div
      className="fixed inset-0 hidden max-floor:visible max-floor:flex flex-col items-center justify-center overflow-y-auto bg-paper px-6 text-center"
    >
      <Maximize2 size={40} strokeWidth={1.5} className="mb-4 text-faint" aria-hidden="true" />
      <h1 className="text-[28px] font-bold tracking-[-0.02em] text-ink">
        Necesitás una pantalla más grande
      </h1>
      <p className="mt-2 max-w-[360px] text-[15px] leading-[1.5] text-muted">
        Control necesita más espacio para mostrarte tus movimientos con claridad. Agrandá la ventana o abrilo en una pantalla más grande.
      </p>
    </div>
  );
}
