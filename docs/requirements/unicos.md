# 3.3 Módulo: Movimientos únicos

> Parte de los requerimientos funcionales de Control. Índice e ID → archivo: `docs/requirements.md`.

Un movimiento único es un gasto o ingreso que ocurrió una sola vez en una fecha específica. Es el tipo de movimiento más simple.

> Al crear un movimiento, el usuario elige primero el tipo de registro: **único**, **fijo** o **cuotas**. Este módulo incluye el formulario de carga común (RF-CM-001); los fijos están en `fijos.md` y las cuotas en `cuotas.md`.

---

## RF-CM-001 — Formulario de carga de movimiento

| Campo | Detalle |
|---|---|
| **Descripción** | La carga de un movimiento se realiza mediante un formulario con tabs, uno por tipo. El contenido cambia según el tab activo. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario activó la acción "nuevo movimiento" (desde el botón "Nuevo movimiento" del sidebar o desde el dashboard). |

**Flujo principal:**
1. El sistema presenta el formulario como un **modal** con tres tabs: **Único**, **Fijo**, **Cuotas**.
2. El tab **Único** está activo por defecto.
3. El usuario selecciona el tab que corresponde al tipo de movimiento a cargar.
4. El formulario muestra los campos del tipo seleccionado.
5. El usuario completa el formulario y confirma (ver RF-MU-001, RF-MF-001, RF-MC-001 según el tipo).

**Criterios de aceptación:**
- [ ] El formulario presenta exactamente tres tabs: Único, Fijo, Cuotas.
- [ ] El tab Único está activo por defecto al abrir el formulario.
- [ ] Dentro del tab Único, el tipo **Gasto** está seleccionado por defecto.
- [ ] Cambiar de tab limpia el formulario — no se conservan datos del tab anterior.
- [ ] El formulario es accesible desde el botón "Nuevo movimiento" del sidebar (presente en cualquier pantalla autenticada) y desde el dashboard.
- [ ] En modo edición, el formulario abre directamente en el tipo del movimiento editado y no muestra los tabs de selección de tipo.
- [ ] El usuario puede cancelar y cerrar el formulario desde cualquier tab sin guardar nada.

---

## RF-MU-001 — Crear movimiento único

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario registra un movimiento único con tipo (gasto/ingreso), monto, categoría, fecha y hora, y descripción opcional. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa. Existe al menos una categoría disponible. |

**Flujo principal:**
1. El usuario inicia la carga de un movimiento y selecciona el tipo **Único**.
2. El usuario selecciona: **Gasto** o **Ingreso**.
3. El usuario ingresa el monto (obligatorio).
4. El usuario selecciona una categoría (obligatorio).
5. El usuario confirma o modifica la fecha y la hora (default: el momento actual de creación).
6. El usuario ingresa una descripción (opcional).
7. El usuario confirma.
8. El sistema guarda el movimiento, cierra el formulario y muestra un toast de confirmación con la acción "Ir a ver". El toast permite navegar a la vista del mes correspondiente a la fecha del movimiento. Si el usuario no interactúa con el toast, este desaparece y el usuario permanece en la pantalla en la que estaba.

**Flujos alternativos:**
- *A1 — Monto inválido (cero, negativo, no numérico):* el sistema muestra error de validación y no guarda.
- *A2 — Sin categoría seleccionada:* el sistema muestra error de validación y no guarda.
- *A3 — El usuario cancela:* no se guarda nada y se vuelve a la pantalla anterior.
- *A4 — El usuario hace clic en "Ir a ver" del toast:* el sistema navega a la vista del mes correspondiente a la fecha del movimiento guardado.

**Criterios de aceptación:**
- [ ] Tipo, monto y categoría son obligatorios. Descripción es opcional.
- [ ] La fecha y la hora tienen como valor por defecto el momento actual de creación y ambas son editables.
- [ ] No se puede guardar un movimiento con monto igual a cero o negativo.
- [ ] Al guardar, el formulario se cierra y aparece un toast de confirmación.
- [ ] El toast incluye una acción "Ir a ver" que navega a la vista del mes correspondiente a la fecha del movimiento.
- [ ] Si el usuario no interactúa con el toast, este desaparece automáticamente y el usuario permanece en la pantalla actual.
- [ ] El monto se almacena en centavos (entero).
- [ ] Las categorías con soft delete no aparecen en el selector.

---

## RF-MU-002 — Editar movimiento único

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede modificar cualquier campo de un movimiento único ya cargado. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El movimiento existe y pertenece al usuario autenticado. |

**Flujo principal:**
1. El usuario selecciona un movimiento único desde la lista del mes.
2. El sistema presenta el formulario pre-completado con los datos actuales.
3. El usuario modifica uno o más campos.
4. El usuario confirma.
5. El sistema actualiza el movimiento.

**Criterios de aceptación:**
- [ ] Todos los campos son editables: tipo, monto, categoría, fecha, hora, descripción.
- [ ] Las validaciones de RF-MU-001 aplican en la edición.
- [ ] Si se cambia la fecha a otro mes, el movimiento deja de aparecer en el mes original y aparece en el nuevo mes.
- [ ] Solo se pueden editar movimientos propios.

