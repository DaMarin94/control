# Fundamentos — lenguaje visual de Control

> Parte de la guía viva de diseño (índice: `docs/design.md`). **Se lee SIEMPRE** antes de cualquier spec o evaluación: reglas duras, tokens, tipografía, espaciado, geometría, sombras, focus, modo de color, jerarquía y contención responsive. Los patrones de componente/feature viven en los otros archivos de `docs/design/` y apuntan acá.
>
> Sistema: **"Precise Ledger"**, densidad Medio, acento Índigo. Dos **modos de color** — **claro** y **oscuro** — con default **Sistema** (sigue `prefers-color-scheme`); el lenguaje visual es el mismo en ambos, cambia la paleta de tokens. La densidad variable no está en v1.
>
> Relación con los otros documentos: `docs/design/control.css` + `docs/design/README.md` son el handoff crudo del prototipo (no se editan); `docs/frontend.md` (secciones Design system) es el "cómo" técnico; esta guía es el "qué" visual vigente y prevalece ante conflicto con el handoff crudo.

---

## Reglas duras

No se negocian sin decisión explícita del usuario:

1. **Verde = ingreso, Rojo = gasto.** Reservados **estrictamente** para ese significado semántico. No se usan para decorar ni para otra cosa.
2. **El acento índigo es solo marca.** NUNCA se usa para montos ni para teñir cifras de dinero.
3. **Toda cifra de dinero va en mono tabular** (IBM Plex Mono + `font-feature-settings: "tnum" 1`). Sin excepción.
4. **Compatibilidad visual total en cualquier dispositivo.** Toda pantalla y componente se ve correcto en **ambos modos de color** (claro y oscuro) y en cualquier tipo de dispositivo. Ninguna superficie, texto, borde, sombra o estado puede asumir un único modo: cada token semántico tiene su valor en claro y en oscuro (ver *Modo de color — claro / oscuro*), y las reglas duras 1–3 se cumplen **idénticas** en los dos modos. (Única excepción declarada: el fondo negro fijo del gate de arranque — ver `gate-arranque.md`.)

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
| Body secundario (bajada) | 14.5px | 400 | — |
| Mensaje de diálogo | 14px | 400 | — |
| Monto en fila | 15.5px | 600 | — |
| Eyebrow / label | 12px | 600 | .1em, uppercase |
| Group header (Únicos…) | 13px | 700 | .1em, uppercase |
| Meta / subtítulos | 12.5px | 500 | — |
| Nota / fine print | 12.5px | 400 | — |
| Micro-label (visualización) | 9px | 600 | .08em, uppercase |

**`Eyebrow / label` — un solo rol para todo label chico en mayúsculas.** Cubre los tres usos: el **eyebrow de página** (la línea sobre el título: "Bienvenido", "Reportes", "Configuración"), el **label de sección** (header de popover, de filtro, de columna) y la **etiqueta de stat-card** (el nombre que encabeza una cifra: "Gastos", "Ingresos", "Balance de junio"). Los tres resuelven el mismo problema —nombrar, en el rango tipográfico más bajo, la cifra o el bloque que viene a continuación— y por eso usan **el mismo valor: 12px / 600 / .1em / uppercase**. **No hay variante de tamaño por contexto:** la jerarquía entre un eyebrow de página y una etiqueta de card la da la **posición y el color**, no medio punto de tamaño — dos tamaños imperceptiblemente distintos para el mismo rol solo producen deriva. Un label en mayúsculas que difiera en size o tracking de esta fila está fuera de la escala.

- **Color del rol:** `--muted` por defecto. Sobre una **superficie de acento rellena** (balance hero del dashboard, mini-balance de `/mes`) el rol se pinta como texto sobre acento (`white/70`): el color lo decide la **superficie**, no el rol. No es un rol aparte.
- Los **micro-labels de gráficos** (ejes, leyendas y anotaciones de 9–11px dentro de las cards de reportes) **no** son este rol: viven en el espacio propio de la visualización y no tienen fila en esta escala.

**`Mensaje de diálogo` — el texto que enuncia la decisión.** Es la frase principal de una superficie modal: la oración que dice **qué se va a hacer y sobre qué objeto** ("Se va a eliminar la categoría *Supermercado*", "Se deshace el movimiento…", "Este método existe pero está inactivo"). Valor: **14px / 400 / `--ink`**, Space Grotesk, `line-height 1.5`. Es el **único texto a 14px de la escala de página** y cubre las dos familias de modal: los diálogos de confirmación destructiva (categoría, método de pago, fijo, cuotas), la confirmación de deshacer y los prompts de reactivación.

