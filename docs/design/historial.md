# `/historial` — historial de cambios, deshacer y bloqueo LIFO

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Entrada "Reabierto": `reabrir-fijo.md` §7. Toast con Deshacer inmediato: `toast-deshacer.md`.

## Historial de cambios (`/historial`) — lista de entradas, deshacer y bloqueo LIFO

Pantalla de **consulta con una acción** (RF-HIST-002/003/004, `screens.md` §11): se lee "qué cambié" y, si hace falta, se deshace. No edita movimientos, no navega al mes, no muestra totales. La lista es **finita y corta por naturaleza** (máx. 5 entradas por movimiento, expiración a 31 días): **no se pagina, no se filtra y no se agrupa por día**; se apila cronológicamente, más reciente primero.

> **Se reusa todo:** el molde de tarjeta-lista de `/mes` (filas separadas por `--hair`), el grid de la fila (`40px 1fr auto`), el patrón de **fila rótulo·valor** de la *Card de detalle de movimiento*, la caja recesada `rounded-ctl border-line bg-panel-2` de "Origen", el chip neutro del DS, `ModalShell variant="dialog"`, el sistema de **skeletons**, el lenguaje **dashed = vacío** y el ítem de nav del sidebar. **Ningún token nuevo.**

### 1. Encuadre de pantalla

- **Ancho de contenido:** `px-10 max-w-[1120px] mx-auto`. Sin `PeriodNav`, **sin flechas ‹ ›**, sin stepper.
- **Sin `CurrencyChip`:** la pantalla no expone totales.
- **Cabecera `.phead`** (anatomía de Dashboard / `/reportes`), zona derecha **vacía**:
  - **Sin eyebrow.** Única `.phead` de la app sin eyebrow: el H1 es una palabra inequívoca y la bajada (regla de retención) es información real. *(Decisión cerrada con el usuario; el resto de las pantallas conserva su eyebrow.)*
    > **El chip flotante del sidebar se contiene a nivel app, no acá.** Sin eyebrow, el H1 es la primera línea y, con el sidebar cerrado a viewport ≲1200px, cae en la zona del chip "Mostrar menú". Lo protege la **banda reservada del chip flotante** (`sidebar.md` *Sidebar — mostrar/ocultar*): ningún contenido de página se pinta por encima de los 70px superiores del viewport. El eyebrow **no** es una defensa contra el chip; `/historial` usa el mismo `px-10 py-[34px] pb-20` que las demás.
  - **H1** "Historial" — 32px/700 `tracking-[-0.02em]` `--ink`.
  - **Bajada** — 14px `--muted`, `mt-2`: *"Se guardan los últimos 5 cambios de cada movimiento, durante 31 días."* Única superficie donde se explica la **regla de retención**; visible **también con datos**.
  - Bloque con `mb-6`.
- **Cuerpo:** una **única tarjeta-lista** (`bg-panel border border-line rounded-card shadow-[var(--shadow-sm)] overflow-hidden`), entradas como filas separadas por `--hair`. **No** una card por entrada.

### 2. Anatomía de la entrada (régimen amplio)

Grid **`40px 1fr auto`**, `gap-[14px]`, padding `var(--row-pad) 18px` (14/18). Divisor `--hair` entre filas.

**Alineación vertical: `items-start` en los DOS regímenes.** La col 2 crece con el bloque de cambios (~70px una edición de un campo, ~180px una eliminación con 5 campos); centrar despegaría el ícono y el momento del nombre.
- **Col 1 (ícono):** `self-start`. La caja de 40px enmarca la banda de identidad (línea de nombre 21px + sublínea ~18px ≈ 39px).
- **Col 3 (momento + acción):** `self-start`. El **momento** lleva la **misma caja de línea** que la línea de identidad (`leading-[21px]`).
- **Col 2:** `self-start`.

