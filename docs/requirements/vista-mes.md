# 3.7 Módulo: Vista del mes

> Parte de los requerimientos funcionales de Control. Índice e ID → archivo: `docs/requirements.md`. Contrato de `GET /movements`: `docs/data-model/movimientos.md`.

La vista del mes muestra todos los movimientos del mes seleccionado (únicos, fijos activos y cuotas) con sus totales.

---

## RF-VM-001 — Listar movimientos del mes

| Campo | Detalle |
|---|---|
| **Descripción** | El sistema muestra todos los movimientos del mes activo: transacciones únicas, fijos activos y cuotas que caen en ese mes. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] Se listan las transacciones únicas cuya `date` esté dentro del mes activo.
- [ ] Se listan los fijos donde `startMonth <= mesActivo` y (`deletedFrom` es null o `deletedFrom > mesActivo`).
- [ ] Se listan las cuotas donde `startMonth <= mesActivo < startMonth + totalInstallments meses`.
- [ ] Cada fila muestra **lo glanceable**: tipo (gasto/ingreso), nombre, categoría, frecuencia (fijos), un **discriminador** (fecha del único / "Cuota X/N"), monto y los estados (Anulado, marcas de límite). El **detalle secundario** (método de pago, moneda/cotización, débito automático, hora del único, vigencia del fijo, plan de la cuota, fórmula del calculado) **no** vive en la fila: se consulta en la **card de detalle** (RF-VM-007).
- [ ] La lista está agrupada por tipo en tres secciones separadas y rotuladas, **Únicos**, **Fijos**, **Cuotas** (orden default; reordenable por el usuario, RF-VM-005). Dentro de cada sección, los movimientos se ordenan por **monto descendente** (`amountCents` DESC: el monto más alto primero, por magnitud, sin distinguir gasto de ingreso). Ante montos iguales, el desempate estable es por sección: Únicos por instante (fecha y hora) descendente; Fijos por fecha de creación descendente; Cuotas por identificador ascendente. El reordenamiento de secciones entre sí (RF-VM-005) aplica **solo a las secciones**, nunca a los ítems dentro de una sección.
- [ ] **Orden de la sección Únicos — alternable por el usuario.** La sección **Únicos** permite alternar el orden de sus movimientos entre **por monto** (descendente, default) y **por fecha** (más reciente primero; desempate por monto descendente). El control vive en la cabecera de la sección Únicos. El orden elegido se **persiste por usuario** (clave `unicosSort`, default `"amount"`; shape en `docs/data-model/preferencias.md`). Aplica **solo a Únicos**: Fijos y Cuotas no tienen fecha y conservan el orden por monto descendente. El orden de los ítems en Fijos y Cuotas **no** es alterable por el usuario.
- [ ] Las **tres secciones se muestran siempre**, aunque estén vacías. Una sección sin movimientos muestra su cabecera completa (rótulo, contador en 0, subtotal en $0) y un mensaje de estado vacío inline propio ("Sin movimientos únicos" / "Sin fijos" / "Sin cuotas").
- [ ] Si no hay movimientos en el mes, no se muestra un mensaje de estado vacío global: las tres secciones aparecen vacías con su empty inline propio y los totales del mes en cero, sin error.

---

## RF-VM-002 — Totales del mes

| Campo | Detalle |
|---|---|
| **Descripción** | La vista del mes muestra el total de gastos, total de ingresos y balance del mes activo. |
| **Actor** | Sistema |
| **Prioridad** | Alta |
| **Precondiciones** | — |

**Criterios de aceptación:**
- [ ] Se muestra el total de gastos (suma de todos los movimientos `EXPENSE` del mes).
- [ ] Se muestra el total de ingresos (suma de todos los movimientos `INCOME` del mes).
- [ ] Se muestra el balance del mes (ingresos − gastos).
- [ ] El balance positivo y negativo son visualmente diferenciables.
- [ ] Los totales se actualizan inmediatamente al agregar, editar o eliminar un movimiento.
- [ ] Los totales suman **movimientos**, no categorías: un movimiento cuenta en los totales aunque su categoría haya sido eliminada (soft delete). Eliminar una categoría no afecta los totales (ver nota en RF-CAT-004).

---

## RF-VM-003 — Acceso a edición y eliminación desde la lista

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede iniciar la edición o eliminación de cualquier movimiento directamente desde la lista del mes. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | Existe al menos un movimiento en la lista. |

