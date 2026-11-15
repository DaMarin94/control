# Límites y alertas — marca pasiva, panel de gestión (hub `/configuracion`), aviso activo, popover informativo

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Marcas en `by-category`: `limites-by-category.md`. Convivencia con simulados en cards: `simulados-en-cards.md` §3.

## Marca visual pasiva de límites

> Catálogo de **efectos visuales de la marca pasiva** (decisión D9 del roadmap de límites y alertas). Un **límite** es una config del usuario que observa un dato (vía su *key* del catálogo), lo compara contra un umbral y, si se cumple, **aplica una marca al anclaje** que emite esa key. Esta sección define **qué marcas existen** (vocabulario), **qué marca aplica a qué tipo de anclaje** (mapeo), **el tono/severidad** y **la accesibilidad**. **No define** el shape del límite, el panel de config ni la evaluación (funcional/técnico).
>
> El identificador de efecto que guarda el límite (`effect`) sale del **id estable** de cada primitiva de abajo — es parte del "lenguaje común" front ↔ design.

### Restricción rectora — cero impacto con config vacía

**Con `limits: []` (o con todos los límites evaluando `false`), la app se ve EXACTAMENTE igual que sin el subsistema.** El sistema de marcas es **aditivo y opt-in**. **Regla dura del subsistema**:

1. **Toda marca es condicional.** Un nodo de marca se renderiza **solo** cuando un límite configurado evalúa `true` sobre ese dato concreto renderizado. Sin límites que crucen → ningún nodo de marca ni clase modificadora.
2. **Las marcas reusan slots que ya colapsan.** Donde una marca **agrega** un elemento (glifo, badge), va en un slot que **ya renderiza vacío** cuando no aplica — caso canónico: la **zona de estados de la sublínea** del ítem de `/mes` (`mes-listado.md` *Sublínea del ítem de `/mes`*). Ningún slot **reserva** ancho/alto "por si acaso".
3. **Las marcas que modifican** (fondo, ring, color, peso) aplican **solo un swap condicional de clase/token**; el estilo base queda intacto cuando ningún límite cruza.
4. **Sin cambio global de layout/DOM.** Ningún contenedor persistente, columna reservada ni wrapper siempre-presente.
5. **La marca nunca desplaza a sus vecinos.** Fondos y rings **no reflowean** (ring vía `box-shadow` como el focus ring; fill de fondo; inset). Badges y glifos caen en clusters flex que ya crecen/encogen. **La altura de una fila y el layout de una grilla no cambian** por marcar.

### Tono y severidad — una sola familia: **ámbar `--warning`**

- **Cruzar un límite es un aviso (`--warning`, ámbar), no un error ni income/expense.** Ámbar es el token del DS para "advertencia, no error". Es el **único hue libre** con semántica de atención: no colisiona con rojo=gasto, verde=ingreso, índigo=marca, paleta de categorías=identidad. La marca es **siempre ámbar** (o **neutra por peso**), **nunca** `--expense`/`--income`/`--accent`/color de categoría.
- **Condición única, sin escalonado (D1).** Un límite = una condición = **una marca binaria**. Sin gradiente ámbar→rojo. Señalización por tramos = **varios límites sobre la misma key** con distinto umbral y efecto: el DS **compone** marcas simples.
- **El usuario elige el EFECTO, no el hue.** Restricción deliberada: preserva los colores reservados **por construcción**.
- **Dos registros, ambos curados:**
  - **Aviso (ámbar)** — `--warning` / `--warning-soft` / `--warning-ink`. Default.
  - **Neutro (peso, sin hue)** — solo sube el **peso tipográfico** del dato. El extremo **quiet**: resaltar sin alarma.

### Vocabulario de efectos (primitivas)

Set curado de **7 primitivas**, con id estable (el `effect` del límite). Todas reusan moldes vigentes. De **más quiet a más fuerte**:

| id | Efecto | Molde reusado | Tono | Portador no-color (a11y) |
|---|---|---|---|---|
| `bold` | **Énfasis de peso** — sube el peso del dato (p. ej. 500→600, 600→700), sin tocar color | escala tipográfica del DS | neutro (sin hue) | el cambio de **peso/forma** es no-color en sí; + aria |
| `tint` | **Color ámbar del texto** — tiñe la cifra/texto en `--warning-ink` | color de texto | ámbar | **solo permitido sobre cifras/textos neutros** (ver regla); + aria |
| `glyph` | **Glifo de alerta** — `AlertTriangle` (lucide) `--warning-ink`, 11–16px según contexto, `aria-label`+`title`, svg `aria-hidden` | cluster de glifos de la zona de estados | ámbar | la **forma del glifo** + aria/title |
| `dot` | **Punto/marcador de alerta** — dot 6px `--warning` (o marcador de esquina en celdas densas) | punto de categoría (6px `rounded-full`) recoloreado a ámbar | ámbar | forma + **aria/tooltip obligatorios** (un dot solo es color) |
| `badge` | **Badge de límite** — chip `--warning-soft`/`--warning-ink`/`--r-chip` 7px, 11px·600·`.04em`, con `AlertTriangle` 11px opcional + label corto | chip "Anulado" recoloreado a ámbar | ámbar | el **texto del badge** (label del límite) |
| `fill` | **Fondo tenue** — `--warning-soft` de fondo de fila/total (reemplaza el hover tint condicionalmente) | patrón `-soft` | ámbar | **nunca solo** — siempre + `glyph` o `badge` (fondo solo = color-only) |
| `ring` | **Ring de alerta** — anillo `--warning` 1px vía `box-shadow` (mecanismo del focus ring, no reflowea), alrededor de celda/bloque de total | focus ring del DS | ámbar | **nunca solo** — siempre + `glyph`/`dot`/tooltip (ring solo = color-only) |

**Regla dura del `tint`:** teñir la **cifra** solo se permite cuando esa cifra es **neutra** (`--ink`/`--ink-2`, magnitud sin tipo: totales de reporte, celdas, métricas de footer, contadores). **Nunca** se tiñe un **monto tipado** (su color es portador del **tipo**). Sobre montos tipados: `glyph`/`badge`/`fill`/`ring`/`bold`, nunca `tint`.

### Mapeo efecto ↔ tipo de anclaje

Cada key del catálogo emite en un **tipo de anclaje**. El panel ofrece, por key, **solo el subset válido**, con un **default sensato**.