**Col 1 — ícono de operación, 40×40.** Misma caja que el ícono de tipo de `/mes`, **fill neutro**: `bg-panel-3`, glifo `--ink-2` **18px**, `aria-hidden`.
- **Editado → `Pencil`** · **Eliminado → `Trash2`** · **Reabierto → `CalendarSync`** (mismos glifos que las acciones del kebab — ver `reabrir-fijo.md` §7).
- **Neutro, nunca rojo.** Rojo es gasto; una eliminación teñida se leería como un gasto.
- *Descartado:* el ícono de tipo tintado de `/mes` (haría leer la fila como un movimiento y dejaría la operación sin ancla). El tipo se lee en el **color de la cifra** del bloque de cambios.

**Col 2 — cuerpo (`min-w-0`), tres bandas:**

1. **Línea de identidad** — `flex items-center gap-[8px] min-w-0 leading-[21px]`:
   - **Nombre del movimiento** — 14.5px/600 `-.01em`, `--ink`, `truncate`, `flex-1 min-w-0`.
   - **Chip de operación** — chip neutro (`--panel-3` / `--muted` / `--r-chip` 7px / 11px·600·`.04em`), `shrink-0`: **"Editado"** / **"Eliminado"** / **"Reabierto"**. Doble codificación con el ícono.
2. **Sublínea de identidad** — 12px, `--muted`, separadores `·` en `--faint`, `truncate`. Vocabulario de la sublínea de `/mes`:
   `● {Categoría} · {Estructura} [· ↳ calculado]`
   - **Punto de categoría** 6px (`category.color` inline, `aria-hidden`), `gap-[6px]`; **Categoría** en `--ink-2`.
   - **Estructura** — `Único` / `Fijo` / `Cuotas`, en `--muted` (acá el movimiento no está en su sección).
   - **`↳ calculado`** (solo calculados) — `CornerDownRight` 12px `--muted` + palabra. **Sin** nombre de origen.
3. **Bloque "Qué cambió"** — §3. `mt-[10px]`.

**Col 3 — momento + acción (`shrink-0`, `text-right`, `flex flex-col items-end gap-[8px]`):**
- **Momento** — `{DD Mmm} · {HH:MM}` (ej. `02 Jun · 14:30`), **mono tabular**, 12.5px `--muted`, `whitespace-nowrap`, `leading-[21px]`. **Sin año** (retención de 31 días).
  - *Descartado el tiempo relativo* ("hace 2 h"): requiere refresco, se vuelve ambiguo y pierde la alineación mono.
- **Acción** — botón "Deshacer" o su estado bloqueado (§5).

**La fila NO tiene:** kebab, link a `/mes`, editar, contador, indicador de vencimiento. La fila entera **es clickeable** y abre el modal de la entrada (§5): `role="button"`, `tabIndex=0`, `Enter`/`Espacio`, `aria-label="Ver cambio de {Nombre}, {DD Mmm HH:MM}"`, `cursor-pointer`, hover `bg-panel-2`. "Deshacer" es un `<button>` hermano con `stopPropagation`.

### 3. Bloque "Qué cambió" — el par antes → después

Caja recesada: `rounded-ctl border border-line bg-panel-2 px-[13px] py-[10px]`, `space-y-[8px]`.

**Una fila por campo**, patrón **rótulo·valor**: `flex flex-wrap items-baseline justify-between gap-x-[16px] gap-y-[2px]`.
- **Rótulo** (izq) — *Meta*, 12.5px/500 `--muted`, `shrink-0`. Vocabulario de la card de detalle (§3.1).
- **Par de valores** (der) — `flex flex-wrap items-baseline justify-end gap-x-[8px] gap-y-[2px] min-w-0`:
  - **Valor anterior** — `--muted`.
  - **`→ valor nuevo`** — **unidad indivisible** (`whitespace-nowrap` sobre flecha+valor). Flecha `→` en `--faint`; valor nuevo en `--ink`.
  - **Sin `line-through` en el anterior** (en Control el tachado significa "anulado / no computa").

**Regla del par:** *izquierda = antes, derecha = después*. En el modal (§5), "antes" es el estado actual y "después" el restaurado.

