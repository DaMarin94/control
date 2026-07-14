"use client";

/**
 * PeriodNav — Navegación de período con flechas gigantes laterales.
 *
 * Patrón genérico: ‹ [contenido] › donde las flechas ‹ › van al período
 * anterior / siguiente.
 *
 * Modelo vigente (fix banda muerta + fix angostamiento — docs/design.md
 * §"Ancho de contenido de página" → "Flechas ‹ › de PeriodNav — overlay, NO
 * gutters"). Reemplaza el modelo anterior de grilla de 3 columnas
 * (`auto min(calc(100% − 168px), 1120px) auto`), que estaba ROTO en dos
 * frentes medidos en el navegador:
 *   (a) las columnas laterales le restaban 168px al ancho disponible de la
 *       pista central → `/mes` quedaba 168px más angosto que las otras cinco
 *       pantallas al mismo viewport.
 *   (b) por debajo de cierto ancho la pista central colapsaba a ~0 (el grid
 *       no distribuía el espacio sobrante correctamente) y las stat-cards
 *       quedaban en slivers de ~40px.
 *
 * Estructura nueva — sin grid, dos piezas independientes:
 *
 * 1) ANCHO — el bloque de contenido usa el mecanismo CANÓNICO, el mismo que
 *    las otras cinco pantallas (`/`, `/categorias`, `/metodos-pago`,
 *    `/reportes`, `/configuracion`): `max-w-[1120px] mx-auto` (el `px-10` y
 *    el padding vertical los agrega el consumidor sobre `children`, igual
 *    que antes). Es un BLOQUE, no un track de grid: llena el disponible y
 *    recién capea al llegar a 1120px — nunca colapsa a `max-content` ni dejar
 *    banda muerta. Este bloque vive dentro de un wrapper raíz `relative` que
 *    ocupa el 100% del ancho de `<main>` (sin padding propio), que es el
 *    sistema de referencia que usan las flechas para calcular su offset.
 *
 * 2) FLECHAS — overlay `position:absolute` respecto del wrapper raíz (por lo
 *    tanto respecto del ancho de `<main>`, NO del bloque de contenido). NO
 *    reservan ancho de columna: su presencia no angosta ni empuja el bloque.
 *
 *    Offset horizontal — fórmula derivada del cap de 1120 (docs/design.md):
 *      M = margen exterior que queda una vez que el contenido capea a 1120
 *        = max((anchoDeContenido − 1120px) / 2, 0)
 *      offset = max(M − 84px, 0px)     // 84px = botón 64px + 20px de aire
 *    `offset` es simultáneamente el `left` de la flecha ‹ y el `right` de la
 *    flecha › (caso simétrico). Un único `max()` anidado la resuelve sin
 *    JS ni container query — es CSS puro, relativo al 100% del wrapper raíz
 *    (que mide exactamente el ancho de `<main>`, sin padding propio):
 *      offset = max(0px, calc((100% - 1120px) / 2 - 84px))
 *    La fórmula no cambia con el gate de visibilidad (ver "Aparición" abajo);
 *    solo importa su valor en el rango donde las flechas efectivamente se
 *    muestran, `anchoDeContenido ≥ 1288px` (`--bp-arrows`):
 *      - En 1288px exacto: M = 84px → offset = 0 → la flecha se pega al
 *        borde del wrapper raíz con EXACTAMENTE 20px de aire hasta el bloque
 *        de contenido (64 + 20 = 84, el umbral del que se deriva 1288).
 *      - Por encima de 1288px: M > 84px → offset = M − 84 > 0 → la flecha
 *        se despega más del borde, siempre con ≥20px de aire, sin invadir
 *        jamás el bloque ni la banda de padding `px-10`. Nunca sale de
 *        `<main>` (invariante 3: ningún control queda fuera de pantalla).
 *    Por debajo de 1288px la fórmula seguiría clampeando a 0 (la flecha se
 *    pegaría al borde de `<main>`, solapando la banda `px-10` del bloque) —
 *    pero ese tramo ya no se ve: el gate de visibilidad (abajo) oculta las
 *    flechas antes de llegar ahí.
 *
 *    Aparición — gateada por el umbral DERIVADO `--bp-arrows` (1288px),
 *    medido con CONTAINER QUERY sobre `<main>` (`@arrows:`/`@max-arrows:`),
 *    no viewport (el <main> del shell autenticado es `@container`, ver
 *    app-shell.tsx). 1288 = 1120 (cap del bloque de contenido) + 2×84 (botón
 *    64px + 20px de aire, por lado): el ancho al que la flecha entra ENTERA
 *    en el margen exterior sin solapar el listado. Convive con `--bp-wide`
 *    (941px), que sigue gobernando exclusivamente el colapso de grillas
 *    (stat-cards), no el régimen de `PeriodNav`. Con el sidebar abierto a
 *    viewport 1000px el contenido mide ~712px — si esto se midiera contra el
 *    viewport montaría las flechas en un hueco angosto y podría desbordar.
 *    Por debajo de 1288px de contenido las flechas van `hidden`; el
 *    consumidor renderiza el stepper compacto en el header (incluida la
 *    banda 941–1288, donde las grillas ya son multicolumna pero la
 *    navegación de período sigue siendo por stepper).
 *
 * Centrado vertical de las flechas al VIEWPORT — portal a `document.body`
 * (reemplaza el mecanismo `sticky top-0 h-screen` de la versión anterior,
 * roto por una regresión: `<main>` es `@container` — `container-type:
 * inline-size` — y eso implica `contain: layout`, que convierte a `<main>`
 * en el containing block de sus descendientes `position:fixed` (y, en la
 * práctica de los motores, también `position:sticky`). Con eso, ambos
 * mecanismos dejan de resolverse contra el viewport real y pasan a
 * comportarse como si fueran contenido del contenedor — las flechas
 * scrolleaban con la página en vez de quedar clavadas. No hay forma de
 * "escapar" un containing block impuesto por un ancestro solo con CSS en el
 * descendiente — la única salida es sacar el nodo del subárbol de `<main>`):
 *
 *  - Cada flecha sigue teniendo un ancla `absolute` dentro del wrapper raíz
 *    (mismo rol que antes: resuelve el offset horizontal — `left`/`right:
 *    ARROW_OFFSET` — vía CSS puro, gateada por `hidden @arrows:block` /
 *    oculta en compacto). Esa ancla ya NO renderiza el botón — es solo una
 *    sonda de medición invisible (`aria-hidden`, `pointer-events-none`, sin
 *    contenido).
 *  - Un hook (`useArrowGeometry`) mide, vía `getBoundingClientRect` +
 *    `ResizeObserver` + resize de ventana, (a) el ancho del wrapper raíz
 *    (mismo ancho de contenido que mide `@arrows:`/`@max-arrows:` — de ahí
 *    `BP_ARROWS = 1288`, espejo numérico en JS del token `--bp-arrows` /
 *    `--container-arrows`, porque un container query de CSS no es legible
 *    desde JS) para decidir si el régimen es amplio, y (b) el `left`
 *    resuelto del ancla (ya con `ARROW_OFFSET` aplicado por CSS) para
 *    plantar el botón en el mismo punto horizontal de siempre.
 *  - El botón real (`PeriodNavButton`) se monta vía `createPortal` a
 *    `document.body` — fuera del subárbol de `<main>`, así que su
 *    `position: fixed` sí resuelve contra el viewport real — con `top: 50%;
 *    transform: translateY(-50%)` para el centrado vertical y `left:
 *    <medido>px` para el horizontal. Gateado por un flag `mounted`
 *    (SSR-safe, mismo patrón que `ModalShell`) además de la visibilidad
 *    medida.
 *  - Medición 0 = "no confiable, conservar el último estado conocido" (en vez
 *    de forzar oculto): cubre tanto el frame inicial antes del primer layout
 *    real como jsdom en tests (no implementa layout — `getBoundingClientRect`
 *    devuelve siempre 0). El estado inicial es `visible: true`, así que las
 *    flechas nunca "parpadean" ocultas antes de la primera medición real.
 *  - Sin scroll fantasma con listas cortas (invariante preexistente): el
 *    botón vive en `document.body` vía `position: fixed`, que por
 *    definición nunca aporta alto al documento — más robusto que el
 *    mecanismo sticky anterior (que dependía de que la capa exterior fuera
 *    `absolute` para no inflar el alto del wrapper raíz).
 *
 * Props:
 *  - children: contenido de la columna central (el consumidor agrega su
 *    propio `px-10` y padding vertical; PeriodNav solo aporta `max-w-[1120px]
 *    mx-auto`).
 *  - prevLabel: aria-label del botón anterior (ej. "Mes anterior").
 *  - nextLabel: aria-label del botón siguiente (ej. "Mes siguiente").
 *  - onPrev: handler al ir al período anterior.
 *  - onNext: handler al ir al período siguiente.
 *  - canGoPrev: si el período anterior está disponible (false → disabled).
 *  - canGoNext: si el período siguiente está disponible (false → disabled).
 *
 * Reutilización (Fase 1.1.5): el mismo componente sirve para navegar año
 * pasando prevLabel="Año anterior", nextLabel="Año siguiente" y los flags
 * canGoPrev/canGoNext atados a earliestYear / año en curso.
 */

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PeriodNavProps {
  children: React.ReactNode;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
}