| Tipo de anclaje | Keys de ejemplo | Efectos válidos | Default | Ubicación / notas |
|---|---|---|---|---|
| **Línea de movimiento** (monto tipado + fila) | `mes.item.monto` | `glyph`, `badge`, `fill`, `bold` | `glyph` | El `glyph` `AlertTriangle` entra en la **zona de estados de la sublínea** (slot que ya colapsa → cero impacto), **primero** del cluster (antes de `GitBranch`). `badge` va como **primer segmento de identidad** (mismo slot que "Anulado"). `fill` reemplaza el hover tint de la fila **+ obligatorio un `glyph`**. **Nunca `tint`** (el monto es tipado). Bajo ítem anulado, la marca hereda el `opacity-[0.55]` del contenido. |
| **Línea de movimiento — derivada por categoría** (sin cifra propia) | `mes.categoria.gastoMes` | `glyph`, `badge`, `fill`, `bold` | `glyph` | **Key derivada**: representa el gasto **acumulado del mes** de una categoría, sin número propio renderizado en `/mes`. Al cruzarse, la marca recae **a nivel de fila** sobre **cada movimiento de esa categoría** → **reusa exactamente el slot y subset de `mes.item.monto`** (**nunca `tint`**). La marca **se repite** en todas las filas de la categoría, por eso el default `glyph` (el más liviano). Portador a11y **por fila** = `aria`/tooltip con el cruce a nivel de categoría-mes (reusa el `label` del límite, ej. "Gasto del mes en {categoría} supera el límite"). Bajo anulado, hereda el `opacity-[0.55]`. |
| **Total / subtotal de mes** (cifra dominante) | `mes.total.gasto`, `mes.total.ingreso`, `mes.balance`, `mes.seccion.subtotal` | `badge`, `glyph`, `bold`, `tint`†, `ring` | `badge` | `badge` adyacente a la cifra (misma celda, `inline-flex gap justify-end`). `tint`† **solo si la cifra es neutra**. `ring` para envolver el bloque de total (+ glifo). |
| **Contador de sección** (pill) | `mes.seccion.conteo` | `glyph`, `badge` | `glyph` | `glyph` a la izquierda del pill contador; o recolorear el pill a `--warning-soft`/`--warning-ink` (`badge`). |
| **Celda de grilla** (fondo ocupado por heatmap) | `reporte.unicos.celda` | `ring`, `dot` | `ring`+`dot` | **`fill` NO disponible** (el fondo lo ocupa la rampa, `graficos-anuales.md` *Reporte anual de Únicos*). `ring` ámbar inset 1px + **marcador de esquina** `dot`. Portador a11y = **el texto del tooltip de celda** + `aria-label` de la celda. |
| **Barra con etiqueta propia** (color = categoría) | `reporte.cuotas.montoPorCuota`, `reporte.cuotas.cantidadCuotas` | `glyph`, `badge`, `ring` | `glyph` | La barra está teñida por **color de categoría** — **no se recolorea**. `glyph` y `badge` entran en la etiqueta de monto (interna u outer); `ring` = anillo inset alrededor de la barra. Portador = glifo/badge + tooltip. |
| **Banda de un stack apilado** (sin etiqueta, alto = valor) | `reporte.cat.gastoMesCategoria` | `ring` (**único**) | `ring` | La banda **no tiene etiqueta** y su **alto lo fija el valor**. **Solo `ring`**: contorno ámbar del perímetro en modo Barra; anillo ámbar en el vértice del borde superior en modo Línea. Si la categoría **no aporta** ese mes, la marca **escala al cartucho del mes**. Ver `limites-by-category.md`. |
| **Columna de mes de un chart apilado** (total sin elemento propio) | `reporte.cat.gastoMesTotal` | `glyph`, `badge`, `ring` | `glyph` | El total del mes **no es ningún elemento pintado**. Su portador es el **cartucho del mes** en el carril del eje X, **idéntico en modo Barra y modo Línea**. Ver `limites-by-category.md`. |
| **Punto/mes de serie en chart** (Recharts) | `reporte.ie.gastoMes`, `reporte.ie.ingresoMes`, `reporte.infl.*` | `dot`, `ring` | `dot` | Marcador `dot` ámbar sobre el punto/barra del mes que cruza; `ring` para envolver una barra. Las series de `income-expense` van tipadas → **no recolorear**. Portador = tooltip del chart + `aria`. |
| **Métrica de footer / porcentaje** (cifra neutra pequeña) | `reporte.unicos.mesTotal`, `reporte.unicos.promedioDiario`, `reporte.unicos.pctVsPrev`, `reporte.unicos.inflacionMes`, `reporte.infl.*` | `tint`, `glyph`, `bold` | `tint` | Cifras **ya neutras** (`--ink-2`) → `tint` a `--warning-ink`. En el `%dif` **se conserva** su glifo `↑`/`↓` (sigue en `--ink-2`). Portador = el tooltip rico del footer + `aria`. |

† `tint` sobre total/subtotal: **solo** cuando el front confirma que esa cifra se renderiza en color neutro.

### Colisión de marcas — un dato, varios límites

- **Una sola marca por dato por familia de efecto.** Si varios límites disparan, se muestra **la marca más fuerte** (orden quiet→fuerte) y su **`aria`/tooltip enumera todos los límites cruzados**.
- **En el cluster de la zona de estados**, **un** `AlertTriangle`; el tooltip lista los que cruzaron.

### Accesibilidad — nunca solo color

- **Toda marca porta una señal no-color:** (a) la **forma** del `AlertTriangle`, (b) el **texto** del `badge`, (c) el **cambio de peso** (`bold`), o (d) como mínimo `aria-label` + `title` + **texto del tooltip** describiendo el límite (ej. "Supera el límite: gasto del mes > $300.000"). El texto accesible **reusa el `label` del límite** (o su placeholder derivado).
- **`fill` y `ring` nunca van solos.**
- **`dot` exige aria/tooltip.**
- **Patrón de glifo idéntico al cluster de estados:** wrapper con `aria-label` + `title` nativo, svg `aria-hidden` (molde de `GitBranch`).
- **Contraste:** `--warning-ink` sobre `--warning-soft` y sobre `--panel` cumple la barra del callout de advertencia. En **oscuro**, los tokens `warning` toman su valor dark (`fundamentos.md` *Principios de calibración del oscuro*).

### Cumplimiento de reglas duras

- **Regla dura 1:** la marca es **ámbar**, jamás verde/rojo; **nunca recolorea un monto tipado**.
- **Regla dura 2:** ningún efecto usa índigo.
- **Regla dura 3:** las marcas **no introducen cifras** fuera de mono; si el `badge` muestra el umbral, va en mono tabular.
- **Regla dura 4:** tokens `warning` con par claro/oscuro.

---

## Panel de gestión de límites

> Spec visual del **gestor de límites**: la sección de `/configuracion` donde el usuario **crea y elimina** límites (decisiones D7/D8 del roadmap). Extiende *Marca visual pasiva de límites* y se articula con *Aviso de alerta activa de límites*. Define **cómo el usuario configura** un límite de **cualquiera de las dos naturalezas**: **pasiva** (marca un dato cuando cruza) y **activa** (avisa al guardar un movimiento). El panel expone un **selector de naturaleza** (§3.3) que reconfigura el resto del formulario. El shape del límite, las keys y la evaluación son funcionales/técnicos; acá va solo el cromo.
>
> **Reutilización total, cero cromo nuevo:** `.card` de `/configuracion`, la navegación vertical de secciones (§1), el segmented `.dtabs` (naturaleza y alcance), la primitiva `Select`, la primitiva `Input`, el listbox rico con íconos (`PaymentMethodSelect`), el molde de modal (`transaction-modal`), la primitiva `Button` y el checkbox del DS.

