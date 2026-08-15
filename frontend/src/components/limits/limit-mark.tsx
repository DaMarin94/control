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

/**
 * Render custom del `dot` de la banda de una categoría en modo Línea de
 * `by-category` (`reporte.cat.gastoMesCategoria`, anclaje "banda de un stack
 * apilado" — docs/design.md §"Marcas de límite en `by-category`" §3). A
 * diferencia de `renderSeriesPointMark` (genérico para `series-point`, subset
 * `dot`/`ring`), esta key **solo ofrece `ring`** — el vértice del borde
 * superior de la banda lleva SIEMPRE el anillo `--warning` 1.5px `r=5.5`, sin
 * importar `mark.effect`. Ignorar `mark.effect` a propósito cierra el Defecto B
 * bonus del spec: antes, un límite creado con `glyph`/`badge` (antes de que el
 * catálogo restringiera el subset a `ring`) caía al branch `dot` por defecto de
 * `renderSeriesPointMark` — divergencia del mismo defecto por otra puerta.
 */
export function renderCategoryBandLineMark(
  props: { cx?: number; cy?: number; index?: number },
  marks: (EvaluatedLimitMark | null)[] | undefined,
): ReactElement {
  const { cx, cy, index } = props;
  const mark = index !== undefined ? (marks?.[index] ?? null) : null;
  if (!mark || cx === undefined || cy === undefined) {
    return <g key={`cat-pt-${index}`} />;
  }
  return (
    <circle key={`cat-pt-${index}`} cx={cx} cy={cy} r={5.5} fill="none" stroke="var(--warning)" strokeWidth={1.5} />
  );
}

// ─── Cartucho de mes — eje X de `by-category` (P2 — Marcas de límite) ─────────

interface MonthCartoucheTickProps {
  // Recharts tipa `x`/`y` de un tick como `string | number` (XAxisTickContentProps)
  // aunque en runtime siempre llegan numéricas — se normalizan abajo con `Number()`.
  x?: number | string;
  y?: number | string;
  index?: number;
}

/**
 * Factory del `tick` custom del eje X de `by-category` (Barra y Línea) —
 * portador único de `reporte.cat.gastoMesTotal` ("columna de mes de un chart
 * apilado", sin elemento pintado propio) y del rescate de
 * `reporte.cat.gastoMesCategoria` cuando su banda no existe ese mes
 * (docs/design.md §"Marcas de límite en `by-category` — el cartucho de mes").
 *
 * **Cero-impacto (obligación del caller):** solo pasar el resultado de esta
 * factory como `tick` de `<XAxis>` cuando `marks.some(Boolean)` sea `true`. Si
 * el año no tiene ninguna marca, `<XAxis>` debe seguir usando el objeto de
 * estilo plano de siempre (`{fontSize:12, fontWeight:500, fill:"var(--muted)",
 * fontFamily:"var(--ui)"}`) — mismo DOM que antes de esta feature.
 *
 * Dentro de esta función, los meses SIN marca replican el `<text>`/`<tspan>`
 * que produce el tick default de Recharts para el mismo `(x, y)` (mismo
 * `textAnchor="middle"`, `dy="0.71em"` de un tick de una sola línea, `x`/`y` sin
 * transformar — ver `CartesianAxis`/`Text` de recharts): aunque el chart tenga
 * al menos una marca en el año, los meses vecinos sin marca se siguen leyendo
 * idénticos al tick de hoy.
 *
 * Los meses CON marca usan un `<foreignObject>` con las primitivas reales del
 * DS (`LimitGlyph`/`LimitBadge`, mismo molde que la marca de límite en el resto
 * de la app) en vez de reimplementar chip/glifo en SVG puro — el centrado del
 * cluster "glifo+rótulo" / "chip" en el tick lo resuelve flexbox
 * (`justify-content:center`), no un cálculo manual de ancho de texto.
 */
