# 3.14 Módulo: Historial de cambios

> Parte de los requerimientos funcionales de Control. Índice e ID → archivo: `docs/requirements.md`. Modelo y contratos (`HistoryEntry`, `GET /history`, `POST /history/:id/undo`, `historyEntryId`): `docs/data-model/historial.md`.

El historial registra las **ediciones** y **eliminaciones** de movimientos y permite **deshacerlas**. Es una **red de seguridad de corto plazo**, no un log de auditoría: las entradas tienen una vida acotada (RF-HIST-005), deshacer no deja rastro (RF-HIST-003) y ninguna otra operación de la app se registra (RF-HIST-001).

---

## RF-HIST-001 — Registro automático de cambios de movimientos

| Campo | Detalle |
|---|---|
| **Descripción** | El sistema registra automáticamente una **entrada de historial** por cada **edición** y cada **eliminación** de un movimiento —único, fijo (incluidos los calculados) y grupo de cuotas— y por cada **reapertura** de un fijo (RF-MF-008). La entrada guarda el estado previo del objetivo, lo suficiente para restaurarlo. El registro es silencioso: no pide confirmación ni agrega ningún control a los flujos de edición y borrado. |
| **Actor** | Sistema |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario edita o elimina un movimiento propio, o reabre un fijo propio. |

**Alcance — qué se registra:**

| Operación | ¿Genera entrada? |
|---|---|
| Editar un movimiento único (RF-MU-002) | Sí |
| Eliminar un movimiento único (RF-MU-003) | Sí |
| Editar un movimiento fijo o un calculado (RF-MF-003, RF-MCALC-006) | Sí |
| Eliminar un movimiento fijo o un calculado (RF-MF-004, RF-MCALC-006/009) | Sí |
| Reabrir un movimiento fijo (RF-MF-008) | Sí — operación **"reabierto"** |
| Editar un grupo de cuotas (RF-MC-003) | Sí |
| Eliminar un grupo de cuotas (RF-MC-002) | Sí |
| Crear un movimiento de cualquier tipo (RF-MU-001, RF-MF-001, RF-MC-001, RF-MCALC-001, RF-VM-008) | No |
| Crear o eliminar una simulación de categoría (RF-SIM-001, RF-SIM-004) | No |
| Anular / des-anular (RF-MU-005, RF-MF-005, RF-MC-004) | No |
| ABM de categorías (RF-CAT-*) y de métodos de pago (RF-PM-*) | No |
| Cambios de preferencias (moneda default, apariencia, reportes, límites, orden y filtros) | No |

**Identidad de la entrada — clave de agrupación por objetivo:**

| Objetivo | Clave |
|---|---|
| Único | `Transaction.id` |
| Fijo, incluido el calculado | **Identidad de cadena** del fijo (`Recurring.chainId`), **no** el id de la fila: editar un fijo parte la cadena y el id de la fila cambia (RN-005; ver `docs/backend/fijos.md` §Inmutabilidad del pasado) |
| Cuotas | `InstallmentGroup.id` |

**Criterios de aceptación:**
- [ ] Cada edición y cada eliminación de un movimiento único, fijo (incluidos los calculados) o grupo de cuotas, y cada reapertura de un fijo, genera **exactamente una** entrada de historial.
- [ ] Las operaciones marcadas "No" en la tabla de alcance **no** generan entrada de ningún tipo.
- [ ] La entrada guarda el estado previo del movimiento, suficiente para restaurarlo por completo al deshacerla (RF-HIST-003), y el instante en que se registró (base del vencimiento, RF-HIST-005).
- [ ] Las entradas se **agrupan por movimiento** con la clave estable de la tabla de identidad. Para un fijo, la clave es la identidad de cadena: las ediciones sucesivas —que parten la cadena— siguen perteneciendo al mismo movimiento.
- [ ] El registro es **automático y silencioso**: el formulario de edición no expone checkbox, aviso ni opción alguna sobre el historial, y el flujo de guardado no suma pasos ni fricción.
- [ ] La **cascada** de un borrado sobre los calculados derivados del movimiento (RF-MCALC-005), y la **reapertura en espejo** de sus calculados (RF-MF-008), **no** generan entradas propias: quedan contenidas en la entrada del origen y se revierten junto con ella.
- [ ] Un usuario solo registra y ve entradas de sus propios movimientos (RN-003).

