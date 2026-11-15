# 3.5 Módulo: Movimientos en cuotas

> Parte de los requerimientos funcionales de Control. Índice e ID → archivo: `docs/requirements.md`.

Una compra dividida en N pagos mensuales iguales. El usuario ingresa el monto de cada cuota, la cantidad de cuotas y el mes de inicio.

> En v1 las cuotas son **solo Gasto (`EXPENSE`)**: el tab Cuotas **no ofrece** selector de tipo y el tipo no es editable. El "Ingreso en cuotas" está fuera de alcance v1 (ver `definiciones-y-alcance.md` §6).

---

## RF-MC-001 — Crear movimiento en cuotas

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario registra una compra en cuotas. El sistema genera una cuota por mes durante N meses consecutivos desde el mes de inicio. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. Existe al menos una categoría disponible. |

**Flujo principal:**
1. El usuario inicia la carga de un movimiento y selecciona el tipo **Cuotas** (el movimiento es Gasto; no hay selector de tipo).
2. El usuario ingresa el **monto de cada cuota** (no el total de la compra).
3. El usuario ingresa la **cantidad de cuotas** (entero > 0).
4. El usuario selecciona el **mes de inicio**. Default: el **mes contexto** si el formulario se abrió desde la Vista del mes (`/mes`); en cualquier otro origen (dashboard, sidebar), el **mes actual**. Es editable y admite meses pasados.
5. El usuario selecciona una categoría (obligatorio).
6. El usuario ingresa una descripción (opcional).
7. El usuario confirma.
8. El sistema crea el grupo de cuotas, genera una cuota por mes durante N meses, cierra el formulario y muestra un toast de confirmación con la acción "Ir a ver". El toast permite navegar a la vista del mes de inicio de las cuotas. Si el usuario no interactúa con el toast, este desaparece y el usuario permanece en la pantalla en la que estaba.

**Flujos alternativos:**
- *A1 — Monto inválido:* el sistema muestra error de validación y no guarda.
- *A2 — Cantidad de cuotas = 0 o negativa:* el sistema muestra error de validación y no guarda.
- *A3 — El usuario hace clic en "Ir a ver" del toast:* el sistema navega a la vista del mes de inicio de las cuotas.

**Criterios de aceptación:**
- [ ] El campo monto corresponde al monto de cada cuota, no al total.
- [ ] La cantidad de cuotas debe ser un entero mayor a cero.
- [ ] El mes de inicio tiene como default el mes contexto cuando el formulario se abre desde la Vista del mes, y el mes actual en cualquier otro origen. Es editable y admite meses pasados.
- [ ] Aparece exactamente una cuota por mes durante exactamente N meses consecutivos.
- [ ] Todas las cuotas tienen el mismo monto (no hay cuotas variables).
- [ ] Cada cuota en la lista muestra el número de cuota y el total (ej: "3/12").
- [ ] Al guardar, el formulario se cierra y aparece un toast de confirmación.
- [ ] El toast incluye una acción "Ir a ver" que navega a la vista del mes de inicio de las cuotas.
- [ ] Si el usuario no interactúa con el toast, este desaparece automáticamente y el usuario permanece en la pantalla actual.

---

## RF-MC-002 — Eliminar grupo de cuotas

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede eliminar el grupo de cuotas completo. Se eliminan todas las instancias (pasadas y futuras). La eliminación es **lógica** (RF-HIST-006): el grupo deja de aparecer en toda la app y queda **reversible desde el historial** (RF-HIST-003) mientras su entrada esté vigente. Al expirar la entrada, la eliminación es definitiva. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El grupo de cuotas existe y pertenece al usuario autenticado. |

**Flujo principal:**
1. El usuario selecciona la opción eliminar sobre una cuota en la lista del mes.
2. El sistema advierte que se eliminará el **grupo completo** (todas las cuotas).
3. El usuario confirma.
4. El sistema marca el grupo como eliminado y registra la entrada correspondiente en el historial (RF-HIST-001).

