# Archivo de specs de diseño — Control

> **Archivo histórico de specs visuales por fase.** Cada sección es la **spec visual puntual** de una fase ya implementada, conservada **verbatim** tal como se cerró. Es material de **trazabilidad / referencia**: explica el porqué y el detalle de cómo se resolvió visualmente cada feature en su momento.
>
> **Relación con la guía viva (`docs/design.md`):** el **lenguaje visual vigente y reutilizable** (tokens, paleta, tipografía, geometría, principios, y los **patrones de componentes vigentes** que nacieron en estas fases — `PeriodNav`, acordeón, filtro de categorías, picker de color) vive en `docs/design.md`. Acá queda el **detalle de la spec de fase**. Ante un conflicto entre una spec archivada y la guía viva, **prevalece la guía viva** (`docs/design.md`).
>
> **Nota de supersesión:** algunas decisiones de specs viejas fueron **superadas** por specs posteriores (p. ej. el "control de año compartido" del *Gráfico anual* lo reemplazó *Reportes configurables*, Fase 1.1.5). Cada sección indica en su encabezado qué quedó superado. Se conservan igual, como registro.
>
> Orden: cronológico aproximado por fase. Las referencias internas a "la sección anterior", "ver matriz", "spec del gráfico", etc., apuntan al cuerpo de documentación tal como estaban al cerrarse la spec.

---

## Picker de color de categoría — spec visual (Fase 1.1.2, 2026-06-16)

> Spec del selector de color dentro del modal de categoría (`category-form-modal.tsx`, RF-CAT-002 / RF-CAT-003). Mismo picker en **crear** y **editar**. Reemplaza la "nota de color de solo lectura" que hoy aparece solo en editar, y agrega el color al modo crear (hoy ausente). No introduce tokens nuevos: todo se resuelve con los tokens/patrones vigentes del DS "Precise Ledger". El modal mantiene su `max-width` 380px, radio 18px, `shadow-lg`.
>
> **Fuente de verdad de la matriz de colores:** la matriz (10 base × 7 tonalidades) es **lenguaje vivo** y vive en `docs/design.md` ("Paleta de colores para categorías"). Esta sección archiva el detalle del **picker** que la consume.

### Ubicación dentro del form

Un bloque nuevo "Color", **debajo del scope picker (Alcance)** y antes del footer. Es el último bloque del cuerpo del form en ambos modos. Respeta el ritmo del form: mismo `space-y-[14px]` entre bloques, mismo patrón de bloque (`flex flex-col gap-[7px]` con `Label` arriba). En **editar** este bloque **sustituye** a la nota read-only de color que hoy existe (`isEditing && (…)`): esa nota se elimina; en su lugar va el picker, igual que en crear.

- **Label del bloque:** `Color`, con el estilo de label del form (`text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]`). No marcado `required` (siempre hay un color preseleccionado; el usuario no puede dejarlo vacío).
- **Fila de cabecera del bloque (Label + acción "aleatorio"):** el `Label` y el botón "aleatorio" comparten una fila `flex items-center justify-between`. Label a la izquierda; botón "aleatorio" a la derecha (ver "Botón aleatorio").

### Layout de la matriz (grid de swatches)

- **Grid:** 10 columnas × 7 filas (`grid-template-columns: repeat(10, 1fr)`), una columna por hue, una fila por tonalidad, en el orden de la matriz (T1 arriba → T7 abajo; C1→C10 izq→der). El orden visual **es** el de la tabla de la matriz, para que se lea como familias verticales de color.
- **Swatch:** cuadrado con `aspect-ratio: 1`, radio `--r-chip` (7px). Con 10 columnas dentro del ancho útil del modal (~336px: 380 − 2×22 de padding), cada swatch resulta ~**26–28px** de lado. No fijar px de lado: que el ancho lo reparta el grid (`1fr`) y la altura la dé `aspect-ratio: 1`.
- **Gaps:** `gap` 6px entre swatches (fila y columna). Coherente con la escala de espaciado (6px existe en la escala).
- **Alto total del grid:** el que resulte de 7 filas de ~26–28px + 6 gaps de 6px ≈ **220–240px**. No se fija alto rígido; el grid crece con su contenido. El modal sigue sin scroll propio en desktop (entra holgado bajo el `max-height` del diálogo).
- **`margin-top` del grid respecto de su Label/fila de cabecera:** 7px (el `gap-[7px]` del bloque).

### Estados del swatch

Cada swatch es un `button type="button"` con el color de fondo (`background-color: <hex>`) y `aria-label` con el nombre legible si se tiene (ej. "azul claro"); si no, el hex. Tres estados:

- **Reposo:** fondo = su hex. Borde sutil `1px` `--line` **solo** para los swatches muy claros (filas T1–T2), para que un pastel no se funda con el panel blanco; los demás sin borde (el color ya contrasta). Regla simple para el frontend: aplicar el borde `--line` a **todos** los swatches en reposo (1px, inset visualmente neutro) — uniforma la grilla y resuelve el caso de los claros sin lógica condicional. `cursor: pointer`.
- **Hover:** el swatch **escala a 1.12** (`transform: scale(1.12)`, transición 0.14s, el hover estándar del DS) y eleva con `--shadow-sm`; el borde pasa a `--line-strong`. El escalado da feedback sin recolorear el swatch (no se puede oscurecer/aclarar el color porque alteraría su identidad). `z-index` elevado en hover para que el swatch agrandado no quede tapado por sus vecinos.
- **Seleccionado (el color elegido):** el swatch lleva un **anillo de selección**: `box-shadow: 0 0 0 2px var(--panel), 0 0 0 4px var(--ink)`. Es decir, un primer halo de 2px del color del panel (separa el anillo del swatch) y un segundo anillo de 2px en `--ink` (el ring de selección, neutro fuerte). Se usa `--ink` —no el acento— porque el acento es solo marca y no debe teñir la selección de color de categoría; un ring neutro oscuro marca "este es el elegido" sin competir con los colores ni romper la regla del acento. El swatch seleccionado **no** escala (queda firme); el ring lo distingue. Además, ✓ opcional: un check `--panel` (blanco) de 14px centrado sobre swatches oscuros (T5–T7) y un check `--ink` sobre swatches claros (T1–T4) refuerza la selección — **opcional**, el ring es la señal canónica y suficiente; el check queda a criterio de implementación si mejora la lectura. (Si el frontend duda con la lógica claro/oscuro del check, omitirlo: el ring basta.)
- **Focus (teclado):** mismo ring de foco del DS — `shadow-[0_0_0_3px_var(--accent-soft)]` — aplicado al swatch enfocado por teclado (`focus-visible`). Acá el `--accent-soft` es ring de interacción de UI (foco), no tiñe el color de categoría, así que es admisible (mismo criterio que el cursor de hover de los gráficos). El grid es navegable por teclado (cada swatch es un `button`).

### Botón "aleatorio"

- **Ubicación:** en la fila de cabecera del bloque Color, a la derecha del Label "Color" (`justify-between`).
- **Estilo:** botón **ghost chico** del DS — patrón `.btn.ghost.sm`: sin fill, texto `--ink-2`, ícono a la izquierda, `hover:bg-panel-2 hover:text-ink`, radio `--r-ctl`, foco con `--accent-soft`. Texto: `Aleatorio`. Ícono lucide `Shuffle` 15px a la izquierda del texto (coherente con el tamaño de íconos de botones chicos del DS). Tamaño de texto 12.5–13px/600.
- **Comportamiento visual:** al pulsarlo, selecciona **un swatch al azar de la matriz** (de los 70 — no un hex arbitrario; la aleatoriedad sale de la matriz, nunca fuera de ella) y mueve el estado "seleccionado" a ese swatch: el ring de selección salta al nuevo swatch, con la transición de 0.14s. No abre otro control ni cambia el layout. Es un atajo para elegir dentro de la misma matriz visible.

### Presencia en crear y editar

- **Crear:** el picker aparece con el color **menos usado** (cálculo sobre la fila T4 / pool actual, ver matriz) ya **seleccionado** (ring puesto). El usuario puede cambiarlo a cualquiera de los 70 o usar "Aleatorio".
- **Editar:** el picker aparece con el **color actual de la categoría** ya **seleccionado** (ring puesto sobre su swatch). Por back-compat, los colores viejos viven en la fila T4, así que el ring cae sobre un swatch existente y visible. El usuario puede cambiarlo. **Desaparece** la nota "El color se asigna automáticamente y no se puede cambiar." (ya no es cierta).
- En ambos modos el bloque es idéntico en layout, estados y posición (debajo de Alcance). La única diferencia es cuál swatch arranca seleccionado.

### Convivencia con las reglas duras (recordatorio)

El ring de selección usa `--ink` (neutro), no el acento (regla dura 2 intacta: el índigo sigue siendo solo marca). Ningún swatch del picker tiñe montos ni comunica ingreso/gasto (regla dura 1 intacta). Los colores elegidos se siguen consumiendo como identificador de categoría en `/categorias` (swatch 14px radio 5px) y en las bandas/leyendas del gráfico anual, sin cambios en esos consumos.

---

## Gráfico anual — spec visual del widget

> Spec del widget de gráfico anual (RF-GRA-001/002/003, pantallas 7 y 8 de `screens.md`). **Dos visualizaciones que son dos recuadros (`.card`) separados, ambos visibles a la vez — sin toggle, sin "forma por defecto", sin morph entre formas.** Forma 1 (Ingresos vs. Gastos) se monta sola en el Dashboard (año fijo); Forma 1 + Forma 2 (Gastos por categoría) se montan apiladas en `/anual` (con navegación de año compartida). Cada recuadro es un componente reutilizable configurable por props. **Librería destino: Tremor Raw (Recharts por debajo).** Esta sección define lo visual; la conducta funcional vive en los RF citados y no se redefine acá.
>
> **PARCIALMENTE SUPERADA por "Reportes configurables — spec visual (Fase 1.1.5)":** el *encuadre* descrito acá (control de año compartido en el `.phead`, año mono suelto en la cabecera del Dashboard, par fijo de dos tarjetas apiladas en `/anual`) **fue reemplazado** por la grilla configurable de cards y el control de año embebido per-card de la Fase 1.1.5. **Lo que sigue vigente y se reutiliza tal cual:** las **gráficas** (Forma 1 área, Forma 2 barras apiladas), ejes, gridlines, leyenda, tooltip, alto de canvas, mapeos de color y los estados de carga/vacío/error del área de gráfico. Ver la sección de la Fase 1.1.5 para el encuadre vigente.

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

> **SUPERADO por la Fase 1.1.5.** En `/reportes` ya no hay control de año compartido: cada card navega su año con un `.stepper` embebido. Se conserva este texto como registro de la decisión original.

En `/anual` hay **un único control de año** que gobierna **las dos tarjetas a la vez**. Para que se lea inequívocamente como compartido (y no como propiedad de una de las dos tarjetas), vive en el **header de página `.phead`**, por encima del par de tarjetas, no dentro de ninguna de ellas.

- **Ubicación dentro del `.phead`:** fila flex `space-between`, `align-items: center`. A la **izquierda**, el bloque de título de página (eyebrow "Tu actividad" + H1 "Anual"). A la **derecha**, el control de año ‹ ›, alineado al baseline/centro del H1. Así un único stepper preside ambos recuadros y se entiende que los mueve juntos.
- **Patrón del control:** reutiliza **`.stepper`** del DS (el navegador de mes): pill (`--r-pill`) `--panel` con borde `--line` y `--shadow-sm`, padding 4px; dos botones circulares 32px (chevron-left / chevron-right) con ícono `--ink-2` que pasa a `--ink` sobre fondo `--panel-2` en hover; en el centro, el **año** como label mono tabular (es un número), 14.5px/600, `min-width` ~64px centrado. Sin la sub-línea "Mes en curso" del stepper de mes (acá no aplica).
- **Estados de los chevrons (límites de RF-GRA-003) — se mantienen:**
  - **‹ deshabilitado** cuando el año mostrado es el primer año con movimientos del usuario (`earliestYear`, no se navega más atrás): chevron en `--faint`, `cursor: default`, sin hover, `opacity` 0.45. No se oculta — se ve presente pero apagado.
  - **› deshabilitado** cuando el año mostrado es el año en curso (no se navega al futuro): mismo tratamiento apagado.
- **Año en las tarjetas:** como el año vive en el `.phead`, las cabeceras de las dos tarjetas de `/anual` **no** repiten el año suelto (su zona derecha queda vacía). El año es uno solo y se lee en el control compartido.

### Año en el Dashboard (sin control)

> **SUPERADO por la Fase 1.1.5.** El Dashboard ahora monta el widget con navegación de año **activa** (control embebido). Se conserva como registro.

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

> **Encuadre SUPERADO por la Fase 1.1.5** (grilla configurable de cards en `/reportes`, y card del Dashboard con navegación activa). Se conserva como registro del encuadre original.

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

---

## Fijos extendidos — spec visual (Fase 1.1.1, 2026-06-15)

> Spec del lenguaje visual de la Fase 1.1.1 (P1 anular un fijo por mes, P2 periodicidad). Backend ya implementado; lo consume `control-frontend`. Toca dos lugares: el **ítem del fijo en `/mes`** (`movement-item-row.tsx`) y el **form de fijo del modal de carga** (`recurring-form.tsx`). No introduce tokens nuevos: todo se resuelve con los tokens y patrones ya vigentes.

### 1. Frecuencia en la sublínea del ítem fijo (`/mes`)

Hoy la sublínea del fijo es `Categoría · gasto · 🔁 mensual` con la palabra "mensual" hardcodeada y el ícono `Repeat` (lucide) a `12px` `opacity-60`. El backend ahora expone `frequency`. La frecuencia **reemplaza** ese texto fijo; **se conserva** el ícono `Repeat` y todo el tratamiento existente del segmento (mismo `12px`, mismo `opacity-60`, misma separación por bullet `--faint`). El ícono `Repeat` sigue significando "es un fijo / se repite"; lo único que cambia es la etiqueta que lo acompaña.

**Etiquetas en español por valor de `frequency`** (minúscula, igual que "mensual" hoy):

| `frequency` | Etiqueta sublínea |
|---|---|
| `MONTHLY` | mensual |
| `BIMONTHLY` | bimestral |
| `QUARTERLY` | trimestral |
| `BIANNUAL` | semestral |
| `ANNUAL` | anual |

- Sin cambios de color, peso ni tamaño respecto del segmento actual: es texto `--muted` 12.5px dentro de la sublínea.
- No se agrega ningún badge ni decoración extra por frecuencia: la periodicidad vive **solo** en este segmento de la sublínea. Un fijo "mensual" se sigue viendo exactamente como hoy.

### 2. Ítem fijo ANULADO (skipped) en `/mes`

El backend devuelve el ítem con `skipped: true` (solo posible en `origin: 'fijo'`). El ítem **se sigue mostrando** en la lista en su sección de Fijos, en su misma posición (sigue ordenado por monto descendente), pero está anulado para ese mes: **no suma a los totales**. La diferenciación tiene que leerse como "este mes no cuenta" sin que el ítem desaparezca ni pierda legibilidad.

**Tratamiento visual del ítem anulado** (delta respecto del fijo activo; todo lo no listado queda igual):

- **Atenuación general de la fila:** todo el contenido de la fila (ícono, nombre, sublínea, monto, columna de fecha) baja a **`opacity: 0.55`**. Suficiente para leerse como inactivo sin volverse ilegible. La atenuación se aplica al contenido, **no** al fondo de la fila ni al hover (ver hover abajo) ni al KebabMenu (el menú de acciones debe quedar plenamente usable).
- **Monto tachado:** el monto lleva **`line-through`** (tachado) además de la atenuación. El tachado es el indicador inequívoco de "este importe no se computa". El monto **conserva su color semántico** (gasto `--ink`, ingreso `--income-ink`, igual que hoy) y su signo; el tachado va por encima. No se recolorea el monto a un neutro: mantenemos la semántica, solo lo anulamos visualmente con el tachado + la opacidad.
- **Badge "Anulado":** un badge de estado se agrega en la **sublínea**, como **primer segmento**, antes de "Categoría". Estilo chip del DS:
  - Texto `Anulado`, UI font, 11px, peso 600, `letter-spacing: .04em`.
  - Fill `--panel-3`, texto `--muted`, radio `--r-chip` (7px), padding `1px 7px`.
  - **Neutro a propósito** (no usa `--warning` ni un semántico): "anulado" es un estado de cómputo, no un error ni un gasto/ingreso. El neutro evita que compita con el verde/rojo del monto.
  - El badge **no** se atenúa con el resto: vive dentro de la fila atenuada, así que hereda algo de la opacidad, lo cual es aceptable y deseado (refuerza el estado apagado). No se le da opacidad propia adicional.
- **Ícono (columna 1):** se mantiene el ícono tintado por tipo (expense-soft/income-soft) tal cual, solo afectado por la opacidad general de la fila. No se cambia a un ícono distinto ni se vuelve gris: la atenuación + el tachado + el badge ya comunican el estado, y mantener el ícono conserva la lectura de "qué fijo es".

**Hover del ítem anulado:** la fila **sigue siendo interactiva** (el usuario va a querer des-anularla). Se conserva el `hover:bg-panel-2` de la fila y la aparición del KebabMenu en hover. En hover, el contenido atenuado **no** vuelve a opacidad plena (seguiría leyéndose como anulado); la única señal de hover es el fondo `--panel-2` y el KebabMenu visible. El KebabMenu en sí nunca está atenuado (queda a opacidad 1 cuando aparece), para que "Des-anular" sea cómodo de accionar.

