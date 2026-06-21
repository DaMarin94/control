# Guía de diseño — Control

> Guía **viva** del lenguaje visual de Control. Es la versión **curada y vigente** de cómo se ve el producto: la fuente de verdad de las decisiones visuales que `control-design` mantiene y que `control-frontend` implementa.
>
> **Relación con los otros documentos de diseño:**
> - **`docs/design/`** — handoff crudo "Precise Ledger" (`control.css` + `README.md`): el material de origen del prototipo, con todos los valores y la racional. Es la referencia de donde sale esta guía; no se edita.
> - **`docs/design/specs-archive.md`** — **archivo histórico** de las specs visuales puntuales de cada fase ya implementada (picker de color, gráfico anual, fijos extendidos, flechas de navegación, secciones de `/mes`, reportes configurables). Conserva el **detalle verbatim** de cada spec para trazabilidad. El **lenguaje vivo y reutilizable** que salió de esas fases vive acá; el detalle de la spec puntual vive en el archivo.
> - **`docs/frontend.md`** (secciones Design system) — cómo los tokens están **implementados** en el código (Tailwind v4, dualidad `@theme`/`:root`, qué está portado). El "cómo" técnico.
> - **`docs/design.md`** (este documento) — el "qué" visual vigente: paleta, tipografía, espaciado, geometría, jerarquía, los **patrones de componentes vigentes** y las reglas duras. Ante un conflicto con el handoff crudo o con una spec archivada, prevalece lo cerrado acá.
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

**El color de un monto lo da el TIPO (ingreso/gasto), no el signo del valor.** Desde la Fase 1.1.7 existen montos **negativos o cero** (solo en movimientos calculados, RN-018). El signo se comunica con el **prefijo `−`** (signo menos `U+2212`) delante de la cifra (`−$1.234,56`); el cero es `$0,00`. **Nunca** se recolorea un monto por ser negativo: un gasto con monto negativo sigue en color de gasto. Recolorear por signo rompería la regla dura 1.

**Tipo derivado del signo (movimientos calculados, RF-MCALC-003).** En el **calculado**, el tipo **no se elige**: se **deriva del signo del monto final** — positivo → **Ingreso** (verde), negativo → **Gasto** (rojo), cero → **Gasto** (convención de borde). Por eso el form del calculado **no tiene control "Tipo"**: el tipo se **comunica como lectura** dentro del bloque "Resultado" (cifra con su color por tipo + **badge de tipo** tintado: "Gasto" `--expense-ink`/`--expense-soft`, "Ingreso" `--income-ink`/`--income-soft`), recalculado en vivo. El **control de signo** se mantiene **neutro** (segmented sin color semántico): el verde/rojo va sobre la **lectura del tipo** (cifra + badge), nunca sobre el control. Esto es consistente con la regla anterior — el color sigue al tipo, y en el calculado el tipo sigue al signo.

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

## Patrones de componentes vigentes

> Patrones de componente **reutilizables y vigentes** que nacieron en specs de fase y pasaron a ser parte del lenguaje visual del producto. Acá viven en **forma resumida** (el patrón canónico, sus valores clave y sus reglas vigentes). El **detalle completo** de cómo se cerró cada uno —racional, alternativas evaluadas, responsive fino, casos límite— vive **verbatim** en `docs/design/specs-archive.md`, enlazado en cada patrón. Ante un conflicto, **prevalece lo de acá**.
>
> Los **gráficos** (Forma 1 — área de ingresos vs. gastos; Forma 2 — barras apiladas por categoría), con sus ejes, gridlines, leyenda, tooltip, altos de canvas y mapeos de color, **siguen vigentes tal cual** se definieron en la spec del gráfico anual: ver *Gráfico anual — spec visual del widget* en el archivo. No se reproducen acá porque no cambiaron; el encuadre que los rodea (cómo se montan en pantalla) es lo que evolucionó y se resume abajo.

### PeriodNav — navegación de período (flechas gigantes laterales + modo `.stepper`)

Patrón **genérico** para navegar un período (mes o año): `‹ contenido ›`, donde **‹ va al período anterior y › al siguiente**. Recibe un rótulo de período ya formateado, handlers anterior/siguiente y dos flags `canGoPrev` / `canGoNext`. **Mismo componente, distinto período.** Tiene **dos formas**:

- **Forma lateral (canónica, a ancho de página):** layout de **3 columnas** `[ ‹ ] [ contenido ] [ › ]` (`grid-template-columns: auto minmax(0, 1120px) auto`, `mx-auto`), con las flechas en columnas propias que flanquean el contenido (simetría del **contenido**, no del viewport). Cada flecha: `button` circular **64×64px**, glifo `ChevronLeft`/`ChevronRight` (lucide) **46px** `stroke-width 1.75`, **sin fill** en reposo, glifo `--faint`. Aire flecha↔contenido 20px. **Vigente en `/mes`** (período = mes; flags siempre `true`) y en **reportes** (mismo patrón).
  - **Centrado vertical de las flechas (revisión Fase 1.2.0):** la flecha está **centrada verticalmente en el VIEWPORT**, siempre, sin importar el largo del listado. Es la posición que tenía al scrollear listas largas (centro del viewport, fija al scrollear): esa posición es la **deseada** y debe valer también con listas cortas. La flecha **permanece anclada al centro del viewport** mientras se hace scroll y con cualquier cantidad de contenido. **No se deroga el centrado al viewport**; se lo hace **robusto para todo largo de contenido**.
  - **Listas largas vs. cortas:** en ambos casos la flecha queda en el **centro vertical del viewport**. Con listas largas ya funcionaba (el anclaje al viewport tenía recorrido). El caso que se corrige es el de **listas cortas**: cuando el contenido es más bajo que el viewport, la celda lateral —que se estira al alto del contenido— quedaba más corta que el viewport y el anclaje no tenía recorrido para llegar al centro, dejando la flecha pegada arriba. La especificación es que el centrado al centro del viewport **aplique igual con listas cortas**. El mecanismo técnico exacto lo resuelve control-frontend (p. ej. garantizar que el área de las celdas laterales tenga alto suficiente —`min-height` del viewport— para que el anclaje pueda centrar, o un anclaje fijo al viewport); el **comportamiento visual a cumplir** es: flecha centrada verticalmente en el viewport, constante al scrollear, con cualquier cantidad de contenido.
- **Forma compacta (`.stepper` pill):** el **modo de colapso** del mismo patrón, también usado **embebido** cuando no hay lugar para flechas laterales (cards apiladas, mobile). Pill `.stepper` del DS: `--r-pill`, `--panel`, borde `--line`, `--shadow-sm`, padding 4px; dos botones circulares **32px** (chevron-left/right, glifo 18px, `--ink-2` → `--ink` sobre `--panel-2` en hover) y, al centro, el rótulo del período (si es número → **mono tabular**, regla dura 3). **Vigente como control de año embebido per-card** en `/reportes` y en el Dashboard (ver *card de reporte* abajo).

**Estados de la flecha/chevron (comunes a ambas formas):**

- **Reposo:** glifo `--faint` (lateral) / `--ink-2` (stepper), `cursor: pointer`.
- **Hover:** glifo a `--ink`; en la forma lateral aparece un fondo circular `--panel-2`; en el `.stepper`, fondo `--panel-2` en el botón. Transición 0.14s.
- **Active:** fondo `--panel-3`.
- **Focus (teclado):** ring `--accent-soft` 3px (`focus-visible`).
- **Disabled (`canGoPrev`/`canGoNext` = false):** glifo `--faint` con `opacity: 0.4`, sin hover, `cursor: default`, `aria-disabled`. **No se oculta** — presente pero apagado. Es el estado que usan los límites de navegación de año (`earliestYear` / año en curso).

`aria-label` según el período: "Mes anterior/siguiente" (mes) o "Año anterior/siguiente" (año).

**Responsive (forma lateral):** dos regímenes. **≥941px (con lugar):** flechas laterales simétricas que se encogen parejo al angostar. **≤940px (sidebar oculta):** colapsa a la forma compacta `.stepper` en el header. **No existe** un modo intermedio de "flechas con fondo pegadas al borde".

**Movimiento:** hover 0.14s; el cambio de período dispara el re-render de la vista (entrada de pantalla 0.32s); las flechas no animan posición — permanecen ancladas al centro del viewport mientras se scrollea (sin desplazamiento visible). Respeta `prefers-reduced-motion`.

> Detalle verbatim: *Navegación de período — flechas gigantes laterales (Fase 1.1.3)* y *Reportes configurables → A.1. Control de año embebido per-card (Fase 1.1.5)* en `docs/design/specs-archive.md`. El centrado vertical de las flechas fue **revisado en Fase 1.2.0**: se mantiene el centrado al **centro del viewport** (fijo al scrollear) y se lo hace **robusto para listas cortas** (que antes dejaban la flecha pegada arriba por falta de recorrido del anclaje); prevalece lo descrito arriba.

### Acordeón — sección colapsable + reordenable

Patrón **genérico reutilizable** de "sección de acordeón" = **cabecera (`.ghead`) + cuerpo (tarjeta-lista)**, que se colapsa/expande individualmente y se reordena entre pares por drag. Vigente en `/mes` (Únicos / Fijos / Cuotas), instanciable N veces en otras pantallas. **Construido SOBRE el look existente de la `.ghead`**, sin reemplazarlo.

**Cabecera colapsable (disclosure):**

- Toda la `.ghead` es el control que colapsa/expande su cuerpo (un único `button`, `aria-expanded` + `aria-controls`). Sigue siendo la misma fila "al aire" (sin caja).
- **Chevron:** `ChevronRight` (lucide) **16px** `stroke-width 2`, **primer elemento** de la fila, `--muted` en reposo. Un único glifo que **rota**: **expandida** → apunta ▼ (90°); **colapsada** → apunta ▶ (0°).
- **Estados:** *reposo* = `.ghead` de hoy + chevron `--muted`. *Hover* (sobrio, sin fondo en la fila): chevron → `--ink-2`, rótulo → `--ink`, transición 0.14s. *Focus*: ring `--accent-soft` 3px con radio `--r-chip` 7px.
- **Resumen visible al colapsar:** el pill contador y el subtotal mono **permanecen visibles** colapsados (es la info de resumen de un vistazo). Solo se oculta el cuerpo y el chevron rota a ▶.

**Animación:** altura del cuerpo 0↔auto (con `overflow: hidden`) + fade + rotación del chevron, **0.22s ease-out**. Respeta `prefers-reduced-motion` (instantáneo).

**Sección vacía:** las secciones se renderizan **siempre** (también vacías). Cabecera completa con contador `0` y subtotal en cero. Cuerpo (expandido): caja `rounded-card border border-dashed border-line bg-panel-2`, padding `px-6 py-6`, una línea centrada *Meta/subtítulos* (12.5–13px, `--muted`). El borde **dashed** = "acá todavía no hay nada".

**Modo orden (reordenar secciones, no ítems):** acción deliberada vía un **modo explícito**, no handles permanentes. **Conducta revisada en Fase 1.2.0** (colapso transitorio al entrar + drag in-place sin overlay flotante); prevalece lo descrito acá sobre el detalle archivado de 1.1.4.