// Offset horizontal compartido por ambas flechas (ver derivación arriba):
// max(0px, (anchoDisponible − 1120px) / 2 − 84px). Relativo al 100% del
// wrapper raíz, que mide exactamente el ancho de <main> (sin padding
// propio) — por eso "100%" acá y no una container query unit.
const ARROW_OFFSET = "max(0px, calc((100% - 1120px) / 2 - 84px))";

// Espejo numérico del token `--bp-arrows` / `--container-arrows` (globals.css,
// 1288px) — un container query de CSS no es legible desde JS, así que la
// medición de régimen amplio/compacto del portal necesita su propia
// constante (ver docstring "Centrado vertical…" arriba). NO confundir con
// `--bp-wide` (941px), que gobierna solo el colapso de grillas y no el
// régimen de PeriodNav.
const BP_ARROWS = 1288;

interface ArrowGeometry {
  visible: boolean;
  /** `left` en px, viewport-relative — listo para `position:fixed`. */
  left: number;
}

/**
 * Mide, contra el wrapper raíz y el ancla de una flecha, si el régimen es
 * amplio y en qué `left` (viewport-relative) debe plantarse el botón
 * portado — ver docstring "Centrado vertical de las flechas al VIEWPORT"
 * arriba. Un ancho medido de 0 (frame inicial sin layout todavía, o jsdom en
 * tests, que no implementa layout) NO se toma como "oculto": se conserva el
 * último estado conocido (default `visible: true`).
 */