---

## RF-HIST-002 — Pantalla de historial de cambios

| Campo | Detalle |
|---|---|
| **Descripción** | La pantalla `/historial` lista las entradas de historial de **todos** los movimientos del usuario. Por cada entrada muestra de qué se trata, qué operación fue (edición, eliminación o reapertura), **qué cambió** —estado anterior → estado nuevo— y expone la acción de **deshacer** (RF-HIST-003). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] La pantalla vive en la ruta `/historial` y es la **cuarta** entrada del sidebar, entre "Reportes" y "Configuración" (RF-NAV-001).
- [ ] Lista las entradas de **todos** los movimientos en una única lista cronológica, la **más reciente primero**. No se navega por mes ni por período.
- [ ] Cada entrada identifica el movimiento (nombre, tipo y categoría), la operación (**editado** / **eliminado** / **reabierto**) y el momento del cambio.
- [ ] En una **edición**, la entrada muestra los campos que cambiaron con su **valor anterior y su valor nuevo**. En una **eliminación**, muestra el movimiento tal como estaba antes de borrarse. En una **reapertura**, el fin anterior → el mes de reapertura, más los campos que cambiaron (monto, categoría, método) con su valor anterior y nuevo.
- [ ] Cada entrada expone la acción **Deshacer** (RF-HIST-003); las entradas bloqueadas se listan igual, con la acción rotulada como **bloqueada** y el motivo visible (RF-HIST-004).
- [ ] La pantalla solo muestra entradas **vigentes**: las purgadas por retención (RF-HIST-005) no aparecen.
- [ ] Un movimiento **eliminado** aparece en el historial aunque no aparezca en ninguna otra superficie de la app (RF-HIST-006): el historial es la única superficie que lo expone.
- [ ] La pantalla es de **consulta y deshacer**: no edita movimientos ni ofrece acceso a su edición.

**Notas:**
- Contenido, acciones, navegación y estados completos de la pantalla en `docs/screens.md`, §11. El detalle visual lo define `control-design` (`docs/design.md`).

---

## RF-HIST-003 — Deshacer un cambio

| Campo | Detalle |
|---|---|
| **Descripción** | Deshacer una entrada **restaura el movimiento al estado previo** que la entrada guarda y **borra la entrada del historial**. El deshacer **no genera entrada nueva** ni se registra de ninguna forma: no queda rastro de que el cambio existió. Es deliberado — Control es un diario personal, no un log de auditoría. Se dispara desde **dos superficies**: `/historial` (RF-HIST-002) y el **atajo del aviso de éxito** de la propia edición/eliminación (RF-HIST-007). La operación es la misma en las dos. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | La entrada existe, está vigente y es la **más reciente** de su movimiento (RF-HIST-004). |

**Flujo principal (desde `/historial`):**
1. El usuario abre una entrada desde `/historial`.
2. El sistema muestra el cambio (estado anterior → estado nuevo) y pide confirmación.
3. El usuario confirma.
4. El sistema restaura el movimiento al estado previo guardado en la entrada.
5. El sistema **elimina la entrada** del historial. La lista se actualiza y el cambio deja de figurar.

**Flujos alternativos:**
- *A1 — El usuario cancela:* no se restaura nada y la entrada queda intacta.
- *A2 — La entrada está bloqueada:* se aplica RF-HIST-004 (el modal explica el motivo y ofrece deshacer los posteriores).