- **Disparador:** botón ghost del DS en el `.phead`, ícono `ArrowUpDown` 15px, "Ordenar secciones". Al entrar se transforma en **"Listo"** (primario índigo); "+ Nuevo movimiento" se deshabilita mientras dura el modo. El botón **"Listo" (primario índigo) es la única señal de "modo edición activo"** — no se agrega chrome adicional (ni banner, ni borde de página).
- **Colapso transitorio al entrar (Fase 1.2.0):** al **entrar** en modo orden **todas las secciones se colapsan** — se reordenan solo las **cabeceras** (`.ghead`), nunca los cuerpos expandidos. Es la lista limpia de cabeceras: una debajo de otra, cada una con su handle + chevron (en ▶, colapsado) + rótulo + pill contador + línea + subtotal, sin cuerpo visible. Este colapso es **puramente visual y transitorio**: **no** se persiste ni pisa la preferencia de colapso del usuario. Al **salir** del modo (botón "Listo") se **restaura exactamente el estado de colapso previo** que el usuario tenía antes de entrar (las que estaban expandidas vuelven a expandirse). La animación de colapso/expansión usa la misma transición del acordeón (0.22s ease-out; instantánea con `prefers-reduced-motion`).
- **Handle:** `GripVertical` (lucide) 16px `--muted` a la izquierda del chevron, `cursor: grab`/`grabbing`. Motor: **dnd-kit**. Durante el modo, la cabecera **no** colapsa al clic (está dedicada a arrastrar; el chevron se ve, ahora siempre en ▶ por el colapso transitorio, pero no es accionable).
- **Drag in-place — el ítem NO flota (Fase 1.2.0):** la cabecera arrastrada **no se despega del contenedor** ni sigue libremente al mouse. Se **desliza únicamente en el eje vertical dentro del box de la lista** (transform de traslación Y, sin overlay flotante). **Se elimina el `DragOverlay`**: no hay un clon que flote y el original deja de ocultarse (queda derogada la conducta de 1.1.4 de "el original se vuelve invisible y un overlay lo reemplaza"). El feedback de "ítem activo" se aplica **sobre la propia cabecera** mientras se desliza:
  - **Ítem activo (la cabecera que se arrastra):** elevación `--shadow-md`, fondo `--panel` (sale del "al aire" y toma una superficie para leerse elevado sobre las demás), radio `--r-ctl` 10px, **sin** `scale` (al moverse in-place, escalar lo despegaría visualmente; el ancho se mantiene 1:1 con la columna). Opacidad plena (`opacity: 1`) — ya no se atenúa porque no hay clon que lo represente. `cursor: grabbing`.
  - **Las demás cabeceras:** opacidad plena, se **desplazan suave** (transición 0.14–0.22s) para abrir el hueco mientras el ítem activo pasa por su posición. No se atenúan.
  - **Indicación del destino:** el desplazamiento de las demás cabeceras (que abren el hueco donde caerá el ítem) **es** la indicación de inserción; al moverse in-place y a ancho completo, no se dibuja una caja-hueco dashed separada (ese tratamiento era del overlay flotante de 1.1.4). El hueco se lee como el espacio que dejan las cabeceras al correrse.
  - **Padding interno del recuadro activo (Fase 1.2.0):** la cabecera "al aire" no tiene padding superior (su fila vive con `px-1 pb-[10px]`, sin `pt`), pensada para el ritmo entre secciones (`space-y-[30px]`) — correcto en reposo. Al volverse recuadro elevado (`--panel` + `--shadow-md` + `--r-ctl` 10px), ese contenido sin aire arriba queda pegado al borde superior del panel. El recuadro activo lleva un **padding interno propio de `10px` en los cuatro lados** (`var(--space-10)` / `10px`) para que el contenido no toque el borde y quede equilibrado con el radio `--r-ctl` 10px. Este padding **se aplica solo mientras el ítem está activo/arrastrándose** (junto con el fondo/sombra/radio del estado activo), **nunca en reposo** — el espaciado normal entre secciones (`space-y-[30px]`) no cambia. Se aplica en el **wrapper del ítem activo** (no en la cabecera), para no alterar la fila "al aire" en reposo. Como la fila ya trae `pb-[10px]`, el resultado visual abajo es mayor que arriba/lados; eso es **aceptable** (el recuadro se lee equilibrado y centrado); no se compensa restando el `pb` de la cabecera.
- **Salida:** "Listo" vuelve a "Ordenar secciones", **restaura el colapso previo** (ver arriba) y aplica el orden en vivo (sin "cancelar" en v1).

> El **dashed = espacio reservado / para agregar** es lenguaje transversal: se usa en la sección vacía, el hueco de drag del acordeón y el recuadro "[+]" de `/reportes`.
>
> Detalle verbatim: *Vista del mes — secciones colapsables + reordenables (Fase 1.1.4)* en `docs/design/specs-archive.md`.

### Card de reporte — widget de gráfico autónomo

Unidad que `/reportes` apila y que el Dashboard monta una vez. Es la **tarjeta `.card` de gráfico** (panel, `--line`, `--r-card` 14px, `--shadow-sm`, padding `--card-pad` 22px) con **controles embebidos**. Estructura: cabecera (identidad a la izquierda; barra de controles a la derecha) → área de gráfico → leyenda. Altos de canvas vigentes: **300px** (cards de `/reportes`) / **280px** (Dashboard); **220px** en ≤940px.

- **Identidad (izquierda):** eyebrow *Eyebrow/labels* `--muted` **"Reporte"** + título 16px/600 `--ink` ("Ingresos y gastos" / "Por categoría").
- **Control de año embebido:** el `.stepper` de **PeriodNav** (forma compacta, arriba), año en **mono tabular**, con su estado **disabled** atado a `earliestYear` / año en curso. Navegación **activa** también en el Dashboard.
- **Filtro de categorías embebido:** ver *Filtro de categorías* abajo.
- **Quitar card (solo `/reportes`):** botón icon-only ghost `X` (16px), `--muted` → `--ink` sobre `--panel-2`, al final de la barra de controles, separado por un divisor `--hair` vertical. Abre una **confirmación inline** (popover `--panel`/`--line`/`--r-ctl`/`--shadow-lg`, "¿Quitar este reporte?", botón **danger** "Quitar" + ghost "Cancelar"). La card del Dashboard **no** es removible.

**Grilla en `/reportes`:** una sola columna a 1120px, cards separadas por `--gap` (18px); el **"[+]"** (recuadro dashed, ver abajo) siempre al final. Sin reordenar cards en v1.1.

**Recuadro "[+]" para agregar card:** recuadro **placeholder dashed** (`--panel-2`, borde dashed `--line`, `--r-card`, sin sombra), ícono `Plus` en círculo `--panel-3`, label "Agregar reporte". Compacto cuando hay cards (~120px); en versión grande preside el **estado vacío inicial** (~280px alto, ~480px ancho, centrado, "Armá tu primer reporte"). Al activarlo, **popover-menú de 2 opciones** (Ingresos y gastos / Por categoría) ancla la elección de tipo; la card nace en el año en curso con todas las categorías.

**Dashboard:** monta una card `income-expense` efímera con navegación de año activa, junto al resumen mensual (que es fijo en el mes en curso). La distinción la dan: bloques de forma distinta (resumen sin `.card` de gráfico vs. card de gráfico), distinto grano temporal (mes-rótulo fijo vs. año-stepper navegable) y el stepper scoped a la card.

> Esta sección **superó** el encuadre del *Gráfico anual* (control de año compartido en el `.phead`, año mono suelto en el Dashboard, par fijo de dos tarjetas en `/anual`). Las **gráficas** de aquella spec siguen vigentes.
>
> Detalle verbatim: *Reportes configurables — spec visual (Fase 1.1.5)* y, para las gráficas, *Gráfico anual — spec visual del widget* en `docs/design/specs-archive.md`.

### Sidebar de navegación global — padding superior del logo (Fase 1.2.0)

La sidebar (`<aside>`, 248px) tiene padding vertical propio `py-[22px]` (de la escala de espaciado). El **logo** (bloque `<Link>` con el gem "C" + wordmark "Control / Finanzas del mes") es el primer elemento del contenido; debe abrir la columna con un aire superior **consistente** con el resto del espaciado, no pegado arriba.

- **Valor vigente:** el logo lleva `pt` de **`10px`** (era `4px`). Sumado al `py-[22px]` del `<aside>`, da un aire superior total de **32px** (22 + 10) por encima del gem — un valor de la escala (32) que equilibra contra el `pb-[18px]` inferior del logo y el ritmo de la lista de nav que sigue.
- **Dónde se aplica:** se ajusta el **`pt` del `<Link>` del logo** (10px), **no** el `py` del `<aside>`. El `py-[22px]` del `<aside>` es el padding estructural de la columna (vale igual arriba y abajo, y para desktop y drawer mobile) y no se toca; el aire fino del logo es responsabilidad del propio bloque del logo. El `pb-[18px]` del logo no cambia.

### Logo de marca — ícono real (gem) en sidebar y login (Fase 1.2.2)

Reemplaza los **placeholders CSS** del logo (la "C" dibujada con gradiente índigo) por el **ícono de marca real** ya exportado. El glifo es una **rueda/timón** (círculo con 6 radios + nodos, blanco sobre fondo azul con gradiente). El asset reemplaza a la "C" en los **dos contextos** donde vivía el placeholder: el gem del sidebar y el chip del login.

**Asset canónico vigente.**

- **Imagen del gem (con su fondo azul):** `frontend/src/app/icon.svg` (= `docs/design/icon-export/Control-icon.svg`, idénticos). SVG cuadrado *full-bleed*: `rect` con gradiente azul `#5080eb` (arriba-izq) → `#1b46b4` (abajo-der), glifo blanco centrado con ~18% de padding interno, **esquinas rectas** (el redondeo lo da el contenedor, no el asset).
- **Intención de marca = esquinas redondeadas.** Los `preview-rounded-*.png` muestran la marca como se quiere ver: gem con esquinas redondeadas. Por eso, en producto, el ícono se monta **siempre dentro de un contenedor con su propio radio** (`rounded-[…]` + `overflow-hidden`), **nunca a borde recto**. El asset full-bleed es correcto: el radio lo aplica el contenedor.
- **Por qué la imagen y no un SVG inline en el componente:** un solo asset es la fuente de verdad (el mismo que alimenta favicon/PWA, ver `docs/frontend.md`). Se monta como `<img>`/`next/image` con `alt=""` decorativo (el wordmark/`aria-label` adyacente ya nombra la marca), nunca redibujando el glifo a mano.

**El azul del ícono convive con el índigo de marca, no lo reemplaza.** El gem tiene su **azul propio** (`#5080eb`→`#1b46b4`, ya adoptado como `theme_color` del manifest). El **acento del DS sigue siendo índigo** (`--accent`, hue 264) para todo lo demás (nav activo, botones primarios, focus ring). Son dos azules-violáceos de la **misma familia de marca**: el azul vive **encerrado dentro del recuadro del gem**; fuera del gem, manda el índigo. **No** se retiñe el ícono al índigo ni se cambia el `--accent` al azul del ícono. Esta convivencia (gem azul + acento índigo) es **deliberada y vigente**.

**Contexto 1 — gem del sidebar.** Mantiene la **geometría y la elevación** del placeholder actual; solo cambia el relleno (de la "C" CSS al ícono).

- Contenedor: **34×34px**, `rounded-[10px]` (radio gem del DS), `overflow-hidden`, `shrink-0`.
- Relleno: el ícono `frontend/src/app/icon.svg` a `100%` (cubre el cuadrado; `object-cover`), `alt=""`, `aria-hidden="true"`.
- **Elevación conservada:** se mantiene el `shadow-[var(--shadow-sm),inset_0_1px_0_oklch(1_0_0_/_0.25)]` del placeholder. La `--shadow-sm` lo asienta sobre la columna; el **inset highlight** blanco arriba lee igual de bien sobre el azul del gem que sobre el índigo. **Se elimina** el `style` de `background: linear-gradient(...)` y el texto "C" (el fondo ahora lo trae el asset).
- El wordmark adyacente ("Control" / "Finanzas del mes") y el `pt-[10px]` del bloque logo **no cambian** (ver sección anterior).

**Contexto 2 — chip del login (`BrandSide`).** Acá el gem va **sobre fondo índigo degradado**. Un gem azul directo sobre índigo "ensucia" el contraste (dos azules pegados). Se conserva el **marco/halo blanco** que ya tenía el chip placeholder, ahora como **passe-partout** del ícono: el blanco separa el azul del gem del índigo del fondo y lo hace leer como una marca asentada, no como una mancha azul.