### 1. Control de navegación — `/configuracion` es el hub de administración con navegación vertical de secciones

`/configuracion` es el **hub de administración de la cuenta**: **cuatro secciones hermanas** bajo una misma cabecera `.phead` ("Ajustes" / "Configuración"). Orden fijo:

1. **General** — la card de Moneda por defecto (y el bloque *Datos externos*, ver `datos-externos.md`).
2. **Categorías** — el gestor `CategoriesList`.
3. **Métodos de pago** — el gestor `PaymentMethodsList`.
4. **Límites** — el gestor de límites (`LimitsTab`).

**Ruteo anidado deep-linkable.** Cada sección es una **ruta propia**: `/configuracion` (→ General), `/configuracion/categorias`, `/configuracion/metodos-pago`, `/configuracion/limites`. La nav **navega entre rutas**. La sección activa se **deriva de la URL** (§1.c).

**Navegación vertical, no segmented.** Un segmented (`.dtabs`) es un **input de elección de valor**; en `/configuracion` el usuario **navega entre secciones**. Por eso el control es **navegación vertical** (patrón GitHub / macOS System Settings / Stripe): **columna de secciones a la izquierda**, **contenido a la derecha**. Escala: más secciones se apilan sin comprimir una barra. **El molde `.dtabs` no se toca** (sigue vivo en el modal de movimiento). El copy y el orden los confirma el analista (`screens.md`).

**Persistencia (arquitectura de rutas).** La `.phead` (§1.b) **y** la columna de nav viven en el **layout compartido** del hub y **no se re-montan** al cambiar de sección. Solo cambia el **contenido de la derecha**.

**Layout (≥941px, régimen amplio):**

- Debajo de la `.phead` (`mb-6`), **dos columnas**: `flex flex-row items-start gap-8`.
- **Columna de nav (izquierda) — track contenedor de grupo:** el `<nav>` **es** el track: `bg-panel-2` + `border border-line` + `rounded-[var(--r-card)]` (14px) + padding `p-1.5` (6px), `flex flex-col gap-1`, `w-[200px] shrink-0`. **Ancho útil interno ~188px**: aloja "Métodos de pago" (~145px con su `px-3`) sin envolver. Con 4 ítems el track mide ~184px de alto. Alineado al **tope**. Radio del track (14px) vs. ítems (10px) con padding 6px: anida limpio. **Por qué el track:** sobre el `--paper` los ítems sueltos se leían como controles independientes; la superficie recesada los agrupa y **completa la metáfora del thumb**: el ítem activo `--panel` **sube de un track recesado**. Sin rótulo de grupo.
- **Columna de contenido (derecha):** `flex-1 min-w-0`. Contenido de la sección activa; cada gestor conserva su contenido, con su cabecera **degradada a cabecera de sección** (§1.b).

**Ítem de sección:**

- **Caja:** `w-full text-left`, `px-3 py-2.5` (~40px), `rounded-[var(--r-ctl)]` (10px), **`border border-transparent`** (reserva el borde: sin salto de 1px). `transition-colors duration-[140ms] motion-reduce:transition-none`.
- **Tipografía:** `text-[13.5px] font-semibold`. El peso **no cambia** entre estados.
- **Estados (lógica de fondos invertida contra el track recesado):**
  - **Reposo (inactivo):** fondo **transparente sobre el track**, `text-muted`, `border-transparent`.
  - **Hover (inactivo):** `bg-panel-3` + `text-ink` — un paso por encima del track en ambos modos.
  - **Activo:** **tile que sube del track** — `bg-panel` + `border border-line` + `shadow-[var(--shadow-sm)]`, `text-ink`. En **claro** activo (blanco) más claro que el track y hover `panel-3` más oscuro → direcciones opuestas. En **oscuro** activo `--panel` (0.215) más oscuro que el track (0.24) y hover (0.27) más claro → siguen opuestos; el **`border border-line` sostiene la separación** (obligatorio en oscuro).
  - **Focus-visible:** `shadow-[0_0_0_3px_var(--accent-soft)]`, 140ms.
- **Sin acento como indicador de activo:** el índigo **solo** como anillo de foco.

#### 1.b Jerarquía de cabecera del hub — un solo H1 de página, cabecera de sección degradada

**Una sola escala de tres niveles** (evita dos H1 y eyebrows redundantes al anidar los gestores):

**Nivel 1 — Título de página (persistente, único H1).** En la `.phead` del layout compartido.
- **Eyebrow** "Ajustes": `text-[12px] font-semibold uppercase tracking-[0.1em] text-muted`. **Único eyebrow de la pantalla.**
- **H1** "Configuración": `text-[32px] font-bold tracking-[-0.02em] text-ink leading-tight`. **Único H1.**
- **Bajada** (opcional) "Preferencias de tu cuenta.": `text-[14px] text-muted mt-2`.
- Bloque con `mb-6`. **No lleva botón.**

**Nivel 2 — Cabecera de sección (`h2`).** Reusa el **token de título de modal** (18px/700). Tres escalones legibles (32 → 18 → 14.5).
- **Fila:** `flex items-center justify-between gap-5 flex-wrap`, `mb-4`.
- **Título (`h2`):** `text-[18px] font-bold tracking-[-0.01em] text-ink` ("General" / "Categorías" / "Métodos de pago" / "Límites"). **Sin eyebrow.**
- **Bajada (opcional):** `text-[13px] text-muted` (500), `mt-[3px]`, con sus énfasis inline (número en `mono`, palabra clave en `--ink`).
- Dentro de la sección, los títulos de card siguen en 14.5/600 `--ink` + 12.5/500 `--muted`.

**Las cabeceras de los gestores (Categorías, Métodos, Límites) no llevan** eyebrow "Configuración" ni H1 de 32px propio: su título es el `h2` de sección. Los **skeletons** de esos gestores imitan la cabecera de sección: **sin línea de eyebrow**, título ~18px, bajada ~13px, botón (ver `skeletons.md`). **General** solo tiene su `h2` "General" (sin bajada ni botón). Listas, filas, cards y modales de los gestores no cambian.

**Botón de acción por sección** ("Nueva categoría" / "Nuevo método de pago" / "Nuevo límite"):
- **Ubicación:** **derecha de la fila de la cabecera de sección** (`justify-between`). Nunca en la nav ni en la `.phead`.
- **Forma unificada:** `Button` **primario** (`variant=default size=default`) con **ícono `Plus` 16px a la izquierda + label**. **Sin** "+ " literal en el texto.
- **Alineación:** `items-center` contra el bloque identidad. Al envolver, cae a una segunda línea bajo la identidad, alineado a la izquierda.
- **General no tiene botón.**

#### 1.c Sección activa derivada de la ruta

La sección activa se **deriva del `pathname`**. El ítem cuya ruta coincide toma el estado **activo** (tile elevado); el resto queda en reposo, con hover (`bg-panel-3` + `text-ink`) y focus-visible idénticos. Entrar por deep-link pinta la sección activa sin parpadeo.

