# `/mes` — simulación de categoría (fila simulada, disparador, modal, ciclo de vida)

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Filtros por sección de `/mes`: `mes-listado.md`. Simulados en `/reportes`: `simulados-en-cards.md`.

## Simulación de categoría (`/mes`) — fila simulada, disparador y ciclo de vida

Implementa **RF-SIM-001..004** (RN-028, RN-029). Vive en **una sola pantalla** (`/mes`) y en **un solo punto de entrada** (el disparador de filtro de la sección **Únicos**). En `/reportes` los simulados se incorporan por el chip propio de las cards (`simulados-en-cards.md`); no aparecen en el Dashboard.

**Tres reglas de alcance (decisión del usuario) que atraviesan toda la spec:**

1. **El horizonte es POR SIMULACIÓN y se ancla al mes desde el que se la crea.** Simular parado en octubre crea una simulación que arranca en **octubre**. Dos simulaciones pueden tener **tramos distintos**: no existe "el horizonte" en singular; cada simulación declara el suyo (§4). El **arranque efectivo nunca es un mes pasado**: si el ancla quedó atrás, arranca en el **mes en curso**; los meses **pasados no se simulan nunca**.
2. **El monto simulado de cada mes es un REMANENTE:** `proyección − únicos reales ya cargados de esa categoría en ese mes` ("lo que falta para llegar a lo proyectado"), en **cualquier** mes del horizonte. Si da 0 o se invierte, **ese mes no lleva fila simulada**.
3. **El selector del modal ofrece SOLO las categorías simulables** (§3). Las que tienen **menos de 3 meses con datos** y las **ya simuladas** **no se listan**. Hay **un mensaje único** al pie de la lista (§3.1b) y **estados vacíos por causa** (§3.8). **Única excepción con texto por fila:** el **error por categoría** del fallo parcial, en un *slot de desenlace* (§3.4).

**Consecuencia de (2): el fenómeno a explicar es "hubo descuento", no "mes en curso".** Un mes futuro con un único adelantado muestra el mismo remanente parcial que el mes en curso. **Decisión del usuario (cerrada): ninguna señal por fila — ni cromo ni variante de copy.** El remanente se explica **una sola vez**, en la bajada del modal (§3.1). La fila del mes en curso es **idéntica** a la de un mes futuro (§1).

### 0. Encuadre y cero-impacto

**Restricción rectora — sin simulaciones activas, `/mes` se ve y se comporta exactamente igual que sin la feature.** Solo **un** elemento es incondicional: el botón **"Simular categoría"** dentro del popover de filtro de Únicos (el punto de entrada). Todo lo demás —fila simulada, glifo de subtotal, línea de composición, lista de activas, nota de simulación pausada— es **condicional**.

**Las tres naturalezas y dónde vive cada una:**

| Naturaleza | Superficie | Condición de montaje |
|---|---|---|
| **Configurar** (crear / eliminar / ver activas) | banda "Simulación" del popover de Únicos | el botón, siempre; la lista, con ≥1 activa |
| **Ver el resultado** | fila simulada en la sección Únicos | mes **dentro del horizonte de esa simulación** (de su arranque efectivo a su fin; pasados nunca), remanente ≠ 0 |
| **Entender la composición** | glifo en el subtotal + línea bajo los totales | ≥1 fila simulada **visible tras los filtros** |

**Los popovers de Fijos y Cuotas no cambian.** La banda se monta **solo** en Únicos (RN-029).

**Glifo canónico de la feature: `ChartSpline`** (lucide), en las tres superficies (botón de la banda, adorno del subtotal, línea de composición). *Descartados:* `Sparkles` (sugiere "magia/IA"), `TrendingUp` (colisiona con dirección), `Waypoints` (genérico).

### 1. Fila del movimiento simulado

Vive en la sección **Únicos** de un mes dentro del horizonte de su simulación —**el mes en curso incluido**, cuando es el arranque efectivo—, mezclada con las filas reales. **Inequívocamente distinguible de un único real de un vistazo, sin leer texto** (RF-SIM-003).

**En el mes en curso la fila es idéntica a la de un mes futuro.** Sin chip, color ni nota propios. *Descartadas:* **(a)** un chip "Parcial"/"Este mes" (quinto vocabulario, no accionable, y falso: un mes futuro puede tener el mismo remanente parcial); **(b)** una nota al pie (es un estado normal, no una anomalía; le restaría fuerza a §6.2); **(c)** una variante de sublínea "resto de la tendencia…" (**descartada por el usuario**: exigiría un dato nuevo por fila para algo no accionable). **La sublínea siempre termina en `· tendencia de 12 meses`, sin variantes.**

**Anatomía — mismo grid que la fila real** (`40px 1fr auto auto auto`, `padding var(--row-pad) 18px`, hairline entre hermanas). Geometría **exacta**: la columna de montos debe seguir alineada (regla dura 3). Cambia el **tratamiento**, nunca la geometría.

**1.1 Col 1 — caja de ícono hueca y punteada (la señal principal).** Misma caja 40×40 `rounded-[11px]` y mismo glifo de dirección (`ArrowDown` gasto / `ArrowUp` ingreso, 19px, `stroke-width 2.2`), pero:

- **Real:** relleno `--expense-soft` / `--income-soft`, glifo `--expense-ink` / `--income-ink`, sin borde.
- **Simulada:** **sin relleno**, **borde `1.5px dashed`** en `--expense` / `--income`, glifo en `--expense-ink` / `--income-ink`.

**El glifo no cambia; el tratamiento sí:** la flecha comunica **dirección** (idéntica en las dos filas). La **naturaleza** (todavía no ocurrió) usa el idioma del DS **`dashed` = acá todavía no hay nada**. *(Consistencia + affordance.)*

**1.2 Col 2 — nombre y sublínea.** El simulado **no tiene descripción propia**: su identidad es la categoría.

- **Nombre** (14.5/600 `--ink`): **el nombre de la categoría**.
- **Sublínea** (12px, molde de `mes-listado.md` *Sublínea del ítem*): `[chip "Simulado"] ● {Categoría} · tendencia de 12 meses`.
  - **Chip "Simulado"** — molde del chip "Anulado": `rounded-[var(--r-chip)] bg-panel-3 text-muted px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em] shrink-0`, **primer segmento**. Respaldo textual de la señal visual. Un simulado **nunca** puede estar anulado.
  - **Punto de categoría 6px + nombre** en `--ink-2`.
  - **`· tendencia de 12 meses`** — último segmento, `--muted`, minúscula. Responde "¿de dónde sale esto?". Trunca primero. (`frontend/src/components/movements/simulated-movement-row.tsx`.)
  - **Texto único, sin variantes**: el frontend no necesita ningún dato extra por fila.
- **Marca de límite con efecto `badge` — inmediatamente después del chip "Simulado":** `[Simulado] [badge de límite] ● {Categoría} · tendencia de 12 meses`.
  - **Mismo slot y orden que la fila real** (`[Anulado] [badge de límite] ● Categoría …`): "Simulado" ocupa la posición de "Anulado".
  - **Orden:** "Simulado" (**qué es**, siempre presente) antes que el badge (**qué le pasó**, condicional): el borde izquierdo de la sublínea queda alineado en toda la sección.
  - **Nunca hay tres chips** (par máximo `[Simulado] [badge]`).
  - Otros efectos: **`glyph`** al cluster de la zona de estados (primero); **`fill`** pinta el fondo de la fila —única excepción al "sin hover tint" de §1.6—; **`tint` prohibido** (monto tipado). Con **`bold`**, el peso sube **solo en la cifra**: el `≈` conserva `--muted` y peso normal (§1.4).
- **Zona de estados:** solo la **marca de límite** si aplica (RN-022). `GitBranch` nunca aplica.

**1.3 Col 3 — vacía** (sin instante, RF-SIM-003; precedente: el fijo).

**1.4 Col 4 — monto con prefijo `≈`.** Mono tabular, 15.5px/600, **color por tipo** (gasto `--ink`, ingreso `--income-ink`) y signo, precedido de **`≈` (U+2248)** en `--muted` con `mr-[3px]`, **dentro del mismo span mono**:

```
≈ −$12.500,00
```

- El `≈` dice "esta cifra es una estimación" en el dato mismo. *(Prevención de error.)*
- **No rompe la alineación tabular** (`text-right`, monoespaciada).
- **No se recolorea ni se atenúa el monto** (el simulado **sí computa**, §5).

**1.5 Col 5 — el hueco del kebab se reserva.** Sin kebab (sin acciones). **Placeholder inerte de 32×32** (`h-8 w-8`, la caja del `KebabMenu`), `aria-hidden`, `pointer-events-none`, sin borde ni fondo. Sin él, el monto se correría 32px y la columna de dinero se desalinearía. *(Descartado: usar el hueco para el chip — falsa affordance en la columna de acciones.)*

