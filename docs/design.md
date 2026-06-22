# Guía de diseño — Control

> Guía **viva** del lenguaje visual de Control. Es la versión **curada y vigente** de cómo se ve el producto: la fuente de verdad de las decisiones visuales que `control-design` mantiene y que `control-frontend` implementa.
>
> **Relación con los otros documentos de diseño:**
> - **`docs/design/`** — handoff crudo "Precise Ledger" (`control.css` + `README.md`): el material de origen del prototipo, con todos los valores y la racional. Es la referencia de donde sale esta guía; no se edita.
> - **`docs/frontend.md`** (secciones Design system) — cómo los tokens están **implementados** en el código (Tailwind v4, dualidad `@theme`/`:root`, qué está portado). El "cómo" técnico.
> - **`docs/design.md`** (este documento) — el "qué" visual vigente: paleta, tipografía, espaciado, geometría, jerarquía, los **patrones de componentes vigentes** y las reglas duras. Ante un conflicto con el handoff crudo, prevalece lo cerrado acá.
>
> Sistema: **"Precise Ledger"**, modo claro, densidad Medio, acento Índigo. (Dark mode y densidad variable no están en v1.)

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

**`warning` (ámbar, hue 75)** — token semántico: `--warning` `oklch(0.72 0.15 75)`, `-soft` `oklch(0.95 0.05 75)`, `-ink` `oklch(0.52 0.12 75)`. Sigue la misma dualidad `@theme`/`:root` que income/expense. Se usa para avisos (advertencia, no error).

**El color de un monto lo da el TIPO (ingreso/gasto), no el signo del valor.** Existen montos **negativos o cero** (solo en movimientos calculados). El signo se comunica con el **prefijo `−`** (signo menos `U+2212`) delante de la cifra (`−$1.234,56`); el cero es `$0,00`. **Nunca** se recolorea un monto por ser negativo: un gasto con monto negativo sigue en color de gasto (recolorear por signo rompería la regla dura 1).

**Tipo derivado del signo (movimientos calculados).** En el **calculado**, el tipo **no se elige**: se **deriva del signo del monto final** — positivo → **Ingreso** (verde), negativo → **Gasto** (rojo), cero → **Gasto** (convención de borde). Por eso el form del calculado **no tiene control "Tipo"**: el tipo se **comunica como lectura** dentro del bloque "Resultado" (cifra con su color por tipo + **badge de tipo** tintado: "Gasto" `--expense-ink`/`--expense-soft`, "Ingreso" `--income-ink`/`--income-soft`), recalculado en vivo. El **control de signo** se mantiene **neutro** (segmented sin color semántico): el verde/rojo va sobre la **lectura del tipo** (cifra + badge), nunca sobre el control. El color sigue al tipo, y en el calculado el tipo sigue al signo.

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

## Paleta de colores para categorías

El usuario **elige y edita** el color de una categoría —tanto al crear como al editar— desde una **matriz de colores tipo Office** (sin entrada de hex libre). El pool de 10 de `backend/src/categories/color-pool.ts` es **una fila identificable de la matriz** (la fila base T4), para back-compat de las categorías ya pintadas.

### Regla dura

El color de categoría es **solo un identificador de categoría** (swatch en la lista, bandas del apilado de la Forma 2 del gráfico, swatch en leyendas). **Nunca** tiñe un monto ni comunica ingreso/gasto — eso lo hacen income/expense (regla dura 1). La matriz está construida para **no chocar** con los semánticos ni con la marca: ningún hex de la matriz es el verde income (`#1f8a5b`), el rojo expense (`#c64637`) ni el índigo de acento.

### La matriz — fuente de verdad compartida (10 base × 7 tonalidades)

La matriz es la **única fuente de verdad** del set de colores elegibles: el backend la usa para **validar** que el color recibido pertenezca a la matriz, y el frontend para **renderizar** el picker. Cualquier hex fuera de esta lista es inválido.

- **Estructura:** 7 **filas** (T1 = más clara, arriba → T7 = más oscura, abajo) × 10 **columnas** (un hue por columna, en el **orden del pool**: azul, naranja, verde, violeta, amarillo, turquesa, rosa, azul grisáceo, marrón, verde menta).
- **Fila base = pool:** la fila **T4** es **exactamente** el pool de 10 colores de `color-pool.ts`, en su orden original. Es la fila "media" de cada columna y la que hace back-compat: una categoría ya pintada con un color del pool cae sobre un swatch de T4, que el picker resalta como seleccionado.
- **Total:** 70 swatches. Todos los hex son explícitos abajo (no se derivan en runtime: esta tabla **es** la fuente).
- **Cálculo del "menos usado" (default al crear):** se mantiene tal cual hoy — sobre los **10 colores base de la fila T4** (no sobre los 70). El sistema preselecciona el color base menos usado entre las categorías activas; el usuario puede cambiarlo a cualquiera de los 70.

**Orden de columnas (índice → hue, igual a `color-pool.ts`):**

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

**Matriz de hex (filas T1→T7 de claro a oscuro; T4 es el pool, resaltada):**

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
T4: #4F86C6 #E07B54 #6DBF67 #A98BD6 #E8C84A #5BC4B8 #E06B8B #8B9DBF #C47D3E #7DBF9E   ← pool (back-compat)
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

> Patrones de componente **reutilizables y vigentes**, parte del lenguaje visual del producto: el patrón canónico, sus valores clave y sus reglas.
>
> Los **gráficos** (Forma 1 — área de ingresos vs. gastos; Forma 2 — barras apiladas por categoría), con sus ejes, gridlines, leyenda, tooltip, altos de canvas y mapeos de color, se definen en *Gráficos — Forma 1 y Forma 2* (abajo). El encuadre que los rodea (cómo se montan en pantalla) vive en *Card de reporte*.

### Cierre de overlays — modales vs. popovers

Dos comportamientos de cierre, según el tipo de overlay:

- **Modales / diálogos** (transaction-modal, category-form-modal y los diálogos de confirmación de borrado — transaction / recurring / installment / category): se cierran **únicamente con el botón ✕ y con `Esc`**. El click en el scrim/backdrop **no** cierra. Son superficies que demandan una decisión explícita; no se descartan por click accidental afuera.
- **Popovers** (filtro de categorías, filtro de sección, menú de tipo de reporte): se cierran por **clic fuera / `Esc` / re-clic**. Son auxiliares y livianos; descartarlos al tocar fuera es lo esperado.

### PeriodNav — navegación de período (flechas gigantes laterales + modo `.stepper`)

Patrón **genérico** para navegar un período (mes o año): `‹ contenido ›`, donde **‹ va al período anterior y › al siguiente**. Recibe un rótulo de período ya formateado, handlers anterior/siguiente y dos flags `canGoPrev` / `canGoNext`. **Mismo componente, distinto período.** Tiene **dos formas**:

- **Forma lateral (canónica, a ancho de página):** layout de **3 columnas** `[ ‹ ] [ contenido ] [ › ]` (`grid-template-columns: auto minmax(0, 1120px) auto`, `mx-auto`), con las flechas en columnas propias que flanquean el contenido (simetría del **contenido**, no del viewport). Cada flecha: `button` circular **64×64px**, glifo `ChevronLeft`/`ChevronRight` (lucide) **46px** `stroke-width 1.75`, **sin fill** en reposo, glifo `--faint`. Aire flecha↔contenido 20px. **Vigente en `/mes`** (período = mes; flags siempre `true`) y en **reportes** (mismo patrón).
  - **Centrado vertical de las flechas:** la flecha está **centrada verticalmente en el VIEWPORT**, siempre, sin importar el largo del listado, y **permanece anclada al centro del viewport** mientras se hace scroll y con cualquier cantidad de contenido. El mecanismo técnico exacto lo resuelve control-frontend (p. ej. garantizar que el área de las celdas laterales tenga alto suficiente —`min-height` del viewport— para que el anclaje pueda centrar también con listas cortas); el **comportamiento visual a cumplir** es: flecha centrada verticalmente en el viewport, constante al scrollear, con cualquier cantidad de contenido.
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

### Acordeón — sección colapsable + reordenable

Patrón **genérico reutilizable** de "sección de acordeón" = **cabecera (`.ghead`) + cuerpo (tarjeta-lista)**, que se colapsa/expande individualmente y se reordena entre pares por drag. Vigente en `/mes` (Únicos / Fijos / Cuotas), instanciable N veces en otras pantallas. **Construido SOBRE el look existente de la `.ghead`**, sin reemplazarlo.

**Cabecera colapsable (disclosure):**

- Toda la `.ghead` es el control que colapsa/expande su cuerpo (un único `button`, `aria-expanded` + `aria-controls`). Sigue siendo la misma fila "al aire" (sin caja).
- **Chevron:** `ChevronRight` (lucide) **16px** `stroke-width 2`, **primer elemento** de la fila, `--muted` en reposo. Un único glifo que **rota**: **expandida** → apunta ▼ (90°); **colapsada** → apunta ▶ (0°).
- **Estados:** *reposo* = `.ghead` de hoy + chevron `--muted`. *Hover* (sobrio, sin fondo en la fila): chevron → `--ink-2`, rótulo → `--ink`, transición 0.14s. *Focus*: ring `--accent-soft` 3px con radio `--r-chip` 7px.
- **Resumen visible al colapsar:** el pill contador y el subtotal mono **permanecen visibles** colapsados (es la info de resumen de un vistazo). Solo se oculta el cuerpo y el chevron rota a ▶.

**Animación:** altura del cuerpo 0↔auto (con `overflow: hidden`) + fade + rotación del chevron, **0.22s ease-out**. Respeta `prefers-reduced-motion` (instantáneo).

**Sección vacía:** las secciones se renderizan **siempre** (también vacías). Cabecera completa con contador `0` y subtotal en cero. Cuerpo (expandido): caja `rounded-card border border-dashed border-line bg-panel-2`, padding `px-6 py-6`, una línea centrada *Meta/subtítulos* (12.5–13px, `--muted`). El borde **dashed** = "acá todavía no hay nada".

**Modo orden (reordenar secciones, no ítems):** acción deliberada vía un **modo explícito**, no handles permanentes. Colapso transitorio al entrar + drag in-place sin overlay flotante.

- **Disparador:** botón ghost del DS en el `.phead`, ícono `ArrowUpDown` 15px, "Ordenar secciones". Al entrar se transforma en **"Listo"** (primario índigo); "+ Nuevo movimiento" se deshabilita mientras dura el modo. El botón **"Listo" (primario índigo) es la única señal de "modo edición activo"** — no se agrega chrome adicional (ni banner, ni borde de página).
- **Colapso transitorio al entrar:** al **entrar** en modo orden **todas las secciones se colapsan** — se reordenan solo las **cabeceras** (`.ghead`), nunca los cuerpos expandidos. Es la lista limpia de cabeceras: una debajo de otra, cada una con su handle + chevron (en ▶, colapsado) + rótulo + pill contador + línea + subtotal, sin cuerpo visible. Este colapso es **puramente visual y transitorio**: **no** se persiste ni pisa la preferencia de colapso del usuario. Al **salir** del modo (botón "Listo") se **restaura exactamente el estado de colapso previo** que el usuario tenía antes de entrar (las que estaban expandidas vuelven a expandirse). La animación de colapso/expansión usa la misma transición del acordeón (0.22s ease-out; instantánea con `prefers-reduced-motion`).
- **Handle:** `GripVertical` (lucide) 16px `--muted` a la izquierda del chevron, `cursor: grab`/`grabbing`. Motor: **dnd-kit**. Durante el modo, la cabecera **no** colapsa al clic (está dedicada a arrastrar; el chevron se ve, siempre en ▶ por el colapso transitorio, pero no es accionable).
- **Drag in-place — el ítem NO flota:** la cabecera arrastrada **no se despega del contenedor** ni sigue libremente al mouse. Se **desliza únicamente en el eje vertical dentro del box de la lista** (transform de traslación Y, sin overlay flotante). **No se usa `DragOverlay`**: no hay un clon que flote y el original no se oculta. El feedback de "ítem activo" se aplica **sobre la propia cabecera** mientras se desliza:
  - **Ítem activo (la cabecera que se arrastra):** elevación `--shadow-md`, fondo `--panel` (sale del "al aire" y toma una superficie para leerse elevado sobre las demás), radio `--r-ctl` 10px, **sin** `scale` (al moverse in-place, escalar lo despegaría visualmente; el ancho se mantiene 1:1 con la columna). Opacidad plena (`opacity: 1`). `cursor: grabbing`.
  - **Las demás cabeceras:** opacidad plena, se **desplazan suave** (transición 0.14–0.22s) para abrir el hueco mientras el ítem activo pasa por su posición. No se atenúan.
  - **Indicación del destino:** el desplazamiento de las demás cabeceras (que abren el hueco donde caerá el ítem) **es** la indicación de inserción; al moverse in-place y a ancho completo, no se dibuja una caja-hueco dashed separada. El hueco se lee como el espacio que dejan las cabeceras al correrse.
  - **Padding interno del recuadro activo:** la cabecera "al aire" no tiene padding superior (su fila vive con `px-1 pb-[10px]`, sin `pt`), por el ritmo entre secciones (`space-y-[30px]`). Al volverse recuadro elevado (`--panel` + `--shadow-md` + `--r-ctl` 10px), el recuadro activo lleva un **padding interno propio de `10px` en los cuatro lados** (`var(--space-10)` / `10px`) para que el contenido no toque el borde y quede equilibrado con el radio `--r-ctl` 10px. Este padding **se aplica solo mientras el ítem está activo/arrastrándose** (junto con el fondo/sombra/radio del estado activo), **nunca en reposo** — el espaciado normal entre secciones (`space-y-[30px]`) no cambia. Se aplica en el **wrapper del ítem activo** (no en la cabecera), para no alterar la fila "al aire" en reposo. Como la fila ya trae `pb-[10px]`, el resultado visual abajo es mayor que arriba/lados; eso es **aceptable** (el recuadro se lee equilibrado y centrado); no se compensa restando el `pb` de la cabecera.