**Resumen de la jerarquía del estado anulado:** badge "Anulado" (qué pasó) → opacidad 0.55 (está apagado) → tachado del monto (no se computa). Las tres señales juntas; ninguna sola alcanza.

### 3. Acción Anular / Des-anular en el KebabMenu del ítem fijo

Solo los ítems con `origin: 'fijo'` suman esta acción; **únicos y cuotas no la tienen** (su KebabMenu queda como está: Editar / Eliminar). En los fijos, la acción es un **toggle** y su label depende del estado `skipped`:

| Estado del fijo | Label del ítem de menú | Ícono (lucide) |
|---|---|---|
| Activo (`skipped: false`) | **Anular este mes** | `CalendarOff` |
| Anulado (`skipped: true`) | **Des-anular este mes** | `CalendarPlus` |

- **Posición en el menú:** entre "Editar" y "Eliminar" (orden: Editar → Anular/Des-anular este mes → Eliminar). Queda agrupada con Editar como acción "no destructiva" y antes del separador conceptual con Eliminar.
- **Tratamiento:** acción **neutra**, no `danger`. Anular es reversible (es un toggle), no destruye nada — no debe pintarse en rojo. Hereda el estilo neutro del `KebabMenuItem` (`text-ink hover:bg-panel-2`), con su ícono a 15px como el resto de los ítems del menú. El único ítem `danger` (rojo) del menú sigue siendo "Eliminar".
- **Íconos:** `CalendarOff` (anular: un calendario con la barra de "off" comunica "esta fecha no cuenta") y `CalendarPlus` (des-anular: lo reintegra). Ambos de lucide, coherentes con el resto de íconos del menú. No reutilizamos `Repeat` acá para no confundir la acción con el indicador de recurrencia de la sublínea.

### 4. Selector de frecuencia en el form de fijo (tab Fijo)

**Control:** `Select` nativo del DS (el mismo componente `@/components/ui/select` que usa Categoría), **no** segmented ni toggle. Razón: son 5 opciones (demasiadas para un segmented cómodo en el ancho del modal) y un select nativo es el patrón ya establecido para elegir de un set cerrado en este form (Categoría). Coherencia sobre novedad.

**Ubicación dentro del form (modo crear):** entre el bloque **Mes de inicio** y el bloque **Categoría**. La frecuencia está conceptualmente ligada al `startMonth` (la periodicidad se ancla al mes de inicio: un bimestral que arranca en marzo cae marzo/mayo/julio…), así que va inmediatamente después de él y antes de Categoría. Mismo `space-y-[14px]` del form, mismo patrón de bloque (`flex flex-col gap-[7px]` con `Label` arriba).

**Label:** `Frecuencia`, con el estilo de label del form (`text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]`). Es requerido (siempre hay una frecuencia), marcado `required` como los demás campos obligatorios.

**Opciones del select y etiquetas (capitalizadas, como van en un control de selección):**

| `frequency` | Opción del select |
|---|---|
| `MONTHLY` | Mensual |
| `BIMONTHLY` | Bimestral |
| `QUARTERLY` | Trimestral |
| `BIANNUAL` | Semestral |
| `ANNUAL` | Anual |

- **Default:** `MONTHLY` (Mensual) preseleccionado. A diferencia de Categoría, **no** lleva opción placeholder vacía ("Seleccioná…"): siempre arranca en Mensual, que es el caso por defecto y back-compat de los fijos existentes.
- **Orden de las opciones:** de menor a mayor período (Mensual → Bimestral → Trimestral → Semestral → Anual).

**Nota de recurrencia existente:** el form ya muestra (solo en crear) la línea `🔁 Se registra automáticamente cada mes a partir del mes de inicio.`. Como ahora la frecuencia es variable, esa frase fija ("cada mes") deja de ser siempre cierta. **Señal para el analista / orquestador:** el texto de esa nota debería contemplar la frecuencia elegida (ej. "cada N meses" / "según la frecuencia elegida, a partir del mes de inicio"). El redactado exacto es copy funcional, no lo cierra esta spec; lo marco como impacto a derivar. Visualmente la línea no cambia (mismo `.field-note` con ícono `Repeat` `--accent-ink`).

**Modo editar — frecuencia inmutable:** el backend dejó la frecuencia **inmutable** en PATCH (igual que el `type`). En modo editar el selector **no** debe permitir cambiarla. Se muestra **read-only con badge, replicando exactamente el patrón ya usado para "Tipo" en edición** (bloque `Label` + caja `rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px] text-[14px] font-semibold text-ink-2`). Se elige read-only visible (no ocultarlo) por coherencia con "Tipo" y porque informar la frecuencia del fijo que se está editando es útil aunque no se pueda cambiar.

- **Contenido de la caja read-only:** ícono `Repeat` (lucide, 15px, `--accent-ink` — mismo acento que la nota de recurrencia y coherente con que el `Repeat` es el indicador de "fijo") + la etiqueta capitalizada de la frecuencia (Mensual / Bimestral / Trimestral / Semestral / Anual, misma tabla de arriba).
- **Ubicación en editar:** la misma posición relativa que en crear, salvo que en editar **no** existe el bloque "Mes de inicio" (ya está oculto en editar hoy). Queda entonces entre **Monto** y **Categoría**.
- Coherente con cómo "Tipo" pasa de toggle (crear) a caja read-only con badge (editar). Frecuencia hace lo mismo: `Select` (crear) → caja read-only (editar).

---

## Navegación de período — flechas gigantes laterales (Fase 1.1.3, 2026-06-16; contenedor revisado 2026-06-16)

> Spec del **patrón genérico de navegación de período**: dos flechas grandes a los costados del contenido — `‹ contenido ›` — donde **‹ va al período anterior y › al período siguiente**. "Período" es deliberadamente **abstracto**: en esta fase es el **mes** (se aplica a `/mes`), y el patrón queda **reutilizable** para el **año** en los reportes (Fase 1.1.5). El patrón unifica/reemplaza el `.stepper` de pill que `/mes` usa hoy. No introduce tokens nuevos: se resuelve con los tokens y patrones vigentes del DS "Precise Ledger".
>
> **El patrón `PeriodNav` es lenguaje vivo** (resumen en `docs/design.md`, "Patrones de componentes vigentes"). Esta sección archiva el detalle de cómo se cerró en la Fase 1.1.3.
>
> **Alcance de esta fase:** **solo `/mes`**. **NO** toca `/anual` ni su `.stepper` (esa pantalla adopta el patrón en 1.1.5). Lo que se define acá es el patrón completo (incluido el estado **disabled**, que en `/mes` hoy no se dispara pero 1.1.5 va a necesitar) para que 1.1.5 lo reuse sin redefinir nada.
>
> **Corrección de contenedor (2026-06-16):** la primera versión anclaba las flechas como **absolutas en el gutter** (`right:100%`/`left:100%` respecto del contenido de 1120px) con fallback por breakpoints. En la práctica salió mal: (1) el gutter izquierdo (sidebar↔contenido) y el derecho (contenido↔viewport) **no son iguales** —el contenido se centra dentro de `<main>`, que ya arranca corrido 248px—, así que las flechas ancladas al contenido quedaban **asimétricas**; (2) el umbral de "gutter amplio" era tan alto que casi ninguna pantalla real (1366–1440px) lo alcanzaba, y casi siempre caía en el modo donde las flechas se **montaban sobre el padding del contenido** como botones de carrusel flotantes (se veía mal); (3) el `sticky top-[50vh]` dentro de un `absolute` era frágil. **Se reemplaza por un layout real de 3 columnas** (abajo). La simetría pasa a ser del **contenido**, no del viewport.

### Concepto y nombre del patrón

`PeriodNav` — un patrón de **tres columnas** que flanquean el contenido de una vista de período: `[ ‹ ] [ contenido ] [ › ]`.

1. **Columna de flecha anterior** (‹) — columna propia a la **izquierda** del contenido.
2. **Columna de contenido** del período (la vista de `/mes`: header, totales, listas).
3. **Columna de flecha siguiente** (›) — columna propia a la **derecha** del contenido.

Más el **rótulo del período** (el "Junio 2026" + sub-línea), que vive en el header de la columna de contenido como título (ver "Rótulo del período").

El patrón es **agnóstico del período**: recibe (conceptualmente) un rótulo de período, un handler "anterior", un handler "siguiente" y dos flags `canGoPrev` / `canGoNext`. En `/mes` el período es el mes y `canGoPrev`/`canGoNext` son siempre `true` (no hay tope); en reportes (1.1.5) el período es el año y esos flags se atan a `earliestYear` / año en curso. **Mismo componente, distinto período.**

### Layout de 3 columnas (el contenedor)

La corrección clave: las flechas no son hijas absolutas ancladas al contenido — son **columnas reales** del layout que **flanquean** la columna de contenido. Así la simetría es del contenido y no depende del tamaño del gutter ni de cálculos de viewport.

- **Contenedor `PeriodNav`:** un **grid de 3 columnas**, `grid-template-columns: auto minmax(0, 1120px) auto`, `mx-auto` dentro del `<main>`, centrado en el área que `<main>` ya tiene (corrida 248px por el sidebar en ≥941px). Alineación vertical de las celdas: `align-items: stretch` (las columnas de flecha ocupan todo el alto del contenido, para poder hacer sticky adentro). `column-gap`: **0** (la separación flecha↔contenido la da el padding propio de la celda de flecha, ver abajo).
  - **Columna central (contenido):** `minmax(0, 1120px)` — el contenido conserva su tope de **1120px** y su `px-10` (40px) interno **sin cambios**. El `minmax(0, …)` permite que la columna se encoja por debajo de 1120 sin desbordar cuando el ancho total aprieta.
  - **Columnas laterales (flechas):** `auto` — toman exactamente el ancho de su contenido (el botón de flecha + su aire lateral). Ambas son `auto`, así que **se reservan el mismo ancho** a ambos lados → las flechas quedan **siempre simétricas respecto del contenido**. Las dos celdas comparten el sobrante por igual gracias al `mx-auto` del contenedor.
  - **Aire flecha↔contenido:** cada celda de flecha lleva un **padding interno de 20px** hacia el lado del contenido (la izquierda `padding-right:20px`, la derecha `padding-left:20px`), de modo que el botón no toca el borde del contenido. Ese aire es el único separador; no hay `column-gap`. (Subió de 16px a 20px junto con el botón de 64px, para conservar la respiración flecha↔contenido del patrón.)
- **Flex como alternativa equivalente:** si el frontend prefiere flex, el equivalente es un `flex items-stretch justify-center` con las dos celdas de flecha de ancho intrínseco (`flex: 0 0 auto`) y el contenido `flex: 0 1 1120px` (`max-width:1120px`, `min-width:0`). El resultado visual debe ser idéntico al grid; **preferencia: grid** por ser más directo el `minmax(0, 1120px)`. La geometría manda; la mecánica (grid/flex) es del frontend mientras respete: contenido centrado, columnas de flecha simétricas de ancho intrínseco, encogimiento parejo.
- **Por qué esto corrige la asimetría:** como las flechas son columnas que abrazan el contenido (no posiciones ancladas a un viewport descentrado), el `‹ contenido ›` se lee simétrico **siempre**, sin importar que el `<main>` esté corrido por el sidebar. Las flechas ya no "saben" del viewport.

### Centrado vertical de las flechas (sticky robusto)

- Cada flecha vive **dentro de su columna lateral**, que por `align-items: stretch` es tan alta como la columna de contenido. El botón se centra verticalmente **dentro de su propia columna** con `position: sticky; top: 50vh; transform: translateY(-50%)` **sobre el botón mismo** (o un wrapper directo del botón dentro de la celda). Al ser sticky dentro de una columna que abarca todo el alto del contenido, la flecha **acompaña el scroll** y queda centrada en el viewport mientras el cursor recorre listas largas, sin volver al tope.
- Esta es la técnica robusta que reemplaza al `sticky` anterior: el sticky vive **dentro de la celda de columna del grid** (un contexto de bloque limpio, tan alto como el contenido), no anidado dentro de un `absolute`. Sin `top:50%` sobre un contenedor `absolute top-0 bottom-0` frágil.
- Si una vista fuera más corta que el viewport, el sticky simplemente no llega a despegarse y la flecha queda centrada en la columna corta — comportamiento correcto sin caso especial.

### Dimensiones, glifo y color de las flechas

Ahora que las flechas viven en columna propia (no flotan sobre el contenido), se define un **tamaño único** para todo el rango en que el patrón muestra flechas laterales (sin el salto 56→44 atado a un breakpoint irreal). El tamaño se elige para que en pantallas típicas (1366–1440px) ya se vea bien.

Cada flecha es un `button` circular tipo "zona de toque generosa con glifo grande":

| Propiedad | Valor | Notas |
|---|---|---|
| **Zona de toque (botón)** | **64 × 64 px**, círculo (`border-radius: 50%`) | Tamaño único en todo el rango con flechas laterales. Target cómodo; el "gigante" es el glifo |
| **Glifo** | `ChevronLeft` / `ChevronRight` (lucide), **46px** | El glifo es el que se lee como "gigante" |
| **Grosor del trazo del glifo** | `stroke-width: 1.75` | Coherente con el peso visual del DS (íconos del DS van 1.5–2; acá un pelo más fino que default lucide 2 para que un glifo grande no se vea tosco) |
| **Fondo en reposo** | **transparente** (sin pill, sin fill) | Las flechas viven en su columna "al aire", no son un control con caja. El fondo de la columna es `--paper` |
| **Color del glifo en reposo** | `--faint` | Presente pero discreto: no compite con el contenido ni con los montos |

> El tamaño **64/46** (ajustado 2026-06-16, Fase 1.1.3) sube un escalón respecto del **48/36** previo: la flecha gana presencia perceptible —se lee más claramente como el "gigante" del patrón al costado del contenido— sin volverse desproporcionada, y sigue entrando cómoda en pantallas 1366–1440px gracias a vivir en columna propia. **Único escalón**: no hay segundo tamaño por breakpoint mientras se muestren flechas laterales; cuando el ancho ya no alcanza, se colapsa al `.stepper` (ver "Responsive y colapso"), no se achican las flechas.

**Por qué sin fill en reposo:** el patrón es "flechas gigantes a los costados", no un par de botones con caja. Dejarlas sin fondo (solo glifo) hace que se lean como affordance de navegación lateral —como las flechas de un carrusel— sin agregar peso visual permanente al canvas. El fill aparece solo en hover (ver estados).

### Estados de la flecha

- **Reposo:** glifo `--faint`, fondo transparente. `cursor: pointer`.
- **Hover:** el glifo sube a `--ink`; aparece un **fondo circular `--panel-2`** detrás del glifo (el botón "se materializa" como círculo al apuntarlo); transición 0.14s (hover estándar del DS). Sin desplazamiento ni escala del botón (queda firme en su lugar; lo que cambia es color + fondo).
- **Active / pressed:** fondo `--panel-3`, glifo `--ink`. Feedback breve de pulsación.
- **Focus (teclado):** anillo de foco del DS — `shadow-[0_0_0_3px_var(--accent-soft)]` — sobre el botón circular (`focus-visible`). El `--accent-soft` acá es ring de interacción de UI, no tiñe nada semántico (mismo criterio que el resto de focos del DS).
- **Disabled (`canGoPrev`/`canGoNext` = false):** glifo `--faint` con `opacity: 0.4`, **sin** hover (no aparece el fondo circular), `cursor: default`, `aria-disabled`. **No se oculta** — se ve presente pero apagado, igual que el criterio ya fijado para los chevrons del stepper de `/anual`. En `/mes` este estado **no se dispara hoy** (el mes no tiene tope), pero queda definido para que 1.1.5 (año, con `earliestYear` y año en curso) lo use sin inventar nada.

`aria-label` por flecha: en `/mes`, "Mes anterior" / "Mes siguiente" (los mismos labels que el stepper actual). El patrón genérico recibe el label según el período (en reportes serán "Año anterior" / "Año siguiente").

### Rótulo del período: qué pasa con el "Junio 2026" + sub-línea

Hoy el rótulo del período ("Junio 2026" + "Mes en curso" / "Histórico") vive **dentro** del pill `.stepper`. Al pasar las flechas a sus columnas laterales, el rótulo **se promueve al header de página** como título de la vista, con el patrón `.phead` del DS (que `/mes` hoy no usa pero el resto del producto sí):

- **Se elimina el pill `.stepper` de `/mes`.** Las flechas laterales reemplazan por completo sus dos chevrons; el rótulo que llevaba en el centro se promueve al header.
- **Header de `/mes` (nuevo `.phead`):** fila `flex items-end justify-between`, a la izquierda el bloque de título, a la derecha el botón "+ Nuevo movimiento" (ver "No-colisión").
  - **Eyebrow** (rol *Eyebrow/labels*: 12px/600, `.1em`, uppercase, `--muted`): **"Tu mes"**. Da el contexto de la pantalla, paralelo al "Tu actividad" de `/anual`.
  - **H1 del período** (rol *H1 página*: 32px/700, `-.02em`, `--ink`): **el rótulo del período**, p. ej. **"Junio 2026"**. Es el título grande de la pantalla. Va en texto UI (Space Grotesk) **no** en mono: "Junio 2026" es un rótulo, no una cifra de dinero (la regla dura 3 aplica a montos, no a títulos de período). El año puede ir teñido con `--accent-ink` siguiendo el patrón ya existente del DS (`.phead h1 .mo` tiñe parte del título con el acento — uso de marca, admisible), o todo en `--ink`; **preferencia: todo en `--ink`** para `/mes` (mantenerlo sobrio; el acento queda reservado para donde ya se usa).
  - **Sub-línea de estado** ("Mes en curso" / "Histórico"): baja a **meta debajo del H1**, rol *Meta/subtítulos* (12.5px/500, `--muted`), o como segunda línea del bloque de título. Conserva exactamente la lógica actual (mes actual → "Mes en curso"; otro → "Histórico"). En reportes (1.1.5), esta sub-línea es el slot donde podría ir un estado análogo del año (o quedar vacía si no aplica); el patrón la contempla como **opcional**.