**Criterios de aceptación:**
- [ ] Deshacer una **edición** devuelve el movimiento a los valores que tenía antes de esa edición. En un **fijo**, restaura también la estructura de la cadena que la edición había partido (RN-005).
- [ ] Deshacer una **eliminación** devuelve el movimiento a la app: vuelve a aparecer en listados, totales y reportes exactamente como estaba.
- [ ] Al deshacer la eliminación de un movimiento que era **origen de calculados**, los calculados que dependían de él **se restauran junto con el origen**, sin acción adicional del usuario (RF-HIST-006).
- [ ] Deshacer una **reapertura** (RF-MF-008) restaura el fin del fijo y borra las anulaciones de relleno que queden; revierte igual los calculados reabiertos en espejo.
- [ ] Deshacer **borra la entrada** del historial y **no crea ninguna entrada nueva**: la operación de deshacer no se registra en ningún lado.
- [ ] Tras deshacer, el historial no conserva ninguna evidencia de que el cambio deshecho haya existido.
- [ ] El deshacer **desde `/historial`** se confirma antes de aplicarse. El **atajo del aviso de éxito** (RF-HIST-007) **no** pide confirmación: la exigencia de confirmar es de la superficie `/historial`, no de la operación.
- [ ] Solo se pueden deshacer entradas de movimientos propios.

---

## RF-HIST-004 — Orden de deshacer y entradas bloqueadas

| Campo | Detalle |
|---|---|
| **Descripción** | El deshacer es **secuencial LIFO por movimiento**: de cada movimiento solo se puede deshacer su entrada **más reciente**. Las anteriores quedan **bloqueadas** hasta que se deshagan las posteriores. Las entradas bloqueadas **se listan siempre**, con su acción rotulada como bloqueada y el motivo visible; la acción sigue siendo operable y abre la explicación del bloqueo con el camino de desbloqueo. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | Un movimiento tiene más de una entrada vigente en el historial. |

**Flujo principal:**
1. El usuario abre una entrada bloqueada desde `/historial`.
2. El sistema explica por qué no se puede deshacer y ofrece el camino de desbloqueo: *"para deshacer este cambio hay que deshacer antes los N posteriores, ¿deshacerlos?"*, indicando cuántos son.
3. El usuario acepta.
4. El sistema deshace las entradas posteriores de ese movimiento, de la más reciente a la más antigua, y luego la entrada abierta. Todas se borran del historial (RF-HIST-003).

**Flujos alternativos:**
- *A1 — El usuario cancela:* no se deshace nada y todas las entradas quedan intactas.

**Criterios de aceptación:**
- [ ] El bloqueo es **por movimiento**: las entradas de un movimiento no bloquean las de otro. Cada movimiento tiene su propia pila LIFO.
- [ ] La entrada **más reciente** de un movimiento siempre está desbloqueada (si está vigente); las anteriores están bloqueadas mientras haya posteriores vigentes.
- [ ] Las entradas bloqueadas **se listan igual** que las demás —no se ocultan ni se filtran—, con su acción **rotulada como bloqueada** y el **motivo visible** en la lista.
- [ ] La acción de una entrada bloqueada **no está inerte**: sigue siendo operable y abre la explicación del bloqueo con la propuesta de desbloqueo en cadena. Lo que no se puede es deshacer esa entrada **por sí sola**.
- [ ] Abrir una entrada bloqueada explica el motivo y ofrece deshacer **los N cambios posteriores** de ese movimiento junto con ella, en una sola confirmación que informa cuántos son.
- [ ] Aceptar el desbloqueo en cadena deshace los posteriores y la entrada abierta, todos con la mecánica de RF-HIST-003 (restaurar + borrar la entrada, sin dejar rastro).
- [ ] **No hay fricción en el momento de editar:** el formulario de edición no advierte sobre el bloqueo ni ofrece opción alguna. El bloqueo se explica recién en el historial, cuando el usuario intenta deshacer.

---

## RF-HIST-005 — Retención y purga de entradas