---

## RF-MU-003 — Eliminar movimiento único

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede eliminar un movimiento único. La eliminación es **lógica** (RF-HIST-006): el movimiento deja de aparecer en toda la app y queda **reversible desde el historial** (RF-HIST-003) mientras su entrada esté vigente. Al expirar la entrada, la eliminación es definitiva. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El movimiento existe y pertenece al usuario autenticado. |

**Flujo principal:**
1. El usuario selecciona la opción eliminar sobre un movimiento único.
2. El sistema solicita confirmación.
3. El usuario confirma.
4. El sistema marca el movimiento como eliminado y registra la entrada correspondiente en el historial (RF-HIST-001).
5. El movimiento desaparece de la lista inmediatamente.

**Flujos alternativos:**
- *A1 — El usuario cancela la confirmación:* el movimiento no se elimina.

**Criterios de aceptación:**
- [ ] El sistema solicita confirmación antes de eliminar.
- [ ] Tras confirmar, el movimiento desaparece de la lista del mes, de los totales y de los reportes (RF-HIST-006).
- [ ] La eliminación queda registrada en el historial (RF-HIST-001) y se puede **deshacer** mientras su entrada esté vigente (RF-HIST-003); al deshacerla, el movimiento vuelve tal como estaba.
- [ ] Al expirar la entrada del historial, el movimiento se borra físicamente y la eliminación es definitiva (RF-HIST-005).
- [ ] La confirmación de borrado no expone controles ni advertencias sobre el historial: el registro es automático (RF-HIST-001).
- [ ] Solo se pueden eliminar movimientos propios.

---

## RF-MU-004 — Crear categoría desde el formulario de carga de movimiento

| Campo | Detalle |
|---|---|
| **Descripción** | Desde el formulario de carga de movimiento, el usuario puede crear una categoría nueva sin abandonar el formulario ni perder los datos ya cargados. La categoría recién creada queda autoseleccionada en el campo categoría del movimiento. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El formulario de carga de movimiento está abierto (en cualquiera de sus tabs: Único, Fijo o Cuotas). |

**Alcance:** Aplica al formulario de carga de movimiento (el formulario único `transaction-form` compartido por los tres tabs), tanto en modo creación como en modo edición, ya que el campo categoría está presente en los tres tipos (RF-MU-001/RF-MU-002, RF-MF-001/RF-MF-003, RF-MC-001/RF-MC-003). Reutiliza el modal de creación de categorías (RF-CAT-002), incluyendo la validación de unicidad (RN-008) y el flujo crear-o-reactivar (RF-CAT-002 A3). **No** es un flujo de alta de categoría paralelo: es otro punto de entrada al mismo modal.

**Flujo principal:**
1. El usuario tiene el formulario de carga abierto, con uno o más campos ya cargados (monto, fecha, hora, descripción, etc.).
2. Junto al selector de categoría, el usuario activa el botón **"+ Nueva"**.
3. El sistema abre el modal de creación de categoría (RF-CAT-002) **por encima** del formulario de carga. El formulario de carga permanece montado por debajo y **conserva todos los datos ya cargados**.
4. El campo **"Tipo" (scope)** del modal, abierto en este modo inline, **solo ofrece las opciones compatibles** con el tipo del movimiento en curso y **oculta la opción del tipo opuesto**:
   - Movimiento **Gasto (`EXPENSE`)** → el scope ofrece `EXPENSE` ("Gasto") y `BOTH` ("Ambos"); se **oculta** `INCOME` ("Ingreso").
   - Movimiento **Ingreso (`INCOME`)** → el scope ofrece `INCOME` ("Ingreso") y `BOTH` ("Ambos"); se **oculta** `EXPENSE` ("Gasto").
   La opción **pre-seleccionada** es el **tipo exacto** del movimiento (Gasto → "Gasto"; Ingreso → "Ingreso"). El usuario puede cambiarla a "Ambos", pero **no** puede elegir el tipo opuesto.
5. El usuario completa el nombre (obligatorio) y confirma.
6. El sistema crea la categoría (RF-CAT-002), cierra el modal y **autoselecciona** la categoría recién creada en el campo categoría del formulario de carga.
7. El usuario continúa con la carga del movimiento desde donde estaba, con todos sus datos previos intactos y la categoría ya seleccionada.

**Flujos alternativos:**
- *A1 — El usuario cancela el modal de categoría:* el modal se cierra, no se crea ninguna categoría y el formulario de carga vuelve a primer plano conservando los datos cargados. La categoría seleccionada en el formulario no cambia.
- *A2 — Colisión con una categoría activa (RN-008):* el modal informa el error de nombre duplicado y no crea la categoría (igual que RF-CAT-002 A2). El usuario sigue dentro del modal.
- *A3 — Colisión con una categoría eliminada (reactivable):* el sistema propone reactivar la categoría eliminada mediante el prompt de reactivación (RF-CAT-002 A3). Si el usuario reactiva, el modal se cierra y la categoría **reactivada** queda autoseleccionada en el campo categoría del formulario de carga, igual que en el alta exitosa. Si cancela el prompt, vuelve al modal de categoría sin crear ni reactivar nada.
- *A4 — Error del backend al crear/reactivar:* el modal informa el error y permite reintentar sin perder lo tipeado; el formulario de carga conserva sus datos por debajo.