**Criterios de aceptación:**
- [ ] Cada ítem de la lista tiene acceso a las acciones editar y eliminar.
- [ ] Al seleccionar editar, se abre el formulario correspondiente (RF-MU-002, RF-MF-003 o RF-MC-003 según el tipo).
- [ ] Al seleccionar eliminar, se ejecuta el flujo correspondiente (RF-MU-003, RF-MF-004 o RF-MC-002 según el tipo).

---

## RF-VM-004 — Navegación entre meses

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede navegar al mes anterior o siguiente desde la vista del mes, y saltar directamente a cualquier mes/año. El dashboard no navega meses: siempre muestra el mes actual (RF-DASH-001). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario está en la vista del mes. |

La navegación de meses es **ilimitada**: no hay rango de año (sin mínimo ni máximo de negocio), por lo que ningún control de navegación se deshabilita por tope. Además del avance secuencial ±1 mes, el rótulo de período actúa como **disparador de salto rápido**: abre un selector de dos ruedas (mes y año) para saltar a cualquier mes/año; al confirmar navega con el mismo mecanismo que el avance secuencial. El único feedback de validación del selector es el botón "Ir" deshabilitado hasta que el año tenga 4 dígitos. El disparador es accionable también durante el modo orden de secciones (RF-VM-005). El detalle visual del selector vive en `docs/design.md`.

Existe además un **acceso directo al mes en curso** disponible desde cualquier mes navegado. Se muestra **únicamente cuando el mes visualizado no es el mes en curso**; estando en el mes en curso no se renderiza. Lleva un indicador de dirección que se **deriva de la comparación entre el mes visualizado y el mes en curso**: apunta hacia adelante cuando el mes visualizado es anterior al actual y hacia atrás cuando es posterior, coincidiendo con el control de avance secuencial que llevaría al mes en curso. Es navegación pura del frontend: no involucra el modelo de datos ni ningún contrato. El detalle visual vive en `docs/design.md`.

**Criterios de aceptación:**
- [ ] Existen controles para avanzar al mes siguiente y retroceder al mes anterior.
- [ ] El rótulo de período abre un selector de dos ruedas que permite saltar a cualquier mes/año; al confirmar, la lista y los totales reflejan el mes elegido.
- [ ] La navegación no tiene tope de año: ningún control se deshabilita por rango. El botón "Ir" del selector se deshabilita solo mientras el año no tenga 4 dígitos.
- [ ] La lista y los totales se actualizan para reflejar el mes seleccionado.
- [ ] Se muestra el nombre del mes y el año del mes activo.
- [ ] Existe un acceso directo al mes en curso que se muestra únicamente cuando el mes visualizado no es el mes en curso; su indicador de dirección se deriva de comparar el mes visualizado con el mes en curso.

---

## RF-VM-005 — Colapsar y reordenar las secciones de la vista del mes

| Campo | Detalle |
|---|---|
| **Descripción** | Las tres secciones de la vista del mes (Únicos, Fijos, Cuotas) son colapsables tipo acordeón y reordenables entre sí. El estado colapsado/expandido y el orden de las secciones se persisten por usuario. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario está en la vista del mes. |

**Flujo principal:**
1. Cada sección puede expandirse o colapsarse individualmente (acordeón): toda la cabecera de grupo actúa como disclosure.
2. El usuario activa el **"modo orden"** desde el header ("Ordenar secciones"); en ese modo arrastra las secciones para reordenarlas entre sí.
3. El usuario sale del modo orden ("Listo"). El nuevo orden ya quedó aplicado en vivo.

**Criterios de aceptación:**
- [ ] Cada sección expande/colapsa de forma individual; la cabecera completa de la sección es el control de disclosure.
- [ ] El usuario puede reordenar **solo las secciones entre sí** mediante drag, dentro de un **modo orden** explícito que se activa/desactiva con un botón del header ("Ordenar secciones" / "Listo").
- [ ] El modo orden reordena **solo las secciones entre sí**, nunca los ítems dentro de una sección: el drag no alcanza a los ítems. El orden de los ítems sigue las reglas de RF-VM-001 (monto descendente, con el orden alternable de Únicos de esa misma RF).
- [ ] El estado colapsado/expandido de cada sección y el orden de las secciones se **persisten por usuario** vía las preferencias; sobreviven a la navegación y al cierre de sesión. Shape de la clave de preferencias en `docs/data-model/preferencias.md` (`monthSections`).
- [ ] En modo orden, el botón "+ Nuevo movimiento" se deshabilita y el colapsar/expandir queda suspendido (la cabecera arrastra en lugar de colapsar). No hay acción de "cancelar": el orden se aplica en vivo.

