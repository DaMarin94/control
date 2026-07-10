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
 *    Verificación en los dos regímenes:
 *      - anchoDeContenido ≥ 1204px (M ≥ 84px, "margen holgado"): offset =
 *        M − 84 > 0 → la flecha cae ENTERA en el margen exterior, con 20px
 *        de aire hasta el borde del bloque (64 + 20 = 84, exacto).
 *      - anchoDeContenido < 1204px (M < 84px, incluido TODO el rango
 *        941–1120px donde el bloque llena `<main>` y M = 0 exacto): la
 *        fórmula clampea a 0 → la flecha se pega al borde izquierdo/derecho
 *        del wrapper raíz (que es el borde de `<main>`), flotando sobre la
 *        banda de padding `px-10` (40px) del bloque. En el piso (M = 0) el
 *        botón (64px) avanza 24px más allá del borde del padding (64 − 40 =
 *        24), el solape ~24px descrito en el spec — consecuencia directa del
 *        clamp, sin necesidad de un caso especial. Nunca sale de `<main>`
 *        (invariante 3: ningún control queda fuera de pantalla).
 *
 *    Aparición — SIGUE gateada por el umbral `--bp-wide` (941px), medido con
 *    CONTAINER QUERY sobre `<main>` (`@wide:`/`@max-wide:`), no viewport (el
 *    <main> del shell autenticado es `@container`, ver app-shell.tsx). Con
 *    el sidebar abierto a viewport 1000px el contenido mide ~712px — si esto
 *    se midiera contra el viewport montaría las flechas en un hueco angosto
 *    y podría desbordar. Por debajo de 941px de contenido las flechas van
 *    `hidden`; el consumidor renderiza el stepper compacto en el header.
 *
 * Centrado vertical de las flechas al VIEWPORT (sin cambios de comportamiento
 * respecto de la versión anterior, solo de mecanismo de anidado):
 *  - Cada flecha vive en dos capas anidadas. La EXTERIOR es la que hace el
 *    overlay horizontal: `absolute inset-y-0` (estirada al alto del wrapper
 *    raíz, que a su vez mide el alto real del contenido, porque el wrapper
 *    raíz es `position:relative` con altura automática determinada por su
 *    único hijo en flujo normal — el bloque de contenido; las capas
 *    absolutas no aportan a esa altura). La INTERIOR es la que centra al
 *    viewport: `sticky top-0 h-screen flex items-center` — igual que en la
 *    versión de grid, el offset vertical lo resuelve `position:sticky` con
 *    una altura fija de 100vh, no `min-height`.
 *  - Por qué no hay scroll fantasma con listas cortas: la capa EXTERIOR es
 *    `position:absolute`, así que queda completamente fuera del cálculo de
 *    alto del documento (un elemento absolutamente posicionado nunca aporta
 *    al alto de su contenedor en flujo normal, sea cual sea el alto de sus
 *    propios hijos). El alto del documento lo define únicamente el bloque de
 *    contenido. Si la capa interior (100vh) es más alta que el contenido,
 *    simplemente desborda visualmente la capa exterior sin inflar el
 *    documento — a diferencia del modelo de grid anterior, acá no depende de
 *    cómo el motor de grid decide el alto de un track auto a partir de un
 *    ítem con `align-self` no-stretch (ambigüedad que el modelo de grid
 *    exigía razonar con cuidado); es una garantía estructural del modelo de
 *    caja: absolute nunca participa del alto en flujo normal del padre.
 *  - Caso de listas largas: el wrapper raíz mide el alto real del contenido
 *    (varios miles de px); la capa exterior (absolute, inset-y-0) se estira
 *    a esa altura; dentro, la capa sticky (100vh) tiene recorrido de sobra
 *    para permanecer anclada al centro del viewport mientras se scrollea.
 *  - Caso de listas cortas: el wrapper raíz mide poco alto (el del
 *    contenido corto); la capa exterior se estira a eso nomás; la capa
 *    sticky (100vh) la desborda visualmente pero no aporta alto al
 *    documento (ver arriba) → sin scroll fantasma, flecha centrada al
 *    viewport igual (no hay recorrido de scroll real para "destickear" antes
 *    de que se acabe la página, porque la página no llega a medir 100vh).
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

export function PeriodNav({
  children,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  canGoPrev = true,
  canGoNext = true,
}: PeriodNavProps) {
  return (
    // Wrapper raíz: 100% del ancho de <main>, sin padding propio — el
    // sistema de referencia de las flechas overlay (ver ARROW_OFFSET).
    // position:relative para que las flechas (absolute) se posicionen
    // respecto de este ancho, no del bloque de contenido ya capeado.
    <div className="relative">
      {/* ── Flecha anterior ‹ — overlay, oculta en compacto ─────────────── */}
      <div
        className="hidden @wide:flex absolute inset-y-0 w-16 items-center justify-center z-10"
        style={{ left: ARROW_OFFSET }}
      >
        {/* Capa de centrado vertical al viewport — ver docstring arriba */}
        <div className="sticky top-0 h-screen w-full flex items-center justify-center">
          <PeriodNavButton
            label={prevLabel}
            disabled={!canGoPrev}
            onClick={onPrev}
            side="prev"
          />
        </div>
      </div>

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

      {/* ── Flecha siguiente › — overlay, oculta en compacto ────────────── */}
      <div
        className="hidden @wide:flex absolute inset-y-0 w-16 items-center justify-center z-10"
        style={{ right: ARROW_OFFSET }}
      >
        <div className="sticky top-0 h-screen w-full flex items-center justify-center">
          <PeriodNavButton
            label={nextLabel}
            disabled={!canGoNext}
            onClick={onNext}
            side="next"
          />
        </div>
      </div>
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
       * El centrado al viewport lo maneja el div contenedor (sticky top-0
       * h-screen + flex items-center). El botón en sí no necesita
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
