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
- **Responsive:** el toggle vive en el **mismo bloque inferior** del sidebar, en su fila propia encima del `UserMenu`, en todos los anchos. El sidebar es un **único elemento de 248px** cuyo mostrar/ocultar lo controla el usuario (ver §Sidebar — mostrar/ocultar); no hay variante mobile separada ni drawer aparte. El toggle de iconos cabe holgado. Cuando el sidebar está cerrado, el control de tema queda oculto junto con el resto del bloque inferior.
- **Skeleton:** si el bloque inferior del sidebar tiene estado de carga, el placeholder del toggle es un `SkeletonPill` (radio `--r-pill`) del alto del control (~36px) y ancho del toggle de 3 iconos (~108px). En la práctica el tema se resuelve antes del primer paint (sin FOUC), así que el toggle no suele requerir skeleton propio.

> **Resumen.** El control de modo de color **es** un toggle de iconos (`Monitor` Sistema · `Sun` Claro · `Moon` Oscuro, sin label visible) que vive en el bloque inferior de `AppSidebar`, en fila propia encima del `UserMenu`, con label "Tema" `--faint` a la izquierda y el toggle alineado a la derecha. Sus valores visuales (track, thumb, focus ring, estados, transición y a11y) son los descritos arriba en esta sección.

---

## Principios de jerarquía y layout

- **Desktop-first.** El target principal es desktop web. El **sidebar** (248px) es chrome que el usuario **muestra u oculta** a voluntad en cualquier ancho soportado (ver §Sidebar — mostrar/ocultar), no un elemento que auto-colapsa por breakpoint. Debajo del breakpoint el login pasa a 1 columna y las grillas colapsan a 1 columna.
- **Jerarquía por peso + tamaño + color, no por decoración.** El monto y los totales dominan visualmente; la meta (categoría, fecha, contadores) va en neutros terciarios.
- **Semántica antes que estética:** el color de un monto comunica ingreso/gasto, nunca es decorativo.
- **Movimiento sobrio:** entrada de pantalla fade + translateY (.32s), modal `pop` (scale .98→1, .22s), toast slide-up (.3s), hover .14s. Respetar `prefers-reduced-motion`.

---

## Contención responsive

El producto es **desktop-first** y se diseña para desktop web. En pantalla chica el compromiso no es adaptar ni rediseñar: es **contener**. No se promete una buena experiencia en pantalla chica; se promete que **no se rompe**. Esta distinción es deliberada y acota el trabajo: nada se rediseña para mobile.

### El breakpoint — un solo umbral nombrado

El sistema tiene **un único breakpoint**: `--bp-wide` = **941px**. Es la frontera entre las dos disposiciones del layout:

- **Amplio** (`min-width: 941px`, `≥ --bp-wide`): disposición desktop plena — grillas multicolumna, login a 2 columnas. (Las **flechas laterales de `PeriodNav`** ya **no** aparecen en este umbral: tienen su propio umbral derivado `--bp-arrows` = 1288px, el ancho al que entran con sus 20px de aire sin solapar el listado — ver § Contención responsive → *Umbral de flechas*.)
- **Compacto** (`max-width: 940px`, `< --bp-wide`): grillas colapsan a 1 columna; login a 1 columna; flechas laterales de `PeriodNav` ocultas (stepper compacto en el header). **El sidebar ya no depende de este umbral:** su presencia la controla el usuario en cualquier ancho, no el breakpoint (ver §Sidebar — mostrar/ocultar). **Regla de resumen-primero:** cuando una grilla de resumen colapsa al stack de 1 columna, la tarjeta más importante lidera el stack aunque en amplio ocupe otra posición. En las stat-cards de `/mes` (Gastos · Ingresos · Balance) el **Balance** —el resultado neto, el dato que el usuario busca primero— se reordena al tope en compacto (`order-first`), mientras que en amplio conserva su columna hero a la derecha (`1.1fr`). Es reordenamiento visual sobre tarjetas no interactivas: no afecta foco ni orden de lectura de contenido relevante.

No existe escala de breakpoints (`sm`/`md`/`lg`) ni config de `screens`: hay un solo umbral **de layout general** y se lo nombra `--bp-wide`. Cualquier media query nueva usa este umbral (o lo justifica explícitamente si necesita otro). La **única excepción justificada** es `--bp-arrows` (1288px), umbral **derivado de la geometría** (cap 1120 + 2×84) que gobierna exclusivamente el régimen de `PeriodNav` (flechas + header grande vs. stepper); no es un breakpoint de layout sino la anchura mínima a la que las flechas overlay entran sin solapar el contenido (ver § Contención responsive → *Umbral de flechas*). Los valores sueltos `lg:`/`md:`/`sm:` que aún aparecen en el código son deuda, no escala vigente.

El umbral está **materializado en el código** como `--breakpoint-wide: 941px` dentro de `@theme` (Tailwind v4) en `frontend/src/app/globals.css`. Eso habilita las variantes `wide:` (`width ≥ 941px`) y `max-wide:` (`width < 941px`), complemento exacto. El número **no se repite** en ningún `.tsx`: la disposición se decide con `wide:` / `max-wide:`, no con media queries a mano.

### Ancho mínimo soportado — 640px (`--bp-floor`)

La app **promete contención desde `640px` hacia arriba**. Por debajo de ese ancho no promete nada: no es un viewport soportado. Los cuatro invariantes rigen en todo ancho `≥ 640px`; el "sin scroll horizontal del `body`" (invariante 1) vale sobre ese piso, no de forma absoluta.

**Token del piso.** El piso se nombra `--bp-floor` = **640px**, materializado en el código como `--breakpoint-floor` dentro de `@theme` (Tailwind v4) en `frontend/src/app/globals.css`. Habilita las variantes `floor:` (`width ≥ 640px`) y `max-floor:` (`width < 640px`), complemento exacto que gobierna el gate. El número no se repite en ningún `.tsx`. **Antes era 768px; bajó a 640px** por decisión del usuario (el gate arranca recién bajo 640, y entre 640 y 768 la app debe estar contenida, no gateada).

El piso existe por una razón estructural, no por convención: el ancho mínimo de una columna `fr` de una grilla lo fija el **`min-content` de su contenido**, y en las stat-cards ese contenido es una **cifra de dinero**. Por eso una grilla de montos **no tiene un ancho mínimo fijo**: el ancho al que deja de entrar **depende de los datos del usuario** — cifras más largas rompen a viewports más anchos. Bajar el piso a `640px` **estrecha ese margen**: en la franja `640–768px`, y todavía más con el sidebar abierto (que le resta 248px al ancho de contenido), una cifra larga puede exceder el `min-content` de su card. La contención en ese caso **no se resuelve truncando el monto** (la cifra es el dato, nunca se corta): la card colapsa a 1 columna y, si aun así no entra, la superficie **scrollea dentro de sí misma** (invariante 4). El `body` nunca scrollea. Regla de diseño: al dimensionar una grilla de montos, no se asume un ancho mínimo fijo; se asume que lo fija el dato, y que el ancho disponible puede ser `viewport − 248px` cuando el sidebar está abierto.

### El gate — qué pasa por debajo del piso

Por debajo del ancho mínimo soportado (`< 640px`) no se contiene ni se adapta: se **gatea**. Una pantalla a viewport completo **impide usar la app** y le dice al usuario qué hacer (agrandar la ventana o usar una pantalla más grande). Cubre **toda la app, incluido el login**, y es un **bloqueo** sin escape: no hay "continuar igual". No genera scroll. La regla funcional, el alcance y el copy exacto son canónicos en `requirements.md`, RF-APP-002 — acá no se repiten. **El gate se decide por el ancho del viewport, no por el ancho de contenido:** que el sidebar esté abierto y estreche el contenido a menos de 640px **no** dispara el gate (el usuario puede cerrarlo para recuperar ancho).

Es **CSS puro**: la aparición y desaparición del gate se deciden con una media query sobre el ancho del viewport (`max-width: 639px`), no con JavaScript. Así, al cruzar el piso (rotar, redimensionar), la app aparece o desaparece **sin recargar ni parpadear**. Una solución con JS reintroduciría el parpadeo de hidratación y la recarga: por eso la condición es estructuralmente CSS, no una elección de estilo.

Visualmente el gate **reusa tokens y primitivas ya existentes** del design system (no introduce valores nuevos): superficie de fondo de la app (`paper`), tipografía UI del sistema, colores de texto `ink`/`muted`/`faint`, y el espaciado estándar. Es una pantalla de una sola columna centrada, jerarquizada en tres capas: **ícono monolínea** (ancla visual que declara "esto es intencional, no está roto"), **título** y **una línea de apoyo**, sin controles. El texto de apoyo es **agnóstico de dispositivo** (no asume desktop ni orientación) y **no expone el umbral en px** al usuario. Al cruzar el piso por rotación o redimensionado, la media query `max-floor` reevalúa el ancho del viewport y muestra/oculta el gate **en vivo, sin recarga ni parpadeo**: no hay manejo especial de rotación. Funciona idéntico en claro y oscuro (todos sus tokens son theme-aware).

### Los cuatro invariantes de contención

Todo lo que se diseña respeta estos cuatro invariantes en todo ancho **`≥ 640px`** (el ancho mínimo soportado), **en cualquiera de los dos estados del sidebar** (abierto o cerrado). Son verificables a ojo y material permanente del QA visual (no los detecta ni el build ni los tests):

1. **Sin scroll horizontal del `body`** en todo ancho `≥ 640px` (el ancho mínimo soportado), con el sidebar abierto o cerrado. Por debajo del piso la app no promete contención.
2. **Modales completos y scrolleables:** no cortados, no atrapantes — el usuario siempre puede ver el modal entero y salir de él.
3. **Ninguna acción inalcanzable:** ningún control queda fuera de pantalla ni tapado.
4. **Las superficies anchas scrollean dentro de sí mismas** (tablas, gráficos, filas anchas), sin romper el layout de la página.

### Ancho de contenido de página — llenar hasta el cap, después centrar

Regla transversal para el ancho del contenido en **todas** las pantallas del área autenticada (`/`, `/mes`, `/reportes`, `/configuracion` — este último aloja sus secciones General / Categorías / Métodos de pago / Límites bajo el mismo contenedor de ancho). Un solo comportamiento, idéntico en las cuatro:

- El contenido **llena el ancho disponible** del `<main>` menos el padding lateral de página (`px-10` = 40px por lado), **hasta un tope de 1120px**.
- Alcanzado 1120px, el contenido **capea y se centra**; el sobrante queda como margen exterior parejo a ambos lados. Este comportamiento por encima de 1120 es correcto y deseado — no se toca.
- **Nunca hay banda muerta al costado del contenido por debajo de 1120px.** Entre el piso soportado (640px) y 1120px el contenido **crece para ocupar el ancho**. Que el contenido quede angosto (a su `max-content`) y pegado a un lado, dejando media pantalla vacía, es un **defecto** — y arrastra síntomas (columnas aplastadas, nombres truncados a una letra en la lista de `/mes`).
- **El "ancho disponible" es el del `<main>`, no el del viewport.** Con el sidebar **abierto**, el `<main>` está corrido 248px y su ancho es `viewport − 248px`; con el sidebar **cerrado**, el `<main>` ocupa el viewport completo. El tope de 1120px y el centrado se miden **contra el ancho del `<main>`** (el ancho de contenido), no contra el viewport. Consecuencia: el contenido cabe en 1120 y se centra cuando el `<main>` supera 1120 + gutters, lo que ocurre a viewport ≈1160 con sidebar cerrado y a viewport ≈1408 con sidebar abierto. En ambos casos el comportamiento visual es el mismo; solo cambia el viewport al que se alcanza el cap, porque el offset del sidebar ahora es **toggle-driven, no breakpoint-driven**.
- **El régimen de disposición (compacto/amplio) también se decide por el ancho del `<main>`, no por el viewport.** El umbral `--bp-wide` (941px) que colapsa grillas a 1 columna debe evaluarse sobre el **ancho de contenido disponible** (`viewport − 248px` si el sidebar está abierto), no sobre el viewport crudo. Motivo: con el sidebar abierto a viewport 1000px el contenido mide ~712px; si el layout creyera "amplio" por el viewport, montaría grillas multicolumna en un hueco de 712px y desbordaría → scroll horizontal del `body` (rompe el invariante 1). El mecanismo natural es una **container query sobre `<main>`** en vez de una media query sobre el viewport; el mecanismo exacto lo resuelve `control-frontend`, pero el contrato es: **la disposición sigue al ancho de contenido, no al viewport.**
- **Flechas ‹ › de `PeriodNav` — overlay, NO gutters, y solo cuando entran limpias.** Son las flechas laterales del patrón de navegación de período. Aparecen **solo cuando el ancho de contenido es ≥ 1288px** (`--bp-arrows`; ver *Umbral de flechas* abajo), medido sobre `<main>` por **container query**, no por viewport. Por debajo se ocultan y el consumidor renderiza el stepper compacto en el header. Con el sidebar **cerrado** aparecen a viewport ≥1288; con el sidebar **abierto** recién a viewport ≈1536 (1288 + 248), porque hasta ahí el contenido no llega a 1288.
  - **No reservan ancho de columna.** Corrige el modelo anterior (grilla `auto min(…) auto` con dos gutters de 84px que le comían 168px al contenido y dejaban `/mes` más angosto que las otras tres pantallas al mismo viewport — defecto medido en el navegador). El bloque de contenido de `/mes` usa **exactamente el mismo mecanismo que el resto** (`px-10 max-w-[1120px] mx-auto`: llena hasta 1120, capea y centra) y por lo tanto tiene el **mismo ancho a igual viewport**. Las flechas son **overlay**: posicionadas en valor **absoluto respecto del bloque de contenido** y centradas verticalmente al viewport (sticky, sin cambios). Flanquean el bloque **desde afuera, sin empujarlo ni angostarlo**.
  - **Umbral de flechas — `--bp-arrows` = 1288px.** Es el ancho de `<main>` a partir del cual la flecha (64px) entra **entera en el margen exterior con sus 20px de aire completos**, sin tocar el bloque de contenido. Se deriva de la geometría, no es un breakpoint arbitrario: `1288 = 1120 (cap de contenido) + 2 × 84 (botón 64 + aire 20, por lado)`. **Convive con `--bp-wide` (941), no lo reemplaza.** Reparto de responsabilidades: `--bp-wide` (941) sigue gobernando el **colapso de grillas** (stat-cards 1↔3 columnas) — sin cambios; `--bp-arrows` (1288) gobierna el **régimen de `PeriodNav`** (flechas + header `.phead` grande vs. stepper compacto). Entre 941 y 1288 conviven **grillas multicolumna** (régimen amplio de grilla) con **header stepper y sin flechas** (régimen compacto de `PeriodNav`): son dos ejes independientes que antes compartían umbral por coincidencia.
  - **Posición horizontal de la flecha overlay (siempre limpia, nunca solapa):** como la flecha solo se muestra con `<main>` ≥ 1288, el margen exterior por lado es **siempre ≥ 84px** (botón 64 + 20 de aire). La flecha se ubica **entera en el margen exterior**, con **≥20px de aire** entre su borde interior y el borde del bloque, **sin invadir jamás** ni la banda de padding `px-10` ni el contenido. La fórmula de offset no cambia (`max(0px, calc((100% − 1120px) / 2 − 84px))`); lo único que cambia es que el gate de visibilidad sube a 1288, de modo que el tramo donde esa fórmula clampeaba a 0 y pegaba la flecha al borde de `<main>` (solapando el listado) **ya no muestra flechas** — las cede al stepper.
  - **Borde resuelto (reversa de la decisión anterior).** El modelo previo **toleraba** que en el tramo ~941–1288 la flecha flotara sobre la banda de padding y, en el piso, solapara ~24px sobre el filo del contenido (opción 1: "solapar, tolerado"). Esa tolerancia **queda revocada**: el usuario reportó el solape como defecto real (viewport ~955–1138, sidebar cerrado). Se elige ahora **no-solape estricto**: donde la flecha no entra con su aire completo, **cede paso al stepper compacto** (patrón ya existente y plenamente funcional), en vez de solapar (rechazado: es el defecto reportado) o reservar gutter (rechazado: reintroduce el angostamiento). Es la opción más consistente: reusa un estado ya diseñado, no inventa tratamiento visual nuevo, y garantiza que la flecha nunca toca el listado.
- **Mecanismo canónico de ancho (las cuatro páginas):** `px-10 max-w-[1120px] mx-auto` sobre un `div` de bloque. Un bloque con `max-width` **llena** el ancho disponible y solo capea al máximo. Las cuatro páginas lo usan para el **ancho de contenido**, incluida `/mes` (dentro de `PeriodNav`, el bloque central es este mismo patrón); las flechas de `/mes` se superponen encima como overlay, sin participar del cálculo de ancho.
- **Trampa retirada (grilla con gutters):** el modelo previo de `PeriodNav` como grilla `auto min(calc(100% − 168px), 1120px) auto` queda **descartado**. Causaba dos defectos medidos: (a) contenido de `/mes` 168px más angosto que las demás pantallas; (b) a ~785px la pista central colapsaba a ~0 y las stat-cards quedaban en slivers de ~40px. Ambos desaparecen con el modelo overlay: el ancho lo da el bloque canónico (nunca colapsa a `max-content`, nunca se angosta por las flechas) y las flechas dejan de tocar el layout de ancho. El mecanismo CSS exacto del overlay lo resuelve `control-frontend`.

### Obligación sobre los specs

**Todo spec de diseño declara el comportamiento en pantalla chica.** Es obligatorio: un spec sin la sección de contención (qué pasa en compacto, cómo se cumplen los cuatro invariantes en ese elemento) está incompleto. El comportamiento en compacto no es un extra opcional del spec — es parte de la definición del elemento.

### Franja de checkpoints — anchos de referencia (con el sidebar en juego)

Anchos concretos que el QA visual verifica a ojo. El **ancho de contenido** = `viewport − 248px` con el sidebar abierto, o `= viewport` con el sidebar cerrado. La disposición sigue al **ancho de contenido**, no al viewport.

| Viewport | Sidebar | Ancho de contenido | Disposición esperada |
|---|---|---|---|
| `< 640px` | — | — | **Gate** (bloqueo, sin app). No importa el estado del sidebar. |
| `640px` (piso) | cerrado | 640px | Compacto: grillas a 1 columna, sin flechas, stepper en header. Sin scroll del `body`. |
| `640px` (piso) | abierto | 392px | Compacto extremo: 1 columna. Los montos no se truncan; si una cifra no entra, su superficie scrollea dentro de sí (invariante 4). Sin scroll del `body`. |
| `~700px` | cerrado | 700px | Compacto, 1 columna. |
| `~700px` | abierto | ~452px | Compacto, 1 columna (mismo régimen que un viewport angosto). |
| `941px` | cerrado | 941px | **Umbral de grilla (`--bp-wide`):** grillas multicolumna (stat-cards 3 col). **Aún sin flechas** — header con **stepper compacto** (falta ancho para las flechas con aire). |
| `941px` | abierto | 693px | Sigue **compacto** en todo (el contenido no llega a 941): sin flechas, 1 columna, stepper. |
| `~1189px` | abierto | ~941px | Con el sidebar abierto recién acá aparece **multicolumna**; **todavía sin flechas** (stepper), el contenido no llega a 1288. |
| `~1160px` | cerrado | 1120px | El contenido alcanza el **cap de 1120px**: capea y se centra; aparece margen exterior parejo. Grillas multicolumna, **stepper, sin flechas** (banda intermedia 941–1288). |
| `1288px` | cerrado | 1288px | **Umbral de flechas (`--bp-arrows`):** aparecen las **flechas ‹ › overlay** con sus **20px de aire completos** (margen exterior = 84px exacto). Header pasa a `.phead` (título grande). Sin solape con el listado. |
| `~1408px` | abierto | 1120px | Con el sidebar abierto el cap se alcanza acá. Grillas multicolumna, **stepper, aún sin flechas** (contenido 1120 < 1288). |
| `1536px` | abierto | 1288px | Con el sidebar abierto recién acá el contenido llega a 1288: **aparecen las flechas** con aire completo. |

**Regla de lectura:** ninguna fila puede producir scroll horizontal del `body`, modal cortado, acción inalcanzable ni banda muerta por debajo del cap. Los checkpoints que más rompen históricamente son los de **sidebar abierto a ancho apretado** (640–941 viewport): ahí el contenido es angosto y el layout debe estar en régimen compacto, no amplio.

---

## Sidebar — mostrar/ocultar (chrome toggleable)

Implementa **RF-NAV-002**. El sidebar (`AppSidebar`, 248px) deja de auto-colapsar por breakpoint: es **chrome que el usuario muestra u oculta a voluntad en cualquier ancho** ≥640px. Un solo elemento, dos estados (**abierto** / **cerrado**). No hay drawer mobile aparte, no hay overlay, no hay rail de íconos. El estado persiste en la preferencia `sidebarOpen` (default **abierto**).

### Estado abierto (default)

- El sidebar es el de RF-NAV-001 tal cual: **248px de ancho, `fixed inset-y-0 left-0`, `bg-panel`, `border-r border-line`, `px-4 py-[22px]`**. Contenido sin cambios: logo, label "Menú", nav, spacer, CTA "Nuevo movimiento", fila de Tema, `UserMenu`.
- **Empuja el contenido:** el `<main>` está corrido `pl-[248px]`; su ancho es `viewport − 248px`. Confirmado — es el comportamiento actual, no cambia.
- **Control de colapsar (vive dentro del sidebar):** un botón **al extremo derecho de la fila del logo**, alineado con el gem (`items-center`, el logo a la izquierda, el botón `ml-auto`). No es un ítem de nav; es chrome del propio sidebar.
  - **Ícono:** `PanelLeftClose` (lucide), 18px, `strokeWidth` default. Comunica "plegar el panel lateral" mejor que un hamburguesa (que lee "abrir menú"). `aria-label="Ocultar menú"`, `aria-expanded="true"`.
  - **Caja:** botón `~32px` (`p-1.5`), `rounded-ctl`. Glifo en reposo `text-muted`.
  - **Estados:** hover `bg-panel-2` + glifo `text-ink`; active `bg-panel-3`; focus-visible `shadow-[0_0_0_3px_var(--accent-soft)]` (anillo DS); transición `duration-[140ms] motion-reduce:transition-none`. Mismo vocabulario que el resto de los controles de chrome.

### Estado cerrado

- El sidebar **desaparece por completo**: no queda rail de íconos ni franja. **Decisión deliberada:** un rail parcial obligaría a rediseñar una tercera variante del sidebar (¿dónde van la CTA, el Tema, el `UserMenu`?) y contradice el objetivo del cierre, que es **dar todo el ancho al contenido**. Un solo elemento con dos estados (presente/ausente) es más consistente y barato de mantener que tres.
- El `<main>` pasa a `pl-0`: el contenido ocupa el **ancho completo del viewport** (menos su `px-10` propio), respetando el mismo contrato de ancho de contenido (llena hasta 1120, después capea y centra).
- **Control de abrir (vive sobre el contenido):** como el sidebar ya no está, hace falta un affordance persistente para reabrirlo. Es un **botón flotante fijo arriba-izquierda** (`fixed top-4 left-4 z-40`), en la posición donde hoy vive el hamburguesa.
  - **Ícono:** `PanelLeft` (lucide), 20px. `aria-label="Mostrar menú"`, `aria-expanded="false"`.
  - **Caja como chip de chrome:** a diferencia del botón de colapsar (que vive sobre el `bg-panel` del sidebar), este flota **sobre contenido arbitrario de la página**, así que necesita cuerpo propio para leerse: `bg-panel`, `border border-line`, `rounded-ctl`, `shadow-[var(--shadow-sm)]`, caja `~40px` (`p-2.5`) para target táctil holgado (~44px con el área de toque). Glifo `text-ink-2` en reposo.
  - **Estados:** hover `bg-panel-2` + glifo `text-ink`; active `bg-panel-3`; focus-visible anillo `--accent-soft`; misma transición 140ms.
  - **No tapa la acción de la página:** el chip **manda** (es chrome persistente, no puede quedar tapado; invariante 3), así que **lo que se corre es el contenido, y se corre a nivel app** — ver "Banda reservada" abajo.

#### Banda reservada del chip flotante (sidebar cerrado)

**Regla:** con el sidebar **cerrado**, `<main>` reserva una **banda superior de 36px** (`padding-top: 36px`; con el sidebar **abierto** es `0`). Sumada al `py-[34px]` que aportan todas las pantallas de la app autenticada, **el primer píxel de contenido de página queda a 70px del borde superior del viewport**: 12px de aire por debajo del chip, que ocupa 58px de alto (`top-4` = 16px + caja de 42px = glifo 20 + `p-2.5` ×2 + borde 1px ×2).

- **Invariante:** *con el sidebar cerrado, ningún contenido de página se pinta por encima de los 70px superiores del viewport en el arranque de la pantalla.* Ese es el contrato; los 36px son su implementación dado el `py-[34px]` común. Si alguna pantalla cambiara su padding superior, se recalcula la banda para sostener el invariante — no se parchea la pantalla.
- **Por qué a nivel app y no por pantalla.** El chip flota en coordenadas de **viewport**; la colisión no depende de la pantalla sino del **ancho**: cuando el viewport baja de ~1200px el bloque de contenido deja de estar centrado y queda pegado a su `px-10` (x = 40px), justo debajo del chip (x = 16..58). Resolverlo pantalla por pantalla ya falló una vez: `/historial`, al no llevar eyebrow, quedó con la **"H" del H1 tapada** ("listorial"). Y no era un problema exclusivo de esa pantalla: con eyebrow el chip igual se come el arranque de esa primera línea a anchos apretados — solo que un rótulo de 12px muted parcialmente tapado no se nota, y un H1 sí. **El eyebrow nunca fue la protección: era una coincidencia que la disimulaba.**
- **Reserva vertical, nunca horizontal.** Correr el contenido a la derecha (más `padding-left`) desalinearía el header respecto del cuerpo de la página, rompería el centrado del cap de 1120px y —si se hiciera con `padding` sobre `<main>`— inflaría el `inline-size` que miden las container queries (ver la nota de `app-shell`: por eso el offset del sidebar es `margin-left` y no `padding-left`). La banda vertical no toca ninguno de los tres ejes.
- **Anima con el resto:** la banda entra y sale dentro de la **misma transición coordinada** del offset del sidebar (0.24s `cubic-bezier(0.4,0,0.2,1)`; instantánea con `prefers-reduced-motion`). Cerrar el sidebar es un solo movimiento: el contenido se corre a la izquierda y baja lo que ocupa el chip.
- **Alcance explícito:** la banda protege el **arranque** de la pantalla. Con scroll > 0 el chip sigue flotando sobre contenido arbitrario — es inherente a un chip fijo y **no** se resuelve acá.

> **Un control lógico, dos encarnaciones.** No hay dos botones simultáneos: cuando el sidebar está **abierto**, se ve solo el botón de **colapsar** (dentro del sidebar); cuando está **cerrado**, se ve solo el botón **flotante de abrir**. El hamburguesa/drawer anterior (`Menu` + overlay `wide:hidden`) **se retira**: ya no hay lógica por breakpoint.

### Borde crítico — sidebar abierto a ancho apretado: empuja, no overlay

Con el sidebar **abierto** a un viewport chico (ej. 700px → contenido ~452px), el sidebar **empuja y estrecha el contenido**; **nunca** pasa a overlay por encima del contenido. Razón: el overlay reintroduciría exactamente la variante mobile/drawer que este rework elimina, y rompería el modelo de "un elemento, dos estados" válido en todos los anchos. La consecuencia (contenido angosto a viewport chico con sidebar abierto) se absorbe con los mecanismos de contención ya definidos: **la disposición sigue al ancho de contenido** (colapsa a compacto/1-columna) y las superficies anchas **scrollean dentro de sí** (invariante 4). Es coherente con la filosofía de contención: no se promete buena experiencia a 452px, se promete que **no se rompe**. Si el usuario quiere más ancho, cierra el sidebar — es su decisión, no la del breakpoint.

### Transición de abrir/cerrar

- **Qué se mueve:** el sidebar se desliza horizontalmente (entra/sale por el borde izquierdo) y, **en sincronía**, el `<main>` reajusta su offset izquierdo (248→0 al cerrar, 0→248 al abrir). El contenido se reacomoda hacia la izquierda al cerrar y hacia la derecha al abrir, como un solo movimiento coordinado.
- **Duración y easing:** **0.24s** con `cubic-bezier(0.4, 0, 0.2, 1)` (ease-in-out estándar). Cae entre el modal `pop` (.22s) y la entrada de pantalla (.32s); es chrome, no una entrada dramática.
- **Sin fades de contenido:** el contenido de la página no hace fade; solo se reacomoda su posición/ancho. El sidebar puede acompañar su deslizamiento con un fade sutil de opacidad si ayuda al slide, pero no es requisito.
- **`prefers-reduced-motion`:** sin transición — el cambio de estado es instantáneo.

### Carga inicial sin flash

El estado inicial (`sidebarOpen`) viene de la preferencia del usuario (blob, server-rendered, igual que `theme`). **No debe haber flash de estado incorrecto al montar:** la app no puede pintar el sidebar abierto y luego cerrarlo (ni al revés) al hidratar. El primer paint ya refleja el `sidebarOpen` correcto. El mecanismo (render del estado inicial desde la preferencia provista por el servidor, sin salto de hidratación) lo resuelve `control-frontend`, análogo al anti-FOUC del modo de color. Es un requisito de **comportamiento visual**, no una sugerencia.

---

## Paleta de colores para categorías

El usuario **elige y edita** el color de una categoría —tanto al crear como al editar— desde una **matriz de colores tipo Office** (sin entrada de hex libre). El pool de asignación automática de `backend/src/categories/color-pool.ts` es **el subset base identificable de la matriz** (la fila media L3).

### Regla dura

El color de categoría es **solo un identificador de categoría** (swatch en la lista, bandas del apilado de la Forma 2 del gráfico, swatch en leyendas). **Nunca** tiñe un monto ni comunica ingreso/gasto — eso lo hacen income/expense (regla dura 1). La matriz está construida para **no chocar** con los semánticos ni con la marca: ningún hex de la matriz es el verde income (`#1F8A5B`), el rojo expense (`#C64637`) ni el índigo de acento (`~#5B57C2`).

### Regla de diseño rectora — máxima separación perceptual

La única regla dura de esta paleta: **dos categorías nunca deben confundirse de un vistazo.** Se prioriza **distinguibilidad sobre cantidad**. De ahí las tres decisiones estructurales:

1. **8 hues categóricamente distintos.** Cada columna es un color con **nombre propio inequívoco**: rojo, naranja, oro, verde, teal, azul, violeta, magenta — repartidos alrededor de la rueda sin dos adyacentes parecidos, sin hues "barrosos" que colapsen con un vecino.
2. **Chroma alto y parejo en la fila base.** Ningún color base es la "versión desaturada" de otro; todos son vívidos, así la distinción es por **hue**, no por sutilezas de saturación.
3. **5 tonalidades con saltos grandes.** Los pasos de claridad son amplios (~0.13–0.15 L de OKLCH entre filas) para que aun dentro de una misma columna dos tonos se lean claramente distintos.

### La matriz — fuente de verdad compartida (8 hues × 5 tonalidades)

La matriz es la **única fuente de verdad** del set de colores elegibles: el backend la usa para **validar** que el color recibido pertenezca a la matriz, y el frontend para **renderizar** el picker. Cualquier hex fuera de esta lista es inválido.

- **Estructura:** 5 **filas** (L1 = más clara, arriba → L5 = más oscura, abajo) × 8 **columnas** (un hue por columna). **Total: 40 swatches.**
- **Orden de columnas (espectral, izq→der):** C1 rojo, C2 naranja, C3 oro, C4 verde, C5 teal, C6 azul, C7 violeta, C8 magenta.
- **Fila base = subset de asignación:** la fila **L3** (fila media, la vívida) es el **subset base** que usa el backend para el "menos usado". Es la fila dominante del picker. Todos los hex son explícitos abajo (no se derivan en runtime: esta tabla **es** la fuente).
- **Cálculo del "menos usado" (default al crear):** se mantiene la mecánica de hoy — sobre los **8 colores base de la fila L3** (no sobre los 40). El sistema preselecciona el color base menos usado entre las categorías activas; en empate, el primero del **orden de asignación** (ver abajo); el usuario puede cambiarlo a cualquiera de los 40.

**Matriz de hex (filas L1→L5 de claro a oscuro; L3 es el subset base, resaltada):**

| Fila | C1 rojo | C2 naranja | C3 oro | C4 verde | C5 teal | C6 azul | C7 violeta | C8 magenta |
|---|---|---|---|---|---|---|---|---|
| **L1** | `#F7C8C8` | `#F9DDC8` | `#F7EBC5` | `#C6E6D1` | `#BFE6E9` | `#C8DBF6` | `#DFCEF3` | `#F4CCE4` |
| **L2** | `#EE8D8D` | `#F2B98D` | `#EFD686` | `#8ACB9F` | `#7ACBD1` | `#8DB4ED` | `#BC99E6` | `#E996C7` |
| **L3** | `#E23B3B` | `#E8863A` | `#E3B92E` | `#35A65A` | `#1AA5B0` | `#3B7DE0` | `#8B4FD4` | `#D94A9E` |
| **L4** | `#9E2929` | `#A25E29` | `#9F8220` | `#25743F` | `#12747B` | `#29589D` | `#613794` | `#98346F` |
| **L5** | `#6C1C1C` | `#6F401C` | `#6D5916` | `#19502B` | `#0C4F54` | `#1C3C6C` | `#432666` | `#68244C` |

**Lista canónica ordenada (orden flat para el picker) — recorrido por filas, de L1 a L5, cada fila C1→C8:**

```
L1: #F7C8C8 #F9DDC8 #F7EBC5 #C6E6D1 #BFE6E9 #C8DBF6 #DFCEF3 #F4CCE4
L2: #EE8D8D #F2B98D #EFD686 #8ACB9F #7ACBD1 #8DB4ED #BC99E6 #E996C7
L3: #E23B3B #E8863A #E3B92E #35A65A #1AA5B0 #3B7DE0 #8B4FD4 #D94A9E   ← subset base
L4: #9E2929 #A25E29 #9F8220 #25743F #12747B #29589D #613794 #98346F
L5: #6C1C1C #6F401C #6D5916 #19502B #0C4F54 #1C3C6C #432666 #68244C
```

### Subset base (pool de asignación automática) — orden explícito

El subset base son los **8 hex de la fila L3**. Su **orden de asignación** (el que rompe empates: "en empate, el primero") **no** es el orden espectral de la columna, sino un **orden que salta por la rueda** para que las **primeras** categorías creadas queden lo más separadas posible entre sí (la 1ª y la 2ª casi opuestas, la 3ª/4ª formando triada, etc.). Este orden es `[0,4,2,6,1,5,3,7]` sobre las columnas espectrales:

| # | Hue | Hex |
|---|---|---|
| 1 | rojo | `#E23B3B` |
| 2 | teal | `#1AA5B0` |
| 3 | oro | `#E3B92E` |
| 4 | violeta | `#8B4FD4` |
| 5 | naranja | `#E8863A` |
| 6 | azul | `#3B7DE0` |
| 7 | verde | `#35A65A` |
| 8 | magenta | `#D94A9E` |

**Pool en orden de asignación (lista canónica para `color-pool.ts` / `CATEGORY_BASE_COLORS`):**

```
#E23B3B #1AA5B0 #E3B92E #8B4FD4 #E8863A #3B7DE0 #35A65A #D94A9E
```

> Nota de estructura para implementación: como el orden de asignación **difiere** del orden flat de la fila L3 en la matriz, el subset base se define como un **array explícito** (no como un `slice` posicional de la lista flat). El orden flat de la matriz (espectral) es para **pintar el grid**; el orden del pool (salteado) es para **asignar**.

### Picker — geometría del grid

- **Columnas del grid del picker: 8.** El picker (`category-form-modal.tsx`) renderiza la lista flat en `grid-template-columns: repeat(8, 1fr)`.
- **Orden de render:** la lista flat canónica de arriba (L1→L5, cada fila C1→C8). Con 8 columnas, cada fila del CSS grid coincide exactamente con una tonalidad (L1 arriba … L5 abajo), reproduciendo el patrón "una familia por columna, un tono por fila".
- El resto del picker (ring de selección neutro `--ink`, hover scale, botón Aleatorio, hairline de contorno en oscuro) **no cambia**.

### Notas de construcción y comportamiento

- **Familia por columna:** cada columna mantiene el **hue** de su color base L3; lo que varía por fila es la claridad (L1–L2 son tintes claros/pastel, aptos como fondo de chip; L4–L5 son sombras profundas, con buen contraste sobre panel blanco). Ninguna fila implica semántica: todas se usan **igual** como identificador de categoría.
- **Separación garantizada en el subset base:** los 8 hues de L3 están repartidos alrededor de la rueda sin dos adyacentes confundibles; combinados con el orden de asignación salteado, las categorías auto-pinteadas nacen ya bien separadas.
- **Ambos modos (regla dura 4):** los hex no cambian entre claro y oscuro. Sobre panel oscuro, las filas oscuras (L4–L5) se apoyan en el **hairline de contorno obligatorio** del swatch (ya definido en *Categorías y gráficos en oscuro*). Los tintes L1–L2 contrastan bien sobre panel oscuro; el texto sobre un chip pintado se calcula por contraste contra el hex, independiente del modo.
- **Fuera de semánticos y marca por construcción:** ningún hex es el verde income, el rojo expense ni el índigo de acento. El rojo de categoría (`#E23B3B`) es un rojo vívido y saturado, distinto del brick apagado del expense (`#C64637`); el verde (`#35A65A`) es un verde grama, distinto del verde teal del income (`#1F8A5B`); el azul (`#3B7DE0`) y el violeta (`#8B4FD4`) son distintos del índigo azul-violeta de marca.

---

## Métodos de pago — identificador de ícono

Feature P4. Un método de pago tiene **nombre**, **tipo** (Crédito / Débito / Efectivo) e **identificador visual = un ícono** elegido por el usuario. La sección **Métodos de pago** (`/configuracion/metodos-pago`) y su modal crear/editar son **espejo 1:1 de Categorías** (`/configuracion/categorias`) en chrome, layout, estados, validaciones, empty y confirmación de borrado; lo único propio de esta feature es que **la identidad visual es un ÍCONO, no un color**. Todo lo que sigue define ese ícono (el set, cómo se elige, cómo se renderiza); el resto reusa el patrón de Categorías sin cambios.

### Campos del modal según tipo

El modal crear/editar (espejo de Categorías) lleva **siempre**: **Nombre**, **Tipo** (triple switch Crédito / Débito / Efectivo) e **Ícono** (icon-picker de abajo). Los **campos condicionales dependen del tipo** y se muestran/ocultan **en vivo** al cambiar el switch, cada uno como un **bloque del form** (`Label` arriba + control, ritmo `space-y-[14px]`):

- **Crédito:** suma **día de cierre** y **día de cobro** (dos controles del DS para día del mes). Es lo único propio del crédito.
- **Débito:** **sin campos condicionales** — el modal del método débito es **idéntico en cromo al de efectivo** (solo Nombre + Tipo + Ícono). El atributo "débito automático" **no vive acá**: es un flag del **movimiento**, no del método (ver *Débito automático — control condicional en el form de carga*).
- **Efectivo:** sin campos condicionales.

(Qué campos exactos y sus validaciones funcionales los define el analista; acá se fija el **cromo y la visibilidad condicional**.)

### Regla dura y decisión de color — SIN campo de color

- **El ícono es la única identidad visual del método. NO existe campo de color.** A diferencia de Categorías (donde el **color** es la identidad), acá el ícono **reemplaza** al color; no se agrega un segundo eje cromático. El modelo lleva solo `icon` (string, allowlist), sin `color`.
- **Los íconos se renderizan monocromos, en tinta neutra** (`--ink-2` en reposo; `--ink` en selección/hover). **Nunca** en color semántico, **nunca** en índigo de marca (salvo el focus ring del control). Motivos:
  1. **Regla dura 1** — verde/rojo están reservados estrictamente a ingreso/gasto. Un ícono de método en verde o rojo (Mastercard, Santander, Naranja, muchos bancos) colisionaría con la semántica de montos, sobre todo pegado a un monto en una fila de `/mes`.
  2. **Regla dura 2** — el índigo es solo marca; no tiñe estos glifos.
  3. **Regla dura 4** — la tinta neutra se resuelve por token en claro y oscuro sin calibrar un color por cada marca.
  Las marcas se reconocen por su **silueta / wordmark** (VISA, AMEX, los dos aros de Mastercard, el apretón de Mercado Pago), no por su color corporativo.
- **Diferenciación entre métodos = ícono + nombre + tipo** (igual que en Categorías la diferenciación es color + nombre). No hace falta color adicional: los genéricos son **glifos distintos entre sí** ($ · tarjeta · billete · monedas · banco · billetera · QR) y las marcas son reconocibles por forma. Dos métodos con el mismo ícono se distinguen por su **nombre**, mismo criterio que dos categorías con el mismo color.

### Set curado de íconos — allowlist v1 (`PAYMENT_METHOD_ICONS`)

Fuente doble:

- **Genéricos → `lucide-react`** (ya instalado en el stack). Glifos outline (stroke).
- **Marcas → `simple-icons`** (glifos de una sola *path*, `fill: currentColor`, ideales para monocromo). **No está instalado hoy** (el stack solo tiene `lucide-react`): sumarlo es una **dependencia nueva del frontend**, y el catálogo exacto debe **verificarse en la versión que se fije**. Toda marca del set cuyo slug **no exista** en la versión instalada **cae al genérico `card`** (fallback duro).

El backend guarda la **clave** en el campo `icon` (string) con **allowlist en código**, mismo criterio que el pool de colores de categorías (hoy duplicado back/front). Lista canónica v1:

**Genéricos (lucide):**

| Clave | Glifo lucide | Rol |
|---|---|---|
| `card` | `CreditCard` | tarjeta genérica — **default al crear** y **fallback** de marca ausente |
| `cash` | `Banknote` | efectivo / billete |
| `coins` | `Coins` | efectivo / monedas |
| `wallet` | `Wallet` | billetera / billetera digital |
| `bank` | `Landmark` | banco / transferencia bancaria |
| `dollar` | `CircleDollarSign` | dinero genérico (`$`) |
| `qr` | `QrCode` | pago con QR / transferencia |

**Marcas (simple-icons; slug entre paréntesis, verificar al instalar):**

| Clave | Slug simple-icons | Marca |
|---|---|---|
| `visa` | `visa` | Visa |
| `mastercard` | `mastercard` | Mastercard |
| `amex` | `americanexpress` | American Express |
| `mercadopago` | `mercadopago` | Mercado Pago |
| `paypal` | `paypal` | PayPal |

Total set v1: **12 claves** (7 genéricas + 5 marcas).

**Marcas comunes en Argentina que NO están disponibles como marca y caen a genérico:** Ualá, Naranja X, Brubank, Personal Pay, MODO, Cuenta DNI, Cabal y los bancos locales (Galicia, Nación, Provincia, etc.) **no están en simple-icons** → el usuario elige un genérico (típicamente `card`, `wallet`, `bank` o `qr`). Santander / BBVA, aun si estuvieran en la versión instalada, **quedan fuera del set v1** para mantenerlo acotado (se los cubre con un genérico). Cualquier ampliación futura del set = **nueva clave en la allowlist back/front**.

### Default y ausencia de "Aleatorio"

- **Default al crear:** `card`. No hay algoritmo de "menos usado" como en el color de categoría: el color se autoasigna para **separar perceptualmente**, pero el ícono debe **describir el método real**, así que un default fijo y neutro (tarjeta) es lo correcto; el usuario lo cambia.
- **Sin botón "Aleatorio".** Ruptura deliberada del espejo con el color-picker: el color es identidad puramente estética (aleatorizar es válido), pero el ícono **carga significado** (debe coincidir con el método real); un ícono al azar daría una identidad engañosa. El icon-picker **no** incluye el `Shuffle`.

### Icon-picker en el modal de método — espejo del color-picker

Vive en el mismo slot que el picker de color en el modal de categoría. Reusa la geometría y los estados del *Picker de color de categoría (matriz de swatches)*, cambiando el swatch de color por una **celda de ícono**:

- **Grid:** `grid-template-columns: repeat(6, 1fr)`, gap 6px. Orden de render: primero los **genéricos** en el orden de la tabla, luego las **marcas** (12 íconos → 2 filas).
- **Celda:** cuadrada `aspect-ratio: 1`, radio `--r-ctl` 10px (un paso mayor que el `--r-chip` del swatch de color, porque contiene un glifo y no un fill pleno). Reposo: fondo `--panel-3`, glifo **20px** centrado en `--ink-2`.
- **Estados** (mismos que el swatch de color): *hover* = `scale(1.12)` + `--shadow-sm`, borde `--line-strong`, glifo → `--ink`, 0.14s. *Seleccionada* = anillo **neutro** `box-shadow: 0 0 0 2px var(--panel), 0 0 0 4px var(--ink)` (ring `--ink`, no acento — regla dura 2) + glifo `--ink`. *Focus* = ring `--accent-soft` 3px.
- **Fill vs stroke:** las marcas (simple-icons) son glifos rellenos y los genéricos (lucide) son outline; conviven en la misma grilla a **igual caja (20px)** y **misma tinta neutra**. La diferencia de peso relleno/contorno es aceptable y hasta ayuda a leer "marca vs genérico"; no se normaliza.
- **Oscuro:** la celda `--panel-3` y el glifo (`currentColor`) se resuelven por token; el **hairline de contorno** `--line` en la celda es **obligatorio en oscuro** (mismo recurso que el swatch de color), para que la celda se lea como ficha sobre panel oscuro.

### Render del ícono en la lista de `/configuracion/metodos-pago`

Espejo del ítem de la lista de categorías (swatch + nombre + scope + "N movimientos"), con el color-swatch reemplazado por una **tile de ícono**:

- **Tile de ícono** (izquierda, en el slot del swatch de color): cuadrada ~**34px**, radio `--r-ctl`, fondo `--panel-3`, borde `--line` (hairline; obligatorio en oscuro), glifo **18px** centrado en `--ink-2`. Es la analogía directa del swatch: en categorías el cuadrado **es** el color; acá el cuadrado neutro **sostiene** el glifo (la identidad).
- **Nombre:** rol *Nombre de movimiento* (14.5px / 600 `--ink`), igual que el nombre de categoría.
- **Tipo (Crédito / Débito / Efectivo):** **chip neutro** del DS (`--panel-3` / `--muted` / `--r-chip` 7px / 11px·600·`.04em`), en el slot del badge de scope. **Neutro, no semántico ni índigo** — el tipo de método no comunica ingreso/gasto ni marca; es metadato. (Difiere del badge de scope "Ambos" de categorías, que va en índigo por ser marca: acá no hay caso "marca".)
- **"N movimientos"** (si la pantalla lo lleva — dato funcional del analista): mismo contador derivado de solo lectura que en categorías (mono tabular, `--muted`), a la derecha de la fila.
- **Orden de la fila** (espejo de categorías): `[tile ícono] [nombre] [chip tipo] … [N movimientos]`.

### Render del ícono en el selector de método del form de carga

El form de movimiento (tabs Único / Fijo / Cuota) suma un **selector de método de pago opcional**. **Ubicación:** vive **dentro del disclosure "Más opciones"** del form, como **segundo sub-bloque** (tras moneda+cotización) — ver *Disclosure "Más opciones" del form*. Su cromo:

- **Control:** `Select` del DS (mismo molde que el selector de categoría), **opcional**, con opción **"(ninguno)"** y **default = ninguno / vacío**.
- **Trigger (con método elegido):** glifo del método **16px** `--ink-2` (`shrink-0`) + nombre (`--ink`) + chip de tipo neutro chico (opcional; si el ancho aprieta, el tipo se omite en el trigger y queda solo ícono + nombre).
- **Trigger (ninguno):** placeholder **"Sin método de pago"** en `--faint`, sin glifo. **No es error**: el campo es opcional.
- **Opciones del menú:** cada fila = glifo 16px `--ink-2` + nombre `--ink` + chip de tipo neutro a la derecha. La opción **"Sin método de pago"** ("(ninguno)") encabeza la lista, sin glifo.
- **Sin botón "+ Nueva" análogo al de categoría** salvo que el analista lo defina funcionalmente: categorías lo tiene por RF-MU-004; para método de pago no hay un RF equivalente cerrado, así que **no se asume** acá. Si se define, reusaría el mismo patrón.
- **Oscuro:** glifos (`currentColor`), chips y `Select` por token; sin tratamiento especial más allá del hairline ya definido.

### Débito automático — control condicional en el form de carga

Cuando el **método de pago seleccionado es de tipo Débito**, el form de movimiento muestra un **checkbox "Débito automático"** para ese movimiento puntual. Es un **atributo del movimiento**, no del método.

- **Visibilidad condicional:** el control se **renderiza solo** si hay un método elegido y su tipo es **Débito**. Si no hay método (`"Sin método de pago"`) o el tipo es **Crédito / Efectivo**, el checkbox **no se muestra** (se desmonta; no queda deshabilitado ni atenuado). Al cambiar el método a uno no-débito el control desaparece. (El manejo del valor al ocultarse es funcional — analista.)
- **Ubicación:** **inmediatamente debajo** del selector de método de pago, como continuación del mismo sub-bloque —lo **modula**, mismo patrón que la cotización modula a la moneda—, **dentro del disclosure "Más opciones"** del form (el checkbox acompaña al selector ahí; ver *Disclosure "Más opciones" del form*). Sigue el ritmo interno del sub-bloque (`space-y-[14px]`).
- **Control:** **checkbox del DS** (el mismo del `CategoryFilterPopover`), en fila **`flex items-center gap-[9px]`** con el label a la derecha: casilla + **"Débito automático"** (registro UI 13px/500 `--ink-2`). **No lleva `Label` arriba** (la etiqueta va a la derecha de la casilla, como es propio del checkbox); admite un **field-note** opcional si el analista define copy de ayuda.
- **Estados:**
  - **Desmarcado (default):** casilla `--panel` / borde `--line`; al mostrarse arranca **desmarcado**.
  - **Marcado:** casilla rellena con el **check del DS** (fill de acento como **cromo de interacción** del control — misma licencia que el focus ring y el thumb del segmented; **no** es color de monto ni decoración de marca).
  - **Hover:** borde `--line-strong`.
  - **Focus:** ring `--accent-soft` 3px (focus ring del DS).
- **Neutralidad semántica:** el control **no** usa verde/rojo (no comunica ingreso/gasto) ni tiñe cifras; el único índigo es el del check/focus (interacción). Es el **único** campo condicional por tipo de método en el form; no se agregan otros.

### Débito automático — indicador en la card de detalle

> **Actualizado (Card de detalle):** el débito automático ya **no** se indica en la fila de `/mes` (se retiró el glifo `Zap` de la zona de estados). Ahora es una **fila de la ficha de la card de detalle** ("Débito automático · Sí", solo si `autoDebit === true`) — ver *Card de detalle de movimiento*. Lo de abajo describe el lenguaje del glifo, que se **reusa dentro de la card** (mismo `Zap` 14px `--muted` + rótulo), no en la fila.

Un movimiento con **débito automático** (`autoDebit === true`) lleva una señal **discreta y neutra** con el glifo `Zap` (lucide, `--muted`), reusado en la card de detalle:

- **Forma:** **glifo solo, sin texto** — `Zap` (lucide, 13px, `--muted`, el svg `aria-hidden`). **Pierde** el label visible "Débito automático": el significado lo cargan `aria-label` + `title` nativo **"Débito automático"** en el wrapper del glifo. Es un glifo del cluster de estados, no un segmento de texto de la identidad.
- **Ubicación:** **zona de estados** (derecha, `shrink-0`), como **segundo** glifo del cluster, después del glifo de padre (`GitBranch`) si está. `gap-[8px]` entre glifos del cluster; la zona de estados se separa de la identidad por `gap-[10px]` o un hairline vertical `--hair`.
- **Neutralidad:** **nunca** semántico (no es ingreso/gasto) ni índigo (no es marca) — es metadato del movimiento.
- **Condicional:** solo aparece si el flag es `true`; si es `false`, no ocupa lugar.
- **Bajo anulado:** hereda la atenuación `opacity: 0.55` de la fila como el resto del contenido.

### Predeterminado por estructura — configuración en el modal + indicador de solo-lectura en la fila de `/configuracion/metodos-pago`

Feature "Método de pago predeterminado por estructura". Cada método puede marcarse como **predeterminado** para una o varias de las tres **estructuras** de movimiento (**Únicos / Fijos / Cuotas**), con **exclusividad por estructura**: una estructura tiene a lo sumo un método (asignarla a uno se la quita a cualquier otro). El default **prellena** el selector de método al **crear un movimiento de esa estructura** — aplica a **egreso e ingreso** por igual — y sigue **editable** en el form de carga. Es prefill, no restricción.

> **Corrección de copy vigente (reemplaza al lenguaje anterior).** El default es por **estructura**, no por "tipo de gasto". **Prohibido** el término "gastos" en esta superficie: prellena movimientos de ambas polaridades. Header/subtítulo neutros (abajo). Las etiquetas de estructura son "Únicos" / "Fijos" / "Cuotas" (plural, consistente con los group headers de `/mes`).

**Decisión de alojamiento — la edición vive en el modal de crear/editar método; la fila es solo-lectura.** (Reemplaza el patrón anterior de celda-disparador + popover en la fila, que se **elimina**.) El default es una **propiedad de configuración del método**, no una acción de escaneo rápido sobre la lista: pertenece al mismo lugar donde se define nombre/tipo/ícono. Ventajas frente al popover-en-fila: (a) una sola superficie de edición del método (menos afordancias sueltas, menos carga cognitiva sobre la fila); (b) la fila queda limpia y legible como *inventario* (identidad + estado), sin controles activos que compitan con el kebab; (c) crear y editar comparten exactamente el mismo control. La fila conserva el **lenguaje visual del estado** (estrella + pills) pero **sin afordancia de edición** — para cambiarlo, se abre *Editar*.

**Star = default (lenguaje unificado, se mantiene).** El glifo `Star` (lucide) relleno `--accent` marca "predeterminado". El acento acá es **cromo de UI/estado, no monto** (misma licencia que el punto del filtro, el thumb del segmented y el check del checkbox; regla dura 2 intacta — no hay cifras en esta pantalla). Se distingue del **chip de tipo neutro** (Crédito/Débito/Efectivo, `--panel-3`/`--muted`) por color, posición y por el prefijo estrella.

#### Sección "Predeterminado para" dentro del modal (`PaymentMethodFormModal`)

**Ubicación.** **Última sección** del cuerpo del form, **después del Icon-picker**, precedida por un **divisor `--hair` full-width** (con `pt`/`mt` de aire). Racional de jerarquía: Nombre/Tipo/Ícono definen **qué es** el método (identidad); esta sección define **cómo se usa** (comportamiento de prefill) — se lee como grupo distinto, subordinado a la identidad, sin interrumpir el flujo de alta. Aplica **igual en crear y en editar**, y para **cualquier tipo** de método (independiente de Crédito/Débito/Efectivo).

- **Label de sección:** "Predeterminado para" — mismo molde que los labels del modal (12.5px / 600 `--ink-2`, `tracking-[0.01em]`), **sin** marca `required` (es opcional).
- **Ayuda:** debajo del label, 12px `--muted`: **"Se prellena al crear un movimiento de esta estructura. Podés cambiarlo al cargar."** Sin la palabra "gastos"; neutro respecto de egreso/ingreso.
- **Tres filas de checkbox**, una por estructura, **orden fijo Únicos → Fijos → Cuotas**, reusando el **checkbox del DS** (el mismo de `CategoryFilterPopover` / débito automático — cuadro `--line`/`--panel` destildado, fill `--accent` + check blanco tildado). Cada fila: `flex items-center gap-[9px]`, `py-[7px]`, toda la fila clickeable (`role="checkbox"`, `aria-checked`, tabbable, Space/Enter): checkbox + **label de estructura** (13px / 500 `--ink`) + a la derecha `flex-1 text-right truncate` la **nota de titular** (abajo). Hover de fila `--panel-2`; focus ring `--accent-soft` 3px.
  - **Tildado** = este método será/es default de esa estructura.
  - **Estados del checkbox:** destildado `--panel`/`--line`; tildado fill `--accent` + check; hover borde `--line-strong`; focus ring `--accent-soft` 3px.
- **Neutralidad de color:** el único color de la sección es el acento del check (interacción). **No** verde/rojo (no comunica ingreso/gasto), **no** tiñe nada como monto.

**Exclusividad — feedback preventivo dentro del modal.** Junto a cada estructura que **hoy tiene OTRO método**, nota **"Hoy: {OtroMétodo}"** (12px `--muted`, `truncate`, alineada a la derecha de la fila). Declara a quién se le va a quitar **antes** de tildar (misma idea que la nota del popover anterior, ahora en el modal). Reglas: estructura tomada por otro → nota + (destildada, salvo que el usuario la tilde en esta sesión); estructura del propio método (editar) → tildada, **sin** nota; estructura libre → destildada, sin nota.

**Modelo mental del CREAR (método sin `id` todavía).** En creación los checkboxes marcan **intención**: la sección se ve y se opera **idéntica** a editar (mismo divisor, mismo control, dentro del mismo form y footer "Crear método de pago" → queda claro que es **parte del alta**, no un paso aparte). Al abrir en modo crear, los tres arrancan **destildados** (el método aún no es default de nada); la nota "Hoy:" funciona igual contra los defaults vigentes. La **asignación con exclusividad se aplica al guardar**, cuando el método ya tiene `id`. En editar, arrancan reflejando el estado actual.

**Comunicación de la reasignación al guardar.** La exclusividad se resuelve **al guardar el modal** (no en vivo por cada tilde, porque en crear no hay `id` y para consistencia también en editar). Feedback:
1. **Preventivo:** la nota "Hoy: {Otro}" en la sección (antes de guardar).
2. **Confirmación al guardar OK:** se mantiene el toast `success` de CRUD ("Método de pago {creado/actualizado} correctamente."). **Además**, si al guardar el método **tomó ≥1 estructura que tenía otro titular**, un toast `info` consolidado: **"‘{Método}’ ahora es el predeterminado de {Estructuras}."** (`{Estructuras}` = lista separada por comas de las estructuras reasignadas, p. ej. "Únicos y Fijos"). Racional: cubre el caso de que la fila desplazada esté **fuera de viewport**; un solo toast info (no uno por estructura) evita el toast-storm. El toast de éxito confirma el guardado; el info confirma el desplazamiento. Sin displacement → solo el `success`.
3. **En la lista:** al cerrarse el modal, las filas se re-renderizan y las pills reflejan el nuevo reparto (invariante "una sola pill por estructura en toda la lista").

#### Indicador de solo-lectura en la fila

Reemplaza a la celda-botón + popover, que **se eliminan**. La columna "Predeterminado" (entre contador y kebab; grid de fila sin cambios: `34px 1fr auto auto auto auto`) pasa a ser un **indicador estático informativo**: **no** es `<button>`, **no** tiene `aria-haspopup`, **no** tiene hover-reveal de afordancia, **no** es foco de tab, **no** abre nada.

- **Método SIN defaults (la mayoría):** la celda **no renderiza contenido** → **cero impacto** (la fila se ve idéntica a una lista sin config, igual que hoy). Ya **no** aparece ninguna afordancia "Predeterminar" en hover.
- **Método CON ≥1 default:** **siempre visible**: `Star` **relleno 11px** `--accent` + una **pill por estructura** en orden fijo Únicos → Fijos → Cuotas. Pill: fondo `--accent-soft`, texto `--accent-ink`, `--r-chip`, **11px / 600**, `px-[7px] py-[2px]`, gap `4px`. **Sin** hover-bg, **sin** cursor pointer, **sin** ring de botón (no es interactivo).
- **Touch / ≤940px:** si hay >1 pill, colapsa a una sola pill **"Predet. ×N"** (`N` mono); el detalle se ve al abrir *Editar*.
- **Edición:** exclusivamente vía **kebab → "Editar"** (abre el modal, que trae la sección). El indicador no ofrece atajo de edición (evita afordancia ambigua sobre un elemento informativo).

**Accesibilidad.** El indicador de la fila es texto legible (pills con label) + estrella `aria-hidden`, envuelto con `aria-label`/`title` que enuncia el estado ("Predeterminado de: Únicos, Fijos"); **no** interactivo, fuera del orden de tab. Dentro del modal: checkboxes rotulados, nota "Hoy:" textual, foco visible, el estado nunca depende solo del color. Se mantiene una región `aria-live="polite"` (espejo textual del toast de reasignación) para el momento del guardado.

**Copy.** Label de sección: "Predeterminado para". Ayuda: "Se prellena al crear un movimiento de esta estructura. Podés cambiarlo al cargar." Labels/pills: "Únicos" / "Fijos" / "Cuotas". Nota de titular: "Hoy: {Método}". Toast de reasignación: "‘{Método}’ ahora es el predeterminado de {Estructuras}." **Nunca** "gasto/gastos" en esta superficie.

> Reutiliza: el checkbox del DS (*Débito automático* / filtros), el lenguaje `Star`=default + pill `--accent-soft`, el sistema de toasts, el chrome del modal (`PaymentMethodFormModal`). Cambia respecto de la versión anterior: la edición **migra de la fila al modal**; la fila pasa a **solo-lectura**; el copy deja de hablar de "gastos" y pasa a **estructura**; la exclusividad se resuelve **al guardar** (no por tilde en vivo).

#### Checklist de aceptación visual — predeterminado por estructura

- [ ] **Copy sin "gastos":** ni en el modal ni en la fila ni en toasts aparece la palabra "gasto/gastos"; la ayuda dice "…al crear un **movimiento** de esta estructura".
- [ ] **Sección en el modal:** al abrir crear o editar, después del Icon-picker hay un divisor `--hair` y la sección "Predeterminado para" con 3 checkboxes (Únicos/Fijos/Cuotas) + línea de ayuda.
- [ ] **Fila sin celda editable:** la fila **no** tiene botón "Predeterminar" ni popover; no aparece nada de eso en hover; la columna sólo muestra estrella + pills cuando el método es default.
- [ ] **Cero impacto sin config:** lista sin ningún default → filas idénticas a hoy, sin estrella ni pills ni afordancia.
- [ ] **Estado visible (solo-lectura):** un método default muestra `★` + pill(s) (`--accent-soft`/`--accent-ink`) **siempre**; el indicador no tiene hover-bg, no es foco de tab, no abre nada.
- [ ] **Una pill por estructura en toda la lista:** cada estructura (Únicos/Fijos/Cuotas) aparece como pill en **a lo sumo una** fila.
- [ ] **Nota de titular en el modal:** una estructura tomada por otro método muestra "Hoy: {Otro}"; la del propio método (editar), tildada sin nota; libre, destildada sin nota.
- [ ] **Crear = intención:** en el modal de creación los 3 checkboxes arrancan destildados; la sección se ve igual que en editar y vive dentro del mismo form/footer de alta.
- [ ] **Exclusividad al guardar:** tildar una estructura ya tomada y guardar → la pill de esa estructura pasa a este método y desaparece de la otra fila.
- [ ] **Toast de reasignación:** guardar con desplazamiento dispara toast `info` "‘{Método}’ ahora es el predeterminado de {Estructuras}", además del `success` de CRUD.
- [ ] **Neutralidad de color:** estrella/pills/check usan acento (UI), nunca verde/rojo; el chip de tipo sigue neutro y no se confunde con las pills.
- [ ] **Touch / ≤940px:** el indicador con >1 default colapsa a "Predet. ×N" (N mono); la edición se hace desde *Editar*.
- [ ] **Focus:** en el modal, filas de checkbox muestran ring `--accent-soft` 3px por teclado; el indicador de la fila no toma foco.

---

## Patrones de componentes vigentes

> Patrones de componente **reutilizables y vigentes**, parte del lenguaje visual del producto: el patrón canónico, sus valores clave y sus reglas.
>
> Los **gráficos** (Forma 1 — área de ingresos vs. gastos; Forma 2 — barras apiladas por categoría), con sus ejes, gridlines, leyenda, tooltip, altos de canvas y mapeos de color, se definen en *Gráficos — Forma 1 y Forma 2* (abajo). El encuadre que los rodea (cómo se montan en pantalla) vive en *Card de reporte*.

### Cierre de overlays — modales vs. popovers

Dos comportamientos de cierre, según el tipo de overlay:

- **Modales / diálogos** (transaction-modal, category-form-modal y los diálogos de confirmación de borrado — transaction / recurring / installment / category): se cierran **únicamente con el botón ✕ y con `Esc`**. El click en el scrim/backdrop **no** cierra. Son superficies que demandan una decisión explícita; no se descartan por click accidental afuera.
- **Popovers** (filtro de categorías, filtro de sección, menú de tipo de reporte): se cierran por **clic fuera / `Esc` / re-clic**. Son auxiliares y livianos; descartarlos al tocar fuera es lo esperado.

#### Posicionamiento de popovers/listbox por portal — flip vertical y comportamiento ante scroll

Todo overlay auxiliar que se monta **por portal a `document.body`** con `position: fixed` anclado a un disparador (los selectores custom tipo listbox — método de pago, categoría de límite, ancla de límite — y los popovers de filtro/menú) comparte **un único contrato de posicionamiento y scroll**. No se resuelve archivo por archivo: la referencia canónica ya cumplida es `reportes/page.tsx` (`calcPosition`) y `card-currency-select.tsx`; el resto se normaliza a ella. Constantes canónicas: **`POPOVER_GAP = 6px`** (separación disparador↔panel) y **`VIEWPORT_MARGIN = 12px`** (respiro mínimo a cualquier borde del viewport).

**1 · Anclaje y flip vertical (nunca fuera del viewport).** El panel se ancla al disparador y **elige lado según el espacio disponible**, no siempre hacia abajo:

- **Preferencia: abajo.** Si el panel entra por debajo (`alto + GAP ≤ espacioAbajo`), va abajo: `top = rect.bottom + GAP`.
- **Flip: arriba.** Si no entra abajo pero sí arriba, se voltea: `top = rect.top − alto − GAP`.
- **No entra en ningún lado:** se elige el lado con más espacio y se **clampea** al `VIEWPORT_MARGIN`; el **`maxHeight` del panel se recorta al espacio disponible** de ese lado (`espacioDisponible − GAP − VIEWPORT_MARGIN`), de modo que la lista **scrollea internamente** en vez de desbordar el viewport. El tope intrínseco (≈260–280px de lista) sigue vigente como cota superior; el clamp solo lo baja cuando el espacio obliga.
- **Horizontal:** ancho = ancho del disparador (listbox) o su ancho intrínseco (popover); `left`/`right` anclado al disparador y **clampeado** a `[VIEWPORT_MARGIN, viewport − ancho − VIEWPORT_MARGIN]`.
- **Medición en dos pasadas** (estimado antes del paint → alto real tras montar) para que el flip no produzca salto visible. Por qué importa: el caso que rompe hoy es el disparador cerca del borde inferior dentro de un modal alto centrado (`max-h-[calc(100dvh−48px)]`) — sin flip el panel abre por debajo del viewport y no se ve (jerarquía visual y flujo rotos: la opción existe pero es inalcanzable).

**2 · Scroll EXTERNO al panel (incluye el cuerpo del modal `overflow-y-auto`) → cierra.** El listener de scroll va en **captura** sobre `window` para atrapar también el scroll de contenedores intermedios (el cuerpo del modal). Coherente con la naturaleza auxiliar del popover (§ arriba): si el usuario mueve la superficie de fondo, el overlay se descarta en vez de quedar "despegado" de su disparador. Cerrar —no reposicionar-siguiendo— es la regla: es más simple, evita el panel flotando lejos del ancla y respeta que estos overlays son livianos.

**3 · Scroll INTERNO del panel → NUNCA cierra.** El handler de scroll **debe ignorar los eventos originados dentro del panel** (`if (panelRef.current?.contains(e.target)) return;`). Este guard es obligatorio: sin él, el listener en captura cierra el panel al rodar la rueda sobre la propia lista y la vuelve **imposible de scrollear** (el bug E1-a). La lista larga (o el panel con `maxHeight` clampeado por §1) debe poder scrollearse con el panel abierto.

**4 · Resize → cierra** (mismo criterio que scroll externo; el anclaje quedaría stale).

**5 · Foco e interacción (heredado de §Cierre de overlays y de los selectores vigentes).** Cierra además por **clic fuera / `Esc` / re-clic**. Al cerrar con `Esc`, **el foco vuelve al disparador**. Se conservan los roles y estados ARIA del listbox (`aria-haspopup="listbox"`, `aria-expanded`, `role="listbox"`/`option`, `aria-selected`) y el foco visible del disparador. Ni el color ni la tipografía del panel cambian por esta regla: es puro comportamiento de overlay + su criterio de ubicación.

### Overflow de modales y bloqueo del fondo (contrato de shell)

Regla **transversal a TODOS los modales/diálogos** de la app: transaction-modal, category-form-modal, el modal de método de pago, crear/editar límite, active-limit-dialog y los diálogos de confirmación/borrado. Todos comparten el mismo **contrato de shell** para que se comporten igual cuando el contenido es alto y para que el fondo nunca se mueva. Los diálogos chicos (confirmaciones) casi nunca desbordan, pero **acatan el mismo contrato** para que el comportamiento sea uniforme.

**Anatomía en tres zonas — header pineado · cuerpo scrolleable · footer pineado.** El diálogo es una **columna flex** con tres regiones:

- **Header (pineado arriba):** la fila de título + botón ✕, y —cuando existen— las tabs `.dtabs`. No scrollea: el título, el cierre y la navegación de tabs están **siempre alcanzables**. `shrink-0`.
- **Cuerpo (única región que scrollea):** el formulario / contenido. Toma el alto sobrante y scrollea internamente cuando desborda (`flex-1`, `min-h-0`, `overflow-y-auto`). Conserva el **padding horizontal del contenido** (`px-[22px]` en transaction-modal) como **carril del scrollbar**, para que la barra viva en el gutter y no se monte sobre los inputs.
- **Footer de acciones (pineado abajo):** los botones Guardar/Cancelar (y sus equivalentes: Eliminar/Cancelar en confirmaciones, etc.) quedan **fijos al borde inferior del diálogo, FUERA de la región de scroll**. `shrink-0`, fondo **opaco `--panel`** (para que el contenido que scrollea por debajo no se transparente). *Esto obliga a que el footer sea hermano de la región de scroll, no hijo de ella* — hoy los botones viven dentro de cada form, y ahí está el bug: hay que sacarlos del cuerpo scrolleable y montarlos como zona pineada del shell.

> **Por qué footer pineado (no "alcanzable por scroll"):** la acción primaria (Guardar) es el objetivo del modal; no debe exigir scroll para aparecer. Pinearlo da un blanco estable y refuerza el carácter de "decisión explícita" del modal (mismo espíritu que "el modal solo cierra con ✕/`Esc`"). Pinear también el header mantiene el ✕ y las tabs siempre a mano. El precio —el cuerpo pierde unos px de alto útil— es despreciable frente a botones inalcanzables.

**Max-height del diálogo (contemplando el padding del scrim).** El scrim es `fixed inset-0 flex items-center justify-center p-6` (padding **24px**). El diálogo lleva:

- `max-height: calc(100dvh - 48px)` — **48px = 2 × 24px** de padding del scrim (arriba + abajo). Se usa **`dvh`** (dynamic viewport height), no `vh`, para respetar la barra dinámica del navegador en mobile. Si en algún breakpoint el frontend baja el padding del scrim, el `calc` debe seguir a ese valor (siempre `100dvh − 2×padding`).
- Mientras el contenido **cabe**, el diálogo se dimensiona por su contenido (como hoy) y no aparece scroll ni footer "flotando"; el `max-height` solo entra en juego cuando el contenido supera el alto disponible.

**Tratamiento de la scrollbar interna, radios y clipping.**

- El diálogo mantiene **`overflow-hidden` + radio 18px**: la región de scroll queda **clippeada a las esquinas redondeadas**; nada se derrama por fuera del radio. El header abraza las esquinas superiores, el footer las inferiores.
- **Scrollbar fina y discreta** (la del SO / overlay alcanza; no se especifica scrollbar custom). Vive en el gutter del padding horizontal del cuerpo, sin comerse los inputs.
- **Divisores de corte (señal de "hay más"):** cuando el cuerpo desborda, aparece una **hairline `--hair` 1px** entre header↔cuerpo y entre cuerpo↔footer — la "repisa" que avisa que hay contenido recortado arriba/abajo. Cuando **no** hay overflow, **no** hay divisores: el modal se lee como una sola superficie continua. Se usa **divisor de línea, no fade con `mask`** (a diferencia de la leyenda de categorías): un fade sobre un input o un label lo volvería ilegible; la línea marca el corte sin tapar contenido.

**Bloqueo de scroll del fondo (body lock).**

- Mientras haya **al menos un modal abierto**, el fondo (la página detrás) **no scrollea**: rueda del mouse / touch sobre el scrim o sobre el diálogo **no** mueven la página de atrás. Hoy el body queda con overflow visible y scrollea — eso es el bug a corregir.
- **Sin salto de layout por la scrollbar:** al bloquear, la desaparición de la scrollbar del documento **no debe correr el contenido de fondo** horizontalmente. Se compensa el ancho de la scrollbar (p. ej. `scrollbar-gutter: stable` en el documento, o compensación equivalente al lock). Intención visual: al abrir/cerrar el modal, la página de atrás **no se desplaza**.
- **Apilamiento:** el scrim/diálogo vive en su capa (hoy `z-40`); si un segundo modal o confirmación se abre encima, monta su propio scrim en una capa superior y el body lock **persiste mientras quede algún modal abierto** (se libera solo cuando se cierra el último).

**Animación.** El `animate-modal-pop` sigue corriendo sobre el diálogo al entrar; la región de scroll **no** anima. Respeta `prefers-reduced-motion`.

#### Shell de modal compartido (`ModalShell`) — pieza única, no convención copiada

El contrato de arriba **no se cumple copiando el mismo markup a mano en cada modal** (así es como hoy 3 de 12 lo incumplen: nada obliga la regla). Se cumple con **un único componente de shell** —`ModalShell`— que **todos** los modales/diálogos de la app consumen. El modal concreto aporta solo su **contenido** (los campos del form, el texto de la confirmación) y sus **acciones**; el shell aporta el scrim, el panel, las tres zonas, el `max-height`, el clipping, el body-lock y los divisores de corte. Ningún modal vuelve a escribir el scrim ni a llamar `useBodyScrollLock` por su cuenta. **Prohibido el parche por archivo:** cualquier modal que hoy arma su propio scrim se migra a consumir el shell; no se corrige el `max-height` archivo por archivo.

**Anatomía canónica que encapsula el shell** (valores exactos, tomados del modal que ya cumple, `transaction-modal.tsx`):

- **Scrim (portal a `document.body`):** `fixed inset-0 z-40 flex items-center justify-center p-6`; fondo `oklch(0.18 0.02 270 / 0.46)` + `backdropFilter: blur(3px)`. El `p-6` (**24px**) es el que define el `48px` del `calc`: **van atados** (`max-height: calc(100dvh − 2 × padding-del-scrim)`). Si el shell algún día baja ese padding, el `calc` lo sigue por construcción (una sola fuente: es el mismo componente).
- **Panel:** `w-full bg-panel border border-line overflow-hidden animate-modal-pop max-h-[calc(100dvh-48px)] flex flex-col`; `borderRadius: 18px`; `boxShadow: var(--shadow-lg)`. El `flex flex-col` + `overflow-hidden` es lo que hace que las tres zonas funcionen y que la región de scroll quede clippeada al radio 18px.
- **Zona 1 — Header (`shrink-0`):** `flex items-center justify-between px-[22px] pt-5 pb-4`. Título + ✕. Si el modal tiene tabs (`.dtabs`), viven también acá, pineadas (`shrink-0`). Nunca scrollea.
- **Zona 2 — Cuerpo (`flex-1 min-h-0 overflow-y-auto`):** **única** región que scrollea. Padding horizontal `px-[22px]` como carril del scrollbar. Ritmo interno según el contenido (`space-y-[14px]` en forms).
- **Zona 3 — Footer (`shrink-0`):** `flex justify-end gap-3 px-[22px] py-4`, **fuera** de la región de scroll, hermano del cuerpo (no hijo). Fondo **opaco**: `--panel` por defecto; una confirmación puede apoyarlo en `--panel-2` (también opaco) — lo que no se admite es footer translúcido. Divisor superior `border-t border-hair` **cuando** el cuerpo desborda (señal de corte); ver contrato de divisores arriba.

**Dos variantes del mismo shell** (difieren en tamaño y densidad, **no** en anatomía ni en el contrato):

- **`dialog` — confirmación / diálogo chico** (borrados, reactivación, `active-limit-dialog`): `max-w-[440px]`, sin tabs, cuerpo corto que casi nunca desborda. **Igual acata** las tres zonas y el `max-height`: cuando el contenido entra, no hay scroll, no hay divisores y el footer se apoya al pie natural (se ve como un diálogo normal). El `max-height` solo actúa en el peor caso (viewport muy bajo).
- **`form` — formulario largo** (`transaction-modal`, `category-form-modal`, método de pago, **crear/editar límite**): `max-w-[460px]`, puede llevar tabs en el header, cuerpo alto que **sí** desborda en viewport chico → el cuerpo scrollea y header+footer quedan pineados. Es el caso donde el contrato se nota.

**Deuda concreta a barrer con esta pieza** (los 3 que hoy incumplen el `max-height`, todos por no consumir un shell común):

- `create-limit-modal.tsx` — hoy usa `max-h-[90vh]` (variante `form`). Debe pasar a `calc(100dvh-48px)` (**`dvh`, no `vh`**) al consumir el shell. Es el form más alto de la app: es exactamente el caso que el contrato existe para proteger.
- `categorias/reactivation-prompt.tsx` y `metodos-pago/reactivation-prompt.tsx` — hoy **no declaran `max-height` ni región de scroll** (variante `dialog`). Al consumir el shell heredan el `max-height` y las tres zonas sin tocar su contenido.

#### Checklist de aceptación visual — overflow y body-lock de modales

- [ ] **Fondo inmóvil:** con un modal abierto, girar la rueda / hacer scroll sobre el scrim y sobre el diálogo **no mueve la página de atrás**.
- [ ] **Sin salto de layout:** al abrir y al cerrar el modal, el contenido de fondo **no se corre** horizontalmente (la scrollbar del documento no produce salto).
- [ ] **Footer siempre visible:** en el modal de movimiento, pestañas **"Cuotas"** y **"Más opciones"** (las más altas), con el viewport chico: los botones **Guardar/Cancelar** quedan **pineados y visibles** al pie, sin necesidad de scrollear para encontrarlos.
- [ ] **Header siempre alcanzable:** título + botón **✕** (y las tabs, cuando hay) **no se van** con el scroll — quedan fijos arriba.
- [ ] **Solo scrollea el cuerpo:** al desbordar, scrollea la zona central; header y footer quedan quietos.
- [ ] **Sin corte crudo arriba/abajo:** cuando hay overflow, aparece la **hairline** header↔cuerpo y cuerpo↔footer; cuando cabe, **no** hay esas líneas (superficie continua).
- [ ] **Esquinas limpias:** el contenido que scrollea queda **clippeado al radio 18px**; nada se derrama fuera de las esquinas redondeadas.
- [ ] **Scrollbar en el gutter:** la barra de scroll no se monta sobre inputs ni labels.
- [ ] **Cabe sin scroll → se ve normal:** un modal cuyo contenido entra en pantalla (p. ej. una confirmación de borrado) se ve sin scroll, sin líneas de corte y con el footer al pie natural.
- [ ] **Apilamiento correcto:** si se abre una confirmación sobre otro modal, el fondo sigue bloqueado; al cerrar la de arriba el lock persiste hasta cerrar el último modal.
- [ ] **`dvh`, no `vh`:** el panel usa `max-h-[calc(100dvh-48px)]`. Verificación específica en el navegador con barra dinámica (mobile): el modal **no** queda cortado por debajo de la barra del navegador (síntoma de `vh`).
- [ ] **Los 3 offenders migrados:** en viewport bajo, **crear límite** (`create-limit-modal`, el form más alto) pinea footer y scrollea el cuerpo; los dos **`reactivation-prompt`** (categorías y métodos de pago) también respetan el `max-height` y las tres zonas. Ninguno arma su propio scrim: todos consumen `ModalShell`.

### Superficies con scroll interno — contención de tablas y gráficos anchos

Instancia del **invariante 4** (*"las superficies anchas scrollean dentro de sí mismas, sin romper el layout de la página"*) para las tres superficies que no se pueden achicar sin volverse ilegibles: la grilla día×mes de Únicos, el gantt de Cuotas y la lista de límites de `/configuracion`. **Contener ≠ adaptar:** no se rediseña ninguna para pantalla chica; se garantiza que **el scroll vive dentro de la superficie** y **nunca lo hereda el `body`** (invariante 1).

#### Regla transversal — el scroll horizontal vive en la card, y los overlays escapan por portal

1. **El carril de scroll es la card, no la página.** La superficie ancha va envuelta en un contenedor con `overflow-x: auto` (`WebkitOverflowScrolling: touch`). El `body` no scrollea horizontal jamás; el desborde lo absorbe la card. Esto **ya está** en `unique-grid-card` y `cuotas-gantt-card` (`<div class="… overflow-x-auto">`); esta sección lo ratifica y le agrega la **affordance de corte** (abajo), que hoy falta.
2. **Regla dura de overlays dentro de scroll (invariante 3).** Cualquier **popover, menú kebab, tooltip o confirmación** anclado a un elemento que vive dentro de una superficie con `overflow`, **se renderiza por `createPortal` a `document.body`** con posición `fixed` calculada desde el `getBoundingClientRect()` del ancla. Motivo: un overlay hijo de un contenedor con `overflow-x/y: auto` se **clippea** o se **corta** contra el borde del carril → una acción queda inalcanzable. Los dos cards ya lo hacen (el `RemoveConfirmPopover` y todos los tooltips van portaled); **es la regla, no una excepción de esos archivos**. Los `<Select>` nativos del DS no necesitan portal (el dropdown nativo no lo clippea el overflow).
3. **Affordance de "hay más" (obligatoria, hoy ausente).** Cuando el contenido excede el ancho del carril, el borde por el que hay contenido oculto muestra una **sombra de corte** de 1px→transparente: `box-shadow` interior `inset -14px 0 12px -12px oklch(0.18 0.02 270 / 0.18)` sobre el borde derecho (hay más a la derecha) y su espejo `inset 14px 0 …` sobre el izquierdo (hay más a la izquierda, es decir cuando ya se scrolleó). En modo oscuro la sombra usa `oklch(0 0 0 / 0.4)`. La sombra **aparece/desaparece según la posición de scroll** (sin sombra en el extremo alcanzado). No se usa fade con `mask` sobre celdas con cifras (taparía un monto); se usa la sombra de borde, que no oculta contenido. Es **la misma familia** de "señal de corte" que la hairline de los modales, adaptada al eje horizontal.

#### `unique-grid-card` — grilla día × mes (31 filas × 12 columnas)

- **Eje de scroll: horizontal.** El ancho es el que desborda: 12 columnas × mínimo **64px** + columna de días **28px** ≈ **796px**, que no entra en compacto. Las 31 filas de día caben en alto; el scroll **vertical** de la grilla lo hace la **página** (no la card), así que la grilla no se recorta en alto.
- **Sticky que importa: la columna de días (`sticky left-0`).** Al scrollear horizontal, la columna de números de día (1–31) queda **fija a la izquierda** para no perder de vista a qué día corresponde cada celda. Ya está implementado (`th sticky left-0`), se ratifica. La celda esquina (día×header) también es `sticky left-0 top-0`.
- **Header de meses (`sticky top-0`):** se mantiene como está. Su utilidad real es acotada (el scroll vertical es de página, no del carril), pero es inocuo y coherente con el gantt; **la contención en compacto la resuelve el scroll horizontal + la columna de días sticky**, no el header sticky.
- **Affordance:** sombra de corte derecha/izquierda por regla transversal §3, sobre el carril `overflow-x-auto`. Debe **respetar la columna de días sticky** (la sombra izquierda aparece por fuera de esa columna, indicando que hay meses ocultos a la izquierda).
- **Overlays:** tooltip de celda, tooltip de footer y `RemoveConfirmPopover` **ya van portaled** — cumplen §2 sin cambios.

**Comportamiento en pantalla chica (compacto, `< --bp-wide`).** La card conserva su ancho de columna; la grilla scrollea horizontal dentro de la card. Invariante 1: el `body` no scrollea horizontal (lo absorbe el carril). Invariante 3: los tooltips/popover portaled no se clippean. Invariante 4: el scroll vive en la card. La columna de días sticky garantiza que el eje de lectura nunca se pierde. No se reduce el mínimo de 64px por columna (por debajo, las cifras `mono` se vuelven ilegibles) — se prefiere scroll a ilegibilidad.

#### `cuotas-gantt-card` — gantt de barras horizontales (12 meses)

- **Eje de scroll: horizontal.** Ancho = 12 columnas × mínimo **64px** = **768px** (`minWidth: calc(12 * 64px)`, ya presente). Desborda en compacto → scroll horizontal dentro de la card.
- **Sticky: header de meses (`sticky top-0`, ya presente).** El gantt **no tiene columna de etiquetas de fila** (las barras se rotulan inline con monto·descripción), así que **no hay sticky-left que definir** — el eje de identidad de cada barra viaja con la barra. Se ratifica el header de meses sticky como está.
- **Affordance:** sombra de corte derecha/izquierda por §3, sobre el carril `overflow-x-auto`. Complementa —no reemplaza— los chevrons `‹`/`›` de las barras, que significan "la cuota continúa en otro año", **no** "hay scroll" (son dos señales distintas y no deben confundirse).
- **Overlays:** `BarTooltipPortal` y `RemoveConfirmPopover` **ya van portaled** — cumplen §2.

**Comportamiento en pantalla chica (compacto).** Idéntico a Únicos: card de ancho fijo, gantt scrollea horizontal adentro, `body` sin scroll horizontal (inv. 1), overlays portaled sin clip (inv. 3), scroll en la card (inv. 4). Mínimo 64px/mes: por debajo, el monto `mono` dentro de una barra de 1 mes no entra — se prefiere scroll.

#### Tabla de límites (`limits-tab` + `limit-row`) — lista, no tabla ancha

Honestidad de diagnóstico: esta superficie **no es una tabla ancha de columnas fijas** como las dos anteriores; es una **lista vertical de filas** (`flex flex-col`, card con `overflow-hidden` y radio 14px). Su contención **no** es scroll horizontal interno, sino **truncado + wrap** — forzar un scroll horizontal acá sería inventar un problema que no existe. La regla que aplica:

- **Fila (`limit-row`):** `flex items-center justify-between gap-6`. Zona **identidad** izquierda `flex-1 min-w-0` con el label `truncate`; zona **acciones** derecha `shrink-0` (toggle + borrar). Como identidad puede encogerse a 0 (por `min-w-0` + `truncate`) y las acciones son `shrink-0`, la fila **nunca empuja scroll horizontal del body** (inv. 1): a lo sumo el label se trunca. Se ratifica.
- **Sublínea de metadatos (chips):** `flex-wrap` (ya presente) — los chips de condición (`mono tabular`) y de alcance **envuelven** a la línea siguiente en vez de desbordar. Se ratifica.
- **Confirmación inline de borrado (invariante 3):** al pedir borrar, la zona de acciones muestra `¿Eliminar? [Eliminar] [Cancelar]` (`shrink-0`, `whitespace-nowrap`). En compacto muy angosto estos tres controles + la identidad `min-w-0` conviven porque identidad cede ancho; **ninguna acción queda inalcanzable ni tapada**. Es confirmación **inline**, no popover → no hay riesgo de clipping por overflow (no aplica §2). Se ratifica el patrón; si en el ancho mínimo la confirmación apretara demasiado, la salida es que la **identidad ceda** (ya lo hace), nunca que los botones se salgan.

**Comportamiento en pantalla chica (compacto).** La card de la lista mantiene su ancho de columna del panel; las filas se contienen por truncado (identidad) y wrap (chips). No hay scroll interno porque no hace falta: la fila no tiene ancho mínimo rígido. Inv. 1: sin scroll horizontal del body. Inv. 3: toggle, borrar y la confirmación inline siempre alcanzables (identidad cede ancho antes que las acciones). Inv. 4: no aplica (no es superficie ancha); la contención es truncado+wrap.

#### Checklist de aceptación visual — superficies con scroll interno

- [ ] **`unique-grid` — sin scroll horizontal del body (inv. 1):** en compacto, la grilla scrollea horizontal **dentro de la card**; la página no gana barra horizontal.
- [ ] **`unique-grid` — columna de días sticky (inv. 4):** al scrollear la grilla a la derecha, la columna de números de día 1–31 queda fija a la izquierda.
- [ ] **`unique-grid` — affordance de corte:** con contenido oculto a la derecha aparece la sombra de borde derecho; al scrollear aparece la del borde izquierdo; en los extremos, sin sombra.
- [ ] **`unique-grid` — overlays no clippeados (inv. 3):** tooltip de celda, tooltip de footer y popover de "quitar reporte" se ven completos, sin recorte contra el borde del carril.
- [ ] **`cuotas-gantt` — sin scroll horizontal del body (inv. 1):** el gantt scrollea horizontal dentro de la card; la página no gana barra horizontal.
- [ ] **`cuotas-gantt` — header de meses sticky (inv. 4):** el header Ene…Dic permanece durante el scroll del carril.
- [ ] **`cuotas-gantt` — affordance de corte:** sombra de borde derecho/izquierdo según posición de scroll; los chevrons `‹`/`›` de barra se distinguen de la sombra (son continuidad de año, no scroll).
- [ ] **`cuotas-gantt` — overlays no clippeados (inv. 3):** tooltip de barra y popover de "quitar reporte" completos, sin recorte.
- [ ] **`limits-tab` — sin scroll horizontal del body (inv. 1):** en compacto, la fila trunca el label y envuelve los chips; la página no gana barra horizontal.
- [ ] **`limits-tab` — acciones alcanzables (inv. 3):** toggle, botón borrar y la confirmación inline `¿Eliminar?/[Eliminar]/[Cancelar]` siempre visibles y clickeables; la identidad cede ancho antes que las acciones.

### PeriodNav — navegación de período (flechas gigantes laterales + modo `.stepper`)

Patrón **genérico** para navegar un período (mes o año): `‹ contenido ›`, donde **‹ va al período anterior y › al siguiente**. Recibe un rótulo de período ya formateado, handlers anterior/siguiente y dos flags `canGoPrev` / `canGoNext`. **Mismo componente, distinto período.** Tiene **dos formas**:

- **Forma lateral (canónica, a ancho de página):** el contenido es el **bloque canónico** `‹ contenido ›` y las flechas ‹ › son **overlay** que lo flanquean **sin reservar ancho** (simetría respecto del **contenido**, no del viewport). Cada flecha: `button` circular **64×64px**, glifo `ChevronLeft`/`ChevronRight` (lucide) **46px** `stroke-width 1.75`, **sin fill** en reposo, glifo `--faint`. **Vigente en `/mes`** (período = mes; flags siempre `true`) y en **reportes** (mismo patrón).
  - **Ancho de la columna central = ancho de contenido de página:** rige la regla *Ancho de contenido de página* (§ Contención responsive). El bloque central usa el **mismo mecanismo que las otras tres pantallas** (`px-10 max-w-[1120px] mx-auto`: llena el ancho disponible del `<main>` hasta **1120px**, y de ahí capea y centra) → **mismo ancho a igual viewport**. Las flechas **NO consumen ancho de columna** (se retiró el modelo de gutters de 84px/lado que angostaba `/mes` respecto del resto). Son overlay, absolutas respecto del bloque, centradas verticalmente al viewport. **Posición horizontal:** las flechas solo se muestran con `<main>` ≥ **1288px** (`--bp-arrows`), ancho al que el margen exterior por lado es **siempre ≥84px** (64 + 20 de aire); por eso la flecha va **siempre entera en el margen exterior** con **≥20px de aire** al borde del bloque y **nunca toca** el listado (ni el padding `px-10`). Por debajo de 1288 no hay flechas: cede al stepper. La fórmula de offset no cambia; sube el umbral de visibilidad. Detalle y racional del borde (incluida la reversa de la tolerancia de solape anterior): § Contención responsive → *Flechas ‹ › de `PeriodNav` — overlay, NO gutters*.
  - **Centrado vertical de las flechas:** la flecha está **centrada verticalmente en el VIEWPORT**, siempre, sin importar el largo del listado, y **permanece anclada al centro del viewport** mientras se hace scroll y con cualquier cantidad de contenido. El mecanismo técnico exacto lo resuelve control-frontend (p. ej. garantizar que el área de las celdas laterales tenga alto suficiente —`min-height` del viewport— para que el anclaje pueda centrar también con listas cortas); el **comportamiento visual a cumplir** es: flecha centrada verticalmente en el viewport, constante al scrollear, con cualquier cantidad de contenido.
- **Forma compacta (`.stepper` pill):** el **modo de colapso** del mismo patrón, también usado **embebido** cuando no hay lugar para flechas laterales (cards apiladas, mobile). Pill `.stepper` del DS: `--r-pill`, `--panel`, borde `--line`, `--shadow-sm`, padding 4px; dos botones circulares **32px** (chevron-left/right, glifo 18px, `--ink-2` → `--ink` sobre `--panel-2` en hover) y, al centro, el rótulo del período (si es número → **mono tabular**, regla dura 3). **Vigente como control de año embebido per-card** en `/reportes` y en el Dashboard (ver *card de reporte* abajo).

**Estados de la flecha/chevron (comunes a ambas formas):**

- **Reposo:** glifo `--faint` (lateral) / `--ink-2` (stepper), `cursor: pointer`.
- **Hover:** glifo a `--ink`; en la forma lateral aparece un fondo circular `--panel-2`; en el `.stepper`, fondo `--panel-2` en el botón. Transición 0.14s.
- **Active:** fondo `--panel-3`.
- **Focus (teclado):** ring `--accent-soft` 3px (`focus-visible`).
- **Disabled (`canGoPrev`/`canGoNext` = false):** glifo `--faint` con `opacity: 0.4`, sin hover, `cursor: default`, `aria-disabled`. **No se oculta** — presente pero apagado. Es el estado que usan los límites de navegación de año (`earliestYear` / año en curso).

`aria-label` según el período: "Mes anterior/siguiente" (mes) o "Año anterior/siguiente" (año).

**Responsive (forma lateral) — medido por container query sobre `<main>`, no por viewport.** El régimen de `PeriodNav` (flechas + `.phead` vs. stepper) se decide contra **`--bp-arrows` = 1288px**, no contra `--bp-wide` (941) — ese último gobierna solo el colapso de grillas (ver § Contención responsive → *Umbral de flechas*). Dos regímenes de `PeriodNav`:
- **Ancho de contenido ≥1288px (las flechas entran con aire):** el contenido es el bloque canónico `px-10 max-w-[1120px] mx-auto` (llena hasta 1120, capea y centra) y las flechas laterales aparecen como **overlay** flanqueándolo con ≥20px de aire (ver posición horizontal arriba); el contenido **no se angosta** por las flechas; el header usa el `.phead` (título grande).
- **Ancho de contenido <1288px (compacto de `PeriodNav`):** las flechas laterales se ocultan y el header usa la forma compacta `.stepper`; el bloque de contenido es el mismo `px-10 max-w-[1120px] mx-auto`, idéntico a las otras tres pantallas. Esto incluye **toda la banda intermedia 941–1288**, donde las grillas ya son multicolumna pero la navegación de período es por stepper.

En ambos regímenes el ancho de contenido es el mismo mecanismo — lo único que cambia es la presencia (overlay) o no de las flechas y la forma del header. **No existe** un modo intermedio de "flechas con fondo pegadas al borde" ni gutters que reserven ancho: donde no hay lugar para las flechas con su aire, se usa el stepper.

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

- **Identidad (izquierda):** **únicamente el título editable por card** (16px/600 `--ink`), sin eyebrow ni rótulo "Reporte" encima. El título es **definido por el usuario** y reemplaza al subtítulo fijo de tipo; cuando está vacío muestra el placeholder *"Reporte N"* (`--faint`). Ver *Título editable de la card de reporte* abajo para anatomía, edición, estados y placeholder. En la card `by-category` (que lleva los `ViewTabs` Barra/Línea) la identidad se ubica según esa misma sección.
- **Control de año embebido:** el `.stepper` de **PeriodNav** (forma compacta, arriba), año en **mono tabular**, con su estado **disabled** atado a `earliestYear` / año en curso. Navegación **activa** también en el Dashboard.
- **Selector de moneda de la card (solo `/reportes`):** override de display por card, persistido. Ver *Moneda por reporte — selector embebido en la cabecera de la card* abajo. **No aparece en la card del Dashboard.**
- **Filtro de categorías embebido:** ver *Filtro de categorías* abajo.
- **Quitar card (solo `/reportes`):** botón icon-only ghost `X` (16px), `--muted` → `--ink` sobre `--panel-2`, al final de la barra de controles, separado por un divisor `--hair` vertical. Abre una **confirmación inline** (popover `--panel`/`--line`/`--r-ctl`/`--shadow-lg`, "¿Quitar este reporte?", botón **danger** "Quitar" + ghost "Cancelar"). La card del Dashboard **no** es removible.

**Grilla en `/reportes`:** una sola columna a 1120px, cards separadas por `--gap` (18px); el **"[+]"** (recuadro dashed, ver abajo) siempre al final. El orden de las cards es **reordenable por el usuario vía un modo orden explícito** — ver *Reportes reordenables — modo orden de cards (Ola 2, P1)* abajo.

**Recuadro "[+]" para agregar card:** recuadro **placeholder dashed** (`--panel-2`, borde dashed `--line`, `--r-card`, sin sombra), ícono `Plus` en círculo `--panel-3`, label "Agregar reporte". Compacto cuando hay cards (~120px); en versión grande preside el **estado vacío inicial** (~280px alto, ~480px ancho, centrado, "Armá tu primer reporte"). Al activarlo, **popover-menú de opciones** ancla la elección de tipo; la card nace en el año en curso con todas las categorías.

> **Nombres de tipo y íconos en el `AddCardMenu` (nomenclatura vigente).** Cada opción del menú es `[ícono de tipo 16px --muted] · [nombre]`, y el ícono es **el mismo glifo** que el mini de reorden usa para ese tipo (ícono ↔ tipo consistente). Los nombres son **descriptivos**: **"Ingresos vs Gastos"** (`income-expense`, ícono `AreaChart`), **"Gastos por categoría"** (`by-category`, ícono `BarChart3`), **"Gastos Únicos"** (`unique-grid`, ícono `CalendarDays`), **"Gastos en Cuotas"** (`installment-gantt`, ícono `CalendarRange`), **"Inflación vs Ingresos"** (`inflation-vs-income`, ícono `TrendingUp`, ver *Reporte anual "Inflación vs Ingresos"*). El renombre de los dos primeros (antes "Ingresos y gastos" / "Por categoría") es de palabra solamente: no cambia ícono, color ni layout del menú. Esta nomenclatura es la **fuente única** del nombre de tipo en todo el producto (menú `[+]` y etiqueta de tipo del mini de reorden, §modo orden).

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
  - **Etiqueta de texto del tipo** — a la **derecha**, tras un divisor: **"Ingresos vs Gastos"** (para `income-expense`) / **"Gastos por categoría"** (para `by-category`) — y, para los otros tipos, **"Gastos Únicos"** (`unique-grid`) / **"Gastos en Cuotas"** (`installment-gantt`) — en **12px/600 `--muted`, uppercase NO** (texto sentence-case, no rótulo de sección). Es **el mismo nombre** que el `AddCardMenu` (nomenclatura única del tipo). Refuerza la identificación por tipo en palabras, no solo por ícono. Precedida por una **línea divisoria** `flex-1 h-px bg-hair` que empuja la etiqueta al extremo derecho (mismo patrón que el subtotal de la `.ghead`: `[contenido izquierda] ——— [meta derecha]`).
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

- **`income-expense` — el título es la identidad, en la fila `justify-between`.** La cabecera es de **una sola línea**: identidad izquierda (**el título editable**, sin eyebrow y **sin tabs** — el toggle se eliminó con el reagrupamiento) ⟷ controles derecha (`stepper · moneda · filtro/leyenda · X`). El título queda inline con los controles en la misma fila `flex justify-between` y trunca contra su ancho disponible (la identidad cede ancho a los controles, no al revés). Es el molde simple de las cards sin tabs.
- **`by-category` — el título en su propia línea encima de las tabs Barra/Línea.** Tras el reagrupamiento, `by-category` es la card con toggle: los `ViewTabs` ("Barra" / "Línea") ocupan el lado izquierdo y son el control de **mayor jerarquía de interacción** (definen cómo se ve); el título es **identidad**, no control. Para no competir, la identidad se apila **encima** de la zona de tabs+controles:
  - **Línea 1 (ancho completo de la cabecera):** **solo el título editable** (`--ink`, o placeholder "Reporte N" en `--faint`). Es la **identidad** de la card; arranca pegada a la izquierda.
  - **Línea 2:** `[ViewTabs Barra/Línea]  ⟷  [stepper · moneda · X]` (`flex justify-between`), según *Toggle Barra ↔ Línea … §1*.
  - **Por qué encima y no inline con las tabs:** meter el título en la misma fila que las tabs lo haría competir con el underline activo y empujaría las tabs hacia el centro, rompiendo su alineación a la izquierda. Apilarlo arriba da al título su propia línea de identidad y deja las tabs intactas en su fila. **El título es el ancla común** de ambos tipos: en los dos, lo que se lee arriba a la izquierda es el título; lo único que cambia es que `by-category` suma debajo la fila de tabs y `income-expense` no.
- **Resultado:** en **los dos tipos** el usuario lee, arriba a la izquierda, el **título** en 16px/600 (o su placeholder "Reporte N"), sin rótulo encima. El único delta entre tipos es la fila de tabs que `by-category` suma debajo del título. (`unique-grid` e `installment-gantt` usan el molde simple de una línea, como `income-expense`.)

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
  - En `income-expense` (y `unique-grid` / `installment-gantt`) el título trunca contra el ancho de su columna de identidad (la cabecera es de una línea, `justify-between`: título izquierda / controles derecha; la identidad cede ancho a los controles, no al revés).
  - En `by-category` el título (línea 1, ancho completo de la cabecera) trunca contra el ancho de la cabecera completa, que es más holgado que la zona de tabs.
- **Ancho al editar:** el input crece hasta el ancho disponible de la zona de identidad y hace scroll horizontal interno del texto si el contenido excede (comportamiento nativo del input). No empuja la barra de controles.

#### 6. Responsive (≤940px — la cabecera hace wrap)

- **`income-expense` (y `unique-grid` / `installment-gantt`):** la identidad (el título) ya está a la izquierda y los controles envuelven a la segunda línea por el `flex-wrap` existente; el título sigue truncando contra su ancho disponible, que se ensancha al pasar los controles abajo. Sin cambios de forma.
- **`by-category`:** la **línea 1 de identidad** (el título) queda **arriba de todo**; debajo, las tabs Barra/Línea con su fila de controles (la fila de controles envuelve por su `flex-wrap` propio). Orden vertical resultante en angosto: `[título]` → `[ViewTabs Barra/Línea]` → `[stepper · moneda · X]`. El título trunca contra el ancho completo de la cabecera angosta.
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

- **El segmented de 4 no entra.** La barra de controles derecha ya carga `YearStepper` (pill ~150px) + divisor + `X`, y en `by-category` la columna de identidad lleva además las tabs "Barra / Línea" debajo del título. Meter un segmented de 4 segmentos (`~180–200px`) a la derecha **rompe el balance** de la cabecera y fuerza wrap permanente aun en desktop. El segmented está pensado para superficies con holgura (fila de ajuste de `/configuracion`, columna de form), no para una barra de controles ya densa.
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

### Botón de refrescar por reporte — utilidad per-card (P5)

Cada card de reporte lleva **su propio botón de refrescar**, en la barra de controles de la cabecera. Refetchea **solo esa card** (reusa el `refetch` del hook de la card). Aplica a los **5 tipos de card** (`income-expense`, `by-category`, únicos, cuotas-gantt, inflación-vs-ingresos) **+ el widget `income-expense` del Dashboard**. En **modo orden** la card colapsa a mini y no se renderiza → el botón tampoco existe ahí (no aplica).

**No inventa cromo nuevo:** es un icon-button ghost del mismo lenguaje que el botón `X` (quitar) — mismo hit-area, mismos colores de estado, mismo focus ring. La única pieza nueva es el ícono y su estado de carga.

#### 1. Ícono

- **`RefreshCw`** (lucide) — dos flechas en círculo, la lectura universal de "refrescar/recargar". **16px**, `aria-hidden="true"`. Se elige `RefreshCw` (no `RotateCw`) porque el doble-arco lee inequívocamente como "actualizar datos" y no como "deshacer/rotar".
- Tamaño 16px para **igualar al `X`** de la cabecera (ambos viven en el mismo clúster de utilidad; los chevrones del `YearStepper` son 18px porque pertenecen a la pill de navegación, otro grupo).

#### 2. Ubicación y orden — regla única para los 4 layouts de cabecera

El botón vive en el **clúster de utilidad**, junto al `X`, al final de la barra de controles derecha. Orden completo (izq → der):

```
[ YearStepper ] |hair| [ CardCurrencySelect? ] |hair| [ refrescar ] [ X? ]
```

- **`refrescar` va inmediatamente a la izquierda del `X`**, dentro del mismo bloque, **sin divisor entre ambos** (separados solo por el `gap-2` del contenedor). Refrescar (no destructivo) primero; `X` (quitar, destructivo) **queda terminal/rightmost**, preservando la muscle-memory de "quitar es la esquina" y la jerarquía año > moneda > utilidades.
- **El divisor `--hair` que hoy precede al `X` pasa a preceder al clúster `[ refrescar ][ X? ]`.** Como `refrescar` está **siempre presente**, ese divisor **siempre se renderiza** (a diferencia de hoy, donde el divisor del `X` era condicional a `removable`). Es decir: el clúster de utilidad ahora es incondicional y arrastra su propio divisor de entrada.
- **No se agrega un segundo divisor** entre `refrescar` y `X`: un solo hair de entrada al clúster. Así una card completa de `/reportes` tiene **dos** hairlines (stepper|moneda y moneda|utilidad), no tres — se evita ruido de hairlines.
- **Regla mecánica para las 4 cabeceras** (el `CardControls` compartido de `report-card.tsx` y las 3 cabeceras inline de `unique-grid-card`, `cuotas-gantt-card`, `inflation-income-card`): renderizar **incondicionalmente** `|hair| [ refrescar ]` después del bloque de moneda, y **dentro del mismo bloque** agregar `[ X ]` solo si `removable`. La condición de `removable` deja de gobernar el divisor (que ahora es del clúster, no del `X`).

Resultado por caso:

- **Dashboard** (`income-expense`, sin moneda ni `X`): `[ YearStepper ] |hair| [ refrescar ]`. La cabecera del Dashboard **deja de ser "stepper solo"**: gana el divisor + refrescar. (Es el único cambio visible del Dashboard por P5.)
- **`/reportes`, card normal**: `[ YearStepper ] |hair| [ CardCurrencySelect ] |hair| [ refrescar ] [ X ]`.

#### 3. Botón icónico — anatomía y estados (reposo/hover/focus)

Idéntico al botón `X` de la cabecera, para que el clúster de utilidad lea uniforme:

- **Hit-area:** `h-8 w-8` (32×32px), `rounded-ctl` (`--r-ctl` 10px), ícono centrado (`flex items-center justify-center`).
- **Reposo:** `text-muted`, sin caja (fondo transparente).
- **Hover:** `hover:bg-panel-2 hover:text-ink`, transición `140ms` (`transition-colors duration-[140ms]`).
- **Focus (teclado):** `focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]` — mismo ring `--accent-soft` que todos los icon-buttons de la cabecera. Acento = cromo de foco, no dato (no viola reglas duras).
- **Sin color semántico ni índigo** en el ícono en ningún estado (regla dura 1 y 2): el ícono es neutro (`--muted` → `--ink`). El índigo aparece **solo** como focus ring.

El botón **no** depende de los límites de año (a diferencia de los chevrones del stepper): está siempre habilitado, salvo mientras su propio refetch está en vuelo (§4).

#### 4. Estado de carga — spinner, sin toast

Feedback **exclusivamente visual y local: solo spinner, sin toast** (la card ya maneja su propio estado de error en el área de contenido; el botón no anuncia nada).

- **Mientras refetchea:** el **mismo ícono `RefreshCw` rota** (`animate-spin`, giro horario). No se cambia por un spinner distinto — se reusa el ícono, que es exactamente la metáfora "refrescando".
- **Botón inerte durante el fetch:** `disabled` + cursor default + **atenuado a `opacity-60`** para señalar que está trabajando y no vuelve a accionarse; hover suprimido mientras carga.
- **A qué estado se ata:** al **fetch en segundo plano** de la card (dato ya presente + refetch en vuelo) — que es justamente el caso del refrescar manual. La **carga inicial** la sigue cubriendo el skeleton de la card (regla de *Skeletons*), así que el botón **no** necesita spinnear en el arranque; su spinner es el del refetch de fondo.
- **`prefers-reduced-motion`:** `motion-reduce:animate-none` — bajo reduced-motion el ícono **no gira**; el estado de "trabajando" queda señalado por la **atenuación `opacity-60` + `disabled`** (que se aplican en ambos casos, con o sin movimiento). Así el feedback de carga **nunca depende solo de la animación**: el dim es el cue accesible cuando no hay giro.

#### 5. Accesibilidad

- **`aria-label="Actualizar reporte"`** (estático; no cambia mientras carga).
- **`aria-busy`** refleja el estado de carga: `aria-busy="true"` mientras refetchea, `false` en reposo. Es el anuncio de "trabajando" para lectores de pantalla, coherente con que no hay toast.
- **`aria-disabled` / `disabled`** durante el fetch (el mismo estado que atenúa y suprime el hover).
- `type="button"`, ícono `aria-hidden="true"` (el nombre accesible lo da el `aria-label`).

> **Reglas duras reafirmadas:** el botón de refrescar es **cromo estrictamente neutro** — ícono `--muted`/`--ink`, sin income/expense (regla dura 1), sin índigo salvo focus ring (regla dura 2). No toca ninguna cifra de dinero, así que la regla dura 3 (mono tabular) no lo alcanza.

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

- **Forma 1 (`income-expense`):** en `/reportes`, el footer es la **leyenda-filtro de categorías** (un ítem por categoría activa, swatch `category.color` + nombre — filtro de cómputo, ver *Leyenda interactiva* y RF-REP-014 §4). En el **Dashboard** (efímero, sin filtros) es una **leyenda decorativa de 2 series** — "Ingresos" (swatch `--income`) / "Gastos" (swatch `--expense`), no interactiva.
- **Forma 2:** un ítem por categoría con gasto en el año, en el mismo orden del apilado (mayor a menor), cada swatch con su `category.color`; sin agrupar ni colapsar.

> **La leyenda es interactiva: es el filtro.** Desde la Ola 2 (P1), la leyenda **no es decorativa** — cada ítem es un toggle clickeable que activa/desactiva su categoría. En **`income-expense`** (Total-only) el footer es la **leyenda-filtro de categorías** (RF-REP-014 §4): tildar/destildar categorías acota qué movimientos alimentan las 2 líneas income/expense, **sin** descomponerlas en series por categoría (el canvas sigue siendo 2 líneas; el swatch es identificador de categoría, no clave de color del canvas). En **`by-category`** la leyenda-filtro de categorías mapea a las bandas/áreas del canvas (en ambos modos Barra y Línea) y **reemplaza** al disparador+popover de categorías-como-breakdown, que se elimina de la card. El detalle de estados, a11y y layout interactivo vive en *Leyenda interactiva (la leyenda es el filtro)*, abajo. *(El Dashboard `income-expense` es la excepción: efímero y sin filtros, lleva una leyenda decorativa de 2 series no interactiva.)*

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

#### 9. Techo editable de la escala de color (P3)

El **techo** (ancla) de la rampa —el valor `max` de `t = clamp(total / max, 0, 1)`— pasa de fijo (15 USD reconvertidos) a **editable por card**. El editor cambia **solo el techo**: la **rampa de 4 stops oklch NO se toca** (§3), el piso queda en `0`, verde=poco / rojo=mucho se conserva idéntico. El editor es un control más del widget autónomo, junto a año / moneda / filtro de categorías; **no vive en `/configuracion`**. El valor se persiste en USD (`anchorUsdCents`, entero, default `1500`) y el backend lo reconvierte por año y moneda; el front recibe el ancla vigente en `colorAnchorCents` (centavos de la moneda de display) y **prellena** el editor con ese valor.

> **Regla dura reafirmada:** el techo es una **cifra de dinero** → va en **mono tabular `tnum`** (regla dura 3) en el input y en cualquier eco del valor. El editor **no** introduce ningún tinte income/expense (regla 1) ni índigo de marca (regla 2): el índigo aparece **solo** como focus ring. La rampa de heatmap sigue siendo lenguaje de magnitud propio (no semántico), como fija *Restricciones duras reafirmadas*.

##### 9.1 Ubicación y disgregación — en la barra de controles derecha

El disparador del editor es un **icon-button ghost** que se suma a la barra de controles derecha de la cabecera, **entre el `CardCurrencyTrigger` y el clúster de utilidad** (refrescar + quitar). Orden vigente ampliado (≥941px de ancho de contenido):

`[ YearStepper ] |hair| [ CardCurrencyTrigger ] [ ColorAnchorTrigger ] |hair| [ RefreshCw ] [ X ]`

- **Va pegado a la moneda, sin divisor entre ambos.** Moneda y techo son los **dos ajustes de display por-card** (qué símbolo / qué intensidad); leen como un mini-grupo de configuración de la card, separado del stepper (por el `--hair` que ya está antes de la moneda) y del clúster de utilidad (por el `--hair` que ya precede a `RefreshCw`). No se agrega un tercer divisor: sumar hairlines fragmenta una barra ya densa (misma economía de cromo que *Moneda por reporte §4*).
- **No toca lo que ya está a la izquierda:** `EditableTitle` (P4) + `LimitsInfoPopover` (P2) quedan intactos en la columna de identidad. El editor vive **solo** en la barra derecha.
- **Cuando la card no tiene override de moneda** (Dashboard efímero — no debería alojar esta card, pero por robustez): si no se monta el `CardCurrencyTrigger`, el `ColorAnchorTrigger` **tampoco** se monta (el techo editable es gemelo del override de moneda: ambos son config persistida per-card, condicionados por la misma señal —callback presente—). En esa rama la barra queda como hoy.

##### 9.2 El disparador (`ColorAnchorTrigger`) — anatomía y estados

`<button type="button">` con `aria-haspopup="dialog"` / `aria-expanded`, **misma hit-area 32×32** (`h-8 w-8`) y mismo lenguaje ghost que `RefreshCw` / `X` / `LimitsInfoPopover` (no inventa cromo).

- **Ícono:** **`Gauge`** (lucide) **16px**, `aria-hidden`. Metáfora: el "techo/intensidad de una escala", distinto de un ícono de paleta (que sugeriría —falsamente— recolorear la rampa) y del genérico de settings. La ambigüedad residual la cierran el `aria-label` y el `title` (tooltip nativo) = **"Techo de la escala de color"**. *(Alternativa evaluada: `SlidersHorizontal` —"ajustar parámetro"— más genérico pero se confunde con un menú de filtros/ajustes; se prefiere `Gauge` por ser específico de "intensidad/tope".)*
- **Estado default (ancla estándar, sin customizar — `anchorUsdCents` ausente):** ghost, `text-muted`; hover → `bg-panel-2 text-ink`. Idéntico a `RefreshCw`. Lee como "utilidad disponible, no tocada".
- **Estado customizado (techo distinto del estándar 1500):** el botón queda **activo persistente** — `bg-panel-2 text-ink` en reposo (mismo recurso neutro con que el `CardCurrencyTrigger` se diferencia en `panel-3`). Comunica "esta card tiene un techo propio" **sin** usar acento ni color semántico (regla 1/2). Es la única señal de "customizado" en la barra; el valor concreto se ve al abrir (no se muestra inline, por densidad — misma decisión que moneda: chip/ícono compacto, no cifra en la barra).
- **Abierto (activo):** `bg-panel-2 text-ink` mantenido mientras el popover está abierto (igual que el disparador del popover de límites).
- **Focus (teclado):** ring `--accent-soft` 3px, radio `--r-ctl` (`focus-visible`) — cromo de foco, no dato.

##### 9.3 El popover-editor — forma

Popover **form** portaleado a `body`, anclado al disparador (mismo mecanismo de posición/colisión que `LimitsInfoPanel`: crece hacia abajo, **flipea arriba** si no hay lugar, clampea horizontal a **12px** del borde del viewport). Caja: `--panel`, borde `--line`, radio `--r-ctl` 10px, `--shadow-lg`, `animate-modal-pop` (`prefers-reduced-motion` → instantáneo). Ancho `min-w-[260px] max-w-[300px]`. Alineado al **borde derecho del disparador** (crece hacia adentro, como el popover de moneda: la barra está pegada al borde derecho de la card). Padding interno `p-[12px]`, ritmo vertical `gap-[10px]`.

Contenido, de arriba a abajo:

1. **Caption:** "Techo de la escala de color" — **11px / 600 uppercase** `tracking-[0.08em]` `--faint` (mismo caption que el popover de límites). No lleva ✕ (es un popover liviano; cierra por Esc/click-fuera/Cancelar).
2. **Input-group monto + moneda** — reusa el **patrón de monto+moneda del form de movimiento** (*Multi-moneda — cromo neutro de moneda y cotización*), no inventa uno nuevo:
   - **Input de monto:** `<input inputmode="decimal">`, cifra en **mono tabular `tnum`** alineada como el resto de montos editables del producto, agrupación es-AR (miles con `.`), color `--ink`. Caja de input estándar del DS (borde `--line`, radio `--r-ctl`, focus ring `--accent-soft`). **Prellenado** con `colorAnchorCents` formateado en la moneda de display de la card (en default, ≈ el equivalente de 15 USD ese año). Ocupa el ancho, con la moneda como adorno a la derecha.
   - **Selector de moneda:** **reusa el `CardCurrencySelect`** (chip-dropdown compacto de las 4 monedas, orden `ARS→USD→EUR→BRL`) como adorno derecho del input-group. Prellenado con la **moneda de display de la card**. Cambiarlo reconvierte el monto mostrado (mismo comportamiento que el selector de moneda del form). No se usa el `CurrencySegmented` (aquí también prima compacidad; el popover es angosto).
3. **Microcopy obligatorio** — **12px `--muted`**, una línea, debajo del input-group:
   > *Se guarda en USD y se reconvierte según el año y la moneda de la card.*

   Cubre las tres consecuencias asumidas (roadmap §P3). **El wording exacto es copy funcional a afinar por `control-analyst`** — el spec fija posición, tamaño y color; el texto final lo cierra el analista (reportar al orquestador).
4. **Fila de acciones** (`flex justify-end gap-2`, pineada al pie del popover):
   - **Guardar** — botón primario del DS (acento como acción primaria, **no** como dato — permitido). Persiste el techo (convierte a USD cents) y cierra.
   - **Cancelar** — botón ghost/secundario. Descarta ediciones sin guardar y cierra.
   - **Restablecer al estándar** — *(**agregado no solicitado — confirmar**)*: link/botón terciario `--muted` 12px, **solo visible en estado customizado**, que borra `anchorUsdCents` (vuelve al comportamiento estándar). No está en el brief; se propone porque, existiendo un default y un estado customizado, negar la vuelta al default sería un callejón. Si el orquestador no lo confirma, se omite (el usuario puede reponer 15 USD a mano).

**Cierre (clase popover, *Cierre de overlays*):** Esc / click-fuera / re-clic en el disparador / Cancelar / Guardar. **Esc, click-fuera y Cancelar descartan** las ediciones sin guardar (revierten al último valor persistido) — el cambio es no destructivo y trivialmente rehacible, así que no exige confirmación (a diferencia de un modal). Esc devuelve el foco al disparador.

##### 9.4 Estados

- **Default (ancla estándar):** disparador ghost `--muted`; al abrir, input prellenado con el equivalente de 15 USD en la moneda/año de la card; sin "Restablecer".
- **Customizado:** disparador activo `bg-panel-2 text-ink`; input prellenado con el techo propio; "Restablecer al estándar" visible.
- **Editando:** input con foco (ring `--accent-soft`); "Guardar" habilitado solo si el valor es válido y distinto del persistido (si es igual, "Guardar" puede quedar habilitado igualmente — guardar sin cambio es inocuo por el guardado en USD; ver roadmap §"Por qué se guarda en USD").
- **Inválido (monto vacío / cero / negativo — el backend exige entero positivo):**
  - **Prevención de entrada:** el input **no admite** signo negativo ni no-numéricos (`inputmode="decimal"`, filtrado a positivo) — lo inválido idealmente no se puede ni tipear (prevención de error).
  - **Vacío o cero:** **"Guardar" queda deshabilitado** (`disabled`, `opacity-60`), y aparece una **micro-línea de ayuda 12px `--muted`** bajo el input: *"Ingresá un monto mayor a cero."* (neutra, **sin rojo** — el rojo es reservado a gasto, regla 1; no se comunica el error solo por color, hay texto). No se usa `--warning` ámbar (reservado a avisos, no a validación de form).
- **Foco (teclado):** todos los controles del popover (input, selector, botones, "Restablecer") tienen ring `--accent-soft` 3px `focus-visible`. Orden de tabulación: input → moneda → Guardar → Cancelar → (Restablecer). Al abrir, el foco entra al **input de monto** (con el texto seleccionado, para reemplazo directo).

##### 9.5 Comportamiento en pantalla chica (contención, `≥ 640px`, sidebar abierto o cerrado)

El disparador es un chip de 32px que **fluye en el mismo `flex flex-wrap justify-end`** de la barra de controles (viaja junto a moneda / refrescar / quitar cuando la cabecera envuelve a segunda línea, `< --bp-wide` / con sidebar apretando el ancho). No cambia de forma ni se separa en su propia línea; el `flex-wrap` reacomoda. Los cuatro invariantes:

1. **Sin scroll horizontal del `body`:** el popover está portaleado a `body`, `position: fixed`, y **clampea su `left`/`right` a 12px del borde del viewport** — nunca empuja ancho ni genera barra horizontal, ni siquiera en el piso 640px con sidebar abierto (contenido 392px).
2. **Completo y no atrapante:** `max-height: min(60vh, 360px)` con `overflow-y-auto` interno; si el contenido (caption + input + microcopy + acciones) no entra, **scrollea dentro del popover**, con la fila de acciones siempre alcanzable (el popover es corto; casi nunca desborda). Esc / click-fuera siempre lo cierran.
3. **Ninguna acción inalcanzable:** al no haber lugar abajo, el popover **flipea hacia arriba**; el clamp horizontal garantiza que "Guardar"/"Cancelar" queden siempre on-screen. El disparador, al fluir en el wrap, nunca queda tapado.
4. **Superficie contenida:** el popover no ensancha la card ni la grilla; la grilla mantiene su propio scroll interno (§*Superficies con scroll interno*), independiente de este overlay.

##### 9.6 Checklist de aceptación visual — techo editable

- [ ] **Disparador presente y ubicado:** ícono `Gauge` 16px en la barra derecha, **entre** el chip de moneda y el botón refrescar, sin divisor extra entre moneda y él.
- [ ] **Default vs customizado:** con techo estándar el botón es ghost `--muted`; con techo propio queda **activo** (`bg-panel-2`/`--ink`) en reposo, sin acento ni verde/rojo.
- [ ] **Abre popover-form:** clic → popover con caption "Techo de la escala de color", input de monto (mono tabular), selector de moneda de 4 opciones, microcopy y acciones Guardar/Cancelar.
- [ ] **Prellenado correcto:** el input muestra el ancla vigente en la moneda de la card (en default, ≈ 15 USD reconvertidos ese año); el selector arranca en la moneda de display de la card.
- [ ] **Microcopy visible:** una línea `--muted` 12px "Se guarda en USD y se reconvierte según el año y la moneda de la card." bajo el input.
- [ ] **Mono tabular:** la cifra del techo va en IBM Plex Mono con `tnum`, agrupación es-AR.
- [ ] **Inválido:** con monto vacío o `0`, "Guardar" queda deshabilitado y aparece la ayuda neutra "Ingresá un monto mayor a cero." (sin rojo, sin ámbar); el signo `−` no se puede tipear.
- [ ] **Sin recolorear la rampa:** al guardar un techo nuevo, las celdas re-mapean `t` pero la rampa de 4 stops (verde→rojo) es la misma; ninguna cifra ni celda se tiñe de índigo o de income/expense por este control.
- [ ] **Restablecer** (si el orquestador lo confirma): visible solo en customizado; al usarlo, el botón vuelve a ghost y las celdas al ancla estándar.
- [ ] **Focus ring:** input, selector y botones muestran ring `--accent-soft` 3px con Tab; Esc cierra y devuelve foco al disparador.
- [ ] **Contención (640px, sidebar abierto/cerrado):** el popover no genera scroll horizontal del `body`, no queda cortado, flipea arriba si falta lugar abajo, y Guardar/Cancelar siempre alcanzables.
- [ ] **Ambos modos:** popover, input, chip de moneda y estados del disparador se ven correctos en claro y oscuro.

### Reporte anual de Cuotas — gantt de barras horizontales (Ola 3, P2)

Cuarto tipo de card de reporte (`installment-gantt`), hermano de `unique-grid`: misma caja (`bg-panel`, `border border-line`, `--r-card` 14px, `p-[var(--card-pad)]`, `--shadow-sm`), misma cabecera (título editable P4 + barra de controles derecha `[ YearStepper ] [ divisor --hair ] [ CardCurrencyTrigger ] [ divisor --hair ] [ X ]`), mismo modo orden P1, mismos estados de carga/vacío/error, mismo filtro de categorías como chips-toggle debajo del canvas. Lo que cambia es el **canvas**: un **gantt anual** donde el eje X = los 12 meses del año y cada **gasto en cuotas (EXPENSE)** es una **barra horizontal** que abarca los meses que ocupa (de `startMonth`, por `totalInstallments` meses), apilada en renglones por un algoritmo de packing. Encaja como una card más en la única columna de `/reportes` (1120px, `--gap` 18px) y en el `[+]`/`AddCardMenu`. **No inventa cromo nuevo**: reusa tokens, escala tipográfica, mono tabular, semánticos y el lenguaje de selectores de la cabecera.

> **Reglas duras reafirmadas para este gantt.** (1) Acá **todo es gasto** (solo EXPENSE): las barras **no** se tiñen de `--expense` rojo ni se colorea el monto en rojo por el hecho de ser gasto — el **color de la barra es el color de su categoría** (identificador, regla dura 1/2 intacta), no el semántico. (2) Todo monto va en **mono tabular** `tnum` (regla dura 3); el monto de la **etiqueta de barra** y la **cifra dominante del tooltip** son el **monto por cuota** — el **total del plan** aparece **solo** como fila rotulada dentro del tooltip (§6), nunca sobre la barra. (3) El **índigo** aparece **solo** como cromo de interacción (focus ring, hover de chips-filtro/selectores), nunca tiñendo barras ni cifras (regla dura 2).

#### 1. Librería — decisión cerrada: NO Recharts. Layout nativo CSS (Grid/absolute) sobre tabla semántica.

Esta vista **no** se construye con Recharts (ni el wrapper `chart.tsx`), igual que `unique-grid`. Un gantt es un **layout de rectángulos posicionados sobre una grilla discreta de 12 columnas (meses) × N renglones**: no es un trazo de serie continua. Recharts no tiene un primitivo de gantt; forzarlo (p. ej. un `BarChart` horizontal apilado con relleno transparente para simular el offset, o stacked bars con paddings) daría peor control de clipping, de packing por renglón, de etiquetas dentro/fuera y de los indicadores de continuación ‹/›, además de peor accesibilidad y costo de montar ejes que no se usan.

- **Primitivo:** **CSS** — una **grilla de 12 columnas** (los meses, `repeat(12, 1fr)`) que da las gridlines verticales y el header de meses, y, sobre ella, las **barras posicionadas** por renglón. Dos andamiajes válidos, **el front elige**: (a) **CSS Grid** donde cada barra es un hijo con `grid-column: <mesInicio> / span <nMeses>` y `grid-row: <renglón>`, o (b) **posicionamiento absoluto** dentro de un contenedor con `left`/`width` en `%` (col = `mes/12`) y `top` por renglón — la opción (b) es más cómoda para el **clipping** de barras que cruzan el borde del año (basta `overflow-hidden` en el contenedor + barra que excede el ancho). **Semántica de tabla/lista accesible obligatoria** por encima del layout visual: un `role="table"`/`list` o `<table>` donde cada barra es una fila anunciable ("Cuota X, marzo–mayo, $Y por cuota"), para que el lector de pantalla lea las barras sin depender de la posición. No se monta `ResponsiveContainer` ni `<svg>` de charting.
- **Por qué no Recharts:** (a) el gantt es layout de rectángulos discretos, no un trazo continuo; (b) el **packing por renglón** (reuso de renglón con descanso) es lógica de layout pura que CSS resuelve mejor que un stack de barras; (c) el **clipping al borde del año + indicadores ‹/›** se hace nativo con `overflow-hidden` + un glifo absoluto, imposible de modelar limpio en Recharts; (d) etiquetas dentro/fuera de la barra según su ancho son CSS, no labels de chart. **Esta decisión es la respuesta al roadmap "la librería la elige `control-design`": para `installment-gantt` se usa layout CSS nativo, no la librería de charting** — misma postura que `unique-grid`. Las cards `income-expense`/`by-category` **siguen** en Recharts; conviven dos motores según la forma.
- **Sin dependencia nueva.** No se agrega librería de gantt/timeline; es CSS + tokens del propio DS. (En v1 los renglones son pocos; no se necesita virtualización.)

#### 2. Recomendación de dónde vive el packing — backend (entrega `rowIndex` por barra)

**Recomendación de diseño: el packing lo calcula el backend y entrega `rowIndex` por barra (más `rowCount` total).** Fundamento de una línea: el packing es **lógica de negocio determinista** (orden por `createdAt` asc, reuso de renglón con ≥1 mes de descanso, clip al año), idéntica en cualquier cliente (web/mobile) y verificable con tests de backend; dejarla en el front la duplicaría por plataforma y la volvería un punto de divergencia. El front recibe `rowIndex`/`rowCount` y hace **solo layout** (posicionar la barra en su columna×renglón, clippear, etiquetar). El **clipping visual y los indicadores ‹/›** sí los resuelve el front (son presentación), pero **qué barra va en qué renglón** lo decide el backend.

> **Señal para análisis/contrato (cerrar con backend):** el contrato de `installment-gantt` necesita, por barra: `id`, `description` (puede ser null), `categoryId`, `amountCents` **por cuota** ya convertido a la moneda de display (mismo `?currency=`), `startMonthIndex` y `endMonthIndex` **recortados a 0–11 del año pedido** (los meses visibles), **dos flags de continuación** `continuesBefore`/`continuesAfter` (true si la compra empieza antes de enero o termina después de diciembre del año), `installmentFrom`/`installmentTo` (qué número de cuota cae en enero/diciembre visibles, para el "progreso" del tooltip), `totalInstallments`, y el **`rowIndex`** asignado por el packing (0 = renglón más cercano al eje, ascendente hacia arriba) + un **`rowCount`** a nivel respuesta. Universo de categorías para el filtro = `availableCategories` (mismas categorías con cuotas EXPENSE en el año), igual que en las otras cards. **Ambigüedad a confirmar con backend:** (i) si manda `categoryId` (front resuelve color/nombre desde `availableCategories`) — **preferencia de diseño: `categoryId`**, para no duplicar paleta; (ii) confirmar que `amountCents` es **por cuota** (coherente con el modelo `InstallmentGroup.amountCents`) y no el total de la compra. (Reportar al orquestador para que el analista lo refleje en el contrato funcional.)

#### 3. Layout del gantt

Estructura del canvas, de arriba a abajo: **header de meses (fila)** → **área de plot** (renglones de barras, de arriba hacia abajo en `rowIndex` **descendente**: el renglón 0 —el más antiguo— queda **abajo, pegado al eje de meses**, y los renglones nuevos crecen **hacia arriba**, coherente con el roadmap "el más cercano al eje X"). Sin columna de rótulo lateral (a diferencia de Únicos): la identidad de cada barra vive **en la barra** (etiqueta) y en el tooltip.

- **Grilla base:** **12 columnas iguales** (`repeat(12, 1fr)`, los meses Ene→Dic), con **gridlines verticales `--hair` 1px** entre meses para anclar la lectura temporal. Ancho total = el del canvas de la card (a 1120px, 12 × ~88px entran cómodos). En `≤940px` el bloque de plot permite **scroll horizontal** (overflow-x) manteniendo el **header de meses sticky arriba**; las 12 columnas conservan un **mínimo legible ~64px** para que ninguna barra de 1 mes quede ilegible.
- **Header de meses:** nombre corto es-AR (`Ene Feb … Dic`), **UI 12px/600 `--muted`**, centrado en su columna, sin rotar; fondo `--panel`, borde inferior `--line` 1px; sticky arriba en scroll. Idéntico registro al header de Únicos (mismo array `MONTH_LABELS_SHORT`).
- **Renglón y barra:** **alto de renglón objetivo ~30px**; la **barra ocupa ~24px de alto** centrada en su renglón (deja ~3px arriba/abajo de aire). **Gap vertical entre renglones: 6px** (separador de fondo `--panel`, las barras no se tocan). El **alto total del plot crece con `rowCount`** (`rowCount × 30 + (rowCount−1) × 6`); con muchas cuotas la card se alarga (aceptable, es una planilla anual). **Radio de barra: `--r-ctl` (10px)**, salvo los lados que tocan un borde clippeado (ver §6: el lado clippeado va recto).
- **Color de barra = color de su categoría** (el `category.color`, identificador): relleno **sólido** del color de categoría a **opacidad plena** para barras anchas; el DS ya define el ajuste de color de categoría en oscuro (*Categorías y gráficos en oscuro*), que aplica igual acá. **No** se usa `--expense` ni se colorea por tipo (todo es gasto). Borde de barra: ninguno (el color sólido + el gap de fondo bastan); en hover, la barra sube a `--shadow-sm` y un leve realce de luminosidad (`brightness(1.04)`), `transition` 140ms.
- **Posición temporal:** la barra empieza en el **borde izquierdo de la columna de su `startMonthIndex`** y termina en el **borde derecho de la columna de su `endMonthIndex`** (ocupa columnas completas: una cuota de marzo a mayo cubre íntegras las columnas Mar, Abr, May). Las cuotas se entienden como **mensuales y por mes completo** (el modelo no tiene día), así que el gantt es de **granularidad mensual**, no diaria.

#### 4. Etiqueta de la barra — el MONTO manda, el nombre acompaña; degradación por ancho

Cada barra rotula su compra con **dos piezas de jerarquía distinta**: el **monto por cuota** (pieza **primaria**, la que el ojo lee primero y la **última** que se sacrifica) y la **descripción/nombre** (pieza **secundaria**, contextual, la **primera** que se omite cuando falta ancho). La etiqueta va **dentro** de la barra cuando hay ancho; **fuera** (a la derecha) cuando ni el monto entra. La barra es un **resumen escaneable**; el detalle completo vive en el tooltip (§6) — la barra nunca tiene que decirlo todo.

**Jerarquía monto vs. nombre (cómo se distinguen).** Dentro de la barra el orden de lectura es `[monto] · [nombre]`: **el monto va primero (izquierda), el nombre lo sigue**. No comparten peso ni tamaño:

- **Monto por cuota — pieza primaria:** mono `tnum` **12px / 700**, color **por contraste pleno** contra el color de la barra (barras claras T1–T3 → `oklch(0.22 0.02 270)`; barras oscuras T5–T7 → `oklch(0.97 0.005 270)`), `shrink-0`, `tracking` normal. Es la cifra dominante de la barra. Sigue siendo el **monto por cuota** (no el total), neutro por contraste (no `--expense-ink`).
- **Nombre/descripción — pieza secundaria:** UI Space Grotesk **11.5px / 500**, **misma familia de contraste pero atenuada** (mismo color de contraste con `opacity-[0.72]`, de modo que lee como subordinado al monto sin recalcular un segundo color), `truncate` contra el ancho restante.
- **Separación entre ambos:** `gap-[8px]` + un **divisor sutil**: punto medio `·` en el color de contraste a `opacity-[0.45]` entre monto y nombre (refuerza que son dos campos, no una frase). El monto siempre arranca pegado al borde izquierdo con `pl-[9px]`; el conjunto cierra con `pr-[9px]`.

> **Por qué el monto adelante y dominante:** en un gantt de cuotas la pregunta es "¿cuánto me sale esto por mes?"; el nombre solo desambigua. Adelantar y agrandar el monto (12/700 mono) sobre el nombre (11.5/500 atenuado) hace que cada renglón se escanee como una columna de cifras alineadas a la izquierda de cada barra, y deja que el nombre se recorte sin perder la información crítica.

**Regla de degradación por ancho (el monto es lo último que se cae).** En orden, según el ancho útil de la barra:

1. **Barra ancha (entra monto + nombre):** `[monto] · [nombre…]` dentro de la barra. El nombre `truncate` ocupa el ancho que sobra tras el monto; si se corta, queda con elipsis — su detalle completo está en el tooltip.
2. **Barra angosta — caso límite 1 mes (entra el monto pero no el nombre):** **solo el monto** dentro de la barra (mono `tnum` 12px/700, centrado u alineado a la izquierda con `pl-[9px]` según quepa), **sin nombre**. El nombre se omite por completo; **no** se trunca a una o dos letras (un nombre ilegible no aporta). El monto, al ser corto, entra en la columna de 1 mes en la mayoría de los casos.
3. **Barra donde ni el monto entra (compra de monto largo en 1 columna muy estrecha, o barra clippeada en diciembre):** la barra queda como **pastilla de color sin texto interno** y **solo el monto** se renderiza **inmediatamente a la derecha** de la barra, mono `tnum` 12px/700 `--ink`, `ml-[6px]`, sobre el fondo del plot (contraste contra `--panel`, no contra la barra). El **nombre sigue omitido** (vive en el tooltip). Si a la derecha tampoco hay aire (barra que termina contra el borde derecho del plot / diciembre clippeado), el monto va **a la izquierda** de la barra; el front elige el lado con más espacio. Este es el mismo recurso "etiqueta afuera" que ya contemplaba el spec, pero **afuera viaja solo el monto**, nunca el nombre.

**Criterio de corte.** El front mide el ancho útil de la barra y decide el escalón: si entra `monto + ·  + ≥ ~6 caracteres de nombre` → escalón 1; si entra el monto pero no un nombre legible → escalón 2; si no entra ni el monto → escalón 3 (afuera). El **fallback de barra mínima** se mantiene: una barra de 1 mes ocupa **como mínimo su columna completa** (no se encoge por debajo del ancho de mes); nunca es un hilo.

**Coherencia.** Nombre siempre Space Grotesk (texto UI), monto siempre IBM Plex Mono `tnum` — la dualidad UI-label / mono-cifra del DS. El **tooltip (§6) no cambia**: sigue mostrando todo el detalle (descripción completa, categoría, período, cuotas, progreso) — la barra es el resumen, el tooltip es la ficha. La continuación no se repite como texto en el tooltip: la comunican los chevrons ‹/› (§5) y el rango real del `Período`. Sin color semántico en el monto (es gasto, pero va neutro por contraste / `--ink`, no `--expense-ink`).

#### 5. Indicadores de continuación ‹ / › — barras que cruzan el borde del año

Una compra que empieza **antes de enero** o termina **después de diciembre** del año mostrado se **clippea** a los 12 meses visibles (`overflow-hidden` del plot), con un **indicador de que continúa** fuera de la vista.

- **Glifo:** **`ChevronLeft` ‹** (continúa antes de enero, `continuesBefore`) y/o **`ChevronRight` ›** (continúa después de diciembre, `continuesAfter`), **lucide 14px**, color **por contraste contra la barra** (mismo cálculo que la etiqueta interna), `stroke-width 2.5` para que el glifo chico no se diluya. `aria-hidden` (la continuación se anuncia en el `aria-label`/tooltip de la barra: "continúa desde noviembre del año anterior").
- **Ubicación:** el chevron ‹ va **pegado al borde izquierdo** de la barra (dentro, `pl-[4px]`), cuando la barra arranca clippeada en enero; el › va **pegado al borde derecho** (dentro, `pr-[4px]`), cuando termina clippeada en diciembre. El **lado clippeado de la barra va con esquina recta** (sin `--r-ctl`) para reforzar visualmente el corte; el lado no clippeado mantiene el radio. Una barra puede llevar **ambos** chevrons (compra larga que envuelve todo el año: empieza antes de enero y sigue después de diciembre → barra de Ene a Dic con ‹ y ›).
- **No es una flecha de scroll ni un control:** el chevron es **decorativo/informativo** (`pointer-events-none`), no clickeable; comunica "esto sigue", no navega. (Cambiar de año se hace con el `YearStepper` de la cabecera.)

#### 6. Tooltip de barra

Hover sobre una barra abre el **mismo tooltip custom portaled a `body`** del DS (idéntico cromo que el de celda/footer de Únicos): `fixed z-50`, `rounded-ctl`, `border border-line`, `bg-panel`, `shadow-[var(--shadow-lg)]`, `pointer-events-none`, `role="tooltip"`, anclado `translate(-50%, -100%)` sobre el centro de la barra (o sobre el cursor). `min-width` ~`200px`.

- **Encabezado:** **swatch 8px `rounded-[3px]` del color de la categoría** + **descripción** de la compra (UI 12px/600 `--ink`; si `description` es null → placeholder `Sin descripción` en `--muted`), en una fila `gap-[7px]`. Debajo, el **nombre de la categoría** en UI 11.5px/500 `--ink-2` (resuelto desde `availableCategories` por `categoryId`). Misma palabra visual swatch+label del tooltip de by-category.
- **Cifra dominante — monto por cuota:** **mono tabular `tnum` 13px/600 `--ink`**, completo sin abreviar (`$1.234,56`), con un micro-rótulo `por cuota` en `--faint` 9px uppercase tracking a su lado o encima. Es la lectura primaria. Sin color semántico (gasto, pero neutro `--ink`).
- **Cuerpo — filas `label ⟷ valor`** (`flex flex-col gap-[5px]`, label izquierda UI 11.5px/500 `--ink-2` `flex-1`, valor derecha mono o UI según corresponda, `shrink-0`), divisor `1px --hair` opcional entre el monto dominante y el bloque:
  - **Rango de meses** — label `Período`; valor = `Mar 2026 – May 2026` (meses cortos es-AR + año, en **UI** 11px/500 `--ink-2` — es un rango de fechas, no una cifra de dinero, así que **no** va en mono). Si la compra cruza años, el rango muestra los **años reales** de inicio/fin de la compra (no recortados al año visible): ej. `Nov 2025 – Feb 2026`.
  - **Cuotas** — label `Cuotas`; valor = `N cuotas` (`totalInstallments`) en mono `tnum` 11px/500 `--ink-2`.
  - **Total del plan** — label `Total del plan`; valor = `amountCents × totalInstallments` en mono `tnum` 11px/500 `--ink-2`, en la **moneda de display de la card** (el monto de la barra ya viene convertido; no hay ambigüedad de moneda acá). Va **inmediatamente después de `Cuotas`** (la cantidad explica el total) y **antes de `Progreso`**. Se **omite si `totalInstallments === 1`** (sería idéntico a la cifra dominante). Ver *Total del plan de cuotas — las tres superficies*.
  - **Progreso** (si aplica) — label `Progreso`; valor = `cuota X de N` indicando qué cuota cae en el mes en curso (si el año mostrado es el actual y el mes en curso está dentro del rango), o `cuotas X–Y visibles este año` cuando la compra cruza el borde del año. Mono `tnum` 11px/500 `--ink-2`. Si no aplica progreso (año pasado completo, o no hay solape con el mes actual), **se omite la fila** (no `—`): el progreso es contextual, no una métrica fija.

  **Sin micro-línea de continuación.** El tooltip **no** lleva una línea "Continúa antes de…/después de…": es redundante. La continuación se comunica con los **chevrons ‹/› en los bordes de la barra** (§5) y el **rango real** del campo `Período` (que muestra mes + año reales de inicio/fin aunque crucen el año visible). Lo textual del tooltip se queda con el rango; el indicador visual vive en la barra.
- **Lenguaje coherente con Únicos:** misma caja, mismo portal, mismo anclaje, mismo registro tipográfico (encabezado UI 12px/600 `--ink`/`--ink-2`, labels UI 11.5px/500 `--ink-2`, cifras mono `tnum`), mismo swatch 8px. La diferencia es el contenido (una compra en cuotas vs. un día/mes). El `title` nativo del browser **no** se usa.

#### 7. Filtro de categorías — chips-toggle debajo del plot

Idéntico a `unique-grid` (*Reporte anual de Únicos §5*): el filtro de categorías se monta como una **fila de chips-toggle de categoría DEBAJO del plot** (componente `ChartLegend` scrollable + `LegendAllChip` "Todas/Ninguna"), separada por `margin-top` 14px. Cada chip es un toggle `aria-pressed` que activa/desactiva su categoría; toggle off → las barras de esa categoría **dejan de mostrarse** y el packing **se recalcula** (los renglones se reordenan con las barras restantes — el packing siempre opera sobre el conjunto visible, así que ocultar una categoría puede compactar renglones). **Universo = `availableCategories`** del contrato. **Un solo lenguaje de filtro** en toda la card: chips-toggle, no popover. **Nota de packing:** como el filtro recalcula el packing, el `rowIndex`/`rowCount` deben recomputarse con el subconjunto filtrado — **a confirmar con backend** si el filtro se manda como parámetro (back devuelve packing ya filtrado, preferencia de diseño por coherencia con Únicos donde el filtro va al back) o si el front re-packea en cliente. **Preferencia de diseño: el filtro viaja al backend** (mismo `?categoryIds=` que las otras cards) y el back devuelve el packing del subconjunto, para que packing viva en un solo lado (§2).

#### 8. Estados

- **Loading (skeleton):** cabecera presente; el canvas se reemplaza por el **header de meses fantasma** + **4–5 barras fantasma** de anchos/posiciones variados (`bg-panel-3 rounded-ctl animate-pulse`) repartidas en 2–3 renglones, + 2–3 chips fantasma de filtro. Mismo molde que `ChartSkeleton`/`GridSkeleton`. Sin spinner.
- **Empty (sin cuotas EXPENSE en el año):** el **header de meses se dibuja** (las 12 columnas con sus gridlines) y un **overlay centrado** "Sin gastos en cuotas en {año}." (UI 14px `--muted`), reusando el overlay de las otras cards. **No** se deja el canvas en blanco: el header de meses presente + overlay comunica "es un gantt, pero no hay barras este año".
- **Error:** idéntico a las otras cards — `AlertTriangle` 20px `--warning-ink` + "No se pudo cargar el reporte." + botón ghost "Reintentar", centrado, sin tinte de error.
- **Modo orden / mini de reorden (P1):** **sin tratamiento especial nuevo.** En modo orden la card colapsa al **mismo mini-ítem** de P1 (`[grip] · [ícono tipo] · [título] · ——— · [etiqueta tipo]`). El **ícono de tipo** de `installment-gantt` es **`CalendarRange`** (lucide, 16px `--muted`) — glifo de "rango sobre calendario" que comunica "barras que abarcan un período", distinto del `CalendarDays` de Únicos, del `AreaChart` (income-expense) y del `BarChart3` (by-category); **el mismo glifo** debe usarlo el `AddCardMenu` al ofrecer este tipo (ícono ↔ tipo consistente, igual que los otros). La **etiqueta de tipo** es **"Gastos en Cuotas"** (12px/600 `--muted`, sentence-case) — nomenclatura única del tipo (§Card de reporte → `AddCardMenu`; antes "Cuotas"). **Sin mini-preview** del gantt (misma decisión cerrada de P1: identidad por ícono+etiqueta+título). Todo lo demás (caja del mini ~56px, grip, drag in-place, salida en vivo) es idéntico a P1.

#### Restricciones duras reafirmadas

- El **color de barra** es el **color de su categoría** (identificador, regla dura 1/2), **nunca** `--expense` rojo ni semántico por tipo: acá todo es gasto y el rojo/verde no aparecen para "gasto/ingreso".
- **Todo monto** (etiqueta de barra, tooltip) va en **mono tabular** `tnum` (regla dura 3), separador coma es-AR, neutro (`--ink`/`--ink-2`, nunca `--expense-ink`). La **etiqueta de barra** y la **cifra dominante del tooltip** son siempre el **monto por cuota**; el **total del plan** vive solo en su fila rotulada del tooltip, subordinado (11px/500 `--ink-2`) — nunca compite con la cifra dominante ni sube a la barra.
- El **índigo** aparece **solo** como cromo de interacción (focus ring de chips-filtro/selectores, hover); **nunca** tiñe barras ni cifras (regla dura 2).
- El **título** de la card es Space Grotesk neutro (`--ink`/`--faint`), nunca mono ni semántico ni índigo (igual que las otras cards, P4).
- **Identidad visual en ambos modos** (regla dura 4): el texto sobre barra se calcula por contraste contra el color de categoría (independiente del modo); el color de categoría usa su ajuste de oscuro ya definido; el plot/gridlines/overlay se adaptan con sus tokens. Verificar el gantt completo en claro y oscuro.
- **El packing lo decide el backend** (`rowIndex`/`rowCount`); el front hace layout, clipping e indicadores ‹/›. Las **alertas de renglón** quedan FUERA de esta ola (futuro), por decisión de roadmap.

### Reporte anual "Inflación vs Ingresos" — gráfico de líneas (Ola 4, P5)

Quinto tipo de card de reporte (`inflation-vs-income`). Misma familia que las otras cards de `/reportes` (panel, `--line`, `--r-card` 14px, `--shadow-sm`, `--card-pad` 22px; cabecera identidad-izquierda ⟷ controles-derecha; canvas 300px `/reportes` / 220px en ≤940px; widget autónomo). El canvas es un **gráfico de líneas anual** (Recharts `LineChart`, eje X = 12 meses, eje Y = **puntos porcentuales**, con valores **negativos** → baseline en cero). **No inventa cromo nuevo:** reusa cabecera P4 + `YearStepper` + filtro, `ChartLegend` interactiva, `ChartTooltipContent`, `ChartSkeleton`, overlays de estado y los tokens existentes. Aporta: (1) un **tercer color de serie** (inflación) y su justificación, (2) el **tratamiento de "línea derivada"** para las rectas de tendencia, (3) el **eje Y con negativos** en puntos porcentuales.

> **Sobre las reglas duras de color.** Las dos series de **ingreso** se asocian al **verde income** (variando estilo, no hue, para distinguir nominal de ajustada). La **inflación** es un benchmark de contexto — no es ni ingreso ni gasto del usuario — y va en **un color neutro-graphite** que no pisa income/expense/índigo/ámbar (justificación abajo). **No** se usa rojo expense para inflación (no es un gasto), **no** se usa índigo (es marca, regla dura 2). Las cifras que el chart muestra son **puntos porcentuales**, no montos de dinero: la regla dura 3 (mono tabular) **aplica igual** a todos los ticks/valores % de este chart (van en IBM Plex Mono `tnum`), pero el **color semántico income/expense NO aplica a un %** — un % de variación de ingresos es un indicador, no una cifra de dinero; por eso las series de ingreso usan el verde **como identidad de "esto habla de tus ingresos"**, no como "monto de ingreso". Esta lectura se documenta y acota acá.

#### 1. Las 5 líneas — paleta, estilo y jerarquía

Cinco trazos sobre el mismo canvas. Tres **series de dato** (líneas plenas) + dos **rectas de tendencia** (derivadas). La jerarquía visual: las series de dato mandan (2px plenas); las tendencias son apoyo (más finas, discontinuas, atenuadas) y se **vinculan por color** a su serie de ingreso.

| # | Línea | Token / color | Stroke | Estilo | Dots | Rol |
|---|---|---|---|---|---|---|
| 1 | **Inflación (IPC del mes)** | **`--rate`** graphite (nuevo token semántico, hue ~270 neutro — abajo) | **2px** | sólida, opacidad 1 | ocultos; `activeDot` 4px en hover | benchmark de contexto |
| 2 | **Var. % ingresos (nominal)** | `--income` | **2px** | sólida, opacidad 1 | ocultos; `activeDot` 4px | serie principal de ingreso |
| 3 | **Var. % ingresos (ajustada por inflación)** | `--income` | **2px** | **dasheada `6 4`** (raya larga) | ocultos; `activeDot` 4px | misma familia verde, distinta por patrón |
| 4 | **Tendencia ingresos nominal** | `--income`, **opacidad 0.45** | **1.25px** | **punteada `2 3`** (puntos finos) | sin dots, sin `activeDot` | recta de mín. cuadrados sobre #2 |
| 5 | **Tendencia ingresos ajustada** | `--income`, **opacidad 0.45** | **1.25px** | **punteada `2 3`** | sin dots, sin `activeDot` | recta de mín. cuadrados sobre #3 |

- **Distinguir nominal (#2) de ajustada (#3) sin un segundo hue verde:** ambas son verde income — son las dos lecturas del **mismo** concepto (tus ingresos), así que comparten identidad de color (regla dura 1: verde = ingreso). Se separan por **patrón de trazo**: **#2 sólida** (la lectura cruda, nominal, primaria), **#3 dasheada `6 4`** (la lectura "corregida", derivada de aplicarle inflación). El dash comunica "esta es una versión procesada de la verde sólida", coherente con que la ajustada **se calcula a partir** de la nominal y la inflación. **No** se introduce un segundo token verde ni se cambia la luminosidad del income (eso lo reservamos para modos/oscuro): el delta nominal↔ajustada es **patrón**, no color.
- **Inflación (#1) — el tercer color, `--rate` graphite (token nuevo).** Necesita un hue que **no choque** con income (158), expense (27), índigo de marca (264) ni ámbar warning (75), y que **no se lea como semántico de dinero** (no debe parecer "ingreso" ni "gasto"). La elección es un **graphite neutro frío, hue ~270 (la familia de los neutros `--ink`), pero cromado lo justo para leerse como línea de dato y no como gridline**: `--rate` `oklch(0.45 0.03 270)` en claro / `oklch(0.72 0.025 270)` en oscuro (más luminoso para separarse del panel oscuro). **Por qué graphite y no un cuarto hue saturado:** (a) la inflación es un **dato de contexto externo** (IPC), no una métrica de la plata del usuario — un neutro-graphite la posiciona correctamente como "la vara contra la que medís tus ingresos", no como otra serie semántica; (b) cualquier hue saturado libre (cyan/teal ~200, violeta ~310) o bien se acerca peligrosamente al verde income (teal) o bien compite con el índigo de marca (violeta) y arriesga leerse como acento; (c) el graphite frío contrasta nítido contra las dos verdes sin entrar en su familia, y **nunca** se confunde con income/expense/marca. Tiene **suficiente croma (0.03)** para distinguirse del gridline `--hair` y del eje `--muted` (que son casi acromáticos), pero **no** tanto como para gritar "acento". El token es **semántico propio del chart de tasas** (lo consume solo este chart y, a futuro, otros indicadores de tasa); sigue la dualidad `@theme`/`:root` como income/expense.

  > **Señal para `control-frontend` / portado de tokens:** `--rate` (`-soft`/`-ink` si hicieran falta para tooltip o estados) es un **token nuevo** a portar a Tailwind v4 (`@theme` + `:root` claro/oscuro), en la familia de los neutros pero como semántico propio. Valores: claro `oklch(0.45 0.03 270)`, oscuro `oklch(0.72 0.025 270)`. (Reportar al orquestador para `docs/frontend.md` → sección Design system, lo escribe el analista.)

- **Las tendencias (#4, #5) se leen como derivadas, no como series.** Tres señales simultáneas, las tres respecto de su serie madre de ingreso: **(a) más finas** (1.25px vs. 2px de las series), **(b) punteadas `2 3`** (puntos finos, distintos del dash `6 4` de la serie ajustada — el ojo separa "serie real dasheada larga" de "tendencia punteada corta"), **(c) atenuadas a opacidad 0.45**. Van en **el mismo verde income** que su serie de ingreso (vínculo de color: la tendencia es "hacia dónde va esta verde"), **sin dots ni `activeDot`** (una recta no tiene puntos-mes que inspeccionar; es una proyección, no una lectura mensual). Se trazan **debajo** de las series de dato (orden de pintado: tendencias primero, series encima) para que el punteado tenue no tape el trazo pleno. **No hay tendencia para la inflación** (decisión de producto: solo 2 rectas, sobre nominal y ajustada).
- **Orden de pintado (z):** tendencias (#4, #5) al fondo → inflación graphite (#1) → ingresos ajustada (#3) → ingresos nominal (#2) arriba (la lectura cruda manda visualmente). El `activeDot` de hover de las tres series queda por encima de todo.
- **Curva:** las **series de dato** (#1, #2, #3) usan `monotone` (suavizado suave, coherente con la Forma 1). Las **tendencias** (#4, #5) son `linear` por definición (recta de mínimos cuadrados — una línea recta, sin suavizar).
- **Prohibido:** teñir cualquier línea con **índigo** (regla dura 2) o con un **color de categoría**; usar **rojo expense** para la inflación (no es un gasto). El verde income se usa **solo** en las dos series de ingreso y sus tendencias.

> **Dónde se calculan las rectas de tendencia — señal de producto.** La recta de mínimos cuadrados sobre cada serie de ingresos es un **cálculo de dato**, no una decisión visual. Preferencia de diseño (por coherencia con cómo el packing del gantt y el ancla de la grilla viven en el backend): que el **backend entregue los dos puntos extremos de cada recta** (o la pendiente+intercepto), para que el front solo trace. Si esto es ambigüo en el contrato, es decisión funcional del analista — **el diseño no la cierra**. (Reportar al orquestador.)

#### 2. Eje Y con negativos, baseline en cero, gridlines y ticks

- **Eje Y = puntos porcentuales, con negativos.** A diferencia de los charts de monto (siempre ≥0), este eje **cruza el cero**: la variación de ingresos puede ser negativa (mes que cayó) y la ajustada por inflación lo es con frecuencia. El dominio se calcula simétrico/holgado alrededor de los datos (`['dataMin - pad', 'dataMax + pad']`), con `pad` que evite que las líneas toquen el borde.
- **Baseline en cero — obligatoria y marcada.** La línea `y = 0` es la **referencia de lectura** ("¿creció o cayó?") y va **más marcada que los gridlines**: `ReferenceLine y={0}` en **`--line` 1px sólida** (un escalón sobre el `--hair` de los gridlines), recta a lo ancho del plot. Es el ancla semántica del chart: arriba del cero = creció / inflación positiva; abajo = cayó. **No** es índigo ni semántica de color — es cromo neutro estructural.
- **Gridlines:** solo horizontales, `--hair` 1px sólidas (mismo recurso que la Forma 1). Sin gridlines verticales. La baseline en cero **reemplaza** al gridline de su altura (no se dibujan dos líneas en y=0).
- **Ticks del eje Y — formato % en mono tabular.** Los ticks son **puntos porcentuales con signo**: `+10%`, `+5%`, `0%`, `−5%`, `−10%` (signo `+` para positivos para enfatizar que es variación; signo menos `U+2212` para negativos, coherente con el DS; `0%` sin signo). **Mono tabular** `tnum` (regla dura 3 — son cifras), **11.5px `--muted`**, separador decimal coma es-AR si hubiera decimales (normalmente enteros). Sin línea ni ticks visibles del eje; 4–6 ticks "lindos" simétricos alrededor del cero. **El color del tick es neutro `--muted`** — un % no es un monto, no lleva color income/expense.
- **Eje X (meses):** idéntico a la Forma 1 — nombre corto del mes es-AR (`Ene … Dic`), UI 12px/500 `--muted`, sin rotación, `axisLine`/`tickLine` ocultos.

#### 3. Leyenda — interactiva, 5 ítems, las tendencias agrupadas a su serie

La leyenda **es el filtro** (mismo `ChartLegend` interactivo, *Leyenda interactiva (la leyenda es el filtro)*), pero el universo es **fijo de series** (no categorías abiertas), así que es un **set corto y fijo: pocos ítems, sin `LegendAllChip`** (el atajo "Todas/Ninguna" no aplica — son 3 toggles, no un universo largo de categorías).

- **Tres ítems toggle (uno por serie de dato), no cinco.** La leyenda lista **las 3 series** que el usuario puede prender/apagar:
  1. **"Inflación"** — swatch graphite `--rate`.
  2. **"Ingresos (nominal)"** — swatch `--income`, swatch **sólido**.
  3. **"Ingresos (ajustado)"** — swatch `--income`, pero el swatch lleva un **patrón dasheado** (una mini-muestra de línea dasheada de 14px en vez del cuadrado pleno) para que el swatch comunique "es la verde dasheada", no se confunda con la nominal. Si un swatch-línea complica, alternativa: cuadrado `--income` con un **borde dasheado** y centro `--panel` (hueco), pero la **mini-línea dasheada es la forma preferida** (comunica trazo, no relleno).
- **Las 2 tendencias NO son ítems propios de la leyenda.** Una recta de tendencia es **derivada** de su serie: no se prende/apaga por separado, **sigue la visibilidad de su serie madre** (toggle "Ingresos (nominal)" off → su tendencia #4 también desaparece; ídem ajustada/#5). Meter 5 toggles (con 2 que no controlan nada propio) recargaría y confundiría. La leyenda se queda en **3 toggles de dato**; las tendencias son lectura visual ligada a su serie. Para que el usuario sepa que existen, el ítem de cada serie de ingreso puede llevar una **micro-anotación** opcional, pero la decisión cerrada es: **leyenda = 3 ítems**, tendencias implícitas.
- **Estados del ítem:** idénticos a la leyenda interactiva del DS (activo/hover/apagado con swatch a outline + label `line-through` + opacidad 0.7 / focus ring `--accent-soft` / pressed `--panel-3`). `role="group"` `aria-label="Filtrar series"` (es leyenda de series fijas, no de categorías). Apagar las 3 → canvas vacío → el empty estándar (abajo); la leyenda no se bloquea.
- **Posición/espaciado:** debajo del canvas, `margin-top` 14px, alineada a la izquierda, `flex-wrap`, sin `LegendAllChip`, sin región scrolleable (son 3 ítems fijos — nunca escalan).

#### 4. Tooltip por mes — los 3 valores en %, mono tabular

Reusa `ChartTooltipContent` (caja `--panel`/`--line`/`--r-ctl`/`--shadow-lg`, padding 10×12, encabezado mes+año UI 12.5px/600 `--ink`). Una fila por **serie de dato visible** en ese mes:

- **Filas (3 máx., solo series visibles):** swatch (8px, con el mismo tratamiento de la leyenda: graphite para inflación, sólido para nominal, mini-dash para ajustada) + nombre UI 12.5px `--ink-2` a la izquierda + **valor en puntos porcentuales mono tabular `tnum`** a la derecha, con signo (`+8,3%` / `−2,1%` / `0%`), separador coma es-AR, **sin abreviar**.
- **Color del valor — neutro, NO semántico.** El valor % va en **`--ink`** (neutro); el color lo da el **swatch**, no el número. Un % de variación **no** lleva color income/expense (no es un monto; sería falsa semántica recolorear un −2,1% de rojo). Excepción deliberada: **ninguna** — los tres valores van neutros, identificados por swatch. (Esto difiere de la Forma 1, donde el monto de ingreso/gasto sí va `--income-ink`/`--expense-ink`: allá es **dinero**; acá es un **indicador %**.)
- **Las tendencias NO aparecen en el tooltip.** Una recta de tendencia no tiene un "valor del mes" que inspeccionar (es una proyección global, no una lectura mensual); listar su valor interpolado por mes sería ruido sin sentido de lectura. El tooltip lista **solo las 3 series de dato**. Decisión cerrada.
- **Cursor de hover:** guía vertical `--hair` 1px (es chart de líneas, mismo recurso que el área de la Forma 1). `activeDot` 4px en cada serie de dato visible (relleno del color de la serie, borde `--panel` 2px); las tendencias **no** muestran `activeDot`.
- **Mes vacío / futuro:** si el mes no tiene dato (futuro, ver §6), no se traza punto ahí y el tooltip de ese mes no muestra filas de series sin dato (o no abre, según el patrón vigente del chart).

#### 5. Cabecera de la card — molde simple (como `income-expense`/`unique-grid`)

Cabecera de **una sola línea** `flex justify-between` (molde simple, sin `ViewTabs` — esta card no tiene vistas alternas): **título editable P4 a la izquierda** (16px/600 `--ink`, placeholder "Reporte N" en `--faint`; toda la anatomía P4 sin cambios) ⟷ **barra de controles a la derecha**, idéntica a las otras cards: `[ YearStepper ] [ divisor --hair ] [ CardCurrencyTrigger ] [ divisor --hair ] [ X quitar ]`.

- **YearStepper:** mismo control y mismas reglas de límite (`earliestYear` / año en curso), año en mono tabular. Navegación activa.
- **Selector de moneda (`CardCurrencyTrigger`):** **a confirmar con el analista si aplica.** Las otras cards lo llevan porque sus cifras son **montos** que reconvierten por moneda. Acá las cifras del chart son **puntos porcentuales** (la variación % de ingresos es adimensional respecto de la moneda; la inflación es un IPC). **Una variación % no cambia con la moneda de display** → el selector de moneda **no tendría efecto sobre el chart**. Preferencia de diseño: **no montar `CardCurrencyTrigger`** en esta card (como tampoco lo monta el Dashboard), salvo que el cálculo de la variación de ingresos dependa de la moneda en que se miden los ingresos (decisión funcional). **Frená y consultá al analista** si la moneda afecta el cálculo — no es decisión de diseño. Si no aplica, la barra queda `[ YearStepper ] [ divisor ] [ X ]`.
- **Filtro de categorías:** **a confirmar con el analista si aplica.** El concepto de "variación de ingresos" podría o no filtrarse por categorías de ingreso. Si el producto define que se filtra, se monta como la **leyenda interactiva de 3 series** (§3) — que ya es el filtro — y/o, si fuera por categorías de ingreso, como chips-toggle debajo (patrón `unique-grid`/gantt). **Decisión de producto, no visual** — frená y consultá. Por defecto, sin filtro de categorías adicional: el filtro es la leyenda de series.
- **X quitar / confirmación inline / Dashboard:** idénticos a las otras cards. (Si esta card llega al Dashboard es decisión de producto; por defecto vive solo en `/reportes`.)

#### 6. Estados

- **Loading (skeleton):** cabecera presente e inerte; canvas reemplazado por bloque del alto del canvas (`bg-panel-3 rounded-ctl animate-pulse`) + 3 chips fantasma de leyenda. Mismo `ChartSkeleton`. Sin spinner.
- **Vacío (año sin datos / filtro vacío):** los 12 meses se dibujan con su eje X completo y la **baseline en cero visible** (el chart "existe" pero sin líneas), + overlay centrado **"Sin datos en {año}."** (UI 14px `--muted`), sin error ni ilustración. Si **apagar las 3 series** por la leyenda vacía el canvas → mismo overlay. La baseline en cero presente comunica "es un chart de variación, pero no hay datos este año".
- **Meses futuros (año en curso) — la línea termina en el mes en curso.** A diferencia de los charts de monto (que dibujan los meses futuros en cero), acá **una variación de un mes que no ocurrió no es "0%", es inexistente**: las series **se cortan en el mes en curso** y no se trazan puntos para meses futuros (`connectNulls={false}`, dato `null` de ahí en más). El eje X **sí** muestra los 12 meses (la grilla del año completa), pero las **líneas terminan** donde termina el dato. Las **rectas de tendencia** se calculan **solo con los meses con dato** (no se proyectan sobre el futuro vacío). Es la diferencia semántica clave: cero ≠ ausencia para una tasa de variación.
- **Error:** idéntico a las otras cards — `AlertTriangle` 20px `--warning-ink` + "No se pudo cargar el reporte." + botón ghost "Reintentar", centrado, sin tinte de error.
- **Modo orden / mini de reorden (P1):** colapsa al mismo mini-ítem (`[grip] · [ícono tipo] · [título] · ——— · [etiqueta tipo]`). **Ícono de tipo:** `TrendingUp` (lucide, 16px `--muted`) — ver §7. **Etiqueta de tipo:** **"Inflación vs Ingresos"** (12px/600 `--muted`, sentence-case). Sin mini-preview (misma decisión P1). Resto idéntico a P1.
- **`prefers-reduced-motion`:** las líneas **no** animan su *draw* de entrada (`isAnimationActive={false}`); el tooltip aparece sin transición; cambio de año instantáneo. Regla obligatoria del DS.
- **Movimiento (con motion permitido):** las líneas animan su *draw* de entrada (~0.4s ease-out, mismo timing que las áreas/barras). Las tendencias entran con el mismo timing, atenuadas.

#### 7. Menú "[+]" (5ª entrada) y nomenclatura del tipo

Quinta opción del `AddCardMenu`, siguiendo la nomenclatura única (§Card de reporte → `AddCardMenu`): `[ícono de tipo 16px --muted] · [nombre]`, mismo glifo que el mini de reorden usa para este tipo.

- **Nombre de display:** **"Inflación vs Ingresos"** (sentence-case, igual nomenclatura que "Ingresos vs Gastos" / "Gastos por categoría" / "Gastos Únicos" / "Gastos en Cuotas").
- **Ícono:** **`TrendingUp`** (lucide, 16px `--muted`). Es el glifo coherente con un **gráfico de líneas / tendencia** y se distingue nítido de los 4 existentes (`AreaChart` income-expense, `BarChart3` by-category, `CalendarDays` unique-grid, `CalendarRange` installment-gantt): ninguno de esos comunica "línea ascendente / tendencia", que es exactamente lo que este reporte muestra (variación e inflación a lo largo del año, con rectas de tendencia). **El mismo `TrendingUp`** lo usa el mini de reorden (ícono ↔ tipo consistente). En neutro `--muted`, nunca semántico ni índigo.
- **Sub-descripción** (línea de apoyo bajo el nombre en el menú, mismo molde que las otras entradas si lo tienen): **"Variación de tus ingresos frente a la inflación, mes a mes."** UI 12px `--muted`. Comunica de qué va el reporte sin tecnicismos (no menciona "mínimos cuadrados").
- **Etiqueta de tipo (mini de reorden):** **"Inflación vs Ingresos"** — el mismo nombre del menú (nomenclatura única), 12px/600 `--muted`, sentence-case.

#### Restricciones duras reafirmadas

- **Verde = ingreso, rojo = gasto.** El **verde income** se usa **solo** en las dos series de ingreso (#2, #3) y sus tendencias (#4, #5) — como identidad de "esto habla de tus ingresos". El **rojo expense NO aparece** en este chart (no hay gasto; la inflación no es un gasto y va en graphite `--rate`, no en rojo). No se recolorea ningún % por su signo (un −2,1% de ingresos sigue en su identidad verde / valor neutro, nunca rojo).
- **El acento índigo no aparece** salvo focus rings de leyenda/controles (cromo de interacción). La baseline en cero, gridlines y ejes son **neutros** (`--line`/`--hair`/`--muted`), nunca índigo.
- **Toda cifra del chart va en mono tabular** (regla dura 3): los ticks del eje Y (% con signo) y los 3 valores del tooltip, todos en IBM Plex Mono `tnum`, separador coma es-AR. (Son puntos porcentuales, no montos; el mono aplica por ser cifra, el color semántico income/expense NO aplica por no ser dinero.)
- **El título** de la card es Space Grotesk neutro (`--ink`/`--faint`), nunca mono ni semántico ni índigo (igual que las otras cards, P4).
- **`--rate` es un token nuevo** (graphite neutro hue ~270, semántico propio de tasas): no toma valor de `--ink`/`--muted` (necesita su propio croma 0.03 para leerse como línea de dato), no es income/expense ni índigo. Identidad visual en ambos modos (regla dura 4): tiene su stop claro/oscuro; verificar las 5 líneas + baseline en claro y oscuro (el verde income y el graphite deben mantener separación en ambos modos).

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

### Toggle Barra ↔ Línea en la card `by-category` (Gastos por categoría)

> **Reagrupamiento de tipos (decisión de producto cerrada).** Antes, la card `income-expense` ("Ingresos vs Gastos") llevaba dos tabs "Total" / "Por categoría", y el apilado por categoría existía además como vista B de esa card. **Eso se reagrupa:** `income-expense` queda **solo con la vista Total** (sin tabs — su cabecera vuelve a ser solo la barra de controles, ver §`income-expense` sin tabs abajo), y la card `by-category` ("Gastos por categoría") gana un **toggle Barra ↔ Línea**. La **vista Línea** es exactamente el stack de áreas apiladas que esta sección describe (antes "vista B" de `income-expense`): el **mismo render, ahora viviendo como un modo de `by-category`**. Verde/rojo y `category.color` mantienen su significado intacto.

La card de reporte `by-category` ("Gastos por categoría", `BarChart` apilado — Forma 2) tiene un **selector de modo** que alterna entre **dos representaciones del mismo dato** (gasto por categoría, mes a mes), sin cambiar de tipo de card ni de altura de canvas. Aplica **idéntico** en `/reportes` (la card del Dashboard solo monta `income-expense`, que no lleva este toggle). Ambos modos grafican **solo gastos** descompuestos por categoría (`categories[]`); cambia el **encuadre** (barras discretas vs. áreas continuas), no el dato.

- **Modo Barra — "Barra" (default):** las **barras apiladas** de la Forma 2 tal cual (una barra por mes, una banda `category.color` por categoría, total de gastos del mes). Es el render histórico de `by-category` y el **default** del toggle.
- **Modo Línea — "Línea":** **un único stack de áreas apiladas** en el mismo canvas, subiendo desde cero: N áreas de gasto apiladas, una por categoría (`categories[]`), que suman la **línea de gasto del mes**, con trazo de áreas continuas `monotone`. **No hay desglose de ingresos** (no hay segundo stack, ni rótulos por tipo): es el total de gasto del mes descompuesto en sus categorías, en skin de áreas. **No** son barras. El modo Línea usa **solo `categories[]`** (gastos) — el mismo array que el modo Barra; cambia la geometría, no la fuente.

#### 1. El selector de modo — DOS TABS horizontales en la cabecera de la card

El cambio de modo se presenta como **dos tabs ("Barra" / "Línea") una al lado de la otra, alineadas en el mismo eje X (horizontal)**, ubicadas en la cabecera de la card. **No** es un segmented control: es el **mismo patrón de tabs underline neutras** que llevaba `income-expense` (ahora reusado acá), con labels "Barra"/"Línea".

- **Forma de las tabs (patrón underline neutro — reusado tal cual).** Dos labels en una fila horizontal, separados por `gap-[18px]`. Cada tab: texto **13px / 600**, `py-[6px]`, sin relleno ni pista de fondo (no hay track tipo segmented). La **tab activa** se marca con un **underline indicador 2px `--ink`** pegado al borde inferior de la fila de tabs (no semántico, no índigo: el modo de visualización es neutro) + texto a `--ink`. La **tab inactiva**: texto `--muted`, sin underline; **hover** → texto `--ink-2` y un underline 2px `--line-strong` (afordancia de clickeabilidad). El underline activo **se desliza** horizontalmente entre las dos tabs (transición `transform`/`left` + `width` 0.18s ease-out; instantáneo con `prefers-reduced-motion`).
- **Por qué underline neutro y no índigo ni segmented:** las tabs eligen **modo de representación**, no un tipo income/expense ni una acción de marca. El underline `--ink` es la señal de "estás acá" más sobria del DS, y libera la cabecera de la pista gris del segmented (que competiría con el stepper, el filtro y el selector de moneda). El acento índigo **no** se usa (es marca, no estado de un control de datos); el verde/rojo **no** se usa (no hay tipo que comunicar: ambos modos son gasto).
- **Etiquetas:** **"Barra"** (modo barras) / **"Línea"** (modo áreas apiladas). Nombran la **geometría** (cómo se ve el mismo dato), no un subconjunto de datos. Default: **"Barra"** (la representación histórica de `by-category`).
- **Lado y orden en la cabecera — tabs a la IZQUIERDA, controles a la derecha.** La cabecera de `by-category`, que hoy es de **una sola línea** con el **título editable** a la izquierda y los controles a la derecha (`flex justify-between`), pasa a tener **tres piezas en su zona izquierda**: el título **y debajo** las dos tabs. Concretamente:
  - **Izquierda (zona de identidad + vista):** una columna `flex flex-col gap-[8px]` con **(1) el título editable P4** (16px/600, su tratamiento no cambia) y **(2) debajo, las dos tabs** (`[Barra] [Línea]`). El título sigue siendo la identidad de la card; las tabs son el control de **representación** y se subordinan al título (por eso van **debajo**, no reemplazándolo). El título sigue truncando contra su ancho.
  - **Derecha (la barra de controles ya existente, sin reordenar internamente):** `[stepper de año] [selector de moneda] [· divisor + X quitar]`, con el mismo `gap-2` de hoy. Stepper, moneda y filtro (leyenda) **modulan** lo que las tabs eligieron.
  - **Por qué las tabs van DEBAJO del título acá y no a la izquierda en una sola fila (a diferencia de cómo se ubicaban en `income-expense`).** En `income-expense` la identidad era solo el título y las tabs lo encabezaban; acá `by-category` ya tiene su **título editable** ocupando la zona de identidad izquierda en una cabecera de una línea (P4). Meter las tabs **en la misma fila** que el título las haría competir con él por el ancho de identidad y por la jerarquía. Apilarlas **debajo del título** mantiene el título como la identidad de primer nivel y deja las tabs como un sub-control claramente subordinado, sin romper el `justify-between` (título+tabs a la izquierda, controles a la derecha). La fila de controles de la derecha se **alinea al tope** (`items-start`) de la zona izquierda, para no descolgarse al crecer la columna de identidad.
- **Responsive (≤940px / cabecera angosta):** los controles de la derecha ya envuelven a una segunda línea por el `flex-wrap` existente de `by-category`; la columna título+tabs de la izquierda **no cambia de forma** (el título arriba, las tabs debajo). Las tabs **nunca** se colapsan en un menú ni cambian a segmented: siempre son dos labels horizontales con su underline.
- **a11y:** `role="tablist"` `aria-label="Representación del reporte"` con dos `role="tab"` (`aria-selected`), cada uno controlando el `role="tabpanel"` del canvas (`aria-controls` / `id`). Navegable por teclado (flechas izq/der mueven la selección, según patrón ARIA tabs). **Focus ring:** `--accent-soft` 3px sobre la tab enfocada (mismo focus ring del DS para controles; el ring de foco sí puede ser acento — es cromo de interacción, no estado de datos ni monto).
- **Solo en la card `by-category`.** La card `income-expense` **ya no lleva tabs** (queda Total-only, ver abajo); `unique-grid` e `installment-gantt` tampoco.
- **El filtro (leyenda interactiva) y el resto de controles valen en ambos modos.** En ambos modos, togglear categorías por la leyenda recorta el stack de gasto (las categorías excluidas no aportan banda/área). El stepper de año, el selector de moneda y sus límites no cambian con el modo. El estado de filtro (`categoryIds`) y de moneda se conserva al alternar Barra↔Línea.

#### 2. El modo Línea — el stack de solo-gastos

Un **único stack de gasto** sube desde cero en el canvas, con el mismo skin de áreas continuas de la Forma 1. El color **identifica la categoría**; la **firma de gasto** la da la línea de contorno superior (regla dura 1/2 intacta).

- **Color de cada banda = `category.color` (identificador), regla dura 1/2 intacta.** Cada banda usa el `color` de su `categories[]`. El color es **solo identificador de categoría**, nunca comunica gasto (eso lo hace la línea de contorno). No se retiñe ninguna banda con rojo expense.
- **Línea de contorno superior del stack = la firma de gasto del mes.** La suma del stack (el total de gasto del mes) se traza como **línea de contorno superior** en `var(--expense)`, **2px**, opacidad 1, `monotone` — el mismo trazo de la línea de gasto que usa la Forma 1 de `income-expense`. El modo Línea es ese total de gasto con su área **descompuesta en bandas por categoría debajo**, lo que comunica "esto es gasto" con el semántico correcto (rojo solo en el contorno), sin teñir las bandas. (El modo Barra, en cambio, **no** lleva línea de contorno: el total del mes lo da el tope del apilado de barras, como en la Forma 2 vigente.)
- **Relleno de las bandas (fill):** cada banda se rellena con su `category.color` a **opacidad 0.55** (más sólida que el 0.14 de las áreas income/expense, porque acá las bandas son la descomposición que hay que distinguir entre sí, no áreas translúcidas que se solapan). El degradé translúcido de las áreas income/expense **no** se usa en las bandas. (Equivale, en intención, a la opacidad de las barras del modo Barra: la banda debe leerse sólida.)
- **Separadores entre bandas:** 1px `var(--panel)` (blanco) entre bandas apiladas, **mismo recurso que las barras de la Forma 2** (`stroke="var(--panel)"` `strokeWidth={1}`), para que dos categorías de color parecido no se fundan. Crítico con muchas categorías y colores reciclados.
- **Orden de apilado (stack order):** determinístico y estable entre meses. El stack se apila **de mayor a menor gasto anual** de la categoría (la de mayor gasto anual en la base) — los datos ya vienen ordenados así (`categories[]` por gasto anual DESC). El orden es **el mismo para los 12 meses** (no se reordena por mes), para que el ojo siga cada banda horizontalmente.
- **Muchas categorías (legibilidad) — sin agrupar en v1:** se muestran **todas** las categorías con gasto en el año, cada una en su banda, sin agrupar ni colapsar (fiel a la Forma 2). Recursos de legibilidad, todos visuales (no cambian datos): orden de apilado mayor→menor (bandas grandes en la base, finas arriba), separadores 1px `--panel`, leyenda con `flex-wrap`. (Post-v1, candidato a evaluar igual que en Forma 2: banda "Otras" para la cola. Fuera de v1 sin decisión explícita.)

#### 3. Leyenda en modo Línea

Reutiliza `ChartLegend` (swatch 10px radio 3px + etiqueta UI 12.5px/500 `--ink-2`, `flex-wrap`, `margin-top` 14px). **La leyenda de categorías es idéntica a la del modo Barra** (mismo universo, mismo orden, mismo filtro): el toggle Barra↔Línea **no** cambia la leyenda.

- **Un único grupo plano:** un ítem por categoría de gasto (swatch `category.color` + nombre), en el **mismo orden del apilado** (mayor a menor gasto anual), separación estándar entre ítems (16px), `flex-wrap`. **No** hay rótulos "Gastos"/"Ingresos" ni dos grupos: es solo gastos, no hay tipo que rotular. Es la **misma leyenda interactiva** (filtro de categorías) que el modo Barra ya monta; cambiar de modo conserva su estado de filtro.
- Las cifras **no** van en la leyenda (van en el tooltip). La leyenda es color → nombre.

#### 4. Tooltip en modo Línea

Reutiliza `ChartTooltipContent` siguiendo el patrón de la Forma 2 (`Form2Tooltip`) **tal cual** — el **mismo tooltip que el modo Barra**, un único bloque de gastos:

- **Encabezado:** mes y año (ej. "Marzo 2026"), igual que hoy.
- **Filas:** una por categoría de **gasto** con valor > 0 en ese mes (`categories[].monthlyExpenseCents[mes]`): swatch con `category.color` + nombre `--ink-2` + monto **mono** en `--ink` (el color lo da el swatch, no el número; un gasto de categoría no se recolorea). Categorías con valor 0 en el mes se **omiten** (igual que la Forma 2).
- **Total:** fila **"Total gastos"** + monto mono `--expense-ink`, separada por `--hair` (es el total de gastos del mes — sí es expense). Mismo patrón exacto que `Form2Tooltip` hoy. **No** hay bloque ni total de ingresos.
- Si el mes está vacío (sin gastos), no hay tooltip (igual que hoy).
- **Cursor de hover:** en modo Línea, guía vertical `--hair` 1px (es área); en modo Barra, la franja vertical `--accent-soft` de las barras (Forma 2) — cada modo conserva el cursor de su geometría.

#### 5. Estados (modo Línea)

Heredan el comportamiento ya vigente de la card `by-category`; sin tokens nuevos. (Los estados del modo Barra son los de la Forma 2, ya speceados.)

- **Vacío (año sin gastos):** los 12 meses se dibujan en cero (eje X completo), overlay centrado "Sin movimientos en {año}." (texto UI 14px `--muted`), sin error — **idéntico** al empty actual de la card. Si el **filtro** vacía la vista (todas las categorías deseleccionadas), mismo empty.
- **Loading:** mismo skeleton del DS de la card (bloque `bg-panel-3 rounded-ctl animate-pulse` del alto del canvas + chips fantasma de leyenda). La cabecera —incluidas las tabs— ya está presente e inerte mientras carga.
- **Error:** mismo tratamiento de la card (ícono `AlertTriangle` 20px `--warning-ink`, "No se pudo cargar el gráfico.", botón ghost "Reintentar").
- **`prefers-reduced-motion`:** las áreas apiladas **no** animan su *grow* de entrada ni al cambiar de año/modo (`isAnimationActive={false}`); el cambio entre Barra y Línea es instantáneo (sin morph/cross-fade); el underline de las tabs no se desliza (cambia de posición instantáneo). El tooltip aparece sin transición. Regla obligatoria del DS.
- **Cambio de modo Barra↔Línea (con movimiento):** reanima el *grow* del canvas entrante (~0.4s ease-out, mismo timing que las barras/áreas) y el underline de la tab se desliza (0.18s). **No hay morph entre las dos geometrías** (barras ↔ stack de áreas son topologías distintas): la representación saliente desaparece y la entrante crece desde la base/cero. Se evita una transición ambigua entre "barras discretas" y "áreas continuas". El año y el filtro de categorías se conservan a través del cambio (solo cambia el render).

#### Restricciones duras reafirmadas

- **Verde = ingreso, rojo = gasto** — en modo Línea, el rojo aparece **solo** en la **línea de contorno** del stack y en el **total** del tooltip; en modo Barra no aparece rojo (las barras son `category.color` y el total vive en el tooltip). Nunca en las bandas/barras de categoría ni en los montos por categoría (esos van por `category.color` / `--ink`). El verde income **no** aparece en ningún modo (esta card es solo gastos).
- **El acento índigo no aparece en esta card** salvo el **focus ring** de las tabs y los controles (cromo de interacción, no estado de datos ni monto). El indicador de tab activa es `--ink` (neutro), no acento.
- **Toda cifra del tooltip va en mono tabular.**

> Reutiliza: el patrón de **tabs underline neutras** (antes en `income-expense`, ahora acá con labels Barra/Línea); las **barras apiladas** de la Forma 2 (modo Barra); las **líneas/degradés** del trazo de gasto (modo Línea, contorno rojo); los **separadores 1px `--panel`** y el **orden de apilado mayor→menor estable** comunes a ambos modos; `ChartLegend` y `ChartTooltipContent` (patrón `Form2Tooltip`) tal cual, **compartidos** entre los dos modos. Aporta: el **toggle Barra↔Línea** en la cabecera de `by-category` y el **modo Línea de un único stack de gastos por categoría** (línea de contorno rojo = firma de gasto; bandas = `category.color` identificador).

### `income-expense` (Ingresos vs Gastos) — sin tabs, Total-only

Con el reagrupamiento, la card `income-expense` **pierde su toggle de vista**: queda **solo con la vista Total** (las dos áreas superpuestas income/expense de la Forma 1). Su antiguo modo "Por categoría" se mudó al modo Línea de `by-category` (arriba).

- **Cabecera sin fila de tabs.** Se **elimina la fila de tabs underline** de su cabecera. La cabecera vuelve a su forma simple de las otras cards: **título editable P4 a la izquierda ⟷ barra de controles a la derecha** (`flex justify-between` de una línea), sin la columna título+tabs que tuvo mientras existía el toggle. La barra de controles (`[stepper año] [moneda] [· divisor + X]`) no cambia (el filtro es la leyenda interactiva debajo del canvas, no un control de la barra).
- **Sin morph de salida del toggle.** No queda rastro del control: la cabecera es la de una card de un solo modo. No hay "tab Total" residual ni segmented de un solo ítem.
- **Footer = leyenda-filtro de categorías.** El footer bajo el canvas es la **leyenda-filtro de categorías tildables** — el mismo patrón que `by-category` y el resto de las cards (lista de nombres de categoría tildables que actúan como filtro de cómputo). No es una leyenda de series: la card sigue siendo **Total-only** (dos líneas Ingresos/Gastos) y **no descompone por categoría**. Tildar/destildar una categoría acota **qué movimientos alimentan las dos líneas** (filtro de cómputo, estado `null`=todas / `[]`=ninguna / lista), sin convertir las categorías en series. **Quién controla cuántas líneas se ven es la Dirección** (ver *Filtros … RF-REP-014*), no el footer: el footer filtra el cómputo de las líneas en alcance, la Dirección define cuántas líneas hay. El swatch de cada categoría en el footer es un **identificador de categoría** (recognition para re-tildar), **no** una clave de color del canvas — ver *Leyenda interactiva* para su tratamiento y el matiz del swatch en `income-expense`.
- **Dashboard.** El Dashboard monta `income-expense` y por ende queda **Total-only, sin tabs** — su cabecera pierde igualmente la fila de tabs. La card del Dashboard es **efímera y despojada**: **no monta los filtros de cómputo** (Dirección/Tipo/Categoría) y por ende **no lleva la leyenda-filtro de categorías en el footer**. Sus dos líneas (Dirección = Ambos por default) se identifican por su **color semántico** (verde ingreso / rojo gasto) y por una **leyenda decorativa de 2 series** (color → nombre, **no interactiva**) bajo el canvas, más el tooltip. El stepper de año (activo) no cambia. *(Si análisis quisiera exponer los filtros también en el Dashboard, es decisión funcional — señal al orquestador.)*

### Filtros de tipo, dirección y categoría en `income-expense` (Ingresos vs Gastos) — RF-REP-014

La card `income-expense` suma **tres filtros de cómputo** combinables — **Dirección** (solo gastos / solo ingresos / ambos), **Tipo de movimiento** (fijo / cuota / único, multi-selección) y **Categoría** (todas / subconjunto / ninguna) — que acotan **qué movimientos entran en las dos líneas Ingresos/Gastos**. Son **filtros de cómputo persistidos** (config de la card, clave `reports`). **Dónde vive cada uno:** Dirección y Tipo van **en la cabecera** (segunda línea, cluster izquierdo); **Categoría vive en el footer** como **leyenda-filtro de categorías tildables** (mismo patrón que `by-category` y el resto de las cards — ver *Leyenda interactiva (la leyenda es el filtro)*), no en la cabecera. El **default reproduce el comportamiento histórico** (ambas direcciones · todos los tipos · todas las categorías): una card sin estos filtros configurados muestra las dos líneas income/expense con todos los movimientos.

> **Alcance de esta sección — los tres filtros y su convivencia.** Las tres dimensiones son **filtros**, no breakdowns: la card sigue siendo **Total-only** (dos líneas Ingresos/Gastos). Ninguno descompone ni apila por categoría — eso es exclusivo de `by-category`. La **Categoría** acota qué movimientos alimentan los totales mensuales **sin** convertir las categorías en series del canvas: vive en el **footer**, como la **leyenda-filtro de categorías tildables** común a las demás cards (mismo `ChartLegend` interactivo de 3 estados `null`/`[]`/lista — ver *Leyenda interactiva*), no tras un disparador+popover en la cabecera. Dirección y Tipo, por ser sets cortos y fijos, van **inline en la cabecera**.

#### 1. Ubicación — segunda línea de cabecera (molde de `by-category`)

Con los controles de cabecera, la cabecera de `income-expense` **deja la fila única** y adopta el **molde de dos líneas de `by-category`** (identidad arriba, controles debajo) — el título es **identidad**, no debe competir con los filtros:

- **Línea 1 (ancho completo, `mb-[8px]`):** **título editable P4** (toda su anatomía sin cambios), igual que la línea 1 de `by-category`.
- **Línea 2 (`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-[18px]`):**
  - **Cluster izquierdo — filtros de cómputo de cabecera (2 dimensiones):** `[ Dirección (segmented) ]  [ divisor --hair ]  [ Tipo (3 chips-toggle) ]`. La **Categoría no va acá**: vive en el footer (leyenda-filtro de categorías).
  - **Cluster derecho — `CardControls`:** `[ YearStepper ] [ divisor ] [ CardCurrencyTrigger ] [ divisor ] [ X ]`.

El cluster izquierdo ocupa el lugar que en `by-category` tienen los `ViewTabs`: es el **control de mayor jerarquía de interacción** de la card (define qué se computa); el stepper conserva su peso como nav dominante a la derecha. Entre las dos dimensiones va un **único divisor `--hair` 1px vertical** (alto 16px, `self-center`, `mx-[8px]`) — Dirección | Tipo, que las lee como **dos dimensiones distintas**, no un solo control. **Por qué Dirección y Tipo van inline y Categoría no:** Dirección (3 valores fijos) y Tipo (3 valores fijos) son sets cortos que se muestran de un vistazo inline en la cabecera (mismo criterio del segmented de moneda); Categoría es un set **abierto y potencialmente largo** (una entrada por categoría del usuario, hasta 70), que inline saturaría la cabecera — por eso **no va en la cabecera** sino en el **footer**, como la leyenda-filtro de categorías tildables (con scroll de alto acotado para el set largo — ver *Escalado de la leyenda con muchas categorías*), idéntico a las demás cards. Sin micro-labels visibles (las etiquetas de los segmentos y los chips se autoexplican; la semántica de grupo va en los `aria-label`); un micro-label `--faint` por cluster es **opcional** y solo si frontend detecta ambigüedad — el default es sin label, como las tabs de `by-category`.

#### 2. Dirección — segmented neutro de 3 (reusa el *triple switch de tipo*)

Control de **elección única** (radio): la card se computa en **un** sentido o en ambos. Es además el **único control de cuántas líneas muestra el canvas** (Ambos = 2 líneas; solo gastos / solo ingresos = 1 línea — ver §5). Reusa **literal** el *Triple switch de tipo (Gasto / Ingreso / Ambos)* del DS (ver *Filtros por listado en `/mes`*), con sus mismas reglas — es el mismo eje conceptual (Gastos / Ingresos / Ambos):

- **Forma:** pista pill `--panel-3` (track), radio `--r-pill`, padding interno `2px`; tres segmentos de ancho igual, texto **12.5px / 600**, `px-[10px] py-[5px]`, radio `--r-pill`. Labels: **"Gastos" / "Ingresos" / "Ambos"**.
- **Segmento seleccionado:** thumb `--panel` elevado con `--shadow-sm` que **se desliza** entre las 3 posiciones (0.14s; instantáneo con `prefers-reduced-motion`). El **texto** del seleccionado toma su color semántico: **Gastos → `--expense-ink`**, **Ingresos → `--income-ink`**, **Ambos → `--accent-ink`** (marca). No viola reglas duras 1/2: es el rótulo de un control de UI, no un monto teñido; el "Ambos" en índigo es marca.
- **Segmento no seleccionado:** texto `--muted`; hover → `--ink-2`.
- **Default:** **Ambos** (thumb a la derecha, texto `--accent-ink`) = comportamiento histórico.
- **a11y:** `role="radiogroup"` con tres `role="radio"` (`aria-checked`), `aria-label="Dirección"`; navegable por flechas; focus ring `--accent-soft` 3px sobre el segmento.

#### 3. Tipo de movimiento — 3 chips-toggle neutros (multi-selección)

Universo **fijo y corto de 3** valores, **multi-selección**, default los tres. Por el mismo criterio del DS que mantiene los sets cortos y fijos **visibles de un vistazo** (racional del segmented de moneda: "un dropdown escondería 3 de 4"), **no** se usa popover/disparador: van **3 chips-toggle visibles**. Como el tipo de movimiento **no** es una dimensión con color de dato (no lleva swatch), son **chips neutros** — deliberadamente distintos de los ítems-swatch de la leyenda, para que nunca se confundan con series:

- **Caja:** `<button type="button">`, `inline-flex items-center`, `px-[10px] py-[5px]`, radio `--r-chip` 7px, texto UI **12.5px / 600**, `select-none`, transición 0.14s. `gap-[6px]` entre chips. Labels: **"Fijos" / "Cuotas" / "Únicos"**.
- **Seleccionado / incluido (default los tres):** fondo `--panel` + borde `1px --line-strong` + `--shadow-sm`, texto `--ink`. Misma lógica del "thumb elevado blanco" del segmento activo: **incluido = pieza elevada**.
- **No seleccionado / excluido:** fondo `--panel-2`, borde `1px --line`, **sin sombra** (plano = "hundido/inactivo"), texto `--muted`. El contraste elevado↔plano + `--ink`↔`--muted` comunica on/off **sin** color ni tachado (el tachado es lenguaje de la leyenda; acá la señal es relleno/elevación, vocabulario de chips del DS).
- **Hover (sobre excluido):** texto → `--ink-2`, borde → `--line-strong`. **(sobre incluido):** se mantiene elevado; sin cambio extra.
- **Active/pressed:** fondo `--panel-3`.
- **Focus (teclado):** ring `--accent-soft` 3px (`focus-visible`), radio `--r-chip` 7px. El índigo es cromo de foco, no estado de dato.
- **Borde "los tres apagados":** se permite (no hay mínimo forzado); el canvas queda vacío → mismo empty **"Sin movimientos en {año}."** que ya cubre el filtro vacío. Los chips **no** se bloquean: el usuario reactiva clickeando cualquiera. Misma regla que el "todas apagadas" de la leyenda.
- **a11y:** contenedor `role="group"` `aria-label="Tipo de movimiento"`; cada chip `<button>` con **`aria-pressed`** = `true` (incluido) / `false` (excluido). Grupo de toggle buttons (misma semántica ARIA que la leyenda interactiva), no radios — porque es multi-selección.

> El chip neutro multi-selección no es lenguaje nuevo: compone la **caja de chip** (`--r-chip` 7px, fills `--panel-2`/`--panel-3`), la idea **"activo = pieza elevada blanca"** del segmented, la **escala neutra `--ink`/`--ink-2`/`--muted`**, el **focus ring `--accent-soft`** y el **grupo de toggle buttons (`aria-pressed`)** de la leyenda. Se diferencia de los ítems de leyenda por **no llevar swatch de color** (no es una serie de dato) y comunicar off por **relleno/elevación**, no por tachado.

#### 4. Categoría — leyenda-filtro de categorías en el footer (no en la cabecera)

Universo **abierto y potencialmente largo** (una entrada por categoría del usuario, hasta 70). Por su longitud **no** va en la cabecera: vive en el **footer bajo el canvas**, como la **leyenda-filtro de categorías tildables** — exactamente el mismo patrón que `by-category` y el resto de las cards. Reusa **literal** el `ChartLegend` interactivo (*Leyenda interactiva (la leyenda es el filtro)*) con su **lógica de tres estados** (`null`=todas / `[]`=ninguna / lista=subconjunto), idéntica a la del widget de reporte (RF-REP-002), su `LegendAllChip` "Todas/Ninguna" y su escalado con scroll de alto acotado para sets largos.

- **Ítems:** uno por categoría (las **activas**), cada uno un chip-toggle tildable (swatch 10px + nombre), `flex-wrap`, `margin-top` 14px, en el orden estándar de la leyenda. Tildado = la categoría alimenta el cómputo de las dos líneas; destildado = excluida.
- **El swatch es identificador de categoría, no clave de color del canvas (matiz propio de `income-expense`).** A diferencia de `by-category` — donde el swatch de cada ítem mapea a una **banda/área de ese color** visible en el gráfico —, en `income-expense` el canvas son **dos líneas income/expense**, sin bandas por categoría. El swatch **no** representa ninguna serie del canvas: es el **identificador de la categoría** (recognition para tildar/destildar), el mismo rol que el swatch cumple en el popover de `/mes` y en cualquier lista de categorías del DS. **No es engañoso** porque el canvas **no contiene ningún color de categoría** (solo el verde ingreso y el rojo gasto, semánticos; la matriz de color de categoría está construida para no chocar con income/expense/acento) — el usuario nunca busca "la banda de este color" porque no existen bandas por categoría. Por eso **se conserva el swatch** (coherencia "como las otras cards") sin mentir: la leyenda es un **filtro de cómputo**, no una clave de color del gráfico.
- **Estado off (destildado):** mismo tratamiento que la leyenda interactiva (label `line-through` + swatch a outline + opacidad 0.7), pero su significado acá es **"esta categoría sale del cómputo de las dos líneas"** (no "su banda desapareció del canvas", que no existe). Las tres señales siguen leyendo inequívocamente "excluido".
- **Empty — ninguna categoría tildada (`[]`):** todas las categorías destildadas vacía el cómputo → canvas sin líneas → empty estándar **"Sin movimientos en {año}."** (sin error). La leyenda **no se bloquea**: el usuario reactiva tildando cualquiera, o usa "Todas" del `LegendAllChip`. Misma regla que el "todas apagadas" del resto.
- **Por qué footer y no cabecera ni popover:** un set de hasta 70 categorías inline en la cabecera la saturaría, y un disparador+popover en la cabecera sería **redundante** con la leyenda del footer (dos lugares para lo mismo). El footer ya es donde las demás cards alojan su filtro de categorías; `income-expense` se alinea a ese patrón. El usuario fue explícito: los nombres tildables del footer, como las otras cards.

> El filtro de categoría de `income-expense` **no es lenguaje nuevo**: es la misma *Leyenda interactiva (la leyenda es el filtro)* que monta `by-category`, reusada tal cual en el footer. Lo único propio de `income-expense` es el **matiz del swatch** (identificador de categoría, no clave de color del canvas) — honesto porque el gráfico no pinta colores de categoría.

#### 5. Dirección como único control de las líneas (el corazón del spec)

Ya **no hay leyenda interactiva de series** (el toggle show/hide de Ingresos/Gastos por leyenda, `hiddenSeries`, se elimina). Con el footer dedicado a la **leyenda-filtro de categorías**, **la Dirección queda como el único control de cuántas líneas muestra el canvas**:

- **Dirección = qué líneas se ven y qué se computa (persistido).** Define el universo de líneas de la card y persiste en `reports`. Es el único determinante de cuántas líneas hay:
  - **Ambos (default):** **2 líneas** — Ingresos (`--income`) y Gastos (`--expense`).
  - **Solo gastos:** **1 línea** — Gastos (`--expense`).
  - **Solo ingresos:** **1 línea** — Ingresos (`--income`).
- **Categorías (footer) = qué movimientos alimentan esas líneas (persistido).** Tildar/destildar categorías acota el **cómputo** de las líneas en alcance, **sin** agregar ni quitar líneas (no descompone). Una línea de Gastos con la mitad de las categorías destildadas sigue siendo **una** línea de gastos, con un total menor.
- **Tipo (cabecera) = qué tipos de movimiento entran (persistido).** Igual que categorías: acota el cómputo de las líneas en alcance, sin tocar cuántas hay.
- **No hay redundancia ni estado fantasma.** Al no existir el show/hide efímero por leyenda, desaparece la antigua tensión "oculté Ingresos por leyenda **y además** puse solo-gastos": cuántas líneas se ven lo decide **solo** la Dirección. No hay `hiddenSeries` que resetear.

**Por qué Dirección absorbe el rol de control de líneas.** El show/hide efímero de series por leyenda servía cuando la leyenda era de series; ahora la leyenda es de **categorías** (filtro de cómputo), así que ese rol no tiene dónde vivir ni hace falta: aislar una línea se logra cambiando la Dirección (persistida, que es justamente la intención "esta card es de gastos"). Un solo eje (Dirección) decide las líneas; los otros dos filtros (Tipo, Categoría) modulan su cómputo sin multiplicarlas.

#### 6. Jerarquía, estados de borde y back-compat

- **Jerarquía de la cabecera:** título (identidad) → **Dirección** (eje conceptual, segmented con thumb y semántica) → **Tipo** (refinamiento, chips neutros) → `[ YearStepper` (nav dominante) `> moneda > X ]`. Dirección pesa más que Tipo (forma de segmented vs chips) por ser el eje que redefine cuántas líneas muestra la card. La **Categoría** ya no está en la cabecera: es la leyenda-filtro del **footer** (refinamiento de cómputo del set largo, bajo el canvas).
- **Back-compat:** card sin filtros configurados ⇒ Dirección = **Ambos**, Tipo = **los tres**, Categoría = **todas** (`null`) ⇒ las 2 áreas income/expense con todas las categorías tildadas en el footer, todos los movimientos.
- **Empty / filtro vacío:** cualquier filtro vaciando el alcance — Tipo con los tres apagados, **Categoría = ninguna (`[]`, todas destildadas en el footer)**, o el cruce de las tres dimensiones sin datos en el año — cae en el empty estándar **"Sin movimientos en {año}."** (sin error). Los controles no se bloquean (la leyenda del footer se reactiva tildando cualquier categoría o con "Todas" del `LegendAllChip`).
- **Responsive (≤940px):** la línea 2 envuelve por su `flex-wrap`; el cluster izquierdo (Dirección + Tipo) puede a su vez envolver (los chips de Tipo bajan bajo el segmento de Dirección), y `CardControls` baja a otro renglón, como ya hace `by-category`. El **segmented de Dirección nunca colapsa** (siempre 3 labels visibles); los chips de Tipo envuelven naturalmente. La **leyenda-filtro de categorías del footer** sigue bajo el canvas (con su scroll de alto acotado si el set es largo). El título (línea 1) queda arriba de todo.
- **Dashboard:** la card `income-expense` del Dashboard es **efímera y despojada** (ya omite el selector de moneda, ver *Moneda por reporte …* §6, y nunca persistió config). Por coherencia con ese precedente, **no monta los filtros Dirección/Tipo/Categoría** — son config de la card de `/reportes`, que es la que persiste en `reports`. *(Si análisis quisiera exponerlos también en el Dashboard, es decisión funcional — señal al orquestador.)*

#### Restricciones duras reafirmadas

- **Verde = ingreso, rojo = gasto, estrictamente:** `--income`/`--expense` aparecen solo en el **texto del segmento Dirección seleccionado** (Ingresos/Gastos) y en las **líneas del canvas** (verde ingreso / rojo gasto). Los chips de Tipo son **neutros** (nunca verde/rojo: el tipo de movimiento no es dirección). La leyenda-filtro de categorías del footer usa `category.color` en sus swatches (color de **dato de categoría**, identificador, no semántico ingreso/gasto ni monto). Ningún monto se tiñe por estos controles.
- **Índigo = solo marca/cromo de interacción:** aparece como **focus ring** de segmented, chips y de los toggles de la leyenda-filtro, y como **texto "Ambos"** del segmento Dirección (badge de alcance "ambos" del DS, marca). Nunca tiñe cifras de dinero. (El `LegendAllChip` del footer es **neutro**, sin índigo — ver *Atajo "Todas / Ninguna"*.)
- **Mono tabular** no se ve afectado: estos controles no muestran cifras de dinero. Las cifras del gráfico/tooltip siguen en mono tabular `tnum`.

> Reutiliza: el **triple switch de tipo** (segmented neutro con semánticos solo en el texto del seleccionado) para Dirección; la **caja de chip** + **grupo de toggle buttons (`aria-pressed`)** + **focus ring `--accent-soft`** + escala neutra del DS para los chips de Tipo; la **leyenda-filtro de categorías (*Leyenda interactiva*)** tal cual `by-category` la monta, para Categoría (en el footer); el **molde de dos líneas de cabecera de `by-category`** (identidad arriba, controles abajo); el **divisor `--hair` vertical** como corte entre Dirección y Tipo; y el **empty "Sin movimientos…"** para el borde de filtro vacío. Aporta: el **chip-toggle neutro multi-selección** (sin swatch, off por relleno/elevación) para Tipo; la **convivencia de tres filtros de cómputo** (Dirección en cabecera · Tipo en cabecera · Categoría en el footer), todos persistidos y sin descomponer la card; la regla de **Dirección como único control de cuántas líneas muestra el canvas** (sin leyenda de series ni `hiddenSeries`); y el **matiz del swatch** de la leyenda-filtro en `income-expense` (identificador de categoría, no clave de color del canvas — honesto porque el gráfico no pinta colores de categoría).

### Leyenda interactiva (la leyenda es el filtro)

La leyenda del gráfico **es** el filtro. Cada ítem de leyenda es un **toggle clickeable**: muestra/oculta su serie en el canvas (cuando la leyenda es de series), o tilda/destilda su categoría para el cómputo (cuando es de categorías). Aplica **idéntico** en `/reportes` y en la card del Dashboard, y sirve **igual para los tres casos** (mismo componente `ChartLegend` interactivo, distinto contenido):

| Caso | Ítems de la leyenda | Qué togglea cada ítem |
|---|---|---|
| **`income-expense` (Ingresos vs Gastos)** | una por **categoría** (las activas; swatch `category.color` + nombre), en el orden estándar de la leyenda | tilda/destilda esa categoría para el **cómputo** de las líneas income/expense (ver *Filtros … RF-REP-014* §4). **No es un toggle de serie:** el canvas son dos líneas semánticas (verde ingreso / rojo gasto), sin bandas por categoría; las líneas no se prenden/apagan por leyenda — cuántas hay lo decide la **Dirección** (§5). La leyenda vive en el **footer**. |
| **`by-category` (Gastos por categoría) — modo Barra** | una por **categoría** de gasto (swatch `category.color` + nombre), orden del apilado | esa banda apilada (barra) |
| **`by-category` (Gastos por categoría) — modo Línea** | una por **categoría** de gasto (swatch `category.color` + nombre), orden del apilado | esa banda del stack de áreas |

**La leyenda de `by-category` es la misma en ambos modos.** El toggle Barra↔Línea no cambia la leyenda ni su estado de filtro; cambia solo la geometría del canvas (banda-barra ↔ banda-área). **La lógica de tres estados NO cambia.** El filtro de categorías es `null`=todas / `[]`=ninguna / lista (subconjunto) — **idéntico en `income-expense` y en `by-category`**. La leyenda solo cambia la **piel** (de decorativa a interactiva) y el **lugar** donde se acciona (no hay popover de categorías).

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

- **Contenedor:** `role="group"` con `aria-label` por caso — **"Filtrar categorías"** (`income-expense` y `by-category`, modos Barra y Línea) / **"Filtrar series"** (*Inflación vs Ingresos*, leyenda de series fijas). Reemplaza el `aria-label="Leyenda del gráfico"` decorativo actual.
- **Ítem:** `<button type="button">` con **`aria-pressed`** = `true` (activo/incluido) / `false` (apagado/excluido). El patrón toggle-button (`aria-pressed`) lee mejor que checkboxes acá: el control **es** el ítem visual (swatch+label), no una casilla aparte, y un grupo de toggle buttons es la semántica ARIA canónica de "mostrar/ocultar esta serie".
- **Texto accesible:** el contenido del botón ya es la etiqueta (nombre de serie/categoría); el swatch va `aria-hidden`. El estado lo comunica `aria-pressed`, no el color (no dependemos del verde/rojo/`category.color` para transmitir on/off a lectores).
- **Navegación por teclado:** cada ítem es tabbable (es un `<button>`); `Enter`/`Espacio` togglea. No se exige roving-tabindex (no es un `tablist`); es un grupo de botones independientes, cada uno en el orden de tab natural.
- **Borde "todas apagadas":** apagar el último ítem (todas las categorías off — o, en la leyenda de series fijas de *Inflación vs Ingresos*, todas las series off) deja la leyenda con todos los ítems en estado apagado y el canvas vacío → **el mismo empty "Sin movimientos en {año}."** que ya cubre el filtro vacío (sin error). La leyenda **no se bloquea**: el usuario reactiva clickeando cualquier ítem. No hay un mínimo forzado de "al menos uno encendido".

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

Control **ligero/disimulado** que vive **solo en la cabecera de la sección Únicos** de `/mes`, hermano del `SectionFilterButton` (*Filtros por listado en `/mes`*, arriba). Únicos es la **única** sección con columna fecha ("DD Mmm"); Fijos y Cuotas no tienen día, así que **no llevan este control** (no se renderiza en sus cabeceras). El criterio de orden por defecto del listado es **magnitud `|monto| DESC`** (el mismo del backend, ver *Sublínea del ítem de `/mes` — dos zonas*); este control permite **alternar** ese orden con un orden **por fecha**.

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

Selector del color de categoría en el modal de categoría (crear y editar), que consume la **matriz de 40 colores** (ver *Paleta de colores para categorías*). Grid 8 columnas × 5 filas, swatch cuadrado `aspect-ratio: 1` radio `--r-chip` 7px, gap 6px.

- **Estados del swatch:** *reposo* = su hex con borde `--line` 1px. *Hover* = `scale(1.12)` + `--shadow-sm`, borde `--line-strong`, transición 0.14s. *Seleccionado* = anillo `box-shadow: 0 0 0 2px var(--panel), 0 0 0 4px var(--ink)` (ring **neutro `--ink`**, no acento — regla dura 2). *Focus* = ring `--accent-soft` 3px.
- **Botón "Aleatorio":** ghost chico (`Shuffle` 15px) que mueve la selección a un swatch al azar **de la matriz** (nunca un hex fuera de ella).
- **Crear:** arranca en el color menos usado (subset base, fila L3). **Editar:** arranca en el color actual de la categoría.

### Sublínea del ítem de `/mes` — dos zonas (identidad · estados)

La **sublínea** (segunda línea del cuerpo del ítem, col 2, bajo el nombre) es el lugar canónico de los metadatos del movimiento. Se organiza en **dos zonas** dentro de una fila `flex items-center` que ocupa el ancho de la col 2:

- **Zona de identidad (izquierda)** — texto, `flex-1 min-w-0`, trunca con elipsis cuando aprieta. Registro de sublínea 12px, texto `--muted`, separadores `·` en `--faint`. Reúne **quién/qué** es el movimiento.
- **Zona de estados (derecha)** — `shrink-0`, cluster de glifos neutros `--muted` alineado a la derecha, **nunca** trunca. Reúne **banderas** del movimiento (padre, débito automático). Se separa de la identidad por un `gap-[10px]` o, si se prefiere el corte visual, un **hairline vertical** `--hair` de 12px de alto.

**El tipo (gasto/ingreso) NO se rotula en la sublínea.** Lo comunican, sin redundar, el **ícono 40×40 tintado** de la col 1 (flecha `↓` gasto en `--expense` / `↑` ingreso en `--income`) y el **signo + color del monto** de la col 4. No hay segmento textual "gasto"/"ingreso" en ninguna zona.

#### Zona de identidad — orden exacto de segmentos

> **Actualizado (Card de detalle):** el **método de pago** ya **no** vive en la sublínea — migró a la card de detalle (ver *Card de detalle de movimiento*). La identidad queda `● Categoría · [frecuencia] · [↳ desde {Origen}]`.

De izquierda a derecha, **omitiendo** los que no apliquen:

1. **Badge "Anulado"** (solo si `skipped`) — chip neutro; ver *Ítem anulado*. Es el **primer** segmento cuando está.
2. **Punto de color de categoría** — punto **6px** (`w-[6px] h-[6px] rounded-full shrink-0`), `background: movement.category.color` inline (el color viene del dato tal cual; el campo disponible en el ítem es `movement.category.color`), `aria-hidden`. Va **inmediatamente antes** del nombre de categoría, `gap-[6px]`. Es el **ancla de identidad** de la fila.
3. **Categoría** — nombre de la categoría en **`--ink-2`** (sube de `--muted` a `--ink-2`: es el **eje de identidad** de la sublínea), 12px, no mono, `truncate`.
4. **Origen — frecuencia** (solo **fijos** y **calculados de origen fijo**) — separador `·` + glifo `Repeat` (12px, `--muted`, `aria-hidden`) + etiqueta de frecuencia **en minúscula** (set de **12 valores** enteros 1..12, ver *Frecuencia del fijo — entero 1..12 y sus etiquetas*), `--muted`, no mono. **La cuota X/N de las cuotas NO vive en la sublínea:** sigue en la **col 3** (ver *Sin cambios*), sin duplicarse. Los **únicos** no llevan segmento de origen en la sublínea (su fecha va en col 3). **El arranque del fijo (`startMonth`) NO vive en la sublínea ni en la col 3:** migró a la card de detalle (ver *Card de detalle de movimiento*).
5. **"↳ desde {Origen}"** (solo si el movimiento **es un calculado**) — **último** segmento de identidad. Separador `·` + glifo `CornerDownRight` (12px, `--muted`, `aria-hidden`) + texto "desde " (`--muted`) + **nombre del origen** en `--ink-2`, no mono, `truncate`. **Fusiona en un solo segmento** la marca de "es calculado" y la referencia a su origen: **no hay chip boxeado "Calculado"** por separado (se eliminó).

El **monto** del calculado puede ser negativo/cero (ver *Paleta y uso de tokens* → regla del signo).

#### Zona de estados — cluster de glifos (derecha)

Glifos neutros `--muted`, **solo glifo, sin texto**: cada uno comunica su significado con `aria-label` + `title` nativo en el wrapper (el svg va `aria-hidden`). Orden dentro del cluster, de izquierda a derecha, `gap-[8px]` entre glifos:

1. **Marca de límite** (efecto `glyph`/`fill`) — ver *Marca visual pasiva de límites*.
2. **Padre** (`hasCalculated === true`) — glifo `GitBranch` (13px, `--muted`). `aria-label`/`title`: **"Tiene N calculado(s)"** (el conteo vive solo en el label/tooltip; **sin** contador visible, para mantener el cluster como glifos). Señal liviana (info secundaria).

> **Actualizado (Card de detalle):** el glifo `Zap` de **débito automático** ya **no** vive en la zona de estados de la fila — migró a la card de detalle (ver *Card de detalle de movimiento*). El cluster queda con la marca de límite y el glifo de padre (`GitBranch`).

Si **ninguna** bandera aplica, la zona de estados **no se renderiza** y la identidad usa el ancho completo.

#### Cumplimiento de reglas duras

- **Regla dura 1 (verde = ingreso · rojo = gasto):** el punto de categoría usa la **paleta de 40 colores de categorías** (identificador), que incluye rojos y verdes, pero **no** comunica tipo: está anclado espacialmente al **nombre de categoría** (eje de identidad), es diminuto (6px) y **nunca** toca la cifra ni el ícono 40×40 de tipo. El tipo lo siguen comunicando **exclusivamente** el ícono tintado (col 1) y el signo/color del monto (col 4). Es el **mismo criterio ya vigente** para los swatches `category.color` de gráficos y tooltips, que conviven con montos sin colisionar. El punto es una **tercera familia de color legítima** (paleta de categorías) sobre **identidad**, nunca sobre cifra ni sobre el ícono de tipo.
- **Regla dura 2 (índigo solo marca):** ningún elemento de la sublínea usa índigo para teñir cifras ni identidad; el punto usa color de categoría, los glifos y textos van en neutros (`--muted` / `--ink-2`).
- **Regla dura 3 (dinero en mono tabular):** la sublínea **no contiene cifras de dinero** (el monto vive en col 4, mono tabular). Ni el nombre de origen ni los glifos de estado son cifras.

#### Relación padre/calculado — transversal a los tres orígenes

La relación **padre/hijo** de los movimientos calculados se señala como arriba (segmento **"↳ desde {Origen}"** del hijo en la identidad; glifo **padre** `GitBranch` en la zona de estados), sin recolorear el ítem ni el monto:
- **El origen del calculado puede ser fijo, único o cuota — el patrón es transversal.** El segmento **"↳ desde {Origen}"** del hijo (identidad) y la marca **padre** (`GitBranch`, zona de estados) se aplican **idénticos** sin importar el origen; el calculado se **lista en la sección de su origen** (calculado de único → **Únicos**; de cuota → **Cuotas**; de fijo → **Fijos**). Particularidades por sección:
  - **El hijo toma la forma de su sección de origen.** En **Únicos** lleva la columna fecha "DD Mmm" (heredada del split temporal del origen); en **Cuotas** la columna 3 va **vacía** — el calculado de cuota **no** muestra la etiqueta "Cuota X/N" (es un movimiento propio, no integra el plan de cuotas); en **Fijos** la columna 3 muestra **su propio arranque** ("desde Mmm AAAA", ver *Arranque del fijo en `/mes` — col 3*) — un calculado es un fijo con **cadena propia** y exhibe su arranque, no el del origen.
  - **La sublínea sigue la regla de su origen:** el segmento de **frecuencia (`Repeat`)** aparece **solo** cuando el calculado es de **origen fijo**; en calculados de único/cuota la zona de identidad es `● Categoría · [método] · ↳ desde {Origen}` (sin frecuencia, sin "X/N", sin rótulo de tipo).
  - **Orden dentro de la sección:** el calculado se ordena por **magnitud `|monto| DESC`** mezclado con el resto de los ítems de su sección (mismo criterio único del backend); **no** se ancla junto a su origen ni se agrupa aparte — cae donde su magnitud lo ubique.
  - **Ícono de la caja de origen (form de calculado).** La caja de origen *read-only* del form lleva un glifo lucide que identifica el **tipo del movimiento de origen**, en `--accent-ink` (cromo de UI, no monto): **fijo → `Repeat`** (recurrencia), **único → `Receipt`** (gasto puntual / ticket), **cuota → `CreditCard`** (compra financiada en N pagos). 15px, `shrink-0`, `aria-hidden`. Son afordancias neutras: no tiñen cifras ni colisionan con la regla verde/rojo. No hay convención previa de ícono para único/cuota en listas (Únicos se distingue por la columna fecha; Cuotas por "X/N"), así que estos tres glifos viven por ahora solo en esta caja.
- **Aviso de borrado en cascada (modal de eliminar):** cuando el movimiento a eliminar es **padre** (`hasCalculated === true`), el modal de confirmación suma un **callout de advertencia** como **último bloque del cuerpo, antes del footer**, avisando que al borrarlo también se borran sus calculados. Es **advertencia (ámbar `--warning`), no error**: el borrado es lo pedido, el callout informa el efecto colateral. Banda `--r-ctl`, fondo `--warning-soft`, borde `--warning`, `AlertTriangle` (lucide, 16px, `--warning-ink`) + texto 13px/500 `--warning-ink`. El botón "Eliminar" del footer **es `danger`** (rojo): advertencia ámbar y acción destructiva roja conviven. Solo aparece si `hasCalculated`; si es `false`, el modal queda igual.

### Ítem anulado (`skipped`) y acciones del KebabMenu

**Ítem anulado** (`skipped: true`): el ítem **se sigue mostrando** en su sección y posición (no desaparece), pero no suma a los totales. La anulación aplica a los **tres orígenes** — fijo, único y cuota — con la **misma señalética visual**; lo único que cambia es el **rótulo** de la acción (ver más abajo). Tres señales juntas, ninguna sola alcanza:

- **Atenuación de la fila:** todo el contenido de la fila (ícono, nombre, sublínea, monto, columna fecha) a **`opacity: 0.55`**. **No** se atenúa el fondo/hover ni el KebabMenu (que queda a opacidad plena para accionar "Des-anular").
- **Monto tachado:** `line-through` sobre el monto, además de la atenuación. **Conserva su color por tipo y su signo** — no se recolorea a neutro.
- **Badge "Anulado":** chip neutro como **primer** segmento de la **zona de identidad** de la sublínea (antes del punto de categoría; si además es calculado, el "↳ desde {Origen}" queda como último segmento de identidad: `[Anulado] ● Categoría · … · ↳ desde {Origen}`). Mismo molde de chip neutro del DS: `--panel-3` / `--muted` / `--r-chip` 7px / 11px·600·`.04em`. **Mismo texto "Anulado" para los tres orígenes** (no se cambia por "este mes"): el badge señala el estado de cómputo del ítem, no el alcance temporal — ese matiz vive en el rótulo del kebab. Neutro a propósito (no `--warning` ni semántico): "anulado" es un estado de cómputo, no error.

**Hover del anulado:** la fila sigue interactiva (`hover:bg-panel-2` + KebabMenu visible); el contenido atenuado **no** vuelve a opacidad plena en hover.

**Acciones del KebabMenu del ítem (orden):** Editar → Anular/Des-anular → **Duplicar** → Crear movimiento calculado → Eliminar (única `danger`/roja). Las intermedias son **neutras** (`text-ink hover:bg-panel-2`, ícono 15px); la anulación aparece en **fijo, único y cuota** (siempre en el mismo slot, justo después de Editar), y las **dos acciones que engendran otro movimiento** (Duplicar y la de calculado) **solo en orígenes no-calculados** — ver *Duplicar movimiento* para el ítem "Duplicar", el agrupamiento y el racional del rótulo de la acción de calculado:

- **Anular / Des-anular** — toggle según `skipped`, siempre en el slot posterior a Editar. Íconos reusados para los tres orígenes: activo → `CalendarOff`; anulado → `CalendarPlus`. Reversible, nunca `danger`. El **rótulo** distingue el alcance:
  - **Fijo** y **cuota** (anulación de la instancia de **ese mes**): **"Anular este mes"** / **"Des-anular este mes"**.
  - **Único** (la anulación es un **flag de la fila**, no un mes puntual): **"Anular"** / **"Des-anular"**, sin "este mes".
  - Los íconos `CalendarOff`/`CalendarPlus` se **reusan tal cual** también en el único: no se introduce ícono nuevo (sin "ojito" ni glifo alternativo). Aunque el calendario alude a "mes", se prioriza mantener el toggle **reconocible e idéntico** entre los tres orígenes; el matiz de alcance lo carga el rótulo.
- **Crear movimiento calculado** — abre el form de calculado (abajo) con el origen fijado. Ícono `Calculator`. **No** aparece sobre un ítem que ya es calculado (sin encadenamiento). Todos los orígenes no-calculados pueden ser origen. *(El racional del rótulo vive en* Duplicar movimiento *§2.)*
- **Duplicar** — abre el modal en modo creación con los datos del ítem precargados. Ícono `Copy`. Mismo gate que la anterior (**solo** en no-calculados). Ver *Duplicar movimiento*.

### Duplicar movimiento — acción del kebab y modo "duplicar" del modal

**Qué es.** Crear un movimiento **nuevo e independiente** precargado con los valores de uno existente (POST, no vínculo). Vive **únicamente** en el kebab "⋮" de la fila de `/mes` — la *Card de detalle* sigue siendo **read-only pura** y no la incorpora. Aplica a **único, fijo y cuota no calculados**; **no** aparece sobre un calculado (mismo gate que la acción de calculado).

**Por qué solo en el kebab.** El kebab ya es el domicilio único de las acciones sobre un ítem (Editar, Anular, Eliminar). Sumarla ahí no agrega superficie nueva ni obliga al usuario a aprender un lugar más; ponerla también en la card rompería la regla de que la card no acciona.

#### 1. El ítem "Duplicar" en el KebabMenu

- **Rótulo: "Duplicar"**, una sola palabra en imperativo — mismo registro que Editar / Anular / Eliminar. Sin objeto ("Duplicar movimiento" sería redundante: el menú ya pertenece a un movimiento) y **sin** la preposición "desde este", que es justamente el fragmento que colisiona con la acción de calculado.
- **Ícono: `Copy` (lucide), 15px**, como el resto de los ítems del menú. Es el glifo canónico de duplicar y se lee entero a 15px (dos rectángulos superpuestos). Se descarta `CopyPlus` (a 15px el `+` ensucia la silueta y compite con la idea de "crear algo derivado", que es la otra acción) y `Files` (lee como "archivos/adjuntos", no como acción).
- **Tono: neutro** (`text-ink hover:bg-panel-2`), **nunca `danger`**. No destruye nada y es reversible por la vía normal (eliminar el nuevo). **Sin diálogo de confirmación:** confirmar una acción no destructiva es fricción injustificada, y la confirmación real es el propio modal, que se puede cancelar.
- **Sin estado de carga propio.** El ítem solo **abre el modal**; no dispara red. El POST, su estado de carga ("Guardando…"), su toast de éxito y su error son los del **form de creación**, sin cambios.
- **Posición: tercera** — `Editar → Anular/Des-anular → Duplicar → Crear movimiento calculado → Eliminar`.
  - **Racional (jerarquía + agrupamiento):** el menú se lee en tres grupos implícitos — *actuar sobre este ítem* (Editar, Anular) → *engendrar otro movimiento a partir de este* (Duplicar, calculado) → *destruir* (Eliminar). Duplicar entra en el segundo grupo, pegado a la acción con la que se confunde: la adyacencia es deliberada, porque es donde el contraste de rótulo (una palabra vs. frase) e ícono (`Copy` vs `Calculator`) se lee **de una** y desambigua, en vez de dejar dos acciones parecidas separadas por el toggle de anular.
  - **Duplicar antes que calculado** dentro del grupo: es la acción más general y frecuente (repetir una carga) frente a la especializada (derivar por fórmula); lo más probable, primero.
  - **Convivencia con el calculado:** las dos comparten el gate `!isCalculated`, así que el grupo aparece o desaparece **completo**. En un ítem calculado el menú queda `Editar → [Anular este mes, solo calculados de fijo] → Eliminar` — sin huecos ni ítems sueltos.
- **Ítems en una sola línea** (`whitespace-nowrap`): el panel crece a su contenido desde su `min-width: 160px`. Ningún rótulo del menú envuelve a dos renglones.
- **Alto del panel y flip:** la altura con la que el menú decide abrir hacia arriba o hacia abajo se **deriva del número real de ítems** (no es una constante fija). Con 5 ítems el panel mide ≈173px (5 × ~33 + 8 de padding), y en las filas del **pie del listado** el menú **abre hacia arriba** en vez de quedar cortado por el borde inferior del viewport. El contrato es: **el menú entra entero en el viewport con cualquier cantidad de ítems**, y por lo tanto ninguna acción queda inalcanzable (invariante 3). Toda incorporación futura de ítems al menú queda cubierta por esa derivación, sin ajuste manual.

#### 2. Rótulo de la acción de calculado

**El rótulo es "Crear movimiento calculado".** Racional, para sostener decisiones futuras sobre este menú:

- **Consistencia de vocabulario:** un concepto, un nombre. Es el mismo término que rotula el modal destino ("Nuevo movimiento calculado"), la sublínea del hijo y la doc — el menú y el modal se confirman entre sí, y el rótulo enseña el concepto por coincidencia con lo que abre. No se introduce un segundo nombre ("derivado", "a partir de") para algo que la app ya llama *calculado*.
- **Desambiguación contra "Duplicar":** las dos acciones son vecinas en el menú, así que el rótulo tiene que hacer el trabajo de contraste. Lo hace en **forma** (frase vs. palabra única), en **verbo** y en **ícono** (`Calculator` vs `Copy`). Y evita nombrar **la procedencia** ("desde este"), que es justamente lo que ambas acciones comparten en el lenguaje coloquial y por lo tanto no distingue nada.
- **Nombra qué obtenés, no de dónde sale:** lo que separa esta acción de Duplicar es que el nuevo movimiento se **calcula** a partir del original y queda **vinculado** a él. El rótulo nombra el resultado (*un movimiento calculado*), que es la información con valor discriminante.

**El resto de la acción:** ícono `Calculator` (diferenciador visual contra `Copy` y refuerzo de "calculado"), posición 4.ª — inmediatamente después de Duplicar —, tono neutro y gate `!isCalculated`.

#### 3. Modo "duplicar" del modal

Es el modal de movimiento existente (`ModalShell variant="form"`), en **modo creación** (POST), con el form del **tipo del original** y los **tabs Único/Fijo/Cuotas ocultos** (decisión funcional cerrada, igual que en los modos de edición).

- **Título — espeja la gramática de edición, no la de creación:**
  - original **único** → **"Duplicar movimiento"**
  - original **fijo** → **"Duplicar · Fijo"**
  - original **cuota** → **"Duplicar · Cuotas"**
  - **Por qué "Duplicar" y no "Nuevo movimiento":** (a) *feedback* — el título repite el verbo que el usuario acaba de elegir y cierra el lazo acción → resultado; (b) explica sin cromo extra **por qué los campos vienen llenos** y **por qué faltan los tabs**; (c) "Nuevo movimiento" con los tabs ausentes lee como el modo creación **roto** (mismo título, distinto chrome) — inconsistencia gratuita.
  - **Por qué el sufijo `· Fijo` / `· Cuotas`:** con los tabs ocultos, el tipo del movimiento **no está en ningún lado**; el sufijo lo recupera, y es exactamente el patrón que el modal ya usa en edición ("Editar · Fijo" / "Editar · Cuotas", y "Editar movimiento" sin sufijo para el único). No se inventa gramática nueva.
- **NO lleva señal adicional de origen** (ni banner, ni nota "precargado desde {Nombre}", ni chip). Decisión explícita, por tres razones: (a) *causa inmediata* — el usuario acaba de pulsar "Duplicar" sobre una fila concreta y el título se lo confirma; un aviso explicaría algo que nadie se está preguntando; (b) **riesgo de vocabulario** — "desde {Origen}" (con `CornerDownRight` / `↳`) es lenguaje **reservado a los calculados**, donde sí hay vínculo permanente; usarlo acá afirmaría un vínculo que **no existe** (el duplicado es independiente) y arruinaría la distinción que este mismo trabajo busca; (c) *carga cognitiva* — un bloque informativo arriba de un form que se va a editar es ruido en el camino crítico.
  - **Prohibido en este modo:** el glifo `CornerDownRight`, el glifo `GitBranch`, la palabra "desde" referida al original y cualquier chip de procedencia.
- **Botón primario: "Guardar"** (con "Guardando…" en carga) — el de creación, **sin cambios**. No se rotula "Duplicar": el título ya nombra la operación, y el botón mantiene el mismo verbo que en toda alta.
- **Disclosure "Más opciones": arranca colapsado, sin excepción** (regla vigente del DS, que no se excepciona acá). Los valores copiados que viven adentro **ya se ven** en el resumen colapsado: código de moneda (+ cotización si ≠ default) y glifo + nombre del método de pago. No hace falta auto-expandir.
  - **Nota del campo Cotización:** cuando `moneda ≠ default`, el valor precargado viene **del original**, no de la referencia del mes; por eso la nota lee **"Cotización modificada"** (`--ink-2`, sin glifo `History`) y **no** "Cotización de referencia del mes" — que sería falso. Mismo tratamiento que en edición.
- **Estados:** ninguno nuevo. Vacío/carga/error/éxito son los del form de creación (incluido el bloque `.warn` de "sin categorías" y la validación de cada campo). El modo duplicar no dispara fetch propio: precarga desde el `MovementItem` que la lista ya tiene.
- **Cierre:** como todo modal de decisión — ✕ y `Esc`; el clic en el scrim **no** cierra.

#### 4. Contención responsive (obligatoria)

- **Invariante 1 (sin scroll horizontal del `body`):** no se agrega ancho a la fila ni al modal. El panel del kebab es un portal `fixed` anclado por su borde derecho al trigger; con el rótulo más largo del menú sigue holgado a 640px (y a ~392px de contenido con el sidebar abierto), y **nunca** se sale por el borde izquierdo — si el ancho disponible no alcanza, el panel se corre hacia adentro, no se desborda.
- **Invariante 2 (modales completos y scrolleables):** lo resuelve `ModalShell variant="form"` sin cambios — `max-height: calc(100dvh − 48px)`, cuerpo scrolleable, footer Guardar/Cancelar pineado. Los títulos de este modo ("Duplicar · Cuotas" es el más largo) son **más cortos** que los ya soportados ("Editar movimiento calculado"), así que no hay riesgo nuevo de truncado; si truncara, trunca el **título**, nunca la ✕.
- **Invariante 3 (ninguna acción inalcanzable):** es el punto sensible — con 5 ítems, el menú abierto en la **última fila del listado** debe seguir entero y visible (ver *flip* en §1). Verificar a ojo en el pie de la lista, en viewport bajo (≈700px de alto).
- **Invariante 4 (superficies anchas scrollean dentro de sí):** no aplica — ni la fila ni el modal introducen superficie ancha nueva.

#### 5. Reglas duras

- **Verde/rojo = tipo:** el ítem "Duplicar" y su ícono son **neutros**; el único ítem rojo del menú sigue siendo Eliminar (`danger`, que es rol destructivo de UI, no monto).
- **Índigo = solo marca/foco:** aparece únicamente como focus ring del ítem y del trigger. Ni relleno ni texto de acento.
- **Mono tabular:** los montos precargados en el form conservan su input mono con prefijo `$`, y el ítem del kebab no muestra cifras.

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

### Frecuencia del fijo — entero 1..12 y sus etiquetas

La frecuencia del fijo es un **entero 1..12** (número de meses del período; la instancia cae cuando `monthDiff(startMonth, mes) % N === 0`). No existen palabras en castellano para todos los períodos, así que las etiquetas son **híbridas**: nombre canónico donde existe, "Cada N meses" donde no. Este set es la **fuente única** de las tres superficies (opción del select, ayuda del form, sublínea del ítem):

| N | Select (capitalizada) | Ayuda del form (minúscula, va en "Se registra automáticamente __ …") | Sublínea del ítem (minúscula, terso) |
|---|---|---|---|
| 1 | Mensual | cada mes | mensual |
| 2 | Bimestral | cada dos meses | bimestral |
| 3 | Trimestral | cada tres meses | trimestral |
| 4 | Cuatrimestral | cada cuatro meses | cuatrimestral |
| 5 | Cada 5 meses | cada cinco meses | cada 5 meses |
| 6 | Semestral | cada seis meses | semestral |
| 7 | Cada 7 meses | cada siete meses | cada 7 meses |
| 8 | Cada 8 meses | cada ocho meses | cada 8 meses |
| 9 | Cada 9 meses | cada nueve meses | cada 9 meses |
| 10 | Cada 10 meses | cada diez meses | cada 10 meses |
| 11 | Cada 11 meses | cada once meses | cada 11 meses |
| 12 | Anual | cada año | anual |

**Racional de los tres registros.** La **ayuda del form** deletrea el número en palabras ("cada cuatro meses") porque es la superficie donde el usuario **confirma una decisión irreversible** (la frecuencia es inmutable, RF-MF-006): ahí la desambiguación explícita vale más que la brevedad, y resuelve la confusión clásica de "bimestral/cuatrimestral". La **sublínea** usa dígito ("cada 5 meses") porque es una línea de metadatos densa que trunca: el dígito es más terso y se lee de un vistazo. El **orden del select es estrictamente 1→12** (período creciente): la posición N-ésima es N meses, así el propio orden ancla el conteo aunque el nombre no lo diga.

### Selector de frecuencia del form de fijo

El bloque **Frecuencia** del form de fijo (entre Mes de inicio y Categoría en crear; entre Monto y Categoría en editar) sigue el patrón de bloque del form (`Label` arriba + control). Etiquetas por valor: las 12 de la tabla anterior, columna *Select*, en orden 1→12.

- **Crear:** `Select` **nativo** del DS (el mismo molde `.input.select` ya usado para Categoría/Método), `required`, **12 `<option>`**, default **Mensual** (valor 1, sin placeholder vacío). Se mantiene el select nativo — no segmented ni picker custom: 12 opciones en un segmented serían targets diminutos que envuelven; el dropdown nativo las lista y scrollea con carga cognitiva mínima y patrón familiar. El texto de cada `<option>` es la etiqueta capitalizada de la tabla, **sin** prefijo numérico (el orden ya ancla el conteo; el número explícito es notación de enumeración, no lenguaje natural).
- **Ayuda (solo en crear):** bajo Categoría, `Repeat` 14px `--accent-ink` + texto 12.5px `--muted`: "Se registra automáticamente **{ayuda}** a partir del mes de inicio." donde `{ayuda}` es la columna *Ayuda del form* de la tabla. Recalcula en vivo al cambiar el select.
- **Editar (inmutable):** caja **read-only con badge**, mismo patrón que "Tipo" en edición (`rounded-ctl border-line bg-panel-2 px-[13px] py-[11px]`): glifo `Repeat` 15px `--accent-ink` + la etiqueta capitalizada de la tabla. Sin ayuda debajo (no hay decisión que confirmar). No hay control editable: la frecuencia no se cambia tras crearse.

> La frecuencia también se muestra en la **sublínea del ítem** (segmento `Repeat` 12px + etiqueta en minúscula de la tabla: mensual / bimestral / … / cada 5 meses / … / anual), sin badge ni decoración extra.

### Arranque y vigencia del fijo — en la card de detalle

> **Actualizado (Card de detalle):** el arranque del fijo (`startMonth`) ya **no** vive en la col 3 de la fila — **la col 3 vuelve a ir vacía para fijos**. El arranque migró a la card de detalle, donde se combina con el **fin** (`endMonth`, dato nuevo del contrato) en una sola línea de **"Vigencia"** (`Desde Mar 2024 · activo` o rango `Mar 2024 – Jun 2026`). Ver *Card de detalle de movimiento*. Lo de abajo queda como referencia histórica del formato `formatMonthShort`, que la card reusa.

El **arranque del fijo lógico** = `MovementItem.startMonth` de la **primera fila de la cadena** (`chainId`), no el del último split. Ya **no** se muestra en la col 3 (locator vacío para fijos); vive en la card. Referencia de formato:

- **Formato:** `desde {Mmm AAAA}` — mes **abreviado a 3 letras capitalizado** + año completo (ej. `desde Mar 2024`). Es un formato de mes compacto nuevo (análogo al "Jun" de `formatDate`); no es cifra de dinero, por lo tanto **no va en mono** (regla dura 3 no aplica — es un rótulo, no un monto).
- **Peso visual:** subordinado. `text-[12.5px]`, la preposición "desde" en `--faint` y el mes-año en `--muted`; `text-right`, `whitespace-nowrap`. Queda **exactamente al nivel de prominencia** de la fecha de un único (quieto, chico, a la derecha), que es la jerarquía correcta: un locator de contexto, no un dato que compita con el nombre ni el monto.
- **Por qué col 3 y no la zona de identidad:** (a) evita el choque de dos "desde" en los calculados de origen fijo, cuya identidad ya lleva "↳ desde {Origen}" — tener "desde Mar 2024 · ↳ desde Alquiler" en la misma línea sería ambiguo; la separación física en col 3 lo resuelve. (b) No engorda ni acelera el truncado de la zona de identidad. (c) Reusa el slot vacío de col 3 en vez de sumar un segmento nuevo.
- **Alcance:** aparece en **fijos** y en **calculados de origen fijo** (que muestran **su propia** cadena, no la del origen). Los únicos siguen con su fecha, las cuotas con "Cuota X/N": la col 3 nunca muestra dos cosas a la vez.
- **Anulado (`skipped`):** hereda el `opacity-[0.55]` de la fila como el resto de la col 3.

### Card de detalle de movimiento (`/mes`) — apertura, contenido read-only y fila adelgazada

La **fila de `/mes`** (`MovementItemRow`) deja de amontonar metadatos secundarios: pasa a ser un **vistazo** (identidad + monto + un discriminador) y todo el dato secundario se lee en una **card de detalle read-only** que se abre al clickear la fila. La card es **read-only pura**: solo consulta, **no edita nada** ni lleva botón de acción. Editar vive en el **kebab "⋮" de la fila** (el botón en la card sería redundante). La card se abre para "espiar" y se cierra con ✕/Esc/scrim.

#### Forma — modal centrado sobre `ModalShell` (variante `dialog`), NO panel lateral

La card es un **modal centrado** que consume el **`ModalShell`** existente (variante `dialog`, `max-w-[440px]`, radio 18px, `--shadow-lg`, scrim con blur, tres zonas header/cuerpo/footer). **Por qué reusar `ModalShell` y no inventar un panel lateral (side-sheet):** (a) el contenido es una **ficha compacta read-only** (lista de pares rótulo·valor), no una superficie de trabajo persistente que justifique un drawer; (b) `ModalShell` ya resuelve —gratis— los cuatro invariantes de contención (`max-h: calc(100dvh − 48px)` en `dvh`, cuerpo scrolleable, footer pineado, body-lock, portal, clipping al radio 18px); un side-sheet obligaría a redefinir posicionamiento, transición y contención desde cero, sin beneficio para contenido compacto; (c) mantiene la **consistencia de overlays** de la app. Una solución nueva tendría que justificar por qué no reusa el patrón vigente — acá no hay justificación.

- **Sin estado de carga / vacío / error:** la card **no dispara fetch** — renderiza el `MovementItem` que la lista **ya tiene en memoria**. No hay skeleton, empty ni error propios; es presentación pura del dato ya cargado.
- **Cierre (excepción justificada a la regla de modales):** la card es **read-only y auxiliar** — no demanda una decisión explícita, se abre para "espiar". Por eso se cierra con **✕, `Esc` Y clic en el scrim** (cierre tipo popover), a diferencia de los modales de decisión (transaction-modal, confirmaciones), que **no** cierran por clic afuera. Es la misma lógica del DS (*Cierre de overlays*): "auxiliar y liviano → se descarta al tocar fuera". El chrome es de modal (`ModalShell`), el **cierre** es de popover.
- **Animación:** `animate-modal-pop` del shell (respeta `prefers-reduced-motion`).

#### Conflicto de invocación — cuerpo abre card, kebab abre menú

La fila tiene **dos zonas de clic**: el **cuerpo** (cols 1–4) abre la card; el **"⋮" (kebab, col 5)** abre su menú de acciones rápidas (Editar / Anular-Des-anular / Crear desde este / Eliminar — sin cambios). Resolución:

- **Cuerpo de la fila:** el contenedor de la fila es clickeable → abre la card. `role="button"`, `tabIndex=0`, `onKeyDown` con `Enter`/`Espacio`, `aria-label="Ver detalle de {nombre}"`, `cursor-pointer` (ya presente). El hover `--panel-2` (o el fill de límite) ya comunica que la fila es interactiva.
- **Kebab:** sigue siendo un `<button>` real; su `onClick`/`onKeyDown` hace **`stopPropagation`** para que su clic **no** burbujee al cuerpo (no abre la card). Cada ítem del menú también corta la propagación. Orden de tab: fila → kebab.
- **A11y (caveat de anidado):** para no anidar un `<button>` dentro de otro `<button>`, la fila usa `role="button"` sobre un `div` (no un `<button>` nativo) y el kebab queda como botón hermano interactivo; el `stopPropagation` garantiza que activar el kebab nunca dispare la card. El mecanismo exacto lo cierra `control-frontend`; el comportamiento a cumplir es el de arriba.
- **Editar vive solo en el kebab.** La card es read-only pura y **no** ofrece camino a editar; la única puerta a edición es "Editar" en el menú del "⋮", que abre el modal de edición actual (no se rediseña).

#### Qué QUEDA en la fila adelgazada (vistazo)

Grid sin cambios (`40px 1fr auto auto auto`). Queda **solo** lo glanceable:

- **Col 1:** ícono 40×40 tintado por tipo (sin cambios).
- **Col 2 — nombre + sublínea de identidad:** `[Anulado] [badge de límite] ● Categoría · [Repeat frecuencia] (solo fijos y calculados de origen fijo) · [↳ desde {Origen}] (solo calculados)`. **Zona de estados** (cluster derecho) reducida a: `[glifo de límite]` + `[GitBranch padre]`. Ver *Sublínea del ítem — dos zonas* (actualizada).
- **Col 3 — un solo discriminador:** fecha `DD Mmm` del único **(solo la fecha, la hora migra a la card)** · `Cuota X/N` de la cuota · **vacía** para el fijo (el arranque migró a la card).
- **Col 4 — monto convertido dominante:** mono 15.5px, color por tipo, signo. **Siempre una sola línea** (se retira el badge de moneda y la segunda línea de valor original — migran a la card). El efecto `bold`/`fill` de límite se conserva.
- **Col 5 — kebab** (sin cambios).
- **Estados que quedan:** badge **"Anulado"** (con `line-through` + `opacity-0.55` de la fila) y las **marcas de límite** (badge/glyph/fill). Sin cambios de semántica.

#### Qué MIGRA de la fila a la card

Se **sacan de la fila** y pasan a la card (todos ya en el contrato `MovementItem`): **método de pago** (icono + nombre + tipo) · **badge de moneda + monto original + cotización** (cross-rate) · **débito automático** (glifo `Zap`) · **arranque del fijo** (`startMonth`, ex "desde Mmm AAAA" de col 3) · **fórmula completa del calculado** (la fila conserva solo `↳ desde {Origen}`) · **hora exacta** del único (`occurredAt`). Suma **dato nuevo del contrato**: **fin/vigencia del fijo** (`endMonth: string | null`, "YYYY-MM" exclusivo; null = activo indefinido).

#### Anatomía de la card (read-only)

La card es **read-only pura**: se compone de **título + ✕ + hero + ficha**, y **no lleva footer ni botón de acción**. Cierra con ✕/Esc/scrim.

**Header (pineado):** `flex items-center justify-between px-[22px] pt-5 pb-4`. **Nombre** del movimiento (rol *Título de diálogo*, 18px/700 `-.01em`, `--ink`, `truncate`) + botón **✕** del DS. Nunca scrollea.

**Cuerpo (única zona scrolleable):** `px-[22px] py-[18px] space-y-[16px]`. De arriba a abajo:

1. **Badge "Anulado"** (solo si `skipped`) — chip neutro del DS (`--panel-3`/`--muted`/`--r-chip`/11px·600·`.04em`), como primera línea; el hero de monto va con `line-through` (mismo lenguaje que la fila).
2. **Bloque hero del monto** — `flex items-center gap-[14px]`:
   - **Ícono 40×40 tintado** por tipo (idéntico a col 1 de la fila — continuidad visual fila↔card).
   - **Cifra convertida** dominante: mono, rol *Stat valor* (**30px/600 `-.02em`**), **color por tipo** (`--ink` gasto / `--income-ink` ingreso — regla del signo), con signo y símbolo de la default. `line-through` si `skipped`. **El tipo NO se rotula en texto** (lo comunican el ícono tintado + signo/color, igual que en la fila; no se agrega badge "Gasto/Ingreso" para movimientos normales — sí en el bloque de fórmula del calculado, donde el tipo es derivado).
   - Si **cross-rate** (`currency ≠ default`): a la derecha de la cifra, el **badge de código** de moneda original (chip neutro `--panel-3`/`--muted`/`mono`, ej. `USD`) — marca el ítem como cross-rate, misma pieza que hoy vive en la fila.
3. **Divisor `--hair`** full-width.
4. **Ficha de detalle — lista de pares rótulo·valor.** Patrón de fila reusable: `flex flex-wrap items-start justify-between gap-x-[16px] gap-y-[2px]`, ritmo `space-y-[10px]`. **Rótulo** a la izquierda (rol *Meta*, 12.5px/500, `--muted`). **Valor** a la derecha (`text-right`, `--ink-2`; cifras, fechas y horas en **mono tabular**). Filas (omitiendo las que no apliquen):
   - **Categoría** — `● category.color` (punto 6px) + `category.name`.
   - **Método de pago** (solo si `paymentMethod ≠ null`) — glifo del método (`PaymentMethodIcon` 14px `--ink-2`) + nombre (`--ink-2`) + **chip de tipo neutro** (`Crédito`/`Débito`/`Efectivo`, `--panel-3`/`--muted`/`--r-chip`). Si no hay método, la fila **se omite** (dato opcional; su ausencia no es informativa).
     - **Sublínea de días del crédito** (solo si `type === "CREDIT"` **y** al menos uno de `closingDay`/`paymentDay` tiene valor) — **segunda línea secundaria muted** bajo el nombre del método, **alineada a la derecha** (misma columna de valor; el bloque del valor apila nombre+chip arriba y esta sublínea abajo con gap `2px`). Tono **`--muted`, 11.5px**, en **mono tabular** (son días del mes, dígitos que se alinean). Formato: `Cierre día {closingDay} · Cobro día {paymentDay}`, **orden fijo cierre → cobro** (el orden mental del ciclo de tarjeta: primero cierra el resumen, después se cobra), separador `·`. Si solo uno de los dos días está cargado, se muestra **solo ese segmento** (sin separador). Es informativa solo para crédito (fechas del ciclo del resumen); para Débito/Efectivo estos campos no existen y la sublínea **no se renderiza**.
   - **Débito automático** (solo si `autoDebit === true`) — glifo `Zap` 14px `--muted` + valor **"Sí"**. Se omite si es `false`/`null`.
   - **Cross-rate (solo si `currency ≠ default`)** — dos filas: **"Monto original"** = `formatCurrency(|amountCents|, currency)` con símbolo de su moneda (ej. `US$20,00`, mono `--ink-2`, sin signo); **"Cotización"** = `1 {currency} = {símbolo default}{cotización}` (ej. `1 USD = $1.100,00`, mono `--muted`).
   - **Único → "Fecha"** — `formatDate(occurredAt, timezone)` + `·` + `formatTime(occurredAt, timezone)` (ej. `02/06/2026 · 14:30`, mono `--ink-2`). **Acá vive la hora exacta** que la col 3 de la fila no muestra.
   - **Fijo → "Frecuencia"** — etiqueta **capitalizada** de la tabla de frecuencias (ej. `Mensual`, `Cada 5 meses`). (La fila muestra la variante en minúscula; la card el registro capitalizado de una ficha.)
   - **Fijo → "Vigencia"** — arranque + fin en una línea:
     - `endMonth === null` (activo indefinido): **`Desde {formatMonthShort(startMonth)} · activo`** (ej. `Desde Mar 2024 · activo`; "activo" en `--muted`).
     - `endMonth` presente: **rango** `{formatMonthShort(startMonth)} – {formatMonthShort(último mes activo)}` con guion medio "–". **`endMonth` es exclusivo** → el último mes activo es `prevMonth(endMonth)` (ej. `endMonth = "2026-07"` ⇒ `Mar 2024 – Jun 2026`). Si arranque == último mes activo, colapsa a un solo mes (`Mar 2024`).
   - **Cuota → "Plan de cuotas"** — `Cuota {number} de {total}` + `·` + `desde {formatMonthShort(installment.startMonth)}` (números en mono).
   - **Cuota → "Total del plan"** (fila propia, inmediatamente debajo de "Plan de cuotas"; se omite si `installment.total === 1`) — `|amountCents| × installment.total` en la **moneda original** del movimiento. Ver *Total del plan de cuotas — las tres superficies*.
5. **Bloque del calculado** (solo si `calculated ≠ null`) — precedido por **divisor `--hair`**:
   - **"Origen"** — caja read-only estilo *form de calculado* (`rounded-ctl border-line bg-panel-2`, glifo por tipo de origen `Repeat`/`Receipt`/`CreditCard` 15px `--accent-ink` + `sourceDescription`; a la derecha su tipo/frecuencia si aplica).
   - **"Fórmula"** — la **expresión legible completa** del cálculo, **reusando el builder del preview del form de calculado**: expresión en `--muted` mono (ej. `10% de $5.000`) + `=` + **resultado** (cifra mono con color por tipo y signo, ej. `= $500`), más el **badge de tipo derivado** tintado (`Gasto` `--expense-ink/-soft` / `Ingreso` `--income-ink/-soft`) — acá el badge sí aplica porque el tipo del calculado es **derivado**. Si `sourceAmountCents === null`, se muestra la fórmula en forma abstracta (operador + operando + origen) sin la cifra del origen; el resultado siempre está disponible del propio monto.
6. **Bloque "Calculados" — derivados del origen** (solo si el movimiento es **origen** de ≥1 calculado **en el mes**: `MovementItem.calculatedChildren.length >= 1`) — precedido por **divisor `--hair`**. Es el **espejo del bloque "Origen"** (item 5): mismo contenedor con borde, **read-only, no clickeable**. Donde el calculado muestra *su* origen (uno), el origen muestra *sus* derivados (N) → una **lista** de esas mismas cajas, una por derivado. Cada derivado del contrato (`MovementItem.calculatedChildren`) trae `id`, `description` (nombre), `type` (`EXPENSE`/`INCOME`) y `convertedAmountCents` (magnitud; el signo se deriva del `type`).
   - **Rótulo de la sección: "Calculados"** — mismo estilo que "Origen"/"Fórmula" (12.5px/600 `--ink-2` `tracking-[0.01em]`). Nombra las entidades (son movimientos *calculados* derivados de éste), es el término de dominio que el usuario ya conoce y es tan corto como "Origen". (Se evaluó **"Derivados"** / **"Calculados derivados"**: describen mejor la dirección de la relación pero son más largos y menos concretos que el sustantivo de dominio; "Calculados" es inequívoco dentro de la card.) **Sin contador** en el rótulo: la lista visible ya comunica la cantidad, y "Origen" tampoco lleva contador.
   - **Layout — `flex flex-col gap-[7px]`** (rótulo → lista); la lista apila las cajas de derivado con `gap-[7px]`. **Cada ítem derivado espeja la caja de "Origen" exactamente:** `flex items-center gap-2 rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px]`.
     - **Ícono de tipo (izq):** flecha diagonal de tipo derivado, **tintada por tipo** — `ArrowUpRight` ingreso (`--income-ink`) / `ArrowDownRight` gasto (`--expense-ink`), 15px, `shrink-0`. Ocupa el **mismo slot** que el ícono de "Origen" (misma posición y tamaño) y **reusa los glifos de tipo derivado** que el badge del bloque *Fórmula* ya usa. **Por qué tintado por tipo y no `--accent-ink` neutro como "Origen":** todos los derivados comparten el mismo tipo estructural ("calculado"), así que un ícono estructural neutro sería idéntico en cada fila y no aportaría; lo que **varía y conviene discriminar de un vistazo es el tipo (gasto/ingreso)**. Usar income/expense sobre un ícono que *significa* tipo cumple la regla dura 1 (es su uso legítimo, no la viola).
     - **Nombre:** `child.description`, `text-[14px] font-semibold text-ink-2 flex-1 min-w-0 truncate` — idéntico al nombre de "Origen".
     - **Monto del derivado (der.):** `child.convertedAmountCents` en **mono tabular**, color por tipo según la convención de esta card (gasto `--ink`, ingreso `--income-ink`), con signo (`formatSignedAmount`), `shrink-0 whitespace-nowrap`, ~13.5px/600, ocupando el slot que en "Origen" usa el descriptor de frecuencia. **Racional:** "Origen" no muestra monto porque el monto del calculado ya es el **hero** de *su* card; acá, en cambio, cada derivado es **otro** movimiento cuyo monto **no aparece en ninguna otra parte de esta card** — mostrarlo convierte "estos son mis derivados" en "estos son mis derivados **y cuánto impactan**", que es la lectura útil de un diario de gastos.
   - **Read-only, no clickeable** (igual que "Origen"): sin hover interactivo, sin `role="button"`, sin `cursor-pointer`, sin navegación. Lectura pura. (Un futuro "saltar al derivado" sería alcance nuevo y requiere decisión explícita.)
   - **Sin fórmula por derivado:** a diferencia del bloque de un calculado (que muestra la fórmula de su **único** origen), la lista de N derivados **no** repite N fórmulas — sobrecargaría la card y rompería el escaneo (carga cognitiva). Cada caja muestra solo tipo + nombre + monto.
   - **Relación con el bloque del calculado (item 5):** son **mutuamente excluyentes en la práctica** (un calculado no es origen de otro; un origen no es calculado). Si por dato ambos aplicaran, "Calculados" va **después** del bloque del calculado. En cualquier caso es el **último bloque** de la card, tras la ficha y precedido por su `--hair`.

**Sin footer ni botón de acción.** La card es read-only pura: el cuerpo (ficha) es el último bloque y la card cierra con **✕, `Esc` y clic en el scrim**. No hay footer pineado ni botón "Editar" (editar vive en el kebab de la fila).

#### Reglas duras en la card

- **R1 (verde=ingreso/rojo=gasto):** el color de la cifra hero y del resultado del calculado lo da el **tipo**; el punto de categoría usa la paleta de categorías (identidad, nunca sobre cifra); el badge de tipo del calculado y el **ícono de tipo + monto de cada derivado** del bloque "Calculados" usan income/expense por su significado real. Método, moneda, cotización y chips de tipo van en **neutros**.
- **R2 (índigo solo marca):** el único índigo es cromo de interacción (focus del ✕). Ninguna cifra se tiñe de índigo.
- **R3 (dinero en mono tabular):** hero, monto original, cotización, resultado de fórmula, los números de cuota y el **monto de cada derivado** del bloque "Calculados" van en **mono tabular**.

#### Comportamiento en pantalla chica (compacto, `< --bp-wide` / hasta el piso 640px, sidebar abierto o cerrado)

- **La card hereda la contención del `ModalShell`:** `max-h: calc(100dvh − 48px)` (**`dvh`**), cuerpo `overflow-y-auto`, header pineado, body-lock, portal, clipping al radio 18px. **Invariante 2** (modal completo y scrolleable) cubierto por el shell; la card no tiene footer/acción, así que no aplica el invariante de control pineado al pie.
- **Panel `w-full max-w-[440px]`:** en contenido angosto (piso 392px con sidebar abierto) el panel encoge a `viewport − 2×24px` de scrim. Las **filas rótulo·valor son `flex-wrap`:** cuando el valor no entra al lado del rótulo, **envuelve a su propia línea** debajo — el rótulo nunca empuja a la cifra ni la trunca.
- **Ninguna cifra se trunca (regla dura).** Si en el ancho mínimo una cifra (hero, original, cotización) no entra, su bloque **scrollea dentro de sí** (invariante 4); **nunca** desborda el body (invariante 1) ni corta el número.
- **Bloque "Calculados" (compacto):** cada caja de derivado sigue el mecanismo de "Origen" — ícono de tipo `shrink-0`, **nombre `truncate min-w-0`** (cede primero), **monto `shrink-0 whitespace-nowrap` en mono nunca truncado** (regla dura). Las cajas apilan verticalmente; sin scroll horizontal. Si en el ancho mínimo el nombre + monto no entran juntos, el nombre trunca con elipsis y el monto queda íntegro.
- **La fila adelgazada mejora su contención** respecto de hoy: col 4 pasa a una sola línea y la sublínea pierde segmentos → menos presión de ancho. Mantiene su grid; col 2 (identidad) trunca con `min-w-0`; col 4 (cifra mono) nunca trunca; la lista sigue el mecanismo de contención vigente de `/mes` (inv. 1 y 4). El clic para abrir la card funciona igual en compacto (la card queda contenida por el shell).

#### Checklist de aceptación visual — card de detalle + fila adelgazada

- [ ] **Fila adelgazada — col 2:** la sublínea ya **no** muestra método de pago ni el glifo `Zap` de autodébito; quedan `● Categoría`, la frecuencia (fijos) y `↳ desde {Origen}` (calculados). El cluster de estados solo muestra límite y `GitBranch` (padre).
- [ ] **Fila — col 3:** único = fecha `DD Mmm` (sin hora); cuota = `Cuota X/N`; **fijo = vacía** (ya no dice "desde Mmm AAAA").
- [ ] **Fila — col 4:** una sola línea siempre; sin badge de código de moneda ni segunda línea de valor original (aun en cross-rate).
- [ ] **Apertura por cuerpo:** clic (o `Enter`/`Espacio`) en el cuerpo de la fila abre la card; clic en el **⋮** abre el menú y **no** abre la card.
- [ ] **Cierre:** la card cierra con **✕, `Esc` y clic en el scrim** (a diferencia del modal de edición, que no cierra por clic afuera).
- [ ] **Hero:** ícono 40×40 tintado + cifra convertida grande (mono, color por tipo, signo); en cross-rate aparece el badge `USD` junto a la cifra.
- [ ] **Ficha:** filas Categoría / Método (+chip tipo) / Débito automático ("Sí", solo si aplica) / y las condicionales por tipo con los rótulos correctos.
- [ ] **Método — sublínea de crédito:** para un método **Crédito** con días cargados aparece una **segunda línea muted (11.5px, mono), alineada a la derecha bajo el nombre**, con `Cierre día {n} · Cobro día {n}` (orden cierre → cobro). Con un solo día cargado se muestra solo ese segmento; para **Débito/Efectivo** (o crédito sin días) la sublínea **no aparece**.
- [ ] **Único:** fila "Fecha" muestra **fecha + hora** (`02/06/2026 · 14:30`).
- [ ] **Fijo:** "Frecuencia" capitalizada + "Vigencia" (`Desde Mar 2024 · activo` cuando `endMonth` null; rango `Mar 2024 – Jun 2026` con fin = mes anterior a `endMonth` cuando presente).
- [ ] **Cuota:** "Plan de cuotas" = `Cuota 3 de 12 · desde Mar 2024`, y debajo **"Total del plan"** = `$120.000,00` (mono `--ink-2`, sin signo). Con `total === 1` la fila **no** aparece. En cross-rate el total va en la **moneda original** con su símbolo + chip neutro del código (`USD`), y **no** se convierte.
- [ ] **Calculado:** bloque Origen (caja read-only) + Fórmula legible con resultado y badge de tipo derivado.
- [ ] **Origen de calculados:** si el movimiento es origen de ≥1 derivado **en el mes**, aparece el bloque **"Calculados"** (último bloque, tras la ficha, precedido por `--hair`) con **una caja por derivado**, espejo de "Origen": ícono de tipo tintado (↗ ingreso `--income-ink` / ↘ gasto `--expense-ink`) + nombre truncable + **monto por tipo**. Las cajas son **read-only, no clickeables** (sin hover ni cursor de interacción). Si el movimiento **no** tiene derivados, el bloque **no aparece**.
- [ ] **Derivados — monto:** cada caja muestra `convertedAmountCents` en **mono tabular**, color por tipo (gasto `--ink` / ingreso `--income-ink`), con signo; en compacto el nombre trunca antes y el monto **nunca** se trunca.
- [ ] **Anulado:** badge "Anulado" en la card y hero con `line-through`.
- [ ] **Read-only pura:** la card **no** tiene footer, botón "Editar" ni ninguna acción — es solo consulta; se cierra con ✕/Esc/scrim. Editar se accede desde el kebab "⋮" de la fila, no desde la card.
- [ ] **Reglas duras:** todas las cifras en mono tabular; ningún monto teñido de índigo; color de cifra = tipo.
- [ ] **Compacto (≤940px, hasta 640/392px):** card completa y scrolleable, filas rótulo·valor que envuelven, ninguna cifra truncada, sin scroll horizontal del `body`.

### Total del plan de cuotas — las tres superficies

En Control una compra en cuotas se registra por su **monto por cuota** (`InstallmentGroup.amountCents` es por cuota; las N cuotas son iguales). El usuario, en cambio, piensa la compra también por **cuánto le sale en total**. El total es **derivado y exacto** (`monto por cuota × cantidad de cuotas`, aritmética entera de centavos — sin redondeo, sin contrato nuevo) y se muestra en **tres superficies**: card de detalle de `/mes`, tooltip del gantt de Cuotas en `/reportes` y preview en vivo del form de cuotas. **La fila compacta de `/mes` NO lo muestra** (sigue siendo vistazo: `Cuota X/N` + monto de esa cuota).

**Reglas transversales (valen en las tres superficies):**

1. **El total nunca es la cifra dominante.** En cada superficie ya hay una cifra protagonista que es el **monto por cuota** (hero 30px de la card, cifra 13px/600 del tooltip, input 20px del form). El total siempre entra **subordinado por tamaño y peso**, nunca al lado ni al mismo rango que ella. La pregunta primaria sigue siendo "¿cuánto me sale por mes?"; el total es contexto.
2. **Rótulo único: "Total del plan"** — literal, mismas tres palabras en las tres superficies (consistencia: mismo concepto, mismas palabras). Descartados: "Total" a secas (ambiguo en el tooltip, donde "Progreso" habla de cuotas *visibles* del año → podría leerse "total visible"), "Total del plan de cuotas" (redundante con la fila "Plan de cuotas" que tiene arriba), "Total financiado" (registro contable; el modelo no tiene interés).
3. **Se omite cuando `total === 1`** en las superficies de **lectura** (card y tooltip): el total sería idéntico a la cifra dominante y una fila que repite el dato de arriba es ruido puro. En el **form** el preview **no** se omite (es un elemento fijo del formulario: aparecer/desaparecer mientras se tipea sería salto de layout).
4. **Sin línea de derivación en las superficies de lectura.** En card y tooltip el `N` ya está en la fila vecina ("Cuota 3 de 12", "12 cuotas") — repetir `12 × $10.000` es redundancia. En el **form sí** va la derivación, porque ahí el usuario está tipeando y necesita auditar la cuenta en vivo (y es el antídoto contra "creí que el monto era el total").
5. **Moneda — el total NO se convierte.** Decisión de producto cerrada: en cross-rate el total se muestra en la **moneda original** del movimiento (`amountCents × total`), sin extrapolar la cotización del mes a todo el plan (esa cotización vale para *esa* cuota, no para las 12). Cuando la cifra del total **no está en la moneda default**, lleva el **chip neutro del código** (mismo molde del badge de moneda: `--panel-3` / `--muted` / `--r-chip` / 11px·600·`.04em` / `mono`) a la derecha de la cifra, con `aria-label="Total del plan en {código}"`. En el **tooltip del gantt no aplica**: el monto de la barra ya viene en la moneda de display de la card.
6. **Reglas duras:** el total es dinero → **mono tabular** siempre (R3); **neutro** (`--ink` / `--ink-2`), **nunca** `--expense-ink` aunque la cuota sea gasto — el rojo semántico ya lo comunica la cifra dominante y el ícono de tipo; **nunca** índigo (R2). La moneda es cromo neutro.
7. **Informativo, no validado.** El total no bloquea guardar ni dispara error propio aunque supere `MAX_AMOUNT_CENTS` (el tope vive sobre el monto por cuota). Si el producto quisiera validarlo, es decisión funcional, no visual.

#### 1. Card de detalle de `/mes` — fila propia de la ficha

- **Forma: `DetailRow` nuevo**, no un segmento agregado a la fila existente. Se evaluó (a) sumarlo a la línea de "Plan de cuotas" (`Cuota 3 de 12 · desde Mar 2024 · total $120.000`) — se descarta: amontona tres hechos distintos en una línea y rompe el escaneo rótulo·valor de la ficha; y (b) sublínea muted bajo el valor (molde de los días del crédito) — se descarta: esa sublínea es para **atributos del mismo dato** (los días *son del método*), y a 11.5px `--muted` sub-pondera una cifra de dinero. Una fila rotulada es el patrón vigente de la ficha y no inventa nada.
- **Ubicación:** inmediatamente **debajo** de "Plan de cuotas", última fila de la ficha. En cross-rate queda a dos filas de "Monto original"/"Cotización", que ya instalan el registro de moneda original.
- **Rótulo:** `Total del plan` — rol *Meta*, 12.5px/500 `--muted` (idéntico a todos los rótulos de la ficha).
- **Valor:** `formatCurrency(Math.abs(amountCents) × installment.total, movement.currency)` — **mono tabular**, 13px, `--ink-2` (valor de ficha), **sin signo** (mismo criterio que "Monto original"; el signo/color del gasto ya los da el hero). Jerarquía contra el hero: 30px/600 vs 13px/400 → el total no compite jamás.
- **Cross-rate:** la cifra sale con el símbolo de su moneda (`US$240,00`) + **chip neutro `USD`** a la derecha. Sin nota explicativa extra: el chip + las filas "Monto original"/"Cotización" ya dicen que la moneda original es otra.
- **`skipped` (anulado):** el total **no** lleva `line-through` (anular afecta *esa* cuota del mes, no el plan). El `line-through` sigue siendo solo del hero.
- **Sin estados de carga/vacío/error:** la card no fetchea; si `origin !== "cuota"` o `installment === null` la fila simplemente no existe.

#### 2. Tooltip del gantt de Cuotas (`/reportes`)

- **Fila nueva `label ⟷ valor`** en el bloque de detalle, **entre `Cuotas` y `Progreso`** (la cantidad explica el total; el progreso es otro eje de lectura y cierra el bloque). Se evaluó colgarlo de la cifra dominante como segunda línea `--faint` — se descarta: mete un segundo número en la zona dominante y le disputa el ojo al "por cuota", que es la lectura primaria del gantt. Se evaluó fusionarlo en la fila `Cuotas` (`12 cuotas · $120.000`) — se descarta: dos magnitudes en un valor de 11px, y estira la columna de valor forzando el ancho.
- **Rótulo:** `Total del plan`, UI 11.5px/500 `--ink-2`, `flex-1 min-w-0` (trunca antes que la cifra si hiciera falta).
- **Valor:** `formatCurrency(bar.amountCents × bar.totalInstallments, currency)`, **mono `tnum` 11px/500 `--ink-2`**, `shrink-0 whitespace-nowrap` — mismo registro exacto que las filas `Cuotas`/`Progreso`. **No** sube de peso ni de tamaño: la única cifra jerarquizada del tooltip sigue siendo la de "por cuota" (13px/600 `--ink`).
- **Ancho:** el `min-width: 200px` del tooltip aguanta el caso normal (rótulo ~70px + gap 12 + cifra ~80px + padding 20 ≈ 182px). Con cifras muy largas el tooltip **crece** (es `min-width`, no ancho fijo) — la cifra **nunca** se trunca ni se abrevia (R3); el que cede es el rótulo. No se toca el anclaje ni el cromo del tooltip.
- **Omisión:** si `totalInstallments === 1`, la fila no se renderiza.
- **A11y (opcional, confirmar con el orquestador):** sumar `· total {monto}` al `aria-label` de la barra, para que el lector de pantalla tenga el mismo dato que el hover. Es el único punto que toca algo fuera del tooltip.

#### 3. Form de cuotas — preview en vivo

- **Forma: tira read-only** con el molde del preview del *form de calculado* (`rounded-ctl border border-line bg-panel-2`), **sin `<Label>` propio arriba** (un label externo la haría leer como campo editable; el rótulo va adentro). Padding `px-[13px] py-[10px]`, un poco más baja que las cajas de campo — es un resultado, no un input.
- **Ubicación:** **después** del grid `Cant. de cuotas + Mes de inicio` y **después** de su bloque de mensajes de error, **antes** de "Categoría". Va después de sus dos operandos (monto arriba, cantidad en el grid): un preview que precede a su propio input rompería el flujo. Hereda el ritmo `space-y-[14px]` del form (sin margen propio).
- **Layout:** `flex flex-wrap items-center justify-between gap-x-[16px] gap-y-[4px]`.
  - **Izquierda — rótulo:** `Total del plan`, 12.5px/600 `--ink-2` `tracking-[0.01em]` (registro de los `Label` del form: es el rótulo de la tira).
  - **Derecha — bloque apilado** (`flex flex-col items-end gap-[2px] shrink-0`):
    - **Cifra:** `formatCurrency(montoCents × cantidad, currency)`, **mono tabular 16px/600 `--ink`**, `whitespace-nowrap`. Subordinada al input de "Monto por cuota" (20px/600) por tamaño; sin color semántico.
    - **Derivación:** `{N} × {monto por cuota}` (ej. `12 × $10.000,00`), mono 11.5px `--muted`. Hace auditable la cuenta mientras se tipea y desactiva la confusión "el monto que puse es el total".
  - **Cross-rate** (`currency ≠ default`, elegida en "Más opciones"): la cifra y la derivación usan el **símbolo de la moneda elegida** (`US$`, `€`, `R$`) y se agrega el **chip neutro del código** a la derecha de la cifra. **No** se muestra equivalente en la default ni se convierte.
- **Estados:**
  - **Completo y válido** (monto parseable > 0 **y** cantidad entera > 0): cifra + derivación.
  - **Vacío / parcial / inválido** (cualquiera de los dos campos vacío, no parseable, 0, negativo o no entero — incluido el caso "monto cargado, cantidad no"): la tira **se mantiene visible en el mismo lugar** y muestra **`—`** en el slot de la cifra (mono 16px `--muted`), **sin** línea de derivación. Cero salto de layout. Se descarta ocultar la tira hasta tener ambos valores: aparecer/desaparecer mientras se tipea es salto vertical y esconde la existencia del dato.
  - **Campo en error (zod):** mismo tratamiento que inválido (`—`). La tira **nunca** se tiñe: el borde queda `--line`, sin rojo ni ring. El error ya está señalado en su campo; duplicarlo en el preview es doble señal y gasta el rojo, que es semántico de gasto/error de campo.
  - **`cantidad === 1`:** el preview **se muestra igual** (`1 × $10.000,00` / `$10.000,00`) — es un elemento fijo del form; ocultarlo sería salto de layout. Asimetría deliberada con card/tooltip (superficies de lectura, donde la fila redundante es ruido).
  - **Editar / duplicar:** el preview refleja los valores precargados desde el montaje, sin interacción previa.
  - Sin skeleton ni estado de carga: es cálculo local instantáneo.

#### 4. Contención responsive (obligatoria)

Umbral `--bp-wide`; piso 640px (contenido 392px con sidebar abierto).

- **Card:** el `DetailRow` es `flex-wrap` → si la cifra + chip no entran al lado del rótulo, **envuelven a su propia línea** (inv. 4). El bloque de valor es `inline-flex items-center gap-[6px] justify-end flex-wrap`, chip `shrink-0`, cifra `whitespace-nowrap` **nunca truncada** (R3). Sin scroll horizontal del body (inv. 1); la card sigue completa y scrolleable por el `ModalShell` (inv. 2).
- **Tooltip:** portal `fixed`, sin cambios de anclaje ni de flip. Rótulo `flex-1 min-w-0` (trunca primero), cifra `shrink-0 whitespace-nowrap`. El tooltip crece de ancho antes que romper la cifra; no genera overflow horizontal de la página (inv. 1).
- **Form:** la tira vive en el cuerpo scrolleable del modal → **no empuja el footer** de acciones, que sigue pineado y accesible (inv. 3). `flex-wrap`: en ancho mínimo el rótulo queda arriba y el bloque de cifra baja a su propia línea alineado a la derecha; la cifra nunca trunca (inv. 4).

#### Checklist de aceptación visual — Total del plan de cuotas

- [ ] **Card — fila:** en un movimiento de origen cuota con `total > 1` aparece **"Total del plan"** justo debajo de "Plan de cuotas", valor mono tabular `--ink-2`, sin signo, y el número **coincide** con `monto por cuota × cantidad`.
- [ ] **Card — jerarquía:** el hero (monto de *esa* cuota) sigue siendo la única cifra grande; el total no está en verde/rojo ni en índigo ni en negrita grande.
- [ ] **Card — cross-rate:** el total sale en la **moneda original** (`US$240,00`) con **chip neutro `USD`**, y **no** es el resultado de multiplicar el monto convertido (comparar contra "Monto original" × cantidad).
- [ ] **Card — anulado:** con el movimiento anulado, el hero tiene `line-through` y el total **no**.
- [ ] **Card — `total === 1`:** la fila "Total del plan" **no** aparece.
- [ ] **Tooltip — orden:** las filas quedan `Período` → `Cuotas` → `Total del plan` → `Progreso`.
- [ ] **Tooltip — registro:** el total va en mono tabular 11px/500 `--ink-2`, igual que sus filas vecinas; la cifra "por cuota" sigue siendo la única dominante (13px/600).
- [ ] **Tooltip — ancho:** con montos largos el tooltip crece sin cortar la cifra ni desbordar; con `totalInstallments === 1` la fila no aparece.
- [ ] **Form — ubicación:** la tira "Total del plan" está entre el grid `Cant. de cuotas / Mes de inicio` y el bloque "Categoría".
- [ ] **Form — en vivo:** al tipear monto y cantidad, la cifra y la derivación `N × monto` se actualizan en cada pulsación y coinciden con la cuenta.
- [ ] **Form — parcial:** con solo el monto (o solo la cantidad) la tira muestra `—` en `--muted`, sin derivación, **sin** cambiar de alto ni desaparecer.
- [ ] **Form — error:** con el campo de monto o de cuotas en error, la tira sigue **neutra** (borde `--line`, sin rojo) y muestra `—`.
- [ ] **Form — cross-rate:** eligiendo USD en "Más opciones", la cifra pasa a `US$…` + chip `USD`, sin equivalente convertido.
- [ ] **Compacto (hasta 640/392px):** en las tres superficies la cifra del total **nunca** se trunca ni se abrevia; envuelve a su propia línea si hace falta; sin scroll horizontal del body; el footer del form sigue pineado.
- [ ] **Reglas duras:** total siempre en mono tabular, neutro (nunca `--expense-ink` ni índigo); moneda como cromo neutro.

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

- **Badge de código de moneda:** chip neutro con el código (`"USD"`, `"ARS"`), **mismo molde que el chip "Anulado"** (`--panel-3` / `--muted` / `--r-chip` 7px / 11px·600·`.04em` / `mono`). Identifica la moneda de origen; no se tiñe.
- **Segmented neutro de moneda:** el **segmented del DS sin semánticos** (molde del triple switch de tipo): track `--panel-3`, radio `--r-pill`, padding `2px`; segmentos texto 13px/600 `mono`. Seleccionado = thumb `--panel` + `--shadow-sm`, texto `--ink`, deslizamiento 0.14s; no seleccionado = `--muted` → `--ink-2` en hover. **Sin color semántico ni índigo en los segmentos.** `role="radiogroup"` + `role="radio"`, focus ring `--accent-soft` 3px. Es el selector de moneda en `/configuracion` y en el bloque moneda+cotización de los forms. Tiene **4 segmentos** (ARS/USD/EUR/BRL); su forma completa se detalla en *Monedas configurables — set curado ARS/USD/EUR/BRL*.
- **Par moneda + cotización (forms de único/fijo/cuotas):** sub-bloque que **modula el Monto** desde dentro del **disclosure colapsable "Más opciones"** —que también contiene el selector de método de pago— ubicado como **último bloque del form, antes de los botones de acción** (ver *#### 4* punto (A) Ubicación). Cuando `moneda ≠ default`: `grid grid-cols-2 gap-[14px]` → Moneda (segmented neutro) + Cotización (input mono con **prefijo de par** de lectura, ej. `"USD→ARS"` / `"ARS→USD"` según la moneda seleccionada, en `mono` 12px `--muted`). Cuando `moneda == default`: el campo Cotización **se oculta** (queda solo el selector). Pre-carga editable: nota *field-note* "Cotización de referencia del mes" (glifo `History` 12px) → "Cotización modificada" al editar. Validación: cotización > 0 (error con borde `--expense` + ring `--expense-soft` + mensaje `--expense-ink`, mismo patrón que el Monto). El **calculado no muestra el bloque** (hereda moneda/cotización del origen, read-only).
- **Ítem de `/mes` (`MovementItemRow`) — solo el convertido, una línea:** **el monto convertido a la default domina y es lo único que la fila muestra** (col 4, 15.5px/600, color por tipo, mono, **una sola línea siempre**). Bajo anulado conserva `line-through` + color por tipo. **Actualizado (Card de detalle):** el **badge de código de moneda** y la **segunda línea de valor original** (cross-rate) ya **no** viven en la fila — migraron a la card de detalle (hero con badge `USD` + filas "Monto original" y "Cotización"); ver *Card de detalle de movimiento*. En la card se conserva el molde neutro del badge y del valor original (símbolo de su moneda, sin signo).
- **Tarjeta de ajuste (patrón reutilizable, `/configuracion`):** `.card` del DS con **fila de ajuste** `flex items-center justify-between gap-6` (izquierda: título 14.5px/600 `--ink` + descripción *Meta/subtítulos* `--muted`; derecha: el control). Molde para ajustes (un ajuste = una fila). El único ajuste vigente: "Moneda por defecto" (segmented neutro de moneda), que persiste **en vivo** al seleccionar (sin botón Guardar; toast de confirmación) y **recomputa el display** de `/mes` y reportes sin tocar lo guardado.
- **Sidebar:** link **"Configuración"** (`Settings` 18px) como **último** ítem de nav, mismo molde/estados que el resto; activo por prefijo `startsWith("/configuracion")`.
- **Reportes:** **no cambian** — ya operan sobre datos convertidos a la default (la conversión es capa de display aguas arriba del gráfico); no se rotula moneda ni se muestran originales en las cards. El cambio de default recomputa sus valores en vivo.

> El caso **mono-moneda no se ensucia** donde corresponde: el **ítem** de `/mes` (sin badge ni línea original cuando moneda=default) y `/configuracion` (un solo segmented) no muestran complejidad de multi-moneda. En el **form**, moneda+cotización (junto con el método de pago) vive dentro del disclosure "Más opciones", colapsado por default, y cuando moneda=default el campo Cotización se oculta.

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
- **`/mes`:** en el `.phead` (columna central de `PeriodNav`, régimen ≥1288px / `--bp-arrows`), fila del eyebrow "Tu mes" → `[Tu mes] [💳 ARS]`, encima del H1 "Junio 2026". En <1288px (header colapsado a `.stepper`), el chip va en la **misma fila del stepper**, a su derecha, sin romper el centrado del rótulo de mes.
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

#### 4. Disclosure "Más opciones" del form — moneda+cotización + método de pago

El form (tabs Único / Fijo / Cuota) agrupa **dos campos secundarios** —**moneda+cotización** (`CurrencyExchangeBlock`, compartido por transaction-form / recurring-form / installment-form) y **método de pago** (selector opcional + su checkbox condicional de *débito automático*)— dentro de **un único disclosure colapsable**. Reutiliza el **patrón disclosure** del *Acordeón* (cabecera = único `<button>` con `aria-expanded` + `aria-controls`, chevron que rota, animación altura 0↔auto + fade), aplicado a un bloque de form (no a una sección de lista). El cromo interno de cada sub-bloque vive en sus secciones propias (moneda: §1–§3 de esta sección; método: *Render del ícono en el selector de método del form de carga* y *Débito automático — control condicional en el form de carga*); acá se define **el disclosure que los contiene**: rótulo, ubicación, orden interno y resumen colapsado.

**(A) Rótulo y ubicación.**

- **Rótulo (copy exacto): "Más opciones".** Tipografía del label: **13px / 600**, `--ink-2` en reposo, `tracking-[0.01em]`, fuente UI (Space Grotesk). **Racional:** la sección agrupa dos campos heterogéneos (moneda/cotización + método de pago) que la mayoría de las cargas dejan en su default (moneda = default del usuario, sin método), así que un rótulo enumerativo ("Moneda, cotización y método de pago") sería largo y ruidoso, y el label literal viejo ("Moneda y cotización") ya no cubre el contenido. **"Más opciones"** es el rótulo neutro y honesto para "campos opcionales que abrís solo cuando los necesitás". Se prefiere sobre **"Avanzado"** (connota ajustes técnicos/riesgosos, ajeno a algo tan cotidiano como elegir el método de pago) y sobre **"Extra"** (más informal, menos claro sobre qué contiene). Es la etiqueta más corta que cubre ambos sub-bloques sin enumerarlos, coherente con la voz es-AR del form.
- **Ubicación: el último bloque del formulario — después de todos los demás campos, justo antes de la fila de botones de acción (Guardar / Cancelar).** El disclosure participa como **un bloque más** del stack del form, con el **gap estándar entre bloques** (`space-y-[14px]`) respecto del campo inmediatamente anterior; no rompe el ritmo de bloques del form. **Colapsado, el disclosure es una sola fila delgada** que no engrosa el pie del form (los campos que la mayoría de las cargas dejan en su default quedan replegados al final, fuera del flujo de los campos primarios). **Separación de la fila de botones:** entre el disclosure y la fila de acciones se conserva la **misma separación que el form ya deja entre su último bloque y sus botones** —no se inventa un valor nuevo—; como el trigger va **al aire** (sin caja de input, ver B), esa separación es la única señal que despega la fila delgada de los botones. **No se agrega divisor ni fondo entre el disclosure y los botones**: sumar un hairline separador acá recargaría el pie y competiría con el propio cromo del disclosure; el gap de bloque alcanza. Con el disclosure **expandido**, su cuerpo termina en el sub-bloque de Método de pago (o su checkbox de *débito automático*, ver D) y la separación al pie aplica desde el borde inferior del cuerpo abierto, con ese mismo gap —el cuerpo abierto no se acerca a los botones más que cualquier otro bloque del form.

**(B) Trigger (la cabecera del disclosure):** fila `<button>` **al aire** (sin caja de input), `w-full flex items-center gap-[7px]`, padding `py-[7px]` (alto cómodo de click, alineado al ritmo del form). Contenido de izq → der:

- **Chevron:** `ChevronRight` (lucide) **16px** `stroke-width 2`, **primer elemento**, `--muted` en reposo. Único glifo que **rota**: colapsado → ▶ (0°); expandido → ▼ (90°). Mismo lenguaje que el chevron del *Acordeón*.
- **Label:** **"Más opciones"** (tipografía en A).
- **Resumen a la derecha (colapsado):** ver **(C)**.
- **Estados del trigger** (mismo set que el disclosure del *Acordeón*):
  - **Reposo:** chevron `--muted`, label `--ink-2`, resumen en sus colores (C). `cursor: pointer`.
  - **Hover** (sobrio, sin fondo en la fila): chevron → `--ink-2`, label → `--ink`, transición 0.14s.
  - **Focus (teclado):** ring `--accent-soft` 3px con radio `--r-chip` 7px (`focus-visible`).
  - **Expandido:** chevron en ▼; sin cambio de color de fondo (la fila sigue al aire).
- **Arranca SIEMPRE colapsado.** Sin excepciones: también en **modo edición**, aunque el movimiento ya tenga `moneda ≠ default` con cotización cargada y/o un método de pago elegido. **Nunca auto-expandido.** El resumen colapsado (C) es suficiente para ver de un vistazo qué hay configurado sin forzar la apertura.
- **Animación de apertura:** altura del cuerpo 0↔auto (con `overflow: hidden`) + fade + rotación del chevron, **0.22s ease-out** (idéntico al *Acordeón*). Respeta **`prefers-reduced-motion`**: apertura/cierre **instantáneos** (sin transición de altura ni fade), el chevron cambia de orientación sin animar.

**(C) Resumen colapsado combinado — dos segmentos de un vistazo.** Cuando el disclosure está **colapsado**, al final de la fila (tras un `flex-1` divisor) se muestra un resumen de lo configurado, armado por **hasta dos segmentos en orden fijo** (moneda primero, método después — mismo orden que el cuerpo expandido y coherente con que la moneda modula el Monto de arriba):

1. **Segmento moneda (siempre presente):** el **código de moneda** en **`mono` 12px `--muted`** (ej. `"ARS"`, `"USD"`). Si `moneda ≠ default`, se suma la cotización: `"USD · 1.480,00"` (código + `·` separador `--faint` + valor mono `--ink-2`). Si `moneda == default`, solo el código. `shrink-0`: este segmento **nunca** se trunca (es la lectura de mayor prioridad —afecta el importe— y es corto).
2. **Divisor de grupo + segmento método (solo si hay método elegido):** un **hairline vertical** (`--line` 1px, `h-[12px]`, `mx-[8px]`, `self-center`, `shrink-0`, `aria-hidden`) separa el grupo moneda del grupo método —**no** se reusa el `·`, que ya es separador *interno* del grupo moneda, para no ambiguar la agrupación—. Luego: **glifo del método** (16px `--ink-2`, `shrink-0`) + **nombre del método** (UI 12px `--ink-2`, `truncate`). **Sin chip de tipo** en el resumen (se omite para no recargar). Si **no hay método** (`"Sin método de pago"`), este segmento **y su divisor se omiten por completo** — el resumen queda solo con el segmento moneda.
- **Débito automático NO aparece en el resumen:** es un sub-modificador del método (checkbox dentro del sub-bloque), no un tercer campo; sumarlo recargaría el resumen. El resumen resume **dos** campos: moneda y método.
- **Truncado / overflow:** el **nombre del método** es el **único elemento flexible** (`truncate`, elipsis) — cede primero cuando la fila se angosta (mobile). El label "Más opciones", el segmento moneda completo y el glifo del método **nunca** se truncan (`shrink-0`); el glifo del método se conserva aun con el nombre truncado (identifica el método visualmente).
- **Casos combinados (referencia):**
  - `moneda=default`, sin método → `ARS` (caso más común; limpio).
  - `moneda=default`, método Visa → `ARS │ [glifo] Visa`.
  - `moneda≠default`, sin método → `USD · 1.480,00`.
  - `moneda≠default`, método Visa → `USD · 1.480,00 │ [glifo] Visa`.
- Al **expandir**, todo el resumen se oculta (su info ya está en los controles abiertos).

**(D) Contenido y orden interno del cuerpo expandido.** El cuerpo abre con `mt-[7px]` respecto del trigger. Contiene **dos sub-bloques en este orden**, separados por un **divisor hairline `--hair` 1px horizontal (`my-[14px]`)** que los marca como dos agrupaciones distintas dentro de la sección:

1. **Sub-bloque Moneda+cotización** (primero — pega con el Monto de arriba). Su contenido depende de la moneda seleccionada — ver **(E)**.
2. **— divisor `--hair` —**
3. **Sub-bloque Método de pago** (segundo). Selector de método (opcional; *Render del ícono en el selector de método del form de carga*) y, **inmediatamente debajo**, el **checkbox condicional "Débito automático"** que se renderiza solo cuando el método elegido es de tipo Débito (*Débito automático — control condicional en el form de carga*). Este sub-bloque conserva su propio ritmo interno (`space-y-[14px]` entre selector y checkbox cuando el checkbox está presente).

**(E) Sub-bloque Moneda+cotización — caso `moneda == default` oculta la Cotización.** El backend ignora `exchangeRate` cuando `currency === anchorCurrency`, así que el form envía `exchangeRate = 1` sin afectar cálculos; no se muestra cotización en ese caso.

- **`moneda == default`:** el sub-bloque muestra **solo el selector de moneda**, a **ancho completo** del form (una sola columna full-width; el `CurrencySegmented` sin `compact`, con `px-[14px]` normal en sus segmentos). **No** se renderiza el label "Cotización", ni la caja del input, ni el prefijo de par, ni la nota *field-note*. Queda: label "Moneda" + segmented a 4.
- **`moneda ≠ default`:** el sub-bloque muestra el **grid `grid-cols-2 gap-[14px]`** → col izq selector de moneda (`compact=true`, mitad de ancho) + col der el input de cotización completo (prefijo de par real `"USD→ARS"`, nota *field-note*, validación).
- **Transición al cambiar moneda dentro del disclosure abierto:** al pasar de `default` a `≠ default` (o viceversa) con el disclosure **abierto**, la **columna de cotización aparece/desaparece** y el selector pasa de full-width a media-columna (y al revés). El cambio es sobrio: el selector reflowea a su nuevo ancho y la columna de cotización hace **fade + leve expansión de ancho** acompañando el reflow del grid (≈0.14–0.18s). Con **`prefers-reduced-motion`**: instantáneo (aparece/desaparece sin fade ni transición de ancho). No se anima la altura del disclosure (ya está abierto); solo reflowea su contenido.

**(F) El form Calculado NO renderiza la sección "Más opciones".** Hereda moneda y cotización de su **origen** (read-only, ver *Form de movimiento calculado*) y no muestra el selector de método: la sección entera queda fuera del calculado. El disclosure es exclusivo de los tabs Único / Fijo / Cuota.

> El requisito de "capturar la cotización" se cumple igual: en moneda=default el backend usa `exchangeRate = 1` (no necesita captura); cuando moneda≠default el campo está presente, editable y validado `> 0`.

> **Lo que esta sección NO toca (por diseño):** no hay UI para la tabla de cotizaciones de referencia (es interna); `/configuracion` tiene una sola tarjeta ("Moneda por defecto", con 4 opciones en el segmented); no hay tokens, colores ni reglas propios. Todo el cromo de las 4 monedas sale del **mapa de símbolos** y el **array de monedas del segmented**, y el del método del **allowlist de íconos** (`PAYMENT_METHOD_ICONS`) — puntos únicos ya centralizados.

### Selector de salto de mes/año en `/mes` (popover "rueda")

Hace **interactivo el rótulo de período** de `/mes` para **saltar rápido** a cualquier mes/año, sin reemplazar la navegación secuencial (flechas desktop / pill stepper mobile). Es **solo UI nueva**: al confirmar reusa la navegación de período existente (RF-VM-004) — navega al mes elegido. Convive con `PeriodNav` (flechas laterales gigantes ≥1288px y forma `.stepper` <1288px) como **atajo de salto largo**, no como reemplazo del "anterior/siguiente".

#### 1. Affordance — el rótulo de período se vuelve disparador

El rótulo del período es el disparador. **No** se agrega un botón aparte ni un ícono suelto que compita; el propio período (que ya es el elemento de mayor jerarquía del header) toma la afordancia, con un glifo de apoyo que comunica "esto despliega".

- **Desktop (≥1288px) — el `<h1>` "Junio 2026" pasa a `<button>`-like.** El H1 (32px/700, tracking `-.02em`, `--ink`) se envuelve en un disparador (`<button>` con el H1 adentro, `inline-flex items-center gap-[8px]`), conservando exactamente su tipografía y tamaño. A su derecha, un glifo **`ChevronsUpDown`** (lucide, **18px**, `stroke-width 2`, `--faint` en reposo, `shrink-0`, `aria-hidden`) — el glifo de doble flecha ↕ comunica "valores que suben/bajan", coherente con la metáfora de "rueda". El eyebrow ("Tu mes" + `CurrencyChip`) y el sub-label de estado ("Mes en curso"/"Histórico") **no cambian** y **quedan fuera** del disparador (el botón envuelve solo el H1 + chevron).
- **Mobile (<1288px) — el centro del pill `.stepper` se vuelve disparador.** El bloque central del `.stepper` (el texto `{mes} {año}` + sub-label de estado, hoy un `<div>` inerte entre las dos flechas) pasa a ser un `<button>` que abre el mismo popover. Las **flechas ‹ › del pill no cambian** (siguen navegando anterior/siguiente). Se suma el mismo glifo `ChevronsUpDown` **15px** `--faint` a la derecha del texto del mes, dentro del botón central, `gap-[6px]`. El sub-label "Mes en curso/Histórico" sigue debajo, dentro del botón. El centro deja de ser `aria-hidden`: ahora es accionable (label real). El pill conserva su molde (`--r-pill`, `--panel`, borde `--line`, `--shadow-sm`, padding 4px).
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

- **Desktop (≥1288px):** el popover se ancla **bajo el disparador (el H1)**, alineado a la **izquierda** del H1 (su borde izquierdo coincide con el inicio de "Junio 2026"), con `gap` vertical **8px** entre el H1 y el borde superior del popover. Como el header de `/mes` vive en la columna central de `PeriodNav` (régimen ≥1288px), el popover queda dentro del ancho de contenido, sin colisionar con las flechas laterales gigantes.
- **Mobile (<1288px):** se ancla **bajo el pill `.stepper`**, **centrado** respecto del botón central del pill (no respecto del viewport), `gap` 8px. Si el centrado lo sacaría del viewport, se alinea al borde con margen mínimo 12px (clamp horizontal).
- **Flip vertical (sin lugar abajo):** si no hay espacio suficiente debajo del disparador para los 240px de alto aproximado del popover (cerca del borde inferior del viewport), **flipea hacia arriba** y se ancla **sobre** el disparador (mismo `gap` 8px, ahora por encima), con la animación `pop` desde el borde inferior. El mecanismo (medición/colisión) lo resuelve `control-frontend`; el comportamiento a cumplir: el popover **siempre queda completamente visible** dentro del viewport, flipeando arriba/abajo y clampeando horizontal según haga falta.

#### 6. Convivencia con la navegación existente

- **No reemplaza nada.** Las **flechas laterales gigantes de `PeriodNav`** (≥1288px) y el **pill stepper** (<1288px) siguen siendo el camino para "mes anterior / siguiente" (saltos de a uno). El popover es el atajo para **saltos largos** (cambiar de año, ir a un mes lejano) sin clickear muchas veces.
- **Mismo destino, misma navegación.** Confirmar en el popover navega exactamente como las flechas (RF-VM-004): no hay un segundo mecanismo de carga de mes. El popover solo **elige** el período; la navegación es la de siempre.
- **El disparador sigue accionable durante el "modo orden de secciones"** (decisión funcional cerrada). El disparador **no** se deshabilita en ese modo: saltar de mes no rompe el modo orden, **consistente con las flechas de `PeriodNav`** (que también navegan sin salir del modo). El popover abre, navega y cierra con normalidad mientras el header está en modo orden.

> Reutiliza: el rótulo de período (H1 ≥1288px / centro del `.stepper` <1288px) como superficie, sin cambiar su tipografía; el **focus ring `--accent-soft`** del DS; el patrón de **input del form** (`border-line-strong`, `bg-panel`, mono tabular para cifras); el botón **primario índigo** (con su estado **disabled** mientras el año está incompleto) y el **ghost**. Aporta: el **patrón de dos ruedas mes/año cohesivas** (cada rueda = UNA pieza: contenedor único con borde `--line-strong` envolvente + divisores internos `--hair`, zonas ▲/valor/▼ sin fondo propio en reposo; año en mono tabular, mes como nombre en UI), su **affordance `ChevronsUpDown`** en el rótulo de período, y la aplicación de la **regla dura P6** (no cierra por click fuera; cierre por Ir / Cancelar / Esc / re-clic). **Ruedas independientes:** el Mes hace wrap circular sin tocar el año; el año solo cambia con su propia rueda (sin odómetro). **Sin rango de año** (navegación de `/mes` ilimitada): no hay estado de error ni steppers disabled por límite; el único feedback de "todavía no" es "Ir" disabled mientras el año no tenga 4 dígitos.

### Botón "Mes en curso" — recentrado temporal en el header de `/mes`

> **Reescrita 2 (rechazo del usuario a la versión link/13px-600 en la fila del título).** Historial: (1) versión chip/ghost con `LocateFixed`, descartada; (2) versión link de texto **13px/600 en la fila del título** con flecha que saltaba de lado (leading/trailing), también descartada. Lo que sigue reemplaza a **ambas**. Cambios de fondo cerrados con el usuario en esta iteración:
> - **(a) Más disimulado.** No debe leerse como botón de acción. Baja a **la misma tipografía que `Histórico`** (12.5px/500 `--muted`) — es un link de texto tenue, no una acción destacada.
> - **(b) Vuelve a la fila del `statusLabel`, junto a `Histórico`.** Ubicación **confirmada explícitamente**. Se lee `Histórico · → Ir al mes en curso` = **estado + su remedio** en la misma línea.
> - **(c) La flecha ocupa SIEMPRE la misma posición (leading, a la izquierda del texto).** Lo único que cambia es **hacia dónde apunta**. Si saltara de lado, el texto se correría — inaceptable.
> - **(d) El label mantiene el verbo:** "Ir al mes en curso".

Acción de **recentrado**: cuando el usuario navega **cualquier mes que no es el mes en curso**, un link lo devuelve al mes en curso de un toque, sin contar flechas ‹ › ni adivinar cuántos saltos faltan. Solo UI nueva; al activarse reusa la navegación de período existente (RF-VM-004, navega a `?month=<mes en curso>`).

#### 1. Visibilidad y semántica

- **Se muestra SOLO cuando `isCurrentMonth === false`.** En el mes en curso el link **no existe** (render condicional por `display`, no `visibility:hidden` — sin target de foco fantasma). No hay estado `disabled`: solo aparece cuando es accionable.
- **Label visible: "Ir al mes en curso"** (literal, con el verbo adentro). El verbo va en el **texto visible**, no en un `aria-label`. Nada de "corriente", "actual", ni "Hoy".
- **Convive, no reemplaza.** Las flechas ‹ › / pill stepper siguen siendo "anterior/siguiente"; el selector de salto sigue siendo el atajo de salto largo. Este link es el atajo de **un solo destino fijo** (el mes en curso), visible solo cuando estás fuera de él.
- Semánticamente es un **`<button type="button">`** (dispara una acción de cliente, no navega a una URL propia), **estilizado como link** de texto tenue.

#### 2. Forma — link de texto tenue, espejando `Histórico`

No es un chip: **sin borde, sin fondo, sin padding de botón, sin sombra, sin radio de superficie**. Es texto accionable inline, **calibrado para desaparecer en el ruido de la sublínea** hasta que el ojo lo busca — deliberadamente disimulado (rechazo explícito a que "lea como botón").

- **Tipografía: espeja `Histórico` exactamente → `text-[12.5px] font-medium text-muted`** (12.5px / peso 500 / `--muted`). Misma caja tipográfica que el `statusLabel` contiguo: el link **no** introduce una escala nueva ni un peso mayor en esa fila. Un paso por debajo del H1 (32px/bold) y sin competir con `Histórico`: son dos piezas de la misma meta.
- **Color reposo: `--muted`** (igual que `Histórico`). No `--ink-2` (era el reposo de la versión-botón descartada, demasiado firme). No `--faint` (se perdería del todo). `--muted` es el tono de la sublínea: el link vive **al mismo nivel** que el estado que remedia.
- **Sin subrayado en reposo.** La affordance en reposo la dan la flecha direccional + el verbo del label; el subrayado es **feedback de interacción** (ver §6). En reposo el conjunto lee como continuación tenue de la meta.
- **Nunca** acento índigo (es solo marca), **nunca** verde/rojo (reservados a ingreso/gasto). Utilidad de navegación neutra.
- **Layout interno:** `inline-flex items-center gap-[5px] whitespace-nowrap`. `gap-[5px]` texto↔flecha (más ceñido que la versión previa de 6px: acompaña la baja de escala a 12.5px).

#### 3. Flecha dinámica direccional — posición fija, sentido variable

Lleva **una** flecha `lucide-react`, **siempre en posición leading (a la izquierda del texto)**. Lo único que cambia entre meses es **hacia dónde apunta**. Esto **deroga la vieja restricción de "ícono no direccional"** — y esa derogación es deliberada, no un olvido: **que nadie la "corrija" de vuelta a un ícono neutro.**

- **Por qué una flecha dinámica, y no un ícono neutro:** una flecha *fija* (siempre →, o siempre ←) **mentiría la mitad de las veces** — apuntaría "adelante" cuando el destino está atrás. Por eso la spec vieja prohibía toda flecha y pedía un glifo neutro (`LocateFixed`, etc.). Una flecha *dinámica*, que apunta al lado real del mes en curso, **no miente nunca**: por eso ahora sí se permite, y es el **corazón del diseño**. El glifo neutro se descarta por mudo.
- **Mes visualizado en el PASADO** (el mes en curso está *adelante*) → **`ArrowRight` (→)**. Lectura: `→ Ir al mes en curso`.
- **Mes visualizado en el FUTURO** (el mes en curso está *atrás*) → **`ArrowLeft` (←)**. Lectura: `← Ir al mes en curso`.
- **Posición SIEMPRE leading (izquierda del texto), en ambos casos.** Solo rota el sentido del glifo. El borde izquierdo del glifo y el borde izquierdo del texto **no se mueven** al cambiar de sentido (→ y ← ocupan la misma caja de 13px): **cero corrimiento horizontal** del label entre meses pasados y futuros.
- **Refuerzo con la navegación:** el sentido de la flecha **coincide siempre** con el chevron (`‹` / `›`) que el usuario apretaría para llegar caminando mes a mes. Flecha y chevron se refuerzan.
- **Descartados explícitamente:** `LocateFixed`, `Crosshair`, `Target`, `CalendarCheck` y toda la familia de íconos neutros/no-direccionales. También descartado el patrón **leading/trailing variable** de la iteración anterior (la flecha no cambia de lado).
- **Tamaño: 13px**, `aria-hidden="true"`, hereda `currentColor` (sigue el color del texto en reposo/hover). 13px es levemente menor que los 14px previos, acorde a la baja de escala del texto a 12.5px; **no debe exceder la caja de línea del texto** (ver §5 — invariante de cero-shift vertical). Fallback: si a 13px el link superara la altura del span `Histórico`, bajar la flecha a **12px** (no subir la línea).
- **Derivación del sentido:** la calcula el frontend comparando el mes visualizado (`month`, `YYYY-MM`) contra el mes en curso — visualizado `<` en curso ⇒ `ArrowRight`; visualizado `>` en curso ⇒ `ArrowLeft`. (Ya implementado como `isPastMonth = month < currentMonth`.)

#### 4. Ubicación, separador y anti-empuje horizontal

- **Desktop (≥1288px): en la fila del `statusLabel`, como hermano posterior del span `Histórico`.** La fila es `flex items-center gap-[8px]` (baja de `gap-[10px]` para ceñir el grupo `estado · remedio`). Orden de fuente: `[span Histórico] · [link]`.
- **Separador: `·` (middot) en `--faint`.** Se elige el middot — no un simple gap — porque agrupa las dos piezas como **"estado · su remedio"** (patrón de separador de meta ya vigente en el DS, p. ej. la sublínea del ítem de salto). El `·` va en `--faint` (más tenue que ambos textos `--muted`) para recederse a pura puntuación. **Solo se renderiza junto al link** (mes histórico): en mes-en-curso la fila muestra únicamente `Mes en curso`, sin `·` ni link.
- **En mes-en-curso la fila es idéntica a hoy:** solo el span `Mes en curso` (12.5px/500 `--muted`). El subsistema del link es **aditivo**: no cambia esa fila cuando no aplica.
- **Mobile (<1288px): fuera del pill `.stepper`**, que está envuelto en `aria-hidden="true"` (meterlo adentro lo volvería inaccesible — el `statusLabel` mobile vive *dentro* del pill, así que el link **no** puede ir junto a él). Se ubica como **último hijo** de la fila flex del header mobile, **después** del pill y del `CurrencyChip`. Al estar fuera del `aria-hidden`, es **plenamente accesible y focalizable** en su orden natural. En teléfonos angostos `flex-wrap` lo baja a su propia línea bajo el pill.
- **Anti-empuje horizontal:**
  - **`Histórico`/`Mes en curso` inmunes:** el span de estado está anclado a la izquierda de la fila; `·` y link son **posteriores** y crecen **hacia la derecha, sobre espacio vacío**. Nada a la izquierda del link se desplaza. El flip de sentido de la flecha **no mueve** el borde izquierdo del link (→ y ← misma caja).
  - **`CurrencyChip` inmune:** en desktop vive en la fila del *eyebrow* (otra fila, arriba); en mobile va **antes** del link en orden de fuente. En ninguno de los dos casos lo toca la aparición del link.
  - **Cluster de acciones inmune (desktop):** el header exterior es `justify-between`, acciones ancladas al **borde derecho**; ensanchar el cluster izquierdo **no las mueve** mientras no haya `flex-wrap`. El link es corto (`whitespace-nowrap`, ~150px) y a ≥1288px sobra ancho: **no se dispara wrap**. (Ítem medible en §8.)
- **Reversión de la iteración anterior (instrucción para `control-frontend`):** el link **sale de la fila del título**. La fila del título (`MonthJumpTriggerDesktop`) vuelve a su estado pre-feature (solo el trigger; su `gap-[12px]` extra pierde sentido con un único hijo). El `<button>` del link se mueve a la fila del `statusLabel`, después del span y del `·`.

#### 5. Anti-layout-shift vertical y cero-impacto real (baja definitiva del `min-h-[34px]`)

- **El `min-h-[34px]` NO se re-introduce en la fila del `statusLabel`.** La versión chip necesitaba esa reserva porque medía ~36.84px y hubiera empujado el layout al aparecer. Con un link que **es tipográficamente idéntico a `Histórico`** (12.5px/500, misma caja de línea), la fila **no crece** por alojarlo → la reserva es innecesaria. Esto es **cero-impacto real** (la fila conserva su alto original), no el parche de reservar altura. La fila queda `flex items-center gap-[8px]` **sin** `min-h`.
- **Invariante de alto verificable (números, no "a ojo"):** el alto de la fila lo fija la **caja de línea del texto de 12.5px**, presente en **ambos** estados (`Mes en curso` sola, o `Histórico · [link]`). La flecha de 13px se centra **dentro** de esa caja de línea (13px < caja de línea de un texto de 12.5px) y **no** la excede. Por lo tanto el alto de la fila es **idéntico** con y sin link: `getBoundingClientRect().height` de la fila del `statusLabel` debe dar **el mismo valor** (delta **0px**) alternando entre un mes histórico (con link) y el mes en curso (sin link). Si el medido difiere en algo distinto de 0px, la causa es la flecha excediendo la caja → aplicar el fallback de 12px de §3.
- **Todo lo que va debajo conserva su `y`:** al no crecer la fila del `statusLabel`, los totales y el label "GASTOS" **conservan su coordenada `y`** (0px de desplazamiento) entre mes-en-curso e histórico.
- **Fila del título — sin cambios:** su alto lo fija el H1 (32px, `leading-none`); ya no aloja el link, así que es estable por construcción.
- **Flechas ‹ › inmunes por estructura:** en desktop viven en las columnas laterales del grid de `PeriodNav`; en mobile dentro del pill, y el link es hermano **posterior** al pill.
- **Mobile — reflow vertical aceptado (trade-off explícito):** por ser el último elemento, su ausencia/presencia nunca mueve lateralmente pill ni chip; en teléfonos angostos aparece en segunda línea y empuja hacia abajo el contenido siguiente. Se acepta ese reflow (viaja con la entrada de vista del cambio de mes) en vez de reservar una línea vacía permanente.

#### 6. Estados

- **Reposo:** texto + flecha `--muted` (`text-muted`), **sin subrayado**, **`cursor: pointer`** (ver §7 — gotcha de Tailwind v4).
- **Hover:** texto + flecha suben a **`--ink-2`** (un paso más firme que `--muted`) **+ subrayado**: `underline`, `underline-offset-[2px]` (offset menor que los 3px previos, acorde a los 12.5px), grosor por defecto, línea = `currentColor`. Transición de **color a 0.14s** (`duration-[140ms]`, par con el chevron del trigger); el subrayado aparece de inmediato (no se anima `text-decoration`). El salto de tono `--muted → --ink-2` es el feedback que confirma "esto es accionable".
- **Active (pressed):** mantiene `--ink-2` + subrayado (mismo tratamiento que hover; es un link, no cambia de superficie).
- **Focus (teclado):** `focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]` + `rounded-[var(--r-chip)]` **+ subrayado visible**, sin outline nativo — mismo anillo y radio que `MonthJumpTriggerDesktop`. El radio `--r-chip` (7px) envuelve el texto de forma prolija.
- **Disabled:** **no aplica** (§1 — el link solo existe cuando es accionable).

#### 7. Movimiento, `cursor: pointer` y accesibilidad

- **`cursor: pointer` OBLIGATORIO y EXPLÍCITO.** **Gotcha de Tailwind v4:** su preflight asigna `cursor: default` a **todos** los `<button>`. Como este control es un `<button>` estilizado como link, **debe** llevar la clase `cursor-pointer` explícita o el puntero quedará en flecha (contradiciendo su affordance de link). Es el mismo motivo por el que `MonthJumpTriggerDesktop` la lleva explícita (`month-jump-popover.tsx:539`: `inline-flex items-center gap-[8px] cursor-pointer`). **La implementación actual del link NO la tiene — hay que agregarla.**
- **Aparición:** sin animación bespoke — aparece con el re-render de la vista al cambiar de mes (entrada 0.32s ya existente). **Sin animación posicional.** Solo transición de color en hover/focus (0.14s).
- **`prefers-reduced-motion`:** no hay movimiento de entrada propio que desactivar; el único movimiento es la transición de color de 140ms en hover/focus (dentro del "movimiento sobrio" del DS, no una animación posicional). No requiere tratamiento especial.
- **A11y — el verbo ya está en el texto visible:** el nombre accesible es **"Ir al mes en curso"** tomado del contenido de texto. **No hace falta `aria-label` extra** (sería redundante). La flecha es `aria-hidden="true"`.
- **Contraste:** `--muted` sobre el fondo del header cumple el contraste mínimo para texto (es el mismo tono con que ya se muestra `Histórico`). El subrayado en hover/focus es un portador **no-dependiente-del-color** de la interacción.
- **Cambio de sentido de la flecha — no se anuncia:** el nombre accesible es **idéntico** apunte → o ← y el destino ("mes en curso") es inequívoco. **No** se usa `aria-live` ni región de anuncio: el flip es refuerzo puramente visual para usuarios videntes.
- **Orden de foco:** en desktop, tras el disparador de salto (H1) → en la fila del `statusLabel` → antes del cluster de acciones de la derecha. En mobile, en la fila del header tras el pill (que es `aria-hidden`) → focalizable en su orden natural.

#### 8. Checklist de aceptación visual

- [ ] Navegando un mes **distinto** al mes en curso, en la **fila del `statusLabel`** (bajo el H1) se lee `Histórico · → Ir al mes en curso` (o con `←`, según §3): span de estado + `·` + link de texto, **sin borde, sin fondo, sin sombra**.
- [ ] Estando en el **mes en curso**, la fila muestra **solo** `Mes en curso`: **no** existe `·`, **no** existe link (ni visible, ni placeholder, ni target de foco).
- [ ] **Tipografía del link idéntica a `Histórico`:** `12.5px` / peso `500` / `--muted` en reposo, **sin subrayado**. (Medible: `font-size`, `font-weight` y `color` computados iguales a los del span `Histórico` contiguo.)
- [ ] **Flecha en mes PASADO:** navegando un mes **anterior** al mes en curso, la flecha es **`ArrowRight` (→)**, en posición **leading** (izquierda del texto).
- [ ] **Flecha en mes FUTURO:** navegando un mes **posterior** al mes en curso, la flecha es **`ArrowLeft` (←)**, en posición **leading** (izquierda del texto).
- [ ] La flecha está **siempre a la izquierda** del texto: alternando entre un mes pasado y uno futuro, el borde izquierdo del texto "Ir al mes en curso" **no se mueve** (delta **0px** en `getBoundingClientRect().left` del texto); solo cambia el sentido del glifo.
- [ ] La flecha **13px** hereda el color del texto (`--muted` reposo / `--ink-2` hover); `gap` texto↔flecha **5px**; separador `·` en `--faint`; `gap` de la fila **8px**.
- [ ] **`cursor: pointer`** al pasar el mouse por encima del link (NO la flecha default de `<button>`).
- [ ] **Hover:** texto+flecha suben a **`--ink-2` con subrayado** (`underline-offset` 2px); transición de color **140ms**. **Focus con teclado:** anillo `--accent-soft` 3px con radio `--r-chip` + subrayado.
- [ ] El link **no** usa índigo, **ni** verde, **ni** rojo, en ningún estado.
- [ ] **La fila del `statusLabel` mide lo MISMO con y sin link:** `getBoundingClientRect().height` de esa fila da **el mismo valor (delta 0px)** entre un mes histórico (con link) y el mes en curso (sin link). La fila **no** lleva `min-h-[34px]` ni ninguna reserva de alto.
- [ ] **Ningún elemento del header se desplaza** al aparecer/desaparecer el link: H1 + `ChevronsUpDown`, `CurrencyChip`, flechas ‹ ›, totales y label "GASTOS" **conservan su `x` e `y`** (0px). Verificable con `getBoundingClientRect` alternando mes histórico ↔ mes en curso.
- [ ] En **desktop** el cluster de acciones ("Ordenar secciones" / "+ Nuevo movimiento") **no se reposiciona** ni dispara `flex-wrap` a 1288px al aparecer el link.
- [ ] En **desktop** el link **ya no está en la fila del título** (salió de junto al `ChevronsUpDown`) y **está en la fila del `statusLabel`**, después del `·`.
- [ ] En **mobile** el link está **fuera del pill** (`aria-hidden`) y es **clickeable/focalizable**; pill y chip **no** se mueven lateralmente.
- [ ] Con `prefers-reduced-motion` el link no tiene animación de entrada; solo la transición de color de hover/focus (no posicional).
- [ ] Orden de foco por teclado: disparador de salto (H1) → link "Ir al mes en curso" → acciones de la derecha.

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
| **`/configuracion/categorias`** (`categories-list.tsx`, skeleton de la sección) | header fantasma (`h-3 w-24` eyebrow + `h-8 w-36` H1 + `h-10 w-36` botón) + `h-[200px]` área lista, todo `animate-pulse rounded-… bg-panel-3` | **Header de sección:** el H1 de página persistente "Configuración" y la nav vertical de secciones son chrome estable (presente e inerte, sin fantasma). La sección no lleva eyebrow ni H1 propio (ver §1): su cabecera fantasma es `SkeletonLine` del `h2` de sección (alto ~18px, ancho ~120px) + `SkeletonBlock` botón (`--r-ctl`, 40×144). **Lista:** en vez de un único bloque `h-[200px]`, **5–7 filas fantasma** que replican la estructura del `catrow` real (`[SkeletonBlock swatch 14px] [SkeletonLine nombre] [SkeletonLine uso]`) dentro de la `.cat-list`, para que el aterrizaje de la lista real no salte. **Cambio a11y:** contenedor `role="status"` `aria-label="Cargando categorías"`. |
| **Filas de sección en `/mes`** (`month-view-client.tsx`, secciones Únicos/Fijos/Cuotas) — **mapeo nuevo (Ola 1)** | hoy durante la carga **solo** se ven los 3 `SkeletonBlock` de los totales; las secciones **no muestran nada** (el área de lista queda vacía hasta que llega el dato). | Mientras `isLoading`, las **tres secciones se renderizan ya** con su cabecera fantasma y su cuerpo de filas fantasma (en vez del listado vacío). Por sección: **(a) Cabecera** — imitar la `.ghead` real (`accordion-section.tsx`): `SkeletonBlock` chevron 16×16 (radio `--r-chip`) + `SkeletonLine` rótulo (alto **13px**, ancho ~80px) + `SkeletonPill` contador (alto ~16px, ancho ~26px, radio `--r-pill`) + línea divisora `--hair` real (no fantasma, es chrome estable) + `SkeletonLine` subtotal mono (alto **13px**, ancho ~72px, alineado a la derecha). El **chevron va estático en ▶ (colapsado-look) o se omite la rotación** — es fantasma, no acciona. Sin handle de drag (el modo orden no existe en carga). **(b) Cuerpo** — la tarjeta-lista real (`bg-panel border-line rounded-card --shadow-sm overflow-hidden`, chrome estable presente) con **3 filas fantasma por sección** (no 5–7: son tres secciones a la vez; 3×3 = 9 filas llenan el viewport sin exceso y el aterrizaje de listas cortas no salta). Cada fila fantasma replica el grid real del `MovementItemRow` (`40px 1fr auto auto auto`, `padding var(--row-pad) 18px`, divisor `--hair` entre filas): **`SkeletonCircle` ícono 40px** + columna texto (`SkeletonLine` nombre alto **14.5px** ancho ~60% + `SkeletonLine` meta alto **12.5px** ancho ~40%, gap real entre ambas) + `SkeletonLine` fecha (alto 12.5px, ancho ~52px, alineada derecha) + `SkeletonLine` monto (alto **15.5px**, ancho ~84px, alineada derecha) + **sin** col de kebab (aparece solo en hover). **a11y:** el área de secciones bajo carga va en contenedor `role="status"` `aria-label="Cargando movimientos"` (distinto del `"Cargando totales"` de los 3 totales — son dos bloques de carga). |
| **Dashboard** (`/`, `dashboard-client.tsx`) — **mapeo nuevo (Ola 1)** | hoy ad-hoc: 2 bloques `h-[120px] animate-pulse rounded-card bg-panel-3` en grid `1fr 1fr` + 1 bloque `h-[160px]` debajo, todo bajo `role="status" aria-label="Cargando totales"`. **No imita** el layout cargado real (faltan la card de reporte y el footer; los altos no coinciden con las stat-cards/hero reales). | Imitar el layout cargado real del resumen + widget, para que no salte al aterrizar. Bajo `role="status" aria-label="Cargando totales"`, **`space-y-[var(--gap)]`**: **(1)** grid `grid-cols-2 gap-[var(--gap)]` con **2× `SkeletonBlock`** (radio `--r-card`) del alto de las stat-cards reales Gastos/Ingresos — **~120px** (el alto real lo fija el contenido: eyebrow + cifra 30px + meta; 120px es la aproximación vigente, mantener). **(2)** **1× `SkeletonBlock`** radio `--r-card` para el **balance hero** — alto **~160px** (eyebrow + cifra 46px + barra de proporción + leyenda). **(3)** **1× `SkeletonBlock`** radio `--r-card` para la **card de reporte** del dashboard (hoy ausente del skeleton): alto ≈ chrome de card-pad + cabecera + **canvas 280px** + leyenda ≈ **~380px** — `control-frontend` ajusta al alto real montado de `ReportCard` con `chartHeight={280}` para evitar salto. La cabecera/controles de esa card pueden alternativamente renderizarse inertes (chrome estable) con solo el canvas como `SkeletonBlock` radio `--r-ctl` 280px + 2–3 `SkeletonLine` de leyenda — preferible si el alto exacto del bloque único es difícil de clavar. El **footer "Ver todos"** no necesita fantasma (es link, no dato). El **header `.phead`** (eyebrow + H1 + botón "+ Nuevo") **ya se renderiza presente e inerte** fuera del bloque de carga (correcto — es estructura estable). |

> **Regla viva derivada:** ningún componente nuevo escribe `animate-pulse bg-panel-3` inline. Todo estado de carga compone las **primitivas** (`SkeletonLine` / `SkeletonBlock` / `SkeletonCircle` / `SkeletonPill`) del componente `Skeleton`, imitando las medidas reales, con pulse (`animate-pulse` sobre `bg-panel-3`, off en reduced-motion) y `role="status"` + `aria-label` en el contenedor. El fill es `--panel-3`; nunca color semántico ni de marca. El skeleton se muestra **solo en la carga inicial** —nunca en refetch ni en interacciones con dato ya presente.

---

## Marca visual pasiva de límites (Límites y Alertas — P2)

> Catálogo de **efectos visuales de la marca pasiva** (decisión D9 del `docs/roadmap-limites-alertas.md`). Un **límite** es una config del usuario que observa un dato (vía su *key* del catálogo §2 del roadmap), lo compara contra un umbral y, si se cumple, **aplica una marca al anclaje** que emite esa key. Esta sección define **qué marcas existen** (vocabulario), **qué marca aplica a qué tipo de anclaje** (mapeo), **el tono/severidad** y **la accesibilidad** — en términos que `control-frontend` implementa sin decidir nada visual por su cuenta. **No define** el shape del límite, el panel de config ni la evaluación (eso es funcional/técnico, del analista y el front).
>
> El identificador de efecto que guarda el límite (`effect` en el shape del roadmap) sale del **id estable** de cada primitiva de abajo — es parte del "lenguaje común" front ↔ design.

### Restricción rectora — cero impacto con config vacía

**Con `limits: []` (o con todos los límites evaluando `false`), la app se ve EXACTAMENTE igual que hoy.** El sistema de marcas es **aditivo y opt-in**: impacto visual nulo mientras ningún dato cruce un umbral. Esto es **regla dura del subsistema**, no una aspiración:

1. **Toda marca es condicional.** Un nodo de marca se renderiza **solo** cuando un límite configurado evalúa `true` sobre ese dato concreto renderizado. Sin límites que crucen → no se monta ningún nodo de marca ni se aplica ninguna clase modificadora.
2. **Las marcas reusan slots que ya colapsan.** Donde una marca **agrega** un elemento (glifo, badge), va en un slot que **ya renderiza vacío** cuando no aplica — el caso canónico es la **zona de estados de la sublínea** del ítem de `/mes` (que "no se renderiza si ninguna bandera aplica", ver *Sublínea del ítem de `/mes`*). Ningún slot **reserva** ancho/alto "por si acaso".
3. **Las marcas que modifican** (fondo, ring, color, peso) aplican **solo un swap condicional de clase/token**; el estilo base del elemento queda intacto cuando ningún límite cruza. Ningún espaciado, borde o color base cambia **por el mero hecho de que el subsistema exista**.
4. **Sin cambio global de layout/DOM.** El subsistema no introduce contenedor persistente, columna reservada ni wrapper siempre-presente. Que el blob `limits` no esté vacío **no cambia nada** hasta que un dato efectivamente cruza.
5. **La marca nunca desplaza a sus vecinos.** Fondos y rings usan mecanismos **que no reflowean** (ring vía `box-shadow` como el focus ring; fill de fondo; inset). Badges y glifos caen en clusters flex que ya crecen/encogen. **La altura de una fila y el layout de una grilla no cambian** por marcar.

### Tono y severidad — una sola familia: **ámbar `--warning`**

- **Cruzar un límite es un aviso (`--warning`, ámbar), no un error ni income/expense.** Ámbar es el token semántico del DS para "advertencia, no error" (ya vigente en el callout de borrado en cascada y en los estados de error de las cards: `AlertTriangle` `--warning-ink`). Es el **único hue libre** con semántica de atención: **no colisiona** con las reservas — rojo=gasto, verde=ingreso (regla dura 1), índigo=marca (regla dura 2), paleta de 40 colores=identidad de categoría. Por eso la marca de límite es **siempre ámbar** (o **neutra por peso**, ver abajo), y **nunca** `--expense`/`--income`/`--accent`/color de categoría.
- **Condición única, sin escalonado (D1).** Un límite = una condición = **una marca binaria** (cruza o no cruza). No hay gradiente ámbar→rojo dentro de un límite. Si el usuario quiere señalización por tramos (p. ej. quiet al 80%, fuerte al 100%), crea **varios límites sobre la misma key** con distinto umbral y distinto efecto (contemplado en D1 del roadmap): el DS **no construye** escalado, lo **compone** de marcas simples.
- **El usuario elige el EFECTO, no el hue.** El panel de config ofrece qué primitiva aplicar (cuán fuerte), **no un color arbitrario**. El hue es siempre ámbar (o neutro para el efecto de peso). Es una **restricción deliberada**: dejar elegir color libre arriesgaría que el usuario tome verde/rojo/índigo y rompa las reservas. Se preserva la regla de colores reservados **por construcción**.
- **Dos registros, ambos curados:**
  - **Aviso (ámbar)** — `--warning` / `--warning-soft` / `--warning-ink`. El default para "quiero que me avise cuando cruce".
  - **Neutro (peso, sin hue)** — solo sube el **peso tipográfico** del dato, sin color. El extremo **quiet**: "quiero que el dato resalte al cruzar, sin alarma". Legítimo porque la intención del roadmap incluye *resaltar*, no solo *alarmar*.

### Vocabulario de efectos (primitivas)

Set curado de **7 primitivas**, con id estable (el `effect` del límite). Todas reusan moldes ya vigentes del DS; ninguna inventa cromo nuevo. Ordenadas de **más quiet a más fuerte**:

| id | Efecto | Molde reusado | Tono | Portador no-color (a11y) |
|---|---|---|---|---|
| `bold` | **Énfasis de peso** — sube el peso del dato (p. ej. 500→600, 600→700), sin tocar color | escala tipográfica del DS | neutro (sin hue) | el cambio de **peso/forma** es no-color en sí; + aria |
| `tint` | **Color ámbar del texto** — tiñe la cifra/texto en `--warning-ink` | color de texto | ámbar | **solo permitido sobre cifras/textos neutros** (ver regla); + aria |
| `glyph` | **Glifo de alerta** — `AlertTriangle` (lucide) `--warning-ink`, 11–16px según contexto, `aria-label`+`title`, svg `aria-hidden` | cluster de glifos de la zona de estados | ámbar | la **forma del glifo** + aria/title |
| `dot` | **Punto/marcador de alerta** — dot 6px `--warning` (o marcador de esquina en celdas densas) | punto de categoría (6px `rounded-full`) recoloreado a ámbar | ámbar | forma + **aria/tooltip obligatorios** (un dot solo es color) |
| `badge` | **Badge de límite** — chip `--warning-soft`/`--warning-ink`/`--r-chip` 7px, 11px·600·`.04em`, con `AlertTriangle` 11px opcional + label corto | chip "Anulado" recoloreado a ámbar | ámbar | el **texto del badge** (label del límite) |
| `fill` | **Fondo tenue** — `--warning-soft` de fondo de fila/total (reemplaza el hover tint condicionalmente) | patrón `-soft` | ámbar | **nunca solo** — siempre + `glyph` o `badge` (fondo solo = color-only) |
| `ring` | **Ring de alerta** — anillo `--warning` 1px vía `box-shadow` (mecanismo del focus ring, no reflowea), alrededor de celda/bloque de total | focus ring del DS | ámbar | **nunca solo** — siempre + `glyph`/`dot`/tooltip (ring solo = color-only) |

**Regla dura del `tint`:** teñir la **cifra** solo se permite cuando esa cifra es **neutra** (`--ink`/`--ink-2`, magnitud sin tipo: totales de reporte, celdas, métricas de footer, contadores). **Nunca** se tiñe un **monto tipado** (income verde / expense) — su color es portador del **tipo** (regla dura 1); pisarlo con ámbar perdería esa señal. Sobre montos tipados se usa `glyph`/`badge`/`fill`/`ring`/`bold` (marcas adyacentes o de contorno), nunca `tint`.

### Mapeo efecto ↔ tipo de anclaje

Cada key del catálogo (§2 del roadmap) emite en un **tipo de anclaje**. El panel de config ofrece, por key, **solo el subset válido** para su anclaje, con un **default sensato** (el usuario puede cambiarlo). El portador de a11y va entre paréntesis.

| Tipo de anclaje | Keys de ejemplo | Efectos válidos | Default | Ubicación / notas |
|---|---|---|---|---|
| **Línea de movimiento** (monto tipado + fila) | `mes.item.monto` | `glyph`, `badge`, `fill`, `bold` | `glyph` | El `glyph` `AlertTriangle` entra en la **zona de estados de la sublínea** (slot que ya colapsa → cero impacto), **primero** del cluster (es lo más relevante, antes de `GitBranch`/`Zap`). `badge` va como **primer segmento de identidad** (mismo slot que "Anulado"). `fill` reemplaza el hover tint de la fila **+ obligatorio un `glyph`**. **Nunca `tint`** (el monto es tipado). Bajo ítem anulado, la marca hereda el `opacity-[0.55]` del contenido (es parte de la fila). |
| **Línea de movimiento — derivada por categoría** (sin cifra propia) | `mes.categoria.gastoMes` | `glyph`, `badge`, `fill`, `bold` | `glyph` | **Key derivada** (refinamiento = categoría): no tiene número propio renderizado en `/mes`; representa el gasto **acumulado del mes** de una categoría. Al cruzarse, la marca recae **a nivel de fila** sobre **cada movimiento cuya categoría** cruzó el límite → **reusa exactamente el slot y subset de `mes.item.monto`** (mismos mecanismos: `glyph` en la zona de estados, `badge` como primer segmento de identidad, `fill` sobre hover tint + `glyph` obligatorio, `bold`; **nunca `tint`**, el monto de fila es tipado). Diferencia semántica: la marca **se repite** en todas las filas de la categoría (no en una sola), por eso el default `glyph` (el más liviano, slot que ya colapsa) es aún más apropiado que un `badge` repetido. Portador a11y **por fila** = el `aria`/tooltip enuncia el cruce a nivel de categoría-mes (reusa el `label` del límite, ej. "Gasto del mes en {categoría} supera el límite"), no el monto de la fila individual. Bajo ítem anulado, hereda el `opacity-[0.55]` de la fila. |
| **Total / subtotal de mes** (cifra dominante) | `mes.total.gasto`, `mes.total.ingreso`, `mes.balance`, `mes.seccion.subtotal` | `badge`, `glyph`, `bold`, `tint`†, `ring` | `badge` | `badge` adyacente a la cifra (misma celda, `inline-flex gap justify-end`, como el badge de moneda). `tint`† **solo si la cifra es neutra**; si va coloreada por tipo/signo, `tint` **no se ofrece** para esa key. `ring` para envolver el bloque de total (+ glifo). |
| **Contador de sección** (pill) | `mes.seccion.conteo` | `glyph`, `badge` | `glyph` | `glyph` a la izquierda del pill contador; o recolorear el pill a `--warning-soft`/`--warning-ink` (`badge`). El contador **no es dinero**, `tint` sería redundante con `badge`. |
| **Celda de grilla** (fondo ocupado por heatmap) | `reporte.unicos.celda` | `ring`, `dot` | `ring`+`dot` | **`fill` NO disponible** (el fondo lo ocupa la rampa de heatmap, ver *Reporte anual de Únicos*). `ring` ámbar inset 1px + **marcador de esquina** `dot` (la celda ~19px no aloja glifo). Portador a11y = **el texto del tooltip de celda** (que ya existe) enunciando el límite cruzado + `aria-label` de la celda. |
| **Barra** (color = categoría) | `reporte.cuotas.montoPorCuota`, banda de `by-category` | `glyph`, `badge`, `ring` | `glyph` | La barra ya está teñida por **color de categoría** (identidad) — **no se recolorea**. `glyph` `AlertTriangle` junto a la etiqueta de monto de la barra; `ring` alrededor de la barra. Portador = glifo + tooltip del chart. |
| **Punto/mes de serie en chart** (Recharts) | `reporte.ie.gastoMes`, `reporte.ie.ingresoMes`, `reporte.infl.*` | `dot`, `ring` | `dot` | Marcador `dot` ámbar sobre el punto/barra del mes que cruza; `ring` para envolver una barra específica. Las barras de `income-expense` van tipadas (verde/rojo) → **no recolorear**, marcar por contorno/marcador. Portador = tooltip del chart + `aria`. |
| **Métrica de footer / porcentaje** (cifra neutra pequeña) | `reporte.unicos.mesTotal`, `reporte.unicos.promedioDiario`, `reporte.unicos.pctVsPrev`, `reporte.unicos.inflacionMes`, `reporte.infl.*` | `tint`, `glyph`, `bold` | `tint` | Cifras **ya neutras** (`--ink-2`) → `tint` a `--warning-ink` es lo más limpio a ese tamaño. En el `%dif` **se conserva** su glifo de dirección `↑`/`↓` (que sigue en `--ink-2`); el `tint` afecta la cifra, no reemplaza la dirección. Portador = el tooltip rico del footer (que ya lista las métricas) + `aria`. |

† `tint` sobre total/subtotal: disponible **solo** cuando el front confirma que esa cifra se renderiza en color neutro; sobre una cifra tipada por signo/tipo, la key no ofrece `tint`.

### Colisión de marcas — un dato, varios límites

Un mismo dato puede cruzar **más de un límite** (p. ej. dos umbrales sobre la misma key). Para no romper el "cero impacto" ni ensuciar la lectura:

- **Se renderiza una sola marca por dato por familia de efecto.** No se apilan N badges ni N glifos sobre una cifra. Si varios límites disparan, se muestra **la marca más fuerte** entre las que aplican (según el orden quiet→fuerte de la tabla de primitivas) y su **`aria`/tooltip enumera todos los límites cruzados**.
- **En el cluster de la zona de estados**, la alerta es **un** `AlertTriangle`, no uno por límite; el tooltip lista los que cruzaron.
- Esto mantiene la huella visual **acotada y predecible**, coherente con la restricción rectora.

### Accesibilidad — nunca solo color

Alineado con la regla dura 4 (compatibilidad en claro/oscuro) y con cómo el DS ya evita depender del color:

- **Toda marca porta una señal no-color.** El hue ámbar **nunca** es la única señal. Portadores admitidos: (a) la **forma** del `AlertTriangle` (`glyph`), (b) el **texto** del `badge`, (c) el **cambio de peso** (`bold`, no-color en sí), o (d) como mínimo `aria-label` + `title` + **texto del tooltip** describiendo el límite (ej. "Supera el límite: gasto del mes > $300.000"). El texto accesible **reusa el `label` del límite** (o su placeholder derivado).
- **`fill` y `ring` nunca van solos** (son color-only): siempre acompañados de `glyph`/`badge`/`dot` o, como piso, del `aria-label` del dato anunciando el cruce.
- **`dot` exige aria/tooltip** por la misma razón (un punto solo es color).
- **Patrón de glifo idéntico al cluster de estados:** wrapper con `aria-label` + `title` nativo, svg `aria-hidden` — el mismo molde de `GitBranch`/`Zap`.
- **Contraste:** `--warning-ink` sobre `--warning-soft` y sobre `--panel` cumple la misma barra ya validada del callout de advertencia vigente. En **oscuro**, los tokens `warning` toman su valor dark (`-soft` = tinte oscuro saturado, `-ink` sube de luminosidad — ver *Principios de calibración del oscuro*): las marcas funcionan idénticas en ambos modos sin tratamiento extra.

### Cumplimiento de reglas duras

- **Regla dura 1 (verde=ingreso · rojo=gasto):** la marca es **ámbar**, jamás verde/rojo; y **nunca recolorea un monto tipado** (`tint` prohibido sobre income/expense). El tipo lo siguen comunicando exclusivamente el ícono 40×40 y el color/signo del monto.
- **Regla dura 2 (índigo solo marca):** ningún efecto usa índigo; el índigo sigue siendo cromo de interacción (focus ring de los controles del panel de config), no marca de límite.
- **Regla dura 3 (dinero en mono tabular):** las marcas **no introducen cifras** fuera de mono; el `badge` de límite lleva label de texto (UI) o, si muestra el umbral, va en mono tabular como cualquier cifra.
- **Regla dura 4 (ambos modos):** tokens `warning` tienen su par claro/oscuro; verificado que la marca se lee en los dos modos.

---

## Panel de gestión de límites (Configuración — P2)

> Spec visual del **gestor de límites**: la solapa de `/configuracion` donde el usuario **crea y elimina** límites (roadmap-limites-alertas §5, decisión D7/D8). Extiende la sección *Marca visual pasiva de límites* (que define **qué marcas existen**) y se articula con *Aviso de alerta activa de límites* (el aviso runtime de la naturaleza activa). Acá se define **cómo el usuario configura** un límite de **cualquiera de las dos naturalezas**: **pasiva** (marca un dato cuando cruza) y **activa** (avisa al guardar un movimiento). El panel expone un **selector de naturaleza** (§3.3) que reconfigura el resto del formulario. El shape del límite, las keys y la evaluación son funcionales/técnicos (analista + front); acá va solo el cromo.
>
> **Reutilización total, cero cromo nuevo.** Todo el panel se arma con moldes vigentes: `.card` de `/configuracion`, la navegación vertical de secciones de `/configuracion` (§1), el segmented `.dtabs` (naturaleza y alcance, del modal de movimiento), la primitiva `Select`, la primitiva `Input`, el listbox rico con íconos (`PaymentMethodSelect`), el molde de modal (`transaction-modal`), la primitiva `Button` y el checkbox del DS. No se introduce ningún control ni token nuevo.

### 1. Control de navegación — `/configuracion` es el hub de administración con navegación vertical de secciones

> **Evolución (P6).** Esta spec nació con dos secciones (General · Límites) y se extiende al **hub de administración de la cuenta de 4 secciones**, con **ruteo anidado deep-linkable**. El patrón visual de nav vertical **no cambia**; se suma la jerarquía de cabecera del hub (§1.b) porque al anidar los gestores existentes aparecían **dos H1** y **eyebrows redundantes**.

`/configuracion` es el **hub de administración de la cuenta**: aloja **cuatro secciones hermanas** bajo una misma cabecera de página `.phead` ("Ajustes" / "Configuración"). Orden fijo:

1. **General** — la card de Moneda por defecto (intacta).
2. **Categorías** — el gestor `CategoriesList`.
3. **Métodos de pago** — el gestor `PaymentMethodsList`.
4. **Límites** — el gestor de límites (`LimitsTab`).

**Ruteo anidado deep-linkable.** Cada sección es una **ruta propia**: `/configuracion` (→ General), `/configuracion/categorias`, `/configuracion/metodos-pago`, `/configuracion/limites`. La nav vertical **navega entre estas rutas** (no alterna paneles de una sola página). La sección activa se **deriva de la URL** (ver §1.c), no de estado efímero.

**El segmented horizontal estaba mal aplicado.** Un segmented (`.dtabs`) es un **input de elección de valor** (como el selector Ingreso/Gasto/Transferencia del modal de movimiento). En `/configuracion` el usuario **no elige un valor**: navega entre secciones de administración. Por eso el control es **navegación vertical** (patrón GitHub / macOS System Settings / Stripe): **columna de secciones a la izquierda**, **contenido de la sección activa a la derecha**. Se eligió sobre tabs subrayadas porque **escala**: con 4 secciones (y las que vengan) se apilan en la columna sin comprimir una barra horizontal.

**El molde `.dtabs` no se toca ni se redefine** — es un token compartido que sigue vivo en el modal de movimiento (selector de tipo, naturaleza, alcance). `/configuracion` simplemente **deja de usarlo**. El copy de las etiquetas y el orden los confirma el analista (`screens.md`); el orden fijo de arriba es el vigente.

**Persistencia (arquitectura de rutas).** La cabecera de página `.phead` (§1.b) **y** la columna de nav son **persistentes**: viven en el **layout compartido** del hub (envuelve las 4 rutas) y **no se re-montan** al cambiar de sección. Solo cambia el **contenido de la derecha** (la sección ruteada). Así el título de página y la nav quedan fijos mientras el usuario recorre secciones.

**Layout (≥941px, régimen amplio):**

- Debajo de la `.phead` (que conserva su `mb-6`), un contenedor de **dos columnas**: `flex flex-row items-start gap-8` (32px de aire entre nav y contenido).
- **Columna de nav (izquierda) — track contenedor de grupo:** la columna es una **superficie recesada** que envuelve los 4 ítems para que se lean como **un conjunto de secciones navegables** (no botones sueltos sobre el paper). El elemento `<nav>` **es** el track: `bg-panel-2` + `border border-line` + `rounded-[var(--r-card)]` (14px) + padding interno `p-1.5` (6px), `flex flex-col gap-1` (4px entre ítems), `w-[200px] shrink-0`. Ancho total 200px → **ancho útil interno ~188px** (200 − 2×6px de padding), que aloja cómodo la etiqueta más larga ("Métodos de pago", ~145px con su `px-3`) **sin envolver dentro de la pastilla** (margen ~19px). Con **4 ítems** el track mide ~184px de alto (12px padding + 4 × ~40px + 3 × 4px de gap) — siempre más bajo que el contenido, así que su alto no fuerza nada. Alineado al **tope** (ambas columnas arrancan a la misma altura). El **radio del track (14px, `--r-card`) contra el radio de los ítems (10px, `--r-ctl`)** con el padding de 6px anida limpio (regla de radio anidado). **Por qué el track:** sobre el `--paper` de la página los 4 ítems sueltos se leían como controles independientes; la superficie recesada `panel-2` los agrupa visualmente como "secciones de esta pantalla" y —clave— **completa la metáfora del thumb del segmented**: el ítem activo `--panel` ahora **sube de un track recesado** (igual que el thumb sube del track `panel-3` del `.dtabs`), no flota sobre el paper. No lleva rótulo de grupo: el H1 "Configuración" + eyebrow "Ajustes" de la `.phead` ya nombran el contexto.
- **Columna de contenido (derecha):** `flex-1 min-w-0` (el `min-w-0` la deja encogerse sin desbordar). Aloja el **contenido de la sección activa** (la ruta hija): General (card de Moneda), Categorías, Métodos de pago o Límites. El contenido de cada gestor **no cambia** salvo su cabecera propia, que se **degrada a cabecera de sección** (§1.b).

**Ítem de sección:**

- **Caja:** `w-full text-left`, `px-3 py-2.5` (~40px de alto), `rounded-[var(--r-ctl)]` (10px), **`border border-transparent`** (reserva el ancho del borde en todo estado, para que activar/desactivar un ítem **no** provoque salto de 1px). `transition-colors duration-[140ms] motion-reduce:transition-none`.
- **Tipografía:** `text-[13.5px] font-semibold` (mismo cuerpo que llevaba la etiqueta de solapa). El peso **no cambia** entre estados (evita salto de layout): el estado activo se comunica por fondo, no por peso.
- **Estados (lógica de fondos invertida contra el track recesado):** el track es `panel-2`; por eso el hover ya **no** puede ser `panel-2` (sería invisible sobre el track) y sube a `panel-3`, mientras el activo baja/sube a `panel` en dirección opuesta.
  - **Reposo (inactivo):** fondo **transparente sobre el track** (deja ver el `panel-2`, no el paper), `text-muted`, `border-transparent`.
  - **Hover (inactivo):** `bg-panel-3` + `text-ink` — tinte un paso por encima del track (en claro `panel-3` es más oscuro que el track; en oscuro es más claro): en ambos modos el hover se despega del `panel-2`. Reemplaza al `panel-2` que se usaba cuando los ítems vivían sobre el paper.
  - **Activo (sección visible):** **tile que sube del track** — `bg-panel` + `border border-line` + `shadow-[var(--shadow-sm)]`, `text-ink`. Reusa el idioma del thumb del segmented (superficie `--panel` elevada saliendo de un track recesado). En **claro** el activo `--panel` (blanco) es más **claro** que el track y el hover `panel-3` es más **oscuro** → direcciones opuestas, activo y hover nunca se confunden. En **oscuro** el activo `--panel` (0.215) es más **oscuro** que el track `panel-2` (0.24) y el hover `panel-3` (0.27) es más **claro** → siguen opuestos; como la sombra oscura casi no lee sobre superficie oscura, el **`border border-line` es lo que sostiene la separación** del tile contra el track (obligatorio en oscuro, mismo recurso que las fichas). El delta de luminosidad track↔activo en oscuro (0.24 vs 0.215) es sutil pero real y el borde + `text-ink` lo refuerzan.
  - **Focus-visible:** `shadow-[0_0_0_3px_var(--accent-soft)]` (anillo índigo del DS), misma transición 140ms. **Se conserva sin cambios** respecto de la versión sin track.
- **Sin acento como indicador de sección activa:** el índigo **no** marca la sección actual (es solo marca/foco). El indicador de activo es neutro (tile `--panel` + sombra), coherente con "el acento es solo marca". El índigo aparece **únicamente** como anillo de foco (cromo de interacción; regla dura 2 intacta — no hay cifras acá).

#### 1.b Jerarquía de cabecera del hub — un solo H1 de página, cabecera de sección degradada

**El problema.** Al anidar los gestores existentes, cada uno traía **su propia** cabecera con eyebrow "Configuración" + **H1 32px** propio + botón + bajada. Sumado a la `.phead` de la página (eyebrow "Ajustes" + H1 "Configuración"), quedaban **dos H1** compitiendo y **dos eyebrows redundantes** ("Ajustes" y "Configuración"). Eso rompe jerarquía visual (el usuario no sabe cuál es el título real de la pantalla) y desperdicia altura vertical. Se resuelve con **una sola escala de tres niveles**:

**Nivel 1 — Título de página (persistente, único H1).** Vive en la `.phead` del layout compartido; **no** se repite por sección. Es el ancla de "dónde estoy en la app".
- **Eyebrow** "Ajustes": `text-[12px] font-semibold uppercase tracking-[0.1em] text-muted`. **Único eyebrow de la pantalla.**
- **H1** "Configuración": `text-[32px] font-bold tracking-[-0.02em] text-ink leading-tight`. **Único H1 de la pantalla.**
- **Bajada** (orientación general, opcional) "Preferencias de tu cuenta.": `text-[14px] text-muted mt-2`.
- Bloque con `mb-6`. **No lleva botón** (las acciones son por sección).

**Nivel 2 — Cabecera de sección (por sección, `h2`).** Cada sección abre con una cabecera propia **degradada de H1 a H2**. Reusa el **token de título de modal** (18px/700), que ya existe en el DS — no se inventa tamaño nuevo. Queda **claramente por debajo** del H1 de 32px y **claramente por encima** de los títulos de card (14.5/600), dando tres escalones legibles (32 → 18 → 14.5).
- **Fila:** `flex items-center justify-between gap-5 flex-wrap`, `mb-4`. Identidad a la izquierda, acción a la derecha ("Botón de acción" abajo).
- **Título (`h2`):** `text-[18px] font-bold tracking-[-0.01em] text-ink` = el nombre de la sección ("General" / "Categorías" / "Métodos de pago" / "Límites"). **Sin eyebrow.**
- **Bajada (opcional):** `text-[13px] text-muted` (font-weight 500), `mt-[3px]`. Es la bajada explicativa de cada gestor (conserva su copy y sus énfasis inline —número en `mono`, palabra clave en `--ink`— cuando los tiene).
- **Un solo escalón por sección:** dentro de la sección, los títulos de las cards (p. ej. "Moneda por defecto") **siguen** en el token de identidad de card (14.5/600 `--ink` + 12.5/500 `--muted`). Así en General quedan tres niveles limpios: página "Configuración" (32) → sección "General" (18) → card "Moneda por defecto" (14.5), sin colisión de peso.

**Qué se ELIMINA de las cabeceras actuales de los gestores** (Categorías y Métodos de pago):
- El **eyebrow "Configuración"** — se borra (redundante con el eyebrow de página "Ajustes" y con el ítem de nav activo).
- El **H1 de 32px propio** — se **degrada** al `h2` de sección (18/700). Ya no es H1.
- La **bajada** — se conserva su copy pero adopta el token de bajada de sección (13px/500 `--muted`).
- El **botón** — se conserva; se reubica en la fila de la cabecera de sección (ver abajo) y unifica su forma.
- Los **skeletons de carga** de esos gestores replican hoy un header de eyebrow(12) + H1(32) + botón(40×~150). Deben ajustarse a la nueva cabecera: **sin línea de eyebrow**, título ~18px, bajada ~13px, botón igual.

**Qué se CONSERVA:** la sección **Límites** (`LimitsTab`) ya tenía una cabecera de sub-panel con título + bajada + botón; **adopta el mismo nivel 2** (su título sube de 14.5/600 a **18/700**; su bajada queda en 13px/500). La sección **General** solo gana su cabecera de sección "General" (título 18/700, **sin bajada, sin botón** — sus cards son autodescriptivas). Las **listas, filas, cards y modales** de todos los gestores quedan **intactos**: solo cambia la banda de cabecera.

**Botón de acción por sección** ("+ Nueva categoría" / "+ Nuevo método de pago" / "+ Nuevo límite"):
- **Ubicación:** **derecha de la fila de la cabecera de sección**, en par con el `h2` (patrón `justify-between`). Nunca en la columna de nav, nunca en la `.phead` de página. Cada sección es dueña de su acción; la acción vive pegada al título de lo que crea.
- **Forma unificada (las 3 secciones que lo tienen):** `Button` **primario** (`variant=default size=default`) con **ícono `Plus` 16px a la izquierda + label**. Se estandariza sobre el patrón que ya usa `LimitsTab`; Categorías y Métodos **dejan de usar el "+ " literal en el texto** y adoptan el ícono `Plus`. Labels: "Nueva categoría" · "Nuevo método de pago" · "Nuevo límite".
- **Alineación vertical:** `items-center` — el botón se centra contra el bloque identidad (título + bajada), como ya hace `LimitsTab`. Al envolver (angosto), cae a una segunda línea bajo la identidad, alineado a la izquierda (ver Responsive).
- **General no tiene botón** — su fila de cabecera es solo el `h2` "General".

#### 1.c Sección activa derivada de la ruta

La sección activa se **deriva del `pathname`** (deep-link), no de estado efímero. **Visualmente no cambia nada**: el ítem cuya ruta coincide con la URL toma el estado **activo** ya especificado (tile elevado: `bg-panel` + `border border-line` + `shadow-[var(--shadow-sm)]`, `text-ink`); el resto queda en reposo (`text-muted`), con **hover** (`bg-panel-2` + `text-ink`) y **focus-visible** (anillo índigo 3px) idénticos. Entrar por deep-link a `/configuracion/limites` pinta "Límites" como activo sin ningún parpadeo ni salto respecto de navegar desde otra sección.

**Cambio de semántica ARIA (por pasar a rutas).** Con secciones que ahora son **URLs propias**, el contrato correcto **ya no es** `tablist`/`tab`/`tabpanel` (eso es para paneles de una sola página): es **navegación entre rutas**. La nav pasa a ser una **landmark de navegación** — `<nav aria-label="Secciones de configuración">` con **enlaces** (`<a>`/`Link`), y el ítem activo lleva **`aria-current="page"`** (el estado visual se liga a `aria-current="page"`, no a `aria-selected`). El contenido de cada ruta **ya no** es un `tabpanel`: es el contenido de la página. La navegación por teclado es la nativa de enlaces (Tab entre ítems); no hace falta el manejo de flechas arriba/abajo del tablist. El rol visual (columna a la izquierda) no cambia.

**Responsive (≤940px, `max-wide` — P0-a, obligatorio):**

- El contenedor pasa de dos columnas a **una**: la nav **arriba**, el contenido **debajo**. En Tailwind mobile-first: base = compacto `flex flex-col gap-6`; `wide:flex-row wide:gap-8 wide:items-start`.
- El **track no desaparece en compacto**: sigue siendo la superficie recesada de grupo (`bg-panel-2 border border-line rounded-[var(--r-card)]`), pero pasa de columna a **barra horizontal que envuelve**. El elemento `<nav>` combina, mobile-first: `flex flex-row flex-wrap gap-1 bg-panel-2 border border-line rounded-[var(--r-card)] p-1 wide:flex-col wide:w-[200px] wide:shrink-0 wide:p-1.5`. Es decir: **base compacto** = fila envolvente con **padding `p-1` (4px)**; **`wide:`** = columna 200px con **padding `p-1.5` (6px)**. Los ítems se **ciñen a su contenido**: ítem base `w-auto`, `wide:w-full`. Quedan **cuatro pastillas cortas** ("General" · "Categorías" · "Métodos de pago" · "Límites") dentro del track, separadas por `gap-1` (4px), con el track a su vez separado del contenido por el `gap-6`.
- **Padding compacto justificado (contra desborde a ~392px):** el track compacto usa `p-1` (4px por lado = 8px totales de aire horizontal) en vez del `p-1.5` amplio, para no comer ancho útil en el piso. La pastilla más ancha ("Métodos de pago" ~145px + `px-3` 24px = ~169px) + los 8px de padding del track = ~177px, **muy por debajo** de los ~392px de contenido disponible (piso 640px con sidebar abierto), así que **ningún ítem individual desborda** el track. Las 4 pastillas suman ~385px + 3 gaps de 4px + 8px de padding ≈ **405px**; a ~392px **envuelven a una segunda fila** dentro del track (comportamiento esperado del `flex-wrap`), **nunca** scroll horizontal. A anchos mayores caben en una sola fila. La cabecera de sección de la derecha también envuelve su botón bajo la identidad por su `flex-wrap` propio.
- **Los cuatro invariantes de contención en este elemento:**
  1. *Sin scroll horizontal ≥640px:* las 4 etiquetas cortas en `flex-wrap` **dentro del track** envuelven a 2 filas antes que desbordar; el track crece en alto (no en ancho), y su padding compacto `p-1` garantiza que ni el ítem más ancho ni la suma fuercen scroll del `body`, incluso a ~392px de contenido (sidebar abierto en el piso).
  2. *Modales completos:* la nav no abre modal; los modales de los gestores (crear categoría / método / límite) son independientes y este cambio no los afecta.
  3. *Ninguna acción inalcanzable:* los 4 ítems son inline dentro del track y siempre visibles (envuelven, no se recortan ni scrollean); el contenido de la sección queda debajo, completo, con su botón de acción alcanzable (envuelto bajo la identidad si hace falta).
  4. *Superficies anchas scrollean dentro de sí:* el track es de ancho acotado (envuelve, no scrollea) y no introduce superficie ancha; el contenido (card de Moneda / lista de límites) conserva su propia contención.

**Accesibilidad y semántica:** al pasar a **rutas propias**, la semántica correcta es **navegación**, no tablist (ver §1.c): `<nav aria-label="Secciones de configuración">` con **enlaces**; el ítem activo lleva **`aria-current="page"`** (a lo que se liga el estado visual). Ya **no** hay `tablist`/`tab`/`tabpanel` ni manejo de flechas arriba/abajo: la navegación por teclado es la nativa de enlaces (Tab). El ítem full-width da un área de click generosa; su alto ~40px se apoya en el ancho pleno de la columna para el objetivo táctil.

**Checklist de aceptación visual (nav de `/configuracion`):**

*Nav vertical (las 4 secciones):*
- [ ] La nav se lee como **un grupo contenido**: los 4 ítems viven dentro de una **superficie recesada** (track `bg-panel-2` con `border border-line` y esquinas `--r-card` 14px), no como botones sueltos sobre el paper. El track **no** lleva rótulo de grupo.
- [ ] En ≥941px la nav es una **columna a la izquierda** (track de ~200px de ancho, padding interno 6px) con el contenido a su derecha, alineados al tope, con aire entre ambos; los **4 ítems** ("General" · "Categorías" · "Métodos de pago" · "Límites") se apilan sin envolver dentro de su pastilla.
- [ ] El `.dtabs`/segmented horizontal **ya no aparece** en `/configuracion` (y sigue vivo e intacto en el modal de movimiento).
- [ ] La sección **activa** (según la URL) se ve como **tile que sube del track** (fondo `panel` + borde + sombra sutil), claramente distinta del track `panel-2` que la rodea; el hover sobre otra sección da un **tinte `panel-3`** (un paso por encima del track), **sin** sombra. Activo y hover tiran en **direcciones opuestas** de superficie, no se confunden.
- [ ] El ítem inactivo en reposo es **transparente sobre el track** (deja ver el `panel-2`), texto `--muted`; no hay salto de 1px al pasar de inactivo a activo (borde reservado).
- [ ] **Ninguna** sección (track, activa ni hover) usa índigo/acento como fondo o texto; el índigo aparece **solo** como anillo de foco al tabular.
- [ ] Foco de teclado: anillo índigo de 3px visible sobre el ítem enfocado; Tab recorre los enlaces.
- [ ] **Deep-link:** entrar directo a `/configuracion/categorias` (o `/metodos-pago` `/limites`) pinta esa sección como activa y muestra su contenido, sin pasar por General.
- [ ] Al cambiar de sección, **solo** cambia el contenido de la derecha; la `.phead` de página y el track de nav **no se mueven ni parpadean**.
- [ ] En ≤940px la nav pasa **arriba** del contenido: el track se vuelve **barra horizontal** (padding interno 4px) con las pastillas cortas envueltas dentro; con 4 ítems pueden **envolver a 2 filas dentro del track** (el track crece en alto, no en ancho). En el piso (640px, y con sidebar abierto ~392px de contenido) **no** hay scroll horizontal del `body`, ningún ítem desborda el track, y las 4 secciones quedan alcanzables.
- [ ] Claro y oscuro: el track `panel-2` y el tile activo `panel` **contrastan** en ambos modos; en oscuro el tile activo se separa del track por su `border border-line` (la sombra oscura casi no lee, el borde la sostiene).

*Jerarquía de cabecera (§1.b):*
- [ ] Hay **un solo H1** en la pantalla ("Configuración", 32px) y **un solo eyebrow** ("Ajustes"). En Categorías, Métodos y Límites **ya no** aparece un segundo H1 de 32px ni el eyebrow "Configuración".
- [ ] Cada sección abre con su **cabecera de sección** `h2` a **18px/700** (por debajo del H1, por encima de los títulos de card): "General" / "Categorías" / "Métodos de pago" / "Límites".
- [ ] La bajada de cada gestor sigue presente, a **13px/500 `--muted`** (con el número en `mono` y las palabras clave en `--ink` donde corresponde).
- [ ] En **General**: página "Configuración" (32) → sección "General" (18) → card "Moneda por defecto" (14.5), tres niveles distintos; General **no** tiene botón.
- [ ] Botón de acción en las **3 secciones** que lo tienen: primario, a la **derecha** de la fila del `h2`, con **ícono `Plus` 16px + label** ("Nueva categoría" / "Nuevo método de pago" / "Nuevo límite") — misma forma en las tres; **sin** el "+ " literal en el texto.
- [ ] En ≤940px, al angostar, el botón de acción **envuelve** bajo la identidad de la sección sin salir del contenedor.
- [ ] Los **skeletons de carga** de Categorías y Métodos ya **no** muestran línea de eyebrow y su título fantasma es ~18px (no ~32px).

> Nota de handoff: la estructura del hub (las 4 secciones, su orden, su copy, las rutas anidadas) es funcional (del analista → `screens.md`). Acá se especifica el **control de navegación** entre secciones **y la jerarquía de cabecera** al anidar los gestores; no se rediseñan las listas, filas, cards ni modales de los gestores — solo su banda de cabecera.

### 2. Solapa Límites — encabezado y lista

Dentro de la sección (ruta) **Límites**:

- **Cabecera de sección** — adopta el nivel 2 del hub (§1.b): fila `flex items-center justify-between gap-5 flex-wrap`, `mb-4`.
  - **Izquierda (identidad):** título `h2` "Límites" (**18px/700 `-0.01em` `--ink`**, subido desde el 14.5/600 previo para igualar a las demás secciones) + bajada **13px/500 `--muted`** ("Resaltá un dato cuando cruza un umbral que definís.").
  - **Derecha (acción):** `Button` **primario** (`variant=default`, `size=default`) con `Plus` 16px + **"Nuevo límite"**. Abre el modal de creación (§3). Misma forma que "Nueva categoría" / "Nuevo método de pago".

- **Lista de límites:** una **card contenedora** (`.card`: `bg-panel`, borde `--line`, `--r-card` 14px, `--shadow-sm`) con los límites como **filas separadas por hairline** (`--hair`), mismo ritmo de lista que `/mes` (`--row-pad` 14px vertical, 22px horizontal). Cada fila tiene **dos zonas** (identidad · estados/acciones), espejo de la sublínea del ítem de `/mes`:

  - **Zona identidad (izquierda, flex-1):**
    - **Línea 1 — label:** el `label` del usuario, o el **placeholder derivado** (key legible + condición) si está ausente; 14.5px/600 `--ink` (rol *nombre de movimiento*). A su izquierda, un **preview del efecto** (el mark real renderizado a tamaño chico — glifo/badge/dot/tint ámbar según el `effect` del límite) que actúa como identificador visual de qué marca aplica (ver §4).
    - **Línea 2 — meta (12.5px/500 `--muted`, `mt-[2px]`):** **qué observa** = rótulo legible de la key + refinamiento cuando aplica (ej. "Gasto del mes" · "Comida" · "Únicos"), y un **chip de alcance temporal** (`--r-chip` 7px, `bg-panel-3` `--muted`, 11px/600 `.04em`): "Todos los meses" / "Mes en curso".
    - **La condición** (`{operador} {umbral}`) va como **chip mono tabular** adyacente al label (ej. `> 300.000`), 12px `mono` `tnum` `--ink-2` sobre `bg-panel-3` `--r-chip` — es cifra, va en mono (regla dura 3). El umbral es **número puro, sin símbolo de moneda** (D3); si el `unit` es porcentaje lleva sufijo `%`, si es conteo lleva un sustantivo neutro ("ítems").
  - **Zona estados/acciones (derecha, `shrink-0`, `gap-[10px]`):**
    - **Toggle `enabled`** — **switch** que reusa el mecanismo del thumb del segmented (`CurrencySegmented`): pista `--panel-3`, thumb `--panel` + `--shadow-sm` deslizando 140ms; **encendido** = pista teñida `--accent` (fill de acento como **cromo de interacción**, misma licencia que el check del débito automático y el focus ring — **no** es color de monto ni marca). `role="switch"` + `aria-checked`, `aria-label` "Activar límite: {label}". Apagado = pista `--panel-3`, thumb a la izquierda.
    - **Eliminar** — `Button` `variant=ghost` `size=icon` con `Trash2` 16px `--muted` (hover `--expense-ink`). Confirmación **inline** (no modal, es acción de bajo riesgo, sin cascada): al pulsar, la zona de acciones se reemplaza por "¿Eliminar? · [Eliminar] [Cancelar]" con `Button` `variant=destructive size=sm` + `variant=ghost size=sm`. Reusa el molde destructive del DS.
  - **Estado deshabilitado (`enabled=false`):** toda la fila baja a `opacity-[0.55]` (mismo tratamiento que el ítem anulado de `/mes`), salvo el switch y el botón eliminar, que quedan a opacidad plena (siguen operables). Comunica "existe pero no evalúa" sin borrar información.

  - **Fila de límite de naturaleza activa:** un límite **activo** no tiene efecto visual ni alcance temporal (§3.3), así que su fila **no** muestra el preview de efecto de la Línea 1 ni el chip de alcance de la Línea 2. En su lugar, la fila porta la **marca de naturaleza activa**: el glyph `AlertTriangle` **ámbar** (`--warning-ink`, 16px) como identificador a la izquierda del label (rol espejo del preview de efecto de la fila pasiva) + un **chip "Alerta activa"** (`--r-chip` 7px, `bg-panel-3` `--warning-ink`, 11px/600 `.04em`) en la Línea 2, donde la fila pasiva lleva el chip de alcance. El resto de la fila es **idéntico** a la pasiva: label (o placeholder derivado), chip mono de condición (`{operador} {umbral}`), meta de qué observa, toggle `enabled` y eliminar con confirmación inline. La marca ámbar de naturaleza (aviso) se distingue del rojo destructive de la acción eliminar (borrado): coexisten en la misma fila sin cruzarse — ámbar = "avisa al guardar", rojo = "vas a destruir algo".

- **Estado vacío (sin límites):** dentro del tabpanel, bloque centrado (reusa el molde de empty-state del DS): glifo neutro `Gauge`/`Target` (lucide, ~28px, `--faint`), titular 14.5px/600 `--ink` "Todavía no creaste límites", bajada 13px/500 `--muted` ("Creá un límite y Control resaltará ese dato cuando cruce el umbral que definas."), y el `Button` **primario** "Nuevo límite" debajo. **Coherente con la restricción rectora:** sin límites, ni la app ni el panel muestran marca alguna.

### 3. Flujo de crear — modal con formulario progresivo

**Contenedor: modal** (reusa `transaction-modal`: portal, scrim `oklch(0.18 0.02 270 / 0.46)` + `blur(3px)`, diálogo `bg-panel` borde `--line` radio 18px `--shadow-lg` `animate-modal-pop`, header con título 18px/700 "Nuevo límite" + botón cerrar `X`). Es el mismo patrón con el que se crean movimientos, categorías y métodos de pago — coherencia total. **No** es wizard multi-página ni panel inline: es **un formulario en columna** (`space-y-[14px]`) que **revela y adapta** campos según lo elegido. Ancho del diálogo: `max-w-[460px]` — es variante `form` del shell, el mismo ancho que el modal de movimiento (el ancho sale de la variante, no de un número por pantalla).

Orden de los controles (arriba → abajo). Los pasos condicionales **no reservan alto** cuando no aplican (se montan/desmontan), fiel a "cero impacto":

1. **Anclaje (key)** — **primer campo y compuerta.** Reusa el **listbox rico con íconos** (`PaymentMethodSelect`): trigger + panel por portal, porque el catálogo va **agrupado por superficie** y con un glifo de contexto que un `<select>` nativo no puede mostrar. En el panel, **encabezados de grupo no seleccionables** (13px/700 `.1em` uppercase `--muted`, rol *group header*): **Vista del mes** · **Dashboard** · y un grupo por tipo de reporte (Ingresos vs Gastos · Gastos por categoría · Únicos · Cuotas · Inflación vs Ingresos). Cada opción = glifo de superficie 16px `--ink-2` + **rótulo legible de la key** (13.5px `--ink`) + meta a la derecha con el tipo de dato (`money`/`percent`/`count`) como chip `--panel-3` (11px/600). Hasta que no se elige key, el **resto del form no se renderiza** (refuerza la compuerta: sin key no hay unit, ni operadores válidos, ni subset de efecto).

2. **Refinamiento (condicional)** — se monta **solo si la key lo declara**:
   - `section` → primitiva **`Select`** con Únicos / Fijos / Cuotas (leídos de `monthSections`).
   - `categoryId` → **listbox rico** (molde `PaymentMethodSelect`) con **swatch de color de categoría** (6px `rounded-full`) + nombre — reusa el picker de categoría del DS. Label del campo: "Categoría".
   - Si la key no tiene refinamiento, este bloque no existe.

3. **Naturaleza (pasiva / activa)** — **segmented de 2 opciones** que reusa el molde `.dtabs`/`CurrencySegmented` neutro (el mismo del selector de solapas y del alcance temporal): **"Pasiva"** (izq) · **"Activa"** (der). Label del campo arriba (rol label, 12px/600 `.1em` uppercase `--muted`). Se monta **tras el refinamiento** (una vez elegida la key). Es la **compuerta** que reconfigura el resto del formulario:
   - **"Activa" está deshabilitada salvo que la key admita alerta activa** — solo las **7 keys `mes.*`** (las de la vista del mes) la habilitan. Con cualquier otra key, la opción "Activa" queda **deshabilitada** (`opacity-50`, `cursor-not-allowed`, `aria-disabled`, thumb sin desplazar) y la naturaleza es forzosamente pasiva. El estado deshabilitado **no se oculta**: presente pero apagado, coherente con el resto de disabled del DS. Un `title`/hint muted junto al control explica por qué ("La alerta activa solo aplica a datos del mes en curso") — el copy exacto lo confirma el analista.
   - **Preselección "Pasiva"** (la naturaleza sin efecto de interceptación; la más común). Cambiar a "Activa" **desmonta** el alcance temporal (§3.5) y el picker de efecto (§3.6) —la activa no tiene ni alcance ni efecto visual— y **restringe la polaridad de operadores** (§3.4). Volver a "Pasiva" los re-monta con sus defaults. Los pasos que se desmontan **no reservan alto** (fieles a "cero impacto"); la transición reusa el mismo montaje/desmontaje condicional del resto del form.

4. **Condición (operador + umbral)** — una fila `flex gap-3`:
   - **Operador:** `Select` compacto (ancho al contenido) con **glifo mono + palabra**. La oferta depende de la naturaleza:
     - **Rama pasiva:** los **5 operadores**: `>` mayor que · `≥` mayor o igual · `<` menor que · `≤` menor o igual · `=` igual a. Default `>` (`gt`).
     - **Rama activa:** **solo la polaridad válida del anclaje de la key** (la activa avisa contra un umbral con dirección única). **Techo** (`>` / `≥`) para las keys de **gasto, subtotal, conteo, categoría e ítem** (cruzar hacia arriba es lo que alarma); **piso** (`<` / `≤`) para **balance e ingreso** (cruzar hacia abajo es lo que alarma). El `Select` solo lista ese par; default el estricto (`>` para techo, `<` para piso). Los operadores fuera de la polaridad **no se ofrecen** (no aparecen deshabilitados: directamente no se listan, porque no tienen lectura de aviso).
   - **Umbral:** primitiva **`Input`** (`inputMode="decimal"`), cifra **mono tabular alineada a la derecha** (regla dura 3), `placeholder` según `unit`. **Número puro, sin prefijo de moneda** (D3). El `unit` de la key define el adorno **neutro**: `money` → sin símbolo (solo el número, con agrupación de miles al mostrar); `percent` → sufijo `%` como texto `--muted` adosado; `count` → paso entero (`step=1`) y sustantivo neutro. El sufijo/hint es cromo neutro `--muted`, **nunca** verde/rojo/moneda.

5. **Alcance temporal (solo naturaleza pasiva)** — segmented de **2 opciones** (reusa el molde `CurrencySegmented`/`.dtabs`, neutro): **"Todos los meses"** | **"Mes en curso"** (D4). Label del campo arriba (rol label, 12px/600 `.1em` uppercase `--muted`). Preselección visual "Todos los meses" (el más abarcativo); el default definitivo lo confirma el analista. **En rama activa este paso se desmonta** (la activa no tiene `temporalScope`).

6. **Efecto visual — marca pasiva (solo naturaleza pasiva)** — **subset por anclaje, con default.** Ver §4. Se monta **después** de elegir la key (el subset depende del **tipo de anclaje** de la key, no del refinamiento). **En rama activa este paso se desmonta** (la activa no tiene efecto visual; su señal es el aviso runtime al guardar, especificado en *Aviso de alerta activa de límites*).

7. **Nombre (opcional)** — último campo. Primitiva **`Input`** de texto, label "Nombre (opcional)", `placeholder` = el **label derivado** (key legible + condición) para que el usuario vea de antemano cómo se llamará si lo deja vacío.

- **Resumen en lenguaje natural** (feedback, antes del footer): línea 12.5px/500 `--muted` que arma la frase viva, con los fragmentos clave en `--ink-2`/600 y la cifra en mono. Se adapta a la naturaleza:
  - **Pasiva:** *"Se marcará **Gasto del mes** cuando **supere 300.000**, en **todos los meses**, con un **glifo de alerta**."* — confirma condición + alcance + efecto.
  - **Activa:** *"Al guardar un movimiento, Control **te avisará** si **Gasto del mes** **supera 300.000**."* — sin fragmentos de alcance ni de efecto (la activa no los tiene); confirma solo la condición y que el resultado es un aviso al guardar.
- **Footer** (`flex justify-end gap-3`, borde superior `--hair`): `Button` `variant=ghost` "Cancelar" + `Button` primario "Crear límite". El primario queda **deshabilitado** (`opacity-50`) hasta que los campos requeridos son válidos (key + umbral; + refinamiento si la key lo exige). Sin errores hasta el submit; los errores de umbral usan el estado de error de `Input` (borde `--expense`, ring `--expense-soft`, texto `--expense-ink`).

### 4. Efecto — subset por anclaje, default y preview

El picker de efecto es el **consumidor** de la tabla *Mapeo efecto ↔ tipo de anclaje* (sección *Marca visual pasiva de límites*). **No se duplica esa tabla acá.** Regla de derivación:

1. La key elegida determina su **tipo de anclaje** (línea de movimiento / total-subtotal / contador / celda de grilla / barra / punto de serie / métrica de footer) — dato del catálogo funcional.
2. El panel ofrece **exactamente** el subset "Efectos válidos" de esa fila, **con la primitiva marcada como Default preseleccionada**.
3. **Nunca** se ofrece un efecto fuera del subset (restricción dura del catálogo: `tint` no aparece sobre montos tipados, `fill` no aparece sobre celdas de heatmap, etc.). El usuario elige **cuán fuerte** marca, no el color: el hue siempre es ámbar `--warning` (o neutro por peso en `bold`).

- **Control:** grupo de **option-cards en radio** (`role="radiogroup"`), una por efecto válido. Cada card: `bg-panel` borde `--line` `--r-ctl`, seleccionada = borde `--accent` + ring `--accent-soft` 3px (cromo de interacción). Contenido de cada card:
  - **Nombre del efecto** (13px/600 `--ink`): Peso · Tinte · Glifo · Punto · Badge · Fondo · Ring (según ids `bold`/`tint`/`glyph`/`dot`/`badge`/`fill`/`ring`).
  - **Preview vivo** (feedback del task): el **mark real** aplicado sobre un **dato de muestra** representativo del anclaje — p. ej. una cifra `$300.000` mono tabular con `glyph` `AlertTriangle` ámbar al lado, o un `badge` `--warning-soft`, o el `tint` `--warning-ink` sobre la cifra. El preview usa los **tokens `warning` reales**, así el usuario ve **exactamente** la marca en ambos modos antes de crear. Para `fill`/`ring` (que "nunca van solos", a11y) el preview muestra el efecto **ya acompañado** de su glifo/badge obligatorio.
- **Default:** la primitiva marcada Default en la tabla queda preseleccionada; el usuario puede cambiar dentro del subset.
- El preview del picker es la **misma** representación que luego aparece como identificador de efecto en la fila de la lista (§2), para que list ↔ create hablen el mismo idioma visual.

### 5. Coherencia — moldes reusados (resumen)

| Elemento del panel | Molde reusado |
|---|---|
| Nav de secciones (hub de 4: General · Categorías · Métodos de pago · Límites) | navegación vertical de secciones (§1, patrón nuevo, tokens del DS) |
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
| Glyph + chip "Alerta activa" (fila y activa) | `AlertTriangle` `--warning-ink` + chip `--r-chip` `--panel-3` |

**Cumplimiento de reglas duras:** el umbral y la condición van en **mono tabular** (regla 3); el único índigo del panel es **cromo de interacción** (focus ring, thumb del switch encendido, borde de card de efecto seleccionada) — nunca tiñe cifras (regla 2); ningún control usa verde/rojo salvo el estado de **error** de `Input` y el botón **destructive** de eliminar (semántica de error/borrado, no de monto) — la señal de tipo income/expense no se toca (regla 1); la marca de **naturaleza activa** (glyph `AlertTriangle` + chip "Alerta activa") usa **ámbar `--warning`** —aviso, no destrucción ni monto— y se distingue nítidamente del rojo destructive de eliminar; todo el cromo tiene par claro/oscuro (regla 4).

---

## Aviso de alerta activa de límites (Límites y Alertas — P2, fase 2)

> Spec visual del **aviso de confirmación de la naturaleza activa** de un límite (`docs/roadmap-limites-alertas.md` §4 y D10). Un límite de naturaleza **activa** intercepta el **guardado de un movimiento** en el modal de carga (tabs Único / Fijo / Cuota): al pulsar **Guardar**, si el resultado **proyectado** cruzaría el umbral de uno o más límites activos, se muestra un **aviso** que enuncia qué límite(s) se cruzaría(n) y ofrece **continuar o cancelar**. **No bloquea** (D10: avisa y deja continuar). Extiende la familia visual ámbar de *Marca visual pasiva de límites* (mismo token `--warning`); acá va solo el cromo del aviso write-path. El shape del límite, las keys `mes.*`, la evaluación y la **proyección del dato post-movimiento** son funcionales/técnicos (analista + front) — no se especifican acá.

### Restricción rectora — cero fricción sin límites activos cruzados

**El aviso existe SOLO si al menos un límite activo se cruzaría.** Sin límites activos cruzados, el flujo de Guardar es **EXACTAMENTE** el de hoy: el movimiento persiste directo, sin diálogo intermedio, sin cambio de DOM ni de foco. La intercepción es una **compuerta condicional** en el handler de guardado: se proyecta el dato post-movimiento y se evalúan los límites activos; conjunto vacío → persistir como hoy; conjunto no vacío → montar el aviso. Es el espejo write-path de "cero impacto con config vacía".

### Forma y ubicación — diálogo de confirmación apilado, en registro ámbar

- **Es un diálogo de confirmación apilado** sobre el modal de movimiento (mismo molde que los `delete-*-dialog`: portal, scrim `oklch(0.18 0.02 270 / 0.46)` + `blur(3px)`, diálogo `bg-panel` borde `--line` radio 18px `--shadow-lg` `animate-modal-pop`, header + cuerpo + footer). **No** es callout inline dentro del form ni transforma el botón Guardar: es el mismo patrón con el que la app ya confirma acciones consecuentes (borrado). El modal de movimiento **permanece montado detrás** con el form intacto.
- **Apilamiento (z-index):** el aviso va **por encima** del modal de movimiento (`z-40`), al nivel de los diálogos de confirmación (`z-50`). El scrim del aviso oscurece también el modal de movimiento.
- **Ancho:** `max-w-[440px]` — es variante `dialog` del shell (el ancho sale de la variante, no de un número por pantalla). Aloja la lista de límites cruzados.
- **Al pulsar Guardar (interceptado):** el form valida como hoy; si es válido y hay ≥1 límite activo cruzado, en vez de persistir se monta el aviso. El botón Guardar del form vuelve a su estado idle (no queda "guardando") mientras el aviso está abierto.

### Tono — ámbar `--warning`, aviso NO destructivo

- El registro es **advertencia, no error ni destrucción.** Todo el peso de advertencia lo carga un **callout ámbar** (mismo molde que el callout de borrado en cascada: `rounded-ctl`, `bg: --warning-soft`, `border: 1px solid --warning`, `AlertTriangle` `--warning-ink`).
- **Se distingue explícitamente de una confirmación destructiva:** los diálogos de borrado usan **rojo** (`variant=destructive` + acentos `--expense`) porque son peligrosos; este aviso **no usa rojo en ningún elemento** — callout ámbar + botones neutros. Ámbar = "prestá atención"; rojo = "vas a destruir algo". No se cruzan.
- **Los botones NO son ámbar.** El ámbar vive en el callout (la información); las acciones son cromo neutro/primario. Teñir el botón de ámbar difuminaría "aviso" (callout) con "acción" (botón).

### Contenido y enumeración de cruces

**Header** — título 18px/700 `--ink`, `tracking-[-0.01em]` (texto, no depende de color; enuncia el hecho, no alarma):
- 1 límite: **"Este movimiento cruza un límite"**
- N límites: **"Este movimiento cruza {N} límites"**

**Cuerpo** (`px-[22px] pb-[22px] space-y-[14px]`):
- **Línea guía** (14px `--ink`): "Al guardar, este movimiento cruzaría {un límite que definiste / estos {N} límites que definiste}:".
- **Callout ámbar** con la enumeración de cruces:
  - **Un solo `AlertTriangle`** (16px `--warning-ink`) arriba a la izquierda — **no uno por límite** (coherente con la regla de colisión de la marca pasiva: un glifo; la enumeración lista los cruces).
  - **Lista de límites cruzados** (`space-y-2`), un ítem por límite. Cada ítem:
    - **Label** (13.5px/600 `--warning-ink`): el `label` del usuario, o el **placeholder derivado** (métrica legible) si está ausente.
    - **Condición cruzada** (12.5px/500 `--warning-ink`, énfasis atenuado), separada del label por middot/em-dash: `{verbo} {umbral}` — ej. **"Gasto del mes"** · "supera $300.000". La **cifra va en mono tabular** (`tnum`, regla dura 3). El `verbo` se deriva del operador: `gt`→"supera", `gte`→"alcanza o supera", `lt`/`lte`→"queda por debajo de", `eq`→"llega a". `unit=percent` → sufijo `%`; `count` → sustantivo neutro. *(La redacción exacta del verbo es contenido; su copy definitivo lo confirma el analista.)*
    - **(Opcional, si el front tiene el proyectado):** addendum muted "quedaría en $X" refuerza la previsibilidad; misma mono tabular. No es obligatorio.
  - Con múltiples límites, cada ítem puede llevar un **marcador neutro** (dot pequeño o dash) a la izquierda; el `AlertTriangle` único de la cabecera del callout ya porta la semántica.
- **Nota de cierre** (12.5px/500 `--muted`): "Podés guardarlo igual — Control solo te avisa." (Refuerza D10: informa, no impide.)

El umbral es **número puro sin moneda** (D3); en el aviso se renderiza en **mono tabular con agrupación de miles**, reusando el formateo de cifra vigente (mismo criterio que el tooltip de la marca pasiva).

### Jerarquía de botones y copy

Footer (`flex items-center justify-end gap-3 px-[22px] py-4`, `border-t border-hair bg-panel-2` — idéntico al footer de los `delete-*-dialog`):
- **"Cancelar"** — `Button variant=ghost size=sm`, a la izquierda. Cierra **solo el aviso**; el modal de movimiento queda abierto con el form intacto (nada se pierde), para ajustar el movimiento.
- **"Guardar igual"** — `Button variant=default size=sm` (**primario, índigo — NO destructive, NO ámbar**), a la derecha. Es la **acción primaria**: persiste el movimiento (mismo save-path de hoy), cierra el aviso y el modal de movimiento, toast de éxito como siempre. Usar el primario neutro —no el rojo destructive— comunica visualmente "esto NO es destrucción"; el índigo es cromo de interacción legítimo (regla dura 2).

**Cuál es primario:** "Guardar igual" es el **botón primario** — coherente con D10 (no bloquea; continuar debe estar accesible sin fricción, a un clic, visualmente dominante). El aviso se **lee** porque el peso de advertencia lo carga el **callout ámbar** (jerarquía visual: callout dominante arriba, botones secundarios abajo), no porque se entierre la acción de continuar.

### Accesibilidad

- **`role="alertdialog"`** (no solo `dialog`): interrumpe el flujo y requiere respuesta; es advertencia. `aria-modal="true"`, `aria-labelledby` = título, `aria-describedby` = línea guía + lista de cruces (el lector enuncia qué límites se cruzarían).
- **Foco:** trap dentro del diálogo. **Foco inicial en "Cancelar"** (la opción no consecuente): así un **Enter reflejo** —el usuario acaba de pulsar Guardar/Enter para disparar la intercepción— **no** salta el aviso por accidente. "Guardar igual" queda a un Tab/clic (fricción mínima, un acto deliberado): se preserva "accesible sin fricción" sin permitir blow-through. **Esc = Cancelar.**
- **No depende solo de color:** la advertencia la portan (a) el **texto del título** ("cruza un límite"), (b) la **forma del `AlertTriangle`**, (c) el **texto enumerado** de cada cruce. El ámbar es refuerzo, nunca la única señal. El texto accesible **reusa el `label`** de cada límite (o su placeholder).
- **Contraste:** `--warning-ink` sobre `--warning-soft` — misma barra ya validada del callout de advertencia vigente; par claro/oscuro (regla dura 4).

### Cumplimiento de reglas duras

- **Regla 1 (verde=ingreso · rojo=gasto):** el aviso es **ámbar**; **ningún elemento usa rojo** (rojo se reserva para destructive/error) ni verde. El callout no recolorea montos tipados.
- **Regla 2 (índigo solo marca/interacción):** el único índigo es el botón primario "Guardar igual" (cromo de interacción), nunca cifra.
- **Regla 3 (dinero en mono tabular):** umbral y proyectado en mono `tnum`; el umbral es número puro (D3).
- **Regla 4 (ambos modos):** tokens `warning` con par claro/oscuro; el aviso se lee idéntico en ambos.

### Coherencia — moldes reusados

| Elemento del aviso | Molde reusado |
|---|---|
| Diálogo apilado (scrim, diálogo, header, footer) | `delete-*-dialog` / `transaction-modal` |
| Callout de límites cruzados | callout de borrado en cascada (`--warning-soft` / `--warning` / `AlertTriangle`) |
| `AlertTriangle` único + enumeración | regla de colisión de la *Marca visual pasiva* |
| Botones (ghost "Cancelar" · primario "Guardar igual") | primitiva `Button` |
| Cifra del umbral / proyectado | mono tabular del DS |

> **Configuración de la naturaleza activa:** el **selector de naturaleza** (pasiva/activa) desde el que el usuario crea un límite activo está especificado en *Panel de gestión de límites* §3.3 (el segmented pasiva/activa, la habilitación de "Activa" solo con keys `mes.*`, el desmontaje de alcance y efecto, y la polaridad de operadores) y su fila en la lista en §2. Esta sección cubre el **aviso runtime** que ese límite dispara al guardar. El disparo de la intercepción y la proyección del dato son técnicos/funcionales.

---

## Popover informativo de límites por superficie (Límites y Alertas — P2)

> Spec visual del **popover de solo lectura** que **lista qué límites observan una superficie** (roadmap §"P2 — Popover informativo de límites por superficie"). Es una pieza **nueva e independiente** de la marca pasiva (RF-LIM-003) y del aviso activo (RF-LIM-004): **no marca ni avisa — solo informa**. Se apoya en un ícono disparador que abre un popover con el listado, agrupado por naturaleza. Aparece en las **5 cards de `/reportes`** y en **`/mes`**; **nunca en el Dashboard** (asimetría deliberada: el widget del Dashboard es pantalla de vistazo, sin chrome de card). El shape del límite, las keys del catálogo (`lib/limits/catalog.ts`), la evaluación y la resolución del refinamiento son funcionales/técnicos — acá va solo el cromo.
>
> **Regla rectora — es información, no señal.** Todo el cromo del popover es **estrictamente neutro** (`--ink`/`--ink-2`/`--muted`/`--faint`). **No usa ámbar `--warning`** en ningún elemento: ámbar es el registro de *marca cruzada* / *aviso* (secciones anteriores), y teñir este popover de ámbar mentiría "algo cruzó un umbral" cuando el popover solo **enumera qué se está observando**, cruce o no. La distinción marca/aviso vs. información se preserva **por color**: ámbar = pasó algo; neutro = acá tenés el dato.

### 1. El ícono disparador

- **Glifo: `Info`** (lucide) — la "i" en círculo, lectura universal de "información sobre esto". Se descartan `AlertTriangle` (es el glifo reservado de la marca ámbar — lo confundiría con un cruce), `Bell` (lee como notificación/alerta) y `HelpCircle` (lee como "ayuda/cómo se usa", no como "datos sobre esto"). **16px**, `aria-hidden="true"` (el nombre accesible lo da el `aria-label` del botón).
- **Botón icónico ghost — reusa el molde exacto del botón de refrescar / `X`** (*Botón de refrescar por reporte* §3): hit-area `h-8 w-8` (32×32px), `rounded-[var(--r-ctl)]` (10px), glifo centrado. Estados:
  - **Reposo:** `text-muted`, **sin caja** (fondo transparente) → en reposo es solo el glifo `Info` tenue, no compite con la identidad.
  - **Hover / abierto:** `hover:bg-panel-2 hover:text-ink`, transición `140ms` (`transition-colors duration-[140ms] motion-reduce:transition-none`). Con el popover **abierto**, el botón mantiene el fondo `--panel-2` y `text-ink` (feedback de "activo").
  - **Focus (teclado):** `focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]` — mismo ring `--accent-soft` que todos los icon-buttons del DS (acento = cromo de foco, no dato; no viola reglas duras).
- **Color: neutro en todo estado** (`--muted` → `--ink`). **Nunca** ámbar, income/expense ni índigo de marca. El índigo aparece **solo** como focus ring.
- **Condición de aparición (regla dura del subsistema):** el ícono se monta **solo si hay ≥1 límite** (habilitado o no) cuya `surface` coincide con la de esta superficie. Con **cero** límites para la superficie, el botón **no se renderiza** (no reserva hueco ni deja un slot vacío) — coherente con el "cero impacto con config vacía" de la marca pasiva. Que el ícono exista es, entonces, señal en sí de "esta pantalla tiene al menos un límite mirándola".

### 2. Ubicación del ícono por superficie

**Principio único:** el ícono vive **junto a la identidad/título** de la superficie (no en el clúster de acciones ni de controles), como la pieza **más quiet** del chrome. Es metadato sobre *qué se observa en esta superficie*, no un control que se opera — por eso acompaña al título, no a los steppers/utilidades.

- **Cards de `/reportes` (5 tipos):** en la **zona de identidad (izquierda)**, **inmediatamente después del título** de la card, separado por `gap-[6px]`. El `CardControls` derecho (año · moneda · refrescar · `X`, con sus dos hairlines) **no se toca** — el ícono no entra en ese clúster ni agrega hairlines. Aplica a las cuatro cabeceras: el `CardControls` compartido de `report-card.tsx` (income-expense + by-category) y las tres inline (`unique-grid-card`, `cuotas-gantt-card`, `inflation-income-card`). En **`by-category`** (que lleva las tabs Barra/Línea bajo el título) el ícono va en la **fila del título**, antes de las tabs — las tabs siguen debajo, sin cambio. El título es editable (click-to-edit + lápiz on-hover): el ícono `Info` es un **botón hermano posterior**, con su propio hit-area y su `gap`, **fuera** del target de edición del título (no lo estorba).
- **Dashboard:** **no se monta.** El widget `income-expense` efímero del Dashboard nunca renderiza el ícono (misma señal condicional que ya lo distingue: sin moneda, sin `X`, default global efímera). El listado del Dashboard no existe.
- **`/mes` — desktop (ancho de contenido ≥1288px):** **en la fila del H1** (`MonthJumpTriggerDesktop`), como **hermano posterior** del disparador de período, separado por `gap-[8px]`. La fila del H1 mide 32px (alto del H1) → el botón de 32×32 **cabe sin crecerla** (cero layout-shift vertical). Es el análogo directo del "ícono junto al título de la card". El disparador del H1 (que abre la rueda mes/año, con su `ChevronsUpDown`) y el botón `Info` son dos targets distintos con su `gap`; no se confunden.
- **`/mes` — compacto (ancho de contenido <1288px):** en la **fila del stepper** (`@wide:hidden`, `flex items-center gap-[10px] flex-wrap`), **después del `CurrencyChip`** y **antes** del link "Ir al mes en curso". El pill stepper mide ~40px → el botón de 32×32 cabe. Si la línea no alcanza, `flex-wrap` lo reacomoda (no se corta ni empuja el pill). Se mantiene la adyacencia con el chrome de contexto de pantalla (período + moneda), igual que en desktop acompaña al período.

> **Por qué no el clúster de acciones/controles.** En `/mes` el clúster derecho (`Ordenar secciones` · `+ Nuevo movimiento`) es de **acciones**, con una CTA primaria; en las cards el clúster derecho es de **controles** (año/moneda/refrescar/quitar). Meter ahí una pieza puramente informativa la haría competir con acciones y rompería el balance ya calibrado (y los hairlines de la card). La zona de identidad es su lugar natural: quiet, a la izquierda, leída como "metadato de esto".

### 3. Anatomía del popover

Reusa el **molde de popover del DS** (*Moneda por reporte* §3, *Cierre de overlays*): caja `--panel`, borde `--line`, radio `--r-ctl` (10px), `--shadow-lg`, animación `pop`; `prefers-reduced-motion` → aparición instantánea. Anclado al ícono; **sin scrim**.

- **Caja y medidas:** `min-w-[240px] max-w-[300px]` (ancho por contenido dentro de esa banda), padding exterior `p-[6px]`. Se ancla al **borde del disparador** y crece hacia el lado con espacio (típicamente hacia abajo-derecha); clampeo y flip en §4.
- **Caption (encabezado del popover):** una línea eyebrow que enmarca el contenido y evita que los headers de grupo queden huérfanos. Texto **12px / 600 uppercase `tracking-[0.1em]` `--muted`** (escala Eyebrow del DS), `px-[10px] pt-[6px] pb-[4px]`. Copy: **"Límites de este reporte"** (cards) / **"Límites de esta vista"** (`/mes`). *(Copy sujeto a confirmación del analista — ver cierre.)*
- **Grupos por naturaleza — encabezado descriptivo.** Los dos grupos del roadmap (**Pasivos** / **Activos**) se rotulan en **lenguaje humano** (traducción de la jerga, criterio de diseño), preservando el significado:
  - **Pasivos → "Marcan un dato"** — pintan una marca sobre un dato de la pantalla (RF-LIM-003).
  - **Activos → "Avisan al guardar"** — avisan al guardar un movimiento (RF-LIM-004). **Este grupo aparece únicamente en `/mes`** (los activos solo existen sobre keys `mes.*`).
  - **Header de grupo:** texto **11px / 600 uppercase `tracking-[0.08em]` `--faint`**, `px-[10px] pt-[8px] pb-[3px]`, precedido de un `--hair` de separación entre grupos (solo entre grupos, no antes del primero). Se muestra **siempre que el grupo tenga ≥1 ítem** (incluso si es el único grupo: nombra el comportamiento, es informativo aun solo). En las cards de `/reportes` solo puede existir el grupo "Marcan un dato".
- **Ítem del listado** (un límite): `role="listitem"`, caja `px-[10px] py-[6px]`, `rounded-[var(--r-chip)]` (7px), **dos líneas**:
  - **Línea 1 — nombre:** `label` del límite si existe; si no, el **rótulo del anclaje** (`getAnchorDef(anchorKey).label`, ej. "Gasto del mes"). Tipografía **UI 13px / 500 `--ink`** (es un nombre, no dinero → **no** mono). Truncado a una línea con ellipsis si excede el ancho; texto completo en `title`. Si el límite tiene **refinamiento de categoría**, el nombre lo antecede un **punto de color 6px** (`rounded-full`, color de la categoría — primitiva de categoría del DS) + el nombre de la categoría; si tiene **refinamiento de sección** (`Únicos`/`Fijos`/`Cuotas`), el nombre lo incorpora en texto. El front resuelve la etiqueta legible del refinamiento.
  - **Línea 2 — condición:** el fragmento comparativo, **12px `--muted`**, `mt-[1px]`. Estructura: cuando la línea 1 es un `label` propio del usuario, la línea 2 antepone el **rótulo del anclaje** para dar contexto del dato ("Gasto del mes · > 300.000"); cuando la línea 1 ya es el rótulo del anclaje (sin `label` propio), la línea 2 es **solo la condición** ("> 300.000"). El **fragmento numérico** de la condición (`formatCondition` → símbolo del operador + umbral) va en **IBM Plex Mono `tnum`** (**regla dura 3**: toda cifra —el umbral es money/percent/count/signed-money— en mono tabular); el símbolo del operador (`>`, `≥`, `<`, `≤`, `=`) acompaña en la misma mono. El separador de contexto es un middot `·` `--faint`.
- **Matiz de alcance temporal (`temporalScope`) — reflejar, no mentir:** un límite **pasivo** con `temporalScope: "current"` marca **solo el mes en curso**, y por eso se comporta distinto según la superficie (en una card anual de `/reportes` solo afecta el punto/barra del mes en curso dentro del año; en `/mes` solo marca cuando estás **viendo** el mes en curso). Para que el listado no mienta, esos ítems llevan un **qualifier neutro**: chip-texto **"Solo mes en curso"**, **11px / 500 `--faint`**, al final de la línea 2 (o debajo si no entra), separado por middot `·`. Los límites `temporalScope: "all"` (el default) **no** llevan qualifier (es la norma; anotarla sería ruido). El enunciado es una verdad sobre el **límite** (su alcance), consistente en toda superficie — el usuario infiere el efecto local. Los **activos** no usan `temporalScope` (no aplica) → nunca llevan este qualifier.
- **Ítem deshabilitado (`enabled: false`) — incluido, atenuado:** se **lista igual** (el popover informa la config completa), con la fila entera a **`opacity-60`** (reusa el registro atenuado del ítem anulado del DS) + una etiqueta **"Desactivado"** al extremo derecho de la línea 1, **11px / 500 `--faint`**, neutra. La atenuación + la etiqueta de texto son **dos portadores** (no solo opacidad): el estado no depende de un único canal. Un límite deshabilitado no produce marca ni aviso, pero el usuario ve que existe y está apagado.
- **Sin preview de efecto.** El popover **lista**, no previsualiza la marca ámbar de cada límite (eso vive en la superficie real cuando el dato cruza). Mostrar el glifo/badge ámbar acá reintroduciría el registro de "algo pasó" que esta pieza deliberadamente evita. *(Agregado no solicitado si alguien lo pide — mantener fuera salvo decisión explícita.)*

### 4. Disparo, cierre y accesibilidad

- **Disparo (híbrido click + hover-desktop, NO hover puro):**
  - **Click / tap** → abre (y re-clic → cierra, toggle). Disponible en todo dispositivo — es el camino que **funciona en touch**.
  - **Desktop (puntero fino / hover-capable):** **además** abre por **hover** con un pequeño delay (~150ms de intención) y cierra al `mouseleave` con una gracia corta. El hover es **aditivo**: nunca es el único camino (en touch no existe hover → nacería roto bajo la política P0-a). El estado abierto por hover es idéntico al abierto por click.
  - **Teclado:** el botón es focalizable; `Enter`/`Espacio` abre; el foco puede entrar al popover a recorrer el listado; `Esc` cierra y **devuelve el foco al disparador**.
- **Cierre (es informativo, no un form → cierra por click-fuera):** por **click/tap fuera**, **`Esc`**, **re-clic en el disparador**, y (desktop) **`mouseleave`**. **No** monta scrim ni bloquea el fondo; **no** hay focus-trap (es contenido de lectura, no un form — se distingue de la rueda mes/año y del aviso activo, que sí atrapan por ser form/alertdialog). Alineado con *Cierre de overlays*: los popovers no-form cierran por click-fuera.
- **A11y del popover:** disparador `aria-haspopup="dialog"` + `aria-expanded`; `aria-label="Límites que observan este reporte"` (cards) / `"…esta vista del mes"` (`/mes`). El popover es una **región etiquetada** (`role="group"`/`dialog` no-modal) con `aria-label` espejo del disparador; el listado es una lista semántica (`role="list"` / `listitem`). Cada ítem porta señal **no-color**: el estado "Desactivado" y el qualifier "Solo mes en curso" son **texto**, no solo atenuación/color. Contraste neutro estándar del DS (par claro/oscuro, regla dura 4).

### 5. Comportamiento en pantalla chica (contención, política P0-a) — los cuatro invariantes

Rige en todo ancho **≥640px** (`--bp-floor`), con el sidebar abierto o cerrado.

1. **Sin scroll horizontal del `body`.** El popover es **overlay por portal** (no participa del flujo de la card ni del header), anclado al disparador y **clampeado al viewport con margen mínimo 12px**: nunca empuja el layout ni asoma fuera del borde. Su ancho (`max-w-[300px]`) entra holgado incluso en el piso de 640px con el sidebar abierto (contenido ~392px). El disparador `Info` es un glifo de 16px en 32×32 → no ensancha ni el header de `/mes` ni la cabecera de card (en las cards vive en la identidad izquierda, lejos del clúster de controles que ya gestiona su propio wrap).
2. **Popover completo y escapable — nunca cortado ni atrapante.** Si no hay lugar debajo del disparador, **flipea hacia arriba** (mismo mecanismo de colisión que la rueda mes/año §5 y los demás popovers; lo resuelve `control-frontend`); si el borde lateral lo cortaría, **clampea horizontal** a 12px del borde. Con **muchos límites**, el popover **capea su alto** (`max-h-[min(60vh,360px)]`) y **scrollea dentro de sí mismo** (invariante 4): el contenido se recorre en el popover, el `body` no. Siempre se puede ver entero y salir (`Esc` / click-fuera / re-clic siempre disponibles, sin trap).
3. **Ninguna acción inalcanzable.** El disparador de 32×32 cumple hit-area del DS y queda on-screen en todo ancho (en `/mes` compacto viaja con el `flex-wrap` del stepper; en cards, en la identidad izquierda que nunca sale de pantalla). El popover no tiene controles operables (es lectura); sus únicas "acciones" son las vías de cierre, todas alcanzables por teclado y puntero.
4. **Superficies anchas scrollean dentro de sí mismas.** El listado largo scrollea **dentro del popover** (punto 2), no en la página. El popover nunca fuerza scroll del `body`.

### 6. Cumplimiento de reglas duras

- **Regla 1 (verde=ingreso · rojo=gasto):** el popover es **neutro**; ningún elemento usa income/expense. Los umbrales de límites sobre montos tipados se muestran como **número puro** (sin recolorear), en `--muted`/mono.
- **Regla 2 (índigo solo marca):** ningún elemento se tiñe de índigo; el índigo aparece **solo** como focus ring del disparador (cromo de interacción).
- **Regla 3 (dinero en mono tabular):** el fragmento numérico de cada condición (umbral money/percent/count/signed-money) va en **IBM Plex Mono `tnum`**; los nombres/labels y los headers van en UI (no son cifras).
- **Regla 4 (ambos modos):** solo tokens neutros theme-aware → se lee idéntico en claro y oscuro sin tratamiento extra.
- **Distinción vs. ámbar (regla del subsistema de límites):** **no** usa `--warning` en ningún elemento — es información, no marca ni aviso. El ámbar queda exclusivo de *Marca visual pasiva* y *Aviso de alerta activa*.

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

> **Señal de documentación (para el analista, vía orquestador):** el copy visible de los **headers de grupo** ("Marcan un dato" / "Avisan al guardar"), el **caption** ("Límites de este reporte" / "…de esta vista"), la etiqueta **"Desactivado"** y el qualifier **"Solo mes en curso"** son **traducciones de diseño** de conceptos funcionales (naturaleza pasiva/activa, `enabled`, `temporalScope`). Su redacción final debería confirmarla el analista en `screens.md` / `requirements.md`. El comportamiento visual definido acá no depende de esa confirmación; solo la letra exacta.

---

## Sección "Datos externos" de `/configuracion` — ver y actualizar inflación (IPC) + cotizaciones

> Spec visual de la sección donde el usuario **lee** los datos macro que Control usa para convertir y contextualizar montos (inflación INDEC + cotizaciones dólar/euro/real) y los **actualiza** con una sola acción. **Reutilización total, cero token nuevo:** todo se arma con moldes vigentes — la `.card` de `/configuracion`, la jerarquía de cabecera del hub (§ *Panel de gestión de límites* §1.b), el botón `RefreshCw` (mismo ícono y lógica de spinner que el *Botón de refrescar por reporte*), el sistema de toasts, `SkeletonPill`, el patrón de error inline de la card de Moneda, y las reglas duras de cifra (mono tabular, neutralidad de color). No se introduce cromo nuevo.

### 0. Ubicación estructural — agregado no solicitado, confirmar con analista

El brief pide "una **sección** Datos externos en `/configuracion`". `/configuracion` es un **hub de nav-rutas** (General · Categorías · Métodos de pago · Límites — § *Panel de gestión de límites* §1). Lo natural y consistente es que "Datos externos" sea una **quinta sección hermana** con su propia ruta (`/configuracion/datos-externos`), tomando el mismo track de nav vertical y la misma cabecera de sección (nivel 2, §1.b). **Pero la estructura del hub (qué secciones existen, su orden, sus rutas y su copy de nav) es funcional — la cierra el analista en `screens.md`.** Por eso:

- **Marca "agregado no solicitado — confirmar":** que "Datos externos" sea una **nueva entrada de nav** (y su posición en el orden — recomiendo **último**, tras Límites, porque es lectura de referencia, no administración de la cuenta) es una decisión de ruteo que **debe confirmar el analista**.
- **La spec visual de abajo es agnóstica a eso.** El contenido (cabecera de sección + dos cards + pie) se implementa **igual** ya sea como sección ruteada propia o —si el analista lo prefiere— como bloque dentro de General. Si es sección propia, hereda el track de nav, el ítem activo y la cabecera nivel 2 **sin cambios** respecto de las otras cuatro secciones; no re-especifico esos moldes acá.

### 1. Cabecera de sección (nivel 2 del hub) + botón "Actualizar datos"

Fila `flex items-center justify-between gap-5 flex-wrap`, `mb-4` (idéntica a las demás secciones del hub, §1.b):

- **Izquierda (identidad):**
  - **Título `h2`** "Datos externos": `text-[18px] font-bold tracking-[-0.01em] text-ink`. Mismo nivel 2 que "General" / "Límites".
  - **Bajada** (13px/500 `--muted`, `mt-[3px]`): *"Inflación y cotizaciones que Control usa para convertir y ajustar tus montos."* (copy sugerido — el definitivo lo confirma el analista).
- **Derecha (acción) — botón "Actualizar datos":**
  - **Ubicación:** en par con el `h2`, a la derecha (`justify-between`), ocupando el mismo *slot de acción de sección* que "+ Nueva categoría" en las otras secciones. Es la **única** acción de la sección y refresca **ambos** bloques (inflación + cotizaciones) de una.
  - **Jerarquía — secundario, no primario.** `Button` **`variant=outline`** `size=default` con **ícono `RefreshCw` 16px a la izquierda + label "Actualizar datos"**. *Por qué secundario y no el primario índigo que usan las secciones de creación:* el slot de acción del hub lleva primario cuando la acción **crea** algo (foco de la tarea). Acá el foco de la sección es **leer** los datos; actualizar es una acción de mantenimiento **repetible y ocasional**. Un primario índigo sólido gritaría en una sección de consulta y competiría con la lectura de las cifras. `outline` (borde `--line-strong`, fondo `--panel`, hover `--panel-2` + translateY) da afordancia clara de botón sin teñir de acento — el índigo queda **solo** como focus ring (regla dura 2). El ícono `RefreshCw` (doble arco = "actualizar", misma elección que el refrescar de reportes) hace inequívoca la acción.
  - **Estado normal:** `RefreshCw` 16px `--ink` estático + "Actualizar datos". Siempre habilitado salvo durante su propio fetch.
  - **Estado "Actualizando…" (loading):** el **mismo ícono `RefreshCw` rota** (`animate-spin`, giro horario; `motion-reduce:animate-none`), el **label cambia a "Actualizando…"**, el botón queda `disabled` + **atenuado `opacity-60`**, hover suprimido, `aria-busy="true"`. Reusa exactamente el patrón del refrescar de reportes: bajo reduced-motion el ícono no gira y el *cue* accesible de "trabajando" es la atenuación + `disabled` (nunca depende solo de la animación). Se ata al fetch de actualización en vuelo (no al skeleton de carga inicial, que es de la sección — §5).
  - **Post-acción:** el botón vuelve al estado normal; **el resultado se comunica por TOAST** (§4), no por cambio persistente en el botón. Los bloques re-renderizan con el dato nuevo (o quedan igual si no hubo cambios) y el pie de "última actualización" (§6) refleja la corrida.
  - **A11y:** `type="button"`, `aria-label="Actualizar datos externos"` (estático), ícono `aria-hidden`. `aria-busy` sigue el fetch.
  - **Responsive:** por el `flex-wrap` de la fila, en angosto el botón **envuelve bajo la identidad**, alineado a la izquierda (igual que el resto de acciones de sección).

Debajo de la cabecera, el contenido de la sección: **dos cards apiladas** (`space-y-4`, mismo ritmo que la sección General) — Inflación primero, Cotizaciones después — y el **pie discreto** (§6).

### 2. Card "Inflación (IPC)"

`.card` del DS: `rounded-[14px] border border-line bg-panel shadow-[var(--shadow-sm)]`, `padding var(--card-pad)` (22px). Estructura interna en tres bandas separadas por hairline (`--hair`): **destacado → historial → ver más**.

**2.a Destacado (último dato) — la lectura protagonista.**
Fila `flex items-center justify-between gap-6` (mismo molde de fila de ajuste):
- **Izquierda (identidad):**
  - **Eyebrow** "Último dato": `text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint` (mismo micro-label que "Tema"/"Menú").
  - **Mes** ej. "Junio 2026": `text-[14.5px] font-semibold text-ink mt-[2px]` (rol nombre).
  - **Sub-rótulo** "Variación mensual": `text-[12.5px] font-medium text-muted mt-[2px]`.
- **Derecha (la cifra):** la variación ej. "1,6%" como **figura mono destacada** — `font-mono tnum text-[22px] font-semibold text-ink leading-none`, sufijo `%` inclusive (mismo cuerpo mono, no un span aparte). `shrink-0`.
  - **Regla dura de color — neutral, jamás semántica.** La inflación **no** es ingreso ni gasto: la cifra va en **`--ink` neutro**, **nunca** verde ni rojo (regla dura 1), aunque "más inflación" tenga connotación negativa. Consistente con el token `--rate`/`--ink-2` que ya usa la inflación en reportes (nunca color semántico).
  - Va en **mono tabular** (`tnum`) por ser cifra numérica: alinea con las variaciones del historial abajo, columna prolija.

**2.b Historial del año en curso — lista mes × variación.**
Debajo de un divisor `--hair` (`mt-4 pt-4` o equivalente), lista de los meses del **año en curso** con su variación, **más reciente arriba**:
- **Fila:** `flex items-center justify-between`, ritmo de lista `py-[10px]`, separadas entre sí por `--hair`.
  - **Izquierda — mes:** ej. "Mayo 2026" `text-[13px] font-medium text-ink-2`.
  - **Derecha — variación:** `font-mono tnum text-[13px] font-medium text-ink-2`, sufijo `%`. **Neutral `--ink-2`**, nunca semántica.
- **Sin duplicar el destacado:** el mes ya mostrado como destacado (§2.a) **no se repite** en la lista; el historial arranca en el mes inmediatamente anterior. Así el "último dato" tiene un solo lugar (arriba, protagónico) y la lista es el contexto hacia atrás.
- **Jerarquía deliberada destacado vs. lista:** el destacado usa cifra 22px `--ink`; la lista usa 13px `--ink-2`. El salto de tamaño y de tono (ink vs ink-2) hace que el ojo lea **primero el último dato** y **después** el historial como material de referencia — jerarquía visual al servicio de "¿cuánto fue la inflación del último mes?".
- **Estado sin más datos del año** (ej. estamos en enero y solo existe el destacado): en vez de la lista, una línea `text-[12.5px] font-medium text-muted` centrada: *"Todavía no hay más datos de {año}."*

**2.c "Ver meses anteriores" — cargar hacia atrás.**
Debajo de la lista, separado por `--hair`, un control **full-width discreto** para traer meses de años anteriores:
- **Forma:** botón `w-full` `flex items-center justify-center gap-1.5`, `py-2.5`, `rounded-[var(--r-ctl)]`, texto `text-[13px] font-semibold text-ink-2`, ícono **`ChevronDown` 14px `--muted`** a la derecha del label. Reposo sin caja; **hover** `bg-panel-2 text-ink`, transición 140ms. Focus-visible: anillo `--accent-soft` 3px. **No** es primario ni lleva acento de relleno (afordancia de "ver más", no de acción destacada).
- **Label:** "Ver meses anteriores".
- **Estado cargando más:** label pasa a "Cargando…" + el `ChevronDown` se reemplaza por `RefreshCw` 16px `animate-spin` (`motion-reduce:animate-none`); botón `disabled` + `opacity-60`. Al resolver, los meses viejos se **anexan al final** de la lista y el botón vuelve a "Ver meses anteriores".
- **Sin más historial disponible:** el botón **se desmonta** (no queda deshabilitado colgando) — cuando el backend indica que no hay meses más atrás, simplemente no se renderiza.

### 3. Card "Cotizaciones"

`.card` del DS (mismo molde). Muestra los **4 valores del mes actual**: dólar oficial, dólar blue, euro, real.

- **Cabecera de card (opcional, ligera):** título "Cotizaciones" `text-[14.5px] font-semibold text-ink` + sub "Valores del mes en curso." `text-[12.5px] font-medium text-muted mt-[2px]`, `mb-4`. (Coherente con la identidad de card del DS; si el analista prefiere sin sub, se cae solo el sub.)
- **Layout — grilla 2×2 de celdas-valor.** `grid grid-cols-2 gap-3`. Cada uno de los 4 valores es una **celda recesada** (tile de valor): `bg-panel-2 border border-line rounded-[var(--r-ctl)] px-3.5 py-3`, `flex flex-col gap-1`, `min-w-0`.
  - **Rótulo (arriba):** `text-[12.5px] font-medium text-muted` — "Dólar oficial" · "Dólar blue" · "Euro" · "Real". **Orden fijo** izq→der, arriba→abajo: `Dólar oficial · Dólar blue` (fila 1), `Euro · Real` (fila 2). (El copy exacto de los rótulos lo confirma el analista; estos son los sugeridos.)
  - **Valor (abajo):** el precio en pesos, **cifra de dinero → mono tabular** (regla dura 3): `font-mono tnum text-[16px] font-semibold text-ink`, con símbolo `$` (ARS) — ej. `$1.100,00`. **Neutral `--ink`**, **nunca** verde/rojo (regla dura 1: una cotización no es ingreso ni gasto). El `tnum` alinea los cuatro precios a lo alto de las columnas.
- **Valor faltante — "—":** si una cotización no está disponible, la celda **conserva su caja y su rótulo** y el valor se reemplaza por un **em dash** `—` en `font-mono text-[16px] text-faint` (mismo cuerpo, tono apagado). Así la grilla no se descuadra y el hueco se lee como "sin dato" sin alarmar. Opcional: micro-caption `text-[11px] text-faint` "Sin dato" bajo el guion — si el analista lo pide; por defecto basta el `—`.
- **Responsive:** la grilla `grid-cols-2` **se mantiene** hasta el piso: las celdas son cortas y `$1.100,00` entra holgado en una columna de ~180px (el contenido a 640px con sidebar abierto da ~392px → dos columnas de ~185px, sin desborde ni scroll horizontal). No se colapsa a una columna (no hace falta y evita una card muy alta).

### 4. Feedback de resultado — por TOAST (copy sugerido)

La acción "Actualizar datos" no anuncia nada en el botón (que solo muestra su spinner); el resultado va por **toast** (mismo sistema del DS). Tres desenlaces:

- **Éxito con cambios** → `toast.success`: **"Datos actualizados."**
- **Sin novedades (ya al día)** → `toast.info`: **"Ya estás al día. No había datos nuevos."** — usa la variante `info` (no `success`), porque no hubo cambio; comunica "todo bien, nada que traer" sin fingir una actualización.
- **Error** → `toast.error`: **"No se pudieron actualizar los datos. Intentá de nuevo."**

(Copy definitivo a confirmar por el analista; el mapeo de variante — success/info/error — es la recomendación de diseño y no debería cambiar: distingue "traje algo" de "no había nada" de "falló".)

### 5. Estados de la sección entera

- **Carga inicial (skeleton).** Mientras se cargan los datos por primera vez, cada card renderiza su **fantasma** con `SkeletonPill` (mismo recurso que la card de Moneda), bajo `role="status"` `aria-label="Cargando datos externos"`:
  - **Inflación:** en el destacado, los textos de identidad reales pueden estar (eyebrow/rótulos son estáticos) y **la cifra** es una `SkeletonPill` ~80×24; el historial son **3–4 filas** cada una con dos pills (mes ~90×14 izq / variación ~44×14 der). Sin el botón "Ver más" hasta que hay lista.
  - **Cotizaciones:** las 4 celdas presentes con su rótulo real y una `SkeletonPill` ~90×18 en lugar del valor.
  - El botón "Actualizar datos" de la cabecera queda **deshabilitado** durante la carga inicial (no hay nada que refrescar todavía).
- **Error de carga (inline, patrón existente).** Si falla la **carga** de los datos (no la actualización), se usa el **mismo patrón que la card de Moneda**: dentro de la card afectada, texto `mt-3 text-[13px] text-expense-ink`: *"No se pudieron cargar los datos externos. Recargá la página."* Es error de página (recargar), distinto del error de **actualización** (§4, que es toast + reintento). Si falla la carga, la card no muestra destacado/lista/grilla; muestra solo ese mensaje.

### 6. Pie discreto — última actualización + fuentes

Debajo de las dos cards (fuera de ellas, al pie de la sección), una **línea única discreta**: `text-[12px] font-medium text-muted mt-1`, alineada a la izquierda:

- *"Última actualización: {14 jul 2026, 09:32} · Fuentes: INDEC (inflación) · dolarapi (dólar) · frankfurter (euro, real)."*
- Es **cromo terciario** (`--muted`), sin caja, sin ícono: informa procedencia y frescura sin competir con las cifras. La atribución por fuente entre paréntesis deja claro qué dato viene de dónde (transparencia de origen). El formato de fecha/hora exacto lo define el front según el locale del proyecto; la estructura (fecha-hora · fuentes) es la de esta spec.

### 7. Contención responsive (obligatoria)

Umbral único `--bp-wide` (941px). La sección **no introduce ninguna superficie ancha**: todo es filas `justify-between` de contenido corto y una grilla de 2 columnas angostas.

- **Cabecera de sección:** `flex-wrap` → el botón "Actualizar datos" envuelve bajo la identidad en angosto (igual que las demás secciones del hub).
- **Card Inflación:** el destacado es `flex justify-between` con identidad corta + cifra corta (entra a cualquier ancho); las filas del historial son `justify-between` de mes + % (cortísimas); "Ver meses anteriores" es full-width. Nada desborda.
- **Card Cotizaciones:** `grid-cols-2` se sostiene hasta el piso (celdas cortas, `$1.100,00` entra en ~185px); no colapsa a 1 columna.
- **Los cuatro invariantes en este elemento:**
  1. *Sin scroll horizontal ≥640px:* todas las filas son `justify-between` de texto corto y la grilla de cotizaciones es de 2 columnas angostas que caben a ~392px de contenido; nada fuerza scroll del `body`.
  2. *Modales completos:* la sección no abre modales.
  3. *Ninguna acción inalcanzable:* el único control de acción ("Actualizar datos") envuelve bajo la identidad pero queda siempre visible y alcanzable; "Ver meses anteriores" es full-width dentro de la card.
  4. *Superficies anchas scrollean dentro de sí:* no hay superficie ancha (ni tabla ni grilla día×mes); las cards conservan su propia contención vertical.

### 8. Reglas duras reafirmadas

- **Regla dura 1 (verde=ingreso / rojo=gasto):** ni la variación de inflación ni las cotizaciones se tiñen de verde/rojo — son cifras **neutras** (`--ink` / `--ink-2`), pese a que "subió la inflación" o "subió el dólar" tenga connotación. El único rojo de la sección es el **error inline** (`--expense-ink`), que es estado de error, no monto.
- **Regla dura 2 (acento = solo marca/foco):** el índigo aparece **únicamente** como focus ring (botón "Actualizar", "Ver más", tiles focusables). Ningún relleno ni texto de acento.
- **Regla dura 3 (cifra de dinero en mono tabular):** las cotizaciones (`$…`) van en `font-mono tnum`; las variaciones de inflación (`%`), aun no siendo dinero, van en `font-mono tnum` para alinear columnas y por coherencia con la inflación en reportes.

### Checklist de aceptación visual — Datos externos

*Cabecera y botón:*
- [ ] La sección abre con un `h2` "Datos externos" a **18px/700** (mismo nivel que "General"/"Límites") + bajada 13px/500 `--muted`.
- [ ] El botón **"Actualizar datos"** vive a la **derecha** de esa fila, es **secundario** (`outline`: borde neutro, fondo panel, **sin relleno índigo**), con **ícono `RefreshCw` 16px + label**.
- [ ] Al pulsar: el ícono **gira** (`animate-spin`), el label pasa a **"Actualizando…"**, el botón queda atenuado/`disabled`; bajo *reduce-motion* no gira pero **sí** se atenúa.
- [ ] Un solo botón refresca **ambos** bloques; el resultado no se anuncia en el botón sino por **toast**.

*Toasts:*
- [ ] Con cambios → toast **éxito** "Datos actualizados."
- [ ] Sin novedades → toast **info** (no éxito) "Ya estás al día. No había datos nuevos."
- [ ] Falla → toast **error** "No se pudieron actualizar los datos. Intentá de nuevo."

*Card Inflación:*
- [ ] El **destacado** muestra eyebrow "Último dato" + mes (14.5/600 `--ink`) + "Variación mensual", y la variación como **cifra mono tabular ~22px `--ink`** con `%` — **neutra, ni verde ni roja**.
- [ ] El **historial** del año en curso lista mes + variación (13px `--ink-2`, mono tabular en la cifra), más reciente arriba, **sin repetir** el mes del destacado; las filas se separan por hairline.
- [ ] El destacado se lee claramente **por encima** del historial (tamaño 22 vs 13, tono ink vs ink-2).
- [ ] Existe un control **"Ver meses anteriores"** full-width discreto (texto `--ink-2` + `ChevronDown`, hover `panel-2`); al cargar más, muestra spinner y **anexa** meses viejos; cuando no hay más, **desaparece**.
- [ ] Si no hay más datos del año, en vez de lista aparece "Todavía no hay más datos de {año}.".

*Card Cotizaciones:*
- [ ] Grilla **2×2** de celdas recesadas (`panel-2` + borde + `--r-ctl`); rótulos Dólar oficial · Dólar blue · Euro · Real.
- [ ] Cada valor es **mono tabular con `$`** (ej. `$1.100,00`), **neutro `--ink`**, nunca verde/rojo.
- [ ] Un valor faltante muestra **"—"** (`--faint`, mismo cuerpo mono) conservando rótulo y caja; la grilla no se descuadra.
- [ ] A 640px (y ~392px de contenido con sidebar abierto) la grilla **sigue en 2 columnas** sin scroll horizontal.

*Estados de sección y pie:*
- [ ] **Carga inicial:** cada card muestra `SkeletonPill` en lugar de cifras (bajo `role="status"`); el botón "Actualizar datos" queda deshabilitado durante esa carga.
- [ ] **Error de carga:** dentro de la card, texto `--expense-ink` "No se pudieron cargar los datos externos. Recargá la página." (patrón de la card de Moneda) — distinto del toast de error de actualización.
- [ ] **Pie discreto** debajo de las cards: una línea `--muted` 12px con "Última actualización: … · Fuentes: INDEC · dolarapi · frankfurter", con atribución por fuente.

*Reglas duras:*
- [ ] Ninguna cifra (inflación % ni cotizaciones $) usa verde/rojo; el único rojo es el error inline.
- [ ] El índigo aparece **solo** como focus ring (botones y tiles), en ningún relleno ni texto.
- [ ] Cotizaciones y variaciones de inflación van en **mono tabular** (`tnum`).

## Historial de cambios (`/historial`) — lista de entradas, deshacer y bloqueo LIFO

Pantalla nueva (RF-HIST-002/003/004, `screens.md` §11). Es una **pantalla de consulta con una acción**: se lee "qué cambié" y, si hace falta, se deshace. No edita movimientos, no navega al mes, no muestra totales. La lista es **finita y corta por naturaleza** (máx. 5 entradas por movimiento, expiración a 31 días), así que **no se pagina, no se filtra y no se agrupa por día**: se apila cronológicamente, más reciente primero.

> **Se reusa todo lo que ya existe:** el molde de tarjeta-lista de `/mes` (filas separadas por `--hair`), el grid de la fila (`40px 1fr auto`), el patrón de **fila rótulo·valor** de la *Card de detalle de movimiento*, la caja recesada `rounded-ctl border-line bg-panel-2` de la caja de "Origen", el chip neutro del DS, `ModalShell variant="dialog"`, el sistema de **skeletons**, el lenguaje **dashed = vacío** y el ítem de nav del sidebar. **No se introduce ningún token nuevo.**

### 1. Encuadre de pantalla

- **Ancho de contenido:** el mecanismo canónico de las demás pantallas — `px-10 max-w-[1120px] mx-auto`. Sin `PeriodNav`, **sin flechas ‹ ›**, sin stepper: el historial no se recorre por período.
- **Sin `CurrencyChip`:** la pantalla no expone totales (Convenciones de `screens.md`).
- **Cabecera `.phead`** (misma anatomía que Dashboard / `/reportes`), zona derecha **vacía** (no hay acción de pantalla):
  - **Sin eyebrow.** Es la única `.phead` de la app que no lo lleva: acá el H1 ya es una sola palabra inequívoca y la bajada (regla de retención) es información real que el usuario necesita. Un eyebrow encima sería una tercera línea de texto que no agrega nada — ruido sobre el título, jerarquía diluida antes de llegar al dato. *(Decisión cerrada con el usuario; el resto de las pantallas conserva su eyebrow.)*
    > **Colisión con el chip flotante del sidebar — resuelta a nivel app, no acá.** Sin eyebrow, el H1 sube a la primera banda y, con el sidebar cerrado a viewport ≲1200px, el chip "Mostrar menú" le tapaba la "H" ("listorial"). La causa **no** es la falta de eyebrow: es que el chip no tenía banda reservada y cada pantalla se defendía por accidente. Se corrige con la **banda reservada del chip flotante** (§"Sidebar — mostrar/ocultar"), que protege a **toda** pantalla presente y futura sin eyebrow. `/historial` **no** recupera el eyebrow y **no** lleva ningún padding especial propio: usa el mismo `px-10 py-[34px] pb-20` que las demás.
  - **H1** "Historial" — 32px/700 `tracking-[-0.02em]` `--ink`.
  - **Bajada** — 14px `--muted`, `mt-2`: *"Se guardan los últimos 5 cambios de cada movimiento, durante 31 días."* Es la única superficie donde la **regla de retención** se le explica al usuario, y tiene que estar visible **también con datos** (el momento en que aparece la pregunta "¿dónde fue a parar aquel cambio?"). *(Copy — ver §10.)*
  - Bloque con `mb-6`.
- **Cuerpo:** una **única tarjeta-lista** (`bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] overflow-hidden`) con las entradas como filas separadas por `--hair`. **No** una card por entrada: la card-por-entrada infla el scroll y le da a cada evento un peso que no tiene; la tarjeta-lista es el molde que la app ya usa para listas de ítems (`/mes`, categorías, métodos, límites).

### 2. Anatomía de la entrada (régimen amplio)

Grid **`40px 1fr auto`**, `gap-[14px]`, padding `var(--row-pad) 18px` (14/18) — el mismo ritmo que la fila de `/mes`. Divisor `--hair` entre filas.

**Alineación vertical del grid: `items-start` en los DOS regímenes.** Las tres columnas se alinean al **tope de la entrada**, nunca al centro. La fila de `/mes` puede centrar porque tiene una sola banda de alto; acá la col 2 crece con el bloque de cambios (una edición de un campo mide ~70px, una eliminación con 5 campos ~180px), así que centrar **despega el ícono y el momento del nombre** y los deja flotando a la altura del diff — el ojo pierde el ancla de identidad, que es lo primero que se lee. *(Jerarquía visual.)*
- **Col 1 (ícono):** `self-start`. La caja de 40px queda **enmarcando la banda de identidad** (línea de nombre 21px + sublínea ~18px ≈ 39px): sin offsets negativos ni números mágicos, el ícono cubre exactamente lo que titula.
- **Col 3 (momento + acción):** `self-start`. El **momento** lleva la **misma caja de línea que la línea de identidad** (`leading-[21px]` en los dos) para que se lean **al mismo nivel** que el nombre: son las dos mitades de la misma frase ("qué movimiento" ⟷ "cuándo").
- **Col 2:** `self-start` por consecuencia; su contenido ya fluye desde arriba.

**Col 1 — ícono de operación, 40×40.** Misma caja que el ícono de tipo de la fila de `/mes` (mismo tamaño, radio y posición), pero **fill neutro**: `bg-panel-3`, glifo `--ink-2` **18px**, `aria-hidden`.
- **Editado → `Pencil`** · **Eliminado → `Trash2`** (mismos glifos que las acciones "Editar"/"Eliminar" del kebab: un concepto, un glifo).
- **Neutro, nunca rojo.** Rojo es gasto (regla dura 1) y, además, teñir de rojo toda la fila de una eliminación la haría leer como un movimiento de gasto. El eje de esta pantalla es *qué pasó*, no *ingreso/gasto*.
- *Alternativa evaluada y descartada:* usar acá el **ícono de tipo tintado** de `/mes` (↓ gasto / ↑ ingreso). Haría que la fila de historial se leyera como una fila de movimiento —que no lo es— y dejaría la operación (lo más importante) sin ancla visual. El tipo del movimiento se sigue leyendo en el **color de la cifra** del bloque de cambios.

**Col 2 — cuerpo (`min-w-0`), tres bandas:**

1. **Línea de identidad** — `flex items-center gap-[8px] min-w-0 leading-[21px]` (caja de línea explícita: es la referencia de altura para el ícono de la col 1 y el momento de la col 3):
   - **Nombre del movimiento** — rol *Nombre de movimiento* (14.5px/600 `-.01em`), `--ink`, `truncate`, `flex-1 min-w-0`. Es el ancla: el usuario busca *qué* movimiento tocó.
   - **Chip de operación** — chip neutro del DS (`--panel-3` / `--muted` / `--r-chip` 7px / 11px·600·`.04em`), `shrink-0`: **"Editado"** / **"Eliminado"**. Doble codificación deliberada con el ícono (glifo para escanear, palabra para precisión y para no depender solo del ícono).
2. **Sublínea de identidad del movimiento** — 12px, `--muted`, separadores `·` en `--faint`, `truncate`. Reusa exactamente el vocabulario de la sublínea de `/mes`:
   `● {Categoría} · {Estructura} [· ↳ calculado]`
   - **Punto de categoría** 6px (`background: category.color` inline, `aria-hidden`), `gap-[6px]` antes del nombre; **Categoría** en `--ink-2` (eje de identidad).
   - **Estructura** — `Único` / `Fijo` / `Cuotas`, en `--muted`. (`screens.md` §11 lo pide explícito: acá el movimiento no está en su sección, así que la estructura no se infiere del contexto como en `/mes`.)
   - **`↳ calculado`** (solo si el movimiento es calculado) — glifo `CornerDownRight` 12px `--muted` + palabra. **Sin** nombre de origen: el historial no lo tiene garantizado y el segmento largo apretaría la línea.
3. **Bloque "Qué cambió"** — ver §3. `mt-[10px]`.

**Col 3 — momento + acción (`shrink-0`, `text-right`, `flex flex-col items-end gap-[8px]`):**
- **Momento** — `{DD Mmm} · {HH:MM}` (ej. `02 Jun · 14:30`), **mono tabular**, 12.5px `--muted`, `whitespace-nowrap`, `leading-[21px]` (misma caja de línea que la línea de identidad → se leen al mismo nivel). Formatos ya vigentes (el `DD Mmm` de la col 3 de `/mes` y el `HH:MM` de la card de detalle). **Sin año**: la retención es de 31 días, el año nunca discrimina.
  - *Se descartó el tiempo relativo* ("hace 2 h"): obliga a refrescar en cliente, se vuelve ambiguo pasados unos días y pierde el eje de alineación que da el mono tabular.
- **Acción** — botón "Deshacer" o su estado bloqueado (§5).

**Lo que la fila NO tiene:** kebab, link a `/mes`, botón de editar, contador de entradas, indicador de vencimiento. La fila entera **es clickeable** y abre el modal de la entrada (§5) — mismo patrón que la fila de `/mes` abre su card de detalle: `role="button"`, `tabIndex=0`, `Enter`/`Espacio`, `aria-label="Ver cambio de {Nombre}, {DD Mmm HH:MM}"`, `cursor-pointer`, hover `bg-panel-2`. El botón "Deshacer" es un `<button>` hermano con `stopPropagation` (mismo mecanismo que el kebab de `/mes`).

### 3. Bloque "Qué cambió" — el par antes → después

Caja recesada: `rounded-ctl border border-line bg-panel-2 px-[13px] py-[10px]`, `space-y-[8px]` — el mismo molde que la caja read-only de "Origen" del calculado.

**Una fila por campo**, con el patrón **rótulo·valor** de la card de detalle: `flex flex-wrap items-baseline justify-between gap-x-[16px] gap-y-[2px]`.
- **Rótulo del campo** (izq) — rol *Meta*, 12.5px/500 `--muted`, `shrink-0`. Vocabulario **idéntico al de la card de detalle** (ver el set completo y su orden abajo).
- **Par de valores** (der) — `flex flex-wrap items-baseline justify-end gap-x-[8px] gap-y-[2px] min-w-0`:
  - **Valor anterior** — `--muted`.
  - **`→ valor nuevo`** — **una sola unidad indivisible** (`whitespace-nowrap` sobre el conjunto flecha+valor). Flecha `→` en `--faint`; valor nuevo en `--ink`.
  - **Sin `line-through` en el valor anterior.** En Control el tachado ya significa **"anulado / no computa"** (ítem `skipped`); reusarlo acá para "valor viejo" cruzaría dos significados. La distinción la hacen el **tono** (pasado `--muted` / vigente `--ink`) y la flecha.

**Regla del par (transversal):** *izquierda = antes, derecha = después*, siempre en orden temporal. El mismo eje se aplica en el modal (§5), donde "antes" es el estado actual y "después" el estado restaurado.

**Jerarquía — el monto manda:**
- Si el **monto** cambió, su fila es **siempre la primera** del bloque y va en **escala promovida**: ambos valores en **mono tabular 15.5px/600** (rol *Monto en fila*); el resto de los campos en **13px**. Es el dato que el usuario más quiere leer de un vistazo y la escala lo refleja sin sacarlo de la estructura común.
- **La promoción de escala es exclusiva del Monto.** Ningún otro campo numérico (cotización, cantidad de cuotas) sube de 13px: si tres filas gritan, ninguna grita.
- **Se muestran TODOS los campos que cambiaron**, sin cortar ni esconder detrás de un "ver más". El caso realista es **1–3 filas**; el techo teórico (~10, una edición que reescribe el movimiento entero) es exactamente el caso donde esconder algo sería peor. Esconder qué cambió vacía de sentido la pantalla.

#### 3.1 Set de campos y orden fijo *(cerrado con el usuario)*

Se registran **todos los campos editables** del movimiento; el bloque muestra **solo los que cambiaron**. Los campos que no aplican al tipo de movimiento simplemente no existen para esa entrada.

**Orden fijo, único para toda la pantalla** — `Monto → Fórmula → Moneda → Cotización → Tipo → Categoría → Descripción → Fecha → Mes de inicio → Cuotas → Método de pago → Débito automático`.

| # | Rótulo | Aplica a | Presentación del par |
|---|---|---|---|
| 1 | `Monto` | los tres tipos | cifra mono tabular **15.5/600**, con signo y símbolo; nuevo con **color por tipo** |
| 2 | `Fórmula` | calculados | expresión completa en **una sola fila** (§3.2 a) |
| 3 | `Moneda` | los tres tipos | **código en mayúsculas**, texto plano (`ARS → USD`) |
| 4 | `Cotización` | los tres tipos | numérico mono tabular (§3.2 b) |
| 5 | `Tipo` | únicos | palabra `Gasto` / `Ingreso`, **sin tintar** (§3.2 e) |
| 6 | `Categoría` | los tres tipos | punto de color 6px + nombre, texto (trunca) |
| 7 | `Descripción` | los tres tipos | texto plano (trunca) |
| 8 | `Fecha` | únicos | **fecha y hora juntas**, mono (§3.2 f) |
| 9 | `Mes de inicio` | fijos y cuotas | `formatMonthShort` (`Mar 2024`), mono tabular |
| 10 | `Cuotas` | cuotas | cantidad, mono, unidad una sola vez (§3.2 c) |
| 11 | `Método de pago` | los tres tipos | nombre del método, texto (trunca) |
| 12 | `Débito automático` | los tres tipos | **verbo de transición, sin par** (§3.2 d) |

**Por qué este orden — cuatro bandas, no una lista arbitraria:**
1. **Dinero (1–4):** *cuánto* y en qué marco monetario. La fórmula va inmediatamente después del monto porque en un calculado **es** su monto (la regla que produce la cifra); moneda y cotización son el marco de conversión de esa misma cifra y se leen como par contiguo — ver una moneda nueva sin la cotización al lado obliga a saltear filas.
2. **Naturaleza e identidad (5–7):** `Tipo` encabeza la banda porque es el cambio más profundo (invierte el signo del movimiento); después categoría y descripción, que son *cómo lo llamo*.
3. **Cuándo y estructura (8–10):** fecha, mes de inicio y cantidad de cuotas. Son mutuamente excluyentes casi siempre (un único no tiene mes de inicio; un fijo no tiene fecha), así que en la práctica ocupan **una sola fila** de esta banda.
4. **Cromo de pago (11–12):** método y débito automático — lo último que se pregunta y lo que menos discrimina una entrada de otra.

Un orden fijo (y no "el orden en que cambiaron") hace que dos entradas distintas se **escaneen igual**: el ojo aprende una vez dónde mira. *(Carga cognitiva + consistencia.)*

**Significancia — `Moneda` y `Cotización` no se emiten cuando no informan nada** *(decisión cerrada con el usuario)*. Son los dos únicos campos del set que el sistema puede tocar **sin que el usuario los haya tocado** (el formulario normaliza la cotización al guardar) o que repiten un default silencioso. Mostrarlos igual produce ruido que el usuario lee como "yo no cambié eso" y le quita credibilidad a todo el bloque: si una fila miente, el historial entero se vuelve sospechoso. *(Carga cognitiva + confianza en el dato.)*

> **La decisión es del backend, no del frontend.** El backend es quien **emite** los campos de la entrada; el frontend renderiza lo que llega y **no filtra nada**. Un filtro en el cliente duplicaría la regla y las dos copias se desincronizarían.

**Vocabulario (contrato con el modelo).** Cada movimiento guarda `currency` (su moneda) y `anchorCurrency` (la moneda default del usuario **al momento de guardar**, que es la moneda de referencia de su `exchangeRate` — ver `data-model` / `schema.prisma`). Se define:

> **conversión real de un estado** ⇔ `estado.currency !== estado.anchorCurrency`.

Si los dos coinciden, `exchangeRate` es un artefacto interno (vale 1, o lo que haya quedado de la normalización del formulario) y **no es información para el usuario**.

**Regla de emisión — `Cotización`:**
- **Diff de edición:** se emite ⇔ `conversiónReal(antes) || conversiónReal(después)` **Y** (`exchangeRate` cambió **o** `currency` cambió).
- **Estado de eliminación (§3.3):** se emite ⇔ `conversiónReal(estado eliminado)`.
- Casos de borde, resueltos por la misma regla:
  - Movimiento ARS con ancla ARS y el form normaliza `1.450,00 → 1,00`: ningún lado tiene conversión real ⇒ **se omite** (es el ruido reportado en QA).
  - **La moneda cambió** (ej. `ARS → USD`, o `USD → ARS`): al menos un lado tiene conversión real ⇒ **se emite siempre**, aunque el número sea idéntico en los dos lados. Cuando cambia la moneda, la cotización es *la* información que explica en qué quedó convertido el monto; omitirla dejaría el cambio a medio contar.

**Regla de emisión — `Moneda`:**
- **Diff de edición:** se emite ⇔ `currency` cambió. **Sin excepción**, incluso si el destino es la moneda default: acá el cambio **es** la información.
- **Estado de eliminación (§3.3):** se **omite** ⇔ `currency === anchorCurrency` **Y** `currency === defaultCurrency vigente del usuario`. En cualquier otro caso se emite.
  - La primera condición es la del usuario ("coincide con su moneda default"), resuelta contra el campo estable del propio movimiento; la segunda evita el hueco de que el usuario haya cambiado su default después: un movimiento en USD borrado por alguien que hoy opera en ARS **sí** tiene que decir `Moneda USD`.
  - Caso reportado en QA: movimiento ARS, ancla ARS, default ARS ⇒ **se omite**.

#### 3.2 Presentación de los campos que no son texto plano

**a) `Fórmula` — una sola fila, no tres.** Aunque la fórmula se compone de **operador, operando y signo**, se muestra como **una expresión única**: `−10% del origen → +15% del origen`.
- **Por qué una y no tres filas:** el usuario no editó "un operador", editó *la regla de cálculo*. Tres filas (`Operador`, `Operando`, `Signo`) lo obligarían a recomponer mentalmente el cálculo a partir de partes sueltas, triplicarían el peso visual de un solo cambio conceptual y dejarían filas como `Signo: + → −` que fuera de contexto no significan nada. *(Carga cognitiva.)*
- **Cómo se arma:** se reusa el **builder de expresión legible del form de calculado**, en su **forma abstracta** — la misma que la card de detalle usa cuando `sourceAmountCents === null` (operador + operando + signo, **sin** la cifra del origen). El historial no tiene garantizado el monto del origen, y meterlo haría que la expresión cambiara sola con el tiempo.
- **Tipografía:** la expresión completa en **mono tabular** 13px (lleva número); el par entero (`anterior → nuevo`) sigue la regla de tono de §3, y `→ {expresión nueva}` es la unidad indivisible.
- **El signo viaja dentro de la expresión, no en una fila `Tipo`.** En un calculado el tipo es **derivado** (lo determina el signo de la fórmula), así que no se abre una fila `Tipo`: sería el mismo cambio contado dos veces.

**b) `Cotización` — numérico, mono, nunca coloreado.**
- **Valor:** el mismo formateo de cotización vigente en la card de Moneda de Configuración, **mono tabular** 13px (regla dura 3: es cifra monetaria). Sin repetir el par de monedas en cada lado (el rótulo ya dice `Cotización`): `1.180,50 → 1.245,00`.
- **Los dos lados se formatean con la misma cantidad de decimales** (la del formateador vigente). Un par con distinta cantidad de decimales de cada lado se compara mal a ojo, que es justamente para lo que sirve el mono tabular.
- **Nunca verde ni rojo.** Una cotización no es ingreso ni gasto (regla dura 1); subir o bajar no es "bueno" ni "malo". Tono estándar del par: anterior `--muted`, nuevo `--ink`.
- **La fila puede no existir.** `Cotización` solo se emite cuando hay **conversión real** en alguno de los dos lados (regla de emisión completa en §3.1). Un movimiento en su moneda ancla **no muestra esta fila aunque el número haya cambiado**; si la **moneda cambió**, la fila **siempre** aparece.

**c) `Cuotas` — cantidad con la unidad una sola vez.** El par se lee `6 → 12 cuotas`: números en **mono tabular** 13px y la palabra **"cuotas" solo en el valor nuevo**, dentro de la unidad indivisible `→ 12 cuotas`.
- **Por qué no `6 cuotas → 12 cuotas`:** repetir el sustantivo en una fila cortísima duplica texto sin agregar información y estira el par justo donde el ancho escasea. La unidad se lee una vez y gobierna los dos lados.
- **Singular:** `1 → 3 cuotas`; si el valor nuevo es 1, `12 → 1 cuota`.
- **No se agrega una fila derivada de "total del plan"** aunque cambiar la cantidad lo cambie: el historial muestra **lo que se editó**, no sus consecuencias calculadas. *(Sería alcance nuevo.)*

**d) `Débito automático` — booleano: verbo de transición, sin par.** Es el único campo que **rompe el patrón del par**, deliberadamente. La fila muestra un **único valor en la columna del "nuevo"** (`--ink`), con el verbo: **"Se activó"** / **"Se desactivó"**.
- **Por qué no `No → Sí`:** un booleano tiene un solo bit de información y el par lo dice dos veces —el lado izquierdo es siempre el complemento del derecho—, así que la mitad de la fila es ruido. Peor: `No → Sí` obliga a leer dos tokens ambiguos y traducirlos ("¿sí a qué?"), mientras que "Se activó" se entiende sin volver al rótulo. *(Carga cognitiva + claridad.)*
- **La estructura no se rompe visualmente:** misma fila rótulo·valor, mismo grid, valor alineado a la derecha en `--ink` — ocupa la posición del "nuevo", que es exactamente lo que es. Lo único que falta es el segmento `anterior →`, y su ausencia no genera duda porque el verbo ya declara la dirección.
- **En el modal** (dirección de deshacer) el verbo se invierte y va en **presente**: si la entrada dice "Se activó", el modal dice **"Se desactiva"** (y viceversa). Misma regla que el resto del bloque: *lo que se muestra es el estado que queda*.
- **En modo de valor único** (eliminación, §3.3) no hubo transición: se muestra el estado, **"Activado"** / **"Desactivado"**, y la fila **se omite si estaba desactivado** (igual que en la card de detalle, donde `autoDebit === false` no se renderiza: su ausencia no es informativa).

**e) `Tipo` — palabra, sin tintar. Solo en movimientos únicos.** La fila existe **exclusivamente** para entradas de un movimiento **único**: es el único tipo cuyo `tipo` es editable (RF-MU-002). Un **fijo** no puede cambiar de tipo (RF-MF-003 — solo monto, categoría y descripción), y en un **calculado** el tipo es derivado del signo de la fórmula, que ya viaja dentro de la expresión (§3.2 a). En esos dos casos la fila `Tipo` no existe para ninguna entrada.

Valores `Gasto` / `Ingreso` como texto plano, con el tono estándar del par (anterior `--muted`, nuevo `--ink`). **No se tiñe la palabra** de verde ni de rojo: el color semántico en Control vive en la **cifra**, no en etiquetas de texto, y pintar dos palabras contiguas con los dos colores del sistema convertiría la fila en un semáforo ilegible. El impacto real del cambio ya se ve en la fila `Monto` (que en ese caso cambia de color y de signo aunque el número sea el mismo) — y por eso, **si cambió el tipo, la fila `Monto` se muestra siempre**, aunque la magnitud no haya cambiado: es la única forma de ver el efecto real de la edición.

**f) `Fecha` — fecha y hora son un solo campo.** Una fila, formato de la card de detalle: `02/06/2026 · 14:30`, **mono tabular**. Si solo cambió la hora, igual se muestran los dos lados completos. Partirlo en `Fecha` + `Hora` obligaría a leer dos filas para reconstruir **un solo instante**, y produciría el caso absurdo de una fila `Fecha` con los dos lados idénticos.

**Color del dinero:** el valor **nuevo** de una cifra de dinero lleva el color por tipo vigente en la app (**gasto `--ink` / ingreso `--income-ink`**, con su signo y símbolo); el valor **anterior** va `--muted` (es pasado, no manda). Toda cifra en **mono tabular** (regla dura 3). Las cifras **no monetarias** (cotización, cantidad de cuotas) van en mono tabular pero **sin color por tipo**.

#### 3.3 Entrada de eliminación (sin "después")

El mismo bloque, en **modo de valor único** — mismas filas rótulo·valor, **sin flecha y sin segundo valor**, con el valor en `--ink-2` (y las cifras de dinero con su color por tipo). Rótulo del bloque: una línea *Meta* 12.5/500 `--muted` arriba, **"Se eliminó:"**.
- Campos mostrados = los del movimiento tal como estaba, **en el mismo orden fijo de §3.1**, omitiendo los que no aplican al tipo, los opcionales sin valor (`Método de pago` sin método, `Débito automático` desactivado) y los **no significativos** según la regla de emisión de §3.1:
  - **`Cotización`** se omite si el movimiento **no tenía conversión real** (`currency === anchorCurrency`).
  - **`Moneda`** se omite si `currency === anchorCurrency` **y** `currency === defaultCurrency vigente`. *(Una ficha de eliminación que dice `Moneda ARS` a un usuario que opera en ARS gasta una fila en decirle lo que ya sabe.)*
  - Las dos omisiones las decide el **backend** al emitir la entrada; el frontend no filtra.
- El booleano usa la palabra de estado (`Activado`), no el verbo de transición (§3.2 d).
- **`Tipo` no se lista** *(decisión cerrada)*. En este bloque no hay transición: la ficha describe el movimiento tal como estaba, y ahí el tipo **ya se lee en la fila `Monto`** —siempre presente, siempre primera— por su **signo** (`−` / `+`) y su **color por tipo**. Una fila `Gasto` debajo de `− $12.500,00` repite el mismo bit con otras palabras y alarga la ficha justo donde queremos un vistazo. Es el mismo criterio con el que §3.3 omite `Método de pago` sin método o `Débito automático` desactivado: lo que no agrega información no ocupa una fila. *(Carga cognitiva.)*
  - **No viola "no depender solo del color":** el tipo va doblemente codificado sin recurrir a él — el **signo** de la cifra lo declara por sí solo, y es el mismo par signo+color con el que el usuario lee montos en toda la app. *(Consistencia + accesibilidad.)*
  - **Sí sigue existiendo como fila en las entradas de edición** (§3.2 e, solo únicos), donde hay un antes y un después reales y el par sí aporta.

### 4. Estados de la entrada

| Estado | Contenido | Acción (col 3) | Fila |
|---|---|---|---|
| **Deshacible** (la más reciente de su movimiento) | opacidad plena | botón **"Deshacer"** | hover `bg-panel-2`, clickeable |
| **Bloqueada** (hay posteriores) | **opacidad plena** | botón **activo** `Lock` + **"Bloqueado"** + **motivo visible** | hover `bg-panel-2`, clickeable → modal de cadena |
| **Deshaciendo** | `opacity-[0.55]`, `pointer-events-none` | botón en carga | no clickeable |

- **La entrada bloqueada NO se atenúa.** Su contenido es exactamente igual de informativo que el de una deshacible —el usuario entró a *leer* qué cambió— y atenuar lo que hay que leer es un error de jerarquía. Lo que está condicionado es **la acción**, no el dato. (Se descartó el `opacity-[0.55]` del ítem anulado justamente por eso: ahí el atenuado significa "no computa"; acá el cambio sí ocurrió y sí importa.)
- **El botón de la entrada bloqueada está ACTIVO** *(decisión cerrada con el usuario)*: mismo `Button variant="outline" size="sm"`, glifo **`Lock` 15px** + label **"Bloqueado"**, **sin `disabled`**, y **abre el modal de cadena** (§6). No es un control muerto: es la puerta a la única salida que existe.
  - **Por qué no `disabled`:** un botón muerto **al lado de una fila que sí es clickeable** es una contradicción de affordance — el usuario ve dos superficies con la misma apariencia de acción, una responde y la otra no, y la que no responde es justo la que nombra lo que quiere hacer. Además un `disabled` sin explicación alcanzable es un callejón: el estado bloqueado **tiene** salida (deshacer la cadena), así que el control tiene que llevar ahí. *(Affordance + flujo, sin callejones.)*
  - **El label cambia con el estado, no solo el ícono:** "Deshacer" ↔ "Bloqueado". Doble codificación (glifo `Undo2`/`Lock` + palabra), sin depender solo del ícono ni solo del color. Que el rótulo *no* diga "Deshacer" es lo que evita el disparo accidental: el usuario que lo toca ya sabe que va a pasar otra cosa.
  - **Sigue siendo `outline`, no primario:** es la misma jerarquía de acción secundaria de la fila; lo que cambia es a dónde lleva.
- **Motivo del bloqueo, visible en la lista** (RF-HIST-004): línea bajo el botón, `text-right`, **12px `--muted`**, `whitespace-nowrap`:
  - `N ≥ 2` → **"Hay {N} cambios posteriores"**
  - `N = 1` → **"Hay 1 cambio posterior"** — acá el numeral **se conserva** en singular: la línea es una **lectura de conteo**, se escanea en columna junto a otras entradas y el número es la información. (Regla general de conteo: §6.)
  
  Va asociada al botón por `aria-describedby` — el motivo se enuncia **en la lista**, sin obligar a abrir el modal para entender por qué no se puede.
- **Dos caminos, un mismo destino.** Tanto el cuerpo de la fila como el botón "Bloqueado" abren **el mismo modal de cadena** (§6): una sola forma de "entrar" a una entrada, idéntica en los dos estados. La fila conserva `cursor-pointer` y hover también bloqueada. El botón es `<button>` hermano con `stopPropagation` para no disparar doble apertura.
- **Deshaciendo:** el estado de carga **vive en el footer del modal** (botón primario "Deshaciendo…", `disabled`); la(s) fila(s) afectada(s) por debajo van a `opacity-[0.55]` + `pointer-events-none`. Al terminar: el modal cierra, **toast de éxito**, y la(s) fila(s) **desaparecen con fade + colapso de alto de 0.22s ease-out** (instantáneo con `prefers-reduced-motion`). Sin la salida animada, una fila que se evapora deja al usuario sin confirmación de *qué* se fue — sobre todo en el deshacer en cadena, donde se van varias.

### 5. La acción Deshacer y su confirmación

**Tono: restaurativa, no destructiva.** Deshacer **devuelve** datos; lo único que destruye es el propio registro del cambio. Por eso **no usa rojo en ningún lado** (`variant="destructive"` queda reservado a Eliminar). Mismo criterio ya cerrado para "Guardar igual" del aviso de límites: el primario índigo es cromo de interacción legítimo y comunica "esto no es destrucción".

**Botón de la fila** — `Button variant="outline" size="sm"`, `min-h-[36px]`, `whitespace-nowrap`. **Dos rótulos, un solo molde:**
- Entrada deshacible → glifo **`Undo2` 15px** + **"Deshacer"** → abre el modal de deshacer (§5).
- Entrada bloqueada → glifo **`Lock` 15px** + **"Bloqueado"** → abre el modal de cadena (§6). **Activo, no `disabled`** (§4).
- **Siempre visible**, nunca revelado por hover: es la razón de ser de la pantalla y un control hover-only sería inalcanzable por touch.
- **Secundario, no primario:** la mayoría de las visitas son de consulta. El contenido (qué cambió) domina la fila; la acción es un blanco estable y discreto a la derecha.
- **Nunca acciona directo:** siempre abre el modal (RF-HIST-003 exige confirmación). Eso también resuelve el riesgo de disparo accidental sin agregar fricción de doble clic.
- Estados: hover/active/focus del `Button` del DS (anillo `--accent-soft` 3px).

**Modal de deshacer** — `ModalShell variant="dialog"` (`max-w-[440px]`), cierre con **✕ y `Esc`** (es un modal de decisión: el clic en el scrim **no** cierra).

- **Título:** "Deshacer cambio".
- **Cuerpo** (`space-y-[14px]`):
  1. **Frase de encuadre** — 14px `--ink`: *"Se va a restaurar **{Nombre}** al estado que tenía antes de este cambio."*
  2. **Caja de identidad** — `rounded-ctl border border-line bg-panel-2 px-4 py-3` (molde exacto de la caja del diálogo de eliminar): nombre 13px/600 `--ink` + sublínea 12px `--muted` `● Categoría · {Estructura} · {DD Mmm · HH:MM}`.
  3. **Bloque "Al deshacer"** — **el mismo bloque de §3, en dirección de deshacer**. Rótulo del bloque (*Meta* 12.5/500 `--muted`): **"Al deshacer queda así:"**. Cada fila: `{valor actual} → {valor restaurado}`, con el **restaurado en `--ink`** (es el que va a mandar) y el actual en `--muted`.
     > **Ojo, es el espejo de la fila.** En la lista el par va `antes → después` (pasado → presente); en el modal va `actual → restaurado` (presente → futuro). **La flecha siempre apunta al estado que queda**, así que la regla es una sola y no hay que aprender dos. Implementar el bloque del modal reusando el de la fila **sin invertir el par sería un bug**: le diría al usuario que el cambio va a volver a aplicarse.
     - En una **eliminación**, el bloque va en modo de valor único con el rótulo **"Vuelve a la app:"** y el resumen del movimiento.
  4. **Nota de consecuencia** — 12.5px `--muted`: *"Esta entrada se borra del historial."* Muted, **no** callout ámbar: es la consecuencia esperada de la acción pedida, no una advertencia sobre un efecto colateral (ámbar está reservado a eso, ver *Aviso de alerta activa de límites*).
- **Footer:** `Cancelar` (`variant="ghost" size="sm"`) + **`Deshacer`** (`variant="default" size="sm"`, primario índigo; en carga **"Deshaciendo…"** + `disabled`).

### 6. Modal de entrada bloqueada — desbloqueo en cadena

Mismo `ModalShell variant="dialog"`. Es el **único** camino para deshacer una entrada bloqueada, y se abre por **dos vías equivalentes**: el cuerpo de la fila o el botón **"Bloqueado"** (§4).

- **Título:** "Hay cambios posteriores" — nombra la situación, no la niega. ("No se puede deshacer" sería un callejón; acá **sí** hay salida.)
- **Cuerpo** (`space-y-[14px]`):
  1. **Callout explicativo neutro** — `rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px]`, glifo **`Info` 16px `--ink-2`** + texto 13px `--ink-2`. **Dos frases escritas aparte, no una plantilla con `{N}`:**
     - `N ≥ 2` → *"Este no es el cambio más reciente de **{Nombre}**. Para deshacerlo hay que deshacer antes los **{N}** cambios posteriores."*
     - `N = 1` → *"Este no es el cambio más reciente de **{Nombre}**. Para deshacerlo hay que deshacer antes **el cambio posterior**."* — **sin numeral**: en prosa corrida el artículo ya dice que es uno, y "los **1** cambios posteriores" es un error de concordancia que el usuario lee como bug (lo fue: QA visual).
     - **Regla de conteo (transversal a la pantalla):** *ningún plural se compone concatenando el numeral con el sustantivo en plural.* Cada superficie escribe su frase de singular aparte. **En prosa** el singular usa artículo y no numeral; **en una línea de conteo** (el motivo de bloqueo de §4) el numeral se conserva, porque ahí el número **es** el dato. Alcanza también al footer y al toast de esta sección.
     - **Neutro, no ámbar y no rojo.** No es una advertencia sobre un efecto peligroso ni un error: es el orden de la pila. Ámbar quedaría desproporcionado y erosionaría su significado de "prestá atención" (ver *Tono y severidad — una sola familia ámbar*).
  2. **Lista de los cambios que se van a deshacer** — rótulo *Meta* 12.5/500 `--muted`: **"Se van a deshacer, en este orden:"**. Filas compactas separadas por `--hair`, **de la más reciente a la más antigua** (el orden real de ejecución), y **la entrada abierta al final, marcada**:
     - Cada fila — `flex flex-wrap items-center gap-x-[8px] gap-y-[2px]`, `px-[10px] py-[8px]`, 12px: `[glifo de operación 14px --muted] {DD Mmm · HH:MM, mono --muted} · {chip de operación} · {resumen de la entrada}`.
     - **Resumen de la entrada — un solo valor, nunca el par.** Se lee `{Rótulo}: {valor resultante}` (`Monto: −$350.000,00`): el valor **que queda después** del cambio; en una eliminación, el valor que el movimiento tenía. **No** se muestra `anterior → nuevo`.
       - **Por qué:** esta lista responde *cuáles se van a deshacer*, no *qué cambió en cada una* — para eso está la entrada en la lista, con su bloque completo. El par duplica el ancho del segmento más largo de la fila y fue la causa directa de que las cifras salieran cortadas en QA (`Monto: −$325.000,…`). *(Carga cognitiva + regla dura de cifras.)*
       - **Campo elegido:** el de **`Monto`** si participa del cambio; si no, el **primero del orden fijo de §3.1** que participe.
       - **El rótulo no se omite.** Sin `Monto:` / `Categoría:`, una cifra suelta al lado del momento se lee como parte de la fecha.
     - **Prioridad de contención de la fila (ninguna cifra se corta jamás — regla dura 3 y §9):**
       1. **Nunca ceden:** glifo, momento, chip de operación y el marcador `(esta)` — todos `shrink-0`.
       2. **La cifra del resumen es indivisible:** `whitespace-nowrap`, no truncable. Alcanza a `Monto`, `Cotización`, `Cuotas`, `Fecha`, `Mes de inicio` y la expresión de `Fórmula`.
       3. **Si el resumen no entra, baja entero a una segunda línea** de la misma fila (`flex-wrap`); momento y chip se quedan arriba. Es el mismo mecanismo de wrap del par de §9 — no hay modo compacto aparte, y la fila crece de alto antes que mentir un número.
       4. **Solo truncan los valores de texto** (`Descripción`, `Categoría`, `Método de pago`, `Moneda`, `Tipo`, `Débito automático`) con `min-w-0` + elipsis: un texto cortado sigue identificando la entrada, un número cortado es un dato falso.
     - La **entrada abierta** cierra la lista con fondo `--panel-3` y el rótulo `(esta)` en `--faint`, para que se vea que el total incluye la que se está mirando.
     - Máximo real: **5 filas** (tope de retención por movimiento). No hace falta truncar ni scrollear.
     - *(Agregado más allá de lo pedido por RF-HIST-004 — **confirmado por el usuario**, ver §10.)*
  3. **Nota de consecuencia** — 12.5px `--muted`: *"Todas se borran del historial."*
- **Footer:** `Cancelar` (ghost) + **`Deshacer los {N+1} cambios`** (primario índigo; carga: "Deshaciendo…"). El número es el **total real** (los posteriores + esta), no los N posteriores: el botón dice exactamente lo que va a pasar. Una entrada bloqueada tiene **al menos un posterior**, así que el total es siempre ≥ 2 y el plural es correcto por construcción; el singular defensivo, si alguna vez se diera, es **"Deshacer el cambio"** (nunca "los 1 cambios").
- **Al confirmar:** las N+1 filas de la lista van a `opacity-[0.55]` y salen juntas con el fade+colapso de §4. **Toast de éxito** con el conteo: **"{N} cambios deshechos."** / singular **"Cambio deshecho."** (misma regla de conteo: el singular tiene su propia frase, sin numeral).

### 7. Vacío, carga y error

**Vacío (el caso más común).** Reusa el lenguaje **dashed = acá todavía no hay nada** (sección vacía del acordeón, recuadro `[+]` de reportes). En lugar de la tarjeta-lista: caja `rounded-card border border-dashed border-line bg-panel-2`, `px-6 py-10`, contenido centrado en columna, `gap-[10px]`:
- **Círculo `--panel-3` de 48px** con glifo **`History` 22px `--muted`** — el mismo ancla visual del gate: declara "esto está bien así, no está roto".
- **Título** 14.5px/600 `--ink`: *"Todavía no hay cambios registrados."*
- **Línea de apoyo** 13px `--muted`, `max-w-[42ch]`, centrada: *"Cuando edites o elimines un movimiento, el cambio aparece acá y lo vas a poder deshacer."*
- **Sin CTA.** Mandar al usuario a `/mes` "a editar algo" para llenar esta pantalla sería absurdo: el vacío es el estado sano.
- La retención **no se repite acá** (ya vive en la bajada de la cabecera, siempre visible).

**Carga.** Sistema de skeletons vigente, sin `animate-pulse` inline.
- **Chrome estable presente e inerte:** la `.phead` completa (H1 + bajada, sin eyebrow) y la tarjeta-lista (`bg-panel border-line rounded-card shadow-sm overflow-hidden`) se renderizan reales.
- **Contenedor** `role="status"` `aria-label="Cargando historial"`; placeholders `aria-hidden`.
- **5 filas fantasma** replicando el grid real (`40px 1fr auto`, padding 14/18, divisor `--hair`):
  - Col 1: **`SkeletonBlock` 40×40 radio `--r-ctl`** (no `SkeletonCircle`: el ícono real es una caja con radio, no un círculo).
  - Col 2: `SkeletonLine` alto **14.5px** ancho ~45% (nombre) + `SkeletonPill` 60×16 (chip de operación) en la misma línea → `SkeletonLine` alto **12px** ancho ~32% (sublínea) → `SkeletonBlock` radio **`--r-ctl`**, alto **44px**, ancho 100% (el bloque de cambios; 44px ≈ dos filas de campo, el alto medio).
  - Col 3: `SkeletonLine` alto 12.5px ancho **80px** + `SkeletonBlock` radio `--r-ctl` **104×36** (el botón).
- **Solo en carga inicial**; un refetch con dato en pantalla no vuelve a skeleton.

**Error.**
- **Falla la carga de la lista** — patrón inline vigente (card de Moneda / Datos externos): dentro del área de lista, texto 13px `--expense-ink`: *"No se pudo cargar el historial. Recargá la página."* Sin skeleton ni lista vacía debajo.
- **Falla el deshacer** — `toast.error`: *"No se pudo deshacer el cambio. Intentá de nuevo."* El **modal queda abierto** y el botón vuelve a su estado normal (a diferencia del diálogo de eliminar, que cierra): el usuario puede reintentar sin volver a buscar la entrada. Nada se restaura a medias, así que la lista no cambia.

### 8. Ítem del sidebar

- **Ícono: `History`** (lucide), **18px**, mismo molde que los demás links (`opacity-70` inactivo / `opacity-100` activo).
  - *Descartados:* `Undo2` (nombra la acción, no el lugar — la pantalla es una lista, no un botón), `RotateCcw` (colisiona con el `RefreshCw` de "refrescar reporte": dos flechas circulares con significados distintos), `Clock` (genérico, dice "hora" y no "registro de cambios").
- **Rótulo:** "Historial".
- **Posición: cuarta**, entre Reportes y Configuración. Orden final: `Dashboard · Vista del mes · Reportes · Historial · Configuración`. **Configuración es chrome de administración y cierra la lista por convención**; Historial es una superficie operativa, hermana de Reportes.
- **Activo:** `bg-accent-soft text-accent-ink font-semibold` + `aria-current="page"`, match por prefijo (`/historial`). Sin cambios al patrón.

### 9. Contención responsive (obligatoria)

**El punto de riesgo es el par `antes → después`**, que se angosta mal. La solución es la misma familia que ya usa la card de detalle: **wrap, nunca truncado de cifra**.

**Régimen amplio (ancho de contenido `≥ --bp-wide`).** El grid `40px 1fr auto` descrito en §2.

**Régimen compacto (`< --bp-wide`, medido por container query sobre `<main>`).** La entrada **colapsa a stack de una columna** (mismo criterio que las grillas de resumen): 
1. Fila superior: `[ícono 40×40] [nombre + chip de operación]`.
2. **Sublínea**, con el **momento como último segmento**: `● Categoría · {Estructura} · {DD Mmm · HH:MM}` (mono solo en el momento).
3. **Bloque "Qué cambió"** a ancho completo — gana todo el ancho de la fila, que es exactamente lo que necesita.
4. **Botón "Deshacer"** en su propia fila, **alineado a la derecha**, `mt-[10px]` (y, si está bloqueado, el motivo a su izquierda en la misma fila).
Así la acción nunca queda apretada ni inalcanzable, y el par de valores no compite por ancho con la columna de acción.

**Comportamiento del par al angostarse (los dos regímenes):**
- La fila de campo es `flex-wrap`: si el par no entra al lado del rótulo, **el par baja a su propia línea** (patrón de la card de detalle).
- Dentro del par, `→ {valor nuevo}` es **una unidad indivisible**: cuando no entra, envuelve entero y la segunda línea se lee `→ $12.500,00`. **El apilado vertical del par sale gratis del wrap** — no hace falta un modo compacto aparte.
- **Ninguna cifra se trunca jamás** (regla dura). Alcanza a **monto, cotización, cantidad de cuotas, fecha/hora, mes de inicio y la expresión de `Fórmula`**: todas envuelven enteras, nunca con elipsis. Los valores de **texto** (Descripción, Categoría, Método de pago, Moneda, Tipo) sí truncan con `min-w-0` + elipsis: un "antes" truncado sigue siendo informativo, un número truncado es un dato falso.
- **La fila `Débito automático`** (valor único, §3.2 d) es la más corta del bloque y nunca necesita envolver.
- **La lista del modal de cadena** (§6.2) tiene su propia contención —resumen de **un solo valor**, cifra indivisible, wrap a segunda línea— porque ahí el ancho útil es fijo (`max-w-[440px]` menos padding) y no depende del viewport. Misma regla dura: **ninguna cifra trunca, nunca**.

**Los cuatro invariantes en este elemento:**
1. *Sin scroll horizontal del `body` (≥640px, sidebar abierto o cerrado):* la fila no tiene ancho mínimo rígido — col 2 es `min-w-0` con truncado y el bloque de cambios envuelve. En compacto la acción sale de la fila y deja de presionar el ancho. A 392px de contenido (piso con sidebar abierto) la entrada se lee apilada, sin barra horizontal.
2. *Modales completos y scrolleables:* los dos modales son `ModalShell variant="dialog"` — `max-h: calc(100dvh − 48px)` en `dvh`, cuerpo scrolleable, footer pineado, body-lock, clipping al radio 18px. El **modal de cadena es el más alto** (callout + hasta 5 filas + nota): es el caso que hay que verificar en viewport bajo — el footer con "Deshacer los N cambios" debe quedar pineado y visible.
3. *Ninguna acción inalcanzable:* el botón de la fila ("Deshacer" o "Bloqueado", **los dos activos**) está siempre visible (nunca hover-only); en compacto ocupa su propia fila. La fila entera es una superficie de activación grande (≥44px de alto real), lo que da un target holgado también en touch.
4. *Superficies anchas scrollean dentro de sí:* **no aplica** — el historial no es una tabla ancha de columnas fijas (es una lista vertical, como `limits-tab`). Su contención es **truncado + wrap**; forzar un carril de scroll horizontal acá sería inventar un problema.

### 10. Agregados más allá del brief — estado

Elementos que esta spec introduce y que **no** estaban en `screens.md` §11 ni en los RF-HIST-*. Todos son de **copy o de transparencia**, ninguno agrega acción ni dato nuevo:

1. **Bajada de la cabecera** con la regla de retención ("Se guardan los últimos 5 cambios de cada movimiento, durante 31 días."). Sin ella, la desaparición silenciosa de entradas es inexplicable para el usuario. **CONFIRMADO por el usuario — se mantiene.** El copy exacto sigue siendo del analista.
2. **Lista de los cambios que se van a deshacer** en el modal de cadena (§6.2). RF-HIST-004 solo exige informar **cuántos** son. Mostrar cuáles es prevención de error pura: deshacer hasta 5 cambios a ciegas es la operación más riesgosa de la pantalla. **CONFIRMADO por el usuario — se mantiene.**
3. **Copy sugerido** (títulos de modal, rótulos de bloque, notas de consecuencia, toasts de éxito/error). Propuesto acá para que el frontend no invente; el texto final lo fija el analista.
4. **Botón "Bloqueado" activo** en vez de deshabilitado (§4). **CONFIRMADO por el usuario**; la CA de RF-HIST-004 ("deshabilitadas") se reformula del lado del analista. La restricción funcional no cambia: la entrada bloqueada **no se puede deshacer sola**, y el botón solo abre la explicación con la salida en cadena.
5. ~~Eyebrow "Tus cambios"~~ — **descartado por el usuario** (ruido sobre el título). Ver §1. *(El QA visual mostró que sacarlo destapó una colisión con el chip flotante del sidebar; se corrigió a nivel app con la banda reservada, no reponiendo el eyebrow — §1.)*

### 11. Reglas duras reafirmadas

- **Regla dura 1 (verde = ingreso · rojo = gasto):** el ícono de operación, los chips "Editado"/"Eliminado" y el motivo de bloqueo son **neutros**; **nada en esta pantalla se pinta de rojo por ser una eliminación**. El único uso de color semántico es el **color por tipo de la cifra nueva** del bloque de cambios (gasto `--ink` / ingreso `--income-ink`), que es su uso legítimo. El punto de categoría usa la paleta de categorías sobre identidad, nunca sobre cifra.
- **Regla dura 2 (índigo solo marca):** aparece en el **botón primario de los modales**, el **ítem activo del sidebar** y los **focus rings**. Ninguna cifra se tiñe de acento.
- **Regla dura 3 (dinero en mono tabular):** todos los montos del bloque de cambios (anterior y nuevo, en fila y en modal) van en **mono tabular**; también los momentos (`DD Mmm · HH:MM`) y los números de cuota, por coherencia de alineación.
- **Regla dura 4 (claro y oscuro):** todos los tokens usados son theme-aware (`--panel`, `--panel-2`, `--panel-3`, `--hair`, `--line`, `--ink`, `--ink-2`, `--muted`, `--faint`, `--income-ink`, `--accent-soft`, `--expense-ink` solo para el error inline). Ninguna superficie asume un modo.

### Checklist de aceptación visual — Historial de cambios

*Encuadre:*
- [ ] `/historial` usa el ancho canónico (`px-10 max-w-[1120px]`, llena y capea en 1120), **sin flechas ‹ ›, sin stepper y sin chip de moneda**.
- [ ] Cabecera: H1 "Historial" (32/700) + bajada con la regla de retención. **Sin eyebrow** (no hay línea de 12px uppercase arriba del título). Zona derecha del header vacía.
- [ ] **Con el sidebar cerrado, el chip flotante "Mostrar menú" no toca ningún texto:** el H1 se lee **"Historial" entero** (la "H" no queda tapada). Verificar a **viewport 1120px y 640px**, que es donde el bloque de contenido queda pegado al borde. Al abrir/cerrar el sidebar la página **baja/sube junto con el deslizamiento**, en un solo movimiento. Comprobar también en `/reportes` que el **eyebrow** ("TU ACTIVIDAD") arranca libre del chip a esos mismos anchos.
- [ ] Las entradas viven en **una sola tarjeta-lista** con filas separadas por hairline (no una card por entrada).

*Anatomía de la entrada:*
- [ ] Col 1: caja 40×40 **neutra** (`--panel-3`) con **`Pencil`** (editado) o **`Trash2`** (eliminado). **Ninguna fila usa rojo por ser una eliminación.**
- [ ] **Alineación al tope:** en una entrada alta (una **eliminación con 5 filas de campos**) el ícono queda **enmarcando el nombre + la sublínea**, no flotando a la altura del bloque de cambios; y el **momento** de la col 3 se lee **al mismo nivel que el nombre**. Verificar en régimen amplio (es donde estaba centrado) y comparar una entrada corta con una larga: el ícono debe estar **a la misma altura en las dos**.
- [ ] Línea 1: nombre del movimiento (14.5/600, trunca) + **chip neutro** "Editado"/"Eliminado".
- [ ] Línea 2: `● Categoría · Único/Fijo/Cuotas` (+ `↳ calculado` si aplica), 12px `--muted`, con el punto de categoría de 6px.
- [ ] Col 3: momento `02 Jun · 14:30` en **mono tabular**, `--muted`, sin año.
- [ ] La fila **no** tiene kebab, ni link a `/mes`, ni botón de editar.

*Bloque "Qué cambió":*
- [ ] Caja recesada (`bg-panel-2` + borde + `--r-ctl`) con una fila por campo cambiado, rótulo a la izquierda y par a la derecha.
- [ ] El par se lee **`anterior → nuevo`**: anterior en `--muted`, flecha `--faint`, nuevo en `--ink`. **Sin tachado** en el valor anterior.
- [ ] Si cambió el **monto**, su fila va **primera** y sus dos valores en **mono 15.5px/600**; **todos** los demás campos a 13px (ningún otro numérico promovido).
- [ ] Orden de campos fijo: **Monto → Fórmula → Moneda → Cotización → Tipo → Categoría → Descripción → Fecha → Mes de inicio → Cuotas → Método de pago → Débito automático**. Se muestran **todos** los campos cambiados (sin "ver más"), y **solo** los que cambiaron.
- [ ] Cifra de dinero nueva con **color por tipo** (gasto `--ink` / ingreso `--income-ink`) y signo; todas las cifras en mono tabular.
- [ ] **`Fórmula`: una sola fila** con la expresión completa (`−10% del origen → +15% del origen`), en mono. **No hay filas separadas de "Operador", "Operando" ni "Signo"**, y un calculado **no** muestra fila `Tipo`.
- [ ] **`Cotización`:** par numérico en mono tabular, **misma cantidad de decimales de los dos lados**, **sin verde ni rojo**.
- [ ] **`Cotización` no significativa — no aparece:** editar un movimiento **en su moneda ancla** (ej. ARS con ancla ARS) **sin tocar la cotización** y verificar que la entrada **no** muestra fila `Cotización`, aunque el formulario la haya normalizado (`1.450,00 → 1,00`). Contraprueba: si en la edición **cambió la moneda**, la fila `Cotización` **sí** aparece.
- [ ] **`Moneda` no significativa — no aparece:** eliminar un movimiento en la **moneda default** y verificar que la ficha **no** muestra fila `Moneda`. Contraprueba: en un **diff donde la moneda cambió**, la fila `Moneda` aparece siempre (aunque el destino sea la default); y una eliminación de un movimiento **en otra moneda** sí la muestra.
- [ ] **`Cuotas`:** el par se lee `6 → 12 cuotas` — la palabra "cuotas" aparece **una sola vez**, en el valor nuevo (singular si el nuevo es 1).
- [ ] **`Débito automático`:** **un solo valor, sin flecha ni valor anterior** — "Se activó" / "Se desactivó" en `--ink`, alineado a la derecha como el resto de los valores nuevos.
- [ ] **`Tipo`:** la fila aparece **solo en entradas de movimientos únicos** — un **fijo** y un **calculado** nunca muestran fila `Tipo`. Palabras `Gasto`/`Ingreso` **sin tintar** (ni verde ni rojo); si cambió el tipo, la fila **`Monto` aparece igual** aunque la magnitud no haya cambiado.
- [ ] **`Fecha`:** una sola fila con fecha **y** hora (`02/06/2026 · 14:30`), mono; nunca dos filas separadas.
- [ ] En una **eliminación**: bloque con rótulo "Se eliminó:", **un solo valor por campo, sin flecha**, mismo orden fijo, y el booleano como **"Activado"** (la fila se omite si estaba desactivado).
- [ ] En una **eliminación** **no aparece la fila `Tipo`** (ni siquiera en un movimiento único): el tipo se lee en el **signo y el color** de la cifra de `Monto`.

*Estados:*
- [ ] Entrada **deshacible**: botón "Deshacer" (`outline`, `Undo2` 15px) **siempre visible**, nunca revelado por hover.
- [ ] Entrada **bloqueada**: contenido a **opacidad plena** (no atenuado); botón `outline` con **`Lock` 15px + "Bloqueado"**, **ACTIVO (no `disabled`)**, con hover/focus normales y **abre el modal de cadena**; debajo, el motivo **"Hay {N} cambios posteriores"** (12px `--muted`). *Verificación clave: no hay ningún botón muerto en la pantalla.*
- [ ] Clic (o `Enter`/`Espacio`) en **el cuerpo de la fila** abre el modal en los **dos** estados; el clic en el botón abre **el mismo** modal y **no** dispara doble apertura.
- [ ] **Deshaciendo:** la(s) fila(s) a `opacity-0.55` sin interacción, botón del modal en "Deshaciendo…"; al terminar salen con **fade + colapso 0.22s** (instantáneo con reduce-motion) y aparece el toast.

*Modal de deshacer:*
- [ ] Título "Deshacer cambio"; cierra con **✕ y `Esc`**, el **clic en el scrim NO cierra**.
- [ ] Caja de identidad (nombre + `● Categoría · Estructura · momento`) con el molde del diálogo de eliminar.
- [ ] Bloque rotulado **"Al deshacer queda así:"** con el par **invertido** respecto de la lista (`actual → restaurado`), con el **restaurado en `--ink`**. *Verificación clave: el modal NO repite el mismo par que la fila.*
- [ ] En el modal, el **débito automático** usa el verbo **invertido y en presente** ("Se desactiva" si la entrada decía "Se activó").
- [ ] Nota muted "Esta entrada se borra del historial." — **sin callout ámbar ni rojo**.
- [ ] Footer: `Cancelar` ghost + **`Deshacer` primario índigo** (nunca `destructive` rojo); en carga "Deshaciendo…" y deshabilitado.

*Modal de entrada bloqueada:*
- [ ] Se abre **por las dos vías**: clic en el cuerpo de la fila y clic en el botón "Bloqueado".
- [ ] Título "Hay cambios posteriores"; callout **neutro** (`Info` + `bg-panel-2`), **no ámbar, no rojo**, con el nombre del movimiento y el **N**.
- [ ] **Concordancia con N = 1:** el callout dice *"…hay que deshacer antes **el cambio posterior**"* — **nunca "los 1 cambios posteriores"**; y la línea de la fila bloqueada dice **"Hay 1 cambio posterior"**. Con `N ≥ 2`, plural en las dos superficies.
- [ ] Lista "Se van a deshacer, en este orden:" de la más reciente a la más antigua, con **la entrada abierta al final marcada `(esta)`** sobre `--panel-3`.
- [ ] **Resumen de cada fila de la lista: un solo valor** (`Monto: −$350.000,00`), **nunca el par `anterior → nuevo`**.
- [ ] **Ninguna cifra de la lista termina en "…"** — probar con montos largos (ej. `−$325.000,00`): si el resumen no entra, **baja completo a una segunda línea** de la fila; solo los valores de **texto** (descripción, categoría, método) pueden truncar con elipsis.
- [ ] Botón primario **"Deshacer los {N+1} cambios"** con el total real (posteriores + esta); toast de éxito **"{N} cambios deshechos."** (singular: "Cambio deshecho.").
- [ ] Al confirmar, **todas** las filas involucradas salen juntas y el toast informa el conteo.

*Vacío / carga / error:*
- [ ] **Vacío:** caja **dashed** con círculo `--panel-3` + `History`, título "Todavía no hay cambios registrados." y una línea de apoyo. **Sin botón ni CTA.**
- [ ] **Carga:** `.phead` y la tarjeta-lista reales presentes; **5 filas fantasma** con bloque 40×40, líneas de nombre/sublínea, **bloque de cambios de 44px** y placeholders de momento + botón. Contenedor `role="status" aria-label="Cargando historial"`. Sin `animate-pulse` inline.
- [ ] **Error de carga:** texto `--expense-ink` "No se pudo cargar el historial. Recargá la página." dentro del área de lista.
- [ ] **Error al deshacer:** toast de error y **el modal queda abierto** con el botón restaurado.

*Sidebar:*
- [ ] El sidebar muestra **5 links** en el orden `Dashboard · Vista del mes · Reportes · Historial · Configuración`.
- [ ] "Historial" usa **`History` 18px** y, estando en `/historial`, va `bg-accent-soft` + `text-accent-ink` + `aria-current="page"`.

*Contención:*
- [ ] A **941px** de contenido y por debajo: la entrada **colapsa a stack** — momento al final de la sublínea y **botón "Deshacer" en su propia fila alineado a la derecha**.
- [ ] A **640px** (y ~392px de contenido con el sidebar abierto): **sin scroll horizontal del `body`**; el par envuelve con `→ valor` entero en la segunda línea; **ninguna cifra truncada** (monto, cotización, cuotas, fecha, mes de inicio y la expresión de `Fórmula` envuelven enteras); los textos largos (descripción, método) truncan con elipsis.
- [ ] En viewport bajo, el **modal de cadena** (el más alto) se ve entero, scrollea el cuerpo y mantiene el footer pineado.
- [ ] Todo lo anterior se verifica igual en **modo claro y oscuro**.

## Simulación de categoría (`/mes`) — fila simulada, disparador y ciclo de vida

Implementa **RF-SIM-001..004** (RN-028, RN-029). Toda la feature vive en **una sola pantalla** (`/mes`) y en **un solo punto de entrada** (el disparador de filtro de la sección **Únicos**). Nada de esto aparece en `/reportes`, en el dashboard ni en el mes en curso.

### 0. Encuadre y cero-impacto

**Restricción rectora — sin simulaciones activas, `/mes` se ve y se comporta exactamente igual que hoy.** Es la misma restricción que rige las marcas de límites: ningún elemento de esta spec se monta de forma incondicional salvo **uno**: el botón **"Simular categoría"** dentro del popover de filtro de Únicos, que es el punto de entrada y por lo tanto siempre está. Todo lo demás —fila simulada, glifo de subtotal, línea de composición bajo los totales, lista de activas, nota de simulación pausada— es **condicional** al estado real.

**Las tres naturalezas y dónde vive cada una:**

| Naturaleza | Superficie | Condición de montaje |
|---|---|---|
| **Configurar** (crear / eliminar / ver activas) | banda "Simulación" del popover de Únicos | el botón, siempre; la lista, con ≥1 activa |
| **Ver el resultado** | fila simulada en la sección Únicos | mes **futuro** dentro del horizonte, valor ≠ 0 |
| **Entender la composición** | glifo en el subtotal + línea bajo los totales | ≥1 fila simulada **visible tras los filtros** |

**Los popovers de Fijos y Cuotas no cambian en nada.** La banda de simulación se monta **solo** en el popover de Únicos (RN-029: la simulación alcanza solo movimientos únicos).

**Glifo canónico de la feature: `ChartSpline`** (lucide). Un mismo glifo en las tres superficies (botón de la banda, adorno del subtotal, línea de composición) para que el usuario ate las tres sin leer. *Descartados:* `Sparkles` (sugiere "magia/IA", y esto es una regresión lineal explicable), `TrendingUp` (colisiona con la semántica de dirección — leería "ingreso/sube" sobre un ítem que puede ser gasto), `Waypoints` (genérico).

### 1. Fila del movimiento simulado

Vive en la sección **Únicos** de un mes futuro dentro del horizonte, mezclada con las filas reales. **Debe ser inequívocamente distinguible de un único real de un vistazo, sin leer texto** (RF-SIM-003).

**Anatomía — mismo grid que la fila real** (`40px 1fr auto auto auto`, `padding var(--row-pad) 18px`, hairline entre hermanas). Se conserva el grid **exacto** por una razón dura: la columna de montos tiene que seguir alineada entre filas reales y simuladas (regla dura 3 — cifras tabulares). Lo que cambia es el **tratamiento**, nunca la geometría.

**1.1 Col 1 — caja de ícono hueca y punteada (la señal principal).** Misma caja 40×40 `rounded-[11px]` y mismo glifo de dirección (`ArrowDown` gasto / `ArrowUp` ingreso, 19px, `stroke-width 2.2`), pero:

- **Real:** relleno `--expense-soft` / `--income-soft`, glifo `--expense-ink` / `--income-ink`, sin borde.
- **Simulada:** **sin relleno** (`transparent`), **borde `1.5px dashed`** en `--expense` / `--income`, glifo en `--expense-ink` / `--income-ink`.

**Por qué el glifo no cambia y el tratamiento sí:** la flecha comunica **dirección** (gasto/ingreso) y eso es idéntico en las dos filas — cambiarla por un glifo de "tendencia" rompería la lectura de tipo que el usuario ya tiene automatizada y obligaría a aprender dos vocabularios para el mismo dato. Lo que cambia es la **naturaleza** del ítem (todavía no ocurrió), y para eso el DS ya tiene un idioma: **`dashed` = acá todavía no hay nada** (empty de sección, recuadro `[+]` de reportes, empty de `/historial`). Hueco + punteado se lee "contorno de algo que aún no está" a distancia de vistazo, sin leer una palabra. *(Consistencia + affordance.)*

**1.2 Col 2 — nombre y sublínea.** El simulado **no tiene descripción propia**: su identidad es la categoría.

- **Nombre** (14.5/600 `--ink`): **el nombre de la categoría**.
- **Sublínea, zona de identidad** (12px, molde de *Sublínea del ítem de `/mes`*): `[chip "Simulado"] ● {Categoría} · tendencia de 12 meses`.
  - **Chip "Simulado"** — mismo molde exacto que el chip "Anulado": `rounded-[var(--r-chip)] bg-panel-3 text-muted px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em] shrink-0`, **primer segmento**. Es el respaldo textual de la señal visual (doble codificación: nunca se depende solo de la forma ni solo del color). Un simulado **nunca** puede estar anulado, así que los dos chips jamás compiten por el slot.
  - **Punto de categoría 6px + nombre** en `--ink-2`, igual que cualquier fila: mantiene la columna de anclas de color pareja en toda la lista.
  - **`· tendencia de 12 meses`** — último segmento, `--muted`, minúscula (mismo registro que la etiqueta de frecuencia del fijo). Ocupa el espacio que en un único real ocupa la nada y responde de antemano la única pregunta que el número dispara ("¿de dónde sale esto?"). Trunca primero al angostarse, por ser el último. *(Copy sugerido; el texto final es del analista.)*
- **Marca de límite con efecto `badge` — va inmediatamente después del chip "Simulado":** `[Simulado] [badge de límite] ● {Categoría} · tendencia de 12 meses`. *(Confirmado — el frontend lo resolvió así replicando el patrón vigente y es correcto.)*
  - Es el **mismo slot y el mismo orden** que ya rige en la fila real: el catálogo de marcas manda el `badge` al *"primer segmento de identidad (mismo slot que «Anulado»)"*, y la sublínea del ítem lo ordena `[Anulado] [badge de límite] ● Categoría …`. El chip "Simulado" ocupa exactamente la posición de "Anulado" (§1.2), así que la marca cae detrás sin decisión nueva. *(Consistencia — un problema ya resuelto no se resuelve dos veces.)*
  - **El orden entre los dos chips no es arbitrario:** "Simulado" declara **qué es** la fila (su naturaleza, siempre presente) y el badge declara **qué le pasó** al dato (condicional). Lo estable primero deja el borde izquierdo de la sublínea alineado en todas las filas de la sección; invertirlos correría el chip de naturaleza a una posición distinta según haya o no límite cruzado. *(Jerarquía visual.)*
  - **Nunca hay tres chips:** un simulado no puede estar anulado (§1.2), así que el par máximo es `[Simulado] [badge]`.
  - Los otros efectos del catálogo no cambian: **`glyph`** va al cluster de la zona de estados (primero, como siempre), **`fill`** pinta el fondo de la fila —única excepción admitida al "sin hover tint" de §1.6— y **`tint` sigue prohibido** (el monto es tipado). Con efecto **`bold`**, el peso sube **solo en la cifra**: el prefijo `≈` conserva `--muted` y su peso normal, porque califica al número y no es parte de él (§1.4).
- **Zona de estados:** solo la **marca de límite** si aplica (un simulado entra a la evaluación de límites, RN-022). El glifo `GitBranch` nunca aplica: un simulado no puede ser origen de un calculado.

**1.3 Col 3 — vacía.** El simulado no tiene instante (RF-SIM-003). La columna queda vacía, exactamente como en un fijo — precedente ya vigente, no se inventa nada.

**1.4 Col 4 — monto con prefijo `≈`.** Mono tabular, 15.5px/600, **color por tipo** (gasto `--ink`, ingreso `--income-ink`) y signo, idéntico a una fila real, precedido de **`≈` (U+2248)** en `--muted` con `mr-[3px]`, **dentro del mismo span mono**:

```
≈ −$12.500,00
```

- El `≈` es la segunda señal sin-texto y la única que aparece **en el dato mismo**: dice "esta cifra es una estimación" en el lugar exacto donde el usuario podría tomarla por un hecho. *(Prevención de error.)*
- **No rompe la alineación tabular:** la columna es `text-right` y la fuente es monoespaciada, así que los dígitos siguen alineados al borde derecho con las filas reales.
- **No se recolorea ni se atenúa el monto.** El tipo manda el color (regla dura 1) y el simulado **sí computa** (§5).

**1.5 Col 5 — el hueco del kebab se reserva, no se colapsa.** La fila simulada **no tiene kebab** (RF-SIM-003: sin acciones). En su lugar va un **placeholder inerte de 32×32** (`h-8 w-8`, exactamente la caja del `KebabMenu`), `aria-hidden`, `pointer-events-none`, sin borde ni fondo.

**Por qué se reserva y no se elimina:** si la columna desaparece, el monto de las filas simuladas se corre 32px a la derecha respecto de las reales y la **columna de dinero deja de alinearse** — el defecto más caro posible en una lista de cifras (regla dura 3, jerarquía). *Alternativa evaluada y descartada:* usar ese hueco para el chip "Simulado". Rechazada: pondría un elemento con aspecto de control en la **columna de acciones**, que es exactamente la que esta fila no tiene — falsa affordance.

**1.6 La fila no es interactiva.** No abre card de detalle (RF-SIM-003), así que:

- **Sin** `role="button"`, **sin** `tabIndex`, **sin** handler de click ni de teclado, **sin** focus ring.
- **Sin hover tint** (`hover:bg-panel-2` no se aplica). `cursor-default`.
- La ausencia de respuesta al hover es una señal más —la descubre quien interactúa, no quien mira— y sobre todo es **obligatoria**: pintar hover sobre una fila que no responde es prometer una acción que no existe. *(Affordance.)*
- **Excepción:** el fondo ámbar del efecto `fill` de una marca de límite **sí** se aplica (es una marca sobre el dato, no un estado de interacción).

**1.7 La fila NO se atenúa.** Nada de `opacity-[0.55]`. Ese atenuado significa, en toda la app, **"no computa"** (ítem anulado) — y el simulado computa: suma al subtotal, al contador y a los totales. Atenuarlo diría exactamente lo contrario de lo que hace. Mismo criterio ya cerrado para la entrada bloqueada de `/historial`. *(Jerarquía + consistencia.)*

**1.8 Orden.** Por **monto**, entra por magnitud mezclado con las reales; por **fecha**, va **al final** de la sección (no tiene instante). **Sin separador, sin subgrupo, sin encabezado propio**: es un ítem más de la lista y su naturaleza ya está codificada en la fila. Meterlo en un bloque aparte lo convertiría en una sección fantasma que el usuario tendría que aprender.

**Resumen de señales de la fila:** 3 sin texto (caja punteada hueca · prefijo `≈` · sin hover) + 1 textual (chip "Simulado"). Ninguna depende solo del color.

### 2. Banda "Simulación" en el popover de filtro de Únicos

El popover de sección tiene hoy dos bloques (**tipo** y **categorías**). La simulación entra como **tercer bloque, en registro distinto**, no como una tercera fila del mismo cajón.

**El problema y la decisión.** Filtrar es *"qué de esto veo"*; simular es *"qué contiene el mes"*. Son dos naturalezas y apilarlas sin demarcación convierte al popover en un menú misceláneo donde el usuario deja de saber qué está tocando. *Alternativas evaluadas:*

- **(A) Tercer bloque al final, con el mismo tratamiento que los otros dos.** Descartada: queda **después** de una lista con scroll interno de 280px — el usuario que no scrollea nunca la ve, y no hay nada que le diga que las dos mitades del popover hacen cosas distintas.
- **(B) Dos solapas (Filtros / Simulación).** Descartada: en 260px, dos solapas para dos ítems es más cromo que contenido, y esconde el punto de entrada único de la feature detrás de un click extra.
- **(C, elegida) Banda fija al pie, recesada y rotulada.** Queda **fuera** del scroll de las categorías (siempre visible al abrir), se demarca por **superficie** (`--panel-2`) y por **divisor fuerte** (`--line`, no `--hair`), y conserva el orden de lectura natural: primero lo que recorta lo que ves, al final lo que agrega contenido al mes.

**Anatomía de la banda** (solo en la sección **Únicos**):

- **Divisor superior:** `border-t border-line` (1px, más fuerte que el `--hair` que separa tipo de categorías — el salto de línea señala el cambio de naturaleza).
- **Superficie:** `bg-panel-2`, `px-3 py-[10px]`, `flex flex-col gap-[8px]`. `shrink-0` (nunca scrollea fuera de alcance).
- **Eyebrow:** 11px/600 uppercase `.08em` `--muted` — **"Simulación"**.
- **Botón "Simular categoría"** — **siempre presente**, ancho completo: molde outline del DS (`bg-panel border border-line rounded-[var(--r-ctl)]`), `min-h-[34px]`, `justify-center gap-[6px]`, texto 12.5/600 `--ink-2`, glifo **`ChartSpline` 15px**. Hover: `bg-panel-3` + texto `--ink`. Focus: ring `--accent-soft` 3px. Abre el **modal** de §3 y **cierra el popover** (un solo overlay a la vez — regla del DS ya vigente en la fila de movimiento).
- **Sin simulaciones activas:** debajo del botón, una línea 11.5px `--muted`: *"Proyecta una categoría a los meses futuros."* Nada más — sin caja dashed, sin ilustración: es un bloque de 3 líneas dentro de un popover, no una pantalla vacía.
- **Con ≥1 activa:** la **lista** (§4) debajo del botón, y al pie una nota 11.5px `--muted`: *"Se proyecta hasta {mes} {año}."*

**El botón va arriba y la lista abajo** para que su posición sea **estable** sea cual sea la cantidad de simulaciones: es el control que se busca, y un target que se mueve según cuántos ítems haya es un target peor.

**El punto indicador `--accent` del disparador NO cambia de significado.** Sigue queriendo decir **"esta sección está filtrada"** (tipo ≠ Ambos u orden/categoría ≠ default). Una simulación activa **no** lo enciende: no recorta lo que ves. Sobrecargarlo destruiría la única lectura que hoy es inequívoca en la cabecera. Que haya simulaciones activas se ve donde importa —en el mes— vía §1 y §5.

### 3. Modal "Simular categoría" — selector con motivo visible

**Por qué modal y no un sub-panel dentro del popover.** Un popover dentro de un popover es frágil (los dos cierran por click-fuera y por scroll) y, sobre todo, los **motivos de deshabilitado necesitan ancho de texto** que 260px no dan sin truncar — y el motivo **nunca se oculta ni se trunca** (RF-SIM-001 A2/A3). Además es una operación de decisión con confirmar/cancelar, que en el DS es `ModalShell variant="dialog"`.

- **Contenedor:** `ModalShell variant="dialog"` (`max-w-[440px]`). Cierra con **✕ y `Esc`**; el clic en el scrim **no** cierra (modal de decisión).
- **Título** (18/700): **"Simular categoría"**.
- **Bajada** 13px `--muted`, `max-w-[46ch]`: *"Se proyecta una categoría a los meses futuros a partir de sus últimos 12 meses. Alcanza hasta {Mes AAAA}."* Es donde el horizonte se explica: en el momento en que el usuario opta por la feature (ver §7).
- **Lista de categorías** — `role="radiogroup"` `aria-label="Categoría a simular"`, universo = **catálogo de categorías activas** del usuario (no las presentes en el mes). Fila: `flex items-center gap-[10px] px-[10px] py-[8px] rounded-[var(--r-ctl)]`, `min-h-[38px]`.
  - `[radio 16px] [● color 10px radio 3px] [nombre 13px] ····· [motivo, derecha]`
  - **Radio:** círculo 16px `border --line-strong`; seleccionado `border-accent bg-accent` con punto blanco 6px (mismo molde que el checkbox del filtro de categorías).
  - **Habilitada:** nombre `--ink`; hover `bg-panel-2`; seleccionada `bg-panel-2`; focus ring `--accent-soft` 3px.
  - **Orden: el del catálogo, sin reagrupar.** Las deshabilitadas **no** se mandan al fondo: el usuario busca *su* categoría por nombre y una lista que se reordena según un estado que él no ve es impredecible. Lo que evita el "cementerio" no es esconderlas, es que cada una diga por qué. *(Consistencia + prevención de error.)*
- **Estados deshabilitados — el motivo siempre visible, nunca un tooltip:**

| Caso | Fila | Motivo (12px `--muted`, a la derecha) |
|---|---|---|
| Menos de 3 meses con datos | `aria-disabled="true"`, `tabIndex={-1}`, `cursor-not-allowed`, radio `--faint` sin relleno, nombre `--muted` | **"Necesita 3 meses con datos (tiene {N})"** — sin `{N}` disponible: *"Necesita 3 meses con datos"* |
| Ya simulada | ídem | **"Ya la estás simulando"** |

  - **El punto de color NO se atenúa** aunque la fila esté deshabilitada: es la identidad, y el usuario la usa para encontrar la categoría. Lo que está condicionado es la **selección**, no la lectura. *(Mismo criterio que la entrada bloqueada de `/historial`.)*
  - El motivo va asociado por **`aria-describedby`**: se enuncia en la lista, sin obligar a nada.
  - **Contención del motivo:** la fila es `flex-wrap`; si el motivo no entra al lado del nombre, **baja entero a una segunda línea** de la misma fila. **Nunca** trunca ni se esconde.
- **Footer:** `Cancelar` (`variant="ghost" size="sm"`) + **`Simular`** (`variant="default" size="sm"`, primario índigo; **`disabled` hasta que haya una categoría elegida**; en carga **"Simulando…"** + `disabled`).
- **Estados de la lista:** *carga* → 4 filas fantasma del sistema de skeletons (`SkeletonCircle` 16 + `SkeletonBlock` 10 + `SkeletonLine` 13px ~40%), contenedor `role="status" aria-label="Cargando categorías"`. *Error* → texto inline 13px `--expense-ink`: *"No se pudieron cargar las categorías. Cerrá y volvé a intentar."* *Todas deshabilitadas* → la lista se muestra **igual, completa, con sus motivos** (no hay empty especial: el motivo por categoría **es** la explicación). *Sin categorías activas* (borde teórico) → caja dashed con la línea *"No tenés categorías activas."*
- **Al confirmar:** cierra el modal, **toast de éxito** *"Simulación creada."*, y el mes visualizado se recarga. Si el mes visualizado es **futuro y dentro del horizonte**, su fila simulada aparece y los totales cambian en el acto; si es el mes en curso o un pasado, **no se ve nada cambiar** — por eso el toast es obligatorio: es la única confirmación posible en ese caso. *(Feedback.)*
- **Error al guardar:** `toast.error` y **el modal queda abierto** con la selección intacta (RNF-008), botón restaurado.

### 4. Lista de simulaciones activas y eliminar

Dentro de la banda (§2), debajo del botón. **Es la única superficie donde se ve el conjunto de simulaciones del usuario.**

- **Fila:** `flex items-center gap-[8px] py-[6px]`, `min-h-[30px]`.
  `[● color 8px] [nombre categoría 12.5px --ink, truncate] ····· [chip de estado, si aplica] [botón eliminar]`
- **Botón eliminar:** icon-only 28×28 `rounded-[8px]`, glifo **`Trash2` 14px** `--muted`. Hover: `bg-expense-soft` + `--expense-ink` (mismo molde que el ítem `danger` del `KebabMenu`; el rojo acá es **cromo de una acción destructiva**, no un monto teñido). Focus: ring `--accent-soft`. `aria-label="Eliminar la simulación de {Categoría}"`.
- **Tope de alto:** con más de 4 activas la lista scrollea dentro de sí (`max-h-[132px] overflow-y-auto`), sin que el botón ni la nota de horizonte salgan de vista.
- **Confirmación (RF-SIM-004)** — `ModalShell variant="dialog"` (`max-w-[440px]`), **cierra el popover al abrirse**:
  - **Título:** "Eliminar simulación".
  - **Cuerpo** (`space-y-[14px]`): frase 14px `--ink` *"Se va a eliminar la simulación de **{Categoría}**."* → **caja de identidad** (`rounded-ctl border border-line bg-panel-2 px-4 py-3`, molde exacto del diálogo de eliminar movimiento) con `● {Categoría}` → **nota de consecuencia** 12.5px `--muted`: *"Sus movimientos simulados dejan de aparecer en los meses futuros y los totales se recalculan sin ellos."*
  - **Footer:** `Cancelar` (ghost sm) + **`Eliminar`** (`variant="destructive" size="sm"`; en carga "Eliminando…").
  - **Éxito:** cierra, `toast` *"Simulación eliminada."*, el mes se recarga sin sus filas simuladas. **Error:** `toast.error` y el modal queda abierto.

### 5. Composición del subtotal y de los totales — se señala, sin tocar las cifras

Un total que mezcla real y simulado sin avisar es engañoso. Pero la cifra **no está mal**: lo que necesita revelarse es su **composición**. Por eso la señal va **al lado** del número, nunca **sobre** el número.

**Lo que NO se hace, y por qué:** no se recolorea ni se atenúa ninguna cifra (los semánticos son del tipo, regla dura 1; el ámbar es de límites y diluirlo le saca fuerza a la única familia de "prestá atención" que tiene la app; el índigo no toca montos, regla dura 2). Marcar el número diría "este número está mal" cuando lo correcto es "este número incluye una estimación".

**5.1 Cabecera de la sección Únicos — glifo junto al subtotal.** Reusa el slot `subtotalAdornment` ya existente en `AccordionSection`:

- Glifo **`ChartSpline` 13px `--muted`**, inmediatamente **a la izquierda del número** y **a la derecha** de cualquier adorno de límite (orden en el cluster: `[marca de límite] [glifo de simulado] [subtotal]`).
- `aria-label` + `title`: **"El subtotal incluye {N} movimientos simulados"** (singular: *"…incluye 1 movimiento simulado"*).
- Se monta **solo** si hay ≥1 fila simulada **visible tras los filtros** de la sección. Si el filtro las deja fuera, el glifo desaparece — el subtotal ya no las incluye.
- **El pill contador no lleva glifo.** Un adorno por cabecera alcanza; duplicarlo satura una fila que ya tiene handle, chevron, rótulo, pill, divisor, dos disparadores y el subtotal.

**5.2 Totales del mes — una línea de composición bajo la grilla.**

- **Ubicación:** inmediatamente **debajo** de la grilla de las tres stat-cards, antes del listado, alineada a la izquierda.
- **Forma:** `inline-flex items-center gap-[6px]`, glifo **`ChartSpline` 13px `--muted`** + texto **12px `--muted`**.
- **Copy:** *"Los totales incluyen {N} movimientos simulados."* — singular con frase propia: *"Los totales incluyen 1 movimiento simulado."* (regla de conteo transversal: ningún plural se arma concatenando numeral + sustantivo plural).
- **Cero-impacto de espaciado:** cuando la línea **no** está, la grilla conserva su `mb-6` actual y el layout es **idéntico byte a byte** al de hoy; cuando está, la grilla pasa a `mb-[10px]` y la línea lleva el `mb-6`. El bloque total no cambia de alto.
- **Una sola línea para las tres cards**, no un qualifier por card: la composición es del **mes**, no de cada bucket, y repetirla tres veces es ruido.
- **Condición de montaje:** ≥1 fila simulada visible tras los filtros (misma condición que 5.1).

**Por qué acá y no un banner arriba:** un banner en cada mes futuro sería un cartel permanente para un estado que es normal y buscado. Una línea de pie bajo el dato que califica es proporcional a lo que informa. *(Carga cognitiva.)*

### 6. Simulación pausada por falta de datos — el silencio se rompe en dos lugares

Una simulación activa cuya categoría cayó por debajo de los 3 meses **deja de derivar movimientos sin eliminarse** (RF-SIM-002). Sin tratamiento, el usuario ve **nada** donde esperaba algo y no tiene forma de averiguar por qué. Se resuelve en las **dos** superficies donde puede preguntárselo:

**6.1 En la lista de activas (§4) — el estado de la simulación.**

- **Chip de estado** después del nombre: **"Sin datos"**, `rounded-[var(--r-chip)] bg-panel-3 text-muted px-[6px] py-[1px] text-[10.5px] font-semibold` — mismo molde que la etiqueta **"Desactivado"** del popover informativo de límites. Un solo idioma para "está configurado pero no está actuando".
- **Nombre de la categoría en `--muted`** (baja de `--ink`).
- **Segunda línea del ítem**, 11.5px `--muted`, siempre visible: *"Necesita 3 meses con datos (tiene {N}). No proyecta."*
- **Neutro, no ámbar.** No es una advertencia de riesgo ni un error: es un estado de configuración. El ámbar está reservado a límites cruzados y erosionarlo acá le saca significado. *(Mismo criterio que el callout neutro del modal de cadena de `/historial`.)*
- **El botón de eliminar sigue disponible** — la simulación existe, solo no proyecta; y eliminarla es lo que el usuario probablemente quiera hacer.

**6.2 En el mes — una nota al pie del listado de Únicos.** El popover hay que abrirlo; la ausencia se ve sin abrir nada. Por eso la explicación también vive **donde está la ausencia**:

- **Ubicación:** última fila de la tarjeta-lista de Únicos, después de todos los ítems, separada por el mismo hairline. Si la sección está **vacía**, va debajo del empty inline dashed, `mt-[8px]`.
- **Forma:** no interactiva, `px-[18px] py-[12px]`, `inline-flex items-start gap-[6px]`, glifo **`Info` 14px `--muted`** + texto **12px `--muted`**.
- **Copy:** *"{N} simulaciones no están proyectando: les faltan meses con datos."* — singular: *"Una simulación no está proyectando: le faltan meses con datos."*
- **Condición:** mes **futuro dentro del horizonte** + ≥1 simulación pausada. **Independiente de los filtros de la sección** (es un estado de configuración, no un ítem filtrable).
- **Sin acción ni link.** El arreglo (eliminarla) está a un clic, en el disparador que está justo encima, en la misma cabecera. Un link acá duplicaría un punto de entrada que la feature define como **único**.
- *(Elemento no previsto en `screens.md` §4 — ver §9.)*

### 7. Meses fuera del horizonte — sin señal (decisión)

Un mes futuro más allá del horizonte **no lleva ninguna señal**: se ve exactamente igual que sin la feature.

- **Es lo que ya está cerrado funcionalmente** (`screens.md` §4: *"Un mes futuro fuera del horizonte, o sin simulaciones activas, se ve exactamente igual que sin la feature"*). Una señal ahí rompería la restricción de cero-impacto.
- **Sería cromo permanente para explicar una nada.** El horizonte llega como mínimo hasta `A+6`: los meses afectados son los que el usuario visita de forma excepcional. Poner en cada uno una línea que diga "acá no se simula" es ruido en el 99% de las visitas para el 1% que se lo pregunta. *(Carga cognitiva.)*
- **La regla se explica donde el usuario opta:** la bajada del modal de §3 (*"Alcanza hasta {Mes AAAA}"*) y la nota al pie de la banda (*"Se proyecta hasta {mes} {año}"*). Ahí el dato es accionable; en un mes lejano es una excusa.

*Alternativa evaluada:* nota al pie del listado como en §6.2, con copy *"La simulación no alcanza este mes."* **Descartada** por lo anterior — y porque compite con §6.2, que sí informa una anomalía real y perdería fuerza si comparte forma con un estado normal.

### 8. Contención responsive (obligatoria)

**8.1 La fila simulada.** Mismo grid que la real en todo ancho; la col 2 es `min-w-0` y trunca (primero `tendencia de 12 meses`, después el nombre de categoría). El **monto nunca trunca ni envuelve** (`whitespace-nowrap`): el prefijo `≈` viaja pegado a la cifra y, si el ancho aprieta, cede la identidad, jamás el número (regla dura 3). El placeholder de 32px de la col 5 se mantiene en **todos** los anchos: es lo que sostiene la alineación de la columna de dinero.

**8.2 El popover.** Es hoy el punto de mayor riesgo: con tres bloques puede superar el alto del viewport y dejar la banda —que contiene el punto de entrada de la feature— **fuera de pantalla** (rompe el invariante 3). Se resuelve con el popover como **columna acotada**:

- `max-height: min(560px, calc(100dvh - 24px))`, `display:flex; flex-direction:column`.
- **Bloque tipo** y **banda Simulación**: `shrink-0` — nunca se comprimen ni scrollean fuera de alcance.
- **Bloque categorías**: única región flexible — `flex-1 min-h-0 overflow-y-auto`, `min-height: 120px` (nunca colapsa a nada).
- **Anclaje:** si bajo el disparador no hay alto suficiente, el popover **abre hacia arriba** (mismo mecanismo `openUpward` del `KebabMenu`). Hoy `SectionFilterPanel` solo abre hacia abajo; con la banda esto pasa a ser requisito.
- Ancho **260px** sin cambios; anclado a la derecha del disparador, que está pegado al borde derecho del contenido — no se sale por ningún costado a 640px.

**8.3 Los dos modales.** `ModalShell variant="dialog"`: `max-h calc(100dvh − 48px)`, cuerpo scrolleable, footer pineado. El de **§3 es el alto** (bajada + lista de N categorías): es el que hay que verificar en viewport bajo — la lista scrollea, el footer con `Simular` queda pineado y visible.

**8.4 Línea de composición (§5.2) y nota (§6.2).** Texto normal que **envuelve** a dos líneas; ninguna trunca, ninguna tiene ancho mínimo rígido.

**Los cuatro invariantes en estos elementos:**

1. *Sin scroll horizontal del `body` (≥640px, sidebar abierto o cerrado):* la fila simulada no agrega ancho mínimo (misma geometría que la real, col 2 truncable); el popover es de ancho fijo portaleado; las líneas de texto envuelven. A 392px de contenido (piso con sidebar abierto) la fila se lee con la identidad truncada y el monto entero.
2. *Modales completos y scrolleables:* los dos son `ModalShell variant="dialog"`; el selector de categorías scrollea su lista con el footer pineado.
3. *Ninguna acción inalcanzable:* la banda del popover es `shrink-0` y el popover se acota al viewport y se invierte de anclaje — el botón "Simular categoría" y los de eliminar están siempre a la vista. La fila simulada no tiene acciones, así que no aporta riesgo.
4. *Superficies anchas scrollean dentro de sí:* aplica a las dos listas del popover (categorías y activas), cada una con su propio carril; la lista de `/mes` no es una tabla ancha.

### 9. Agregados más allá del brief — estado

1. **Línea de composición bajo los totales (§5.2)** y **glifo en el subtotal (§5.1)** — respuesta al pedido explícito del brief ("un total que mezcla real y simulado sin avisar es engañoso"). No están en `screens.md` §4. **Requieren reflejo del analista.**
2. **Nota de simulación pausada en el listado (§6.2)** — respuesta al pedido explícito ("hoy eso sería silencioso; resolvelo visualmente"). Elemento nuevo de `/mes`. **Requiere reflejo del analista.**
3. **Nota de horizonte en la banda y en la bajada del modal (§2, §3)** — **agregado no solicitado, confirmar.** Es copy de transparencia (no agrega acción ni dato persistido) y es el sustituto de no señalar los meses fuera del horizonte (§7). Si se descarta, el horizonte queda sin explicar en ningún lado.
4. **Copy sugerido** (títulos, rótulos, motivos de deshabilitado, notas, toasts). Propuesto para que el frontend no invente; el texto final lo fija el analista.
5. **Segmento `· tendencia de 12 meses` en la sublínea (§1.2)** — **agregado no solicitado, confirmar.** RF-SIM-003 lista el contenido de la fila y no lo incluye. Se propone porque ocupa espacio que de otro modo queda vacío y responde de antemano la pregunta que el número dispara. Si se descarta, la fila queda `[Simulado] ● Categoría` y **nada más cambia**.

### 10. Reglas duras reafirmadas

- **Regla dura 1 (verde = ingreso · rojo = gasto):** el simulado usa los semánticos **exactamente** para lo mismo que un real — dirección del ícono y color del monto según su **tipo derivado** (RN-028). El borde punteado de la caja usa el token semántico pleno (`--expense`/`--income`) porque comunica **ese mismo tipo**, no decoración. El chip "Simulado", el chip "Sin datos" y las notas son **neutros**. El rojo del botón de eliminar es cromo de acción destructiva (molde `danger` ya vigente), no una cifra teñida.
- **Regla dura 2 (índigo solo marca):** aparece en el radio seleccionado del selector, en el botón primario `Simular`, en los focus rings y en el punto indicador del disparador de filtro (que **no** cambia de significado). Ninguna cifra se tiñe de acento.
- **Regla dura 3 (dinero en mono tabular):** el monto simulado va en mono tabular con `tnum`, mismo tamaño y peso que el real, con el `≈` **dentro** del mismo span mono para no romper la alineación de la columna. Ninguna cifra trunca nunca.
- **Regla dura 4 (claro y oscuro):** todos los tokens usados son theme-aware (`--panel`, `--panel-2`, `--panel-3`, `--hair`, `--line`, `--ink`, `--ink-2`, `--muted`, `--faint`, `--expense`/`-soft`/`-ink`, `--income`/`-soft`/`-ink`, `--accent`/`-soft`). El **borde punteado** es el punto a verificar en oscuro: `--expense`/`--income` están recalibrados y el contorno debe leerse claramente sobre `--panel` en los dos modos.

### Checklist de aceptación visual — Simulación de categoría

*Fila simulada (mes futuro dentro del horizonte, sección Únicos):*
- [ ] La caja de la col 1 es **hueca con borde punteado** del color del tipo (rojo gasto / verde ingreso), con la **misma flecha** ↓/↑ que una fila real. Comparada con la fila real de arriba o abajo, se distingue **sin leer nada**.
- [ ] La sublínea arranca con el chip neutro **"Simulado"** (mismo molde que "Anulado"), seguido del punto de color y el nombre de la categoría.
- [ ] Con un **límite cruzado** cuya marca es `badge`: el chip ámbar aparece **inmediatamente a la derecha del chip "Simulado"** y antes del punto de categoría (`[Simulado] [badge] ● Categoría · tendencia…`), nunca antes de "Simulado" ni al final de la sublínea. Con efecto `glyph`, el `AlertTriangle` va al **cluster derecho**; con `fill`, la fila toma el fondo ámbar; con `bold`, **solo la cifra** engorda y el `≈` queda igual.
- [ ] El **nombre de la fila** es el nombre de la categoría.
- [ ] La **col 3 está vacía** (sin fecha, sin "Cuota X/N") — igual que un fijo.
- [ ] El monto lleva prefijo **`≈`** en `--muted`, en mono tabular, con su signo y su color por tipo. **Los dígitos quedan alineados** con los de las filas reales de la sección (verificar a ojo la columna derecha).
- [ ] **No hay kebab (⋮)**, ni siquiera al pasar el mouse — y el monto **no se corre** respecto de las filas reales (el hueco está reservado).
- [ ] **Pasar el mouse por la fila no la tiñe**, el cursor **no** es de mano, y **clic / Enter / Espacio no abren nada** (ni card de detalle, ni menú). La fila **no** recibe foco con `Tab`.
- [ ] La fila está a **opacidad plena** (no atenuada como un ítem anulado).
- [ ] En orden **por monto** la fila aparece intercalada por magnitud; en orden **por fecha** aparece **al final** de la sección. En ningún caso hay un separador, encabezado o bloque aparte.
- [ ] Los **filtros de la sección** la alcanzan: filtrar por Gasto/Ingreso o destildar su categoría la saca de la lista, y el subtotal y el contador bajan en consecuencia.
- [ ] **Mes en curso y meses pasados: ninguna fila simulada, nunca.**

*Popover de Únicos:*
- [ ] La banda **"Simulación"** está al pie, con **fondo recesado** (`--panel-2`) y separada del bloque de categorías por un divisor **más fuerte** que el interno.
- [ ] La banda es visible **al abrir el popover, sin scrollear**; scrollear la lista de categorías **no** la mueve.
- [ ] El botón **"Simular categoría"** (glifo `ChartSpline`) ocupa el ancho de la banda y está presente **aunque no haya ninguna simulación** (con la línea "Proyecta una categoría a los meses futuros." debajo).
- [ ] Con simulaciones activas: lista debajo del botón con `● color + nombre` y botón de basura por fila, y al pie **"Se proyecta hasta {mes} {año}."**
- [ ] Los popovers de **Fijos** y **Cuotas** **no tienen banda de simulación** ni ningún cambio respecto de hoy.
- [ ] Tener una simulación activa **no** enciende el punto `--accent` del disparador (ese punto sigue significando solo "sección filtrada").
- [ ] Abrir el modal (crear o eliminar) **cierra el popover**; nunca quedan los dos overlays a la vez.

*Modal "Simular categoría":*
- [ ] Título "Simular categoría" + bajada con el horizonte; cierra con **✕ y `Esc`**, el clic en el scrim **no** cierra.
- [ ] Lista en **orden de catálogo**, con las deshabilitadas **en su lugar** (no agrupadas al final) y **nunca ocultas**.
- [ ] Categoría con **menos de 3 meses**: fila no seleccionable, con el motivo **visible en la propia fila** ("Necesita 3 meses con datos (tiene {N})"). El **punto de color no se atenúa**.
- [ ] Categoría **ya simulada**: fila no seleccionable con el motivo **"Ya la estás simulando"** visible.
- [ ] **Ningún motivo depende de un tooltip** ni se corta con elipsis: si no entra al lado del nombre, **baja entero a una segunda línea**.
- [ ] Clic en una fila deshabilitada **no selecciona nada** y `Tab` la saltea.
- [ ] El botón **`Simular` arranca deshabilitado** y se habilita solo al elegir una categoría; en carga dice "Simulando…".
- [ ] Al confirmar aparece **toast de éxito** aunque el mes visualizado no cambie visualmente (probarlo parado en el **mes en curso**).
- [ ] Si el guardado falla: **toast de error y el modal sigue abierto** con la selección intacta.

*Eliminar simulación:*
- [ ] El botón de basura de la fila pasa a **rojo sobre fondo rojo suave** en hover, y tiene `aria-label` con el nombre de la categoría.
- [ ] La confirmación es un diálogo con **caja de identidad** y nota de consecuencia, footer `Cancelar` + **`Eliminar` rojo**.
- [ ] Al confirmar: toast, la fila desaparece de la banda y **las filas simuladas de esa categoría desaparecen de los meses futuros**, con totales recalculados.

*Composición de totales:*
- [ ] Con ≥1 fila simulada visible, la cabecera de **Únicos** muestra el glifo `ChartSpline` `--muted` **pegado a la izquierda del subtotal** (y a la derecha de una marca de límite, si la hubiera), con `title` explicando el conteo.
- [ ] Bajo la grilla de totales aparece la línea **"Los totales incluyen {N} movimientos simulados."** (singular con su propia frase, **nunca "1 movimientos"**).
- [ ] **Ninguna cifra —de sección, de card o de fila— cambia de color, de peso o de opacidad** por incluir simulados.
- [ ] **Cero-impacto:** en un mes **sin** simulados (o con el filtro que los excluye), **no hay glifo ni línea**, y el espaciado entre la grilla de totales y el listado es **idéntico** al de un mes sin la feature (comparar contra el mes en curso).

*Simulación pausada:*
- [ ] En la banda, la simulación sin datos suficientes muestra el chip neutro **"Sin datos"**, el nombre en `--muted` y la línea **"Necesita 3 meses con datos (tiene {N}). No proyecta."** — **sin ámbar y sin rojo**.
- [ ] Su **botón de eliminar sigue disponible**.
- [ ] En un mes futuro dentro del horizonte, al pie del listado de Únicos aparece la nota `Info` **"Una simulación no está proyectando: le faltan meses con datos."** (plural con `{N}` si son varias), también cuando la sección está **vacía** (debajo del empty dashed).
- [ ] La nota **no es clickeable** y no ofrece link.

*Fuera del horizonte:*
- [ ] Un mes futuro más allá del horizonte se ve **exactamente igual que sin la feature**: sin filas simuladas, **sin nota, sin glifo, sin línea de composición**.

*Contención:*
- [ ] A **640px** (y ~392px de contenido con el sidebar abierto): sin scroll horizontal del `body`; en la fila simulada trunca la identidad y **el monto se lee entero, con su `≈`**.
- [ ] En viewport **bajo** (ej. 700px de alto), el popover de Únicos **no se corta**: se acota al viewport, la lista de categorías scrollea y la **banda de simulación sigue visible y accionable**; si no entra hacia abajo, **abre hacia arriba**.
- [ ] Con **más de 4 simulaciones activas**, la lista de la banda scrollea dentro de sí y el botón "Simular categoría" y la nota de horizonte siguen a la vista.
- [ ] El modal del selector, con **muchas categorías**, muestra el footer **pineado** y scrollea solo la lista.
- [ ] Todo lo anterior se verifica igual en **modo claro y oscuro** — con atención al **borde punteado** de la caja del ícono, que debe leerse con claridad en los dos.

---

## Toast con acción — Deshacer inmediato tras editar o eliminar

Atajo en pantalla a la operación de **RF-HIST-003**, sin ir a `/historial`. El toast de éxito que ya se emite al **editar** o **eliminar** un movimiento pasa a ofrecer **Deshacer**. Alcanza a las **cuatro formas** (único, fijo, calculado, cuotas) y **solo** a editar/eliminar: crear **no** lleva acción (no genera entrada de historial).

Todo lo de esta sección que no sea específico del undo (**duración, pausa por hover, layout de la acción, apilado**) es **regla general del sistema de toasts**, no una excepción de esta feature.

### 1. Anatomía — la acción va INLINE, no debajo del mensaje

El molde del pill no cambia: `bg-ink text-paper`, radio `13px`, `py-3 pl-4 pr-[14px]`, `shadow-[var(--shadow-lg)]`, `font-ui 14px/500`, entrada `slide-up .3s`. Lo que cambia es dónde vive la acción.

Fila única, `items-center`, `gap-[14px]`:

`[tick 24px] [mensaje] │ [Deshacer] [✕]`

- **Mensaje** — `min-w-0 flex-1`, `leading-snug`, **máximo 2 líneas** (`line-clamp-2`, elipsis al final). No contiene cifras (ver §8).
- **Divisor** — `w-px h-5 bg-current opacity-[0.22] shrink-0`. Usa `currentColor` (= `--paper`), así contrasta igual en claro y oscuro. Es lo que hace que la acción se lea como **control** y no como parte de la frase. *(Affordance.)*
- **Acción** — `shrink-0 whitespace-nowrap text-center min-w-[104px]`, 14px **700**, color `--paper` pleno, con el subrayado `tlink` vigente (`border-b border-b-current pb-px`). Hover `opacity-80`, focus visible `ring-2 ring-current` sobre `rounded-ctl`.
  - **Hit area 48px sin engordar el pill:** el botón mide ~34px visibles; el blanco se extiende con `relative` + `after:absolute after:-inset-y-[7px] after:inset-x-0` (≥44px, regla de accesibilidad). Subir el alto real del botón crecería el pill a 68px y arruinaría el apilado.
  - **`min-w-[104px]` es anti-layout-shift:** reserva el ancho del rótulo más largo (`Deshaciendo…`), para que el pill no se ensanche al pasar a en-vuelo. Mismo criterio que el botón *Mes en curso*.
- **✕** — sin cambios, siempre habilitado (también en vuelo).
- **Por qué inline y no debajo:** debajo el pill crece ~18px por toast (con 3 apilados son 54px más de pantalla tapada), y el blanco queda en una tira de texto de ~16px de alto. **Inline la acción no cuesta alto propio:** a igual cantidad de líneas del mensaje, un toast con acción mide exactamente lo mismo que uno sin acción. Lo que la acción cuesta es **ancho de mensaje** (119px: divisor 1 + gap 14 + botón 104), y ese costo se compensa en el ancho del pill (abajo), no dejando que se pague en líneas.

**Ancho del pill — dos reglas, no una.**

- **Toast sin acción:** `max-w-[min(460px,calc(100vw-32px))]`. Ancho natural, capeado.
- **Toast con acción:** **ancho fijo** `w-[min(520px,calc(100vw-32px))]`. No es un rango `min-w`/`max-w`: es **una sola propiedad**.
  - **Por qué fijo y no un rango.** El pill con acción es un blanco de clic que además **se reemplaza en su misma posición** (§5, identidad de grupo) mientras el puntero viaja hacia él. Con un rango, dos movimientos de nombres distintos producen dos pills de **anchos distintos en el mismo slot**: el blanco cambia de tamaño bajo el cursor. Es el mismo modo de falla que §5 previene en el eje vertical, en el eje horizontal. Ancho fijo = geometría estable entre toasts sucesivos. *(Prevención de error.)*
  - **Por qué 520 y no 460.** El toast con acción carga 119px de cromo que uno normal no tiene. A 460px su columna de mensaje queda en **227px** contra los 360px de un toast sin acción: 37% menos de texto por la sola presencia del botón. Subir a 520 devuelve **287px** de mensaje. A 520 el pill entra con holgura en el piso soportado (520 + 32 = 552 ≤ 640).
  - **Prohibido `min-width` sin clamp — regla general del DS.** En CSS `min-width` **gana sobre** `max-width`: un piso fijo (`min-w-[320px]`) convive con un clamp de viewport (`max-w-[…100vw-32px]`) hasta que se cruzan, y a partir de ahí **el elemento se sale de la pantalla**. Ningún elemento del DS declara un piso de ancho que su propio clamp de viewport no pueda vencer: o se usa una sola propiedad `width: min(deseado, clamp)` (lo que se hace acá), o el piso se escribe también clampeado (`min-width: min(piso, clamp)`). Aplica a todo el sistema, no solo al toast.
- **El desenlace (c/d) no hereda el ancho.** El toast que reemplaza al de acción ya no tiene acción, así que toma la regla sin acción (natural, ≤460): se **angosta**. Es correcto y esperado, no un defecto — para ese momento el blanco de clic ya no existe y la pila no se reordena (los demás pills no se mueven al cambiar el ancho de uno). Lo que sí puede mover la pila es un cambio de **cantidad de líneas** en el swap; ocurre una sola vez, después del clic, sin ningún blanco en vuelo.

**Presupuesto de ancho del mensaje (aritmética cerrada, no re-derivable).** Pill 520 − padding (16 + 14) = 430… es decir: contenido **490**; menos tick 24, divisor 1, acción 104, ✕ 18 y **4 gaps de 14 (=56)** ⇒ **columna de mensaje = 287px**. Con `leading-snug` (19,25px por línea): **1 línea ⇒ pill de 48px** (lo fija el tick de 24 + 24 de padding, no el texto), **2 líneas ⇒ 63px**. El pill **no** llega a 68px: ese número, que aparecía en §5 y §6, era una estimación vieja; el valor real de dos líneas es **63px**.

**El tick no cambia.** Sigue el mapeo vigente por tipo (`success`→`--income`, `error`→`--expense`, `warning`→`--warning`, `info`→`--accent-ink`). No se re-abre acá.

### 2. Copy

| Acción | Mensaje | Tipo |
|---|---|---|
| Edición (las 4 formas) | **"Actualizado: ‘{Nombre}’."** | `success` |
| Eliminación (las 4 formas) | **"Eliminado: ‘{Nombre}’."** | `success` |

- **`{Nombre}`** = la descripción del movimiento; si no tiene, el **nombre de la categoría** (misma regla de identidad que el diálogo de eliminar y la fila de `/historial`). Comillas tipográficas simples ‘ ’, como el toast de método predeterminado.
- **Nombrar el movimiento es obligatorio, no adorno.** Con dos o tres toasts con Deshacer conviviendo (§5), un copy genérico deja al usuario eligiendo a ciegas cuál revertir: el riesgo no es estético, es **deshacer el movimiento equivocado**. *(Prevención de error.)*
- **Cae "correctamente" y cae "Movimiento"** — ninguno de los dos discrimina (el tick verde ya dice "salió bien"; el usuario acaba de tocar un movimiento y no otra cosa) y los dos le roban ancho al nombre, que es lo único que identifica. **El nombre va lo más cerca posible del comienzo de la frase:** es lo que lo protege del `line-clamp`, porque lo que se corta es siempre el final. Con 287px de columna, "Actualizado: ‘{Nombre}’." deja al nombre ~23 caracteres en **una** línea y ~63 antes de la elipsis en dos; con el molde viejo ("Movimiento actualizado: …") el nombre nunca entraba en una línea. *(Carga cognitiva + prevención de error.)*
- **Un solo molde para las 4 formas.** El calculado deja de nombrar su estructura ("Movimiento calculado actualizado."): el **nombre** identifica mejor que la estructura, y un molde único evita cuatro frases distintas para el mismo evento. *(Consistencia.)*
- **Rótulo de la acción: "Deshacer"** — el mismo verbo, la misma palabra que en `/historial`. Ni "Deshacer cambio" (más largo y falso en la eliminación) ni "Revertir".

### 3. Duración y pausa

- **Toast con acción: `8000 ms`.** Constante nombrada aparte del default. El default de los toasts sin acción **sigue en `5000 ms`** y no se toca.
  - **Por qué 8 y no 5:** 5s alcanzan para *leer* una confirmación, no para **leer + decidir + llegar**. El presupuesto real es lectura del mensaje con nombre (~1,5–2s) + decisión "¿quise hacer esto?" (~2s) + viaje del puntero desde donde el usuario hizo clic (footer de un modal, kebab de una fila, centro de pantalla) hasta el pill de abajo-centro (~1s), más margen para el usuario cuya atención ya volvió al listado. 5s corta ese trayecto justo cuando la mano ya salió; el fracaso es total (el atajo no existe) y el costo del error también (hay que ir a `/historial`).
  - **Por qué no 10 o 12:** con hasta 3 pills apilados y 8s cada uno, la banda inferior ya queda ocupada un rato largo; más tiempo aumenta la ventana en la que el toast **queda obsoleto** (el usuario deshizo desde `/historial`) y la chance de tapar chrome. 8s es el punto donde el atajo es realmente alcanzable sin volverse ruido persistente.
- **Pausa por hover y por foco — regla general de todos los toasts.** El auto-dismiss se **pausa** con el puntero sobre el pill (`pointerenter`) o con el foco dentro (`focus-within`), y **reanuda** al salir con el **tiempo restante, nunca menos de 2000 ms** (para que no se evapore 200ms después de que el usuario retiró el puntero).
  - Sin pausa, el caso más frecuente del undo es también el peor: el usuario acerca el cursor al botón y el toast desaparece **debajo del cursor**. Es la falla clásica de un blanco efímero.
  - **No** se pausa por pestaña oculta (`visibilitychange`): decidido que no, para no acumular toasts viejos al volver.

### 4. Ciclo de vida de la acción

**a. Reposo.** El toast se comporta como cualquier otro: 8s con pausa por hover, ✕ disponible.

**b. En vuelo (`isUndoing`).** El clic en Deshacer **no cierra el toast** (hoy el sistema lo cierra en el mismo tick: acá **no**).
- El temporizador se **cancela definitivamente** — un toast comprometido con una operación en curso no puede evaporarse a mitad de camino.
- El botón pasa a **"Deshaciendo…"**, `disabled`, `aria-busy="true"`, `opacity-70`, `cursor-default`, **sin el subrayado** (un control inactivo no debe seguir pareciendo clickeable) y sin hover. El ancho no se mueve (`min-w-[104px]`).
- **Sin spinner.** Un spinner dentro de un botón de texto de 14px es ruido; el cambio de rótulo es el feedback, y es el patrón ya establecido en la app ("Eliminando…", "Deshaciendo…" del modal de `/historial`). *(Consistencia.)*
- El **✕ sigue habilitado**: cerrar el toast **no cancela** la operación; el desenlace igual se anuncia (c/d/e). Nunca se atrapa al usuario en un pill.

**c. Éxito.** El toast de origen **se descarta** y en **su misma posición** aparece `toast.success` **"Cambio deshecho."** — 5s, **sin acción**.
- **Por qué toast y no silencio:** el efecto puede no ser visible (el usuario está parado en otro mes, o la fila restaurada queda fuera de vista). Y es **exactamente el copy de `/historial`**: misma operación, mismas palabras. *(Consistencia + feedback.)*
- El intercambio es 1↔1: la pila **no crece**.

**d. Obsoleto (404 — la entrada ya se deshizo desde `/historial` o venció).** El toast de origen **se descarta** (su acción ya no significa nada) y en su posición aparece **`toast.warning`**: *"Este cambio ya no está disponible para deshacer."* (el mensaje que ya resuelve `useUndoHistory`).
- **Ámbar, no rojo y no info.** Regla general que se fija acá: **si algo que el usuario pidió explícitamente quedó sin hacer, el tono es al menos `warning`; `info` queda para desenlaces donde nada de lo pedido quedó pendiente** (precedente: "Ya estás al día." de Datos externos). Rojo sobra: no hubo falla, y no hay nada que reintentar.

**e. Error reintentable (red / 5xx).** El toast de origen **NO se descarta**: vuelve a **reposo** con el botón "Deshacer" restaurado y un temporizador **nuevo de 8s**; encima aparece `toast.error` *"No se pudo deshacer el cambio. Intentá de nuevo."*
- Espeja la regla ya cerrada de `/historial` (*"el modal queda abierto y el botón vuelve a su estado normal"*): el reintento no debe obligar a ir a buscar la entrada. *(Flujo, sin callejones.)*

**f. Sin confirmación previa.** El toast **acciona directo**, no abre el modal de `/historial`. La confirmación de RF-HIST-003 protege un deshacer **frío** (una entrada elegida en una lista, minutos u horas después); acá el usuario está a 8 segundos de su propia acción, mirando el nombre del movimiento que acaba de tocar — el modal sería fricción sobre una decisión ya tomada, y anularía el sentido del atajo. El riesgo de disparo accidental se contiene con el divisor, el hit area acotado y el rótulo explícito. *(Ver §7: exige confirmación del analista sobre RF-HIST-003.)*

### 5. Apilado e identidad

- **Orden:** el más nuevo **abajo** (más cerca del borde de origen y del puntero); la pila crece hacia arriba. `gap-[10px]`, `bottom-[26px]`, centrado al **viewport** (es chrome global, no contenido de `<main>`).
- **Tope de 3 pills visibles.** Al llegar el cuarto se descarta el **más viejo**, con una excepción dura: **nunca se descarta un toast con acción en vuelo**; en ese caso cae el más viejo que no esté en vuelo.
  - Con 8s y pills de 48px, sin tope la banda inferior se convierte en una pared: 5 pills tapan 300px de pantalla y el usuario ya no distingue cuál es cuál. Tres es el techo donde todavía se lee y se elige bien.
  - Geometría con 3: `26 + 3×48 + 2×10 = 190px` de banda ocupada. Con los tres mensajes en 2 líneas (63px cada uno) el peor caso es `26 + 3×63 + 2×10 = 235px`.
- **Identidad de grupo — un toast de deshacer por movimiento.** El toast declara la identidad del **movimiento** al que pertenece. Emitir otro con la misma identidad **reemplaza al anterior conservando su posición y su índice en la pila** (no sale por abajo y vuelve a entrar): el blanco no salta bajo el cursor. Toasts de **movimientos distintos conviven**.
- **El toast de desenlace (c/d) hereda la posición del que reemplaza**, por el mismo motivo.

### 6. Contención responsive (obligatoria)

**Alcance: el piso es 640px (`--bp-floor`) y el gate cubre lo de abajo.** Por debajo de 640px la app está **gateada** (§ Ancho mínimo soportado / El gate): no hay pantalla que contener. El toast es chrome global montado en `z-[90]`, por encima de casi todo — **el gate lo cubre igual**: el bloqueo es a viewport completo y **ningún pill queda visible por debajo del piso**. Medir el toast a 324px o 374px de viewport no mide un estado soportado: mide un gate que no está tapando lo que debe. Si en QA aparece un pill bajo el piso, el hallazgo es **del gate**, no del toast.

- **Ancho:** el pill con acción es **ancho fijo** `w-[min(520px,calc(100vw-32px))]` y el pill sin acción `max-w-[min(460px,calc(100vw-32px))]` (§1). **Ningún `min-width` sin clamp** — el piso `min-w-[320px]` queda **retirado**: cruzaba el clamp a 352px de viewport y, como `min-width` gana sobre `max-width`, sacaba el pill de la pantalla por los dos bordes. Aunque ese ancho está bajo el piso soportado, el defecto se corrige igual: un elemento **jamás** debe poder desbordar el viewport, esté o no en un ancho que se promete. El clamp `calc(100vw-32px)` ahora es la última palabra en todo ancho. El pill es `fixed` sobre el viewport, así que **el estado del sidebar no lo afecta**: no se angosta ni se corre.
- **El mensaje envuelve, la acción no.** Mensaje `min-w-0` + `line-clamp-2`; acción y ✕ `shrink-0`. El pill crece de alto (48→63px) antes que empujar la acción fuera.
- **El ancho de mensaje es constante en todo ancho soportado.** Con el pill fijo en 520, la columna de mensaje mide **287px a 640px, a 941px, a 1120px y a 1920px** — el toast no tiene régimen compacto: se comporta idéntico en toda la franja. Eso hace que el criterio de no-truncado se verifique **una sola vez** y valga para todos los anchos.
- **Truncado permitido solo en texto, y el nombre nunca desaparece entero.** El nombre puede terminar en elipsis, pero el copy lo pone al comienzo de la frase (§2): con 287px × 2 líneas, la elipsis recorta **el final de un nombre largo**, nunca llega a comerse la frase antes del nombre. **No hay cifras en este copy**; si alguna vez se agregara un monto, iría en **mono tabular** y **no truncaría jamás** (regla dura 3).
- **Los cuatro invariantes:**
  1. *Sin scroll horizontal del `body` (≥640px, sidebar abierto o cerrado):* `fixed` + ancho clampeado a `100vw-32px` en una sola propiedad + `translate-x-1/2`; el toast no participa del flujo ni del ancho de `<main>`.
  2. *Modales completos y scrolleables:* el toast no es modal ni bloquea. **Colisión conocida:** el viewport de toasts es `z-[90]` y los modales `z-40/50`, así que un pill puede solaparse con el **footer de un modal alto en viewport bajo** (riesgo preexistente que los 8s agravan). Se mantiene el ancla abajo-centro —mover el toast según haya modal haría impredecible el blanco del undo—, y la contención real es que el pill **nunca atrapa**: ✕ siempre habilitado, `pointer-events` solo en el pill (el contenedor es `pointer-events-none`) y auto-dismiss. **Se verifica en QA** (700×640 con el form de movimiento abierto); si el solape tapa un botón del footer, la salida acordada es la **excepción de posición top-center mientras haya un modal abierto**, que requiere decisión explícita del usuario.
  3. *Ninguna acción inalcanzable:* acción y ✕ **siempre visibles** (nunca hover-only), hit area ≥44px (48px real vía `after`), y con 3 pills apilados la banda ocupada (≤235px) deja libre el resto de la pantalla también a 640px de alto.
  4. *Superficies anchas scrollean dentro de sí:* **no aplica** — el toast no es una superficie de datos; su contención es wrap + clamp de ancho.

### 7. Agregados más allá del brief — estado

1. **Cambio de copy de los toasts existentes** (cae "correctamente", **cae "Movimiento"**, entra el nombre del movimiento, el calculado pierde su frase propia): **decidido acá** por la necesidad de identidad con toasts apilados y por el presupuesto de ancho de §1. El texto final lo fija el analista. **Si el analista rechaza acortar a "Actualizado: ‘{Nombre}’.", el ancho fijo de 520px sostiene igual la restricción dura** (el nombre sigue legible: con el molde largo entran ~53 caracteres de nombre en dos líneas); lo que se pierde es el pill de 48px en el caso típico, que pasa a 63px siempre.
2. **Reglas generales del sistema de toasts** que esta feature introduce y aplican a **todos**: pausa por hover/foco, tope de 3, ancho del pill (clamp de viewport, y **la prohibición de `min-width` sin clamp**, que es regla de todo el DS). **Agregado no solicitado — confirmar.**
3. **Sin modal de confirmación en el atajo** (§4.f): choca con la lectura literal de RF-HIST-003 ("Deshacer siempre pide confirmación"). **Requiere que el analista acote la exigencia de confirmación a la superficie `/historial`.**
4. **El copy de los diálogos de eliminar miente hoy** — *"Esta acción es permanente y no se puede deshacer."* (`delete-transaction-dialog`, `delete-recurring-dialog`) y *"Esta acción es permanente."* (`delete-installment-dialog`). Ya era falso desde `/historial`; con el botón en el toast es una contradicción a un segundo de distancia. **Reemplazo propuesto:** *"Vas a poder deshacerlo desde el historial."* **Agregado no solicitado — confirmar con el analista.**

### 8. Reglas duras reafirmadas

- **Sin verde/rojo fuera de su semántica en la acción:** el botón Deshacer es `--paper` sobre `--ink`, neutro. El tick conserva el mapeo por tipo ya vigente.
- **Sin índigo en el pill.** El acento no participa del toast (ni en el botón, ni en el foco: el anillo es `currentColor`).
- **Sin cifras en el copy** — y si alguna entrara, mono tabular sin truncado.
- **Los dos modos de color:** el pill es `--ink`/`--paper` (se invierte solo), divisor y foco son `currentColor`, y el tick usa tokens semánticos. Nada asume claro.

### Checklist de aceptación visual — Toast con Deshacer

*Presencia y copy:*
- [ ] Editar un movimiento (probar **las 4 formas**: único, fijo, calculado, cuotas) emite un toast `success` con el texto **"Actualizado: ‘{Nombre}’."** y un botón **Deshacer**.
- [ ] Eliminar (las 4 formas) emite **"Eliminado: ‘{Nombre}’."** con **Deshacer**.
- [ ] Un movimiento **sin descripción** muestra el **nombre de la categoría** entre comillas.
- [ ] **Crear** un movimiento emite el toast de siempre, **sin** botón Deshacer.
- [ ] En ningún toast aparece "correctamente" **ni la palabra "Movimiento"**; el calculado usa el **mismo** molde que los otros tres.

*Anatomía:*
- [ ] La acción está **a la derecha del mensaje**, en la misma línea, separada por un **divisor vertical** tenue, con el ✕ al final. **No** debajo del mensaje.
- [ ] A igual cantidad de líneas del mensaje, un toast con acción tiene **el mismo alto** que uno sin acción. Alturas esperadas del pill: **48px con el mensaje en 1 línea, 63px en 2**. Ningún otro valor.
- [ ] Con un nombre corto (ej. "Alquiler") y el copy vigente, el pill mide **48px** (mensaje en **una** línea).
- [ ] `Tab` llega a Deshacer y a ✕ con **foco visible**; el blanco de clic de Deshacer es cómodo (~48px de alto, se activa un poco por arriba y por debajo del texto).

*Ancho y no-truncado (medible en el DOM):*
- [ ] El pill **con acción** mide **exactamente 520px** de ancho en **640, 941, 1120 y 1920** de viewport (y sigue midiendo 520 con el sidebar abierto y cerrado: el toast es `fixed`, el sidebar no lo toca). **No** hay ningún `min-width` en el pill.
- [ ] El pill **sin acción** no supera **460px** y toma su ancho natural. El toast de desenlace ("Cambio deshecho.") **se angosta** respecto del pill de 520 que reemplaza: es lo esperado, no un defecto.
- [ ] **Columna de mensaje = 287px** (`clientWidth` del `<p>`) en los cuatro anchos de arriba. Es constante: el toast no tiene régimen compacto.
- [ ] **Criterio de no-truncado:** en el `<p>` del mensaje, con un nombre de **hasta 23 caracteres**, `scrollHeight === clientHeight` **y** `clientHeight ≈ 19px` (una línea). Con un nombre de **hasta 60 caracteres**, `scrollHeight === clientHeight` con `clientHeight ≈ 39px` (dos líneas, sin recorte). Verificar en **640 y 1920**.
- [ ] **El nombre nunca se pierde:** con un nombre deliberadamente largo (>80 caracteres) el mensaje sí recorta (`scrollHeight > clientHeight`), pero en pantalla se lee **"Actualizado: ‘" + el comienzo del nombre**; la elipsis cae **dentro** del nombre, nunca antes de él.
- [ ] **Ningún borde cortado:** el `x` del pill (`getBoundingClientRect`) es **≥ 16** y `x + width ≤ innerWidth − 16` en **640, 941 y 1920**. Verificar también a **660** y **700** (los anchos donde el pill ocupa mayor proporción de pantalla).

*Duración y pausa:*
- [ ] El toast con Deshacer dura **~8s**; uno sin acción sigue durando **~5s** (comparar con el toast de crear).
- [ ] Con el **puntero encima**, el toast **no se cierra** (esperar >10s); al retirar el puntero se cierra recién después de un par de segundos.

*En vuelo:*
- [ ] Al hacer clic en Deshacer el toast **no se cierra**: el botón pasa a **"Deshaciendo…"**, deshabilitado, sin subrayado y **sin spinner**.
- [ ] El pill **no cambia de ancho** al pasar de "Deshacer" a "Deshaciendo…".
- [ ] Durante ese estado el **✕ sigue funcionando**, y si se cierra el toast igual aparece el toast de desenlace.

*Desenlaces:*
- [ ] Éxito → el toast se reemplaza **en su misma posición** por `success` **"Cambio deshecho."** (sin botón); la pila **no crece**; el cambio se ve reflejado en `/mes` y en `/historial` (la entrada desapareció).
- [ ] Deshacer una **eliminación** desde el toast hace **reaparecer** el movimiento en la lista del mes.
- [ ] **Obsoleto:** editar → ir a `/historial` en otra pestaña/paso y deshacer ahí → volver y usar el toast ⇒ toast **ámbar (`warning`)** *"Este cambio ya no está disponible para deshacer."*, **no rojo**.
- [ ] **Error reintentable** (backend caído): aparece toast **rojo** *"No se pudo deshacer el cambio. Intentá de nuevo."* **y el toast original sigue en pantalla con su botón "Deshacer" restaurado**.

*Apilado:*
- [ ] Editar/eliminar **3 movimientos distintos** seguidos ⇒ **3 pills apilados**, el más nuevo **abajo**, `10px` entre ellos, todos legibles y cada uno con su nombre.
- [ ] Un **4º** toast hace desaparecer el **más viejo** (nunca uno que esté en "Deshaciendo…").
- [ ] Editar **dos veces el mismo movimiento** ⇒ queda **un solo** toast de ese movimiento, **en la misma posición** (no salta al final de la pila); los toasts de otros movimientos siguen ahí.

*Contención y modos:*
- [ ] A **640px** de viewport (sidebar abierto y cerrado): el pill entra completo, **sin scroll horizontal del `body`**, y no se corre ni se angosta al abrir/cerrar el sidebar.
- [ ] **Por debajo de 640px no se evalúa el toast, se evalúa el gate:** a **375px** y a **324px** con un toast recién emitido, la pantalla muestra **solo el gate** y **ningún pill queda visible** (ni asomando, ni por encima del bloqueo). Si se ve un pill, el hallazgo es del **gate** (`z-index` del bloqueo vs. `z-[90]` del viewport de toasts), no del toast.
- [ ] A **700×640** con el **form de movimiento abierto**: verificar que un toast no tape los botones del footer del modal; si los tapa, reportarlo (queda pendiente de decisión, §6 invariante 2).
- [ ] Se ve correcto en **claro y oscuro**: pill invertido, divisor y foco visibles en ambos, tick con su color semántico.

---

## Specs de fase

El lenguaje visual vigente y reutilizable que salió de cada fase de implementación está consolidado en las secciones de arriba. Las decisiones puntuales de cada fase, una vez implementadas, dejan de tener documento propio: lo que sobrevive es la regla en presente; el "cuándo/por qué cambió" vive en el historial de git.