- Contenedor exterior (chip blanco): **44×44px**, `rounded-[13px]`, `background: #fff`, `shadow-[0_6px_18px_oklch(0.2_0.05_270_/_0.3)]` (los tres valores se conservan del placeholder). `grid place-items-center`, `shrink-0`, `aria-label="Control"`.
- Ícono dentro del chip: **34×34px**, `rounded-[9px]` (radio interior, ~chip menos el marco), `overflow-hidden`. Deja un **marco blanco de ~5px** alrededor del gem (44 chip − 34 gem = 5px por lado). El ícono a `object-cover`, `alt=""`, `aria-hidden="true"`.
- Se **elimina** el `color: var(--accent-ink)`, el `text-[24px] font-bold` y la "C" del placeholder.
- El wordmark "Control" (`<b>` 22px) a la derecha y el resto del `BrandSide` **no cambian**.

> Regla viva derivada: **el gem de marca siempre se monta dentro de un contenedor con radio + `overflow-hidden`** (10px en sidebar, 13px de chip / 9px de gem interior en login). Sobre superficies **claras** (sidebar `--panel`) el gem va **directo** (su azul contrasta con el blanco). Sobre superficies **de marca índigo** (login) el gem va **con marco blanco** para no encimar dos azules. El azul del asset nunca sale del recuadro del gem; el índigo del DS sigue siendo el acento de todo lo demás.

### Toggle de vista en la card `income-expense` — "Total" ↔ "Por categoría" (Fase 1.2.2)

La card de reporte `income-expense` (hoy un AreaChart con dos áreas superpuestas: ingresos vs. gastos, mes a mes — Forma 1) gana un **selector de modo** que alterna entre **dos vistas del mismo gráfico**, sin cambiar de tipo de card ni de altura de canvas. Aplica **idéntico** en `/reportes` y en la card del Dashboard (mismo widget `ReportCard`). **No** es la antigua "Forma 2" (barras apiladas por categoría, que sigue siendo su propia card `by-category`): es una **vista alternativa de la card de ingresos vs. gastos**, en su mismo "skin" de áreas continuas.

- **Vista A — "Total" (default, actual, sin cambios):** las dos áreas superpuestas de la Forma 1 (income verde, expense rojo), tal cual están hoy. No se toca.
- **Vista B — "Por categoría" (nueva) — SOLO GASTOS:** **un único stack de áreas apiladas** en el mismo canvas, subiendo desde cero: N áreas de gasto apiladas, una por categoría (`categories[]`), que suman la **línea de gasto del mes**. **No hay desglose de ingresos** en esta vista (no hay segundo stack, ni doble código, ni rótulos por tipo): es la línea de gasto de la Forma 1 descompuesta en sus categorías. Mismo trazo de áreas continuas `monotone` mes a mes que la Forma 1. **No** son barras (las barras siguen siendo de la card `by-category`).

> Cambio de alcance respecto de la versión previa de esta spec: la vista B perdió el stack de ingresos. Quedan **eliminados del spec**: el stack de ingreso, el contrato `incomeCategories` (revertido del backend — ya no existe), el prefijo `income_`, la leyenda en dos grupos, el tooltip con bloque/total de ingresos, el z-order ingreso/gasto y el wash por hue semántico. La vista B usa **solo `categories[]`** (gastos).

#### 1. El selector de modo — DOS TABS horizontales en la cabecera de la card

El cambio de modo se presenta como **dos tabs ("Total" / "Por categoría") una al lado de la otra, alineadas en el mismo eje X (horizontal)**, ubicadas en la cabecera de la card. **No** es un segmented control (se deroga el segmented de 2 segmentos de la versión previa de esta spec): es un patrón de **tabs nuevas** para el DS, definido acá.

- **Forma de las tabs (patrón underline neutro).** Dos labels en una fila horizontal, separados por `gap-[18px]`. Cada tab: texto **13px / 600**, `py-[6px]`, sin relleno ni pista de fondo (no hay track tipo segmented). La **tab activa** se marca con un **underline indicador 2px `--ink`** pegado al borde inferior de la fila de tabs (no semántico, no índigo: el modo de visualización es neutro) + texto a `--ink`. La **tab inactiva**: texto `--muted`, sin underline; **hover** → texto `--ink-2` y un underline 2px `--line-strong` (afordancia de clickeabilidad). El underline activo **se desliza** horizontalmente entre las dos tabs (transición `transform`/`left` + `width` 0.18s ease-out; instantáneo con `prefers-reduced-motion`).
- **Por qué underline neutro y no índigo ni segmented:** las tabs eligen **modo de visualización**, no un tipo income/expense ni una acción de marca. El underline `--ink` es la señal de "estás acá" más sobria del DS, y libera la cabecera de la pista gris del segmented (que competía con el stepper y el filtro). El acento índigo **no** se usa (es marca, no estado de un control de datos); el verde/rojo **no** se usa (no hay tipo que comunicar: vista A muestra ambos, vista B es gasto pero ya lo dice su línea de contorno).
- **Etiquetas:** **"Total"** (vista A) / **"Por categoría"** (vista B). "Total" comunica la suma agregada ingreso vs. gasto, en contraste con el desglose. Default: **"Total"** (vista A).
- **Lado y orden en la cabecera — tabs a la IZQUIERDA, controles a la derecha.** La cabecera de la card pasa a tener **dos zonas en una fila** (`flex`, `items-center`, `justify-between`):
  - **Izquierda:** las **dos tabs** (`[Total] [Por categoría]`). Son el control de **mayor jerarquía** (definen qué se está viendo), por eso encabezan la fila a la izquierda, alineadas con el título/contenido de la card y separadas de la zona de controles por el `justify-between`.
  - **Derecha (la barra de controles ya existente, sin reordenar internamente):** `[stepper de año] [filtro de categorías] [· divisor + X quitar (solo /reportes)]`, con el mismo `gap-2` de hoy. El stepper y el filtro **modulan** la vista que las tabs eligieron, por eso quedan a la derecha como controles secundarios.
  - Orden visual resultante de izq→der: `[Total · Por categoría]  ⟷  [stepper año] [filtro categorías] [divisor + X]`.
- **Responsive (≤940px / cabecera angosta):** si las dos zonas no entran en una fila, la fila de tabs **baja a su propia línea sobre** la barra de controles (las tabs siguen a la izquierda de su línea; los controles quedan en la línea de abajo, alineados a la derecha como hoy). Las tabs **nunca** se colapsan en un menú ni cambian a segmented: siempre son dos labels horizontales con su underline.
- **a11y:** `role="tablist"` `aria-label="Vista del reporte"` con dos `role="tab"` (`aria-selected`), cada uno controlando el `role="tabpanel"` del canvas (`aria-controls` / `id`). Navegable por teclado (flechas izq/der mueven la selección, según patrón ARIA tabs). **Focus ring:** `--accent-soft` 3px sobre la tab enfocada (mismo focus ring del DS para controles; el ring de foco sí puede ser acento — es cromo de interacción, no estado de datos ni monto).
- **Solo en la card `income-expense`.** La card `by-category` (barras apiladas) **no** lleva estas tabs: su cabecera queda igual.
- **El filtro de categorías sigue valiendo en ambas vistas.** En vista B, filtrar categorías recorta el stack de gasto (las categorías excluidas no aportan banda). El stepper de año y sus límites (`earliestYear` / año en curso) no cambian con la vista.

#### 2. La vista apilada — el stack de solo-gastos

Un **único stack de gasto** sube desde cero en el canvas, con el mismo skin de áreas continuas de la Forma 1. El color **identifica la categoría**; la **firma de gasto** la da la línea de contorno superior (regla dura 1/2 intacta).

- **Color de cada banda = `category.color` (identificador), regla dura 1/2 intacta.** Cada banda usa el `color` de su `categories[]`. El color es **solo identificador de categoría**, nunca comunica gasto (eso lo hace la línea de contorno). No se retiñe ninguna banda con rojo expense.
- **Línea de contorno superior del stack = la línea de gasto de la Forma 1.** La suma del stack (el total de gasto del mes) se traza como **línea de contorno superior** en `var(--expense)`, **2px**, opacidad 1, `monotone` — idéntica a la línea de gasto de la Forma 1. La vista B es la línea de gasto de la Forma 1 con su área **descompuesta en bandas por categoría debajo**, lo que garantiza continuidad visual entre las dos vistas y comunica "esto es gasto" con el semántico correcto, sin teñir las bandas.
- **Relleno de las bandas (fill):** cada banda se rellena con su `category.color` a **opacidad 0.55** (más sólida que el 0.14 de las áreas de Forma 1, porque acá las bandas son la descomposición que hay que distinguir entre sí, no áreas translúcidas que se solapan). El degradé translúcido de la Forma 1 **no** se usa en las bandas.
- **Separadores entre bandas:** 1px `var(--panel)` (blanco) entre bandas apiladas, **mismo recurso que las barras de la Forma 2** (`stroke="var(--panel)"` `strokeWidth={1}`), para que dos categorías de color parecido no se fundan. Crítico con muchas categorías y colores reciclados.
- **Orden de apilado (stack order):** determinístico y estable entre meses. El stack se apila **de mayor a menor gasto anual** de la categoría (la de mayor gasto anual en la base) — los datos ya vienen ordenados así (`categories[]` por gasto anual DESC). El orden es **el mismo para los 12 meses** (no se reordena por mes), para que el ojo siga cada banda horizontalmente.
- **Muchas categorías (legibilidad) — sin agrupar en v1:** se muestran **todas** las categorías con gasto en el año, cada una en su banda, sin agrupar ni colapsar (fiel a la Forma 2). Recursos de legibilidad, todos visuales (no cambian datos): orden de apilado mayor→menor (bandas grandes en la base, finas arriba), separadores 1px `--panel`, leyenda con `flex-wrap`. (Post-v1, candidato a evaluar igual que en Forma 2: banda "Otras" para la cola. Fuera de v1 sin decisión explícita.)

#### 3. Leyenda en vista B

Reutiliza `ChartLegend` (swatch 10px radio 3px + etiqueta UI 12.5px/500 `--ink-2`, `flex-wrap`, `margin-top` 14px). **Un solo grupo de categorías, sin rótulos de tipo ni agrupación:**

- **Un único grupo plano:** un ítem por categoría de gasto (swatch `category.color` + nombre), en el **mismo orden del apilado** (mayor a menor gasto anual), separación estándar entre ítems (16px), `flex-wrap`. **No** hay rótulos "Gastos"/"Ingresos" ni dos grupos: la vista es solo gastos, no hay tipo que rotular.
- Las cifras **no** van en la leyenda (van en el tooltip). La leyenda es color → nombre.
- En vista A la leyenda queda como hoy: dos ítems "Ingresos" (`--income`) / "Gastos" (`--expense`).

#### 4. Tooltip en vista B

Reutiliza `ChartTooltipContent` siguiendo el patrón de la Forma 2 (`Form2Tooltip`) **tal cual** — un único bloque de gastos:

- **Encabezado:** mes y año (ej. "Marzo 2026"), igual que hoy.
- **Filas:** una por categoría de **gasto** con valor > 0 en ese mes (`categories[].monthlyExpenseCents[mes]`): swatch con `category.color` + nombre `--ink-2` + monto **mono** en `--ink` (el color lo da el swatch, no el número; un gasto de categoría no se recolorea). Categorías con valor 0 en el mes se **omiten** (igual que la Forma 2).
- **Total:** fila **"Total gastos"** + monto mono `--expense-ink`, separada por `--hair` (es el total de gastos del mes — sí es expense). Mismo patrón exacto que `Form2Tooltip` hoy. **No** hay bloque ni total de ingresos.
- Si el mes está vacío (sin gastos), no hay tooltip (igual que hoy).
- **Cursor de hover:** guía vertical `--hair` 1px (igual que la Forma 1, que es área).

#### 5. Estados (vista B)

Heredan el comportamiento ya vigente de la card de reporte; sin tokens nuevos.

