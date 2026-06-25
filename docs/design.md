# Guía de diseño — Control

> Guía **viva** del lenguaje visual de Control. Es la versión **curada y vigente** de cómo se ve el producto: la fuente de verdad de las decisiones visuales que `control-design` mantiene y que `control-frontend` implementa.
>
> **Relación con los otros documentos de diseño:**
> - **`docs/design/`** — handoff crudo "Precise Ledger" (`control.css` + `README.md`): el material de origen del prototipo, con todos los valores y la racional. Es la referencia de donde sale esta guía; no se edita.
> - **`docs/frontend.md`** (secciones Design system) — cómo los tokens están **implementados** en el código (Tailwind v4, dualidad `@theme`/`:root`, qué está portado). El "cómo" técnico.
> - **`docs/design.md`** (este documento) — el "qué" visual vigente: paleta, tipografía, espaciado, geometría, jerarquía, los **patrones de componentes vigentes** y las reglas duras. Ante un conflicto con el handoff crudo, prevalece lo cerrado acá.
>
> Sistema: **"Precise Ledger"**, densidad Medio, acento Índigo. Dos **modos de color** vigentes — **claro** y **oscuro** — con default **Sistema** (sigue `prefers-color-scheme`); el lenguaje visual es el mismo en ambos, cambia la paleta de tokens. La densidad variable no está en v1. La paleta dark y su selector se definen en *Modo de color — claro / oscuro*.

---

## Reglas duras

No se negocian sin decisión explícita del usuario:

1. **Verde = ingreso, Rojo = gasto.** Reservados **estrictamente** para ese significado semántico. No se usan para decorar ni para otra cosa.
2. **El acento índigo es solo marca.** NUNCA se usa para montos ni para teñir cifras de dinero.
3. **Toda cifra de dinero va en mono tabular** (IBM Plex Mono + `font-feature-settings: "tnum" 1`). Sin excepción.
4. **Compatibilidad visual total en cualquier dispositivo.** Toda pantalla y componente se ve correcto en **ambos modos de color** (claro y oscuro) y en cualquier tipo de dispositivo. Ninguna superficie, texto, borde, sombra o estado puede asumir un único modo: cada token semántico tiene su valor en claro y en oscuro (ver *Modo de color — claro / oscuro*), y las reglas duras 1–3 (verde/rojo, índigo solo marca, mono tabular) se cumplen **idénticas** en los dos modos.

---

## Paleta y uso de tokens

> Valores definidos en `docs/design/control.css` con `oklch()`. Hex aproximados solo como referencia rápida — preferir los valores oklch.
>
> Las tablas de abajo dan el valor **claro** de cada token. El valor **oscuro** de **todos** los tokens vive en *Modo de color — claro / oscuro* (la columna "Dark"). Los componentes consumen siempre el alias (`var(--token)`); el modo activo decide qué valor toma.

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

## Modo de color — claro / oscuro

Control tiene **dos modos de color**: **claro** y **oscuro**. El lenguaje visual (tipografía, geometría, espaciado, jerarquía, patrones de componente, las tres reglas duras semánticas) es **idéntico** en ambos; lo único que cambia es la **paleta de tokens**. Default = **Sistema** (sigue `prefers-color-scheme`); el usuario lo fija desde el **chrome global** (el toggle de tema del sidebar — ver *Selector de modo de color* abajo). Es **regla dura 4**: toda superficie se ve correcta en los dos modos.

### Cómo se modela

- **Un solo alias por token, dos valores.** Los componentes consumen siempre `var(--token)` (nunca un valor literal). El **claro** es el valor base (en `:root`, tablas de *Paleta y uso de tokens*); el **oscuro** son overrides de los **mismos alias** bajo el selector `[data-theme="dark"]`. (Los tokens `@theme` de Tailwind no soportan theming dinámico, así que el dark vive sobre los alias `:root` / sombras / focus; el cómo técnico es de `control-frontend` — acá se definen solo los **valores y reglas**.)
- **Qué tokens cambian:** **todos** los neutros, **todos** los semánticos (income/expense/warning con sus `-soft`/`-ink`), **toda** la familia de acento, las **tres sombras** compuestas, y el **focus ring** (que es `--accent-soft`) y su variante de error (`--expense-soft`). Nada queda sin valor dark.
- **Qué NO cambia:** los **hex canónicos de categoría** (la matriz de 70 + el pool) son identificadores fijos — los mismos valores en ambos modos; cambia solo su **presentación** (ver *Categorías y gráficos en oscuro*). Tipografía, radios, densidad y la semántica de las reglas duras 1–3 son invariantes.

### Principios de calibración del oscuro

- **No es un negro puro.** El fondo de app es un gris-azulado muy oscuro (no `#000`), con la misma familia de hue neutro (`270`) que el claro, para que la app no vibre ni "queme". Las superficies suben de luminosidad por capas (`paper` < `panel` < `panel-2` < `panel-3`), igual que en claro pero en sentido ascendente desde un piso oscuro.
- **El texto baja de croma y sube de luminosidad.** `--ink` no llega a blanco puro (reduce halación sobre fondo oscuro); los terciarios mantienen su jerarquía relativa (ink > ink-2 > muted > faint).
- **Los bordes se invierten de polaridad.** En claro, líneas/bordes son `ink` con baja alfa (oscuro sobre claro). En oscuro pasan a ser **blanco con baja alfa** (claro sobre oscuro) — mismo rol, polaridad invertida — para que se lean como separadores sutiles, no como rayas negras invisibles.
- **Semánticos recalibrados, mismo significado.** Verde sigue siendo verde y rojo sigue siendo rojo (regla dura 1), pero sobre fondo oscuro necesitan **más luminosidad** para legibilidad de texto/swatch, y los `-soft` (fondos tintados) dejan de ser casi-blancos: pasan a **tintes oscuros saturados** del mismo hue, sutiles sobre el panel. Los `-ink` (texto sobre `-soft`) suben de luminosidad para contrastar contra el `-soft` oscuro.
- **Sombras dependen más del borde.** En oscuro, una sombra negra "desaparece" sobre fondo oscuro; la elevación se comunica sobre todo por **el escalón de superficie** (`panel` más claro que `paper`) + el **borde superior** sutil. Las sombras se conservan pero con **más opacidad y negro más puro**, como refuerzo, no como única señal de elevación.

### Paleta dark — valores completos (oklch)

> Override de los alias bajo `[data-theme="dark"]`. La columna **Light** repite el valor base (referencia); **Dark** es lo nuevo a portar. Racional breve por grupo arriba de cada tabla.

**Neutros** — piso oscuro hue `270`, superficies ascendentes, texto sin blanco puro, bordes en blanco con alfa.

| Token | Light | **Dark** | Rol |
|---|---|---|---|
| `--paper` | `oklch(0.965 0.004 270)` | `oklch(0.18 0.008 270)` | fondo de app (piso oscuro, no negro) |
| `--panel` | `#ffffff` | `oklch(0.225 0.009 270)` | tarjetas / superficies (escalón sobre paper) |
| `--panel-2` | `oklch(0.975 0.004 270)` | `oklch(0.265 0.010 270)` | hover sutil (un paso más claro) |
| `--panel-3` | `oklch(0.955 0.005 270)` | `oklch(0.305 0.011 270)` | chips / fills (el más claro de las superficies) |
| `--ink` | `oklch(0.22 0.012 270)` | `oklch(0.95 0.006 270)` | texto principal (casi blanco, no `#fff`) |
| `--ink-2` | `oklch(0.40 0.012 270)` | `oklch(0.78 0.008 270)` | texto secundario |
| `--muted` | `oklch(0.55 0.012 270)` | `oklch(0.62 0.009 270)` | texto terciario |
| `--faint` | `oklch(0.70 0.010 270)` | `oklch(0.48 0.009 270)` | placeholders |
| `--hair` | `ink/0.10` → `oklch(0.22 0.012 270 / 0.10)` | `oklch(1 0 0 / 0.07)` | divisores internos (blanco/alfa) |
| `--line` | `ink/0.17` → `oklch(0.22 0.012 270 / 0.17)` | `oklch(1 0 0 / 0.12)` | bordes de tarjeta (blanco/alfa) |
| `--line-strong` | `ink/0.28` → `oklch(0.22 0.012 270 / 0.28)` | `oklch(1 0 0 / 0.20)` | bordes de input (blanco/alfa) |

**Semánticos income / expense / warning** — verde/rojo/ámbar recalibrados para fondo oscuro; los `-soft` pasan a tintes oscuros; los `-ink` suben para contrastar sobre el `-soft`.

| Token | Light | **Dark** | Rol |
|---|---|---|---|
| `--income` | `oklch(0.58 0.12 158)` | `oklch(0.70 0.13 158)` | verde de ingreso (más luminoso) |
| `--income-soft` | `oklch(0.95 0.04 158)` | `oklch(0.32 0.05 158)` | fondo tintado verde (oscuro sutil) |
| `--income-ink` | `oklch(0.45 0.11 158)` | `oklch(0.80 0.12 158)` | texto verde sobre `-soft` oscuro |
| `--expense` | `oklch(0.57 0.16 27)` | `oklch(0.66 0.17 27)` | rojo de gasto (más luminoso) |
| `--expense-soft` | `oklch(0.95 0.035 27)` | `oklch(0.33 0.06 27)` | fondo tintado rojo (oscuro sutil) |
| `--expense-ink` | `oklch(0.47 0.15 27)` | `oklch(0.78 0.15 27)` | texto rojo sobre `-soft` oscuro |
| `--warning` | `oklch(0.72 0.15 75)` | `oklch(0.78 0.15 75)` | ámbar de aviso |
| `--warning-soft` | `oklch(0.95 0.05 75)` | `oklch(0.34 0.06 75)` | fondo tintado ámbar (oscuro sutil) |
| `--warning-ink` | `oklch(0.52 0.12 75)` | `oklch(0.84 0.13 75)` | texto ámbar sobre `-soft` oscuro |

> **Regla dura 1 en oscuro:** el color del monto lo sigue dando el **tipo** (verde=ingreso, rojo=gasto), con estos valores recalibrados; nunca el signo ni la decoración. Los `-soft` siguen siendo solo **fondos tintados** de badges/estados (badge de tipo del calculado, ring de error), nunca superficies grandes saturadas.

**Acento índigo** — el acento es **solo marca** (regla dura 2): nunca tiñe montos. En oscuro sube de luminosidad para destacar sobre el panel oscuro; el `-soft` pasa a tinte índigo oscuro (sigue sirviendo de focus ring); el `-ink` sube para texto sobre `-soft` oscuro. Se controla por el mismo `--accent-h: 264`.

| Token | Light | **Dark** | Rol |
|---|---|---|---|
| `--accent` | `oklch(0.52 0.17 264)` | `oklch(0.66 0.17 264)` | acción primaria / marca (más luminoso) |
| `--accent-press` | `oklch(0.45 0.17 264)` | `oklch(0.58 0.17 264)` | pressed |
| `--accent-soft` | `oklch(0.95 0.035 264)` | `oklch(0.34 0.07 264)` | fondos suaves + **focus ring** (tinte índigo oscuro) |
| `--accent-ink` | `oklch(0.40 0.16 264)` | `oklch(0.82 0.14 264)` | texto índigo sobre fondo oscuro/`-soft` |

> El **botón primario** sigue con su inset highlight, pero en oscuro el highlight superior baja de opacidad (`white/0.12` aprox.) para no quemar; el cómo exacto es de `control-frontend`. **El índigo no tiñe ninguna cifra de dinero en ningún modo** (regla dura 2).

**Sombras compuestas** — en oscuro suben de opacidad y usan negro más puro; la elevación se apoya sobre todo en el escalón de superficie + borde.

| Token | **Dark** |
|---|---|
| `--shadow-sm` | `0 1px 2px oklch(0 0 0 / 0.30), 0 1px 3px oklch(0 0 0 / 0.24)` |
| `--shadow-md` | `0 4px 16px oklch(0 0 0 / 0.40), 0 2px 6px oklch(0 0 0 / 0.30)` |
| `--shadow-lg` | `0 18px 50px oklch(0 0 0 / 0.55), 0 6px 18px oklch(0 0 0 / 0.40)` |

**Focus ring (dark):** sigue siendo el anillo de 3px en `--accent-soft` (ahora tinte índigo oscuro `oklch(0.34 0.07 264)`) — visible sobre panel oscuro. La variante de **error** usa `--expense-soft` dark (`oklch(0.33 0.06 27)`). Mismo grosor y geometría que en claro.

### Categorías y gráficos en oscuro

Los **hex canónicos de categoría no cambian** (la matriz de 70 + el pool son identificadores fijos, fuente de verdad compartida con el backend; cambiarlos rompería el back-compat). Lo que se define es **cómo se presentan** sobre superficie oscura:

- **Swatch de color sólido (lista de categorías, bandas del apilado, swatch de leyenda):** se usa el **hex tal cual** en ambos modos. Sobre panel oscuro, los hex **oscuros** de la matriz (filas T5–T7) pierden separación del fondo; por eso **todo swatch lleva un hairline de contorno** en dark: borde `1px` `--line` (blanco/alfa 0.12) alrededor del swatch. Ese contorno ya existe como recurso del DS; en oscuro es **obligatorio** para garantizar que el swatch se lea como ficha y no se funda con el panel. (En claro el contorno es opcional/sutil; en oscuro es regla.)
- **Filas claras T1–T3 como fondo de chip:** siguen funcionando — son pasteles claros, contrastan bien sobre panel oscuro. El **texto** que va sobre un chip pintado con un hex de categoría se calcula por contraste contra **ese hex** (no contra el modo): un fondo T1–T3 (claro) lleva texto oscuro; un fondo T5–T7 (oscuro) lleva texto claro. El cálculo de contraste es **independiente del modo** (depende del hex del swatch), por eso el chip de categoría se ve igual de legible en claro y oscuro.
- **Series de gráfico (Forma 2, apilado por categoría):** las bandas usan el hex de cada categoría sin cambio; sobre fondo de gráfico oscuro, las bandas de hex oscuros se separan entre sí y del fondo con el **gridline/hairline** del propio gráfico. No se recolorea ninguna serie por modo.
- **Ejes, gridlines y tooltips del gráfico:** son **cromo neutro** → consumen tokens (`--line`, `--hair`, `--muted`, `--panel`, `--ink`), así que se adaptan solos al modo. La **Forma 1** (área ingresos vs. gastos) usa `--income`/`--expense` recalibrados; el relleno de área baja su opacidad sobre fondo oscuro (mismo recurso que en claro, ajustado por `control-frontend`).

### Panel de marca de auth en oscuro

El **panel de marca** del login/registro (`.auth-grid-bg` + `.auth-glow`) ya está construido **sobre un fondo oscuro de marca** (la grilla y el glow son blanco con baja alfa sobre un panel índigo/oscuro). Por eso ese panel **no cambia entre modos**: es una superficie de marca con su propio fondo, no una superficie de contenido que dependa de los tokens neutros. La grilla (`oklch(1 0 0 / 0.07)`) y el glow (`oklch(1 0 0 / 0.18)`) se mantienen idénticos. La **columna de formulario** del auth (la otra mitad) sí es superficie de contenido y **sigue los tokens** (paper/panel/ink), por lo que se oscurece con el modo como cualquier pantalla.

### Transición de cambio de modo

- **El cambio de modo es instantáneo en estructura, suave en color.** Al togglear (o al cambiar `prefers-color-scheme` en modo Sistema), los tokens de color cruzan con una **transición corta de `background-color` / `color` / `border-color` de ~0.18–0.20s ease**, aplicada a nivel raíz, para que el flip no sea un corte brusco. No se animan tamaños, posiciones ni layout — solo color.
- **Respeta `prefers-reduced-motion`:** con reduced-motion el cambio de modo es **instantáneo** (sin transición de color).
- **Sin flash en carga (FOUC):** el modo resuelto debe aplicarse **antes del primer paint** para que nunca se vea un destello de claro antes de pasar a oscuro (ni viceversa). El mecanismo exacto es de `control-frontend`; el comportamiento a cumplir es: la primera pintura ya está en el modo correcto.

### Selector de modo de color (chrome global)

El control del modo de color vive en el **chrome global** (el sidebar / `AppSidebar`), no en una pantalla. Es un control de **chrome persistente**, siempre alcanzable desde cualquier vista. Su forma es un **toggle compacto de 3 iconos** (`Sistema · Claro · Oscuro`).