- **Salida:** "Listo" vuelve a "Ordenar secciones", **restaura el colapso previo** (ver arriba) y aplica el orden en vivo (sin "cancelar" en v1).

> El **dashed = espacio reservado / para agregar** es lenguaje transversal: se usa en la sección vacía, el hueco de drag del acordeón y el recuadro "[+]" de `/reportes`.

### Card de reporte — widget de gráfico autónomo

Unidad que `/reportes` apila y que el Dashboard monta una vez. Es la **tarjeta `.card` de gráfico** (panel, `--line`, `--r-card` 14px, `--shadow-sm`, padding `--card-pad` 22px) con **controles embebidos**. Estructura: cabecera (identidad a la izquierda; barra de controles a la derecha) → área de gráfico → leyenda. Altos de canvas vigentes: **300px** (cards de `/reportes`) / **280px** (Dashboard); **220px** en ≤940px.

- **Identidad (izquierda):** eyebrow *Eyebrow/labels* `--muted` **"Reporte"** + título 16px/600 `--ink` ("Ingresos y gastos" / "Por categoría").
- **Control de año embebido:** el `.stepper` de **PeriodNav** (forma compacta, arriba), año en **mono tabular**, con su estado **disabled** atado a `earliestYear` / año en curso. Navegación **activa** también en el Dashboard.
- **Filtro de categorías embebido:** ver *Filtro de categorías* abajo.
- **Quitar card (solo `/reportes`):** botón icon-only ghost `X` (16px), `--muted` → `--ink` sobre `--panel-2`, al final de la barra de controles, separado por un divisor `--hair` vertical. Abre una **confirmación inline** (popover `--panel`/`--line`/`--r-ctl`/`--shadow-lg`, "¿Quitar este reporte?", botón **danger** "Quitar" + ghost "Cancelar"). La card del Dashboard **no** es removible.

**Grilla en `/reportes`:** una sola columna a 1120px, cards separadas por `--gap` (18px); el **"[+]"** (recuadro dashed, ver abajo) siempre al final. Sin reordenar cards en v1.1.

**Recuadro "[+]" para agregar card:** recuadro **placeholder dashed** (`--panel-2`, borde dashed `--line`, `--r-card`, sin sombra), ícono `Plus` en círculo `--panel-3`, label "Agregar reporte". Compacto cuando hay cards (~120px); en versión grande preside el **estado vacío inicial** (~280px alto, ~480px ancho, centrado, "Armá tu primer reporte"). Al activarlo, **popover-menú de 2 opciones** (Ingresos y gastos / Por categoría) ancla la elección de tipo; la card nace en el año en curso con todas las categorías.

**Dashboard:** monta una card `income-expense` efímera con navegación de año activa, junto al resumen mensual (que es fijo en el mes en curso). La distinción la dan: bloques de forma distinta (resumen sin `.card` de gráfico vs. card de gráfico), distinto grano temporal (mes-rótulo fijo vs. año-stepper navegable) y el stepper scoped a la card.

> Las **gráficas** que montan estas cards se definen en *Gráficos — Forma 1 y Forma 2* (abajo).

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

- **Forma 1:** dos ítems — "Ingresos" (swatch `--income`) / "Gastos" (swatch `--expense`).
- **Forma 2:** un ítem por categoría con gasto en el año, en el mismo orden del apilado (mayor a menor), cada swatch con su `category.color`; sin agrupar ni colapsar.

#### Tooltip / hover (ambas formas)

- **Cursor de hover:** franja vertical `--accent-soft` translúcida (en barras) o guía vertical `--hair` 1px (en área). El `--accent-soft` acá es fondo de UI (resaltado de interacción), no tiñe montos.
- **Caja:** `--panel`, borde `--line`, `--r-ctl` (10px), `--shadow-lg`, padding 10px 12px.
- **Encabezado:** mes y año, UI 12.5px/600 `--ink` (ej. "Marzo 2026").
- **Filas:** una por serie/categoría visible en ese mes — swatch 8px + nombre (UI 12.5px `--ink-2`) a la izquierda, monto mono tabular (regla dura 3) a la derecha, formato es-AR completo sin abreviar. En Forma 1: ingresos `--income-ink`, gastos `--expense-ink` (el monto sí lleva color semántico). En Forma 2: el monto de cada banda en `--ink` (el color lo da el swatch, no el número). Orden de filas = orden del apilado/serie; categorías con valor 0 en el mes se omiten.
- **Total (Forma 2):** fila final separada por `--hair`, "Total gastos" + monto mono `--expense-ink` (es el total de gastos del mes — sí es expense).

#### Estados (área de gráfico)

- **Loading (skeleton):** la cabecera de la card ya presente; el área se reemplaza por bloque del alto del canvas, `bg-panel-3 rounded-ctl animate-pulse`; la leyenda muestra 2–3 chips fantasma (`bg-panel-3 animate-pulse`). Sin spinner.
- **Año sin movimientos (vacío):** los 12 meses se dibujan en cero (eje X completo, sin huecos); overlay centrado "Sin movimientos en {año}." (UI 14px `--muted`), sin ilustración ni error. La Forma 2 puede estar vacía aunque la Forma 1 tenga ingresos (Forma 2 es solo gastos).
- **Meses futuros (año en curso):** se dibujan en cero como cualquier mes vacío, sin tratamiento especial de "futuro". Los fijos/cuotas proyectados aparecen como datos normales.
- **Error:** ícono `AlertTriangle` (lucide) 20px `--warning-ink` + texto UI 14px `--ink-2` "No se pudo cargar el gráfico." + botón `.btn.ghost.sm` "Reintentar", centrado; fondo de card normal, sin tinte de error.

#### Movimiento

Las áreas/barras animan su *grow* de entrada (~0.4s ease-out). Respeta `prefers-reduced-motion` (`isAnimationActive={false}`: sin grow; tooltip sin transición).

### Sidebar de navegación global — padding superior del logo

La sidebar (`<aside>`, 248px) tiene padding vertical propio `py-[22px]` (de la escala de espaciado). El **logo** (bloque `<Link>` con el gem "C" + wordmark "Control / Finanzas del mes") es el primer elemento del contenido; debe abrir la columna con un aire superior **consistente** con el resto del espaciado, no pegado arriba.

- **Valor vigente:** el logo lleva `pt` de **`10px`**. Sumado al `py-[22px]` del `<aside>`, da un aire superior total de **32px** (22 + 10) por encima del gem — un valor de la escala (32) que equilibra contra el `pb-[18px]` inferior del logo y el ritmo de la lista de nav que sigue.
- **Dónde se aplica:** se ajusta el **`pt` del `<Link>` del logo** (10px), **no** el `py` del `<aside>`. El `py-[22px]` del `<aside>` es el padding estructural de la columna (vale igual arriba y abajo, y para desktop y drawer mobile) y no se toca; el aire fino del logo es responsabilidad del propio bloque del logo. El `pb-[18px]` del logo no cambia.

### Logo de marca — ícono real (gem) en sidebar y login

El logo es el **ícono de marca real** exportado. El glifo es una **rueda/timón** (círculo con 6 radios + nodos, blanco sobre fondo azul con gradiente). Vive en **dos contextos**: el gem del sidebar y el chip del login.

**Asset canónico vigente.**

- **Imagen del gem (con su fondo azul):** `frontend/src/app/icon.svg` (= `docs/design/icon-export/Control-icon.svg`, idénticos). SVG cuadrado *full-bleed*: `rect` con gradiente azul `#5080eb` (arriba-izq) → `#1b46b4` (abajo-der), glifo blanco centrado con ~18% de padding interno, **esquinas rectas** (el redondeo lo da el contenedor, no el asset).
- **Intención de marca = esquinas redondeadas.** Los `preview-rounded-*.png` muestran la marca como se quiere ver: gem con esquinas redondeadas. Por eso, en producto, el ícono se monta **siempre dentro de un contenedor con su propio radio** (`rounded-[…]` + `overflow-hidden`), **nunca a borde recto**. El asset full-bleed es correcto: el radio lo aplica el contenedor.
- **Por qué la imagen y no un SVG inline en el componente:** un solo asset es la fuente de verdad (el mismo que alimenta favicon/PWA, ver `docs/frontend.md`). Se monta como `<img>`/`next/image` con `alt=""` decorativo (el wordmark/`aria-label` adyacente ya nombra la marca), nunca redibujando el glifo a mano.

**El azul del ícono convive con el índigo de marca, no lo reemplaza.** El gem tiene su **azul propio** (`#5080eb`→`#1b46b4`, `theme_color` del manifest). El **acento del DS es índigo** (`--accent`, hue 264) para todo lo demás (nav activo, botones primarios, focus ring). Son dos azules-violáceos de la **misma familia de marca**: el azul vive **encerrado dentro del recuadro del gem**; fuera del gem, manda el índigo. **No** se retiñe el ícono al índigo ni se cambia el `--accent` al azul del ícono. Esta convivencia (gem azul + acento índigo) es **deliberada y vigente**.

**Contexto 1 — gem del sidebar.**

- Contenedor: **34×34px**, `rounded-[10px]` (radio gem del DS), `overflow-hidden`, `shrink-0`.
- Relleno: el ícono `frontend/src/app/icon.svg` a `100%` (cubre el cuadrado; `object-cover`), `alt=""`, `aria-hidden="true"`.
- **Elevación:** `shadow-[var(--shadow-sm),inset_0_1px_0_oklch(1_0_0_/_0.25)]`. La `--shadow-sm` lo asienta sobre la columna; el **inset highlight** blanco arriba lee bien sobre el azul del gem. El fondo lo trae el asset (sin gradiente CSS ni texto "C").
- El wordmark adyacente ("Control" / "Finanzas del mes") y el `pt-[10px]` del bloque logo **no cambian** (ver sección anterior).

**Contexto 2 — chip del login (`BrandSide`).** Acá el gem va **sobre fondo índigo degradado**. Un gem azul directo sobre índigo "ensucia" el contraste (dos azules pegados). El chip lleva un **marco/halo blanco** como **passe-partout** del ícono: el blanco separa el azul del gem del índigo del fondo y lo hace leer como una marca asentada, no como una mancha azul.

- Contenedor exterior (chip blanco): **44×44px**, `rounded-[13px]`, `background: #fff`, `shadow-[0_6px_18px_oklch(0.2_0.05_270_/_0.3)]`. `grid place-items-center`, `shrink-0`, `aria-label="Control"`.
- Ícono dentro del chip: **34×34px**, `rounded-[9px]` (radio interior, ~chip menos el marco), `overflow-hidden`. Deja un **marco blanco de ~5px** alrededor del gem (44 chip − 34 gem = 5px por lado). El ícono a `object-cover`, `alt=""`, `aria-hidden="true"`.
- El wordmark "Control" (`<b>` 22px) a la derecha y el resto del `BrandSide` **no cambian**.

> Regla viva derivada: **el gem de marca siempre se monta dentro de un contenedor con radio + `overflow-hidden`** (10px en sidebar, 13px de chip / 9px de gem interior en login). Sobre superficies **claras** (sidebar `--panel`) el gem va **directo** (su azul contrasta con el blanco). Sobre superficies **de marca índigo** (login) el gem va **con marco blanco** para no encimar dos azules. El azul del asset nunca sale del recuadro del gem; el índigo del DS sigue siendo el acento de todo lo demás.

### Toggle de vista en la card `income-expense` — "Total" ↔ "Por categoría"

La card de reporte `income-expense` (un AreaChart con dos áreas superpuestas: ingresos vs. gastos, mes a mes — Forma 1) tiene un **selector de modo** que alterna entre **dos vistas del mismo gráfico**, sin cambiar de tipo de card ni de altura de canvas. Aplica **idéntico** en `/reportes` y en la card del Dashboard (mismo widget `ReportCard`). **No** es la "Forma 2" (barras apiladas por categoría, que es su propia card `by-category`): es una **vista alternativa de la card de ingresos vs. gastos**, en su mismo "skin" de áreas continuas.