**Jerarquía — el monto manda:**
- Si cambió el **monto**, su fila es **siempre la primera** y va en **escala promovida**: ambos valores en **mono tabular 15.5px/600**; el resto en **13px**.
- **La promoción es exclusiva del Monto.**
- **Se muestran TODOS los campos que cambiaron**, sin "ver más".

#### 3.1 Set de campos y orden fijo *(cerrado con el usuario)*

Se registran **todos los campos editables**; el bloque muestra **solo los que cambiaron**.

**Orden fijo** — `Monto → Fórmula → Moneda → Cotización → Tipo → Categoría → Descripción → Fecha → Mes de inicio → Cuotas → Método de pago → Débito automático`. Las entradas **"Reabierto"** suman `Vigencia → Tramo anulado → Calculados` después de `Mes de inicio` — ver `reabrir-fijo.md` §7.2.

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

**Por qué este orden — cuatro bandas:**
1. **Dinero (1–4):** monto; fórmula (en un calculado **es** su monto); moneda y cotización como par contiguo.
2. **Naturaleza e identidad (5–7):** `Tipo` (invierte el signo), categoría, descripción.
3. **Cuándo y estructura (8–10):** mutuamente excluyentes casi siempre.
4. **Cromo de pago (11–12).**

Un orden fijo hace que dos entradas se **escaneen igual**.

**Significancia — `Moneda` y `Cotización` no se emiten cuando no informan nada** *(decisión cerrada con el usuario)*: son los únicos campos que el sistema puede tocar sin que el usuario los toque (el form normaliza la cotización) o que repiten un default silencioso. Una fila que miente vuelve sospechoso todo el historial.

> **La decisión es del backend, no del frontend.** El backend **emite** los campos; el frontend renderiza lo que llega y **no filtra nada**.

**Vocabulario (contrato con el modelo).** Cada movimiento guarda `currency` y `anchorCurrency` (la moneda default **al momento de guardar**, referencia de su `exchangeRate`):

> **conversión real de un estado** ⇔ `estado.currency !== estado.anchorCurrency`.

Si coinciden, `exchangeRate` es un artefacto interno y **no es información para el usuario**.

**Regla de emisión — `Cotización`:**
- **Diff de edición:** se emite ⇔ `conversiónReal(antes) || conversiónReal(después)` **Y** (`exchangeRate` cambió **o** `currency` cambió).
- **Estado de eliminación (§3.3):** se emite ⇔ `conversiónReal(estado eliminado)`.
- Bordes:
  - ARS con ancla ARS y el form normaliza `1.450,00 → 1,00`: ningún lado con conversión real ⇒ **se omite**.
  - **La moneda cambió**: al menos un lado con conversión real ⇒ **se emite siempre**, aunque el número sea idéntico.

**Regla de emisión — `Moneda`:**
- **Diff de edición:** se emite ⇔ `currency` cambió. **Sin excepción.**
- **Estado de eliminación (§3.3):** se **omite** ⇔ `currency === anchorCurrency` **Y** `currency === defaultCurrency vigente del usuario`. En cualquier otro caso se emite.
  - Movimiento ARS, ancla ARS, default ARS ⇒ **se omite**.

#### 3.2 Presentación de los campos que no son texto plano

**a) `Fórmula` — una sola fila, no tres.** Expresión única: `−10% del origen → +15% del origen`.
- **Por qué:** el usuario editó *la regla de cálculo*; tres filas (operador/operando/signo) obligarían a recomponerla.
- **Cómo se arma:** **builder de expresión legible del form de calculado**, en **forma abstracta** (sin la cifra del origen, como la card de detalle con `sourceAmountCents === null`).
- **Tipografía:** **mono tabular** 13px; `→ {expresión nueva}` es la unidad indivisible.
- **El signo viaja dentro de la expresión**: no se abre fila `Tipo` en calculados.

**b) `Cotización` — numérico, mono, nunca coloreado.**
- **Valor:** el formateo de cotización vigente en la card de Moneda, **mono tabular** 13px, sin repetir el par de monedas: `1.180,50 → 1.245,00`.
- **Misma cantidad de decimales en los dos lados.**
- **Nunca verde ni rojo.** Tono estándar del par.
- **La fila puede no existir** (regla de emisión de §3.1).