- **Ubicación — fila propia en el bloque inferior del sidebar, justo encima del `UserMenu`.** El bloque inferior del sidebar queda, de arriba a abajo: CTA "+ Nuevo movimiento" → **fila del toggle de tema** → `UserMenu`. La fila es de ancho completo del contenido del sidebar (248px menos padding lateral), con el toggle **alineado a la derecha** y una etiqueta `--faint` a la izquierda. Va **separada del `UserMenu` por el patrón del DS** (un `--hair` o gap), de modo que se lea como su propio control y no como parte del bloque de cuenta.
  - **Por qué fila propia y no dentro del dropdown del `UserMenu` ni un segmented de labels inline:** (1) el dropdown del `UserMenu` es para acciones de cuenta (un solo ítem, "Cerrar sesión") y abre hacia arriba con poco alto; meter un control de 3 estados ahí lo vuelve un menú denso y esconde el modo tras dos clics. (2) Un segmented con labels de 3 (`Sistema · Claro · Oscuro`) en un track de ~200px quedaría **apretado** dentro de los ~216px útiles del sidebar (248px − padding), y competiría visualmente con los nav-links. El **toggle de iconos** ocupa ~108px, respira en la fila, queda siempre visible (un clic) y no compite con la navegación.
- **Forma — toggle de iconos de 3 segmentos (variante compacta del segmented neutro).** Mismo cromo neutro que el segmented del DS, pero los segmentos muestran **solo un icono** (sin label visible):
  - **Track:** `--panel-3`, radio `--r-pill`, padding interno `2px`, `inline-flex`. Ancho intrínseco al contenido (no estira a 100%): 3 segmentos cuadrados.
  - **Segmentos:** 3 botones de **ancho igual**, cada uno `~32–34px` de lado (target táctil ≥32px en el lado corto), icono lucide centrado `size 16`, radio `--r-pill`.
  - **Iconos (orden fijo izq → der):** `Monitor` (Sistema) · `Sun` (Claro) · `Moon` (Oscuro). El icono **es** el control acá: no hay label textual visible.
  - **Thumb deslizante:** `--panel` + `--shadow-sm`, entre 3 posiciones (`left = calc((i/3)*100% + 2px)`, `width = calc(33.33% - 4px)`), transición `[left,width]` 140ms ease-out; instantánea con `prefers-reduced-motion`.
  - **Color del icono:** *seleccionado* = `--ink`; *no seleccionado* = `--muted` → `--ink-2` en hover. **Sin color semántico ni índigo** en los iconos (cromo neutro de control); el índigo solo aparece como focus ring.
- **Etiqueta de la fila:** a la izquierda del toggle, label corto `--faint` `text-[10.5px] font-semibold uppercase tracking-[0.12em]` "Tema" (mismo molde que el label "Menú" del sidebar). Es opcional visualmente pero recomendado para anclar la fila; el toggle queda alineado a la derecha (`justify-between`).
- **Cómo se rotula "Sistema" (modo resuelto):** el toggle muestra siempre los 3 iconos; el seleccionado es el que el usuario fijó (incluido `Monitor` para Sistema). El **modo efectivo** cuando está en Sistema **no se rotula visualmente en el chrome** (no hay descripción larga acá): se comunica por **a11y**. El `aria-label` de cada segmento dice su modo (`"Tema del sistema"` / `"Tema claro"` / `"Tema oscuro"`); cuando Sistema está activo, su `aria-label` resuelto incluye el modo efectivo: `"Tema del sistema (ahora: claro)"` / `"…(ahora: oscuro)"`, recalculado si cambia `prefers-color-scheme`. La verdad legible del modo efectivo vive en el lector de pantalla, no en texto visible del chrome.
- **Estados (idénticos al segmented neutro del DS):** *seleccionado* = thumb `--panel` + `--shadow-sm`, icono `--ink`. *No seleccionado* = icono `--muted` → `--ink-2` en hover. *Focus (teclado)* = ring `--accent-soft` 3px sobre el segmento activo. *Disabled* = `opacity-50` + `cursor-not-allowed` mientras persiste el cambio. El índigo aparece **solo** como focus ring (cromo de interacción), nunca tiñendo iconos.
- **A11y:** `role="radiogroup"` con `aria-label="Modo de color"` + 3 `role="radio"` con `aria-checked` y `aria-label` por opción (con el modo resuelto en Sistema, arriba); flechas ←/→ ciclan por los 3. Como no hay texto visible, **cada segmento debe tener su `aria-label`** (no basta el `aria-label` del grupo).
- **Persistencia:** persiste **en vivo** al seleccionar (sin botón Guardar). El cambio aplica el nuevo modo a toda la app de inmediato (con la transición de color de ~0.18s descrita arriba). Mientras persiste, el toggle queda *disabled* (estado de arriba). **No** lleva toast: es un control de chrome de feedback inmediato, donde el flip de color **es** la confirmación.
- **Responsive (drawer mobile ≤940px):** el toggle vive en el **mismo bloque inferior** del drawer overlay (que reusa el `sidebarContent`), en su fila propia encima del `UserMenu`. Mismo tamaño y forma que en desktop (el drawer también es de 248px). No hay variante mobile separada del control; cambia solo el contenedor (drawer vs. sidebar fijo). El toggle de iconos cabe holgado en ambos.
- **Skeleton:** si el bloque inferior del sidebar tiene estado de carga, el placeholder del toggle es un `SkeletonPill` (radio `--r-pill`) del alto del control (~36px) y ancho del toggle de 3 iconos (~108px). En la práctica el tema se resuelve antes del primer paint (sin FOUC), así que el toggle no suele requerir skeleton propio.

> **Resumen.** El control de modo de color **es** un toggle de iconos (`Monitor` Sistema · `Sun` Claro · `Moon` Oscuro, sin label visible) que vive en el bloque inferior de `AppSidebar`, en fila propia encima del `UserMenu`, con label "Tema" `--faint` a la izquierda y el toggle alineado a la derecha. Sus valores visuales (track, thumb, focus ring, estados, transición y a11y) son los descritos arriba en esta sección.

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

- **Identidad (izquierda):** **únicamente el título editable por card** (16px/600 `--ink`), sin eyebrow ni rótulo "Reporte" encima. El título es **definido por el usuario** y reemplaza al subtítulo fijo de tipo; cuando está vacío muestra el placeholder *"Reporte N"* (`--faint`). Ver *Título editable de la card de reporte* abajo para anatomía, edición, estados y placeholder. En la card `income-expense` (que lleva los `ViewTabs`) la identidad se ubica según esa misma sección.
- **Control de año embebido:** el `.stepper` de **PeriodNav** (forma compacta, arriba), año en **mono tabular**, con su estado **disabled** atado a `earliestYear` / año en curso. Navegación **activa** también en el Dashboard.
- **Selector de moneda de la card (solo `/reportes`):** override de display por card, persistido. Ver *Moneda por reporte — selector embebido en la cabecera de la card* abajo. **No aparece en la card del Dashboard.**
- **Filtro de categorías embebido:** ver *Filtro de categorías* abajo.
- **Quitar card (solo `/reportes`):** botón icon-only ghost `X` (16px), `--muted` → `--ink` sobre `--panel-2`, al final de la barra de controles, separado por un divisor `--hair` vertical. Abre una **confirmación inline** (popover `--panel`/`--line`/`--r-ctl`/`--shadow-lg`, "¿Quitar este reporte?", botón **danger** "Quitar" + ghost "Cancelar"). La card del Dashboard **no** es removible.

**Grilla en `/reportes`:** una sola columna a 1120px, cards separadas por `--gap` (18px); el **"[+]"** (recuadro dashed, ver abajo) siempre al final. El orden de las cards es **reordenable por el usuario vía un modo orden explícito** — ver *Reportes reordenables — modo orden de cards (Ola 2, P1)* abajo.

**Recuadro "[+]" para agregar card:** recuadro **placeholder dashed** (`--panel-2`, borde dashed `--line`, `--r-card`, sin sombra), ícono `Plus` en círculo `--panel-3`, label "Agregar reporte". Compacto cuando hay cards (~120px); en versión grande preside el **estado vacío inicial** (~280px alto, ~480px ancho, centrado, "Armá tu primer reporte"). Al activarlo, **popover-menú de 2 opciones** (Ingresos y gastos / Por categoría) ancla la elección de tipo; la card nace en el año en curso con todas las categorías.

**Dashboard:** monta una card `income-expense` efímera con navegación de año activa, junto al resumen mensual (que es fijo en el mes en curso). La distinción la dan: bloques de forma distinta (resumen sin `.card` de gráfico vs. card de gráfico), distinto grano temporal (mes-rótulo fijo vs. año-stepper navegable) y el stepper scoped a la card.

> Las **gráficas** que montan estas cards se definen en *Gráficos — Forma 1 y Forma 2* (abajo).

### Reportes reordenables — modo orden de cards (Ola 2, P1)

Las cards de `/reportes` se **reordenan** entre sí por drag, vía el **mismo lenguaje de "modo orden" que `/mes`** (ver *Acordeón — sección colapsable + reordenable* → "Modo orden"). Es el análogo visual de aquel modo, trasladado de cabeceras de acordeón a cards de reporte: un **modo explícito** (no handles permanentes), con **colapso transitorio** de las cards a una representación "mini" mientras dura, y **drag in-place sin overlay flotante**. **No inventa cromo nuevo:** reusa el botón ghost↔primario del header, el `GripVertical`, el feedback del ítem activo de `SortableSection` y el dashed transversal. El motor es **dnd-kit** con `restrictToVerticalAxis` + `restrictToParentElement` (igual que `/mes`).

> **Espejo deliberado de `/mes`.** Donde `/mes` colapsa cada sección a su `.ghead`, `/reportes` colapsa cada card a un **mini-ítem** identificable por **título (P4) + tipo**. Todo lo demás (disparador, grip, drag in-place, feedback del activo, salida en vivo) es **idéntico al modo orden de `/mes`**: si una decisión vale para uno, vale para el otro.

#### 1. Disparador — toggle "Ordenar reportes" / "Listo"

- **Ubicación:** en la **zona derecha del `.phead`** de `/reportes`, hoy vacía (la izquierda lleva el eyebrow "Tu actividad" + chip de moneda default + H1 "Reportes"). El toggle es **el único habitante** de esa zona derecha. El header pasa a `flex items-end justify-between`: identidad izquierda ⟷ toggle derecha.
- **Estilo — espejo exacto de `/mes`:**
  - **Fuera de modo orden:** botón **ghost del DS** — `inline-flex items-center gap-1.5 px-3 py-2`, `text-[13px] font-semibold text-ink-2`, `rounded-[var(--r-ctl)]`, `bg-panel border border-line`, hover `bg-panel-2`+`text-ink`, transición 0.14s, focus ring `--accent-soft` 3px. Ícono `ArrowUpDown` **15px** a la izquierda del label. Label exacto: **"Ordenar reportes"** (no "Ordenar secciones": acá son reportes). `aria-label="Ordenar reportes"`.
  - **En modo orden:** se transforma en el botón **primario índigo** "Listo" — `bg-accent` hover `bg-accent-press`, `text-white`, mismo `px-3 py-2` y `rounded-[var(--r-ctl)]`, sombra `--shadow-sm` + inset highlight, hover `--shadow-md`, focus ring `--accent-soft`. Ícono `Check` **15px** + label **"Listo"**. El botón "Listo" (primario índigo) es la **única señal** de "modo orden activo" — sin banner, sin borde de página (idéntico a `/mes`).
- **Visibilidad del toggle:** solo cuando **hay cards** (`cards.length > 0`). En el **estado vacío** (solo el "[+]" grande) no se muestra: no hay nada que ordenar. Con **una sola card** el criterio queda a definición funcional del analista; visualmente el toggle no estorba si se muestra (no hay reordenamiento posible, pero el modo es inocuo). **Frená y consultá al analista si una card debe ocultar el toggle** — no es decisión de diseño.

#### 2. Representación "mini" de la card en modo orden

Al **entrar** en modo orden, **cada card colapsa a un mini-ítem** (análogo al colapso transitorio de las cabeceras en `/mes`). El mini-ítem es la **fila de identidad arrastrable**: ni gráfico, ni leyenda, ni controles internos. Es **puramente visual y transitorio**: no se persiste, no toca ninguna preferencia; al salir ("Listo") las cards vuelven a su forma plena. La animación de colapso/expansión usa la transición del DS (0.22s ease-out; instantánea con `prefers-reduced-motion`).

- **Caja del mini-ítem:** mantiene la **superficie de card** (`bg-panel`, `border border-line`, `--r-card` 14px) para que la lista de minis se lea como "las mismas cards, compactadas" y no como otro componente. Padding interno **vertical reducido**: `px-[var(--card-pad)] py-[14px]` (el `--card-pad` 22px horizontal se mantiene para alinear con la card plena; el alto baja a una fila). **Alto objetivo ~56px** (una fila cómoda: grip + ícono + título). Separación entre minis: el mismo `--gap` 18px de la columna.
- **Layout de la fila (de izquierda a derecha):** `[grip] · [ícono de tipo] · [título] · ——— · [etiqueta de tipo]`
  - **Grip** (`GripVertical`, ver §4) — primer elemento, punto de arrastre.
  - **Ícono de tipo** — `AreaChart` (16px) para `income-expense`, `BarChart3` (16px) para `by-category`, `--muted`, `aria-hidden`. Es el **mismo glifo** que el popover-menú de tipo usa al crear la card (`AddCardMenu`), así el ícono ya está asociado al tipo en el modelo mental del usuario. `gap-3` entre grip→ícono→título (mismo ritmo que la `.ghead` de `/mes`).
  - **Título** — el **título P4 de la card** (16px/600 Space Grotesk `--ink` si es propio; placeholder "Reporte N" en `--faint` si no hay título), `truncate` contra el ancho disponible (no se edita en modo orden — ver §3; es texto de display). Mismo `title=` nativo para el valor completo. La numeración "Reporte N" sigue el 1-based **vigente** según el orden actual (mientras se arrastra, N puede cambiar al reordenar — es display, consistente con P4).
  - **Etiqueta de texto del tipo** — a la **derecha**, tras un divisor: **"Ingresos y gastos"** (para `income-expense`) / **"Por categoría"** (para `by-category`), en **12px/600 `--muted`, uppercase NO** (texto sentence-case, no rótulo de sección). Refuerza la identificación por tipo en palabras, no solo por ícono. Precedida por una **línea divisoria** `flex-1 h-px bg-hair` que empuja la etiqueta al extremo derecho (mismo patrón que el subtotal de la `.ghead`: `[contenido izquierda] ——— [meta derecha]`).
- **Jerarquía tipográfica del mini:** el **título manda** (16px/600 `--ink`/`--faint`), la **etiqueta de tipo es metadato** (12px/600 `--muted`), el **ícono es señal de apoyo** (16px `--muted`). Sin cifras de dinero en el mini → ninguna regla dura de mono aplica acá.
- **Sin mini-preview del gráfico — decisión de diseño cerrada.** La regla del roadmap es "incluir un thumbnail del gráfico **solo si resulta barato**". **No es barato:** cada mini-preview exigiría montar un Recharts (`useReports` con su fetch por año/moneda/categorías, `ResponsiveContainer`, gradientes) por card, lo que (a) reintroduce carga/skeleton/error dentro de una fila que debe ser estable e instantánea, y (b) le da a dnd-kit rects de altura variable/asincrónica, justo lo que el modo orden de `/mes` evita con el colapso instantáneo (`noTransition` para medir rects estables). El costo de robustez supera el beneficio. **La identificación la dan ícono + etiqueta de tipo + título**, que es exactamente el espejo de `/mes` (donde el mini tampoco muestra el contenido, solo la cabecera). Si más adelante existiera un thumbnail estático y barato (un sprite/snapshot precomputado), se reevalúa; **no** en P1.
- **Feedback del ítem activo (la card que se arrastra) — reusa `SortableSection`:** elevación `--shadow-md`, fondo `--panel`, radio `--r-ctl` 10px, `cursor: grabbing`, **sin** `scale`, opacidad plena. Padding interno `10px` mientras está activo (igual que `SortableSection`). Las **demás minis** se desplazan suave (0.14–0.22s) para abrir el hueco; **no se atenúan**. **El desplazamiento de las demás minis ES la indicación de inserción** — no se dibuja caja-hueco dashed separada (in-place, ancho completo). Drag in-place: la mini no flota, **sin `DragOverlay`**, traslación solo en Y dentro del box de la columna.

#### 3. Estado del resto de controles en modo orden

Espejo del criterio de `/mes` ("+ Nuevo movimiento" se deshabilita; el contenido de sección se atenúa):