export function makeMonthCartoucheTick(
  marks: (EvaluatedLimitMark | null)[],
  monthLabels: readonly string[],
  isCompact: boolean,
) {
  return function MonthCartoucheTick({ x: xProp, y: yProp, index }: MonthCartoucheTickProps) {
    if (xProp === undefined || yProp === undefined || index === undefined) return null;
    const x = Number(xProp);
    const y = Number(yProp);
    const label = monthLabels[index] ?? "";
    const mark = marks[index] ?? null;

    if (!mark) {
      return (
        <text
          key={`cartouche-${index}`}
          x={x}
          y={y}
          textAnchor="middle"
          fill="var(--muted)"
          fontSize={12}
          fontWeight={500}
          fontFamily="var(--ui)"
        >
          <tspan x={x} dy="0.71em">
            {label}
          </tspan>
        </text>
      );
    }

    const tooltip = describeLimitMark(mark);
    // Ancho generoso del <foreignObject>: no fuerza layout del SVG (no reflowea
    // vecinos, docs/design.md §7 "el cartucho no fuerza ancho ni alto") — solo
    // acota el <div> flex que centra el cluster/chip sobre el tick.
    const width = isCompact ? 100 : 150;
    const height = 20;
    // El molde quiet (glifo+rótulo, sin chip) se sirve SIEMPRE en compacto
    // (<--bp-wide, docs/design.md §7) y para el efecto "glyph" en amplio.
    const isQuiet = isCompact || mark.effect === "glyph";

    // Clamp de borde (fix defecto QA — el cartucho no puede exceder el área de
    // trazado): el tick de un mes extremo (primero/último) está pegado al
    // borde del área de trazado, así que centrar el <foreignObject> de ancho
    // fijo en `x` deja la mitad afuera. En los extremos se alinea el borde
    // EXTERIOR del cartucho a `x` (el propio tick, siempre dentro del área de
    // trazado) en vez de centrarlo. No requiere conocer el ancho real del
    // área de trazado: alinear el borde exterior a un punto que YA está
    // garantizado adentro (el tick) es suficiente para que el cartucho entero
    // quede adentro.
    const isFirst = index === 0;
    const isLast = index === marks.length - 1;

    // Defecto de contención (QA visual, ancho de contenido ~660px): el clamp
    // de arriba SOLO cubría los dos extremos literales. Con `interval={0}` en
    // un eje de categorías, los ticks intermedios están espaciados LINEALMENTE
    // desde el borde izquierdo del área de trazado (`PLOT_LEFT_X`, ver abajo)
    // hasta el borde derecho — así que, en un carril angosto (régimen
    // compacto, donde el espaciado entre meses se achica), el mes ANTEPENÚLTIMO/
    // PENÚLTIMO (no el último) puede quedar lo bastante cerca del borde derecho
    // como para que su caja de ancho fijo (100/150px) exceda igual el área de
    // trazado — y como el `<foreignObject>` lleva `overflow: visible`, ese
    // excedente pinta fuera del `<svg>` y termina agrandando el
    // `document.scrollWidth` (invariante 1 de docs/design.md §Contención
    // responsive). El fix generaliza el mismo criterio ("no exceder el área
    // de trazado") a CUALQUIER mes intermedio, no solo a los dos extremos.
    //
    // Para eso hace falta el borde derecho real del área de trazado, que esta
    // función no recibe como prop — pero se puede DERIVAR del propio tick sin
    // plumbing adicional: en un eje de categorías con N ticks espaciados
    // linealmente desde `PLOT_LEFT_X` (índice 0) hasta el borde derecho
    // (índice N-1), el espaciado entre ticks consecutivos es
    // `(x - PLOT_LEFT_X) / index` para cualquier tick con `index >= 1`, y de
    // ahí el borde derecho es `x + (N-1-index) * espaciado`.
    //
    // `PLOT_LEFT_X = 64` es el borde izquierdo del área de trazado con la
    // config de eje de `Form2ChartInner`/`Form3ChartInner` (los dos únicos
    // callers de `resolveCartoucheTick`): `margin.left: 0` + `<YAxis
    // width={64}>`. Si alguna vez cambia esa config, este valor tiene que
    // actualizarse junto con ella.
    const PLOT_LEFT_X = 64;

    let boxX: number;
    let justifyContent: "flex-start" | "flex-end" | "center";
    if (isFirst) {
      boxX = x;
      justifyContent = "flex-start";
    } else if (isLast) {
      boxX = x - width;
      justifyContent = "flex-end";
    } else {
      const spacing = (x - PLOT_LEFT_X) / index;
      const plotRight = x + (marks.length - 1 - index) * spacing;
      const naturalBoxX = x - width / 2;
      if (naturalBoxX + width > plotRight) {
        // Igual que en el último mes: ancla el borde derecho de la caja al
        // borde derecho del área de trazado (nunca al tick — este mes NO es
        // el tick que vive en ese borde, así que anclar a `x` lo correría de
        // más).
        boxX = plotRight - width;
        justifyContent = "flex-end";
      } else if (naturalBoxX < PLOT_LEFT_X) {
        // Espejo del caso anterior para el borde izquierdo (no contribuye al
        // `document.scrollWidth` en LTR, pero es el mismo defecto visual: el
        // cartucho no puede exceder el área de trazado, sin importar el lado).
        boxX = PLOT_LEFT_X;
        justifyContent = "flex-start";
      } else {
        boxX = naturalBoxX;
        justifyContent = "center";
      }
    }

    // Segunda vuelta del fix anterior (QA): el <foreignObject> es una caja de
    // ancho fijo bastante más ancha que el chip/cluster que realmente se ve
    // dentro (flexbox solo la usa para centrar). El clamp de arriba mueve la
    // CAJA para que no se salga del área de trazado, pero si el contenido
    // sigue centrado dentro de esa caja desplazada, el chip visible se corre
    // hacia el centro del chart y termina pisando el rótulo del mes vecino.
    // La corrección es anclar el CONTENIDO al mismo borde por el que se
    // clampeó la caja en vez de centrarlo en ella — ya resuelto arriba junto
    // con `boxX` (mismo criterio para los extremos y para cualquier mes
    // intermedio clampeado). Los meses sin clamp (caja centrada en el tick)
    // siguen centrados, sin cambios.

    return (
      <foreignObject
        key={`cartouche-${index}`}
        x={boxX}
        y={y - 6}
        width={width}
        height={height}
        style={{ overflow: "visible" }}
      >
        <div
          role="img"
          aria-label={tooltip}
          title={tooltip}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent,
          }}
        >
          {isQuiet ? (
            <span className="inline-flex items-center gap-[4px]">
              <LimitGlyph tooltip={tooltip} size={isCompact ? 11 : 12} />
              <span style={{ fontFamily: "var(--ui)", fontSize: 12, fontWeight: 500, color: "var(--muted)" }}>
                {label}
              </span>
            </span>
          ) : (
            <LimitBadge
              tooltip={tooltip}
              label={label}
              className={mark.effect === "ring" ? "shadow-[0_0_0_1.5px_var(--warning)]" : undefined}
            />
          )}
        </div>
      </foreignObject>
    );
  };
}