**1.6 La fila no es interactiva** (no abre card de detalle):

- **Sin** `role="button"`, `tabIndex`, handlers ni focus ring.
- **Sin hover tint**; `cursor-default`. Pintar hover sobre algo que no responde promete una acción inexistente.
- **Excepción:** el fondo del efecto `fill` de una marca de límite **sí** se aplica.

**1.7 La fila NO se atenúa** (sin `opacity-[0.55]`: en la app significa "no computa", y el simulado computa).

**1.8 Orden.** Por **monto**, por magnitud mezclado con las reales; por **fecha**, **al final** de la sección. **Sin separador, subgrupo ni encabezado propio.**

**Resumen de señales:** 3 sin texto (caja punteada hueca · `≈` · sin hover) + 1 textual (chip "Simulado"). Ninguna depende solo del color.

### 2. Banda "Simulación" en el popover de filtro de Únicos

El popover de sección tiene dos bloques (**tipo** y **categorías**); la simulación es un **tercer bloque, en registro distinto**.

**El problema y la decisión.** Filtrar es *"qué de esto veo"*; simular es *"qué contiene el mes"*. *Alternativas:*

- **(A) Tercer bloque al final, mismo tratamiento.** Descartada: queda después de una lista con scroll de 280px y no se distingue.
- **(B) Dos solapas.** Descartada: más cromo que contenido en 260px y esconde el punto de entrada.
- **(C, elegida) Banda fija al pie, recesada y rotulada.** **Fuera** del scroll de categorías, demarcada por **superficie** (`--panel-2`) y **divisor fuerte** (`--line`, no `--hair`).

**Anatomía de la banda** (solo en **Únicos**):

- **Divisor superior:** `border-t border-line`.
- **Superficie:** `bg-panel-2`, `px-3 py-[10px]`, `flex flex-col gap-[8px]`, `shrink-0`.
- **Eyebrow:** 11px/600 uppercase `.08em` `--muted` — **"Simulación"**.
- **Botón "Simular categoría"** — **siempre presente**, ancho completo: outline (`bg-panel border border-line rounded-[var(--r-ctl)]`), `min-h-[34px]`, `justify-center gap-[6px]`, 12.5/600 `--ink-2`, **`ChartSpline` 15px**. Hover `bg-panel-3` + `--ink`. Focus `--accent-soft` 3px. Abre el **modal** (§3) y **cierra el popover** (un overlay a la vez).
- **Sin simulaciones activas:** debajo del botón, 11.5px `--muted`: *"Proyecta categorías desde el mes que estás viendo."* (Enunciado exacto de lo que el botón hará ahora; sin caja dashed ni ilustración.)
- **Con ≥1 activa:** la **lista** (§4) debajo del botón y al pie una nota 11.5px `--muted`: *"Cada simulación proyecta desde el mes en que la creaste."*
  - **La nota declara la REGLA, no un tramo** (con anclas distintas, un tramo único sería falso para alguna fila). El tramo concreto vive en cada fila (§4). *Descartadas:* nota de alcance máximo (no dice hasta cuándo llega **cada una**); sacar la nota (dos fechas distintas se leerían como defecto).

**El botón va arriba y la lista abajo**: posición **estable** del control buscado.

**El punto indicador `--accent` del disparador NO cambia de significado:** sigue siendo **"esta sección está filtrada"**. Una simulación activa **no** lo enciende.

### 3. Modal "Simular categoría" — selector MÚLTIPLE, solo categorías simulables

**Por qué modal y no un sub-panel en el popover:** un popover dentro de un popover es frágil; es una **decisión con confirmar/cancelar** y **selección múltiple con contador** (`ModalShell variant="dialog"`); y el **error por categoría** del fallo parcial (§3.4) necesita ancho.

**La lista muestra únicamente lo que se puede simular** (fuera: **menos de 3 meses con datos** y **ya simulada**; decisión del usuario):

- **El filtro es de presentación, no de contrato:** el frontend recibe el **catálogo activo completo con sus flags** (`monthsWithData`, `alreadySimulated`) y oculta las no elegibles; los flags permiten decir **cuál** causa dejó la lista vacía (§3.8).
- **El universo se congela al abrir.** La lista se calcula **una vez** y **ninguna fila desaparece mientras el modal está abierto** — las creadas en un intento con fallo parcial **se quedan en su lugar** (§3.7 c). *(Prevención de error.)*

- **Contenedor:** `ModalShell variant="dialog"` (`max-w-[440px]`). **✕ y `Esc`**; el scrim **no** cierra.
- **Título** (18/700): **"Simular categoría"** — igual que el botón que lo abre (par disparador↔destino). La pluralidad se comunica en los checkboxes y el botón de confirmación.

**3.1 Bajada** — 13px `--muted`, `max-w-[46ch]`, un `<p>` de tres oraciones:

> *"Se proyecta cada categoría elegida a partir de sus últimos 12 meses. Alcanza desde {Mes inicio} hasta {Mes fin}. En cada mes se simula solo lo que falta para llegar a lo proyectado."*

- **Oración 1** — plural (selector múltiple).
- **Oración 2** — **inicio y fin del tramo, con los dos meses nombrados** (*"Alcanza desde octubre 2026 hasta marzo 2027."*). Todas las de una tanda comparten ancla (el mes visualizado). Sin el deíctico "este mes" (ambiguo entre mes en curso y mes visualizado). **`{Mes inicio}` = arranque efectivo = `max(mes visualizado, mes en curso)`**. *(Descartado: "desde este mes" + mes entre paréntesis.)*
- **Oración 3** — **la explicación del remanente**, en el único momento en que el usuario opta por la feature. **Es el ÚNICO portador de esa explicación**: **no se acorta, no se mueve y no se vuelve opcional**. La bajada se queda en **TRES** oraciones.

**3.1b Mensaje de elegibilidad — una línea al pie de la lista**

Único lugar donde se explica **por qué una categoría no está en la lista**.

- **Copy:** *"Solo aparecen las categorías con 3 o más meses de datos que todavía no estás simulando."*
- **Ubicación:** **debajo de la lista**, último elemento del cuerpo, `mt-[10px]`. **No** se monta con la lista vacía (§3.8) ni en carga o error.
- **Forma:** `<p>` 12px `--muted`, ancho completo, **sin glifo, caja ni borde**. Envuelve; nunca trunca.
- **Al pie y no en la bajada:** responde *"¿por qué no está la mía?"*, pregunta que aparece después de recorrer la lista; y protege la bajada (§3.1).
- **Sin glifo:** un `Info` lo haría anomalía y competiría con §6.2.
- **Nombra las DOS causas:** con el popover cerrado, la lista de activas no está a la vista; hablar solo de los 3 meses llevaría a un diagnóstico equivocado. *(Prevención de error.)*
- **Scrollea con el cuerpo, no queda pineado** (§8.3): aparece al terminar de recorrer la lista.

**3.2 El control de selección — checkbox 16px, no radio**

La lista es **`role="group"`** `aria-label="Categorías a simular"`; cada fila **`role="checkbox"`** con `aria-checked`.

- **Forma:** **cuadrado 16px `rounded-[4px]`, borde 1px** — **molde exacto del checkbox del filtro de categorías** (`CategoryFilterPopover`). Tick **SVG blanco 10×8, `stroke-width 1.8`, linecap/linejoin `round`**.
- **Cuadrado y no círculo:** redondo = uno, cuadrado = varios; dice "podés elegir más de una" antes de intentarlo. Mismo molde que el filtro. *(Affordance + consistencia.)*
- **Transición:** `transition-colors duration-[140ms]`.

| Estado | Caja | Fila |
|---|---|---|
| **Vacío** (habilitado, sin tildar) | `border-line-strong bg-panel`, sin tick | nombre `--ink`; `hover:bg-panel-2`; `cursor-pointer` |
| **Tildado** | `border-accent bg-accent` + tick blanco | fondo `bg-panel-2` persistente (la fila elegida se lee como bloque, no solo por el tilde) |
| **Deshabilitado** — **única causa: la fila se creó en este intento** (§3.7 c) | `border-faint`, **sin relleno y sin tick** — nunca puede estar tildado | `aria-disabled="true"`, `tabIndex={-1}`, `cursor-not-allowed`, nombre `--muted` |
| **Foco** | la caja **no** cambia | el **ring va en la fila entera**: `focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]` — el target real es la fila, no el cuadradito de 16px |

- **Al abrir ninguna fila está deshabilitada**; el estado solo aparece **después** de un intento con fallo parcial, sobre las creadas.
- **Teclado:** cada fila **habilitada** es `tabIndex={0}` y se tilda con **Espacio** o **Enter**; las deshabilitadas fuera del orden de `Tab`.
- **El punto de color de categoría (10px, `rounded-[3px]`) nunca se atenúa.**

