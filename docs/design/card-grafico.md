# /reportes — card de gráfico (cabecera, orden, título, moneda, refrescar)

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Gráficos que monta la card: `graficos.md`. Tipos de card con spec propio: `grafico-unicos-grilla.md`, `grafico-cuotas-gantt.md`, `grafico-inflacion.md`, `grafico-fixed-evolution.md`. Capa de simulados: `graficos-simulados.md`. Marcas de límite: `limites.md`, `limites-by-category.md`. Pertenece al grupo *Patrones de componentes vigentes*.

### Card de reporte — widget de gráfico autónomo

Unidad que `/reportes` apila y que el Dashboard monta una vez. Es la **tarjeta `.card` de gráfico** (panel, `--line`, `--r-card` 14px, `--shadow-sm`, padding `--card-pad` 22px) con **controles embebidos**. Estructura: cabecera (identidad a la izquierda; barra de controles a la derecha) → área de gráfico → leyenda. Altos de canvas: **300px** (cards de `/reportes`) / **280px** (Dashboard); **220px** en ≤940px.

- **Identidad (izquierda):** **únicamente el título editable por card** (16px/600 `--ink`), sin eyebrow ni rótulo "Reporte" encima. El título es **definido por el usuario**; cuando está vacío muestra el placeholder *"Reporte N"* (`--faint`). Ver *Título editable de la card de reporte* abajo. En la card `by-category` (que lleva los `ViewTabs` Barra/Línea) la identidad se ubica según esa misma sección.
- **Control de año embebido:** el `.stepper` de **PeriodNav** (forma compacta, `navegacion-periodo.md`), año en **mono tabular**, con su estado **disabled** en **cada extremo del rango de datos propio de la card** y **ambas flechas** apagadas cuando no hay rango (RF-REP-002, *Límites de navegación de año*). Navegación **activa** también en el Dashboard.
- **Selector de moneda de la card (solo `/reportes`):** override de display por card, persistido. Ver *Moneda por reporte — selector embebido en la cabecera de la card* abajo. **No aparece en la card del Dashboard.**
- **Filtro de categorías:** la leyenda es el filtro — ver `graficos.md` *Leyenda interactiva (la leyenda es el filtro)*.
- **Refrescar:** ver *Botón de refrescar por reporte — utilidad per-card* abajo.
- **Quitar card (solo `/reportes`):** botón icon-only ghost `X` (16px), `--muted` → `--ink` sobre `--panel-2`, al final de la barra de controles. Abre una **confirmación inline** (popover `--panel`/`--line`/`--r-ctl`/`--shadow-lg`, "¿Quitar este reporte?", botón **danger** "Quitar" + ghost "Cancelar"). La card del Dashboard **no** es removible.

**Grilla en `/reportes`:** una sola columna a 1120px, cards separadas por `--gap` (18px); el **"[+]"** (recuadro dashed, ver abajo) siempre al final. El orden de las cards es **reordenable por el usuario vía un modo orden explícito** — ver *Reportes reordenables — modo orden de cards* abajo.

**Recuadro "[+]" para agregar card:** recuadro **placeholder dashed** (`--panel-2`, borde dashed `--line`, `--r-card`, sin sombra), ícono `Plus` en círculo `--panel-3`, label "Agregar reporte". Compacto cuando hay cards (~120px); en versión grande preside el **estado vacío inicial** (~280px alto, ~480px ancho, centrado, "Armá tu primer reporte"). Al activarlo, **popover-menú de opciones** ancla la elección de tipo; la card nace en el año en curso con todas las categorías.

> **Nombres de tipo y íconos en el `AddCardMenu` (nomenclatura).** Cada opción del menú es `[ícono de tipo 16px --muted] · [nombre]`, y el ícono es **el mismo glifo** que el mini de reorden usa para ese tipo. Los nombres son **descriptivos**: **"Ingresos vs Gastos"** (`income-expense`, ícono `AreaChart`), **"Gastos por categoría"** (`by-category`, ícono `BarChart3`), **"Gastos Únicos"** (`unique-grid`, ícono `CalendarDays`), **"Gastos en Cuotas"** (`installment-gantt`, ícono `CalendarRange`), **"Inflación vs Ingresos"** (`inflation-vs-income`, ícono `TrendingUp`), **"Detalle histórico de fijos"** (`fixed-evolution`, ícono `Repeat`). Esta nomenclatura es la **fuente única** del nombre de tipo en todo el producto (menú `[+]` y etiqueta de tipo del mini de reorden).

