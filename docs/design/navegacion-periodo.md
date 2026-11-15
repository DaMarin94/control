# Navegación de período — PeriodNav, salto de mes/año, "Mes en curso"

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md` (§Ancho de contenido de página y umbral `--bp-arrows`). Pertenece al grupo *Patrones de componentes vigentes*.

### PeriodNav — navegación de período (flechas gigantes laterales + modo `.stepper`)

Patrón **genérico** para navegar un período (mes o año): `‹ contenido ›`, donde **‹ va al período anterior y › al siguiente**. Recibe un rótulo de período ya formateado, handlers anterior/siguiente y dos flags `canGoPrev` / `canGoNext`. **Mismo componente, distinto período.** Tiene **dos formas**:

- **Forma lateral (canónica, a ancho de página):** el contenido es el **bloque canónico** `‹ contenido ›` y las flechas ‹ › son **overlay** que lo flanquean **sin reservar ancho** (simetría respecto del **contenido**, no del viewport). Cada flecha: `button` circular **64×64px**, glifo `ChevronLeft`/`ChevronRight` (lucide) **46px** `stroke-width 1.75`, **sin fill** en reposo, glifo `--faint`. En `/mes` (período = mes; flags siempre `true`) y en **reportes**.
  - **Ancho de la columna central = ancho de contenido de página:** rige *Ancho de contenido de página* (`fundamentos.md`). El bloque central usa el **mismo mecanismo que las otras pantallas** (`px-10 max-w-[1120px] mx-auto`) → **mismo ancho a igual viewport**. Las flechas **NO consumen ancho de columna**. Son overlay, absolutas respecto del bloque, centradas verticalmente al viewport. **Posición horizontal:** las flechas solo se muestran con `<main>` ≥ **1288px** (`--bp-arrows`), ancho al que el margen exterior por lado es **siempre ≥84px** (64 + 20 de aire); la flecha va **siempre entera en el margen exterior** con **≥20px de aire** al borde del bloque y **nunca toca** el listado (ni el padding `px-10`). Por debajo de 1288 no hay flechas: cede al stepper. Detalle: `fundamentos.md` → *Flechas ‹ › de `PeriodNav` — overlay, NO gutters*.
  - **Centrado vertical de las flechas:** la flecha está **centrada verticalmente en el VIEWPORT**, siempre, sin importar el largo del listado, y **permanece anclada al centro del viewport** mientras se hace scroll y con cualquier cantidad de contenido. El mecanismo técnico lo resuelve control-frontend (p. ej. que las celdas laterales tengan `min-height` del viewport para centrar también con listas cortas); el **comportamiento visual a cumplir** es: flecha centrada verticalmente en el viewport, constante al scrollear, con cualquier cantidad de contenido.
- **Forma compacta (`.stepper` pill):** el **modo de colapso** del mismo patrón, también usado **embebido** cuando no hay lugar para flechas laterales (cards apiladas, ventana angosta). Pill `.stepper` del DS: `--r-pill`, `--panel`, borde `--line`, `--shadow-sm`, padding 4px; dos botones circulares **32px** (chevron-left/right, glifo 18px, `--ink-2` → `--ink` sobre `--panel-2` en hover) y, al centro, el rótulo del período (si es número → **mono tabular**, regla dura 3). Es el **control de año embebido per-card** en `/reportes` y en el Dashboard (ver `card-grafico.md` *Card de reporte*).

**Estados de la flecha/chevron (comunes a ambas formas):**

- **Reposo:** glifo `--faint` (lateral) / `--ink-2` (stepper), `cursor: pointer`.
- **Hover:** glifo a `--ink`; en la forma lateral aparece un fondo circular `--panel-2`; en el `.stepper`, fondo `--panel-2` en el botón. Transición 0.14s.
- **Active:** fondo `--panel-3`.
- **Focus (teclado):** ring `--accent-soft` 3px (`focus-visible`).
- **Disabled (`canGoPrev`/`canGoNext` = false):** glifo `--faint` con `opacity: 0.4`, sin hover, `cursor: default`, `aria-disabled`. **No se oculta** — presente pero apagado. Es el estado que usan los límites de navegación de año: **cada flecha se apaga en su extremo del rango de datos propio de la card**, y **las dos** quedan apagadas cuando no hay rango (stepper congelado, el rótulo de año no cambia). Qué rango manda lo define la regla funcional — RF-REP-002, *Límites de navegación de año*; acá solo se declara su forma visual.

`aria-label` según el período: "Mes anterior/siguiente" (mes) o "Año anterior/siguiente" (año).

**Responsive (forma lateral) — medido por container query sobre `<main>`, no por viewport.** El régimen de `PeriodNav` (flechas + `.phead` vs. stepper) se decide contra **`--bp-arrows` = 1288px**, no contra `--bp-wide` (941) — ese último gobierna solo el colapso de grillas. Dos regímenes:
- **Ancho de contenido ≥1288px (las flechas entran con aire):** el contenido es el bloque canónico y las flechas laterales aparecen como **overlay** flanqueándolo con ≥20px de aire; el contenido **no se angosta** por las flechas; el header usa el `.phead` (título grande).
- **Ancho de contenido <1288px (compacto de `PeriodNav`):** las flechas laterales se ocultan y el header usa la forma compacta `.stepper`; el bloque de contenido es el mismo `px-10 max-w-[1120px] mx-auto`. Incluye **toda la banda intermedia 941–1288**, donde las grillas ya son multicolumna pero la navegación de período es por stepper.

En ambos regímenes el ancho de contenido es el mismo mecanismo — lo único que cambia es la presencia (overlay) o no de las flechas y la forma del header. **No existe** un modo intermedio de "flechas con fondo pegadas al borde" ni gutters que reserven ancho.

**Movimiento:** hover 0.14s; el cambio de período dispara el re-render de la vista (entrada de pantalla 0.32s); las flechas no animan posición — permanecen ancladas al centro del viewport mientras se scrollea. Respeta `prefers-reduced-motion`.

### Selector de salto de mes/año en `/mes` (popover "rueda")

Hace **interactivo el rótulo de período** de `/mes` para **saltar rápido** a cualquier mes/año, sin reemplazar la navegación secuencial (flechas laterales en amplio / pill stepper en compacto). Es **solo UI**: al confirmar reusa la navegación de período existente (RF-VM-004) — navega al mes elegido. Convive con `PeriodNav` (flechas laterales gigantes ≥1288px y forma `.stepper` <1288px) como **atajo de salto largo**, no como reemplazo del "anterior/siguiente".

#### 1. Affordance — el rótulo de período se vuelve disparador

El rótulo del período es el disparador. **No** se agrega un botón aparte ni un ícono suelto que compita; el propio período (que ya es el elemento de mayor jerarquía del header) toma la afordancia, con un glifo de apoyo que comunica "esto despliega".

- **Amplio de `PeriodNav` (≥1288px) — el `<h1>` "Junio 2026" pasa a `<button>`-like.** El H1 (32px/700, tracking `-.02em`, `--ink`) se envuelve en un disparador (`<button>` con el H1 adentro, `inline-flex items-center gap-[8px]`), conservando exactamente su tipografía y tamaño. A su derecha, un glifo **`ChevronsUpDown`** (lucide, **18px**, `stroke-width 2`, `--faint` en reposo, `shrink-0`, `aria-hidden`) — el glifo de doble flecha ↕ comunica "valores que suben/bajan", coherente con la metáfora de "rueda". El eyebrow ("Tu mes" + `CurrencyChip`) y el sub-label de estado ("Mes en curso"/"Histórico") **no cambian** y **quedan fuera** del disparador (el botón envuelve solo el H1 + chevron).
- **Compacto de `PeriodNav` (<1288px) — el centro del pill `.stepper` se vuelve disparador.** El bloque central del `.stepper` (el texto `{mes} {año}` + sub-label de estado) es un `<button>` que abre el mismo popover. Las **flechas ‹ › del pill no cambian** (siguen navegando anterior/siguiente). Lleva el mismo glifo `ChevronsUpDown` **15px** `--faint` a la derecha del texto del mes, dentro del botón central, `gap-[6px]`. El sub-label "Mes en curso/Histórico" sigue debajo, dentro del botón. El centro no es `aria-hidden`: es accionable (label real). El pill conserva su molde (`--r-pill`, `--panel`, borde `--line`, `--shadow-sm`, padding 4px).
- **Por qué `ChevronsUpDown` y no `ChevronDown`/`Calendar`:** el popover **no** es un menú desplegable plano (sería `ChevronDown`) ni un date-picker de calendario (sería `Calendar`): es un **selector de dos ruedas** (mes y año que suben/bajan). El doble chevron vertical ↕ es la afordancia exacta del patrón "stepper/rueda" y no se confunde con el chevron lateral ‹ › de navegación secuencial ni con el chevron de disclosure ▶.

**Estados del disparador (comunes a las dos disposiciones):**

- **Reposo:** H1/label en su color normal (`--ink`); chevron `--faint`; `cursor: pointer`.
- **Hover:** chevron sube a `--ink-2`; el H1 **no** cambia de color (se mantiene `--ink` para no parpadear el título). Transición 0.14s. En compacto, el botón central **no** toma fondo (el pill ya es la superficie); el chevron a `--ink-2` es la única señal.
- **Focus (teclado):** ring `--accent-soft` 3px (`focus-visible`), radio `--r-chip` 7px ajustado al box del disparador (envuelve H1 + chevron sin recortar el descender de la tipografía).
- **Abierto:** el chevron pasa a `--ink-2` (mismo que hover) y se mantiene mientras el popover está abierto (señal de "activo"); el disparador lleva `aria-expanded="true"` + `aria-haspopup="dialog"`.

#### 2. El popover — dos ruedas mes / año

Superficie flotante portaleada a body, anclada al disparador. **No** es un calendario: son **dos columnas de selección** ("ruedas"), una de mes y una de año, cada una con su valor central y sus controles ▲▼ de subir/bajar. **Las dos ruedas son independientes:** la de Mes hace **wrap circular** sin tocar el Año, y el Año solo cambia con su propia rueda (ver wrap abajo y §3).

**Principio de diseño:** cada rueda debe **leerse de inmediato como UNA pieza integrada** (un stepper/rueda cohesivo), **no** como tres barras grises sueltas (▲ / display / ▼ desconectados). Por eso **no** se da a los tres elementos un fondo `--panel-2` con esquinas independientes (se leerían como tres chips apilados sin relación): la pieza es **un contenedor único con borde envolvente y divisores internos**, donde ▲, valor y ▼ son **zonas de la misma caja**, no cajas separadas.

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
- **Contenedor de la rueda (la pieza cohesiva):** un único `<div>` con **borde `--line-strong` 1px en los cuatro lados**, radio **`--r-ctl` 10px**, `bg-panel`, `overflow-hidden` (para que las zonas internas respeten el radio). Adentro, tres zonas apiladas separadas por **divisores internos `--hair` 1px** (no bordes de caja propios): la zona ▲ arriba, la zona valor al medio, la zona ▼ abajo. **Las zonas NO llevan fondo propio en reposo** (heredan el `bg-panel` del contenedor): el borde envolvente + los dos divisores `--hair` son lo único que estructura la pieza. **Sin radios independientes por zona** (el único radio es el del contenedor).
- **Zona ▲ / ▼ (subir/bajar):** ocupa el ancho completo de la rueda, alto **28px**, **sin fondo en reposo** (transparente sobre el `bg-panel` del contenedor). Glifo `ChevronUp` / `ChevronDown` (lucide, **16px**, `stroke-width 2`, `--ink-2`). **Hover:** fondo `--panel-2` (solo la zona hovereada toma fondo), glifo `--ink`. **Active:** fondo `--panel-3`, sin `scale` (escalar despegaría la zona de la pieza). **Focus (teclado):** ring `--accent-soft` 3px **inset** (para que el ring no rompa el borde envolvente de la pieza). Hold/repeat (mantener apretado para avanzar rápido) es opcional — lo resuelve `control-frontend`; el spec no lo exige. `aria-label="Mes siguiente/anterior"` / `"Año siguiente/anterior"` (según rueda).
- **Zona valor (el centro de la rueda):** alto **40px**, `bg-panel`, texto **centrado**. **Sin bordes propios** (los divisores `--hair` arriba y abajo la delimitan). Es la zona dominante de la pieza (más alta que las zonas ▲▼ de 28px, para que el valor sea el foco visual).
  - **Rueda Año:** input numérico. Valor en **mono tabular** (IBM Plex Mono + `tnum`, **regla dura 3** — es una cifra), **17px/600**, `--ink`, `text-center`. Editable por teclado (escribir el año). `inputMode="numeric"`, `maxLength=4`. **Focus del input** (escribiendo): ring `--accent-soft` 3px **inset** sobre la zona valor (no rompe el borde de la pieza).
  - **Rueda Mes:** el mes se muestra como **nombre** ("Junio"), no número. Por eso **no** es un `<input type=number>`: es un campo de texto que muestra el nombre del mes (UI **15px/600** Space Grotesk, `--ink`, `text-center`) y se cambia con ▲▼; opcionalmente escribible (escribir "jun" autocompleta a Junio) — la escritura del mes es **secundaria**, los ▲▼ son el camino primario. El nombre del mes es UI (no cifra), por eso va en Space Grotesk, **no** en mono. `aria-label="Mes"` con `aria-valuetext` = nombre del mes.
  - **Wrap del mes — circular, NO toca el año.** Las dos ruedas son **independientes**: ▲ en Diciembre pasa a **Enero** y ▼ en Enero pasa a **Diciembre**, **sin modificar el año**. El año **solo cambia con su propia rueda** (sus ▲▼ o escribiéndolo). Sin odómetro/arrastre del año.

#### 3. Estados de valor — válido, foco, incompleto

**Sin rango de año.** En `/mes` la navegación de meses es **ilimitada**, así que el selector **no impone rango de año**: no existe "año fuera de rango" y los steppers ▲▼ del año **no tienen estado disabled por límite**. El input Año solo valida que sea un **año numérico plausible de 4 dígitos** (forma, no negocio).

- **Reposo (válido):** input con borde `--line-strong`, valor `--ink`.
- **Focus en el input (escribiendo):** borde del input sube a `--accent` (o se mantiene `--line-strong` con) ring `--accent-soft` 3px alrededor del input — mismo focus ring del DS para inputs de form. El valor sigue `--ink`.
- **Incompleto — año aún no válido (no es estado de error).** Mientras el usuario **escribe** el año y todavía **no hay 4 dígitos** (ej. `20`, `202`, o el campo vacío), el valor está **incompleto**, no en error:
  - El input **no** se tiñe de error: **no** se usa `--expense` ni el error ring `--expense-soft`. Conserva el borde `--line-strong` (o el focus ring `--accent-soft` si está enfocado). No hay color semántico de gasto, no hay mensaje de error, no hay `aria-live`.
  - **El botón "Ir" se deshabilita** mientras el año no tenga **4 dígitos numéricos** (estado disabled del primario, ver §4). Es el único feedback de "todavía no podés saltar".
  - **Entrada no numérica:** el input es `inputMode="numeric"` `maxLength=4`; caracteres no numéricos se **descartan**, no producen estado de error.
- **Steppers ▲▼ del año — siempre activos.** Siempre suben/bajan el año en ±1 sin tope y siempre producen un año de 4 dígitos válido, así que "Ir" nunca queda deshabilitado por usar los steppers; el disabled de "Ir" solo aparece por **escritura incompleta** del año.

#### 4. Footer y comportamiento de cierre

**Regla vigente: este popover NO se cierra por click afuera** (ver `overlays-modales.md` §Cierre de overlays). Demanda una decisión explícita (saltar de mes es una acción de navegación, no un filtro liviano que se revierte solo). Cierre **explícito**:

- **Footer:** fila `flex items-center justify-end gap-[8px]`. Dos botones del DS:
  - **"Cancelar"** — botón **ghost** del DS (`.btn.ghost`, texto 13px/600 `--ink-2` → `--ink` sobre `--panel-2`, radio `--r-ctl`). Cierra **sin navegar** (descarta el cambio tentativo).
  - **"Ir"** — botón **primario índigo** del DS (`bg-accent` → `--accent-press`, texto blanco 13px/600, radio `--r-ctl`, `shadow-[var(--shadow-sm),inset_0_1px_0_oklch(1_0_0_/_0.2)]`, focus ring `--accent-soft` 3px). **Confirma**: navega al mes/año elegido (reusa RF-VM-004) y cierra. Glifo opcional `ArrowRight` 15px. **Disabled** mientras el año está **incompleto** (§3): `opacity-50`, `cursor-not-allowed`, sin hover.
- **Vías de cierre:**
  - **"Ir"** → confirma + navega + cierra.
  - **"Cancelar"** → cierra sin navegar.
  - **`Esc`** → cierra sin navegar (equivale a Cancelar).
  - **Re-clic en el disparador** → cierra sin navegar (toggle).
  - **Click fuera → NO cierra.** No se monta scrim oscuro; el popover flota sobre la pantalla y se descarta solo por una de las vías de arriba.
- **`Enter` dentro de un input** equivale a "Ir" (si el año está completo; si está incompleto, `Enter` no navega).
- **a11y del popover:** `role="dialog"` `aria-label="Saltar a mes y año"`, foco entra al popover al abrir (primer control: input Año o ▲ del mes), `Esc` lo cierra, foco vuelve al disparador al cerrar. **Focus trap** dentro del popover mientras está abierto.

#### 5. Ubicación, anclaje y flip

- **Amplio de `PeriodNav` (≥1288px):** el popover se ancla **bajo el disparador (el H1)**, alineado a la **izquierda** del H1, con `gap` vertical **8px**. Queda dentro del ancho de contenido, sin colisionar con las flechas laterales gigantes.
- **Compacto de `PeriodNav` (<1288px):** se ancla **bajo el pill `.stepper`**, **centrado** respecto del botón central del pill (no respecto del viewport), `gap` 8px. Si el centrado lo sacaría del viewport, se alinea al borde con margen mínimo 12px (clamp horizontal).
- **Flip vertical (sin lugar abajo):** si no hay espacio suficiente debajo del disparador para los ~240px de alto del popover, **flipea hacia arriba** y se ancla **sobre** el disparador (mismo `gap` 8px), con la animación `pop` desde el borde inferior. El mecanismo lo resuelve `control-frontend`; el comportamiento a cumplir: el popover **siempre queda completamente visible** dentro del viewport, flipeando arriba/abajo y clampeando horizontal según haga falta.

#### 6. Convivencia con la navegación existente

- **No reemplaza nada.** Las flechas laterales de `PeriodNav` (≥1288px) y el pill stepper (<1288px) siguen siendo el camino para "mes anterior / siguiente". El popover es el atajo para **saltos largos**.
- **Mismo destino, misma navegación.** Confirmar en el popover navega exactamente como las flechas (RF-VM-004). El popover solo **elige** el período.
- **El disparador sigue accionable durante el "modo orden de secciones".** No se deshabilita en ese modo, **consistente con las flechas de `PeriodNav`** (que también navegan sin salir del modo).

> Reutiliza: el rótulo de período como superficie, sin cambiar su tipografía; el **focus ring `--accent-soft`**; el patrón de **input del form** (`border-line-strong`, `bg-panel`, mono tabular para cifras); el botón **primario índigo** (con **disabled** mientras el año está incompleto) y el **ghost**. Aporta: el **patrón de dos ruedas mes/año cohesivas**, su **affordance `ChevronsUpDown`** y la aplicación del cierre explícito (Ir / Cancelar / Esc / re-clic).

### Botón "Mes en curso" — recentrado temporal en el header de `/mes`

Acción de **recentrado**: cuando el usuario navega **cualquier mes que no es el mes en curso**, un link lo devuelve al mes en curso de un toque. Al activarse reusa la navegación de período existente (RF-VM-004, navega a `?month=<mes en curso>`).

Decisiones cerradas con el usuario (no revertir): **(a)** disimulado — misma tipografía que `Histórico`, no se lee como botón de acción; **(b)** vive en la fila del `statusLabel`, junto a `Histórico` (`Histórico · → Ir al mes en curso` = estado + su remedio); **(c)** la flecha ocupa SIEMPRE la posición leading, solo cambia hacia dónde apunta; **(d)** el label mantiene el verbo: "Ir al mes en curso". Descartados: versión chip/ghost con `LocateFixed`; versión link 13px/600 en la fila del título con flecha que cambiaba de lado.

#### 1. Visibilidad y semántica

- **Se muestra SOLO cuando `isCurrentMonth === false`.** En el mes en curso el link **no existe** (render condicional por `display`, no `visibility:hidden` — sin target de foco fantasma). No hay estado `disabled`.
- **Label visible: "Ir al mes en curso"** (literal, con el verbo). El verbo va en el **texto visible**, no en un `aria-label`. Nada de "corriente", "actual", ni "Hoy".
- **Convive, no reemplaza.** Flechas ‹ › / pill stepper = "anterior/siguiente"; selector de salto = salto largo; este link = atajo de **un solo destino fijo**.
- Semánticamente es un **`<button type="button">`**, **estilizado como link** de texto tenue.

#### 2. Forma — link de texto tenue, espejando `Histórico`

No es un chip: **sin borde, sin fondo, sin padding de botón, sin sombra, sin radio de superficie**. Texto accionable inline, deliberadamente disimulado.

- **Tipografía: espeja `Histórico` exactamente → `text-[12.5px] font-medium text-muted`** (12.5px / peso 500 / `--muted`). No introduce una escala nueva ni un peso mayor en esa fila.
- **Color reposo: `--muted`** (igual que `Histórico`). No `--ink-2` (demasiado firme). No `--faint` (se perdería).
- **Sin subrayado en reposo.** La affordance en reposo la dan la flecha direccional + el verbo; el subrayado es **feedback de interacción** (§6).
- **Nunca** acento índigo, **nunca** verde/rojo. Utilidad de navegación neutra.
- **Layout interno:** `inline-flex items-center gap-[5px] whitespace-nowrap`.

#### 3. Flecha dinámica direccional — posición fija, sentido variable

Lleva **una** flecha `lucide-react`, **siempre en posición leading (a la izquierda del texto)**. Lo único que cambia entre meses es **hacia dónde apunta**. Esto **deroga deliberadamente la restricción de "ícono no direccional"**: **que nadie la "corrija" de vuelta a un ícono neutro.**

- **Por qué una flecha dinámica:** una flecha *fija* **mentiría la mitad de las veces**. Una flecha *dinámica*, que apunta al lado real del mes en curso, **no miente nunca**. El glifo neutro se descarta por mudo.
- **Mes visualizado en el PASADO** (el mes en curso está *adelante*) → **`ArrowRight` (→)**.
- **Mes visualizado en el FUTURO** (el mes en curso está *atrás*) → **`ArrowLeft` (←)**.
- **Posición SIEMPRE leading, en ambos casos.** → y ← ocupan la misma caja de 13px: **cero corrimiento horizontal** del label entre meses pasados y futuros.
- **Refuerzo con la navegación:** el sentido de la flecha **coincide siempre** con el chevron (`‹` / `›`) que el usuario apretaría para llegar caminando mes a mes.
- **Descartados explícitamente:** `LocateFixed`, `Crosshair`, `Target`, `CalendarCheck` y toda la familia de íconos neutros. También el patrón **leading/trailing variable**.
- **Tamaño: 13px**, `aria-hidden="true"`, hereda `currentColor`. **No debe exceder la caja de línea del texto** (§5). Fallback: si a 13px el link superara la altura del span `Histórico`, bajar la flecha a **12px** (no subir la línea).
- **Derivación del sentido:** visualizado `<` en curso ⇒ `ArrowRight`; visualizado `>` en curso ⇒ `ArrowLeft` (`isPastMonth = month < currentMonth`).

#### 4. Ubicación, separador y anti-empuje horizontal

- **Amplio de `PeriodNav` (≥1288px): en la fila del `statusLabel`, como hermano posterior del span `Histórico`.** La fila es `flex items-center gap-[8px]`. Orden de fuente: `[span Histórico] · [link]`. **No** va en la fila del título (`MonthJumpTriggerDesktop` contiene solo el trigger).
- **Separador: `·` (middot) en `--faint`.** Agrupa las dos piezas como **"estado · su remedio"**. **Solo se renderiza junto al link**: en mes-en-curso la fila muestra únicamente `Mes en curso`, sin `·` ni link.
- **Compacto de `PeriodNav` (<1288px): fuera del pill `.stepper`**, que está envuelto en `aria-hidden="true"` (meterlo adentro lo volvería inaccesible). Se ubica como **último hijo** de la fila flex del header compacto, **después** del pill y del `CurrencyChip`; plenamente accesible y focalizable. En ventanas muy angostas `flex-wrap` lo baja a su propia línea bajo el pill.
- **Anti-empuje horizontal:**
  - **`Histórico`/`Mes en curso` inmunes:** `·` y link son **posteriores** y crecen **hacia la derecha, sobre espacio vacío**. El flip de sentido de la flecha **no mueve** el borde izquierdo del link.
  - **`CurrencyChip` inmune:** en amplio vive en la fila del *eyebrow*; en compacto va **antes** del link en orden de fuente.
  - **Cluster de acciones inmune (desktop):** el header exterior es `justify-between`, acciones ancladas al **borde derecho**; el link es corto (`whitespace-nowrap`, ~150px) y a ≥1288px **no se dispara wrap**.

#### 5. Anti-layout-shift vertical y cero-impacto real

- **Sin `min-h` en la fila del `statusLabel`.** El link es tipográficamente idéntico a `Histórico` (12.5px/500, misma caja de línea), la fila **no crece** por alojarlo. La fila queda `flex items-center gap-[8px]` **sin** `min-h`.
- **Invariante de alto verificable:** la flecha de 13px se centra **dentro** de la caja de línea de 12.5px y **no** la excede. `getBoundingClientRect().height` de la fila del `statusLabel` debe dar **el mismo valor** (delta **0px**) alternando entre un mes histórico (con link) y el mes en curso (sin link). Si difiere, la causa es la flecha excediendo la caja → fallback de 12px de §3.
- **Todo lo que va debajo conserva su `y`:** totales y label "GASTOS" (0px de desplazamiento).
- **Fila del título — estable por construcción:** su alto lo fija el H1 (32px, `leading-none`).
- **Flechas ‹ › inmunes por estructura.**
- **Compacto — reflow vertical aceptado (trade-off explícito):** en ventanas muy angostas aparece en segunda línea y empuja hacia abajo el contenido siguiente. Se acepta ese reflow (viaja con la entrada de vista del cambio de mes) en vez de reservar una línea vacía permanente.

#### 6. Estados

- **Reposo:** texto + flecha `--muted`, **sin subrayado**, **`cursor: pointer`** (§7).
- **Hover:** texto + flecha suben a **`--ink-2`** **+ subrayado** (`underline`, `underline-offset-[2px]`, línea = `currentColor`). Transición de **color a 0.14s** (`duration-[140ms]`); el subrayado aparece de inmediato.
- **Active (pressed):** igual que hover.
- **Focus (teclado):** `focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]` + `rounded-[var(--r-chip)]` **+ subrayado visible**, sin outline nativo — mismo anillo y radio que `MonthJumpTriggerDesktop`.
- **Disabled:** **no aplica** (§1).

#### 7. Movimiento, `cursor: pointer` y accesibilidad

- **`cursor: pointer` OBLIGATORIO y EXPLÍCITO.** **Gotcha de Tailwind v4:** su preflight asigna `cursor: default` a **todos** los `<button>`. Este control **debe** llevar la clase `cursor-pointer` explícita (mismo motivo por el que `MonthJumpTriggerDesktop` la lleva).
- **Aparición:** sin animación propia — aparece con el re-render de la vista al cambiar de mes (entrada 0.32s). Solo transición de color en hover/focus (0.14s). Con `prefers-reduced-motion` no requiere tratamiento especial.
- **A11y:** nombre accesible **"Ir al mes en curso"** tomado del texto. **Sin `aria-label` extra.** La flecha es `aria-hidden="true"`.
- **Contraste:** `--muted` cumple el contraste mínimo (mismo tono que `Histórico`). El subrayado en hover/focus es un portador **no-dependiente-del-color**.
- **Cambio de sentido de la flecha — no se anuncia:** sin `aria-live`.
- **Orden de foco:** en amplio, disparador de salto (H1) → link → cluster de acciones. En compacto, tras el pill (que es `aria-hidden`), en su orden natural.

#### 8. Checklist de aceptación visual

- [ ] Navegando un mes **distinto** al mes en curso, en la **fila del `statusLabel`** (bajo el H1) se lee `Histórico · → Ir al mes en curso` (o con `←`, según §3): span de estado + `·` + link de texto, **sin borde, sin fondo, sin sombra**.
- [ ] Estando en el **mes en curso**, la fila muestra **solo** `Mes en curso`: **no** existe `·`, **no** existe link (ni visible, ni placeholder, ni target de foco).
- [ ] **Tipografía del link idéntica a `Histórico`:** `12.5px` / peso `500` / `--muted` en reposo, **sin subrayado**. (Medible: `font-size`, `font-weight` y `color` computados iguales a los del span `Histórico` contiguo.)
- [ ] **Flecha en mes PASADO:** navegando un mes **anterior** al mes en curso, la flecha es **`ArrowRight` (→)**, en posición **leading**.
- [ ] **Flecha en mes FUTURO:** navegando un mes **posterior** al mes en curso, la flecha es **`ArrowLeft` (←)**, en posición **leading**.
- [ ] La flecha está **siempre a la izquierda** del texto: alternando entre un mes pasado y uno futuro, el borde izquierdo del texto "Ir al mes en curso" **no se mueve** (delta **0px** en `getBoundingClientRect().left` del texto).
- [ ] La flecha **13px** hereda el color del texto (`--muted` reposo / `--ink-2` hover); `gap` texto↔flecha **5px**; separador `·` en `--faint`; `gap` de la fila **8px**.
- [ ] **`cursor: pointer`** al pasar el mouse por encima del link (NO la flecha default de `<button>`).
- [ ] **Hover:** texto+flecha suben a **`--ink-2` con subrayado** (`underline-offset` 2px); transición de color **140ms**. **Focus con teclado:** anillo `--accent-soft` 3px con radio `--r-chip` + subrayado.
- [ ] El link **no** usa índigo, **ni** verde, **ni** rojo, en ningún estado.
- [ ] **La fila del `statusLabel` mide lo MISMO con y sin link** (delta 0px). La fila **no** lleva `min-h-[34px]` ni ninguna reserva de alto.
- [ ] **Ningún elemento del header se desplaza** al aparecer/desaparecer el link: H1 + `ChevronsUpDown`, `CurrencyChip`, flechas ‹ ›, totales y label "GASTOS" **conservan su `x` e `y`** (0px).
- [ ] A **≥1288px** el cluster de acciones ("Ordenar secciones" / "+ Nuevo movimiento") **no se reposiciona** ni dispara `flex-wrap` al aparecer el link.
- [ ] A **≥1288px** el link está **en la fila del `statusLabel`**, después del `·`, y **no** en la fila del título.
- [ ] A **<1288px** el link está **fuera del pill** (`aria-hidden`) y es **clickeable/focalizable**; pill y chip **no** se mueven lateralmente.
- [ ] Con `prefers-reduced-motion` el link no tiene animación de entrada; solo la transición de color de hover/focus.
- [ ] Orden de foco por teclado: disparador de salto (H1) → link "Ir al mes en curso" → acciones de la derecha.