**Semántica ARIA de navegación entre rutas:** `<nav aria-label="Secciones de configuración">` con **enlaces** (`<a>`/`Link`); el ítem activo lleva **`aria-current="page"`** (a lo que se liga el estado visual). **No** hay `tablist`/`tab`/`tabpanel`; navegación nativa de enlaces (Tab).

**Responsive (≤940px, `max-wide` — obligatorio):**

- **Una columna**: nav **arriba**, contenido **debajo**. Base `flex flex-col gap-6`; `wide:flex-row wide:gap-8 wide:items-start`.
- **El track no desaparece en compacto**: pasa a **barra horizontal que envuelve**. `<nav>`: `flex flex-row flex-wrap gap-1 bg-panel-2 border border-line rounded-[var(--r-card)] p-1 wide:flex-col wide:w-[200px] wide:shrink-0 wide:p-1.5`. Ítems `w-auto`, `wide:w-full`. **Cuatro pastillas cortas** con `gap-1`, track separado del contenido por `gap-6`.
- **Padding compacto `p-1` (contra desborde a ~392px):** la pastilla más ancha (~169px) + 8px de padding = ~177px, muy por debajo de ~392px. Las 4 suman ≈ **405px**; a ~392px **envuelven a una segunda fila** dentro del track, **nunca** scroll horizontal.
- **Los cuatro invariantes:**
  1. *Sin scroll horizontal:* las 4 etiquetas en `flex-wrap` **dentro del track** envuelven; el track crece en alto, no en ancho.
  2. *Modales completos:* la nav no abre modal; los modales de los gestores son independientes.
  3. *Ninguna acción inalcanzable:* los 4 ítems siempre visibles; el botón de acción de la sección alcanzable (envuelto si hace falta).
  4. *Superficies anchas scrollean dentro de sí:* el track envuelve, no scrollea.

**Checklist de aceptación visual (nav de `/configuracion`):**

*Nav vertical (las 4 secciones):*
- [ ] La nav se lee como **un grupo contenido**: los 4 ítems viven dentro de una **superficie recesada** (track `bg-panel-2` con `border border-line` y esquinas `--r-card` 14px), no como botones sueltos sobre el paper. El track **no** lleva rótulo de grupo.
- [ ] En ≥941px la nav es una **columna a la izquierda** (track de ~200px de ancho, padding interno 6px) con el contenido a su derecha, alineados al tope, con aire entre ambos; los **4 ítems** ("General" · "Categorías" · "Métodos de pago" · "Límites") se apilan sin envolver dentro de su pastilla.
- [ ] El `.dtabs`/segmented horizontal **no aparece** en `/configuracion` (y sigue vivo e intacto en el modal de movimiento).
- [ ] La sección **activa** (según la URL) se ve como **tile que sube del track** (fondo `panel` + borde + sombra sutil), claramente distinta del track `panel-2` que la rodea; el hover sobre otra sección da un **tinte `panel-3`** (un paso por encima del track), **sin** sombra. Activo y hover tiran en **direcciones opuestas** de superficie, no se confunden.
- [ ] El ítem inactivo en reposo es **transparente sobre el track** (deja ver el `panel-2`), texto `--muted`; no hay salto de 1px al pasar de inactivo a activo (borde reservado).
- [ ] **Ninguna** sección (track, activa ni hover) usa índigo/acento como fondo o texto; el índigo aparece **solo** como anillo de foco al tabular.
- [ ] Foco de teclado: anillo índigo de 3px visible sobre el ítem enfocado; Tab recorre los enlaces.
- [ ] **Deep-link:** entrar directo a `/configuracion/categorias` (o `/metodos-pago` `/limites`) pinta esa sección como activa y muestra su contenido, sin pasar por General.
- [ ] Al cambiar de sección, **solo** cambia el contenido de la derecha; la `.phead` de página y el track de nav **no se mueven ni parpadean**.
- [ ] En ≤940px la nav pasa **arriba** del contenido: el track se vuelve **barra horizontal** (padding interno 4px) con las pastillas cortas envueltas dentro; con 4 ítems pueden **envolver a 2 filas dentro del track** (el track crece en alto, no en ancho). A 640px (y con sidebar abierto ~392px de contenido) **no** hay scroll horizontal del `body`, ningún ítem desborda el track, y las 4 secciones quedan alcanzables.
- [ ] Claro y oscuro: el track `panel-2` y el tile activo `panel` **contrastan** en ambos modos; en oscuro el tile activo se separa del track por su `border border-line` (la sombra oscura casi no lee, el borde la sostiene).

*Jerarquía de cabecera (§1.b):*
- [ ] Hay **un solo H1** en la pantalla ("Configuración", 32px) y **un solo eyebrow** ("Ajustes"). En Categorías, Métodos y Límites **no** aparece un segundo H1 de 32px ni el eyebrow "Configuración".
- [ ] Cada sección abre con su **cabecera de sección** `h2` a **18px/700** (por debajo del H1, por encima de los títulos de card): "General" / "Categorías" / "Métodos de pago" / "Límites".
- [ ] La bajada de cada gestor sigue presente, a **13px/500 `--muted`** (con el número en `mono` y las palabras clave en `--ink` donde corresponde).
- [ ] En **General**: página "Configuración" (32) → sección "General" (18) → card "Moneda por defecto" (14.5), tres niveles distintos; General **no** tiene botón.
- [ ] Botón de acción en las **3 secciones** que lo tienen: primario, a la **derecha** de la fila del `h2`, con **ícono `Plus` 16px + label** ("Nueva categoría" / "Nuevo método de pago" / "Nuevo límite") — misma forma en las tres; **sin** el "+ " literal en el texto.
- [ ] En ≤940px, al angostar, el botón de acción **envuelve** bajo la identidad de la sección sin salir del contenedor.
- [ ] Los **skeletons de carga** de Categorías y Métodos **no** muestran línea de eyebrow y su título fantasma es ~18px (no ~32px).

> La estructura del hub (secciones, orden, copy, rutas anidadas) es funcional (`screens.md`). Acá: el **control de navegación** y la **jerarquía de cabecera**.

### 2. Solapa Límites — encabezado y lista

Dentro de la sección (ruta) **Límites**:

- **Cabecera de sección** — nivel 2 del hub (§1.b): fila `flex items-center justify-between gap-5 flex-wrap`, `mb-4`.
  - **Izquierda:** `h2` "Límites" (**18px/700 `-0.01em` `--ink`**) + bajada **13px/500 `--muted`** ("Resaltá un dato cuando cruza un umbral que definís.").
  - **Derecha:** `Button` **primario** con `Plus` 16px + **"Nuevo límite"**. Abre el modal de creación (§3).