**Dashboard:** monta una card `income-expense` efímera con navegación de año activa, junto al resumen mensual (que es fijo en el mes en curso). La distinción la dan: bloques de forma distinta (resumen sin `.card` de gráfico vs. card de gráfico), distinto grano temporal (mes-rótulo fijo vs. año-stepper navegable) y el stepper scoped a la card.

### Reportes reordenables — modo orden de cards

Las cards de `/reportes` se **reordenan** entre sí por drag, vía el **mismo lenguaje de "modo orden" que `/mes`** (ver `mes-secciones.md` *Acordeón — sección colapsable + reordenable* → "Modo orden"): un **modo explícito** (no handles permanentes), con **colapso transitorio** de las cards a una representación "mini" mientras dura, y **drag in-place sin overlay flotante**. **No inventa cromo nuevo:** reusa el botón ghost↔primario del header, el `GripVertical`, el feedback del ítem activo de `SortableSection` y el dashed transversal. Motor: **dnd-kit** con `restrictToVerticalAxis` + `restrictToParentElement` (igual que `/mes`).

> **Espejo deliberado de `/mes`.** Donde `/mes` colapsa cada sección a su `.ghead`, `/reportes` colapsa cada card a un **mini-ítem** identificable por **título + tipo**. Todo lo demás (disparador, grip, drag in-place, feedback del activo, salida en vivo) es **idéntico al modo orden de `/mes`**: si una decisión vale para uno, vale para el otro.

#### 1. Disparador — toggle "Ordenar reportes" / "Listo"

- **Ubicación:** en la **zona derecha del `.phead`** de `/reportes` (la izquierda lleva el eyebrow "Tu actividad" + chip de moneda default + H1 "Reportes"). El toggle es **el único habitante** de esa zona derecha. El header es `flex items-end justify-between`: identidad izquierda ⟷ toggle derecha.
- **Estilo — espejo exacto de `/mes`:**
  - **Fuera de modo orden:** botón **ghost del DS** — `inline-flex items-center gap-1.5 px-3 py-2`, `text-[13px] font-semibold text-ink-2`, `rounded-[var(--r-ctl)]`, `bg-panel border border-line`, hover `bg-panel-2`+`text-ink`, transición 0.14s, focus ring `--accent-soft` 3px. Ícono `ArrowUpDown` **15px** a la izquierda del label. Label exacto: **"Ordenar reportes"**. `aria-label="Ordenar reportes"`.
  - **En modo orden:** botón **primario índigo** "Listo" — `bg-accent` hover `bg-accent-press`, `text-white`, mismo `px-3 py-2` y `rounded-[var(--r-ctl)]`, sombra `--shadow-sm` + inset highlight, hover `--shadow-md`, focus ring `--accent-soft`. Ícono `Check` **15px** + label **"Listo"**. Es la **única señal** de "modo orden activo" — sin banner, sin borde de página.
- **Visibilidad del toggle:** solo cuando **hay cards** (`cards.length > 0`). En el **estado vacío** (solo el "[+]" grande) no se muestra. *(Abierto: con **una sola card**, si el toggle se oculta es decisión funcional del analista; visualmente es inocuo si se muestra.)*

#### 2. Representación "mini" de la card en modo orden

Al **entrar** en modo orden, **cada card colapsa a un mini-ítem**: la **fila de identidad arrastrable** — ni gráfico, ni leyenda, ni controles internos. **Puramente visual y transitorio**: no se persiste; al salir ("Listo") las cards vuelven a su forma plena. Transición del DS (0.22s ease-out; instantánea con `prefers-reduced-motion`).

