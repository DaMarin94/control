# 3.6.b Submódulo: Métodos de pago

> Parte de los requerimientos funcionales de Control. Índice e ID → archivo: `docs/requirements.md`. Contrato de API: `docs/data-model/metodos-pago.md`.

Un método de pago clasifica **con qué se pagó o cobró** un movimiento (tarjeta de crédito, débito, efectivo). Es una entidad **espejo de Categoría**: propia del usuario, con soft delete (el histórico conserva la referencia), gestor dedicado como **sección del hub de Configuración** (`/configuracion/metodos-pago`) y contador de movimientos. La asociación de un movimiento a un método es **opcional**. La identidad visual del método es un **ícono** (no un color); el set de íconos y su cromo los define `control-design` (ver `docs/design.md`, §Métodos de pago — identificador de ícono). La regla de negocio compacta vive en RN-021.

> La cuenta nueva **nace sin métodos de pago**: la feature es 100% opcional (a diferencia de las categorías por defecto, RF-CAT-001).

---

## RF-PM-001 — Crear método de pago

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario crea un método de pago con nombre, tipo (obligatorio, sin preselección), ícono y los campos condicionales que dicta el tipo. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Flujo principal:**
1. El usuario abre el modal "Nuevo método de pago" desde la sección Métodos de pago de Configuración (`/configuracion/metodos-pago`). El modal abre **sin tipo elegido**.
2. Ingresa el nombre (obligatorio).
3. Elige el **tipo**: **Crédito** / **Débito** / **Efectivo** (obligatorio, sin default — hasta elegir uno no se puede guardar).
4. Según el tipo, el modal muestra los campos condicionales:
   - **Crédito:** día de cierre y día de cobro (día del mes 1-31, opcionales; informativos).
   - **Débito:** sin campos extra (idéntico a Efectivo).
   - **Efectivo:** sin campos extra.
5. Elige el ícono del set curado (default `card`).
6. Confirma.
7. El sistema verifica que el nombre **normalizado** (RN-014) no colisione con otro método del usuario y crea el método.

**Flujos alternativos:**
- *A1 — Nombre vacío:* error de validación, no crea.
- *A2 — Sin tipo elegido:* el guardado queda bloqueado (el tipo es obligatorio y no tiene preselección).
- *A3 — Colisión con un método activo del mismo nombre normalizado:* bloquea la creación como duplicado (espejo RN-008).
- *A4 — Colisión con un método eliminado (soft delete) del mismo nombre normalizado:* propone **reactivar** el método eliminado mediante un prompt Reactivar / Cancelar (espejo exacto de RF-CAT-002 A3); al reactivar, la fila vuelve con su configuración original (mismo `id`, tipo, ícono y campos), ignorando lo tipeado.

**Criterios de aceptación:**
- [ ] Nombre y tipo son obligatorios; el modal abre **sin tipo preseleccionado** y no permite guardar hasta elegir Crédito / Débito / Efectivo.
- [ ] El tipo se persiste como allowlist `CREDIT` / `DEBIT` / `CASH` (rótulos UI en español); ver RN-021.
- [ ] Los campos condicionales son los del tipo elegido (crédito → días de cierre/cobro; débito y efectivo → ninguno).
- [ ] Día de cierre y día de cobro son enteros **1-31**; si el valor supera el último día del mes, se aplica al **último día del mes** (clamp). Son **informativos**: no mueven el mes de imputación del gasto en v1 (RN-021).
- [ ] El ícono sale del set curado (allowlist en código); default `card`. **Sin botón "aleatorio"** (decisión de `control-design`).
- [ ] La unicidad de nombre es **espejo de categorías**: normalización RN-014 (trim, insensible a mayúsculas y acentos) y flujo crear-o-reactivar sobre un método soft-deleted homónimo (RF-CAT-002 A3).
- [ ] La cuenta nueva no trae métodos por defecto: la lista arranca vacía.

---

## RF-PM-002 — Editar método de pago

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede modificar nombre, tipo, ícono y los campos condicionales de un método de pago. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El método existe y pertenece al usuario autenticado. |

**Criterios de aceptación:**
- [ ] Son editables: nombre, tipo, ícono y los campos condicionales del tipo vigente.
- [ ] El **tipo es editable** tras crear. Al **cambiar de tipo** se **descartan** los campos condicionales que ya no aplican (p. ej. de Crédito a Débito o Efectivo se descartan día de cierre/cobro).
- [ ] La unicidad de nombre aplica igual que en la creación (RN-014, RN-008).
- [ ] Los movimientos ya asociados reflejan automáticamente el nuevo nombre, ícono y tipo (referencia por `id`).
- [ ] Solo se pueden editar métodos propios.