**Criterios de aceptación:**
- [ ] Al eliminar desde cualquier cuota del grupo, se elimina el grupo completo.
- [ ] La confirmación informa explícitamente que se eliminarán todas las cuotas (no solo la del mes visible).
- [ ] Tras confirmar, ninguna cuota del grupo aparece en listados, totales ni reportes (RF-HIST-006).
- [ ] La eliminación queda registrada en el historial (RF-HIST-001) y se puede **deshacer** mientras su entrada esté vigente (RF-HIST-003); al deshacerla, el grupo completo vuelve tal como estaba.
- [ ] Al expirar la entrada del historial, el grupo se borra físicamente y la eliminación es definitiva (RF-HIST-005).
- [ ] Solo se pueden eliminar grupos propios.

**Notas:**
- La cancelación parcial de cuotas (eliminar solo las cuotas restantes) está fuera de scope en v1.

---

## RF-MC-003 — Editar grupo de cuotas

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede editar el grupo de cuotas completo: monto por cuota, cantidad de cuotas, mes de inicio, categoría y descripción. La edición aplica a todas las instancias del grupo. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El grupo de cuotas existe y pertenece al usuario autenticado. |

**Flujo principal:**
1. El usuario selecciona la opción editar sobre una cuota en la lista del mes.
2. El sistema presenta el formulario de edición del grupo con los datos actuales.
3. El usuario modifica uno o más campos: monto por cuota, cantidad de cuotas, mes de inicio, categoría o descripción.
4. El usuario confirma.
5. El sistema actualiza el grupo de cuotas completo y regenera las instancias mensuales según los nuevos valores.

**Flujos alternativos:**
- *A1 — Monto inválido (cero, negativo, no numérico):* el sistema muestra error de validación y no guarda.
- *A2 — Cantidad de cuotas = 0 o negativa:* el sistema muestra error de validación y no guarda.
- *A3 — El usuario cancela:* el grupo de cuotas no se modifica.

**Criterios de aceptación:**
- [ ] Los campos editables son: monto por cuota, cantidad de cuotas, mes de inicio, categoría y descripción. El tipo no es editable (solo Gasto).
- [ ] La edición aplica al grupo completo, no a una cuota individual.
- [ ] El monto por cuota debe ser mayor a cero (misma validación que RF-MC-001).
- [ ] La cantidad de cuotas debe ser un entero mayor a cero (misma validación que RF-MC-001).
- [ ] Al cambiar la cantidad de cuotas o el mes de inicio, el sistema recalcula en qué meses aparecen las cuotas.
- [ ] Solo se pueden editar grupos propios.

---

## RF-MC-004 — Anular una cuota en un mes puntual (skip)

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede **anular** la instancia de una cuota en un **mes puntual**, sin eliminar el grupo. Es una acción **reversible** (toggle anular / des-anular) que anula **solo la cuota de ese mes**; las demás cuotas del grupo no se tocan. La cuota anulada se sigue mostrando, pero **no suma** a los totales del mes ni a los reportes. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El grupo de cuotas existe, la cuota aparece en el mes visualizado y pertenece al usuario autenticado. |

**Flujo principal:**
1. El usuario, parado en un mes en la Vista del mes (`/mes`), abre el menú de acciones (kebab) del ítem de una cuota.
2. El usuario selecciona la acción **"Anular este mes"**.
3. El sistema marca esa instancia mensual de la cuota como anulada, sin afectar el resto del grupo.
4. El ítem **se sigue mostrando** en la lista con su diferenciación visual de anulado, **deja de sumar** a los totales del mes y a los reportes.

**Flujos alternativos:**
- *A1 — Des-anular (toggle):* sobre una cuota ya anulada en ese mes, la acción se rotula **"Des-anular este mes"**; al activarla, la instancia vuelve a contar y el ítem pierde la diferenciación visual de anulado.

