# `/mes` — listado: acordeón, filtros, orden, sublínea, anulado, duplicar

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Card de detalle de la fila: `card-detalle.md`. Frecuencia del fijo: `fijos-frecuencia.md`. Pertenece al grupo *Patrones de componentes vigentes*.

### Acordeón — sección colapsable + reordenable

Patrón **genérico reutilizable** de "sección de acordeón" = **cabecera (`.ghead`) + cuerpo (tarjeta-lista)**, que se colapsa/expande individualmente y se reordena entre pares por drag. Vigente en `/mes` (Únicos / Fijos / Cuotas), instanciable N veces en otras pantallas. **Construido SOBRE el look existente de la `.ghead`**, sin reemplazarlo.

**Cabecera colapsable (disclosure):**

- Toda la `.ghead` es el control que colapsa/expande su cuerpo (un único `button`, `aria-expanded` + `aria-controls`). Sigue siendo la misma fila "al aire" (sin caja).
- **Chevron:** `ChevronRight` (lucide) **16px** `stroke-width 2`, **primer elemento** de la fila, `--muted` en reposo. Un único glifo que **rota**: **expandida** → apunta ▼ (90°); **colapsada** → apunta ▶ (0°).
- **Estados:** *reposo* = `.ghead` + chevron `--muted`. *Hover* (sobrio, sin fondo en la fila): chevron → `--ink-2`, rótulo → `--ink`, transición 0.14s. *Focus*: ring `--accent-soft` 3px con radio `--r-chip` 7px.
- **Resumen visible al colapsar:** el pill contador y el subtotal mono **permanecen visibles** colapsados. Solo se oculta el cuerpo y el chevron rota a ▶.

**Animación:** altura del cuerpo 0↔auto (con `overflow: hidden`) + fade + rotación del chevron, **0.22s ease-out**. Respeta `prefers-reduced-motion` (instantáneo).

**Sección vacía:** las secciones se renderizan **siempre** (también vacías). Cabecera completa con contador `0` y subtotal en cero. Cuerpo (expandido): caja `rounded-card border border-dashed border-line bg-panel-2`, padding `px-6 py-6`, una línea centrada *Meta/subtítulos* (12.5–13px, `--muted`). El borde **dashed** = "acá todavía no hay nada".

**Modo orden (reordenar secciones, no ítems):** acción deliberada vía un **modo explícito**, no handles permanentes. Colapso transitorio al entrar + drag in-place sin overlay flotante.

- **Disparador:** botón ghost del DS en el `.phead`, ícono `ArrowUpDown` 15px, "Ordenar secciones". Al entrar se transforma en **"Listo"** (primario índigo); "+ Nuevo movimiento" se deshabilita mientras dura el modo. El botón **"Listo" es la única señal de "modo edición activo"** — sin chrome adicional (ni banner, ni borde de página).
- **Colapso transitorio al entrar:** al **entrar** en modo orden **todas las secciones se colapsan** — se reordenan solo las **cabeceras**. Es **puramente visual y transitorio**: **no** se persiste ni pisa la preferencia de colapso del usuario. Al **salir** ("Listo") se **restaura exactamente el estado de colapso previo**. Misma transición del acordeón (0.22s ease-out; instantánea con `prefers-reduced-motion`).
- **Handle:** `GripVertical` (lucide) 16px `--muted` a la izquierda del chevron, `cursor: grab`/`grabbing`. Motor: **dnd-kit**. Durante el modo, la cabecera **no** colapsa al clic (el chevron se ve en ▶ pero no es accionable).
- **Drag in-place — el ítem NO flota:** la cabecera arrastrada **no se despega del contenedor**; se **desliza únicamente en el eje vertical dentro del box de la lista** (transform Y). **No se usa `DragOverlay`**. Feedback **sobre la propia cabecera**:
  - **Ítem activo:** elevación `--shadow-md`, fondo `--panel`, radio `--r-ctl` 10px, **sin** `scale` (ancho 1:1 con la columna). Opacidad plena. `cursor: grabbing`.
  - **Las demás cabeceras:** opacidad plena, se **desplazan suave** (0.14–0.22s) para abrir el hueco. No se atenúan.
  - **Indicación del destino:** el desplazamiento de las demás cabeceras **es** la indicación de inserción; no se dibuja una caja-hueco dashed separada.
  - **Padding interno del recuadro activo:** el recuadro activo lleva **`10px` en los cuatro lados** (`var(--space-10)`), **solo mientras el ítem está activo** (junto con fondo/sombra/radio), **nunca en reposo** — el espaciado entre secciones (`space-y-[30px]`) no cambia. Se aplica en el **wrapper del ítem activo** (no en la cabecera). Como la fila ya trae `pb-[10px]`, el resultado abajo es mayor que arriba/lados; es **aceptable**, no se compensa.
