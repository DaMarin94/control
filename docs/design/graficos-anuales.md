# Cards anuales — Únicos (grilla), Cuotas (gantt), Inflación vs Ingresos (líneas)

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Encuadre común de card (cabecera, título editable, modo orden, moneda, refrescar, `AddCardMenu`): `card-grafico.md`. Leyenda-filtro y formas de gráfico: `graficos.md`. Contención de grillas anchas: `scroll-interno.md`. Pertenece al grupo *Patrones de componentes vigentes*.

### Reporte anual de Únicos — grilla día × mes

Tipo de card de reporte `unique-grid`, espejo de encuadre de las cards `income-expense` / `by-category`: misma caja (`bg-panel`, `border border-line`, `--r-card` 14px, `p-[var(--card-pad)]`, `--shadow-sm`), misma cabecera (título editable + barra de controles derecha), mismo modo orden, mismos estados de carga/vacío/error. Lo que cambia es el **canvas**: no es un chart de Recharts sino una **grilla tipo planilla** (heatmap calendario) de **días del mes (filas) × 12 meses (columnas)**, con un **footer de métricas por mes**. Encaja como una card más en la única columna de `/reportes` (1120px, `--gap` 18px) y en el `[+]`/`AddCardMenu`. **No inventa cromo nuevo**: reusa tokens, escala tipográfica, mono tabular, semánticos y el lenguaje de selectores de la cabecera.

> **Reglas duras reafirmadas para esta grilla.** (1) Cada celda es una **cifra de dinero** → su tinte de heatmap **no** es income/expense ni índigo: es una **rampa propia de intensidad de gasto diario** (definida abajo), que **no comunica ingreso/gasto** (acá todo es gasto: Únicos) sino *magnitud*. La regla dura 1 (verde=ingreso/rojo=gasto) **no aplica al tinte de celda**: el verde del piso de la rampa **no** significa "ingreso", significa "gasto bajo"; por eso esta rampa es un **lenguaje aparte, documentado y acotado a esta grilla**. (2) Todo monto (celda, footer) va en **mono tabular** (`tnum`), regla dura 3. (3) El **índigo** aparece **solo** como cromo de interacción (focus ring, hover de selección), nunca tiñendo cifras (regla dura 2).

#### 1. Librería — decisión cerrada: NO Recharts. Grilla nativa CSS Grid + tabla semántica.

Esta vista **no** se construye con Recharts (ni el wrapper `chart.tsx`). Una **matriz densa de ~31×12 celdas con valor + color + footer de agregados por columna** es una **planilla**, no un gráfico de series — forzarla en Recharts daría peor control de layout, peor accesibilidad y peor densidad.

- **Primitivo:** **CSS Grid nativo** dentro de una **tabla semántica** (`<table>` con `<thead>` de meses, `<tbody>` de días, `<tfoot>` de métricas) — o un contenedor `role="table"` equivalente; **el front elige el andamiaje, pero la semántica de tabla (header de columna = mes, header de fila = día) es obligatoria** para a11y ("fila 14, columna Marzo, $X"). No se monta ningún `ResponsiveContainer` ni `<svg>` de charting.
- **Por qué no Recharts:** (a) el heatmap-calendario es una grilla de celdas discretas, no un trazo continuo; (b) los **agregados por columna** son nativos de una tabla; (c) evitamos montar 12 mini-ejes; (d) el control fino de tamaño de celda, gridlines y truncado se hace mejor con CSS Grid. Las cards `income-expense`/`by-category` **siguen** en Recharts; conviven dos motores de visualización según la forma.
- **Sin dependencia nueva.** CSS Grid + tabla del propio DS. (En v1 son 372 celdas máximo; no necesita virtualización.)

#### 2. Layout de la grilla

Estructura del canvas, de arriba a abajo: **header de meses (fila sticky)** → **cuerpo de 31 filas de día** → **footer de métricas por mes**. A la izquierda, una **columna fija de días** (1–31).

- **Geometría:** **13 columnas** = 1 columna de rótulo de día (~28px) + 12 columnas de mes (`1fr` cada una, mínimo legible ~64px). **32 filas** de cuerpo = 1 header de meses + 31 de día. La grilla **no scrollea internamente en desktop**: a 1120px de card entran cómodos. En `≤940px` la card permite **scroll horizontal** del bloque de grilla (overflow-x), manteniendo la **columna de día sticky a la izquierda** y el **header de meses sticky arriba**.
- **Header de meses (`<thead>`):** nombre corto es-AR (`Ene Feb … Dic`), **UI 12px/600 `--muted`**, centrado, sin rotar. Fondo `--panel` con borde inferior `--line` 1px; **sticky** al hacer scroll vertical. La celda esquina va vacía.
- **Columna de días (`<th scope="row">`):** número de día **mono tabular 11px `--muted`** (`tnum`), alineado a la **derecha**, con `pr-[6px]`. Fondo `--panel`, borde derecho `--hair` 1px; **sticky** a la izquierda en scroll horizontal.
- **Celdas de día (cuerpo):** **alto de fila objetivo ~18–20px** (31 filas × ~19px ≈ 590px de cuerpo). **Gap entre celdas: 2px** (hairline de fondo `--panel`/`--paper`) para que el heatmap se lea como mosaico de fichas. Cada celda lleva su **tinte de heatmap** (§3) y el **monto del día** en **mono tabular 10.5px** (`tnum`), centrado, color de texto por contraste contra el tinte (§3). **La cifra en celda va abreviada** (`$0` · `$8` · `$13` · `$1,2k`), mismo criterio que el eje Y de los charts, y la **cifra completa** vive en el **tooltip** de la celda.
- **Días inexistentes (30/31 en meses cortos, 29/30/31 en febrero):** **celda nula** con fondo `--panel-2`, **sin tinte de heatmap, sin número, sin tooltip**. Se distingue de un día con `$0` (que existe y lleva tinte de piso + "$0"). La silueta de cada mes se lee de un vistazo. `aria`: la celda nula es `aria-hidden` o con `aria-label="—"`; no participa de la navegación de datos.

#### 3. Escala de color — rampa de intensidad de gasto diario (verde → rojo, anclada en 15 USD de poder adquisitivo)

Rampa **propia de esta grilla** (no es el semántico income/expense): mapea el **total de gasto del día** a un color de **verde (gasto bajo)** a **rojo (gasto alto)**, anclada en el rango **0 → ancla**, donde el **ancla = el equivalente de 15 USD de poder adquisitivo, reconvertido a la moneda de display de la card** (TC del **año del reporte**), o el techo editado por el usuario (§9).