- **Vista A — "Total" (default):** las dos áreas superpuestas de la Forma 1 (income verde, expense rojo).
- **Vista B — "Por categoría" — SOLO GASTOS:** **un único stack de áreas apiladas** en el mismo canvas, subiendo desde cero: N áreas de gasto apiladas, una por categoría (`categories[]`), que suman la **línea de gasto del mes**. **No hay desglose de ingresos** en esta vista (no hay segundo stack, ni doble código, ni rótulos por tipo): es la línea de gasto de la Forma 1 descompuesta en sus categorías. Mismo trazo de áreas continuas `monotone` mes a mes que la Forma 1. **No** son barras (las barras son de la card `by-category`). La vista B usa **solo `categories[]`** (gastos).

#### 1. El selector de modo — DOS TABS horizontales en la cabecera de la card

El cambio de modo se presenta como **dos tabs ("Total" / "Por categoría") una al lado de la otra, alineadas en el mismo eje X (horizontal)**, ubicadas en la cabecera de la card. **No** es un segmented control: es un patrón de **tabs** del DS, definido acá.

- **Forma de las tabs (patrón underline neutro).** Dos labels en una fila horizontal, separados por `gap-[18px]`. Cada tab: texto **13px / 600**, `py-[6px]`, sin relleno ni pista de fondo (no hay track tipo segmented). La **tab activa** se marca con un **underline indicador 2px `--ink`** pegado al borde inferior de la fila de tabs (no semántico, no índigo: el modo de visualización es neutro) + texto a `--ink`. La **tab inactiva**: texto `--muted`, sin underline; **hover** → texto `--ink-2` y un underline 2px `--line-strong` (afordancia de clickeabilidad). El underline activo **se desliza** horizontalmente entre las dos tabs (transición `transform`/`left` + `width` 0.18s ease-out; instantáneo con `prefers-reduced-motion`).
- **Por qué underline neutro y no índigo ni segmented:** las tabs eligen **modo de visualización**, no un tipo income/expense ni una acción de marca. El underline `--ink` es la señal de "estás acá" más sobria del DS, y libera la cabecera de la pista gris del segmented (que competiría con el stepper y el filtro). El acento índigo **no** se usa (es marca, no estado de un control de datos); el verde/rojo **no** se usa (no hay tipo que comunicar).
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

> Reutiliza: las **líneas/degradés income/expense** de la Forma 1; los **separadores 1px `--panel`** y el **orden de apilado mayor→menor estable** de la Forma 2; `ChartLegend` y `ChartTooltipContent` (patrón `Form2Tooltip`) tal cual. Aporta: el patrón de **tabs underline neutras** en la cabecera de la card y la **vista B de un único stack de gastos por categoría** (línea de contorno rojo = firma de gasto; bandas = `category.color` identificador).

### Filtro de categorías embebido (checklist en popover)

Control reutilizable para filtrar por categorías sin tapar el contenido. Botón disparador + popover con checklist.

- **Disparador:** botón ghost chico (`.btn.ghost.sm`), ícono `SlidersHorizontal` 15px. Rótulo **"Categorías"** (default, todas) / **"Categorías · N"** (subconjunto, `· N` mono `--ink`) / **"Categorías · 0"** (ninguna). Con filtro activo: ícono+texto suben a `--ink` y aparece un **punto indicador 6px `--accent`** (cromo de UI, no monto).
- **Popover:** `--panel`, `--line`, `--r-ctl`, `--shadow-lg`, ancho 260px, `max-height ~320px` con scroll interno (header/footer fijos). Header: label "Mostrar categorías" + toggle "Todas"/"Ninguna" (link `--accent-ink`). Filas: checkbox del DS + **swatch de color 10px radio 3px** + nombre 13px (`--ink` tildada / `--ink-2` destildada). El universo son las categorías **activas**. Filtro **en vivo** (sin Aplicar/Cancelar); cierra por clic fuera / `Esc` / re-clic.
- Si el filtro vacía el reporte, el gráfico muestra los 12 meses en cero con el empty "Sin movimientos…" (sin error); los límites de año no cambian.

### Filtros por listado en `/mes` — controles de sección

El filtro de `/mes` es **por listado**: cada `AccordionSection` (Únicos / Fijos / Cuotas) tiene **sus propios** controles de filtro, alojados **en su cabecera** (no hay un filtro por-pantalla en el `.phead`). El patrón *Filtro de categorías embebido* (arriba) **se reutiliza** acá, scoped a la sección.

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

**Comportamiento en modo orden — los controles de filtro NO se muestran.** En modo orden la cabecera está dedicada a arrastrar (colapso transitorio, fila reducida a handle + chevron ▶ + rótulo + pill + divisor + subtotal). El **disparador de filtro se oculta** mientras dura el modo orden (no se renderiza), igual que el cuerpo está colapsado. Al salir del modo ("Listo") el disparador vuelve. Esto mantiene la fila de orden limpia y evita un control accionable en una cabecera que no es accionable.

**Responsive (≤940px).** El disparador es icon-only (no crece de ancho), así que entra en la fila igual que en desktop; el popover (260px, portaleado, anclado a la derecha) no depende del ancho de la sección. No hay cambio de forma en ≤940px más allá del re-anclaje natural del popover al disparador.

> Reutiliza el *Filtro de categorías embebido* (popover de categorías) y el lenguaje del punto indicador `--accent` del `FilterButton`. Aporta el **triple switch de tipo** (segmented neutro con semánticos solo en el texto del seleccionado) y la decisión de **alojar los dos controles tras un único disparador en la cabecera del acordeón, fuera del `<button>` disclosure**.

### Picker de color de categoría (matriz de swatches)

Selector del color de categoría en el modal de categoría (crear y editar), que consume la **matriz de 70 colores** (ver *Paleta de colores para categorías*). Grid 10 columnas × 7 filas, swatch cuadrado `aspect-ratio: 1` radio `--r-chip` 7px, gap 6px.

- **Estados del swatch:** *reposo* = su hex con borde `--line` 1px. *Hover* = `scale(1.12)` + `--shadow-sm`, borde `--line-strong`, transición 0.14s. *Seleccionado* = anillo `box-shadow: 0 0 0 2px var(--panel), 0 0 0 4px var(--ink)` (ring **neutro `--ink`**, no acento — regla dura 2). *Focus* = ring `--accent-soft` 3px.
- **Botón "Aleatorio":** ghost chico (`Shuffle` 15px) que mueve la selección a un swatch al azar **de la matriz** (nunca un hex fuera de ella).
- **Crear:** arranca en el color menos usado (fila T4). **Editar:** arranca en el color actual de la categoría.

### Metadatos de relación en la sublínea del ítem de `/mes` (calculados)

La **sublínea** del ítem de `/mes` es el lugar canónico de los metadatos del movimiento (categoría, tipo, frecuencia, cuota, estado anulado). La relación **padre/hijo** de los movimientos calculados se señala ahí, con **chips/segmentos neutros**, sin recolorear el ítem ni el monto:

- **Hijo (es un calculado):** chip neutro **"Calculado"** (mismo estilo que el chip "Anulado": `--panel-3` / `--muted` / `--r-chip` / 11px·600·`.04em`) con mini-glifo `Link2` (11px), como **primer** segmento de la sublínea; y un segmento final **"desde {Origen}"** (`--muted`, nombre en `--ink-2`, sin mono). Orden si además está anulado: `[Anulado] [Calculado] Categoría · …`.
- **Padre (tiene calculados derivados):** segmento final con glifo `GitBranch` (13px, `--muted`) + contador mono tabular si hay más de uno, y `title` nativo "Tiene N calculado(s)". Señal más liviana que la del hijo (es info secundaria).
- El **monto** del calculado puede ser negativo/cero (ver *Paleta y uso de tokens* → regla del signo).
- **El origen del calculado puede ser fijo, único o cuota — el patrón es transversal.** El chip "Calculado", el "desde {Origen}" del hijo y la marca padre (`GitBranch`) se aplican **idénticos** sin importar el origen; el calculado se **lista en la sección de su origen** (calculado de único → **Únicos**; de cuota → **Cuotas**; de fijo → **Fijos**). Particularidades por sección:
  - **El hijo toma la forma de su sección de origen.** En **Únicos** lleva la columna fecha "DD Mmm" (heredada del split temporal del origen); en **Cuotas** la columna 3 va **vacía** — el calculado de cuota **no** muestra la etiqueta "Cuota X/N" (es un movimiento propio, no integra el plan de cuotas); en **Fijos** la columna 3 va vacía como cualquier fijo.
  - **La sublínea sigue la regla de su origen:** el segmento de **frecuencia (`Repeat`)** aparece **solo** cuando el calculado es de **origen fijo**; en calculados de único/cuota la sublínea es `[Calculado] Categoría · gasto/ingreso · desde {Origen}` (sin frecuencia, sin "X/N").
  - **Orden dentro de la sección:** el calculado se ordena por **magnitud `|monto| DESC`** mezclado con el resto de los ítems de su sección (mismo criterio único del backend); **no** se ancla junto a su origen ni se agrupa aparte — cae donde su magnitud lo ubique.
  - **Ícono de la caja de origen (form de calculado).** La caja de origen *read-only* del form lleva un glifo lucide que identifica el **tipo del movimiento de origen**, en `--accent-ink` (cromo de UI, no monto): **fijo → `Repeat`** (recurrencia), **único → `Receipt`** (gasto puntual / ticket), **cuota → `CreditCard`** (compra financiada en N pagos). 15px, `shrink-0`, `aria-hidden`. Son afordancias neutras: no tiñen cifras ni colisionan con la regla verde/rojo. No hay convención previa de ícono para único/cuota en listas (Únicos se distingue por la columna fecha; Cuotas por "X/N"), así que estos tres glifos viven por ahora solo en esta caja.
- **Aviso de borrado en cascada (modal de eliminar):** cuando el movimiento a eliminar es **padre** (`hasCalculated === true`), el modal de confirmación suma un **callout de advertencia** como **último bloque del cuerpo, antes del footer**, avisando que al borrarlo también se borran sus calculados. Es **advertencia (ámbar `--warning`), no error**: el borrado es lo pedido, el callout informa el efecto colateral. Banda `--r-ctl`, fondo `--warning-soft`, borde `--warning`, `AlertTriangle` (lucide, 16px, `--warning-ink`) + texto 13px/500 `--warning-ink`. El botón "Eliminar" del footer **es `danger`** (rojo): advertencia ámbar y acción destructiva roja conviven. Solo aparece si `hasCalculated`; si es `false`, el modal queda igual.

### Ítem fijo anulado (`skipped`) y acciones del KebabMenu

**Fijo anulado para el mes** (`origin: 'fijo'`, `skipped: true`): el ítem **se sigue mostrando** en su sección y posición (no desaparece), pero no suma a los totales. Tres señales juntas, ninguna sola alcanza:

- **Atenuación de la fila:** todo el contenido de la fila (ícono, nombre, sublínea, monto, columna fecha) a **`opacity: 0.55`**. **No** se atenúa el fondo/hover ni el KebabMenu (que queda a opacidad plena para accionar "Des-anular").
- **Monto tachado:** `line-through` sobre el monto, además de la atenuación. **Conserva su color por tipo y su signo** — no se recolorea a neutro.
- **Badge "Anulado":** chip neutro como **primer** segmento de la sublínea (antes de Categoría; si además es calculado: `[Anulado] [Calculado] …`). Mismo molde de chip neutro del DS: `--panel-3` / `--muted` / `--r-chip` 7px / 11px·600·`.04em`. Neutro a propósito (no `--warning` ni semántico): "anulado" es un estado de cómputo, no error.

**Hover del anulado:** la fila sigue interactiva (`hover:bg-panel-2` + KebabMenu visible); el contenido atenuado **no** vuelve a opacidad plena en hover.

**Acciones del KebabMenu del ítem (orden):** Editar → Anular/Des-anular este mes → Crear movimiento desde este → Eliminar (única `danger`/roja). Las dos intermedias son **neutras** (`text-ink hover:bg-panel-2`, ícono 15px), **solo en `origin: 'fijo'`** para "Anular" y **solo en orígenes no-calculados** para "Crear desde este":

- **Anular / Des-anular este mes** — toggle según `skipped`: activo → **"Anular este mes"** (`CalendarOff`); anulado → **"Des-anular este mes"** (`CalendarPlus`). Reversible, nunca `danger`.
- **Crear movimiento desde este** — abre el form de calculado (abajo) con el origen fijado. Ícono `Calculator`. **No** aparece sobre un ítem que ya es calculado (sin encadenamiento). Únicos/cuotas pueden ser origen (su KebabMenu **no** lleva "Anular").

### Selector de frecuencia del form de fijo

El bloque **Frecuencia** del form de fijo (entre Mes de inicio y Categoría en crear; entre Monto y Categoría en editar) sigue el patrón de bloque del form (`Label` arriba + control). Etiquetas por valor: `MONTHLY` → Mensual, `BIMONTHLY` → Bimestral, `QUARTERLY` → Trimestral, `BIANNUAL` → Semestral, `ANNUAL` → Anual; orden de menor a mayor período.