- **Lista de límites:** **card contenedora** (`.card`: `bg-panel`, borde `--line`, `--r-card` 14px, `--shadow-sm`) con **filas separadas por hairline** (`--hair`), ritmo de lista de `/mes` (`--row-pad` 14px vertical, 22px horizontal). Cada fila tiene **dos zonas** (identidad · estados/acciones):

  - **Zona identidad (izquierda, flex-1):**
    - **Línea 1 — label:** el `label` del usuario, o el **placeholder derivado** (key legible + condición); 14.5px/600 `--ink`. A su izquierda, un **preview del efecto** (el mark real a tamaño chico, según el `effect`) como identificador (§4).
    - **Línea 2 — meta (12.5px/500 `--muted`, `mt-[2px]`):** **qué observa** = rótulo legible de la key + refinamiento (ej. "Gasto del mes" · "Comida" · "Únicos"), y un **chip de alcance temporal** (`--r-chip` 7px, `bg-panel-3` `--muted`, 11px/600 `.04em`): "Todos los meses" / "Mes en curso".
    - **La condición** (`{operador} {umbral}`) como **chip mono tabular** adyacente al label (ej. `> 300.000`), 12px `mono` `tnum` `--ink-2` sobre `bg-panel-3` `--r-chip`. Umbral **número puro, sin símbolo de moneda** (D3); `percent` → sufijo `%`; conteo → sustantivo neutro ("ítems").
  - **Zona estados/acciones (derecha, `shrink-0`, `gap-[10px]`):**
    - **Toggle `enabled`** — **switch** con el mecanismo del thumb del segmented: pista `--panel-3`, thumb `--panel` + `--shadow-sm` deslizando 140ms; **encendido** = pista `--accent` (cromo de interacción). `role="switch"` + `aria-checked`, `aria-label` "Activar límite: {label}".
    - **Eliminar** — `Button` `variant=ghost` `size=icon` con `Trash2` 16px `--muted` (hover `--expense-ink`). Confirmación **inline** (bajo riesgo, sin cascada): la zona se reemplaza por "¿Eliminar? · [Eliminar] [Cancelar]" (`variant=destructive size=sm` + `variant=ghost size=sm`).
  - **Deshabilitado (`enabled=false`):** la fila a `opacity-[0.55]` (como el ítem anulado de `/mes`), salvo switch y eliminar (opacidad plena).

  - **Fila de límite de naturaleza activa:** sin preview de efecto ni chip de alcance (no los tiene, §3.3). En su lugar: glyph `AlertTriangle` **ámbar** (`--warning-ink`, 16px) a la izquierda del label + **chip "Alerta activa"** (`--r-chip` 7px, `bg-panel-3` `--warning-ink`, 11px/600 `.04em`) en la Línea 2. El resto idéntico a la pasiva. Ámbar = "avisa al guardar"; rojo = "vas a destruir algo".

- **Estado vacío (sin límites):** bloque centrado (molde de empty-state): glifo neutro `Gauge`/`Target` (~28px, `--faint`), titular 14.5px/600 `--ink` "Todavía no creaste límites", bajada 13px/500 `--muted` ("Creá un límite y Control resaltará ese dato cuando cruce el umbral que definas."), y el `Button` **primario** "Nuevo límite" debajo.

### 3. Flujo de crear — modal con formulario progresivo

**Contenedor: modal** (`transaction-modal`: portal, scrim `oklch(0.18 0.02 270 / 0.46)` + `blur(3px)`, diálogo `bg-panel` borde `--line` radio 18px `--shadow-lg` `animate-modal-pop`, header 18px/700 "Nuevo límite" + `X`). **No** es wizard ni panel inline: **un formulario en columna** (`space-y-[14px]`) que **revela y adapta** campos. Ancho `max-w-[460px]` (variante `form` del shell).

Orden (arriba → abajo). Los pasos condicionales **no reservan alto** (se montan/desmontan):

1. **Anclaje (key)** — **primer campo y compuerta.** **Listbox rico con íconos** (`PaymentMethodSelect`): trigger + panel por portal, catálogo **agrupado por superficie**. **Encabezados de grupo no seleccionables** (13px/700 `.1em` uppercase `--muted`): **Vista del mes** · **Dashboard** · un grupo por tipo de reporte (Ingresos vs Gastos · Gastos por categoría · Únicos · Cuotas · Inflación vs Ingresos). Cada opción = glifo de superficie 16px `--ink-2` + **rótulo legible** (13.5px `--ink`) + chip de tipo de dato (`money`/`percent`/`count`, `--panel-3`, 11px/600). Sin key, **el resto del form no se renderiza**.

2. **Refinamiento (condicional)** — solo si la key lo declara:
   - `section` → **`Select`** con Únicos / Fijos / Cuotas (de `monthSections`).
   - `categoryId` → **listbox rico** con **swatch de categoría** (6px `rounded-full`) + nombre. Label "Categoría".

3. **Naturaleza (pasiva / activa)** — **segmented de 2 opciones** (`.dtabs`/`CurrencySegmented` neutro): **"Pasiva"** · **"Activa"**. Label arriba (12px/600 `.1em` uppercase `--muted`). Tras el refinamiento. Reconfigura el resto:
   - **"Activa" deshabilitada salvo que la key admita alerta activa** — solo las **7 keys `mes.*`**. Con otra key: `opacity-50`, `cursor-not-allowed`, `aria-disabled`, thumb sin desplazar; **no se oculta**. Un `title`/hint muted explica por qué ("La alerta activa solo aplica a datos del mes en curso").
   - **Preselección "Pasiva".** "Activa" **desmonta** alcance (§3.5) y efecto (§3.6) y **restringe operadores** (§3.4). Volver a "Pasiva" los re-monta con sus defaults.

4. **Condición (operador + umbral)** — fila `flex gap-3`:
   - **Operador:** `Select` compacto con **glifo mono + palabra**:
     - **Pasiva:** los **5 operadores** `>` mayor que · `≥` mayor o igual · `<` menor que · `≤` menor o igual · `=` igual a. Default `>`.
     - **Activa:** **solo la polaridad válida**: **techo** (`>` / `≥`) para gasto, subtotal, conteo, categoría e ítem; **piso** (`<` / `≤`) para balance e ingreso. Default el estricto. Los otros **no se listan**.
   - **Umbral:** **`Input`** (`inputMode="decimal"`), **mono tabular alineada a la derecha**, `placeholder` según `unit`. **Sin prefijo de moneda** (D3): `money` → solo el número (agrupación al mostrar); `percent` → sufijo `%` `--muted`; `count` → `step=1` y sustantivo neutro. Adorno **neutro**.

5. **Alcance temporal (solo pasiva)** — segmented de **2 opciones**: **"Todos los meses"** | **"Mes en curso"** (D4). Preselección **"Todos los meses"** (`frontend/src/components/limits/create-limit-modal.tsx`). **Se desmonta en activa.**

6. **Efecto visual — marca pasiva (solo pasiva)** — subset por anclaje, con default (§4). **Se desmonta en activa** (su señal es el aviso al guardar).

7. **Nombre (opcional)** — **`Input`** de texto, label "Nombre (opcional)", `placeholder` = el **label derivado**.

- **Resumen en lenguaje natural** (antes del footer): 12.5px/500 `--muted`, fragmentos clave en `--ink-2`/600, cifra en mono:
  - **Pasiva:** *"Se marcará **Gasto del mes** cuando **supere 300.000**, en **todos los meses**, con un **glifo de alerta**."*
  - **Activa:** *"Al guardar un movimiento, Control **te avisará** si **Gasto del mes** **supera 300.000**."*