**3.3 Anatomía de la fila y orden**

`flex flex-wrap items-center gap-[10px] px-[10px] py-[8px] rounded-[var(--r-ctl)]`, `min-h-[38px]`:

`[checkbox 16px] [● color 10px] [nombre 13px] ····· [desenlace, derecha — solo tras un intento]`

- **Orden: el del catálogo, sin reagrupar**, también después de un intento con fallo parcial (las creadas **no se mueven**).
- **En reposo la fila es solo `[checkbox] [● color] [nombre]`.** Nada que justificar por fila.
- **El punto de color NO se atenúa** aunque la fila esté deshabilitada.
- **Contención del desenlace:** si el texto no entra al lado del nombre, **baja entero a una segunda línea**. Nunca trunca.

**3.4 El slot de desenlace — vacío en reposo, un solo inquilino después de un intento**

Se llena **solo después de un intento**; sus dos contenidos son **excluyentes por construcción** (una fila o se creó o falló):

| Contenido | Color | Cuándo |
|---|---|---|
| **Mensaje de error del último intento** (texto del backend, tal cual) | **`--expense-ink`** 12px | la fila participó del último batch y **falló** |
| **"Simulación creada."** | `--muted` 12px | la fila se **creó** en un intento con fallo parcial (§3.7 c) |

- **El error vive en la fila:** el motivo es **por categoría** y el toast se evapora.
- **Todo lo rojo del slot es un fallo del intento recién ejecutado.**
- **La fila creada dice qué PASÓ** ("Simulación creada.", mismo enunciado del toast de éxito), no "Ya la estás simulando".
- Asociados por **`aria-describedby`**. El error **no** usa `role="alert"` (el anuncio lo hace el toast).
- **Ciclo de vida del error:** persiste hasta que **(a)** el usuario **destilda** la fila, **(b)** hay un **nuevo intento**, o **(c)** se cierra el modal. **"Simulación creada." NO se limpia** con intentos siguientes.

**3.5 Footer — el contador vive dentro del botón**

- `Cancelar` (`variant="ghost" size="sm"`, `disabled` con un batch en vuelo).
- **Botón primario** (`variant="default" size="sm"`, índigo), rótulo **sensible al conteo**:

| Selección | Rótulo | Estado |
|---|---|---|
| 0 | **"Simular"** | `disabled` |
| 1 | **"Simular 1 categoría"** | habilitado |
| N ≥ 2 | **"Simular {N} categorías"** | habilitado |
| en vuelo | **"Simulando…"** | `disabled` |

- **Singular con frase propia:** nunca "Simular 1 categorías".
- **Con 0 el rótulo pierde el número.**
- **El número NO va en mono** (conteo dentro de una frase, no cifra de dinero).
- **Anti layout-shift:** **`min-w-[164px]`**, texto centrado, **`whitespace-nowrap`**.

**Por qué en el botón:** contesta *"¿qué va a pasar si aprieto esto?"* y viaja **pineado en el footer** aunque la lista scrollee. *(Descartado: una línea "3 seleccionadas" separada del verbo.)*

**3.6 "Seleccionar todas" — NO se agrega (decisión explícita)**

**Sin control "Todas / Ninguna"**:

1. **No es un filtro, es una creación.** Cada tilde crea un objeto **persistente** que mueve los totales de todo su horizonte, y su borrado es **físico y no deshacible** (§4). *(Prevención de error.)*
2. **"Simular todo" no es un caso de uso** (la feature es opt-in para mirar **algunas**).

El filtro de categorías sí lo tiene porque allá "todas" es el default, reversible e instantáneo, sin persistencia.

**3.7 Confirmación y desenlaces — incluido el fallo parcial**

El batch tolera fallo parcial: por cada `categoryId` vuelve la simulación creada **o** un mensaje de error legible.

**(a) Éxito total — {N} de {N}.** El modal **cierra**. `toast.success`:
- N = 1 → *"Simulación creada."*
- N ≥ 2 → *"{N} simulaciones creadas."*

El mes visualizado se recarga; normalmente la fila simulada aparece **en el acto** (el mes visualizado es el ancla). En un mes pasado o con remanente 0 **no se ve nada cambiar**: el toast es la única confirmación.

**(b) Fallo total — 0 de {N}.** El modal **queda abierto con la selección intacta** (RNF-008), el botón vuelve a reposo. `toast.error` con el mensaje del backend si era una categoría; **"No se pudo crear ninguna simulación."** si eran varias. Errores por fila según §3.4. **Sin caja de resumen.**

**(c) Fallo parcial — {K} de {N}, con 1 ≤ K < N. El modal QUEDA ABIERTO** (invariante RNF-008: hay error). *(Descartado: cerrar con un toast "Se crearon 3 de 5." — comportamiento impredecible y el toast se lleva cuál falló y por qué.)* Las causas típicas (ya simulada, bajo los 3 meses) son carreras entre el fetch y el POST y llegan como texto del backend.

El modal se **reconcilia** con el estado real, **sin reordenar ni sacar ninguna fila**:

1. **Toast `warning`**: *"Se crearon {K} de {N} simulaciones."* (K = 1 → *"Se creó 1 de {N} simulaciones."*). El tick ámbar del toast es un vocabulario de sistema, ortogonal a la reserva del ámbar sobre datos del mes.
2. **Filas creadas (K)** — **deshabilitadas** con **"Simulación creada."** (`--muted`), **tilde quitada**, **en su lugar**, sin animación ni reorden. Desaparecen en la próxima apertura.
3. **Filas fallidas (N−K)** — **conservan el tilde** y muestran su **error** en el slot (`--expense-ink`). El botón ya dice **"Simular {N−K} categorías"**, listo para reintentar.
4. **Caja de resumen** — **solo en este desenlace**, entre la bajada y la lista, `mb-[10px]`:
   - `rounded-[var(--r-ctl)] border border-line bg-panel-2 px-3 py-[8px]`, **12.5px `--ink-2`**.
   - *"Se crearon {K} de {N}. Las que siguen tildadas no se pudieron crear — el motivo está en cada fila."* (K = 1 → *"Se creó 1 de {N}. …"*).
   - **Neutra, no roja** (resume, incluye éxitos).
   - **Persiste** hasta el próximo intento o cerrar el modal (no desaparece al tildar/destildar).
5. **`Cancelar` sigue siendo salida limpia** (las K creadas ya están creadas).

**3.8 Estados de la lista — el vacío tiene CAUSAS y hay que decir cuál tocó**

*Carga* → 4 filas fantasma (`SkeletonCircle` 16 + `SkeletonBlock` 10 + `SkeletonLine` 13px ~40%), `role="status" aria-label="Cargando categorías"`. *Error de carga* → inline 13px `--expense-ink`: *"No se pudieron cargar las categorías. Cerrá y volvé a intentar."*

**Vacío — cuatro causas, cuatro copys.** Con la lista filtrada, el vacío es **frecuente**, y el empty es **el único portador de la explicación** (las salidas son opuestas: esperar vs. eliminar una).

- **Forma:** caja dashed vigente — `rounded-ctl border border-dashed border-line bg-panel-2 px-4 py-6 text-center` — con **una línea** 12.5px `--ink-2` y, cuando aporta, **una segunda** 12px `--muted` `mt-[4px]`. Sin ícono ni botón.
- **El mensaje de elegibilidad (§3.1b) NO se monta con el empty.**

| Causa | Línea 1 (12.5px `--ink-2`) | Línea 2 (12px `--muted`) |
|---|---|---|
| **Sin categorías activas** (el catálogo viene vacío) | *"No tenés categorías activas."* | — |
| **Ninguna llega a 3 meses con datos** | *"Ninguna categoría llega a 3 meses con datos."* | *"Cuando alguna los acumule, va a aparecer acá."* |
| **Todas las elegibles ya están simuladas** | *"Ya estás simulando todas las categorías que se pueden simular."* | *"Podés verlas y eliminarlas en el filtro de Únicos."* |
| **Mixta** (unas sin datos, el resto ya simuladas) | *"No queda ninguna categoría para simular."* | *"Las que tienen 3 o más meses de datos ya las estás simulando; al resto todavía le faltan meses."* |

- **Distinguibles con los flags que ya llegan** (`monthsWithData`, `alreadySimulated`).
- **Solo "todas simuladas" señala una salida**, sin link (el punto de entrada es único).
- **"Ninguna llega a 3 meses"** dice **cuándo se resuelve**.
- **El botón "Simular categoría" NO se deshabilita** para evitar estos vacíos (exigiría un fetch previo; el empty **es** la explicación).

### 4. Lista de simulaciones activas y eliminar