- **Crear:** `Select` del DS, `required`, default **Mensual** (sin placeholder vacío).
- **Editar (inmutable):** caja **read-only con badge**, mismo patrón que "Tipo" en edición (`rounded-ctl border-line bg-panel-2 px-[13px] py-[11px]`): glifo `Repeat` 15px `--accent-ink` + la etiqueta capitalizada.

> La frecuencia también se muestra en la **sublínea del ítem** (segmento `Repeat` 12px + etiqueta en minúscula: mensual/bimestral/…), sin badge ni decoración extra.

### Form de movimiento calculado

El calculado **no es un tab** del modal: se abre en modo propio (sin tabs de tipo), título **"Nuevo / Editar movimiento calculado"**, reusando el chrome del modal (radio 18px, `--shadow-lg`, bloques `space-y-[14px]`). Orden de bloques: **Origen** (read-only) → **Fórmula** (operador + operando) → **Signo del resultado** → **Resultado** (preview read-only) → Categoría → Descripción. **No hay bloque "Tipo" ni "Monto"**: el monto se deriva y el tipo se deriva del signo del monto final (ver *Paleta y uso de tokens* → tipo derivado del signo).

- **Origen (read-only):** caja `rounded-ctl border-line bg-panel-2`, glifo por tipo de origen (`Repeat`/`Receipt`/`CreditCard` 15px `--accent-ink`, ver sección anterior) + nombre del fijo de origen (UI 14px/600 `--ink-2`) + a la derecha su tipo·frecuencia y, si está, el monto del origen del mes contexto (mono `--muted`). No editable.
- **Fórmula:** una fila `[Origen] [operador] [operando]` bajo un único `Label`. Operador = **segmented neutro de 5 celdas** (`+ − × ÷ %`, glifos 15px, thumb elevado `--panel`+`--shadow-sm` para el seleccionado, **sin** color semántico). Operando = input numérico mono tabular, alineado a la derecha, `flex-1`; affordance según operador (prefijo `$` para `+`/`−`, sufijo `%` para `%`, factor para `×`/`÷`).
- **Signo del resultado:** **segmented neutro de 2 celdas** (Positivo `Plus` / Negativo `Minus`), **sin** color semántico (el color del tipo va sobre el Resultado, no sobre el control).
- **Resultado (preview read-only, en vivo):** caja `rounded-ctl border-line bg-panel-2`. A la izquierda, la expresión legible del cálculo (`--muted` mono). A la derecha, apiladas: la **cifra** mono tabular (16–18px/600) con su color por tipo y su signo (`−$…` / `$0,00`), y debajo el **badge de tipo derivado** tintado ("Gasto" `--expense-ink`/`--expense-soft`, "Ingreso" `--income-ink`/`--income-soft`). Cifra y badge concuerdan siempre; recalculan en vivo al cambiar operador/operando/signo.
- **Validación operando 0 con `÷`/`%`** (división por cero): input en error (borde `--expense` + ring `--expense-soft` + mensaje `--expense-ink`), Guardar deshabilitado y el bloque Resultado muestra "Operando inválido" sin cifra ni badge. Con `+`/`−`/`×` el operando 0 es válido. El `--expense` acá es color de error de UI, no monto.
- **Editar:** Origen read-only (vínculo inmutable); Operador, Operando, Signo, Categoría, Descripción editables, precargados.

### Multi-moneda — cromo neutro de moneda y cotización

La moneda explícita por movimiento, su cotización y la conversión de display a la **moneda default** del usuario aportan piezas reutilizables que **nunca tiñen el monto**. **Regla viva:** **la moneda es cromo neutro** — badge, código y cotización van en **neutros** (`--ink-2` / `--muted` / `--panel-3`); **nunca** verde/rojo (eso es tipo, regla dura 1) ni índigo (eso es marca, regla dura 2). El color del monto lo da su **tipo**; la moneda solo lo **rotula**. Cifra original y convertida van **ambas en mono tabular** (regla dura 3). El índigo aparece solo como **cromo de interacción** (focus ring, thumb activo del segmented).

- **Badge de código de moneda:** chip neutro con el código (`"USD"`, `"ARS"`), **mismo molde que los chips Anulado/Calculado** (`--panel-3` / `--muted` / `--r-chip` 7px / 11px·600·`.04em` / `mono`). Identifica la moneda de origen; no se tiñe.
- **Segmented neutro de moneda:** el **segmented del DS sin semánticos** (molde del triple switch de tipo): track `--panel-3`, radio `--r-pill`, padding `2px`; segmentos texto 13px/600 `mono`. Seleccionado = thumb `--panel` + `--shadow-sm`, texto `--ink`, deslizamiento 0.14s; no seleccionado = `--muted` → `--ink-2` en hover. **Sin color semántico ni índigo en los segmentos.** `role="radiogroup"` + `role="radio"`, focus ring `--accent-soft` 3px. Es el selector de moneda en `/configuracion` y en el bloque moneda+cotización de los forms. Tiene **4 segmentos** (ARS/USD/EUR/BRL); su forma completa se detalla en *Monedas configurables — set curado ARS/USD/EUR/BRL*.
- **Par moneda + cotización (forms de único/fijo/cuotas):** bloque que va **debajo del Monto** (lo modula), dentro de un **disclosure colapsable** (ver *Bloque moneda+cotización del form* abajo). Cuando `moneda ≠ default`: `grid grid-cols-2 gap-[14px]` → Moneda (segmented neutro) + Cotización (input mono con **prefijo de par** de lectura, ej. `"USD→ARS"` / `"ARS→USD"` según la moneda seleccionada, en `mono` 12px `--muted`). Cuando `moneda == default`: el campo Cotización **se oculta** (queda solo el selector). Pre-carga editable: nota *field-note* "Cotización de referencia del mes" (glifo `History` 12px) → "Cotización modificada" al editar. Validación: cotización > 0 (error con borde `--expense` + ring `--expense-soft` + mensaje `--expense-ink`, mismo patrón que el Monto). El **calculado no muestra el bloque** (hereda moneda/cotización del origen, read-only).
- **Ítem de `/mes` (`MovementItemRow`) — original subordinado al convertido:** **el monto convertido a la default domina** (col 4, 15.5px/600, color por tipo, mono). Cuando `moneda ≠ default` se suman dos elementos **neutros y subordinados**: el **badge de moneda original** a la izquierda del monto (misma celda, `inline-flex items-center gap-[7px] justify-end`) y una **segunda línea** del valor original (*Meta/subtítulos* 12.5px/500 `--muted` `mono`, con el símbolo de su moneda, ej. `US$100,00`, sin signo). **Cuando `moneda = default` el ítem no lleva badge ni línea original.** Bajo anulado, ambos heredan el `opacity-[0.55]`; el convertido conserva su `line-through` + color por tipo.
- **Tarjeta de ajuste (patrón reutilizable, `/configuracion`):** `.card` del DS con **fila de ajuste** `flex items-center justify-between gap-6` (izquierda: título 14.5px/600 `--ink` + descripción *Meta/subtítulos* `--muted`; derecha: el control). Molde para ajustes (un ajuste = una fila). El único ajuste vigente: "Moneda por defecto" (segmented neutro de moneda), que persiste **en vivo** al seleccionar (sin botón Guardar; toast de confirmación) y **recomputa el display** de `/mes` y reportes sin tocar lo guardado.
- **Sidebar:** link **"Configuración"** (`Settings` 18px) como **último** ítem de nav, mismo molde/estados que el resto; activo por prefijo `startsWith("/configuracion")`.
- **Reportes:** **no cambian** — ya operan sobre datos convertidos a la default (la conversión es capa de display aguas arriba del gráfico); no se rotula moneda ni se muestran originales en las cards. El cambio de default recomputa sus valores en vivo.

> El caso **mono-moneda no se ensucia** donde corresponde: el **ítem** de `/mes` (sin badge ni línea original cuando moneda=default) y `/configuracion` (un solo segmented) no muestran complejidad de multi-moneda. En el **form**, el bloque moneda+cotización vive dentro de un disclosure colapsado por default, y cuando moneda=default el campo Cotización se oculta.

### Indicador de moneda default a nivel app

Lenguaje **coherente, persistente y a nivel app** para comunicar **en qué moneda están todos los montos mostrados**. El cromo por-ítem (badge de moneda original, valor original vs. convertido) y el ajuste (`/configuracion`) se complementan con un **indicador global** que dice, en toda pantalla, "todos estos montos están en {moneda default}". Se apoya en el badge de código de moneda (chip neutro) y la regla dura *la moneda es cromo neutro*.

**El indicador global es INFORMATIVO, no interactivo.** Comunica la moneda default vigente; **no la cambia**. El cambio de moneda default vive **únicamente en `/configuracion`** (su segmented, persistencia en vivo). El indicador es una **lectura** consistente entre pantallas, con una afordancia de navegación hacia `/configuracion` (no de edición in-situ). El chip **no** despliega popover ni segmented: es lectura + link. (Un indicador interactivo que cambie la default desde cualquier pantalla sería alcance nuevo y requiere decisión explícita.)

#### 1. El chip de moneda default — pieza canónica

Un **chip de moneda** neutro, persistente, que rotula el contexto monetario de la pantalla. **Mismo molde que el badge de código de moneda** (chip `--panel-3` / `--r-chip` 7px / código en `mono`), enriquecido para su rol de indicador global:

- **Composición:** glifo `Wallet` (lucide, 13px, `--muted`, `shrink-0`, `aria-hidden`) + código de moneda **`"ARS"` / `"USD"`** en `mono` 11.5px·600·`.04em` `--ink-2`. El glifo lo distingue del badge por-ítem (que es solo código) y comunica "moneda del contexto" sin texto largo. Sin símbolo de país ni bandera.
- **Caja:** `inline-flex items-center gap-[6px]`, fondo `--panel-3`, radio `--r-chip` 7px, padding `px-[8px] py-[3px]`. **Neutro estricto:** nunca income/expense (regla dura 1), nunca índigo de marca (regla dura 2). Es cromo de moneda (regla viva 1.2.3).
- **Afordancia a `/configuracion` (navegación, no edición):** el chip es un **`Link` a `/configuracion`** con `aria-label="Moneda por defecto: {código}. Cambiar en Configuración"`. Estados: *reposo* como arriba; *hover* fondo `--panel-2`→texto `--ink` y aparece un glifo `Settings`/`ChevronRight` 11px `--faint` a la derecha (afordancia "se gestiona en otro lado"), transición 0.14s; *focus* ring `--accent-soft` 3px, radio `--r-chip`. **No** despliega popover ni segmented: el cambio de moneda vive solo en `/configuracion`.
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
- **Cifra original vs. convertida (jerarquía):** la **línea de valor original subordinada** del ítem de `/mes` cross-rate muestra la cifra original **con el símbolo de su moneda** (ej. `US$100,00` en `--muted`, debajo del convertido en `$`). Eso es **información del ítem** (su moneda de origen), distinta del **contexto de pantalla** (la default). Coexisten sin contradicción: el **chip global** dice "los totales y el monto dominante están en {default}"; el **símbolo + línea original** del ítem dice "este movimiento se cargó en otra moneda". Jerarquía: global (header) > convertido dominante (col 4 del ítem, en el símbolo de la default) > original subordinado (segunda línea, en el símbolo de su moneda). Ningún nivel se tiñe.

#### 4. Jerarquía y reglas duras

- **Cuatro señales de cromo de moneda, sin pisarse:** (1) **símbolo por cifra** (`$`/`US$`/`€`/`R$`) = la moneda de ese número, autosuficiente; (2) **chip global** en el header = contexto de pantalla + afordancia a config; (3) **badge de moneda original** en el ítem cross-rate = etiqueta de origen junto al monto convertido; (4) **línea de valor original** = la cifra en su moneda de origen (con su símbolo). El chip global es el de **mayor alcance** (rige todo) y el de **menor peso visual por unidad**; el símbolo es por-cifra; los marcadores por-ítem son **locales** y solo aparecen en cross-rate. Hablan de cosas distintas (cifra / contexto / origen del ítem / cifra original). Ver *Símbolos de moneda por código* abajo.
- **La moneda es cromo neutro:** el chip global (su glifo y su código) van en `--panel-3` / `--muted` / `--ink-2`; el **símbolo de moneda** hereda el color del monto (por tipo). **Nunca** verde/rojo por moneda ni índigo (marca). El índigo solo aparece como **focus ring** del chip-link (cromo de interacción).
- **Toda cifra va en mono tabular** (regla dura 3): el código del chip, los totales, los originales y el **símbolo de moneda** van en `mono`.

> Reutiliza el **badge de código de moneda** (chip neutro), la regla viva *la moneda es cromo neutro* y el patrón `.phead` (eyebrow + H1). Aporta el **chip de moneda default global** (glifo `Wallet` + link a `/configuracion`), su **ubicación canónica** en el header de Dashboard / `/mes` / `/reportes` (no en `/configuracion`) y la **jerarquía** de cromo de moneda (símbolo por cifra > global > convertido > original).

### Símbolos de moneda por código

