# Métodos de pago — ícono, débito automático y predeterminado

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. El disclosure "Más opciones" donde vive el selector de método: `multi-moneda.md` §4.

## Métodos de pago — identificador de ícono

Un método de pago tiene **nombre**, **tipo** (Crédito / Débito / Efectivo) e **identificador visual = un ícono** elegido por el usuario. La sección **Métodos de pago** (`/configuracion/metodos-pago`) y su modal crear/editar son **espejo 1:1 de Categorías** (`/configuracion/categorias`) en chrome, layout, estados, validaciones, empty y confirmación de borrado; lo único propio de esta feature es que **la identidad visual es un ÍCONO, no un color**. Todo lo que sigue define ese ícono (el set, cómo se elige, cómo se renderiza); el resto reusa el patrón de Categorías sin cambios.

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
- **Diferenciación entre métodos = ícono + nombre + tipo** (igual que en Categorías la diferenciación es color + nombre). Los genéricos son **glifos distintos entre sí** ($ · tarjeta · billete · monedas · banco · billetera · QR) y las marcas son reconocibles por forma. Dos métodos con el mismo ícono se distinguen por su **nombre**, mismo criterio que dos categorías con el mismo color.

### Set curado de íconos — allowlist v1 (`PAYMENT_METHOD_ICONS`)

Fuente doble:

- **Genéricos → `lucide-react`.** Glifos outline (stroke).
- **Marcas → `simple-icons`** (glifos de una sola *path*, `fill: currentColor`, ideales para monocromo). El catálogo exacto se **verifica en la versión instalada**. Toda marca del set cuyo slug **no exista** en la versión instalada **cae al genérico `card`** (fallback duro). *(Dudoso: el texto de origen decía que `simple-icons` no estaba instalado; verificar contra `package.json`.)*

El backend guarda la **clave** en el campo `icon` (string) con **allowlist en código**, mismo criterio que el pool de colores de categorías (duplicado back/front). Lista canónica v1:

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

**Marcas comunes en Argentina que NO están disponibles como marca y caen a genérico:** Ualá, Naranja X, Brubank, Personal Pay, MODO, Cuenta DNI, Cabal y los bancos locales (Galicia, Nación, Provincia, etc.) **no están en simple-icons** → el usuario elige un genérico (típicamente `card`, `wallet`, `bank` o `qr`). Santander / BBVA, aun si estuvieran en la versión instalada, **quedan fuera del set v1** para mantenerlo acotado. Cualquier ampliación futura del set = **nueva clave en la allowlist back/front**.

### Default y ausencia de "Aleatorio"

- **Default al crear:** `card`. No hay algoritmo de "menos usado" como en el color de categoría: el color se autoasigna para **separar perceptualmente**, pero el ícono debe **describir el método real**, así que un default fijo y neutro (tarjeta) es lo correcto; el usuario lo cambia.
- **Sin botón "Aleatorio".** Ruptura deliberada del espejo con el color-picker: el color es identidad puramente estética (aleatorizar es válido), pero el ícono **carga significado** (debe coincidir con el método real); un ícono al azar daría una identidad engañosa. El icon-picker **no** incluye el `Shuffle`.

### Icon-picker en el modal de método — espejo del color-picker

Vive en el mismo slot que el picker de color en el modal de categoría. Reusa la geometría y los estados del *Picker de color de categoría (matriz de swatches)* (`categorias-colores.md`), cambiando el swatch de color por una **celda de ícono**:

- **Grid:** `grid-template-columns: repeat(6, 1fr)`, gap 6px. Orden de render: primero los **genéricos** en el orden de la tabla, luego las **marcas** (12 íconos → 2 filas).
- **Celda:** cuadrada `aspect-ratio: 1`, radio `--r-ctl` 10px (un paso mayor que el `--r-chip` del swatch de color, porque contiene un glifo y no un fill pleno). Reposo: fondo `--panel-3`, glifo **20px** centrado en `--ink-2`.
- **Estados** (mismos que el swatch de color): *hover* = `scale(1.12)` + `--shadow-sm`, borde `--line-strong`, glifo → `--ink`, 0.14s. *Seleccionada* = anillo **neutro** `box-shadow: 0 0 0 2px var(--panel), 0 0 0 4px var(--ink)` (ring `--ink`, no acento — regla dura 2) + glifo `--ink`. *Focus* = ring `--accent-soft` 3px.
- **Fill vs stroke:** las marcas (simple-icons) son glifos rellenos y los genéricos (lucide) son outline; conviven en la misma grilla a **igual caja (20px)** y **misma tinta neutra**. La diferencia de peso relleno/contorno ayuda a leer "marca vs genérico"; no se normaliza.
- **Oscuro:** la celda `--panel-3` y el glifo (`currentColor`) se resuelven por token; el **hairline de contorno** `--line` en la celda es **obligatorio en oscuro** (mismo recurso que el swatch de color).