Dentro de la banda (§2), debajo del botón. **Única superficie donde se ve el conjunto de simulaciones.**

- **Fila:** `flex flex-wrap items-center gap-[8px] py-[6px]`, dos líneas.
  - **Línea 1 — identidad y acción:** `[● color 8px] [nombre categoría 12.5px --ink, truncate] ····· [chip de estado, si aplica] [botón eliminar]`.
  - **Línea 2 — el tramo de ESA simulación** (`w-full`, 11.5px `--muted`), en toda simulación que **proyecta**. **Una pausada muestra la nota de pausa y NO el tramo** (§6.1).

**El tramo por fila** responde *"hasta cuándo llega esto"* por objeto:

| Caso | Copy |
|---|---|
| Ya arrancó (arranque efectivo = mes en curso) | *"Proyecta hasta {mes} {año}."* |
| Todavía no arrancó (se creó parado en un mes futuro) | *"Proyecta de {mes} {año} a {mes} {año}."* |

- **La variante corta es la regla**; la larga **solo cuando el arranque no es adivinable** (una simulación de un mes futuro todavía no muestra nada).
- **Meses con `formatMonthLabel`** ("marzo 2027"), no abreviados.
- *Descartadas:* tramo inline en la línea 1 (truncaría el nombre y colisiona con "Sin datos"); tramo en `title` (no existe en táctil ni para lector).
- **Alto:** filas de ~44px; tope **`max-h-[176px]`** para ver **4 filas** antes de scrollear.
- **Botón eliminar:** icon-only 28×28 `rounded-[8px]`, **`Trash2` 14px** `--muted`. Hover `bg-expense-soft` + `--expense-ink` (molde del ítem `danger` del `KebabMenu`; cromo de acción destructiva). Focus `--accent-soft`. `aria-label="Eliminar la simulación de {Categoría}"`.
- **Más de 4 activas:** `max-h-[176px] overflow-y-auto`, sin que el botón ni la nota general salgan de vista.
- **Confirmación (RF-SIM-004)** — `ModalShell variant="dialog"` (`max-w-[440px]`), **cierra el popover al abrirse**:
  - **Título:** "Eliminar simulación".
  - **Cuerpo** (`space-y-[14px]`): 14px `--ink` *"Se va a eliminar la simulación de **{Categoría}**."* → **caja de identidad** (`rounded-ctl border border-line bg-panel-2 px-4 py-3`) con `● {Categoría}` → **nota** 12.5px `--muted`: *"Sus movimientos simulados dejan de aparecer en los meses que alcanza, y los totales se recalculan sin ellos."* ("los meses que alcanza" es verdadero también para una simulación que todavía no arrancó.)
  - **Footer:** `Cancelar` (ghost sm) + **`Eliminar`** (`variant="destructive" size="sm"`; "Eliminando…").
  - **Éxito:** cierra, `toast` *"Simulación eliminada."*, el mes se recarga. **Error:** `toast.error` y el modal queda abierto.

### 4.1 Extender el tramo de una simulación — disparador condicional, revelado en el lugar

Extensión de `endMonth` sobre una simulación existente. **Contrato:** `PATCH /simulations/:id/extend?today=YYYY-MM-DD`, body `{ months: 1|3|6|12 }`, devuelve el `SimulationDto` con el `endMonth` corrido. **`startMonth` no se toca nunca.**

**Tres decisiones cerradas por el usuario:**

1. **El disparador aparece SOLO en la fila cuya simulación tiene `endMonth` igual al mes que se está viendo en `/mes`** (`viewedMonth === simulation.endMonth`). Condición **por fila**, contra el **mes visualizado** (no el mes en curso real).
2. **El menú ofrece 1 / 3 / 6 / 12 meses**, siempre las cuatro, en ese orden.
3. **Sin tope de extensión.** Tras extender, la fila deja de cumplir la condición 1: **un clic por visita**; para otra vuelta hay que navegar al nuevo último mes.

**Wiring:** la condición 1 se evalúa contra el **mes visualizado** (`month`, el param de ruta de `month-view-client.tsx`), no contra `currentMonth` (mes en curso real): `SimulationBand` recibe el prop `viewedMonth` y cada fila evalúa `simulation.endMonth === viewedMonth`.

**El problema y la decisión.** Cuatro opciones dentro de un popover de 260px, sin dropdown anidado:

- **(A) Ícono + menú flotante anclado al botón.** Overlay dentro de overlay, con dos "click afuera" compitiendo. **Descartada.**
- **(B, elegida) Revelado en el lugar ("inline disclosure").** La línea 2 de la fila (carril del tramo o la nota de pausa, §4): un link **"Extender"** que, al clic, reemplaza su contenido por los **cuatro valores en línea** (`1 mes · 3 meses · 6 meses · 12 meses`), sin `position: fixed/absolute`, sin `z-index`, sin listener propio. Extiende el lenguaje de "texto tenue accionable" del link "Ir al mes en curso" (`navegacion-periodo.md`).

#### Anatomía — línea 2, tres estados posibles

La línea 2 (§4: `w-full text-[11.5px] text-muted`) tiene tres estados excluyentes:

**a) Reposo, con disparador** (condición 1 cumplida). El texto existente (tramo o nota de pausa) **se conserva entero** y a continuación —**separado por un espacio, no por `·`** (el texto ya termina en punto)— el link **"Extender"** con `ChevronDown` 11px `aria-hidden` a `3px`, mismo `--muted`/`currentColor`:

  - Activa, ya arrancó: *"Proyecta hasta noviembre 2026. Extender ⌄"*
  - Activa, todavía no arrancó: *"Proyecta de marzo 2027 a diciembre 2027. Extender ⌄"*
  - Pausada: *"Necesita 3 meses con datos (tiene 2). No proyecta. Extender ⌄"*

  El link: `inline-flex items-center gap-[3px]`, **11.5px** (hereda el tamaño de la oración), `text-muted`, `cursor-pointer` explícito (gotcha de Tailwind v4). **Hover:** `text-ink-2` + `underline underline-offset-[2px]`, color `140ms`. **Focus:** `focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] rounded-[var(--r-chip)]`. **Sin peso extra** (un link más pesado leería como botón).
  - El `ChevronDown` señala que el clic **revela opciones**.

**b) Eligiendo** (tras el clic). La línea 2 se **reemplaza entera** (el chip "Sin datos" de la línea 1, si aplica, sigue visible) por:

  `1 mes · 3 meses · 6 meses · 12 meses`

  - Contenedor: `flex flex-wrap items-center gap-x-[6px] gap-y-[2px]`.
  - Cada valor: botón de texto con el **molde de "Extender"**. `aria-label="Extender {N} {mes|meses}"`. `whitespace-nowrap` **por botón**.
  - Separadores `·` en `--faint`, `aria-hidden`, entre pares.
  - **Hit area:** `py-[3px] -my-[3px]` por botón.
  - **Ancho:** los cuatro entran en una línea en los 236px útiles (~200–215px). Si envolviera, envuelve **entre valores**.
  - **Foco al revelarse:** al primer valor ("1 mes").
  - **`aria-live="polite"` `aria-atomic="true"`** en el contenedor de la línea 2.

**c) En vuelo.** La línea 2 pasa a *"Extendiendo…"* no interactivo — **sin spinner**. El `Trash2` **de esa fila** se deshabilita mientras dura (previene carrera eliminar/extender); las demás filas no se afectan.

#### Cómo vuelve atrás (sin elegir nada)

**Una sola fila "eligiendo" a la vez** en toda la banda:

- **Click afuera de las 4 opciones** (en cualquier otro punto del popover) colapsa a (a). Click **fuera del popover** lo cierra entero (comportamiento existente).
- **Escape** colapsa a (a) **sin cerrar el popover** (lo más interno se cierra primero); sin fila "eligiendo", `Escape` cierra el popover. El foco vuelve a "Extender".
- **"Extender" en otra fila** colapsa la primera y abre la segunda.
- **Sin botón de cerrar dedicado** (los tres caminos lo cubren).

#### Éxito, error y toasts

- **Éxito:** `toast.success` **"Simulación extendida."** (la fecha nueva se ve en la fila). La fila recalcula su `endMonth` y, al dejar de cumplir la condición 1, la línea 2 **vuelve sola** al tramo/pausa **sin disparador**, sin marca de "recién extendida" (rechazada por el usuario). El popover **no se cierra**.
- **Error:** `toast.error` **"No se pudo extender la simulación. Intentá de nuevo."** — la línea 2 **vuelve al estado (b)** para reintentar de un clic. El popover **no se cierra**.
- **Sin confirmación previa** (mueve una fecha hacia adelante; nada se borra).

#### Tramo ya vencido — se ofrecen las cuatro opciones igual, sin distinción