function useArrowGeometry(
  wrapperRef: RefObject<HTMLDivElement | null>,
  anchorRef: RefObject<HTMLDivElement | null>,
): ArrowGeometry {
  const [geometry, setGeometry] = useState<ArrowGeometry>({ visible: true, left: 0 });

  useEffect(() => {
    function update() {
      const wrapperEl = wrapperRef.current;
      const anchorEl = anchorRef.current;
      if (!wrapperEl || !anchorEl) return;

      const wrapperWidth = wrapperEl.getBoundingClientRect().width;
      if (wrapperWidth === 0) return;

      setGeometry(
        wrapperWidth >= BP_ARROWS
          ? { visible: true, left: anchorEl.getBoundingClientRect().left }
          : { visible: false, left: 0 },
      );
    }

    update();
    window.addEventListener("resize", update);

    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined" && wrapperRef.current) {
      resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(wrapperRef.current);
    }

    return () => {
      window.removeEventListener("resize", update);
      resizeObserver?.disconnect();
    };
  }, [wrapperRef, anchorRef]);

  return geometry;
}

export function PeriodNav({
  children,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  canGoPrev = true,
  canGoNext = true,
}: PeriodNavProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const prevAnchorRef = useRef<HTMLDivElement>(null);
  const nextAnchorRef = useRef<HTMLDivElement>(null);

  const prevGeometry = useArrowGeometry(wrapperRef, prevAnchorRef);
  const nextGeometry = useArrowGeometry(wrapperRef, nextAnchorRef);

  // Gate SSR-safe para el portal — mismo patrón que ModalShell (`document`
  // no existe en el pase de render del servidor).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    // Wrapper raíz: 100% del ancho de <main>, sin padding propio — el
    // sistema de referencia de las flechas overlay (ver ARROW_OFFSET) y de
    // la medición de régimen amplio/compacto (ver useArrowGeometry).
    // position:relative para que las anclas (absolute) se posicionen
    // respecto de este ancho, no del bloque de contenido ya capeado.
    <div ref={wrapperRef} className="relative">
      {/* ── Ancla anterior ‹ — sonda de medición, sin contenido visual ──── */}
      <div
        ref={prevAnchorRef}
        aria-hidden="true"
        className="hidden @arrows:block absolute inset-y-0 w-16 pointer-events-none"
        style={{ left: ARROW_OFFSET }}
      />

      {/* ── Bloque de contenido — mecanismo canónico ─────────────────────── */}
      {/*
       * max-w-[1120px] mx-auto: el mismo mecanismo que las otras cinco
       * pantallas. El px-10 y el padding vertical los aporta el consumidor
       * sobre `children` (no acá), igual que antes.
       * min-w-0: un hijo de bloque normal no lo necesita para no colapsar
       * (a diferencia de un ítem de grid/flex), pero se preserva por si
       * algún descendiente todavía asume un contexto flex/grid ancestro
       * para su propio truncado de texto.
       */}
      <div className="max-w-[1120px] mx-auto min-w-0">{children}</div>

      {/* ── Ancla siguiente › — sonda de medición, sin contenido visual ──── */}
      <div
        ref={nextAnchorRef}
        aria-hidden="true"
        className="hidden @arrows:block absolute inset-y-0 w-16 pointer-events-none"
        style={{ right: ARROW_OFFSET }}
      />

      {/* ── Flechas — portadas a document.body, ver docstring arriba ────── */}
      {mounted &&
        prevGeometry.visible &&
        createPortal(
          <div
            className="fixed z-10"
            style={{ left: prevGeometry.left, top: "50%", transform: "translateY(-50%)" }}
          >
            <PeriodNavButton
              label={prevLabel}
              disabled={!canGoPrev}
              onClick={onPrev}
              side="prev"
            />
          </div>,
          document.body,
        )}
      {mounted &&
        nextGeometry.visible &&
        createPortal(
          <div
            className="fixed z-10"
            style={{ left: nextGeometry.left, top: "50%", transform: "translateY(-50%)" }}
          >
            <PeriodNavButton
              label={nextLabel}
              disabled={!canGoNext}
              onClick={onNext}
              side="next"
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

// ─── Botón de flecha ──────────────────────────────────────────────────────────

interface PeriodNavButtonProps {
  label: string;
  disabled: boolean;
  onClick: () => void;
  side: "prev" | "next";
}

function PeriodNavButton({ label, disabled, onClick, side }: PeriodNavButtonProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-label={label}
      aria-disabled={disabled}
      /*
       * Tamaño único: 64×64px circular (spec 1.1.3 revisada).
       * Glifo: 46px, stroke-width 1.75 (ver ChevronLeft/Right abajo).
       *
       * El centrado al viewport lo maneja el wrapper portado a
       * document.body (position:fixed; top:50%; translateY(-50%) — ver
       * docstring del componente arriba). El botón en sí no necesita
       * posicionamiento propio.
       *
       * Estados:
       *  reposo:  glifo --faint, fondo transparente.
       *  hover:   glifo --ink, fondo circular --panel-2.
       *  active:  fondo --panel-3, glifo --ink.
       *  focus:   anillo --accent-soft (focus-visible).
       *  disabled: opacity 0.4, cursor default, sin hover.
       *
       * prefers-reduced-motion: sin transición (motion-reduce:transition-none).
       */
      className={[
        // Forma circular, centrado, tamaño único 64×64
        "flex items-center justify-center rounded-full",
        "w-16 h-16",
        // Transición de color (hover estándar DS 0.14s)
        "transition-colors duration-[140ms] motion-reduce:transition-none",
        // Glifo en reposo: --faint
        "text-faint",
        // Fondo en reposo: transparente (sin fill; es affordance "al aire")
        "bg-transparent",
        // Hover — solo cuando no está disabled
        !disabled && "hover:text-ink hover:bg-panel-2",
        // Active
        !disabled && "active:bg-panel-3 active:text-ink",
        // Focus visible — anillo DS
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
        // Disabled: opacidad, cursor, sin hover
        disabled ? "opacity-40 cursor-default" : "cursor-pointer",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {side === "prev" ? (
        <ChevronLeft
          aria-hidden="true"
          size={46}
          strokeWidth={1.75}
        />
      ) : (
        <ChevronRight
          aria-hidden="true"
          size={46}
          strokeWidth={1.75}
        />
      )}
    </button>
  );
}