- **Caja del mini-ítem:** mantiene la **superficie de card** (`bg-panel`, `border border-line`, `--r-card` 14px). Padding `px-[var(--card-pad)] py-[14px]`. **Alto objetivo ~56px**. Separación entre minis: `--gap` 18px.
- **Layout de la fila (de izquierda a derecha):** `[grip] · [ícono de tipo] · [título] · ——— · [etiqueta de tipo]`
  - **Grip** (`GripVertical`, ver §4) — primer elemento, punto de arrastre.
  - **Ícono de tipo** — el glifo de la nomenclatura del `AddCardMenu` (16px, `--muted`, `aria-hidden`). `gap-3` entre grip→ícono→título (mismo ritmo que la `.ghead` de `/mes`).
  - **Título** — el **título de la card** (16px/600 Space Grotesk `--ink` si es propio; "Reporte N" en `--faint` si no), `truncate`, display puro (no se edita en modo orden). `title=` nativo para el valor completo. "Reporte N" sigue el 1-based según el orden actual (mientras se arrastra, N puede cambiar).
  - **Etiqueta de texto del tipo** — a la **derecha**: el **mismo nombre** que el `AddCardMenu`, en **12px/600 `--muted`, sentence-case** (no uppercase). Precedida por una **línea divisoria** `flex-1 h-px bg-hair` que la empuja al extremo derecho (mismo patrón que el subtotal de la `.ghead`).
- **Jerarquía tipográfica del mini:** el **título manda**, la **etiqueta de tipo es metadato**, el **ícono es señal de apoyo**. Sin cifras de dinero.
- **Sin mini-preview del gráfico — decisión cerrada.** Cada mini-preview exigiría montar un gráfico (fetch por año/moneda/categorías, `ResponsiveContainer`) por card: (a) reintroduce carga/skeleton/error en una fila que debe ser estable e instantánea, y (b) le da a dnd-kit rects de altura variable/asincrónica, justo lo que el modo orden evita con el colapso instantáneo (`noTransition` para medir rects estables). **La identificación la dan ícono + etiqueta de tipo + título.** Si existiera un thumbnail estático y barato (sprite/snapshot precomputado), se reevalúa.
- **Feedback del ítem activo — reusa `SortableSection`:** elevación `--shadow-md`, fondo `--panel`, radio `--r-ctl` 10px, `cursor: grabbing`, **sin** `scale`, opacidad plena, padding interno `10px` mientras está activo. Las **demás minis** se desplazan suave (0.14–0.22s); **no se atenúan**. **Ese desplazamiento ES la indicación de inserción** — no hay caja-hueco dashed. Drag in-place: **sin `DragOverlay`**, traslación solo en Y dentro de la columna.

#### 3. Estado del resto de controles en modo orden

- **Controles internos de cada card** (stepper de año · moneda · refrescar · X · **título editable**): **no se renderizan** en modo orden (la card colapsa al mini). El título del mini es **display puro** (sin lápiz on-hover). Al salir, la card vuelve con todos sus controles.
- **Recuadro "[+]" (AddCardButton compacto):** se **atenúa y deshabilita** — `opacity-45 pointer-events-none cursor-default` (el tratamiento de "+ Nuevo movimiento" en `/mes`). Permanece visible al final de la columna (su ausencia repentina sacaría un ancla visual). **No** participa del sortable.
- **Sin chrome adicional de "modo activo":** la única señal es el botón "Listo" (§1).

#### 4. Grip handle

Idéntico al de `SortableSection` / `AccordionSection`:

- **Ícono:** `GripVertical` (lucide) **16px**, `aria-hidden`. Color `--muted` en reposo y en hover (el feedback de "agarrable" lo da el cursor).
- **Posición:** **primer elemento** de la fila. `gap-3` hasta el siguiente.
- **Cursor:** `cursor-grab active:cursor-grabbing`.
- **Área de toque:** el grip va en un `span` con `touch-none` que porta los `listeners`/`attributes` de dnd-kit; `aria-label="Arrastrar reporte"`. En `/mes` el handle vive **dentro** del `<button>` de disclosure; acá el mini-ítem **no es un disclosure**, así que el grip es control de arrastre directo en la fila.

#### Restricciones duras reafirmadas