- **Footer** (`flex justify-end gap-3`, borde superior `--hair`): `Button` ghost "Cancelar" + primario "Crear límite", **deshabilitado** (`opacity-50`) hasta key + umbral válidos (+ refinamiento si se exige). Errores de umbral al submit con el estado de error de `Input` (borde `--expense`, ring `--expense-soft`, texto `--expense-ink`).

### 4. Efecto — subset por anclaje, default y preview

El picker es el **consumidor** de *Mapeo efecto ↔ tipo de anclaje* (no se duplica la tabla):

1. La key determina su **tipo de anclaje**.
2. Se ofrece **exactamente** el subset "Efectos válidos", **con el Default preseleccionado**.
3. **Nunca** un efecto fuera del subset. El usuario elige **cuán fuerte**, no el color.

- **Control:** **option-cards en radio** (`role="radiogroup"`). Cada card: `bg-panel` borde `--line` `--r-ctl`; seleccionada = borde `--accent` + ring `--accent-soft` 3px. Contenido:
  - **Nombre** (13px/600 `--ink`): Peso · Tinte · Glifo · Punto · Badge · Fondo · Ring (`bold`/`tint`/`glyph`/`dot`/`badge`/`fill`/`ring`).
  - **Preview vivo:** el **mark real** sobre un **dato de muestra** del anclaje (p. ej. `$300.000` mono con `glyph` ámbar), con los **tokens `warning` reales**. Para `fill`/`ring` el preview va **acompañado** de su glifo/badge obligatorio.
- **Subset de un solo efecto:** el `radiogroup` **no se renderiza**; va una **línea informativa** con el mismo preview — label del efecto (13px/600 `--ink`) + la marca sobre el dato de muestra + bajada 12.5px `--muted` (ej. *"Contorno ámbar sobre la banda de esa categoría."*). Caso: `reporte.cat.gastoMesCategoria` → `ring`.
- **Default:** preseleccionado; el usuario puede cambiar dentro del subset.
- El preview del picker es la **misma** representación que el identificador de efecto de la fila de la lista (§2).

### 5. Coherencia — moldes reusados (resumen)

| Elemento del panel | Molde reusado |
|---|---|
| Nav de secciones (hub de 4: General · Categorías · Métodos de pago · Límites) | navegación vertical de secciones (§1, tokens del DS) |
| Cabecera de sección `h2` + botón (Categorías / Métodos / Límites) | jerarquía de cabecera del hub (§1.b): `h2` 18/700 = token de título de modal; bajada 13/500; botón primario con `Plus` |
| Card contenedora de la lista | `.card` de `/configuracion` |
| Fila de límite (2 zonas) | sublínea del ítem de `/mes` (identidad · estados) |
| Chip de condición / alcance | chip `--r-chip` `--panel-3` (mono para la cifra) |
| Toggle `enabled` | thumb deslizante de `CurrencySegmented`, como switch |
| Botón "Nuevo límite" / footer | primitiva `Button` (primario / ghost / destructive) |
| Eliminar + confirmación inline | `Button` icon + variante destructive `size=sm` |
| Modal de creación | `transaction-modal` (scrim, diálogo, header) |
| Picker de anclaje / de categoría | listbox rico `PaymentMethodSelect` |
| Selector de sección / operador | primitiva `Select` |
| Input de umbral / nombre | primitiva `Input` (mono para el umbral) |
| Segmented de naturaleza (pasiva/activa) | `CurrencySegmented`/`.dtabs` neutro (con opción "Activa" disabled) |
| Segmented de alcance temporal | `CurrencySegmented`/`.dtabs` neutro |
| Preview y marca de efecto | primitivas del catálogo *Marca visual pasiva* (tokens `warning`) |
| Glyph + chip "Alerta activa" (fila de activa) | `AlertTriangle` `--warning-ink` + chip `--r-chip` `--panel-3` |

**Reglas duras:** umbral y condición en **mono tabular**; el único índigo es **cromo de interacción** (focus ring, switch encendido, borde de card de efecto seleccionada); verde/rojo solo en el **error** de `Input` y el **destructive** de eliminar; la marca de **naturaleza activa** es **ámbar**; todo con par claro/oscuro.

---

## Aviso de alerta activa de límites

> **Aviso de confirmación de la naturaleza activa** (roadmap de límites §4 y D10). Un límite **activo** intercepta el **guardado de un movimiento** en el modal de carga (Único / Fijo / Cuota): al pulsar **Guardar**, si el resultado **proyectado** cruzaría el umbral de uno o más límites activos, se muestra un **aviso** que enuncia qué límite(s) y ofrece **continuar o cancelar**. **No bloquea** (D10). La proyección y la evaluación son funcionales/técnicas.

### Restricción rectora — cero fricción sin límites activos cruzados

**El aviso existe SOLO si al menos un límite activo se cruzaría.** Sin cruces, el flujo de Guardar persiste directo, sin diálogo, sin cambio de DOM ni de foco. Compuerta condicional en el handler de guardado: conjunto vacío → persistir; no vacío → montar el aviso.

### Forma y ubicación — diálogo de confirmación apilado, en registro ámbar

- **Diálogo de confirmación apilado** sobre el modal de movimiento (molde de los `delete-*-dialog`: portal, scrim `oklch(0.18 0.02 270 / 0.46)` + `blur(3px)`, `bg-panel` borde `--line` radio 18px `--shadow-lg` `animate-modal-pop`, header + cuerpo + footer). **No** es callout inline ni transforma Guardar. El modal de movimiento **permanece montado detrás** con el form intacto.
- **Apilamiento:** por encima del modal de movimiento (`z-40`), al nivel de los diálogos de confirmación (`z-50`). Su scrim oscurece también el modal de movimiento.
- **Ancho:** `max-w-[440px]` (variante `dialog`).
- **Al pulsar Guardar (interceptado):** el form valida; con ≥1 cruce se monta el aviso. Guardar vuelve a idle mientras el aviso está abierto.

### Tono — ámbar `--warning`, aviso NO destructivo

- **Advertencia, no error ni destrucción.** El peso lo carga un **callout ámbar** (molde del callout de borrado en cascada: `rounded-ctl`, `bg: --warning-soft`, `border: 1px solid --warning`, `AlertTriangle` `--warning-ink`).
- **Sin rojo en ningún elemento** (los diálogos de borrado usan rojo porque destruyen).
- **Los botones NO son ámbar.** El ámbar vive en el callout (información).

### Contenido y enumeración de cruces

**Header** — 18px/700 `--ink`, `tracking-[-0.01em]`:
- 1 límite: **"Este movimiento cruza un límite"**
- N límites: **"Este movimiento cruza {N} límites"**