### Render del ícono en la lista de `/configuracion/metodos-pago`

Espejo del ítem de la lista de categorías (swatch + nombre + scope + "N movimientos"), con el color-swatch reemplazado por una **tile de ícono**:

- **Tile de ícono** (izquierda, en el slot del swatch de color): cuadrada ~**34px**, radio `--r-ctl`, fondo `--panel-3`, borde `--line` (hairline; obligatorio en oscuro), glifo **18px** centrado en `--ink-2`. En categorías el cuadrado **es** el color; acá el cuadrado neutro **sostiene** el glifo (la identidad).
- **Nombre:** rol *Nombre de movimiento* (14.5px / 600 `--ink`), igual que el nombre de categoría.
- **Tipo (Crédito / Débito / Efectivo):** **chip neutro** del DS (`--panel-3` / `--muted` / `--r-chip` 7px / 11px·600·`.04em`), en el slot del badge de scope. **Neutro, no semántico ni índigo** — el tipo de método es metadato. (Difiere del badge de scope "Ambos" de categorías, que va en índigo por ser marca.)
- **"N movimientos"** (si la pantalla lo lleva — dato funcional del analista): mismo contador derivado de solo lectura que en categorías (mono tabular, `--muted`), a la derecha de la fila.
- **Orden de la fila** (espejo de categorías): `[tile ícono] [nombre] [chip tipo] … [N movimientos]`.

### Render del ícono en el selector de método del form de carga

El form de movimiento (tabs Único / Fijo / Cuota) tiene un **selector de método de pago opcional**. **Ubicación:** **dentro del disclosure "Más opciones"** del form, como **segundo sub-bloque** (tras moneda+cotización) — ver `multi-moneda.md` *Disclosure "Más opciones" del form*. Su cromo:

- **Control:** `Select` del DS (mismo molde que el selector de categoría), **opcional**, con opción **"(ninguno)"** y **default = ninguno / vacío** (salvo prefill por *Predeterminado por estructura*, abajo).
- **Trigger (con método elegido):** glifo del método **16px** `--ink-2` (`shrink-0`) + nombre (`--ink`) + chip de tipo neutro chico (opcional; si el ancho aprieta, el tipo se omite en el trigger y queda solo ícono + nombre).
- **Trigger (ninguno):** placeholder **"Sin método de pago"** en `--faint`, sin glifo. **No es error**: el campo es opcional.
- **Opciones del menú:** cada fila = glifo 16px `--ink-2` + nombre `--ink` + chip de tipo neutro a la derecha. La opción **"Sin método de pago"** ("(ninguno)") encabeza la lista, sin glifo.
- **Sin botón "+ Nueva" análogo al de categoría** salvo que el analista lo defina funcionalmente: categorías lo tiene por RF-MU-004; para método de pago no hay un RF equivalente cerrado, así que **no se asume**. Si se define, reusaría el mismo patrón.
- **Oscuro:** glifos (`currentColor`), chips y `Select` por token; sin tratamiento especial más allá del hairline ya definido.

### Débito automático — control condicional en el form de carga

Cuando el **método de pago seleccionado es de tipo Débito**, el form de movimiento muestra un **checkbox "Débito automático"** para ese movimiento puntual. Es un **atributo del movimiento**, no del método.

