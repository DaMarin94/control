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

## Paleta de colores para categorías — REABIERTO y RESUELTO (Fase 1.1.2, 2026-06-16)

> **Reabre la decisión de v1.0** (color de categoría no editable, pool fijo de 10 como única fuente). A partir de la Fase 1.1.2 el usuario **elige y edita** el color de una categoría —tanto al crear como al editar— desde una **matriz de colores tipo Office** (sin entrada de hex libre). La sección anterior ("color no editable, pool fijo es la fuente") queda **superada** por esta. El pool de 10 de `backend/src/categories/color-pool.ts` **no desaparece**: pasa a ser **una fila identificable de la matriz** (la fila base), para back-compat de las categorías ya pintadas.

### Regla dura que se mantiene

El color de categoría sigue siendo **solo un identificador de categoría** (swatch en la lista, bandas del apilado de la Forma 2 del gráfico, swatch en leyendas). **Nunca** tiñe un monto ni comunica ingreso/gasto — eso lo siguen haciendo income/expense (regla dura 1). La matriz fue construida para **no chocar** con los semánticos ni con la marca: ningún hex de la matriz es el verde income (`#1f8a5b`), el rojo expense (`#c64637`) ni el índigo de acento.

### La matriz — fuente de verdad compartida (10 base × 7 tonalidades)

La matriz es la **única fuente de verdad** del set de colores elegibles: el backend la usa para **validar** que el color recibido pertenezca a la matriz, y el frontend para **renderizar** el picker. Cualquier hex fuera de esta lista es inválido.

- **Estructura:** 7 **filas** (T1 = más clara, arriba → T7 = más oscura, abajo) × 10 **columnas** (un hue por columna, en el **mismo orden del pool actual**: azul, naranja, verde, violeta, amarillo, turquesa, rosa, azul grisáceo, marrón, verde menta).
- **Fila base = pool actual:** la fila **T4** es **exactamente** el pool de 10 colores vigente de `color-pool.ts`, en su orden original. Es la fila "media" de cada columna y la que hace back-compat: una categoría ya pintada con un color del pool cae sobre un swatch de T4, que el picker resalta como seleccionado.
- **Total:** 70 swatches. Todos los hex son explícitos abajo (no se derivan en runtime: esta tabla **es** la fuente).
- **Cálculo del "menos usado" (default al crear):** se mantiene tal cual hoy — sobre los **10 colores base de la fila T4** (no sobre los 70). El sistema preselecciona el color base menos usado entre las categorías activas; el usuario puede cambiarlo a cualquiera de los 70.

**Orden de columnas (índice → hue, idéntico a `color-pool.ts`):**

| Col | Hue |
|---|---|
| C1 | azul |
| C2 | naranja |
| C3 | verde |
| C4 | violeta |
| C5 | amarillo |
| C6 | turquesa |
| C7 | rosa |
| C8 | azul grisáceo |
| C9 | marrón |
| C10 | verde menta |

**Matriz de hex (filas T1→T7 de claro a oscuro; T4 es el pool actual, resaltada):**

| Fila | C1 azul | C2 naranja | C3 verde | C4 violeta | C5 amarillo | C6 turquesa | C7 rosa | C8 azul gris | C9 marrón | C10 v. menta |
|---|---|---|---|---|---|---|---|---|---|---|
| **T1** | `#DCE7F4` | `#F8E2D7` | `#E0F1DE` | `#ECE4F6` | `#FBF3D1` | `#D8F0ED` | `#F8DEE7` | `#E3E8F0` | `#F0E0CD` | `#DDF1E8` |
| **T2** | `#B6CDE9` | `#F1C4AE` | `#C2E4BF` | `#D6C6ED` | `#F6E6A6` | `#B2E2DB` | `#F1BDCC` | `#C8D1E1` | `#E2C19C` | `#BCE4D2` |
| **T3** | `#84A9D6` | `#E89E78` | `#97D08F` | `#BFA4E1` | `#EFD56F` | `#83D2C7` | `#E893AB` | `#A9B6CD` | `#D29F66` | `#9BD5B8` |
| **T4** | `#4F86C6` | `#E07B54` | `#6DBF67` | `#A98BD6` | `#E8C84A` | `#5BC4B8` | `#E06B8B` | `#8B9DBF` | `#C47D3E` | `#7DBF9E` |
| **T5** | `#3E6BA3` | `#BC6241` | `#54A04E` | `#8A6BB8` | `#C2A52E` | `#46A096` | `#BD5572` | `#71819F` | `#A2632C` | `#629E81` |
| **T6** | `#2E5079` | `#8E4A30` | `#3E7739` | `#674F89` | `#917B1F` | `#33766F` | `#8C3F55` | `#546077` | `#794927` | `#497660` |
| **T7** | `#1F3551` | `#5F311F` | `#284E25` | `#443458` | `#5F5113` | `#214E49` | `#5D2A39` | `#383F4F` | `#502F19` | `#304E40` |

**Lista canónica ordenada (para backend/frontend) — recorrido por filas, de T1 a T7, cada fila C1→C10:**

```
T1: #DCE7F4 #F8E2D7 #E0F1DE #ECE4F6 #FBF3D1 #D8F0ED #F8DEE7 #E3E8F0 #F0E0CD #DDF1E8
T2: #B6CDE9 #F1C4AE #C2E4BF #D6C6ED #F6E6A6 #B2E2DB #F1BDCC #C8D1E1 #E2C19C #BCE4D2
T3: #84A9D6 #E89E78 #97D08F #BFA4E1 #EFD56F #83D2C7 #E893AB #A9B6CD #D29F66 #9BD5B8
T4: #4F86C6 #E07B54 #6DBF67 #A98BD6 #E8C84A #5BC4B8 #E06B8B #8B9DBF #C47D3E #7DBF9E   ← pool actual (back-compat)
T5: #3E6BA3 #BC6241 #54A04E #8A6BB8 #C2A52E #46A096 #BD5572 #71819F #A2632C #629E81
T6: #2E5079 #8E4A30 #3E7739 #674F89 #917B1F #33766F #8C3F55 #546077 #794927 #497660
T7: #1F3551 #5F311F #284E25 #443458 #5F5113 #214E49 #5D2A39 #383F4F #502F19 #304E40
```

Notas de construcción (para entender la matriz, no son reglas que el código deba recalcular):
- Cada columna conserva el **hue del color base de T4**; lo que varía por fila es la claridad (y un leve ajuste de saturación: las T1–T2 son pasteles desaturados; las T6–T7, profundas). Esto da el patrón de "una familia por columna" típico de un picker tipo Office.
- Las filas claras (T1–T3) son aptas como fondo de chip; las oscuras (T6–T7) garantizan contraste para swatches sobre panel blanco. Todas se usan **igual** como color de categoría (identificador), sin que la fila implique semántica.
- Verde income y rojo expense quedan fuera de la matriz por construcción; los verdes (C3, C10) y el rojo/rosa (C7) de la matriz son hues claramente distintos de los semánticos.

---

## Picker de color de categoría — spec visual (Fase 1.1.2, 2026-06-16)

> Spec del selector de color dentro del modal de categoría (`category-form-modal.tsx`, RF-CAT-002 / RF-CAT-003). Mismo picker en **crear** y **editar**. Reemplaza la "nota de color de solo lectura" que hoy aparece solo en editar, y agrega el color al modo crear (hoy ausente). No introduce tokens nuevos: todo se resuelve con los tokens/patrones vigentes del DS "Precise Ledger". El modal mantiene su `max-width` 380px, radio 18px, `shadow-lg`.

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