---

## RF-PM-003 — Eliminar método de pago

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede eliminar un método de pago. La eliminación es lógica (soft delete): desaparece de la lista y del selector, pero los movimientos históricos conservan la referencia. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El método existe y pertenece al usuario autenticado. |

**Criterios de aceptación:**
- [ ] El sistema solicita confirmación antes de eliminar.
- [ ] El método eliminado no aparece en la lista de la sección Métodos de pago (`/configuracion/metodos-pago`) ni en el selector de método del formulario de carga.
- [ ] Los movimientos que tenían ese método conservan la referencia y siguen mostrándolo.
- [ ] La eliminación es lógica (`deletedAt`); un método eliminado puede **reactivarse** vía crear-o-reactivar (RF-PM-001 A4).
- [ ] Eliminar un método **no afecta** los totales del mes, el balance ni los reportes: el método es metadato, no entra a ningún cálculo de dinero (el único conteo que cambia es el contador "N movimientos", RF-PM-005).
- [ ] Solo se pueden eliminar métodos propios.

---

## RF-PM-004 — Ícono identificador del método

| Campo | Detalle |
|---|---|
| **Descripción** | Cada método de pago tiene un **ícono** de un set curado, elegido por el usuario. El ícono es la **única identidad visual** del método — no hay campo de color. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Baja |
| **Precondiciones** | Se crea o edita un método de pago. |

**Criterios de aceptación:**
- [ ] El ícono se elige de un **set curado** (allowlist en código); no hay ingreso libre.
- [ ] Al **crear**, el default es `card`; al **editar**, el picker abre con el ícono actual del método.
- [ ] **No hay campo de color**: el ícono reemplaza al color como identidad (a diferencia de las categorías, RF-CAT-005). Decisión de `control-design`.
- [ ] Una marca no disponible en el set cae al genérico `card` (fallback).
- [ ] El ícono es solo de presentación: no afecta montos, imputación ni ninguna regla de negocio.
- [ ] El set concreto de íconos y el cromo del picker los define `control-design` (`docs/design.md`).

---

## RF-PM-005 — Contador de movimientos por método

| Campo | Detalle |
|---|---|
| **Descripción** | En la pantalla de gestión de métodos de pago, cada método muestra la cantidad de movimientos asociados. Es un dato derivado de solo lectura. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Baja |
| **Precondiciones** | El usuario accede a la sección Métodos de pago de Configuración (`/configuracion/metodos-pago`). |

**Criterios de aceptación:**
- [ ] Cada método de la lista muestra un contador "N movimientos" (espejo de RF-CAT-006), suma de los movimientos únicos, fijos y grupos de cuotas que lo referencian.
- [ ] El contador es de solo lectura y muestra cero si el método no tiene movimientos asociados.

---

## RF-PM-006 — Asociar un método de pago a un movimiento

| Campo | Detalle |
|---|---|
| **Descripción** | El formulario de carga permite asociar, **opcionalmente**, un método de pago a cualquier movimiento. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] El formulario de carga tiene un **selector de método de pago opcional** en los tres tabs (Único / Fijo / Cuotas), análogo al selector de categoría, con opción **"(ninguno)"** / vacío y **default = ninguno**. **Sin botón "+ Nueva" inline** (a diferencia de categorías, RF-MU-004).
- [ ] El método es **opcional**: un movimiento puede guardarse sin método (no es error).
- [ ] El selector lista solo métodos **activos** (los soft-deleted no aparecen).
- [ ] Un movimiento **calculado** **hereda** el método de pago de su origen y **no lo puede editar ni tener uno propio** —no se elige ni se persiste propio; se deriva al vuelo del origen—. Mismo patrón que la moneda/cotización del calculado (RF-CUR-004).
- [ ] **Débito automático — atributo del movimiento.** El formulario tiene un **checkbox "débito automático"** que aparece **solo cuando el método elegido para ese movimiento es de tipo `DEBIT`**. Es un flag **del movimiento**, no del método. Aplica a único / fijo / cuota; el **calculado no lo muestra** (lo hereda del origen, no editable). La regla de persistencia está en RN-021.
- [ ] El método asociado se expone en `GET /movements` (nombre + ícono + tipo) para que la Vista del mes lo muestre, y cada movimiento expone `autoDebit` (`boolean | null`) **a nivel del ítem** (fuera del objeto `paymentMethod` embebido); contrato en `docs/data-model/movimientos.md`, §Contrato de movimientos del mes.