Navegando a un mes **pasado** que es el `endMonth` de una simulación vencida, el disparador aparece igual y **las cuatro opciones se muestran sin ocultar ni deshabilitar ninguna**, aunque alguna deje el `endMonth` en el pasado.

- *Descartadas:* (a) ocultar las opciones cuyo resultado siga en el pasado (duplicaría en JS aritmética del backend para algo que no es error); (b) deshabilitar con motivo (patrón abandonado en el selector del modal, §3).
- **(c, elegida)** Ofrecerlas igual: todas mueven `endMonth` hacia adelante; si sigue vencida, se repite navegando al nuevo último mes.

**Sin cartel ni estado de "vencida/terminada"** (rechazado explícitamente por el usuario). Disparador, opciones y estados son **idénticos** con el `endMonth` en el pasado, presente o futuro.

#### Simulación pausada — convive con la nota de "Sin datos"

La pausada **también** ofrece extender:

- **Reposo:** *"Necesita 3 meses con datos (tiene {N}). No proyecta. Extender ⌄"*.
- **Eligiendo / en vuelo:** la nota se oculta temporalmente y vuelve al resolverse. **Extender no cambia el estado de pausa** (no toca `monthsWithData` ni el chip "Sin datos").

#### Contención responsive

El popover mantiene **260px fijos en todo el rango** (§8.2).

- **Invariante 1:** sin ancho mínimo nuevo; `whitespace-nowrap` **por ítem**.
- **Invariante 2:** no aplica.
- **Invariante 3:** la fila "eligiendo" vive en el carril scrolleable de la lista de activas (`max-h-[176px] overflow-y-auto`); el popover se acota al viewport y abre hacia arriba si hace falta (§8.2).
- **Invariante 4:** mismo carril.
- **`max-h-[176px]` no cambia:** todo vive en el carril de la línea 2.

#### Reglas duras

- **Ningún verde ni rojo** (link, valores y "Extendiendo…" neutros). El rojo sigue exclusivo de Eliminar.
- **Sin índigo salvo el anillo de foco.**
- **El toast de error usa el mapeo vigente** (`error` → tick `--expense`).

### 5. Composición del subtotal y de los totales — se señala, sin tocar las cifras

Un total que mezcla real y simulado sin avisar es engañoso, pero la cifra **no está mal**: se revela su **composición**, **al lado** del número.

**Lo que NO se hace:** no se recolorea ni se atenúa ninguna cifra (los semánticos son del tipo; el ámbar es de límites; el índigo no toca montos).

**5.1 Cabecera de la sección Únicos — glifo junto al subtotal.** Slot `subtotalAdornment` de `AccordionSection`:

- **`ChartSpline` 13px `--muted`**, **a la izquierda del número** y **a la derecha** de cualquier adorno de límite: `[marca de límite] [glifo de simulado] [subtotal]`.
- `aria-label` + `title`: **"El subtotal incluye {N} movimientos simulados"** (singular: *"…incluye 1 movimiento simulado"*).
- Se monta **solo** con ≥1 fila simulada **visible tras los filtros**.
- **El pill contador no lleva glifo.**

**5.2 Totales del mes — una línea de composición bajo la grilla.**

- **Ubicación:** **debajo** de la grilla de las tres stat-cards, antes del listado, a la izquierda.
- **Forma:** `inline-flex items-center gap-[6px]`, **`ChartSpline` 13px `--muted`** + texto **12px `--muted`**.
- **Copy:** *"Los totales incluyen {N} movimientos simulados."* / *"Los totales incluyen 1 movimiento simulado."*
- **Cero-impacto de espaciado:** sin la línea, la grilla conserva su `mb-6`; con la línea, la grilla pasa a `mb-[10px]` y la línea lleva el `mb-6`.
- **Una sola línea para las tres cards** (la composición es del **mes**).
- **Condición:** ≥1 fila simulada visible tras los filtros.

**Por qué no un banner:** sería un cartel permanente para un estado normal y buscado.

### 6. Simulación pausada por falta de datos — el silencio se rompe en dos lugares

Una simulación cuya categoría cayó por debajo de los 3 meses **deja de derivar movimientos sin eliminarse** (RF-SIM-002). Se explica en las **dos** superficies donde el usuario puede preguntárselo:

**6.1 En la lista de activas (§4).**

- **Chip de estado** después del nombre: **"Sin datos"**, `rounded-[var(--r-chip)] bg-panel-3 text-muted px-[6px] py-[1px] text-[10.5px] font-semibold` — molde de **"Desactivado"** del popover informativo de límites.
- **Nombre de la categoría en `--muted`.**
- **Segunda línea**, 11.5px `--muted`: *"Necesita 3 meses con datos (tiene {N}). No proyecta."*
- **Neutro, no ámbar** (es un estado de configuración).
- **Eliminar sigue disponible.**

**6.2 En el mes — una nota al pie del listado de Únicos.**

- **Ubicación:** última fila de la tarjeta-lista de Únicos, tras el mismo hairline. Con la sección **vacía**, debajo del empty dashed, `mt-[8px]`.
- **Forma:** no interactiva, `px-[18px] py-[12px]`, `inline-flex items-start gap-[6px]`, **`Info` 14px `--muted`** + **12px `--muted`**.
- **Copy:** *"{N} simulaciones no están proyectando: les faltan meses con datos."* / *"Una simulación no está proyectando: le faltan meses con datos."*
- **Condición:** ≥1 simulación pausada **cuyo horizonte alcanza el mes visualizado** (mes en curso incluido); `{N}` cuenta **solo esas**. **Independiente de los filtros.**
- **Sin acción ni link** (el arreglo está en el disparador de la misma cabecera).

### 7. Meses fuera del horizonte — sin señal (decisión)

Un mes que **ninguna simulación alcanza** (más allá del fin, o **anterior al arranque** de las creadas desde un mes futuro) **no lleva ninguna señal**. Se evalúa **por simulación**.

- **Cerrado funcionalmente** (`screens.md` §4). Una señal rompería el cero-impacto.
- **Cromo permanente para explicar una nada.** *(Carga cognitiva.)*
- **La regla se explica donde el usuario opta:** la bajada del modal (§3), la nota general de la banda (§2) y **la línea de tramo de cada fila** (§4). El caso "todavía no arrancó" se explica en la fila de la simulación.

*Descartada:* nota al pie *"La simulación no alcanza este mes."* (compite con §6.2).

### 8. Contención responsive (obligatoria)

**8.1 La fila simulada.** Mismo grid que la real; col 2 `min-w-0` (trunca primero `tendencia de 12 meses`, después el nombre). El **monto nunca trunca ni envuelve** (`whitespace-nowrap`), `≈` pegado. El placeholder de 32px de la col 5 en **todos** los anchos.

**8.2 El popover.** Con tres bloques puede superar el alto del viewport y dejar la banda fuera de pantalla. **Columna acotada**:

- `max-height: min(560px, calc(100dvh - 24px))`, `display:flex; flex-direction:column`.
- **Bloque tipo** y **banda Simulación**: `shrink-0`.
- **Bloque categorías**: única región flexible — `flex-1 min-h-0 overflow-y-auto`, `min-height: 120px`.
- **La lista de activas es la segunda región compresible; su `max-h-[176px]` es TECHO, no piso.** Si no alcanza el alto, **cede primero esa lista** antes de empujar al bloque de categorías por debajo de 120px. Botón y nota general **nunca** entran en ese carril.
- **Anclaje:** sin alto suficiente bajo el disparador, el popover **abre hacia arriba** (mecanismo `openUpward` del `KebabMenu`). Requisito para `SectionFilterPanel`.
- Ancho **260px**, anclado a la derecha del disparador.

**8.3 Los dos modales.** `ModalShell variant="dialog"`: `max-h calc(100dvh − 48px)`, cuerpo scrolleable, footer pineado. El de **§3 es el alto**: verificar en viewport bajo.

**8.3.1 El selector múltiple en pantalla chica (`< --bp-wide`, hasta el piso del régimen de app).**

- **Botón contador:** `whitespace-nowrap` + `min-w-[164px]`; **nunca trunca ni envuelve**. A **392px de contenido** el par entra en una fila; si no, el footer **envuelve** con el primario abajo a la derecha.
- **Caja de resumen:** ancho completo, **envuelve** a 2–3 líneas.
- **Error por fila:** **baja entero a una segunda línea**; nunca trunca. Igual "Simulación creada.".
- **Mensaje de elegibilidad y empty por causa:** ancho completo, envuelven; el empty conserva su caja dashed.
- **Checkbox:** 16px fijo, `shrink-0`; target = la fila entera (`min-h-[38px]`).

**8.3.2 Los cuatro invariantes en los elementos del modal.**