- **Por qué `--ink` y no `--muted`:** no es prosa de apoyo, es **el contenido de la pantalla**. En un diálogo el mensaje *es* la tarea —el usuario lee esa única frase para decidir— y por eso toma el color de texto principal, aunque mida menos que el body base. El título de 18px nombra la acción; el mensaje de 14px la enuncia con el objeto concreto. Esa es toda la jerarquía que el diálogo necesita.
- **Por qué 14px y no 14.5px:** `Body secundario` (14.5/400) es apoyo de un título grande y vive en `--muted`; el mensaje de diálogo es contenido y vive en `--ink`. Separar medio punto mantiene los dos roles distinguibles por size **además** de por color, y evita que un mensaje de diálogo se escriba por error con la caja de una bajada.
- **Variante `--muted` — frase líder de un estado vacío de card de reporte.** El mismo valor de size y weight (14px / 400) se usa para la **única frase** que ocupa el lugar del dibujo cuando una card de reporte no tiene datos ("Sin movimientos en {year}", "Ningún gasto fijo tiene dos apariciones en el rango"). Ahí el color es **`--muted`**: no hay decisión que tomar ni objeto sobre el que actuar —es la **ausencia** de contenido, no el contenido—, y el bloque entero es subordinado a la card que lo contiene. Es la misma fila con el color que le corresponde a su superficie, no un rol aparte. **El cuerpo** de un estado vacío (la frase que explica cómo salir del vacío, debajo de la líder) no es esta fila: baja a `Nota / fine print` por la regla de subordinación.
- **Énfasis inline:** el nombre del objeto afectado dentro del mensaje puede subir a **600** (y a mono tabular si es una cifra o una fecha, por regla dura 3) sin cambiar el size de la fila. Es lo que hace que el usuario reconozca *cuál* objeto está por tocar.
- **Disposición compacta:** el rol **no cambia de size ni de color** por debajo de `--bp-wide`. Un modal angosto contiene el mensaje haciéndolo **envolver en más líneas**, nunca reduciéndolo: a 14px ya está en el piso de lo legible para texto corrido, y bajarlo rompería accesibilidad justo en la frase que decide una acción destructiva. Las cuatro invariantes se mantienen: el mensaje sigue siendo el primer texto después del título (jerarquía), conserva `--ink` (contraste), no se trunca ni se recorta con ellipsis (ninguna parte de la decisión queda oculta) y las cifras que contenga siguen en mono tabular.

**`Meta / subtítulos` — variante mono.** Cuando el texto de este rol es una **fecha, un contador o una cifra** (la fecha de la fila de movimiento, `Cuota 3/12`, el `12 movimientos` de una stat-card), va en **IBM Plex Mono tabular** por la regla de cifras de § Tipografía; **size (12.5px), weight (500) y color no cambian**. La variante mono no es un rol nuevo.

### Prosa secundaria — dos filas y una regla de subordinación

La escala tiene **dos filas para texto corrido que no es el contenido principal**. Las dos van en `--muted`, `line-height 1.5`, weight **400** (es prosa: no lleva peso) y sin tracking.

| Fila | Valor | Qué es |
|---|---|---|
| **`Body secundario`** | 14.5px / 400 / `--muted` | La **bajada**: la frase de apoyo inmediatamente debajo de un **título de pantalla** (H1 32px) o de **sección** (H2 18px). Una o dos frases, nunca un párrafo largo. |
| **`Nota / fine print`** | 12.5px / 400 / `--muted` | La **letra chica**: ayuda de campo, nota al pie de un form, descripción de una opción de menú o popover, cuerpo de un estado vacío, línea de consecuencia de una acción en un diálogo, pie de las pantallas de acceso. |

**Regla de subordinación — el apoyo nunca iguala al texto que apoya.** `Body secundario` solo acompaña a un título de **18px o más**. Cuando el texto al que apoya mide **≤ 15.5px** —cuerpo de diálogo, frase líder de un estado vacío, título de card de 14.5px— el apoyo baja a `Nota / fine print`. Esto resuelve sin ambigüedad el caso que más deriva produce: un diálogo queda en 14px (mensaje) + 12.5px (consecuencia), y una bajada de pantalla en 32px + 14.5px.

**El par del diálogo, explícito.** El mensaje del diálogo es uno de los textos que **reciben** apoyo, no uno de los que apoyan: su fila es `Mensaje de diálogo` (14px / 400 / `--ink`) y su apoyo —la **línea de consecuencia**, la que dice qué pasa con los datos asociados ("Los movimientos registrados con esta categoría no se eliminan", "Se recalculan las cuotas siguientes")— es `Nota / fine print` (12.5px / 400 / `--muted`). Nunca al revés y nunca iguales: la consecuencia no sube a 14px (competiría con la frase que enuncia la decisión) y el mensaje no baja a 12.5px (dejaría al diálogo sin texto principal). El mismo par rige el estado vacío de una card de reporte: frase líder en 14px / `--muted` + cuerpo en 12.5px / `--muted`, distinguidos por size porque comparten color.

- **`Body secundario` y `Nombre de movimiento` comparten los 14.5px** y se distinguen por weight (400 prosa vs. 600 nombre de objeto), igual que `Nota / fine print` y `Meta / subtítulos` comparten los 12.5px y se distinguen por weight (400 prosa vs. 500 dato). La prosa y el dato nunca compiten: el dato lleva peso, la prosa no.
- **Énfasis dentro de la prosa:** una palabra o una cifra pueden subir a `--ink` + 600 (y a mono si es cifra) dentro del párrafo. El énfasis inline **no cambia el size** de la fila.
- **Qué no es prosa secundaria** (y por eso no entra en estas filas): el **texto de un control** (botón, opción, chip, tab) sigue la escala de controles; el **texto con color semántico** (error en `--expense-ink`, aviso en `--warning-ink`) es estado, no prosa; el **meta de un objeto** (fila, card) es `Meta / subtítulos`; el **interior de una visualización** tiene su propia escala (ver abajo).

**`--faint` no es un color de prosa.** Ningún texto que el usuario deba leer va en `--faint`: su contraste no alcanza en los tamaños de estas dos filas. `--faint` queda reservado para **placeholder de input** y para la **marca de dato ausente** (el `—` de una celda sin valor). La letra chica legal también va en `--muted`: es texto que el usuario tiene derecho a poder leer. Cuando un enlace vive **dentro** de un párrafo de estas filas, se distingue en `--ink-2` + subrayado —más oscuro que el texto que lo rodea, y con una señal que no es color.

**`Micro-label` — el único valor canónico del espacio de visualización.** El interior de una card de reporte (eje, leyenda, tooltip, anotación sobre el dibujo, pie de la grilla) **no lo gobierna la escala de página**: compite por píxeles con el dibujo y tiene su propia jerarquía, más densa. De esa jerarquía esta guía fija **un solo valor**: el **`Micro-label`** —el rótulo en mayúsculas que nombra una cifra dentro del dibujo, del tooltip o del pie de la grilla ("prom", "infl", "vs ant", "por cuota", el mes de un tooltip)— en **9px / 600 / .08em / uppercase / `--muted`**.

