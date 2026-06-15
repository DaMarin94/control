# Guía de diseño — Control

> Guía **viva** del lenguaje visual de Control. Es la versión **curada y vigente** de cómo se ve el producto: la fuente de verdad de las decisiones visuales que `control-design` mantiene y que `control-frontend` implementa.
>
> **Relación con los otros documentos de diseño:**
> - **`docs/design/`** — handoff crudo "Precise Ledger" (`control.css` + `README.md`): el material de origen del prototipo, con todos los valores y la racional. Es la referencia de donde sale esta guía; no se edita.
> - **`docs/frontend.md`** (secciones Design system) — cómo los tokens están **implementados** en el código (Tailwind v4, dualidad `@theme`/`:root`, qué está portado). El "cómo" técnico.
> - **`docs/design.md`** (este documento) — el "qué" visual vigente: paleta, tipografía, espaciado, geometría, jerarquía y las reglas duras. Ante un conflicto con el handoff crudo, prevalece lo cerrado acá.
>
> Sistema vigente: **"Precise Ledger"**, modo claro, preset de densidad Medio, acento Índigo. (Dark mode y densidad variable no están vigentes en v1.)

---

## Reglas duras

No se negocian sin decisión explícita del usuario:

1. **Verde = ingreso, Rojo = gasto.** Reservados **estrictamente** para ese significado semántico. No se usan para decorar ni para otra cosa.
2. **El acento índigo es solo marca.** NUNCA se usa para montos ni para teñir cifras de dinero.
3. **Toda cifra de dinero va en mono tabular** (IBM Plex Mono + `font-feature-settings: "tnum" 1`). Sin excepción.

---

## Paleta y uso de tokens

> Valores definidos en `docs/design/control.css` con `oklch()`. Hex aproximados solo como referencia rápida — preferir los valores oklch.

### Acento de marca — Índigo (default)

El acento se controla por una sola variable de tono: `--accent-h: 264`. Cambiar el hue regenera toda la familia.

| Token | Light | Uso |
|---|---|---|
| `--accent` | `oklch(0.52 0.17 264)` | acción primaria, marca |
| `--accent-press` | `oklch(0.45 0.17 264)` | estado pressed |
| `--accent-soft` | `oklch(0.95 0.035 264)` | fondos suaves, focus ring |
| `--accent-ink` | `oklch(0.40 0.16 264)` | texto sobre fondo claro |

**El acento es solo marca** (botones primarios, item de nav activo, año del título, badge de alcance "ambos"). **Nunca tiñe montos.**

### Semánticos — income / expense (NO cambian con el acento)

Verde = ingreso, Rojo = gasto. Reservados estrictos.

| Token | Light | Aprox hex |
|---|---|---|
| `--income` | `oklch(0.58 0.12 158)` | `#1f8a5b` |
| `--income-soft` | `oklch(0.95 0.04 158)` | `#e3f4ea` |
| `--income-ink` | `oklch(0.45 0.11 158)` | `#1c6e49` |
| `--expense` | `oklch(0.57 0.16 27)` | `#c64637` |
| `--expense-soft` | `oklch(0.95 0.035 27)` | `#f7e6e3` |
| `--expense-ink` | `oklch(0.47 0.15 27)` | `#a23a2d` |

**`warning` (ámbar, hue 75)** — token semántico agregado a la implementación porque el DS original no tenía ámbar: `--warning` `oklch(0.72 0.15 75)`, `-soft` `oklch(0.95 0.05 75)`, `-ink` `oklch(0.52 0.12 75)`. Sigue la misma dualidad `@theme`/`:root` que income/expense.

### Neutros