| Campo | Detalle |
|---|---|
| **Descripción** | Las entradas de historial tienen **dos límites de retención** y se purgan por **el que ocurra primero**: un máximo de **5 entradas por movimiento** y un vencimiento a los **31 días** desde que la entrada se registró. Al purgarse la entrada de una eliminación, el movimiento se borra **físicamente**. |
| **Actor** | Sistema |
| **Prioridad** | Alta |
| **Precondiciones** | Existen entradas de historial. |

**Límites de retención:**

| Límite | Regla |
|---|---|
| **Cantidad** | Máximo **5 entradas por movimiento** (no un tope global). Al registrarse el **sexto** cambio de ese movimiento, se descarta la entrada **más antigua de ese movimiento**. |
| **Antigüedad** | Una entrada **vence a los 31 días** de haberse registrado y se descarta. |

**Criterios de aceptación:**
- [ ] El tope de 5 es **por movimiento**, no total: un usuario con muchos movimientos puede tener muchas más de 5 entradas vigentes en el historial.
- [ ] Registrar el sexto cambio de un movimiento descarta la entrada **más antigua de ese movimiento**; las entradas de los demás movimientos no se tocan.
- [ ] Una entrada de más de 31 días se descarta aunque el movimiento no haya llegado a 5 entradas.
- [ ] Los dos límites conviven: se purga por **el que ocurra primero**.
- [ ] Una entrada purgada desaparece de `/historial` y **ya no se puede deshacer**: el cambio queda consolidado.
- [ ] Al purgarse la entrada de una **eliminación**, el movimiento —y los calculados que hayan caído en cascada con él— se **borran físicamente** (RF-HIST-006) y la eliminación pasa a ser definitiva.

---

## RF-HIST-006 — Borrado lógico de movimientos

| Campo | Detalle |
|---|---|
| **Descripción** | Eliminar un movimiento es un **borrado lógico**: el registro queda **marcado como eliminado** y **deja de aparecer en toda la app** —listados, totales, reportes, selectores— sin excepción. Sigue existiendo solo para poder restaurarlo desde el historial. Se borra **físicamente** cuando su entrada de historial se purga (RF-HIST-005). |
| **Actor** | Sistema |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario elimina un movimiento propio. |

**Criterios de aceptación:**
- [ ] Eliminar un **movimiento único** (RF-MU-003) o un **grupo de cuotas** (RF-MC-002) marca el registro como eliminado en lugar de borrarlo.
- [ ] La eliminación de un **movimiento fijo** por boundary (`deletedFrom`, RF-MF-004) es reversible sin borrado físico. En el **borde** en que esa eliminación borra el fijo por completo (mes visualizado anterior o igual al mes de inicio), el registro se marca como eliminado en lugar de borrarse, con el mismo tratamiento que el único y el grupo de cuotas.
- [ ] Un movimiento marcado como eliminado **no aparece en ninguna superficie de la app**: ni en la lista del mes (RF-VM-001), ni en los totales del mes y del dashboard (RF-VM-002, RF-DASH-002), ni en ningún reporte (módulo 3.9), ni en los contadores de movimientos por categoría (RF-CAT-006) o por método de pago (RF-PM-005). La **única** superficie que lo expone es `/historial` (RF-HIST-002).
- [ ] Los **movimientos calculados** que dependían del eliminado caen en cascada (RF-MCALC-005) también de forma lógica: nunca se borran físicamente mientras la entrada del origen esté vigente, por lo que **se restauran solos** al deshacerla (RF-HIST-003).
- [ ] El borrado **físico** ocurre solo al purgarse la entrada de historial de la eliminación (RF-HIST-005).
- [ ] Un movimiento marcado como eliminado **no se puede editar, anular, duplicar ni tomar como origen** de un calculado: no existe para el resto de la app.

---

## RF-HIST-007 — Deshacer desde el aviso de éxito

