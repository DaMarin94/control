# Moneda — cromo neutro, indicador global, símbolos, set curado, "Más opciones"

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Moneda por card de reporte: `card-grafico.md` *Moneda por reporte*. Pertenece al grupo *Patrones de componentes vigentes*.

### Multi-moneda — cromo neutro de moneda y cotización

La moneda explícita por movimiento, su cotización y la conversión de display a la **moneda default** del usuario aportan piezas reutilizables que **nunca tiñen el monto**. **Regla viva:** **la moneda es cromo neutro** — badge, código y cotización van en **neutros** (`--ink-2` / `--muted` / `--panel-3`); **nunca** verde/rojo (eso es tipo, regla dura 1) ni índigo (eso es marca, regla dura 2). El color del monto lo da su **tipo**; la moneda solo lo **rotula**. Cifra original y convertida van **ambas en mono tabular** (regla dura 3). El índigo aparece solo como **cromo de interacción** (focus ring, thumb activo del segmented).

- **Badge de código de moneda:** chip neutro con el código (`"USD"`, `"ARS"`), **mismo molde que el chip "Anulado"** (`--panel-3` / `--muted` / `--r-chip` 7px / 11px·600·`.04em` / `mono`). Identifica la moneda de origen; no se tiñe.
- **Segmented neutro de moneda:** el **segmented del DS sin semánticos** (molde del triple switch de tipo): track `--panel-3`, radio `--r-pill`, padding `2px`; segmentos texto 13px/600 `mono`. Seleccionado = thumb `--panel` + `--shadow-sm`, texto `--ink`, deslizamiento 0.14s; no seleccionado = `--muted` → `--ink-2` en hover. **Sin color semántico ni índigo en los segmentos.** `role="radiogroup"` + `role="radio"`, focus ring `--accent-soft` 3px. Es el selector de moneda en `/configuracion` y en el bloque moneda+cotización de los forms. **4 segmentos** (ARS/USD/EUR/BRL); forma completa en *Monedas configurables*.
- **Par moneda + cotización (forms de único/fijo/cuotas):** sub-bloque que **modula el Monto** desde dentro del **disclosure colapsable "Más opciones"** —que también contiene el selector de método de pago— ubicado como **último bloque del form, antes de los botones de acción** (ver *Monedas configurables* §4 (A)). Cuando `moneda ≠ default`: `grid grid-cols-2 gap-[14px]` → Moneda (segmented neutro) + Cotización (input mono con **prefijo de par** de lectura, ej. `"USD→ARS"` / `"ARS→USD"`, en `mono` 12px `--muted`). Cuando `moneda == default`: el campo Cotización **se oculta**. Pre-carga editable: nota *field-note* "Cotización de referencia del mes" (glifo `History` 12px) → "Cotización modificada" al editar. Validación: cotización > 0 (error con borde `--expense` + ring `--expense-soft` + mensaje `--expense-ink`, mismo patrón que el Monto). El **calculado no muestra el bloque** (hereda moneda/cotización del origen, read-only).
- **Ítem de `/mes` (`MovementItemRow`) — solo el convertido, una línea:** el monto convertido a la default es lo único que la fila muestra (col 4, 15.5px/600, color por tipo, mono, **una sola línea siempre**). Bajo anulado conserva `line-through` + color por tipo. El **badge de código de moneda** y el **valor original** (cross-rate) viven en la card de detalle (hero con badge `USD` + filas "Monto original" y "Cotización"; ver `card-detalle.md`), con el mismo molde neutro (símbolo de su moneda, sin signo).
- **Tarjeta de ajuste (patrón reutilizable, `/configuracion`):** `.card` del DS con **fila de ajuste** `flex items-center justify-between gap-6` (izquierda: título 14.5px/600 `--ink` + descripción *Meta/subtítulos* `--muted`; derecha: el control). Un ajuste = una fila. "Moneda por defecto" (segmented neutro de moneda) persiste **en vivo** al seleccionar (sin botón Guardar; toast de confirmación) y **recomputa el display** de `/mes` y reportes sin tocar lo guardado.
- **Sidebar:** link **"Configuración"** (`Settings` 18px), mismo molde/estados que el resto; activo por prefijo `startsWith("/configuracion")`. (Orden de ítems: ver `sidebar.md` e `historial.md` §8.)
- **Reportes:** operan sobre datos convertidos (la conversión es capa de display aguas arriba del gráfico); la moneda de cada card la elige su selector propio (`card-grafico.md` *Moneda por reporte*). El cambio de default recomputa en vivo.