- **Anclaje:** `t = clamp(totalDía / ancla, 0, 1)`. `t=0` → piso (verde); `t=1` → tope (rojo). **Todo total ≥ ancla = color máximo**. El backend entrega el ancla **ya reconvertida a la moneda de display** (en centavos) y el front la usa tal cual, nunca un valor hardcodeado — ver §6. Anclar en **poder adquisitivo** hace que el gradiente sea **igual de significativo en cualquier moneda** (15 unidades de ARS saturarían casi todo en rojo).
- **Stops de la rampa (4 paradas, interpolación en oklch por luminosidad+hue):**

  | Punto | `t` | Token / valor (claro) | Lectura |
  |---|---|---|---|
  | Piso (≈$0–$1) | 0.00 | `oklch(0.94 0.05 150)` (verde muy claro) | día barato |
  | Bajo-medio | 0.33 | `oklch(0.90 0.10 110)` (verde-lima) | — |
  | Medio-alto | 0.66 | `oklch(0.88 0.13 70)` (ámbar) | — |
  | Tope (≥ ancla) | 1.00 | `oklch(0.78 0.16 30)` (rojo-coral) | día caro |

  Interpolación **continua** entre stops (no escalonada). Son **tintes de fondo de celda** (luminosidad alta); **no** son los tokens `--income`/`--expense` — esta rampa recorre el arco verde→ámbar→rojo a **luminosidad de superficie**, deliberadamente distinta para que no se lea como "ingreso vs gasto".
- **Celda con `$0` de gasto (día existe, sin gasto):** `t=0` → tinte **piso verde claro** + texto "$0" en `--muted`. **No** se deja en blanco: un día de $0 es información.
- **Texto del monto por contraste (independiente del modo):** se calcula por **contraste contra el tinte de la celda**, igual criterio que el texto sobre chip de categoría (`fundamentos.md` *Categorías y gráficos en oscuro*). Tintes claros → texto **oscuro** (`oklch(0.25 0.02 270)`); tope rojo → texto que mantenga contraste (lo resuelve el cálculo de contraste).
- **Rampa en modo oscuro:** los **stops bajan de luminosidad** (mismos hue): piso `oklch(0.32 0.05 150)`, bajo-medio `oklch(0.36 0.09 110)`, medio-alto `oklch(0.40 0.12 70)`, tope `oklch(0.45 0.15 30)`. Arco de hue y anclaje **idénticos**. En oscuro los tintes son más oscuros → texto **claro**. El gap-hairline de 2px se lee como separador; no hace falta contorno extra.
- **Por qué esta rampa y no income/expense:** usar `--expense` para "día caro" y `--income` para "día barato" **rompería la regla dura 1**. El verde acá = "poco gasto", nunca "ingreso".

#### 4. Footer de métricas por mes

Debajo del cuerpo, un **`<tfoot>`** con **una celda por columna de mes** que apila las **5 métricas**, en orden de jerarquía. Fondo `--panel-2`, borde superior `--line` 1px. Las métricas van **apiladas en filas, no inline**, con rótulos mínimos a la izquierda y cifra a la derecha.

- **Jerarquía (de mayor a menor peso visual):**
  1. **Total del mes** — **mono tabular 12px/600 `--ink`** (`tnum`), abreviada igual que las celdas (`$1,2k`), completa en tooltip. Sin color semántico.
  2. **Promedio por día** — **mono 10.5px/500 `--ink-2`**, micro-rótulo `prom` en `--faint` 9px uppercase tracking.
  3. **%dif vs mes anterior** — **mono 10.5px/600 `--ink-2`** (color **neutro**), con **glifo de dirección** (↑/↓). Micro-rótulo `vs ant`.
  4. **Puntos de inflación del mes** — **mono 10.5px/500 `--ink-2`**, sufijo `pts` o `%` según el contrato; micro-rótulo `infl`. **Color neutro**, **nunca** verde/rojo.
  5. **%dif ajustado por inflación** — **mono 10.5px/600 `--ink-2`**, mismo tratamiento de dirección-por-glifo que (3); micro-rótulo `vs ant real` (o `real`).
- **Formato del %dif (métricas 3 y 5) — NEUTRO + glifo de dirección, NO color por dirección (decisión cerrada del usuario):** el número va en **`--ink-2`**, sin tinte `--expense-ink`/`--income-ink`. La dirección se comunica **solo con un glifo discreto** que precede a la cifra. El usuario prefiere un footer **tranquilo** donde la dirección se lea por la forma del glifo, no por el color.
  - **Glifo de dirección:** **`ArrowUp` / `ArrowDown` (lucide)**, **9px**, `stroke-width 2.5`, color **`--ink-2`** (el mismo que la cifra), `aria-hidden`. **Inmediatamente a la izquierda del número**, `gap 2px`, alineado a la baseline. Fallback aceptado: signo **`+` / `−`** (`U+2212`) en el mismo `--ink-2`/9px; el **default es la flechita**. Siempre **monocromo `--ink-2`**.
  - **Dif positivo:** `↑12,40%`. **Dif negativo:** `↓8,10%`. Todo en `--ink-2`.
  - **Dif cero / sin mes anterior:** `—` en `--muted`, **sin glifo**.
  - El número del %dif va **siempre en mono tabular**, separador decimal coma es-AR, 2 decimales (`ROUNDDOWN` a 2).
- **Micro-rótulos:** `prom` / `vs ant` / `infl` / `real` en **`--faint` 9px/600 uppercase `tracking-[0.08em]`**, a la izquierda de cada cifra; el **total** no lleva rótulo. Si el ancho de mes no alcanza para rótulo+cifra inline, el rótulo va **encima** de la cifra.
- **Tooltip de footer:** hover sobre la celda de footer abre el **tooltip custom del DS** (no el `title` nativo) con las 5 métricas **completas y rotuladas** (§4b).

#### 4b. Tooltip rico del footer (reemplaza el `title` nativo)

Mismo **tooltip custom portaled a `body`** que las celdas diarias (§8). Hover sobre la celda de footer → aparece anclado encima de la celda, `pointer-events-none`, `role="tooltip"`. No se usa `title` nativo.

- **Caja (idéntica al tooltip de celda):** `fixed z-50`, `rounded-ctl`, `border border-line`, `bg-panel`, `shadow-[var(--shadow-lg)]`, padding `px-[10px] py-[8px]`, anclada `translate(-50%, -100%)`. **No** se reusa `ChartTooltipContent` tal cual (este tooltip es **label ⟷ valor** sin swatch) pero hereda la **misma caja**. `min-width` ~`190px`.
- **Encabezado:** **nombre del mes completo es-AR + año** (`Marzo 2026`), **UI 12px/600 `--ink-2`**, `mb-[6px]`.
- **Cuerpo — 5 filas `label ⟷ valor`** (`flex flex-col gap-[5px]`), en el orden del footer:
  1. **Total** — label `Total`; valor **completo sin abreviar** (`$1.234,56`), **mono `tnum` 12px/600 `--ink`**.
  2. **Promedio diario** — label `Promedio diario`; mono `tnum` 11px/500 `--ink-2`.
  3. **% dif vs mes anterior** — label `vs. mes anterior`; mono `tnum` 11px/600 **`--ink-2`** con el **glifo de dirección** `↑`/`↓` (9px, `stroke-width 2.5`, `--ink-2`, `aria-hidden`) a la izquierda, `gap 2px`. `↑12,40%` / `↓8,10%`.
  4. **Inflación** — label `Inflación`; mono `tnum` 11px/500 `--ink-2`, sufijo `pts`. Neutro.
  5. **% dif ajustado por inflación** — label `vs. anterior (real)`; mono `tnum` 11px/600 `--ink-2` con el mismo glifo.