---

## RF-PM-007 — Método de pago predeterminado por estructura de movimiento

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede designar un método de pago como **predeterminado por estructura de movimiento** (único / fijo / cuota). Al **crear** un movimiento de esa estructura, el selector de método de pago del formulario arranca prellenado con el default de esa estructura, como valor inicial editable. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Baja |
| **Precondiciones** | El usuario tiene sesión activa. Existe al menos un método de pago activo. |

**Configuración (tres slots independientes):**
- Hay **tres slots** de default —**único**, **fijo**, **cuota**—, independientes; cada uno apunta a **lo sumo un** método de pago activo, o a ninguno.
- Se configuran **dentro del modal de crear/editar método de pago** (el mismo modal de Nombre / Tipo / Ícono), en una sección **"Predeterminado para"** con tres checkboxes de estructura (Únicos / Fijos / Cuotas). Marcar una estructura fija ese método como default de esa estructura; desmarcarla deja la estructura sin default. Aplica tanto al crear como al editar un método.
- La **fila de la lista no edita** el default: muestra solo un **indicador de solo lectura** (estrella + pill por estructura) cuando el método es default de ≥1 estructura, y nada cuando no lo es.
- **Exclusividad por estructura:** un método que toma una estructura la **quita** de cualquier otro (a lo sumo un método default por estructura). Un mismo método **puede** ser default de varias estructuras a la vez. La exclusividad se **resuelve al guardar el modal**, no en vivo mientras se marcan los checkboxes.
- Al **crear**, los checkboxes arrancan destildados y la asignación se aplica **después de crear el método** (con el id nuevo).
- Al guardar, si el método toma ≥1 estructura que tenía otro método, se muestra un **toast `info` consolidado** con las reasignaciones, además del toast de éxito del CRUD.

**Prefill (solo al crear, editable):**
- El prefill aplica **por estructura, tanto a egresos como a ingresos** (el default es de la estructura, no del sentido gasto/ingreso).
- Es solo el **valor inicial** del selector: el usuario puede cambiarlo a otro método o dejarlo en "Sin método de pago".
- **No** aplica en **edición**: ahí el selector carga el método guardado del propio movimiento.
- **No** aplica a movimientos **calculados**: heredan el método del origen y no tienen selector propio (RF-PM-006).

**Fallback en lectura:**
- El id guardado en cada slot se **valida contra los métodos de pago activos en cada lectura**; si el método fue eliminado (soft delete), ese slot se trata como "ninguno" y el prefill cae a "Sin método de pago".
- Eliminar un método **no limpia** el blob de preferencias: la validación en lectura es la fuente de verdad.

**Criterios de aceptación:**
- [ ] Los tres slots (único / fijo / cuota) son independientes; cada uno apunta a lo sumo un método activo o a ninguno.
- [ ] La configuración vive en el **modal de crear/editar método** de la sección Métodos de pago (`/configuracion/metodos-pago`, sección "Predeterminado para" del modal), no en la sección General ni en otra sección del hub. La fila de la lista muestra solo un indicador de lectura, no edita.
- [ ] Marcar una estructura en un método la quita de cualquier otro; un método puede ser default de varias estructuras a la vez. La exclusividad se resuelve al guardar el modal.
- [ ] Al crear un método, los checkboxes arrancan destildados y la asignación se aplica con el id nuevo; si al guardar se reasigna alguna estructura, se muestra un toast `info` consolidado además del toast de éxito.
- [ ] Al **crear** un movimiento de una estructura con default, el selector de método arranca con ese default (egreso e ingreso por igual), editable.
- [ ] El prefill es solo el valor inicial y no pisa una selección hecha manualmente por el usuario.
- [ ] En **edición** el selector carga el método guardado del movimiento, no el default.
- [ ] Un movimiento **calculado** no recibe prefill (hereda del origen, RF-PM-006).
- [ ] Si el método guardado en un slot fue eliminado, ese slot se trata como "ninguno" y el prefill cae a "Sin método de pago"; el blob no se limpia al borrar el método.

**Notas:**
- Persistencia en el blob `UserPreferences` (clave `defaultPaymentMethods`), que el backend no interpreta; shape y semántica en `docs/data-model/preferencias.md`, §`defaultPaymentMethods`.
- El detalle visual de la sección "Predeterminado para" del modal y del indicador de lectura en la fila lo define `control-design`.