> El caso **mono-moneda no se ensucia**: el **ítem** de `/mes` no muestra complejidad de multi-moneda; en el **form**, moneda+cotización (junto con el método de pago) vive dentro del disclosure "Más opciones", colapsado por default, y cuando moneda=default el campo Cotización se oculta.

### Indicador de moneda default a nivel app

Lenguaje **coherente, persistente y a nivel app** para comunicar **en qué moneda están todos los montos mostrados**: un **indicador global** que dice, en toda pantalla de consumo, "todos estos montos están en {moneda default}". Se apoya en el badge de código de moneda y la regla *la moneda es cromo neutro*.

**El indicador global es INFORMATIVO, no interactivo.** Comunica la moneda default vigente; **no la cambia**. El cambio vive **únicamente en `/configuracion`**. El chip **no** despliega popover ni segmented: es lectura + link. (Un indicador interactivo sería alcance nuevo.)

#### 1. El chip de moneda default — pieza canónica

**Mismo molde que el badge de código de moneda** (chip `--panel-3` / `--r-chip` 7px / código en `mono`), enriquecido para su rol:

- **Composición:** glifo `Wallet` (lucide, 13px, `--muted`, `shrink-0`, `aria-hidden`) + código **`"ARS"` / `"USD"` / …** en `mono` 11.5px·600·`.04em` `--ink-2`. Sin símbolo de país ni bandera.
- **Caja:** `inline-flex items-center gap-[6px]`, fondo `--panel-3`, radio `--r-chip` 7px, padding `px-[8px] py-[3px]`. **Neutro estricto.**
- **Afordancia a `/configuracion` (navegación, no edición):** **`Link` a `/configuracion`** con `aria-label="Moneda por defecto: {código}. Cambiar en Configuración"`. *Reposo* como arriba; *hover* fondo `--panel-2`→texto `--ink` y aparece un glifo `Settings`/`ChevronRight` 11px `--faint` a la derecha, 0.14s; *focus* ring `--accent-soft` 3px, radio `--r-chip`.
- **Se muestra siempre**, también cuando todo está en la default. Su valor es ser constante.

#### 2. Ubicación por pantalla — el chip vive en el header, a la derecha del eyebrow

En el **`.phead`** de cada pantalla con totales, alineado con la **identidad** del header (eyebrow + H1), **no** con la zona de acciones. **Fila del eyebrow**, a su derecha, `gap-[10px]`. Por encima del H1, nunca compitiendo con la cifra hero.

- **Dashboard (`/`):** `.phead`, fila del eyebrow "Tu mes" → `[Tu mes]  [💳 ARS]`; `+ Nuevo movimiento` a la derecha por el `justify-between`. Un solo chip preside todas las cards.
- **`/mes`:** en el `.phead` (≥1288px / `--bp-arrows`), fila del eyebrow "Tu mes" → `[Tu mes] [💳 ARS]`, encima del H1. En <1288px (header con `.stepper`), el chip va en la **misma fila del stepper**, a su derecha, sin romper el centrado del rótulo de mes.
- **`/reportes`:** en el `.phead` de la pantalla, **no** en cada card.
- **`/configuracion`:** **NO lleva chip indicador** (es donde la moneda default se edita; el segmented ya es control y lectura).

> **Consistencia:** mismo chip, mismo lugar, mismo valor en Dashboard, `/mes` y `/reportes`. Al cambiar la default, **todos** los chips reflejan el nuevo valor en vivo.

