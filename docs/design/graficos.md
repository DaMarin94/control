# Gráficos — formas, `by-category`, `income-expense`, leyenda-filtro

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. El encuadre que rodea a cada gráfico (cabecera, controles, estados de card) vive en `card-grafico.md`. Pertenece al grupo *Patrones de componentes vigentes*.

### Gráficos — Forma 1 y Forma 2

Las dos visualizaciones que montan las *cards de reporte*. Librería: Tremor Raw (Recharts por debajo). El **encuadre** (cabecera, controles, estados de carga/vacío/error de la card) vive en *Card de reporte*; acá viven las **gráficas**: tipo, mapeo de color, curva, ejes, gridlines, leyenda y tooltip. Altos de canvas: 300px (`/reportes`) / 280px (Dashboard) / 220px en ≤940px; ancho 100% del contenedor (responsive container de Recharts).

#### Forma 1 — Ingresos vs. Gastos (área)

`AreaChart`, **dos series superpuestas, NO apiladas** (income y expense son lecturas independientes que el usuario compara mes a mes; no suman un total con sentido).

| Serie | Stroke | Fill | Opacidad fill |
|---|---|---|---|
| **Ingresos** | `var(--income)` | `var(--income)` | **0.14** |
| **Gastos** | `var(--expense)` | `var(--expense)` | **0.14** |

- **Stroke:** 2px, sólido, opacidad 1, sin punteado.
- **Fill:** plano a opacidad 0.14 (translúcido, para que ambas áreas se lean aunque se solapen). Si se usa gradiente, del mismo hue del token, 0.18 (arriba) → 0.02 (abajo); el plano a 0.14 es la opción canónica.
- **Orden de pintado:** gastos debajo, ingresos encima (lectura "¿me sobró?" arriba).
- **Puntos (dots):** ocultos en reposo; visibles solo en el punto activo de hover (`activeDot`), radio 4px, relleno del color de la serie, borde `--panel` 2px.
- **Curva:** `monotone` (suavizado suave), no `linear`.
- **Prohibido** teñir estas series con índigo o con un color de categoría (regla dura 1).

#### Forma 2 — Gastos por categoría (barras apiladas)

`BarChart` apilado, una barra por mes, una banda por categoría (es la descomposición de un total: las bandas de un mes suman el total de gastos del mes; las barras discretas lo comunican mejor que un área, que sugeriría flujo entre meses).

- **Color de banda = `category.color`** tal cual viene del dato; el gráfico no reasigna ni retiñe. Una categoría soft-deleted con gasto en el año sigue con su color. **Prohibido** usar income/expense o índigo para las bandas: son color de categoría (identificador), no semántico — el rojo expense no se usa acá aunque sean gastos.
- **Orden de apilado:** de mayor a menor gasto anual de la categoría (la mayor en la base), **el mismo para los 12 meses** (no se reordena por mes), para seguir cada banda horizontalmente.
- **Separadores entre bandas:** 1px `stroke="var(--panel)"` (blanco), para que dos categorías de color parecido no se fundan.
- **Redondeo de barra:** `--r-chip` (7px) solo en la esquina superior del segmento más alto del stack; el resto cantos rectos. Si Recharts complica el redondeo selectivo, cantos rectos (0px) es aceptable.
- **Ancho de barra / gap:** `barCategoryGap` ~25–30%; ancho de barra el que resulte (no fijar px).
- **Muchas categorías — sin agrupar:** se muestran todas las categorías con gasto en el año, cada una en su banda, sin agrupar ni colapsar. Recursos de legibilidad (visuales, no cambian datos): orden de apilado mayor→menor, separadores 1px `--panel`, leyenda con `flex-wrap`. (Post-v1, candidato a evaluar: banda "Otras" para la cola. Fuera de v1 sin decisión explícita.)

#### Ejes (ambas formas)

- **Eje X (meses):** nombre corto del mes en es-AR (`Ene Feb … Dic`), UI 12px/500 `--muted`, sin rotación (entran los 12 en desktop). `axisLine` y `tickLine` ocultos; solo etiquetas.
- **Eje Y (monto):** mono tabular (regla dura 3), 11.5px `--muted`, **formato abreviado** (`$0`, `$50k`, `$120k`, `$2,5M`; separador decimal coma es-AR). El monto completo va en el tooltip, no en el eje. Sin línea ni ticks visibles; 4–5 ticks máximo, redondeados a valores "lindos".
- **Gridlines:** solo horizontales, `--hair` 1px sólidas. Sin gridlines verticales. La línea base (y=0) puede ir levemente más marcada (`--line`).

#### Leyenda (ambas formas)

Debajo del área del gráfico, alineada a la izquierda, `margin-top` 14px (separada por aire, no por línea). Ítem: swatch cuadrado 10px radio 3px + etiqueta UI 12.5px/500 `--ink-2`; separación entre ítems 16px, `flex-wrap`. Las cifras **no** van en la leyenda (van en el tooltip): la leyenda es color → nombre.

- **Forma 1 (`income-expense`):** en `/reportes`, el footer es la **leyenda-filtro de categorías** (un ítem por categoría activa, swatch `category.color` + nombre — filtro de cómputo, ver *Leyenda interactiva* y RF-REP-014 §4). En el **Dashboard** (efímero, sin filtros) es una **leyenda decorativa de 2 series** — "Ingresos" (swatch `--income`) / "Gastos" (swatch `--expense`), no interactiva.
- **Forma 2:** un ítem por categoría con gasto en el año, en el mismo orden del apilado (mayor a menor), cada swatch con su `category.color`; sin agrupar ni colapsar.

> **La leyenda es interactiva: es el filtro.** Cada ítem es un toggle clickeable que activa/desactiva su categoría. En **`income-expense`** (Total-only) el footer es la **leyenda-filtro de categorías** (RF-REP-014 §4): tildar/destildar categorías acota qué movimientos alimentan las 2 líneas income/expense, **sin** descomponerlas en series por categoría. En **`by-category`** la leyenda-filtro de categorías mapea a las bandas/áreas del canvas (en ambos modos Barra y Línea); no hay disparador+popover de categorías en la card. El detalle vive en *Leyenda interactiva (la leyenda es el filtro)*. *(El Dashboard `income-expense` es la excepción: efímero y sin filtros, lleva una leyenda decorativa de 2 series no interactiva.)*

#### Tooltip / hover (ambas formas)