---

## RF-VM-006 — Filtros por listado de la vista del mes

| Campo | Detalle |
|---|---|
| **Descripción** | Cada una de las tres secciones de la vista del mes (Únicos, Fijos, Cuotas) ofrece **sus propios** controles de filtro: un **filtro de tipo** (Gasto / Ingreso / Ambos) y un **filtro de categoría**. Filtran solo su sección. Los **totales del mes** reflejan la suma de lo visible tras aplicar los filtros de las tres secciones. Es un estado **por pantalla** (no por mes): la selección se mantiene al navegar entre meses y se persiste por usuario. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario está en la vista del mes. |

**Flujo principal:**
1. Cada sección (Únicos / Fijos / Cuotas) expone su disparador de filtro con dos controles propios: **tipo** (Gasto / Ingreso / Ambos) y **categoría**.
2. El usuario filtra una sección por tipo y/o categoría.
3. La lista de esa sección, su **contador (pill)** y su **subtotal** se recalculan al instante para reflejar lo filtrado; los **totales del mes** se recalculan como la suma de lo visible en las tres secciones.

**Controles por sección:**
- **Tipo:** Gasto / Ingreso / **Ambos** (default Ambos). Restringe la sección al tipo elegido.
- **Categoría:** **tres estados** —**todas** (default, sin filtro), **subconjunto** (solo las tildadas), **ninguna** (todas destildadas → la sección queda vacía)—.

**Criterios de aceptación:**
- [ ] Cada sección tiene **dos controles propios e independientes**: filtro de tipo (Gasto/Ingreso/Ambos, default **Ambos**) y filtro de categoría (default **todas**). El filtro de una sección no afecta a las otras dos.
- [ ] El **pill contador** y el **subtotal** de cada sección reflejan **lo filtrado** en esa sección.
- [ ] Los **totales del mes** (RF-VM-002) son la **suma de lo visible** tras aplicar los filtros de las tres secciones.
- [ ] El estado de categoría **"ninguna"** (todas destildadas) deja esa sección **vacía** y sin aporte a los totales.
- [ ] Los controles de filtro **no se muestran en modo orden** (RF-VM-005).
- [ ] La selección **se mantiene al navegar entre meses** (es por pantalla, no por mes) y se **persiste por usuario** vía las preferencias, clave `monthListFilters` (shape en `docs/data-model/filtro-categorias.md`); sobrevive a la navegación y al cierre de sesión.
- [ ] **Relevancia del filtro de categoría:** el filtro de categoría de cada sección lista **solo las categorías presentes en los movimientos de esa sección** del mes (no el catálogo completo del usuario). Cada sección deriva su universo de categorías de sus propios movimientos.
- [ ] Con categoría "todas" (sin filtro) se muestran también movimientos cuya categoría fue eliminada (soft delete, RF-CAT-004 / RF-VM-002); con un subconjunto, solo entran las categorías seleccionadas.
- [ ] El filtro **no es global:** no afecta a otras pantallas (dashboard ni reportes tienen su propio estado de filtro, independiente de este).
- [ ] Sin `monthListFilters` guardado, cada lista arranca en su default (Ambos + todas). La preferencia deprecada `monthCategoryFilter` no se lee desde `/mes`.

**Notas:**
- El **filtrado es 100% en el frontend**: `/mes` trae todo el mes en una sola llamada y filtra cada lista en cliente; los totales del mes se recalculan en cliente sobre lo visible. El query param `categories` de `GET /movements` **no se usa desde `/mes`** (lo usa `/reportes`); ver `docs/data-model/filtro-categorias.md`.

---

## RF-VM-007 — Card de detalle de movimiento

