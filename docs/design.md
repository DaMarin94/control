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

- **Forma lateral (canónica, a ancho de página):** layout de **3 columnas** `[ ‹ ] [ contenido ] [ › ]` (`grid-template-columns: auto minmax(0, 1120px) auto`, `mx-auto`), con las flechas en columnas propias que flanquean el contenido (simetría del **contenido**, no del viewport). Cada flecha: `button` circular **64×64px**, glifo `ChevronLeft`/`ChevronRight` (lucide) **46px** `stroke-width 1.75`, **sin fill** en reposo, glifo `--faint`. Aire flecha↔contenido 20px. Centrado vertical con `sticky; top: 50vh; translateY(-50%)` dentro de la columna lateral. **Vigente en `/mes`** (período = mes; flags siempre `true`).
- **Forma compacta (`.stepper` pill):** el **modo de colapso** del mismo patrón, también usado **embebido** cuando no hay lugar para flechas laterales (cards apiladas, mobile). Pill `.stepper` del DS: `--r-pill`, `--panel`, borde `--line`, `--shadow-sm`, padding 4px; dos botones circulares **32px** (chevron-left/right, glifo 18px, `--ink-2` → `--ink` sobre `--panel-2` en hover) y, al centro, el rótulo del período (si es número → **mono tabular**, regla dura 3). **Vigente como control de año embebido per-card** en `/reportes` y en el Dashboard (ver *card de reporte* abajo).

**Estados de la flecha/chevron (comunes a ambas formas):**

- **Reposo:** glifo `--faint` (lateral) / `--ink-2` (stepper), `cursor: pointer`.
- **Hover:** glifo a `--ink`; en la forma lateral aparece un fondo circular `--panel-2`; en el `.stepper`, fondo `--panel-2` en el botón. Transición 0.14s.
- **Active:** fondo `--panel-3`.
- **Focus (teclado):** ring `--accent-soft` 3px (`focus-visible`).
- **Disabled (`canGoPrev`/`canGoNext` = false):** glifo `--faint` con `opacity: 0.4`, sin hover, `cursor: default`, `aria-disabled`. **No se oculta** — presente pero apagado. Es el estado que usan los límites de navegación de año (`earliestYear` / año en curso).

`aria-label` según el período: "Mes anterior/siguiente" (mes) o "Año anterior/siguiente" (año).

**Responsive (forma lateral):** dos regímenes. **≥941px (con lugar):** flechas laterales simétricas que se encogen parejo al angostar. **≤940px (sidebar oculta):** colapsa a la forma compacta `.stepper` en el header. **No existe** un modo intermedio de "flechas con fondo pegadas al borde".

**Movimiento:** hover 0.14s; el cambio de período dispara el re-render de la vista (entrada de pantalla 0.32s); las flechas no animan posición. Respeta `prefers-reduced-motion`.

> Detalle verbatim: *Navegación de período — flechas gigantes laterales (Fase 1.1.3)* y *Reportes configurables → A.1. Control de año embebido per-card (Fase 1.1.5)* en `docs/design/specs-archive.md`.

### Acordeón — sección colapsable + reordenable

Patrón **genérico reutilizable** de "sección de acordeón" = **cabecera (`.ghead`) + cuerpo (tarjeta-lista)**, que se colapsa/expande individualmente y se reordena entre pares por drag. Vigente en `/mes` (Únicos / Fijos / Cuotas), instanciable N veces en otras pantallas. **Construido SOBRE el look existente de la `.ghead`**, sin reemplazarlo.

**Cabecera colapsable (disclosure):**

- Toda la `.ghead` es el control que colapsa/expande su cuerpo (un único `button`, `aria-expanded` + `aria-controls`). Sigue siendo la misma fila "al aire" (sin caja).
- **Chevron:** `ChevronRight` (lucide) **16px** `stroke-width 2`, **primer elemento** de la fila, `--muted` en reposo. Un único glifo que **rota**: **expandida** → apunta ▼ (90°); **colapsada** → apunta ▶ (0°).
- **Estados:** *reposo* = `.ghead` de hoy + chevron `--muted`. *Hover* (sobrio, sin fondo en la fila): chevron → `--ink-2`, rótulo → `--ink`, transición 0.14s. *Focus*: ring `--accent-soft` 3px con radio `--r-chip` 7px.
- **Resumen visible al colapsar:** el pill contador y el subtotal mono **permanecen visibles** colapsados (es la info de resumen de un vistazo). Solo se oculta el cuerpo y el chevron rota a ▶.