- **Cursor de hover:** franja vertical `--accent-soft` translúcida (en barras) o guía vertical `--hair` 1px (en área). El `--accent-soft` acá es fondo de UI (resaltado de interacción), no tiñe montos.
- **Caja:** `--panel`, borde `--line`, `--r-ctl` (10px), `--shadow-lg`, padding 10px 12px.
- **Encabezado:** mes y año, UI 12.5px/600 `--ink` (ej. "Marzo 2026").
- **Filas:** una por serie/categoría visible en ese mes — swatch 8px + nombre (UI 12.5px `--ink-2`) a la izquierda, monto mono tabular (regla dura 3) a la derecha, formato es-AR completo sin abreviar. En Forma 1: ingresos `--income-ink`, gastos `--expense-ink` (el monto sí lleva color semántico). En Forma 2: el monto de cada banda en `--ink` (el color lo da el swatch, no el número). Orden de filas = orden del apilado/serie; categorías con valor 0 en el mes se omiten.
- **Total (Forma 2):** fila final separada por `--hair`, "Total gastos" + monto mono `--expense-ink` (es el total de gastos del mes — sí es expense).

#### Estados (área de gráfico)

- **Loading (skeleton):** la cabecera de la card ya presente; el área se reemplaza por el skeleton de card de reporte (ver `skeletons.md` §Mapeo de casos). Sin spinner.
- **Año sin movimientos (vacío):** los 12 meses se dibujan en cero (eje X completo, sin huecos); overlay centrado "Sin movimientos en {año}." (UI 14px `--muted`), sin ilustración ni error. La Forma 2 puede estar vacía aunque la Forma 1 tenga ingresos (Forma 2 es solo gastos).
- **Meses futuros (año en curso):** se dibujan en cero como cualquier mes vacío, sin tratamiento especial de "futuro". Los fijos/cuotas proyectados aparecen como datos normales.
- **Error:** ícono `AlertTriangle` (lucide) 20px `--warning-ink` + texto UI 14px `--ink-2` "No se pudo cargar el gráfico." + botón `.btn.ghost.sm` "Reintentar", centrado; fondo de card normal, sin tinte de error.

#### Movimiento

Las áreas/barras animan su *grow* de entrada (~0.4s ease-out). Respeta `prefers-reduced-motion` (`isAnimationActive={false}`: sin grow; tooltip sin transición).

### Toggle Barra ↔ Línea en la card `by-category` (Gastos por categoría)

La card de reporte `by-category` ("Gastos por categoría", `BarChart` apilado — Forma 2) tiene un **selector de modo** que alterna entre **dos representaciones del mismo dato** (gasto por categoría, mes a mes), sin cambiar de tipo de card ni de altura de canvas. Aplica en `/reportes` (la card del Dashboard solo monta `income-expense`, que no lleva este toggle). Ambos modos grafican **solo gastos** descompuestos por categoría (`categories[]`); cambia el **encuadre** (barras discretas vs. áreas continuas), no el dato. (`income-expense` es Total-only, sin tabs — ver abajo.)

- **Modo Barra — "Barra" (default):** las **barras apiladas** de la Forma 2 tal cual (una barra por mes, una banda `category.color` por categoría, total de gastos del mes).
- **Modo Línea — "Línea":** **un único stack de áreas apiladas** en el mismo canvas, subiendo desde cero: N áreas de gasto apiladas, una por categoría (`categories[]`), que suman la **línea de gasto del mes**, con trazo de áreas continuas `monotone`. **No hay desglose de ingresos** (no hay segundo stack, ni rótulos por tipo). **No** son barras. Usa **solo `categories[]`** (gastos) — el mismo array que el modo Barra; cambia la geometría, no la fuente.

#### 1. El selector de modo — DOS TABS horizontales en la cabecera de la card

El cambio de modo se presenta como **dos tabs ("Barra" / "Línea") una al lado de la otra, alineadas en el mismo eje X (horizontal)**, en la cabecera de la card. **No** es un segmented control: es el **patrón de tabs underline neutras**.

- **Forma de las tabs (patrón underline neutro).** Dos labels en una fila horizontal, separados por `gap-[18px]`. Cada tab: texto **13px / 600**, `py-[6px]`, sin relleno ni pista de fondo. La **tab activa** se marca con un **underline indicador 2px `--ink`** pegado al borde inferior de la fila de tabs (no semántico, no índigo) + texto a `--ink`. La **tab inactiva**: texto `--muted`, sin underline; **hover** → texto `--ink-2` y un underline 2px `--line-strong`. El underline activo **se desliza** horizontalmente entre las dos tabs (transición `transform`/`left` + `width` 0.18s ease-out; instantáneo con `prefers-reduced-motion`).
- **Por qué underline neutro y no índigo ni segmented:** las tabs eligen **modo de representación**, no un tipo income/expense ni una acción de marca. El underline `--ink` es la señal de "estás acá" más sobria del DS, y libera la cabecera de la pista gris del segmented (que competiría con el stepper, el filtro y el selector de moneda). El acento índigo **no** se usa; el verde/rojo **no** se usa (ambos modos son gasto).
- **Etiquetas:** **"Barra"** / **"Línea"**. Nombran la **geometría**, no un subconjunto de datos. Default: **"Barra"**.
- **Lado y orden en la cabecera — tabs a la IZQUIERDA, controles a la derecha.**
  - **Izquierda (zona de identidad + vista):** una columna `flex flex-col gap-[8px]` con **(1) el título editable** (16px/600, ver `card-grafico.md` *Título editable*) y **(2) debajo, las dos tabs** (`[Barra] [Línea]`). Las tabs se subordinan al título (por eso van **debajo**, no reemplazándolo). El título sigue truncando contra su ancho.
  - **Derecha (la barra de controles, sin reordenar internamente):** `[stepper de año] [selector de moneda] [· divisor + X quitar]`, con `gap-2`.
  - **Por qué las tabs van DEBAJO del título:** meterlas en la misma fila que el título las haría competir con él por el ancho de identidad y por la jerarquía. Apilarlas debajo mantiene el título como identidad de primer nivel sin romper el `justify-between`. La fila de controles de la derecha se **alinea al tope** (`items-start`) de la zona izquierda.
- **Responsive (≤940px / cabecera angosta):** los controles de la derecha envuelven a una segunda línea por el `flex-wrap`; la columna título+tabs **no cambia de forma**. Las tabs **nunca** se colapsan en un menú ni cambian a segmented.
- **a11y:** `role="tablist"` `aria-label="Representación del reporte"` con dos `role="tab"` (`aria-selected`), cada uno controlando el `role="tabpanel"` del canvas (`aria-controls` / `id`). Navegable por teclado (flechas izq/der, patrón ARIA tabs). **Focus ring:** `--accent-soft` 3px sobre la tab enfocada (cromo de interacción).
- **Solo en la card `by-category`.** `income-expense`, `unique-grid` e `installment-gantt` no llevan tabs.
- **El filtro (leyenda interactiva) y el resto de controles valen en ambos modos.** Togglear categorías por la leyenda recorta el stack de gasto. Stepper de año, selector de moneda y sus límites no cambian con el modo. El estado de filtro (`categoryIds`) y de moneda se conserva al alternar Barra↔Línea.