**c) `Cuotas` — cantidad con la unidad una sola vez:** `6 → 12 cuotas` (mono 13px; "cuotas" solo en el nuevo, dentro de la unidad indivisible).
- **Singular:** `1 → 3 cuotas`; `12 → 1 cuota`.
- **Sin fila derivada de "total del plan"** (el historial muestra lo editado, no sus consecuencias).

**d) `Débito automático` — booleano: verbo de transición, sin par.** Un **único valor en la columna del "nuevo"** (`--ink`): **"Se activó"** / **"Se desactivó"**.
- **Por qué no `No → Sí`:** un bit dicho dos veces, con tokens ambiguos.
- La estructura de fila rótulo·valor se mantiene.
- **En el modal** (deshacer) el verbo se invierte y va en **presente**: "Se activó" → **"Se desactiva"**.
- **En valor único** (eliminación): **"Activado"** / **"Desactivado"**, y la fila **se omite si estaba desactivado**.

**e) `Tipo` — palabra, sin tintar. Solo en movimientos únicos** (el único tipo editable, RF-MU-002; un fijo no puede cambiar de tipo, RF-MF-003; en un calculado es derivado). `Gasto` / `Ingreso` en texto plano con el tono del par. **No se tiñe la palabra.** **Si cambió el tipo, la fila `Monto` se muestra siempre**, aunque la magnitud no cambie.

**f) `Fecha` — fecha y hora son un solo campo.** Formato de la card de detalle: `02/06/2026 · 14:30`, **mono tabular**. Si solo cambió la hora, se muestran ambos lados completos.

**Color del dinero:** el valor **nuevo** lleva el color por tipo (**gasto `--ink` / ingreso `--income-ink`**, con signo y símbolo); el **anterior** va `--muted`. Toda cifra en **mono tabular**. Las cifras **no monetarias** (cotización, cuotas) en mono pero **sin color por tipo**.

#### 3.3 Entrada de eliminación (sin "después")

**Modo de valor único** — mismas filas, **sin flecha y sin segundo valor**, valor en `--ink-2` (cifras de dinero con su color por tipo). Rótulo del bloque: *Meta* 12.5/500 `--muted` arriba, **"Se eliminó:"**.
- Campos = los del movimiento tal como estaba, **en el orden fijo de §3.1**, omitiendo los que no aplican, los opcionales sin valor (`Método de pago` sin método, `Débito automático` desactivado) y los **no significativos**:
  - **`Cotización`** se omite sin conversión real.
  - **`Moneda`** se omite si `currency === anchorCurrency` **y** `currency === defaultCurrency vigente`.
  - Las omisiones las decide el **backend**.
- El booleano usa la palabra de estado (`Activado`).
- **`Tipo` no se lista** *(decisión cerrada)*: ya se lee en la fila `Monto` (siempre presente, primera) por su **signo** y **color**. No depende solo del color: el signo lo declara.
  - **Sí existe en las entradas de edición** (§3.2 e, solo únicos).

### 4. Estados de la entrada

| Estado | Contenido | Acción (col 3) | Fila |
|---|---|---|---|
| **Deshacible** (la más reciente de su movimiento) | opacidad plena | botón **"Deshacer"** | hover `bg-panel-2`, clickeable |
| **Bloqueada** (hay posteriores) | **opacidad plena** | botón **activo** `Lock` + **"Bloqueado"** + **motivo visible** | hover `bg-panel-2`, clickeable → modal de cadena |
| **Deshaciendo** | `opacity-[0.55]`, `pointer-events-none` | botón en carga | no clickeable |

