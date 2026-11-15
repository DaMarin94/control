# Superficies con scroll interno

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md` (§Los cuatro invariantes de contención). Pertenece al grupo *Patrones de componentes vigentes*.

### Superficies con scroll interno — contención de tablas y gráficos anchos

Instancia del **invariante 4** (*"las superficies anchas scrollean dentro de sí mismas, sin romper el layout de la página"*) para las tres superficies que no se pueden achicar sin volverse ilegibles: la grilla día×mes de Únicos, el gantt de Cuotas y la lista de límites de `/configuracion`. **Contener ≠ adaptar:** no se rediseña ninguna para pantalla chica; se garantiza que **el scroll vive dentro de la superficie** y **nunca lo hereda el `body`** (invariante 1).

#### Regla transversal — el scroll horizontal vive en la card, y los overlays escapan por portal

1. **El carril de scroll es la card, no la página.** La superficie ancha va envuelta en un contenedor con `overflow-x: auto` (`WebkitOverflowScrolling: touch`). El `body` no scrollea horizontal jamás; el desborde lo absorbe la card (`unique-grid-card` y `cuotas-gantt-card`: `<div class="… overflow-x-auto">`).
2. **Regla dura de overlays dentro de scroll (invariante 3).** Cualquier **popover, menú kebab, tooltip o confirmación** anclado a un elemento que vive dentro de una superficie con `overflow`, **se renderiza por `createPortal` a `document.body`** con posición `fixed` calculada desde el `getBoundingClientRect()` del ancla. Motivo: un overlay hijo de un contenedor con `overflow-x/y: auto` se **clippea** contra el borde del carril → una acción queda inalcanzable. **Es la regla, no una excepción de esos archivos.** Los `<Select>` nativos del DS no necesitan portal (el dropdown nativo no lo clippea el overflow).
3. **Affordance de "hay más" (obligatoria).** Cuando el contenido excede el ancho del carril, el borde por el que hay contenido oculto muestra una **sombra de corte** de 1px→transparente: `box-shadow` interior `inset -14px 0 12px -12px oklch(0.18 0.02 270 / 0.18)` sobre el borde derecho (hay más a la derecha) y su espejo `inset 14px 0 …` sobre el izquierdo (cuando ya se scrolleó). En modo oscuro la sombra usa `oklch(0 0 0 / 0.4)`. La sombra **aparece/desaparece según la posición de scroll** (sin sombra en el extremo alcanzado). No se usa fade con `mask` sobre celdas con cifras (taparía un monto). Es **la misma familia** de "señal de corte" que la hairline de los modales, adaptada al eje horizontal.

#### `unique-grid-card` — grilla día × mes (31 filas × 12 columnas)

- **Eje de scroll: horizontal.** 12 columnas × mínimo **64px** + columna de días **28px** ≈ **796px**, que no entra en compacto. Las 31 filas de día caben en alto; el scroll **vertical** de la grilla lo hace la **página** (no la card).
- **Sticky que importa: la columna de días (`sticky left-0`).** Al scrollear horizontal, la columna de números de día (1–31) queda **fija a la izquierda**. La celda esquina (día×header) también es `sticky left-0 top-0`.
- **Header de meses (`sticky top-0`):** su utilidad real es acotada (el scroll vertical es de página), pero es inocuo y coherente con el gantt; **la contención en compacto la resuelve el scroll horizontal + la columna de días sticky**.
- **Affordance:** sombra de corte derecha/izquierda por regla transversal §3. Debe **respetar la columna de días sticky** (la sombra izquierda aparece por fuera de esa columna).
- **Overlays:** tooltip de celda, tooltip de footer y `RemoveConfirmPopover` van portaled (§2).

**Comportamiento en pantalla chica (compacto, `< --bp-wide`).** La card conserva su ancho de columna; la grilla scrollea horizontal dentro de la card. Invariante 1: el `body` no scrollea horizontal. Invariante 3: los tooltips/popover portaled no se clippean. Invariante 4: el scroll vive en la card. No se reduce el mínimo de 64px por columna (por debajo, las cifras `mono` se vuelven ilegibles) — se prefiere scroll a ilegibilidad.

#### `cuotas-gantt-card` — gantt de barras horizontales (12 meses)

- **Eje de scroll: horizontal.** Ancho = 12 columnas × mínimo **64px** = **768px** (`minWidth: calc(12 * 64px)`). Desborda en compacto → scroll horizontal dentro de la card.
- **Sticky: header de meses (`sticky top-0`).** El gantt **no tiene columna de etiquetas de fila** (las barras se rotulan inline con monto·descripción), así que **no hay sticky-left** — el eje de identidad de cada barra viaja con la barra.
- **Affordance:** sombra de corte derecha/izquierda por §3. Complementa —no reemplaza— los chevrons `‹`/`›` de las barras, que significan "la cuota continúa en otro año", **no** "hay scroll" (dos señales distintas).
- **Overlays:** `BarTooltipPortal` y `RemoveConfirmPopover` van portaled (§2).

**Comportamiento en pantalla chica (compacto).** Idéntico a Únicos: card de ancho fijo, gantt scrollea horizontal adentro, `body` sin scroll horizontal (inv. 1), overlays portaled sin clip (inv. 3), scroll en la card (inv. 4). Mínimo 64px/mes: por debajo, el monto `mono` dentro de una barra de 1 mes no entra — se prefiere scroll.

#### Tabla de límites (`limits-tab` + `limit-row`) — lista, no tabla ancha

Esta superficie **no es una tabla ancha de columnas fijas**; es una **lista vertical de filas** (`flex flex-col`, card con `overflow-hidden` y radio 14px). Su contención **no** es scroll horizontal interno, sino **truncado + wrap**:

- **Fila (`limit-row`):** `flex items-center justify-between gap-6`. Zona **identidad** izquierda `flex-1 min-w-0` con el label `truncate`; zona **acciones** derecha `shrink-0` (toggle + borrar). La fila **nunca empuja scroll horizontal del body** (inv. 1): a lo sumo el label se trunca.
- **Sublínea de metadatos (chips):** `flex-wrap` — los chips de condición (`mono tabular`) y de alcance **envuelven** a la línea siguiente en vez de desbordar.
- **Confirmación inline de borrado (invariante 3):** al pedir borrar, la zona de acciones muestra `¿Eliminar? [Eliminar] [Cancelar]` (`shrink-0`, `whitespace-nowrap`). En compacto muy angosto la identidad `min-w-0` cede ancho; **ninguna acción queda inalcanzable ni tapada**. Es confirmación **inline**, no popover → no aplica §2. Si en el ancho mínimo la confirmación apretara demasiado, la salida es que la **identidad ceda**, nunca que los botones se salgan.

**Comportamiento en pantalla chica (compacto).** Las filas se contienen por truncado (identidad) y wrap (chips). No hay scroll interno porque la fila no tiene ancho mínimo rígido. Inv. 1: sin scroll horizontal del body. Inv. 3: toggle, borrar y la confirmación inline siempre alcanzables. Inv. 4: no aplica (no es superficie ancha).

#### Checklist de aceptación visual — superficies con scroll interno

- [ ] **`unique-grid` — sin scroll horizontal del body (inv. 1):** en compacto, la grilla scrollea horizontal **dentro de la card**; la página no gana barra horizontal.
- [ ] **`unique-grid` — columna de días sticky (inv. 4):** al scrollear la grilla a la derecha, la columna de números de día 1–31 queda fija a la izquierda.
- [ ] **`unique-grid` — affordance de corte:** con contenido oculto a la derecha aparece la sombra de borde derecho; al scrollear aparece la del borde izquierdo; en los extremos, sin sombra.
- [ ] **`unique-grid` — overlays no clippeados (inv. 3):** tooltip de celda, tooltip de footer y popover de "quitar reporte" se ven completos.
- [ ] **`cuotas-gantt` — sin scroll horizontal del body (inv. 1):** el gantt scrollea horizontal dentro de la card.
- [ ] **`cuotas-gantt` — header de meses sticky (inv. 4):** el header Ene…Dic permanece durante el scroll del carril.
- [ ] **`cuotas-gantt` — affordance de corte:** sombra de borde derecho/izquierdo según posición de scroll; los chevrons `‹`/`›` de barra se distinguen de la sombra.
- [ ] **`cuotas-gantt` — overlays no clippeados (inv. 3):** tooltip de barra y popover de "quitar reporte" completos.
- [ ] **`limits-tab` — sin scroll horizontal del body (inv. 1):** en compacto, la fila trunca el label y envuelve los chips.
- [ ] **`limits-tab` — acciones alcanzables (inv. 3):** toggle, botón borrar y la confirmación inline `¿Eliminar?/[Eliminar]/[Cancelar]` siempre visibles y clickeables.