#### 2. El modo Línea — el stack de solo-gastos

Un **único stack de gasto** sube desde cero en el canvas, con el mismo skin de áreas continuas de la Forma 1. El color **identifica la categoría**; la **firma de gasto** la da la línea de contorno superior (regla dura 1/2 intacta).

- **Color de cada banda = `category.color` (identificador).** Nunca comunica gasto (eso lo hace la línea de contorno). No se retiñe ninguna banda con rojo expense.
- **Línea de contorno superior del stack = la firma de gasto del mes.** La suma del stack se traza como **línea de contorno superior** en `var(--expense)`, **2px**, opacidad 1, `monotone` — el mismo trazo de la línea de gasto de la Forma 1. (El modo Barra **no** lleva línea de contorno: el total del mes lo da el tope del apilado.)
- **Relleno de las bandas (fill):** cada banda con su `category.color` a **opacidad 0.55** (más sólida que el 0.14 de las áreas income/expense, porque las bandas son la descomposición que hay que distinguir entre sí). El degradé translúcido de las áreas income/expense **no** se usa en las bandas.
- **Separadores entre bandas:** 1px `var(--panel)` entre bandas apiladas (`stroke="var(--panel)"` `strokeWidth={1}`), mismo recurso que las barras de la Forma 2.
- **Orden de apilado (stack order):** **de mayor a menor gasto anual** (la mayor en la base) — `categories[]` ya viene ordenado así. **El mismo para los 12 meses.**
- **Muchas categorías — sin agrupar en v1:** igual que Forma 2.

#### 3. Leyenda en modo Línea

Reutiliza `ChartLegend` (swatch 10px radio 3px + etiqueta UI 12.5px/500 `--ink-2`, `flex-wrap`, `margin-top` 14px). **Idéntica a la del modo Barra** (mismo universo, mismo orden, mismo filtro): el toggle **no** cambia la leyenda.

- **Un único grupo plano:** un ítem por categoría de gasto, en el **mismo orden del apilado**, separación 16px, `flex-wrap`. **No** hay rótulos "Gastos"/"Ingresos" ni dos grupos. Cambiar de modo conserva su estado de filtro.
- Las cifras **no** van en la leyenda (van en el tooltip).

#### 4. Tooltip en modo Línea

Reutiliza `ChartTooltipContent` siguiendo el patrón de la Forma 2 (`Form2Tooltip`) **tal cual** — el **mismo tooltip que el modo Barra**:

- **Encabezado:** mes y año (ej. "Marzo 2026").
- **Filas:** una por categoría de **gasto** con valor > 0 en ese mes (`categories[].monthlyExpenseCents[mes]`): swatch `category.color` + nombre `--ink-2` + monto **mono** en `--ink`. Categorías con valor 0 se **omiten**.
- **Total:** fila **"Total gastos"** + monto mono `--expense-ink`, separada por `--hair`. **No** hay bloque ni total de ingresos.
- Si el mes está vacío (sin gastos), no hay tooltip.
- **Cursor de hover:** en modo Línea, guía vertical `--hair` 1px; en modo Barra, la franja vertical `--accent-soft`.

#### 5. Estados (modo Línea)

Heredan el comportamiento de la card `by-category`; sin tokens nuevos.

- **Vacío (año sin gastos):** los 12 meses en cero, overlay centrado "Sin movimientos en {año}." (UI 14px `--muted`), sin error. Si el **filtro** vacía la vista (todas las categorías deseleccionadas), mismo empty.
- **Loading:** mismo skeleton de la card (`skeletons.md`). La cabecera —incluidas las tabs— ya está presente e inerte mientras carga.
- **Error:** mismo tratamiento de la card (ícono `AlertTriangle` 20px `--warning-ink`, "No se pudo cargar el gráfico.", botón ghost "Reintentar").
- **`prefers-reduced-motion`:** las áreas apiladas **no** animan su *grow* ni al cambiar de año/modo (`isAnimationActive={false}`); el cambio entre Barra y Línea es instantáneo; el underline de las tabs no se desliza. El tooltip aparece sin transición.
- **Cambio de modo Barra↔Línea (con movimiento):** reanima el *grow* del canvas entrante (~0.4s ease-out) y el underline se desliza (0.18s). **No hay morph entre las dos geometrías**: la representación saliente desaparece y la entrante crece desde la base/cero. El año y el filtro de categorías se conservan.

#### Restricciones duras reafirmadas

- **Verde = ingreso, rojo = gasto** — en modo Línea, el rojo aparece **solo** en la **línea de contorno** del stack y en el **total** del tooltip; en modo Barra no aparece rojo salvo el total del tooltip. Nunca en las bandas/barras ni en los montos por categoría. El verde income **no** aparece en ningún modo.
- **El acento índigo no aparece en esta card** salvo el **focus ring** de las tabs y los controles. El indicador de tab activa es `--ink`.
- **Toda cifra del tooltip va en mono tabular.**

> Reutiliza: el patrón de **tabs underline neutras**; las **barras apiladas** de la Forma 2 (modo Barra); el trazo de gasto (modo Línea, contorno rojo); los **separadores 1px `--panel`** y el **orden de apilado mayor→menor estable**; `ChartLegend` y `ChartTooltipContent` (patrón `Form2Tooltip`), **compartidos** entre los dos modos.

### `income-expense` (Ingresos vs Gastos) — sin tabs, Total-only

La card `income-expense` **no tiene toggle de vista**: es **solo la vista Total** (las dos áreas superpuestas income/expense de la Forma 1). La descomposición por categoría vive en el modo Línea de `by-category`.