- **La entrada bloqueada NO se atenúa**: lo condicionado es **la acción**, no el dato.
- **El botón de la entrada bloqueada está ACTIVO** *(decisión cerrada con el usuario)*: `Button variant="outline" size="sm"`, **`Lock` 15px** + **"Bloqueado"**, **sin `disabled`**, **abre el modal de cadena** (§6).
  - **Por qué no `disabled`:** un botón muerto al lado de una fila clickeable es contradicción de affordance, y un disabled sin explicación es un callejón; el bloqueo **tiene** salida.
  - **El label cambia con el estado:** "Deshacer" ↔ "Bloqueado" (glifo `Undo2`/`Lock` + palabra).
  - **Sigue siendo `outline`.**
- **Motivo del bloqueo, visible en la lista** (RF-HIST-004): bajo el botón, `text-right`, **12px `--muted`**, `whitespace-nowrap`:
  - `N ≥ 2` → **"Hay {N} cambios posteriores"**
  - `N = 1` → **"Hay 1 cambio posterior"** (el numeral se conserva: es lectura de conteo; regla general de conteo en §6).

  Asociado al botón por `aria-describedby`.
- **Dos caminos, un mismo destino:** cuerpo de la fila y botón "Bloqueado" abren **el mismo modal de cadena** (§6). El botón con `stopPropagation`.
- **Deshaciendo:** la carga **vive en el footer del modal** ("Deshaciendo…", `disabled`); la(s) fila(s) afectada(s) a `opacity-[0.55]` + `pointer-events-none`. Al terminar: el modal cierra, **toast de éxito**, y la(s) fila(s) **desaparecen con fade + colapso de alto de 0.22s ease-out** (instantáneo con `prefers-reduced-motion`).

### 5. La acción Deshacer y su confirmación

**Tono: restaurativa, no destructiva.** Deshacer **devuelve** datos; **no usa rojo en ningún lado** (`variant="destructive"` reservado a Eliminar). Mismo criterio que "Guardar igual" del aviso de límites.

**Botón de la fila** — `Button variant="outline" size="sm"`, `min-h-[36px]`, `whitespace-nowrap`. **Dos rótulos, un solo molde:**
- Deshacible → **`Undo2` 15px** + **"Deshacer"** → modal de deshacer.
- Bloqueada → **`Lock` 15px** + **"Bloqueado"** → modal de cadena (§6). **Activo** (§4).
- **Siempre visible**, nunca hover-only (inalcanzable por touch).
- **Secundario:** la mayoría de las visitas son de consulta.
- **Nunca acciona directo:** siempre abre el modal (RF-HIST-003 exige confirmación).
- Estados del `Button` del DS (anillo `--accent-soft` 3px).

**Modal de deshacer** — `ModalShell variant="dialog"` (`max-w-[440px]`), cierre con **✕ y `Esc`** (modal de decisión: el scrim **no** cierra).

- **Título:** "Deshacer cambio".
- **Cuerpo** (`space-y-[14px]`):
  1. **Frase de encuadre** — 14px `--ink`: *"Se va a restaurar **{Nombre}** al estado que tenía antes de este cambio."*
  2. **Caja de identidad** — `rounded-ctl border border-line bg-panel-2 px-4 py-3` (molde del diálogo de eliminar): nombre 13px/600 `--ink` + sublínea 12px `--muted` `● Categoría · {Estructura} · {DD Mmm · HH:MM}`.
  3. **Bloque "Al deshacer"** — **el bloque de §3, en dirección de deshacer**. Rótulo (*Meta* 12.5/500 `--muted`): **"Al deshacer queda así:"**. Cada fila: `{valor actual} → {valor restaurado}`, **restaurado en `--ink`**, actual en `--muted`.
     > **Es el espejo de la fila.** Lista: `antes → después`; modal: `actual → restaurado`. **La flecha siempre apunta al estado que queda.** Reusar el bloque de la fila **sin invertir el par sería un bug**.
     - En una **eliminación**: valor único con el rótulo **"Vuelve a la app:"**.
  4. **Nota de consecuencia** — 12.5px `--muted`: *"Esta entrada se borra del historial."* **No** callout ámbar (es la consecuencia esperada).
- **Footer:** `Cancelar` (`variant="ghost" size="sm"`) + **`Deshacer`** (`variant="default" size="sm"`, primario índigo; carga **"Deshaciendo…"** + `disabled`).

