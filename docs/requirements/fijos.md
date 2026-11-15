# 3.4 Módulo: Movimientos fijos

> Parte de los requerimientos funcionales de Control. Índice e ID → archivo: `docs/requirements.md`. Submódulo de calculados (3.4.b): `calculados.md`.

Un movimiento fijo es una plantilla recurrente: sueldo, alquiler, Netflix. Aparece automáticamente en cada mes que dicta su frecuencia (RF-MF-006), desde su inicio hasta que el usuario lo elimina. No tiene día específico dentro del mes.

---

## RF-MF-001 — Crear movimiento fijo

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario registra un movimiento fijo que se repetirá en todos los meses desde su mes de inicio en adelante. El mes de inicio es elegible y admite meses pasados. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. Existe al menos una categoría disponible. |

**Flujo principal:**
1. El usuario inicia la carga de un movimiento y selecciona el tipo **Fijo**.
2. El usuario selecciona: **Gasto** o **Ingreso**.
3. El usuario ingresa el monto (obligatorio).
4. El usuario selecciona el **mes de inicio**. Default: el **mes contexto** si el formulario se abrió desde la Vista del mes (`/mes`); en cualquier otro origen (dashboard, sidebar), el **mes actual**. Es editable y admite meses pasados.
5. El usuario selecciona una categoría (obligatorio).
6. El usuario ingresa una descripción (opcional).
7. El usuario confirma.
8. El sistema crea el movimiento fijo con `startMonth` igual al mes de inicio elegido, cierra el formulario y muestra un toast de confirmación con la acción "Ir a ver". El toast permite navegar a la vista del mes de inicio del fijo. Si el usuario no interactúa con el toast, este desaparece y el usuario permanece en la pantalla en la que estaba.

**Flujos alternativos:**
- *A1 — El usuario hace clic en "Ir a ver" del toast:* el sistema navega a la vista del mes de inicio del fijo.

**Criterios de aceptación:**
- [ ] El mes de inicio tiene como default el mes contexto cuando el formulario se abre desde la Vista del mes, y el mes actual en cualquier otro origen. Es editable.
- [ ] Se permite elegir un mes de inicio pasado; en ese caso el fijo aparece retroactivamente en los meses anteriores y modifica sus totales (consecuencia esperada).
- [ ] Un movimiento fijo mensual con mes de inicio en junio aparece en junio, julio, agosto, y todos los meses siguientes.
- [ ] El movimiento fijo no tiene fecha de día — aparece como ítem mensual sin día específico.
- [ ] Las validaciones de monto (> 0) aplican igual que en RF-MU-001.
- [ ] Al guardar, el formulario se cierra y aparece un toast de confirmación.
- [ ] El toast incluye una acción "Ir a ver" que navega a la vista del mes de inicio del fijo.
- [ ] Si el usuario no interactúa con el toast, este desaparece automáticamente y el usuario permanece en la pantalla actual.
- [ ] Las categorías con soft delete no aparecen en el selector.

---

## RF-MF-002 — Visualización de movimiento fijo en el mes

| Campo | Detalle |
|---|---|
| **Descripción** | El sistema incluye automáticamente los movimientos fijos activos en cada mes consultado, sin acción del usuario. |
| **Actor** | Sistema |
| **Prioridad** | Media |
| **Precondiciones** | Existe al menos un movimiento fijo activo. |

**Criterios de aceptación:**
- [ ] Un fijo activo aparece en todos los meses desde `startMonth` inclusive **que caen en su frecuencia** (RF-MF-006 / RN-016). Un fijo mensual aparece en todos los meses del rango; uno de frecuencia mayor solo en los meses que dicta su paso anclado al `startMonth`.
- [ ] Un fijo con `deletedFrom` definido no aparece en ese mes ni en los siguientes.
- [ ] Si `deletedFrom` es el mes siguiente al actual, el fijo aún aparece en el mes actual.
- [ ] El movimiento fijo se distingue visualmente como "fijo" en la lista del mes.
- [ ] Un fijo **anulado** para el mes (RF-MF-005) se sigue mostrando con su diferenciación visual, pero no suma a los totales.

---

