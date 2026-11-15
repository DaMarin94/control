# Toasts — sistema general y Deshacer inmediato tras editar o eliminar

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Deshacer desde la pantalla: `historial.md`. Toast sobre el footer en régimen de captura: `captura.md` §8.

## Toast con acción — Deshacer inmediato tras editar o eliminar

Atajo en pantalla a la operación de **RF-HIST-003**, sin ir a `/historial` (RF-HIST-007). El toast de éxito al **editar**, **eliminar** o **reabrir** un movimiento ofrece **Deshacer**. Alcanza a las **cuatro formas** (único, fijo, calculado, cuotas); crear **no** lleva acción (no genera entrada de historial).

Todo lo que no sea específico del undo (**duración, pausa por hover, layout de la acción, apilado, ancho**) es **regla general del sistema de toasts**.

### 1. Anatomía — la acción va INLINE, no debajo del mensaje

Molde del pill: `bg-ink text-paper`, radio `13px`, `py-3 pl-4 pr-[14px]`, `shadow-[var(--shadow-lg)]`, `font-ui 14px/500`, entrada `slide-up .3s`.

Fila única, `items-center`, `gap-[14px]`:

`[tick 24px] [mensaje] │ [Deshacer] [✕]`

- **Mensaje** — `min-w-0 flex-1`, `leading-snug`, **máximo 2 líneas** (`line-clamp-2`). Sin cifras (§8).
- **Divisor** — `w-px h-5 bg-current opacity-[0.22] shrink-0` (`currentColor` = `--paper`, contrasta en ambos modos). Hace que la acción se lea como **control**.
- **Acción** — `shrink-0 whitespace-nowrap text-center min-w-[104px]`, 14px **700**, `--paper` pleno, subrayado `tlink` (`border-b border-b-current pb-px`). Hover `opacity-80`, focus visible `ring-2 ring-current` sobre `rounded-ctl`.
  - **Hit area 48px sin engordar el pill:** `relative` + `after:absolute after:-inset-y-[7px] after:inset-x-0` (≥44px).
  - **`min-w-[104px]` es anti-layout-shift:** reserva el ancho de `Deshaciendo…`.
- **✕** — siempre habilitado (también en vuelo).
- **Por qué inline:** debajo el pill crece ~18px por toast y el blanco queda en una tira de ~16px. **Inline la acción no cuesta alto propio**; cuesta **ancho de mensaje** (119px: divisor 1 + gap 14 + botón 104), compensado en el ancho del pill.

**Ancho del pill — dos reglas.**

- **Sin acción:** `max-w-[min(460px,calc(100vw-32px))]`. Ancho natural, capeado.
- **Con acción:** **ancho fijo** `w-[min(520px,calc(100vw-32px))]` (una sola propiedad).
  - **Por qué fijo:** el pill con acción es un blanco que **se reemplaza en su misma posición** (§5); con un rango, dos nombres distintos dan dos anchos en el mismo slot y el blanco cambia bajo el cursor.
  - **Por qué 520:** a 460 la columna de mensaje quedaría en 227px; a 520 devuelve **287px**. 520 + 32 = 552 ≤ 600.
  - **Prohibido `min-width` sin clamp — regla general del DS.** `min-width` **gana sobre** `max-width`: un piso fijo con un clamp de viewport se sale de pantalla cuando se cruzan. O una sola propiedad `width: min(deseado, clamp)`, o el piso también clampeado (`min-width: min(piso, clamp)`). Aplica a todo el sistema.
- **El desenlace (c/d) no hereda el ancho**: sin acción, se **angosta** (≤460). Esperado.

**Presupuesto de ancho del mensaje.** Contenido **490** (520 − padding 16 + 14); menos tick 24, divisor 1, acción 104, ✕ 18 y **4 gaps de 14 (=56)** ⇒ **columna de mensaje = 287px**. Con `leading-snug` (19,25px por línea): **1 línea ⇒ pill de 48px**, **2 líneas ⇒ 63px**.

**El tick no cambia.** Mapeo por tipo (`success`→`--income`, `error`→`--expense`, `warning`→`--warning`, `info`→`--accent-ink`).

### 2. Copy

| Acción | Mensaje | Tipo |
|---|---|---|
| Edición (las 4 formas) | **"Actualizado: ‘{Nombre}’."** | `success` |
| Eliminación (las 4 formas) | **"Eliminado: ‘{Nombre}’."** | `success` |
| Reapertura de un fijo (RF-MF-008) | **"Reabierto: ‘{Nombre}’."** | `success` |