- **Genérico para mes o año:** el bloque de título (eyebrow + H1 + sub-línea) muestra el **rótulo del período** sea mes ("Junio 2026") o año ("2026"). El patrón no asume formato: recibe el string ya formateado. Por eso sirve igual a `/mes` y a los reportes de 1.1.5.

### No-colisión y jerarquía

- **Las flechas no compiten con el contenido.** En reposo son glifos `--faint` al aire en su columna lateral, **fuera** de la columna de contenido: están **separadas físicamente** del canvas (su propia columna del grid), así que no pelean con el monto/totales ni con las cifras (que dominan por peso, tamaño y color semántico). El glifo `--faint` es el neutro más tenue de la escala: presente, no protagonista.
- **Relación con "+ Nuevo movimiento":** ese botón es la **acción primaria** del header y **se mantiene en el header** (`.phead`, a la derecha), con su estilo actual (`.btn` primario índigo). Las flechas son **navegación**, no acción; viven en las **columnas laterales**, no en el header. Quedan en planos distintos —el botón en la barra superior del contenido, las flechas en las columnas a los costados— así que no colisionan ni en posición ni en jerarquía. El botón primario sigue siendo el único elemento de acento índigo "fuerte" del header; las flechas, al ser `--faint` sin fill, no le disputan atención.
- **Una sola navegación de período por pantalla:** al eliminar el `.stepper`, las flechas laterales son el **único** control para cambiar de período en `/mes`. No conviven dos navegadores.

### Responsive y colapso

Con el layout de 3 columnas, el responsive se simplifica a **dos regímenes** (ya no hay un modo intermedio de "flechas pegadas al borde con fondo": ese era el síntoma del modelo viejo). Desktop-first, coherente con que el DS oculta la sidebar en ≤940px:

- **Hay lugar para las columnas de flecha (≥941px, mientras las celdas laterales tengan ancho suficiente):** modo canónico. Layout `[ ‹ ] [ contenido ] [ › ]` con la columna central `minmax(0, 1120px)` y las dos celdas de flecha de ancho intrínseco. Botón 64px, glifo 46px, las dos flechas simétricas respecto del contenido. Al angostar el viewport dentro de este rango, **las dos columnas de flecha se encogen de forma pareja** (porque ambas son `auto` y comparten el sobrante por igual vía `mx-auto`): el contenido baja de 1120px hacia su mínimo y las flechas se acercan a él de manera simétrica, manteniendo el `‹ contenido ›` equilibrado. **Nunca se montan sobre el contenido**: viven en su columna; cuando esa columna ya no puede reservar el aire mínimo del botón + sus 20px, se pasa al colapso.
  - *Umbral de colapso a criterio de implementación*, pero atado a un hecho concreto: el patrón muestra flechas laterales **mientras la celda de flecha pueda alojar el botón de 64px con su aire de 20px sin invadir el contenido**. Resuelto con breakpoint CSS o container query; **preferencia: breakpoint CSS** alineado al breakpoint de sidebar del DS (940px) — es decir, en `/mes`, con sidebar visible (≥941px) el contenido de 1120px + el sidebar de 248px todavía dejan margen para las columnas de flecha en las resoluciones objetivo, así que el régimen canónico cubre el desktop típico (1366–1440px) y el colapso coincide con la ocultación de la sidebar. Si en algún ancho intermedio las celdas de flecha no entran antes de los 940px, **colapsar directamente al `.stepper`** (no hay modo "flechas con fondo pegadas").

- **Mobile / sidebar oculta (≤940px) — colapso al `.stepper`:** el DS ya oculta la sidebar; el contenido ocupa todo el ancho con `px-10`. Aquí no hay lugar para columnas laterales y las flechas gigantes se vuelven incómodas (chocan con el contenido y el thumb del pulgar). **El patrón colapsa al `.stepper` pill** —el mismo navegador compacto que `/mes` usa hoy— **integrado en el header**, debajo del H1 del período o reemplazando el bloque de título por el pill. Es decir: en ≤940px no se renderizan las columnas de flecha; en su lugar, un pill `.stepper` (chevron ‹ + rótulo + chevron ›) como control compacto. Esto garantiza que el patrón sea **usable en todo el rango** sin flechas gigantes donde no entran. (Esto quedó bien en la versión anterior y **no cambia**.)
  - El `.stepper` de fallback usa el rótulo del período como su label central (el "Junio 2026"); la sub-línea de estado va en el `small` del stepper (como hoy). Reaprovecha el componente `.stepper` ya existente del DS — no se descarta, se reserva como el modo compacto del patrón en mobile.

**Resumen del responsive en una línea:** hay lugar para las columnas laterales → flechas 48px simétricas que se encogen parejo; no hay lugar (≤940px) → colapsa al pill `.stepper` en el header. **No existe** el modo intermedio de "flechas con fondo pegadas al borde del contenido" — ese era el bug del modelo anterior.

### Movimiento y prefers-reduced-motion

- **Hover/active:** transición 0.14s en color y aparición del fondo circular (hover estándar del DS).
- **Cambio de período:** la navegación dispara el re-render de la vista (en `/mes`, la entrada de pantalla `fade + translateY` de 0.32s ya existente). Las flechas no animan posición al cambiar de período (quedan fijas; lo que cambia es el contenido y el rótulo del H1).
- **`prefers-reduced-motion`:** se respeta el DS (sin transición de hover ni fade de entrada). Regla obligatoria del DS.

### Reutilización en reportes (1.1.5) — nota de continuidad

Esta spec deja el patrón listo para que 1.1.5 lo monte sobre cada **card de reporte** (donde el período es el **año**) y sobre el **dashboard**. Lo que 1.1.5 hereda sin redefinir: dimensiones de flecha (48/36, escalón único), estados (incluido **disabled**, que allá sí se dispara con `earliestYear` / año en curso), el centrado vertical sticky, los **dos regímenes responsive** (columnas laterales / colapso al `.stepper`), y el rótulo de período como H1/título. Lo que 1.1.5 deberá especificar por su cuenta (fuera de esta spec): **si las flechas flanquean la card individual** (el roadmap dice que las flechas son "parte del propio widget", no chrome de la página) en vez de flanquear la columna entera — ese encuadre por-card (aplicar el mismo grid de 3 columnas a la card, o equivalente) lo resuelve 1.1.5; el **patrón visual de la flecha** (tamaño, color, estados, colapso) es el de esta sección.

---

## Vista del mes — secciones colapsables + reordenables (Fase 1.1.4, 2026-06-16)

> Spec del lenguaje visual de la Fase 1.1.4 sobre `/mes` (`month-view-client.tsx`): **P5 — acordeón** (las 3 secciones Únicos / Fijos / Cuotas se colapsan/expanden individualmente) y **P6 — reordenar** (el usuario reordena las secciones entre sí por drag; los ítems **dentro** de cada sección no se reordenan, siguen por monto descendente). **No introduce tokens nuevos:** todo se resuelve con los tokens y patrones vigentes del DS "Precise Ledger".
>
> **El patrón de acordeón / sección reordenable es lenguaje vivo** (resumen en `docs/design.md`, "Patrones de componentes vigentes"). Esta sección archiva el detalle de cómo se cerró en la Fase 1.1.4.
>
> **Restricción dura de esta fase: el look ACTUAL de `/mes` se mantiene.** El acordeón y el modo orden se construyen **SOBRE** el aspecto actual de la `.ghead` (cabecera de grupo) y de la tarjeta-lista, no lo reemplazan. La cabecera de grupo de hoy —rótulo uppercase con tracking (`--ink-2`), pill contador (`--panel-3`), línea `flex-1 h-px bg-hair`, subtotal mono (`--muted`) a la derecha— se conserva **idéntica**; lo que esta spec agrega son: el affordance de colapso, el estado colapsado, la sección vacía y el modo orden. Cualquier elemento no mencionado abajo queda exactamente como está.
>
> **Decisiones de producto ya cerradas con el usuario que esta spec respeta:** (1) se muestran **siempre las 3 secciones**, aunque estén vacías (hoy se ocultan las vacías); por eso se define el estado de sección vacía. (2) El motor de drag será **dnd-kit** y el acordeón se piensa como **patrón reutilizable** en el resto de la app — por eso el spec describe la cabecera colapsable y la fila reordenable de forma **genérica** (una "sección de acordeón" / un "ítem reordenable"), no atada a que sean exactamente 3 ni a que sean Únicos/Fijos/Cuotas.
>
> **Lo que NO es de esta spec (se deriva):** la **persistencia** del estado colapsado/expandido y del orden de secciones (por usuario) es comportamiento funcional/técnico — esta spec define cómo se **ve** cada estado, no dónde ni cómo se guarda. Si el frontend necesita el contrato de persistencia, lo pide al analista vía orquestador.

### A. Anatomía: la "sección de acordeón" (patrón genérico reutilizable)

Una sección de acordeón es el par **cabecera (`.ghead`) + cuerpo (tarjeta-lista)** que `/mes` ya tiene hoy por grupo. Se generaliza así para que el patrón sirva en otras pantallas:

- **Cabecera de acordeón** = la `.ghead` actual, vuelta clickable (botón de disclosure). Lleva: glifo de colapso (chevron), rótulo, pill contador, línea divisoria `flex-1 h-px bg-hair`, valor a la derecha (en `/mes`: el subtotal mono). El look es el de hoy; lo único nuevo es el chevron y que toda la cabecera es accionable.
- **Cuerpo de acordeón** = la tarjeta-lista de hoy (`bg-panel border border-line rounded-card shadow-sm`, con sus filas). Es lo que colapsa/expande.
- En `/mes`, el patrón se instancia 3 veces (Únicos / Fijos / Cuotas). En otra pantalla, N veces con otro rótulo/valor. El espaciado entre secciones se mantiene el actual (`space-y-[30px]`).

### B. Cabecera colapsable (P5) — affordance, área clickeable, estados

**La `.ghead` se vuelve un disclosure sin perder su look.** Toda la fila de cabecera pasa a ser el control que colapsa/expande su cuerpo. No se la convierte en una caja con fondo ni borde: sigue siendo la misma fila al aire que es hoy. Solo se le agrega el chevron y el comportamiento de botón.

**Chevron de colapso:**

- **Glifo:** `ChevronRight` (lucide), **16px**, `stroke-width` 2 (default lucide; coherente con los chevrons chicos del DS). Se usa `ChevronRight` como glifo base y se **rota** para indicar estado (ver abajo) — un único glifo que gira, no dos íconos distintos.
- **Ubicación:** **primer elemento de la fila**, a la izquierda del rótulo, antes de "Únicos/Fijos/Cuotas". Empuja el resto de la fila; el `gap-3` actual entre elementos de la `.ghead` se mantiene (el chevron entra como nuevo primer hijo con el mismo `gap`). El rótulo, el pill, la línea y el subtotal conservan su orden y estilo.
- **Color:** `--muted` en reposo (terciario, coherente con que la `.ghead` es meta, no protagonista; el chevron no debe competir con el rótulo `--ink-2`). Pasa a `--ink-2` en hover de la cabecera (ver estados).
- **Rotación según estado:** **expandida** → chevron apuntando **hacia abajo** (rotación `90deg` desde el `ChevronRight` base, es decir apunta ▼). **Colapsada** → chevron en su orientación base apuntando **a la derecha** (▶, `0deg`). Convención estándar de acordeón: apunta abajo cuando está abierto, a la derecha cuando está cerrado. La rotación **anima** (ver "Animación").
- **No se agrega un segundo control:** el chevron es indicador, no un botón separado; el área accionable es toda la cabecera (abajo).

**Área clickeable:**

- **Toda la cabecera** (`.ghead` completa: chevron + rótulo + pill + línea + subtotal) es el área que dispara el colapso/expansión. Es un único control de disclosure que ocupa el ancho de la fila. Se prefiere cabecera-entera-clickable (no solo el chevron) por superficie de click generosa, coherente con el resto del DS.
- **Semántica:** la cabecera es el disclosure trigger (`button`, `aria-expanded`, `aria-controls` apuntando al cuerpo). El cuerpo es la región controlada. El frontend resuelve el marcado accesible; lo visual es: la fila entera responde al hover/focus/click como un solo control.
- **Cursor:** `pointer` sobre toda la cabecera.

**Estados de la cabecera (disclosure):**

- **Reposo:** idéntico a la `.ghead` de hoy + chevron `--muted`. Sin fondo, sin borde.
- **Hover:** señal **sobria**, porque la `.ghead` no es una caja. El **chevron sube a `--ink-2`** y el **rótulo sube de `--ink-2` a `--ink`** (refuerzo de "esto es accionable"). **No** se pinta un fondo `--panel-2` en toda la fila (rompería el look "al aire" de la cabecera) — la única señal de hover es el oscurecimiento del chevron + rótulo. Transición **0.14s** (hover estándar del DS) en `color`. El pill, la línea y el subtotal no cambian en hover.
- **Focus (teclado):** anillo de foco del DS — `shadow-[0_0_0_3px_var(--accent-soft)]` — sobre la fila de cabecera (`focus-visible`), con un radio suave (`--r-chip`, 7px) para que el ring no quede con esquinas vivas sobre una fila sin caja. El `--accent-soft` acá es ring de interacción de UI, no tiñe nada semántico (mismo criterio que los demás focos del DS).
- **Active/pressed:** sin tratamiento extra (la acción es instantánea; el feedback es la propia animación de colapso). 

**Comportamiento del subtotal y el contador al colapsar:**

- El **pill contador** y el **subtotal mono** de la cabecera **permanecen visibles en estado colapsado** — son justamente la información de resumen que el usuario quiere ver cuando la sección está cerrada ("Fijos · 4 · −$120.000" de un vistazo sin abrir). No se ocultan ni se atenúan al colapsar. Conservan su estilo actual.
- Lo único que cambia al colapsar es: el cuerpo (tarjeta-lista) se oculta y el chevron rota a ▶. La cabecera con su resumen queda como única línea visible de la sección.

### C. Animación de colapso / expansión

- **Qué anima:** (1) la **altura** del cuerpo (tarjeta-lista) entre 0 y su alto natural, con `overflow: hidden` durante la transición para que las filas no se desborden; (2) un **fade** del cuerpo (`opacity` 0↔1) acompañando la altura, para que el contenido no aparezca/desaparezca de golpe; (3) la **rotación** del chevron (▶↔▼).
- **Duración:** **0.22s** — el mismo tiempo del `pop` de modal del DS; suficiente para leerse como un despliegue suave sin demorar la interacción. (Entre el hover de 0.14s y la entrada de pantalla de 0.32s; un colapso es una transición de tamaño media.)
- **Easing:** `ease-out` (el contenido entra rápido y desacelera), coherente con el movimiento sobrio del DS.
- **Chevron:** la rotación usa la misma duración (0.22s) y easing, para que glifo y cuerpo se muevan en conjunto.
- **`prefers-reduced-motion`:** se **desactiva** la transición de altura, fade y rotación. El colapso/expansión es **instantáneo** (el cuerpo aparece/desaparece sin animar; el chevron salta a su orientación final). Regla obligatoria del DS.
- **Nota de implementación (no normativa):** animar `height:auto` requiere medir el alto natural (técnica de grid `1fr`/`0fr` o medición JS); el frontend elige la técnica mientras el resultado sea: despliegue suave de 0.22s ease-out con fade, y respeto a `prefers-reduced-motion`.

### D. Sección vacía (decisión de producto: se muestran siempre las 3)

A diferencia de hoy (que oculta una sección sin movimientos), las 3 secciones **se renderizan siempre**. Una sección sin ítems se ve así, manteniendo el look actual:

- **Cabecera:** presente y **completa**, con su chevron, rótulo, pill contador y subtotal. El **pill contador muestra `0`** (mismo estilo `--panel-3` / `--muted`). El **subtotal muestra el cero formateado** según el formateador actual (sin signo, p. ej. el `formatCurrency(0)` que el componente ya usa) en mono `--muted`. La cabecera de una sección vacía no se atenúa: se lee igual que una con contenido, solo que su contador es 0.
- **Cuerpo (cuando está expandida):** en vez de la tarjeta-lista con filas, un **estado vacío inline** dentro de la misma caja de tarjeta, reutilizando el patrón de empty ya presente en `/mes`:
  - Caja `rounded-card border border-dashed border-line bg-panel-2`, con padding interior generoso (`px-6 py-6`, un punto más compacto que el empty global de la pantalla que usa `py-8`, porque acá es el empty de **una** sección, no de toda la vista). El borde **dashed** la distingue de una tarjeta-lista con contenido (que lleva borde sólido) y comunica "acá todavía no hay nada".
  - **Texto:** una sola línea, centrada, rol *Meta/subtítulos* (12.5–13px, `--muted`): por sección, **"Sin movimientos únicos" / "Sin fijos" / "Sin cuotas"** (copy breve; el redactado exacto es copy funcional — si el analista define otro, se respeta; lo visual es: una línea `--muted` centrada). Sin ilustración, sin botón. Sobrio.