- **Controles internos de cada card** (stepper de año · selector de moneda · X de quitar · **título editable P4**): **no se renderizan** en modo orden, porque la card entera colapsa al mini-ítem (§2) que solo lleva grip + ícono + título de display + etiqueta. El título en el mini es **display puro, no editable** (sin lápiz on-hover, sin entrar a edición) — el modo orden está dedicado a arrastrar, igual que la `.ghead` de `/mes` no colapsa al clic en ese modo. Al salir ("Listo"), la card vuelve a su forma plena con todos sus controles y el título recupera su edición in-situ.
- **Recuadro "[+]" (AddCardButton compacto):** se **atenúa y deshabilita** mientras dura el modo — `opacity-45 pointer-events-none cursor-default` (exactamente el tratamiento de "+ Nuevo movimiento" en `/mes`). Permanece visible al final de la columna (no se quita: agregar una card es una acción que no aplica mientras se reordena, pero su ausencia repentina sacaría un ancla visual). **No** participa del sortable (no es arrastrable; queda fijo al pie).
- **Sin chrome adicional de "modo activo":** la única señal es el botón "Listo" primario índigo (§1), idéntico a `/mes`. No se agrega banner, borde de página ni overlay.

#### 4. Grip handle

Idéntico al de `SortableSection` / `AccordionSection`:

- **Ícono:** `GripVertical` (lucide) **16px**, `aria-hidden`. Color `--muted` (en reposo y en hover; el grip no cambia de color — el feedback de "agarrable" lo da el cursor).
- **Posición:** **primer elemento** de la fila del mini-ítem, a la izquierda del ícono de tipo. `gap-3` hasta el siguiente elemento.
- **Cursor:** `grab` en reposo, `grabbing` al arrastrar (`cursor-grab active:cursor-grabbing`).
- **Área de toque:** el grip se envuelve en un `span` con `touch-action: none` (`touch-none`) que porta los `listeners`/`attributes` de dnd-kit; `aria-label="Arrastrar reporte"`. El área accionable abarca el glifo + su padding de fila (la fila del mini es cómoda a ~56px de alto, dando blanco de toque suficiente). En `/mes` el handle vive **dentro** del `<button>` de disclosure; acá el mini-ítem **no es un disclosure** (no colapsa nada al clic), así que el grip puede vivir como control de arrastre directo en la fila, sin botón contenedor que herede semántica de disclosure.

#### Restricciones duras reafirmadas

- El modo orden **no muestra cifras de dinero** (ni en el mini, ni en el toggle): ninguna regla dura de mono/income/expense entra en juego. El título es texto de UI (Space Grotesk), nunca mono.
- El **índigo** aparece **solo** en el botón "Listo" (señal de modo activo = cromo de interacción) y en los focus rings — **nunca** tiñe títulos, íconos ni etiquetas del mini (regla dura 2).
- Los íconos de tipo (`AreaChart`/`BarChart3`) y la etiqueta de tipo van en **neutro `--muted`** — no se colorean por semántica ni por marca.

### Título editable de la card de reporte (Ola 2, P4)

Cada card de `/reportes` tiene un **título definido por el usuario**, mostrado en la cabecera y **editable in-situ**. Es la **única** pieza de identidad de la card: **no hay eyebrow ni rótulo "Reporte"** encima del título. Reemplaza al subtítulo fijo de tipo ("Ingresos y gastos" / "Por categoría") que antes ocupaba la línea de identidad: pasa a ser **texto del usuario**, no una etiqueta derivada del tipo. Aplica a **ambos** tipos de card (`income-expense` y `by-category`). **No inventa cromo nuevo:** reusa la escala *Nombre de movimiento / título de card 16px*, el lenguaje de input del DS y el focus ring de acento; respeta las tres reglas duras (el título es texto neutro, nunca tiñe ni comunica montos).

> **Es texto libre del usuario, no marca ni semántica.** El título va en **Space Grotesk** (UI), **nunca** en mono (no es cifra), **nunca** teñido de income/expense ni de índigo (regla dura 1/2). El índigo aparece **solo** como focus ring al editar (cromo de interacción).

#### 1. Default placeholder — "Reporte N" (sin título)

Cuando el título está **vacío**, la card muestra el placeholder **"Reporte N"**, donde **N = posición 1-based de la card en la columna** (recalculado según las cards existentes; **no monotónico** — si se quita una card intermedia, las de abajo recorren su N). Es un **placeholder visual, no texto persistido**: nunca se guarda "Reporte 3" como título; es lo que se pinta mientras no haya título propio.

- **Tono del placeholder:** color `--faint` (el neutro de placeholders del DS), mismo size/weight/tracking que un título real (16px/600 Space Grotesk, `leading-tight`) — solo cambia el **color** a `--faint` para leerse como "sin nombre todavía", no como un título tenue elegido. Distingue de un título real (`--ink`) por contraste de color, no por tamaño ni estilo.
- **Al entrar a editar con título vacío:** el campo arranca **vacío** (no precargado con "Reporte N" — ese N es solo display); el `placeholder` nativo del input muestra `Reporte N` en `--faint`, de modo que el usuario ve qué nombre tomará si deja el campo en blanco. Si confirma vacío, vuelve al placeholder "Reporte N" de display.

#### 2. Ubicación en la cabecera — el título es la única identidad

La identidad de la card es **solo el título editable** (sin eyebrow). El título ocupa **la zona de identidad (izquierda)** de la cabecera; la barra de controles derecha (stepper · moneda · X) **no cambia**. Difiere por tipo de card:

- **`by-category` — el título es la identidad, en la fila `justify-between`.** La cabecera es de **una sola línea**: identidad izquierda (**el título editable**, antes el texto fijo "Por categoría", y antes precedido por un eyebrow que ya no existe) ⟷ controles derecha (`stepper · moneda · X`). El título queda inline con los controles en la misma fila `flex justify-between` y trunca contra su ancho disponible (la identidad cede ancho a los controles, no al revés).
- **`income-expense` — el título en su propia línea encima de las tabs.** Los `ViewTabs` ("Total" / "Por categoría") ya ocupan el lado izquierdo y son el control de **mayor jerarquía de interacción** (definen qué se ve); el título es **identidad**, no control. Para no competir, la identidad se apila **encima** de la zona de tabs+controles:
  - **Línea 1 (ancho completo de la cabecera):** **solo el título editable** (`--ink`, o placeholder "Reporte N" en `--faint`). Es la **identidad** de la card; arranca pegada a la izquierda.
  - **Línea 2 (la fila actual sin cambios):** `[ViewTabs]  ⟷  [stepper · moneda · X]` — exactamente como hoy (`flex justify-between`).
  - **Por qué encima y no inline con las tabs:** meter el título en la misma fila que las tabs lo haría competir con el underline activo y empujaría las tabs hacia el centro, rompiendo su alineación a la izquierda. Apilarlo arriba da al título su propia línea de identidad y deja las tabs intactas en su fila. **El título es el ancla común** de ambos tipos: en los dos, lo que se lee arriba a la izquierda es el título; lo único que cambia es que `income-expense` suma debajo la fila de tabs y `by-category` no.
- **Resultado:** en **los dos tipos** el usuario lee, arriba a la izquierda, el **título** en 16px/600 (o su placeholder "Reporte N"), sin rótulo encima. El único delta entre tipos es la fila de tabs que `income-expense` suma debajo del título.

#### 3. Affordance de edición — click directo + lápiz on-hover

El título se edita **in-situ** (no abre diálogo). La afordancia combina **dos señales**, sin ícono fijo permanente que ensucie la identidad en reposo:

- **El texto del título es clickeable.** El nodo del título es un `<button type="button">` (display: el texto) con `cursor:text`; un clic entra en modo edición. `aria-label="Editar título del reporte"`.
- **Lápiz `Pencil` (lucide, 14px `--muted`) que aparece en hover**, a la derecha del título con `gap-[6px]`, `aria-hidden` (la afordancia accesible la da el `aria-label` del botón). En reposo el lápiz está **oculto** (la identidad queda limpia: solo el título); aparece (`opacity 0→1`, transición 0.14s) al hacer hover **sobre la zona del título**. Refuerza "esto se edita" sin agregar peso permanente.
- **Foco por teclado:** el botón de título es tabbable; al recibir foco de teclado muestra el lápiz (igual que hover) y un focus ring `--accent-soft` 3px sobre el nodo. Enter/Espacio entran a edición.
- **Por qué click directo + lápiz on-hover y no un lápiz permanente:** un ícono lápiz siempre visible junto a cada título se repite N veces en la columna, recargando. El click directo sobre el texto es el gesto primario (descubrible por `cursor:text` + hover state); el lápiz on-hover es el refuerzo explícito para quien no lo intuye. Es el mismo principio del DS de "afordancia que aparece en hover" (ej. el `X` de quitar, que solo toma caja en hover).

#### 4. Estados

- **Idle (título propio):** texto 16px/600 Space Grotesk `--ink`, `leading-tight`, sin caja ni borde (es texto plano en la identidad). Lápiz oculto.
- **Idle (placeholder "Reporte N"):** igual molde, color `--faint` (§1). Lápiz oculto.
- **Hover (sobre la zona del título):** aparece el lápiz `Pencil` 14px `--muted`; el texto **no** cambia de color ni toma caja (se evita un fondo que lo confunda con un input ya activo). `cursor:text`. Transición 0.14s.
- **Focus de teclado (sin editar aún):** lápiz visible + focus ring `--accent-soft` 3px sobre el nodo del título (radio `--r-ctl` 10px para el ring). Es el estado "enfocado, listo para entrar a editar".
- **Editando (input activo):** el texto se reemplaza por un **input de texto inline** del DS, en su lugar exacto (sin saltos de layout):
  - **Caja del input:** `bg-panel`, borde `--line-strong` (borde de input del DS), radio `--r-ctl` 10px, padding compacto `px-[8px] py-[3px]` para no engordar la línea de identidad. Ancho: se ajusta a la zona de identidad disponible (ver §5 truncado).
  - **Texto del input:** **misma tipografía que el título** — 16px/600 Space Grotesk `--ink`, para que editar se sienta "sobre el mismo texto", sin reflow de tamaño.
  - **Placeholder del input:** `Reporte N` en `--faint` (§1).
  - **Focus ring:** `--accent-soft` 3px (`focus-visible`), radio `--r-ctl` 10px. El acento es cromo de foco, no estado de datos (no viola reglas duras).
  - **El lápiz se oculta mientras se edita** (el input ya comunica el modo); el input queda en la zona de identidad, a la izquierda.
  - **Confirmar / cancelar:** **Enter** o **blur** confirman (persisten el título; si quedó vacío → vuelve al placeholder "Reporte N"); **Esc** cancela y restaura el valor previo. (El comportamiento de persistencia/validación de longitud es funcional — lo define el analista; acá se define solo la presentación de los estados.)
- **Sin estado de error visual propio** en v1 (es texto libre; no hay validación que pinte error en la cabecera). Si más adelante se define un límite con feedback, reusará el ring `--expense-soft` del DS.

#### 5. Tipografía, ancho y truncado

- **Tipografía:** rol *Nombre de movimiento / título de card* — **16px / 600**, Space Grotesk, `leading-tight`, `tracking` normal. **Nunca mono** (no es cifra), **nunca semántico ni índigo** (regla dura 1/2). Idéntico en claro y oscuro (toma `--ink` / `--faint`, que ya cambian por modo).
- **Ancho máximo (idle/display):** el título ocupa el ancho disponible de la zona de identidad y **trunca con elipsis** (`truncate`: `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`) si excede. **No envuelve a varias líneas** (mantiene la cabecera en su alto): un título largo se corta con `…` y el valor completo queda en `title=` (tooltip nativo) + en el input al editar.
  - En `by-category` el título trunca contra el ancho de su columna de identidad (la cabecera es de una línea, `justify-between`: título izquierda / controles derecha; la identidad cede ancho a los controles, no al revés).
  - En `income-expense` el título (línea 1, ancho completo de la cabecera) trunca contra el ancho de la cabecera completa, que es más holgado que la zona de tabs.
- **Ancho al editar:** el input crece hasta el ancho disponible de la zona de identidad y hace scroll horizontal interno del texto si el contenido excede (comportamiento nativo del input). No empuja la barra de controles.

#### 6. Responsive (≤940px — la cabecera hace wrap)

- **`by-category`:** la identidad (el título) ya está a la izquierda y los controles envuelven a la segunda línea por el `flex-wrap` existente; el título sigue truncando contra su ancho disponible, que se ensancha al pasar los controles abajo. Sin cambios de forma.
- **`income-expense`:** la **línea 1 de identidad** (el título) queda **arriba de todo**; debajo, la fila de tabs baja a su propia línea sobre la barra de controles (comportamiento ya definido en *Toggle de vista … Responsive*). Orden vertical resultante en angosto: `[título]` → `[ViewTabs]` → `[stepper · moneda · X]`. El título trunca contra el ancho completo de la cabecera angosta.
- El **lápiz on-hover** se mantiene (en táctil sin hover, la afordancia primaria es el tap directo sobre el texto, que entra a edición; el lápiz es refuerzo de hover/foco para puntero/teclado).
- **`prefers-reduced-motion`:** la aparición del lápiz y la transición de entrada/salida del input son instantáneas (sin fade); el resto del comportamiento es idéntico.

#### Restricciones duras reafirmadas

- El título es **texto de UI en Space Grotesk**, nunca mono (no es cifra) — la regla dura 3 (mono tabular) no aplica porque no es dinero.
- El título **nunca** se tiñe de income/expense (regla dura 1) ni de índigo de marca (regla dura 2); usa `--ink` (título propio) / `--faint` (placeholder). El índigo aparece **solo** como focus ring al editar/enfocar (cromo de interacción).
- El placeholder "Reporte N" es **display, no dato**: nunca se persiste; N es la posición 1-based recalculada en vivo.

### Moneda por reporte — selector embebido en la cabecera de la card (Ola 3, P3)

Cada card de `/reportes` tiene **su propia moneda de display**, override persistido e independiente de la default global del usuario (nace con la default global al crear la card). El control vive **dentro de la barra de controles de la cabecera de la card**. Es un selector de moneda más del DS — extiende el patrón ya cerrado en *Monedas configurables — set curado ARS/USD/EUR/BRL* a un tercer lugar de uso (form, `/configuracion`, y ahora la cabecera de card). **No inventa cromo nuevo:** reusa el lenguaje neutro de moneda y respeta las tres reglas duras (cromo neutro, índigo solo de marca/focus, cifra/código en mono tabular).

> **El chip de moneda del header de `/reportes` (`CurrencyChip`) NO cambia:** sigue reflejando la **default global** y sigue siendo el ancla de contexto de la pantalla (Link a `/configuracion`). La moneda por card es un override **local a cada card**; el chip del header es el **default global**. Son dos cosas distintas y conviven: el chip dice "tu default es X", cada card dice "esta card se muestra en Y".

#### 1. Qué control — chip-dropdown in-situ (NO el segmented de 4)

El control es un **chip-disparador que abre un popover con las 4 monedas**, **no** el `CurrencySegmented`. Racional de la elección, dado el espacio de la cabecera:

- **El segmented de 4 no entra.** La barra de controles derecha ya carga `YearStepper` (pill ~150px) + divisor + `X`, y en `income-expense` la izquierda lleva las tabs "Total / Por categoría". Meter un segmented de 4 segmentos (`~180–200px`) a la derecha **rompe el balance** de la cabecera y fuerza wrap permanente aun en desktop. El segmented está pensado para superficies con holgura (fila de ajuste de `/configuracion`, columna de form), no para una barra de controles ya densa.
- **El chip-dropdown es compacto y del mismo sistema.** Un disparador del tamaño de un chip (código `mono` + chevron, ~52px) **convive** con el stepper y el `X` sin desbalancear, y mantiene **todas las opciones a un clic** (el popover muestra las 4). Es coherente con el lenguaje del `CurrencyChip` del header (glifo/código mono neutro), pero **acciona in-situ** (no es Link): abre un popover y cambia la moneda de la card sin salir de pantalla.
- **Por qué popover y no segmented acá, si en el form sí usamos segmented:** la decisión "segmented, no dropdown" de *Monedas configurables §1* aplica a superficies donde **caben** los 4 visibles sin comprometer el layout. La cabecera de card es el caso opuesto (densa, compartida con año + quitar + tabs): acá el criterio del DS de "no romper el balance de la barra de controles" pesa más, y el dropdown es la forma correcta. **No es una contradicción:** es el mismo set de 4 monedas neutras, distinto envase según el espacio.

#### 2. El disparador (`CardCurrencyTrigger`) — anatomía

`<button type="button">` con `aria-haspopup="listbox"` / `aria-expanded`. Anatomía, de izq → der:

- **Código de moneda** en `mono` **12px / 600** `tracking-[0.04em]`, color `--ink-2`, con `tnum` (regla dura 3). Muestra `"ARS" / "USD" / "EUR" / "BRL"` — el de la card.
- **Chevron:** `ChevronDown` (lucide) **12px** `--faint`, a la derecha del código, `aria-hidden`. Indica "abre opciones" (a diferencia del `ChevronRight` del `CurrencyChip`, que indica "se gestiona en otro lado"). Rota a ▲ (`-180°`, 0.14s) cuando el popover está abierto.
- **Caja:** `inline-flex items-center gap-[6px]`, `bg-panel-3`, radio `--r-chip` 7px, `px-[8px] py-[3px]` — **idéntica caja al `CurrencyChip`** para que se lea del mismo sistema. **Sin** glifo `Wallet`: el `Wallet` es la marca del default global (header); el disparador de card omite el glifo para diferenciarse y porque la cabecera ya tiene suficiente densidad icónica (stepper, `X`).
- **Estados:**
  - **Reposo:** caja `--panel-3`, código `--ink-2`, chevron `--faint`.
  - **Hover:** caja → `--panel-2`, código → `--ink`, chevron → `--muted`. Transición `0.14s`.
  - **Abierto (activo):** caja `--panel-2` mantenida, chevron rotado a ▲. El feedback real del cambio es que, al elegir, el código del disparador y las cifras del gráfico/leyenda/tooltip pasan al símbolo de la nueva moneda.
  - **Focus (teclado):** ring `--accent-soft` 3px, radio `--r-chip` 7px (`focus-visible`). Acento = cromo de foco, no estado de datos (no viola reglas duras).
- **Sin color semántico ni índigo** en código/chevron/caja (regla dura "la moneda es cromo neutro"). Cromo estrictamente neutro.

#### 3. El popover — lista de las 4 monedas

Popover anclado al disparador (mismo mecanismo y reglas de cierre que el resto de popovers del DS — *Cierre de overlays*: cierra por selección, Esc, click fuera y re-clic en el disparador; este popover **sí** cierra por click fuera porque es una elección simple, no un form). Forma:

- **Caja:** `--panel`, borde `--line`, radio `--r-ctl` 10px, `--shadow-lg`, padding `p-[4px]`. Ancho mínimo que acomode `"ARS"` + check (~96px); se alinea al **borde derecho del disparador** (la barra de controles está pegada al borde derecho de la card; el popover crece hacia adentro). Animación `pop` del DS; `prefers-reduced-motion` → aparición instantánea.
- **Ítems:** 4 filas, `role="option"`. Cada una: código en `mono` 13px / 600 `--ink-2` (`tnum`), `px-[10px] py-[6px]`, radio `--r-chip` 7px, `cursor:pointer`. Orden canónico `ARS → USD → EUR → BRL` (mismo orden que el segmented).
  - **Ítem seleccionado (la moneda actual de la card):** código `--ink` + glifo `Check` (lucide) **14px** `--ink-2` a la derecha (`aria-hidden`; el estado lo da `aria-selected`). **Sin** fondo de acento ni tinte semántico — el seleccionado se marca con peso de color + check, neutro.
  - **No seleccionado:** código `--ink-2`; hover → fondo `--panel-2`, código `--ink`.
  - **Focus (teclado):** ring `--accent-soft` 3px (`focus-visible`), radio `--r-chip` 7px.
- **A11y:** disparador `aria-haspopup="listbox"`; popover `role="listbox"` con `aria-label="Moneda del reporte"`; ítems `role="option"` + `aria-selected`. Flechas ↑/↓ recorren, Enter/Espacio eligen, Esc cierra y devuelve foco al disparador.
- **Al elegir:** cierra el popover, persiste la moneda de la card, y el gráfico/leyenda/tooltip/cifras reflowean al símbolo de la nueva moneda. **No** hay skeleton al cambiar de moneda (es re-display de dato ya presente, no carga inicial — regla de *Skeletons*: skeleton solo con área vacía de dato).

#### 4. Ubicación exacta y responsive

- **Orden en la barra de controles derecha (≥941px):** `[ YearStepper ] [ divisor --hair ] [ CardCurrencyTrigger ] [ divisor --hair ] [ X ]`. El selector de moneda va **después** del stepper de año y **antes** del botón quitar, cada bloque separado por el **mini-divisor `--hair` vertical** (`h-[16px] w-px bg-hair`) ya existente. Racional del orden: año (el control más usado y de mayor jerarquía) primero; moneda (ajuste menos frecuente) en el medio; quitar (acción destructiva, terminal) al final. El divisor **antes** del trigger lo separa visualmente del stepper; el divisor **después** (el que hoy precede al `X`) se mantiene.
- **Cuando la card NO es removible** (no debería pasar en `/reportes`, pero por robustez): el selector queda como último elemento de la barra, sin divisor colgando a su derecha (el divisor pertenece al `X`, igual que hoy el divisor del `X` solo se renderiza con `removable`).
- **Responsive (≤940px — la cabecera hace wrap):** el selector de moneda **viaja junto con el stepper y el `X`** en el bloque de controles derecho (`flex flex-wrap justify-end`), que ya envuelve a la segunda línea bajo las tabs/identidad. **No** se separa en su propia línea ni cambia de forma: el chip es lo bastante compacto para fluir con el resto. Mantiene la caja, el orden relativo (stepper → moneda → X) y los divisores; el `flex-wrap` reacomoda si la línea no alcanza. El popover sigue anclado a su disparador y, si no hay lugar abajo, **flipea hacia arriba** (mismo mecanismo de colisión que los demás popovers; lo resuelve `control-frontend`).

#### 5. Jerarquía visual

De más a menos peso en la barra de controles derecha:

1. **`YearStepper`** — pieza dominante: pill con borde `--line` + `--shadow-sm` + año en mono 14.5px. Es el control de navegación principal de la card. **Conserva su peso; el selector de moneda no compite.**
2. **`CardCurrencyTrigger`** — secundario: chip plano `--panel-3` (sin borde ni sombra), código 12px. Lee como "ajuste de display", subordinado al stepper. Su menor peso (caja plana vs. pill con sombra, fuente más chica) lo posiciona como un control de segundo orden, coherente con que se toca menos que el año.
3. **Botón `X` (quitar)** — terminal: icon-only ghost, `--muted`, sin caja en reposo (solo `--panel-2` en hover). Acción destructiva, deliberadamente discreta hasta el hover.

El selector de moneda **nunca** usa borde, sombra ni fondo de acento que lo eleve por encima del stepper: su tratamiento plano es intencional para preservar la jerarquía año > moneda > quitar.

#### 6. Card del Dashboard — sin selector (condición visual)

La card del Dashboard usa el **mismo `ReportCard`** pero **NO** renderiza el `CardCurrencyTrigger`. Se condiciona por la **misma señal que ya distingue Dashboard de `/reportes`**: la card del Dashboard es **no removible** (`removable=false`) y usa la **default global efímera**. El selector de moneda se renderiza **bajo la misma condición que habilita el override persistido** (las cards de `/reportes`), no bajo `removable` per se — `control-frontend` recibe la moneda como prop opcional con su callback; cuando no hay callback de cambio de moneda (Dashboard), el trigger no se monta y la barra de controles queda como hoy: `[ YearStepper ]` (sin divisor ni moneda ni `X`). Visualmente: en el Dashboard la cabecera de la card queda **idéntica a la actual** (stepper solo), las cifras siguen en la default global, sin chrome de moneda agregado.

> **Reglas duras reafirmadas:** el código de moneda va en **mono tabular** (regla dura 3); ningún elemento del disparador, popover o ítems se tiñe de income/expense (regla dura 1) ni de índigo de marca (regla dura 2); el índigo aparece **solo** como focus ring (cromo de interacción). El selector de moneda **no** cambia qué es ingreso/gasto ni recolorea cifras: solo cambia el **símbolo** con el que se presentan (vía el mapa `código → símbolo` de *Símbolos de moneda por código*).

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

> **La leyenda es interactiva: es el filtro.** Desde la Ola 2 (P1), la leyenda **no es decorativa** — cada ítem es un toggle clickeable que activa/desactiva su serie (Forma 1 modo Total) o su categoría (Forma 1 modo Por categoría y Forma 2). **Reemplaza** al disparador+popover de categorías embebido, que se elimina de la card. El detalle de estados, a11y y layout interactivo vive en *Leyenda interactiva (la leyenda es el filtro)*, abajo.

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

### Reporte anual de Únicos — grilla día × mes (Ola 3, P2)

Tercer tipo de card de reporte (`unique-grid`), espejo de encuadre de las cards `income-expense` / `by-category`: misma caja (`bg-panel`, `border border-line`, `--r-card` 14px, `p-[var(--card-pad)]`, `--shadow-sm`), misma cabecera (título editable P4 + barra de controles derecha), mismo modo orden P1, mismos estados de carga/vacío/error. Lo que cambia es el **canvas**: no es un chart de Recharts sino una **grilla tipo planilla** (heatmap calendario) de **días del mes (filas) × 12 meses (columnas)**, con un **footer de métricas por mes**. Encaja como una card más en la única columna de `/reportes` (1120px, `--gap` 18px) y en el `[+]`/`AddCardMenu`. **No inventa cromo nuevo**: reusa tokens, escala tipográfica, mono tabular, semánticos y el lenguaje de selectores de la cabecera.

> **Reglas duras reafirmadas para esta grilla.** (1) Cada celda es una **cifra de dinero** → su tinte de heatmap **no** es income/expense ni índigo: es una **rampa propia de intensidad de gasto diario** (definida abajo), que **no comunica ingreso/gasto** (acá todo es gasto: Únicos) sino *magnitud*. La regla dura 1 (verde=ingreso/rojo=gasto) **no aplica al tinte de celda**: el verde del piso de la rampa **no** significa "ingreso", significa "gasto bajo"; por eso esta rampa es un **lenguaje aparte, documentado y acotado a esta grilla**, y se la nombra explícitamente como tal para que nadie la confunda con el semántico. (2) Todo monto (celda, footer) va en **mono tabular** (`tnum`), regla dura 3. (3) El **índigo** aparece **solo** como cromo de interacción (focus ring, hover de selección), nunca tiñendo cifras (regla dura 2).

#### 1. Librería — decisión cerrada: NO Recharts. Grilla nativa CSS Grid + tabla semántica.

Esta vista **no** se construye con Recharts (ni el wrapper `chart.tsx`). Recharts modela series sobre ejes continuos (área/barras/líneas); una **matriz densa de ~31×12 celdas con valor + color + footer de agregados por columna** es una **planilla**, no un gráfico de series — forzarla en Recharts (p. ej. un scatter teñido o un treemap) daría peor control de layout, peor accesibilidad y peor densidad que el primitivo correcto.

- **Primitivo:** **CSS Grid nativo** dentro de una **tabla semántica** (`<table>` con `<thead>` de meses, `<tbody>` de días, `<tfoot>` de métricas) — o un contenedor `role="table"` equivalente si el front necesita el control de grid de CSS por encima del layout de tabla; **el front elige el andamiaje, pero la semántica de tabla (header de columna = mes, header de fila = día) es obligatoria** para a11y y para que el lector de pantalla anuncie "fila 14, columna Marzo, $X". No se monta ningún `ResponsiveContainer` ni `<svg>` de charting.
- **Por qué no Recharts:** (a) el heatmap-calendario es una grilla de celdas discretas, no un trazo continuo; (b) los **agregados por columna** (footer de 5 métricas por mes) son nativos de una tabla, no de un chart de series; (c) evitamos el costo de montar 12 mini-ejes; (d) el control fino de tamaño de celda, gridlines y truncado se hace mejor con CSS Grid. **Esta decisión es la respuesta al roadmap "la librería la elige `control-design`": para `unique-grid` se usa grilla nativa, no la librería de charting.** Las cards `income-expense`/`by-category` **siguen** en Recharts; conviven dos motores de visualización según la forma.
- **Sin dependencia nueva.** No se agrega librería de heatmap/tabla; es CSS Grid + tabla del propio DS. (Si más adelante hiciera falta virtualización por performance, se evalúa aparte; en v1 son 372 celdas máximo, no la necesita.)

#### 2. Layout de la grilla

Estructura del canvas, de arriba a abajo: **header de meses (fila sticky)** → **cuerpo de 31 filas de día** → **footer de métricas por mes**. A la izquierda, una **columna fija de días** (1–31).

- **Geometría:** **13 columnas** = 1 columna de rótulo de día (estrecha, ~28px) + 12 columnas de mes (de ancho igual, `1fr` cada una, mínimo legible ~64px). **32 filas** de cuerpo = 1 header de meses + 31 de día. La grilla **no scrollea internamente en desktop**: a 1120px de card, 12×~80px de mes + 28px de día entran cómodos. En `≤940px` la card permite **scroll horizontal** del bloque de grilla (overflow-x), manteniendo la **columna de día sticky a la izquierda** y el **header de meses sticky arriba**, para que el usuario nunca pierda los dos ejes de referencia.
- **Header de meses (`<thead>`):** nombre corto es-AR (`Ene Feb … Dic`), **UI 12px/600 `--muted`**, centrado en su columna, sin rotar. Fondo `--panel` con borde inferior `--line` 1px; **sticky** al hacer scroll vertical (no aplica en desktop, sí en mobile scroll). La celda esquina (intersección día×mes header) va vacía.
- **Columna de días (`<th scope="row">`):** número de día **mono tabular 11px `--muted`** (`tnum`), alineado a la **derecha** de su celda estrecha (los números se leen por su unidad), con `pr-[6px]`. Fondo `--panel`, borde derecho `--hair` 1px que la separa del cuerpo; **sticky** a la izquierda en scroll horizontal.
- **Celdas de día (cuerpo):** cada celda es un cuadro de la grilla. **Alto de fila objetivo ~18–20px** (31 filas × ~19px ≈ 590px de cuerpo; es una card alta, aceptable para una planilla anual). **Gap entre celdas: 2px** (hairline de fondo `--panel`/`--paper` que las separa, igual recurso que los separadores 1px de la Forma 2) para que el heatmap se lea como mosaico de fichas y no como bloque continuo. Cada celda lleva su **tinte de heatmap** (§3) y, encima, el **monto del día** en **mono tabular 10.5px** (`tnum`), centrado, color de texto calculado por contraste contra el tinte de la celda (ver §3, texto por contraste). **Densidad vs. cifra completa:** a ~64–80px de ancho de columna, un total diario formateado completo (`$1.234,56`) no entra; por eso la **cifra en celda va abreviada** (`$0` · `$8` · `$13` · `$1,2k`), mismo criterio que el eje Y de los charts (*Ejes → Eje Y*), y la **cifra completa** vive en el **tooltip/hover** de la celda. El tinte ya comunica la magnitud relativa; el número en celda es la lectura aproximada; el tooltip da el exacto.
- **Manejo de días inexistentes (30/31 en meses cortos, 29/30/31 en febrero):** la celda del día que **no existe** en ese mes (ej. Feb 30, Abr 31) **no se pinta ni rotula**: es una **celda nula** con fondo `--panel-2` (el neutro de "no aplica", levemente hundido), **sin tinte de heatmap, sin número, sin tooltip**. Se distingue claramente de un día con `$0` (que sí existe y sí lleva tinte de piso + "$0"). Así la silueta de cada mes (28/29/30/31 filas vivas) se lee de un vistazo: las colas nulas de febrero y de los meses de 30 quedan en gris neutro. `aria`: la celda nula es `aria-hidden` o con `aria-label="—"`; no participa de la navegación de datos.

#### 3. Escala de color — rampa de intensidad de gasto diario (verde → rojo, anclada en 15 USD de poder adquisitivo)

Rampa **propia de esta grilla** (no es el semántico income/expense): mapea el **total de gasto del día** a un color que va de **verde (gasto bajo)** a **rojo (gasto alto)**, anclada en el rango **0 → ancla**, donde el **ancla = el equivalente de 15 USD de poder adquisitivo, reconvertido a la moneda de display de la card** (usando el TC del **año del reporte**). Es un **heatmap secuencial-divergente** de magnitud, documentado y acotado: el verde del piso **no** dice "ingreso", dice "día barato".

- **Anclaje:** `t = clamp(totalDía / ancla, 0, 1)`. `t=0` → piso (verde); `t=1` → tope (rojo). **Todo total ≥ ancla = `t=1` = color máximo** (saturación de la rampa; un día en el ancla y uno del doble se ven igual de "rojo tope"). El **ancla es 15 USD de poder adquisitivo** (no 15 unidades de la moneda activa): el backend lo entrega **ya reconvertido a la moneda de display** (en centavos, con el TC del año del reporte) y el front lo usa tal cual en lugar de un valor hardcodeado — ver §6. Anclar en **poder adquisitivo** (15 USD) y no en N unidades de la moneda hace que el gradiente sea **igual de significativo en cualquier moneda**: 15 unidades de una moneda débil (p. ej. ARS) saturaría casi todas las celdas en rojo y el gradiente solo serviría en USD. El umbral de 15 USD es **fijo por decisión de roadmap**, no configurable en v1; lo que viaja con la moneda es su reconversión.
- **Stops de la rampa (4 paradas, interpolación en oklch por luminosidad+hue):**

  | Punto | `t` | Token / valor (claro) | Lectura |
  |---|---|---|---|
  | Piso (≈$0–$1) | 0.00 | `oklch(0.94 0.05 150)` (verde muy claro) | día barato |
  | Bajo-medio | 0.33 | `oklch(0.90 0.10 110)` (verde-lima) | — |
  | Medio-alto | 0.66 | `oklch(0.88 0.13 70)` (ámbar) | — |
  | Tope (≥ ancla) | 1.00 | `oklch(0.78 0.16 30)` (rojo-coral) | día caro |

  Interpolación **continua** entre stops (no escalonada): el front interpola el color en oklch según `t`. Estos valores son **tintes de fondo de celda** (luminosidad alta, para que el texto del monto se lea encima); **no** son los tokens `--income`/`--expense` (esos son semántico de tipo, hue 158/27 a luminosidad de trazo) — esta rampa recorre el arco verde→ámbar→rojo a **luminosidad de superficie**, deliberadamente distinta para que no se lea como "ingreso vs gasto".