- **Salida:** "Listo" vuelve a "Ordenar secciones", **restaura el colapso previo** y aplica el orden en vivo (sin "cancelar" en v1).

> El **dashed = espacio reservado / para agregar** es lenguaje transversal: sección vacía, hueco de drag del acordeón y recuadro "[+]" de `/reportes`.

### Filtros por listado en `/mes` — controles de sección

El filtro de `/mes` es **por listado**: cada `AccordionSection` (Únicos / Fijos / Cuotas) tiene **sus propios** controles de filtro, alojados **en su cabecera** (no hay un filtro por-pantalla en el `.phead`). El patrón *Filtro de categorías embebido* (`graficos.md`) **se reutiliza** acá, scoped a la sección.

Cada sección tiene **dos controles propios**:
1. **Triple switch de tipo:** **Gasto / Ingreso / Ambos** (default **Ambos**).
2. **Filtro por categoría:** el `CategoryFilterPopover` (default **todas**), reutilizado sin cambios de lógica.

**Decisión de alojamiento — un único disparador por sección que abre un popover con ambos controles.** La cabecera del acordeón ya está cargada (handle + chevron + rótulo + pill + divisor flex + subtotal). Meter dos controles inline la satura y compite con el subtotal. Además es **restricción dura de accesibilidad**: la cabecera entera es un `<button>` (disclosure), y no se anidan controles interactivos dentro de un button — disparador y popover van **fuera** del `<button>` de la cabecera.

**Ubicación en la fila.** El disparador es **icon-only**, **entre el divisor flex y el subtotal** (`[handle] [chevron] [rótulo] [pill] [divisor flex-1] [disparador filtro] [subtotal]`). Se renderiza **como hermano del `<button>` de la cabecera**: la fila es un contenedor `flex` que envuelve el `<button>` disclosure y, a su derecha, el disparador como sibling. El click en el disparador **no** dispara el colapso (`stopPropagation` por las dudas).

- **Disparador (botón):** ghost icon-only, `SlidersHorizontal` **15px**, **sin rótulo**. Padding `px-[7px] py-[5px]`, radio `--r-ctl`. Reposo: `--muted`. Hover: `--ink` sobre `--panel-2`. Abierto: `--panel-2` + `--ink`. Focus: ring `--accent-soft` 3px. `aria-label="Filtrar {rótulo}"`, `aria-expanded`, `aria-haspopup="dialog"`.
- **Estado "filtro activo" (≠ default).** Tipo ≠ Ambos **o** categoría ≠ todas. Señal: **punto indicador 6px `--accent`** (cromo de UI) como badge en la esquina superior derecha (offset `-top-[2px] -right-[2px]`, borde `2px --panel`). El ícono sube a `--ink` en reposo. **Sin** contador numérico.
- **Popover.** `--panel`, `--line`, `--r-ctl`, `--shadow-lg`, ancho **260px**, portaleado a body, anclado bajo el disparador, alineado a la derecha. Cierra por clic fuera / `Esc` / re-clic. **Dos bloques** separados por divisor `--hair`:
  1. **Bloque tipo (arriba):** label *Eyebrow/labels* `--muted` **"Mostrar"** y, debajo, el **triple switch**. Padding `px-3 py-[10px]`.
  2. **Bloque categorías (abajo):** el **`CategoryFilterPopover` embebido** (header "Mostrar categorías" + toggle Todas/Ninguna, filas checkbox + swatch 10px + nombre, scroll interno `max-height ~280px`), con su lógica de 3 estados (`null`=todas / `[]`=ninguna / lista).