- **Cabecera sin fila de tabs.** La cabecera usa el molde de dos líneas descrito en *Filtros … RF-REP-014* §1 (título arriba; filtros de cómputo + `CardControls` debajo). No hay "tab Total" residual ni segmented de un solo ítem.
- **Footer = leyenda-filtro de categorías.** El footer bajo el canvas es la **leyenda-filtro de categorías tildables** — el mismo patrón que `by-category`. No es una leyenda de series: la card sigue siendo **Total-only** y **no descompone por categoría**. Tildar/destildar una categoría acota **qué movimientos alimentan las dos líneas** (filtro de cómputo, estado `null`=todas / `[]`=ninguna / lista). **Quién controla cuántas líneas se ven es la Dirección** (ver *Filtros … RF-REP-014*), no el footer. El swatch de cada categoría en el footer es un **identificador de categoría**, **no** una clave de color del canvas — ver *Leyenda interactiva*.
- **Dashboard.** El Dashboard monta `income-expense` Total-only, sin tabs. La card del Dashboard es **efímera y despojada**: **no monta los filtros de cómputo** (Dirección/Tipo/Categoría) y por ende **no lleva la leyenda-filtro de categorías en el footer**. Sus dos líneas (Dirección = Ambos) se identifican por su **color semántico** y por una **leyenda decorativa de 2 series** (color → nombre, **no interactiva**) bajo el canvas, más el tooltip. El stepper de año (activo) no cambia. *(Si análisis quisiera exponer los filtros también en el Dashboard, es decisión funcional.)*

### Filtros de tipo, dirección y categoría en `income-expense` (Ingresos vs Gastos) — RF-REP-014

La card `income-expense` tiene **tres filtros de cómputo** combinables — **Dirección** (solo gastos / solo ingresos / ambos), **Tipo de movimiento** (fijo / cuota / único, multi-selección) y **Categoría** (todas / subconjunto / ninguna) — que acotan **qué movimientos entran en las dos líneas Ingresos/Gastos**. Son **filtros de cómputo persistidos** (config de la card, clave `reports`). Dirección y Tipo van **en la cabecera** (segunda línea, cluster izquierdo); **Categoría vive en el footer** como **leyenda-filtro de categorías tildables**. El **default** es ambas direcciones · todos los tipos · todas las categorías.

> **Los tres son filtros, no breakdowns:** la card sigue siendo **Total-only**. Ninguno descompone ni apila por categoría — eso es exclusivo de `by-category`. Dirección y Tipo, por ser sets cortos y fijos, van **inline en la cabecera**; Categoría (set largo) en el footer.

#### 1. Ubicación — segunda línea de cabecera (molde de `by-category`)

La cabecera de `income-expense` adopta el **molde de dos líneas de `by-category`** (identidad arriba, controles debajo):

- **Línea 1 (ancho completo, `mb-[8px]`):** **título editable** (anatomía sin cambios).
- **Línea 2 (`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-[18px]`):**
  - **Cluster izquierdo — filtros de cómputo de cabecera (2 dimensiones):** `[ Dirección (segmented) ]  [ divisor --hair ]  [ Tipo (3 chips-toggle) ]`.
  - **Cluster derecho — `CardControls`:** `[ YearStepper ] [ divisor ] [ CardCurrencyTrigger ] [ divisor ] [ X ]`.

El cluster izquierdo es el **control de mayor jerarquía de interacción** de la card (define qué se computa); el stepper conserva su peso como nav dominante a la derecha. Entre las dos dimensiones va un **único divisor `--hair` 1px vertical** (alto 16px, `self-center`, `mx-[8px]`). **Por qué Dirección y Tipo inline y Categoría no:** Dirección y Tipo (3 valores fijos cada uno) se muestran de un vistazo inline (mismo criterio del segmented de moneda); Categoría es un set **abierto y potencialmente largo** (sin tope de cantidad), que inline saturaría la cabecera — va en el footer con scroll de alto acotado (ver *Escalado de la leyenda con muchas categorías*). Sin micro-labels visibles (la semántica de grupo va en los `aria-label`); un micro-label `--faint` por cluster es **opcional** y solo si frontend detecta ambigüedad.

#### 2. Dirección — segmented neutro de 3 (reusa el *triple switch de tipo*)

Control de **elección única** (radio). Es además el **único control de cuántas líneas muestra el canvas** (Ambos = 2 líneas; solo gastos / solo ingresos = 1 línea — ver §5). Reusa **literal** el *Triple switch de tipo (Gasto / Ingreso / Ambos)* del DS (ver `mes-listado.md` *Filtros por listado en `/mes`*):

- **Forma:** pista pill `--panel-3` (track), radio `--r-pill`, padding interno `2px`; tres segmentos de ancho igual, texto **12.5px / 600**, `px-[10px] py-[5px]`, radio `--r-pill`. Labels: **"Gastos" / "Ingresos" / "Ambos"**.
- **Segmento seleccionado:** thumb `--panel` elevado con `--shadow-sm` que **se desliza** entre las 3 posiciones (0.14s; instantáneo con `prefers-reduced-motion`). El **texto** del seleccionado toma su color semántico: **Gastos → `--expense-ink`**, **Ingresos → `--income-ink`**, **Ambos → `--accent-ink`** (marca). No viola reglas duras 1/2: es el rótulo de un control de UI, no un monto teñido.
- **Segmento no seleccionado:** texto `--muted`; hover → `--ink-2`.
- **Default:** **Ambos**.
- **a11y:** `role="radiogroup"` con tres `role="radio"` (`aria-checked`), `aria-label="Dirección"`; navegable por flechas; focus ring `--accent-soft` 3px sobre el segmento.

#### 3. Tipo de movimiento — 3 chips-toggle neutros (multi-selección)

Universo **fijo y corto de 3** valores, **multi-selección**, default los tres. **No** se usa popover/disparador: van **3 chips-toggle visibles**. Son **chips neutros** (sin swatch) — deliberadamente distintos de los ítems-swatch de la leyenda:

- **Caja:** `<button type="button">`, `inline-flex items-center`, `px-[10px] py-[5px]`, radio `--r-chip` 7px, texto UI **12.5px / 600**, `select-none`, transición 0.14s. `gap-[6px]` entre chips. Labels: **"Fijos" / "Cuotas" / "Únicos"**.
- **Seleccionado / incluido (default los tres):** fondo `--panel` + borde `1px --line-strong` + `--shadow-sm`, texto `--ink`. **Incluido = pieza elevada**.
- **No seleccionado / excluido:** fondo `--panel-2`, borde `1px --line`, **sin sombra**, texto `--muted`. Comunica on/off **sin** color ni tachado (el tachado es lenguaje de la leyenda).
- **Hover (sobre excluido):** texto → `--ink-2`, borde → `--line-strong`. **(sobre incluido):** sin cambio extra.
- **Active/pressed:** fondo `--panel-3`.
- **Focus (teclado):** ring `--accent-soft` 3px (`focus-visible`), radio `--r-chip` 7px.
- **Borde "los tres apagados":** se permite; el canvas queda vacío → empty **"Sin movimientos en {año}."**. Los chips **no** se bloquean.
- **a11y:** contenedor `role="group"` `aria-label="Tipo de movimiento"`; cada chip con **`aria-pressed`**. Toggle buttons, no radios (multi-selección).