- **Celda con `$0` de gasto (día existe, sin gasto):** `t=0` → tinte **piso verde claro** + texto "$0" en `--muted`. **No** se deja en blanco: un día de $0 es información (gastaste cero), y el piso verde lo comunica como "el más barato posible". Se distingue de la **celda nula** (día inexistente, §2) que va en `--panel-2` gris sin número.
- **Texto del monto por contraste (independiente del modo):** el color del número en la celda se calcula por **contraste contra el tinte de la celda**, no contra el modo claro/oscuro — igual criterio que el texto sobre chip de categoría (*Categorías y gráficos en oscuro*). Tintes claros (piso/medio) → texto **oscuro** (`oklch(0.25 0.02 270)`); tope rojo más saturado → texto que mantenga contraste (oscuro o el `--ink` del modo, lo resuelve el cálculo de contraste). Así la cifra se lee en claro y oscuro sin recolorear la rampa.
- **Rampa en modo oscuro:** los **stops bajan de luminosidad** (mismos hue, superficie sobre panel oscuro) para no quemar: piso `oklch(0.32 0.05 150)`, bajo-medio `oklch(0.36 0.09 110)`, medio-alto `oklch(0.40 0.12 70)`, tope `oklch(0.45 0.15 30)`. El **arco de hue (verde→ámbar→rojo) y el anclaje (0 → ancla 15 USD reconvertido) son idénticos**; solo cambia la luminosidad de superficie, igual que el resto de los `-soft` en oscuro. El texto del monto sigue por contraste contra el tinte (en oscuro, los tintes son más oscuros → texto **claro**). **Todo swatch/celda lleva su gap-hairline** (el 2px de §2) que en oscuro se lee como separador; no hace falta contorno extra porque las celdas teselan sin huecos.
- **Por qué esta rampa y no income/expense:** usar el `--expense` (rojo) para "día caro" y `--income` (verde) para "día barato" **rompería la regla dura 1** (verde=ingreso): un día de gasto bajo se vería "verde ingreso", que es exactamente lo que el DS prohíbe. Por eso la rampa es un **lenguaje de magnitud aparte**, con hues y luminosidades **distintos** de los semánticos, y se documenta como tal. El verde acá = "poco gasto", nunca "ingreso".

#### 4. Footer de métricas por mes

Debajo del cuerpo de la grilla, un **`<tfoot>`** con **una celda por columna de mes** (alineado bajo cada mes) que apila las **5 métricas** del roadmap, de arriba a abajo, en orden de jerarquía. Fondo `--panel-2` (escalón leve que lo separa del cuerpo), borde superior `--line` 1px. Cada celda de footer es angosta (el ancho de su mes ~64–80px), así las métricas van **apiladas en filas, no inline**, con rótulos mínimos a la izquierda y cifra a la derecha.

- **Jerarquía (de mayor a menor peso visual):**
  1. **Total del mes** — la cifra dominante: **mono tabular 12px/600 `--ink`** (`tnum`), abreviada igual que las celdas (`$1,2k`), con la completa en tooltip. Sin color semántico (es magnitud, no tipo). Es lo que más se lee del footer.
  2. **Promedio por día** — **mono 10.5px/500 `--ink-2`** (`tnum`), precedido por un micro-rótulo `prom` en `--faint` 9px uppercase tracking. Es la lectura de "ritmo diario".
  3. **%dif vs mes anterior** — **mono 10.5px/600 `--ink-2`** (`tnum`, color **neutro**), con un **glifo de dirección discreto** (↑/↓, ver abajo). Micro-rótulo `vs ant` `--faint`.
  4. **Puntos de inflación del mes** — **mono 10.5px/500 `--ink-2`** (`tnum`), sufijo `pts` o `%` según defina el contrato; micro-rótulo `infl` `--faint`. **Color neutro** (la inflación no es ingreso/gasto): `--ink-2`, **nunca** verde/rojo semántico.
  5. **%dif ajustado por inflación** — **mono 10.5px/600 `--ink-2`** (`tnum`, color **neutro**), mismo formato y tratamiento de dirección-por-glifo que (3); micro-rótulo `vs ant real` (o `real`) `--faint`. Es el par "real" de la métrica (3).
- **Formato del %dif (métricas 3 y 5) — NEUTRO + glifo de dirección, NO color por dirección (decisión cerrada del usuario):** el número del %dif **no se colorea** por dirección. Va en **`--ink-2`** (color neutro, igual que el resto de las métricas tibias del footer), sin tinte `--expense-ink`/`--income-ink`. La dirección de la variación se comunica **solo con un glifo discreto** que precede a la cifra, no con color. El razonamiento: pintar de rojo/verde el delta cargaba un peso semántico fuerte (y rozaba la regla dura 1) para una métrica de detalle; el usuario prefiere un footer **tranquilo** donde la dirección se lea de un vistazo por la forma del glifo, no por el color.
  - **Glifo de dirección:** **`ArrowUp` / `ArrowDown` (lucide)**, **9px**, `stroke-width 2.5` (peso firme para que el glifo chico no se diluya), color **`--ink-2`** (el **mismo** que la cifra: el glifo es parte de la misma palabra visual, no un acento aparte), `aria-hidden` (la dirección ya está en el signo + en el texto del tooltip). Va **inmediatamente a la izquierda del número**, `gap 2px`, alineado a la baseline de la cifra mono. Alternativa equivalente si el `ArrowUp/Down` se ve pesado a 9px: signo **`+` / `−`** (signo menos `U+2212`) en el mismo `--ink-2`/9px como prefijo — `control-frontend` puede usar el prefijo `+`/`−` como fallback, pero el **default es la flechita** por ser más rápida de leer que un signo a 9px. En ambos casos el glifo es **monocromo `--ink-2`**, nunca coloreado.
  - **Dif positivo (gastó más que el mes anterior):** glifo **`↑` (`ArrowUp`)** + cifra. Ej. `↑12,40%` — todo en `--ink-2`.
  - **Dif negativo (gastó menos):** glifo **`↓` (`ArrowDown`)** + cifra. Ej. `↓8,10%` — todo en `--ink-2`.
  - **Dif cero / sin mes anterior (enero o primer mes con dato):** `—` en `--muted`, **sin glifo de dirección**. Es el mismo tratamiento neutro que ya tenía el caso vacío; no se introduce flecha cuando no hay variación que mostrar.
  - El número del %dif va **siempre en mono tabular** (`tnum`), separador decimal coma es-AR, 2 decimales (`ROUNDDOWN` a 2, según el roadmap). El glifo de dirección reemplaza al prefijo `+`/`−` coloreado del diseño anterior; la cifra ya no lleva signo coloreado.
- **Micro-rótulos:** los rótulos `prom` / `vs ant` / `infl` / `real` son **`--faint` 9px/600 uppercase `tracking-[0.08em]`** (variante mínima del eyebrow del DS), a la izquierda de cada cifra del footer; el **total** no lleva rótulo (es la cifra grande, se entiende por posición). Si el ancho de mes no alcanza para rótulo+cifra inline, el rótulo va **encima** de la cifra (apilado vertical dentro de la celda de footer).
- **Tooltip de footer:** hover sobre la celda de footer de un mes abre el **mismo tooltip custom del DS** que las celdas diarias (no el `title` nativo del browser) con las 5 métricas **completas y rotuladas**. Spec detallado en **§4b**.

#### 4b. Tooltip rico del footer (reemplaza el `title` nativo)

Hoy cada celda de footer abrevia sus 5 métricas y el detalle vive en un `title` nativo (tooltip del SO, sin estilar, multilínea con `\n`). Se reemplaza por el **mismo tooltip custom portaled a `body`** que ya usan las celdas diarias (§8): caja con el cromo de la card, no chrome del browser. Hover sobre la celda de footer de un mes → aparece anclado encima de la celda, `pointer-events-none`, `role="tooltip"`.

- **Caja (idéntica al tooltip de celda existente):** `fixed z-50`, `rounded-ctl` (`--r-ctl`), `border border-line`, `bg-panel`, `shadow-[var(--shadow-lg)]`, padding `px-[10px] py-[8px]`, anclada `translate(-50%, -100%)` sobre la celda (mismo posicionamiento del tooltip de celda). **No** se reusa `ChartTooltipContent` tal cual (ese molde es swatch+label+monto, pensado para categorías); este tooltip es **label ⟷ valor** sin swatch, pero hereda la **misma caja**. `min-width` ~`190px` para que las filas label⟷valor no se aprieten.
- **Encabezado:** **nombre del mes (largo, es-AR) + año** — ej. `Marzo 2026` —, **UI 12px/600 `--ink-2`**, `mb-[6px]`. Mes en nombre **completo** (`Marzo`, no `Mar`): el tooltip es la lectura detallada, tiene aire para el nombre largo; el `Mar` abreviado queda para el header de columna y la celda. Mismo registro que el encabezado del tooltip de celda (`Mar 14, 2026`), pero acá sin día.
- **Cuerpo — 5 filas `label ⟷ valor`** (`flex flex-col gap-[5px]`), en el **mismo orden de jerarquía del footer** (§4), de arriba a abajo:
  1. **Total** — label `Total`; valor = total del mes **completo sin abreviar** (`$1.234,56`), **mono tabular `tnum` 12px/600 `--ink`** (la cifra dominante, más peso que el resto, igual que es la dominante en el footer).
  2. **Promedio diario** — label `Promedio diario`; valor mono `tnum` 11px/500 `--ink-2`, completo.
  3. **% dif vs mes anterior** — label `vs. mes anterior`; valor mono `tnum` 11px/600 **`--ink-2` (neutro)** con el **glifo de dirección** `↑`/`↓` (`ArrowUp`/`ArrowDown` lucide, 9px, `stroke-width 2.5`, `--ink-2`, `aria-hidden`) inmediatamente a la izquierda del número, `gap 2px` — **idéntico tratamiento neutro que el footer (§4)**: dirección por glifo, nunca por color. Formato `↑12,40%` / `↓8,10%`.
  4. **Inflación** — label `Inflación`; valor mono `tnum` 11px/500 `--ink-2`, con sufijo `pts` (puntos de inflación del mes). **Color neutro `--ink-2`**, nunca semántico.
  5. **% dif ajustado por inflación** — label `vs. anterior (real)`; valor mono `tnum` 11px/600 `--ink-2` con el **mismo glifo de dirección** que (3). Es el par "real" de la métrica 3.
- **Layout de cada fila:** label a la **izquierda** en **UI 11.5px/500 `--ink-2`** (`flex-1`, truncate si hiciera falta), valor a la **derecha** alineado (mono, `shrink-0`); `gap` entre ambos ~`16px`. El label es texto UI (Space Grotesk), el valor siempre mono tabular — misma dualidad UI-label / mono-cifra del DS.
- **Nulls (`—`):** cualquier métrica `null` (sin mes anterior → métricas 3 y 5 en enero o primer mes con dato; sin inflación cargada → métrica 4; promedio `null` si el mes no tiene días con dato) muestra **`—` en `--muted`**, en la **misma posición de valor** y **sin glifo de dirección** (el `—` no lleva flecha). El label de la fila se mantiene (la fila no desaparece): el tooltip siempre lista las 5 métricas en orden fijo, para que el footer tenga una lectura estable mes a mes. El total **nunca** es null (un mes sin gasto es `$0`, no `—`).
- **Separador opcional:** se puede insertar un divisor `1px --hair` (`my-[7px]`, igual que el `totalRow` de `ChartTooltipContent`) **entre el Total (fila 1) y las 4 métricas derivadas (2–5)**, para apartar la cifra dominante del bloque de ratios. `control-frontend` puede montarlo o no; si lo monta, va solo en esa junta (1 ⟷ 2), no entre cada fila.
- **Coherencia con el tooltip de celda:** misma caja, mismo portal, mismo anclaje, mismo registro tipográfico de encabezado y mismo glifo de dirección neutro. La única diferencia es el contenido (5 métricas del mes vs. fecha+total+desglose del día). El `title` nativo del footer **se elimina** (deja de existir el tooltip del SO).

#### 5. Selectores de la cabecera — año + filtro de categorías

La cabecera de `unique-grid` sigue el **molde `by-category`** (una sola fila `flex justify-between`: título editable izquierda ⟷ barra de controles derecha), porque esta card **no tiene `ViewTabs`** (no hay vistas alternas). La barra de controles derecha es **idéntica** a la de las otras cards: `[ YearStepper ] [ divisor --hair ] [ CardCurrencyTrigger ] [ divisor --hair ] [ X ]` (ver *Moneda por reporte*). El **YearStepper** es el selector de año (mismo control, mismas reglas de límite `earliestYear`/`currentYear`).

- **Filtro de categorías:** el roadmap pide "el mismo selector de categorías que ya existe en las otras cards". El DS **eliminó el popover de filtro de la card** y lo reemplazó por **la leyenda interactiva = el filtro** (*Leyenda interactiva (la leyenda es el filtro)*). Pero esta grilla **no tiene leyenda de series/categorías** (las celdas no son bandas de color por categoría; el color es magnitud). Entonces el filtro de categorías de `unique-grid` se monta como una **fila de chips-toggle de categoría DEBAJO del footer** (mismo componente `ChartLegend` scrollable + `LegendAllChip` "Todas/Ninguna" que usan Forma 2 / Vista B), separada del footer por el `margin-top` 14px del DS. Funciona igual: cada chip es un toggle `aria-pressed` que activa/desactiva su categoría; toggle off → esa categoría no suma al total diario de ninguna celda ni al footer; los totales y el heatmap se recalculan. **Universo = `availableCategories`** del contrato (mismas categorías con gasto en el año, sin filtro). Esto mantiene **un solo lenguaje de filtro de categorías** en toda la card de reporte: chips-toggle, no popover. **No** se reintroduce el viejo `CategoryFilterPopover`.
  - **Por qué debajo y no como leyenda lateral:** la grilla ocupa el ancho completo del canvas; los chips de categoría son un **control de filtro**, no una leyenda de color de la propia grilla (el color es magnitud, definido por la rampa de §3). Van debajo, como en las otras cards la leyenda-filtro va debajo del chart.

#### 6. Moneda de la card y el ancla (15 USD reconvertido)

La card respeta **moneda por reporte** (*Moneda por reporte*): el `CardCurrencyTrigger` cambia la moneda de display, y **todas** las cifras (celdas, footer) reflowean al símbolo nuevo. El **ancla de la rampa es 15 USD de poder adquisitivo, reconvertido a la moneda de display de la card** usando el TC del **año del reporte**: el backend entrega los totales diarios ya convertidos a esa moneda (mismo mecanismo `?currency=` del contrato) **y, junto con ellos, el ancla ya reconvertida** (en centavos de la moneda de display); el front mapea `t = clamp(total / ancla, 0, 1)` sobre esos valores, usando el ancla que recibe — **nunca un valor hardcodeado**. El roadmap fija el umbral en **15 USD**; al ser un ancla de **poder adquisitivo** (no N unidades de la moneda activa), se **reconvierte por moneda y por año**: si la card está en USD el ancla ronda 15 USD, si está en ARS el ancla es el equivalente en ARS de 15 USD al TC de ese año. Así el gradiente es **igual de significativo en cualquier moneda** (anclar en 15 unidades de una moneda débil saturaría casi todo en rojo). El front **no** calcula la reconversión: la recibe del backend.

> **Señal para análisis/contrato:** esta card necesita que el backend entregue el **ancla de la rampa ya reconvertida** a la moneda de display (en centavos), usando el TC del año del reporte — un campo nuevo en el contrato de `unique-grid`, además de los totales diarios. (Reportar al orquestador para que el analista lo refleje en el contrato funcional.)

#### 7. Estados