- **Vacío (año sin gastos):** los 12 meses se dibujan en cero (eje X completo), overlay centrado "Sin movimientos en {año}." (texto UI 14px `--muted`), sin error — **idéntico** al empty actual de la card. Si el **filtro** vacía la vista (todas las categorías deseleccionadas), mismo empty.
- **Loading:** mismo skeleton del DS de la card (bloque `bg-panel-3 rounded-ctl animate-pulse` del alto del canvas + chips fantasma de leyenda). La cabecera —incluidas las tabs— ya está presente e inerte mientras carga.
- **Error:** mismo tratamiento de la card (ícono `AlertTriangle` 20px `--warning-ink`, "No se pudo cargar el gráfico.", botón ghost "Reintentar").
- **`prefers-reduced-motion`:** las áreas apiladas **no** animan su *grow* de entrada ni al cambiar de año/vista (`isAnimationActive={false}`); el cambio entre vista A y B es instantáneo (sin morph/cross-fade); el underline de las tabs no se desliza (cambia de posición instantáneo). El tooltip aparece sin transición. Regla obligatoria del DS.
- **Cambio de vista (con movimiento):** A↔B reanima el *grow* de las áreas (~0.4s ease-out, mismo timing que la Forma 1) y el underline de la tab se desliza (0.18s). No hay morph entre las dos topologías de área (la actual desaparece y la nueva crece desde la base): se evita una transición ambigua entre "dos áreas" y "un stack de N bandas".

#### Restricciones duras reafirmadas

- **Verde = ingreso, rojo = gasto** solo en la **línea de contorno** del stack (rojo) y el **total** del tooltip (rojo) — nunca en las bandas de categoría ni en los montos por categoría (esos van por `category.color` / `--ink`). Las bandas son identificador, no semántico.
- **El acento índigo no aparece en esta vista** salvo el **focus ring** de las tabs (cromo de interacción, no estado de datos ni monto). El indicador de tab activa es `--ink` (neutro), no acento.
- **Toda cifra del tooltip va en mono tabular.**

> Reutiliza: las **líneas/degradés income/expense** de la Forma 1 (gráfico anual); los **separadores 1px `--panel`** y el **orden de apilado mayor→menor estable** de la Forma 2; `ChartLegend` y `ChartTooltipContent` (patrón `Form2Tooltip`) tal cual. Aporta: el patrón nuevo de **tabs underline neutras** en la cabecera de la card (deroga el segmented de 2 segmentos de la versión previa) y la **vista B de un único stack de gastos por categoría** (línea de contorno rojo = firma de gasto; bandas = `category.color` identificador). Detalle verbatim: *Toggle de vista en la card `income-expense` (Fase 1.2.2)* en `docs/design/specs-archive.md`.

### Filtro de categorías embebido (checklist en popover)

Control reutilizable para filtrar por categorías sin tapar el contenido. Botón disparador + popover con checklist.

- **Disparador:** botón ghost chico (`.btn.ghost.sm`), ícono `SlidersHorizontal` 15px. Rótulo **"Categorías"** (default, todas) / **"Categorías · N"** (subconjunto, `· N` mono `--ink`) / **"Categorías · 0"** (ninguna). Con filtro activo: ícono+texto suben a `--ink` y aparece un **punto indicador 6px `--accent`** (cromo de UI, no monto).
- **Popover:** `--panel`, `--line`, `--r-ctl`, `--shadow-lg`, ancho 260px, `max-height ~320px` con scroll interno (header/footer fijos). Header: label "Mostrar categorías" + toggle "Todas"/"Ninguna" (link `--accent-ink`). Filas: checkbox del DS + **swatch de color 10px radio 3px** + nombre 13px (`--ink` tildada / `--ink-2` destildada). El universo son las categorías **activas**. Filtro **en vivo** (sin Aplicar/Cancelar); cierra por clic fuera / `Esc` / re-clic.
- Si el filtro vacía el reporte, el gráfico muestra los 12 meses en cero con el empty "Sin movimientos…" (sin error); los límites de año no cambian.

> Detalle verbatim: *Reportes configurables → A.2. Filtro de categorías embebido (Fase 1.1.5)* en `docs/design/specs-archive.md`.

### Filtros por listado en `/mes` — controles de sección (Fase 1.2.1)

El filtro de `/mes` deja de ser **uno por pantalla** y pasa a ser **por listado**: cada `AccordionSection` (Únicos / Fijos / Cuotas) tiene **sus propios** controles de filtro, alojados **en su cabecera**. Esto **deroga** el `FilterButton` por-pantalla del header de `/mes` (que se elimina del `.phead`); el patrón *Filtro de categorías embebido* (arriba) **se reutiliza** acá, ahora scoped a la sección.

Cada sección tiene **dos controles propios**:
1. **Triple switch de tipo:** **Gasto / Ingreso / Ambos** (default **Ambos**).
2. **Filtro por categoría:** el `CategoryFilterPopover` existente (default **todas**), reutilizado sin cambios de lógica.

**Decisión de alojamiento — un único disparador por sección que abre un popover con ambos controles.** La cabecera del acordeón ya está cargada (handle de orden + chevron + rótulo + pill contador + divisor flex + subtotal mono). Meter dos controles inline en esa fila la satura y compite con el subtotal, que debe seguir dominando a la derecha. Por eso los **dos** controles viven **dentro de un popover** que se abre desde **un solo disparador** por sección. Además es una **restricción dura de accesibilidad**: la cabecera entera es un `<button>` (disclosure), y no se anidan controles interactivos dentro de un button — tanto el disparador como el popover van **fuera** del `<button>` de la cabecera (ver "Ubicación en la fila" abajo).

**Ubicación en la fila.** El disparador se inserta como **un elemento icon-only** ubicado **entre el divisor flex y el subtotal** (orden de la fila: `[handle] [chevron] [rótulo] [pill] [divisor flex-1] [disparador filtro] [subtotal]`). Queda pegado al borde derecho, junto al subtotal que es el dato que el filtro modula, sin empujar el rótulo ni romper el divisor. El disparador y el popover se renderizan **como hermanos del `<button>` de la cabecera** (no hijos): la fila pasa a ser un contenedor `flex` que envuelve el `<button>` disclosure (que conserva chevron + rótulo + pill + divisor + subtotal) y, a su derecha, el disparador del filtro como sibling. El click en el disparador **no** dispara el colapso (vive fuera del button; además conviene `stopPropagation` por las dudas — detalle de implementación de `control-frontend`).

- **Disparador (botón):** ghost icon-only del DS, ícono `SlidersHorizontal` **15px**, **sin rótulo de texto** (a diferencia del disparador a ancho del *Filtro de categorías embebido*, acá hay poco lugar en la fila y la sección ya está rotulada). Padding `px-[7px] py-[5px]`, radio `--r-ctl`. Reposo: `--muted`. Hover: `--ink` sobre `--panel-2`. Abierto: `--panel-2` + `--ink`. Focus: ring `--accent-soft` 3px. `aria-label="Filtrar {rótulo}"`, `aria-expanded`, `aria-haspopup="dialog"`.
- **Estado "filtro activo" (≠ default).** Una sección está filtrada cuando el tipo ≠ Ambos **o** la categoría ≠ todas. La señal es el mismo lenguaje que el `FilterButton`: **punto indicador 6px `--accent`** (cromo de UI, no monto), posicionado como badge en la esquina superior derecha del disparador icon-only (offset `-top-[2px] -right-[2px]`, borde `2px --panel` para recortarlo del ícono). Con filtro activo el ícono además sube a `--ink` en reposo. **No** se muestra un contador numérico en el disparador (no hay lugar; el detalle del filtro se ve al abrir el popover).
- **Popover.** `--panel`, `--line`, `--r-ctl`, `--shadow-lg`, ancho **260px** (mismo que el *Filtro de categorías embebido*), portaleado a body, anclado bajo el disparador, alineado a la derecha. Cierra por clic fuera / `Esc` / re-clic. Estructura de **dos bloques** separados por divisor `--hair`:
  1. **Bloque tipo (arriba):** header con label *Eyebrow/labels* `--muted` **"Mostrar"** y, debajo, el **triple switch** Gasto / Ingreso / Ambos (ver abajo). Padding `px-3 py-[10px]`.
  2. **Bloque categorías (abajo):** el **`CategoryFilterPopover` existente embebido** tal cual su patrón (header "Mostrar categorías" + toggle Todas/Ninguna, filas checkbox + swatch 10px + nombre, scroll interno `max-height ~280px`). **Se reutiliza el componente y su lógica de 3 estados** (`null`=todas / `[]`=ninguna / lista) sin cambios.

**Triple switch de tipo (Gasto / Ingreso / Ambos).** Segmented control del DS, **neutro en forma**, con los semánticos aplicados **solo al texto del segmento seleccionado** (no a fondos saturados, para no convertir el control en una superficie roja/verde grande):

- **Forma:** pista pill `--panel-3` (track), radio `--r-pill`, padding interno `2px`, tres segmentos de ancho igual repartidos en la pista. Cada segmento: texto **12.5px / 600**, `px-[10px] py-[5px]`, radio `--r-pill`.
- **Segmento seleccionado:** thumb `--panel` (blanco) elevado con `--shadow-sm`, que se **desliza** entre las 3 posiciones (transición 0.14s; instantánea con `prefers-reduced-motion`). El **texto** del segmento seleccionado toma su color semántico: **Gasto → `--expense-ink`**, **Ingreso → `--income-ink`**, **Ambos → `--accent-ink`** (marca, consistente con el badge de alcance "ambos" del DS). Esto **no viola la regla dura 1/2**: no hay montos teñidos; es el rótulo de un control de UI que comunica el modo de visualización, y el "ambos" en índigo es marca, no monto.
- **Segmento no seleccionado:** texto `--muted`, sin thumb. Hover (no seleccionado): texto `--ink-2`.
- **Default:** **Ambos** seleccionado (thumb a la derecha, texto `--accent-ink`).
- **Semántica/a11y:** `role="radiogroup"` con tres `role="radio"` (`aria-checked`), `aria-label="Tipo de movimiento"`. Navegable por teclado (flechas), focus ring `--accent-soft` 3px sobre el segmento.

**Subtotal y pill contador reflejan el filtro.** El pill contador y el subtotal mono de la cabecera muestran **lo visible/computado bajo el filtro de esa sección** (no el total bruto). Es **dato para el visual**: ambos números cambian con el filtro; el patrón ya los soporta (son strings que la cabecera recibe ya calculados). No se agrega indicación extra de "filtrado" sobre el número en sí — la señal de filtro vive en el disparador (punto `--accent`). El **color del subtotal no cambia** por el filtro de tipo (sigue `--muted`, es un total de sección, no un monto de movimiento).

**Comportamiento en modo orden — los controles de filtro NO se muestran.** En modo orden la cabecera está dedicada a arrastrar (colapso transitorio, fila reducida a handle + chevron ▶ + rótulo + pill + divisor + subtotal). El **disparador de filtro se oculta** mientras dura el modo orden (no se renderiza), igual que el cuerpo está colapsado. Al salir del modo ("Listo") el disparador vuelve. Esto mantiene la fila de orden limpia y evita un control accionable en una cabecera que no es accionable. (Confirma el requisito del orquestador.)

**Responsive (≤940px).** El disparador es icon-only (no crece de ancho), así que entra en la fila igual que en desktop; el popover (260px, portaleado, anclado a la derecha) no depende del ancho de la sección. No hay cambio de forma en ≤940px más allá del re-anclaje natural del popover al disparador.

> Reutiliza el *Filtro de categorías embebido* (popover de categorías, sin cambios de lógica) y el lenguaje del punto indicador `--accent` del `FilterButton`. Aporta el **triple switch de tipo** (segmented neutro con semánticos solo en el texto del seleccionado) como pieza nueva, y la decisión de **alojar dos controles tras un único disparador en la cabecera del acordeón, fuera del `<button>` disclosure**. Detalle verbatim: *Filtros por listado en `/mes` (Fase 1.2.1)* en `docs/design/specs-archive.md`.

### Picker de color de categoría (matriz de swatches)

Selector del color de categoría en el modal de categoría (crear y editar), que consume la **matriz de 70 colores** (ver *Paleta de colores para categorías*). Grid 10 columnas × 7 filas, swatch cuadrado `aspect-ratio: 1` radio `--r-chip` 7px, gap 6px.