1. *Sin scroll horizontal del `body`:* `max-w-[440px]` capeado; solo el botón del footer tiene ancho mínimo (`164px`).
2. *Modales completos y scrolleables:* con la caja de resumen el cuerpo scrollea y el footer queda pineado.
3. *Ninguna acción inalcanzable:* confirmar y cancelar en el footer pineado; las fallidas quedan **tildadas**.
4. *Superficies anchas:* la lista de categorías es la única región flexible.

**8.4 Línea de composición (§5.2), nota (§6.2) y líneas de la banda (§2, §4).** Texto que **envuelve**; sin truncado ni ancho mínimo. La línea de tramo ocupa el ancho de la banda (236px útiles) y envuelve en su variante larga; el **nombre de la categoría** es lo único que trunca en la línea 1.

**Los cuatro invariantes:**

1. *Sin scroll horizontal del `body`:* la fila simulada no agrega ancho mínimo; el popover es de ancho fijo portaleado; las líneas envuelven. A 392px de contenido la fila se lee con la identidad truncada y el monto entero.
2. *Modales completos y scrolleables:* `ModalShell variant="dialog"`.
3. *Ninguna acción inalcanzable:* banda `shrink-0`; el popover se acota y se invierte de anclaje.
4. *Superficies anchas:* las dos listas del popover, cada una con su carril.

### 9. Agregados más allá del brief — estado

1. **Línea de composición bajo los totales (§5.2)** y **glifo en el subtotal (§5.1)** — vigentes en la UI.
2. **Nota de simulación pausada en el listado (§6.2)** — vigente en la UI.
3. **Nota de horizonte en la banda y bajada del modal (§2, §3)** — vigente.
4. **Copy de la feature** — vigente; señal de documentación: espejarlo en `screens.md`.
5. **Segmento `· tendencia de 12 meses` (§1.2)** — vigente.
6. **Variante `· resto de la tendencia de 12 meses`** — **rechazada por el usuario**; sin flag "hubo descuento" en el DTO.
7. **Caja de resumen del fallo parcial (§3.7 c)** — vigente.
8. **Contador dentro del rótulo del botón de confirmación (§3.5)** — vigente.
9. **Condición y copy del chip "Simulados" de `/reportes`** (`simulados-en-cards.md` §1.3) — vigente.
10. **Mensaje único de elegibilidad (§3.1b)** — vigente; incluye la segunda causa ("que todavía no estás simulando").
11. **Estados vacíos por causa (§3.8)** — vigente.
12. **Línea de tramo por simulación (§4)** — vigente; cada `SimulationDto` trae su tramo (`startMonth`/`effectiveStartMonth`/`endMonth`), sin horizonte único a nivel respuesta. La pertenencia de un mes al horizonte se evalúa contra el tramo de **cada** simulación.
13. **Desenlace "Simulación creada." por fila (§3.4)** — vigente.
14. **Extender el tramo (§4.1)** — vigente (contrato `PATCH /simulations/:id/extend`).

**9.2 Inventario de copy vigente:**

| Dónde | Copy |
|---|---|
| Bajada del modal, oración 2 (§3.1) | **"Alcanza desde {Mes inicio} hasta {Mes fin}."** — `{Mes inicio}` = `max(mes visualizado, mes en curso)` |
| Bajada del modal, oraciones 1 y 3 (§3.1) | la 3ª, la del remanente, es intocable |
| Banda sin activas (§2) | **"Proyecta categorías desde el mes que estás viendo."** |
| Nota general de la banda (§2) | **"Cada simulación proyecta desde el mes en que la creaste."** |
| Tramo por fila de la lista de activas (§4) | **"Proyecta hasta {mes} {año}."** · si todavía no arrancó: **"Proyecta de {mes} {año} a {mes} {año}."** |
| Mensaje de elegibilidad del modal (§3.1b) | **"Solo aparecen las categorías con 3 o más meses de datos que todavía no estás simulando."** |
| Empty del modal (§3.8) | **cuatro copys por causa** — ver la tabla de §3.8 |
| Desenlace de fila creada (§3.4) | **"Simulación creada."** |
| Consecuencia del borrado (§4) | **"…dejan de aparecer en los meses que alcanza, y los totales…"** |
| Sublínea de la fila (§1.2) | **"tendencia de 12 meses"** — texto único, sin variante |
| Motivo de año del chip "Simulados" de `/reportes` | **"{Año} ya pasó. Las simulaciones no alcanzan meses pasados."** |
| Disparador de extender, línea 2 de la fila (§4.1) | **"{tramo o nota de pausa existente} Extender ⌄"** — con un espacio, sin `·` |
| Opciones de extender (§4.1) | **"1 mes · 3 meses · 6 meses · 12 meses"** |
| Extender en vuelo (§4.1) | **"Extendiendo…"** |
| Toast de extender (§4.1) | Éxito: **"Simulación extendida."** · Error: **"No se pudo extender la simulación. Intentá de nuevo."** |

**Helpers de copy** (`frontend/src/lib/simulations.ts` — el frontend no inventa ninguna cadena):

- `formatHorizonReach(startMonth, endMonth)` → *"Alcanza desde {Mes inicio} hasta {Mes fin}."*
- `formatHorizonBandNote()` → *"Cada simulación proyecta desde el mes en que la creaste."* (constante)
- `formatSimulationSpan(startMonth, endMonth, currentMonth)` → si `startMonth <= currentMonth`: *"Proyecta hasta {mes} {año}."*; si no: *"Proyecta de {mes} {año} a {mes} {año}."*
- `formatEligibilityNote()` → *"Solo aparecen las categorías con 3 o más meses de datos que todavía no estás simulando."* (constante)
- Empty del selector (§3.8): **cuatro pares de líneas** por causa (constantes o `formatCandidatesEmpty(cause)`); **nunca** concatenando fragmentos.
- `formatSimulateCta(n)` → `0` → *"Simular"* · `1` → *"Simular 1 categoría"* · `n` → *"Simular {n} categorías"*
- `formatBatchSuccessToast(n)` → `1` → *"Simulación creada."* · `n` → *"{n} simulaciones creadas."*
- `formatBatchPartialToast(k, n)` → `k=1` → *"Se creó 1 de {n} simulaciones."* · `k>1` → *"Se crearon {k} de {n} simulaciones."*
- `formatBatchPartialSummary(k, n)` → `k=1` → *"Se creó 1 de {n}. Las que siguen tildadas no se pudieron crear — el motivo está en cada fila."* · `k>1` → *"Se crearon {k} de {n}. …"*
- *"tendencia de 12 meses"* es una constante.
- `formatMinDataMotive` (solo §6.1), `formatSubtotalSimulatedLabel`, `formatTotalsSimulatedLine`, `formatPausedListNote`.
- `formatExtendSuccessToast()` → *"Simulación extendida."* (constante). Las cuatro opciones y el toast de error son **constantes literales**.

### 10. Reglas duras reafirmadas

- **Regla dura 1:** el simulado usa los semánticos para lo mismo que un real — dirección del ícono y color del monto según su **tipo derivado** (RN-028). El borde punteado usa el token pleno (`--expense`/`--income`) porque comunica **ese tipo**. Chips "Simulado" y "Sin datos" y las notas son **neutros**. El rojo del botón de eliminar es cromo de acción destructiva. En el fallo parcial, el **rojo** aparece solo en los **mensajes de error por fila** (`--expense-ink`); el **ámbar** solo en el **tick del toast `warning`**; la **caja de resumen es neutra**.
- **Regla dura 2:** índigo en el **checkbox tildado**, el botón primario, los focus rings y el punto indicador del disparador (sin cambiar de significado). El contador del botón es texto dentro del botón, no una cifra teñida.
- **Regla dura 3:** monto simulado en mono tabular `tnum`, mismo tamaño y peso que el real, con el `≈` **dentro** del mismo span. Ninguna cifra trunca.
- **Regla dura 4:** tokens theme-aware. Verificar en oscuro el **borde punteado** sobre `--panel`.
- **Extender (§4.1)** sin excepciones nuevas: neutro, índigo solo como foco, sin cifras de dinero.

### Checklist de aceptación visual — Simulación de categoría

*Fila simulada (mes dentro del horizonte DE SU SIMULACIÓN — el mes en curso incluido cuando es su arranque efectivo —, sección Únicos):*
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
- [ ] **Meses pasados: ninguna fila simulada, nunca.** Meses **fuera del horizonte de esa simulación**: tampoco — ni después de su fin, ni **antes de su arranque** (simulación creada parada en un mes futuro: el mes en curso **no** muestra su fila).

