# Marcas de límite en `by-category` — el cartucho de mes

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Vocabulario de efectos y mapeo: `limites.md` *Marca visual pasiva de límites*. Convivencia con simulados: `simulados-en-cards.md`.

## Marcas de límite en `by-category` — el cartucho de mes

> **Portador** de las marcas pasivas de límite en la card **"Gastos por categoría"** (`/reportes`), en sus **dos modos** (Barra y Línea). Extiende *Marca visual pasiva de límites* y se articula con *Movimientos simulados en cards de reporte (RF-REP-017)*. **No** cambia el catálogo de efectos (RF-LIM-001) ni la regla de desempate (RF-LIM-003): define **dónde se dibuja** la marca y **qué subset ofrece** cada anclaje de esta card.

### 1. Qué se corrige y con qué criterio

**Problema A — una marca que se evalúa bien y no tiene dónde dibujarse.** Colgar la marca de `reporte.cat.gastoMesTotal` de la **última banda del stack** la ataría a la categoría más chica del año (el orden de apilado es mayor → menor): en un mes donde esa categoría no aporta, el portador mide ~0px y la marca **no se ve**. Un aviso que no llega es el peor defecto de *feedback*.

**Problema B — efectos ofrecidos que no se entregan.** Una banda apilada no tiene etiqueta de monto donde colgar un glifo ni un badge; ofrecerlos en Configuración y entregar siempre el mismo contorno enseña que la configuración no sirve. La respuesta es **ofrecer solo lo que se cumple**.

**Criterio rector:** *el portador de una marca no puede depender del valor que la marca observa.*

### 2. El portador — **cartucho de mes** en el carril del eje X

La marca del **total del mes** se dibuja en el **rótulo del mes del eje X** (`Ene`…`Dic`): (a) **existe siempre**; (b) **tiene exactamente el alcance del anclaje** (el mes completo); (c) es **idéntico en modo Barra y en modo Línea**; (d) es **texto**, así que aloja las tres primitivas del subset.

#### 2.1 Geometría y ubicación

- **Carril:** la banda del eje X (`XAxis`, alto 30px), la misma en ambos modos. El cartucho se dibuja **dentro** de esa banda.
- **No cambia nada del canvas:** ni `margin`, ni alto (260 amplio / 220 compacto), ni el `width: 64` del eje Y, ni la leyenda.
- **Centro horizontal:** el tick del mes. **En los meses extremos el cartucho se ancla al tick por su borde interior y crece hacia adentro:** `Ene` apoya su **borde izquierdo** en el tick, `Dic` su **borde derecho**; los diez intermedios se centran. Mismo **clamp en los bordes** que los popovers. Centrado en los extremos excedería el área de trazado (se corta en Línea, aporta ancho al `body`) o pisaría el rótulo vecino.
- **Centro vertical:** la línea media del rótulo.
- **Mes sin marca:** el tick es el estándar (12px/500 `--muted`, `--ui`). Ningún nodo extra, `<rect>` ni `<title>`.

#### 2.2 Los tres efectos, de verdad distintos

Ordenados quiet → fuerte, **en el orden de la regla de desempate** (`glyph` < `badge` < `ring`):

| Efecto | Forma | Detalle |
|---|---|---|
| **`glyph`** *(default)* | `AlertTriangle` **12px** `--warning-ink` a la **izquierda** del rótulo, gap **4px**. El rótulo **no cambia** (12px/500 `--muted`). | El cluster `[glifo · rótulo]` se **centra como unidad** en el tick: se corre el rótulo del **mes marcado**, nunca los de sus vecinos. Registro quiet, correcto para el default. |
| **`badge`** | El rótulo se sirve como **chip ámbar**: fondo `--warning-soft`, radio `--r-chip` (7px), padding **1px 7px**, `AlertTriangle` **11px** + **el nombre del mes** en 11px/600 `.04em`, todo en `--warning-ink`. Chip centrado en el tick. | Molde de `LimitBadge`, con **el mes como texto del badge** en lugar de "Límite". El texto es el portador no-color. |
| **`ring`** | **El chip del `badge` + anillo `--warning` 1.5px** sobre su mismo radio. | `ring ⊃ badge` es deliberado: la regla de desempate pone `ring` **por encima** de `badge`, así que no puede leerse más quiet. Satisface *"`ring` nunca va solo"*. **Trade-off:** badge y ring se parecen entre sí; se acepta por la monotonía del desempate. |