#### 3. Cómo los totales comunican su moneda — símbolo por moneda + chip global como contexto

Los totales y montos agregados llevan el **símbolo de su moneda** (*Símbolos de moneda*): `$` ARS, `US$` USD, `€` EUR, `R$` BRL. El símbolo hace **autosuficiente** cada cifra. El **chip global** sigue como **contexto de pantalla** y afordancia a `/configuracion`. No se duplica el **código** pegado a cada número agregado.

- **Los totales NO se recolorean ni cambian de tipografía** por la moneda: color por tipo (o neutro) y `mono tabular`. El símbolo hereda el color del monto.
- **Cifra original vs. convertida (jerarquía):** el valor original de un movimiento cross-rate (en la card de detalle) muestra la cifra **con el símbolo de su moneda** (ej. `US$100,00`). Es **información del ítem**, distinta del **contexto de pantalla**. Jerarquía: global (header) > convertido dominante (en el símbolo de la default) > original subordinado (en el símbolo de su moneda). Ningún nivel se tiñe.

#### 4. Jerarquía y reglas duras

- **Cuatro señales de cromo de moneda, sin pisarse:** (1) **símbolo por cifra** = la moneda de ese número; (2) **chip global** en el header = contexto de pantalla + afordancia a config; (3) **badge de moneda original** del movimiento cross-rate = etiqueta de origen junto al convertido; (4) **valor original** = la cifra en su moneda de origen. El chip global es el de **mayor alcance** y **menor peso visual**; los marcadores por-movimiento son **locales** y solo aparecen en cross-rate.
- **La moneda es cromo neutro:** chip global en `--panel-3` / `--muted` / `--ink-2`; el **símbolo** hereda el color del monto. **Nunca** verde/rojo por moneda ni índigo. Índigo solo como **focus ring** del chip-link.
- **Toda cifra va en mono tabular**: el código del chip, los totales, los originales y el **símbolo de moneda**.

### Símbolos de moneda por código

Cada moneda tiene su **símbolo propio** como prefijo de la cifra. El símbolo es **cromo neutro de moneda**: hereda el color del número (tipo) y va en `mono tabular` junto a la cifra.

**Tabla de símbolos — fuente de verdad única y centralizada:**

| Código | Símbolo | Ejemplo (formato es-AR) | Negativo |
|---|---|---|---|
| `ARS` | `$` | `$219.400,00` | `−$1.234,56` |
| `USD` | `US$` | `US$1.500,00` | `−US$1.234,56` |
| `EUR` | `€` | `€1.500,00` | `−€1.234,56` |
| `BRL` | `R$` | `R$1.500,00` | `−R$1.234,56` |

- **Por qué `US$` (y no `U$S`):** prefijo internacional inequívoco, lee limpio antes de la cifra. `U$S` es grafía coloquial y rompe el patrón "símbolo + cifra".
- **Centralizado / extensible:** el símbolo vive en **un único mapa `código → símbolo`**. **Toda** cifra de dinero se formatea a través de ese formateador; ningún componente arma el símbolo a mano. Sumar una moneda = agregar una entrada al mapa.

**Placement y composición (todas las cifras de dinero):**

- **Símbolo pegado a la cifra, prefijo, SIN espacio:** `$219.400,00`, `US$1.500,00`. Mismo `mono tabular` y color que la cifra.
- **Signo antes del símbolo:** `[signo][símbolo][cifra]` → `−$1.234,56`. El `−` (U+2212) y el `+` heredan el color del monto (por tipo, nunca por signo — regla del signo en `fundamentos.md`).
- **Dónde aplica:** **todas** las cifras — totales/subtotales, montos de ítem, cards del Dashboard, balance hero, mini-balance, ejes y tooltips de reportes, montos de los forms. Las convertidas llevan el símbolo de la **default**; el valor original de un cross-rate lleva el de la **moneda original**.

**Relación con el chip global y el badge por-movimiento:**