- **Cuerpo (cuando está colapsada):** igual que cualquier sección colapsada — el cuerpo (incluido el empty inline) se oculta; queda solo la cabecera con su contador en 0. Una sección vacía **se puede colapsar igual** que una con contenido (no hay caso especial).
- **El empty global de la pantalla** (el bloque "No hay movimientos en {mes}" que hoy aparece cuando las 3 están vacías) — **señal a derivar:** con la decisión de mostrar siempre las 3 cabeceras, hay que definir funcionalmente si ese empty global **convive** con las 3 secciones vacías o se **reemplaza** por ellas. Esto es comportamiento de pantalla (qué se muestra cuándo), no lenguaje visual: lo marco como **impacto a derivar al analista** (`docs/screens.md`). Visualmente, si el analista decide conservar el empty global, su estilo no cambia; si decide que las 3 secciones vacías lo sustituyen, esta spec ya cubre cómo se ve cada sección vacía.

### E. Modo orden / edición (P6) — disparador, entrada, drag y salida

Reordenar las secciones es una acción **deliberada y poco frecuente**, no algo que el usuario hace en cada visita. Por eso **no** se muestran handles de drag permanentemente (ensuciarían el look actual que al usuario le gusta): se entra a un **modo orden** explícito, se reordena, y se sale. El drag está disponible **solo dentro de ese modo**.

**Disparador — botón "Ordenar secciones":**

- **Ubicación:** en el **header de página (`.phead`)**, en la fila del título, **a la izquierda del botón "+ Nuevo movimiento"** (ambos a la derecha del bloque de título, con el `gap-5` que el header ya tiene entre sus elementos de la derecha). Queda en el mismo plano que la acción primaria pero claramente subordinado a ella por estilo.
- **Estilo:** botón **ghost del DS** (`.btn.ghost`): sin fill, texto `--ink-2`, ícono a la izquierda, `hover:bg-panel-2 hover:text-ink`, radio `--r-ctl` (10px), foco `--accent-soft`. **No** es primario índigo — el primario del header sigue siendo, único, "+ Nuevo movimiento" (no se le disputa el acento). Tamaño de texto 13px/600.
- **Ícono:** lucide `ArrowUpDown` (15px, a la izquierda del texto) — comunica "reordenar verticalmente" sin ambigüedad. Rótulo: **"Ordenar secciones"**.
- **Visibilidad:** solo se renderiza cuando hay **al menos 2 secciones con contenido** que tenga sentido reordenar — aunque, dado que ahora las 3 cabeceras están siempre, el botón está siempre disponible (siempre hay 3 secciones que reordenar). Se mantiene visible en todo momento en `/mes`.

**Entrada al modo orden — cómo cambia la página:**

Al activar "Ordenar secciones", la página entra en estado editable. El cambio es **acotado a las secciones**; el header, los totales y el resto no se alteran (salvo el botón disparador, que cambia a "Listo", abajo). Cambios visuales:

- **El botón disparador se transforma en "Listo":** mismo lugar, pasa de ghost a **botón primario índigo** (`.btn` primario) con rótulo **"Listo"** (sin ícono, o con `Check` 15px a la izquierda). Señala inequívocamente que se está en modo orden y cómo salir. (Es el único momento en que aparece un segundo botón primario en el header; mientras dura el modo orden, "+ Nuevo movimiento" se atenúa/deshabilita — ver abajo — así que no compiten dos primarios activos.)
- **"+ Nuevo movimiento" se deshabilita** mientras dura el modo orden: pasa a estado disabled del DS (opacidad reducida ~0.45, `cursor: default`, sin hover). Cargar un movimiento nuevo en pleno reordenamiento no tiene sentido; al salir vuelve a su estado normal. (Decisión visual coherente con "el modo orden es un estado modal-lite de la lista".)
- **Cada cabecera de sección gana un handle de drag:** un glifo lucide `GripVertical` (16px, `--muted`) aparece **a la izquierda del chevron** (nuevo primer elemento de la `.ghead` durante el modo orden), con `cursor: grab` (`grabbing` mientras se arrastra). El handle es el asidero de dnd-kit. El resto de la cabecera mantiene su contenido.
- **La cabecera deja de funcionar como disclosure mientras dura el modo orden** (ver "Colapsar durante el modo orden", abajo): el click/tap sobre la cabecera no colapsa; la interacción de la cabecera es **arrastrar**. El chevron se mantiene visible (indica el estado colapsado/expandido que tenía cada sección) pero **no responde al click**; su hover de disclosure se suspende.
- **Affordance de "esto se puede mover":** cada sección entera (cabecera + cuerpo) se vuelve una **tarjeta arrastrable**. Para comunicarlo sin recolorear, se aplica a cada sección un sutil realce de contenedor: la sección se envuelve visualmente como un bloque con `--shadow-sm` y un borde `--line` apenas perceptible alrededor del conjunto cabecera+cuerpo (o, más simple y preferido: **no** se agrega caja nueva; el handle `GripVertical` + el cursor `grab` + la sombra que aparece al levantar ya comunican el affordance). **Preferencia: mínima intervención** — handle visible + cursor grab, sin cajas nuevas alrededor de la sección, para no romper el look. El realce fuerte se reserva para el ítem **levantado** (abajo).
- **Atenuación de foco:** opcionalmente, el contenido **dentro** de las tarjetas-lista (las filas de movimiento) puede bajar levemente a `opacity: 0.7` durante el modo orden, para que la atención vaya a la estructura (las secciones como bloques movibles) y no a las filas individuales. Es **opcional** y sutil; si genera dudas de implementación, omitirlo — el handle + el botón "Listo" ya señalan el modo. Las cabeceras (lo que se arrastra) **no** se atenúan: son el sujeto de la acción.

**Feedback durante el arrastre (dnd-kit):**

- **Ítem levantado (drag overlay):** la sección que se arrastra se "levanta" del plano: gana `--shadow-lg` (la sombra de elevación máxima del DS, la de modales/panel), un leve `scale(1.02)` y `opacity` ~0.95, y sigue al cursor. Conserva su contenido (cabecera + cuerpo, o cabecera sola si estaba colapsada) para que el usuario vea qué está moviendo. El `cursor` es `grabbing`.
- **Placeholder / hueco destino:** en la posición original (y desplazándose a la posición destino mientras se arrastra) queda un **hueco** que marca dónde caería la sección: un bloque del alto de la sección arrastrada con `rounded-card`, fondo `--panel-2`, **borde `dashed` `--line`** (mismo lenguaje "dashed = espacio reservado / sin contenido fijo" que la sección vacía). Las demás secciones se **desplazan suavemente** (transición de 0.14–0.22s, el movimiento de reordenamiento de dnd-kit) para abrir el hueco. 
- **Indicador de inserción (alternativa equivalente):** si el frontend prefiere, en vez de un hueco con dashed puede usar una **línea de inserción** de 2px `--accent` entre secciones marcando dónde caerá — el `--accent` acá es indicador de interacción de UI (dónde suelto), no tiñe montos, admisible. **Preferencia: el hueco dashed** por ser más claro a nivel de "bloque que entra en este lugar"; la línea de inserción es aceptable si el hueco complica la implementación con dnd-kit.
- **Solo se reordenan secciones, no ítems:** dentro de una tarjeta-lista, las filas **no** muestran handles ni son arrastrables. El único elemento arrastrable es la sección (vía su cabecera/handle). Visualmente: ninguna fila de movimiento gana `GripVertical` ni cursor grab. Esto refuerza que lo que se mueve son bloques, no filas.

**Colapsar durante el modo orden — deshabilitado:**

- Mientras dura el modo orden, **colapsar/expandir queda deshabilitado**. Razón: la cabecera está dedicada a arrastrar; mezclar "click colapsa" con "drag mueve" sobre el mismo elemento es ambiguo y propenso a accidentes (un drag corto se leería como click). El chevron se ve (refleja el estado actual de cada sección) pero **no es accionable**: sin hover de disclosure, sin cambio de cursor a pointer sobre el chevron (el cursor de la cabecera es `grab`). Cada sección se arrastra en el estado (colapsada/expandida) en que esté; arrastrar una sección colapsada mueve solo su cabecera (más compacta, lo cual de hecho facilita reordenar muchas secciones).
- Al **salir** del modo orden, el chevron vuelve a ser accionable y el colapsar/expandir se rehabilita; cada sección conserva el estado colapsado/expandido que tenía.

**Salida del modo orden:**

- **Botón "Listo"** (el disparador transformado) — al pulsarlo, la página vuelve al estado normal: desaparecen los handles `GripVertical`, las cabeceras vuelven a ser disclosures, "+ Nuevo movimiento" se rehabilita, y "Listo" vuelve a ser "Ordenar secciones" (ghost). El nuevo orden queda aplicado.
- **No hay "cancelar" en v1:** el reordenamiento se aplica en vivo (cada drop reordena); "Listo" solo cierra el modo, no confirma/descarta (no hay un estado pendiente que descartar). Coherente con que el orden se persiste a medida que se reordena. (Si producto quisiera un cancelar, sería alcance nuevo — no se asume.)
- La transición de entrada/salida del modo orden (aparición/desaparición de handles, cambio del botón) usa la duración de hover del DS (0.14s) para los cambios de color/opacidad; no requiere animación elaborada.

### F. Responsive (≥941px vs ≤940px)

- **≥941px (desktop, sidebar visible):** todo lo anterior aplica tal cual. El botón "Ordenar secciones" / "Listo" vive en el `.phead` junto a "+ Nuevo movimiento". El drag es por mouse (handle `GripVertical`). El acordeón funciona con click en la cabecera.
- **≤940px (sidebar oculta, header compacto con stepper):** 
  - **Acordeón:** funciona igual (cabeceras clickables, chevron, colapso). El tap sobre la cabecera colapsa/expande. Sin cambios de tamaño en el chevron.
  - **Botón "Ordenar secciones":** en ≤940px el header ya está más apretado (stepper compacto + "+ Nuevo movimiento"). El botón disparador se mantiene en el header; si el espacio no alcanza, el header **envuelve** (`flex-wrap`, que el header ya usa) y el botón "Ordenar secciones" baja a una segunda fila junto a "+ Nuevo movimiento". No se oculta ni se mueve a otro lugar (mantener un único punto de entrada al modo orden).
  - **Drag táctil:** el handle `GripVertical` es el asidero también en touch (dnd-kit soporta pointer/touch). El target del handle debe ser cómodo al dedo: aunque el glifo es 16px, su zona de toque efectiva conviene que sea ≥40px (padding alrededor del handle), sin agrandar el glifo. El feedback (ítem levantado con `--shadow-lg`, hueco dashed) es idéntico al de desktop.
  - Ninguna parte del modo orden scrollea horizontal; las secciones ocupan el ancho del contenido como hoy.

### G. Convivencia con las reglas duras (recordatorio)

- El chevron, el handle `GripVertical`, el ring de foco (`--accent-soft`) y el eventual indicador de inserción (`--accent`) son **cromo de interacción de UI** (navegación/affordance), **no** montos ni cifras de dinero: no tocan la regla dura 2 (el acento sigue siendo solo marca/interacción, nunca tiñe un monto). Ningún elemento de esta spec recolorea un subtotal ni un monto: el subtotal de la cabecera conserva su `mono --muted` y su signo (+/−) actuales; los montos de las filas, su color semántico income/expense intacto (reglas duras 1 y 3). El modo orden y el colapso **no alteran** ninguna cifra: solo muestran/ocultan y reordenan bloques.

---

## Reportes configurables — spec visual (Fase 1.1.5, 2026-06-17)

> Spec del lenguaje visual de la Fase 1.1.5: el **renombre de `/anual` → `/reportes`** como pantalla **configurable por cards** y el **widget de reporte autónomo** que cada card monta (pantallas 7 y 8 de `screens.md`; RF-REP-001..005). Las **dos visualizaciones** (Forma 1 — Ingresos vs. Gastos; Forma 2 — Gastos por categoría apilado) **no cambian su gráfica**: el área, las barras apiladas, los ejes, la leyenda y el tooltip ya definidos en "Gráfico anual — spec visual del widget" **siguen vigentes tal cual** y se reutilizan sin tocar. Lo que esta fase agrega/cambia es el **encuadre**: cada visualización deja de ser un recuadro de año compartido y pasa a ser un **widget autónomo** que lleva **embebidos** (a) su propia navegación de año independiente y (b) su propio filtro de categorías; y la pantalla anfitriona deja de ser un par fijo de tarjetas para volverse una **grilla configurable de cards** que el usuario arma con un **"[+]"**.
>
> **No introduce tokens nuevos:** todo se resuelve con los tokens y patrones vigentes del DS "Precise Ledger" y con el patrón `PeriodNav` de la Fase 1.1.3.
>
> **El control de año embebido per-card y el filtro de categorías embebido son lenguaje vivo** (resumen en `docs/design.md`, "Patrones de componentes vigentes"). Esta sección archiva el detalle de cómo se cerró en la Fase 1.1.5.
>
> **Qué de "Gráfico anual — spec visual del widget" queda superado por esta sección** (y solo eso): (1) el **"Control de año ‹ › compartido (`/anual`)"** que vivía en el `.phead` y gobernaba las dos tarjetas a la vez — **eliminado**: ya no hay control compartido; cada card navega su año con el control embebido que se define abajo. (2) El **año mono suelto en la cabecera de la tarjeta del Dashboard** (zona derecha, sin navegación) — **superado**: el Dashboard ahora monta el widget con navegación **activa** (mismo control embebido). (3) La idea de "dos tarjetas apiladas fijas en `/anual`" — **superada** por la grilla configurable. Todo lo demás de esa sección (gráficas, ejes, leyenda, tooltip, estados de carga/vacío/error del área de gráfico, alto de canvas, mapeos de color, reglas duras) **se conserva**.

### A. Anatomía de una card de reporte (widget autónomo)

Una **card de reporte** es la unidad que `/reportes` apila y que el Dashboard monta una sola vez. Es la **tarjeta `.card` de gráfico ya existente** (panel blanco, `--line`, `--r-card` 14px, `--shadow-sm`, padding interior `--card-pad` 22px) **más** dos controles embebidos nuevos y una affordance de quitar. De arriba hacia abajo, la estructura interna de la card es:

1. **Barra de cabecera de la card** — fila flex `space-between`, `align-items: center`, `margin-bottom` 18px (`--gap`). Reemplaza la cabecera de la "Gráfico anual" en lo que toca a la zona derecha:
   - **Izquierda — identidad de la card:** igual que hoy. Eyebrow uppercase (rol *Eyebrow/labels*: 12px/600, `.1em`, uppercase, `--muted`) + **título de la card** debajo (UI font 16px/600 `--ink`):
     - Card `income-expense` (Forma 1) → eyebrow **"Reporte"**, título **"Ingresos y gastos"**.
     - Card `by-category` (Forma 2) → eyebrow **"Reporte"**, título **"Por categoría"**.
     (El eyebrow pasa de "Resumen anual"/"Tu actividad" a **"Reporte"** porque la card ya no vive bajo un H1 "Anual" que dé ese contexto; cada card se autodescribe. En el Dashboard la card de Forma 1 usa el mismo eyebrow "Reporte" — ver sección F.)
   - **Derecha — barra de controles de la card:** una fila flex `items-center` con `gap` 8px que aloja, en este orden de izquierda a derecha: **el control de año embebido** (A.1), **el botón de filtro de categorías** (A.2) y, **solo en `/reportes`**, la **affordance de quitar** la card (A.3). El año mono suelto de la cabecera del Dashboard **desaparece** (lo reemplaza el control de año activo). Si el contenido no entra en una fila junto al título, la cabecera envuelve (ver responsive, sección G).
2. **Área del gráfico** — el chart ya definido (Forma 1 área / Forma 2 barras apiladas), con sus ejes, gridlines y estados. Sin cambios.
3. **Leyenda** — debajo del área, sin cambios respecto de la spec del gráfico.

> **Nota sobre el alto del canvas:** las cards de `/reportes` usan el alto de **300px** en desktop (el ya definido para `/anual`, por tarjeta) y **220px** en ≤940px. La card del Dashboard conserva su **280px** (desktop) / 220px (≤940px), como ya estaba. Estos altos no cambian.

### A.1. Control de año embebido per-card — LA decisión central de la fase

El patrón de **flechas gigantes laterales** de la Fase 1.1.3 (`PeriodNav`, `‹ contenido ›`, botón 64px / glifo 46px, sticky centrado vertical, columnas que flanquean **toda la columna de contenido de la página**) fue diseñado para **una sola vista de período a ancho completo** (`/mes`) y para un control **único por pantalla**. En `/reportes` hay **varias cards apiladas** y **cada una navega su propio año**: flanquear la página entera con flechas gigantes ya **no aplica** (no se sabría a qué card pertenecen, y habría una sola pareja para muchas cards). Por eso el control de año de 1.1.5 **NO** usa las flechas laterales gigantes a nivel de página. Se resuelve así:

**El control de año vive DENTRO de la cabecera de cada card, como un `.stepper` pill embebido** — exactamente el **mismo control compacto** que el patrón `PeriodNav` de 1.1.3 ya define como su **modo de colapso** (el `.stepper` pill que `/mes` usa en ≤940px). Es decir: 1.1.5 adopta el patrón de 1.1.3, pero **siempre en su forma compacta `.stepper`**, montada en la barra de controles de la card (A.1, zona derecha de la cabecera), no en columnas laterales de página. Justificación de coherencia: el `.stepper` **es parte del mismo patrón `PeriodNav`** (su modo compacto canónico), así que usarlo per-card no inventa un control nuevo — reusa el que el patrón ya reserva para "cuando no hay lugar para flechas laterales", que es exactamente el caso de varias cards apiladas con navegación propia.

**Especificación del `.stepper` de año embebido:**

- **Forma:** pill `.stepper` del DS — `--r-pill`, fondo `--panel`, borde `--line`, `--shadow-sm`, padding 4px. Dos botones circulares **32px** (chevron-left / chevron-right, glifo `ChevronLeft`/`ChevronRight` lucide a 18px, `--ink-2` que pasa a `--ink` sobre fondo `--panel-2` en hover) y, en el centro, el **año** como label **mono tabular** (es un número → regla dura 3), **14.5px/600**, `--ink`, `min-width` ~52px centrado (un año son 4 dígitos; 52px alcanza). Es el mismo `.stepper` que ya existe, sin la sub-línea "Mes en curso" (acá no aplica un estado de período análogo).
- **Glifo de los chevrons:** `ChevronLeft` / `ChevronRight` a **18px** (no 46px — esto **no** es la flecha gigante lateral; es el chevron compacto del `.stepper`). El "gigante" del patrón 1.1.3 se reserva para `/mes`; en cards embebidas el control es compacto por necesidad de layout.
- **Estados de los chevrons — límites de navegación (RF-REP-002):** se hereda **exactamente** el estado **disabled** ya definido en `PeriodNav` (Fase 1.1.3) y en el control de año del gráfico:
  - **‹ deshabilitado** cuando el año mostrado es `earliestYear` (primer año con CUALQUIER movimiento del usuario, **no** afectado por el filtro de categorías — RF-REP-005): chevron `--faint`, `opacity` 0.4, `cursor: default`, sin hover, `aria-disabled`. No se oculta.
  - **› deshabilitado** cuando el año mostrado es el año en curso (no se navega al futuro): mismo tratamiento apagado.
  - Reposo, hover, active y focus de los chevrons: los del `.stepper` del DS (hover `--panel-2`, focus ring `--accent-soft` 3px). Sin novedad.
- **`aria-label` de los chevrons:** "Año anterior" / "Año siguiente" (el patrón `PeriodNav` ya contempla recibir el label según el período).
- **Ubicación:** primer elemento de la barra de controles de la cabecera (A, punto 1, zona derecha), a la izquierda del botón de filtro. Alineado al centro vertical de la fila de cabecera.

**Por qué NO las flechas gigantes laterales acá (registro de la decisión):** (1) son **un control por página**, no por card; con N cards no hay forma de que una sola pareja de flechas laterales navegue años independientes. (2) Viven en **columnas que flanquean los 1120px de contenido**; meterlas por-card obligaría a un grid de 3 columnas por cada card y a flechas gigantes pegadas a cada tarjeta — visualmente ruidoso y ambiguo cuando hay varias cards. (3) El propio patrón 1.1.3 ya previó este caso y **dejó el `.stepper` como su modo compacto reutilizable**. Adoptarlo es la lectura fiel de la nota de continuidad de 1.1.3 ("si las flechas flanquean la card individual… ese encuadre por-card lo resuelve 1.1.5"): **lo resolvemos optando por el modo `.stepper` del patrón, no por flechas gigantes per-card.** El lenguaje visual de la flecha (chevron, estados, disabled) es el mismo del patrón; solo cambia el encuadre (pill embebido en la cabecera, en vez de columnas laterales).

### A.2. Filtro de categorías embebido (checklist en popover)

Cada card filtra **su propio** subconjunto de categorías (default: todas). El filtro debe (a) ofrecer el **universo de categorías del usuario** (no solo las con gasto, porque aplica también a Forma 1), (b) **no tapar el gráfico** y (c) caber en una cabecera junto al año. Se resuelve como **botón disparador + popover con checklist**, no como fila de chips permanente (una fila de chips de todas las categorías ocuparía demasiado alto fijo y competiría con el gráfico).

**A.2.1 — Botón disparador del filtro (en la cabecera):**

- **Estilo:** botón **ghost chico** del DS (patrón `.btn.ghost.sm`): sin fill en reposo, texto `--ink-2`, ícono a la izquierda, `hover:bg-panel-2 hover:text-ink`, radio `--r-ctl` (10px), foco `--accent-soft` 3px. Texto 12.5–13px/600.
- **Ícono:** lucide `SlidersHorizontal` (15px, a la izquierda del texto) — comunica "filtrar/ajustar". (Se elige `SlidersHorizontal` sobre `Filter` para no chocar con ningún otro uso; cualquiera de los dos es admisible, **preferencia `SlidersHorizontal`**.)
- **Rótulo y estado (el texto refleja la selección):**
  - **Todas seleccionadas (default):** rótulo **"Categorías"** (sin contador). Estado neutro: el filtro está "en su default", nada que destacar.
  - **Subconjunto (algunas destildadas, ≥1 seleccionada):** rótulo **"Categorías · N"** donde **N = cantidad seleccionada**, con el "· N" en mono tabular (es un número) `--ink`. Además, para señalar "hay un filtro activo" sin recolorear el botón, el ícono y el texto del botón suben a `--ink` (no `--ink-2`) y el botón gana un **punto indicador** de 6px `--accent` (`•`) inmediatamente a la derecha del rótulo. El `--accent` acá es **cromo de interacción de UI** (marca "filtro activo"), **no** tiñe ningún monto → regla dura 2 intacta. Es el único uso de acento del control, y es admisible por ser indicador de estado de UI, no cifra.
  - **Ninguna seleccionada:** rótulo **"Categorías · 0"**, mismo tratamiento de "filtro activo" (ink + punto acento). Es un estado válido (el gráfico se grafica en cero, ver A.2.4); el botón no se pinta de error.
- **Estado abierto (popover desplegado):** el botón queda en estado "activo" visual — fondo `--panel-2`, texto `--ink` — mientras el popover está abierto, para anclar visualmente el origen del popover.

**A.2.2 — Popover del checklist:**

- **Tipo:** **popover** anclado al botón disparador, que **se despliega hacia abajo** desde la cabecera, **por encima** del área de gráfico (overlay, no empuja el layout) y **alineado a la derecha** del botón (su borde derecho coincide con el del botón, para no salirse de la card). Al abrirse **flota sobre el gráfico** sin desplazarlo; al cerrarse, el gráfico queda intacto. Esto resuelve "no tapar el gráfico de forma permanente": el gráfico solo queda cubierto **mientras** el popover está abierto, que es justo cuando el usuario está eligiendo categorías y no mirando el gráfico.
- **Caja:** panel `--panel`, borde `--line`, radio `--r-ctl` (10px), `--shadow-lg` (la sombra de elevación de popovers/menús del DS), padding 0 (el padding lo dan las zonas internas, abajo). **Ancho** fijo **260px**. **Alto máximo** ~320px con **scroll vertical interno** (`overflow-y: auto`) cuando hay muchas categorías; el header y el footer del popover (abajo) quedan **fijos** (sticky) y solo scrollea la lista. `margin-top` 6px respecto del botón (aire disparador↔popover).
- **Header del popover (fijo arriba):** una fila `space-between` con padding `10px 12px`, borde inferior `--hair`:
  - Izquierda: label **"Mostrar categorías"** (rol *Eyebrow/labels* atenuado: UI 12px/600, `.1em`, uppercase, `--muted`).
  - Derecha: una acción de texto **toggle "Todas" / "Ninguna"** — link-button ghost muy chico (UI 12px/600, `--accent-ink`, hover subraya). Muestra **"Todas"** cuando hay ≥1 destildada (la acción selecciona todas); muestra **"Ninguna"** cuando están todas tildadas (la acción destilda todas). Es el atajo de seleccionar/deseleccionar en bloque. El `--accent-ink` acá es color de **acción de UI** (un link), no un monto → admisible.
- **Lista de categorías (scrollable):** una fila por categoría del **universo del usuario** (todas las activas; el orden = el de `/categorias`, alfabético o el que ya use esa pantalla — el front reutiliza el mismo orden de categorías que ya muestra). Cada fila:
  - `flex items-center gap-[10px]`, padding `8px 12px`, `cursor: pointer`, toda la fila es el target del toggle (no solo el checkbox). Hover de fila: fondo `--panel-2`.
  - **Checkbox** del DS a la izquierda (el componente checkbox ya existente; marcado = `--accent` con check `--panel`, desmarcado = borde `--line-strong` sobre `--panel`). El `--accent` del check es cromo de control de formulario, admisible (no es monto).
  - **Swatch de color de la categoría** 10px, radio 3px (el mismo swatch chico de la leyenda del gráfico), con el `category.color`. Va **entre** el checkbox y el nombre, para que el usuario asocie la categoría a su color (clave en Forma 2, donde el color es la banda).
  - **Nombre** de la categoría: UI 13px/500 `--ink` (tildada) / `--ink-2` (destildada, leve atenuación para reforzar "no cuenta"). Sin contador de movimientos acá (no es `/categorias`): solo color + nombre.
  - Si una categoría está **soft-deleted pero todavía aparece con gasto en algún año** (RF-CAT-004): **no** se lista en el universo del filtro (el universo son las **activas**); el gráfico igual la dibuja con su color en los años donde tiene gasto (eso lo maneja el dato, no el filtro). El filtro opera sobre categorías activas; no agrega filas para categorías eliminadas. *(Si esto resultara ambiguo funcionalmente — ver "Dudas para el orquestador".)*
  - **Empty del universo:** si el usuario no tiene ninguna categoría activa (caso límite: las eliminó todas), el popover muestra, en lugar de la lista, una línea centrada UI 12.5px `--muted` "No tenés categorías." con padding `16px 12px`. Sin acción.
- **Footer del popover (fijo abajo) — opcional:** no se agrega footer con botones de "Aplicar/Cancelar": el filtro es **en vivo** (cada check/destilde recalcula el gráfico al instante, como el resto de los filtros del producto). El popover se cierra por: clic fuera, `Esc`, o re-clic en el disparador. No hay confirmación. (Coherente con "el filtro aplica en vivo" de los RF.)

**A.2.3 — Comportamiento de selección:**

- **Default = todas tildadas.** Visualmente, todas las filas con checkbox marcado; el botón disparador en su estado neutro "Categorías".
- **Destildar** una o más → el gráfico recalcula en vivo; el botón pasa a "Categorías · N" con el indicador de filtro activo (A.2.1).
- **Todas / Ninguna** desde el header del popover → marca/desmarca en bloque, recalcula en vivo.
- En modo **persistido** (cards de `/reportes`) cada cambio de selección se persiste (RF-REP-004); en modo **efímero** (Dashboard) no. Esto es funcional, no cambia la presentación; visualmente el control se ve y se comporta igual en ambos modos.

**A.2.4 — Filtro que vacía el reporte:** si la selección no tiene movimientos en el año (o "Ninguna"), el área de gráfico muestra los **12 meses en cero** con el **mensaje de estado vacío** ya definido en la spec del gráfico ("Sin movimientos…"), **sin error**. Los límites de navegación de año **no** cambian (siguen atados a `earliestYear`, independiente del filtro). El botón de filtro queda en su estado "activo" (· N o · 0). No se introduce un empty distinto para "el filtro vació el reporte": reusa el empty de año-sin-movimientos del gráfico.

### B. Affordance de quitar una card (A.3, solo en `/reportes`)

La card de `/reportes` se puede **quitar**; la del Dashboard **no** (es fija). La affordance de quitar:

- **Control:** un botón **icon-only** ghost chico al final de la barra de controles de la cabecera (zona derecha, después del filtro). Glifo lucide **`X`** (16px), `--muted` en reposo, `--ink` en hover con fondo `--panel-2`, radio `--r-ctl`, zona de toque ~32×32px, foco `--accent-soft`. `aria-label` "Quitar reporte".
- **Confirmación:** quitar es **reversible en el sentido de que el usuario puede volver a agregar la card**, pero **pierde la configuración** (año + filtro) de esa card. Para evitar un borrado accidental de una card configurada, el clic en `X` abre una **confirmación inline ligera**, no un modal completo: un **popover de confirmación** anclado al botón `X` (mismo lenguaje de popover que el filtro: `--panel`, `--line`, `--r-ctl`, `--shadow-lg`, padding `12px 14px`, ancho ~220px), con el texto UI 13px `--ink` "¿Quitar este reporte?" y, debajo, dos botones en fila: **"Quitar"** (`.btn.sm` con tratamiento **danger** del DS — el rojo `--expense` reservado para acciones destructivas de UI; acá "Quitar" es destructivo de configuración, admisible como acción danger, no como monto) y **"Cancelar"** (`.btn.ghost.sm`). Clic fuera o `Esc` cancela.
  - *Alternativa aceptable si el front prefiere consistencia con el resto de las confirmaciones del producto:* reutilizar el **modal de confirmación** estándar del DS (el mismo de "Eliminar categoría"/"Eliminar movimiento": diálogo radio 18px, `shadow-lg`, título 18px/700, botón danger + cancelar). **Preferencia: el popover inline** por ser una acción de configuración liviana (no toca datos, solo la vista), pero el modal estándar es válido si unifica el patrón de confirmación. Cualquiera de los dos; no inventar un tercer mecanismo.
- **Ubicación del `X`:** es el **último** elemento de la barra de controles. Para que no quede pegado al filtro, lleva un `margin-left` extra de 4px o un mini-divisor `--hair` vertical (1px, alto ~16px) entre el filtro y el `X`, separando "controles del reporte" (año, filtro) de "acción sobre la card" (quitar). **Preferencia: el divisor `--hair`** (lee mejor la separación conceptual).

### C. Recuadro "[+]" para agregar card y elección de tipo

El **"[+]"** está **siempre presente** en `/reportes` (con cards o sin ellas) y es el único punto de alta de cards.

**C.1 — El recuadro "[+]" (la card placeholder de alta):**

- **Forma:** un recuadro del **mismo footprint que una card de reporte** (mismo ancho de columna; ver grilla, sección E), pero con tratamiento de **placeholder / dropzone**: fondo `--panel-2`, **borde `dashed` `--line`** (el mismo lenguaje "dashed = espacio para agregar / sin contenido fijo" que ya usa el empty de sección de `/mes` y el hueco de drag), radio `--r-card` (14px), **sin** `--shadow-sm` (no es una superficie elevada; es una invitación). Alto: en estado vacío inicial (sin cards), un alto generoso para presidir la pantalla (ver D); cuando ya hay cards, un alto **compacto** (~120px) suficiente para alojar el ícono + label, para que el "[+]" no compita con las cards reales.
- **Contenido (centrado, vertical):** ícono lucide **`Plus`** (28px, `--muted`) dentro de un círculo sutil (`--panel-3`, 48px, sin borde) y, debajo, label UI 13px/600 `--muted` **"Agregar reporte"**.
- **Estados:** reposo como arriba. **Hover:** el borde dashed pasa a `--line-strong`, el ícono y el label suben a `--ink-2`, fondo a `--panel-3`; `cursor: pointer`; transición 0.14s. **Focus (teclado):** ring `--accent-soft` 3px sobre el recuadro. Es un único control accionable (un `button` que ocupa todo el recuadro).
- **Ubicación:** **al final** de la grilla de cards (después de la última card), siempre visible. En estado vacío inicial es lo único en pantalla y se centra (ver D).

**C.2 — Elección del tipo de reporte al agregar (el mecanismo de interacción):**

Al activar el "[+]", el usuario debe elegir **Forma 1 (Ingresos vs. Gastos)** o **Forma 2 (Gastos por categoría)** antes de que la card se cree. Mecanismo elegido: **un popover-menú de 2 opciones anclado al "[+]"** (no un modal, no una card placeholder a configurar después — la elección es binaria y trivial, no amerita un modal ni un paso de configuración intermedio).

- **Popover-menú:** anclado al recuadro "[+]", se despliega hacia abajo (o hacia arriba si no hay espacio; el front decide el flip). Mismo lenguaje de popover del DS: `--panel`, `--line`, `--r-ctl`, `--shadow-lg`, padding 6px, ancho ~240px. `margin` 6px respecto del "[+]".
- **Dos ítems de menú** (cada uno una fila `flex items-center gap-[10px]`, padding `10px 12px`, radio `--r-ctl`, hover `--panel-2`, `cursor: pointer`):
  - **Ítem 1 — "Ingresos y gastos":** a la izquierda un **mini-glifo de previsualización** que insinúa la Forma 1 (dos líneas/áreas superpuestas) — puede ser un ícono lucide `AreaChart` o `TrendingUp` (16px, `--ink-2`), o un mini-swatch doble (un cuadradito `--income` + uno `--expense` de 8px). **Preferencia: el ícono `AreaChart`** por simplicidad y para no recargar el menú con semánticos. Nombre: UI 13px/600 `--ink`. Debajo, meta opcional UI 11.5px `--muted` "Ingresos vs. gastos por mes".
  - **Ítem 2 — "Por categoría":** a la izquierda ícono lucide `BarChart3` (16px, `--ink-2`) que insinúa las barras apiladas. Nombre: UI 13px/600 `--ink`. Debajo, meta opcional UI 11.5px `--muted` "Gastos por categoría, apilado".
