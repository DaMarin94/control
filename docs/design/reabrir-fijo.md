# Reabrir un fijo terminado (`/mes` + `/historial`)

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Reusa: `anulacion-fijo.md`, `mes-listado.md` (kebab), `historial.md`, `toast-deshacer.md`.

## Reabrir un fijo terminado (`/mes` + `/historial`) — RF-MF-008

Acción **"Reabrir"** del kebab, **modal de reapertura**, su toast con Deshacer y entrada **"Reabierto"** de `/historial`. Lo funcional (qué fijos se reabren, piso y default del mes X, relleno anulado con la cadencia vieja, monto desde X, reemplazos de dados de baja, calculados en espejo, deshacer) está en `requirements.md` RF-MF-008 y `screens.md` §Vista del mes.

> **Se reusa todo:** KebabMenu y su gate, `ModalShell variant="dialog"`, la **caja de identidad** y la **caja de resultado** del modal de anulación, el campo **Monto** del form de fijo, el `Select` nativo, la `.field-note`, el pill **`.stepper`** de `PeriodNav`, el toast con Deshacer y el bloque "Qué cambió" de `/historial`. **Ningún token nuevo.** Lo propio es la **composición** del modal y tres filas del set de campos del historial (§7).

### 0. Encuadre — qué cambia y qué no

- **La fila de `/mes` no cambia.** Un fijo reabierto se ve como cualquier fijo indefinido. Los meses del **relleno** muestran el ítem **anulado** con la señalética vigente (`0.55` + tachado + badge) **sin marca de "anulado por reapertura"**; se des-anula con la acción de siempre.
- **La card de detalle no cambia.** Read-only, no ofrece "Reabrir"; tras reabrir muestra `Desde {arranque} · activo` (RF-MF-007).
- **Costo pagado a propósito:** reabrir es poco frecuente y tiene consecuencias no visibles desde el mes actual; el modal **prioriza explicar el resultado** con una caja de consecuencia en vivo (§3.5).

### 1. La acción "Reabrir" en el KebabMenu

- **Rótulo: "Reabrir"** — imperativo de una palabra, sin objeto.
- **Ícono: `CalendarSync` (lucide), 15px** — "la recurrencia vuelve a correr"; familia de `CalendarOff` / `CalendarPlus`. *Descartados:* `RotateCcw`/`Undo2` (se leen como **deshacer**), `LockOpen` (pegado a `Lock` de `/historial`), `Play`, `Repeat` (ya significa **frecuencia**). *Fallback cerrado si lucide no exporta `CalendarSync`: `RefreshCw`.*
- **Tono neutro** (`text-ink hover:bg-panel-2`), **nunca `danger`**.
- **Sin estado de carga propio:** solo abre el modal.
- **Gate:** solo fijo **normal** (no calculado) con `endMonth` (pasado o futuro). En otro ítem **no existe** (no deshabilitado).
- **Posición — grupo "actuar sobre este ítem", después de Anular:**
  `Editar → Anular/Des-anular este mes → Reabrir → Duplicar → Crear movimiento calculado → Eliminar`.
  - Pegado a Anular (las dos acciones temporales, mismos glifos de calendario), lejos de Eliminar.
  - **6 ítems** (~206px). El flip se deriva de `items.length` (`mes-listado.md` *Duplicar* §1); se verifica en QA en la última fila.

### 2. Contenedor, título, foco y cierre

- **Contenedor:** `ModalShell variant="dialog"` (`max-w-[440px]`). **✕ y `Esc`**; el scrim **no** cierra.
- **Título** (18px/700): **"Reabrir movimiento fijo"** (espeja "Eliminar movimiento fijo").
- **Foco inicial:** en el **primer reemplazo obligatorio vacío** si los hay (§4); si no, en el **input Monto** (sin seleccionar su texto).
- **`Enter` confirma desde cualquier control** (excepto con un `<select>` nativo desplegado). Camino frecuente: kebab → Reabrir → `Enter`.

### 3. Cuerpo — orden y anatomía

Cuerpo `space-y-[14px]`:

**3.1 · Bajada** — 13px `--muted`, `max-w-[46ch]`: *"El fijo vuelve a aparecer desde el mes que elijas, sin fecha de fin."*