- **Loading (skeleton):** cabecera presente; el canvas se reemplaza por un **bloque del alto de la grilla** (`bg-panel-3 rounded-ctl animate-pulse`) — **no** se dibuja la cuadrícula fantasma celda por celda (sería ruido); un solo bloque alto + una franja de footer fantasma + 2–3 chips fantasma de filtro, mismo molde que `ChartSkeleton`. Sin spinner.
- **Empty (sin gastos Únicos en el año):** la **grilla se dibuja completa** (todos los días en piso verde claro/`$0`, todas las celdas nulas de meses cortos en gris) y un **overlay centrado** "Sin gastos únicos en {año}." (UI 14px `--muted`), reusando el overlay de las otras cards. **No** se deja el canvas en blanco: la planilla vacía (todo en piso) **es** el estado vacío legible, con el overlay de refuerzo. El footer muestra todos los totales en `$0` y los %dif en `—`.
- **Error:** idéntico a las otras cards — `AlertTriangle` 20px `--warning-ink` + "No se pudo cargar el reporte." + botón ghost "Reintentar", centrado, sin tinte de error.
- **Modo orden / mini de reorden (P1):** **sin tratamiento especial nuevo.** En modo orden la card colapsa al **mismo mini-ítem** de P1 (`[grip] · [ícono tipo] · [título] · ——— · [etiqueta tipo]`). El **ícono de tipo** de `unique-grid` es **`CalendarDays`** (lucide, 16px `--muted`) — glifo distinto de `AreaChart`/`BarChart3` que comunica "grilla de calendario/planilla"; **el mismo glifo** debe usarlo el `AddCardMenu` al ofrecer este tipo de reporte, para que ícono ↔ tipo sea consistente (igual que los otros dos). La **etiqueta de tipo** es **"Únicos"** (12px/600 `--muted`, sentence-case). **Sin mini-preview** de la grilla (misma decisión cerrada de P1: no es barato montar la grilla+fetch en el mini; identidad por ícono+etiqueta+título). Todo lo demás (caja del mini ~56px, grip, drag in-place, salida en vivo) es idéntico a P1.

#### 8. Tooltip de celda con desglose por categoría

Hoy el tooltip de celda (portaled a `body`) muestra solo **fecha + total del día**. Se enriquece con el **desglose por categoría de ESE día**, reusando el **lenguaje del popup de by-category** (Forma 2): por cada categoría con gasto ese día → **chip/punto de color de la categoría + nombre + monto**. Es la misma palabra visual de `ChartTooltipContent` (swatch 8px + label + monto mono), trasladada de "categorías de un mes" a "categorías de un día".

- **Caja:** la **misma** que ya tiene el tooltip de celda (sin cambios de cromo): `fixed z-50`, `rounded-ctl`, `border border-line`, `bg-panel`, `shadow-[var(--shadow-lg)]`, portaled a `body`, `pointer-events-none`, anclado `translate(-50%, -100%)` sobre la celda. **Sube** el `min-width` a ~`180px` (igual que `ChartTooltipContent`) para alojar las filas swatch+nombre+monto sin apretarse. Padding `px-3 py-[10px]` (el de `ChartTooltipContent`) en vez del `px-[10px] py-[8px]` actual, para alinear con el molde de by-category que ahora hereda.
- **Encabezado (se mantiene + se completa):** **fecha del día** en el registro actual — ej. `Mar 14, 2026` (mes corto es-AR + día + año), **UI 12px/600 `--ink-2`** (el front ya lo tiene así). Debajo, antes o como remate del desglose, el **total del día**: ver "Total" abajo.
- **Total del día — al ENCABEZADO, como cifra dominante:** el total del día va **arriba**, pegado a la fecha, en **mono tabular `tnum` 13px/600 `--ink`** (el peso que ya tiene hoy). Razón: el total es la lectura primaria (lo que la celda abrevia); el desglose es el detalle que se despliega debajo. Estructura: `[fecha UI]` → `[total mono dominante]` → `divisor --hair` → `[filas de categoría]`. (Alternativa equivalente: total al **pie** como `totalRow` de `ChartTooltipContent`, separado por divisor — pero el **default es total arriba**, porque el front ya lo tiene arriba y es la cifra que la celda representa.)
- **Filas de desglose (una por categoría con gasto ese día):** `flex items-center gap-[7px]`, idénticas a `ChartTooltipContent`:
  - **Swatch** 8px `rounded-[3px]`, `background: category.color`, `aria-hidden` — el **color identifica la categoría** (regla dura 1/2 intacta: el color es identificador, no semántico income/expense).
  - **Nombre** de la categoría: `flex-1`, **UI 12.5px/500 `--ink-2`**, `truncate` (nombres largos se cortan con elipsis; el swatch + monto nunca se comprimen).
  - **Monto** del gasto de esa categoría ese día: **mono tabular `tnum` `--ink-2`**, `shrink-0`, **completo sin abreviar** (`$1.234,56`) — el tooltip es la lectura exacta. Sin color semántico (todo es gasto Únicos; el monto va neutro `--ink-2`, no `--expense-ink`).
- **Orden de las categorías: monto DESC** (la de mayor gasto del día primero). Mismo criterio de jerarquía que el resto del producto (lo más grande arriba); el ojo lee de inmediato en qué se fue la plata ese día.
- **Límite / scroll:** un día concreto rara vez tiene muchas categorías, pero por las dudas: se muestran **hasta ~8 filas**; si hay más, el bloque de filas (no el encabezado ni el total) se vuelve **scrolleable** (`max-h-[180px] overflow-y-auto`) con el mismo recurso de la región scrollable de la leyenda (fade inferior opcional). **No** se agrupa en "Otras" en el tooltip (a diferencia de un candidato post-v1 del chart): el tooltip es detalle, lista todo. El encabezado (fecha + total) y el divisor quedan **fijos**; solo scrollean las filas.
- **Día con `$0` de gasto (día existe, sin gasto):** el tooltip **se muestra** con la fecha + total **`$0`** (mono, `--muted`) y **sin filas de desglose** (no hay categorías que listar) — opcionalmente una micro-línea `Sin gastos` en UI 12px `--muted` en lugar de la lista vacía. No se muestra un tooltip "vacío" sin contenido: siempre hay al menos fecha + `$0`. Coherente con la celda de `$0` (que existe y lleva tinte de piso, §3).
- **Celda nula (día inexistente, ej. Feb 30):** **no abre tooltip** (es `aria-hidden`, no participa de la navegación de datos, §2). Sin hover, sin popup. El front no debe cablear `onMouseEnter` de tooltip en celdas nulas.
- **Modo oscuro:** el tooltip hereda la caja del DS (`bg-panel`, `--line`, `--shadow-lg`) que ya resuelve ambos modos; los swatches usan el `category.color` (con el ajuste de color de categoría en oscuro que ya define el DS, *Categorías y gráficos en oscuro*). Sin tratamiento extra.

##### Contrato que necesita el backend (para cerrar con backend)

El front ya tiene `total` por celda. Para el desglose, cada celda (día con gasto) necesita un **breakdown por categoría**: por entrada, **`categoryId`** (para mapear color/nombre desde el universo de categorías que la card ya conoce) **o** `{ name, color }` ya resueltos, **y `amount`** (en cents, en la **moneda de display de la card** — mismo `?currency=` ya convertido, igual que el `total` de celda). El front ordena por `amount` DESC en cliente; el backend no necesita pre-ordenar (pero si lo hace, mejor). Días con `$0` → breakdown vacío `[]`. Celdas nulas → no se emiten. **Ambigüedad a confirmar:** si el backend manda `categoryId` (front resuelve color/nombre) o `{ name, color, amount }` ya armado — preferencia de diseño: **`categoryId` + `amount`**, para reusar el mismo universo de color/nombre del filtro de categorías y no duplicar la paleta en dos contratos.

#### Restricciones duras reafirmadas

- La **rampa de heatmap** es un **lenguaje de magnitud propio de esta grilla**, **distinto** de income/expense: verde=poco gasto, rojo=mucho gasto; **no** comunica ingreso/gasto (regla dura 1 no aplica al tinte de celda). Documentada y acotada acá.
- **Toda cifra** (celda, footer) va en **mono tabular** `tnum` (regla dura 3), abreviada en celda/footer, completa en tooltip, separador coma es-AR.
- El **%dif del footer** es **neutro `--ink-2` + glifo de dirección `↑`/`↓`** (decisión cerrada del usuario): **no** colorea por dirección. Esto **no introduce** ninguna excepción a la regla dura 1 — verde/rojo quedan reservados estrictamente a ingreso/gasto y no aparecen en el %dif.
- El **índigo** aparece **solo** como cromo de interacción (focus ring de chips-filtro/selectores, hover); **nunca** tiñe celdas ni cifras (regla dura 2).
- El **título** de la card es Space Grotesk neutro (`--ink`/`--faint`), nunca mono ni semántico ni índigo (igual que las otras cards, P4).
- **Identidad visual en ambos modos** (regla dura 4): la rampa tiene sus stops de luminosidad por modo; el texto de celda se calcula por contraste contra el tinte (independiente del modo); celdas nulas en `--panel-2` se adaptan solas. Verificar la grilla completa en claro y oscuro.

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

### Leyenda interactiva (la leyenda es el filtro)

La leyenda del gráfico **es** el filtro. Cada ítem de leyenda es un **toggle clickeable** que muestra/oculta su serie o categoría en el canvas. **Reemplaza** al disparador `FilterButton` + `CategoryFilterPopover` embebido, que se elimina de la cabecera de la card. Aplica **idéntico** en `/reportes` y en la card del Dashboard, y sirve **igual para los tres casos** (mismo componente `ChartLegend` interactivo, distinto contenido):

| Caso | Ítems de la leyenda | Qué togglea cada ítem |
|---|---|---|
| **Forma 1 — modo "Total" (vista A)** | dos: **Ingresos** (`--income`) / **Gastos** (`--expense`) | esa serie de área. **No hay filtro de categorías** acá. |
| **Forma 1 — modo "Por categoría" (vista B)** | una por **categoría** de gasto (swatch `category.color` + nombre), orden del apilado | esa banda del stack |
| **Forma 2 — by-category** | una por **categoría** de gasto (swatch `category.color` + nombre), orden del apilado | esa banda apilada |

**La lógica de tres estados NO cambia.** El filtro sigue siendo `null`=todas / `[]`=ninguna / lista (subconjunto) para categorías; en Forma 1 Total son dos series independientes que se prenden/apagan. La leyenda solo cambia la **piel** (de decorativa a interactiva) y el **lugar** donde se acciona (deja de haber popover).

#### Anatomía del ítem interactivo

Cada ítem deja de ser un `<div>` y pasa a ser un **`<button type="button">`**. Mantiene el contenido visual del ítem decorativo (swatch 10px radio 3px + etiqueta UI 12.5px/500), pero gana área de hit, padding propio y estados:

- **Caja del botón:** `inline-flex items-center gap-[6px]`, padding `px-[6px] py-[4px]`, radio `--r-chip` 7px, `cursor: pointer`, `transition` de color/opacidad/fondo `0.14s`. El padding agranda el área de hit (el swatch+texto solos son un target chico) y da espacio para el fondo de hover sin que el texto toque el borde. **Margen negativo `-mx-[6px]` en el contenedor de la leyenda** para que el padding del primer/último ítem no desalinee la leyenda respecto del eje del gráfico (el swatch del primer ítem sigue alineado a la izquierda como en la leyenda decorativa).
- **Swatch:** cuadrado 10px radio 3px, `shrink-0`. Su tratamiento por estado se detalla abajo (es la pieza que más comunica "activo vs. apagado").
- **Etiqueta:** UI 12.5px/500. Color por estado (abajo). `select-none`. **No** se trunca; la leyenda usa `flex-wrap`.

#### Estados del ítem

Cinco estados; el par crítico es **activo** (incluido en el gráfico) vs. **apagado** (excluido).

- **Activo (reposo) — incluido:** es el estado "encendido" y el default de todos los ítems. Swatch a **color pleno** (`--income`/`--expense`/`category.color`, opacidad 1). Etiqueta `--ink-2` (igual que la leyenda decorativa de hoy). Sin fondo.
- **Hover (sobre un ítem activo):** fondo `--panel-2`, etiqueta sube a `--ink`. Transición 0.14s. Comunica clickeabilidad sin mover el layout.
- **Apagado — excluido:** el estado "off". Tres señales simultáneas, ninguna sola alcanza (mismo principio que el ítem anulado de `/mes`):
  1. **Etiqueta `line-through`** (tachado), color a **`--muted`** (baja un escalón de jerarquía respecto del `--ink-2` activo). Se elige **`line-through` y no `underline`**: el subrayado se confunde con afordancia de link y compite con los underlines de las tabs de la cabecera; el tachado lee inequívocamente como "esto está descartado / fuera del cómputo", coherente con el `line-through` del monto anulado del DS.
  2. **Swatch a `outline` en vez de relleno:** el swatch apagado **pierde el relleno de color** y queda como un cuadrado con **borde 1.5px del propio color** (`category.color` / `--income` / `--expense`) e interior `--panel` (vacío). Mantiene la identidad del color (sigue siendo "esta" serie/categoría) pero comunica "vacío / no pintado en el gráfico", en eco directo de que su banda/área desapareció del canvas. **No** se atenúa el swatch a gris neutro: perdería la asociación color↔ítem que el usuario necesita para re-activarlo.
  3. **Opacidad del conjunto a `0.7`** sobre el botón entero (atenúa parejo swatch-outline + etiqueta tachada sin borrarlos). No baja de 0.7 para que el ítem siga siendo legible y re-clickeable.
- **Hover (sobre un ítem apagado):** mismo fondo `--panel-2`; la etiqueta sube de `--muted` a `--ink-2` (sigue tachada); opacidad del conjunto sube a `0.85`. Comunica "podés volver a activarlo" sin quitar aún el tachado.
- **Focus (teclado):** ring `--accent-soft` 3px (`focus-visible`, mismo focus ring del DS), radio `--r-chip` 7px. Cromo de interacción — el acento acá es foco, no estado de datos ni monto (no viola reglas duras). Vale igual en activo y apagado.
- **Active/pressed (clic sostenido):** fondo `--panel-3` (un escalón más que el `--panel-2` del hover), 0.14s. Feedback táctil del toggle.

> **Por qué el swatch va a outline y no se desatura:** el color del swatch es el **identificador** de la serie/categoría (regla dura de color de categoría / semánticos). Si al apagar se volviera gris, el usuario perdería la pista de **cuál** está re-activando. El outline conserva el hue (identidad) y comunica el "off" por la **ausencia de relleno**, espejo de que la banda/área salió del canvas. El `line-through` de la etiqueta refuerza el "off" en el texto. Las dos señales (swatch hueco + label tachada) más la atenuación son redundantes a propósito.

#### A11y — grupo de toggles

La leyenda interactiva es semánticamente un **grupo de controles de dos estados** (cada ítem prende/apaga una serie/categoría), no una sola elección excluyente:

- **Contenedor:** `role="group"` con `aria-label` por caso — **"Filtrar series"** (Forma 1 Total) / **"Filtrar categorías"** (Forma 1 Por categoría y Forma 2). Reemplaza el `aria-label="Leyenda del gráfico"` decorativo actual.
- **Ítem:** `<button type="button">` con **`aria-pressed`** = `true` (activo/incluido) / `false` (apagado/excluido). El patrón toggle-button (`aria-pressed`) lee mejor que checkboxes acá: el control **es** el ítem visual (swatch+label), no una casilla aparte, y un grupo de toggle buttons es la semántica ARIA canónica de "mostrar/ocultar esta serie".
- **Texto accesible:** el contenido del botón ya es la etiqueta (nombre de serie/categoría); el swatch va `aria-hidden`. El estado lo comunica `aria-pressed`, no el color (no dependemos del verde/rojo/`category.color` para transmitir on/off a lectores).
- **Navegación por teclado:** cada ítem es tabbable (es un `<button>`); `Enter`/`Espacio` togglea. No se exige roving-tabindex (no es un `tablist`); es un grupo de botones independientes, cada uno en el orden de tab natural.
- **Borde "todas apagadas":** apagar el último ítem (todas las categorías off, o ambas series off) deja la leyenda con todos los ítems en estado apagado y el canvas vacío → **el mismo empty "Sin movimientos en {año}."** que ya cubre el filtro vacío (sin error). La leyenda **no se bloquea**: el usuario reactiva clickeando cualquier ítem. No hay un mínimo forzado de "al menos uno encendido".

#### Layout y espaciado al volverse interactiva