- **Al elegir un ítem:** el popover se cierra, la card nueva se **agrega al final** (antes del "[+]", que se recoloca después de la nueva card) con su tipo, **año en curso** y **todas las categorías** (RF-REP-003), y la card aparece con la **animación de entrada de card** (sección H). No hay paso de configuración intermedio: la card nace lista y el usuario ajusta año/filtro con sus controles embebidos.
- **Cierre sin elegir:** clic fuera o `Esc` cierra el popover sin crear nada.

### D. Estado vacío inicial de `/reportes` (solo "[+]")

La primera visita (clave `reports` ausente o array vacío, RF-REP-003/004) muestra **solo el "[+]"**, centrado y en versión "presidiendo la pantalla":

- **Layout:** el contenido de la pantalla (header `.phead` + zona de cards) ocupa el `max-width` 1120px habitual. Bajo el `.phead`, en lugar de la grilla de cards, **un único recuadro "[+]" centrado**:
  - **Header `.phead` igual que siempre:** eyebrow (rol *Eyebrow/labels*, `--muted`) **"Tu actividad"** + H1 (rol *H1 página*, 32px/700, `--ink`) **"Reportes"**. (El H1 cambia de "Anual" a "Reportes", coherente con el renombre.) La zona derecha del `.phead` queda **vacía** (ya no hay control de año compartido). 
  - **El recuadro "[+]" en versión grande:** mismo recuadro dashed de C.1 pero con alto generoso (**~280px**, el alto de un área de gráfico, para que se sienta "del tamaño de un reporte que todavía no existe") y centrado horizontalmente, con un ancho acotado (~**480px**, no a ancho completo: una invitación, no una card real estirada). Dentro, el contenido se enriquece respecto del "[+]" compacto:
    - Ícono `Plus` 32px `--muted` en círculo `--panel-3` 56px.
    - Título UI 15px/600 `--ink-2` **"Armá tu primer reporte"**.
    - Línea de ayuda UI 12.5px/500 `--muted`, centrada, máx ~2 líneas: **"Agregá un reporte de ingresos y gastos o de gastos por categoría. Cada uno navega su propio año y filtra sus categorías."** (copy de invitación; si el analista define otro redactado, se respeta — lo visual es: título + una línea de ayuda `--muted` centrada).
  - Sin ilustración, sin segundo CTA. Sobrio, coherente con los empties del DS.
- **Interacción:** el recuadro grande es el mismo disparador del popover-menú de tipo (C.2). Al agregar la primera card, la pantalla pasa al estado "con cards" (E): la card creada se monta arriba y el "[+]" se **encoge a su versión compacta** (C.1) al final de la grilla.

### E. Grilla de cards en `/reportes` (estado con cards)

- **Disposición:** **una sola columna** de cards apiladas verticalmente, a ancho del contenido (`max-width` 1120px), **separadas por `--gap` (18px)** vertical — el mismo aire que ya separaba las dos tarjetas de `/anual`. No se introduce un grid multi-columna en v1.1: las cards de gráfico necesitan ancho para leer 12 meses, y una columna mantiene la coherencia con el `/anual` actual y con el resto del DS (desktop-first, contenido a 1120px). El **orden** de las cards = el orden del array `reports` (RF-REP-004); el front no reordena.
- **El "[+]" compacto** (C.1) va **al final**, después de la última card, separado de ella por el mismo `--gap` (18px). Siempre visible, siempre el último elemento de la columna.
- **Sin reordenamiento de cards en v1.1:** la pantalla **no** ofrece arrastrar/reordenar cards (no está en el alcance cerrado de 1.1.5; el orden es el del array, y el alta agrega al final). No se agregan handles de drag. *(Si producto quisiera reordenar cards, sería alcance nuevo — no se asume.)*
- **Estados por card:** cada card resuelve **su propio** cargando / con datos / vacío / error, con los tratamientos ya definidos en la spec del gráfico (skeleton del alto del canvas, empty "Sin movimientos en {año}", error con `alert-triangle` + "Reintentar"). Una card en error **no** rompe el resto de la columna ni el "[+]". El control de año y el botón de filtro de la cabecera **siguen presentes y usables** aunque el área de gráfico esté en error o cargando (la cabecera no se tapa con el skeleton; solo el área de gráfico).

### F. Dashboard (pantalla 3) — convivencia de resumen fijo + widget con navegación activa

El Dashboard monta **una sola** card de reporte, de tipo `income-expense` (Forma 1), en **modo efímero**, con **navegación de año activa** y **filtro de categorías** — el **mismo widget** y los **mismos controles embebidos** (A.1 control de año `.stepper`, A.2 filtro popover) que las cards de `/reportes`. La card del Dashboard **no** lleva la affordance de quitar (B) — es fija. El reto visual es que el **resumen mensual** del Dashboard (stats + balance hero) es **fijo en el mes en curso y NO navega**, mientras la card **sí** navega año: hay que evitar que el usuario crea que navegar el año de la card mueve el resumen.

**Tratamiento para que no se confundan:**

- **Orden y separación (sin cambios respecto de la spec del gráfico):** de arriba hacia abajo en la columna del Dashboard: bloque de **resumen mensual** (stats + balance hero, con su encabezado de **mes** "Junio 2026") → **card de reporte Ingresos y gastos** → footer "Ver todos los movimientos →". La card va separada del resumen por `--gap` (18px). Son **dos bloques visualmente distintos**: el resumen es un bloque de stats + hero (sin `.card` de gráfico); la card es una `.card` de gráfico con su cabecera. Esa diferencia de forma ya ayuda a separarlos.
- **Anclas temporales explícitas y distintas:**
  - El **resumen mensual** conserva su **encabezado de mes** ("Junio 2026", rol H1 de la pantalla / el que ya use el Dashboard) — deja claro que el resumen es **del mes en curso**. Ese encabezado **no** tiene control de navegación (el Dashboard no navega meses): se ve como un rótulo fijo, igual que hoy.
  - La **card** muestra su **año** en su propio `.stepper` embebido (A.1) dentro de la cabecera de la card — un **control de año**, visiblemente navegable (chevrons), claramente **scoped a la card**. La distinción "mes fijo arriba (rótulo) vs. año navegable abajo (stepper dentro de la card)" es la señal principal: distinto **grano temporal** (mes vs. año) y distinta **forma** (rótulo vs. stepper interactivo).
- **Micro-rótulo de aclaración en la card (refuerzo):** para blindar el caso, la cabecera de la card del Dashboard usa el eyebrow **"Reporte"** (igual que en `/reportes`) y, dado que el grano es anual, el control de año habla por sí mismo. **No** se agrega texto extra del tipo "no afecta el resumen" (sería ruido); la separación de bloques + el distinto grano temporal + el stepper scoped a la card alcanzan. Si tras implementar se viera ambigüedad real, evaluar un eyebrow más explícito ("Reporte anual") — pero **no** se especifica copy adicional ahora (evitar inventar texto).
- **Filtro efímero:** el botón de filtro de la card del Dashboard se ve y se comporta **idéntico** al de `/reportes` (A.2); la única diferencia es que su estado **no se persiste** (al recargar vuelve a "todas"). Visualmente no hay diferencia entre efímero y persistido — el usuario no necesita verlo; es comportamiento, no presentación.
- **La card del Dashboard NO es removible:** no se renderiza el `X` de quitar (B). El usuario no puede sacar el reporte del Dashboard (es parte fija de la pantalla, RF-DASH-001). En `/reportes`, sí.

### G. Responsive (desktop-first)

- **Desktop (>940px):** la cabecera de cada card en **una fila** — título a la izquierda; barra de controles (año `.stepper` + filtro + [quitar]) a la derecha. La columna de cards a 1120px; el "[+]" compacto al final. El popover de filtro y el menú de tipo se anclan a su disparador como se definió.
- **≤940px (sidebar oculta):**
  - **Cabecera de la card:** si los controles (stepper de año + botón de filtro + eventual X) no entran en la misma fila que el título, la cabecera **envuelve en dos filas** (`flex-wrap`): título arriba; barra de controles debajo, alineada al inicio (izquierda). El `.stepper` de año conserva su forma compacta (ya es compacto). El botón de filtro mantiene su rótulo; si aprieta, puede colapsar a **icon-only** (solo `SlidersHorizontal` + el punto acento si hay filtro activo, sin el texto "Categorías · N") — **preferencia: conservar el rótulo** mientras entre; icon-only solo si no entra.
  - **Popover de filtro:** en pantallas muy angostas, el popover anclado de 260px podría desbordar; si no entra alineado a la derecha del botón, se ancla al **borde derecho de la card** con un pequeño margen, o pasa a ocupar casi todo el ancho de la card (con el mismo `max-height` + scroll). El front resuelve el anclaje; el contenido del popover no cambia.
  - **Grilla:** sigue siendo una columna (ya lo era); el área de gráfico de cada card baja a **220px** (ya definido). El "[+]" compacto al final, a ancho de la card.
  - **Empty inicial:** el recuadro "[+]" grande (D) reduce su ancho acotado al ancho disponible de la card (con un margen), conservando el centrado y el copy.
- Ninguna card scrollea horizontal; el contenido encaja al ancho del contenedor (igual que la spec del gráfico).

### H. Movimiento y `prefers-reduced-motion`

- **Alta de card:** la card nueva entra con la **animación de entrada de pantalla del DS** (fade + `translateY`, 0.32s) — aparece desde abajo con un leve desplazamiento, y el "[+]" se recoloca debajo de ella. Las áreas/barras del gráfico de la card hacen su *grow* de entrada (~0.4s) ya definido en la spec del gráfico.
- **Quitar card:** la card sale con un **fade-out + colapso de altura** (0.22s, el tiempo del `pop`/colapso del DS) y las cards de abajo (y el "[+]") **suben suavemente** para cerrar el hueco (transición 0.22s ease-out).
- **Apertura/cierre de popovers** (filtro, menú de tipo, confirmación de quitar): el `pop` de overlay del DS (scale .98→1, 0.22s) que ya usan los menús/modales.
- **Cambio de año de una card:** solo recalcula y reanima el *grow* de **esa** card (~0.4s); las demás cards no se tocan (son independientes). 
- **Cambio de filtro:** el gráfico de la card recalcula; las áreas/barras pueden reanimar el *grow* (~0.4s) o transicionar suavemente sus valores — preferencia: reanimar el *grow*, coherente con el cambio de año.
- **`prefers-reduced-motion`:** se **desactiva** la animación de entrada/salida de cards, el *grow* de gráficos (`isAnimationActive={false}`, ya en la spec del gráfico) y el `pop` de popovers; las transiciones de color/hover de los controles también se desactivan. Las cards aparecen/desaparecen y los gráficos cargan **instantáneamente**. Regla obligatoria del DS.

### I. Convivencia con las reglas duras (recordatorio)

- **Año en mono tabular** (regla dura 3): el año del `.stepper` embebido es un número → mono `tnum`, como ya estaba el año del control de gráfico.
- **El acento solo como cromo de UI** (regla dura 2): los únicos usos de `--accent`/`--accent-ink`/`--accent-soft` en esta spec son **indicadores de interacción** — el punto "filtro activo" del botón de filtro, el link "Todas/Ninguna" del popover, el check de los checkboxes, los focus rings. **Ninguno tiñe un monto ni una cifra de dinero.** El acento sigue siendo solo marca/interacción.
- **Semánticos income/expense intactos** (regla dura 1): el verde/rojo solo aparece donde la spec del gráfico ya lo define (serie de ingresos / gastos de la Forma 1, montos del tooltip). El filtro, el `.stepper`, el "[+]", el menú de tipo y la confirmación de quitar **no** usan income/expense salvo: (a) el opcional mini-swatch doble del ítem "Ingresos y gastos" del menú de tipo, que es **previsualización del propio reporte** (admisible, comunica qué es la Forma 1), y (b) el botón "Quitar" en tratamiento **danger** (`--expense` como rojo de acción destructiva de UI, no como monto — uso ya establecido del DS para acciones destructivas). Los **colores de categoría** del checklist y de las bandas son **identificador de categoría**, nunca tiñen montos (regla de la matriz de colores intacta).
- Ningún control de esta fase recolorea ni altera una cifra de dinero: el filtro **cambia qué datos entran** al gráfico, pero la presentación de cada monto (color semántico, mono tabular) la sigue gobernando la spec del gráfico sin cambios.

---

## Movimientos calculados — spec visual (Fase 1.1.7, 2026-06-17)

> Spec del lenguaje visual de la Fase 1.1.7 (submódulo 3.4.b de `requirements.md`, RF-MCALC-001..007). Un **movimiento calculado** es un **fijo** cuyo monto **no se ingresa**: se deriva en vivo del monto de **otro fijo de origen** vía una **fórmula** (operador + operando) y un **switch de signo**, mes a mes. Toca **tres** lugares: (1) el **ítem de `/mes`** (`movement-item-row.tsx`) — indicación padre/hijo + montos negativos/cero; (2) el **KebabMenu del ítem fijo** — la acción "crear movimiento desde este"; (3) el **modal de carga** — un nuevo **form de calculado** (operador + operando + signo + origen read-only + resultado derivado). **No introduce tokens nuevos:** todo se resuelve con los tokens y patrones vigentes del DS "Precise Ledger".
>
> **Restricción dura:** el look actual del ítem de `/mes` y del modal de carga **se mantiene**; esta spec **agrega** (no reemplaza) los indicadores padre/hijo, la presentación de monto negativo, la tercera acción del kebab y el form de calculado. Todo lo no mencionado queda como está.
>
> **Coherencia con specs previas:** el ítem calculado es un **fijo** a todos los efectos visuales — hereda **íntegro** el tratamiento del fijo de la Fase 1.1.1 (ícono tintado por tipo, sublínea `Categoría · gasto/ingreso · 🔁 frecuencia`, estado anulado con opacidad 0.55 + tachado + badge "Anulado"). El form de calculado **reusa** el patrón de bloques del modal (`space-y-[14px]`, bloque `flex flex-col gap-[7px]` con `Label` arriba) y el patrón "toggle en crear / caja read-only en editar" de Tipo y Frecuencia (Fase 1.1.1).
>
> **Lo que NO es de esta spec (se deriva):** la mecánica de split del pasado, el recálculo en vivo, la persistencia, el contrato de datos (qué flags expone el backend para "tiene hijos" / "es hijo de", el nombre del origen, la fórmula). Esta spec define **cómo se ve** cada cosa, no cómo se computa ni qué shape tiene el dato. Si el front necesita el contrato, lo pide al analista vía orquestador.

### 1. Indicación visual padre/hijo en `/mes` (RF-MCALC-007)

Hay **dos** relaciones a señalar, **ortogonales** (un fijo puede ser padre, hijo, ambos no — un calculado nunca es padre, RF-MCALC-001) y que **conviven** con el estado anulado de la Fase 1.1.1. El criterio rector: **señales livianas en la sublínea**, sin agregar peso visual ni competir con el monto. Ni el padre ni el hijo cambian de ícono ni de color de monto; la relación se comunica con **chips/segmentos de sublínea** neutros y un **ícono de vínculo**.

**1.a — Ítem HIJO (es un calculado de un fijo de origen):**

El ítem hijo es un fijo normal en su columna de ícono, nombre y monto. Lo que lo distingue:

- **Chip "Calculado" en la sublínea**, como **primer segmento** de la sublínea (antes de "Categoría"), con el **mismo estilo de chip neutro** que el badge "Anulado" de la Fase 1.1.1: UI font 11px, peso 600, `letter-spacing: .04em`, fill `--panel-3`, texto `--muted`, radio `--r-chip` (7px), padding `1px 7px`. Texto: **"Calculado"**. Lleva, a su izquierda dentro del chip, un mini-glifo lucide **`Link2`** (11px, `--muted`, mismo color que el texto del chip) que comunica "deriva de otro". El chip es **neutro a propósito** (no semántico, no acento): "es calculado" es un rasgo estructural del movimiento, no un estado de error ni una cifra.
- **Referencia al origen en la sublínea:** inmediatamente después de la cadena habitual de la sublínea (`Categoría · gasto · 🔁 mensual`), se agrega un segmento más, separado por el mismo bullet `--faint`: **"desde {Nombre del origen}"**, texto `--muted` 12.5px (rol *Meta/subtítulos*), con **"desde"** en `--muted` normal y el **nombre del origen** en `--ink-2` (levemente más firme, para que se lea cuál es el padre) — sin mono (es un nombre, no una cifra). Si el nombre es largo, el segmento trunca con elipsis (`text-overflow: ellipsis`) sin romper la fila. *El nombre del origen es dato que provee el backend; si no estuviera disponible, el chip "Calculado" solo ya cumple RF-MCALC-007 — ver "Dudas para el orquestador".*
- **Orden final de la sublínea del hijo:** `[chip Calculado] Categoría · gasto · 🔁 mensual · desde Sueldo`. (Si además está anulado, el chip "Anulado" va **primero**, antes del chip "Calculado": `[Anulado] [Calculado] Categoría · …`.)
- **El monto del hijo** se presenta según la regla de monto negativo/cero de la sección 1.c (puede ser ≤ 0). Lo demás del ítem (ícono tintado por tipo, nombre, hover, kebab) **no cambia**.

**1.b — Ítem PADRE (un fijo que tiene al menos un calculado derivado):**

El padre es un fijo común; la señal de "tiene hijos" debe ser **aún más liviana** que la del hijo (es información secundaria: lo importante del padre es que es un fijo normal; el dato "alguien deriva de mí" es contextual).