- **Layout de cada fila:** label a la **izquierda** en **UI 11.5px/500 `--ink-2`** (`flex-1`, truncate si hiciera falta), valor a la **derecha** (mono, `shrink-0`); `gap` ~`16px`.
- **Nulls (`—`):** cualquier métrica `null` muestra **`—` en `--muted`**, sin glifo. La fila no desaparece: el tooltip siempre lista las 5 métricas en orden fijo. El total **nunca** es null (un mes sin gasto es `$0`).
- **Separador opcional:** divisor `1px --hair` (`my-[7px]`) **entre el Total y las 4 métricas derivadas**; si se monta, solo en esa junta.
- **Coherencia con el tooltip de celda:** misma caja, portal, anclaje, registro tipográfico de encabezado y glifo de dirección neutro.

#### 5. Selectores de la cabecera — año + filtro de categorías

La cabecera de `unique-grid` sigue el **molde de una sola fila** (`flex justify-between`: título editable izquierda ⟷ barra de controles derecha), porque esta card **no tiene `ViewTabs`**. Barra de controles derecha: `[ YearStepper ] [ divisor --hair ] [ CardCurrencyTrigger ] [ ColorAnchorTrigger ] [ divisor --hair ] [ RefreshCw ] [ X ]` (ver §9 y `card-grafico.md`). El **YearStepper** sigue RF-REP-002, *Límites de navegación de año*.

- **Filtro de categorías:** esta grilla **no tiene leyenda de series/categorías** (el color es magnitud). El filtro se monta como una **fila de chips-toggle de categoría DEBAJO del footer** (mismo `ChartLegend` scrollable + `LegendAllChip` "Todas/Ninguna" que usa `by-category`), separada por `margin-top` 14px. Cada chip es un toggle `aria-pressed`; toggle off → esa categoría no suma al total diario de ninguna celda ni al footer; totales y heatmap se recalculan. **Universo = `availableCategories`** del contrato. **Un solo lenguaje de filtro de categorías** en toda la card de reporte: chips-toggle, no popover.
  - **Por qué debajo y no como leyenda lateral:** la grilla ocupa el ancho completo; los chips son un **control de filtro**, no una leyenda de color de la grilla.

#### 6. Moneda de la card y el ancla (15 USD reconvertido)

La card respeta **moneda por reporte**: el `CardCurrencyTrigger` cambia la moneda de display, y **todas** las cifras reflowean. El backend entrega los totales diarios ya convertidos (`?currency=`) **y el ancla ya reconvertida** (`colorAnchorCents`, centavos de la moneda de display); el front mapea `t = clamp(total / ancla, 0, 1)` con el ancla que recibe — **nunca un valor hardcodeado**. El front **no** calcula la reconversión.

#### 7. Estados

- **Loading (skeleton):** cabecera presente; el canvas se reemplaza por un **bloque del alto de la grilla** (`SkeletonBlock`, ver `skeletons.md`) — **no** se dibuja la cuadrícula fantasma celda por celda; un bloque alto + una franja de footer fantasma + 2–3 chips fantasma de filtro. Sin spinner.
- **Empty (sin gastos Únicos en el año):** la **grilla se dibuja completa** (días en piso verde/`$0`, celdas nulas en gris) + **overlay centrado** "Sin gastos únicos en {año}." (UI 14px `--muted`). El footer muestra totales en `$0` y %dif en `—`.
- **Error:** `AlertTriangle` 20px `--warning-ink` + "No se pudo cargar el reporte." + botón ghost "Reintentar", centrado, sin tinte de error.
- **Modo orden / mini de reorden:** mismo mini-ítem (`[grip] · [ícono tipo] · [título] · ——— · [etiqueta tipo]`, ver `card-grafico.md` *Reportes reordenables*). **Ícono de tipo:** **`CalendarDays`** (lucide, 16px `--muted`); **el mismo glifo** en el `AddCardMenu`. **Etiqueta de tipo:** **"Únicos"** (12px/600 `--muted`). **Sin mini-preview**.

#### 8. Tooltip de celda con desglose por categoría

El tooltip de celda (portaled a `body`) muestra **fecha + total del día + desglose por categoría de ESE día**, reusando el **lenguaje del tooltip de `by-category`** (swatch 8px + label + monto mono).

- **Caja:** `fixed z-50`, `rounded-ctl`, `border border-line`, `bg-panel`, `shadow-[var(--shadow-lg)]`, portaled a `body`, `pointer-events-none`, anclado `translate(-50%, -100%)`. `min-width` ~`180px`. Padding `px-3 py-[10px]` (el de `ChartTooltipContent`).
- **Encabezado:** **fecha del día** — ej. `Mar 14, 2026` (mes corto es-AR + día + año), **UI 12px/600 `--ink-2`**.
- **Total del día — en el ENCABEZADO, como cifra dominante:** pegado a la fecha, **mono `tnum` 13px/600 `--ink`**. Estructura: `[fecha UI]` → `[total mono dominante]` → `divisor --hair` → `[filas de categoría]`.
- **Filas de desglose (una por categoría con gasto ese día):** `flex items-center gap-[7px]`, idénticas a `ChartTooltipContent`:
  - **Swatch** 8px `rounded-[3px]`, `background: category.color`, `aria-hidden`.
  - **Nombre:** `flex-1`, **UI 12.5px/500 `--ink-2`**, `truncate`.
  - **Monto:** **mono `tnum` `--ink-2`**, `shrink-0`, **completo sin abreviar**. Neutro (no `--expense-ink`).
- **Orden de las categorías: monto DESC.**
- **Límite / scroll:** **hasta ~8 filas**; si hay más, el bloque de filas se vuelve **scrolleable** (`max-h-[180px] overflow-y-auto`, fade inferior opcional). **No** se agrupa en "Otras". Encabezado (fecha + total) y divisor quedan **fijos**.
- **Día con `$0`:** se muestra con la fecha + total **`$0`** (mono, `--muted`) y **sin filas** — opcionalmente una micro-línea `Sin gastos` en UI 12px `--muted`.
- **Celda nula (día inexistente):** **no abre tooltip**. El front no cablea `onMouseEnter` en celdas nulas.
- **Modo oscuro:** hereda la caja del DS; swatches con el ajuste de color de categoría en oscuro. Sin tratamiento extra.

##### Contrato que necesita el backend

Cada celda (día con gasto) lleva un **breakdown por categoría** **`{ categoryId, amount }`** (cents, en la moneda de display de la card); el front resuelve color/nombre desde `availableCategories` (`frontend/src/types/reports.ts`) — **una sola fuente de color/nombre**, la misma que alimenta el filtro. El front ordena por `amount` DESC. Días con `$0` → breakdown `[]`. Celdas nulas → no se emiten.

#### Restricciones duras reafirmadas

- La **rampa de heatmap** es un **lenguaje de magnitud propio de esta grilla**, **distinto** de income/expense: verde=poco gasto, rojo=mucho gasto; **no** comunica ingreso/gasto.
- **Toda cifra** (celda, footer) va en **mono tabular** `tnum`, abreviada en celda/footer, completa en tooltip, separador coma es-AR.
- El **%dif del footer** es **neutro `--ink-2` + glifo de dirección `↑`/`↓`**: **no** colorea por dirección; verde/rojo no aparecen en el %dif.
- El **índigo** aparece **solo** como cromo de interacción; **nunca** tiñe celdas ni cifras.
- El **título** de la card es Space Grotesk neutro (`--ink`/`--faint`).
- **Identidad visual en ambos modos** (regla dura 4): la rampa tiene stops por modo; el texto de celda por contraste; celdas nulas en `--panel-2`. Verificar la grilla completa en claro y oscuro.