Cada moneda tiene su **símbolo propio** como prefijo de la cifra, para que cada monto sea **autosuficiente** (se lee qué moneda es sin depender del chip global). El símbolo es **cromo neutro de moneda**: no se recolorea por moneda; hereda el color del número (que lo da el tipo income/expense, regla dura 1) y va en `mono tabular` junto a la cifra (regla dura 3).

**Tabla de símbolos — fuente de verdad única y centralizada:**

| Código | Símbolo | Ejemplo (formato es-AR) | Negativo |
|---|---|---|---|
| `ARS` | `$` | `$219.400,00` | `−$1.234,56` |
| `USD` | `US$` | `US$1.500,00` | `−US$1.234,56` |
| `EUR` | `€` | `€1.500,00` | `−€1.234,56` |
| `BRL` | `R$` | `R$1.500,00` | `−R$1.234,56` |

- **Por qué `US$` (y no `U$S`):** `US$` es el prefijo internacional inequívoco para dólar estadounidense, lee limpio como prefijo antes de la cifra y compone con el formato es-AR. `U$S` es grafía coloquial argentina, menos universal y rompe el patrón "símbolo + cifra".
- **Centralizado / extensible:** el símbolo por código vive en **un único punto** (un mapa `código → símbolo`, una sola fuente de verdad para toda la app, conceptualmente análogo al pool/matriz de colores). **Toda** cifra de dinero se formatea a través de ese único formateador; ningún componente arma el símbolo a mano. Sumar una moneda = agregar una entrada al mapa (no tocar componentes).

**Placement y composición (todas las cifras de dinero):**

- **Símbolo pegado a la cifra, prefijo, SIN espacio:** `$219.400,00`, `US$1.500,00`. No `$ 219.400,00`. Mismo `mono tabular` y mismo color que la cifra.
- **Signo (`−`/`+`) antes del símbolo:** orden `[signo][símbolo][cifra]` → `−$1.234,56`, `−US$1.234,56`. El `−` (U+2212) y el `+` heredan el color del monto (por tipo, nunca por signo — regla del signo en *Paleta y uso de tokens*). El símbolo de moneda no cambia esa regla.
- **Dónde aplica:** **todas** las cifras — totales/subtotales de `/mes`, montos de ítem (col 4), cards del Dashboard, balance hero, mini-balance, ejes y tooltips de reportes, montos de los forms (resultado del calculado, etc.). Cada cifra usa el símbolo de **su** moneda: las cifras convertidas a la default llevan el símbolo de la **default**; la línea de valor original del ítem cross-rate lleva el símbolo de la **moneda original**.

**Relación con el chip global y el badge/línea por-ítem (que NO se vuelvan redundantes):**

- **El chip global sigue vigente como CONTEXTO**, no como única desambiguación. Con símbolos distintos, cada número ya dice su moneda; el chip pasa a comunicar **el contexto de pantalla** ("todos los agregados están en {default}") y la **afordancia a `/configuracion`**. No es redundante: el símbolo desambigua número por número; el chip ancla el contexto global + el acceso al ajuste. Se mantiene siempre visible.
- **El badge de código por-ítem (`"USD"`) del ítem cross-rate se mantiene.** Aunque la línea original ya lleve `US$`, el badge identifica la moneda de origen del movimiento **junto al monto convertido** (que va en `$` de la default, sin símbolo distinto que delate el cross-rate). El badge marca "este ítem es cross-rate" de un vistazo en la celda del monto dominante; el `US$` de la línea original confirma la cifra en su moneda. No se contradicen: badge = etiqueta de origen junto al convertido; `US$` = símbolo de la cifra original.

### Monedas configurables — set curado ARS/USD/EUR/BRL

El set de monedas es de **4 monedas curadas: `ARS`, `USD`, `EUR`, `BRL`**. No hay tokens, reglas ni patrones propios de esta sección: extiende los patrones de moneda a 4 valores. La **regla dura "la moneda es cromo neutro"** se mantiene: badge, código, símbolo, selector y cotización van en **neutros** (`--ink-2` / `--muted` / `--panel-3`), nunca income/expense (regla dura 1) ni índigo de marca (regla dura 2); el índigo aparece solo como **cromo de interacción** (focus ring, thumb activo). Toda cifra va en **mono tabular** (regla dura 3).

**Alcance visible de producto:** (a) el **selector de moneda tiene 4 opciones**; (b) **EUR y BRL** participan del cromo de moneda (símbolo, badge, chip global, línea original) con el mismo tratamiento que ARS/USD. **La tabla de cotizaciones de referencia es interna y NO tiene UI** — no hay pantalla, fila de ajuste ni control para editarla. El único campo de cotización visible es el del **bloque moneda+cotización del form**.

#### 1. Selector de moneda — segmented neutro a 4 segmentos

El **segmented neutro de moneda** (molde del triple switch de tipo) es el control, con 4 segmentos. **No** es un dropdown: 4 códigos cortos (3 caracteres, `mono`) caben en un segmented que mantiene **todas las opciones visibles de un vistazo** (coherente con el resto de selectores neutros del DS); un dropdown escondería 3 de 4 monedas. Aplica **idéntico** en el bloque del form y en la tarjeta de ajuste de `/configuracion`.

- **Forma y tokens:** track `--panel-3`, radio `--r-pill`, padding interno `2px`. **4** segmentos de **ancho igual** (`25%` cada uno), texto `13px`/`600` `mono` `tracking-[0.01em]`, padding `px-[14px] py-[6px]`, radio `--r-pill`. El **thumb deslizante** (`--panel` + `--shadow-sm`) se posiciona entre 4 posiciones: `left = calc(${(selectedIndex / 4) * 100}% + 2px)`, `width = calc(25% - 4px)`, transición `[left,width]` `140ms ease-out` (instantánea con `prefers-reduced-motion`).
- **Estados:** *seleccionado* = thumb `--panel` + `--shadow-sm`, texto `--ink`. *No seleccionado* = `--muted` → `--ink-2` en hover. *Disabled* = `opacity-50` + `cursor-not-allowed` (el set completo, ej. mientras persiste el cambio de default en `/configuracion`). *Focus (teclado)* = ring `--accent-soft` 3px sobre el segmento activo. **Sin color semántico ni índigo en los segmentos** (regla dura "la moneda es cromo neutro").
- **A11y:** `role="radiogroup"` + 4 `role="radio"` con `aria-checked`; flechas ←/→ ciclan por los 4 (el wrap módulo contempla `CURRENCIES.length`, no hardcodeado).
- **Etiquetas:** `"ARS" / "USD" / "EUR" / "BRL"` en `mono`. **Orden vigente:** `ARS → USD → EUR → BRL` (ARS/USD primero por back-compat y peso de uso; EUR/BRL después). Mismo orden en el form y en `/configuracion`.
- **Responsive / mobile — el punto a vigilar:** en `/configuracion` el segmented vive a la **derecha de la fila de ajuste** (`flex justify-between`), con holgura; 4 segmentos cortos entran sin problema en desktop. El caso ajustado es el **bloque del form**, donde el segmented ocupa **la mitad** del `grid grid-cols-2` (comparte fila con Cotización) y en mobile el form se angosta. Regla de comportamiento a cumplir:
  - El segmented **nunca hace scroll horizontal interno** ni recorta etiquetas. Las 4 etiquetas son cortas (3 chars `mono`); para ganar espacio cuando la columna se angosta, el segmented **puede reducir el padding horizontal de los segmentos** de `px-[14px]` hacia un mínimo de `px-[8px]` (manteniendo `py-[6px]`, el thumb y los tokens), antes que apretar el texto. El texto se mantiene a `13px`; **no** se reduce el tamaño de fuente ni se truncan códigos.
  - Si en el viewport más angosto soportado el `grid grid-cols-2` dejara el segmented sin aire para las 4 etiquetas legibles, el bloque moneda+cotización **colapsa a una sola columna apilada** (Moneda arriba, Cotización abajo, mismo `gap`), dándole al segmented el **ancho completo del form**. Es el mismo recurso de apilado que ya usa el DS cuando dos campos no caben en 2-col; **no** se inventa un control nuevo ni se cambia el segmented por otra forma. (El breakpoint exacto lo resuelve `control-frontend` midiendo; el comportamiento a cumplir es: 4 etiquetas siempre legibles, sin recorte ni scroll, apilando si hace falta.)

#### 2. Símbolos y presentación de EUR (€) y BRL (R$)

EUR y BRL son dos entradas más del **mapa `código → símbolo`** (fuente de verdad única, *Símbolos de moneda por código*). **Ningún componente arma el símbolo a mano:** todo el cromo (símbolo en cifras, badge por-ítem, chip global, línea original) consume ese mapa.

- **Por qué `€` y `R$`:** `€` es el símbolo universal e inequívoco del euro, prefijo limpio antes de la cifra. `R$` es el prefijo estándar del real brasileño (no `R `, no `BRL `); lee como prefijo y compone con el formato es-AR. Ambos componen igual que `$`/`US$`: **prefijo pegado a la cifra, SIN espacio** (`€1.500,00`, `R$1.500,00`), mismo `mono tabular`, mismo color que la cifra (heredado del tipo). Signo antes del símbolo: `[signo][símbolo][cifra]` → `−€1.234,56`, `−R$1.234,56`.
- **Presentación idéntica a ARS/USD — sin tratamiento especial por moneda:** EUR y BRL **no** se recolorean, **no** cambian de tipografía ni de peso, **no** llevan bandera ni código de país. El símbolo es cromo neutro: no tiñe distinto por moneda; hereda el color del número. Donde ARS/USD aparecen hoy, EUR/BRL aparecen igual:
  - **Chip global de moneda default (`CurrencyChip`):** mismo molde (glifo `Wallet` 13px `--muted` + código en `mono` 11.5px·600·`.04em` `--ink-2`, caja `--panel-3` `--r-chip`). Muestra `"EUR"` / `"BRL"` como código sin ningún cambio. `aria-label` con el código nuevo.
  - **Ítem de `/mes` (`MovementItemRow`), cross-rate:** el **badge de moneda original** muestra `"EUR"` / `"BRL"` (mismo chip neutro `--panel-3` / `--muted` / 11px·600·`.04em` `mono`); la **línea de valor original** subordinada muestra la cifra con el símbolo de su moneda (ej. `€100,00`, `R$350,00`) en *Meta/subtítulos* 12.5px/500 `--muted` `mono`. El **monto convertido dominante** sigue en el símbolo de la **default** del usuario (que ahora puede ser cualquiera de las 4). Jerarquía intacta: global > convertido dominante > original subordinado; ningún nivel se tiñe.
  - **Totales, cards de Dashboard, balance hero, mini-balance, ejes/tooltips de reportes, montos de forms:** cada cifra usa el símbolo de **su** moneda vía el mapa; las cifras convertidas a la default llevan el símbolo de la default. Nada más cambia.

#### 3. Bloque de cotización del form — aguanta las 4 monedas

El **input de cotización**: caja `rounded-ctl border-[1.5px]`, prefijo de par en `mono` 12px `--muted`, input `mono` 15px/600, nota *field-note* "Cotización de referencia del mes" / "Cotización modificada", validación `> 0` con borde `--expense` + ring `--expense-soft`. El valor pre-cargado sale de la tabla de referencia interna, lo cual es **invisible visualmente** — el campo es editable y la presentación es la misma. El **encuadre** del bloque vive en un disclosure y el input se oculta cuando moneda=default (ver §4).

- **El prefijo de par aguanta las 4 monedas:** `"USD→ARS"`, `"EUR→ARS"`, `"BRL→USD"`, etc. Son códigos de 3 chars `mono`; el prefijo `XXX→YYY` (7 chars) entra en la caja sin recortar (`shrink-0`, `select-none`). Sin tratamiento por moneda en el bloque.
- **La nota de pre-carga ("Cotización de referencia del mes")** comunica que el valor viene pre-cargado y es editable. Glifo `History` 12px `--muted` + texto `--muted`; al editar pasa a "Cotización modificada" en `--ink-2` (sin glifo).

#### 4. Bloque moneda+cotización del form — disclosure colapsable + caso moneda=default

El bloque del form (`CurrencyExchangeBlock`, compartido por transaction-form / recurring-form / installment-form):

**(A) El bloque completo vive dentro de un disclosure colapsable**, **debajo del campo Monto, antes de Categoría**. Reutiliza el **patrón disclosure** del *Acordeón* (cabecera = único `<button>` con `aria-expanded` + `aria-controls`, chevron que rota, animación altura 0↔auto + fade), aplicado a un bloque de form (no a una sección de lista).