- **Ícono indicador de "tiene derivados"** al final de la **sublínea** (último segmento, separado por el bullet `--faint`): glifo lucide **`GitBranch`** (13px, `--muted`) seguido —si hay más de uno— de un contador **mono tabular** chiquito: **`GitBranch 2`** cuando tiene 2 derivados, solo el glifo cuando tiene 1. El glifo `GitBranch` comunica "de esto se ramifica algo". El contador, cuando aparece, va en mono tabular (es un número) `--muted` 12px, pegado al glifo. *(Alternativa de glifo: `CornerDownRight`; **preferencia `GitBranch`** por leer mejor "tiene ramificaciones/derivados".)*
- **`title`/tooltip nativo del segmento** (accesible, no es un popover): "Tiene N movimiento(s) calculado(s)". No se abre panel ni se listan los hijos en el ítem padre (eso no lo pide el RF; los hijos se ven como sus propias filas en la lista).
- **No se cambia** el chip de tipo, el ícono ni el color del monto del padre. La única adición es ese segmento de sublínea con `GitBranch`.
- **Orden final de la sublínea del padre:** `Categoría · gasto · 🔁 mensual · ⎇ GitBranch 2`. (El indicador de derivados va **al final**, después de la frecuencia.)

**Por qué sublínea y no badge grande ni recoloreo:** la sublínea ya es el lugar donde el producto pone metadatos del movimiento (categoría, tipo, frecuencia, anulado). Sumar la relación padre/hijo ahí mantiene la jerarquía: el **monto y el nombre dominan**; la relación es metadato terciario en `--muted`. Recolorear el ítem o el monto rompería la regla dura 1 (color = ingreso/gasto) y agregaría ruido. Los chips/íconos neutros (`--muted` / `--panel-3`) comunican la estructura sin pelear con la semántica del monto.

**Convivencia con el estado anulado (Fase 1.1.1):** un calculado puede estar anulado el mes (si su origen está anulado, RF-MCALC-005). En ese caso aplican **ambos** tratamientos: opacidad 0.55 + tachado del monto + chip "Anulado" (de 1.1.1) **y** el chip "Calculado" + referencia al origen (de acá). Los chips conviven en la sublínea (Anulado primero, Calculado después). El chip "Calculado" hereda la opacidad de la fila como el "Anulado" (refuerza el apagado, aceptable).

### 1.c — Presentación del monto negativo o cero (RN-018) — solo calculados

Por RN-018 un calculado **puede tener monto negativo o cero** (excepción única a "monto > 0"; ningún otro movimiento llega acá). Hay que presentar un monto **negativo** y un monto **cero** sin romper la regla dura 1 (verde=ingreso, rojo=gasto) ni la lectura del balance.

> **Decisión clave:** el **color del monto sigue gobernado por el TIPO del movimiento** (gasto → rojo `--expense`/`--ink` según convención vigente; ingreso → verde `--income-ink`), **no por el signo del valor**. El signo se comunica con el **prefijo `−`** delante de la cifra, no recoloreando. Es decir: un calculado de tipo **gasto** con monto negativo **no** se vuelve verde — sigue siendo un gasto (rojo), solo que su valor es negativo. Esto preserva la regla dura 1 (el color comunica ingreso/gasto, que es un atributo del movimiento, no del signo del número) y evita la ambigüedad de "un gasto que parece ingreso".

- **Monto negativo:** la cifra se renderiza con **prefijo `−`** (signo menos real `U+2212`, no guion) **antes** del símbolo de moneda: **`−$1.234,56`**. Mono tabular (regla dura 3), mismo tamaño/peso que cualquier monto en fila (rol *Monto en fila*: 15.5px/600). El **color lo da el tipo** (no el signo): gasto → el rojo/ink de gasto vigente; ingreso → el verde de ingreso vigente. El `−` hereda el color del monto. **No** se recolorea por el signo; **no** se usa el rojo `--expense` para "negativo" (el rojo está reservado a "es un gasto", no a "es negativo").
- **Monto cero:** **`$0,00`** (sin signo). Mono tabular. El color lo da el tipo igual que cualquier otro. No hay tratamiento especial de "cero" (no se atenúa ni se marca distinto): es un monto válido que simplemente no suma. *(Si el origen está anulado y por eso el calculado no computa, eso lo señala el estado anulado de 1.1.1, no el valor cero.)*
- **Imputación a totales/subtotales (RN-019):** la presentación de los **totales del mes** y **subtotales de sección** **no cambia** su lenguaje visual — siguen siendo mono tabular con su color/signo habitual; lo que cambia es **qué suma** (un gasto negativo resta del total de gastos, etc., según RN-019), que es cómputo, no presentación. **Esta spec no redefine** cómo se ven los totales; solo confirma que un monto de fila negativo se muestra con `−$…` y color por tipo. *(Si RN-019 implicara un total de sección que pueda volverse negativo y haya que decidir su presentación visual, eso excede esta fila — ver "Dudas para el orquestador".)*
- **Por qué el `−` y no paréntesis ni recoloreo:** el `−$` es la convención más directa y legible en es-AR, consistente con cómo ya se muestran montos negativos en el balance (ingresos − gastos puede dar negativo y se muestra con signo). Paréntesis contables `($1.234)` serían un lenguaje nuevo ajeno al producto (Control es un diario, no un sistema contable). Recolorear por signo chocaría con la regla dura 1.

### 2. Acción "crear movimiento desde este" en el KebabMenu del ítem fijo (RF-MCALC-001)

Es la **tercera** acción del menú de acciones (kebab) de un ítem, **solo en fijos**, junto a Editar y Eliminar. **Únicos y cuotas NO la tienen.** Además, **no se ofrece sobre un ítem que ya es un calculado** (sin encadenamiento, RF-MCALC-001): un ítem hijo tiene el kebab de fijo **sin** esta acción (solo Editar / Anular-Desanular / Eliminar).

| Condición del ítem | ¿Aparece "Crear movimiento desde este"? |
|---|---|
| Fijo NO calculado (origen potencial) | **Sí** |
| Fijo que ES calculado (hijo) | **No** (no encadena) |
| Único | **No** |
| Cuota | **No** |

- **Label del ítem de menú:** **"Crear movimiento desde este"** (coherente con el RF). Si el ancho del menú aprieta, **preferencia: mantener el label completo**; no abreviar a "Crear desde este" salvo que no entre.
- **Ícono (lucide):** **`Calculator`** (15px, como el resto de los íconos del menú) — comunica "este nuevo movimiento se calcula a partir de otro". *(Alternativas evaluadas: `GitBranch` —se reserva para el indicador de "tiene derivados" en la sublínea del padre, sección 1.b, para no duplicar significado— y `Sigma`/`Plus`. **Preferencia `Calculator`**: es el más claro para "movimiento calculado" y no colisiona con `GitBranch`.)*
- **Tratamiento:** acción **neutra**, **no** `danger`. Crear no destruye nada. Hereda el estilo neutro del `KebabMenuItem` (`text-ink hover:bg-panel-2`), ícono 15px `--ink-2`. El único ítem `danger` (rojo) del menú sigue siendo "Eliminar".
- **Posición en el menú:** **última de las acciones no destructivas, antes de "Eliminar"**. Orden del kebab de un fijo: **Editar → Anular/Des-anular este mes → Crear movimiento desde este → Eliminar**. Va agrupada con las acciones constructivas/neutras y antes del separador conceptual con Eliminar. (Si el front usa un separador visual `--hair` antes de "Eliminar", esta acción queda del lado de arriba con Editar y Anular.)
- **Al accionarla:** abre el **modal de carga en el form de calculado** (sección 3) con el origen ya fijado al ítem desde el que se disparó. No navega; el modal se superpone como cualquier otra invocación del modal de carga.

### 3. Form del movimiento calculado en el modal de carga (RF-MCALC-001/002/003)

El calculado **no es un tab nuevo** del modal de carga (RF-MCALC-001: no hay tab "calculado" en creación normal). Su **único punto de creación** es la acción del kebab (sección 2). Por eso el form de calculado se abre en un **modo propio del modal** (como el modo edición: sin tabs de tipo de movimiento), titulado para el contexto. Reusa el **chrome del modal de carga** vigente (radio 18px, `--shadow-lg`, header con título 18px/700, footer con Guardar/Cancelar, patrón de bloques `space-y-[14px]`).

**3.0 — Encabezado y estructura del form:**

- **Título del diálogo** (rol *Título de diálogo*: 18px/700, `-.01em`, `--ink`): **"Nuevo movimiento calculado"** (crear) / **"Editar movimiento calculado"** (editar, RF-MCALC-006). Sin tabs de tipo de movimiento (igual que el modo edición).
- **Orden de bloques del form** (de arriba hacia abajo, mismo `space-y-[14px]`):
  1. **Origen** (read-only, 3.1)
  2. **Fórmula** = **Operador** + **Operando** (3.2)
  3. **Signo del resultado** (3.3)
  4. **Resultado derivado** (preview read-only, con la cifra **y el tipo derivado**, 3.4)
  5. **Categoría** (el selector del DS, con su "+ Nueva")
  6. **Descripción** (opcional)
  - **No hay bloque "Tipo" (Gasto/Ingreso)** — el tipo **no se elige**: se **deriva en vivo del signo del monto final** (RF-MCALC-003 reescrito / RN-018): monto negativo → **Gasto (`EXPENSE`)**, positivo → **Ingreso (`INCOME`)**, cero → **Gasto** (convención de borde). El tipo derivado se **comunica dentro del bloque "Resultado"** (3.4), no como campo editable.
  - **No hay bloque "Monto"** — el monto no se ingresa (RF-MCALC-001/RN-017); lo reemplaza el bloque "Resultado derivado" read-only (3.4). **No hay bloque "Mes de inicio" ni "Frecuencia"** propios: el calculado hereda la presencia/cadena del origen (RF-MCALC-004); no son campos del form. *(Si producto quisiera mostrar la frecuencia heredada del origen como dato read-only, sería una adición — no se asume; ver "Dudas".)*

**3.1 — Bloque "Origen" (read-only):**

El origen está **fijado** (viene del ítem desde el que se disparó) y **no es editable** en este form (RF-MCALC-006: el vínculo al origen no se cambia editando). Se muestra como **caja read-only**, mismo patrón que "Tipo"/"Frecuencia" en edición (Fase 1.1.1): `Label` "Origen" arriba (estilo label del form: `text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]`), debajo una caja `rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px]`.

- **Contenido de la caja:** ícono lucide **`Repeat`** (15px, `--accent-ink` — el mismo indicador de "es un fijo" que usa la frecuencia read-only de 1.1.1) + el **nombre del fijo de origen** (UI 14px/600 `--ink-2`) + a la derecha, en `--muted` 12.5px, su tipo y frecuencia (ej. **"gasto · mensual"**), para dar contexto de qué se está derivando. El **monto actual del origen en el mes contexto** puede mostrarse como cifra mono tabular `--muted` a la derecha (ej. `$120.000,00`) para que el usuario entienda sobre qué número opera la fórmula — *preferencia: mostrarlo*, ayuda a leer el resultado derivado del bloque 3.4; si el dato no está disponible, se omite sin romper el bloque.
- **Nota bajo la caja (solo crear):** una `.field-note` (el mismo estilo de nota del form, ícono lucide `Info` o `Repeat` 14px `--accent-ink` + texto `--muted` 12.5px): **"El monto se calcula a partir de este movimiento, mes a mes."** (copy de orientación; el redactado exacto es copy funcional — si el analista define otro, se respeta; lo visual es: `.field-note` con ícono acento + texto `--muted`).

**3.2 — Fórmula: selector de operador + campo de operando (RF-MCALC-002):**

La fórmula es **un operador + un operando**. Se presenta como **una sola fila** bajo un único `Label` **"Fórmula"**, leída como una operación: `[origen] [operador] [operando]`.

- **Label del bloque:** "Fórmula" (estilo label del form), `required`.
- **Layout de la fila:** `flex items-center gap-[8px]`. De izquierda a derecha:
  1. **Prefijo contextual read-only** (opcional, recomendado): un mini-rótulo `--muted` 12.5px **"Origen"** o el `Repeat` chico, para anclar que la operación es `origen ⊕ operando`. **Preferencia: un chip `--panel-3` "Origen"** (mismo estilo de chip neutro) que represente el operando izquierdo implícito de la fórmula. Si recarga visualmente, puede omitirse y dejar solo operador+operando con la explicación en la nota; **preferencia: incluir el chip "Origen"** para que la fórmula se lea sola.
  2. **Selector de operador** (ver abajo).
  3. **Campo de operando** numérico (ver abajo).
- **Selector de operador — segmented control de 5 opciones:** los cinco operadores `+ − × ÷ %` como un **segmented control** del DS (toggle de varios segmentos, mismo lenguaje que el toggle Gasto/Ingreso del DS pero con 5 celdas). Cada celda muestra el **glifo del operador** centrado, UI/mono 15px/600. Símbolos: **`+`** (suma), **`−`** (`U+2212`, resta), **`×`** (`U+00D7`, multiplicación), **`÷`** (`U+00F7`, división), **`%`** (porcentaje). Estados de celda: reposo `--ink-2` sobre `--panel`; **seleccionada** = fondo `--panel` elevado con `--shadow-sm` y texto `--ink` (el "thumb" del segmented del DS) — **sin** acento de color (el operador no es una cifra ni marca; el segmented del DS ya distingue el seleccionado por el thumb elevado, no por color). Hover de celda no seleccionada: `--panel-2`. Focus: ring `--accent-soft` 3px sobre el control. *Razón del segmented (no un select): son solo 5 símbolos, visualmente compactos, y el segmented los muestra todos de un vistazo, más rápido que abrir un dropdown. Coherente con que el toggle Gasto/Ingreso ya es segmented.*
  - **Default del operador (crear):** **`%`** preseleccionado *(preferencia: el caso de uso más típico de "derivar un movimiento de otro" es un porcentaje —ej. ahorro = 10% del sueldo—; si producto prefiere otro default, se ajusta — ver "Dudas").* En **editar** arranca en el operador guardado.
- **Campo de operando — input numérico:** input del DS (mismo estilo que el campo Monto: `rounded-ctl border border-line-strong bg-panel px-[13px] py-[11px] text-[14px]`), **alineado a la derecha** y en **mono tabular** (es un número → regla dura 3 aplica a montos; el operando es un número que opera sobre dinero, va en mono por coherencia). Placeholder `--faint` que insinúa el formato según operador (ver abajo). `inputmode="decimal"`. Acepta decimales con coma es-AR (ej. `1,5`).
  - **Sufijo/affordance contextual según operador:** cuando el operador es **`%`**, el campo muestra un **sufijo `%`** dentro del input (a la derecha, `--muted`), y el placeholder sugiere `10`. Cuando es **`×`/`÷`**, placeholder `2` o `1,5` (factor). Cuando es **`+`/`−`**, el campo es un **monto** y muestra el **prefijo `$`** (a la izquierda, `--muted`), placeholder `5.000` — porque sumar/restar opera en pesos, mientras multiplicar/dividir/porcentaje opera con un factor adimensional. El affordance ($ vs. %) ayuda a leer qué significa el operando según el operador elegido.
  - **Ancho:** el operando no necesita todo el ancho de la fila; **preferencia: el operador toma su ancho intrínseco (5 celdas) y el operando ocupa el resto de la fila** (`flex-1`), para que el número tenga lugar.

**3.3 — Switch de signo del resultado (RF-MCALC-003):**

Un control que fuerza el resultado final a **positivo** o **negativo** (×+1 / ×−1). Es un campo **propio** y editable.

- **Label del bloque:** "Signo del resultado" (estilo label del form), `required`.
- **Control:** **segmented de 2 opciones** (mismo lenguaje que el toggle Gasto/Ingreso), con dos celdas:
  - **"Positivo"** — glifo lucide `Plus` (14px) + texto "Positivo" (o solo **`+`** grande si se prefiere compacto; **preferencia: glifo + texto** para que sea inequívoco).
  - **"Negativo"** — glifo lucide `Minus` (14px) + texto "Negativo" (o **`−`**).
  - Celda seleccionada = thumb elevado del segmented (`--panel` + `--shadow-sm` + texto `--ink`), **sin** color semántico: aunque el signo ahora **determina el tipo derivado** (positivo → ingreso, negativo → gasto, RF-MCALC-003), el control de signo **no** se pinta verde/rojo. El **segmented de signo es neutro**; quien comunica el tipo resultante (con su color verde/gasto-rojo) es el **bloque "Resultado"** (3.4). Pintar la celda "Negativo" de rojo aquí duplicaría la señal del tipo y arriesgaría confundir "signo del número" con "es un gasto"; la regla dura 1 quiere el color **sobre la cifra**, no sobre el control. El segmented neutro evita esa lectura.
- **Default (crear):** **"Positivo"**. En editar, el signo guardado.
- **Nota aclaratoria (opcional, `.field-note` `--muted`):** "El signo define el tipo: positivo = ingreso, negativo = gasto. Un calculado puede dar un monto negativo." — orienta sobre la regla del tipo derivado (RF-MCALC-003) y la excepción de RN-018. Copy funcional; el redactado lo afina el analista si hace falta.

**3.4 — Resultado derivado (preview read-only) — el monto NO se ingresa y el tipo se deriva:**

El monto **no se ingresa**: se **deriva**. El **tipo tampoco se elige**: se deriva del **signo del monto final** (RF-MCALC-003 / RN-018). Para que el usuario vea **qué va a valer** el calculado y **qué tipo va a tener** antes de confirmar, el form muestra un bloque **read-only de resultado**, calculado en vivo a partir de origen (mes contexto) ⊕ operador ⊕ operando × signo.