- **Estados del swatch:** *reposo* = su hex con borde `--line` 1px. *Hover* = `scale(1.12)` + `--shadow-sm`, borde `--line-strong`, transición 0.14s. *Seleccionado* = anillo `box-shadow: 0 0 0 2px var(--panel), 0 0 0 4px var(--ink)` (ring **neutro `--ink`**, no acento — regla dura 2). *Focus* = ring `--accent-soft` 3px.
- **Botón "Aleatorio":** ghost chico (`Shuffle` 15px) que mueve la selección a un swatch al azar **de la matriz** (nunca un hex fuera de ella).
- **Crear:** arranca en el color menos usado (fila T4). **Editar:** arranca en el color actual de la categoría.

> Detalle verbatim: *Picker de color de categoría — spec visual (Fase 1.1.2)* en `docs/design/specs-archive.md`.

### Metadatos de relación en la sublínea del ítem de `/mes` (calculados)

La **sublínea** del ítem de `/mes` es el lugar canónico de los metadatos del movimiento (categoría, tipo, frecuencia, cuota, estado anulado). La relación **padre/hijo** de los movimientos calculados (Fases 1.1.7–1.1.8) se señala ahí, con **chips/segmentos neutros**, sin recolorear el ítem ni el monto:

- **Hijo (es un calculado):** chip neutro **"Calculado"** (mismo estilo que el chip "Anulado": `--panel-3` / `--muted` / `--r-chip` / 11px·600·`.04em`) con mini-glifo `Link2` (11px), como **primer** segmento de la sublínea; y un segmento final **"desde {Origen}"** (`--muted`, nombre en `--ink-2`, sin mono). Orden si además está anulado: `[Anulado] [Calculado] Categoría · …`.
- **Padre (tiene calculados derivados):** segmento final con glifo `GitBranch` (13px, `--muted`) + contador mono tabular si hay más de uno, y `title` nativo "Tiene N calculado(s)". Señal más liviana que la del hijo (es info secundaria).
- El **monto** del calculado puede ser negativo/cero (ver *Paleta y uso de tokens* → regla del signo).
- **El origen del calculado puede ser fijo, único o cuota (Fase 1.1.8) — el patrón es transversal.** El chip "Calculado", el "desde {Origen}" del hijo y la marca padre (`GitBranch`) se aplican **idénticos** sin importar el origen; el calculado se **lista en la sección de su origen** (calculado de único → **Únicos**; de cuota → **Cuotas**; de fijo → **Fijos**). Particularidades por sección:
  - **El hijo toma la forma de su sección de origen.** En **Únicos** lleva la columna fecha "DD Mmm" (heredada del split temporal del origen, RN-020); en **Cuotas** la columna 3 va **vacía** — el calculado de cuota **no** muestra la etiqueta "Cuota X/N" (es un movimiento propio, no integra el plan de cuotas); en **Fijos** la columna 3 va vacía como cualquier fijo.
  - **La sublínea sigue la regla de su origen:** el segmento de **frecuencia (`Repeat`)** aparece **solo** cuando el calculado es de **origen fijo**; en calculados de único/cuota la sublínea es `[Calculado] Categoría · gasto/ingreso · desde {Origen}` (sin frecuencia, sin "X/N").
  - **Orden dentro de la sección:** el calculado se ordena por **magnitud `|monto| DESC`** mezclado con el resto de los ítems de su sección (mismo criterio único del backend); **no** se ancla junto a su origen ni se agrupa aparte — cae donde su magnitud lo ubique.
  - **Ícono de la caja de origen (form de calculado).** La caja de origen *read-only* del form lleva un glifo lucide que identifica el **tipo del movimiento de origen**, en `--accent-ink` (cromo de UI, no monto): **fijo → `Repeat`** (recurrencia), **único → `Receipt`** (gasto puntual / ticket), **cuota → `CreditCard`** (compra financiada en N pagos). 15px, `shrink-0`, `aria-hidden`. Son afordancias neutras: no tiñen cifras ni colisionan con la regla verde/rojo. No hay convención previa de ícono para único/cuota en listas (Únicos se distingue por la columna fecha; Cuotas por "X/N"), así que estos tres glifos viven por ahora solo en esta caja.
- **Aviso de borrado en cascada (modal de eliminar):** cuando el movimiento a eliminar es **padre** (`hasCalculated === true`), el modal de confirmación suma un **callout de advertencia** como **último bloque del cuerpo, antes del footer**, avisando que al borrarlo también se borran sus calculados. Es **advertencia (ámbar `--warning`), no error**: el borrado es lo pedido, el callout informa el efecto colateral. Banda `--r-ctl`, fondo `--warning-soft`, borde `--warning`, `AlertTriangle` (lucide, 16px, `--warning-ink`) + texto 13px/500 `--warning-ink`. El botón "Eliminar" del footer **sigue siendo `danger`** (rojo): advertencia ámbar y acción destructiva roja conviven. Solo aparece si `hasCalculated`; si es `false`, el modal queda igual.

> Detalle verbatim: *Movimientos calculados — spec visual (Fase 1.1.7)* y *Calculados de único y cuota — spec visual (Fase 1.1.8)* en `docs/design/specs-archive.md`.

### Multi-moneda ARS/USD — cromo neutro de moneda y cotización (Fase 1.2.3)

La moneda explícita (ARS/USD) por movimiento, su cotización y la conversión de display a la **moneda default** del usuario aportan piezas reutilizables que **nunca tiñen el monto**. **Regla viva derivada:** **la moneda es cromo neutro** — badge, código "ARS"/"USD" y cotización van en **neutros** (`--ink-2` / `--muted` / `--panel-3`); **nunca** verde/rojo (eso es tipo, regla dura 1) ni índigo (eso es marca, regla dura 2). El color del monto lo sigue dando su **tipo**; la moneda solo lo **rotula**. Cifra original y convertida van **ambas en mono tabular** (regla dura 3). El índigo aparece solo como **cromo de interacción** (focus ring, thumb activo del segmented).

- **Badge de código de moneda:** chip neutro con el código (`"USD"`, `"ARS"`), **mismo molde que los chips Anulado/Calculado** (`--panel-3` / `--muted` / `--r-chip` 7px / 11px·600·`.04em` / `mono`). Identifica la moneda de origen; no se tiñe.
- **Segmented neutro ARS/USD (2 opciones):** el **segmented del DS reducido a 2 segmentos y sin semánticos** (molde del triple switch de tipo de 1.2.1): track `--panel-3`, radio `--r-pill`, padding `2px`; segmentos texto 13px/600 `px-[14px] py-[6px]`, etiquetas `"ARS"`/`"USD"` en `mono`. Seleccionado = thumb `--panel` + `--shadow-sm`, texto `--ink`, deslizamiento 0.14s; no seleccionado = `--muted` → `--ink-2` en hover. **Sin color semántico ni índigo en los segmentos.** `role="radiogroup"` + 2 `role="radio"`, focus ring `--accent-soft` 3px. Vigente en `/configuracion` y como selector de moneda del bloque moneda+cotización de los forms.
- **Par moneda + cotización (forms de único/fijo/cuotas):** bloque que va **inmediatamente debajo del Monto** (lo modula), en `grid grid-cols-2 gap-[14px]` → Moneda (segmented neutro) + Cotización (input mono con **prefijo de par** de lectura, ej. `"USD→ARS"` / `"ARS→USD"` según la moneda seleccionada, en `mono` 12px `--muted`). ~~El campo Cotización va SIEMPRE presente y editable, también cuando `moneda == default`; no se oculta ni se colapsa.~~ **DEROGADO por 1.2.4** (ver *Bloque moneda+cotización colapsable + caso moneda=default* abajo): el bloque ahora vive dentro de un **disclosure** y, cuando `moneda == default`, el campo Cotización **se oculta** (queda solo el selector). Pre-carga editable: nota *field-note* "Cotización de referencia del mes" (glifo `History` 12px) → "Cotización modificada" al editar. Validación: cotización > 0 en todos los casos (error con borde `--expense` + ring `--expense-soft` + mensaje `--expense-ink`, mismo patrón que el Monto). El **calculado no muestra el bloque** (hereda moneda/cotización del origen, read-only).
- **Ítem de `/mes` (`MovementItemRow`) — original subordinado al convertido:** **el monto convertido a la default sigue dominando** (col 4, 15.5px/600, color por tipo, mono, sin agrandarse ni moverse). Cuando `moneda ≠ default` se suman dos elementos **neutros y subordinados**: el **badge de moneda original** a la izquierda del monto (misma celda, `inline-flex items-center gap-[7px] justify-end`) y una **segunda línea** del valor original (*Meta/subtítulos* 12.5px/500 `--muted` `mono`, ej. `"USD 100,00"`, sin signo). **Cuando `moneda = default` (caso mayoritario / back-compat ARS) el ítem queda exactamente como hoy** — sin badge ni línea original. Bajo anulado, ambos heredan el `opacity-[0.55]`; el convertido conserva su `line-through` + color por tipo.
- **Tarjeta de ajuste (patrón reutilizable, `/configuracion`):** `.card` del DS con **fila de ajuste** `flex items-center justify-between gap-6` (izquierda: título 14.5px/600 `--ink` + descripción *Meta/subtítulos* `--muted`; derecha: el control). Molde para ajustes futuros (un ajuste = una fila). En v1.2.3 hay uno solo: "Moneda por defecto" (segmented ARS/USD), que persiste **en vivo** al seleccionar (sin botón Guardar; toast de confirmación) y **recomputa el display** de `/mes` y reportes sin tocar lo guardado.
- **Sidebar:** link **"Configuración"** (`Settings` 18px) como **último** ítem de nav, mismo molde/estados que el resto; activo por prefijo `startsWith("/configuracion")`.
- **Reportes:** **no cambian** — ya operan sobre datos convertidos a la default (la conversión es capa de display aguas arriba del gráfico); no se rotula moneda ni se muestran originales en las cards. El cambio de default recomputa sus valores en vivo.

> El caso **mono-moneda no se ensucia** donde corresponde: el **ítem** de `/mes` (sin badge ni línea original cuando moneda=default) y `/configuracion` (un solo segmented) no muestran complejidad de multi-moneda. En el **form**, ~~el campo Cotización va siempre presente y editable~~ **(DEROGADO por 1.2.4)** el bloque moneda+cotización vive ahora dentro de un disclosure colapsado por default, y cuando moneda=default el campo Cotización se oculta. Detalle verbatim: *Multi-moneda ARS/USD + `/configuracion` (Fase 1.2.3)* en `docs/design/specs-archive.md`.

### Indicador de moneda default a nivel app (Fase 1.2.3 — extensión)

Extiende el cromo de moneda de 1.2.3 con un **lenguaje coherente, persistente y a nivel app** para comunicar **en qué moneda están todos los montos mostrados**. La multi-moneda original ya resolvió el cromo **por-ítem** (badge de moneda original, valor original vs. convertido) y el **ajuste** (`/configuracion`); faltaba el **indicador global** que diga, en toda pantalla, "todos estos montos están en {moneda default}". Esta sección define ese indicador. **No introduce tokens nuevos** ni deroga nada de 1.2.3: se apoya en el badge de código de moneda (chip neutro) y reafirma la regla dura *la moneda es cromo neutro*.

**Decisión de alcance — el indicador global es INFORMATIVO, no interactivo (CERRADO).** El indicador comunica la moneda default vigente; **no la cambia**. El cambio de moneda default vive **únicamente en `/configuracion`** (su segmented ARS/USD, persistencia en vivo), como lo cerró el roadmap §1.2.3 (`/configuracion` es "el contenedor" de ese ajuste). El indicador es una **lectura** consistente entre pantallas, con una afordancia de navegación hacia `/configuracion` (no de edición in-situ). El chip **no** despliega popover ni segmented: es lectura + link, nunca control de cambio in-situ. (Un indicador interactivo que cambie la default desde cualquier pantalla sería alcance nuevo y requiere decisión explícita; no es parte de lo vigente.)