**3.2 · Caja de identidad** — molde del modal de anulación (`rounded-ctl border border-line bg-panel-2 px-4 py-3`):
- Línea 1: nombre 13px/600 `--ink` `truncate`.
- Línea 2 (12px `--muted`, `·` en `--faint`): `● {Categoría} · {frecuencia} · {vigencia}` — vigencia en formato de la card (`Mar 2024 – Jun 2026`, fin = `prevMonth(endMonth)`), que explica el piso del selector de X. Una categoría dada de baja se muestra igual; el reemplazo se pide abajo.

**3.3 · Mes de reapertura X — `.stepper` de mes, no `Select`.**
- **Label:** "Vuelve a aparecer desde" (`.f`: 12.5px/600 `--ink-2`, gap 7px).
- **Control:** pill **`.stepper`** (`--r-pill`, `--panel`, borde `--line`, `--shadow-sm`, padding 4px; botones 32px `ChevronLeft`/`ChevronRight` 18px), `inline-flex` a la izquierda. Centro: mes en **nombre completo** (`Septiembre 2026`), 14px/600 `--ink`, Space Grotesk, `text-center`, **ancho fijo `w-[16ch]`** (anti-layout-shift). `aria-live="polite"` sobre el valor; grupo `role="group"` + `aria-labelledby`; botones `aria-label="Mes anterior"` / `"Mes siguiente"`.
- **Por qué stepper:** el dominio de X tiene **piso pero no techo**; un `Select` exigiría inventar un techo. **‹ se apaga en el piso, › nunca.** (Descartada la rueda mes/año: popover de navegación de página, otra capa de overlay.)
- **Estados:** ‹ en el piso → *Disabled* de `PeriodNav` (`opacity 0.4`, sin hover, `aria-disabled`, **no se oculta**). › siempre activo. Arranca en el **default = piso**.
- **Nota de piso** — `.field-note` (12.5px `--muted`, `Info` 14px `--accent-ink`), **siempre presente**:
  - piso = mes en curso: *"No puede ser anterior al mes en curso."*
  - piso = `endMonth` (fin a futuro): *"Lo más temprano es {Mmm AAAA}, el mes siguiente a su último mes."*
  - Neutra.

**3.4 · Monto** — el campo **Monto del form de fijo, idéntico** (label "Monto" requerido, caja `border-[1.5px] border-line-strong`, prefijo del símbolo de la **moneda del fijo** en mono `--muted`, input **mono 20px/600**, focus `--accent` + ring `--accent-soft`). Precargado con el último monto (moneda original, sin signo). **No se tiñe** por tipo.
- **Fijo en otra moneda:** prefijo con su moneda (`US$`), **solo lectura**, sin selector. La **cotización se conserva** (RF-MF-008, "solo el monto") y **no se muestra**.
- **Nota bajo el campo** (`.field-note` sin glifo, 12.5px `--muted`), dinámica con X: *"Rige desde {Mmm AAAA}. Los meses anteriores conservan el monto que tenían."*
- **Validación:** la del form de fijo (molde de error de campo). Monto vacío o 0 → error y foco.

**3.5 · Caja de consecuencia — "qué va a pasar"** — molde de la **caja de resultado** de anulación (`rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px] flex items-start gap-[10px]`), **`CalendarSync` 16px `--ink-2`**, texto 13px `--ink`, fragmentos en **600**, `aria-live="polite"`. **Último elemento del cuerpo.** Hasta **tres líneas** (`<p>` con `space-y-[6px]`); 2 y 3 **solo existen** si aplican:

| Línea | Cuándo | Copy |
|---|---|---|
| 1 — vigencia | siempre | *"Desde **{Mmm AAAA}** aparece **{ayuda de frecuencia}**, sin fecha de fin."* (`cada mes`, `cada tres meses`… — columna *Ayuda del form* de la tabla de frecuencias) |
| 2 — relleno | hay ≥1 aparición de la cadencia vieja en `[endMonth, X)` | `N ≥ 2`: *"Se anulan **{N} apariciones**, entre **{Mmm AAAA}** y **{Mmm AAAA}**: se siguen viendo en su mes, pero no suman."* · `N = 1`: *"Se anula **una aparición**: **{Mmm AAAA}**. Se sigue viendo en su mes, pero no suma."* |
| 3 — calculados | ≥1 calculado se reabre en espejo | `N ≥ 2`: *"También se reabren **{N} calculados**: {Nombre}, {Nombre}."* · `N = 1`: *"También se reabre el calculado **{Nombre}**."* |