**Triple switch de tipo (Gasto / Ingreso / Ambos).** Segmented del DS, **neutro en forma**, semánticos **solo en el texto del segmento seleccionado**:

- **Forma:** pista pill `--panel-3`, radio `--r-pill`, padding interno `2px`, tres segmentos de ancho igual. Cada segmento: **12.5px / 600**, `px-[10px] py-[5px]`, radio `--r-pill`.
- **Segmento seleccionado:** thumb `--panel` elevado con `--shadow-sm`, que se **desliza** (0.14s; instantánea con `prefers-reduced-motion`). Texto: **Gasto → `--expense-ink`**, **Ingreso → `--income-ink`**, **Ambos → `--accent-ink`** (marca, consistente con el badge de alcance "ambos"). No viola reglas duras 1/2: es el rótulo de un control, no un monto.
- **Segmento no seleccionado:** `--muted`; hover `--ink-2`.
- **Default:** **Ambos**.
- **a11y:** `role="radiogroup"` con tres `role="radio"` (`aria-checked`), `aria-label="Tipo de movimiento"`. Flechas; focus ring `--accent-soft` 3px.

**Subtotal y pill contador reflejan el filtro.** Muestran **lo visible/computado bajo el filtro de esa sección**. Sin indicación extra sobre el número (la señal vive en el disparador). El **color del subtotal no cambia** por el filtro de tipo (sigue `--muted`).

**Modo orden — los controles de filtro NO se muestran.** El disparador **no se renderiza** mientras dura el modo orden; vuelve al salir ("Listo").

**Responsive (≤940px).** Icon-only, no crece; el popover (260px, portaleado) no depende del ancho de la sección.

> Reutiliza el *Filtro de categorías embebido* y el punto indicador `--accent` del `FilterButton`. Aporta el **triple switch de tipo** y la decisión de **alojar los dos controles tras un único disparador fuera del `<button>` disclosure**.

### Control de orden de la sección Únicos (toggle monto ↔ fecha)

Control **ligero/disimulado** que vive **solo en la cabecera de la sección Únicos**, hermano del `SectionFilterButton`. Únicos es la **única** sección con columna fecha ("DD Mmm"); Fijos y Cuotas **no llevan este control**. El orden por defecto es **magnitud `|monto| DESC`** (el del backend); este control lo **alterna** con un orden **por fecha**.

**Es un toggle de dos órdenes, no un menú.** **(a) por monto** (`|monto| DESC`, default) y **(b) por fecha**. Sin tercer estado ni dirección configurable. Un clic alterna a↔b.

**Dirección por fecha — descendente (`fecha DESC`, más reciente primero).** Convención de feed/registro temporal. Desempate dentro del mismo día: `|monto| DESC`. El orden por monto conserva `DESC`.

**Ubicación en la fila.** **A la izquierda del `SectionFilterButton`**, ambos pegados al borde derecho junto al subtotal: `[handle] [chevron] [rótulo] [pill] [divisor flex-1] [control de orden] [filtro] [subtotal]`. `gap-1` (4px) entre los dos disparadores. **Fuera del `<button>` disclosure** (hermano), con `stopPropagation`. En Fijos/Cuotas no hay slot.

**Tratamiento visual — mismo molde icon-only que el `SectionFilterButton`.** Ghost icon-only, **sin rótulo**. Padding `px-[7px] py-[5px]`, radio `--r-ctl`, transición `colors` 0.14s.