*Fila simulada en el MES EN CURSO y remanente:*
- [ ] Parado en el **mes en curso**, con una simulación **creada desde ese mismo mes** sobre una categoría **sin** únicos reales cargados: aparece la fila simulada, **idéntica en tratamiento** a la de un mes futuro (caja punteada, chip "Simulado", `≈`, sin kebab, sin hover) y la sublínea termina en **"· tendencia de 12 meses"**.
- [ ] Misma categoría, **con** un único real ya cargado ese mes: el monto simulado es **menor** (es el remanente) y la sublínea termina **igual, en "· tendencia de 12 meses"**. Los dos ítems —el real y el simulado— conviven en Únicos.
- [ ] Cargar un nuevo único real de esa categoría **baja** el monto simulado; cargar hasta alcanzar o pasar la proyección hace **desaparecer** la fila simulada (remanente 0 o invertido), sin dejar hueco ni fila en `$0`.
- [ ] **La sublínea NO tiene variantes:** en ningún mes, con o sin descuento, aparece el texto "resto de la tendencia…" ni ninguna otra formulación distinta de **"· tendencia de 12 meses"**.
- [ ] La fila del mes en curso **no** tiene chip extra, ni color distinto, ni nota al pie propia respecto de la de un mes futuro; una fila con remanente descontado es **indistinguible** de una con la proyección entera.
- [ ] Con la sublínea apretada, "tendencia de 12 meses" **trunca primero** (antes que el nombre de categoría).
- [ ] **Cero-impacto intacto:** un mes en curso **sin** simulaciones activas se ve **exactamente** como sin la feature (sin fila, sin glifo de subtotal, sin línea de composición, mismo espaciado).

*Popover de Únicos:*
- [ ] La banda **"Simulación"** está al pie, con **fondo recesado** (`--panel-2`) y separada del bloque de categorías por un divisor **más fuerte** que el interno.
- [ ] La banda es visible **al abrir el popover, sin scrollear**; scrollear la lista de categorías **no** la mueve.
- [ ] El botón **"Simular categoría"** (glifo `ChartSpline`) ocupa el ancho de la banda y está presente **aunque no haya ninguna simulación** (con la línea **"Proyecta categorías desde el mes que estás viendo."** debajo — **sin** "futuros" y **sin** "este mes"). El botón **nunca se deshabilita**, tampoco cuando no queda nada para simular.
- [ ] Con simulaciones activas: lista debajo del botón con `● color + nombre` y botón de basura por fila, y al pie la nota general **"Cada simulación proyecta desde el mes en que la creaste."** — que **no nombra ningún mes**.
- [ ] **Cada fila de la lista lleva su propio tramo** en una segunda línea 11.5px `--muted`: **"Proyecta hasta {mes} {año}."**. Con **dos simulaciones creadas desde meses distintos**, las dos filas muestran **fechas distintas** y ninguna nota general las contradice.
- [ ] Una simulación **creada parada en un mes futuro** muestra la variante larga: **"Proyecta de {mes} {año} a {mes} {año}."**, con el mes de arranque **posterior** al mes en curso.
- [ ] Una simulación **pausada** muestra la nota de pausa (§6.1) **y no** la línea de tramo (nunca las dos).
- [ ] Con **más de 4 activas** la lista scrollea dentro de sí y el botón y la nota general siguen a la vista.
- [ ] Los popovers de **Fijos** y **Cuotas** **no tienen banda de simulación**.
- [ ] Tener una simulación activa **no** enciende el punto `--accent` del disparador (ese punto sigue significando solo "sección filtrada").
- [ ] Abrir el modal (crear o eliminar) **cierra el popover**; nunca quedan los dos overlays a la vez.

*Modal "Simular categoría" — selección múltiple:*
- [ ] Título **"Simular categoría"** (en singular); cierra con **✕ y `Esc`**, el clic en el scrim **no** cierra.
- [ ] La **bajada** tiene **tres oraciones** (ni una más) y dice: proyección desde los últimos 12 meses · **"Alcanza desde {Mes inicio} hasta {Mes fin}."** con **los dos meses nombrados** · **"En cada mes se simula solo lo que falta para llegar a lo proyectado."** Ninguna dice "meses futuros" **ni "este mes"**. No debe faltar la tercera oración.
- [ ] Abriendo el modal parado en un **mes futuro** (ej. octubre estando en septiembre), la bajada dice **"desde octubre …"**; parado en un **mes pasado**, dice **desde el mes en curso** — nunca un mes que ya pasó.
- [ ] El control de cada fila es un **cuadrado ~16px con esquinas apenas redondeadas**, **no** un círculo. Tildado: **relleno índigo con tick blanco**. Vacío: contorno gris sobre fondo de panel.
- [ ] **Se pueden tildar varias a la vez:** tildar la segunda **no destilda** la primera. La fila tildada queda además con **fondo recesado** (`--panel-2`).
- [ ] **No existe ningún control "Todas" / "Ninguna" / "Seleccionar todas"** en este modal.
- [ ] **Teclado:** `Tab` recorre **una fila habilitada por vez** (no es una sola parada con flechas); **Espacio** y **Enter** tildan/destildan; el **anillo de foco índigo rodea la fila entera**, no el cuadradito.
- [ ] **La lista muestra SOLO categorías simulables:** una categoría con **menos de 3 meses con datos** y una **ya simulada** **no aparecen** (ni tildables, ni deshabilitadas, ni en gris — no están). Al abrir, **ninguna fila está deshabilitada** y **ninguna fila tiene texto a la derecha**.
- [ ] Lista en **orden de catálogo** (las que quedan, en su orden relativo original).
- [ ] Debajo de la lista, la línea 12px `--muted` **"Solo aparecen las categorías con 3 o más meses de datos que todavía no estás simulando."** — sin glifo, sin caja, y **no** aparece cuando la lista está vacía.
- [ ] **Vacío por causa:** sin categorías activas → *"No tenés categorías activas."*; ninguna con 3 meses → *"Ninguna categoría llega a 3 meses con datos."* + *"Cuando alguna los acumule, va a aparecer acá."*; todas las elegibles ya simuladas → *"Ya estás simulando todas las categorías que se pueden simular."* + *"Podés verlas y eliminarlas en el filtro de Únicos."*; mixto → *"No queda ninguna categoría para simular."* + su segunda línea. **Siempre en la caja dashed**, nunca un texto pelado y nunca el copy genérico en un caso que tiene el suyo.
- [ ] Con la lista vacía, el botón primario está **deshabilitado** y dice **"Simular"**.
- [ ] **Rótulo del botón primario:** con 0 seleccionadas dice **"Simular"** y está **deshabilitado**; con 1, **"Simular 1 categoría"** (nunca "1 categorías"); con N, **"Simular {N} categorías"**; en vuelo, **"Simulando…"** deshabilitado (y `Cancelar` también).
- [ ] El botón **no cambia de ancho** al tildar/destildar dentro del rango normal (reserva de ancho mínimo) y su rótulo **nunca trunca ni envuelve**.
- [ ] El número del botón está en la **misma fuente del botón** (no monoespaciado).
- [ ] Con la lista scrolleada, el botón y su contador **siguen visibles** (footer pineado).

*Modal — desenlaces del batch:*
- [ ] **Éxito total con 1:** cierra + toast verde **"Simulación creada."** **Con N ≥ 2:** cierra + toast verde **"{N} simulaciones creadas."**
- [ ] Al confirmar aparece **toast de éxito aunque el mes visualizado no cambie visualmente** (probarlo parado en un **mes pasado**).
- [ ] **Fallo total (0 de N):** toast **rojo**, el modal **sigue abierto** con **la selección intacta**, el botón vuelve a su rótulo con contador, y **no aparece** la caja de resumen.
- [ ] **Fallo parcial (K de N, 1 ≤ K < N): el modal QUEDA ABIERTO.**
  - [ ] Toast **ámbar (warning)**: **"Se crearon {K} de {N} simulaciones."** (con K = 1: **"Se creó 1 de {N} simulaciones."**).
  - [ ] Aparece una **caja recesada neutra** (fondo `--panel-2`, borde, **sin rojo**) entre la bajada y la lista: *"Se crearon {K} de {N}. Las que siguen tildadas no se pudieron crear — el motivo está en cada fila."*
  - [ ] Las **K creadas** quedan en **su misma posición** (no se van al fondo, **no desaparecen** aunque ya no sean simulables), **destildadas** y **deshabilitadas**, con el texto gris **"Simulación creada."** — **nunca** "Ya la estás simulando".
  - [ ] Las **(N−K) fallidas** **siguen tildadas** y muestran su **mensaje de error en rojo** en el slot de desenlace de la fila.
  - [ ] **Ninguna fila desaparece de la lista mientras el modal está abierto.** Al cerrar y volver a abrir, las K creadas **ya no están** (la lista se recalcula).
  - [ ] El botón dice ahora **"Simular {N−K} categorías"** y **reintentar funciona de un clic**, sin volver a tildar nada.
  - [ ] La caja de resumen y los errores de fila **no desaparecen** al tildar o destildar otra fila (sin salto de layout); el error de **una fila que se destilda** sí se va con ella. El **"Simulación creada."** de una fila creada **no se limpia** en los intentos siguientes.
  - [ ] `Cancelar` cierra el modal; **las K creadas siguen creadas** (aparecen en la banda del popover, con su tramo).