#### 2.3 Qué **no** es el cartucho (alternativas descartadas)

- **No es un anillo alrededor de la columna apilada del mes** (no existe en Línea; en Barra mide cero sin gasto; compite con el contorno de una banda marcada).
- **No es un marcador en el tope del stack** (ahí vive la marca de `gastoMesCategoria` de la última banda).
- **No es una banda de fondo del mes** (`fill` no está en el subset; competiría con los colores de categoría y con el cursor de hover).
- **Costo asumido:** el cartucho no dice *por cuánto* se cruzó; el límite es binario, la magnitud la dan el eje Y y el tooltip.

### 3. La banda de categoría — subset restringido a `ring`, con rescate

`reporte.cat.gastoMesCategoria` **conserva su portador natural** (la banda de esa categoría en ese mes), pero:

- **Ofrece un solo efecto: `ring`.** La banda no tiene etiqueta y su alto lo fija el valor. Configuración lo presenta como **línea informativa** (`limites.md` *Panel de gestión* §4, "subset de un solo efecto").
  - **Modo Barra:** contorno `--warning` 2px en el perímetro de la celda (sobre banda simulada, mantiene el punteado `4 3` — RF-REP-017 §3).
  - **Modo Línea:** anillo `--warning` 1.5px, `r=5.5`, en el vértice del **borde superior** de esa banda.
- **Rescate — ninguna marca evaluada queda sin portador.** Si la banda **no existe** ese mes (aporte 0, alcanzable con `<` / `≤` / `=`), la marca **escala al cartucho del mes**. Semántica del cartucho: *"este mes tiene al menos un límite cruzado; el texto dice cuáles"*.

### 4. Un cartucho por mes — fusión y desempate

- Un mes marcado tiene **un solo cartucho**. Varias marcas se **fusionan con la regla de desempate**: gana **la más fuerte** y el **texto accesible enumera todas**.
- La marca de una banda **que existe** vive en la banda y **no** enciende cartucho: *"ámbar dentro del gráfico = una categoría; ámbar en el eje = el mes"*.

### 5. Ortogonalidad con RF-REP-017 (simulados)

| Dimensión | Propiedad que la porta | En el cartucho |
|---|---|---|
| Real vs. simulado | relleno hueco + patrón punteado, **solo dentro del área de trazado** | **nunca** aparece |
| Límite cruzado | color ámbar `--warning` | **siempre** sólido |

- El cartucho vive **fuera del área de trazado**; lo simulado, **solo dentro**. Ambigüedad imposible por construcción.
- **El cartucho nunca puntea, nunca se ahueca y nunca cambia de forma** con el chip "Simulados". El toggle solo cambia **el valor evaluado** y por lo tanto **en qué meses** aparece.
- **Barra simulada y marcada:** lleva **una sola** marca (la suya, de categoría), con contorno ámbar + punteado `4 3` + relleno hueco.

### 6. Accesibilidad

- **Nunca solo color:** los tres efectos portan **forma** (el triángulo) y dos además **texto**.
- **Texto accesible:** el `<g>` del cartucho lleva `role="img"` + `aria-label` con la **enumeración de los límites cruzados** (`describeLimitMark`) y un `<title>` hijo.
- **El tooltip del chart sigue siendo el portador completo** (`warningNote`).
- **Contraste:** `--warning-ink` sobre `--warning-soft` y sobre la card; par claro/oscuro.
- **No es un control:** no le aplica el mínimo de ~44px.

### 7. Contención responsive (obligatoria)

Umbral `--bp-wide` **941px**, sobre el **ancho de contenido** (`<main>`). Todo el régimen de app (`≥ 600px` en ambos ejes).