> El chip neutro multi-selección compone la **caja de chip** (`--r-chip` 7px, fills `--panel-2`/`--panel-3`), la idea **"activo = pieza elevada blanca"** del segmented, la **escala neutra**, el **focus ring `--accent-soft`** y el **grupo de toggle buttons (`aria-pressed`)** de la leyenda. Se diferencia de los ítems de leyenda por **no llevar swatch** y comunicar off por **relleno/elevación**, no por tachado.

#### 4. Categoría — leyenda-filtro de categorías en el footer (no en la cabecera)

Universo **abierto y potencialmente largo** (sin tope de cantidad). Vive en el **footer bajo el canvas**, como la **leyenda-filtro de categorías tildables** — el mismo patrón que `by-category`. Reusa **literal** el `ChartLegend` interactivo (*Leyenda interactiva*) con su **lógica de tres estados** (`null`=todas / `[]`=ninguna / lista), idéntica a la del widget de reporte (RF-REP-002), su `LegendAllChip` "Todas/Ninguna" y su escalado con scroll de alto acotado.

- **Ítems:** uno por categoría **activa**, chip-toggle tildable (swatch 10px + nombre), `flex-wrap`, `margin-top` 14px. Tildado = la categoría alimenta el cómputo de las dos líneas; destildado = excluida.
- **El swatch es identificador de categoría, no clave de color del canvas (matiz propio de `income-expense`).** En `income-expense` el canvas son **dos líneas income/expense**, sin bandas por categoría. El swatch es el **identificador de la categoría** (recognition para tildar/destildar). **No es engañoso** porque el canvas **no contiene ningún color de categoría** (solo verde/rojo semánticos; la matriz de categoría está construida para no chocar con income/expense/acento).
- **Estado off (destildado):** mismo tratamiento que la leyenda interactiva (label `line-through` + swatch a outline + opacidad 0.7); significa **"esta categoría sale del cómputo de las dos líneas"**.
- **Empty — ninguna categoría tildada (`[]`):** canvas sin líneas → **"Sin movimientos en {año}."** (sin error). La leyenda **no se bloquea**.
- **Por qué footer y no cabecera ni popover:** decenas de categorías inline saturarían la cabecera, y un disparador+popover sería **redundante** con la leyenda del footer. El usuario fue explícito: los nombres tildables del footer, como las otras cards.

#### 5. Dirección como único control de las líneas (el corazón del spec)

**No hay leyenda interactiva de series** (sin `hiddenSeries`). **La Dirección es el único control de cuántas líneas muestra el canvas**:

- **Dirección = qué líneas se ven y qué se computa (persistido).**
  - **Ambos (default):** **2 líneas** — Ingresos (`--income`) y Gastos (`--expense`).
  - **Solo gastos:** **1 línea** — Gastos (`--expense`).
  - **Solo ingresos:** **1 línea** — Ingresos (`--income`).
- **Categorías (footer) = qué movimientos alimentan esas líneas (persistido).** Acota el **cómputo**, **sin** agregar ni quitar líneas.
- **Tipo (cabecera) = qué tipos de movimiento entran (persistido).** Igual que categorías.
- **Sin redundancia ni estado fantasma:** cuántas líneas se ven lo decide **solo** la Dirección.

#### 6. Jerarquía, estados de borde y defaults

- **Jerarquía de la cabecera:** título (identidad) → **Dirección** (segmented con thumb y semántica) → **Tipo** (chips neutros) → `[ YearStepper > moneda > X ]`. Dirección pesa más que Tipo por ser el eje que redefine cuántas líneas muestra la card. La **Categoría** es la leyenda-filtro del **footer**.
- **Default:** card sin filtros configurados ⇒ Dirección = **Ambos**, Tipo = **los tres**, Categoría = **todas** (`null`).
- **Empty / filtro vacío:** cualquier filtro vaciando el alcance — Tipo con los tres apagados, Categoría = ninguna (`[]`), o el cruce sin datos en el año — cae en **"Sin movimientos en {año}."** (sin error). Los controles no se bloquean.
- **Responsive (≤940px):** la línea 2 envuelve por su `flex-wrap`; el cluster izquierdo puede a su vez envolver (los chips de Tipo bajan bajo el segmented), y `CardControls` baja a otro renglón. El **segmented de Dirección nunca colapsa**. La leyenda-filtro del footer sigue bajo el canvas. El título queda arriba de todo.
- **Dashboard:** la card del Dashboard **no monta los filtros Dirección/Tipo/Categoría** (efímera, ya omite el selector de moneda — ver `card-grafico.md` *Moneda por reporte …* §6).

#### Restricciones duras reafirmadas

- **Verde = ingreso, rojo = gasto, estrictamente:** `--income`/`--expense` aparecen solo en el **texto del segmento Dirección seleccionado** y en las **líneas del canvas**. Los chips de Tipo son **neutros**. La leyenda-filtro usa `category.color` en sus swatches (identificador). Ningún monto se tiñe por estos controles.
- **Índigo = solo marca/cromo de interacción:** **focus ring** de segmented, chips y toggles de la leyenda-filtro, y **texto "Ambos"** del segmento Dirección. Nunca tiñe cifras. (El `LegendAllChip` es **neutro**.)
- **Mono tabular:** estos controles no muestran cifras; las del gráfico/tooltip siguen en mono tabular `tnum`.

### Leyenda interactiva (la leyenda es el filtro)

La leyenda del gráfico **es** el filtro. Cada ítem de leyenda es un **toggle clickeable**: muestra/oculta su serie en el canvas (cuando la leyenda es de series), o tilda/destilda su categoría para el cómputo (cuando es de categorías). Mismo componente `ChartLegend` interactivo, distinto contenido:

| Caso | Ítems de la leyenda | Qué togglea cada ítem |
|---|---|---|
| **`income-expense` (Ingresos vs Gastos)** | una por **categoría** (las activas; swatch `category.color` + nombre), en el orden estándar de la leyenda | tilda/destilda esa categoría para el **cómputo** de las líneas income/expense (ver *Filtros … RF-REP-014* §4). **No es un toggle de serie:** las líneas no se prenden/apagan por leyenda — cuántas hay lo decide la **Dirección** (§5). Vive en el **footer**. |
| **`by-category` (Gastos por categoría) — modo Barra** | una por **categoría** de gasto (swatch `category.color` + nombre), orden del apilado | esa banda apilada (barra) |
| **`by-category` (Gastos por categoría) — modo Línea** | una por **categoría** de gasto (swatch `category.color` + nombre), orden del apilado | esa banda del stack de áreas |