**Cuerpo** (`px-[22px] pb-[22px] space-y-[14px]`):
- **Línea guía** (14px `--ink`): "Al guardar, este movimiento cruzaría {un límite que definiste / estos {N} límites que definiste}:".
- **Callout ámbar** con la enumeración:
  - **Un solo `AlertTriangle`** (16px `--warning-ink`) arriba a la izquierda — **no uno por límite**.
  - **Lista** (`space-y-2`), un ítem por límite:
    - **Label** (13.5px/600 `--warning-ink`): `label` del usuario o **placeholder derivado**.
    - **Condición cruzada** (12.5px/500 `--warning-ink`), separada por middot/em-dash: `{verbo} {umbral}` — ej. **"Gasto del mes"** · "supera $300.000". **Cifra en mono tabular**. Verbo: `gt`→"supera", `gte`→"alcanza o supera", `lt`/`lte`→"queda por debajo de", `eq`→"llega a". `percent` → `%`; `count` → sustantivo neutro. Mapa de verbos en `frontend/src/components/limits/active-limit-dialog.tsx`; no se reinventa por superficie.
    - **(Opcional, si el front tiene el proyectado):** addendum muted "quedaría en $X", mono tabular.
  - Con múltiples límites, cada ítem puede llevar un **marcador neutro** (dot o dash).
- **Nota de cierre** (12.5px/500 `--muted`): "Podés guardarlo igual — Control solo te avisa."

El umbral es **número puro sin moneda** (D3), en **mono tabular con agrupación de miles**.

### Jerarquía de botones y copy

Footer (`flex items-center justify-end gap-3 px-[22px] py-4`, `border-t border-hair bg-panel-2` — idéntico a los `delete-*-dialog`):
- **"Cancelar"** — `Button variant=ghost size=sm`, a la izquierda. Cierra **solo el aviso**; el modal de movimiento queda con el form intacto.
- **"Guardar igual"** — `Button variant=default size=sm` (**primario, índigo — NO destructive, NO ámbar**), a la derecha. Persiste (mismo save-path), cierra aviso y modal, toast de éxito.

**"Guardar igual" es el primario** (D10: continuar sin fricción). El aviso se **lee** porque el peso lo carga el **callout ámbar**.

### Accesibilidad

- **`role="alertdialog"`**, `aria-modal="true"`, `aria-labelledby` = título, `aria-describedby` = línea guía + lista de cruces.
- **Foco:** trap dentro del diálogo. **Foco inicial en "Cancelar"** (un Enter reflejo no salta el aviso). **Esc = Cancelar.**
- **No depende solo de color:** título, forma del `AlertTriangle`, texto enumerado.
- **Contraste:** `--warning-ink` sobre `--warning-soft`; par claro/oscuro.

### Cumplimiento de reglas duras

- **Regla 1:** el aviso es **ámbar**; **ningún elemento usa rojo** ni verde.
- **Regla 2:** el único índigo es "Guardar igual" (cromo de interacción).
- **Regla 3:** umbral y proyectado en mono `tnum`.
- **Regla 4:** tokens `warning` con par claro/oscuro.

### Coherencia — moldes reusados

| Elemento del aviso | Molde reusado |
|---|---|
| Diálogo apilado (scrim, diálogo, header, footer) | `delete-*-dialog` / `transaction-modal` |
| Callout de límites cruzados | callout de borrado en cascada (`--warning-soft` / `--warning` / `AlertTriangle`) |
| `AlertTriangle` único + enumeración | regla de colisión de la *Marca visual pasiva* |
| Botones (ghost "Cancelar" · primario "Guardar igual") | primitiva `Button` |
| Cifra del umbral / proyectado | mono tabular del DS |

> La configuración de la naturaleza activa está en *Panel de gestión de límites* §3.3 y su fila en §2.

---

## Popover informativo de límites por superficie

> **Popover de solo lectura** que **lista qué límites observan una superficie**. Independiente de la marca pasiva (RF-LIM-003) y del aviso activo (RF-LIM-004): **no marca ni avisa — solo informa**. Aparece en las **5 cards de `/reportes` con límites** (`income-expense`, `by-category`, `unique-grid`, `installment-gantt`, `inflation-vs-income`; no en `fixed-evolution`) y en **`/mes`**; **nunca en el Dashboard**.
>
> **Regla rectora — es información, no señal.** Cromo **estrictamente neutro** (`--ink`/`--ink-2`/`--muted`/`--faint`). **No usa ámbar `--warning`** en ningún elemento: ámbar = pasó algo; neutro = acá tenés el dato.

### 1. El ícono disparador

- **Glifo: `Info`** (lucide). Descartados `AlertTriangle` (reservado a la marca ámbar), `Bell` (notificación) y `HelpCircle` (ayuda). **16px**, `aria-hidden="true"`.
- **Botón icónico ghost — molde del botón de refrescar / `X`** (`card-grafico.md` *Botón de refrescar por reporte* §3): `h-8 w-8`, `rounded-[var(--r-ctl)]`, glifo centrado.
  - **Reposo:** `text-muted`, **sin caja**.
  - **Hover / abierto:** `hover:bg-panel-2 hover:text-ink`, `transition-colors duration-[140ms] motion-reduce:transition-none`. **Abierto** mantiene `--panel-2` + `text-ink`.
  - **Focus:** `focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]`.
- **Color neutro en todo estado.** Índigo solo como focus ring.
- **Condición de aparición:** el ícono se monta **solo si hay ≥1 límite** (habilitado o no) cuya `surface` coincide. Con **cero**, **no se renderiza** (sin hueco).

### 2. Ubicación del ícono por superficie

**Principio:** junto a la **identidad/título** de la superficie, como la pieza **más quiet** del chrome.

- **Cards de `/reportes`:** en la **zona de identidad (izquierda)**, **inmediatamente después del título**, `gap-[6px]`. El `CardControls` derecho **no se toca**. Aplica al `CardControls` compartido de `report-card.tsx` (income-expense + by-category) y a las cabeceras inline (`unique-grid-card`, `cuotas-gantt-card`, `inflation-income-card`). En **`by-category`** va en la **fila del título**, con las tabs Barra/Línea debajo. Es un **botón hermano posterior** del título editable, **fuera** de su target de edición.
- **Dashboard:** **no se monta.**
- **`/mes` — desktop (≥1288px):** en la **fila del H1** (`MonthJumpTriggerDesktop`), **hermano posterior** del disparador de período, `gap-[8px]`. El botón de 32×32 cabe en la fila de 32px (cero layout-shift).
- **`/mes` — compacto (<1288px):** en la **fila del stepper** (`@wide:hidden`, `flex items-center gap-[10px] flex-wrap`), **después del `CurrencyChip`** y **antes** del link "Ir al mes en curso". `flex-wrap` lo reacomoda si no alcanza.

> **Por qué no el clúster de acciones/controles:** en `/mes` es de **acciones** (con CTA primaria); en las cards es de **controles**. Una pieza informativa ahí competiría y rompería los hairlines.

### 3. Anatomía del popover

Molde de popover del DS: `--panel`, borde `--line`, radio `--r-ctl` (10px), `--shadow-lg`, animación `pop`; `prefers-reduced-motion` → instantáneo. Anclado al ícono; **sin scrim**.

