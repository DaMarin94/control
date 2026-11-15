# Skeletons — estados de carga

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Pertenece al grupo *Patrones de componentes vigentes*.

### Skeletons — sistema unificado de estados de carga

Sistema **único y reutilizable** para todos los estados de carga del frontend: **un solo lenguaje** y un conjunto de **primitivas** que **todos** los procesos de carga —presentes y futuros— usan. Ninguna pantalla arma el suyo inline: un skeleton ad-hoc por pantalla produce ritmos, radios y tonos distintos para el mismo estado, y la espera deja de leerse como una sola cosa del producto. Un skeleton no es un spinner: es un **fantasma del contenido real** que reserva el layout para que, al llegar el dato, no haya salto.

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
- **`prefers-reduced-motion` (obligatorio):** con reduced-motion, **la animación se desactiva por completo**: el placeholder queda como **bloque estático** `--panel-3`. El layout fantasma sigue reservando el espacio sin movimiento.
- **Implementación (para `control-frontend`, no normativa de diseño):** el mecanismo es la utilidad **`animate-pulse` (Tailwind)** sobre **`bg-panel-3`**; desactivada bajo `@media (prefers-reduced-motion: reduce)`. El diseño fija el **comportamiento**; el mecanismo exacto es del frontend.

#### Primitivas — los building blocks del componente reutilizable

`control-frontend` arma **un componente `Skeleton` reutilizable** (con variantes) que expone estas primitivas. Toda pantalla compone su skeleton **a partir de estas piezas**; no se vuelve a escribir `animate-pulse bg-panel-3` inline en ningún lado.

| Primitiva | Reemplaza | Radio | Medidas / variantes |
|---|---|---|---|
| **`SkeletonLine`** | una línea de texto (título, label, nombre, meta) | `--r-chip` 7px | **alto = el `font-size` real del texto** que reemplaza (p.ej. 12px para meta, 14.5px para nombre de movimiento, 32px para H1); **ancho** parametrizable (porcentaje o px) para imitar largos distintos. Una línea de meta debe ser **más corta** que la de título. |
| **`SkeletonBlock`** | superficie rectangular (card, canvas de gráfico, área de lista, input, botón) | `--r-card` por default; `--r-ctl` para controles | alto/ancho explícitos = los del elemento real. Es la primitiva más usada (todo lo que no es línea ni círculo). |
| **`SkeletonCircle`** | avatar, swatch circular, glifo redondo | `50%` | un solo parámetro de **diámetro** (= el del círculo real: 32px avatar de sidebar, etc.). |
| **`SkeletonPill`** | pill / stepper / segmented / chip-contador | `--r-pill` | alto/ancho del control real (p.ej. stepper ~36px alto). Es un `SkeletonBlock` con radio pill; se nombra aparte por frecuencia de uso. |

- **Densidad/espaciado entre primitivas:** los placeholders se separan con **el mismo gap que separa los elementos reales** que imitan (`--gap` 18px entre cards, `--row-pad` 14px de fila, el `gap` real entre líneas de un ítem). No hay un "gap de skeleton" propio.
- **Cuántos placeholders en una lista:** una lista fantasma muestra **un número fijo y razonable de filas** (**5–7** para una lista de movimientos/categorías). Suficientes para llenar el viewport sin scroll inicial; no tantas que el aterrizaje de una lista corta genere salto. Cada fila fantasma replica la **estructura de columnas** de la fila real (p.ej. en `/mes`: `[círculo ícono] [línea nombre + línea meta] [línea fecha] [línea monto]`).

#### Accesibilidad (obligatoria en todo skeleton)

- El **contenedor** lleva **`role="status"`** + **`aria-label`** descriptivo del contenido en carga (p.ej. `"Cargando movimientos"`, `"Cargando totales"`, `"Cargando configuración"`, `"Cargando gráfico"`).
- Los **placeholders internos** son **decorativos**: `aria-hidden="true"`.
- **No** se usa `role="alert"` (eso es para error). El skeleton es `status`.

#### Cómo construir el skeleton de una pantalla (lineamiento)

1. **Identificá la estructura estable vs. la dependiente del dato.** Lo estable puede renderizarse **ya, inerte**; solo el área de dato se reemplaza por fantasmas.
2. **Mapeá cada elemento real a una primitiva** con sus medidas reales.
3. **Respetá columnas, gaps y radios reales** para que no haya salto al aterrizar.
4. **Envolvé** en un contenedor `role="status"` + `aria-label`; los placeholders `aria-hidden`.
5. **La animación es `pulse`**, off en reduced-motion.
6. **Mostralo solo en la carga inicial**, cuando aún no hay datos.

#### Mapeo de casos (unificación)

Todos los estados de carga se componen sobre las primitivas. Las medidas son las del layout real.