- **El chip global sigue vigente como CONTEXTO**, no como única desambiguación. Siempre visible.
- **El badge de código (`"USD"`) del movimiento cross-rate se mantiene** junto al monto convertido (que va en el símbolo de la default y no delata el cross-rate): marca "este movimiento es cross-rate" de un vistazo; el `US$` del valor original confirma la cifra en su moneda.

### Monedas configurables — set curado ARS/USD/EUR/BRL

El set es de **4 monedas curadas: `ARS`, `USD`, `EUR`, `BRL`**. Sin tokens ni patrones propios: extiende los patrones de moneda a 4 valores. **"La moneda es cromo neutro"** se mantiene. Toda cifra en **mono tabular**.

**Alcance visible:** (a) el **selector tiene 4 opciones**; (b) **EUR y BRL** participan del cromo de moneda con el mismo tratamiento que ARS/USD. **La tabla de cotizaciones de referencia es interna y no tiene UI de edición**; la vista de cotizaciones externas vive en `datos-externos.md`. El único campo de cotización editable es el del **bloque moneda+cotización del form**.

#### 1. Selector de moneda — segmented neutro a 4 segmentos

**No** es un dropdown: 4 códigos cortos caben en un segmented que mantiene **todas las opciones visibles** (un dropdown escondería 3 de 4). Aplica **idéntico** en el form y en `/configuracion`.

- **Forma y tokens:** track `--panel-3`, radio `--r-pill`, padding `2px`. **4** segmentos de **ancho igual** (`25%`), texto `13px`/`600` `mono` `tracking-[0.01em]`, padding `px-[14px] py-[6px]`, radio `--r-pill`. **Thumb deslizante** (`--panel` + `--shadow-sm`): `left = calc(${(selectedIndex / 4) * 100}% + 2px)`, `width = calc(25% - 4px)`, transición `[left,width]` `140ms ease-out` (instantánea con `prefers-reduced-motion`).
- **Estados:** *seleccionado* = thumb + texto `--ink`. *No seleccionado* = `--muted` → `--ink-2` en hover. *Disabled* = `opacity-50` + `cursor-not-allowed` (el set completo, ej. mientras persiste el cambio de default). *Focus* = ring `--accent-soft` 3px. **Sin color semántico ni índigo.**
- **A11y:** `role="radiogroup"` + 4 `role="radio"` con `aria-checked`; flechas ←/→ ciclan (wrap módulo `CURRENCIES.length`, no hardcodeado).
- **Etiquetas y orden:** `"ARS" / "USD" / "EUR" / "BRL"` en `mono`, orden `ARS → USD → EUR → BRL`. Mismo orden en form y `/configuracion`.
- **Responsive / compacto:** en `/configuracion` vive a la derecha de la fila de ajuste, con holgura. El caso ajustado es el **bloque del form** (mitad del `grid grid-cols-2`):
  - **Nunca hace scroll horizontal interno** ni recorta etiquetas. Para ganar espacio **puede reducir el padding horizontal** de `px-[14px]` hacia un mínimo de `px-[8px]` (manteniendo `py-[6px]`). El texto se mantiene a `13px`.
  - Si aun así no entra, el bloque moneda+cotización **colapsa a una sola columna apilada** (Moneda arriba, Cotización abajo, mismo `gap`). El breakpoint exacto lo resuelve `control-frontend` midiendo; el comportamiento: 4 etiquetas siempre legibles, sin recorte ni scroll.

#### 2. Símbolos y presentación de EUR (€) y BRL (R$)

Dos entradas más del **mapa `código → símbolo`**. **Ningún componente arma el símbolo a mano.**

- **Por qué `€` y `R$`:** `€` universal; `R$` prefijo estándar del real (no `R `, no `BRL `). Componen igual que `$`/`US$`: pegado, sin espacio, mismo mono y color; signo antes del símbolo (`−€1.234,56`, `−R$1.234,56`).
- **Presentación idéntica a ARS/USD:** sin recolorear, sin cambio de tipografía, sin bandera ni código de país.
  - **Chip global (`CurrencyChip`):** mismo molde; muestra `"EUR"` / `"BRL"`. `aria-label` con el código.
  - **Movimiento cross-rate:** el **badge de moneda original** muestra `"EUR"` / `"BRL"` y el **valor original** la cifra con su símbolo (ej. `€100,00`, `R$350,00`). El **convertido dominante** sigue en el símbolo de la **default** (que puede ser cualquiera de las 4).
  - **Totales, cards, balance hero, mini-balance, ejes/tooltips, montos de forms:** cada cifra con el símbolo de **su** moneda vía el mapa.