#### 9. Techo editable de la escala de color

El **techo** (ancla) de la rampa —el `max` de `t = clamp(total / max, 0, 1)`— es **editable por card**. El editor cambia **solo el techo**: la **rampa de 4 stops oklch NO se toca** (§3), el piso queda en `0`. Es un control más del widget autónomo; **no vive en `/configuracion`**. Se persiste en USD (`anchorUsdCents`, entero, default `1500`) y el backend lo reconvierte por año y moneda; el front recibe el ancla vigente en `colorAnchorCents` y **prellena** el editor con ese valor.

> **Regla dura reafirmada:** el techo es una **cifra de dinero** → **mono tabular `tnum`** en el input y en cualquier eco. Sin tinte income/expense ni índigo de marca (el índigo **solo** como focus ring).

##### 9.1 Ubicación y disgregación — en la barra de controles derecha

Icon-button ghost en la barra de controles derecha, **entre el `CardCurrencyTrigger` y el clúster de utilidad** (≥941px de ancho de contenido):

`[ YearStepper ] |hair| [ CardCurrencyTrigger ] [ ColorAnchorTrigger ] |hair| [ RefreshCw ] [ X ]`

- **Va pegado a la moneda, sin divisor entre ambos.** Moneda y techo son los **dos ajustes de display por-card**; leen como un mini-grupo. No se agrega un tercer divisor (misma economía de cromo que *Moneda por reporte §4*).
- **No toca la columna de identidad:** `EditableTitle` + `LimitsInfoPopover` intactos.
- **Sin override de moneda** (p. ej. Dashboard efímero): si no se monta el `CardCurrencyTrigger`, el `ColorAnchorTrigger` **tampoco** (ambos son config persistida per-card, condicionados por la misma señal —callback presente—).

##### 9.2 El disparador (`ColorAnchorTrigger`) — anatomía y estados

`<button type="button">` con `aria-haspopup="dialog"` / `aria-expanded`, **hit-area 32×32** (`h-8 w-8`), mismo lenguaje ghost que `RefreshCw` / `X` / `LimitsInfoPopover`.

- **Ícono:** **`Gauge`** (lucide) **16px**, `aria-hidden`. Metáfora de "techo/intensidad de una escala", distinto de un ícono de paleta (que sugeriría recolorear la rampa). `aria-label` y `title` = **"Techo de la escala de color"**. *(Descartado: `SlidersHorizontal`, se confunde con un menú de filtros.)*
- **Default (ancla estándar, `anchorUsdCents` ausente):** ghost, `text-muted`; hover → `bg-panel-2 text-ink`.
- **Customizado (techo distinto del estándar 1500):** **activo persistente** — `bg-panel-2 text-ink` en reposo. Sin acento ni color semántico. El valor concreto se ve al abrir (no inline).
- **Abierto:** `bg-panel-2 text-ink` mientras el popover está abierto.
- **Focus (teclado):** ring `--accent-soft` 3px, radio `--r-ctl` (`focus-visible`).

##### 9.3 El popover-editor — forma

Popover **form** portaleado a `body`, anclado al disparador (mismo mecanismo que `LimitsInfoPanel`: crece hacia abajo, **flipea arriba** si no hay lugar, clampea horizontal a **12px** del viewport). Caja: `--panel`, borde `--line`, radio `--r-ctl` 10px, `--shadow-lg`, `animate-modal-pop` (`prefers-reduced-motion` → instantáneo). Ancho `min-w-[260px] max-w-[300px]`. Alineado al **borde derecho del disparador**. Padding `p-[12px]`, ritmo vertical `gap-[10px]`.

1. **Caption:** "Techo de la escala de color" — **11px / 600 uppercase** `tracking-[0.08em]` `--faint`. Sin ✕.
2. **Input-group monto + moneda** — reusa el **patrón de monto+moneda del form de movimiento** (`moneda.md` *Multi-moneda*):
   - **Input de monto:** `<input inputmode="decimal">`, **mono tabular `tnum`**, agrupación es-AR, `--ink`. Caja estándar (borde `--line`, radio `--r-ctl`, focus ring `--accent-soft`). **Prellenado** con `colorAnchorCents` en la moneda de display.
   - **Selector de moneda:** **reusa el `CardCurrencySelect`** (chip-dropdown compacto, orden `ARS→USD→EUR→BRL`) como adorno derecho. Prellenado con la moneda de display de la card. Cambiarlo reconvierte el monto mostrado.
3. **Microcopy obligatorio** — **12px `--muted`**, una línea, debajo del input-group:
   > *Se guarda en USD y se reconvierte según el año y la moneda de la card.*

   El wording exacto es copy funcional (lo cierra `control-analyst`); el spec fija posición, tamaño y color.
4. **Fila de acciones** (`flex justify-end gap-2`, al pie):
   - **Guardar** — primario del DS. Persiste el techo (convierte a USD cents) y cierra.
   - **Cancelar** — ghost/secundario. Descarta y cierra.
   - **Exactamente Cancelar + Guardar.** No hay "Restablecer al estándar": el techo estándar se repone tipeando 15 USD.

**Cierre (clase popover, `overlays-modales.md` *Cierre de overlays*):** Esc / click-fuera / re-clic en el disparador / Cancelar / Guardar. **Esc, click-fuera y Cancelar descartan** las ediciones sin guardar. Esc devuelve el foco al disparador.

##### 9.4 Estados

- **Default:** disparador ghost `--muted`; input prellenado con el equivalente de 15 USD.
- **Customizado:** disparador activo `bg-panel-2 text-ink`; input con el techo propio. Misma fila de acciones.
- **Editando:** input con foco (ring `--accent-soft`); "Guardar" habilitado si el valor es válido (guardar sin cambio es inocuo).
- **Inválido (vacío / cero / negativo):**
  - **Prevención de entrada:** el input **no admite** signo negativo ni no-numéricos.
  - **Vacío o cero:** **"Guardar" deshabilitado** (`opacity-60`) + **micro-línea de ayuda 12px `--muted`** bajo el input: *"Ingresá un monto mayor a cero."* (neutra, **sin rojo**, sin ámbar).
- **Foco (teclado):** ring `--accent-soft` 3px en todos los controles. Orden: input → moneda → Cancelar → Guardar. Al abrir, foco al **input de monto** con el texto seleccionado.

##### 9.5 Comportamiento en pantalla chica (contención, todo el régimen de app, sidebar abierto o cerrado)

El disparador (32px) **fluye en el mismo `flex flex-wrap justify-end`** de la barra de controles. Los cuatro invariantes:

1. **Sin scroll horizontal del `body`:** popover portaleado, `position: fixed`, **clampea `left`/`right` a 12px** del viewport, incluso a 640px con sidebar abierto (contenido 392px).
2. **Completo y no atrapante:** `max-height: min(60vh, 360px)` con `overflow-y-auto` interno; acciones siempre alcanzables. Esc / click-fuera siempre lo cierran.
3. **Ninguna acción inalcanzable:** **flipea hacia arriba** sin lugar abajo; el clamp horizontal mantiene "Guardar"/"Cancelar" on-screen.
4. **Superficie contenida:** el popover no ensancha la card ni la grilla; la grilla mantiene su propio scroll interno (`scroll-interno.md`).

##### 9.6 Checklist de aceptación visual — techo editable

- [ ] **Disparador presente y ubicado:** ícono `Gauge` 16px en la barra derecha, **entre** el chip de moneda y el botón refrescar, sin divisor extra entre moneda y él.
- [ ] **Default vs customizado:** con techo estándar el botón es ghost `--muted`; con techo propio queda **activo** (`bg-panel-2`/`--ink`) en reposo, sin acento ni verde/rojo.
- [ ] **Abre popover-form:** clic → popover con caption "Techo de la escala de color", input de monto (mono tabular), selector de moneda de 4 opciones, microcopy y acciones Guardar/Cancelar.
- [ ] **Prellenado correcto:** el input muestra el ancla vigente en la moneda de la card (en default, ≈ 15 USD reconvertidos ese año); el selector arranca en la moneda de display de la card.
- [ ] **Microcopy visible:** una línea `--muted` 12px "Se guarda en USD y se reconvierte según el año y la moneda de la card." bajo el input.
- [ ] **Mono tabular:** la cifra del techo va en IBM Plex Mono con `tnum`, agrupación es-AR.
- [ ] **Inválido:** con monto vacío o `0`, "Guardar" queda deshabilitado y aparece la ayuda neutra "Ingresá un monto mayor a cero." (sin rojo, sin ámbar); el signo `−` no se puede tipear.
- [ ] **Sin recolorear la rampa:** al guardar un techo nuevo, las celdas re-mapean `t` pero la rampa de 4 stops (verde→rojo) es la misma; ninguna cifra ni celda se tiñe de índigo o de income/expense por este control.
- [ ] **Fila de acciones:** exactamente **Cancelar** + **Guardar**, en ese orden; no hay un tercer control de "restablecer" ni en default ni en customizado.
- [ ] **Focus ring:** input, selector y botones muestran ring `--accent-soft` 3px con Tab; Esc cierra y devuelve foco al disparador.
- [ ] **Contención (640px, sidebar abierto/cerrado):** el popover no genera scroll horizontal del `body`, no queda cortado, flipea arriba si falta lugar abajo, y Guardar/Cancelar siempre alcanzables.
- [ ] **Ambos modos:** popover, input, chip de moneda y estados del disparador se ven correctos en claro y oscuro.

### Reporte anual de Cuotas — gantt de barras horizontales

Tipo de card de reporte `installment-gantt`, hermano de `unique-grid`: misma caja, misma cabecera (título editable + barra de controles derecha), mismo modo orden, mismos estados de carga/vacío/error, mismo filtro de categorías como chips-toggle debajo del canvas. El **canvas** es un **gantt anual**: eje X = los 12 meses del año y cada **gasto en cuotas (EXPENSE)** es una **barra horizontal** que abarca los meses que ocupa (de `startMonth`, por `totalInstallments` meses), apilada en renglones por un algoritmo de packing. **No inventa cromo nuevo**.

> **Reglas duras reafirmadas para este gantt.** (1) Acá **todo es gasto**: las barras **no** se tiñen de `--expense` ni se colorea el monto en rojo — el **color de la barra es el color de su categoría** (identificador). (2) Todo monto va en **mono tabular** `tnum`; la **etiqueta de barra** y la **cifra dominante del tooltip** son el **monto por cuota** — el **total del plan** aparece **solo** como fila rotulada dentro del tooltip (§6), nunca sobre la barra. (3) El **índigo** aparece **solo** como cromo de interacción.

#### 1. Librería — decisión cerrada: NO Recharts. Layout nativo CSS (Grid/absolute) sobre tabla semántica.

Un gantt es un **layout de rectángulos posicionados sobre una grilla discreta de 12 columnas × N renglones**. Recharts no tiene un primitivo de gantt; forzarlo daría peor control de clipping, packing, etiquetas dentro/fuera e indicadores ‹/›, y peor accesibilidad.

- **Primitivo:** **CSS** — una **grilla de 12 columnas** (`repeat(12, 1fr)`) que da las gridlines verticales y el header de meses, y sobre ella las **barras posicionadas** por renglón. Dos andamiajes válidos, **el front elige**: (a) **CSS Grid** con `grid-column: <mesInicio> / span <nMeses>` y `grid-row: <renglón>`, o (b) **posicionamiento absoluto** con `left`/`width` en `%` y `top` por renglón — (b) es más cómoda para el **clipping** al borde del año. **Semántica de tabla/lista accesible obligatoria**: cada barra es una fila anunciable ("Cuota X, marzo–mayo, $Y por cuota"). Sin `ResponsiveContainer` ni `<svg>` de charting.
- **Por qué no Recharts:** (a) rectángulos discretos, no trazo continuo; (b) el **packing por renglón** es layout puro; (c) **clipping + indicadores ‹/›** nativos con `overflow-hidden`; (d) etiquetas dentro/fuera según ancho son CSS. Misma postura que `unique-grid`.
- **Sin dependencia nueva.** (En v1 los renglones son pocos; sin virtualización.)

#### 2. Recomendación de dónde vive el packing — backend (entrega `rowIndex` por barra)

**El packing lo calcula el backend y entrega `rowIndex` por barra (más `rowCount` total).** Es **lógica de negocio determinista** (orden por `createdAt` asc, reuso de renglón con ≥1 mes de descanso, clip al año), idéntica en cualquier cliente y verificable con tests de backend. El front hace **solo layout** (posicionar, clippear, etiquetar). El **clipping visual y los indicadores ‹/›** los resuelve el front.

#### 3. Layout del gantt

De arriba a abajo: **header de meses (fila)** → **área de plot** (renglones en `rowIndex` **descendente**: el renglón 0 —el más antiguo— queda **abajo, pegado al eje de meses**, y los nuevos crecen **hacia arriba**). Sin columna de rótulo lateral: la identidad de cada barra vive **en la barra** y en el tooltip.

- **Grilla base:** **12 columnas iguales** (Ene→Dic), **gridlines verticales `--hair` 1px** entre meses. A 1120px, 12 × ~88px. En `≤940px` el plot permite **scroll horizontal** manteniendo el **header de meses sticky arriba**; columnas con **mínimo legible ~64px**.
- **Header de meses:** nombre corto es-AR, **UI 12px/600 `--muted`**, centrado, sin rotar; fondo `--panel`, borde inferior `--line` 1px; sticky. Mismo array `MONTH_LABELS_SHORT` que Únicos.
- **Renglón y barra:** **alto de renglón ~30px**; **barra ~24px** centrada. **Gap vertical entre renglones: 6px**. Alto del plot = `rowCount × 30 + (rowCount−1) × 6`. **Radio de barra: `--r-ctl` (10px)**, salvo los lados clippeados (§5: van rectos).
- **Color de barra = color de su categoría** (`category.color`): relleno **sólido** a opacidad plena; ajuste de oscuro según `fundamentos.md` *Categorías y gráficos en oscuro*. **No** `--expense`. Sin borde; en hover, `--shadow-sm` + `brightness(1.04)`, `transition` 140ms.
- **Posición temporal:** del **borde izquierdo de la columna de `startMonthIndex`** al **borde derecho de la columna de `endMonthIndex`** (columnas completas). Granularidad **mensual**.