| Campo | Detalle |
|---|---|
| **Descripción** | Al hacer clic en el **cuerpo** de una fila de la Vista del mes (`/mes`) se abre una **card de detalle read-only** del movimiento. Muestra los datos que la fila no muestra; no tiene acciones sobre el movimiento ni edita nada in-situ. La edición y demás acciones (incluida **Reabrir** un fijo terminado, RF-MF-008) viven en el **kebab (⋮)** de la fila. En un ítem **fijo** (no calculado), la card ofrece además una **vista evolución** del fijo (RF-VM-009): navegación interna de la card, no una acción sobre el movimiento. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe al menos un movimiento en la lista del mes. |

**Flujo principal:**
1. El usuario hace clic en el cuerpo de una fila (o la activa con Enter/Espacio).
2. El sistema abre la card de detalle del movimiento en modo **solo lectura**.
3. El usuario consulta los datos y cierra la card.

**Contenido de la card (read-only):** muestra el detalle que la fila deja fuera. Común a todos los tipos: nombre, monto convertido, **método de pago** (nombre + tipo; si es **Crédito**, además su **día de cierre** y su **día de cobro** — RF-PM-001), **moneda + cotización + monto original** cuando la moneda del ítem difiere de la default (cross-rate), **débito automático** (si aplica, RN-021), categoría y estado de anulación. Y por tipo:
- **Único:** la **fecha con hora** exacta del movimiento.
- **Fijo:** su **frecuencia** (RF-MF-006) y su **vigencia** (arranque + fin, RF-MF-007).
- **Cuota:** el **plan** (cuota N de M + mes de inicio del grupo) y el **total del plan** (RF-MC-005).
- **Calculado:** su **origen** y la **fórmula** completa con el resultado derivado (RF-MCALC-002/007).
- **Origen de calculados:** cuando el movimiento es **origen** de uno o más calculados, la card lista sus **derivados del mes** (nombre + monto), read-only. Es el **espejo** del bloque que muestra el "Origen" desde un calculado: la card es bidireccional origen ↔ derivados (RF-MCALC-007).

**Acciones disponibles:**
- **Cerrar** — la card se cierra con **✕**, con **Esc** y con **clic en el scrim** (fondo). La card no tiene footer de acción ni botón "Editar". Editar, anular, duplicar, crear movimiento calculado, reabrir y eliminar viven en el **kebab (⋮)** de la fila.
- **Ver evolución** (solo ítems **fijos** no calculados, RF-VM-009) — pasa a la vista evolución del fijo, que reemplaza el contenido de la card; desde ahí se vuelve a la vista de detalle. Es navegación interna: no actúa sobre el movimiento.

**Criterios de aceptación:**
- [ ] El clic en el **cuerpo** de la fila (o Enter/Espacio) abre la card; el clic en el **kebab (⋮)** abre su menú de acciones rápidas y **no** abre la card. El kebab concentra todas las acciones del movimiento (Editar / Anular-Des-anular / Duplicar / Crear movimiento calculado / Reabrir / Eliminar).
- [ ] La card es **solo lectura pura**: no tiene footer de acción ni botón "Editar"; sus únicos controles son cerrar y, en un fijo no calculado, el acceso a la vista evolución (RF-VM-009). No modifica el movimiento in-situ.
- [ ] La card **siempre abre en la vista de detalle**.
- [ ] La card muestra las filas de contenido definidas arriba, mostrando **solo las que aplican** al tipo y omitiendo las que no (ej.: método de pago solo si el movimiento tiene uno; cross-rate solo si la moneda del ítem difiere de la default).
- [ ] Si el movimiento es **origen** de calculados, la card lista sus **derivados del mes** (nombre + monto, read-only, no clickeable); si no tiene derivados, esa sección se omite.
- [ ] Para un método de pago de tipo **Crédito**, la card muestra su **día de cierre** y su **día de cobro**; para Débito/Efectivo esos datos no existen y no se muestran.
- [ ] La card cierra con ✕, Esc y clic en el scrim (en la vista evolución, Esc vuelve a la vista de detalle; RF-VM-009).
- [ ] La **vista de detalle no dispara una carga propia**: presenta el `MovementItem` que la lista del mes ya tiene en memoria; no tiene estados de carga, vacío ni error propios. La vista evolución sí carga y tiene sus propios estados (RF-VM-009).

**Notas:**
- La anatomía visual de la card, el reparto exacto fila/card y el comportamiento de apertura/cierre los define `control-design` (`docs/design.md`).

---

## RF-VM-008 — Duplicar un movimiento