- **Ícono — un único glifo que comunica el orden vigente:**
  - **Por monto (default):** `ArrowDownWideNarrow` (lucide, 15px, `stroke-width 2`, `aria-hidden`).
  - **Por fecha:** `ArrowDownNarrowWide` (lucide, 15px). (Alternativa aceptable: `CalendarArrowDown`. Canónico: el par `ArrowDownWideNarrow` ↔ `ArrowDownNarrowWide`.)

**Estado no-default (por fecha) — mismo lenguaje del punto indicador del filtro:** ícono `--ink` en reposo + **punto 6px `--accent`** en la esquina superior derecha (offset `-top-[2px] -right-[2px]`, borde `2px --panel`, `pointer-events-none`, `aria-hidden`). Por monto: sin punto, ícono `--muted`. Dos puntos `--accent` posibles en la cabecera de Únicos = "esta sección está modulada".

**Estados:**

- **Reposo (por monto):** ícono `--muted`, sin fondo, sin punto.
- **Reposo (por fecha):** ícono `--ink`, sin fondo, **con** punto `--accent`.
- **Hover:** ícono `--ink`, fondo `--panel-2`. 0.14s.
- **Active:** fondo `--panel-3`.
- **Focus:** ring `--accent-soft` 3px (`focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]`), sin outline.

**a11y.** `<button type="button">` con `aria-pressed` = `true` cuando el orden es por fecha. `aria-label` **dinámico con la acción del próximo clic**: por monto → `"Ordenar por fecha"`; por fecha → `"Ordenar por monto"`. Sin `aria-haspopup`/`aria-expanded`. Punto e íconos `aria-hidden`.

**Modo orden — se oculta**, igual que el filtro. Vuelve al salir.

**Persistencia / scope.** Estado de UI de la sección Únicos; que persista entre meses o sesiones es **decisión funcional**. El control refleja el orden vigente sea cual sea su origen.

**Responsive (≤940px).** Icon-only, sin cambio de forma.

### Sublínea del ítem de `/mes` — dos zonas (identidad · estados)

La **sublínea** (segunda línea del cuerpo del ítem, col 2, bajo el nombre) es el lugar canónico de los metadatos del movimiento. **Dos zonas** en una fila `flex items-center` que ocupa el ancho de la col 2:

- **Zona de identidad (izquierda)** — `flex-1 min-w-0`, trunca con elipsis. Registro 12px, texto `--muted`, separadores `·` en `--faint`. **Quién/qué** es el movimiento.
- **Zona de estados (derecha)** — `shrink-0`, cluster de glifos neutros `--muted` alineado a la derecha, **nunca** trunca. **Banderas** del movimiento. Separada de la identidad por `gap-[10px]` o un **hairline vertical** `--hair` de 12px de alto.

**El tipo (gasto/ingreso) NO se rotula en la sublínea.** Lo comunican el **ícono 40×40 tintado** de la col 1 (`↓` gasto en `--expense` / `↑` ingreso en `--income`) y el **signo + color del monto** de la col 4.

**El método de pago y el débito automático no viven en la fila**: están en la card de detalle (`card-detalle.md`).

#### Zona de identidad — orden exacto de segmentos

Identidad: `● Categoría · [frecuencia] · [↳ desde {Origen}]`. De izquierda a derecha, **omitiendo** los que no apliquen:

1. **Badge "Anulado"** (solo si `skipped`) — chip neutro; ver *Ítem anulado*. **Primer** segmento cuando está.
2. **Punto de color de categoría** — **6px** (`w-[6px] h-[6px] rounded-full shrink-0`), `background: movement.category.color` inline, `aria-hidden`. **Inmediatamente antes** del nombre de categoría, `gap-[6px]`. **Ancla de identidad**.
3. **Categoría** — en **`--ink-2`** (eje de identidad), 12px, no mono, `truncate`.
4. **Origen — frecuencia** (solo **fijos** y **calculados de origen fijo**) — `·` + glifo `Repeat` (12px, `--muted`, `aria-hidden`) + etiqueta de frecuencia **en minúscula** (ver `fijos-frecuencia.md`), `--muted`, no mono. **La cuota X/N vive en la col 3**, no en la sublínea. Los **únicos** no llevan segmento de origen (su fecha va en col 3). **El arranque del fijo no vive en la sublínea ni en la col 3:** está en la card de detalle.
5. **"↳ desde {Origen}"** (solo si es **calculado**) — **último** segmento. `·` + glifo `CornerDownRight` (12px, `--muted`, `aria-hidden`) + "desde " (`--muted`) + **nombre del origen** en `--ink-2`, no mono, `truncate`. **Fusiona** la marca de "es calculado" y la referencia a su origen: **no hay chip "Calculado"** separado. **Cola de mes base** (solo calculados de origen fijo con desfasaje **`> 0`**): cierra con `de {Mmm AAAA}` — preposición `--muted`, mes `--ink-2`, no mono, `shrink-0 whitespace-nowrap` (el nombre del origen trunca antes). Con desfasaje `0`, sin cola. Ver `form-movimiento.md` *Mes del monto base del calculado*.

El **monto** del calculado puede ser negativo/cero (ver `fundamentos.md` *Paleta y uso de tokens* → regla del signo).

#### Zona de estados — cluster de glifos (derecha)

Glifos neutros `--muted`, **solo glifo, sin texto**: cada uno con `aria-label` + `title` nativo en el wrapper (svg `aria-hidden`). Orden, `gap-[8px]`:

1. **Marca de límite** (efecto `glyph`/`fill`) — ver `limites.md` *Marca visual pasiva de límites*.
2. **Padre** (`hasCalculated === true`) — `GitBranch` (13px, `--muted`). `aria-label`/`title`: **"Tiene N calculado(s)"** (conteo solo en el label; **sin** contador visible).

Si **ninguna** bandera aplica, la zona de estados **no se renderiza** y la identidad usa el ancho completo.

#### Cumplimiento de reglas duras

- **Regla dura 1:** el punto de categoría usa la **paleta de categorías** (identificador), que incluye rojos y verdes, pero **no** comunica tipo: anclado al **nombre de categoría**, diminuto (6px), **nunca** toca la cifra ni el ícono de tipo. El tipo lo comunican **exclusivamente** el ícono tintado (col 1) y el signo/color del monto (col 4). Mismo criterio que los swatches `category.color` de gráficos.
- **Regla dura 2:** ningún elemento de la sublínea usa índigo.
- **Regla dura 3:** la sublínea **no contiene cifras de dinero**.

#### Relación padre/calculado — transversal a los tres orígenes

Segmento **"↳ desde {Origen}"** del hijo (identidad) y glifo **padre** `GitBranch` (estados), sin recolorear el ítem ni el monto:
- **El origen puede ser fijo, único o cuota — el patrón es transversal.** El calculado se **lista en la sección de su origen** (único → **Únicos**; cuota → **Cuotas**; fijo → **Fijos**):
  - **El hijo toma la forma de su sección de origen.** En **Únicos** lleva la columna fecha "DD Mmm"; en **Cuotas** la col 3 va **vacía** (no muestra "Cuota X/N": es un movimiento propio); en **Fijos** la col 3 va **vacía**, como cualquier fijo (un calculado de origen fijo tiene **cadena propia** y exhibe **su** vigencia en la card de detalle).
  - **La sublínea sigue la regla de su origen:** el segmento de **frecuencia (`Repeat`)** aparece **solo** si el calculado es de **origen fijo**; en calculados de único/cuota la identidad es `● Categoría · ↳ desde {Origen}`.
  - **Orden dentro de la sección:** por **magnitud `|monto| DESC`** mezclado con el resto; **no** se ancla junto a su origen.
  - **Ícono de la caja de origen (form de calculado).** La caja de origen *read-only* lleva un glifo del **tipo del movimiento de origen**, en `--accent-ink` (cromo de UI): **fijo → `Repeat`**, **único → `Receipt`**, **cuota → `CreditCard`**. 15px, `shrink-0`, `aria-hidden`. Estos tres glifos viven solo en esta caja.