- El modo orden **no muestra cifras de dinero**. El título es texto de UI (Space Grotesk), nunca mono.
- El **índigo** aparece **solo** en el botón "Listo" y en los focus rings — **nunca** tiñe títulos, íconos ni etiquetas del mini (regla dura 2).
- Íconos y etiqueta de tipo en **neutro `--muted`**.

### Título editable de la card de reporte

Cada card de `/reportes` tiene un **título definido por el usuario**, mostrado en la cabecera y **editable in-situ**. Es la **única** pieza de identidad de la card: **no hay eyebrow ni rótulo "Reporte"** encima. Aplica a **todos** los tipos de card. Reusa la escala de título de card 16px, el lenguaje de input del DS y el focus ring de acento.

> **Es texto libre del usuario, no marca ni semántica.** **Space Grotesk**, **nunca** mono, **nunca** teñido de income/expense ni de índigo. El índigo aparece **solo** como focus ring al editar.

#### 1. Default placeholder — "Reporte N" (sin título)

Con título **vacío**, la card muestra **"Reporte N"**, donde **N = posición 1-based de la card en la columna** (recalculado; **no monotónico** — si se quita una card intermedia, las de abajo recorren su N). Es **placeholder visual, no texto persistido**.

- **Tono:** `--faint`, mismo size/weight/tracking que un título real (16px/600, `leading-tight`) — solo cambia el **color**.
- **Al entrar a editar con título vacío:** el campo arranca **vacío**; el `placeholder` nativo muestra `Reporte N` en `--faint`. Si confirma vacío, vuelve al placeholder de display.

#### 2. Ubicación en la cabecera — el título es la única identidad

El título ocupa **la zona de identidad (izquierda)**; la barra de controles derecha no cambia. Por tipo de card:

- **`income-expense` — fila `justify-between`.** Identidad izquierda (el título, sin tabs) ⟷ controles derecha. El título trunca contra su ancho disponible (la identidad cede ancho a los controles). Sus filtros van en una segunda línea — ver `graficos.md` *Filtros de tipo, dirección y categoría en `income-expense`*.
- **`by-category` — el título en su propia línea encima de las tabs Barra/Línea.** Los `ViewTabs` son el control de **mayor jerarquía de interacción**; el título es **identidad**. Para no competir:
  - **Línea 1 (ancho completo):** **solo el título editable**.
  - **Línea 2:** `[ViewTabs Barra/Línea]  ⟷  [controles]` (`flex justify-between`), según `graficos.md` *Toggle Barra ↔ Línea … §1*.
  - **Por qué encima:** inline con las tabs competiría con el underline activo y empujaría las tabs al centro. **El título es el ancla común**: lo que se lee arriba a la izquierda es el título.
- **Resultado:** en **todos los tipos** se lee arriba a la izquierda el **título** (o "Reporte N"), sin rótulo encima. (`unique-grid` e `installment-gantt` usan el molde simple de una línea; `inflation-vs-income` y `fixed-evolution`, el de su archivo.)

#### 3. Affordance de edición — click directo + lápiz on-hover

Edición **in-situ** (no abre diálogo). Dos señales, sin ícono permanente:

- **El texto es clickeable.** El nodo del título es un `<button type="button">` con `cursor:text`; un clic entra en edición. `aria-label="Editar título del reporte"`.
- **Lápiz `Pencil` (lucide, 14px `--muted`) en hover**, a la derecha del título con `gap-[6px]`, `aria-hidden`. En reposo **oculto**; aparece (`opacity 0→1`, 0.14s) con hover **sobre la zona del título**.
- **Foco por teclado:** tabbable; con foco muestra el lápiz y focus ring `--accent-soft` 3px. Enter/Espacio entran a edición.
- **Por qué no lápiz permanente:** se repetiría N veces en la columna. El click directo es el gesto primario; el lápiz on-hover es el refuerzo. Principio del DS de "afordancia que aparece en hover".

#### 4. Estados