| Campo | Detalle |
|---|---|
| **Descripción** | Tras **editar** o **eliminar** un movimiento, o **reabrir** un fijo (RF-MF-008), el **aviso de éxito** de esa acción ofrece **deshacerla en el acto**, sin ir a `/historial`. Es un **atajo a la operación de RF-HIST-003** sobre la **misma entrada de historial** que la acción acaba de generar: misma restauración, misma eliminación de la entrada, sin rastro. No es un mecanismo aparte ni una segunda forma de deshacer. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario acaba de editar o eliminar un movimiento propio, o de reabrir un fijo propio, y su aviso de éxito sigue en pantalla. |

**Sin confirmación.** El atajo aplica el deshacer directo. El usuario está a segundos de su propia acción y viendo el nombre del movimiento en el aviso: un paso de confirmación anularía el sentido del atajo. La confirmación de RF-HIST-003 es una exigencia de la superficie `/historial`, donde el usuario puede estar operando sobre un cambio que no recuerda.

**Alcance:**

| Operación | ¿Ofrece el atajo? |
|---|---|
| **Editar** un único, un fijo, un calculado o un grupo de cuotas | Sí |
| **Eliminar** un único, un fijo, un calculado o un grupo de cuotas | Sí |
| **Reabrir** un fijo (RF-MF-008) | Sí |
| **Crear** un movimiento de cualquier forma, incluido duplicar (RF-VM-008) | No — la creación no genera entrada de historial (RF-HIST-001) |
| Crear o eliminar una **simulación** de categoría | No — la simulación queda entera afuera (RF-SIM-004) |
| Anular / des-anular, ABM de categorías y métodos de pago, cambios de preferencias | No — no generan entrada (RF-HIST-001) |

**Un aviso por movimiento.** Una acción nueva sobre el **mismo** movimiento **reemplaza** el aviso anterior; los avisos de movimientos **distintos** conviven en pantalla. Consecuencia: el atajo **nunca puede quedar apuntando a una entrada bloqueada** (RF-HIST-004), porque la entrada que ofrece es siempre la **más reciente** de ese movimiento. El bloqueo LIFO y el desbloqueo en cadena son exclusivos de `/historial`.

**Desenlaces:**

| Resultado | Qué pasa |
|---|---|
| **Éxito** | El aviso informa que el cambio se deshizo. |
| **La entrada ya no existe** (se deshizo antes desde `/historial`) | El aviso informa que ese cambio **ya no está disponible** para deshacer. **No se trata como un error**: es un desenlace esperado. |
| **Falla por otro motivo** (red, servidor) | Se informa el fallo y el atajo **sigue disponible para reintentar**. |

**Criterios de aceptación:**
- [ ] Editar y eliminar ofrecen el atajo en su aviso de éxito, en las **cuatro formas**: único, fijo, calculado y grupo de cuotas. Reabrir un fijo también lo ofrece.
- [ ] El atajo **deshace sin pedir confirmación** y su efecto es idéntico al de deshacer esa misma entrada desde `/historial` (RF-HIST-003): el movimiento vuelve al estado previo, la entrada se borra y no queda rastro.
- [ ] Las **creaciones** —incluida la de duplicar— **no** ofrecen el atajo, y la **simulación** queda fuera por completo (RF-SIM-004).
- [ ] Una acción nueva sobre el **mismo** movimiento reemplaza su aviso anterior; los avisos de movimientos **distintos** conviven.
- [ ] El atajo **nunca ofrece deshacer una entrada bloqueada** (RF-HIST-004).
- [ ] Si la entrada ya no existe, el aviso lo comunica como **no disponible**, no como error.
- [ ] Ante cualquier otro fallo, el atajo **queda disponible para reintentar**.
- [ ] Si el usuario no lo usa, el aviso desaparece solo y el cambio queda aplicado; el atajo sigue disponible desde `/historial` mientras la entrada esté vigente (RF-HIST-005).