- **Línea 1** vale para fin pasado y futuro ("aparece"); con frecuencia > 1 enseña que **X es aparición**.
- **Línea 2 cuenta apariciones reales** (primera y última **de la cadencia vieja** en el relleno). Relleno sin apariciones, o X = `endMonth`: **sin línea 2**.
- **Línea 3** lista nombres (envuelven, nunca truncan). Singular con frase propia.
- **Neutra** (consecuencias esperadas, todo se deshace).
- **Sin cifras de dinero.**

### 4. Estado "con reemplazos obligatorios"

Se monta **solo** si la categoría o el método del fijo —o la **categoría** de algún calculado que se reabre— está dada de baja. Si no, **no existe en el DOM**. Va **entre Monto y la caja de consecuencia**.

- **Encabezado:** `border-t border-hair pt-[14px]`. 13px/600 `--ink`: **"Elegí reemplazos"**; debajo, 12.5px `--muted`: *"Estos datos se dieron de baja y no se pueden volver a usar."*
- **Grupos:** si solo el fijo necesita reemplazos, sin subtítulo. Con calculados, un grupo por movimiento (`space-y-[12px]`), subtítulo 12.5px/600 `--ink-2`: el **nombre del fijo** y **`↳ {Nombre del calculado}`** (`CornerDownRight` 12px `--muted`). Orden: fijo, después calculados en el orden de la línea 3.
- **Campos por grupo:** el **fijo**: `Categoría` y/o `Método de pago` (solo los dados de baja). Un **calculado**: **solo `Categoría`** (hereda el método, RN-021). Un calculado con categoría activa **no tiene grupo**.
- **Cada campo** (`.f`, "Categoría" / "Método de pago", requeridos):
  - **Categoría:** `Select` nativo, primera opción vacía **"Elegí una categoría activa"**, luego las activas del tipo.
  - **Método de pago:** `Select` nativo, primera opción vacía **"Elegí un método"**, luego **"Sin método de pago"** (rótulo vigente), luego los activos. "Sin método de pago" es **elegible, no default**.
  - **Sin preselección** (sería un default silencioso).
  - **Nota "Antes"** bajo el select, 12.5px `--muted`: *"Antes: ● {Nombre}, dada de baja."* / *"Antes: {glifo del método 14px} {Nombre}, dado de baja."*
  - Campos **apilados a ancho completo** (no `.row2`).
- **Validación al enviar** (no primario deshabilitado): cada select vacío toma el **molde de error de campo**, con *"Elegí una categoría."* / *"Elegí un método de pago."*, foco al **primero** en error (el cuerpo scrollea). Se limpia al elegir.

### 5. Footer, carga, éxito y error

- **Footer:** `Cancelar` (`ghost sm`) + **`Reabrir`** (`default sm`, **primario índigo**). **Nunca `destructive`.** Rótulo fijo.
- **Carga:** **"Reabriendo…"** + `disabled`; `Cancelar` habilitado; el cuerpo no se atenúa.
- **Datos para armar el modal.** El `MovementItem` aporta identidad, frecuencia, vigencia y monto: el modal abre **completo en eso** (identidad, stepper, Monto, línea 1). Al abrir pide `GET /recurring/:id/reopen-preview` (piso del mes, último monto, reemplazos exigidos, calculados que se reabren); mientras llega, la caja muestra bajo la línea 1 **una línea de skeleton** (`aria-busy`) con el primario `disabled` y `aria-describedby` a la caja. Si esa carga falla: cierra y `toast.error` *"No se pudo preparar la reapertura."*
- **Éxito:** cierra, la lista se refresca y aparece el **toast con Deshacer** (`toast-deshacer.md`, 8s, ancho 520): **"Reabierto: ‘{Nombre}’."** Identidad de grupo = `chainId`. Toast **obligatorio** (portador del Deshacer).
  - **Desenlaces:** los vigentes. Des-anular meses del relleno **no bloquea** el deshacer (solo LIFO).