| Campo | Detalle |
|---|---|
| **Descripción** | Desde el menú de acciones (kebab ⋮) de una fila de la Vista del mes (`/mes`), la acción **"Duplicar"** crea un movimiento **nuevo e independiente** precargado con los valores del original, editables antes de guardar. El duplicado **no queda vinculado** al original: es un alta común del tipo correspondiente. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe en el mes visualizado un movimiento **único, fijo o de cuotas** que **no** es calculado. |

**Flujo principal:**
1. El usuario abre el kebab (⋮) de un ítem y elige **"Duplicar"**.
2. El sistema abre el formulario de carga en **modo creación**, con el form del **tipo del original** y **sin los tabs** Único / Fijo / Cuotas, con los campos precargados.
3. El usuario ajusta lo que quiera: todos los campos precargados son editables y valen las mismas validaciones que cualquier alta de ese tipo.
4. El usuario confirma. Se crea un movimiento **nuevo**; el original queda intacto.

**Flujos alternativos:**
- *A1 — El usuario cancela:* no se crea nada y el original queda intacto.

**Valores precargados** — se copian **tal cual**, sin transformar:

| Tipo | Se precarga |
|---|---|
| **Único** | Tipo, monto, categoría, descripción y la **fecha y hora originales** del movimiento (no la fecha/hora actual). |
| **Fijo** | Tipo, monto, categoría, descripción, frecuencia y el **mes de inicio original** del fijo (no el mes visualizado ni el mes en curso). |
| **Cuota** | Monto por cuota, cantidad de cuotas, categoría, descripción y el **mes de inicio original** del grupo (no el mes visualizado ni el mes en curso). |
| **Comunes** | Moneda, **cotización del original**, método de pago y débito automático. |

La **descripción se copia idéntica**: no se le agrega sufijo ni marca alguna ("(copia)" u otro).

**Criterios de aceptación:**
- [ ] La acción **"Duplicar"** vive **únicamente** en el kebab (⋮) de la fila de `/mes`. La **card de detalle** (RF-VM-007) es read-only pura y **no** la ofrece.
- [ ] Está disponible en ítems **único, fijo y cuota** no calculados. Sobre un ítem **calculado** la acción **no aparece** — mismo gate que la acción de crear movimiento calculado (RF-MCALC-001): un calculado no puede ser origen de otro movimiento.
- [ ] El modal abre en **modo creación** con el form del tipo del original y **sin los tabs** de selección de tipo: el duplicado es siempre del mismo tipo que el original.
- [ ] Confirmar **crea un movimiento nuevo** y **no modifica el original**; no queda ningún vínculo entre ambos (a diferencia del calculado, RF-MCALC-004).
- [ ] Los valores se copian **sin transformar**, según la tabla de arriba: fecha y hora originales del único, mes de inicio original del fijo y de la cuota, y **descripción idéntica**.
- [ ] La cotización precargada es la **del original**, no la cotización de referencia del mes: la pre-carga automática de RF-CUR-003 **no pisa** el valor duplicado.
- [ ] Si el original **no tiene método de pago**, el duplicado arranca con el **método por defecto del usuario** para esa estructura (RF-PM-007), igual que cualquier alta en blanco.

---

## RF-VM-009 — Vista evolución de un fijo en la card de detalle

| Campo | Detalle |
|---|---|
| **Descripción** | La card de detalle (RF-VM-007) de un ítem **fijo** ofrece una **segunda vista, "evolución"**, que reemplaza el contenido de la card por el gráfico de montos de **ese fijo** a lo largo del tiempo. La vista monta la card de reporte `fixed-evolution` (RF-REP-013) acotada a **un solo fijo** (su cadena, `chainId`). Es navegación interna de la card: no edita ni actúa sobre el movimiento. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | La card de detalle está abierta sobre un ítem fijo (gasto o ingreso) no calculado. |

**Flujo principal:**
1. Desde la vista de detalle, el usuario activa el acceso **"Ver evolución"**.
2. La card reemplaza su contenido por la vista evolución: el gráfico de montos del fijo en el rango **1 año**.
3. El usuario puede cambiar el rango.
4. El usuario vuelve a la vista de detalle, o cierra la card.

**Alcance del acceso:**