#### 4. Etiqueta de la barra — el MONTO manda, el nombre acompaña; degradación por ancho

Dos piezas: el **monto por cuota** (**primaria**, la **última** que se sacrifica) y la **descripción** (**secundaria**, la **primera** que se omite). Dentro cuando hay ancho; **fuera** cuando ni el monto entra. El detalle completo vive en el tooltip.

**Jerarquía.** Orden de lectura `[monto] · [nombre]`:

- **Monto por cuota — primaria:** mono `tnum` **12px / 700**, color **por contraste pleno** contra el color de la barra (barras claras T1–T3 → `oklch(0.22 0.02 270)`; oscuras T5–T7 → `oklch(0.97 0.005 270)`), `shrink-0`. Neutro por contraste (no `--expense-ink`).
- **Nombre/descripción — secundaria:** UI Space Grotesk **11.5px / 500**, mismo color de contraste con `opacity-[0.72]`, `truncate`. **Nombre visible** = `description`; si es `null` (o vacía), el **nombre de la categoría** (desde `availableCategories`), mismo estilo. La degradación por ancho no cambia: el nombre de categoría se trata igual que una descripción.
- **Separación:** `gap-[8px]` + punto medio `·` en el color de contraste a `opacity-[0.45]`. `pl-[9px]` / `pr-[9px]`.

> **Por qué el monto adelante y dominante:** la pregunta es "¿cuánto me sale esto por mes?"; el nombre solo desambigua. Cada renglón se escanea como una columna de cifras, y el nombre se recorta sin perder lo crítico.

**Degradación por ancho:**

1. **Barra ancha:** `[monto] · [nombre…]` dentro; el nombre trunca con elipsis.
2. **Barra angosta (1 mes, entra el monto pero no el nombre):** **solo el monto** dentro (mono 12px/700, `pl-[9px]` o centrado). El nombre se omite (no se trunca a 1–2 letras).
3. **Ni el monto entra:** barra como **pastilla sin texto** y **solo el monto** **inmediatamente a la derecha**, mono `tnum` 12px/700 `--ink`, `ml-[6px]`, sobre el fondo del plot. Si a la derecha no hay aire (diciembre clippeado), va **a la izquierda**; el front elige el lado con más espacio. **Afuera viaja solo el monto**.

**Criterio de corte:** si entra `monto + · + ≥ ~6 caracteres de nombre` → 1; si entra el monto pero no un nombre legible → 2; si no → 3. **Barra mínima:** una barra de 1 mes ocupa **como mínimo su columna completa**.

**Coherencia:** nombre en Space Grotesk, monto en IBM Plex Mono `tnum`. El tooltip (§6) es la ficha; la continuación la comunican los chevrons ‹/› (§5) y el rango del `Período`.

#### 5. Indicadores de continuación ‹ / › — barras que cruzan el borde del año

Una compra que empieza **antes de enero** o termina **después de diciembre** se **clippea** a los 12 meses visibles (`overflow-hidden`), con indicador de continuación.

- **Glifo:** **`ChevronLeft` ‹** (`continuesBefore`) y/o **`ChevronRight` ›** (`continuesAfter`), **lucide 14px**, color **por contraste contra la barra**, `stroke-width 2.5`. `aria-hidden` (la continuación se anuncia en el `aria-label`/tooltip).
- **Ubicación:** ‹ **pegado al borde izquierdo** (dentro, `pl-[4px]`); › **pegado al borde derecho** (dentro, `pr-[4px]`). El **lado clippeado va con esquina recta**. Una barra puede llevar **ambos**.
- **No es un control:** decorativo (`pointer-events-none`). Cambiar de año = `YearStepper`.

#### 6. Tooltip de barra

**Tooltip custom portaled a `body`** (mismo cromo que el de Únicos): `fixed z-50`, `rounded-ctl`, `border border-line`, `bg-panel`, `shadow-[var(--shadow-lg)]`, `pointer-events-none`, `role="tooltip"`, anclado `translate(-50%, -100%)` sobre el centro de la barra (o sobre el cursor). `min-width` ~`200px`.

- **Encabezado:** **swatch 8px `rounded-[3px]`** del color de la categoría + **nombre visible** (UI 12px/600 `--ink`; `description`, o si es `null`/vacía el **nombre de la categoría** con el mismo estilo — sin `--muted`), fila `gap-[7px]`. Debajo, **nombre de la categoría** UI 11.5px/500 `--ink-2` (desde `availableCategories`). **Sin descripción:** la línea de categoría de abajo **se omite** (el encabezado ya la nombra); el string "Sin descripción" no existe en esta card.
- **Nombre accesible de la barra (`aria-label`):** `{nombre visible}, {Categoría}, {monto} por cuota, {Mmm} a {Mmm}…` (el resto del label, sin cambios). **Sin descripción:** arranca en la categoría como nombre y **no la repite**: `{Categoría}, {monto} por cuota, …`.
- **Cifra dominante — monto por cuota:** **mono `tnum` 13px/600 `--ink`**, completo, con micro-rótulo `por cuota` en `--faint` 9px uppercase tracking.
- **Cuerpo — filas `label ⟷ valor`** (`flex flex-col gap-[5px]`, label UI 11.5px/500 `--ink-2` `flex-1`, valor `shrink-0`), divisor `1px --hair` opcional bajo el monto dominante:
  - **Período** — `Mar 2026 – May 2026` en **UI** 11px/500 `--ink-2` (no mono: es rango de fechas). Si cruza años, muestra los **años reales** (`Nov 2025 – Feb 2026`).
  - **Cuotas** — `N cuotas` en mono `tnum` 11px/500 `--ink-2`.
  - **Total del plan** — `amountCents × totalInstallments` en mono `tnum` 11px/500 `--ink-2`, en la moneda de display. **Después de `Cuotas`**, **antes de `Progreso`**. Se **omite si `totalInstallments === 1`**. Ver `form-movimiento.md` *Total del plan de cuotas — las tres superficies*.
  - **Progreso** (si aplica) — `cuota X de N` (año actual, mes en curso dentro del rango) o `cuotas X–Y visibles este año` (cruza el borde). Mono `tnum` 11px/500 `--ink-2`. Si no aplica, **se omite la fila**.

  **Sin micro-línea de continuación** ("Continúa antes de…"): redundante con los chevrons y el `Período`.
- **Coherencia con Únicos:** misma caja, portal, anclaje, registro tipográfico, swatch 8px. Sin `title` nativo.

#### 7. Filtro de categorías — chips-toggle debajo del plot

Idéntico a `unique-grid` (§5): **fila de chips-toggle DEBAJO del plot** (`ChartLegend` scrollable + `LegendAllChip`), `margin-top` 14px. Toggle off → las barras de esa categoría **dejan de mostrarse** y el packing **se recalcula** (puede compactar renglones). **Universo = `availableCategories`**. **El filtro viaja al backend** (`?categoryIds=`) y el back devuelve `rowIndex`/`rowCount` del subconjunto ya packeado: el packing vive **en un solo lado**.