- **Por qué 9px y no se unifica hacia arriba:** estos rótulos viven en celdas de una grilla de 12 columnas y en tooltips angostos. Subirlos desborda la celda o fuerza wrap en la leyenda, y el costo recae sobre la lectura del gráfico, que es la tarea. La contención se compra donde no cuesta: el **color canónico es `--muted`**, no `--faint`, y eso recupera legibilidad sin tocar un píxel de layout.
- **El micro-label nunca es el único portador del dato.** Es una abreviatura; su nombre completo está disponible en el tooltip de la misma celda (`vs ant` → "Variación vs. mes anterior"). Si un rótulo de 9px fuera la única forma de saber qué significa una cifra, el problema es la composición, no el tamaño.
- **Un rótulo en mayúsculas fuera del dibujo no es micro-label.** Header de popover, label de filtro, label de columna de un diálogo, rótulo de un separador: todos son **`Eyebrow / label`** (12px / 600 / .1em). El espacio de visualización empieza en el dibujo y sus piezas de lectura, no en la card que lo contiene.
- **Qué queda fuera de la tabla, explícitamente:** la prosa y los pares etiqueta–valor del tooltip, la lista de la leyenda y las cifras mono de lectura interna de cada card. Siguen la jerarquía interna de su card y no tienen fila en esta escala. El `navlbl` del sidebar (10.5px / 600 / .12em / `--faint`) también queda fuera: es la escala comprimida propia del sidebar como chrome persistente, y **ese valor no se usa en ninguna otra superficie** — un label con ese valor dentro del contenido es deriva y se corrige a `Eyebrow / label`.

**Contención (régimen de app).** Ninguna de estas tres filas cambia de size al angostar la ventana: la escala tipográfica **no tiene saltos por breakpoint**. La prosa secundaria se contiene por **wrap dentro de su contenedor** (y, cuando hace falta, por `max-w`), nunca por reducción de tamaño ni por truncado — un párrafo truncado pierde información y no es contención. El `Micro-label`, por ser el valor más chico de la app, no se reduce en ningún ancho; si su contenedor no entra, la superficie ancha scrollea dentro de sí misma (invariante 4), no se achica la letra.

---

## Espaciado y densidad

- **Escala de espaciado:** 4, 6, 7, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 40 px.
- **Densidad — preset Medio:** `--row-pad` (fila de lista) **14**, `--card-pad` (interior de tarjeta) **22**, `--gap` (separación de grid) **18**. Los presets Compacto (10/16/13) y Amplio (18/28/24) del prototipo **no están vigentes**; la densidad es fija en v1.

---

## Geometría (radios)

| Token | Valor (Medio) | Uso |
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
- **Qué NO cambia:** los **hex canónicos de categoría** (la matriz de 40 + el pool — ver `categorias-colores.md`) son identificadores fijos — los mismos valores en ambos modos; cambia solo su **presentación** (ver *Categorías y gráficos en oscuro*). Tipografía, radios, densidad y la semántica de las reglas duras 1–3 son invariantes.

### Principios de calibración del oscuro

- **No es un negro puro.** El fondo de app es un gris-azulado muy oscuro (no `#000`), con la misma familia de hue neutro (`270`) que el claro, para que la app no vibre ni "queme". Las superficies suben de luminosidad por capas (`paper` < `panel` < `panel-2` < `panel-3`), igual que en claro pero en sentido ascendente desde un piso oscuro.
- **El texto baja de croma y sube de luminosidad.** `--ink` no llega a blanco puro (reduce halación sobre fondo oscuro); los terciarios mantienen su jerarquía relativa (ink > ink-2 > muted > faint).
- **Los bordes se invierten de polaridad.** En claro, líneas/bordes son `ink` con baja alfa (oscuro sobre claro). En oscuro pasan a ser **blanco con baja alfa** (claro sobre oscuro) — mismo rol, polaridad invertida — para que se lean como separadores sutiles, no como rayas negras invisibles.
- **Semánticos recalibrados, mismo significado.** Verde sigue siendo verde y rojo sigue siendo rojo (regla dura 1), pero sobre fondo oscuro necesitan **más luminosidad** para legibilidad de texto/swatch, y los `-soft` (fondos tintados) dejan de ser casi-blancos: pasan a **tintes oscuros saturados** del mismo hue, sutiles sobre el panel. Los `-ink` (texto sobre `-soft`) suben de luminosidad para contrastar contra el `-soft` oscuro.
- **Sombras dependen más del borde.** En oscuro, una sombra negra "desaparece" sobre fondo oscuro; la elevación se comunica sobre todo por **el escalón de superficie** (`panel` más claro que `paper`) + el **borde superior** sutil. Las sombras se conservan pero con **más opacidad y negro más puro**, como refuerzo, no como única señal de elevación.

### Paleta dark — valores completos (oklch)

> Override de los alias bajo `[data-theme="dark"]`. La columna **Light** repite el valor base (referencia); **Dark** es el valor del override.

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

**Focus ring (dark):** sigue siendo el anillo de 3px en `--accent-soft` (tinte índigo oscuro `oklch(0.34 0.07 264)`) — visible sobre panel oscuro. La variante de **error** usa `--expense-soft` dark (`oklch(0.33 0.06 27)`). Mismo grosor y geometría que en claro.

### Categorías y gráficos en oscuro

Los **hex canónicos de categoría no cambian** (la matriz de 40 + el pool son identificadores fijos, fuente de verdad compartida con el backend; cambiarlos rompería el back-compat). Lo que se define es **cómo se presentan** sobre superficie oscura:

- **Swatch de color sólido (lista de categorías, bandas del apilado, swatch de leyenda):** se usa el **hex tal cual** en ambos modos. Sobre panel oscuro, los hex **oscuros** de la matriz (filas L4–L5) pierden separación del fondo; por eso **todo swatch lleva un hairline de contorno** en dark: borde `1px` `--line` (blanco/alfa 0.12) alrededor del swatch. En claro el contorno es opcional/sutil; en oscuro es regla.
- **Filas claras L1–L2 como fondo de chip:** son pasteles claros, contrastan bien sobre panel oscuro. El **texto** que va sobre un chip pintado con un hex de categoría se calcula por contraste contra **ese hex** (no contra el modo): un fondo claro (L1–L2) lleva texto oscuro; un fondo oscuro (L4–L5) lleva texto claro. El cálculo de contraste es **independiente del modo**, por eso el chip de categoría se ve igual de legible en claro y oscuro.
- **Series de gráfico (Forma 2, apilado por categoría):** las bandas usan el hex de cada categoría sin cambio; sobre fondo de gráfico oscuro, las bandas de hex oscuros se separan entre sí y del fondo con el **gridline/hairline** del propio gráfico. No se recolorea ninguna serie por modo.
- **Ejes, gridlines y tooltips del gráfico:** son **cromo neutro** → consumen tokens (`--line`, `--hair`, `--muted`, `--panel`, `--ink`), así que se adaptan solos al modo. La **Forma 1** (área ingresos vs. gastos) usa `--income`/`--expense` recalibrados; el relleno de área baja su opacidad sobre fondo oscuro (ajustado por `control-frontend`).

### Panel de marca de auth en oscuro

El **panel de marca** del login/registro (`.auth-grid-bg` + `.auth-glow`) está construido **sobre un fondo oscuro de marca** (la grilla y el glow son blanco con baja alfa sobre un panel índigo/oscuro). Por eso ese panel **no cambia entre modos**: es una superficie de marca con su propio fondo, no una superficie de contenido que dependa de los tokens neutros. La grilla (`oklch(1 0 0 / 0.07)`) y el glow (`oklch(1 0 0 / 0.18)`) se mantienen idénticos. La **columna de formulario** del auth sí es superficie de contenido y **sigue los tokens** (paper/panel/ink), por lo que se oscurece con el modo como cualquier pantalla.

### Transición de cambio de modo

- **El cambio de modo es instantáneo en estructura, suave en color.** Al togglear (o al cambiar `prefers-color-scheme` en modo Sistema), los tokens de color cruzan con una **transición corta de `background-color` / `color` / `border-color` de ~0.18–0.20s ease**, aplicada a nivel raíz. No se animan tamaños, posiciones ni layout — solo color.
- **Respeta `prefers-reduced-motion`:** con reduced-motion el cambio de modo es **instantáneo** (sin transición de color).
- **Sin flash en carga (FOUC):** el modo resuelto debe aplicarse **antes del primer paint**. El mecanismo exacto es de `control-frontend`; el comportamiento a cumplir es: la primera pintura ya está en el modo correcto.

### Selector de modo de color (chrome global)

El control del modo de color vive en el **chrome global** (el sidebar / `AppSidebar`), no en una pantalla. Es un control de **chrome persistente**, siempre alcanzable desde cualquier vista. Su forma es un **toggle compacto de 3 iconos** (`Sistema · Claro · Oscuro`).

- **Ubicación — fila propia en el bloque inferior del sidebar, justo encima del `UserMenu`.** El bloque inferior del sidebar queda, de arriba a abajo: CTA "+ Nuevo movimiento" → **fila del toggle de tema** → `UserMenu`. La fila es de ancho completo del contenido del sidebar (248px menos padding lateral), con el toggle **alineado a la derecha** y una etiqueta `--faint` a la izquierda. Va **separada del `UserMenu` por el patrón del DS** (un `--hair` o gap), de modo que se lea como su propio control y no como parte del bloque de cuenta.
  - **Por qué fila propia y no dentro del dropdown del `UserMenu` ni un segmented de labels inline:** (1) el dropdown del `UserMenu` es para acciones de cuenta y abre hacia arriba con poco alto; meter un control de 3 estados ahí lo vuelve un menú denso y esconde el modo tras dos clics. (2) Un segmented con labels de 3 en un track de ~200px quedaría **apretado** dentro de los ~216px útiles del sidebar y competiría visualmente con los nav-links. El **toggle de iconos** ocupa ~108px, respira en la fila, queda siempre visible (un clic) y no compite con la navegación.
- **Forma — toggle de iconos de 3 segmentos (variante compacta del segmented neutro).** Mismo cromo neutro que el segmented del DS, pero los segmentos muestran **solo un icono** (sin label visible):
  - **Track:** `--panel-3`, radio `--r-pill`, padding interno `2px`, `inline-flex`. Ancho intrínseco al contenido (no estira a 100%): 3 segmentos cuadrados.
  - **Segmentos:** 3 botones de **ancho igual**, cada uno `~32–34px` de lado (target táctil ≥32px en el lado corto), icono lucide centrado `size 16`, radio `--r-pill`.
  - **Iconos (orden fijo izq → der):** `Monitor` (Sistema) · `Sun` (Claro) · `Moon` (Oscuro). El icono **es** el control: no hay label textual visible.
  - **Thumb deslizante:** `--panel` + `--shadow-sm`, entre 3 posiciones (`left = calc((i/3)*100% + 2px)`, `width = calc(33.33% - 4px)`), transición `[left,width]` 140ms ease-out; instantánea con `prefers-reduced-motion`.
  - **Color del icono:** *seleccionado* = `--ink`; *no seleccionado* = `--muted` → `--ink-2` en hover. **Sin color semántico ni índigo** en los iconos (cromo neutro de control); el índigo solo aparece como focus ring.