## RF-MF-003 — Editar movimiento fijo

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede editar monto, categoría o descripción de un movimiento fijo. Los cambios aplican desde el **mes visualizado** (el mes desde el que se abre la edición en la Vista del mes) en adelante; los meses anteriores a ese mes no se tocan. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El movimiento fijo existe, está activo y pertenece al usuario autenticado. |

**Flujo principal:**
1. El usuario selecciona un movimiento fijo desde la Vista del mes, estando posicionado en un mes determinado (el **mes visualizado**).
2. El sistema presenta el formulario de edición con los datos actuales.
3. El usuario modifica monto, categoría o descripción.
4. El usuario confirma.
5. El sistema actualiza el movimiento fijo: aplica el cambio **desde el mes visualizado en adelante** (pivote del split), preservando los meses anteriores a él.

**Criterios de aceptación:**
- [ ] Los campos editables son: monto, categoría, descripción.
- [ ] El pivote del cambio es el **mes visualizado** en la Vista del mes desde el que se abrió la edición, no el mes actual real del usuario.
- [ ] Los cambios se reflejan en el mes visualizado y en todos los meses siguientes.
- [ ] Los meses anteriores al mes visualizado no sufren ningún cambio.
- [ ] Editar un fijo desde un mes pasado modifica ese mes y los siguientes, preservando solo los meses anteriores a él (consecuencia esperada).
- [ ] Las validaciones de monto (> 0) aplican en la edición.

**Notas:**
- La edición retroactiva de un mes específico anterior al mes visualizado está fuera de scope en v1: el split solo preserva los meses previos al pivote, no permite tocar uno puntual del pasado.

---

## RF-MF-004 — Eliminar movimiento fijo

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede eliminar un movimiento fijo. La eliminación aplica **desde el mes visualizado** en la Vista del mes (`/mes`) **inclusive en adelante**, preservando los meses anteriores. Es un comportamiento único, sin opciones. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El movimiento fijo existe, está activo y pertenece al usuario autenticado. |

**Flujo principal:**
1. El usuario selecciona la opción eliminar sobre un movimiento fijo, estando parado en un mes en la Vista del mes (`/mes`). El **mes visualizado** es el pivote de la operación (mismo pivote que la edición de fijos — RF-MF-003, RN-005).
2. El sistema muestra una confirmación, sin opciones a elegir.
3. El usuario confirma.
4. El fijo deja de aparecer **desde el mes visualizado inclusive en adelante**. Los meses anteriores al mes visualizado no cambian.
5. **Borde:** si el mes visualizado es anterior o igual al mes de inicio del fijo, el fijo no aparecería en ningún mes y se elimina por completo.

**Flujos alternativos:**
- *A1 — El usuario cancela:* el movimiento fijo sigue sin cambios.

**Criterios de aceptación:**
- [ ] La confirmación no ofrece opciones: la eliminación siempre aplica desde el mes visualizado inclusive.
- [ ] El fijo desaparece desde el mes visualizado en adelante y se preserva en los meses anteriores a él.
- [ ] Si el mes visualizado es anterior o igual al mes de inicio del fijo, el fijo se elimina por completo.
- [ ] En ningún caso se modifican los meses anteriores al mes visualizado.
- [ ] Solo se pueden eliminar movimientos fijos propios.
- [ ] Un fijo con fin de vigencia se puede **reabrir** (RF-MF-008).

---

## RF-MF-005 — Anular apariciones de un movimiento fijo (skip)

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede **anular** apariciones de un movimiento fijo sin eliminarlo, con dos **alcances**: un **mes puntual** o un **rango de meses**. Es una acción **reversible** en los dos alcances (anular / des-anular). Un mes anulado se sigue mostrando en la lista, pero **no suma a los totales** de ese mes ni a la proyección anual. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El movimiento fijo existe, está activo, aparece en el mes visualizado según su frecuencia (RF-MF-006) y pertenece al usuario autenticado. |

**Flujo principal:**
1. El usuario, parado en un mes en la Vista del mes (`/mes`), abre el menú de acciones del ítem de un movimiento fijo.
2. El usuario selecciona la acción **"Anular este mes"**. El sistema abre un **modal de alcance** con dos opciones: **este mes** (preseleccionada) y **un rango de meses**.
3. El usuario confirma: con **este mes**, se anula la aparición del mes visualizado; con **rango**, elige mes desde y mes hasta y se anulan las apariciones del fijo dentro de ese rango.
4. Cada mes anulado **se sigue mostrando** en la lista de su mes con la diferenciación visual de anulado, y **deja de sumar** a los totales de ese mes y a la proyección anual.