- **`{Nombre}`** = la descripción del movimiento; si no tiene, el **nombre de la categoría**. Comillas tipográficas simples ‘ ’.
- **Nombrar el movimiento es obligatorio:** con varios toasts apilados, un copy genérico deja al usuario eligiendo a ciegas cuál revertir.
- **Sin "correctamente" ni "Movimiento"**: no discriminan y le roban ancho al nombre. **El nombre va lo más cerca posible del comienzo** (lo protege del `line-clamp`). Con 287px, ~23 caracteres de nombre en una línea y ~63 antes de la elipsis en dos.
- **Un solo molde para las 4 formas** (el calculado no nombra su estructura).
- **Rótulo de la acción: "Deshacer"** — la misma palabra que en `/historial`.

### 3. Duración y pausa

- **Toast con acción: `8000 ms`** (constante aparte). Default sin acción: **`5000 ms`**.
  - **Por qué 8:** lectura con nombre (~1,5–2s) + decisión (~2s) + viaje del puntero (~1s) + margen.
  - **Por qué no 10 o 12:** con 3 pills apilados la banda inferior queda ocupada mucho y aumenta la ventana en que el toast queda obsoleto.
- **Pausa por hover y por foco — regla general de todos los toasts.** El auto-dismiss se **pausa** con `pointerenter` o `focus-within`, y **reanuda** con el **tiempo restante, nunca menos de 2000 ms**.
  - **No** se pausa por pestaña oculta (`visibilitychange`).

### 4. Ciclo de vida de la acción

**a. Reposo.** 8s con pausa por hover, ✕ disponible.

**b. En vuelo (`isUndoing`).** El clic en Deshacer **no cierra el toast**: el desenlace se comunica en el mismo lugar.
- El temporizador se **cancela definitivamente**.
- El botón pasa a **"Deshaciendo…"**, `disabled`, `aria-busy="true"`, `opacity-70`, `cursor-default`, **sin subrayado**, sin hover. El ancho no se mueve.
- **Sin spinner** (el cambio de rótulo es el feedback, patrón "Eliminando…" / "Deshaciendo…").
- El **✕ sigue habilitado**: cerrar **no cancela** la operación; el desenlace igual se anuncia.

**c. Éxito.** El toast de origen **se descarta** y en **su misma posición** aparece `toast.success` **"Cambio deshecho."** — 5s, **sin acción** (mismo copy que `/historial`). Intercambio 1↔1.

**d. Obsoleto (404 — ya se deshizo desde `/historial` o venció).** Se descarta y en su posición aparece **`toast.warning`**: *"Este cambio ya no está disponible para deshacer."* (mensaje de `useUndoHistory`).
- **Regla general:** **si algo que el usuario pidió explícitamente quedó sin hacer, el tono es al menos `warning`; `info` queda para desenlaces donde nada de lo pedido quedó pendiente.** Rojo sobra (no hubo falla).

**e. Error reintentable (red / 5xx).** El toast de origen **NO se descarta**: vuelve a **reposo** con "Deshacer" restaurado y un temporizador **nuevo de 8s**; encima aparece `toast.error` *"No se pudo deshacer el cambio. Intentá de nuevo."*

**f. Sin confirmación previa.** El toast **acciona directo**. La confirmación de RF-HIST-003 es de la superficie `/historial` (deshacer **frío**); el atajo es RF-HIST-007 y no confirma. El disparo accidental se contiene con el divisor, el hit area acotado y el rótulo explícito.

### 5. Apilado e identidad

- **Orden:** el más nuevo **abajo**; la pila crece hacia arriba. `gap-[10px]`, `bottom-[26px]`, centrado al **viewport** (chrome global).
- **Tope de 3 pills visibles.** El cuarto descarta el **más viejo**, salvo que esté en vuelo (cae el más viejo que no lo esté).
  - Geometría con 3: `26 + 3×48 + 2×10 = 190px`; peor caso con 2 líneas: `26 + 3×63 + 2×10 = 235px`.
- **Identidad de grupo — un toast de deshacer por movimiento.** Emitir otro con la misma identidad **reemplaza al anterior conservando su posición e índice**. Toasts de **movimientos distintos conviven**.
- **El toast de desenlace (c/d) hereda la posición** del que reemplaza.

### 6. Contención responsive (obligatoria)