- **Idle (título propio):** 16px/600 Space Grotesk `--ink`, `leading-tight`, sin caja ni borde. Lápiz oculto.
- **Idle (placeholder):** igual molde, `--faint`. Lápiz oculto.
- **Hover:** aparece el lápiz; el texto **no** cambia de color ni toma caja. `cursor:text`. 0.14s.
- **Focus de teclado (sin editar):** lápiz visible + focus ring `--accent-soft` 3px (radio `--r-ctl` 10px).
- **Editando:** el texto se reemplaza por un **input inline** del DS, en su lugar exacto (sin saltos de layout):
  - **Caja:** `bg-panel`, borde `--line-strong`, radio `--r-ctl` 10px, `px-[8px] py-[3px]`. Ancho: la zona de identidad disponible.
  - **Texto:** **misma tipografía que el título** (16px/600 `--ink`), sin reflow.
  - **Placeholder:** `Reporte N` en `--faint`.
  - **Focus ring:** `--accent-soft` 3px, radio `--r-ctl` 10px.
  - **El lápiz se oculta mientras se edita.**
  - **Confirmar / cancelar:** **Enter** o **blur** confirman (vacío → vuelve al placeholder); **Esc** cancela y restaura. (Persistencia/validación de longitud: funcional.)
- **Sin estado de error visual propio.** Si se define un límite con feedback, reusará el ring `--expense-soft`.

#### 5. Tipografía, ancho y truncado

- **Tipografía:** **16px / 600**, Space Grotesk, `leading-tight`. **Nunca mono**, **nunca semántico ni índigo**. `--ink` / `--faint` cambian por modo.
- **Ancho (display):** ocupa el ancho de la zona de identidad y **trunca con elipsis**. **No envuelve**: el valor completo queda en `title=` + en el input al editar.
  - Moldes de una línea: trunca contra su columna de identidad.
  - `by-category`: trunca contra el ancho completo de la cabecera.
- **Ancho al editar:** el input crece hasta el ancho disponible y scrollea su texto internamente si excede. No empuja la barra de controles.

#### 6. Responsive (≤940px — la cabecera hace wrap)

- **Moldes de una línea:** el título queda a la izquierda y los controles envuelven a la segunda línea (`flex-wrap`); el título trunca contra su ancho, que se ensancha.
- **`by-category`:** orden vertical en angosto: `[título]` → `[ViewTabs Barra/Línea]` → `[controles]`.
- El **lápiz on-hover** se mantiene (en táctil la afordancia primaria es el tap directo).
- **`prefers-reduced-motion`:** aparición del lápiz y del input instantáneas.

#### Restricciones duras reafirmadas

- Texto de UI en Space Grotesk, nunca mono — no es dinero.
- **Nunca** se tiñe de income/expense ni de índigo; usa `--ink` / `--faint`. Índigo **solo** como focus ring.
- "Reporte N" es **display, no dato**: nunca se persiste.

### Moneda por reporte — selector embebido en la cabecera de la card

Cada card de `/reportes` tiene **su propia moneda de display**, override persistido e independiente de la default global del usuario (nace con la default global). El control vive **dentro de la barra de controles de la cabecera de la card**. Extiende `multi-moneda.md` *Monedas configurables — set curado ARS/USD/EUR/BRL* a un tercer lugar de uso (form, `/configuracion`, cabecera de card).

> **El chip de moneda del header de `/reportes` (`CurrencyChip`) refleja la default global** y es el ancla de contexto de la pantalla (Link a `/configuracion`). La moneda por card es un override **local**. Conviven: el chip dice "tu default es X", cada card dice "esta card se muestra en Y".

#### 1. Qué control — chip-dropdown in-situ (NO el segmented de 4)

**Chip-disparador que abre un popover con las 4 monedas**, **no** el `CurrencySegmented`:

- **El segmented de 4 no entra.** La barra derecha ya carga `YearStepper` (~150px) + divisores + utilidades; un segmented de 4 (`~180–200px`) **rompe el balance** y fuerza wrap permanente aun en desktop.
- **El chip-dropdown es compacto y del mismo sistema** (código `mono` + chevron, ~52px), con **todas las opciones a un clic**. Coherente con el `CurrencyChip`, pero **acciona in-situ** (no es Link).
- **No contradice al form:** "segmented, no dropdown" aplica donde **caben** los 4. Mismo set, distinto envase según el espacio.