- **Error al reabrir:** `toast.error` *"No se pudo reabrir el movimiento."*; el modal **queda abierto** con todo intacto.

### 6. Contención responsive (obligatoria)

Régimen **único** en todo el régimen de app (`≥ 600px` en ambos ejes), sidebar abierto o cerrado.

- **Ancho:** `min(440px, 100vw − 48px)`; a 640px mide 440 y no se mueve con el sidebar. Cuerpo útil 396px. Stepper ≈ **210px**. Monto, selects y caja a ancho completo con `min-w-0`; **ningún `min-width` en px**.
- **Invariante 1:** el modal no aporta ancho; el kebab de 6 ítems anclado por su borde derecho.
- **Invariante 2:** sin reemplazos ≈470px; con reemplazos de fijo + 2 calculados puede superar 800px. **Cuerpo scrollea**, header y footer pineados (`max-h-[calc(100dvh−48px)]`), hairlines de corte.
- **Invariante 3:** footer pineado; kebab abre hacia arriba en el pie; `<select>` nativos.
- **Invariante 4:** no aplica.

### 7. `/historial` — la entrada "Reabierto"

**7.1 · Identidad de la entrada** (anatomía de `historial.md` §2):
- **Col 1:** caja 40px neutra con **`CalendarSync` 18px `--ink-2`**.
- **Chip de operación: "Reabierto"** (neutro). `Editado` · `Eliminado` · `Reabierto`. Nunca verde.
- Sublínea: `● {Categoría} · Fijo`.

**7.2 · "Qué cambió" — tres filas nuevas en el set de campos**, en la banda *Cuándo y estructura*, después de `Mes de inicio`:

`Monto → Fórmula → Moneda → Cotización → Tipo → Categoría → Descripción → Fecha → Mes de inicio → `**`Vigencia → Tramo anulado → Calculados`**` → Cuotas → Método de pago → Débito automático`

| Rótulo | Cuándo | Presentación |
|---|---|---|
| `Monto` | si el monto confirmado ≠ el anterior | par vigente, escala promovida 15.5/600, **primera fila** (regla vigente) |
| `Categoría` / `Método de pago` | si se reemplazaron | par vigente (`● Gimnasio → ● Deportes`). Si el método se reemplazó por **"sin método"**, el lado nuevo dice **"Sin método de pago"** en `--faint`, sin glifo. En el modal de deshacer, invertido: `Sin método de pago → {glifo} Visa`. |
| **`Vigencia`** | **siempre** | par: `hasta {Mmm AAAA}` → `desde {Mmm AAAA}`. Preposiciones en `--faint`, meses en mono tabular (como `Mes de inicio`); "hasta" = último mes de aparición (`prevMonth(endMonth)`), "desde" = X. |
| **`Tramo anulado`** | si la línea 2 del modal existió | **valor único** (patrón de `Débito automático`: solo en la columna del "nuevo", `--ink`): `{N} apariciones · {Mmm AAAA} – {Mmm AAAA}` / `una aparición · {Mmm AAAA}`. Meses en mono. |
| **`Calculados`** | si se reabrieron calculados | **valor único**: `{N} reabiertos` / `1 reabierto` (línea de conteo: el numeral se conserva). Sin nombres. |

- Con X = `endMonth` (fin a futuro): `Vigencia` dice `hasta Nov 2026 → desde Dic 2026`, sin `Tramo anulado`.
- **El backend emite las filas** (el frontend no filtra ni deriva).

**7.3 · Modal de deshacer.** El vigente (`historial.md` §5).
- **Encabezado del bloque: "Al deshacer queda así:"** — el de la edición (el fijo nunca salió de la app; "Vuelve a la app:" no aplica).
- Par **invertido**: `Vigencia: desde Sep 2026 → hasta Jun 2026`; `Monto` / `Categoría` / `Método` invertidos.
- Valor único en **presente**: `Tramo anulado` → *"Vuelve a quedar fuera de vigencia"* (incluye meses des-anulados por el usuario — RF-MF-008); `Calculados` → *"{N} vuelven a terminar"* / *"1 vuelve a terminar"*.
- Nota: *"Esta entrada se borra del historial."*
- **Sin bloqueo propio:** solo LIFO (RF-HIST-004).
- En la lista del modal de cadena, resumen: `Monto` si participa; si no, `Vigencia: desde Sep 2026`.