**Flujos alternativos:**
- *A1 — Des-anular:* sobre un fijo **anulado en el mes visualizado**, la acción del kebab se rotula **"Des-anular este mes"** y el modal ofrece los mismos dos alcances en sentido inverso ("Des-anular este mes" / "Des-anular un rango de meses"). El **sentido de la operación lo fija el estado del mes visualizado** y aplica a los dos alcances: no hay un modal que anule unos meses y des-anule otros.
- *A2 — Des-anular un rango:* quita **todas** las anulaciones del fijo que caen dentro del rango, sin importar cómo se crearon (una por una o por rango).
- *A3 — El usuario cancela:* nada cambia.

**Reglas del rango:**

| Regla | Detalle |
|---|---|
| **Extremos** | Mes desde y mes hasta, **ambos inclusive**. Un rango de un solo mes equivale al alcance "este mes". |
| **Solo apariciones reales** | Se anulan **únicamente los meses en que el fijo aparece** según su frecuencia (RN-016). Un fijo con frecuencia 3 anulado "de marzo a diciembre" queda anulado en marzo, junio, septiembre y diciembre — no en los diez meses. |
| **Sobre el fijo lógico** | El rango opera sobre el **fijo lógico** (la cadena, RF-MF-007), no sobre la fila vigente del mes visualizado: un rango que cruza un split de edición (RN-005) anula igual los meses que cubren las filas anteriores de la cadena. |
| **Piso** | El **arranque del fijo lógico**. |
| **Techo** | El **último mes de aparición** del fijo cuando tiene fin de vigencia (`endMonth`, exclusivo). Un fijo indefinido no tiene techo propio: lo acota el largo máximo. |
| **Largo máximo** | **24 meses.** |
| **Meses pasados** | **Admitidos**, igual que en el alcance de un mes. |
| **Idempotencia** | Anular un rango que ya contiene meses anulados los deja anulados, sin duplicar; des-anular un rango sin anulaciones no hace nada. Rangos superpuestos no se pisan. |
| **Selector acotado** | El selector **no ofrece** meses fuera del piso, del techo ni del largo máximo: no acepta un rango para después no hacer nada en esos meses. |

**Criterios de aceptación:**
- [ ] La acción de anular / des-anular vive en el **menú de acciones (kebab)** del ítem del **fijo** y abre el **modal de alcance**, con la opción **"este mes" preseleccionada**. Los **calculados** (de fijo, único o cuota) **no ofrecen la acción**: no tienen skip propio, **heredan** el estado de anulación de su origen para el mes (RF-MCALC-005). Los movimientos **únicos** (RF-MU-005) y las **cuotas** (RF-MC-004) tienen su propia acción de anulación, **sin modal y sin alcance de rango** (anulan una sola cosa: la fila del único, la instancia del mes de la cuota), con la misma mecánica de exclusión de totales y reportes (RN-016, RN-020).
- [ ] La acción es **reversible** en los dos alcances: anular crea las anulaciones, des-anular las quita, y se puede ir y volver indefinidamente.
- [ ] Un rango anula **solo las apariciones reales** del fijo dentro de él (frecuencia, RN-016); los meses del rango sin aparición no generan nada.
- [ ] El rango está acotado por la **vigencia del fijo lógico** (arranque … último mes de aparición) y por un **largo máximo de 24 meses**; el selector no ofrece meses fuera de esos límites.
- [ ] El rango admite **meses pasados**.
- [ ] Des-anular un rango **quita todas** las anulaciones del fijo que caen dentro de él.
- [ ] Anular / des-anular **no genera entrada de historial** en ningún alcance (RF-HIST-001): revertir es volver a operar sobre el mismo mes o rango.
- [ ] Las anulaciones del **relleno** de una reapertura (RF-MF-008) son anulaciones comunes: se des-anulan con esta misma acción.
- [ ] Anular se distingue de eliminar (`deletedFrom`, RF-MF-004): no elimina el fijo ni toca los meses de afuera del alcance elegido — el fijo sigue vivo y aparece en las demás apariciones que dicta su frecuencia, incluidas las posteriores al rango.
- [ ] Un fijo anulado para un mes **se sigue mostrando** en la lista de ese mes, con diferenciación visual.
- [ ] El monto de un fijo anulado **no suma** a los totales del mes (RF-VM-002, RF-DASH-002) **ni** a la serie anual de los reportes (RF-REP-001).
- [ ] Solo se pueden anular movimientos fijos propios.