#### 2. El disparador (`CardCurrencyTrigger`) — anatomía

`<button type="button">` con `aria-haspopup="listbox"` / `aria-expanded`. De izq → der:

- **Código** en `mono` **12px / 600** `tracking-[0.04em]`, `--ink-2`, `tnum`: `"ARS" / "USD" / "EUR" / "BRL"`.
- **Chevron:** `ChevronDown` **12px** `--faint`, `aria-hidden` ("abre opciones", a diferencia del `ChevronRight` del `CurrencyChip`, "se gestiona en otro lado"). Rota a ▲ (`-180°`, 0.14s) abierto.
- **Caja:** `inline-flex items-center gap-[6px]`, `bg-panel-3`, `--r-chip` 7px, `px-[8px] py-[3px]` — **idéntica al `CurrencyChip`**. **Sin** glifo `Wallet` (marca del default global).
- **Estados:** reposo caja `--panel-3`, código `--ink-2`, chevron `--faint` · hover caja `--panel-2`, código `--ink`, chevron `--muted` (0.14s) · abierto caja `--panel-2` + chevron ▲ · focus ring `--accent-soft` 3px, radio `--r-chip`.
- **Sin color semántico ni índigo.**

#### 3. El popover — lista de las 4 monedas

Anclado al disparador (reglas de `overlays-modales.md` *Cierre de overlays*: cierra por selección, Esc, click fuera y re-clic):

- **Caja:** `--panel`, borde `--line`, `--r-ctl` 10px, `--shadow-lg`, `p-[4px]`. Ancho mínimo ~96px; alineado al **borde derecho del disparador**. Animación `pop`; reduced-motion → instantánea.
- **Ítems:** 4 filas `role="option"`: código `mono` 13px / 600 `--ink-2` (`tnum`), `px-[10px] py-[6px]`, `--r-chip`. Orden `ARS → USD → EUR → BRL`.
  - **Seleccionado:** código `--ink` + `Check` **14px** `--ink-2` a la derecha (`aria-hidden`). **Sin** fondo de acento.
  - **No seleccionado:** `--ink-2`; hover fondo `--panel-2`, código `--ink`.
  - **Focus:** ring `--accent-soft` 3px.
- **A11y:** popover `role="listbox"` `aria-label="Moneda del reporte"`; ítems `aria-selected`. ↑/↓ recorren, Enter/Espacio eligen, Esc cierra y devuelve foco.
- **Al elegir:** cierra, persiste, y gráfico/leyenda/tooltip/cifras reflowean al nuevo símbolo. **Sin** skeleton (`skeletons.md`: skeleton solo con área vacía de dato).

#### 4. Ubicación exacta y responsive

- **Orden en la barra de controles derecha (≥941px):** `[ YearStepper ] |hair| [ CardCurrencyTrigger ] |hair| [ refrescar ] [ X ]` (divisor = `h-[16px] w-px bg-hair`). Año (el más usado) primero; moneda en el medio; utilidades al final, quitar terminal. Ver *Botón de refrescar por reporte* §2.
- **Responsive (≤940px):** el selector **viaja con el stepper y las utilidades** en el bloque derecho (`flex flex-wrap justify-end`). No se separa ni cambia de forma; mantiene orden y divisores. El popover **flipea hacia arriba** si no hay lugar abajo.

#### 5. Jerarquía visual

1. **`YearStepper`** — dominante: pill con borde `--line` + `--shadow-sm` + año mono 14.5px.
2. **`CardCurrencyTrigger`** — secundario: chip plano `--panel-3`, código 12px. "Ajuste de display".
3. **Utilidades (refrescar, `X`)** — icon-only ghost `--muted`, sin caja en reposo.

El selector **nunca** usa borde, sombra ni fondo de acento que lo eleve por encima del stepper.

#### 6. Card del Dashboard — sin selector (condición visual)