#### 1. El chip de moneda default — pieza canónica

Un **chip de moneda** neutro, persistente, que rotula el contexto monetario de la pantalla. **Mismo molde que el badge de código de moneda** de 1.2.3 (chip `--panel-3` / `--r-chip` 7px / código en `mono`), enriquecido para su rol de indicador global:

- **Composición:** glifo `Wallet` (lucide, 13px, `--muted`, `shrink-0`, `aria-hidden`) + código de moneda **`"ARS"` / `"USD"`** en `mono` 11.5px·600·`.04em` `--ink-2`. El glifo lo distingue del badge por-ítem (que es solo código) y comunica "moneda del contexto" sin texto largo. Sin símbolo de país ni bandera.
- **Caja:** `inline-flex items-center gap-[6px]`, fondo `--panel-3`, radio `--r-chip` 7px, padding `px-[8px] py-[3px]`. **Neutro estricto:** nunca income/expense (regla dura 1), nunca índigo de marca (regla dura 2). Es cromo de moneda (regla viva 1.2.3).
- **Afordancia a `/configuracion` (navegación, no edición):** el chip es un **`Link` a `/configuracion`** con `aria-label="Moneda por defecto: {ARS|USD}. Cambiar en Configuración"`. Estados: *reposo* como arriba; *hover* fondo `--panel-2`→texto `--ink` y aparece un glifo `Settings`/`ChevronRight` 11px `--faint` a la derecha (afordancia "se gestiona en otro lado"), transición 0.14s; *focus* ring `--accent-soft` 3px, radio `--r-chip`. **No** despliega popover ni segmented (eso sería el modo interactivo, **descartado**: el cambio de moneda vive solo en `/configuracion`). El default vigente es el `Link` a `/configuracion`.
- **Cuando hay una sola moneda en juego no desaparece:** a diferencia del badge por-ítem (que solo aparece en cross-rate), el chip global **se muestra siempre**, también cuando todo está en la default y no hay conversión. Es el ancla de "todos estos números están en {moneda}"; su valor es justamente ser constante.

#### 2. Ubicación por pantalla — el chip vive en el header, a la derecha del eyebrow

El chip se ancla en el **`.phead`** de cada pantalla con totales, alineado con la **identidad** del header (eyebrow + H1), **no** con la zona de acciones (`+ Nuevo movimiento`). Va en la **fila del eyebrow**, a su derecha, separado por un `gap-[10px]`: el eyebrow rotula la pantalla ("Tu mes", "Reporte"), el chip rotula su moneda — leen juntos como "contexto de la pantalla". Queda **por encima** del H1 (período / título), nunca tapándolo ni compitiendo con la cifra hero.

Pantallas y anclaje exacto:

- **Dashboard (`/`):** en el `.phead`, fila del eyebrow "Tu mes" → `[Tu mes]  [💳 ARS]` a la izquierda; `+ Nuevo movimiento` sigue a la derecha por el `justify-between`. Un solo chip preside todas las cards (Gastos / Ingresos / Balance hero) y la card de reporte: todas en la default.
- **`/mes`:** en el `.phead` (columna central de `PeriodNav`, régimen ≥941px), fila del eyebrow "Tu mes" → `[Tu mes] [💳 ARS]`, encima del H1 "Junio 2026". En ≤940px (header colapsado a `.stepper`), el chip va en la **misma fila del stepper**, a su derecha, sin romper el centrado del rótulo de mes.
- **`/reportes`:** en el `.phead` de la pantalla (eyebrow de pantalla), **no** en cada card. Una sola lectura de moneda para todos los reportes apilados (todos operan sobre datos convertidos a la default — 1.2.3). Las cards **no** llevan chip propio (evita repetir el indicador N veces).
- **`/configuracion`:** **NO lleva chip indicador.** Es la pantalla donde la moneda default **se edita** (su tarjeta de ajuste "Moneda por defecto" con el segmented ARS/USD ya **es** el control y la lectura de ese valor). Un chip indicador acá sería redundante y ambiguo respecto del segmented editable. El indicador global vive en las pantallas de **consumo** de montos, no en la de configuración.

> **Consistencia entre pantallas:** mismo chip, mismo lugar (fila del eyebrow del `.phead`), mismo valor (la moneda default vigente) en Dashboard, `/mes` y `/reportes`. Al cambiar la default en `/configuracion`, **todos** los chips reflejan el nuevo valor en vivo (junto con la recomputación de totales de 1.2.3). El chip es la confirmación visible de que "el cambio surtió efecto en toda la app".

#### 3. Cómo los totales comunican su moneda — símbolo por moneda + chip global como contexto

Los totales y montos agregados (totales de `/mes`, cards de Dashboard, mini-balance, cifras de reportes) llevan el **símbolo de su moneda** (ver *Símbolos de moneda*, abajo): `$` para ARS, `US$` para USD. El símbolo hace **autosuficiente** cada cifra (se lee qué moneda es sin mirar otra parte). El **chip global del header** sigue presente como **contexto de pantalla** y afordancia a `/configuracion`; ya no es la única fuente de desambiguación, sino el ancla "todos estos montos están en {default}". No se duplica el **código** (`ARS`/`USD`) pegado a cada número agregado: el símbolo ya lo dice y el chip da el contexto.

- **Los totales NO se recolorean ni cambian de tipografía** por la moneda: siguen su color por tipo (income/expense) o neutro (mini-balance/subtotales) y su `mono tabular`. El símbolo **es cromo neutro de moneda**: no se recolorea por moneda (ni ARS ni USD tiñen distinto); hereda el color del monto (que lo da el tipo). La moneda nunca toca el color del número (regla dura).
- **Cifra original vs. convertida (jerarquía con 1.2.3):** la **línea de valor original subordinada** del ítem de `/mes` cross-rate (1.2.3) ahora muestra la cifra original **con el símbolo de su moneda** (ej. `US$100,00` en `--muted`, debajo del convertido en `$`), en lugar del prefijo de código `"USD"`. Eso es **información del ítem** (su moneda de origen), distinta del **contexto de pantalla** (la default). Coexisten sin contradicción: el **chip global** dice "los totales y el monto dominante están en {default}"; el **símbolo + línea original** del ítem dice "este movimiento se cargó en otra moneda". Jerarquía: global (header) > convertido dominante (col 4 del ítem, en el símbolo de la default) > original subordinado (segunda línea, en el símbolo de su moneda). Ningún nivel se tiñe.

#### 4. Jerarquía y reglas duras (reafirmadas)

- **Cuatro señales de cromo de moneda, sin pisarse:** (1) **símbolo por cifra** (`$`/`US$`) = la moneda de ese número, autosuficiente; (2) **chip global** en el header = contexto de pantalla + afordancia a config; (3) **badge de moneda original** en el ítem cross-rate (1.2.3) = etiqueta de origen junto al monto convertido; (4) **línea de valor original** (1.2.3) = la cifra en su moneda de origen (con su símbolo `US$`). El chip global es el de **mayor alcance** (rige todo) y el de **menor peso visual por unidad**; el símbolo es por-cifra; los marcadores por-ítem son **locales** y solo aparecen en cross-rate. No se contradicen: hablan de cosas distintas (cifra / contexto / origen del ítem / cifra original). Ver *Símbolos de moneda por código* abajo.
- **La moneda es cromo neutro** (regla viva 1.2.3, reafirmada): el chip global (su glifo y su código) van en `--panel-3` / `--muted` / `--ink-2`; el **símbolo de moneda** hereda el color del monto (por tipo). **Nunca** verde/rojo por moneda ni índigo (marca). El índigo solo aparece como **focus ring** del chip-link (cromo de interacción).
- **Toda cifra sigue en mono tabular** (regla dura 3): el código del chip, los totales, los originales y el **símbolo de moneda** van en `mono`.

> **Estado de los flags (CERRADOS por el usuario):** ambos flags que abría este spec quedaron resueltos. (1) El indicador global es **informativo** (lectura + navegación a `/configuracion`), **no** interactivo — un selector que cambie la default desde cualquier pantalla sigue siendo alcance nuevo, fuera de lo vigente. (2) Los **símbolos de moneda son distintos por moneda** (`$` ARS / `US$` USD): ver *Símbolos de moneda por código* abajo. El `control-frontend` implementa el indicador informativo + los símbolos distintos.

> Reutiliza el **badge de código de moneda** (chip neutro 1.2.3), la **regla viva la moneda es cromo neutro**, y el patrón `.phead` (eyebrow + H1). Aporta el **chip de moneda default global** (con glifo `Wallet` + link a `/configuracion`), su **ubicación canónica** en el header de Dashboard / `/mes` / `/reportes` (no en `/configuracion`), y la **jerarquía de tres niveles** de cromo de moneda (global > convertido > original). Detalle verbatim: *Indicador de moneda default a nivel app (Fase 1.2.3 — extensión)* en `docs/design/specs-archive.md`.

### Símbolos de moneda por código — `$` ARS / `US$` USD (Fase 1.2.3 — extensión)

Cada moneda tiene su **símbolo propio** como prefijo de la cifra, para que cada monto sea **autosuficiente** (se lee qué moneda es sin depender del chip global). El símbolo es **cromo neutro de moneda** (regla viva 1.2.3): no se recolorea por moneda; hereda el color del número (que lo da el tipo income/expense, regla dura 1) y va en `mono tabular` junto a la cifra (regla dura 3).

**Tabla de símbolos — fuente de verdad única y centralizada** (ampliada a 4 monedas en Fase 1.2.4; ver *Monedas configurables — set curado ARS/USD/EUR/BRL*):

| Código | Símbolo | Ejemplo (formato es-AR) | Negativo |
|---|---|---|---|
| `ARS` | `$` | `$219.400,00` | `−$1.234,56` |
| `USD` | `US$` | `US$1.500,00` | `−US$1.234,56` |
| `EUR` | `€` | `€1.500,00` | `−€1.234,56` |
| `BRL` | `R$` | `R$1.500,00` | `−R$1.234,56` |

- **Por qué `US$` (y no `U$S`):** `US$` es el prefijo internacional inequívoco para dólar estadounidense, lee limpio como prefijo antes de la cifra y compone con el formato es-AR. `U$S` es grafía coloquial argentina, menos universal y rompe el patrón "símbolo + cifra"; se descarta.
- **Centralizado / extensible:** el símbolo por código vive en **un único punto** (un mapa `código → símbolo`, una sola fuente de verdad para toda la app, conceptualmente análogo al pool/matriz de colores). **Toda** cifra de dinero se formatea a través de ese único formateador; ningún componente arma el símbolo a mano. Sumar una moneda futura = agregar una entrada al mapa (no tocar componentes). La configurabilidad por el usuario (monedas creables) es fase futura aparte, fuera de este spec; este mapa deja la puerta abierta.

**Placement y composición (todas las cifras de dinero):**

- **Símbolo pegado a la cifra, prefijo, SIN espacio:** `$219.400,00`, `US$1.500,00`. No `$ 219.400,00`. Mismo `mono tabular` y mismo color que la cifra.
- **Signo (`−`/`+`) antes del símbolo:** orden `[signo][símbolo][cifra]` → `−$1.234,56`, `−US$1.234,56`. El `−` (U+2212) y el `+` heredan el color del monto (por tipo, nunca por signo — regla del signo en *Paleta y uso de tokens*). El símbolo de moneda no cambia esa regla.
- **Dónde aplica:** **todas** las cifras — totales/subtotales de `/mes`, montos de ítem (col 4), cards del Dashboard, balance hero, mini-balance, ejes y tooltips de reportes, montos de los forms (resultado del calculado, etc.). Cada cifra usa el símbolo de **su** moneda: las cifras convertidas a la default llevan el símbolo de la **default**; la línea de valor original del ítem cross-rate lleva el símbolo de la **moneda original**.

**Relación con el chip global y el badge/línea por-ítem (que NO se vuelvan redundantes):**