- **Etiqueta de la fila:** a la izquierda del toggle, label corto `--faint` `text-[10.5px] font-semibold uppercase tracking-[0.12em]` "Tema" (mismo molde que el label "Menú" del sidebar). El toggle queda alineado a la derecha (`justify-between`).
- **Cómo se rotula "Sistema" (modo resuelto):** el toggle muestra siempre los 3 iconos; el seleccionado es el que el usuario fijó (incluido `Monitor` para Sistema). El **modo efectivo** cuando está en Sistema **no se rotula visualmente en el chrome**: se comunica por **a11y**. El `aria-label` de cada segmento dice su modo (`"Tema del sistema"` / `"Tema claro"` / `"Tema oscuro"`); cuando Sistema está activo, su `aria-label` resuelto incluye el modo efectivo: `"Tema del sistema (ahora: claro)"` / `"…(ahora: oscuro)"`, recalculado si cambia `prefers-color-scheme`.
- **Estados (idénticos al segmented neutro del DS):** *seleccionado* = thumb `--panel` + `--shadow-sm`, icono `--ink`. *No seleccionado* = icono `--muted` → `--ink-2` en hover. *Focus (teclado)* = ring `--accent-soft` 3px sobre el segmento activo. *Disabled* = `opacity-50` + `cursor-not-allowed` mientras persiste el cambio. El índigo aparece **solo** como focus ring.
- **A11y:** `role="radiogroup"` con `aria-label="Modo de color"` + 3 `role="radio"` con `aria-checked` y `aria-label` por opción (con el modo resuelto en Sistema); flechas ←/→ ciclan por los 3. Como no hay texto visible, **cada segmento debe tener su `aria-label`** (no basta el del grupo).
- **Persistencia:** persiste **en vivo** al seleccionar (sin botón Guardar). El cambio aplica el nuevo modo a toda la app de inmediato (con la transición de color de ~0.18s). Mientras persiste, el toggle queda *disabled*. **No** lleva toast: el flip de color **es** la confirmación.
- **Responsive:** el toggle vive en el **mismo bloque inferior** del sidebar, en su fila propia encima del `UserMenu`, en todos los anchos. El sidebar es un **único elemento de 248px** cuyo mostrar/ocultar lo controla el usuario (ver `sidebar.md` → §Sidebar — mostrar/ocultar); no hay una segunda variante ni drawer aparte. Cuando el sidebar está cerrado, el control de tema queda oculto junto con el resto del bloque inferior.
- **Skeleton:** si el bloque inferior del sidebar tiene estado de carga, el placeholder del toggle es un `SkeletonPill` (radio `--r-pill`) del alto del control (~36px) y ancho del toggle de 3 iconos (~108px). En la práctica el tema se resuelve antes del primer paint (sin FOUC), así que el toggle no suele requerir skeleton propio.

---

## Principios de jerarquía y layout

- **La app es desktop-first.** El target de **la app** es desktop web. El **sidebar** (248px) es chrome que el usuario **muestra u oculta** a voluntad en todo el régimen de app (ver `sidebar.md`), no un elemento que auto-colapsa por breakpoint. Debajo del breakpoint el login pasa a 1 columna y las grillas colapsan a 1 columna. Este principio rige **el régimen de app**; en régimen de captura no se ve la app sino una superficie propia, con su propio lenguaje de densidad (ver `captura.md`).
- **Jerarquía por peso + tamaño + color, no por decoración.** El monto y los totales dominan visualmente; la meta (categoría, fecha, contadores) va en neutros terciarios.
- **Semántica antes que estética:** el color de un monto comunica ingreso/gasto, nunca es decorativo.
- **Movimiento sobrio:** entrada de pantalla fade + translateY (.32s), modal `pop` (scale .98→1, .22s), toast slide-up (.3s), hover .14s. Respetar `prefers-reduced-motion`.

---

## Contención responsive

### Dos regímenes de superficie — la frontera es el tamaño

Control resuelve **dos superficies distintas**, y lo que decide cuál se ve es **el tamaño del viewport**. El dispositivo **no participa del criterio**: no se pregunta si hay mouse, si hay táctil, ni qué aparato es. Un teléfono, una tablet y una ventana de escritorio del mismo tamaño ven exactamente lo mismo.

**Criterio canónico — la dimensión menor del viewport** (canónico en `requirements.md`, RF-APP-003):

| Condición del viewport | Régimen | Qué se ve |
|---|---|---|
| **`ancho < 600px` o `alto < 600px`** (la dimensión **menor** es `< 600px`) | **Régimen de captura** | La **superficie de captura** de un movimiento, o el **acceso** sin sesión → `captura.md` |
| **`ancho ≥ 600px` y `alto ≥ 600px`** | **Régimen de app** | La app completa, con la política de contención de esta sección |

- **Se mide la dimensión menor, no solo el ancho.** Un viewport `932 × 430` está en régimen de captura por su **alto**, aunque le sobre ancho. Un viewport `580 × 900` lo está por su **ancho**.
- **Umbral nombrado:** `--bp-capture` = **600px**, el mismo número en los dos ejes. Se materializa como token para que no se repita en ningún `.tsx`; la condición se expresa como una media query de dos ramas (`max-width` **o** `max-height`), no con JavaScript, para que cruzar la frontera sea instantáneo y sin recarga.
- **El criterio se evalúa en vivo, en los dos regímenes.** Redimensionar la ventana o rotar la pantalla mueve al usuario de un régimen al otro **sin recargar y sin parpadeo**. No hay estado congelado ni medición de una sola vez.
- **Ningún tamaño queda sin producto.** Por debajo del umbral hay siempre algo usable: la superficie de captura. En ningún tamaño la app bloquea, avisa o pide agrandar la ventana.