- **Trigger (la cabecera del disclosure):** fila `<button>` **al aire** (sin caja de input), `w-full flex items-center gap-[7px]`, padding `py-[7px]` (alto cómodo de click, alineado al ritmo del form). Contenido de izq → der:
  - **Chevron:** `ChevronRight` (lucide) **16px** `stroke-width 2`, **primer elemento**, `--muted` en reposo. Único glifo que **rota**: colapsado → ▶ (0°); expandido → ▼ (90°). Mismo lenguaje que el chevron del *Acordeón*.
  - **Label (copy exacto):** **"Moneda y cotización"**. Tipografía: **13px / 600**, `--ink-2` en reposo, `tracking-[0.01em]`, fuente UI (Space Grotesk). Nombra exactamente el contenido del disclosure y es coherente con los labels del form ("Moneda", "Cotización").
  - **Resumen a la derecha (colapsado):** cuando el disclosure está **colapsado**, mostrar al final de la fila (tras un `flex-1` divisor) un **resumen de un vistazo** de lo que hay configurado: el **código de moneda** seleccionado en **`mono` 12px `--muted`** (ej. `"ARS"`, `"USD"`). Si `moneda ≠ default`, sumar la cotización: `"USD · 1.480,00"` (código + `·` separador `--faint` + valor mono `--ink-2`). Si `moneda == default`, solo el código (`"ARS"`). Es el equivalente al "resumen visible al colapsar" del *Acordeón* (pill+subtotal): comunica el estado sin expandir. Al **expandir**, el resumen se oculta (su info ya está en los controles abiertos).
- **Estados del trigger** (mismo set que el disclosure del *Acordeón*):
  - **Reposo:** chevron `--muted`, label `--ink-2`, resumen `--muted`/`--ink-2`. `cursor: pointer`.
  - **Hover** (sobrio, sin fondo en la fila): chevron → `--ink-2`, label → `--ink`, transición 0.14s.
  - **Focus (teclado):** ring `--accent-soft` 3px con radio `--r-chip` 7px (`focus-visible`).
  - **Expandido:** chevron en ▼; sin cambio de color de fondo (la fila sigue al aire).
- **Arranca SIEMPRE colapsado.** Sin excepciones: también en **modo edición**, aunque el movimiento ya tenga `moneda ≠ default` y una cotización cargada. **Nunca auto-expandido.** El resumen colapsado (que muestra `"USD · 1.480,00"`) es suficiente para que el usuario vea de un vistazo que hay una moneda no-default configurada, sin forzar la apertura.
- **Animación de apertura:** altura del cuerpo 0↔auto (con `overflow: hidden`) + fade + rotación del chevron, **0.22s ease-out** (idéntico al *Acordeón*). Respeta **`prefers-reduced-motion`**: apertura/cierre **instantáneos** (sin transición de altura ni fade), el chevron cambia de orientación sin animar.
- **Spacing:** el trigger va separado del campo Monto (arriba) y del campo Categoría (abajo) con el **gap estándar entre campos del form** (no se inventa un valor nuevo; el bloque ocupa el slot entre Monto y Categoría). El **cuerpo expandido** abre con `mt-[7px]` respecto del trigger (separa el chevron/label del contenido), y mantiene su `gap` interno.

**(B) Cuando `moneda == default`, el campo Cotización se OCULTA.** El backend ignora `exchangeRate` cuando `currency === anchorCurrency`, así que el form envía `exchangeRate = 1` sin afectar cálculos; no se muestra cotización en ese caso.

- **Contenido del cuerpo expandido según la moneda seleccionada:**
  - **`moneda == default`:** el cuerpo muestra **solo el selector de moneda**, a **ancho completo** del form (una sola columna full-width; el `CurrencySegmented` sin `compact`, con `px-[14px]` normal en sus segmentos). **No** se renderiza el label "Cotización", ni la caja del input, ni el prefijo de par, ni la nota *field-note*. Queda: label "Moneda" + segmented a 4.
  - **`moneda ≠ default`:** el cuerpo muestra el **grid `grid-cols-2 gap-[14px]`** → col izq selector de moneda (`compact=true`, mitad de ancho) + col der el input de cotización completo (prefijo de par real `"USD→ARS"`, nota *field-note*, validación).
- **Transición al cambiar moneda dentro del disclosure abierto:** al pasar de `default` a `≠ default` (o viceversa) con el disclosure **abierto**, la **columna de cotización aparece/desaparece** y el selector pasa de full-width a media-columna (y al revés). El cambio es sobrio: el selector reflowea a su nuevo ancho y la columna de cotización hace **fade + leve expansión de ancho** acompañando el reflow del grid (≈0.14–0.18s). Con **`prefers-reduced-motion`**: instantáneo (aparece/desaparece sin fade ni transición de ancho). No se anima la altura del disclosure (ya está abierto); solo reflowea su contenido.
- **El resumen colapsado refleja este caso:** si moneda=default, el resumen es solo el código (no hay cotización que mostrar); si moneda≠default, suma `· {cotización}`.

> El requisito de "capturar la cotización" se cumple igual: en moneda=default el backend usa `exchangeRate = 1` (no necesita captura); cuando moneda≠default el campo está presente, editable y validado `> 0`.

> **Lo que este bloque NO toca (por diseño):** no hay UI para la tabla de cotizaciones de referencia (es interna); `/configuracion` tiene una sola tarjeta ("Moneda por defecto", con 4 opciones en el segmented); no hay tokens, colores ni reglas propios. Todo el cromo de las 4 monedas sale del **mapa de símbolos** y el **array de monedas del segmented** — puntos únicos ya centralizados.

### Selector de salto de mes/año en `/mes` (popover "rueda")

Hace **interactivo el rótulo de período** de `/mes` para **saltar rápido** a cualquier mes/año, sin reemplazar la navegación secuencial (flechas desktop / pill stepper mobile). Es **solo UI nueva**: al confirmar reusa la navegación de período existente (RF-VM-004) — navega al mes elegido. Convive con `PeriodNav` (flechas laterales gigantes ≥941px y forma `.stepper` ≤940px) como **atajo de salto largo**, no como reemplazo del "anterior/siguiente".

#### 1. Affordance — el rótulo de período se vuelve disparador

El rótulo del período es el disparador. **No** se agrega un botón aparte ni un ícono suelto que compita; el propio período (que ya es el elemento de mayor jerarquía del header) toma la afordancia, con un glifo de apoyo que comunica "esto despliega".

- **Desktop (≥941px) — el `<h1>` "Junio 2026" pasa a `<button>`-like.** El H1 (32px/700, tracking `-.02em`, `--ink`) se envuelve en un disparador (`<button>` con el H1 adentro, `inline-flex items-center gap-[8px]`), conservando exactamente su tipografía y tamaño. A su derecha, un glifo **`ChevronsUpDown`** (lucide, **18px**, `stroke-width 2`, `--faint` en reposo, `shrink-0`, `aria-hidden`) — el glifo de doble flecha ↕ comunica "valores que suben/bajan", coherente con la metáfora de "rueda". El eyebrow ("Tu mes" + `CurrencyChip`) y el sub-label de estado ("Mes en curso"/"Histórico") **no cambian** y **quedan fuera** del disparador (el botón envuelve solo el H1 + chevron).
- **Mobile (≤940px) — el centro del pill `.stepper` se vuelve disparador.** El bloque central del `.stepper` (el texto `{mes} {año}` + sub-label de estado, hoy un `<div>` inerte entre las dos flechas) pasa a ser un `<button>` que abre el mismo popover. Las **flechas ‹ › del pill no cambian** (siguen navegando anterior/siguiente). Se suma el mismo glifo `ChevronsUpDown` **15px** `--faint` a la derecha del texto del mes, dentro del botón central, `gap-[6px]`. El sub-label "Mes en curso/Histórico" sigue debajo, dentro del botón. El centro deja de ser `aria-hidden`: ahora es accionable (label real). El pill conserva su molde (`--r-pill`, `--panel`, borde `--line`, `--shadow-sm`, padding 4px).
- **Por qué `ChevronsUpDown` y no `ChevronDown`/`Calendar`:** el popover **no** es un menú desplegable plano (sería `ChevronDown`) ni un date-picker de calendario (sería `Calendar`): es un **selector de dos ruedas** (mes y año que suben/bajan). El doble chevron vertical ↕ es la afordancia exacta del patrón "stepper/rueda" y no se confunde con el chevron lateral ‹ › de navegación secuencial ni con el chevron de disclosure ▶.

**Estados del disparador (desktop e mobile, comunes):**

- **Reposo:** H1/label en su color normal (`--ink`); chevron `--faint`; `cursor: pointer`.
- **Hover:** chevron sube a `--ink-2`; el H1 **no** cambia de color (se mantiene `--ink` para no parpadear el título). Transición 0.14s. En mobile, el botón central **no** toma fondo (el pill ya es la superficie); el chevron a `--ink-2` es la única señal.
- **Focus (teclado):** ring `--accent-soft` 3px (`focus-visible`), radio `--r-chip` 7px ajustado al box del disparador (envuelve H1 + chevron sin recortar el descender de la tipografía).
- **Abierto:** el chevron pasa a `--ink-2` (mismo que hover) y se mantiene mientras el popover está abierto (señal de "activo"); el disparador lleva `aria-expanded="true"` + `aria-haspopup="dialog"`.

#### 2. El popover — dos ruedas mes / año

Superficie flotante portaleada a body, anclada al disparador. **No** es un calendario: son **dos columnas de selección** ("ruedas"), una de mes y una de año, cada una con su valor central y sus controles ▲▼ de subir/bajar. **Las dos ruedas son independientes:** la de Mes hace **wrap circular** sin tocar el Año, y el Año solo cambia con su propia rueda (ver wrap abajo y §3).

**Principio de diseño (corrección visual, Ola 1):** cada rueda debe **leerse de inmediato como UNA pieza integrada** (un stepper/rueda cohesivo), **no** como tres barras grises sueltas (▲ / display / ▼ desconectados). El error del diseño anterior fue dar a los tres elementos el mismo fondo `--panel-2` con esquinas independientes: se leían como tres chips apilados sin relación. La pieza ahora es **un contenedor único con borde envolvente y divisores internos**, donde ▲, valor y ▼ son **zonas de la misma caja**, no cajas separadas.

- **Caja del popover:** `--panel`, borde `--line`, radio **`--r-ctl` 10px**, `--shadow-lg`, padding `p-[14px]`. Ancho **fijo 240px** (entran las dos ruedas + el footer sin apretar). Animación de entrada `pop` (scale .98→1, 0.18s ease-out; instantáneo con `prefers-reduced-motion`).
- **Layout interno (de arriba abajo):**
  1. **Fila de las dos ruedas:** `grid grid-cols-2 gap-[10px]`. Columna izquierda = **Mes**, columna derecha = **Año**. Cada columna es una **rueda vertical cohesiva** (ver abajo). El mes va a la izquierda por orden de lectura natural ("Junio 2026").
  2. **Divisor:** `--hair` 1px horizontal, `my-[12px]`.
  3. **Footer de acciones:** ver §4 (Cancelar ghost + Ir primario).

**Cada rueda (mes / año) — UNA pieza, no tres:**

```
┌─────────┐   ← contenedor único: borde --line-strong envolvente,
│   ▲     │     radio --r-ctl 10px, bg-panel, overflow-hidden.
├─────────┤   ← divisor interno --hair (no borde-caja): separa ▲ del valor
│  valor  │
├─────────┤   ← divisor interno --hair: separa valor del ▼
│   ▼     │
└─────────┘
```

- **Label de la rueda:** sobre el contenedor, eyebrow *Eyebrow/labels* (12px/600, `.1em`, uppercase, `--muted`): **"Mes"** / **"Año"**. `mb-[6px]`.
- **Contenedor de la rueda (la pieza cohesiva):** un único `<div>` con **borde `--line-strong` 1px en los cuatro lados**, radio **`--r-ctl` 10px**, `bg-panel`, `overflow-hidden` (para que las zonas internas respeten el radio). Adentro, tres zonas apiladas separadas por **divisores internos `--hair` 1px** (no bordes de caja propios): la zona ▲ arriba, la zona valor al medio, la zona ▼ abajo. **Las zonas NO llevan fondo propio en reposo** (heredan el `bg-panel` del contenedor): el borde envolvente + los dos divisores `--hair` son lo único que estructura la pieza. Así se lee como un stepper integrado, no como tres chips. **Sin radios independientes por zona** (el único radio es el del contenedor).
- **Zona ▲ / ▼ (subir/bajar):** ocupa el ancho completo de la rueda, alto **28px**, **sin fondo en reposo** (transparente sobre el `bg-panel` del contenedor). Glifo `ChevronUp` / `ChevronDown` (lucide, **16px**, `stroke-width 2`, `--ink-2`). **Hover:** fondo `--panel-2` (solo la zona hovereada toma fondo — la afordancia de "este botón se aprieta"), glifo `--ink`. **Active:** fondo `--panel-3`, sin `scale` (escalar despegaría la zona de la pieza). **Focus (teclado):** ring `--accent-soft` 3px **inset** (`inset` para que el ring no rompa el borde envolvente de la pieza). Hold/repeat (mantener apretado para avanzar rápido) es opcional — lo resuelve `control-frontend`; el spec no lo exige. `aria-label="Mes siguiente/anterior"` / `"Año siguiente/anterior"` (según rueda).
- **Zona valor (el centro de la rueda):** alto **40px**, `bg-panel`, texto **centrado**. **Sin bordes propios** (los divisores `--hair` arriba y abajo, parte del contenedor, la delimitan). Es la zona dominante de la pieza (más alta que las zonas ▲▼ de 28px, para que el valor sea el foco visual).
  - **Rueda Año:** input numérico. Valor en **mono tabular** (IBM Plex Mono + `tnum`, **regla dura 3** — es una cifra), **17px/600**, `--ink`, `text-center`. Editable por teclado (escribir el año). `inputMode="numeric"`, `maxLength=4`. **Focus del input** (escribiendo): ring `--accent-soft` 3px **inset** sobre la zona valor (no rompe el borde de la pieza).
  - **Rueda Mes:** el mes se muestra como **nombre** ("Junio"), no número. Por eso **no** es un `<input type=number>`: es un campo de texto que muestra el nombre del mes (UI **15px/600** Space Grotesk, `--ink`, `text-center`) y se cambia con ▲▼; opcionalmente escribible (escribir "jun" autocompleta a Junio) — la escritura del mes es **secundaria**, los ▲▼ son el camino primario para el mes. El nombre del mes es UI (no cifra), por eso va en Space Grotesk, **no** en mono (la rueda Año sí es mono por ser número). `aria-label="Mes"` con `aria-valuetext` = nombre del mes.
  - **Wrap del mes — circular, NO toca el año (decisión cerrada Ola 1).** Las dos ruedas son **independientes**: ▲ en Diciembre pasa a **Enero** y ▼ en Enero pasa a **Diciembre**, **sin modificar el año** (wrap circular, la rueda de mes gira sobre sí misma). El año **solo cambia con su propia rueda** (sus ▲▼ o escribiéndolo). **Eliminado** el comportamiento de odómetro/arrastre del año por el wrap del mes que tenía el diseño anterior.