### 8. Agregados más allá del brief — estado

Los tres **aprobados**:
1. **Línea 3 de la caja de consecuencia con los nombres de los calculados.**
2. **Nota "Antes: …" bajo cada reemplazo.**
3. **Filas `Tramo anulado` y `Calculados` en el "Qué cambió"** (la entrada de historial guarda esos datos).

### 9. Reglas duras reafirmadas

- **Verde/rojo:** ningún elemento nuevo usa `--income`/`--expense`; el único color de error es el molde de error de campo. En `/historial` el valor nuevo de `Monto` lleva su color por tipo.
- **Índigo:** primario "Reabrir", focus rings, glifo de la `.field-note`, borde de foco del Monto.
- **Mono tabular:** input Monto; en `/historial`, el par de `Monto` y los meses de `Vigencia` / `Tramo anulado`. En el modal, los meses son rótulos en Space Grotesk.
- **Ámbar no se usa.**

### Checklist de aceptación visual — Reabrir un fijo terminado

> Datos de prueba: fijo **mensual** "Gimnasio" con fin `Jun 2026` (endMonth `2026-07`), mes en curso `Sep 2026`, visualizando `May 2026`; otro fijo **trimestral** con fin a futuro; un fijo con categoría **y** método dados de baja y un calculado (categoría dada de baja) que terminó junto con él; un fijo en **USD** con fin.

*Kebab:*
- [ ] En un fijo normal con fin, el menú muestra **6 ítems** en orden: Editar · Anular este mes · **Reabrir** · Duplicar · Crear movimiento calculado · Eliminar. "Reabrir" lleva `CalendarSync` 15px, texto `--ink`, hover `--panel-2`, **no** es rojo.
- [ ] En un fijo **sin fin**, en un **calculado**, en un único y en una cuota, "Reabrir" **no aparece** (ni deshabilitado).
- [ ] Abierto en la **última fila** con ventana baja (~700px), el menú de 6 ítems se ve entero (abre hacia arriba).

*Modal — default:*
- [ ] Título **"Reabrir movimiento fijo"**; ✕ y `Esc` cierran; el clic en el scrim **no** cierra.
- [ ] Caja de identidad: `● Categoría · mensual · Mar 2024 – Jun 2026` (fin = mes anterior a `endMonth`).
- [ ] El stepper arranca en **"Septiembre 2026"** (piso = mes en curso), con **‹ apagado** (`opacity 0.4`, `aria-disabled`, visible) y › activo. Las flechas **no se mueven** de posición al pasar por "Mayo 2027" ↔ "Septiembre 2027".
- [ ] Con el fijo de fin a futuro, el stepper arranca en el mes de su `endMonth` y la nota dice *"Lo más temprano es {Mmm AAAA}, el mes siguiente a su último mes."*; con el otro, *"No puede ser anterior al mes en curso."*
- [ ] Monto precargado con el último monto, **mono 20px/600**, prefijo del símbolo de la moneda del fijo, sin color por tipo. La nota debajo dice *"Rige desde Sep 2026…"* y **cambia** al mover el stepper.
- [ ] `document.activeElement` al abrir (sin reemplazos) es el input Monto.
- [ ] Caja de consecuencia con `CalendarSync`: *"Desde **Sep 2026** aparece **cada mes**, sin fecha de fin."* + *"Se anulan **2 apariciones**, entre **Jul 2026** y **Ago 2026**…"*; al subir X a Oct 2026 pasa a **3** apariciones, Jul–Sep.
- [ ] Con el fijo de fin a futuro y X en el default, la caja tiene **solo la línea 1** (no hay línea de relleno en el DOM).
- [ ] Con 1 aparición en el relleno, la línea usa **"una aparición"**, sin el numeral.
- [ ] La caja tiene `aria-live="polite"`, borde `--line`, y ningún texto en `--expense-ink`/`--warning-ink`.