**El toast es chrome de los dos regímenes.** `z-[90]`, mismo molde. Solo cambia **dónde apoya la pila**: en **régimen de app**, abajo-centro a `--toast-inset-bottom` (26px); en **régimen de captura**, el envase publica el alto de su footer en esa variable y la pila queda **por encima del footer pineado** (no tapa Guardar; `captura.md` §8). El clamp `100vw − 32px` es la última palabra en los dos regímenes.

- **Ancho:** con acción, **fijo** `w-[min(520px,calc(100vw-32px))]`; sin acción `max-w-[min(460px,calc(100vw-32px))]`. **Ningún `min-width` sin clamp.** El pill es `fixed`: **el sidebar no lo afecta**.
- **El mensaje envuelve, la acción no.** Mensaje `min-w-0` + `line-clamp-2`; acción y ✕ `shrink-0`. Crece de alto (48→63px) antes que empujar la acción.
- **El ancho de mensaje es constante en todo el régimen de app** (287px a 640, 941, 1120 y 1920): sin disposición compacta; el no-truncado se verifica una vez.
- **Truncado solo en texto; el nombre nunca desaparece entero.** Sin cifras en este copy; si se agregara un monto, mono tabular y **no truncaría jamás**.
- **Los cuatro invariantes:**
  1. *Sin scroll horizontal del `body`:* `fixed` + ancho clampeado en una sola propiedad + `translate-x-1/2`.
  2. *Modales completos y scrolleables:* el toast no es modal. Viewport de toasts `z-[90]`, modales `z-40/50`: un pill **se dibuja por encima** de un modal y puede solaparse con su footer en viewport bajo. **El ancla del toast es siempre abajo-centro**, haya o no un modal (un blanco que cambia de lugar es impredecible). **Invariante: ni la acción del toast ni los controles del modal quedan inaccesibles** — lo sostienen: el pill **nunca atrapa** (✕ habilitado, `pointer-events` solo en el pill, contenedor `pointer-events-none`, auto-dismiss), los modales scrollean dentro de sí y la banda ocupada está acotada (≤235px). **Se verifica en QA** a 700×640 con el form de movimiento abierto.
  3. *Ninguna acción inalcanzable:* acción y ✕ **siempre visibles**, hit area ≥44px (48px vía `after`); banda ≤235px.
  4. *Superficies anchas:* **no aplica**.

### 7. Agregados más allá del brief — estado

1. **Copy de los toasts de editar y eliminar** (con el nombre, sin "correctamente" ni "Movimiento", calculado sin frase propia) — **confirmado por el usuario**.
2. **Reglas generales del sistema de toasts** (pausa por hover/foco, tope de 3, ancho del pill con clamp y la prohibición de `min-width` sin clamp) — **confirmado por el usuario, vigente para toda la app**.
3. **Sin modal de confirmación en el atajo** (§4.f) — RF-HIST-003 confirma en `/historial`; RF-HIST-007 aplica el atajo directo. Sin conflicto.
4. **Copy de los diálogos de eliminar** (`delete-transaction-dialog`, `delete-recurring-dialog`, `delete-installment-dialog`): cierran con *"Vas a poder deshacerlo desde el historial."* — **confirmado por el usuario**.

### 8. Reglas duras reafirmadas

- **Sin verde/rojo fuera de su semántica:** Deshacer es `--paper` sobre `--ink`, neutro. El tick conserva su mapeo.
- **Sin índigo en el pill** (el anillo de foco es `currentColor`).
- **Sin cifras en el copy** — si entrara alguna, mono tabular sin truncado.
- **Ambos modos:** pill `--ink`/`--paper` (se invierte solo), divisor y foco `currentColor`, tick con tokens semánticos.

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
- [ ] **En régimen de captura el pill apoya sobre el footer, no sobre el borde:** a **375px** y a **324px** de ancho, con un toast recién emitido, el pill queda **entero por encima del footer pineado** (`--toast-inset-bottom` = alto del footer) — **no tapa el botón Guardar**, que sigue visible y operable —, entra completo con su clamp `100vw − 32px` y **no genera scroll horizontal**.
- [ ] A **700×640** con el **form de movimiento abierto**: con un toast en pantalla, **la acción del toast y los controles del footer del modal siguen alcanzables** (el pill puede solaparse, pero nada queda inaccesible: ✕ operable, footer alcanzable con scroll del modal). Si algo queda inaccesible, es una **rotura del invariante 2** (§6) y se reporta como hallazgo.
- [ ] Se ve correcto en **claro y oscuro**: pill invertido, divisor y foco visibles en ambos, tick con su color semántico.