### 6. Modal de entrada bloqueada — desbloqueo en cadena

Mismo `ModalShell variant="dialog"`. **Único** camino para deshacer una entrada bloqueada; se abre por el cuerpo de la fila o el botón **"Bloqueado"**.

- **Título:** "Hay cambios posteriores" (nombra la situación; "No se puede deshacer" sería un callejón).
- **Cuerpo** (`space-y-[14px]`):
  1. **Callout explicativo neutro** — `rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px]`, **`Info` 16px `--ink-2`** + texto 13px `--ink-2`. **Dos frases escritas aparte:**
     - `N ≥ 2` → *"Este no es el cambio más reciente de **{Nombre}**. Para deshacerlo hay que deshacer antes los **{N}** cambios posteriores."*
     - `N = 1` → *"Este no es el cambio más reciente de **{Nombre}**. Para deshacerlo hay que deshacer antes **el cambio posterior**."* — **sin numeral**.
     - **Regla de conteo (transversal a la pantalla):** *ningún plural se compone concatenando el numeral con el sustantivo en plural.* Cada superficie escribe su singular aparte. **En prosa** el singular usa artículo; **en una línea de conteo** (motivo de bloqueo, §4) el numeral se conserva. Alcanza al footer y al toast.
     - **Neutro, no ámbar ni rojo:** es el orden de la pila.
  2. **Lista de los cambios que se van a deshacer** — rótulo *Meta* 12.5/500 `--muted`: **"Se van a deshacer, en este orden:"**. Filas compactas separadas por `--hair`, **de la más reciente a la más antigua**, y **la entrada abierta al final, marcada**:
     - Fila — `flex flex-wrap items-center gap-x-[8px] gap-y-[2px]`, `px-[10px] py-[8px]`, 12px: `[glifo de operación 14px --muted] {DD Mmm · HH:MM, mono --muted} · {chip de operación} · {resumen de la entrada}`.
     - **Resumen — un solo valor, nunca el par:** `{Rótulo}: {valor resultante}` (`Monto: −$350.000,00`); en una eliminación, el valor que tenía.
       - **Por qué:** la lista responde *cuáles*, no *qué cambió*; el par duplica el ancho y corta cifras.
       - **Campo:** `Monto` si participa; si no, el **primero del orden fijo de §3.1** que participe.
       - **El rótulo no se omite.**
     - **Prioridad de contención (ninguna cifra se corta jamás):**
       1. **Nunca ceden:** glifo, momento, chip y marcador `(esta)` — `shrink-0`.
       2. **La cifra del resumen es indivisible:** `whitespace-nowrap`. Alcanza a `Monto`, `Cotización`, `Cuotas`, `Fecha`, `Mes de inicio` y `Fórmula`.
       3. **Si el resumen no entra, baja entero a una segunda línea** (`flex-wrap`).
       4. **Solo truncan los valores de texto** (`Descripción`, `Categoría`, `Método de pago`, `Moneda`, `Tipo`, `Débito automático`) con `min-w-0` + elipsis.
     - La **entrada abierta** cierra la lista con fondo `--panel-3` y `(esta)` en `--faint`.
     - Máximo real: **5 filas**.
  3. **Nota de consecuencia** — 12.5px `--muted`: *"Todas se borran del historial."*
- **Footer:** `Cancelar` (ghost) + **`Deshacer los {N+1} cambios`** (primario índigo; carga "Deshaciendo…"). El número es el **total real** (posteriores + esta), siempre ≥ 2; singular defensivo: **"Deshacer el cambio"**.
- **Al confirmar:** las N+1 filas a `opacity-[0.55]` y salen juntas (fade+colapso de §4). **Toast de éxito:** **"{N} cambios deshechos."** / singular **"Cambio deshecho."**

### 7. Vacío, carga y error