- **Degradación declarada en compacto:** por debajo del umbral, **los tres efectos se sirven en la forma quiet** (`AlertTriangle` **11px** + rótulo, **sin chip**). A 640px de contenido el slot de un mes mide ~48px (`(640 − 64) / 12`) y el chip ~49px. **Se degrada la forma, nunca el hecho de marcar.** Precedente: la banda simulada de <3px que delega en el tooltip (RF-REP-017 §4).
- **Umbral nombrado:** a 941px el slot mide ~73px y el chip entra con holgura; no se introduce un segundo umbral.
- **El cartucho no fuerza ancho ni alto.**
- **Solape en anchos extremos, declarado:** con sidebar abierto a 640px (~392px de contenido) el slot mide ~27px y los 12 rótulos ya se rozan (`interval={0}`). El cartucho quiet puede rozar al vecino: **solape dentro del SVG, no desbordamiento**. Se acepta.
- **Los cuatro invariantes:**
  1. *Sin scroll horizontal del `body`:* dentro del `ResponsiveContainer`, sin ancho mínimo propio.
  2. *Modales completos:* no introduce modal, popover ni overlay.
  3. *Ninguna acción inalcanzable:* no es accionable ni tapa controles; el tooltip sigue alcanzable.
  4. *Superficies anchas:* el canvas escala dentro de la card; la leyenda conserva su scroll interno.
- **Checkpoints obligatorios:** `640px` sidebar cerrado, `640px` sidebar abierto (392px de contenido), `941px` cerrado, `1288px` cerrado.

### 8. Alcance — qué cubre esta spec y qué se verificó que no aplica

**Cubre:** las **dos** keys de `by-category` (`reporte.cat.gastoMesTotal` y `reporte.cat.gastoMesCategoria`), en **Barra y Línea**, en `/reportes`. `by-category` **no se monta en el Dashboard**.

**No aplica al resto — verificado anclaje por anclaje** (el problema es exclusivo de `by-category`, única superficie donde un dato no tiene elemento propio de tamaño independiente del valor):

- `reporte.unicos.celda` — celda de tamaño fijo (~19px). `ring`+`dot` se ven siempre.
- `reporte.unicos.*` (footer) — cifras propias, siempre renderizadas.
- `reporte.ie.*` y `reporte.infl.*` — puntos de serie siempre definidos (un 0 se dibuja sobre la base).
- `reporte.cuotas.*` — la barra tiene **etiqueta de monto propia** y su ancho lo fija el **período**.
- `mes.*` — filas y cifras siempre presentes.

### 9. Agregados más allá del brief — estado

- **Restringir `reporte.cat.gastoMesCategoria` a `ring` (§3)** — vigente; cambia lo que Configuración ofrece.
- **Rescate al cartucho de una marca sin geometría (§3)** — vigente.
- **Regla de panel para subsets de un solo efecto** (línea informativa en vez de `radiogroup` de un ítem) — vigente; vive en `limites.md` §4.
- **El texto del `badge` es el nombre del mes**, no "Límite" — vigente.
- Nada más: sin leyenda de límites, contador de marcas, renglón nuevo en el tooltip ni cifra en el eje.

### 10. Reglas duras reafirmadas

- **Regla dura 1:** el cartucho es **ámbar**; no toca bandas ni montos. El rojo de la card sigue **solo** en el contorno del stack (Línea) y en el "Total gastos" del tooltip.
- **Regla dura 2:** sin índigo; el cursor `--accent-soft` vive **dentro** del área de trazado, el cartucho fuera.
- **Regla dura 3:** el cartucho **no muestra ninguna cifra**; el mes es texto UI.
- **Regla dura 4:** solo tokens `warning`, con par.
- **Cero-impacto con `limits: []`:** el eje X es el estándar carácter por carácter; ningún nodo, clase ni `<title>`; `margin`, alto del canvas y `width` del eje Y no cambian.

### Checklist de aceptación visual — Marcas de límite en `by-category`

> Insumo directo del QA visual per-feature (skill `qa-visual`, `.claude/skills/qa-visual/SKILL.md`). Escenario recomendado: un año con **al menos 4 categorías de gasto** donde la **categoría de menor gasto anual** tenga **cero** en algún mes que sí cruce el umbral del total (caso testigo), y límites creados de a uno para probar cada efecto.

*Cero-impacto:*
- [ ] Con **`limits: []`**: los 12 rótulos del eje X de `by-category` (Barra y Línea) son los estándar (12px/500 `--muted`), sin ningún nodo ámbar; el alto del canvas, el eje Y y la posición de la leyenda no cambian.

*El portador siempre presente:*
- [ ] Límite pasivo **"Total de gasto apilado del mes > X"** con efecto **Glifo**: en cada mes cuyo total cruza aparece un `AlertTriangle` ámbar **12px** a la izquierda del nombre del mes, **en el carril del eje X**.
- [ ] **Caso testigo:** en un mes marcado donde la **categoría más chica del apilado no tiene gasto**, la marca se ve **igual de nítida** que en un mes donde todas aportan.
- [ ] El **mismo** límite en **modo Línea** produce **exactamente** el mismo cartucho, en el mismo lugar y con la misma forma. Alternar **Barra ↔ Línea** no cambia la marca.