*Modal — reemplazos:*
- [ ] Con categoría dada de baja: aparece el bloque **"Elegí reemplazos"** (separado por hairline), con un `Select` en **"Elegí una categoría activa"** (sin preselección) y la nota *"Antes: ● {Nombre}, dada de baja."*; el foco inicial está en ese select.
- [ ] Con método dado de baja: el `Select` de método arranca en **"Elegí un método"** (vacío), y sus opciones son **"Sin método de pago"** primero y después los métodos activos (ninguno dado de baja). Elegir "Sin método de pago" **satisface** el campo (no da error al confirmar).
- [ ] Sin dados de baja, el bloque **no está en el DOM**.
- [ ] Con un calculado involucrado: grupos con subtítulo del fijo y **`↳ {Nombre del calculado}`**; el grupo del calculado tiene **solo `Categoría`** (nunca `Método de pago`), aun si el método del fijo está dado de baja. Un calculado con categoría activa **no tiene grupo**. La caja de consecuencia suma *"También se reabre el calculado **{Nombre}**."*
- [ ] Confirmar con un reemplazo vacío ⇒ el select toma el molde de error de campo, texto *"Elegí una categoría."* / *"Elegí un método de pago."*, foco en el primero en error; al elegir, el error se va. El primario **no** estaba deshabilitado.

*Modal — fijo en otra moneda:*
- [ ] Con el fijo en USD: el Monto lleva el prefijo **`US$`** (solo lectura, sin selector de moneda) y en el modal **no hay** campo, valor ni nota de cotización.

*Footer, carga y desenlaces:*
- [ ] Primario **"Reabrir"** índigo (`variant="default"`), nunca rojo; en vuelo **"Reabriendo…"** + `disabled`, Cancelar habilitado.
- [ ] Éxito: el modal cierra y aparece el toast **"Reabierto: ‘{Nombre}’."** con **Deshacer**, ancho 520, 8s con pausa por hover.
- [ ] Deshacer desde el toast ⇒ "Cambio deshecho."; el fijo vuelve a terminar en Jun 2026 y los meses de relleno ya no muestran el ítem anulado.
- [ ] Reabrir, **des-anular** `Jul 2026` y deshacer (toast o `/historial`) ⇒ el deshacer **no** está bloqueado ni muestra aviso extra; tras deshacer, `Jul 2026` tampoco muestra el ítem.
- [ ] Error de red al reabrir ⇒ `toast.error` *"No se pudo reabrir el movimiento."* y el modal **sigue abierto** con X, monto y reemplazos intactos.
- [ ] Navegando a `Jul 2026` tras reabrir: la fila está **anulada** con la señalética vigente (0.55 + tachado + badge "Anulado"), **sin** marca extra de reapertura; su monto es el **viejo**.

*`/historial`:*
- [ ] La entrada lleva `CalendarSync` 18px en caja neutra y el chip **"Reabierto"** (mismo molde que "Editado"/"Eliminado", neutro).
- [ ] "Qué cambió" muestra `Vigencia: hasta Jun 2026 → desde Sep 2026` (meses mono, preposiciones `--faint`), y si aplica `Tramo anulado: 2 apariciones · Jul 2026 – Ago 2026` como **valor único** y `Calculados: 1 reabierto`. Si el monto cambió, `Monto` va **primero** en escala promovida.
- [ ] El modal de deshacer muestra el encabezado **"Al deshacer queda así:"**, `Vigencia: desde Sep 2026 → hasta Jun 2026` (invertido), `Tramo anulado: Vuelve a quedar fuera de vigencia` y, si aplica, `Calculados: 1 vuelve a terminar`.
- [ ] Si el método se reemplazó por "Sin método de pago", la fila `Método de pago` muestra `{glifo} {Nombre} → Sin método de pago` con el lado nuevo en `--faint` y sin glifo.
- [ ] La entrada "Reabierto" solo aparece **"Bloqueado"** si hay un cambio posterior del mismo fijo (LIFO); des-anular meses del relleno no la bloquea.

*Contención y modos:*
- [ ] A **640px** (sidebar abierto y cerrado): diálogo de 440px exactos, sin scroll horizontal del `body`; stepper, Monto y caja sin desbordar; `min-width` computado de los descendientes `0px`/`auto`.
- [ ] A **640×560** con reemplazos de fijo + calculado: el cuerpo scrollea, título + ✕ arriba y Cancelar/Reabrir al pie sin scrollear.
- [ ] Claro y oscuro: stepper (incluida la flecha apagada), caja de identidad, caja de consecuencia y foco visibles en ambos.