- **Visibilidad condicional:** el control se **renderiza solo** si hay un método elegido y su tipo es **Débito**. Si no hay método (`"Sin método de pago"`) o el tipo es **Crédito / Efectivo**, el checkbox **no se muestra** (se desmonta; no queda deshabilitado ni atenuado). Al cambiar el método a uno no-débito el control desaparece. (El manejo del valor al ocultarse es funcional — analista.)
- **Ubicación:** **inmediatamente debajo** del selector de método de pago, como continuación del mismo sub-bloque —lo **modula**, mismo patrón que la cotización modula a la moneda—, **dentro del disclosure "Más opciones"**. Sigue el ritmo interno del sub-bloque (`space-y-[14px]`).
- **Control:** **checkbox del DS** (el mismo del `CategoryFilterPopover`), en fila **`flex items-center gap-[9px]`** con el label a la derecha: casilla + **"Débito automático"** (registro UI 13px/500 `--ink-2`). **No lleva `Label` arriba**; admite un **field-note** opcional si el analista define copy de ayuda.
- **Estados:**
  - **Desmarcado (default):** casilla `--panel` / borde `--line`; al mostrarse arranca **desmarcado**.
  - **Marcado:** casilla rellena con el **check del DS** (fill de acento como **cromo de interacción** del control — misma licencia que el focus ring y el thumb del segmented; **no** es color de monto ni decoración de marca).
  - **Hover:** borde `--line-strong`.
  - **Focus:** ring `--accent-soft` 3px.
- **Neutralidad semántica:** el control **no** usa verde/rojo ni tiñe cifras; el único índigo es el del check/focus (interacción). Es el **único** campo condicional por tipo de método en el form.

### Débito automático — indicador en la card de detalle

El débito automático **no** se indica en la fila de `/mes`: es una **fila de la ficha de la card de detalle** ("Débito automático · Sí", solo si `autoDebit === true`) — ver `card-detalle.md` *Card de detalle de movimiento*. Lenguaje del glifo dentro de la card:

- **Glifo:** `Zap` (lucide, `--muted`, el svg `aria-hidden`) + rótulo de la fila.
- **Neutralidad:** **nunca** semántico (no es ingreso/gasto) ni índigo (no es marca) — es metadato del movimiento.
- **Condicional:** solo aparece si el flag es `true`; si es `false`, no ocupa lugar.
- **Bajo anulado:** hereda la atenuación del movimiento como el resto del contenido.

*(Dudoso: el texto de origen daba el glifo a 13px en una descripción y a 14px en otra; el tamaño vigente es el que fija `card-detalle.md`.)*

### Predeterminado por estructura — configuración en el modal + indicador de solo-lectura en la fila de `/configuracion/metodos-pago`

Cada método puede marcarse como **predeterminado** para una o varias de las tres **estructuras** de movimiento (**Únicos / Fijos / Cuotas**), con **exclusividad por estructura**: una estructura tiene a lo sumo un método (asignarla a uno se la quita a cualquier otro). El default **prellena** el selector de método al **crear un movimiento de esa estructura** — aplica a **egreso e ingreso** por igual — y sigue **editable** en el form de carga. Es prefill, no restricción.

**Copy.** El default es por **estructura**, no por "tipo de gasto". **Prohibido** el término "gastos" en esta superficie: prellena movimientos de ambas polaridades. Las etiquetas de estructura son "Únicos" / "Fijos" / "Cuotas" (plural, consistente con los group headers de `/mes`).

**Decisión de alojamiento — la edición vive en el modal de crear/editar método; la fila es solo-lectura.** El default es una **propiedad de configuración del método**, no una acción de escaneo rápido sobre la lista: pertenece al mismo lugar donde se define nombre/tipo/ícono. Ventajas: (a) una sola superficie de edición del método (menos afordancias sueltas, menos carga cognitiva sobre la fila); (b) la fila queda limpia y legible como *inventario* (identidad + estado), sin controles activos que compitan con el kebab; (c) crear y editar comparten exactamente el mismo control. La fila conserva el **lenguaje visual del estado** (estrella + pills) pero **sin afordancia de edición** — para cambiarlo, se abre *Editar*.

**Star = default (lenguaje unificado).** El glifo `Star` (lucide) relleno `--accent` marca "predeterminado". El acento acá es **cromo de UI/estado, no monto** (misma licencia que el punto del filtro, el thumb del segmented y el check del checkbox; regla dura 2 intacta — no hay cifras en esta pantalla). Se distingue del **chip de tipo neutro** (Crédito/Débito/Efectivo, `--panel-3`/`--muted`) por color, posición y por el prefijo estrella.

#### Sección "Predeterminado para" dentro del modal (`PaymentMethodFormModal`)