- **Caja y medidas:** `min-w-[240px] max-w-[300px]`, padding `p-[6px]`. Crece hacia el lado con espacio; clampeo y flip en §5.
- **Caption:** **12px / 600 uppercase `tracking-[0.1em]` `--muted`**, `px-[10px] pt-[6px] pb-[4px]`. Copy: **"Límites de este reporte"** (cards) / **"Límites de esta vista"** (`/mes`) (`frontend/src/components/limits/limits-info-popover.tsx`).
- **Grupos por naturaleza** en lenguaje humano:
  - **Pasivos → "Marcan un dato"**.
  - **Activos → "Avisan al guardar"** — **solo en `/mes`**.
  - **Header de grupo:** **11px / 600 uppercase `tracking-[0.08em]` `--faint`**, `px-[10px] pt-[8px] pb-[3px]`, precedido de un `--hair` solo entre grupos. Se muestra **siempre que el grupo tenga ≥1 ítem** (aun si es el único).
- **Ítem** (un límite): `role="listitem"`, `px-[10px] py-[6px]`, `rounded-[var(--r-chip)]`, **dos líneas**:
  - **Línea 1 — nombre:** `label` del límite o el **rótulo del anclaje** (`getAnchorDef(anchorKey).label`). **UI 13px / 500 `--ink`** (no mono). Una línea con ellipsis; completo en `title`. Refinamiento de **categoría** → **punto 6px** (`rounded-full`, color de la categoría) + nombre de la categoría; de **sección** → en texto.
  - **Línea 2 — condición:** **12px `--muted`**, `mt-[1px]`. Con `label` propio, antepone el **rótulo del anclaje** ("Gasto del mes · > 300.000"); sin `label`, **solo la condición** ("> 300.000"). El **fragmento numérico** (`formatCondition` → operador + umbral) en **IBM Plex Mono `tnum`**. Separador `·` `--faint`.
- **Matiz de alcance temporal:** un pasivo con `temporalScope: "current"` lleva el qualifier **"Solo mes en curso"**, **11px / 500 `--faint`**, al final de la línea 2 (o debajo), con `·`. Los `"all"` no llevan qualifier. Los **activos** nunca.
- **Ítem deshabilitado (`enabled: false`) — incluido, atenuado:** fila a **`opacity-60`** + etiqueta **"Desactivado"** al extremo derecho de la línea 1, **11px / 500 `--faint`**. Dos portadores.
- **Sin preview de efecto** (exclusión deliberada, no pendiente): el preview reintroduciría el registro de "algo pasó".

### 4. Disparo, cierre y accesibilidad

- **Disparo (híbrido click + hover-desktop, NO hover puro):**
  - **Click / tap** → abre (re-clic → cierra). Camino que funciona en touch.
  - **Desktop (hover-capable):** **además** abre por **hover** (~150ms de intención) y cierra al `mouseleave` con gracia corta. **Aditivo**.
  - **Teclado:** `Enter`/`Espacio` abre; el foco puede entrar al listado; `Esc` cierra y **devuelve el foco al disparador**.
- **Cierre:** click/tap fuera, **`Esc`**, re-clic y (desktop) **`mouseleave`**. **Sin** scrim, **sin** focus-trap (contenido de lectura). Alineado con `overlays-modales.md` *Cierre de overlays*.
- **A11y:** disparador `aria-haspopup="dialog"` + `aria-expanded`; `aria-label="Límites que observan este reporte"` (cards) / `"…esta vista del mes"` (`/mes`). Popover = **región etiquetada** (`role="group"`/`dialog` no-modal) con `aria-label` espejo; listado `role="list"` / `listitem`. "Desactivado" y "Solo mes en curso" son **texto**.

### 5. Comportamiento en pantalla chica — los cuatro invariantes

Todo el régimen de app (`≥ 600px` en ambos ejes), sidebar abierto o cerrado.

1. **Sin scroll horizontal del `body`.** Overlay por portal, **clampeado al viewport con margen 12px**. `max-w-[300px]` entra a 640px con sidebar abierto (~392px).
2. **Completo y escapable.** **Flipea hacia arriba** sin lugar abajo; **clampea horizontal** a 12px. Con muchos límites, `max-h-[min(60vh,360px)]` y **scroll interno**. Sin trap.
3. **Ninguna acción inalcanzable.** Disparador 32×32 on-screen en todo ancho. El popover no tiene controles operables.
4. **Superficies anchas scrollean dentro de sí mismas.**

### 6. Cumplimiento de reglas duras

- **Regla 1:** neutro; umbrales como **número puro**.
- **Regla 2:** índigo solo como focus ring.
- **Regla 3:** fragmento numérico de cada condición en **IBM Plex Mono `tnum`**.
- **Regla 4:** tokens neutros theme-aware.
- **Distinción vs. ámbar:** **no** usa `--warning`.

### 7. Checklist de aceptación visual

- [ ] El ícono `Info` (16px, `--muted`, ghost 32×32) aparece **solo** cuando la superficie tiene ≥1 límite (habilitado o no); con cero límites **no está** (sin hueco reservado).
- [ ] **Ubicación:** en cada card de `/reportes` va junto al **título** (izquierda), **fuera** del clúster de controles derecho; en `by-category` en la fila del título, con las tabs Barra/Línea debajo intactas. En `/mes` desktop va en la **fila del H1** (después del disparador de período); en compacto, en la fila del stepper, tras el `CurrencyChip`.
- [ ] **No aparece en el Dashboard** (widget income-expense efímero).
- [ ] Reposo = glifo tenue sin caja; hover/abierto = `--panel-2` + `--ink`; focus = ring `--accent-soft` 3px.
- [ ] Abre por **click/tap** (toda plataforma) y —en desktop— **también por hover**; cierra por click-fuera, `Esc`, re-clic y (desktop) mouseleave. **No** hay scrim, **no** hay focus-trap.
- [ ] Contenido agrupado: header **"Marcan un dato"** (pasivos) y —solo en `/mes`— **"Avisan al guardar"** (activos). El grupo Activos **no** aparece en ninguna card de `/reportes`.
- [ ] Cada ítem: nombre (UI 13px `--ink`) + condición (numérico en **mono tabular**, `--muted`). Refinamiento de categoría lleva punto de color 6px + nombre de categoría.
- [ ] Límites `enabled: false` **listados**, a `opacity-60` + etiqueta **"Desactivado"** (`--faint`) — atenuación **y** texto, no solo color.
- [ ] Límites pasivos `temporalScope: "current"` llevan qualifier **"Solo mes en curso"** (`--faint`); los `all` no llevan nada; los activos nunca lo llevan.
- [ ] **Cero ámbar** en todo el popover; **cero** income/expense; índigo solo en el focus ring.
- [ ] ≥640px (sidebar abierto/cerrado): popover **no cortado**, clampeado a 12px del borde, flipea arriba si falta lugar; con muchos ítems scrollea **dentro del popover** sin scroll horizontal del `body`.

> **Señal de documentación (para el analista):** el copy de los headers de grupo ("Marcan un dato" / "Avisan al guardar"), el caption ("Límites de este reporte" / "…de esta vista"), "Desactivado" y "Solo mes en curso" son traducciones de diseño vigentes en la UI (`limits-info-popover.tsx`); el analista los espeja en `screens.md` / `requirements.md`.