#### 8. Estados

- **Loading (skeleton):** cabecera presente; **header de meses fantasma** + **4–5 barras fantasma** de anchos/posiciones variados en 2–3 renglones + 2–3 chips fantasma de filtro (primitivas de `skeletons.md`). Sin spinner.
- **Empty (sin cuotas EXPENSE en el año):** **header de meses dibujado** (12 columnas con gridlines) + **overlay centrado** "Sin gastos en cuotas en {año}." (UI 14px `--muted`).
- **Error:** `AlertTriangle` 20px `--warning-ink` + "No se pudo cargar el reporte." + ghost "Reintentar".
- **Modo orden / mini de reorden:** mismo mini-ítem. **Ícono de tipo:** **`CalendarRange`** (lucide, 16px `--muted`), el mismo en el `AddCardMenu`. **Etiqueta de tipo:** **"Gastos en Cuotas"** (12px/600 `--muted`). **Sin mini-preview**.

#### Restricciones duras reafirmadas

- **Color de barra** = **color de su categoría**, **nunca** `--expense` ni semántico por tipo.
- **Todo monto** en **mono tabular** `tnum`, coma es-AR, neutro (`--ink`/`--ink-2`). Etiqueta y cifra dominante = **monto por cuota**; el **total del plan** solo en su fila del tooltip, subordinado.
- **Índigo** solo como cromo de interacción.
- **Título** Space Grotesk neutro.
- **Ambos modos:** texto sobre barra por contraste; color de categoría con su ajuste de oscuro. Verificar el gantt completo en claro y oscuro.
- **El packing lo decide el backend** (`rowIndex`/`rowCount`). Las **alertas de renglón** están fuera de alcance (futuro).

### Reporte anual "Inflación vs Ingresos" — gráfico de líneas

Tipo de card de reporte `inflation-vs-income`. Misma familia que las otras cards de `/reportes` (panel, `--line`, `--r-card` 14px, `--shadow-sm`, `--card-pad` 22px; cabecera identidad-izquierda ⟷ controles-derecha; canvas 300px `/reportes` / 220px en ≤940px; widget autónomo). El canvas es un **gráfico de líneas anual** (Recharts `LineChart`, eje X = 12 meses, eje Y = **puntos porcentuales**, con **negativos** → baseline en cero). Reusa cabecera + `YearStepper` + filtro, `ChartLegend` interactiva, `ChartTooltipContent`, skeleton de card, overlays de estado. Aporta: (1) un **tercer color de serie** (inflación), (2) el **tratamiento de "línea derivada"** para las rectas de tendencia, (3) el **eje Y con negativos** en puntos porcentuales.

> **Sobre las reglas duras de color.** Las dos series de **ingreso** van en **verde income** (variando estilo, no hue). La **inflación** es un benchmark de contexto — ni ingreso ni gasto — y va en **un neutro-graphite** (`--rate`). **No** rojo expense para inflación, **no** índigo. Las cifras son **puntos porcentuales**, no montos: la regla dura 3 (mono tabular) **aplica igual** a ticks/valores %, pero el **color semántico income/expense NO aplica a un %** — las series de ingreso usan el verde **como identidad de "esto habla de tus ingresos"**, no como "monto de ingreso". Lectura documentada y acotada acá.

#### 1. Las 5 líneas — paleta, estilo y jerarquía

Tres **series de dato** (plenas) + dos **rectas de tendencia** (derivadas, más finas, discontinuas, atenuadas, vinculadas por color a su serie).

| # | Línea | Token / color | Stroke | Estilo | Dots | Rol |
|---|---|---|---|---|---|---|
| 1 | **Inflación (IPC del mes)** | **`--rate`** graphite (token semántico, hue ~270 neutro — abajo) | **2px** | sólida, opacidad 1 | ocultos; `activeDot` 4px en hover | benchmark de contexto |
| 2 | **Var. % ingresos (nominal)** | `--income` | **2px** | sólida, opacidad 1 | ocultos; `activeDot` 4px | serie principal de ingreso |
| 3 | **Var. % ingresos (ajustada por inflación)** | `--income` | **2px** | **dasheada `6 4`** (raya larga) | ocultos; `activeDot` 4px | misma familia verde, distinta por patrón |
| 4 | **Tendencia ingresos nominal** | `--income`, **opacidad 0.45** | **1.25px** | **punteada `2 3`** (puntos finos) | sin dots, sin `activeDot` | recta de mín. cuadrados sobre #2 |
| 5 | **Tendencia ingresos ajustada** | `--income`, **opacidad 0.45** | **1.25px** | **punteada `2 3`** | sin dots, sin `activeDot` | recta de mín. cuadrados sobre #3 |