| Token | Light | Uso |
|---|---|---|
| `--paper` | `oklch(0.965 0.004 270)` | fondo de app |
| `--panel` | `#ffffff` | tarjetas / superficies |
| `--panel-2` | `oklch(0.975 0.004 270)` | hover sutil |
| `--panel-3` | `oklch(0.955 0.005 270)` | chips / fills |
| `--ink` | `oklch(0.22 0.012 270)` | texto principal |
| `--ink-2` | `oklch(0.40 0.012 270)` | texto secundario |
| `--muted` | `oklch(0.55 0.012 270)` | texto terciario |
| `--faint` | `oklch(0.70 0.010 270)` | placeholders |
| `--hair` | `ink / 0.10` | divisores internos |
| `--line` | `ink / 0.17` | bordes de tarjeta |
| `--line-strong` | `ink / 0.28` | bordes de input |

---

## Tipografía

- **UI / títulos:** `"Space Grotesk"`, pesos 400/500/600/700.
- **Cifras / fechas / montos:** `"IBM Plex Mono"`, pesos 400/500/600, con `font-feature-settings: "tnum" 1` (cifras tabulares) y `letter-spacing: -.01em`. **Toda cantidad de dinero va en mono** (regla dura 3).
- Base body: 15px / line-height 1.45.

### Escala de texto (roles)

| Rol | Size | Weight | Tracking |
|---|---|---|---|
| H1 página (`Junio 2026`) | 32px | 700 | -.02em |
| Balance hero (cifra) | 46px | 600 | -.025em |
| Stat valor | 30px | 600 | -.02em |
| Título de diálogo | 18px | 700 | -.01em |
| Nombre de movimiento | 14.5px | 600 | -.01em |
| Monto en fila | 15.5px | 600 | — |
| Eyebrow / labels | 12px | 600 | .1em, uppercase |
| Group header (Únicos…) | 13px | 700 | .1em, uppercase |
| Meta / subtítulos | 12.5px | 500 | — |

---

## Espaciado y densidad

- **Escala de espaciado:** 4, 6, 7, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 40 px.
- **Densidad — preset Medio (vigente):** `--row-pad` (fila de lista) **14**, `--card-pad` (interior de tarjeta) **22**, `--gap` (separación de grid) **18**. Los presets Compacto (10/16/13) y Amplio (18/28/24) del prototipo **no están vigentes**; la densidad es fija en v1.

---

## Geometría (radios)

Valores vigentes (preset Medio):

| Token | Vigente (Medio) | Uso |
|---|---|---|
| `--r-card` | 14px | tarjetas |
| `--r-ctl` | 10px | botones / inputs |
| `--r-chip` | 7px | chips / badges |
| `--r-pill` | 999px | pills / steppers |

Diálogos usan radio fijo **18px**; el logo gem **10px**; el avatar **50%**.

---

## Sombras

Compuestas (multi-capa), se consumen como `var(--shadow-sm|md|lg)`:

- `--shadow-sm` — tarjetas, botones.
- `--shadow-md` — hover, balance hero.
- `--shadow-lg` — modales, toast, panel.

Los botones primarios suman un **inset highlight** `white/0.2` arriba.

---

## Focus ring

Foco visible del DS: anillo de 3px en `--accent-soft` (`shadow-[0_0_0_3px_var(--accent-soft)]`). En estado de error el anillo usa `--expense-soft`.

---

## Principios de jerarquía y layout

- **Desktop-first.** El target principal es desktop web. En ≤940px la sidebar se oculta (nav mobile pendiente) y el login pasa a 1 columna.
- **Jerarquía por peso + tamaño + color, no por decoración.** El monto y los totales dominan visualmente; la meta (categoría, fecha, contadores) va en neutros terciarios.
- **Semántica antes que estética:** el color de un monto comunica ingreso/gasto, nunca es decorativo.
- **Movimiento sobrio:** entrada de pantalla fade + translateY (.32s), modal `pop` (scale .98→1, .22s), toast slide-up (.3s), hover .14s. Respetar `prefers-reduced-motion`.

---

## Paleta de colores para categorías — RESUELTO (2026-06-14)

Las categorías **no tienen una paleta propia definida en el DS**: cada categoría trae **su color asignado por el backend** desde un pool fijo de 10 colores (RF-CAT-005 / RN-013), embebido en el dato como `category.color`. El DS **consume** ese color tal cual; no lo reasigna, no lo retiñe, no inventa swatches alternativos.