**Invariantes de la frontera** (visuales, verificables a ojo):

- **Sin flash de superficie equivocada.** Al cargar en cualquier tamaño se pinta directamente la superficie que corresponde: nunca se ve la app por un frame en régimen de captura, ni la superficie de captura por un frame en régimen de app. Mismo estándar de "sin parpadeo" que rige el modo de color.
- **La frontera es continua.** Achicar una ventana de escritorio por debajo del umbral **entra en la superficie de captura**, con su densidad y su composición; agrandarla vuelve a la app. En los dos sentidos, **sin recarga, sin pantalla intermedia y sin bloqueo**.
- **No hay tercera superficie.** Ningún tamaño ve una mezcla: o la app con su contención, o la superficie de captura.

**Todo lo que sigue en esta sección** —breakpoint, piso, los cuatro invariantes, ancho de contenido, checkpoints— **es la política del régimen de app.** La superficie de captura tiene su propio archivo (`captura.md`) y su propio contrato de densidad.

**Vocabulario** (obligatorio, para que doc y diseño no diverjan):

- **Régimen de captura** / **régimen de app** — los dos lados de la frontera de tamaño. **Superficie de captura** — lo que se ve del lado chico.
- "Compacto" y "pantalla chica" nombran **siempre** una **ventana angosta dentro del régimen de app** (`< --bp-wide`, y por definición `≥ 600px` en los dos ejes). Nunca nombran el régimen de captura.
- **No se usan** "celular", "móvil", "mobile" ni "dispositivo" para nombrar el criterio ni la superficie: la frontera es una condición de **tamaño**, y nombrarla por el aparato reintroduce una distinción que el producto no hace.

### La política del régimen de app — contener, no adaptar

Dentro del régimen de app el producto es **desktop-first** y se diseña para desktop web. Cuando la ventana se angosta, el compromiso no es adaptar ni rediseñar: es **contener**. No se promete una buena experiencia en una ventana angosta; se promete que **no se rompe**. Esta distinción es deliberada y acota el trabajo: **ninguna pantalla de la app se rediseña para pantalla chica** — por debajo del umbral de captura no hace falta ese rediseño, porque ahí no se ve la app sino la superficie de captura.

### El breakpoint — un solo umbral nombrado

El sistema tiene **un único breakpoint de layout**: `--bp-wide` = **941px**. Es la frontera entre las dos disposiciones del layout:

- **Amplio** (`min-width: 941px`, `≥ --bp-wide`): disposición desktop plena — grillas multicolumna, login a 2 columnas. (Las **flechas laterales de `PeriodNav`** no dependen de este umbral: tienen su propio umbral derivado `--bp-arrows` = 1288px — ver *Ancho de contenido de página* → *Umbral de flechas*.)
- **Compacto** (`max-width: 940px`, `< --bp-wide`): grillas colapsan a 1 columna; login a 1 columna; flechas laterales de `PeriodNav` ocultas (stepper compacto en el header). **El sidebar no depende de este umbral:** su presencia la controla el usuario en cualquier ancho (ver `sidebar.md`). **Regla de resumen-primero:** cuando una grilla de resumen colapsa al stack de 1 columna, la tarjeta más importante lidera el stack aunque en amplio ocupe otra posición. En las stat-cards de `/mes` (Gastos · Ingresos · Balance) el **Balance** —el resultado neto, el dato que el usuario busca primero— se reordena al tope en compacto (`order-first`), mientras que en amplio conserva su columna hero a la derecha (`1.1fr`). Es reordenamiento visual sobre tarjetas no interactivas: no afecta foco ni orden de lectura de contenido relevante.

No existe escala de breakpoints (`sm`/`md`/`lg`) ni config de `screens`: hay un solo umbral **de layout general** y se lo nombra `--bp-wide`. Cualquier media query nueva usa este umbral (o lo justifica explícitamente si necesita otro). Los otros tres umbrales del sistema son de propósito acotado:

- **`--bp-capture` (600px, los dos ejes)** — la **frontera entre regímenes** (ver *Dos regímenes de superficie*). No es un umbral de layout: decide qué superficie se monta.
- **`--bp-arrows` (1288px)** — umbral **derivado de la geometría** (cap 1120 + 2×84) que gobierna exclusivamente el régimen de `PeriodNav` (flechas + header grande vs. stepper). Es la anchura mínima a la que las flechas overlay entran sin solapar el contenido.
- **`--bp-short` (480px de alto)** — único umbral **de alto**, exclusivo de la superficie de captura y ortogonal a los de ancho (ver `captura.md` → *Disposición corta*).

Los valores sueltos `lg:`/`md:`/`sm:` que aún aparecen en el código son deuda, no escala vigente.

El umbral está **materializado en el código** como `--breakpoint-wide: 941px` dentro de `@theme` (Tailwind v4) en `frontend/src/app/globals.css`. Eso habilita las variantes `wide:` (`width ≥ 941px`) y `max-wide:` (`width < 941px`), complemento exacto. El número **no se repite** en ningún `.tsx`: la disposición se decide con `wide:` / `max-wide:`, no con media queries a mano.

### El piso del régimen de app — 600px, por construcción

El régimen de app existe **desde 600px hacia arriba en los dos ejes**: ese es su piso, y no es un número aparte — es el mismo `--bp-capture` que define la frontera, leído desde el lado grande. **No hay un token de piso propio**: un segundo umbral cerca del primero solo abriría una franja fantasma entre ambos. La app **promete contención en todo su régimen** (`≥ 600px`), y por debajo no hay nada que contener: hay otra superficie.