| Ítem | Acceso a la vista evolución |
|---|---|
| Fijo de **gasto** o de **ingreso**, no calculado | Sí (habilitado o deshabilitado según el criterio de abajo) |
| Calculado (de fijo, de único o de cuota) | No se ofrece |
| Único, cuota, movimiento simulado | No se ofrece |

**Disponibilidad (criterio de ≥2 apariciones):**
- El acceso se muestra **habilitado** si la cadena del fijo tiene **al menos 2 apariciones graficables en toda su historia**, desde su arranque hasta el **mes en curso** inclusive (la card no grafica meses futuros, RF-REP-013). "Aparición graficable" es el mismo criterio de RF-REP-013 (mes con monto; no cuentan meses sin aparición por frecuencia, anulados, previos al alta ni posteriores a la baja).
- Con **menos de 2**, el acceso se muestra **deshabilitado**, con un **tooltip** que explica el motivo (copy en `docs/design.md`).
- El dato lo provee el backend en el ítem del mes (`MovementItem.evolutionAvailable`, `docs/data-model/movimientos.md`); el front no lo calcula.

**Contenido de la vista evolución:**
- El **nombre del fijo** queda visible arriba; el resto del contenido de la card se reemplaza.
- El gráfico de la card `fixed-evolution` (RF-REP-013) con **una sola línea**: la del fijo, en modo **montos**, en la **moneda default** del usuario. Todas las reglas de la línea y del rango de RF-REP-013 aplican igual (cadena recompuesta a través de los splits, ausencia = hueco, borde derecho = mes en curso, recorte del borde izquierdo contra el primer mes con aparición de **cualquier** fijo del usuario). Los meses del rango previos al alta del fijo son hueco.
- **Único control: el selector de rango**, con los mismos 8 rangos de meses corridos de RF-REP-013. **Default 1 año.** **No se persiste:** cada entrada a la vista evolución arranca en 1 año, también al volver a entrar dentro de la misma card abierta.
- **No** expone: selector de modo, selector de moneda, leyenda / selección de fijos, superficie de fijos excluidos, título editable, quitar card, refrescar (RF-REP-016) ni popover de límites (RF-LIM-005).
- **Volver al detalle** — al pie del contenido; regresa a la vista de detalle.

**Cierre y teclado:**

| Acción | Efecto |
|---|---|
| **Esc** | Vuelve a la vista de detalle. Con el selector de rango desplegado, el primer Esc solo lo cierra. |
| **✕** / clic en el scrim | Cierran la card. |

**Estados** (copys en `docs/design.md`):
- **Cargando** — el del canvas de la card `fixed-evolution`.
- **Error** — mensaje de error con **Reintentar**.
- **Vacío** — el fijo tiene ≥2 apariciones graficables en total pero **menos de 2 en el rango elegido**; sugiere alargar el rango, salvo que ya esté en 5 años.
- **Con datos** — la línea del fijo en el rango.

**Criterios de aceptación:**
- [ ] La card de detalle de un fijo de **gasto o de ingreso**, no calculado, ofrece el acceso "Ver evolución"; en calculados, únicos, cuotas y simulados el acceso **no aparece**.
- [ ] El acceso está **deshabilitado con tooltip explicativo** cuando la cadena tiene menos de 2 apariciones graficables entre su arranque y el mes en curso; habilitado en caso contrario.
- [ ] La vista evolución **reemplaza el contenido** de la card conservando visible el nombre del fijo, y permite **volver** a la vista de detalle desde "Volver al detalle", al pie.
- [ ] La vista grafica **solo** la línea de ese fijo (por `chainId`), en modo montos y en la moneda default del usuario.
- [ ] El único control es el **selector de rango** (8 rangos de RF-REP-013), **default 1 año**, **no persistido**: cada entrada a la vista arranca en 1 año.
- [ ] El borde izquierdo se recorta contra el primer mes con aparición de cualquier fijo del usuario, no contra la cadena; los meses previos al alta del fijo son hueco.
- [ ] Con menos de 2 apariciones graficables en el rango elegido, la vista muestra el estado vacío.
- [ ] Esc vuelve a la vista de detalle (con el selector de rango abierto, el primer Esc solo lo cierra); ✕ y scrim cierran la card.
- [ ] La vista no edita ni actúa sobre el movimiento.

**Notas:**
- La anatomía de la vista (ubicación y forma del acceso, del "volver" y del tooltip) y sus copys los define `control-design` (`docs/design.md`).