El pool es la fuente de verdad (`backend/src/categories/color-pool.ts`). Valores vigentes (no se cambian acá):

| # | Hex | Nombre |
|---|---|---|
| 1 | `#4F86C6` | azul |
| 2 | `#E07B54` | naranja |
| 3 | `#6DBF67` | verde |
| 4 | `#A98BD6` | violeta |
| 5 | `#E8C84A` | amarillo |
| 6 | `#5BC4B8` | turquesa |
| 7 | `#E06B8B` | rosa |
| 8 | `#8B9DBF` | azul grisáceo |
| 9 | `#C47D3E` | marrón |
| 10 | `#7DBF9E` | verde menta |

**Convivencia con las reglas duras:** el pool fue elegido para **no chocar** con los semánticos ni con la marca: ninguno es el verde income (`#1f8a5b`), el rojo expense (`#c64637`) ni el índigo de acento. El `#6DBF67` (verde) y el `#E07B54` (naranja) son tonos claramente distintos de los semánticos, por lo que se usan sin reserva como color de categoría. **Regla:** el color de categoría se usa **solo** como identificador de categoría (swatch en la lista, bandas del apilado de la Forma 2 del gráfico). Nunca se usa para teñir un monto ni para comunicar ingreso/gasto — eso lo siguen haciendo income/expense.

**Dónde se consume hoy:** swatch de la fila de categoría (pantalla `/categorias`, 14px radio 5px) y bandas del gráfico anual Forma 2 (ver sección siguiente).

---

## Gráfico anual — spec visual del widget

> Spec del widget de gráfico anual (RF-GRA-001/002/003, pantallas 7 y 8 de `screens.md`). **Dos visualizaciones que son dos recuadros (`.card`) separados, ambos visibles a la vez — sin toggle, sin "forma por defecto", sin morph entre formas.** Forma 1 (Ingresos vs. Gastos) se monta sola en el Dashboard (año fijo); Forma 1 + Forma 2 (Gastos por categoría) se montan apiladas en `/anual` (con navegación de año compartida). Cada recuadro es un componente reutilizable configurable por props. **Librería destino: Tremor Raw (Recharts por debajo).** Esta sección define lo visual; la conducta funcional vive en los RF citados y no se redefine acá.

### Dos recuadros independientes (no un widget con toggle)

Cada visualización es una **tarjeta `.card` propia y autónoma** (panel blanco, `--line`, `--r-card` 14px, `--shadow-sm`), con padding interior `--card-pad` (22px), su propia cabecera, su propio gráfico, su propia leyenda y sus propios estados. No hay un contenedor padre que las una ni un control que alterne entre ellas: son dos paneles separados. En el Dashboard se monta **solo** la tarjeta de Forma 1; en `/anual`, las dos tarjetas **apiladas** (Forma 1 arriba, Forma 2 abajo). El control de año, cuando existe, es **compartido** y vive fuera de las tarjetas (ver "Control de año compartido").

### Contenedor y cabecera de cada tarjeta

**Estructura interna de cada tarjeta (de arriba hacia abajo):**

1. **Barra de cabecera de la tarjeta** — fila flex `space-between`, `align-items: center`, alto natural, `margin-bottom` 18px (`--gap`):
   - **Izquierda:** identidad de la tarjeta. Eyebrow uppercase (rol *Eyebrow/labels*: 12px/600, `.1em`, uppercase, `--muted`) "Resumen anual" + **título de la tarjeta** debajo (rol de título de tarjeta, UI font 16px/600 `--ink`):
     - Tarjeta de Forma 1 → **"Ingresos y gastos"**.
     - Tarjeta de Forma 2 → **"Por categoría"**.
     (Son los rótulos que antes etiquetaban el toggle; ahora titulan cada recuadro.)
   - **Derecha:** **solo en el Dashboard** (Forma 1, año fijo, sin navegación) el **año** aparece acá como cifra **mono tabular** (es un número), peso 600, ~20px, color `--ink`. En `/anual` la cabecera de cada tarjeta **no** lleva año suelto: el año lo gobierna el control compartido del header de página (ver abajo), y la zona derecha de la cabecera queda vacía.