#### 3. Bloque de cotización del form — aguanta las 4 monedas

**Input de cotización:** caja `rounded-ctl border-[1.5px]`, prefijo de par en `mono` 12px `--muted`, input `mono` 15px/600, nota *field-note* "Cotización de referencia del mes" / "Cotización modificada", validación `> 0` con borde `--expense` + ring `--expense-soft`. El valor pre-cargado sale de la tabla de referencia interna (invisible visualmente). El encuadre vive en el disclosure y el input se oculta cuando moneda=default (§4).

- **El prefijo de par aguanta las 4 monedas:** `"USD→ARS"`, `"EUR→ARS"`, `"BRL→USD"`, etc. (7 chars `mono`, `shrink-0`, `select-none`).
- **Nota de pre-carga:** glifo `History` 12px `--muted` + texto `--muted`; al editar pasa a "Cotización modificada" en `--ink-2` (sin glifo).

#### 4. Disclosure "Más opciones" del form — moneda+cotización + método de pago

El form (tabs Único / Fijo / Cuota) agrupa **dos campos secundarios** —**moneda+cotización** (`CurrencyExchangeBlock`, compartido por transaction-form / recurring-form / installment-form) y **método de pago** (selector opcional + su checkbox condicional de *débito automático*)— dentro de **un único disclosure colapsable**. Reutiliza el **patrón disclosure** del *Acordeón* (`mes-listado.md`): cabecera = único `<button>` con `aria-expanded` + `aria-controls`, chevron que rota, animación altura 0↔auto + fade. El cromo interno de cada sub-bloque vive en sus secciones (moneda: §1–§3; método: `metodos-pago-iconos.md` *Render del ícono en el selector de método del form de carga* y *Débito automático — control condicional en el form de carga*).

**(A) Rótulo y ubicación.**

- **Rótulo: "Más opciones".** **13px / 600**, `--ink-2` en reposo, `tracking-[0.01em]`, Space Grotesk. Agrupa dos campos heterogéneos que la mayoría de las cargas dejan en su default; un rótulo enumerativo sería largo. Descartados "Avanzado" (connota ajustes técnicos) y "Extra" (informal).
- **Ubicación: el último bloque del formulario, justo antes de la fila de botones (Guardar / Cancelar).** Un bloque más del stack, con `space-y-[14px]`. **Colapsado es una sola fila delgada.** Entre el disclosure y la fila de acciones se conserva **la misma separación que el form deja entre su último bloque y sus botones** (no se inventa un valor). **Sin divisor ni fondo** entre el disclosure y los botones. Expandido, su cuerpo termina en el sub-bloque de Método (o su checkbox) y la separación al pie aplica desde ahí, con el mismo gap.

**(B) Trigger (la cabecera del disclosure):** `<button>` **al aire** (sin caja de input), `w-full flex items-center gap-[7px]`, padding `py-[7px]`. De izq → der:

- **Chevron:** `ChevronRight` **16px** `stroke-width 2`, **primer elemento**, `--muted`. Rota: colapsado ▶ (0°); expandido ▼ (90°).
- **Label:** **"Más opciones"**.
- **Resumen a la derecha (colapsado):** ver **(C)**.
- **Estados:**
  - **Reposo:** chevron `--muted`, label `--ink-2`. `cursor: pointer`.
  - **Hover** (sin fondo): chevron → `--ink-2`, label → `--ink`, 0.14s.
  - **Focus:** ring `--accent-soft` 3px con radio `--r-chip` 7px (`focus-visible`).
  - **Expandido:** chevron en ▼; sin cambio de fondo.