**Vacío (el caso más común).** Lenguaje **dashed = acá todavía no hay nada**. Caja `rounded-card border border-dashed border-line bg-panel-2`, `px-6 py-10`, centrado en columna, `gap-[10px]`:
- **Círculo `--panel-3` de 48px** con **`History` 22px `--muted`**.
- **Título** 14.5px/600 `--ink`: *"Todavía no hay cambios registrados."*
- **Apoyo** 13px `--muted`, `max-w-[42ch]`: *"Cuando edites o elimines un movimiento, el cambio aparece acá y lo vas a poder deshacer."*
- **Sin CTA** (el vacío es el estado sano). La retención no se repite (vive en la bajada).

**Carga.** Sistema de skeletons (`skeletons.md`), sin `animate-pulse` inline.
- **Chrome estable presente:** `.phead` (H1 + bajada) y la tarjeta-lista reales.
- **Contenedor** `role="status"` `aria-label="Cargando historial"`; placeholders `aria-hidden`.
- **5 filas fantasma** con el grid real (`40px 1fr auto`, padding 14/18, divisor `--hair`):
  - Col 1: **`SkeletonBlock` 40×40 radio `--r-ctl`** (no círculo).
  - Col 2: `SkeletonLine` **14.5px** ~45% + `SkeletonPill` 60×16 en la misma línea → `SkeletonLine` **12px** ~32% → `SkeletonBlock` `--r-ctl` **44px** alto, 100% ancho.
  - Col 3: `SkeletonLine` 12.5px × **80px** + `SkeletonBlock` `--r-ctl` **104×36**.
- **Solo en carga inicial.**

**Error.**
- **Falla la carga** — patrón inline (card de Moneda / Datos externos): 13px `--expense-ink`: *"No se pudo cargar el historial. Recargá la página."*
- **Falla el deshacer** — `toast.error`: *"No se pudo deshacer el cambio. Intentá de nuevo."* El **modal queda abierto** y el botón vuelve a normal. La lista no cambia.

### 8. Ítem del sidebar

- **Ícono: `History`** (lucide), **18px**, molde de los demás links (`opacity-70` inactivo / `opacity-100` activo).
  - *Descartados:* `Undo2` (nombra la acción), `RotateCcw` (colisiona con `RefreshCw`), `Clock` (genérico).
- **Rótulo:** "Historial".
- **Posición: cuarta**, entre Reportes y Configuración. Orden: `Dashboard · Vista del mes · Reportes · Historial · Configuración`. **Configuración cierra la lista por convención.**
- **Activo:** `bg-accent-soft text-accent-ink font-semibold` + `aria-current="page"`, match por prefijo (`/historial`).

### 9. Contención responsive (obligatoria)

**El riesgo es el par `antes → después`.** Solución: **wrap, nunca truncado de cifra**.

**Régimen amplio (`≥ --bp-wide`):** el grid `40px 1fr auto` de §2.

**Régimen compacto (`< --bp-wide`, container query sobre `<main>`):** la entrada **colapsa a stack de una columna**:
1. `[ícono 40×40] [nombre + chip de operación]`.
2. **Sublínea**, con el **momento como último segmento**: `● Categoría · {Estructura} · {DD Mmm · HH:MM}` (mono solo en el momento).
3. **Bloque "Qué cambió"** a ancho completo.
4. **Botón "Deshacer"** en su propia fila, **a la derecha**, `mt-[10px]` (bloqueado: el motivo a su izquierda en la misma fila).

**El par al angostarse (los dos regímenes):**
- Fila de campo `flex-wrap`: si el par no entra al lado del rótulo, **baja a su propia línea**.
- `→ {valor nuevo}` es **indivisible**; envuelve entero (`→ $12.500,00`).
- **Ninguna cifra se trunca jamás**: monto, cotización, cuotas, fecha/hora, mes de inicio y `Fórmula` envuelven enteras. Los **textos** truncan con `min-w-0` + elipsis.
- **`Débito automático`** nunca necesita envolver.
- **La lista del modal de cadena** (§6.2) tiene su propia contención (ancho fijo del modal), misma regla dura.