2. **Área del gráfico** — el chart propiamente dicho.
3. **Leyenda** — debajo del área del gráfico (ver "Leyenda").

> Ya no hay toggle de Forma en la cabecera. Ver "Responsive" para el colapso de la cabecera.

### Alto y proporción del área de gráfico

- **Dashboard (`/`), tarjeta de Forma 1:** **280px** fijo en desktop. Es suficiente para leer 12 meses sin que el recuadro domine la página. (Se conserva el alto que ya tenía el recuadro de ingresos/gastos del dashboard.)
- **`/anual`, cada una de las dos tarjetas:** **300px** fijo en desktop, por tarjeta. Como ahora son dos recuadros apilados (antes era uno solo a 340px), 300px da aire de pantalla dedicada a cada gráfico sin que la columna total se vuelva excesivamente alta. Ambas tarjetas usan el mismo alto de canvas (300px) para que se lean como un par homogéneo.
- **Ancho:** 100% del contenedor (responsive container de Recharts), en ambos anfitriones.
- El alto **no** incluye la cabecera ni la leyenda; esas suman por fuera, en cada tarjeta.

### Forma 1 — Ingresos vs. Gastos

**Tipo de gráfico: área (`AreaChart` de Tremor/Recharts), dos series superpuestas, NO apiladas.** Justificación: las dos series (ingresos, gastos) son magnitudes que el usuario compara mes a mes; el área comunica volumen y deja ver de un vistazo cuándo ingreso supera a gasto. No se apilan porque son dos lecturas independientes (no suman un total con sentido). Es el patrón de la imagen de referencia del usuario, pero con la semántica del DS.

**Mapeo de color (regla dura 1):**

| Serie | Stroke (línea) | Fill (área) | Opacidad de fill |
|---|---|---|---|
| **Ingresos** | `var(--income)` (`#1f8a5b`) | `var(--income)` | **0.14** |
| **Gastos** | `var(--expense)` (`#c64637`) | `var(--expense)` | **0.14** |

- **Stroke:** 2px, sólido, opacidad 1. Sin punteado.
- **Fill:** relleno plano a opacidad 0.14 (translúcido para que ambas áreas se lean aunque se solapen). Recharts admite un `fillOpacity`; si se usa gradiente, que sea del **mismo hue** del token, de 0.18 (arriba) a 0.02 (abajo) — pero el plano a 0.14 es la opción canónica y suficiente.
- **Orden de pintado:** gastos primero (debajo), ingresos después (encima), para que la lectura "¿me sobró?" (verde sobre rojo) quede arriba. Como ambos son translúcidos, el solape se ve igual en cualquier orden; este orden es la preferencia.
- **Puntos (dots):** ocultos en reposo; visibles solo en hover del punto activo (Recharts `activeDot`), radio 4px, relleno del color de la serie, borde `--panel` 2px.
- **Curva:** `monotone` (suavizado suave), no `linear` con esquinas duras, para un trazo sobrio coherente con el DS.

**Prohibido:** teñir cualquiera de estas series con el acento índigo o con un color de categoría. Income = verde, expense = rojo, sin excepción.

### Forma 2 — Gastos por categoría (apilado)

**Tipo de gráfico: barras apiladas (`BarChart` apilado de Tremor/Recharts), una barra por mes, una banda por categoría.** Justificación: el apilado por categoría es una **descomposición de un total** (las bandas de un mes suman el total de gastos del mes). Las **barras apiladas** comunican esa descomposición discreta mes-a-mes mucho mejor que un área apilada: cada banda es un rectángulo nítido, fácil de leer y de asociar a su categoría por color, y los meses en cero se ven como ausencia de barra sin ambigüedad. El área apilada, en cambio, sugiere continuidad/flujo entre meses que acá no aplica (cada mes es una cuenta cerrada). Por eso **Forma 2 = barras apiladas**, aunque Forma 1 sea área.