- **Aviso de borrado en cascada (modal de eliminar):** si el movimiento a eliminar es **padre**, el modal suma un **callout de advertencia** como **último bloque del cuerpo, antes del footer**: al borrarlo también se borran sus calculados. **Ámbar `--warning`, no error**: banda `--r-ctl`, fondo `--warning-soft`, borde `--warning`, `AlertTriangle` (16px, `--warning-ink`) + texto 13px/500 `--warning-ink`. El botón "Eliminar" **es `danger`** (rojo). Solo si `hasCalculated`.

### Ítem anulado (`skipped`) y acciones del KebabMenu

**Ítem anulado** (`skipped: true`): **se sigue mostrando** en su sección y posición, pero no suma a los totales. Aplica a los **tres orígenes** — fijo, único y cuota — con la **misma señalética**; solo cambia el **rótulo** de la acción. Tres señales juntas:

- **Atenuación de la fila:** todo el contenido (ícono, nombre, sublínea, monto, col fecha) a **`opacity: 0.55`**. **No** se atenúa el fondo/hover ni el KebabMenu (opacidad plena para "Des-anular").
- **Monto tachado:** `line-through`. **Conserva su color por tipo y su signo**.
- **Badge "Anulado":** chip neutro como **primer** segmento de la zona de identidad (`[Anulado] ● Categoría · … · ↳ desde {Origen}`). Molde: `--panel-3` / `--muted` / `--r-chip` 7px / 11px·600·`.04em`. **Mismo texto para los tres orígenes**. Neutro a propósito (no `--warning`): es estado de cómputo, no error.

**Hover del anulado:** la fila sigue interactiva (`hover:bg-panel-2` + KebabMenu visible); el contenido atenuado **no** vuelve a opacidad plena.

**Acciones del KebabMenu del ítem (orden):** Editar → Anular/Des-anular → [**Reabrir**, solo fijo normal con fin — ver `reabrir-fijo.md` §1] → **Duplicar** → Crear movimiento calculado → Eliminar (única `danger`). Las intermedias son **neutras** (`text-ink hover:bg-panel-2`, ícono 15px). La anulación aparece en **fijo, único y cuota** (justo después de Editar); las **dos acciones que engendran otro movimiento** (Duplicar y calculado) **solo en orígenes no-calculados**:

- **Anular / Des-anular** — toggle según `skipped`. Íconos para los tres orígenes: activo → `CalendarOff`; anulado → `CalendarPlus`. Reversible, nunca `danger`. Rótulo:
  - **Fijo** y **cuota**: **"Anular este mes"** / **"Des-anular este mes"**. (La anulación de un fijo abre el modal de alcance — ver `anulacion-fijo.md`.)
  - **Único**: **"Anular"** / **"Des-anular"**.
  - Los íconos se **reusan tal cual** en el único; el matiz de alcance lo carga el rótulo.
- **Crear movimiento calculado** — abre el form de calculado con el origen fijado. Ícono `Calculator`. **No** aparece sobre un calculado (sin encadenamiento). *(Racional del rótulo en* Duplicar movimiento *§2.)*
- **Duplicar** — abre el modal en modo creación con los datos precargados. Ícono `Copy`. Mismo gate (**solo** no-calculados).

### Duplicar movimiento — acción del kebab y modo "duplicar" del modal

**Qué es.** Crear un movimiento **nuevo e independiente** precargado con los valores de uno existente (POST, no vínculo). Vive **únicamente** en el kebab "⋮" de la fila de `/mes` — la *Card de detalle* sigue siendo **read-only pura**. Aplica a **único, fijo y cuota no calculados**.

**Por qué solo en el kebab.** El kebab es el domicilio único de las acciones sobre un ítem; ponerla en la card rompería la regla de que la card no acciona.

#### 1. El ítem "Duplicar" en el KebabMenu