**Ubicación.** **Última sección** del cuerpo del form, **después del Icon-picker**, precedida por un **divisor `--hair` full-width** (con `pt`/`mt` de aire). Nombre/Tipo/Ícono definen **qué es** el método (identidad); esta sección define **cómo se usa** (comportamiento de prefill) — se lee como grupo distinto, subordinado a la identidad. Aplica **igual en crear y en editar**, y para **cualquier tipo** de método.

- **Label de sección:** "Predeterminado para" — mismo molde que los labels del modal (12.5px / 600 `--ink-2`, `tracking-[0.01em]`), **sin** marca `required` (es opcional).
- **Ayuda:** debajo del label, 12px `--muted`: **"Se prellena al crear un movimiento de esta estructura. Podés cambiarlo al cargar."**
- **Tres filas de checkbox**, una por estructura, **orden fijo Únicos → Fijos → Cuotas**, reusando el **checkbox del DS** (cuadro `--line`/`--panel` destildado, fill `--accent` + check blanco tildado). Cada fila: `flex items-center gap-[9px]`, `py-[7px]`, toda la fila clickeable (`role="checkbox"`, `aria-checked`, tabbable, Space/Enter): checkbox + **label de estructura** (13px / 500 `--ink`) + a la derecha `flex-1 text-right truncate` la **nota de titular** (abajo). Hover de fila `--panel-2`; focus ring `--accent-soft` 3px.
  - **Tildado** = este método será/es default de esa estructura.
  - **Estados del checkbox:** destildado `--panel`/`--line`; tildado fill `--accent` + check; hover borde `--line-strong`; focus ring `--accent-soft` 3px.
- **Neutralidad de color:** el único color de la sección es el acento del check (interacción). **No** verde/rojo, **no** tiñe nada como monto.

**Exclusividad — feedback preventivo dentro del modal.** Junto a cada estructura que **tiene OTRO método**, nota **"Hoy: {OtroMétodo}"** (12px `--muted`, `truncate`, alineada a la derecha de la fila). Declara a quién se le va a quitar **antes** de tildar. Reglas: estructura tomada por otro → nota + (destildada, salvo que el usuario la tilde en esta sesión); estructura del propio método (editar) → tildada, **sin** nota; estructura libre → destildada, sin nota.

**Modelo mental del CREAR (método sin `id` todavía).** En creación los checkboxes marcan **intención**: la sección se ve y se opera **idéntica** a editar (mismo divisor, mismo control, dentro del mismo form y footer "Crear método de pago" → queda claro que es **parte del alta**, no un paso aparte). Al abrir en modo crear, los tres arrancan **destildados**; la nota "Hoy:" funciona igual contra los defaults vigentes. La **asignación con exclusividad se aplica al guardar**, cuando el método ya tiene `id`. En editar, arrancan reflejando el estado actual.

**Comunicación de la reasignación al guardar.** La exclusividad se resuelve **al guardar el modal** (no en vivo por cada tilde). Feedback:
1. **Preventivo:** la nota "Hoy: {Otro}" en la sección (antes de guardar).
2. **Confirmación al guardar OK:** toast `success` de CRUD ("Método de pago {creado/actualizado} correctamente."). **Además**, si al guardar el método **tomó ≥1 estructura que tenía otro titular**, un toast `info` consolidado: **"‘{Método}’ ahora es el predeterminado de {Estructuras}."** (`{Estructuras}` = lista de las estructuras reasignadas, p. ej. "Únicos y Fijos"). Cubre el caso de que la fila desplazada esté **fuera de viewport**; un solo toast info (no uno por estructura) evita el toast-storm. Sin displacement → solo el `success`.
3. **En la lista:** al cerrarse el modal, las filas se re-renderizan y las pills reflejan el nuevo reparto (invariante "una sola pill por estructura en toda la lista").

#### Indicador de solo-lectura en la fila

La columna "Predeterminado" (entre contador y kebab; grid de fila `34px 1fr auto auto auto auto`) es un **indicador estático informativo**: **no** es `<button>`, **no** tiene `aria-haspopup`, **no** tiene hover-reveal de afordancia, **no** es foco de tab, **no** abre nada.