La card del Dashboard usa el **mismo `ReportCard`** pero **NO** renderiza el `CardCurrencyTrigger`. Condición: el override persistido (cards de `/reportes`), no `removable` per se — `control-frontend` recibe la moneda como prop opcional con su callback; sin callback (Dashboard) el trigger no se monta. Cabecera del Dashboard: `[ YearStepper ] |hair| [ refrescar ]`; cifras en la default global.

> **Reglas duras reafirmadas:** código en **mono tabular**; nada se tiñe de income/expense ni de índigo; índigo **solo** como focus ring. El selector solo cambia el **símbolo** (`multi-moneda.md` *Símbolos de moneda por código*), nunca recolorea cifras.

### Botón de refrescar por reporte — utilidad per-card

Cada card lleva **su propio botón de refrescar** en la barra de controles; refetchea **solo esa card** (`refetch` del hook de la card). Aplica a los **6 tipos de card** **+ el widget `income-expense` del Dashboard**. En **modo orden** no existe (la card es mini).

Icon-button ghost del mismo lenguaje que el `X` — mismo hit-area, estados y focus ring.

#### 1. Ícono

- **`RefreshCw`** (lucide), **16px**, `aria-hidden="true"`. El doble-arco lee "actualizar datos", no "deshacer/rotar" (por eso no `RotateCw`).
- 16px para **igualar al `X`** (los chevrones del `YearStepper` son 18px porque pertenecen a la pill de navegación).

#### 2. Ubicación y orden — regla única para los 4 layouts de cabecera

```
[ YearStepper ] |hair| [ CardCurrencySelect? ] |hair| [ refrescar ] [ X? ]
```

- **`refrescar` inmediatamente a la izquierda del `X`**, mismo bloque, **sin divisor entre ambos** (`gap-2`). `X` (destructivo) **terminal**.
- **El divisor `--hair` precede al clúster `[ refrescar ][ X? ]`** y **siempre se renderiza**.
- **Sin segundo divisor** entre `refrescar` y `X`: una card completa tiene **dos** hairlines.
- **Regla mecánica** (`CardControls` de `report-card.tsx` y las cabeceras inline de `unique-grid-card`, `cuotas-gantt-card`, `inflation-income-card`): renderizar **incondicionalmente** `|hair| [ refrescar ]` tras el bloque de moneda, y en el mismo bloque `[ X ]` solo si `removable`.

Resultado: **Dashboard** `[ YearStepper ] |hair| [ refrescar ]` · **`/reportes`** `[ YearStepper ] |hair| [ CardCurrencySelect ] |hair| [ refrescar ] [ X ]`.

#### 3. Botón icónico — anatomía y estados (reposo/hover/focus)

- **Hit-area:** `h-8 w-8` (32×32px), `rounded-ctl`, ícono centrado.
- **Reposo:** `text-muted`, sin caja.
- **Hover:** `hover:bg-panel-2 hover:text-ink`, `transition-colors duration-[140ms]`.
- **Focus:** `focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]`.
- **Sin color semántico ni índigo** en el ícono.

**No** depende de los límites de año: siempre habilitado, salvo durante su propio refetch (§4).

#### 4. Estado de carga — spinner, sin toast

Feedback **visual y local: solo spinner, sin toast** (la card maneja su error en el área de contenido).

- **Mientras refetchea:** el **mismo `RefreshCw` rota** (`animate-spin`).
- **Inerte durante el fetch:** `disabled` + cursor default + **`opacity-60`**; hover suprimido.
- **Se ata al fetch en segundo plano** (dato presente + refetch en vuelo). La **carga inicial** la cubre el skeleton de la card.
- **`prefers-reduced-motion`:** `motion-reduce:animate-none`; el estado lo señalan **`opacity-60` + `disabled`** (presentes siempre). El feedback **nunca depende solo de la animación**.

#### 5. Accesibilidad

- **`aria-label="Actualizar reporte"`** (estático).
- **`aria-busy`** `true` mientras refetchea.
- **`aria-disabled` / `disabled`** durante el fetch.
- `type="button"`, ícono `aria-hidden="true"`.

> **Reglas duras reafirmadas:** cromo neutro (`--muted`/`--ink`), sin income/expense, sin índigo salvo focus ring. No toca cifras.