**Mapeo de color:** cada banda usa **`category.color`** tal cual viene del dato (pool de 10, ver sección anterior). El gráfico **no** reasigna ni retiñe. Una categoría soft-deleted que todavía tiene gastos en el año sigue apareciendo con su color (RF-GRA-001).

**Guía de uso del apilado (sin cambiar los valores del pool):**

- **Orden de apilado (stack order):** determinístico y estable entre meses — apilar **de mayor a menor gasto anual total** de cada categoría (la categoría que más gastó en el año queda en la base de cada barra). El orden es el **mismo para los 12 meses** (no se reordena por mes), para que el ojo siga cada banda horizontalmente. La categoría "más grande" abajo da una base visual estable.
- **Separadores entre bandas:** 1px de separación con el color del panel (`--panel`, blanco) entre bandas apiladas, para que dos categorías de color parecido no se fundan. En Recharts se logra con un `stroke="var(--panel)"` + `strokeWidth={1}` por banda, o un pequeño `gap`. La banda inferior y superior de cada barra llevan el redondeo de la barra (ver abajo); las intermedias, cantos rectos.
- **Redondeo de barra:** la barra apilada completa lleva `--r-chip` (7px) **solo en la esquina superior** del segmento más alto (top del stack). El resto, cantos rectos. Si Recharts complica el redondeo selectivo, aceptable: barras de cantos rectos (0px) — la prioridad es la legibilidad de las bandas, no el redondeo.
- **Ancho de barra / gap entre meses:** barras con `barCategoryGap` ~25–30% para que las 12 barras respiren; ancho de barra el que resulte (no fijar px).
- **Muchas categorías (legibilidad) — sin agrupar en v1:** en v1, Forma 2 muestra **TODAS las categorías con gasto en el año, cada una en su propia banda, sin agrupar ni colapsar** — fiel a RF-GRA-001 ("una banda por categoría"). El gráfico no introduce ninguna regla de agregación que altere los datos. Notas de legibilidad cuando hay muchas categorías (todas puramente visuales, no cambian los valores):
  - **Orden de apilado** como ya se definió (mayor a menor gasto anual, estable entre meses): concentra las bandas grandes en la base y deja las finas arriba, donde el ojo ya espera detalle menor.
  - **Separadores de 1px `--panel`** entre bandas (ya definido): clave justamente cuando hay muchas categorías y colores del pool reciclados, para que dos bandas de color parecido no se fundan.
  - **Leyenda con `flex-wrap`** (ver "Leyenda"): absorbe muchos ítems envolviendo en varias filas, sin truncar.
  - *(Post-v1, candidato a evaluar: una banda "Otras" que agrupe la cola de categorías de menor gasto. Queda fuera de la spec de v1 por ser una agregación que cambia la lectura del dato; no se implementa hasta decisión explícita.)*

**Prohibido:** usar income/expense o el acento para las bandas. Las bandas son color de categoría; el rojo expense **no** se usa acá aunque sean gastos (el rojo semántico es para el monto/serie de gasto agregada, no para descomponer).

### Ejes

- **Eje X (meses):** etiquetas con el **nombre corto del mes en es-AR**: `Ene Feb Mar Abr May Jun Jul Ago Sep Oct Nov Dic`. Tipografía UI (Space Grotesk), 12px, peso 500, color `--muted`. Sin rotación (deben entrar los 12 en desktop). Línea de eje (`axisLine`) y ticks (`tickLine`) **ocultos**; solo las etiquetas.
- **Eje Y (monto):** cifras en **mono tabular** (regla dura 3) — IBM Plex Mono + `tnum`, 11.5px, color `--muted`. **Formato abreviado** para no saturar: `$0`, `$50k`, `$120k`, `$2,5M` (k = miles, M = millones; separador decimal coma es-AR; prefijo `$`). El monto completo sin abreviar aparece en el **tooltip**, no en el eje. Eje Y sin línea ni ticks visibles. 4–5 ticks como máximo (Recharts `tickCount`), redondeados a valores "lindos".
- **Gridlines:** solo **horizontales**, color `--hair` (`ink/0.10`), 1px, sólidas. Sin gridlines verticales (los meses ya se separan por las etiquetas/barras). La línea base (y=0) puede ser levemente más marcada (`--line`).