El piso importa por una razón estructural: el ancho mínimo de una columna `fr` de una grilla lo fija el **`min-content` de su contenido**, y en las stat-cards ese contenido es una **cifra de dinero**. Por eso una grilla de montos **no tiene un ancho mínimo fijo**: el ancho al que deja de entrar **depende de los datos del usuario**. En la franja `600–768px`, y todavía más con el sidebar abierto (que le resta 248px al ancho de contenido, dejando **352px** en el piso), una cifra larga puede exceder el `min-content` de su card. La contención en ese caso **no se resuelve truncando el monto** (la cifra es el dato, nunca se corta): la card colapsa a 1 columna y, si aun así no entra, la superficie **scrollea dentro de sí misma** (invariante 4). El `body` nunca scrollea. Regla de diseño: al dimensionar una grilla de montos, no se asume un ancho mínimo fijo; se asume que lo fija el dato, y que el ancho disponible puede ser `viewport − 248px` cuando el sidebar está abierto.

**El régimen se decide por el viewport, no por el ancho de contenido.** Que el sidebar esté abierto y estreche el contenido a menos de 600px **no** cambia de régimen: la app sigue montada y el usuario puede cerrar el sidebar para recuperar ancho. Lo que sí sigue al ancho de contenido es la **disposición** (compacto/amplio), ver *Ancho de contenido de página*.

### Los cuatro invariantes de contención

Todo lo que se diseña **para la app** respeta estos cuatro invariantes en **todo el régimen de app** (`≥ 600px` en los dos ejes), **en cualquiera de los dos estados del sidebar** (abierto o cerrado). Son verificables a ojo y material permanente del QA visual (no los detecta ni el build ni los tests). La superficie de captura **también los cumple**, con su propia lectura de cada uno (ver `captura.md` → *Invariantes de la superficie*):

1. **Sin scroll horizontal del `body`** en todo ancho `≥ 600px`, con el sidebar abierto o cerrado.
2. **Modales completos y scrolleables:** no cortados, no atrapantes — el usuario siempre puede ver el modal entero y salir de él.
3. **Ninguna acción inalcanzable:** ningún control queda fuera de pantalla ni tapado.
4. **Las superficies anchas scrollean dentro de sí mismas** (tablas, gráficos, filas anchas), sin romper el layout de la página.

### Ancho de contenido de página — llenar hasta el cap, después centrar

Regla transversal para el ancho del contenido en **todas** las pantallas del área autenticada (`/`, `/mes`, `/reportes`, `/configuracion` — este último aloja sus secciones bajo el mismo contenedor de ancho). Un solo comportamiento, idéntico en todas:

- El contenido **llena el ancho disponible** del `<main>` menos el padding lateral de página (`px-10` = 40px por lado), **hasta un tope de 1120px**.
- Alcanzado 1120px, el contenido **capea y se centra**; el sobrante queda como margen exterior parejo a ambos lados.
- **Nunca hay banda muerta al costado del contenido por debajo de 1120px.** Entre el piso del régimen (600px) y 1120px el contenido **crece para ocupar el ancho**. Que el contenido quede angosto (a su `max-content`) y pegado a un lado, dejando media pantalla vacía, es un **defecto** — y arrastra síntomas (columnas aplastadas, nombres truncados a una letra en la lista de `/mes`).
- **El "ancho disponible" es el del `<main>`, no el del viewport.** Con el sidebar **abierto**, el `<main>` está corrido 248px y su ancho es `viewport − 248px`; con el sidebar **cerrado**, el `<main>` ocupa el viewport completo. El tope de 1120px y el centrado se miden **contra el ancho del `<main>`**. Consecuencia: el contenido se centra cuando el `<main>` supera 1120 + gutters, lo que ocurre a viewport ≈1160 con sidebar cerrado y a viewport ≈1408 con sidebar abierto. El offset del sidebar es **toggle-driven, no breakpoint-driven**.
- **El régimen de disposición (compacto/amplio) también se decide por el ancho del `<main>`, no por el viewport.** El umbral `--bp-wide` (941px) se evalúa sobre el **ancho de contenido disponible** (`viewport − 248px` si el sidebar está abierto). Motivo: con el sidebar abierto a viewport 1000px el contenido mide ~712px; si el layout creyera "amplio" por el viewport, montaría grillas multicolumna en un hueco de 712px y desbordaría → scroll horizontal del `body` (rompe el invariante 1). El mecanismo natural es una **container query sobre `<main>`**; el mecanismo exacto lo resuelve `control-frontend`, pero el contrato es: **la disposición sigue al ancho de contenido, no al viewport.**
- **Flechas ‹ › de `PeriodNav` — overlay, NO gutters, y solo cuando entran limpias.** Son las flechas laterales del patrón de navegación de período. Aparecen **solo cuando el ancho de contenido es ≥ 1288px** (`--bp-arrows`), medido sobre `<main>` por **container query**. Por debajo se ocultan y el consumidor renderiza el stepper compacto en el header. Con el sidebar **cerrado** aparecen a viewport ≥1288; con el sidebar **abierto** recién a viewport ≈1536 (1288 + 248).
  - **No reservan ancho de columna.** El bloque de contenido de `/mes` usa **exactamente el mismo mecanismo que el resto** (`px-10 max-w-[1120px] mx-auto`) y por lo tanto tiene el **mismo ancho a igual viewport**. Las flechas son **overlay**: posicionadas en valor **absoluto respecto del bloque de contenido** y centradas verticalmente al viewport (sticky). Flanquean el bloque **desde afuera, sin empujarlo ni angostarlo**. (Un modelo de grilla con gutters de 84px está descartado: angostaba `/mes` 168px respecto del resto y colapsaba la pista central a ~785px.)
  - **Umbral de flechas — `--bp-arrows` = 1288px.** Es el ancho de `<main>` a partir del cual la flecha (64px) entra **entera en el margen exterior con sus 20px de aire completos**, sin tocar el bloque de contenido: `1288 = 1120 (cap de contenido) + 2 × 84 (botón 64 + aire 20, por lado)`. **Convive con `--bp-wide` (941), no lo reemplaza:** `--bp-wide` gobierna el **colapso de grillas** (stat-cards 1↔3 columnas); `--bp-arrows` gobierna el **régimen de `PeriodNav`** (flechas + header `.phead` grande vs. stepper compacto). Entre 941 y 1288 conviven **grillas multicolumna** con **header stepper y sin flechas**: son dos ejes independientes.
  - **Posición horizontal de la flecha overlay (siempre limpia, nunca solapa):** como la flecha solo se muestra con `<main>` ≥ 1288, el margen exterior por lado es **siempre ≥ 84px**. La flecha se ubica **entera en el margen exterior**, con **≥20px de aire** entre su borde interior y el borde del bloque, **sin invadir jamás** ni la banda de padding `px-10` ni el contenido. Fórmula de offset: `max(0px, calc((100% − 1120px) / 2 − 84px))`.
  - **No-solape estricto.** Donde la flecha no entra con su aire completo, **cede paso al stepper compacto** (patrón ya existente y plenamente funcional), en vez de solapar el listado o reservar gutter. La flecha nunca toca el listado.