- **Rótulo: "Duplicar"**, una palabra en imperativo. Sin objeto y **sin** "desde este" (colisiona con la acción de calculado).
- **Ícono: `Copy` (lucide), 15px.** Descartados `CopyPlus` (el `+` ensucia a 15px) y `Files` (lee como adjuntos).
- **Tono: neutro** (`text-ink hover:bg-panel-2`), **nunca `danger`**. **Sin diálogo de confirmación** (la confirmación real es el propio modal, cancelable).
- **Sin estado de carga propio.** Solo **abre el modal**; POST, "Guardando…", toast y error son los del **form de creación**.
- **Posición: tercera** — `Editar → Anular/Des-anular → Duplicar → Crear movimiento calculado → Eliminar` (cuarta en un fijo con fin, donde "Reabrir" entra entre Anular y Duplicar).
  - **Racional:** tres grupos implícitos — *actuar sobre este ítem* (Editar, Anular) → *engendrar otro movimiento* (Duplicar, calculado) → *destruir* (Eliminar). Duplicar va pegado a la acción con la que se confunde: la adyacencia hace que el contraste de rótulo e ícono desambigüe.
  - **Duplicar antes que calculado:** más general y frecuente.
  - **Convivencia con el calculado:** comparten el gate `!isCalculated`; el grupo aparece o desaparece **completo**. En un calculado: `Editar → [Anular este mes, solo calculados de fijo] → Eliminar`.
- **Ítems en una sola línea** (`whitespace-nowrap`): el panel crece desde `min-width: 160px`.
- **Alto del panel y flip:** la altura con que el menú decide abrir arriba o abajo se **deriva del número real de ítems**. Con 5 ítems ≈173px (5 × ~33 + 8). En las filas del **pie del listado** abre **hacia arriba**. Contrato: **el menú entra entero en el viewport con cualquier cantidad de ítems** (invariante 3).

#### 2. Rótulo de la acción de calculado

**"Crear movimiento calculado".** Racional:

- **Consistencia de vocabulario:** mismo término que el modal destino ("Nuevo movimiento calculado"), la sublínea del hijo y la doc.
- **Desambiguación contra "Duplicar":** contraste en **forma** (frase vs. palabra), **verbo** e **ícono** (`Calculator` vs `Copy`); evita nombrar la procedencia ("desde este").
- **Nombra qué obtenés:** un movimiento **calculado** y **vinculado**.

Ícono `Calculator`, posición 4.ª, tono neutro, gate `!isCalculated`.

#### 3. Modo "duplicar" del modal

Modal de movimiento (`ModalShell variant="form"`), **modo creación** (POST), con el form del **tipo del original** y los **tabs Único/Fijo/Cuotas ocultos** (decisión funcional cerrada).

- **Título — espeja la gramática de edición:**
  - original **único** → **"Duplicar movimiento"**
  - original **fijo** → **"Duplicar · Fijo"**
  - original **cuota** → **"Duplicar · Cuotas"**
  - **Por qué "Duplicar":** feedback (repite el verbo elegido), explica por qué los campos vienen llenos y faltan los tabs; "Nuevo movimiento" sin tabs leería como creación rota.
  - **Por qué el sufijo:** con los tabs ocultos el tipo no está en ningún lado; mismo patrón que "Editar · Fijo" / "Editar · Cuotas".
- **NO lleva señal adicional de origen** (ni banner, ni "precargado desde {Nombre}", ni chip): (a) la causa es inmediata; (b) "desde {Origen}" (con `↳`) es lenguaje **reservado a los calculados** y afirmaría un vínculo que no existe; (c) ruido en el camino crítico.
  - **Prohibido en este modo:** `CornerDownRight`, `GitBranch`, la palabra "desde" referida al original y cualquier chip de procedencia.
- **Botón primario: "Guardar"** ("Guardando…" en carga), sin cambios.
- **Disclosure "Más opciones": arranca colapsado, sin excepción.** Los valores copiados ya se ven en el resumen colapsado (moneda + cotización si ≠ default; glifo + nombre del método).
  - **Nota del campo Cotización:** con `moneda ≠ default`, el valor viene **del original** → la nota lee **"Cotización modificada"** (`--ink-2`, sin `History`), no "Cotización de referencia del mes". Mismo tratamiento que en edición.