| Caso | Composición |
|---|---|
| **Totales de `/mes`** (`month-view-client.tsx`, 3 cards de total) | **3× `SkeletonBlock`** radio `--r-card`, alto **90px**, en el **mismo grid `1fr 1fr 1.1fr` con `--gap`**. Contenedor `role="status"` `aria-label="Cargando totales"`. |
| **Card de reporte** (`report-card.tsx`, `ChartSkeleton`) | **1× `SkeletonBlock`** radio `--r-ctl` del **alto del canvas** (300/280/220) + **3× `SkeletonLine`/`SkeletonPill`** de leyenda (anchos 70/56/80, alto 14, radio `--r-chip`). Contenedor **`role="status"` `aria-label="Cargando gráfico"`**. La cabecera/tabs de la card está presente e inerte. |
| **`/configuracion`** (`settings-client.tsx`, skeleton del segmented) | **1× `SkeletonPill`** radio `--r-pill`, 220×36, dentro de la fila de ajuste real (título + descripción reales presentes; solo el control es fantasma). Área de carga bajo `role="status"` `aria-label="Cargando configuración"`. |
| **`/configuracion/categorias`** (`categories-list.tsx`, skeleton de la sección) | **Header de sección:** el H1 de página persistente "Configuración" y la nav vertical de secciones son chrome estable (presente e inerte, sin fantasma). La sección no lleva eyebrow ni H1 propio (ver `limites.md` §1. Control de navegación): su cabecera fantasma es `SkeletonLine` del `h2` de sección (alto ~18px, ancho ~120px) + `SkeletonBlock` botón (`--r-ctl`, 40×144). **Lista:** **5–7 filas fantasma** que replican la estructura del `catrow` real (`[SkeletonBlock swatch 14px] [SkeletonLine nombre] [SkeletonLine uso]`) dentro de la `.cat-list`. Contenedor `role="status"` `aria-label="Cargando categorías"`. |
| **Filas de sección en `/mes`** (`month-view-client.tsx`, secciones Únicos/Fijos/Cuotas) | Mientras `isLoading`, las **tres secciones se renderizan ya** con su cabecera fantasma y su cuerpo de filas fantasma. Por sección: **(a) Cabecera** — imitar la `.ghead` real (`accordion-section.tsx`): `SkeletonBlock` chevron 16×16 (radio `--r-chip`) + `SkeletonLine` rótulo (alto **13px**, ancho ~80px) + `SkeletonPill` contador (alto ~16px, ancho ~26px, radio `--r-pill`) + línea divisora `--hair` real (chrome estable) + `SkeletonLine` subtotal mono (alto **13px**, ancho ~72px, alineado a la derecha). El **chevron va estático en ▶ o se omite la rotación** — es fantasma, no acciona. Sin handle de drag. **(b) Cuerpo** — la tarjeta-lista real (`bg-panel border-line rounded-card --shadow-sm overflow-hidden`, chrome estable presente) con **3 filas fantasma por sección** (3×3 = 9 filas llenan el viewport sin exceso). Cada fila fantasma replica el grid real del `MovementItemRow` (`40px 1fr auto auto auto`, `padding var(--row-pad) 18px`, divisor `--hair` entre filas): **`SkeletonCircle` ícono 40px** + columna texto (`SkeletonLine` nombre alto **14.5px** ancho ~60% + `SkeletonLine` meta alto **12.5px** ancho ~40%) + `SkeletonLine` fecha (alto 12.5px, ancho ~52px, alineada derecha) + `SkeletonLine` monto (alto **15.5px**, ancho ~84px, alineada derecha) + **sin** col de kebab. **a11y:** contenedor `role="status"` `aria-label="Cargando movimientos"` (distinto del `"Cargando totales"` — son dos bloques de carga). |
| **Dashboard** (`/`, `dashboard-client.tsx`) | Imitar el layout cargado real del resumen + widget. Bajo `role="status" aria-label="Cargando totales"`, **`space-y-[var(--gap)]`**: **(1)** grid `grid-cols-2 gap-[var(--gap)]` con **2× `SkeletonBlock`** (radio `--r-card`) del alto de las stat-cards Gastos/Ingresos — **~120px**. **(2)** **1× `SkeletonBlock`** radio `--r-card` para el **balance hero** — alto **~160px**. **(3)** **1× `SkeletonBlock`** radio `--r-card` para la **card de reporte** del dashboard: alto ≈ card-pad + cabecera + **canvas 280px** + leyenda ≈ **~380px** — `control-frontend` ajusta al alto real montado de `ReportCard` con `chartHeight={280}`. Alternativa preferible si el alto exacto es difícil de clavar: cabecera/controles inertes con solo el canvas como `SkeletonBlock` radio `--r-ctl` 280px + 2–3 `SkeletonLine` de leyenda. El **footer "Ver todos"** no necesita fantasma. El **header `.phead`** se renderiza presente e inerte fuera del bloque de carga. |

> **Regla viva derivada:** ningún componente nuevo escribe `animate-pulse bg-panel-3` inline. Todo estado de carga compone las **primitivas** (`SkeletonLine` / `SkeletonBlock` / `SkeletonCircle` / `SkeletonPill`) del componente `Skeleton`, imitando las medidas reales, con pulse (off en reduced-motion) y `role="status"` + `aria-label` en el contenedor. El fill es `--panel-3`; nunca color semántico ni de marca. El skeleton se muestra **solo en la carga inicial** —nunca en refetch ni en interacciones con dato ya presente.