*Los tres efectos, diferenciados:*
- [ ] Efecto **Badge**: el nombre del mes se sirve como **chip ámbar** (fondo `--warning-soft`, texto `--warning-ink` 11px/600, radio 7px) con el triángulo 11px adentro. El chip **dice el nombre del mes**, no la palabra "Límite".
- [ ] Efecto **Ring**: el **mismo chip del badge con un anillo ámbar 1.5px** alrededor. Se distingue a simple vista del badge y se lee **más fuerte**, nunca más débil.
- [ ] Con el mismo umbral, los **tres efectos se ven distintos entre sí**.
- [ ] Ninguno de los tres pinta **contorno ámbar sobre ninguna banda** del apilado cuando el límite es el del **total**.

*Límite por categoría:*
- [ ] En Configuración, la key **"Gasto de una categoría en un mes"** ofrece **un solo efecto (Ring)**, presentado como **línea informativa con preview**, no como grupo de opciones. No aparecen Glifo ni Badge.
- [ ] Ese límite pinta **contorno ámbar** sobre la banda de esa categoría (Barra) / **anillo ámbar en el vértice** de su borde superior (Línea), y **no enciende cartucho** en los meses donde la banda existe.
- [ ] Con un límite de categoría del tipo **`< X`** en un mes donde esa categoría **no tiene gasto**: ese mes **enciende cartucho** y el texto nombra ese límite. **Ningún límite cruzado queda sin señal visible.**

*Fusión:*
- [ ] Dos límites cruzando el mismo mes con efectos distintos (p. ej. Glifo y Ring sobre el total): se ve **un solo cartucho**, en la forma **Ring** (la más fuerte), y su texto **enumera los dos**.
- [ ] Nunca hay dos cartuchos en el mismo mes.

*Convivencia con Simulados (RF-REP-017):*
- [ ] Con el chip **Simulados encendido**, el cartucho es **ámbar sólido**: nunca punteado, nunca hueco. Su forma es la misma que con el toggle apagado; lo único que puede cambiar es **en qué meses** aparece.
- [ ] Con el toggle encendido, la **capa simulada de la última categoría** **no** lleva contorno ámbar por el límite del **total**. Si lleva contorno ámbar es por **su propio** límite de categoría, y entonces mantiene el punteado `4 3` y el relleno hueco.
- [ ] **Nada de lo simulado es ámbar** y **nada del límite es punteado**.

*a11y y estados:*
- [ ] Hover sobre el cartucho: **tooltip nativo** con la enumeración de los límites cruzados. Hover sobre la columna del mes: el tooltip del chart sigue mostrando su `warningNote`.
- [ ] El cartucho **no muestra ninguna cifra** (ni umbral ni total).
- [ ] Los rótulos de los **meses vecinos no se mueven** al marcarse un mes; la **leyenda no se desplaza** (comparar con y sin marcas).
- [ ] `prefers-reduced-motion`: el cartucho aparece **sin animación propia** (no crece, no pulsa).
- [ ] En **oscuro**, los tres efectos se leen igual y el chip mantiene contraste sobre el fondo de la card.

*Contención:*
- [ ] **< 941px de ancho de contenido:** los tres efectos se sirven en la forma **quiet** (triángulo 11px + rótulo, **sin chip**); el mes marcado se sigue distinguiendo y el tooltip sigue enumerando.
- [ ] **640px, sidebar cerrado y abierto (392px de contenido):** sin **scroll horizontal del `body`**; nada se sale de la card; los rótulos del eje pueden rozarse (condición vigente de la card), pero ningún elemento empuja al layout.
- [ ] **941px y 1288px, sidebar cerrado:** el chip de `badge`/`ring` entra en el slot del mes **sin tocar el del mes vecino**.
- [ ] **Meses extremos (`Ene` y `Dic`) marcados**, en Barra y en Línea y en los cuatro checkpoints: el cartucho queda **entero dentro del área de trazado** (no se corta ni asoma fuera de la card), **no dispara scroll horizontal del `body`**, y **no se superpone con el rótulo del mes vecino** (`Feb` / `Nov`). Verificar con el efecto más ancho (**Ring**) en ancho amplio y con la forma quiet en compacto.