#### 3. Estados de valor — válido, foco, incompleto

**Sin rango de año.** En `/mes` la navegación de meses es **ilimitada** (las flechas no restringen), así que el selector **no impone rango de año**: no existe "año fuera de rango", no hay límites `earliestYear`/año en curso, y los steppers ▲▼ del año **no tienen estado disabled por límite**. El input Año solo valida que sea un **año numérico plausible de 4 dígitos** (forma, no negocio).

- **Reposo (válido):** input con borde `--line-strong`, valor `--ink`.
- **Focus en el input (escribiendo):** borde del input sube a `--accent` (o se mantiene `--line-strong` con) ring `--accent-soft` 3px alrededor del input — mismo focus ring del DS para inputs de form. El valor sigue `--ink`.
- **Incompleto — año aún no válido (no es estado de error).** Mientras el usuario **escribe** el año y todavía **no hay 4 dígitos** (ej. `20`, `202`, o el campo vacío), el valor está **incompleto**, no en error:
  - El input **no** se tiñe de error: **no** se usa `--expense` ni el error ring `--expense-soft`. Conserva el borde `--line-strong` (o el focus ring `--accent-soft` si está enfocado). No hay color semántico de gasto, no hay mensaje de error, no hay `aria-live`.
  - **El botón "Ir" se deshabilita** mientras el año no tenga **4 dígitos numéricos** (estado disabled del primario, ver §4). Es el único feedback de "todavía no podés saltar": el primario apagado, sin pintar el input de rojo.
  - **Entrada no numérica:** el input es `inputMode="numeric"` `maxLength=4`; caracteres no numéricos se **descartan** (no se aceptan), no producen estado de error. El campo solo contiene dígitos.
- **Steppers ▲▼ del año — siempre activos.** Como no hay rango, los ▲▼ del año **nunca** se ven disabled: siempre suben/bajan el año en ±1 sin tope. (El wrap circular del mes —§2— no toca el año, así que el año solo se mueve con su propia rueda; tampoco encuentra límite.) Los ▲▼ siempre producen un año de 4 dígitos válido, así que "Ir" nunca queda deshabilitado por usar los steppers; el disabled de "Ir" solo aparece por **escritura incompleta** del año.

#### 4. Footer y comportamiento de cierre

**Regla dura vigente (Ola 0, P6): los popovers/modales NO se cierran por click afuera.** Aunque este overlay es funcionalmente un popover, **acá no se descarta por click fuera**: demanda una decisión explícita (saltar de mes es una acción de navegación, no un filtro liviano que se revierte solo). Cierre **explícito**:

- **Footer:** fila `flex items-center justify-end gap-[8px]`. Dos botones del DS:
  - **"Cancelar"** — botón **ghost** del DS (`.btn.ghost`, texto 13px/600 `--ink-2` → `--ink` sobre `--panel-2`, radio `--r-ctl`). Cierra **sin navegar** (descarta el cambio de mes/año tentativo).
  - **"Ir"** — botón **primario índigo** del DS (`bg-accent` → `--accent-press`, texto blanco 13px/600, radio `--r-ctl`, `shadow-[var(--shadow-sm),inset_0_1px_0_oklch(1_0_0_/_0.2)]`, focus ring `--accent-soft` 3px). **Confirma**: navega al mes/año elegido (reusa RF-VM-004) y cierra. Glifo opcional `ArrowRight` 15px. **Disabled** mientras el año está **incompleto** (no tiene 4 dígitos numéricos, §3): `opacity-50`, `cursor-not-allowed`, sin hover.
- **Vías de cierre (las tres explícitas):**
  - **"Ir"** → confirma + navega + cierra.
  - **"Cancelar"** → cierra sin navegar.
  - **`Esc`** → cierra sin navegar (equivale a Cancelar).
  - **Re-clic en el disparador** → cierra sin navegar (toggle).
  - **Click fuera (scrim/resto de la página) → NO cierra** (regla dura P6). No se monta scrim oscuro; el popover flota sobre la pantalla y se descarta solo por una de las vías de arriba.
- **`Enter` dentro de un input** equivale a "Ir" (si el año está completo —4 dígitos—; si está incompleto, `Enter` no navega, igual que "Ir" disabled).
- **a11y del popover:** `role="dialog"` `aria-label="Saltar a mes y año"`, foco entra al popover al abrir (primer control: input Año o ▲ del mes), `Esc` lo cierra, foco vuelve al disparador al cerrar. **Focus trap** dentro del popover mientras está abierto (coherente con que no se cierra por click fuera).

#### 5. Ubicación, anclaje y flip

- **Desktop (≥941px):** el popover se ancla **bajo el disparador (el H1)**, alineado a la **izquierda** del H1 (su borde izquierdo coincide con el inicio de "Junio 2026"), con `gap` vertical **8px** entre el H1 y el borde superior del popover. Como el header de `/mes` vive en la columna central de `PeriodNav` (régimen ≥941px), el popover queda dentro del ancho de contenido, sin colisionar con las flechas laterales gigantes.
- **Mobile (≤940px):** se ancla **bajo el pill `.stepper`**, **centrado** respecto del botón central del pill (no respecto del viewport), `gap` 8px. Si el centrado lo sacaría del viewport, se alinea al borde con margen mínimo 12px (clamp horizontal).
- **Flip vertical (sin lugar abajo):** si no hay espacio suficiente debajo del disparador para los 240px de alto aproximado del popover (cerca del borde inferior del viewport), **flipea hacia arriba** y se ancla **sobre** el disparador (mismo `gap` 8px, ahora por encima), con la animación `pop` desde el borde inferior. El mecanismo (medición/colisión) lo resuelve `control-frontend`; el comportamiento a cumplir: el popover **siempre queda completamente visible** dentro del viewport, flipeando arriba/abajo y clampeando horizontal según haga falta.

#### 6. Convivencia con la navegación existente

- **No reemplaza nada.** Las **flechas laterales gigantes de `PeriodNav`** (≥941px) y el **pill stepper** (≤940px) siguen siendo el camino para "mes anterior / siguiente" (saltos de a uno). El popover es el atajo para **saltos largos** (cambiar de año, ir a un mes lejano) sin clickear muchas veces.
- **Mismo destino, misma navegación.** Confirmar en el popover navega exactamente como las flechas (RF-VM-004): no hay un segundo mecanismo de carga de mes. El popover solo **elige** el período; la navegación es la de siempre.
- **El disparador sigue accionable durante el "modo orden de secciones"** (decisión funcional cerrada). El disparador **no** se deshabilita en ese modo: saltar de mes no rompe el modo orden, **consistente con las flechas de `PeriodNav`** (que también navegan sin salir del modo). El popover abre, navega y cierra con normalidad mientras el header está en modo orden.

> Reutiliza: el rótulo de período (H1 ≥941px / centro del `.stepper` ≤940px) como superficie, sin cambiar su tipografía; el **focus ring `--accent-soft`** del DS; el patrón de **input del form** (`border-line-strong`, `bg-panel`, mono tabular para cifras); el botón **primario índigo** (con su estado **disabled** mientras el año está incompleto) y el **ghost**. Aporta: el **patrón de dos ruedas mes/año cohesivas** (cada rueda = UNA pieza: contenedor único con borde `--line-strong` envolvente + divisores internos `--hair`, zonas ▲/valor/▼ sin fondo propio en reposo; año en mono tabular, mes como nombre en UI), su **affordance `ChevronsUpDown`** en el rótulo de período, y la aplicación de la **regla dura P6** (no cierra por click fuera; cierre por Ir / Cancelar / Esc / re-clic). **Ruedas independientes:** el Mes hace wrap circular sin tocar el año; el año solo cambia con su propia rueda (sin odómetro). **Sin rango de año** (navegación de `/mes` ilimitada): no hay estado de error ni steppers disabled por límite; el único feedback de "todavía no" es "Ir" disabled mientras el año no tenga 4 dígitos.

### Skeletons — sistema unificado de estados de carga

Sistema **único y reutilizable** para todos los estados de carga del frontend. Hoy los skeletons son **ad-hoc e inconsistentes** (cada pantalla arma el suyo con `animate-pulse rounded-… bg-panel-3` inline); esta sección define **un solo lenguaje** y un conjunto de **primitivas** que **todos** los procesos de carga —presentes y futuros— deben usar. Un skeleton no es un spinner: es un **fantasma del contenido real** que reserva el layout para que, al llegar el dato, no haya salto.

#### Principio rector

- **El skeleton imita el layout real, no lo aproxima.** Cada placeholder ocupa **las mismas dimensiones y posiciones** (alto, ancho, radio, gaps, columnas) que el elemento real que reemplaza, para que el contenido aterrice **sin reflow ni salto**. La estructura **estable** de la pantalla (la que no depende del dato: títulos fijos, controles inertes, chrome de card) puede renderizarse **ya presente** mientras solo el área de datos muestra fantasmas. Un skeleton que no respeta las medidas reales es peor que ninguno: introduce el salto que venía a evitar.
- **Fantasma sobrio, no decorativo.** El skeleton es **superficie neutra animada**, sin íconos, sin texto, sin color semántico. **Nunca** usa income/expense, índigo de marca ni `category.color` (regla dura 1/2): un skeleton no comunica tipo ni marca, comunica "esto está por llegar".
- **Skeleton solo en la carga inicial; nunca con dato ya presente.** El skeleton se muestra **únicamente cuando aún no hay datos** (carga inicial de la pantalla o de un bloque). Cualquier interacción o refetch **con dato ya en pantalla** —refetch silencioso en background, colapsar/expandir una sección, reordenar secciones, cambiar de filtro manteniendo resultados— **no** vuelve a skeleton (evita el parpadeo); a lo sumo deja el dato viejo mientras llega el nuevo. La **regla visual** es: skeleton solo cuando el área está vacía de dato (el "cuándo exacto" por pantalla lo decide la implementación según haya o no dato previo).

#### Tokens del skeleton

Un único set, derivado de los neutros del DS:

| Aspecto | Valor | Racional |
|---|---|---|
| **Color base (fill)** | `--panel-3` | el fill gris de chips/superficies; sobre `--panel`/`--paper` lee como "hueco por llenar" sin gritar. Es el valor canónico del skeleton, sobre el que late la opacidad. |
| **Radio — bloque/card** | `--r-card` (14px) | placeholders que reemplazan tarjetas/áreas grandes (canvas de gráfico, card de total, área de lista). |
| **Radio — control** | `--r-ctl` (10px) | placeholders de inputs/botones. |
| **Radio — pill** | `--r-pill` (999px) | placeholders de pills/steppers/segmented redondeado. |
| **Radio — texto/línea** | `--r-chip` (7px) | líneas de texto y chips fantasma (sus extremos redondeados leen como "renglón"). |
| **Radio — círculo/avatar** | `50%` | avatares, swatches circulares, glifos redondos. |

No se introducen tokens de color nuevos: el sistema **se construye sobre `--panel-3`**, ya existente.

#### Animación — pulse y reduced-motion

- **Animación canónica: pulse.** La **opacidad del placeholder oscila** en bucle (~`1` → ~`0.6` → `1`) sobre el fill `--panel-3`. Lee como "esto está por llegar" sin decorar: es un latido sobrio, sin banda, sin gradiente, sin tinte. Un único neutro del DS (`--panel-3`); el movimiento viene de la opacidad, no del color.
- **Parámetros:** duración **~1.5s**, en bucle infinito, con la curva de easing estándar de `pulse`. Dentro del "movimiento sobrio" del DS.
- **`prefers-reduced-motion` (obligatorio):** con reduced-motion, **la animación se desactiva por completo**: el placeholder queda como **bloque estático** `--panel-3`. El layout fantasma sigue reservando el espacio sin movimiento. Regla dura del DS (igual que el resto de las animaciones).
- **Implementación (para `control-frontend`, no normativa de diseño):** el mecanismo es la utilidad **`animate-pulse` (Tailwind)** sobre **`bg-panel-3`**; desactivada bajo `@media (prefers-reduced-motion: reduce)` (queda `--panel-3` estático). El diseño fija el **comportamiento** (opacidad latiendo ~1→~0.6→1 sobre `--panel-3`, ~1.5s, off en reduced-motion); el mecanismo exacto es del frontend.