- **Label del bloque:** "Resultado" (estilo label del form). **No** es `required` ni editable (es derivado).
- **Caja read-only:** `rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px]`, con:
  - A la izquierda, una **expresión legible** de la fórmula en `--muted` 12.5px mono tabular: ej. **`$120.000,00 × 10% × (−1)`** o, más simple, **`10% de $120.000,00, negativo`** — *preferencia: la forma legible "`{operando}{%/×/…} de/sobre {monto del origen}`" + ", negativo" si aplica*, para que se entienda el cálculo sin parsear símbolos. (El redactado de la expresión es semi-copy; lo visual es: línea `--muted` mono que muestra el cómputo.)
  - A la derecha, una **columna con dos piezas apiladas y alineadas a la derecha** (`flex flex-col items-end gap-[5px]`):
    1. El **resultado** como **cifra mono tabular** grande (rol *Monto en fila* o algo mayor: 16–18px/600), con su **color por tipo** (gasto/ingreso, igual que en la fila de `/mes`) y su **signo** (`−$…` si es negativo, `$0,00` si es cero) — exactamente la presentación de la sección 1.c. Es el preview de cómo se verá el monto del calculado.
    2. **Debajo de la cifra, el badge de tipo derivado** (ver bullet siguiente), alineado a la derecha bajo el monto. La cifra **domina** (es lo grande); el badge es la lectura secundaria que confirma "esto va a ser un gasto / un ingreso".

- **Badge de tipo derivado (NUEVO — reemplaza al ex bloque "Tipo"):** una **etiqueta de tipo** que se recalcula en vivo y comunica el tipo que tendrá el calculado según el signo del monto final. Reglas:
  - **Forma:** chip/pill, mismo lenguaje del **chip neutro de sublínea** (UI font 11px, peso 600, `letter-spacing: .04em`, radio `--r-chip` 7px, padding `1px 7px`), pero **tintado por tipo** (no neutro): es la única pieza del form que lleva el color semántico de gasto/ingreso, coherente con que el color del tipo va **sobre la lectura del tipo**, no sobre el control de signo.
  - **Color/token — Gasto:** texto `--expense-ink` sobre fill `--expense-soft` (el rojo de gasto del DS, en su variante de chip suave — el mismo registro con el que el producto ya marca "gasto" en chips/sublíneas). Texto del chip: **"Gasto"**.
  - **Color/token — Ingreso:** texto `--income-ink` sobre fill `--income-soft` (el verde de ingreso del DS). Texto del chip: **"Ingreso"**. *(Si el DS no expone un par `*-soft` para income/expense que el front ya use en chips, se usa el mismo par con el que hoy se tintan los chips de tipo en la sublínea del ítem `/mes` —Fase 1.1.1—; no se inventan tokens nuevos. Si hubiera duda sobre qué token de fill suave corresponde, FRENAR y preguntar antes de elegir uno.)*
  - **Glifo (opcional, preferencia incluir):** un mini-glifo lucide a la izquierda del texto del chip (11px, mismo color que el texto): `ArrowDownRight` para Gasto / `ArrowUpRight` para Ingreso —o el par de flechas de tipo que el DS ya use en `/mes`—, para reforzar la dirección. Si el DS no tiene un glifo de tipo establecido, el chip de solo texto basta.
  - **Caso borde `final == 0`:** el monto es `$0,00` y el tipo derivado por convención es **Gasto** (RN-018). El badge muestra **"Gasto"** igual (con su color de gasto). No hay tratamiento "neutro" para el cero: el badge sigue la convención de borde. *(Es solo visual; un monto 0 no aporta a totales, RN-019.)*
  - **Recálculo en vivo:** el badge cambia de "Gasto" a "Ingreso" (y de color) **en el mismo instante** que el signo o la fórmula hacen cruzar el resultado por cero — junto con el cambio de color de la cifra de arriba. Cifra y badge siempre concuerdan (mismo color, mismo tipo): nunca se ve una cifra con color de gasto y un badge "Ingreso".
  - **Estado de error (operando inválido, 3.5):** cuando el resultado no se puede computar (operando 0 con `÷`/`%`), **no se muestra badge de tipo** (no hay tipo si no hay monto); la caja muestra el estado de error de 3.5 en vez de cifra + badge.

- **Recalcula en vivo** a medida que el usuario cambia operador, operando o signo (sin botón) — tanto la **cifra** como el **badge de tipo**. Si el origen tiene distinto monto en distintos meses (su cadena), el preview muestra el del **mes contexto** (el mes desde el que se disparó), con una nota `--muted` "para {Mes Año}" si ayuda a aclarar que el valor varía mes a mes. *(El que varíe mes a mes es comportamiento de RF-MCALC-004; el preview solo muestra el del mes contexto.)*

**3.5 — Estados de validación del form:**

- **Operando vacío / no numérico:** el campo de operando es `required`; vacío bloquea Guardar con el tratamiento de error del DS (borde del input a `--expense`/`--line` de error, focus ring `--expense-soft` 3px, mensaje de error bajo el campo en `--expense-ink` 12px). Mensaje: "Ingresá un operando." (copy funcional).
- **Operando 0 con operador `÷` o `%` (RN-017 — división por cero):** **error específico.** Cuando el operador seleccionado es **`÷`** o **`%`** y el operando es **0** (o se vacía a 0), el campo de operando entra en **estado de error**: borde a color de error (`--expense` con `--line` de error), focus ring `--expense-soft` 3px, y **mensaje** bajo el campo en `--expense-ink` 12px: **"No se puede dividir por cero."** (para `÷`) / **"El porcentaje no puede ser 0."** (para `%`) — *o un mensaje único "El operando no puede ser 0 con este operador."*; copy funcional, lo afina el analista. Mientras dure el error: **Guardar deshabilitado** y el **bloque "Resultado" (3.4) muestra el estado de error** en vez de una cifra **y sin badge de tipo** (no hay monto → no hay tipo derivado) — texto `--expense-ink` 12.5px "Operando inválido" (no muestra `$NaN` ni `∞`). El uso de `--expense` acá es **color de error de UI** (validación), no monto ni "es un gasto" — admisible, es el rojo de error que el DS ya usa en inputs inválidos (no recolorea ninguna cifra de dinero).
  - Con operador `+`, `−` o `×`, el operando **0 es válido** (RN-017) y **no** dispara error (sumar/restar 0, o multiplicar por 0 → resultado 0, que es un monto cero válido por RN-018). El error de "0" es **exclusivo** de `÷` y `%`.
  - **Al cambiar el operador** de `÷`/`%` a otro con el operando en 0, el error **se limpia** en vivo (el 0 pasa a ser válido). Al revés, si el operando es 0 y el usuario cambia a `÷`/`%`, el error **aparece** en vivo.
- **Categoría sin elegir:** mismo tratamiento que el resto del modal (la categoría es `required`); sin novedad.
- **Error del backend al guardar (RNF-008):** el modal permanece abierto y conserva todo lo ingresado, igual que el resto del modal de carga. Sin novedad.

**3.6 — Modo editar (RF-MCALC-006):**

- **Origen read-only** (3.1): igual, pero el bloque deja explícito que **no se puede cambiar el origen** desde acá (la caja read-only ya lo comunica; sin control para editarlo). Para derivar de otro fijo se crea un calculado nuevo.
- **Editables:** Operador, Operando, Signo, Categoría, Descripción — todos con su control de creación (segmented / input / select), precargados con los valores guardados. **El "Tipo" NO es un campo** (ni en crear ni en editar): se deriva del signo del monto final (RF-MCALC-003) y se muestra como badge en el bloque Resultado (3.4). El **monto sigue sin ingresarse** (se deriva); el bloque Resultado (3.4) muestra el valor derivado actual y su tipo derivado.
- **Split del pasado:** la edición aplica desde el mes visualizado en adelante (RN-005), igual que cualquier fijo — eso es comportamiento; visualmente el form no agrega un control de "desde cuándo" (sigue el patrón de edición de fijos vigente, sin selector de pivote en el form).

### 4. Convivencia con las reglas duras (recordatorio)

- **Regla dura 1 (verde=ingreso / rojo=gasto):** el color del monto del calculado lo da **siempre el tipo** (gasto/ingreso), **nunca el signo** — y el tipo, en el calculado, ahora **se deriva del signo del monto final** (RF-MCALC-003): positivo = ingreso (verde), negativo = gasto (rojo), cero = gasto. El color semántico aparece **sobre la cifra del resultado** (3.4) y sobre el **badge de tipo derivado** (3.4) — las únicas dos piezas del form que lo llevan. Un monto negativo se marca con el **prefijo `−`**, no recoloreando por signo. Los segmented de operador y de signo son **neutros** (thumb elevado, sin color semántico): el verde/rojo no se pinta en el control de signo, solo en la lectura del tipo. El rojo `--expense` aparece además como **color de error de UI** (validación del operando 0, borde de input inválido) y como **danger** de "Eliminar".
- **Regla dura 2 (acento solo marca/UI):** el índigo aparece solo como cromo de interacción — focus rings (`--accent-soft`), el `Repeat`/`Info` `--accent-ink` de las notas y de la caja de origen, el check de los checkboxes/selects del DS. **Ningún monto, operando ni resultado se tiñe de acento.**
- **Regla dura 3 (dinero en mono tabular):** el operando, el monto del origen, el resultado derivado y cualquier cifra de los chips/sublíneas que sea numérica (contador de derivados) van en **mono tabular** (`tnum`). Los símbolos de operador (`+ − × ÷ %`) y el signo (`+`/`−` del switch) son glifos de control, no cifras de dinero; van en el tipo del control (admisible).

### 6. Aviso de borrado en cascada en el modal de eliminar fijo (UX nueva, 2026-06-18)

Cuando el usuario va a eliminar un **fijo que es padre** (tiene ≥1 calculado activo derivado de él), el modal de confirmación de borrado (`delete-recurring-dialog.tsx`) debe **advertir** que, al eliminar el fijo, **también se eliminarán los movimientos calculados que dependen de él**. Hoy el modal no lo avisa y el efecto colateral sorprende.

**Dato disponible (contrato):** el front sabe que el fijo es padre vía `MovementItem.hasCalculated: boolean` (true ⇔ tiene ≥1 calculado activo en el mes). **No** hay nombre ni cantidad de los hijos — solo el booleano. Por eso el aviso es **genérico**: no nombra al/los calculado(s) ni los cuenta.

**Condición de aparición:** el aviso aparece **solo si `hasCalculated === true`**. Si es `false`, el modal queda **exactamente igual que hoy** (sin aviso, sin cambios de layout ni de espaciado).

**Tono y token — advertencia (ámbar), NO error (rojo):** eliminar el fijo es **lo que el usuario pidió**; lo que hay que comunicar es un **efecto colateral** ("además se borra algo"), no un error ni una acción destructiva extra. Eso es semánticamente una **advertencia** → token `--warning` (ámbar, hue 75), no `--expense`. Esto es coherente con el uso vigente de `--warning` en el producto (toast tipo `warning`, error de carga del gráfico con `AlertTriangle` + `--warning-ink`). El rojo `--expense` sigue reservado para el botón **danger** "Eliminar" del footer (acción destructiva de UI) — no se usa en el aviso, para no duplicar el rojo ni leer el aviso como "otro error". **No introduce tokens nuevos.**

**Forma — callout de advertencia (banda):**

- **Tipo:** una caja-callout (no un toast, no un texto suelto): bloque con fondo suave de advertencia + ícono + texto, alineado al ancho del cuerpo del modal.
- **Contenedor:** `rounded-ctl` (`--r-ctl` 10px, mismo radio de la caja de detalle existente del modal), fondo **`--warning-soft`** (ámbar muy claro), borde 1px **`--warning`** (a `~0.35` de opacidad si el front lo prefiere más sutil; preferencia: borde `--warning` pleno fino, el `-soft` ya baja el peso). Padding interno `px-3 py-2.5` (12 / 10px), coherente con la densidad de la caja de detalle del modal (`px-4 py-3`), un punto más compacto por ser secundario.
- **Layout interno:** `flex items-start gap-2.5` — ícono a la izquierda, texto a la derecha (el texto puede ocupar 2 líneas; `items-start` alinea el ícono con la primera línea).
- **Ícono:** lucide **`AlertTriangle`** (16px, `strokeWidth` 2), color **`--warning-ink`** (ámbar oscuro, para contraste sobre `--warning-soft`). Es el glifo de advertencia ya establecido en el producto (toast warning, error de gráfico). `aria-hidden` (el texto ya comunica; el rol lo da el contenedor, ver accesibilidad).
- **Texto:** rol *Meta/subtítulos* del DS — **13px**, peso 500, color **`--warning-ink`** (no `--muted`: la advertencia debe leerse como tal, el ámbar oscuro le da presencia sin gritar). Sin mono (no es cifra). Line-height cómodo (`leading-snug`).

**Ubicación dentro del modal:** el callout va en el **cuerpo del modal**, como **último bloque del cuerpo**, **inmediatamente después** del párrafo de cierre existente ("El fijo dejará de aparecer desde este mes en adelante. Los meses anteriores no se modifican.") y **antes del footer** (los botones Cancelar / Eliminar). Es lo **último que el usuario lee antes de decidir**. Se inserta como un ítem más del `space-y-[14px]` del cuerpo (hereda esa separación vertical respecto del párrafo anterior). No se mete dentro de la caja de detalle del movimiento ni reemplaza ningún texto existente — **se agrega**.

**Wording exacto (es-AR, voz del producto):**

> **Este movimiento fijo tiene movimientos calculados que dependen de él. Si lo eliminás, esos calculados también se eliminarán.**

- Genérico a propósito (no nombra ni cuenta los hijos — solo hay el booleano). Funciona igual para 1 o N calculados.
- Coherente con la voz del producto (segunda persona "vos": "eliminás"), igual que el resto del modal ("¿Estás seguro de que querés eliminar…?").
- Es **copy** además de visual: si el analista afina el redactado, se respeta el texto; lo **visual** es: callout ámbar (`--warning-soft` / borde `--warning`), ícono `AlertTriangle` `--warning-ink` 16px a la izquierda, texto 13px/500 `--warning-ink`, como último bloque del cuerpo antes del footer, solo si `hasCalculated`.

**Accesibilidad:** el callout es contenido informativo dentro de un diálogo de confirmación ya rotulado (`role="dialog"`, `aria-modal`). El aviso forma parte del cuerpo que el usuario lee; **no** necesita `role="alert"` (no es un cambio dinámico que interrumpa: está presente desde que el modal abre). El ícono va `aria-hidden`; el texto se lee tal cual.

**Lo que NO cambia:** el resto del modal (título, párrafo de confirmación, caja de detalle del movimiento, párrafo de cierre, footer con Cancelar/Eliminar) queda **idéntico**. El botón "Eliminar" **sigue siendo `danger`** (rojo) — el callout ámbar **no** lo reemplaza ni lo recolorea: advertencia (ámbar, informa) y acción destructiva (rojo, el botón) son dos cosas distintas y conviven. No se agrega ningún checkbox de confirmación extra ni se cambia el comportamiento de borrado (sigue desde el mes visualizado en adelante).

**Por qué advertencia ámbar y no error rojo, ni tinte de todo el modal:** el rojo del DS comunica "gasto" (regla dura 1) o "acción destructiva" (el botón Eliminar). El efecto colateral del borrado no es ninguna de esas dos: es información que el usuario necesita **antes** de confirmar. El ámbar (`--warning`) es el registro correcto —"ojo, esto arrastra algo más"— sin escalar a error ni teñir todo el diálogo. Que sea una **banda contenida** (no texto suelto) la separa visualmente del párrafo neutro de cierre y la jerarquiza como la pieza de información más fuerte del cuerpo, justo antes de los botones.

### 5. Dudas para el orquestador (frená si alguna bloquea al front)

Ninguna bloquea la implementación visual del grueso del spec, pero conviene confirmar:

1. **Nombre del origen en la sublínea del hijo (1.a) y en la caja de origen (3.1):** ¿el backend expone el **nombre/descripción del fijo de origen** en el ítem y al abrir el form? Si **no**, el chip "Calculado" solo ya cumple RF-MCALC-007 y la caja de origen mostraría solo tipo/frecuencia. Diseñé asumiendo que el nombre está disponible (mejor UX); confirmar el contrato.
2. **Monto del origen en el mes contexto (3.1 y 3.4):** ¿el form recibe el **monto actual del origen** para mostrar la expresión y el resultado derivado en vivo? El preview del resultado (3.4) depende de ese dato. Si no estuviera, el preview no se puede mostrar y habría que decidir un fallback (ej. "se calcula al guardar"). Confirmar.
3. **Default del operador (3.2):** propuse **`%`** como default (caso de uso típico). Si producto prefiere otro (ej. `×`), se ajusta — es una preferencia de diseño, no una regla.
4. **Total de sección que pueda volverse negativo (1.c / RN-019):** si por RN-019 un **subtotal de sección o un total del mes** puede dar negativo y eso necesita una decisión visual propia (cómo se presenta un subtotal de Fijos negativo), excede esta fila y habría que speccearlo aparte. Esta spec resuelve el **monto de fila** negativo; los totales conservan su lenguaje actual salvo aviso.
5. **Frecuencia heredada como dato en el form (3.0):** no agregué un bloque "Frecuencia" read-only en el form del calculado (la hereda del origen y no es editable). Si producto lo quiere visible, es una adición menor — no la asumí.