**La leyenda de `by-category` es la misma en ambos modos.** **La lógica de tres estados** del filtro de categorías es `null`=todas / `[]`=ninguna / lista (subconjunto) — **idéntica en `income-expense` y en `by-category`**. No hay popover de categorías en la card.

#### Anatomía del ítem interactivo

Cada ítem es un **`<button type="button">`**. Mantiene el contenido visual del ítem decorativo (swatch 10px radio 3px + etiqueta UI 12.5px/500), con área de hit, padding propio y estados:

- **Caja del botón:** `inline-flex items-center gap-[6px]`, padding `px-[6px] py-[4px]`, radio `--r-chip` 7px, `cursor: pointer`, `transition` de color/opacidad/fondo `0.14s`. **Margen negativo `-mx-[6px]` en el contenedor de la leyenda** para que el padding del primer/último ítem no desalinee la leyenda respecto del eje del gráfico.
- **Swatch:** cuadrado 10px radio 3px, `shrink-0`.
- **Etiqueta:** UI 12.5px/500. Color por estado (abajo). `select-none`. **No** se trunca; la leyenda usa `flex-wrap`.

#### Estados del ítem

Cinco estados; el par crítico es **activo** (incluido) vs. **apagado** (excluido).

- **Activo (reposo) — incluido:** default de todos los ítems. Swatch a **color pleno** (opacidad 1). Etiqueta `--ink-2`. Sin fondo.
- **Hover (sobre un ítem activo):** fondo `--panel-2`, etiqueta sube a `--ink`. Transición 0.14s.
- **Apagado — excluido:** tres señales simultáneas, ninguna sola alcanza (mismo principio que el ítem anulado de `/mes`):
  1. **Etiqueta `line-through`**, color a **`--muted`**. Se elige **`line-through` y no `underline`**: el subrayado se confunde con afordancia de link y compite con los underlines de las tabs; el tachado lee inequívocamente como "fuera del cómputo", coherente con el `line-through` del monto anulado del DS.
  2. **Swatch a `outline` en vez de relleno:** cuadrado con **borde 1.5px del propio color** e interior `--panel` (vacío). Mantiene la identidad del color pero comunica "no pintado en el gráfico". **No** se atenúa a gris neutro.
  3. **Opacidad del conjunto a `0.7`** sobre el botón entero. No baja de 0.7.
- **Hover (sobre un ítem apagado):** fondo `--panel-2`; la etiqueta sube de `--muted` a `--ink-2` (sigue tachada); opacidad del conjunto a `0.85`.
- **Focus (teclado):** ring `--accent-soft` 3px (`focus-visible`), radio `--r-chip` 7px. Vale igual en activo y apagado.
- **Active/pressed (clic sostenido):** fondo `--panel-3`, 0.14s.

> **Por qué el swatch va a outline y no se desatura:** el color del swatch es el **identificador** de la serie/categoría. Si al apagar se volviera gris, el usuario perdería la pista de **cuál** está re-activando. El outline conserva el hue y comunica el "off" por la **ausencia de relleno**. Las señales (swatch hueco + label tachada + atenuación) son redundantes a propósito.

#### A11y — grupo de toggles

- **Contenedor:** `role="group"` con `aria-label` por caso — **"Filtrar categorías"** (`income-expense` y `by-category`) / **"Filtrar series"** (*Inflación vs Ingresos*, leyenda de series fijas).
- **Ítem:** `<button type="button">` con **`aria-pressed`** = `true` (incluido) / `false` (excluido).
- **Texto accesible:** el contenido del botón es la etiqueta; el swatch va `aria-hidden`. El estado lo comunica `aria-pressed`, no el color.
- **Navegación por teclado:** cada ítem es tabbable; `Enter`/`Espacio` togglea. Sin roving-tabindex.
- **Borde "todas apagadas":** apagar el último ítem deja el canvas vacío → **"Sin movimientos en {año}."** (sin error). La leyenda **no se bloquea**. No hay un mínimo forzado de "al menos uno encendido".

#### Layout y espaciado al volverse interactiva

- **Posición:** debajo del canvas, `margin-top` 14px, alineada a la izquierda, `flex-wrap`. Como cada ítem trae `px-[6px]` propio, el `gap` del contenedor es **`gap-x-[10px] gap-y-[6px]`** (≈16 de aire entre swatches). El `-mx-[6px]` del contenedor compensa el padding de los extremos.
- **Sin línea divisoria ni caja:** ítems "al aire". La interactividad la comunican el cursor, el hover y el focus.
- **Skeleton de carga:** durante loading la leyenda muestra 2–3 chips fantasma, inertes (ver `skeletons.md`); no se renderizan como botones hasta que hay datos.
- **`prefers-reduced-motion`:** sin transición en el toggle. El cambio del canvas al togglear reanima el grow salvo reduced-motion.

#### Atajo "Todas / Ninguna" (select/deselect all)

El atajo de seleccionar/deseleccionar todo de un clic es un **`LegendAllChip`: un chip-comando icónico** asociado a la leyenda, en un carril fijo debajo de los chips de categoría, separado por un divisor `--hair`. Se siente parte del set de chips por forma y altura, pero está deliberadamente diferenciado (ícono en vez de swatch, sin `aria-pressed`, color neutro) para que **nunca** se confunda con una categoría. Descartado: link de texto `--accent-ink` en una micro-cabecera sobre la fila (leía como "linkcito" suelto).

- **Alcance — solo en leyendas de categorías** (`income-expense` footer y `by-category`), donde el universo es **abierto y potencialmente largo**. **No se muestra en leyendas de series** (leyenda decorativa de 2 series del Dashboard, series fijas de *Inflación vs Ingresos*): con pocos ítems un atajo no ahorra trabajo. El chrome aparece cuando resuelve un problema real, no por simetría.

- **Forma — chip-comando icónico, hermano de los chips de leyenda pero no uno de ellos.** `<button type="button">` con la **misma anatomía de caja** que un ítem de leyenda (`inline-flex items-center gap-[6px]`, radio `--r-chip` 7px, `cursor:pointer`, `transition .14s`). Difiere en tres cosas que lo marcan como **comando**:
  1. **Ícono en lugar de swatch de color.** Ícono 13px (`--muted` en reposo) a la izquierda del rótulo; cambia con el estado/acción (abajo). Un chip con ícono es un control; un chip con swatch es un ítem de datos.
  2. **Rótulo UI 12px / 600** (vs. 12.5px/500 de la leyenda). `select-none`. **Nunca** tachado ni con swatch hueco.
  3. **Padding `px-[8px] py-[4px]`** (vs. `px-[6px]` del ítem).