**Notas:**
- El detalle visual del ítem anulado, del control de la acción y del modal de alcance lo define `control-design` (`docs/design.md`).
- La anulación se modela como un registro aparte `(fijo, mes)`, **distinto** de `deletedFrom`: `deletedFrom` significa "el fijo deja de existir de ahí en adelante"; la anulación significa "esta aparición no cuenta, pero el fijo sigue vivo" (ver `docs/data-model/entidades.md`, entidad RecurringSkip, y RN-016).
- **No hay entidad "rango".** El modelo guarda **una anulación por (fijo, mes)**: el rango es la herramienta de selección del momento y no queda registrado. De ahí se siguen dos cosas. (a) El conjunto de meses anulados **se fija al confirmar** y no se recalcula después: si los meses de aparición del fijo cambiaran, los que pasan a tener aparición **no** quedan anulados, porque nunca se creó su anulación. (b) **Encadenar dos rangos consecutivos da exactamente el mismo estado** que un único rango del largo equivalente, así que un tramo mayor al largo máximo se cubre en dos operaciones sin ninguna pérdida.
- **Por qué el largo máximo.** El rango materializa una anulación por aparición, así que su largo es también el volumen que escribe. Los 24 meses son dos años calendario —la unidad con la que trabaja el resto de la app— y alcanzan para expresar "lo que queda de este año más todo el que viene" desde cualquier mes de partida. El caso "de acá en adelante para siempre" no es una anulación sino una **baja**, y lo cubre RF-MF-004.
- **Por qué el selector acota en vez de aceptar y no hacer nada.** La vigencia del fijo lógico viaja en el ítem del mes (contrato de `GET /movements`), así que acotar no cuesta un dato extra, y aceptar un rango fuera de la vigencia lo convertiría en un no-op invisible. Mismo criterio que la navegación de año de los reportes, acotada al rango de datos propio de cada card (RF-REP-002). No contradice la navegación **ilimitada** de meses (RF-VM-004): ahí el dominio son los meses del calendario, que existen todos; acá son las apariciones del fijo, que tienen bordes.
- **Contrato de datos.** Anular / des-anular un rango es **una** operación de usuario sobre el fijo lógico más mes desde / mes hasta; resolver qué meses son aparición y, mes por mes, qué fila de la cadena los cubre es del backend. El contrato HTTP exacto vive en `docs/backend/fijos.md` §Anulación de apariciones.

---

## RF-MF-006 — Periodicidad del movimiento fijo (frecuencia)

| Campo | Detalle |
|---|---|
| **Descripción** | Al crear un movimiento fijo, el usuario elige su **frecuencia** de aparición: un **entero de 1 a 12** que expresa cuántos meses transcurren entre apariciones. La frecuencia está **anclada al mes de inicio** y define en qué meses aparece el fijo. No se puede cambiar después de creado. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. Existe al menos una categoría disponible. |

**Flujo principal:**
1. El usuario carga un movimiento fijo (RF-MF-001) y, además del mes de inicio, selecciona una **frecuencia** (1 a 12).
2. El sistema crea el fijo con esa frecuencia.
3. El fijo aparece en su mes de inicio y luego cada N meses, anclado al mes de inicio.

**Etiquetas:** cada valor tiene un rótulo en el selector:

| Valor | Etiqueta | Valor | Etiqueta |
|---|---|---|---|
| 1 | Mensual | 6 | Semestral |
| 2 | Bimestral | 7..11 | Cada N meses |
| 3 | Trimestral | 12 | Anual |
| 4 | Cuatrimestral | | |
| 5 | Cada 5 meses | | |