- **Posición y separación entre ítems sin cambios estructurales:** la leyenda sigue debajo del canvas, `margin-top` 14px, alineada a la izquierda, `flex-wrap`. La separación visual entre ítems se mantiene en ~16px: como cada ítem ahora trae `px-[6px]` propio, el `gap` del contenedor baja de 16px a **`gap-x-[10px] gap-y-[6px]`** (10 de gap + 6+6 de paddings vecinos ≈ 16 de aire entre swatches, igual densidad percibida que la leyenda decorativa). El `-mx-[6px]` del contenedor compensa el padding de los ítems de los extremos para no perder la alineación izquierda.
- **Sin línea divisoria ni caja:** la leyenda interactiva **no** gana borde, fondo de grupo ni separador — sigue siendo ítems "al aire", como la decorativa. La interactividad la comunican el cursor, el hover y el focus, no chrome estructural.
- **Skeleton de carga sin cambios:** durante loading la leyenda sigue mostrando 2–3 chips fantasma (`bg-panel-3 animate-pulse`), inertes; no se renderizan como botones hasta que hay datos.
- **`prefers-reduced-motion`:** las transiciones de color/fondo/opacidad del toggle son ≤0.14s y sobrias; igual respetan `prefers-reduced-motion` (sin transición). El cambio del canvas al togglear hereda el comportamiento ya vigente (las áreas/barras reaniman su grow salvo reduced-motion).

#### Atajo "Todas / Ninguna" (select/deselect all)

Al pasar a leyenda-filtro se perdió el atajo **"Todas / Ninguna"** que el viejo `CategoryFilterPopover` tenía en su header (seleccionar/deseleccionar todo de un clic). Se **reintroduce** como un control asociado a la leyenda, sin volver a meter un popover.

> **Rediseño (reemplaza el link de texto en micro-cabecera).** La versión anterior — un botón-link de texto `--accent-ink` 12px en una **micro-cabecera** sobre la fila de toggles — se descarta: leía como un "linkcito" suelto, pobre y desprendido del sistema de chips. **Lo nuevo es un `LegendAllChip`: un chip-comando icónico que vive en la misma fila de la leyenda (inline, al final), separado de los chips de categoría por un divisor `--hair` vertical.** Se siente parte del set de chips por forma y altura, pero está deliberadamente diferenciado (ícono en vez de swatch de color, sin `aria-pressed`, color neutro) para que **nunca** se confunda con una categoría. Esto también **elimina la micro-cabecera** y devuelve a la leyenda su `margin-top: 14px` simple respecto del canvas.

- **Alcance — solo en la leyenda de categorías.** Se muestra en **Forma 1 modo "Por categoría" (vista B)** y en **Forma 2** (las dos leyendas de categorías), donde el universo de ítems es **abierto y potencialmente largo** (una por categoría de gasto) y prender/apagar de a uno es engorroso. **No se muestra en la leyenda de series Ingresos/Gastos (Forma 1 "Total")**: son **dos** ítems, donde un atajo "todas/ninguna" no ahorra trabajo (alcanza un clic por serie) y además "apagar todas" las series equivale a vaciar el gráfico sin un caso de uso real (a diferencia de aislar categorías). Mostrarlo ahí sería ruido. La justificación es la misma economía que rige el resto del DS: el chrome aparece cuando resuelve un problema real, no por simetría.

- **Forma — chip-comando icónico, hermano de los chips de leyenda pero no uno de ellos.** Es un `<button type="button">` con la **misma anatomía de caja** que un ítem de leyenda (`inline-flex items-center gap-[6px]`, radio `--r-chip` 7px, `cursor:pointer`, `transition .14s`), para que comparta altura, alineación vertical y baseline con la fila — **se siente del mismo sistema**. Difiere en tres cosas que lo marcan como **comando**, no como categoría:
  1. **Ícono en lugar de swatch de color.** Lleva un ícono 13px (`--muted` en reposo) a la izquierda del rótulo, **no** un swatch cuadrado de color. El ícono cambia con el estado/acción (ver "Label e ícono" abajo). Esto rompe de un vistazo la asociación "cuadrito de color = una categoría": un chip con ícono es, por convención del DS, un control; un chip con swatch es un ítem de datos.
  2. **Rótulo en semibold y un punto más chico:** UI **12px / 600** (vs. la etiqueta de leyenda 12.5px/500), para leer como "acción/comando". `select-none`. **Nunca** tachado ni con swatch hueco — no tiene estado on/off propio.
  3. **Padding levemente mayor en X para densidad de "botón":** `px-[8px] py-[4px]` (vs. `px-[6px]` del ítem), apenas más ancho, lo que junto al fondo de reposo (abajo) le da peso de control.

- **Ubicación exacta — en un carril fijo, fuera del área que scrollea, separado por un divisor.** El `LegendAllChip` **no fluye dentro del `flex-wrap` de los toggles**: vive en un **carril propio, fijo**, **siempre visible**. **La estructura DOM autoritativa de ese carril (stack vertical de dos partes: región scrolleable arriba, carril del comando abajo) está en *Escalado de la leyenda con muchas categorías*, abajo — ese spec manda sobre los detalles de layout/divisor de este bullet.** Entre el set de chips de categoría y el `LegendAllChip` va un **divisor `--hair` `1px`**: **horizontal** a lo ancho del bloque (`my-[8px]`) en el stack vertical (forma canónica), o **vertical** (alto 16px, `self-center`, `mx-[8px]`) solo en el fallback opcional de fila única. En ambos casos el divisor **declara "lo que sigue no es una categoría más"** — corta el set de datos del comando. Esto reemplaza la **micro-cabecera** anterior: ya no hay línea propia encima; la leyenda recupera `margin-top: 14px` respecto del canvas y el grupo conserva su `-mx-[6px]`.
  - **Por qué fuera del scroll y no como último chip del wrap:** si el chip fluyera como último hijo del `flex-wrap` (spec previo), con muchas categorías caería 4–6 renglones abajo, **enterrado** — el problema exacto que el escalado resuelve. En su carril fijo queda anclado, alcanzable sin scrollear.
  - **El divisor pertenece al chip-comando, no a la fila:** se renderiza pegado al `LegendAllChip` (mismo subárbol), de modo que si por algún caso el chip no se muestra (leyenda de series), tampoco aparece divisor colgando.
  - **Cambia respecto del spec anterior (y del código vigente):** la versión previa — **implementada hoy** en `ChartLegend` como `trailingSlot` y en `report-card.tsx` como `LegendAllChip` inline — metía el chip como **último hijo del mismo `flex-wrap`** que los toggles, con divisor vertical. Esa estructura **se reemplaza** por el stack vertical con región scrolleable + carril fijo. Frontend debe reestructurar `ChartLegend` (ver resumen al orquestador).

- **Tratamiento visual con peso de control discreto (NO chrome pesado).** A diferencia del ítem de leyenda — que va "al aire" sin fondo en reposo —, el chip-comando lleva un **fondo sutil permanente** que lo distingue como botón sin gritarlo:
  - **Reposo:** fondo **`--panel-2`**, ícono `--muted`, rótulo `--ink-2`. El fondo tenue lo separa de los ítems "al aire" sin meter borde ni sombra.
  - **Hover:** fondo sube a **`--panel-3`**, ícono y rótulo suben a **`--ink`**. Transición `.14s`. (Sin `underline`: el chip ya tiene afordancia por fondo + cursor; el subrayado quedaría como vestigio del link viejo.)
  - **Active/pressed:** fondo `--panel-3` mantenido + el feedback real es el cambio inmediato de los swatches de toda la leyenda al togglear, más el flip de ícono/label del propio chip.
  - **Focus (teclado):** ring **`--accent-soft` 3px** (`focus-visible`), radio `--r-chip` 7px — **mismo focus ring del DS** que los toggles de la leyenda. El acento acá es **cromo de foco**, no estado de datos ni monto (no viola reglas duras).
  - **Color del rótulo — neutro, NO `--accent-ink`.** Se abandona a propósito el índigo del link viejo: el `--accent-ink` sobre texto suelto fue parte de lo que lo hacía leer como "linkcito". El chip se apoya en el **fondo** para su afordancia y usa la **escala neutra** (`--ink-2`→`--ink`) para el rótulo, coherente con los segmentos no-marca de los controles del DS. (El popover de `/mes` conserva su link `--accent-ink` en header; ver "Coherencia" abajo — son de la misma familia sin ser idénticos.)

- **Label e ícono invertidos según estado (misma semántica que el popover viejo).** El chip **anticipa la acción que ejecutará**, no el estado actual:
  - Si **todas** las categorías están activas (`hiddenIds` vacío) → rótulo **"Ninguna"** + ícono **`EyeOff`** (13px). Clic = apagar todas → estado `[]`. El ícono "ojo tachado" prefigura "ocultar todo".
  - Si hay **alguna apagada** (`hiddenIds` no vacío — incluye "todas apagadas" y cualquier subconjunto) → rótulo **"Todas"** + ícono **`Eye`** (13px). Clic = encender todas → estado `null`. El ícono "ojo" prefigura "mostrar todo".
  - El **flip ícono+label es la micro-interacción**: al togglear, el chip cambia de `Eye/"Todas"` ↔ `EyeOff/"Ninguna"` con un `transition` de color `.14s` (sin animación de layout; el ancho del chip puede variar 1–2px entre "Todas"/"Ninguna" y eso es aceptable, no se fija ancho). Comunica, antes del clic, **qué va a pasar**.
  - Es la **misma lógica de tres estados** ya vigente (`null`=todas / `[]`=ninguna / subconjunto); el chip solo salta a los dos extremos. No agrega un cuarto estado.

- **A11y:**
  - `<button type="button">` **fuera** del `role="group"` de los toggles de categoría — es un **comando sobre el grupo**, no un miembro. **El `role="group"` envuelve solo los chips de categoría** (dentro de la región scrolleable); el `LegendAllChip` y su divisor quedan como **hermanos del group**, en el carril fijo, fuera del scroll (el bloque externo agrupa `[región-scroll(group de toggles)][divisor horizontal][carril: chip-comando]`).
  - **No** lleva `aria-pressed` (no es un toggle de dos estados visible: su rótulo ya comunica la acción que ejecutará). Texto accesible = el rótulo ("Todas" / "Ninguna"); el ícono va `aria-hidden`.
  - `aria-label` explícito para desambiguar comando vs. estado: **`aria-label="Mostrar todas las categorías"`** cuando el rótulo es "Todas", **`aria-label="Ocultar todas las categorías"`** cuando es "Ninguna". (El rótulo visible corto basta a la vista; el `aria-label` largo evita que un lector lea solo "Todas" sin contexto.)
  - **Orden de tab:** al estar al final del DOM de la fila, queda **después** de los toggles de categoría — el usuario recorre primero las categorías y al final el comando "todas/ninguna" (orden de lectura natural de la enumeración). El divisor es decorativo (`aria-hidden`, no focusable).

- **Robustez con pocas / muchas categorías y card angosta.** Con **pocas** categorías el bloque es una región sin scroll (1–2 renglones) + el carril del comando debajo, separados por la regla horizontal — sin fade, sin scrollbar. Con **muchas** categorías el chip **no se entierra**: queda fijo en su carril, separado del área scrolleable de los toggles (que recorta a 3 renglones) — ver *Escalado de la leyenda con muchas categorías*, abajo, que es el spec completo de este caso. En **card angosta** la región scrolleable es más alta (más renglones por menos ancho) pero el `max-h-[84px]` la acota igual, y el chip no crece de ancho (su rótulo es de 1 palabra, alineado a la izquierda del carril) — sin overflow horizontal, sin truncado, sin ancho fijo.

#### Escalado de la leyenda con muchas categorías

Las categorías del usuario **no tienen tope duro** (la matriz de color tiene 70 entradas; un usuario puede llegar a 20, 30+ categorías). Sin un tope de alto, la leyenda-filtro de categorías se vuelve una fila `flex-wrap` de **4–6+ renglones** que cuelgan bajo el gráfico y hacen crecer la card a lo alto sin límite; en `/reportes` hay **varias cards apiladas**, así que el sprawl vertical es grave. Este spec acota ese crecimiento. **Aplica solo a las leyendas de categorías** (Forma 1 modo "Por categoría" y Forma 2); la leyenda de series Ingresos/Gastos (Forma 1 "Total") son siempre **2 ítems** y **no usa nada de esto** (ni región scrolleable, ni carril fijo, ni `LegendAllChip`).

**Opciones evaluadas.** Tres caminos reales, juzgados por lectura, alto de card, ubicación del atajo masivo y comportamiento del gráfico apilado con muchas series:

| Opción | Lectura con 30+ cats | Alto de card | Atajo "Todas/Ninguna" | Gráfico apilado | Veredicto |
|---|---|---|---|---|---|
| **(a) Región con `max-h` + scroll interno** | el universo entero a **un gesto de scroll**; sin estados ocultos que recordar | **acotado y constante** (3 renglones), idéntico con 6 o 70 cats | puede **fijarse fuera del scroll** (carril propio) → nunca enterrado | sin cambios (el filtro no toca qué grafica el canvas) | **elegida** (combinada con carril fijo) |
| **(b) Cap visual "+N más" que expande** | hay que **expandir** para ver/filtrar la cola; "+12 más" es mal affordance *para filtrar* | **vuelve a crecer ilimitado** al expandir (un clic y la card se estira N renglones) | el atajo queda **antes o después del cap** → o se entierra al expandir, o filtra sobre un set parcial | igual | descartada |
| **(c) Solo carril fijo, sin tope de alto** | toda la leyenda visible pero | **sprawl vertical sin límite** (el problema original) | siempre visible, pero la card sigue rota | igual | descartada (no acota alto) |

**Opción elegida: (a) + carril fijo — región de leyenda con alto máximo + scroll interno, y `LegendAllChip` en carril fijo siempre visible.** Combina el tope de alto con scroll interno para los chips (acota la card) con la fijación del comando fuera del scroll (nunca se entierra). Se descarta **(b)**: expandir reintroduce el crecimiento vertical ilimitado que queremos evitar, agrega un estado más que mantener, y un "+12 más" es peor affordance *para filtrar* que un área scrolleable donde el universo entero está a un gesto de scroll. El scroll de alto fijo es además **el patrón que ya usaba el control viejo** (`max-h-[280px] overflow-y-auto` en `CategoryFilterPopover`) y el que conserva el popover de `/mes` — coherencia de vocabulario.

- **Umbral — por alto, no por conteo.** La región **no** tiene un número mágico de categorías que dispare el cambio; tiene un **alto máximo en renglones**. Mientras el contenido de chips entra en **≤ 3 renglones** la región se ve idéntica al caso simple actual (sin scroll, sin fade, sin scrollbar). Cuando el contenido supera ese alto, el sobrante queda detrás de scroll. Razón de elegir alto y no conteo: lo que rompe la card es la **altura**, y la altura depende de cuántos chips entran por renglón (varía con el ancho de la card y el largo de los nombres) — 3 renglones de chips largos en card angosta ocupan tanto como 5 de chips cortos en card ancha. Atar el umbral al alto renderizado lo hace correcto en todos los anchos sin tunear conteos.
  - **Alto máximo concreto:** **`max-height` = 3 renglones de chip** ≈ **`84px`** (3 × ~28px de alto de chip, con su `gap-y-[6px]`). Es el valor a portar; si el alto real del chip difiere, frontend ajusta el `max-height` para que cuadre 3 renglones exactos (no es un pixel sagrado: la intención es "3 renglones visibles"). Este alto deja ver cómodamente ~12–20 categorías típicas en cards anchas sin scroll, y acota el peor caso (70 categorías) a una ventana de 3 renglones + scroll.

- **Contenedor scrolleable (los chips de categoría).** El `role="group"` de los toggles de categoría se envuelve en una **región scrolleable**:
  - `max-h-[84px]` + `overflow-y-auto` + `overflow-x-hidden`. El `flex-wrap` de los chips vive **dentro** de esta región; conserva su `gap-x-[10px] gap-y-[6px]` y su `-mx-[6px]` para la alineación leyenda↔eje (el `-mx` va en el wrap interno, no en la región, para que el scrollbar no coma la alineación).
  - **Padding para el scrollbar:** la región lleva `pr-[2px]` (o el ancho del scrollbar overlay) para que el scrollbar, cuando aparece, no se monte sobre los chips del borde derecho.
  - **Fade inferior como señal de "hay más".** Cuando la región tiene contenido por debajo del corte, un **fade de 16px** en su borde inferior (gradiente que desvanece los chips hacia `--panel`, vía `mask-image: linear-gradient(to bottom, black, transparent)` sobre los últimos 16px, **no** una capa de color encima) insinúa continuidad sin meter scrollbar siempre visible ni chrome pesado.
    - **Cuándo aparece:** solo cuando `scrollHeight > clientHeight` (hay overflow). Frontend mide eso una vez por render del set de chips (y en resize) y lo expone como `data-overflow="true"` en la región; el fade se ata a ese atributo vía CSS. Con ≤ 3 renglones (sin overflow) **no hay fade**.
    - **Atenuación al fondo (opcional):** idealmente el fade se apaga cuando el scroll llega al final (ya no hay nada debajo). Si atarlo al `scrollTop` en vivo es caro, **es aceptable un fade estático** que existe mientras `data-overflow` sea true — el costo es que el fade sigue insinuando "hay más" al estar al fondo, lo cual es un defecto menor y tolerable.
    - **El fade vive DENTRO de la región scrolleable, no sobre el carril del comando.** El `mask` aplica al contenedor de scroll; el `LegendAllChip` (con su fondo `--panel-2`) queda **debajo del fade**, en el carril fijo, intacto y nítido. El fade nunca tiñe ni desvanece el chip-comando.
  - **Scrollbar:** fino y discreto, no siempre presente — el del SO/overlay alcanza; no se especifica scrollbar custom. Lo que comunica "hay más" es el **fade**, no el track del scrollbar.
  - **Sin caja ni borde:** la región scrolleable **no** gana borde, fondo propio ni separador superior — sigue siendo "chips al aire" sobre el `--panel` de la card, igual que la leyenda no-scrolleable. El único chrome nuevo es el **fade inferior condicional**. No se debe leer como un panel embebido; se debe leer como "la misma leyenda, con tope de alto".