### Control de año ‹ › compartido (`/anual`)

En `/anual` hay **un único control de año** que gobierna **las dos tarjetas a la vez**. Para que se lea inequívocamente como compartido (y no como propiedad de una de las dos tarjetas), vive en el **header de página `.phead`**, por encima del par de tarjetas, no dentro de ninguna de ellas.

- **Ubicación dentro del `.phead`:** fila flex `space-between`, `align-items: center`. A la **izquierda**, el bloque de título de página (eyebrow "Tu actividad" + H1 "Anual"). A la **derecha**, el control de año ‹ ›, alineado al baseline/centro del H1. Así un único stepper preside ambos recuadros y se entiende que los mueve juntos.
- **Patrón del control:** reutiliza **`.stepper`** del DS (el navegador de mes): pill (`--r-pill`) `--panel` con borde `--line` y `--shadow-sm`, padding 4px; dos botones circulares 32px (chevron-left / chevron-right) con ícono `--ink-2` que pasa a `--ink` sobre fondo `--panel-2` en hover; en el centro, el **año** como label mono tabular (es un número), 14.5px/600, `min-width` ~64px centrado. Sin la sub-línea "Mes en curso" del stepper de mes (acá no aplica).
- **Estados de los chevrons (límites de RF-GRA-003) — se mantienen:**
  - **‹ deshabilitado** cuando el año mostrado es el primer año con movimientos del usuario (`earliestYear`, no se navega más atrás): chevron en `--faint`, `cursor: default`, sin hover, `opacity` 0.45. No se oculta — se ve presente pero apagado.
  - **› deshabilitado** cuando el año mostrado es el año en curso (no se navega al futuro): mismo tratamiento apagado.
- **Año en las tarjetas:** como el año vive en el `.phead`, las cabeceras de las dos tarjetas de `/anual` **no** repiten el año suelto (su zona derecha queda vacía). El año es uno solo y se lee en el control compartido.

### Año en el Dashboard (sin control)

En el Dashboard la navegación de año está **deshabilitada**: **no se renderiza** ningún stepper. El **año actual** aparece como cifra **mono tabular** suelta en la **zona derecha de la cabecera** de la única tarjeta (Forma 1), peso 600 ~20px `--ink`. No se muestra un stepper deshabilitado ni un control inerte.

### Leyenda

- **Ubicación:** debajo del área de gráfico, alineada al inicio (izquierda), `margin-top` 14px, separada del chart por aire (no por línea).
- **Ítem de leyenda:** swatch + etiqueta. Swatch cuadrado 10px radio 3px (más chico que el de `/categorias`) con el color de la serie/categoría; etiqueta UI 12.5px/500 `--ink-2`. Separación entre ítems 16px, `flex-wrap` permitido.
- **Forma 1:** dos ítems — "Ingresos" (swatch `--income`) y "Gastos" (swatch `--expense`).
- **Forma 2:** un ítem por categoría con gasto en el año, en el **mismo orden del apilado** (mayor a menor); cada swatch con su `category.color`. Un ítem por categoría: no se agrupa ni se colapsa (ver "Forma 2", sin agrupar en v1). Si hay muchos ítems, la leyenda envuelve (`flex-wrap`).
- Las cifras **no** van en la leyenda (van en el tooltip). La leyenda es solo color → nombre.

### Tooltip / hover