**Criterios de aceptación:**
- [ ] La frecuencia es un **entero de 1 a 12** (meses entre apariciones). No hay frecuencias libres fuera de ese rango ni custom.
- [ ] El **default** al crear es **1** (Mensual).
- [ ] La frecuencia está **anclada al mes de inicio**: un fijo con frecuencia 2 que arranca en marzo aparece en marzo, mayo, julio, etc.; uno con frecuencia 3 que arranca en enero aparece en enero, abril, julio, octubre; y así con cualquier N (aparece cada N meses desde el mes de inicio). Un fijo reabierto se **re-ancla en el mes de reapertura** desde ese mes (RF-MF-008).
- [ ] Un fijo aparece en un mes solo si, además de estar activo en el rango (RF-MF-002), ese mes cae en su frecuencia respecto del mes de inicio.
- [ ] La frecuencia **es inmutable** tras crearse (igual que el tipo): el selector aparece **solo al crear**; en el formulario de edición se muestra de **solo lectura**. Cambiar la cadencia de un fijo equivale a crear otro.
- [ ] El cálculo de qué fijo cae en cada mes es **on-the-fly** (RN-006): no se generan filas por instancia mensual.

**Notas:**
- El detalle visual del selector de frecuencia y de la etiqueta de frecuencia en el ítem del mes lo define `control-design` (`docs/design.md`).
- La regla de cálculo de la frecuencia está formalizada en RN-016. La anulación de un mes puntual (RF-MF-005) opera sobre **una** de las apariciones que dicta la frecuencia.

---

## RF-MF-007 — Arranque y vigencia del fijo en la card de detalle

| Campo | Detalle |
|---|---|
| **Descripción** | La **card de detalle** (RF-VM-007) de un ítem fijo muestra su **vigencia**: el **mes de arranque** del fijo lógico y su **mes de fin** cuando lo tiene. Ambos son del **fijo lógico**, independientes del mes visualizado. La **fila de `/mes` no muestra el arranque** — se consulta en la card. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Baja |
| **Precondiciones** | La card de detalle de un ítem fijo está abierta. |

**Criterios de aceptación:**
- [ ] La card muestra el arranque del **fijo lógico**, no el de la fila vigente: un fijo creado en marzo 2024 y editado luego sigue mostrando marzo 2024 como arranque, aunque la edición haya partido la cadena (ver RN-005 y `docs/data-model/entidades.md`, §Decisiones de negocio sobre los datos — identidad de cadena).
- [ ] La card muestra el **fin (vigencia)** del fijo cuando tiene una terminación programada (`endMonth`); un fijo sin fin programado —incluido uno reabierto (RF-MF-008)— se muestra como **activo indefinidamente**.
- [ ] Un **calculado de origen fijo** muestra su **propio** arranque y su **propio** fin (los de su cadena), no los del origen: un calculado creado en enero 2026 sobre un fijo de marzo 2024 muestra enero 2026.
- [ ] El arranque **no** aparece en la fila de `/mes` (RF-VM-001); vive solo en la card.
- [ ] La ubicación y forma visual del dato en la card la define `control-design` (`docs/design.md`).

**Notas:**
- El backend expone arranque y fin en `MovementItem.startMonth` / `MovementItem.endMonth` para fijos (ver `docs/data-model/movimientos.md`, §Contrato de movimientos del mes); la resolución por cadena vive en `docs/backend/movimientos-mes.md` §Integración de fijos en `/movements`.

---

## RF-MF-008 — Reabrir un movimiento fijo terminado

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede **reabrir** un movimiento fijo que tiene **fin de vigencia** (`endMonth`, RF-MF-004 / RF-MF-007), ya alcanzado o programado a futuro. Elige el **mes de reapertura X** y el monto: desde X el fijo vuelve a aparecer **indefinidamente**, con su cadencia **re-anclada en X**. Los meses entre el fin y X (**relleno**, `[endMonth, X)`) muestran las apariciones del fijo **anuladas**. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El fijo existe, pertenece al usuario autenticado, es un fijo **normal** (no calculado de ningún tipo), tiene `endMonth` y está listado en el mes visualizado de `/mes`. |

**Flujo principal:**
1. El usuario, parado en un mes en `/mes`, abre el **kebab (⋮)** de un ítem fijo con fin de vigencia y elige **"Reabrir"**.
2. El sistema abre el **paso de reapertura** con el **mes de reapertura X** (default: el mayor entre el mes en curso y `endMonth`) y el **monto** precargado con el último monto del fijo.
3. El usuario ajusta X y/o el monto. Si la **categoría** del fijo está dada de baja, el paso obliga a elegir una activa; si lo está el **método de pago**, obliga a elegir uno activo o "sin método de pago". En el mismo paso obliga también a elegir una categoría activa para cada **calculado que se reabre en espejo** con la suya dada de baja (su método lo hereda del origen, RN-021).
4. El usuario confirma.
5. El sistema reabre el fijo según las reglas de abajo y muestra el aviso de éxito con la acción **"Deshacer"** (RF-HIST-007).