- **Mecanismo canónico de ancho (todas las páginas):** `px-10 max-w-[1120px] mx-auto` sobre un `div` de bloque. Un bloque con `max-width` **llena** el ancho disponible y solo capea al máximo. Todas las páginas lo usan para el **ancho de contenido**, incluida `/mes` (dentro de `PeriodNav`, el bloque central es este mismo patrón); las flechas de `/mes` se superponen encima como overlay, sin participar del cálculo de ancho. El mecanismo CSS exacto del overlay lo resuelve `control-frontend`.

### Obligación sobre los specs

**Todo spec de diseño declara el comportamiento en pantalla chica.** Es obligatorio: un spec sin la sección de contención (qué pasa en compacto, cómo se cumplen los cuatro invariantes en ese elemento) está incompleto. El comportamiento en compacto no es un extra opcional del spec — es parte de la definición del elemento.

**Y si el elemento vive además en la superficie de captura** (el form de movimiento y todo lo que cuelga de él: tabs, campos, aviso de límite, modal de nueva categoría), el spec declara también su **densidad táctil** ahí: target mínimo, alto del control y comportamiento con el teclado abierto. Es la misma obligación, en el otro régimen.

### Franja de checkpoints — anchos de referencia (con el sidebar en juego)

Anchos concretos que el QA visual verifica a ojo, **dentro del régimen de app** (siempre con `alto ≥ 600px`; si el alto baja del umbral, lo que se verifica es la superficie de captura, ver `captura.md`). El **ancho de contenido** = `viewport − 248px` con el sidebar abierto, o `= viewport` con el sidebar cerrado. La disposición sigue al **ancho de contenido**, no al viewport.

| Viewport | Sidebar | Ancho de contenido | Disposición esperada |
|---|---|---|---|
| `< 600px` de ancho (o `< 600px` de alto) | — | — | **Fuera del régimen de app:** se monta la **superficie de captura**. |
| `600px` (piso) | cerrado | 600px | Compacto: grillas a 1 columna, sin flechas, stepper en header. Sin scroll del `body`. |
| `600px` (piso) | abierto | 352px | Compacto extremo: 1 columna. Los montos no se truncan; si una cifra no entra, su superficie scrollea dentro de sí (invariante 4). Sin scroll del `body`. |
| `~700px` | cerrado | 700px | Compacto, 1 columna. |
| `~700px` | abierto | ~452px | Compacto, 1 columna (mismo régimen que un viewport angosto). |
| `941px` | cerrado | 941px | **Umbral de grilla (`--bp-wide`):** grillas multicolumna (stat-cards 3 col). **Aún sin flechas** — header con **stepper compacto**. |
| `941px` | abierto | 693px | Sigue **compacto** en todo (el contenido no llega a 941): sin flechas, 1 columna, stepper. |
| `~1189px` | abierto | ~941px | Con el sidebar abierto recién acá aparece **multicolumna**; **todavía sin flechas** (stepper). |
| `~1160px` | cerrado | 1120px | El contenido alcanza el **cap de 1120px**: capea y se centra. Grillas multicolumna, **stepper, sin flechas** (banda intermedia 941–1288). |
| `1288px` | cerrado | 1288px | **Umbral de flechas (`--bp-arrows`):** aparecen las **flechas ‹ › overlay** con sus **20px de aire completos** (margen exterior = 84px exacto). Header pasa a `.phead` (título grande). Sin solape con el listado. |
| `~1408px` | abierto | 1120px | Con el sidebar abierto el cap se alcanza acá. Grillas multicolumna, **stepper, aún sin flechas** (contenido 1120 < 1288). |
| `1536px` | abierto | 1288px | Con el sidebar abierto recién acá el contenido llega a 1288: **aparecen las flechas** con aire completo. |

**Regla de lectura:** ninguna fila puede producir scroll horizontal del `body`, modal cortado, acción inalcanzable ni banda muerta por debajo del cap. Los checkpoints que más rompen son los de **sidebar abierto a ancho apretado** (600–941 viewport): ahí el contenido es angosto y el layout debe estar en régimen compacto, no amplio.

**Checkpoint del piso — cuál se verifica.** El piso del régimen de app es **600px**. Los specs que fijan su checkpoint del piso en **640px** siguen siendo válidos como verificación, pero **no son el piso**: quien los ejecute verifica también a 600px, que es el ancho más apretado en el que la app se monta.