- **Nominal (#2) vs. ajustada (#3) sin un segundo hue verde:** son dos lecturas del **mismo** concepto → misma identidad de color. Se separan por **patrón**: **#2 sólida** (cruda, primaria), **#3 dasheada `6 4`** (versión procesada). **No** se introduce un segundo token verde.
- **Inflación (#1) — `--rate` graphite.** Hue que **no choca** con income (158), expense (27), índigo (264) ni ámbar (75), y **no se lee como semántico de dinero**: `--rate` `oklch(0.45 0.03 270)` en claro / `oklch(0.72 0.025 270)` en oscuro. **Por qué graphite:** (a) la inflación es **dato de contexto externo**, "la vara contra la que medís tus ingresos"; (b) un hue saturado libre (teal ~200 / violeta ~310) se acerca al verde income o compite con el índigo; (c) contrasta nítido contra las verdes. **Croma 0.03** basta para distinguirse del gridline `--hair` y del eje `--muted`. Token **semántico propio de tasas** (solo lo consume este chart); dualidad `@theme`/`:root` como income/expense.
- **Las tendencias (#4, #5) se leen como derivadas:** **(a) más finas** (1.25px), **(b) punteadas `2 3`**, **(c) opacidad 0.45**. Mismo verde income que su serie, **sin dots ni `activeDot`**. Se trazan **debajo** de las series de dato. **No hay tendencia para la inflación** (decisión de producto).
- **Orden de pintado (z):** tendencias (#4, #5) → inflación (#1) → ajustada (#3) → nominal (#2) arriba. `activeDot` por encima de todo.
- **Curva:** series de dato `monotone`; tendencias `linear` (el contrato entrega la recta ya calculada).
- **Prohibido:** índigo o color de categoría en cualquier línea; rojo expense para la inflación. El verde income **solo** en las dos series de ingreso y sus tendencias.

#### 2. Eje Y con negativos, baseline en cero, gridlines y ticks

- **Eje Y = puntos porcentuales, con negativos.** Dominio holgado alrededor de los datos (`['dataMin - pad', 'dataMax + pad']`).
- **Baseline en cero — obligatoria y marcada:** `ReferenceLine y={0}` en **`--line` 1px sólida** (un escalón sobre el `--hair`). Cromo neutro estructural.
- **Gridlines:** solo horizontales, `--hair` 1px. La baseline **reemplaza** al gridline de y=0.
- **Ticks del eje Y — % en mono tabular:** `+10%`, `+5%`, `0%`, `−5%`, `−10%` (`+` para positivos; `U+2212` para negativos; `0%` sin signo). **Mono `tnum` 11.5px `--muted`**, coma es-AR si hubiera decimales. Sin línea ni ticks visibles; 4–6 ticks simétricos alrededor del cero. Color neutro.
- **Eje X (meses):** idéntico a la Forma 1.

#### 3. Leyenda — interactiva, 5 ítems, las tendencias agrupadas a su serie

La leyenda **es el filtro** (`ChartLegend` interactivo), pero el universo es **fijo de series**: set corto, **sin `LegendAllChip`**.

- **Tres ítems toggle (uno por serie de dato):**
  1. **"Inflación"** — swatch graphite `--rate`.
  2. **"Ingresos (nominal)"** — swatch `--income` **sólido**.
  3. **"Ingresos (ajustado)"** — swatch `--income` como **mini-muestra de línea dasheada de 14px** (forma preferida). Alternativa: cuadrado `--income` con **borde dasheado** y centro `--panel`.
- **Las 2 tendencias NO son ítems propios.** **Siguen la visibilidad de su serie madre** (nominal off → #4 desaparece; ajustada off → #5). Decisión cerrada: **leyenda = 3 ítems**, tendencias implícitas (micro-anotación opcional).
- **Estados del ítem:** idénticos a la leyenda interactiva del DS. `role="group"` `aria-label="Filtrar series"`. Apagar las 3 → empty estándar; la leyenda no se bloquea.
- **Posición/espaciado:** debajo del canvas, `margin-top` 14px, izquierda, `flex-wrap`, sin región scrolleable.

#### 4. Tooltip por mes — los 3 valores en %, mono tabular

Reusa `ChartTooltipContent` (caja `--panel`/`--line`/`--r-ctl`/`--shadow-lg`, padding 10×12, encabezado mes+año UI 12.5px/600 `--ink`).

- **Filas (3 máx., solo series visibles):** swatch 8px (mismo tratamiento de la leyenda) + nombre UI 12.5px `--ink-2` + **valor % mono `tnum`** con signo (`+8,3%` / `−2,1%` / `0%`), coma es-AR, sin abreviar.
- **Color del valor — neutro `--ink`, NO semántico.** El color lo da el swatch. (Difiere de la Forma 1, donde el monto sí va `--income-ink`/`--expense-ink`: allá es **dinero**; acá es un **indicador %**.)
- **Las tendencias NO aparecen en el tooltip.** Decisión cerrada.
- **Cursor de hover:** guía vertical `--hair` 1px. `activeDot` 4px en cada serie de dato visible (relleno del color, borde `--panel` 2px); tendencias sin `activeDot`.
- **Mes vacío / futuro:** sin punto; el tooltip no muestra filas de series sin dato (o no abre, según el patrón vigente del chart).

#### 5. Cabecera de la card — molde simple (como `income-expense`/`unique-grid`)

Una sola línea `flex justify-between`, sin `ViewTabs`: **título editable a la izquierda** (16px/600 `--ink`, placeholder "Reporte N" en `--faint`) ⟷ **barra de controles a la derecha**: `[ YearStepper ] |hair| [ CardCurrencyTrigger ] |hair| [ RefreshCw ] [ X ]`.

- **YearStepper:** mismas reglas de límite (RF-REP-002, *Límites de navegación de año*), año en mono tabular.
- **Selector de moneda (`CardCurrencySelect`): sí lo lleva** (se monta cuando hay callback de cambio de moneda). La moneda en que se miden los ingresos entra en el cálculo de la variación.
- **Filtro de categorías: sí lo lleva**, como **chips-toggle debajo del plot** (`ChartLegend` scrollable + `LegendAllChip`), mismo patrón que `unique-grid` y el gantt; viaja al backend (`categoryIds`). La leyenda de las 3 series **no** es el filtro: dos controles con dos ejes distintos (qué series se ven vs. qué categorías de ingreso entran en el cálculo).
- **X quitar / confirmación inline / Dashboard:** idénticos a las otras cards. (Por defecto vive solo en `/reportes`.)

#### 6. Estados

- **Loading (skeleton):** cabecera presente e inerte; skeleton de card de reporte (`skeletons.md`) + 3 chips fantasma de leyenda. Sin spinner.
- **Vacío (año sin datos / filtro vacío):** 12 meses con eje X completo y **baseline en cero visible**, + overlay centrado **"Sin datos en {año}."** (UI 14px `--muted`). Apagar las 3 series → mismo overlay.
- **Meses futuros — la línea termina en el mes en curso.** Una variación de un mes que no ocurrió **no es "0%", es inexistente**: las series **se cortan en el mes en curso** (`connectNulls={false}`, `null` en adelante). El eje X muestra los 12 meses. Las **tendencias** se calculan **solo con los meses con dato**.
- **Error:** `AlertTriangle` 20px `--warning-ink` + "No se pudo cargar el reporte." + ghost "Reintentar".
- **Modo orden / mini de reorden:** **Ícono de tipo:** `TrendingUp` (§7). **Etiqueta:** **"Inflación vs Ingresos"** (12px/600 `--muted`). Sin mini-preview.
- **`prefers-reduced-motion`:** sin *draw* de entrada (`isAnimationActive={false}`); tooltip sin transición; cambio de año instantáneo.
- **Movimiento (con motion permitido):** *draw* de entrada ~0.4s ease-out; tendencias con el mismo timing, atenuadas.

#### 7. Menú "[+]" (5ª entrada) y nomenclatura del tipo

Entrada del `AddCardMenu` con la nomenclatura única (`card-grafico.md` *Card de reporte*): `[ícono de tipo 16px --muted] · [nombre]`.

- **Nombre de display:** **"Inflación vs Ingresos"** (misma nomenclatura que "Ingresos vs Gastos" / "Gastos por categoría" / "Gastos Únicos" / "Gastos en Cuotas").
- **Ícono:** **`TrendingUp`** (lucide, 16px `--muted`), distinto de `AreaChart` (income-expense), `BarChart3` (by-category), `CalendarDays` (unique-grid), `CalendarRange` (installment-gantt). El mismo en el mini de reorden.
- **Sub-descripción** (si las entradas la tienen): **"Variación de tus ingresos frente a la inflación, mes a mes."** UI 12px `--muted`.
- **Etiqueta de tipo (mini de reorden):** **"Inflación vs Ingresos"**.

#### Restricciones duras reafirmadas

- **Verde = ingreso, rojo = gasto.** El verde income **solo** en las series de ingreso (#2, #3) y sus tendencias (#4, #5). El **rojo expense NO aparece**. No se recolorea ningún % por su signo.
- **El índigo no aparece** salvo focus rings. Baseline, gridlines y ejes **neutros**.
- **Toda cifra del chart en mono tabular**: ticks % con signo y valores del tooltip. (El mono aplica por ser cifra; el color semántico NO aplica por no ser dinero.)
- **Título** Space Grotesk neutro.
- **`--rate` es un token semántico propio** (graphite hue ~270, croma 0.03): no toma valor de `--ink`/`--muted`, no es income/expense ni índigo. Tiene stop claro/oscuro; verificar las 5 líneas + baseline en ambos modos.