- **Disparo:** hover sobre un mes (Recharts tooltip, `cursor` activo). El cursor de hover es una franja vertical sutil `--accent-soft` translúcida (en barras) o una guía vertical `--hair` 1px (en área) — el `--accent-soft` acá es fondo de UI (resaltado de interacción), no tiñe montos, así que es admisible.
- **Caja del tooltip:** panel `--panel`, borde `--line`, `--r-ctl` (10px), `--shadow-lg`, padding 10px 12px.
- **Encabezado del tooltip:** el mes y año en texto UI 12.5px/600 `--ink` (ej. "Marzo 2026").
- **Filas del tooltip:** una por serie/categoría visible en ese mes — swatch 8px + nombre (UI 12.5px `--ink-2`) a la izquierda, **monto en mono tabular** (regla dura 3) a la derecha, formato es-AR completo `$ 219.400,00` (sin abreviar). En Forma 1, ingresos en `--income-ink` y gastos en `--expense-ink` (el monto sí lleva color semántico acá). En Forma 2, el monto de cada banda va en `--ink` (el color lo da el swatch, no el número; el número no es income/expense, es un gasto de categoría).
- **Total (Forma 2):** fila final separada por un `--hair`, "Total gastos" + monto mono `--expense-ink` (es el total de gastos del mes — sí es expense).
- **Orden de filas:** el del apilado/serie. Categorías con valor 0 en ese mes se omiten del tooltip.

### Estados

- **Cargando (skeleton):** cada tarjeta `.card` se renderiza con su cabecera ya presente (eyebrow + título de tarjeta; el año del dashboard, si aplica, como cifra mono ya visible). El área de gráfico se reemplaza por un **skeleton** del DS: bloque del alto del canvas de esa tarjeta (280px en dashboard, 300px en `/anual`), `bg-panel-3`, `rounded-[--r-ctl]`, `animate-pulse`. Opcionalmente, barras/ondas fantasma con el mismo `bg-panel-3`. La leyenda muestra 2–3 chips fantasma (`bg-panel-3 animate-pulse`, ~70px × 14px). Sin spinner. En `/anual` cada una de las dos tarjetas tiene su propio skeleton (cargan como un par). El control de año compartido del `.phead` ya está presente con el año, inerte mientras cargan los datos.
- **Con datos:** lo descrito arriba, por tarjeta según su forma.
- **Año sin movimientos (vacío):** los 12 meses **igual se dibujan en cero** (eje X completo, sin huecos) — el gráfico no desaparece. Sobre el área (centrada), un **mensaje de estado vacío** sobrio: texto UI 14px `--muted` "Sin movimientos en {año}." Sin ilustración. El eje Y puede mostrar una escala mínima (`$0`). En el dashboard, si el **año entero** está vacío, mismo tratamiento (no se mezcla con el empty del dashboard de "primer movimiento"; este es el empty de la tarjeta). En `/anual` cada tarjeta resuelve su vacío por separado (la de Forma 2 puede estar vacía aunque la de Forma 1 tenga ingresos, ya que Forma 2 es solo gastos). No es un error.
- **Año en curso con meses futuros:** los meses futuros sin datos se dibujan en **cero** como cualquier mes vacío (sin estilo especial de "futuro" en v1: no se atenúan ni se marcan distinto — la spec no introduce un tratamiento de "futuro" que los RF no pidieron). Los fijos/cuotas proyectados (RN-006) aparecen como datos normales.
- **Error:** la tarjeta se mantiene (no se rompe el layout del anfitrión ni de la otra tarjeta en `/anual`). En el área del gráfico, mensaje centrado: ícono `alert-triangle` (lucide) 20px `--warning-ink`, texto UI 14px `--ink-2` "No se pudo cargar el gráfico." y, debajo, un botón `.btn.ghost.sm` "Reintentar". Fondo de la tarjeta normal (`--panel`), sin tinte de error en toda la tarjeta. En `/anual` cada tarjeta maneja su error por separado.

### Ubicación en cada anfitrión