**Los cuatro invariantes:**
1. *Sin scroll horizontal del `body`:* sin ancho mínimo rígido; col 2 `min-w-0`; en compacto la acción sale de la fila. A 392px de contenido se lee apilada.
2. *Modales completos y scrolleables:* `ModalShell variant="dialog"` — `max-h: calc(100dvh − 48px)`, cuerpo scrolleable, footer pineado. El **modal de cadena es el más alto**: verificar en viewport bajo.
3. *Ninguna acción inalcanzable:* el botón (los dos estados activos) siempre visible; la fila es una superficie de activación ≥44px.
4. *Superficies anchas:* **no aplica** (lista vertical; contención por truncado + wrap).

### 10. Agregados más allá del brief — estado

1. **Bajada de la cabecera** con la regla de retención — **confirmado por el usuario**; espejarlo en `screens.md` es del analista.
2. **Lista de los cambios que se van a deshacer** en el modal de cadena (§6.2) — RF-HIST-004 solo exige **cuántos**; mostrar cuáles es prevención de error. **Confirmado por el usuario.**
3. **Copy de la pantalla** (títulos de modal, rótulos de bloque, notas, toasts) — vigente en la UI. Señal de documentación: espejarlo en `screens.md`.
4. **Botón "Bloqueado" activo** en vez de deshabilitado (§4) — **confirmado por el usuario**; la CA de RF-HIST-004 ("deshabilitadas") la reformula el analista. La entrada bloqueada **no se puede deshacer sola**.
5. **Eyebrow** — descartado por el usuario (ver §1).

### 11. Reglas duras reafirmadas

- **Regla dura 1:** ícono de operación, chips y motivo de bloqueo **neutros**; **nada se pinta de rojo por ser una eliminación**. El único color semántico es el **color por tipo de la cifra nueva** (gasto `--ink` / ingreso `--income-ink`).
- **Regla dura 2:** índigo en el **botón primario de los modales**, el **ítem activo del sidebar** y los **focus rings**.
- **Regla dura 3:** montos (anterior y nuevo, fila y modal) en **mono tabular**; también momentos y números de cuota.
- **Regla dura 4:** solo tokens theme-aware (`--expense-ink` solo para el error inline).

### Checklist de aceptación visual — Historial de cambios

*Encuadre:*
- [ ] `/historial` usa el ancho canónico (`px-10 max-w-[1120px]`, llena y capea en 1120), **sin flechas ‹ ›, sin stepper y sin chip de moneda**.
- [ ] Cabecera: H1 "Historial" (32/700) + bajada con la regla de retención. **Sin eyebrow** (no hay línea de 12px uppercase arriba del título). Zona derecha del header vacía.
- [ ] **Con el sidebar cerrado, el chip flotante "Mostrar menú" no toca ningún texto:** el H1 se lee **"Historial" entero** (la "H" no queda tapada). Verificar a **viewport 1120px y 640px**, que es donde el bloque de contenido queda pegado al borde. Al abrir/cerrar el sidebar la página **baja/sube junto con el deslizamiento**, en un solo movimiento. Comprobar también en `/reportes` que el **eyebrow** ("TU ACTIVIDAD") arranca libre del chip a esos mismos anchos.
- [ ] Las entradas viven en **una sola tarjeta-lista** con filas separadas por hairline (no una card por entrada).

*Anatomía de la entrada:*
- [ ] Col 1: caja 40×40 **neutra** (`--panel-3`) con **`Pencil`** (editado), **`Trash2`** (eliminado) o **`CalendarSync`** (reabierto). **Ninguna fila usa rojo por ser una eliminación.**
- [ ] **Alineación al tope:** en una entrada alta (una **eliminación con 5 filas de campos**) el ícono queda **enmarcando el nombre + la sublínea**, no flotando a la altura del bloque de cambios; y el **momento** de la col 3 se lee **al mismo nivel que el nombre**. Comparar una entrada corta con una larga: el ícono debe estar **a la misma altura en las dos**.
- [ ] Línea 1: nombre del movimiento (14.5/600, trunca) + **chip neutro** "Editado"/"Eliminado"/"Reabierto".
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