- **`LegendAllChip` en carril fijo, fuera del scroll.** El chip-comando **no** entra en la región scrolleable: vive en un **carril fijo**, **siempre visible**, de modo que "Todas/Ninguna" es alcanzable **sin scrollear** por más categorías que haya. Esto es lo que resuelve el "queda enterrado abajo" del problema.

- **Estructura DOM única (no dos árboles).** Para no obligar a mantener dos layouts distintos, el bloque de leyenda de categorías es **siempre el mismo stack vertical de dos partes**, independientemente de cuántas categorías haya:
  ```
  <div bloque-leyenda>                    ← mt-[14px], stack vertical
    <div región-scroll  max-h-[84px]      ← chips de categoría
         overflow-y-auto overflow-x-hidden
         data-overflow={true|false}>      ← marca de overflow (controla fade)
      <div role="group" flex-wrap -mx-[6px] gap-x-[10px] gap-y-[6px]>
        <button aria-pressed> … chips …
      </div>
    </div>
    <div carril-comando -ml-[8px]>         ← [divisor][LegendAllChip], NUNCA scrollea
  </div>
  ```
  El carril del comando es `flex` alineado a la izquierda; el `LegendAllChip` lleva su `px-[8px]` propio, así que el carril compensa con `-ml-[8px]` para que el ícono del chip quede alineado al eje del gráfico (mismo principio que el `-mx-[6px]` de los chips). El divisor horizontal va **antes** del chip dentro del bloque, a lo ancho completo (no se aplica el `-ml` al divisor).
  La **única** diferencia visible entre "pocas" y "muchas" categorías la produce el **`max-height` y el overflow del navegador**, no un cambio de árbol: con pocos chips la región no llega al tope y se ve como una leyenda normal; con muchos, recorta a 3 renglones y aparece scroll. **No se anima** el paso de un estado a otro (no hay transición de layout; `prefers-reduced-motion` no aplica). Frontend no necesita medir nada para decidir el árbol — solo para el fade (ver abajo).

- **El divisor del carril es siempre horizontal.** En este stack el `[divisor]` que precede al `LegendAllChip` es una **regla `1px --hair` horizontal a lo ancho del bloque** (`my-[8px]`), no el divisor vertical 16px del caso de fila única. Separa "área de chips" de "carril del comando" en eje vertical. **Esto ajusta el spec del `LegendAllChip`:** su divisor deja de ser siempre vertical — es vertical solo en el *fallback de fila única* (abajo) y horizontal en el stack. El divisor sigue perteneciendo al subárbol del chip (si el chip no se renderiza, no hay divisor colgando).

- **Fallback de fila única para pocas categorías (opcional, no obligatorio).** El stack vertical con divisor horizontal **ya cubre correctamente el caso de pocas categorías** (una región de 1–2 renglones sin scroll + carril debajo): es la forma canónica y la que frontend debe implementar primero. El "chips + divisor vertical 16px + chip, todo en una línea" del spec del `LegendAllChip` queda como **variante estética preferida pero no bloqueante** para cuando la leyenda entra en 1 renglón holgado; si frontend la implementa, la conmuta por conteo de renglones medido (overflow=false **y** una sola fila renderizada) y usa divisor vertical en ese caso. **Si no la implementa, el stack vertical con divisor horizontal es aceptable en todos los anchos** y no degrada nada — solo agrega una regla horizontal fina bajo 1–2 renglones de chips, coherente con el resto del DS. Se prioriza **una estructura estable y correcta** sobre la micro-optimización de la fila única.

- **A11y de la región scrolleable.**
  - **Foco dentro del scroll:** cada chip de categoría sigue siendo un `<button>` tabbable; al tabular hacia un chip que está fuera de la ventana visible, el navegador **auto-scrollea** la región para traerlo a la vista (comportamiento nativo de `overflow:auto` con foco). No se requiere lógica extra.
  - **Orden de tab:** primero los chips de categoría (en orden del apilado, dentro del scroll), y **al final** el `LegendAllChip` — que al estar en el carril fijo **fuera** del scroll, es siempre alcanzable por teclado **sin** depender de scrollear (un `Tab` desde el último chip cae en el comando). Esto cumple el requisito de que "Todas/Ninguna" sea alcanzable sin scroll, tanto con mouse (carril fijo visible) como con teclado (último en el orden de tab, sin scroll intermedio obligatorio).
  - **El `role="group"`** sigue envolviendo **solo** los chips de categoría (ahora dentro de la región scrolleable); el `LegendAllChip` y el divisor quedan **hermanos del group**, en el carril fijo — sin cambios respecto de la semántica ya specada.
  - **Región scrolleable y lectores:** la región es un contenedor de scroll, **no** un landmark ni un `role` nuevo; no se le pone `tabindex={0}` propio (los chips internos ya son focusables y arrastran el scroll). El fade y el scrollbar son decorativos (`aria-hidden` no aplica a pseudo-fade vía mask; no hay nodo extra que ocultar).

- **Coherencia con el popover "Todas/Ninguna" de `/mes`.** Misma familia, no idéntico. Comparten: el patrón **área scrolleable de alto fijo** (`max-h` ~280px en el popover de `/mes`; ~84px / 3 renglones acá — el popover es más alto porque es una superficie dedicada, la leyenda vive embebida bajo el gráfico y no puede robar tanto alto) y la **semántica "Todas/Ninguna" de tres estados** (`null`/`[]`/lista). Difieren en la **piel**: el popover de `/mes` es una superficie flotante con filas-checkbox y "Todas/Ninguna" como **link `--accent-ink`** en un header fijo; la leyenda es **inline**, con chips-toggle (swatch hueco + tachado como "off") y "Todas/Ninguna" como **`LegendAllChip` icónico neutro** en carril fijo. La fijación del comando (header fijo allá, carril fijo acá) es el principio común: **el select/deselect-all nunca se entierra detrás del scroll**.

> **Nota separada — legibilidad del gráfico apilado con muchas series.** Fuera del scope del filtro, conviene anotar (para que el orquestador lo derive como señal funcional/visual, no es spec de este filtro): con ~30–70 categorías apiladas, el área/barra de cada banda se vuelve un hilo indistinguible y la matriz de 70 colores agota contrastes diferenciables. Mitigaciones a evaluar **por separado**, no acá: (i) un *top-N + "Otras"* en el canvas (agrupar la cola de categorías chicas en una banda neutra "Otras"), manteniendo la leyenda-filtro completa para desglosar; (ii) que el default del filtro con muchas categorías muestre las top-N y deje el resto apagado (re-activable desde la leyenda). Ambas son **decisiones funcionales** (qué grafica el canvas), no del filtro — las menciono como riesgo y las dejo para que el orquestador decida si abre análisis. **No** las incluyo en el spec del filtro.

> Reutiliza: el componente `ChartLegend` (swatch 10px + etiqueta 12.5px/500) ahora en variante interactiva; el `line-through` + atenuación del **ítem anulado de `/mes`** como lenguaje de "fuera del cómputo"; el **focus ring `--accent-soft` 3px** del DS; el **empty "Sin movimientos…"** para el borde de todo apagado; la **caja de chip (`--r-chip` 7px, fondo `--panel-2`→`--panel-3`)** y la **escala neutra `--ink-2`→`--ink`** de los controles del DS para el chip-comando; el **divisor `--hair` vertical** como corte entre conjunto de datos y comando; la **semántica "Todas/Ninguna" del header del popover de filtro** (misma lógica de tres estados y rótulo invertido, coherencia de vocabulario sin copiar el tratamiento de link). Aporta: el **swatch hueco (outline) como señal de "off"** que preserva la identidad de color; la semántica de **grupo de toggle buttons (`aria-pressed`)** que hace de la leyenda el filtro; y el **`LegendAllChip`** — chip-comando icónico (ícono `Eye`/`EyeOff` + rótulo, fondo sutil, neutro, sin `aria-pressed`) en carril fijo al cierre de la leyenda tras un divisor, fuera del `role="group"` y solo en leyendas de categorías — que reintroduce el select/deselect-all **reemplazando el link de texto en micro-cabecera** descartado por pobre; y el **escalado de la leyenda con muchas categorías** — **stack vertical estable de dos partes** (región de chips `max-h` 3 renglones ~84px + scroll interno + fade inferior atado a `data-overflow`, arriba; carril fijo con divisor horizontal `--hair` + `LegendAllChip`, abajo), con el comando **fijo fuera del scroll** (alcanzable sin scrollear, por mouse y por teclado) — que acota el sprawl vertical de la card sin enterrar el "Todas/Ninguna", con una sola estructura DOM que no se degrada con pocas categorías.

### Filtro de categorías embebido (checklist en popover)

> **Estado vigente (Ola 2, P1):** este patrón disparador+popover **ya NO se usa en la card de reporte** — en `/reportes` y en el Dashboard el filtro de categorías pasó a ser la **leyenda interactiva** (ver *Leyenda interactiva (la leyenda es el filtro)*, abajo), y el `FilterButton` + `CategoryFilterPopover` se **eliminaron de la cabecera de la card**. El patrón **sigue vigente y se reutiliza** dentro del *Filtro por listado en `/mes`* (bloque categorías del popover de sección), donde sí hay un disparador. La lógica de tres estados (`null`=todas / `[]`=ninguna / lista) **no cambia**; lo que cambia es la piel y el lugar donde se acciona en la card.

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

### Control de orden de la sección Únicos (toggle monto ↔ fecha)

Control **ligero/disimulado** que vive **solo en la cabecera de la sección Únicos** de `/mes`, hermano del `SectionFilterButton` (*Filtros por listado en `/mes`*, arriba). Únicos es la **única** sección con columna fecha ("DD Mmm"); Fijos y Cuotas no tienen día, así que **no llevan este control** (no se renderiza en sus cabeceras). El criterio de orden por defecto del listado es **magnitud `|monto| DESC`** (el mismo del backend, ver *Metadatos de relación…*); este control permite **alternar** ese orden con un orden **por fecha**.

**Es un toggle de dos órdenes, no un menú.** Dos estados mutuamente excluyentes: **(a) por monto** (`|monto| DESC`, el default de la sección) y **(b) por fecha**. No hay un tercer estado ni dirección configurable por el usuario: cada orden tiene **una** dirección fija (ver default abajo). Un solo clic alterna entre a↔b.

**Default de la dirección por fecha — descendente (más reciente primero, `fecha DESC`).** Justificación: en un diario de gastos del mes en curso, lo último cargado/gastado es lo que el usuario acaba de hacer y lo que más consulta; "lo más nuevo arriba" es la convención de un feed/registro temporal. Desempate dentro del mismo día: `|monto| DESC` (cae al criterio base), para que dos movimientos del mismo día queden ordenados de forma estable y predecible. El orden **por monto** conserva su dirección histórica (`DESC`, mayor magnitud arriba).

**Ubicación en la fila.** Se inserta **a la izquierda del `SectionFilterButton`**, ambos pegados al borde derecho junto al subtotal. Orden de la fila en Únicos: `[handle] [chevron] [rótulo] [pill] [divisor flex-1] [control de orden] [filtro] [subtotal]`. Aire entre los dos disparadores: `gap-1` (4px), para que se lean como un par de affordances de UI sin fundirse. Como el `SectionFilterButton`, se renderiza **fuera del `<button>` disclosure** (hermano), con `stopPropagation` en el clic para no disparar el colapso. En Fijos/Cuotas la fila no incluye este slot (queda solo `[… divisor] [filtro] [subtotal]`).

**Tratamiento visual — mismo molde icon-only que el `SectionFilterButton`.** Botón ghost icon-only del DS, **sin rótulo de texto** (mismo argumento: poco lugar en la fila y la sección ya está rotulada; el par con el filtro debe leerse parejo). Padding `px-[7px] py-[5px]`, radio `--r-ctl`, transición `colors` 0.14s.

- **Ícono — un único glifo que comunica el orden vigente** (igual que el chevron del acordeón rota para comunicar estado, acá el glifo cambia según el orden activo, no se acumulan dos íconos):
  - **Orden por monto (default):** `ArrowDownWideNarrow` (lucide, 15px, `stroke-width 2`, `aria-hidden`). Las barras decrecientes leen "ordenado de mayor a menor" (la magnitud).
  - **Orden por fecha:** `ArrowDownNarrowWide` (lucide, 15px) — barras crecientes, par visual del anterior, que lee "otro criterio de orden". (Alternativa aceptable si frontend prefiere reforzar el dominio temporal: `CalendarArrowDown`. Canónico: el par `ArrowDownWideNarrow` ↔ `ArrowDownNarrowWide`, porque mantiene la familia "flecha de orden" y evita sugerir un date-picker.)

**Estado activo / no-default — mismo lenguaje del punto indicador del filtro.** El **default es "por monto"**; "por fecha" es el estado **≠ default**. Cuando el orden es **por fecha** (no-default), se aplican las dos señales del `SectionFilterButton`: (1) el ícono sube a `--ink` en reposo, y (2) aparece el **punto indicador 6px `--accent`** como badge en la esquina superior derecha (offset `-top-[2px] -right-[2px]`, borde `2px --panel`, `pointer-events-none`, `aria-hidden`) — cromo de UI, no monto. En el estado **por monto (default)** no hay punto y el ícono está en `--muted` (reposo). Así, de un vistazo, dos puntos `--accent` posibles en la cabecera de Únicos comunican "esta sección está modulada" (uno por orden ≠ default, otro por filtro activo), con el mismo vocabulario.

**Estados (reposo / hover / activo-abierto-no aplica / focus)** — idénticos al `SectionFilterButton`, salvo que este es un toggle sin popover (no tiene estado "abierto"):

- **Reposo (orden por monto = default):** ícono `--muted`, sin fondo, sin punto.
- **Reposo (orden por fecha ≠ default):** ícono `--ink`, sin fondo, **con** punto `--accent`.
- **Hover (cualquier orden):** ícono → `--ink`, fondo `--panel-2`. Transición 0.14s.
- **Active (`:active`, mientras se presiona):** fondo `--panel-3` (consistente con el active de los controles del DS).
- **Focus (teclado):** ring `--accent-soft` 3px (`focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]`), sin outline.

**a11y.** Es un **botón toggle**, no un grupo: `<button type="button">` con `aria-pressed` reflejando "por fecha" (`aria-pressed={true}` cuando el orden es por fecha, `false` cuando es por monto). `aria-label` **dinámico que anuncia la acción del próximo clic**: en orden por monto → `aria-label="Ordenar por fecha"`; en orden por fecha → `aria-label="Ordenar por monto"`. (No usa `aria-haspopup` ni `aria-expanded` — no abre overlay.) El punto indicador y los íconos son `aria-hidden`; el estado lo comunican `aria-pressed` + el label.

**Comportamiento en modo orden — se oculta, igual que el filtro.** En modo orden de secciones la cabecera está dedicada a arrastrar; el control de orden **no se renderiza** (mismo criterio que el `SectionFilterButton`). Vuelve al salir del modo ("Listo").

**Persistencia / scope.** El orden elegido es **estado de UI de la sección Únicos**; que persista entre navegaciones de mes o entre sesiones es **decisión funcional**, no visual — fuera del scope de esta guía (a definir por análisis si se requiere). Visualmente, el control refleja el orden vigente sea cual sea su origen.

**Responsive (≤940px).** Icon-only, no crece de ancho: entra en la fila igual que en desktop, en par con el filtro. Sin cambio de forma.

> Reutiliza el molde icon-only y el lenguaje del punto indicador `--accent` del `SectionFilterButton`. Aporta el patrón **toggle de orden** (un glifo que muta según el criterio activo, `aria-pressed`, sin popover) y la regla de que **solo Únicos** (sección con columna fecha) lo lleva.

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