- **Dashboard (`/`):** se monta **solo la tarjeta de Forma 1 (Ingresos vs. Gastos)**. Va **después del bloque de stats + balance hero y ANTES del footer "Ver todos los movimientos →"** (orden fijo, ya definido — no queda a criterio del frontend). De arriba hacia abajo en la columna principal: stats + balance hero → tarjeta de Ingresos vs. Gastos → footer "Ver todos los movimientos →". Full-width del contenido (respeta el `max-width` 1120px del dashboard), separada del bloque superior por `--gap` (18px). Navegación de año **ausente**; año actual como cifra mono en la cabecera de la tarjeta. La tarjeta de Gastos por categoría (Forma 2) **no** va en el dashboard.
- **Pantalla dedicada (`/anual`):** el contenido central son las **dos tarjetas apiladas**, ambas visibles a la vez. Header de página estándar (`.phead`): eyebrow "Tu actividad" + H1 "Anual" (rol H1 página, 32px/700; sin teñir el año en el H1) a la izquierda, y el **control de año ‹ › compartido** a la derecha (ver "Control de año compartido"). Debajo del `.phead`, las dos tarjetas:
  - **Arriba:** tarjeta de **Forma 1 — "Ingresos y gastos"**.
  - **Abajo:** tarjeta de **Forma 2 — "Por categoría"**.
  - **Separación entre tarjetas:** `--gap` (18px) vertical, el mismo aire que separa bloques de tarjetas en el resto del DS. Ambas full-width del contenido (`max-width` 1120px como el resto).
  Cada área de gráfico es de **300px** de alto (ver "Alto y proporción"). Navegación de año **habilitada** mediante el control compartido del `.phead`. Al abrir, ambas tarjetas en el **año actual**.

### Responsive (desktop-first)

- **Desktop (> 940px):** cabecera de cada tarjeta en una fila (título izquierda; en dashboard, año mono a la derecha; en `/anual` la derecha de la cabecera queda vacía). En `/anual`, el `.phead` en una fila (título izquierda; control de año derecha). 12 meses en el eje X sin rotación. Altos de canvas: 280px (dashboard) / 300px por tarjeta (`/anual`).
- **≤ 940px:**
  - En `/anual`, el `.phead` **envuelve en dos filas** (título arriba; control de año compartido debajo, alineado al inicio). Las dos tarjetas siguen **apiladas** (ya lo estaban) con la misma separación `--gap`.
  - La cabecera de cada tarjeta, si su contenido no entra en una fila, envuelve también (título arriba; en dashboard, año mono debajo).
  - El área de gráfico de cada tarjeta baja a **220px**.
  - Las etiquetas de mes, si no entran las 12, se muestran de a una sí/una no (Recharts `interval`) o se acortan a la inicial — preferencia: `interval` para saltear, manteniendo las 12 barras/puntos. La leyenda envuelve (`flex-wrap`). Coherente con el resto del DS, que en ≤940px oculta la sidebar.
- Ninguna tarjeta scrollea horizontal; siempre encajan al ancho del contenedor.

### Movimiento y prefers-reduced-motion

- **Animación de entrada:** al montar/cargar, las áreas/barras de cada tarjeta hacen un *grow* desde la base (Recharts `isAnimationActive`), duración ~0.4s, easing suave — coherente con el movimiento sobrio del DS (0.32s de entrada de pantalla). En `/anual`, las dos tarjetas pueden animar a la vez al entrar. Ya no hay morph/cross-fade entre formas (no existe toggle).
- **Cambio de año (`/anual`):** al navegar con el control compartido, ambas tarjetas recalculan; las áreas/barras pueden reanimar su *grow* (~0.4s) sincronizadas, ya que comparten el año.
- **Hover:** transición 0.14s (tooltip aparece, dot crece) — igual que el resto del DS.
- **`prefers-reduced-motion`:** se **desactiva** la animación de entrada y la reanimación al cambiar de año (Recharts `isAnimationActive={false}`); la carga y el cambio de año son instantáneos. El tooltip sigue apareciendo pero sin transición. Regla obligatoria del DS (principios de jerarquía y layout).