#### Primitivas — los building blocks del componente reutilizable

`control-frontend` arma **un componente `Skeleton` reutilizable** (con variantes) que expone estas primitivas. Toda pantalla compone su skeleton **a partir de estas piezas**; no se vuelve a escribir `animate-pulse bg-panel-3` inline en ningún lado.

| Primitiva | Reemplaza | Radio | Medidas / variantes |
|---|---|---|---|
| **`SkeletonLine`** | una línea de texto (título, label, nombre, meta) | `--r-chip` 7px | **alto = el `font-size` real del texto** que reemplaza (p.ej. 12px para meta, 14.5px para nombre de movimiento, 32px para H1); **ancho** parametrizable (porcentaje o px) para imitar largos distintos. Una línea de meta debe ser **más corta** que la de título. |
| **`SkeletonBlock`** | superficie rectangular (card, canvas de gráfico, área de lista, input, botón) | `--r-card` por default; `--r-ctl` para controles | alto/ancho explícitos = los del elemento real. Es la primitiva más usada (todo lo que no es línea ni círculo). |
| **`SkeletonCircle`** | avatar, swatch circular, glifo redondo | `50%` | un solo parámetro de **diámetro** (= el del círculo real: 32px avatar de sidebar, etc.). |
| **`SkeletonPill`** | pill / stepper / segmented / chip-contador | `--r-pill` | alto/ancho del control real (p.ej. stepper ~36px alto). Es un `SkeletonBlock` con radio pill; se nombra aparte por frecuencia de uso. |

- **Densidad/espaciado entre primitivas:** los placeholders se separan con **el mismo gap que separa los elementos reales** que imitan (la escala de espaciado del DS: `--gap` 18px entre cards, `--row-pad` 14px de fila, el `gap` real entre líneas de un ítem). No hay un "gap de skeleton" propio: hereda el ritmo del layout real.
- **Cuántos placeholders en una lista:** una lista fantasma muestra **un número fijo y razonable de filas** (**5–7** para una lista de movimientos/categorías), no una ni infinitas. Suficientes para llenar el viewport sin scroll inicial y comunicar "viene una lista"; no tantas que el aterrizaje de una lista corta genere salto al colapsar. Cada fila fantasma replica la **estructura de columnas** de la fila real (p.ej. en `/mes`: `[círculo ícono] [línea nombre + línea meta] [línea fecha] [línea monto]`).

#### Accesibilidad (obligatoria en todo skeleton)

- El **contenedor** lleva **`role="status"`** + **`aria-label`** descriptivo del contenido en carga (p.ej. `"Cargando movimientos"`, `"Cargando totales"`, `"Cargando configuración"`, `"Cargando gráfico"`).
- Los **placeholders internos** (líneas, bloques, círculos) son **decorativos**: `aria-hidden="true"`. El `role="status"` del contenedor ya anuncia el estado.
- **No** se usa `role="alert"` (eso es para error, que tiene su propio patrón). El skeleton es `status` (información, no urgencia).

#### Cómo construir el skeleton de una pantalla (lineamiento)

1. **Identificá la estructura estable vs. la dependiente del dato.** Lo estable (chrome de card, títulos fijos, controles que no dependen del dato) puede renderizarse **ya, inerte**; solo el área de dato se reemplaza por fantasmas.
2. **Mapeá cada elemento real a una primitiva** con sus medidas reales (línea→`SkeletonLine` del alto del texto; card→`SkeletonBlock` del alto de la card; avatar→`SkeletonCircle` del diámetro; pill→`SkeletonPill`).
3. **Respetá columnas, gaps y radios reales** para que no haya salto al aterrizar.
4. **Envolvé** en un contenedor `role="status"` + `aria-label`; los placeholders `aria-hidden`.
5. **La animación es `pulse`** (opacidad latiendo sobre `--panel-3`), off en reduced-motion.
6. **Mostralo solo en la carga inicial**, cuando aún no hay datos: nunca en refetch ni en interacciones con el dato ya presente (colapsar/expandir o reordenar secciones no muestra skeleton).

#### Mapeo de casos (unificación)

Todos los estados de carga se componen sobre las primitivas (mismo resultado visual o mejor, mismo lenguaje). Las medidas reales se conservan; cambia el **cómo** (primitivas + pulse + a11y consistente), no el layout. Los primeros cuatro casos reescriben los skeletons ad-hoc originales; los dos últimos (**filas de sección en `/mes`** y **Dashboard**) son **mapeos nuevos** (Ola 1) — antes no tenían skeleton o lo tenían incompleto.

| Caso | Hoy (ad-hoc) | Pasa a usar |
|---|---|---|
| **Totales de `/mes`** (`month-view-client.tsx`, 3 cards de total) | `div.h-[90px] animate-pulse rounded-card bg-panel-3` ×3 en grid `1fr 1fr 1.1fr`, ya con `role="status"` `aria-label="Cargando totales"` | **3× `SkeletonBlock`** radio `--r-card`, alto **90px**, en el **mismo grid `1fr 1fr 1.1fr` con `--gap`**. Conserva el `role="status"`/`aria-label` (ya correcto). Solo cambia el fill ad-hoc por la primitiva (`animate-pulse` sobre `bg-panel-3`). |
| **Card de reporte** (`report-card.tsx`, `ChartSkeleton`) | bloque `animate-pulse rounded-ctl bg-panel-3` del alto del canvas + 3 chips `rounded-chip bg-panel-3` (70/56/80 ×14px) de leyenda; hijos `aria-hidden` | **1× `SkeletonBlock`** radio `--r-ctl` del **alto del canvas** (300/280/220) + **3× `SkeletonLine`/`SkeletonPill`** de leyenda (anchos 70/56/80, alto 14, radio `--r-chip`). **Cambio a11y:** envolver en contenedor **`role="status"` `aria-label="Cargando gráfico"`** (hoy los hijos son `aria-hidden` pero falta el `status` contenedor). La cabecera/tabs de la card ya está presente e inerte (correcto). |
| **`/configuracion`** (`settings-client.tsx`, skeleton del segmented) | `div.rounded-pill bg-panel-3 animate-pulse` 220×36, `aria-hidden` | **1× `SkeletonPill`** radio `--r-pill`, 220×36, dentro de la fila de ajuste real (título + descripción reales presentes; solo el control es fantasma). **Cambio a11y:** el área de carga debe quedar bajo un `role="status"` `aria-label="Cargando configuración"`. |
| **`/categorias`** (`categories-list.tsx`, skeleton de pantalla) | header fantasma (`h-3 w-24` eyebrow + `h-8 w-36` H1 + `h-10 w-36` botón) + `h-[200px]` área lista, todo `animate-pulse rounded-… bg-panel-3` | **Header:** `SkeletonLine` eyebrow (alto ~12px, ancho ~96px, radio chip) + `SkeletonLine` H1 (alto ~32px, ancho ~144px) + `SkeletonBlock` botón (`--r-ctl`, 40×144). **Lista:** en vez de un único bloque `h-[200px]`, **5–7 filas fantasma** que replican la estructura del `catrow` real (`[SkeletonBlock swatch 14px] [SkeletonLine nombre] [SkeletonLine uso]`) dentro de la `.cat-list`, para que el aterrizaje de la lista real no salte. **Cambio a11y:** contenedor `role="status"` `aria-label="Cargando categorías"`. |
| **Filas de sección en `/mes`** (`month-view-client.tsx`, secciones Únicos/Fijos/Cuotas) — **mapeo nuevo (Ola 1)** | hoy durante la carga **solo** se ven los 3 `SkeletonBlock` de los totales; las secciones **no muestran nada** (el área de lista queda vacía hasta que llega el dato). | Mientras `isLoading`, las **tres secciones se renderizan ya** con su cabecera fantasma y su cuerpo de filas fantasma (en vez del listado vacío). Por sección: **(a) Cabecera** — imitar la `.ghead` real (`accordion-section.tsx`): `SkeletonBlock` chevron 16×16 (radio `--r-chip`) + `SkeletonLine` rótulo (alto **13px**, ancho ~80px) + `SkeletonPill` contador (alto ~16px, ancho ~26px, radio `--r-pill`) + línea divisora `--hair` real (no fantasma, es chrome estable) + `SkeletonLine` subtotal mono (alto **13px**, ancho ~72px, alineado a la derecha). El **chevron va estático en ▶ (colapsado-look) o se omite la rotación** — es fantasma, no acciona. Sin handle de drag (el modo orden no existe en carga). **(b) Cuerpo** — la tarjeta-lista real (`bg-panel border-line rounded-card --shadow-sm overflow-hidden`, chrome estable presente) con **3 filas fantasma por sección** (no 5–7: son tres secciones a la vez; 3×3 = 9 filas llenan el viewport sin exceso y el aterrizaje de listas cortas no salta). Cada fila fantasma replica el grid real del `MovementItemRow` (`40px 1fr auto auto auto`, `padding var(--row-pad) 18px`, divisor `--hair` entre filas): **`SkeletonCircle` ícono 40px** + columna texto (`SkeletonLine` nombre alto **14.5px** ancho ~60% + `SkeletonLine` meta alto **12.5px** ancho ~40%, gap real entre ambas) + `SkeletonLine` fecha (alto 12.5px, ancho ~52px, alineada derecha) + `SkeletonLine` monto (alto **15.5px**, ancho ~84px, alineada derecha) + **sin** col de kebab (aparece solo en hover). **a11y:** el área de secciones bajo carga va en contenedor `role="status"` `aria-label="Cargando movimientos"` (distinto del `"Cargando totales"` de los 3 totales — son dos bloques de carga). |
| **Dashboard** (`/`, `dashboard-client.tsx`) — **mapeo nuevo (Ola 1)** | hoy ad-hoc: 2 bloques `h-[120px] animate-pulse rounded-card bg-panel-3` en grid `1fr 1fr` + 1 bloque `h-[160px]` debajo, todo bajo `role="status" aria-label="Cargando totales"`. **No imita** el layout cargado real (faltan la card de reporte y el footer; los altos no coinciden con las stat-cards/hero reales). | Imitar el layout cargado real del resumen + widget, para que no salte al aterrizar. Bajo `role="status" aria-label="Cargando totales"`, **`space-y-[var(--gap)]`**: **(1)** grid `grid-cols-2 gap-[var(--gap)]` con **2× `SkeletonBlock`** (radio `--r-card`) del alto de las stat-cards reales Gastos/Ingresos — **~120px** (el alto real lo fija el contenido: eyebrow + cifra 30px + meta; 120px es la aproximación vigente, mantener). **(2)** **1× `SkeletonBlock`** radio `--r-card` para el **balance hero** — alto **~160px** (eyebrow + cifra 46px + barra de proporción + leyenda). **(3)** **1× `SkeletonBlock`** radio `--r-card` para la **card de reporte** del dashboard (hoy ausente del skeleton): alto ≈ chrome de card-pad + cabecera + **canvas 280px** + leyenda ≈ **~380px** — `control-frontend` ajusta al alto real montado de `ReportCard` con `chartHeight={280}` para evitar salto. La cabecera/controles de esa card pueden alternativamente renderizarse inertes (chrome estable) con solo el canvas como `SkeletonBlock` radio `--r-ctl` 280px + 2–3 `SkeletonLine` de leyenda — preferible si el alto exacto del bloque único es difícil de clavar. El **footer "Ver todos"** no necesita fantasma (es link, no dato). El **header `.phead`** (eyebrow + H1 + botón "+ Nuevo") **ya se renderiza presente e inerte** fuera del bloque de carga (correcto — es estructura estable). |

> **Regla viva derivada:** ningún componente nuevo escribe `animate-pulse bg-panel-3` inline. Todo estado de carga compone las **primitivas** (`SkeletonLine` / `SkeletonBlock` / `SkeletonCircle` / `SkeletonPill`) del componente `Skeleton`, imitando las medidas reales, con pulse (`animate-pulse` sobre `bg-panel-3`, off en reduced-motion) y `role="status"` + `aria-label` en el contenedor. El fill es `--panel-3`; nunca color semántico ni de marca. El skeleton se muestra **solo en la carga inicial** —nunca en refetch ni en interacciones con dato ya presente.

---

## Specs de fase

El lenguaje visual vigente y reutilizable que salió de cada fase de implementación está consolidado en las secciones de arriba. Las decisiones puntuales de cada fase, una vez implementadas, dejan de tener documento propio: lo que sobrevive es la regla en presente; el "cuándo/por qué cambió" vive en el historial de git.