**Animación:** altura del cuerpo 0↔auto (con `overflow: hidden`) + fade + rotación del chevron, **0.22s ease-out**. Respeta `prefers-reduced-motion` (instantáneo).

**Sección vacía:** las secciones se renderizan **siempre** (también vacías). Cabecera completa con contador `0` y subtotal en cero. Cuerpo (expandido): caja `rounded-card border border-dashed border-line bg-panel-2`, padding `px-6 py-6`, una línea centrada *Meta/subtítulos* (12.5–13px, `--muted`). El borde **dashed** = "acá todavía no hay nada".

**Modo orden (reordenar secciones, no ítems):** acción deliberada vía un **modo explícito**, no handles permanentes.

- **Disparador:** botón ghost del DS en el `.phead`, ícono `ArrowUpDown` 15px, "Ordenar secciones". Al entrar se transforma en **"Listo"** (primario índigo); "+ Nuevo movimiento" se deshabilita mientras dura el modo.
- **Handle:** `GripVertical` (lucide) 16px `--muted` a la izquierda del chevron, `cursor: grab`/`grabbing`. Motor: **dnd-kit**. Durante el modo, la cabecera **no** colapsa (está dedicada a arrastrar; el chevron se ve pero no es accionable).
- **Drag:** ítem levantado con `--shadow-lg` + `scale(1.02)` + `opacity ~0.95`; hueco destino `rounded-card`, `--panel-2`, **borde dashed `--line`** (alternativa: línea de inserción 2px `--accent`, indicador de UI). Las demás secciones se desplazan suave (0.14–0.22s).
- **Salida:** "Listo" vuelve a "Ordenar secciones"; el orden se aplica en vivo (sin "cancelar" en v1).

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

### Filtro de categorías embebido (checklist en popover)

Control reutilizable para filtrar por categorías sin tapar el contenido. Botón disparador + popover con checklist.

- **Disparador:** botón ghost chico (`.btn.ghost.sm`), ícono `SlidersHorizontal` 15px. Rótulo **"Categorías"** (default, todas) / **"Categorías · N"** (subconjunto, `· N` mono `--ink`) / **"Categorías · 0"** (ninguna). Con filtro activo: ícono+texto suben a `--ink` y aparece un **punto indicador 6px `--accent`** (cromo de UI, no monto).
- **Popover:** `--panel`, `--line`, `--r-ctl`, `--shadow-lg`, ancho 260px, `max-height ~320px` con scroll interno (header/footer fijos). Header: label "Mostrar categorías" + toggle "Todas"/"Ninguna" (link `--accent-ink`). Filas: checkbox del DS + **swatch de color 10px radio 3px** + nombre 13px (`--ink` tildada / `--ink-2` destildada). El universo son las categorías **activas**. Filtro **en vivo** (sin Aplicar/Cancelar); cierra por clic fuera / `Esc` / re-clic.
- Si el filtro vacía el reporte, el gráfico muestra los 12 meses en cero con el empty "Sin movimientos…" (sin error); los límites de año no cambian.

> Detalle verbatim: *Reportes configurables → A.2. Filtro de categorías embebido (Fase 1.1.5)* en `docs/design/specs-archive.md`.

### Picker de color de categoría (matriz de swatches)

Selector del color de categoría en el modal de categoría (crear y editar), que consume la **matriz de 70 colores** (ver *Paleta de colores para categorías*). Grid 10 columnas × 7 filas, swatch cuadrado `aspect-ratio: 1` radio `--r-chip` 7px, gap 6px.

- **Estados del swatch:** *reposo* = su hex con borde `--line` 1px. *Hover* = `scale(1.12)` + `--shadow-sm`, borde `--line-strong`, transición 0.14s. *Seleccionado* = anillo `box-shadow: 0 0 0 2px var(--panel), 0 0 0 4px var(--ink)` (ring **neutro `--ink`**, no acento — regla dura 2). *Focus* = ring `--accent-soft` 3px.
- **Botón "Aleatorio":** ghost chico (`Shuffle` 15px) que mueve la selección a un swatch al azar **de la matriz** (nunca un hex fuera de ella).
- **Crear:** arranca en el color menos usado (fila T4). **Editar:** arranca en el color actual de la categoría.

> Detalle verbatim: *Picker de color de categoría — spec visual (Fase 1.1.2)* en `docs/design/specs-archive.md`.

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