**Criterios de aceptación:**
- [ ] El disparador es un botón **"+ Nueva"** ubicado **junto al selector de categoría** dentro del formulario de carga (no un ítem dentro del desplegable de categorías).
- [ ] El botón abre el modal de creación de categoría (RF-CAT-002), superpuesto al formulario de carga.
- [ ] Los datos ya cargados en el formulario de carga (monto, fecha, hora, descripción, mes de inicio, cantidad de cuotas, según el tipo) se conservan al abrir el modal y al volver de él.
- [ ] Al abrir el modal desde el formulario de carga (modo inline), el campo "Tipo" (scope) **solo ofrece las opciones compatibles** con el tipo del movimiento en curso: Gasto → "Gasto" y "Ambos" (se oculta "Ingreso"); Ingreso → "Ingreso" y "Ambos" (se oculta "Gasto"). La opción pre-seleccionada es el tipo exacto del movimiento. El usuario puede cambiar a "Ambos" pero no puede elegir el tipo opuesto.
- [ ] La restricción de opciones de scope aplica **únicamente** en modo inline (modal abierto desde el formulario de carga). Cuando el modal se abre desde su lugar normal en la sección Categorías de Configuración (`/configuracion/categorias`), ofrece las tres opciones (Gasto / Ingreso / Ambos) con default "Ambos".
- [ ] Al crear la categoría con éxito, el modal se cierra y la categoría recién creada queda autoseleccionada en el campo categoría del formulario de carga.
- [ ] Si la creación choca con una categoría eliminada, se reutiliza el prompt de reactivación (RF-CAT-002 A3); al reactivar, la categoría reactivada queda autoseleccionada en el campo categoría.
- [ ] Cancelar el modal de categoría no crea ni reactiva nada y devuelve el foco al formulario de carga sin alterar sus datos ni su categoría seleccionada.
- [ ] La autoselección respeta el filtrado por scope del selector de categorías (RN-010): el selector del formulario solo ofrece categorías compatibles con el tipo del movimiento en curso. Como en modo inline el scope nunca puede quedar en el tipo opuesto, la categoría creada/reactivada siempre es compatible y la autoselección siempre funciona.

**Notas:**
- Sin endpoint ni contrato propio: usa el modal de creación de categoría (RF-CAT-002), el flujo crear-o-reactivar y la validación de unicidad. La categoría creada/reactivada queda disponible en el listado de categorías que alimenta el selector del formulario (RF-CAT-002: "disponible inmediatamente en los selectores").

---

## RF-MU-005 — Anular un movimiento único (skip)

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede **anular** un movimiento único sin eliminarlo. Es una acción **reversible** (toggle anular / des-anular) modelada como un **flag booleano de la fila** (sin alcance temporal: anula el movimiento entero, no un mes puntual). El único anulado se sigue mostrando en la lista, pero **no suma** a los totales del mes ni a los reportes. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El movimiento único existe y pertenece al usuario autenticado. |

**Flujo principal:**
1. El usuario abre el menú de acciones (kebab) del ítem de un movimiento único en la Vista del mes (`/mes`).
2. El usuario selecciona la acción **"Anular"**.
3. El sistema marca el único como anulado (flag de la fila).
4. El ítem **se sigue mostrando** en la lista con su diferenciación visual de anulado, **deja de sumar** a los totales del mes y a los reportes.

**Flujos alternativos:**
- *A1 — Des-anular (toggle):* sobre un único ya anulado, la acción se rotula **"Des-anular"**; al activarla, el movimiento vuelve a contar y el ítem pierde la diferenciación visual de anulado.

**Criterios de aceptación:**
- [ ] La acción de anular / des-anular vive en el **menú de acciones (kebab)** del ítem del único, con rótulo **"Anular"** / **"Des-anular"** (sin "este mes": la anulación no tiene alcance temporal, es de la fila entera).
- [ ] La acción es un **toggle reversible**: anular activa el flag, des-anular lo quita. Se puede ir y volver indefinidamente.
- [ ] Aplica a cualquier dirección del único (gasto o ingreso).
- [ ] Un único anulado **se sigue mostrando** en la lista con diferenciación visual, y su monto **no suma** a los totales del mes (RF-VM-002, RF-DASH-002) **ni** a los reportes (RF-REP-001) — mismo efecto que la anulación de un fijo (RN-016), formalizado en RN-020.
- [ ] Los **calculados** derivados de un único anulado **heredan** su estado de anulación para el mes: no tienen skip propio (RF-MCALC-005).
- [ ] Solo se pueden anular movimientos únicos propios.

**Notas:**
- El detalle visual del ítem anulado y del control de la acción lo define `control-design` (`docs/design.md`).
- El flag de anulación del único vive en la propia fila (`Transaction.skipped`), a diferencia del fijo y de la cuota, que anulan **una** aparición mensual con un registro aparte. Ver `docs/data-model/entidades.md` (entidad Movimiento único) y RN-020.