- **Ubicación — en un carril fijo, fuera del área que scrollea, separado por un divisor.** No fluye dentro del `flex-wrap` de los toggles: vive en un **carril propio, fijo, siempre visible**. La estructura DOM autoritativa está en *Escalado de la leyenda con muchas categorías* (abajo). Entre el set de chips y el `LegendAllChip` va un **divisor `--hair` `1px`**: **horizontal** a lo ancho del bloque (`my-[8px]`) en el stack vertical (forma canónica), o **vertical** (alto 16px, `self-center`, `mx-[8px]`) solo en el fallback opcional de fila única. El divisor **declara "lo que sigue no es una categoría más"**. La leyenda conserva `margin-top: 14px` respecto del canvas y el `-mx-[6px]`.
  - **Por qué fuera del scroll:** como último chip del wrap, con muchas categorías caería 4–6 renglones abajo, **enterrado**. En su carril fijo queda alcanzable sin scrollear.
  - **El divisor pertenece al chip-comando:** se renderiza en el mismo subárbol que el `LegendAllChip`; si el chip no se muestra, tampoco hay divisor colgando.

- **Tratamiento visual con peso de control discreto.** Fondo **sutil permanente**:
  - **Reposo:** fondo **`--panel-2`**, ícono `--muted`, rótulo `--ink-2`. Sin borde ni sombra.
  - **Hover:** fondo **`--panel-3`**, ícono y rótulo a **`--ink`**. `.14s`. Sin `underline`.
  - **Active/pressed:** fondo `--panel-3` + el cambio inmediato de los swatches de toda la leyenda, más el flip de ícono/label.
  - **Focus (teclado):** ring **`--accent-soft` 3px** (`focus-visible`), radio `--r-chip` 7px.
  - **Color del rótulo — neutro, NO `--accent-ink`.** El chip se apoya en el **fondo** para su afordancia y usa la escala neutra (`--ink-2`→`--ink`).

- **Label e ícono invertidos según estado.** El chip **anticipa la acción que ejecutará**, no el estado actual:
  - Si **todas** las categorías están activas (`hiddenIds` vacío) → **"Ninguna"** + **`EyeOff`** (13px). Clic = apagar todas → estado `[]`.
  - Si hay **alguna apagada** (incluye "todas apagadas" y cualquier subconjunto) → **"Todas"** + **`Eye`** (13px). Clic = encender todas → estado `null`.
  - El **flip ícono+label es la micro-interacción** (`transition` de color `.14s`, sin animación de layout; el ancho puede variar 1–2px, no se fija ancho).
  - Misma **lógica de tres estados** (`null`/`[]`/subconjunto); el chip solo salta a los dos extremos.

- **A11y:**
  - `<button type="button">` **fuera** del `role="group"` de los toggles — es un **comando sobre el grupo**. **El `role="group"` envuelve solo los chips de categoría** (dentro de la región scrolleable); el `LegendAllChip` y su divisor son **hermanos del group**, en el carril fijo.
  - **No** lleva `aria-pressed`. El ícono va `aria-hidden`.
  - `aria-label` explícito: **`"Mostrar todas las categorías"`** cuando el rótulo es "Todas", **`"Ocultar todas las categorías"`** cuando es "Ninguna".
  - **Orden de tab:** **después** de los toggles de categoría. El divisor es decorativo (`aria-hidden`, no focusable).

- **Robustez con pocas / muchas categorías y card angosta.** Con **pocas** categorías: región sin scroll (1–2 renglones) + carril del comando debajo, separados por la regla horizontal — sin fade, sin scrollbar. Con **muchas**: el chip queda fijo en su carril; la región de toggles recorta a 3 renglones. En **card angosta** el `max-h-[84px]` acota igual y el chip no crece de ancho — sin overflow horizontal, sin truncado, sin ancho fijo.

#### Escalado de la leyenda con muchas categorías

Las categorías del usuario **no tienen tope duro** (la matriz de color tiene 40 entradas — 8 hues × 5 tonalidades, RN-013 — y los colores pueden repetirse entre categorías). Sin un tope de alto, la leyenda-filtro se vuelve una fila `flex-wrap` de **4–6+ renglones** que hace crecer la card sin límite; en `/reportes` hay **varias cards apiladas**, así que el sprawl vertical es grave. **Aplica solo a las leyendas de categorías**; las leyendas de series **no usan nada de esto** (ni región scrolleable, ni carril fijo, ni `LegendAllChip`).

**Opciones evaluadas:**

| Opción | Lectura con 30+ cats | Alto de card | Atajo "Todas/Ninguna" | Gráfico apilado | Veredicto |
|---|---|---|---|---|---|
| **(a) Región con `max-h` + scroll interno** | el universo entero a **un gesto de scroll**; sin estados ocultos que recordar | **acotado y constante** (3 renglones), idéntico con 6 o 60 cats | puede **fijarse fuera del scroll** (carril propio) → nunca enterrado | sin cambios | **elegida** (combinada con carril fijo) |
| **(b) Cap visual "+N más" que expande** | hay que **expandir** para ver/filtrar la cola; "+12 más" es mal affordance *para filtrar* | **vuelve a crecer ilimitado** al expandir | el atajo queda **antes o después del cap** → o se entierra, o filtra sobre un set parcial | igual | descartada |
| **(c) Solo carril fijo, sin tope de alto** | toda la leyenda visible pero | **sprawl vertical sin límite** | siempre visible, pero la card sigue rota | igual | descartada |

**Opción elegida: (a) + carril fijo.** El scroll de alto fijo es además el patrón del popover de categorías de `/mes` — coherencia de vocabulario.

- **Umbral — por alto, no por conteo.** La región tiene un **alto máximo en renglones**. Mientras los chips entran en **≤ 3 renglones** se ve como una leyenda simple (sin scroll, sin fade, sin scrollbar). Lo que rompe la card es la **altura**, que depende de cuántos chips entran por renglón (ancho de card y largo de nombres).
  - **Alto máximo concreto:** **`max-height` = 3 renglones de chip** ≈ **`84px`** (3 × ~28px, con su `gap-y-[6px]`). Si el alto real del chip difiere, frontend ajusta para que cuadre 3 renglones exactos (la intención es "3 renglones visibles").