**Flujos alternativos:**
- *A1 — El usuario cancela:* el fijo sigue sin cambios.
- *A2 — X igual a `endMonth`:* no hay relleno; equivale a **quitar el fin**. Es el caso del fijo con fin programado a futuro reabierto con el default.

**Reglas de la reapertura:**

| Regla | Detalle |
|---|---|
| **Mes de reapertura X** | X >= máx(mes en curso, `endMonth`) — mes en curso real, no el mes visualizado. Default: ese mínimo. |
| **Cadencia** | Se **re-ancla en X**: X es siempre aparición y desde ahí el fijo aparece cada N meses (N = su frecuencia, que no cambia — RF-MF-006), como un fijo recién creado en X. |
| **Relleno** | Los meses `[endMonth, X)`. Las apariciones del fijo en ese tramo se evalúan con la **cadencia previa a la reapertura** (RN-016) y **solo esas** quedan **anuladas** (RF-MF-005); los meses del relleno sin aparición no generan nada. Sin tope de largo. |
| **Relleno en el pasado** | Los meses de relleno pueden ser pasados y muestran sus ítems anulados. Es una excepción explícita a RN-005: la reapertura solo **agrega anulaciones** en esos meses, no cambia sus totales. |
| **Monto** | Los meses de relleno llevan el **monto previo a la reapertura**; el monto confirmado rige **desde X**. |
| **Campos editables** | Solo el **monto**. El resto del fijo se conserva, salvo la categoría o el método de pago dados de baja, que se reemplazan en el paso: la categoría por una activa; el método por uno activo o por "sin método de pago". Lo que está activo no se cambia al reabrir. El reemplazo rige **desde X**; los meses de relleno conservan los originales. |
| **Vigencia resultante** | Siempre **indefinida**. Para volver a terminarlo se usa RF-MF-004. |
| **Calculados derivados** | Los calculados derivados del fijo (RF-MCALC-005) que terminaron **junto con el origen** (mismo `endMonth`) se reabren **en espejo**, con el mismo X y su relleno anulado, dentro de la **misma entrada de historial** del origen (se revierten con ella). Los que tienen otro fin quedan cerrados. |

**Criterios de aceptación:**
- [ ] La acción **"Reabrir"** vive en el **kebab (⋮)** del ítem en `/mes` y se ofrece solo sobre fijos **normales** con `endMonth` (ya alcanzado o a futuro). No aparece en fijos sin fin ni en ningún calculado. La card de detalle (RF-VM-007) no la ofrece.
- [ ] Un fijo eliminado por completo (borde de RF-MF-004) no existe para la app (RF-HIST-006) y no se reabre: se recupera deshaciendo su eliminación (RF-HIST-003).
- [ ] X no puede ser anterior al mes en curso ni a `endMonth`; el default es máx(mes en curso, `endMonth`).
- [ ] Desde X el fijo aparece en X y cada N meses desde X, sin fin.
- [ ] En el relleno quedan anuladas exactamente las apariciones que dictaba la cadencia previa, con el monto previo; no suman a totales ni a reportes (RN-016).
- [ ] Des-anular un mes de relleno (RF-MF-005) lo hace aparecer y sumar como cualquier mes, con el monto previo.
- [ ] La reapertura genera una entrada de historial con operación **"reabierto"**, deshacible desde `/historial` y desde el aviso de éxito (RF-HIST-001/003/007). Deshacerla restaura el fin y borra las anulaciones de relleno que queden: los meses de relleno vuelven a quedar fuera de vigencia, estén anulados o no.
- [ ] El relleno amplía el rango navegable de los reportes (RF-REP-002) y en la vista evolución (RF-VM-009) sus apariciones cuentan como anuladas.
- [ ] Solo se pueden reabrir movimientos fijos propios.

**Notas:**
- El detalle visual del paso de reapertura lo define `control-design` (`docs/design.md`).
- Contrato de API: `docs/data-model/reapertura.md`.