**Criterios de aceptación:**
- [ ] La acción de anular / des-anular vive en el **menú de acciones (kebab)** del ítem de la cuota, con rótulo **"Anular este mes"** / **"Des-anular este mes"** (anula **una** instancia mensual, no el grupo entero; sin modal de alcance, a diferencia del fijo — RF-MF-005).
- [ ] La acción es un **toggle reversible**: anular crea la anulación de ese mes; des-anular la quita. Se puede ir y volver indefinidamente.
- [ ] Anular una cuota en un mes **no** afecta las demás cuotas del grupo ni las anula: solo esa instancia mensual.
- [ ] Una cuota anulada **se sigue mostrando** en la lista con diferenciación visual, y su monto **no suma** a los totales del mes (RF-VM-002, RF-DASH-002) **ni** a los reportes (RF-REP-001) — mismo efecto que la anulación de un fijo (RN-016), formalizado en RN-020.
- [ ] Los **calculados** derivados de una cuota anulada **heredan** su estado de anulación para ese mes: no tienen skip propio (RF-MCALC-005).
- [ ] Solo se pueden anular cuotas de grupos propios.

**Notas:**
- El detalle visual del ítem anulado y del control de la acción lo define `control-design` (`docs/design.md`).
- La anulación de una cuota se modela como un registro aparte `(grupo, mes)` —espejo de la anulación de un fijo—, distinto de eliminar el grupo (RF-MC-002). Ver `docs/data-model/entidades.md`, entidad Anulación de cuota (InstallmentSkip), y RN-020.

---

## RF-MC-005 — Total del plan de cuotas

| Campo | Detalle |
|---|---|
| **Descripción** | Las superficies que exponen información de un grupo de cuotas muestran, además del monto por cuota, el **total del plan** = **monto por cuota × cantidad de cuotas**. Es un dato **derivado en el frontend**: no se persiste ni lo provee el backend. Como las cuotas son N pagos iguales y el monto del grupo es el **monto por cuota** (RF-MC-001), el producto es exacto. Es **informativo**. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Baja |
| **Precondiciones** | Existe un grupo de cuotas propio del usuario, o el usuario está cargando/editando uno en el formulario. |

**Superficies donde aparece:**
- **Card de detalle del movimiento** de `/mes` (RF-VM-007), junto al plan de la cuota.
- **Tooltip de barra** del reporte anual de Cuotas (RF-REP-011).
- **Formulario de alta/edición de cuotas**, que además lo **previsualiza mientras el usuario tipea** monto por cuota y cantidad de cuotas.

**Moneda:** cuando la moneda del movimiento difiere de la default, el total del plan se expresa en la **moneda original del movimiento** y **no se convierte**. La cotización guardada del grupo (RF-CUR-004) es la del momento de la carga; extrapolarla a todas las cuotas del plan produciría una cifra que no corresponde a plata real de ningún mes. En el reporte anual de Cuotas la ambigüedad no se presenta: el monto de la barra viene en la **moneda de display de la card** (RF-REP-007) y el total se expresa en esa misma moneda.

**Criterios de aceptación:**
- [ ] El total es `monto por cuota × cantidad de cuotas`, calculado en el frontend con datos que la superficie ya tiene; no hay campo persistido ni provisto por el backend.
- [ ] Se muestra en la card de detalle de `/mes`, en el tooltip de barra del reporte anual de Cuotas y en el formulario de alta/edición de cuotas.
- [ ] En la **card** y en el **tooltip** se **omite** cuando el plan tiene **una sola cuota** (sería idéntico a la cifra ya mostrada).
- [ ] En el **formulario** se actualiza en vivo al editar monto por cuota o cantidad de cuotas, antes de guardar.
- [ ] Con moneda distinta de la default, el total va en la **moneda original del movimiento**, sin convertir; en el reporte, en la moneda de display de la card.
- [ ] El total es **informativo**: no valida, no bloquea el guardado y no tiene tope propio. El tope de monto (RN-023) aplica **solo** al monto por cuota.

**Notas:**
- La presentación visual del total en cada superficie la define `control-design` (`docs/design.md`).