- **Arranca SIEMPRE colapsado.** Sin excepciones: también en **edición** y **duplicar**, aunque haya `moneda ≠ default` o un método elegido. **Nunca auto-expandido.**
- **Animación:** altura 0↔auto (`overflow: hidden`) + fade + rotación del chevron, **0.22s ease-out**. Con **`prefers-reduced-motion`**: instantáneo.

**(C) Resumen colapsado combinado — dos segmentos de un vistazo.** Al final de la fila (tras un `flex-1`), **hasta dos segmentos en orden fijo** (moneda, método):

1. **Segmento moneda (siempre presente):** **código** en **`mono` 12px `--muted`** (ej. `"ARS"`). Si `moneda ≠ default`, se suma la cotización: `"USD · 1.480,00"` (código + `·` `--faint` + valor mono `--ink-2`). `shrink-0`: **nunca** se trunca.
2. **Divisor de grupo + segmento método (solo si hay método):** **hairline vertical** (`--line` 1px, `h-[12px]`, `mx-[8px]`, `self-center`, `shrink-0`, `aria-hidden`) — **no** se reusa el `·` (separador interno del grupo moneda). Luego: **glifo del método** (16px `--ink-2`, `shrink-0`) + **nombre** (UI 12px `--ink-2`, `truncate`). **Sin chip de tipo.** Sin método, segmento **y divisor se omiten**.
- **Débito automático NO aparece en el resumen.**
- **Truncado:** el **nombre del método** es el **único elemento flexible**. Label, segmento moneda y glifo del método **nunca** se truncan.
- **Casos de referencia:**
  - `moneda=default`, sin método → `ARS`.
  - `moneda=default`, método Visa → `ARS │ [glifo] Visa`.
  - `moneda≠default`, sin método → `USD · 1.480,00`.
  - `moneda≠default`, método Visa → `USD · 1.480,00 │ [glifo] Visa`.
- Al **expandir**, el resumen se oculta.

**(D) Contenido y orden interno del cuerpo expandido.** `mt-[7px]` respecto del trigger. **Dos sub-bloques**, separados por un **divisor `--hair` 1px horizontal (`my-[14px]`)**:

1. **Sub-bloque Moneda+cotización** (primero — pega con el Monto). Ver **(E)**.
2. **— divisor `--hair` —**
3. **Sub-bloque Método de pago.** Selector de método (opcional) y, **inmediatamente debajo**, el **checkbox condicional "Débito automático"** (solo con método tipo Débito). Ritmo `space-y-[14px]` entre selector y checkbox.

**(E) Sub-bloque Moneda+cotización — `moneda == default` oculta la Cotización.** El backend ignora `exchangeRate` cuando `currency === anchorCurrency`; el form envía `exchangeRate = 1`.

- **`moneda == default`:** **solo el selector**, a **ancho completo** (`CurrencySegmented` sin `compact`, `px-[14px]`). Sin label "Cotización", caja, prefijo ni nota.
- **`moneda ≠ default`:** **`grid grid-cols-2 gap-[14px]`** → selector (`compact=true`) + input de cotización completo (prefijo de par, nota, validación).
- **Transición al cambiar moneda con el disclosure abierto:** la columna de cotización aparece/desaparece y el selector pasa de full-width a media columna; la columna hace **fade + leve expansión de ancho** (≈0.14–0.18s). Con **`prefers-reduced-motion`**: instantáneo. No se anima la altura del disclosure.

**(F) El form Calculado NO renderiza "Más opciones".** Hereda moneda y cotización de su **origen** y no muestra el selector de método.

> Con moneda=default el backend usa `exchangeRate = 1`; con moneda≠default el campo está presente, editable y validado `> 0`.

> Todo el cromo de las 4 monedas sale del **mapa de símbolos** y el **array de monedas del segmented**, y el del método del **allowlist de íconos** (`PAYMENT_METHOD_ICONS`) — puntos únicos centralizados. No hay tokens, colores ni reglas propios.