- [ ] **El rojo del slot es exclusivo del error del último intento**; el desenlace neutro ("Simulación creada.") nunca se pinta de rojo. **Ninguna fila muestra un motivo de exclusión** ("Ya la estás simulando" / "Necesita 3 meses…").

*Modal — contención en pantalla chica:*
- [ ] A **640px** de viewport (≈392px de contenido con el sidebar abierto): sin scroll horizontal del `body`; `Cancelar` + botón contador entran en el footer; un **mensaje de error largo** de una fila **baja entero a segunda línea** en vez de truncar.
- [ ] En **viewport bajo**, con la caja de resumen montada y la lista larga: el cuerpo **scrollea**, el **footer queda pineado**, la caja de resumen se alcanza scrolleando hacia arriba y la **nota de elegibilidad** scrolleando hacia abajo (queda **debajo** de la última fila, nunca pineada ni cortada).
- [ ] La **segunda línea del empty** envuelve entera a 2–3 líneas dentro de la caja dashed, sin truncar.
- [ ] Todo lo anterior se verifica igual en **modo claro y oscuro**.

*Eliminar simulación:*
- [ ] El botón de basura de la fila pasa a **rojo sobre fondo rojo suave** en hover, y tiene `aria-label` con el nombre de la categoría.
- [ ] La confirmación es un diálogo con **caja de identidad** y nota de consecuencia, footer `Cancelar` + **`Eliminar` rojo**.
- [ ] La nota de consecuencia dice **"…dejan de aparecer en los meses que alcanza…"** (no "en los meses futuros" ni "en este mes y en los siguientes").
- [ ] Al confirmar: toast, la fila desaparece de la banda y **las filas simuladas de esa categoría desaparecen de todos los meses de su tramo**, con totales recalculados.

*Extender el tramo:*
- [ ] El link **"Extender"** (con `ChevronDown` 11px) aparece **únicamente** en la fila cuya simulación tiene `endMonth` igual al **mes que se está viendo** en `/mes` — nunca en las demás filas, aunque estén activas. Cambiar de mes visualizado mueve el disparador a la fila que corresponda (o lo hace desaparecer si ninguna coincide).
- [ ] En una simulación **ya arrancada**, la línea 2 dice **"Proyecta hasta {mes} {año}. Extender ⌄"**; en una que **todavía no arrancó**, **"Proyecta de {mes} {año} a {mes} {año}. Extender ⌄"**; en una **pausada**, **"Necesita 3 meses con datos (tiene {N}). No proyecta. Extender ⌄"** — siempre agregado al final de la oración existente, con un espacio, **sin `·`**.
- [ ] Clic en "Extender" reemplaza el contenido de la línea 2 por **"1 mes · 3 meses · 6 meses · 12 meses"**, cuatro valores clickeables separados por `·` en `--faint`; ninguno rompe entre el número y "mes(es)". El foco pasa al primero.
- [ ] **Nunca hay dos filas "eligiendo" a la vez:** clickear "Extender" en otra fila colapsa la primera.
- [ ] **Escape** colapsa la elección sin cerrar el popover (el popover se cierra con un segundo `Escape`, cuando ya no hay ninguna fila eligiendo). **Click afuera de las 4 opciones** (en cualquier punto del popover) también colapsa. **No hay ningún botón `×` dedicado** para cancelar.
- [ ] Elegir un valor dispara la extensión **sin confirmación**: la línea 2 pasa a **"Extendiendo…"** (texto plano, sin spinner) y el botón **Eliminar de esa misma fila** se deshabilita mientras dura; las demás filas siguen operables con normalidad.
- [ ] **Éxito:** `toast.success` **"Simulación extendida."**, el popover **no se cierra**, y la fila —al recalcular su `endMonth`— **deja de mostrar el disparador** en ese mismo mes visualizado, sin ninguna marca de "recién extendida".
- [ ] **Error:** `toast.error` **"No se pudo extender la simulación. Intentá de nuevo."**, la línea 2 **vuelve a las cuatro opciones** (no al link "Extender"), lista para reintentar de un clic.
- [ ] En un mes **ya vencido** (navegando hacia atrás hasta el `endMonth` de una simulación cuyo fin ya pasó), las **cuatro opciones se ofrecen igual**, ninguna oculta ni deshabilitada — aunque el resultado de alguna siga cayendo en el pasado. **En ningún caso aparece un cartel o nota de "vencida"/"terminada".**
- [ ] En una simulación **pausada**, extender **no cambia** el chip "Sin datos" ni el resto de su línea 1; al resolverse (éxito, error o cancelar la elección), la nota de pausa **vuelve intacta**.
- [ ] El link "Extender" y los cuatro valores son **enteramente neutros** (`--muted` reposo, `--ink-2` + subrayado en hover, foco `--accent-soft`) — **sin verde, sin rojo, sin índigo** salvo el anillo de foco.
- [ ] El `max-h-[176px]` de la lista de activas **no cambia**; el revelado ocupa el mismo carril de línea 2 que ya usaba el tramo o la nota de pausa.
- [ ] A **260px de popover, en todo el rango de viewport** (el popover no tiene disposición compacta): las cuatro opciones entran en una línea; si envuelven, envuelven **entre valores**, nunca partiendo "12 meses". Se verifica igual en **modo claro y oscuro**.

*Composición de totales:*
- [ ] Con ≥1 fila simulada visible, la cabecera de **Únicos** muestra el glifo `ChartSpline` `--muted` **pegado a la izquierda del subtotal** (y a la derecha de una marca de límite, si la hubiera), con `title` explicando el conteo.
- [ ] Bajo la grilla de totales aparece la línea **"Los totales incluyen {N} movimientos simulados."** (singular con su propia frase, **nunca "1 movimientos"**).
- [ ] **Ninguna cifra —de sección, de card o de fila— cambia de color, de peso o de opacidad** por incluir simulados.
- [ ] **Cero-impacto:** en un mes **sin** simulados (o con el filtro que los excluye), **no hay glifo ni línea**, y el espaciado entre la grilla de totales y el listado es **idéntico** al de un mes sin la feature.

*Simulación pausada:*
- [ ] En la banda, la simulación sin datos suficientes muestra el chip neutro **"Sin datos"**, el nombre en `--muted` y la línea **"Necesita 3 meses con datos (tiene {N}). No proyecta."** — **sin ámbar y sin rojo**.
- [ ] Su **botón de eliminar sigue disponible**.
- [ ] La **nota al pie del listado de Únicos** ("{N} simulaciones no están proyectando…") aparece **también parado en el mes en curso**, no solo en meses futuros. En un mes **pasado**, o en un mes **que el tramo de esa simulación no alcanza**, no aparece — y el `{N}` **cuenta solo las pausadas cuyo tramo alcanza el mes visualizado**.
- [ ] En un mes futuro dentro del horizonte, al pie del listado de Únicos aparece la nota `Info` **"Una simulación no está proyectando: le faltan meses con datos."** (plural con `{N}` si son varias), también cuando la sección está **vacía** (debajo del empty dashed).
- [ ] La nota **no es clickeable** y no ofrece link.

*Fuera del horizonte:*
- [ ] Un mes que **ninguna simulación alcanza** —más allá del fin de todas, o **anterior al arranque** de una creada desde un mes futuro— se ve **exactamente igual que sin la feature**: sin filas simuladas, **sin nota, sin glifo, sin línea de composición**.

*Contención:*
- [ ] A **640px** (y ~392px de contenido con el sidebar abierto): sin scroll horizontal del `body`; en la fila simulada trunca la identidad y **el monto se lee entero, con su `≈`**.
- [ ] En viewport **bajo** (ej. 700px de alto), el popover de Únicos **no se corta**: se acota al viewport, la lista de categorías scrollea y la **banda de simulación sigue visible y accionable**; si no entra hacia abajo, **abre hacia arriba**.
- [ ] Con **más de 4 simulaciones activas** (filas de dos líneas), la lista de la banda scrollea dentro de sí y el botón "Simular categoría" y la nota general siguen a la vista. Con el popover muy apretado de alto, **lo que se achica es la lista de activas**, y el bloque de categorías **nunca** baja de sus 120px.
- [ ] El modal del selector, con **muchas categorías**, muestra el footer **pineado** y scrollea solo la lista.
- [ ] Todo lo anterior se verifica igual en **modo claro y oscuro** — con atención al **borde punteado** de la caja del ícono, que debe leerse con claridad en los dos.