- **El chip global sigue vigente como CONTEXTO**, no como única desambiguación. Con símbolos distintos, cada número ya dice su moneda; el chip pasa a comunicar **el contexto de pantalla** ("todos los agregados están en {default}") y la **afordancia a `/configuracion`**. No es redundante: el símbolo desambigua número por número; el chip ancla el contexto global + el acceso al ajuste. Se mantiene siempre visible.
- **El badge de código por-ítem (`"USD"`) del ítem cross-rate se MANTIENE.** Aunque la línea original ya lleve `US$`, el badge identifica la moneda de origen del movimiento **junto al monto convertido** (que va en `$` de la default, sin símbolo distinto que delate el cross-rate). El badge marca "este ítem es cross-rate" de un vistazo en la celda del monto dominante; el `US$` de la línea original confirma la cifra en su moneda. No se contradicen: badge = etiqueta de origen junto al convertido; `US$` = símbolo de la cifra original.

> Detalle verbatim: *Símbolos de moneda por código — `$` / `US$` (Fase 1.2.3 — extensión)* en `docs/design/specs-archive.md`.

### Monedas configurables — set curado ARS/USD/EUR/BRL (Fase 1.2.4)

El set de monedas pasa de **2 (ARS/USD)** a **4 monedas curadas: `ARS`, `USD`, `EUR`, `BRL`**. **No introduce tokens, ni reglas, ni patrones nuevos:** extiende los patrones de moneda ya vigentes (1.2.3 y sus extensiones) para que **aguanten 4 valores** en vez de 2. La **regla dura "la moneda es cromo neutro"** se mantiene intacta: badge, código, símbolo, selector y cotización siguen en **neutros** (`--ink-2` / `--muted` / `--panel-3`), nunca income/expense (regla dura 1) ni índigo de marca (regla dura 2); el índigo sigue apareciendo solo como **cromo de interacción** (focus ring, thumb activo). Toda cifra sigue en **mono tabular** (regla dura 3).

**Alcance visible de producto (lo único nuevo que ve el usuario):** (a) el **selector de moneda crece a 4 opciones**; (b) **EUR y BRL aparecen** en el cromo de moneda (símbolo, badge, chip global, línea original) con el mismo tratamiento que ARS/USD. **La tabla de cotizaciones de referencia es interna y NO tiene UI** — no se define ninguna pantalla, fila de ajuste ni control para editarla. El único campo de cotización visible sigue siendo el del **bloque moneda+cotización del form** (1.2.3), sin cambios de mecánica.

#### 1. Selector de moneda con 4 opciones — sigue siendo el segmented neutro, ahora a 4 segmentos

El **segmented neutro de moneda** (1.2.3 — molde del triple switch de tipo de 1.2.1) **se mantiene como el control**, ampliado de 2 a 4 segmentos. Se eligió **no** cambiar a dropdown: 4 códigos cortos (todos de 3 caracteres, `mono`) caben en un segmented, y el segmented mantiene **todas las opciones visibles de un vistazo** (coherente con el resto de selectores neutros del DS). Un dropdown escondería 3 de 4 monedas y rompería el patrón establecido. Aplica **idéntico** en el bloque del form y en la tarjeta de ajuste de `/configuracion`.

- **Forma y tokens (sin cambios respecto de 1.2.3):** track `--panel-3`, radio `--r-pill`, padding interno `2px`. Segmentos de **ancho igual** (ahora **4** segmentos de `25%` cada uno, antes 2 de `50%`), texto `13px`/`600` `mono` `tracking-[0.01em]`, padding `px-[14px] py-[6px]`, radio `--r-pill`. El **thumb deslizante** (`--panel` + `--shadow-sm`) se posiciona ahora entre **4** posiciones: `left = calc(${(selectedIndex / 4) * 100}% + 2px)`, `width = calc(25% - 4px)`, misma transición `[left,width]` `140ms ease-out` (instantánea con `prefers-reduced-motion`).
- **Estados (sin cambios):** *seleccionado* = thumb `--panel` + `--shadow-sm`, texto `--ink`. *No seleccionado* = `--muted` → `--ink-2` en hover. *Disabled* = `opacity-50` + `cursor-not-allowed` (el set completo, ej. mientras persiste el cambio de default en `/configuracion`). *Focus (teclado)* = ring `--accent-soft` 3px sobre el segmento activo. **Sin color semántico ni índigo en los segmentos** (regla dura "la moneda es cromo neutro").
- **A11y (sin cambios):** `role="radiogroup"` + 4 `role="radio"` con `aria-checked`; flechas ←/→ ciclan por los 4 (el wrap módulo ya contempla `CURRENCIES.length`, no estaba hardcodeado a 2).
- **Etiquetas:** `"ARS" / "USD" / "EUR" / "BRL"` en `mono`. **Orden vigente:** `ARS → USD → EUR → BRL` (ARS/USD primero por back-compat y peso de uso; EUR/BRL después). Mismo orden en el form y en `/configuracion`.
- **Responsive / mobile — el punto a vigilar:** en `/configuracion` el segmented vive a la **derecha de la fila de ajuste** (`flex justify-between`), con holgura; 4 segmentos cortos entran sin problema en desktop. El caso ajustado es el **bloque del form**, donde el segmented ocupa **la mitad** del `grid grid-cols-2` (comparte fila con Cotización) y en mobile el form se angosta. Regla de comportamiento a cumplir:
  - El segmented **nunca hace scroll horizontal interno** ni recorta etiquetas. Las 4 etiquetas son cortas (3 chars `mono`); para ganar espacio cuando la columna se angosta, el segmented **puede reducir el padding horizontal de los segmentos** de `px-[14px]` hacia un mínimo de `px-[8px]` (manteniendo `py-[6px]`, el thumb y los tokens), antes que apretar el texto. El texto se mantiene a `13px`; **no** se reduce el tamaño de fuente ni se truncan códigos.
  - Si en el viewport más angosto soportado el `grid grid-cols-2` dejara el segmented sin aire para las 4 etiquetas legibles, el bloque moneda+cotización **colapsa a una sola columna apilada** (Moneda arriba, Cotización abajo, mismo `gap`), dándole al segmented el **ancho completo del form**. Es el mismo recurso de apilado que ya usa el DS cuando dos campos no caben en 2-col; **no** se inventa un control nuevo ni se cambia el segmented por otra forma. (El breakpoint exacto lo resuelve `control-frontend` midiendo; el comportamiento a cumplir es: 4 etiquetas siempre legibles, sin recorte ni scroll, apilando si hace falta.)

#### 2. Símbolos y presentación de EUR (€) y BRL (R$) — dos entradas más en el mapa único

Cada moneda nueva entra al **mapa `código → símbolo`** (fuente de verdad única, *Símbolos de moneda por código*) como una entrada más. **Ningún componente arma el símbolo a mano:** todo el cromo (símbolo en cifras, badge por-ítem, chip global, línea original) consume ese mapa. Símbolos vigentes para las 4:

| Código | Símbolo | Ejemplo (formato es-AR) | Negativo |
|---|---|---|---|
| `ARS` | `$` | `$219.400,00` | `−$1.234,56` |
| `USD` | `US$` | `US$1.500,00` | `−US$1.234,56` |
| `EUR` | `€` | `€1.500,00` | `−€1.234,56` |
| `BRL` | `R$` | `R$1.500,00` | `−R$1.234,56` |

- **Por qué `€` y `R$`:** `€` es el símbolo universal e inequívoco del euro, prefijo limpio antes de la cifra. `R$` es el prefijo estándar del real brasileño (no `R `, no `BRL `); lee como prefijo y compone con el formato es-AR. Ambos componen igual que `$`/`US$`: **prefijo pegado a la cifra, SIN espacio** (`€1.500,00`, `R$1.500,00`), mismo `mono tabular`, mismo color que la cifra (heredado del tipo). Signo antes del símbolo: `[signo][símbolo][cifra]` → `−€1.234,56`, `−R$1.234,56`.
- **Presentación idéntica a ARS/USD — sin tratamiento especial por moneda:** EUR y BRL **no** se recolorean, **no** cambian de tipografía ni de peso, **no** llevan bandera ni código de país. El símbolo es cromo neutro: no tiñe distinto por moneda; hereda el color del número. Donde ARS/USD aparecen hoy, EUR/BRL aparecen igual:
  - **Chip global de moneda default (`CurrencyChip`):** mismo molde (glifo `Wallet` 13px `--muted` + código en `mono` 11.5px·600·`.04em` `--ink-2`, caja `--panel-3` `--r-chip`). Muestra `"EUR"` / `"BRL"` como código sin ningún cambio. `aria-label` con el código nuevo.
  - **Ítem de `/mes` (`MovementItemRow`), cross-rate:** el **badge de moneda original** muestra `"EUR"` / `"BRL"` (mismo chip neutro `--panel-3` / `--muted` / 11px·600·`.04em` `mono`); la **línea de valor original** subordinada muestra la cifra con el símbolo de su moneda (ej. `€100,00`, `R$350,00`) en *Meta/subtítulos* 12.5px/500 `--muted` `mono`. El **monto convertido dominante** sigue en el símbolo de la **default** del usuario (que ahora puede ser cualquiera de las 4). Jerarquía intacta: global > convertido dominante > original subordinado; ningún nivel se tiñe.
  - **Totales, cards de Dashboard, balance hero, mini-balance, ejes/tooltips de reportes, montos de forms:** cada cifra usa el símbolo de **su** moneda vía el mapa; las cifras convertidas a la default llevan el símbolo de la default. Nada más cambia.

#### 3. Bloque de cotización del form — aguanta las 4 monedas, mecánica del input sin cambios

El **input de cotización** (1.2.3) **no cambia su mecánica interna**: misma caja `rounded-ctl border-[1.5px]`, prefijo de par en `mono` 12px `--muted`, input `mono` 15px/600, nota *field-note* "Cotización de referencia del mes" / "Cotización modificada", validación `> 0` con borde `--expense` + ring `--expense-soft`. Lo que cambia es **de dónde sale el valor pre-cargado**: ahora viene de la **tabla de referencia interna**. **Eso es invisible visualmente** — el campo sigue siendo editable y la presentación es la misma. *(Lo que sí cambia es el **encuadre** del bloque: pasa a vivir dentro de un disclosure y el input se oculta cuando moneda=default — ver §4 abajo.)*

- **Confirmación de que la presentación aguanta 4 monedas:** el **prefijo de par** (ej. `"USD→ARS"`) ahora puede combinar cualquiera de las 4 (`"EUR→ARS"`, `"BRL→USD"`, etc.). Son códigos de 3 chars `mono`; el prefijo `XXX→YYY` (7 chars) entra en la caja sin recortar (`shrink-0`, `select-none`). La nota *field-note* y el input no cambian. **No** se agrega tratamiento por moneda al bloque.
- **La nota de pre-carga ("Cotización de referencia del mes") se mantiene tal cual:** comunica que el valor viene pre-cargado y es editable. Glifo `History` 12px `--muted` + texto `--muted`; al editar pasa a "Cotización modificada" en `--ink-2` (sin glifo). **No** se define copy nuevo que delate la tabla interna; la regla de oro prohíbe inventar copy/estados no especificados.

#### 4. Bloque moneda+cotización colapsable + caso moneda=default (Fase 1.2.4)

Dos decisiones cerradas por el usuario sobre el bloque del form (`CurrencyExchangeBlock`, compartido por transaction-form / recurring-form / installment-form):

**(A) El bloque completo pasa a vivir dentro de un disclosure colapsable.** Mismo lugar de hoy: **debajo del campo Monto, antes de Categoría**. Reutiliza el **patrón disclosure** ya vigente del *Acordeón* (cabecera = único `<button>` con `aria-expanded` + `aria-controls`, chevron que rota, animación altura 0↔auto + fade), aplicado acá a un bloque de form (no a una sección de lista).