- **Método SIN defaults (la mayoría):** la celda **no renderiza contenido** → **cero impacto** (la fila se ve idéntica a una lista sin config). No aparece ninguna afordancia "Predeterminar" en hover.
- **Método CON ≥1 default:** **siempre visible**: `Star` **relleno 11px** `--accent` + una **pill por estructura** en orden fijo Únicos → Fijos → Cuotas. Pill: fondo `--accent-soft`, texto `--accent-ink`, `--r-chip`, **11px / 600**, `px-[7px] py-[2px]`, gap `4px`. **Sin** hover-bg, **sin** cursor pointer, **sin** ring de botón.
- **Touch / ≤940px:** si hay >1 pill, colapsa a una sola pill **"Predet. ×N"** (`N` mono); el detalle se ve al abrir *Editar*.
- **Edición:** exclusivamente vía **kebab → "Editar"** (abre el modal, que trae la sección).

**Accesibilidad.** El indicador de la fila es texto legible (pills con label) + estrella `aria-hidden`, envuelto con `aria-label`/`title` que enuncia el estado ("Predeterminado de: Únicos, Fijos"); **no** interactivo, fuera del orden de tab. Dentro del modal: checkboxes rotulados, nota "Hoy:" textual, foco visible, el estado nunca depende solo del color. Región `aria-live="polite"` (espejo textual del toast de reasignación) para el momento del guardado.

**Copy (resumen).** Label de sección: "Predeterminado para". Ayuda: "Se prellena al crear un movimiento de esta estructura. Podés cambiarlo al cargar." Labels/pills: "Únicos" / "Fijos" / "Cuotas". Nota de titular: "Hoy: {Método}". Toast de reasignación: "‘{Método}’ ahora es el predeterminado de {Estructuras}." **Nunca** "gasto/gastos" en esta superficie.

> Reutiliza: el checkbox del DS (*Débito automático* / filtros), el lenguaje `Star`=default + pill `--accent-soft`, el sistema de toasts, el chrome del modal (`PaymentMethodFormModal`).

#### Checklist de aceptación visual — predeterminado por estructura

- [ ] **Copy sin "gastos":** ni en el modal ni en la fila ni en toasts aparece la palabra "gasto/gastos"; la ayuda dice "…al crear un **movimiento** de esta estructura".
- [ ] **Sección en el modal:** al abrir crear o editar, después del Icon-picker hay un divisor `--hair` y la sección "Predeterminado para" con 3 checkboxes (Únicos/Fijos/Cuotas) + línea de ayuda.
- [ ] **Fila sin celda editable:** la fila **no** tiene botón "Predeterminar" ni popover; no aparece nada de eso en hover; la columna sólo muestra estrella + pills cuando el método es default.
- [ ] **Cero impacto sin config:** lista sin ningún default → filas sin estrella, sin pills y sin afordancia.
- [ ] **Estado visible (solo-lectura):** un método default muestra `★` + pill(s) (`--accent-soft`/`--accent-ink`) **siempre**; el indicador no tiene hover-bg, no es foco de tab, no abre nada.
- [ ] **Una pill por estructura en toda la lista:** cada estructura (Únicos/Fijos/Cuotas) aparece como pill en **a lo sumo una** fila.
- [ ] **Nota de titular en el modal:** una estructura tomada por otro método muestra "Hoy: {Otro}"; la del propio método (editar), tildada sin nota; libre, destildada sin nota.
- [ ] **Crear = intención:** en el modal de creación los 3 checkboxes arrancan destildados; la sección se ve igual que en editar y vive dentro del mismo form/footer de alta.
- [ ] **Exclusividad al guardar:** tildar una estructura ya tomada y guardar → la pill de esa estructura pasa a este método y desaparece de la otra fila.
- [ ] **Toast de reasignación:** guardar con desplazamiento dispara toast `info` "‘{Método}’ ahora es el predeterminado de {Estructuras}", además del `success` de CRUD.
- [ ] **Neutralidad de color:** estrella/pills/check usan acento (UI), nunca verde/rojo; el chip de tipo sigue neutro y no se confunde con las pills.
- [ ] **Touch / ≤940px:** el indicador con >1 default colapsa a "Predet. ×N" (N mono); la edición se hace desde *Editar*.
- [ ] **Focus:** en el modal, filas de checkbox muestran ring `--accent-soft` 3px por teclado; el indicador de la fila no toma foco.