- **Contenedor scrolleable (los chips de categoría).** El `role="group"` se envuelve en una **región scrolleable**:
  - `max-h-[84px]` + `overflow-y-auto` + `overflow-x-hidden`. El `flex-wrap` vive **dentro**; conserva `gap-x-[10px] gap-y-[6px]` y `-mx-[6px]` (el `-mx` va en el wrap interno, no en la región, para que el scrollbar no coma la alineación).
  - **Padding para el scrollbar:** `pr-[2px]` (o el ancho del scrollbar overlay).
  - **Fade inferior como señal de "hay más".** Con contenido por debajo del corte, un **fade de 16px** en el borde inferior vía `mask-image: linear-gradient(to bottom, black, transparent)` sobre los últimos 16px (**no** una capa de color encima).
    - **Cuándo aparece:** solo cuando `scrollHeight > clientHeight`. Frontend lo mide por render del set de chips (y en resize) y lo expone como `data-overflow="true"`; el fade se ata a ese atributo vía CSS.
    - **Atenuación al fondo (opcional):** idealmente se apaga al llegar al final del scroll; **es aceptable un fade estático** mientras `data-overflow` sea true.
    - **El fade vive DENTRO de la región scrolleable**: el `LegendAllChip` queda debajo del fade, en el carril fijo, intacto y nítido.
  - **Scrollbar:** el del SO/overlay; sin scrollbar custom. Lo que comunica "hay más" es el **fade**.
  - **Sin caja ni borde:** sigue siendo "chips al aire". Se lee como "la misma leyenda, con tope de alto".

- **Estructura DOM única (no dos árboles).** El bloque de leyenda de categorías es **siempre el mismo stack vertical de dos partes**:
  ```
  <div bloque-leyenda>                    ← mt-[14px], stack vertical
    <div región-scroll  max-h-[84px]      ← chips de categoría
         overflow-y-auto overflow-x-hidden
         data-overflow={true|false}>      ← marca de overflow (controla fade)
      <div role="group" flex-wrap -mx-[6px] gap-x-[10px] gap-y-[6px]>
        <button aria-pressed> … chips …
      </div>
    </div>
    <div carril-comando -ml-[8px]>         ← [divisor][LegendAllChip], NUNCA scrollea
  </div>
  ```
  El carril del comando es `flex` alineado a la izquierda; el `LegendAllChip` lleva su `px-[8px]` propio, así que el carril compensa con `-ml-[8px]` para alinear el ícono al eje del gráfico. El divisor horizontal va **antes** del chip, a lo ancho completo (sin el `-ml`).
  La **única** diferencia visible entre "pocas" y "muchas" la produce el **`max-height` y el overflow del navegador**, no un cambio de árbol. **No se anima** el paso de un estado a otro.

- **El divisor del carril es siempre horizontal** en el stack (`1px --hair`, `my-[8px]`). Es vertical solo en el *fallback de fila única*.

- **Fallback de fila única para pocas categorías (opcional, no obligatorio).** El stack vertical **ya cubre correctamente** el caso de pocas categorías y es la forma canónica. "Chips + divisor vertical 16px + chip, todo en una línea" queda como **variante estética no bloqueante** para cuando la leyenda entra en 1 renglón holgado (conmutada por overflow=false **y** una sola fila renderizada). Se prioriza **una estructura estable y correcta**.

- **A11y de la región scrolleable.**
  - **Foco dentro del scroll:** al tabular hacia un chip fuera de la ventana visible, el navegador **auto-scrollea** la región (nativo).
  - **Orden de tab:** chips de categoría (orden del apilado) y **al final** el `LegendAllChip`, alcanzable por teclado sin scroll intermedio.
  - **El `role="group"`** envuelve **solo** los chips de categoría; el `LegendAllChip` y el divisor son **hermanos del group**.
  - **Región scrolleable:** no es landmark ni `role` nuevo; sin `tabindex={0}` propio. Fade y scrollbar son decorativos.

- **Coherencia con el popover "Todas/Ninguna" de `/mes`.** Misma familia, no idéntico. Comparten el **área scrolleable de alto fijo** (`max-h` ~280px allá; ~84px / 3 renglones acá) y la **semántica "Todas/Ninguna" de tres estados**. Difieren en la **piel**: el popover de `/mes` es una superficie flotante con filas-checkbox y "Todas/Ninguna" como **link `--accent-ink`** en un header fijo; la leyenda es **inline**, con chips-toggle y **`LegendAllChip` icónico neutro** en carril fijo. Principio común: **el select/deselect-all nunca se entierra detrás del scroll**.

> **Riesgo abierto (no es spec) — legibilidad del gráfico apilado con muchas series.** Con ~30+ categorías apiladas, cada banda se vuelve un hilo indistinguible, y pasadas las 40 la matriz (RN-013) obliga a repetir colores entre bandas. Mitigaciones a evaluar **por separado** (decisiones funcionales, no del filtro): (i) *top-N + "Otras"* en el canvas manteniendo la leyenda-filtro completa; (ii) default del filtro con muchas categorías mostrando top-N y el resto apagado.

### Filtro de categorías embebido (checklist en popover)

> Este patrón disparador+popover **no se usa en la card de reporte** (ahí el filtro es la *Leyenda interactiva*). **Sigue vigente** dentro del *Filtro por listado en `/mes`* (bloque categorías del popover de sección, ver `mes-listado.md`). La lógica de tres estados (`null`=todas / `[]`=ninguna / lista) es la misma.

Control reutilizable para filtrar por categorías sin tapar el contenido. Botón disparador + popover con checklist.

- **Disparador:** botón ghost chico (`.btn.ghost.sm`), ícono `SlidersHorizontal` 15px. Rótulo **"Categorías"** (default, todas) / **"Categorías · N"** (subconjunto, `· N` mono `--ink`) / **"Categorías · 0"** (ninguna). Con filtro activo: ícono+texto suben a `--ink` y aparece un **punto indicador 6px `--accent`** (cromo de UI, no monto).
- **Popover:** `--panel`, `--line`, `--r-ctl`, `--shadow-lg`, ancho 260px, `max-height ~320px` con scroll interno (header/footer fijos). Header: label "Mostrar categorías" + toggle "Todas"/"Ninguna" (link `--accent-ink`). Filas: checkbox del DS + **swatch de color 10px radio 3px** + nombre 13px (`--ink` tildada / `--ink-2` destildada). El universo son las categorías **activas**. Filtro **en vivo** (sin Aplicar/Cancelar); cierra por clic fuera / `Esc` / re-clic.