- **Estados:** los del form de creación. Sin fetch propio: precarga desde el `MovementItem`.
- **Cierre:** ✕ y `Esc`; el clic en el scrim **no** cierra.

#### 4. Contención responsive (obligatoria)

- **Invariante 1:** el panel del kebab es un portal `fixed` anclado por su borde derecho al trigger; holgado a 640px (y ~392px de contenido con sidebar abierto); si no alcanza, se corre hacia adentro.
- **Invariante 2:** `ModalShell variant="form"` — `max-height: calc(100dvh − 48px)`, cuerpo scrolleable, footer pineado. Si el título truncara, trunca el **título**, nunca la ✕.
- **Invariante 3:** con 5 ítems, el menú en la **última fila** sigue entero (flip, §1). Verificar en viewport bajo (≈700px de alto).
- **Invariante 4:** no aplica.

#### 5. Reglas duras

- **Verde/rojo = tipo:** "Duplicar" es **neutro**; el único ítem rojo es Eliminar (`danger`).
- **Índigo = solo foco.**
- **Mono tabular:** los montos precargados conservan su input mono con prefijo `$`.

#### 6. Checklist de aceptación visual — Duplicar movimiento

*Ítem del kebab:*
- [ ] En un **único, fijo y cuota** (no calculados) el menú "⋮" muestra **5 ítems** en este orden: **Editar · Anular/Des-anular · Duplicar · Crear movimiento calculado · Eliminar**.
- [ ] "Duplicar" lleva ícono **`Copy` 15px**, texto **neutro** (`--ink`), hover `--panel-2`; **no** es rojo ni tiene confirmación.
- [ ] En un **movimiento calculado** **no** aparecen ni "Duplicar" ni la acción de calculado: el menú queda Editar · [Anular este mes, si es calculado de fijo] · Eliminar.
- [ ] Ningún rótulo del menú envuelve a dos renglones.
- [ ] Con el menú abierto en la **última fila** del listado y ventana baja, el panel **se ve entero** (abre hacia arriba si hace falta) y todos los ítems son clickeables.

*Modal:*
- [ ] Al elegir "Duplicar" abre el modal con título **"Duplicar movimiento"** (único) / **"Duplicar · Fijo"** / **"Duplicar · Cuotas"** según el original.
- [ ] Los **tabs Único/Fijo/Cuotas NO se muestran**.
- [ ] Los campos vienen **precargados** con los valores del original (monto, categoría, descripción **idéntica sin sufijo**, fecha/hora del único o mes de inicio del fijo/cuota).
- [ ] **No** hay banner, nota ni chip de "precargado desde {Nombre}"; **no** aparece el glifo `↳`/`CornerDownRight` ni `GitBranch` en el modal.
- [ ] El botón primario dice **"Guardar"** (y "Guardando…" mientras persiste); Cancelar es ghost. El modal cierra con ✕ y `Esc`; el clic en el scrim **no** cierra.
- [ ] **"Más opciones" arranca colapsado**, y su resumen a la derecha muestra la moneda (y la cotización si ≠ default) y el método de pago **copiados del original**.
- [ ] Con moneda ≠ default, la nota bajo Cotización lee **"Cotización modificada"** (sin el glifo `History`).
- [ ] Al guardar, aparece un **movimiento nuevo e independiente** en la lista y el original queda **intacto** (sin marca de padre `GitBranch`, sin "↳ desde").

*Contención y reglas duras:*
- [ ] A **640px** (y ~392px de contenido con sidebar abierto): sin scroll horizontal del `body`, modal entero y scrolleable con footer pineado, panel del kebab dentro del viewport.
- [ ] Ninguna pieza nueva usa verde/rojo fuera de "Eliminar", ni índigo fuera del focus ring; los montos precargados siguen en mono tabular.