- **Trigger (la cabecera del disclosure):** fila `<button>` **al aire** (sin caja de input), `w-full flex items-center gap-[7px]`, padding `py-[7px]` (alto cómodo de click, alineado al ritmo del form). Contenido de izq → der:
  - **Chevron:** `ChevronRight` (lucide) **16px** `stroke-width 2`, **primer elemento**, `--muted` en reposo. Único glifo que **rota**: colapsado → ▶ (0°); expandido → ▼ (90°). Mismo lenguaje que el chevron del *Acordeón*.
  - **Label (copy exacto):** **"Moneda y cotización"**. Tipografía: **13px / 600**, `--ink-2` en reposo, `tracking-[0.01em]`, fuente UI (Space Grotesk). Se elige "Moneda y cotización" (no "Configuración avanzada") porque nombra **exactamente** el contenido del disclosure y es coherente con el rótulo del bloque y los labels del form ("Moneda", "Cotización"); "Configuración avanzada" es genérico y no dice qué hay adentro.
  - **Resumen a la derecha (colapsado):** cuando el disclosure está **colapsado**, mostrar al final de la fila (tras un `flex-1` divisor) un **resumen de un vistazo** de lo que hay configurado: el **código de moneda** seleccionado en **`mono` 12px `--muted`** (ej. `"ARS"`, `"USD"`). Si `moneda ≠ default`, sumar la cotización: `"USD · 1.480,00"` (código + `·` separador `--faint` + valor mono `--ink-2`). Si `moneda == default`, solo el código (`"ARS"`). Es el equivalente al "resumen visible al colapsar" del *Acordeón* (pill+subtotal): comunica el estado sin expandir. Al **expandir**, el resumen se oculta (su info ya está en los controles abiertos).
- **Estados del trigger** (mismo set que el disclosure del *Acordeón*):
  - **Reposo:** chevron `--muted`, label `--ink-2`, resumen `--muted`/`--ink-2`. `cursor: pointer`.
  - **Hover** (sobrio, sin fondo en la fila): chevron → `--ink-2`, label → `--ink`, transición 0.14s.
  - **Focus (teclado):** ring `--accent-soft` 3px con radio `--r-chip` 7px (`focus-visible`).
  - **Expandido:** chevron en ▼; sin cambio de color de fondo (la fila sigue al aire).
- **Arranca SIEMPRE colapsado.** Sin excepciones: también en **modo edición**, aunque el movimiento ya tenga `moneda ≠ default` y una cotización cargada. **Nunca auto-expandido.** El resumen colapsado (que muestra `"USD · 1.480,00"`) es suficiente para que el usuario vea de un vistazo que hay una moneda no-default configurada, sin forzar la apertura.
- **Animación de apertura:** altura del cuerpo 0↔auto (con `overflow: hidden`) + fade + rotación del chevron, **0.22s ease-out** (idéntico al *Acordeón*). Respeta **`prefers-reduced-motion`**: apertura/cierre **instantáneos** (sin transición de altura ni fade), el chevron cambia de orientación sin animar.
- **Spacing:** el trigger va separado del campo Monto (arriba) y del campo Categoría (abajo) con el **gap estándar entre campos del form** que ya usan esos forms (no se inventa un valor nuevo; el bloque ocupa el mismo slot que hoy ocupaba el grid moneda+cotización). El **cuerpo expandido** abre con `mt-[7px]` respecto del trigger (separa el chevron/label del contenido), y mantiene su `gap` interno actual.

**(B) Cuando `moneda == default`, el campo Cotización se OCULTA.** Se **deroga** el `buildPairLabel` que inventaba un par contra "la primera otra moneda" y mostraba una cotización de referencia sin significado (líneas ~49-56 del componente): ese caso ya no muestra cotización inventada. El backend ignora `exchangeRate` cuando `currency === anchorCurrency`, así que el form envía `exchangeRate = 1` sin afectar cálculos.

- **Contenido del cuerpo expandido según la moneda seleccionada:**
  - **`moneda == default`:** el cuerpo muestra **solo el selector de moneda**, a **ancho completo** del form (el `grid grid-cols-2` se reemplaza por una sola columna full-width; el `CurrencySegmented` deja de usar `compact=true` porque ya no comparte fila — dispone de todo el ancho, con `px-[14px]` normal en sus segmentos). **No** se renderiza el label "Cotización", ni la caja del input, ni el prefijo de par, ni la nota *field-note*. Queda: label "Moneda" + segmented a 4, nada más.
  - **`moneda ≠ default`:** el cuerpo muestra el **grid `grid-cols-2 gap-[14px]`** de hoy → col izq selector de moneda (`compact=true`, mitad de ancho) + col der el input de cotización completo (prefijo de par real `"USD→ARS"` etc., nota *field-note*, validación). Es el bloque tal cual 1.2.3, sin el caso inventado.
- **Transición al cambiar moneda dentro del disclosure abierto:** cuando el usuario pasa de `default` a `≠ default` (o viceversa) con el disclosure **abierto**, la **columna de cotización aparece/desaparece** y el selector pasa de full-width a media-columna (y al revés). El cambio es **sobrio**: el selector reflowea a su nuevo ancho y la columna de cotización hace **fade + leve expansión de ancho** acompañando el reflow del grid (≈0.14–0.18s, mismo orden que las transiciones de hover/segmented del DS). Con **`prefers-reduced-motion`**: el cambio es **instantáneo** (aparece/desaparece sin fade ni transición de ancho). No se anima la altura del disclosure en este cambio (el disclosure ya está abierto); solo reflowea su contenido.
- **El resumen colapsado refleja este caso:** si moneda=default, el resumen es solo el código (no hay cotización que mostrar); si moneda≠default, suma `· {cotización}`. Coherente con que el campo solo existe cuando moneda≠default.

> **Esta sub-sección DEROGA explícitamente** la regla previa de 1.2.3 "el campo Cotización va SIEMPRE presente y editable, también cuando moneda=default; no se oculta ni se colapsa". A partir de 1.2.4: (1) el bloque vive en un **disclosure colapsado por default** (también en edición), y (2) cuando **moneda=default el campo Cotización se oculta** (queda solo el selector, a ancho completo). El requisito del roadmap de "capturar siempre la cotización" se cumple igual: en moneda=default el backend usa `exchangeRate = 1` (no necesita captura); cuando moneda≠default el campo sigue presente, editable y validado `> 0`.

> **Lo que este spec NO toca (por diseño):** no hay UI para la tabla de cotizaciones de referencia (es interna); no se agrega fila de ajuste a `/configuracion` (su única tarjeta sigue siendo "Moneda por defecto", ahora con 4 opciones en el segmento); no se crean tokens, colores ni reglas; no se cambia la mecánica del bloque de cotización. Todo el cromo de las 4 monedas sale de extender el **mapa de símbolos** y el **array de monedas del segmented** — puntos únicos ya centralizados.
>
> Detalle verbatim: este spec se archiva como *Monedas configurables — set curado ARS/USD/EUR/BRL (Fase 1.2.4)* en `docs/design/specs-archive.md`.

---

## Índice de specs archivadas

Las specs visuales puntuales de cada fase ya implementada se conservan **verbatim** en `docs/design/specs-archive.md` (trazabilidad). El lenguaje vivo que salió de ellas está consolidado arriba.

| Spec archivada | Fase | Estado | Patrón vigente derivado (arriba) |
|---|---|---|---|
| Fijos extendidos | 1.1.1 | Vigente | (specifica del ítem fijo / form de fijo; no es patrón transversal) |
| Picker de color de categoría | 1.1.2 | Vigente | *Picker de color de categoría*; consume la *matriz de colores* (lenguaje vivo) |
| Gráfico anual — spec del widget | — | Gráficas vigentes; **encuadre superado por 1.1.5** | *Card de reporte* (encuadre); las gráficas se reutilizan tal cual |
| Navegación de período — flechas laterales | 1.1.3 | Vigente | *PeriodNav* |
| Vista del mes — secciones colapsables + reordenables | 1.1.4 | Vigente | *Acordeón* |
| Reportes configurables | 1.1.5 | Vigente | *Card de reporte*, *Filtro de categorías embebido*, control de año embebido (forma compacta de *PeriodNav*) |
| Movimientos calculados | 1.1.7 | Vigente | *Metadatos de relación en la sublínea del ítem de `/mes`* (chips padre/hijo); regla del **signo del monto** (negativo/cero, en *Paleta y uso de tokens*); form de calculado y acción del kebab (específicos de fase, no transversales) |
| Calculados de único y cuota | 1.1.8 | Vigente | *Metadatos de relación…* extendido a Únicos/Cuotas (mismo chip/marca padre-hijo, transversal al origen); calculado de cuota **sin** "X/N" |
| Filtros por listado en `/mes` | 1.2.1 | Vigente | *Filtros por listado en `/mes` — controles de sección*; reutiliza *Filtro de categorías embebido*; aporta el **triple switch de tipo** (segmented neutro) |
| Multi-moneda ARS/USD + `/configuracion` | 1.2.3 | Vigente | *Multi-moneda ARS/USD — cromo neutro de moneda y cotización*; aporta el **badge de código de moneda** (chip neutro), el **par moneda+cotización** en formularios, la **línea de valor original** subordinada al monto convertido en el ítem de `/mes`, y la **tarjeta de ajuste** + **segmented neutro ARS/USD** de `/configuracion`; reutiliza el segmented neutro de 1.2.1 (a 2 opciones, sin semánticos), los chips neutros de la sublínea (1.1.7) y el link de sidebar; nueva **regla dura: la moneda es cromo neutro** (nunca semántico ni de marca) |
| Indicador de moneda default a nivel app | 1.2.3 (ext.) | Vigente | *Indicador de moneda default a nivel app*; aporta el **chip de moneda default global** (glifo `Wallet` + código mono neutro + link a `/configuracion`), su **ubicación canónica** en el `.phead` de Dashboard / `/mes` / `/reportes` (no en `/configuracion`), y la **jerarquía** de cromo de moneda (símbolo por cifra > global > convertido dominante > original subordinado); reutiliza el badge de código de moneda y la regla viva *la moneda es cromo neutro* de 1.2.3; indicador **informativo CERRADO** (no interactivo) |
| Símbolos de moneda por código | 1.2.3 (ext.) | Vigente | *Símbolos de moneda por código — `$` ARS / `US$` USD*; aporta el **símbolo distinto por moneda** (prefijo pegado a la cifra, neutro/heredando color del monto, mono tabular) desde un **mapa `código → símbolo` único y centralizado** (extensible a monedas futuras); reafirma *la moneda es cromo neutro*; mantiene chip global (contexto) y badge de código por-ítem (origen del cross-rate) sin redundancia |
| Monedas configurables — set curado ARS/USD/EUR/BRL | 1.2.4 | Vigente | *Monedas configurables — set curado ARS/USD/EUR/BRL*; **no aporta tokens/reglas/patrones nuevos**: extiende los de 1.2.3 a **4 monedas**. Amplía el **segmented neutro de moneda** de 2 a **4 segmentos** (thumb `25%`, padding colapsable `px-[14px]`→`px-[8px]`, apilado del bloque moneda+cotización si no caben en 2-col en mobile) y suma **`EUR`→`€`** y **`BRL`→`R$`** al **mapa único de símbolos**; presentación de EUR/BRL idéntica a ARS/USD en chip global, badge por-ítem, línea original y todas las cifras. **Encuadra el bloque moneda+cotización del form en un disclosure colapsable** ("Moneda y cotización", chevron, animación 0.22s, arranca siempre colapsado incl. en edición, resumen moneda·cotización al colapsar) y **deroga "cotización siempre visible"**: cuando **moneda=default el campo Cotización se oculta** (queda solo el selector a ancho completo); reutiliza el patrón disclosure del *Acordeón*. Input de cotización sin cambios de mecánica (pre-carga viene de la tabla de referencia interna, invisible). **Sin UI para la tabla de referencia** (interna) |
| Toggle de vista en la card `income-expense` | 1.2.2 | Vigente | *Toggle de vista en la card `income-expense`*; reutiliza las líneas/degradés income/expense (Forma 1) y los separadores/orden de apilado (Forma 2); aporta el patrón nuevo de **tabs underline neutras** (deroga el segmented de 2 segmentos) y la **vista B de un único stack de gastos por categoría** (línea de contorno rojo = firma; bandas = `category.color` identificador) |
