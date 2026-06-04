# Requerimientos Funcionales — Control v1.0

> Documento de referencia para el desarrollo de Control v1.0.
> Para la visión del producto ver `product.md`. Para el modelo de datos ver `data-model.md`. Para el estado de implementación ver `features.md`.

---

## 1. Introducción

### 1.1 Propósito

Este documento describe los requerimientos funcionales de **Control v1.0**, una aplicación web personal para el registro y seguimiento de gastos e ingresos. Define qué debe hacer el sistema, bajo qué condiciones, y los criterios verificables para considerar cada requerimiento cumplido.

### 1.2 Alcance

Cubre exclusivamente la plataforma **web** de Control en su versión 1.0. La plataforma mobile está fuera de scope.

### 1.3 Definiciones y abreviaturas

| Término | Definición |
|---|---|
| Movimiento | Registro de una transacción económica: gasto o ingreso |
| Gasto (`EXPENSE`) | Egreso de dinero |
| Ingreso (`INCOME`) | Entrada de dinero |
| Movimiento único | Movimiento que ocurrió una sola vez en una fecha específica |
| Movimiento fijo | Plantilla recurrente que genera un ítem en cada mes mientras esté activa |
| Cuota | Instancia mensual de una compra dividida en N pagos iguales |
| Grupo de cuotas | Registro padre que define el monto, cantidad y mes de inicio de las cuotas |
| Categoría | Clasificador asignado a cada movimiento (ej: Consumibles, Servicios) |
| Balance del mes | Resultado de ingresos − gastos en un mes |
| Mes activo | Mes actualmente visualizado en la vista del mes |
| RF | Requerimiento Funcional |
| RNF | Requerimiento No Funcional |

### 1.4 Versiones del documento

| Versión | Fecha | Descripción |
|---|---|---|
| 1.0 | 2026-06-03 | Versión inicial |

---

## 2. Descripción general del sistema

### 2.1 Perspectiva del sistema

Control es una aplicación web de uso personal para registrar y visualizar movimientos de dinero organizados por mes. No es un sistema contable: su foco es la **previsibilidad** — ver en qué se va el dinero y detectar patrones mes a mes.

El sistema se compone de:

- **Frontend:** Next.js 15 + Tailwind CSS v4 (puerto 3000)
- **Backend:** NestJS + TypeScript + PostgreSQL + Prisma (puerto 3001)
- **Auth:** Auth.js (NextAuth v5) con Google OAuth

### 2.2 Usuarios del sistema

| Actor | Descripción |
|---|---|
| Usuario autenticado | Persona que inició sesión con su cuenta de Google. Es el único actor del sistema en v1. |

No hay roles, administradores ni usuarios invitados. Un usuario accede exclusivamente a sus propios datos.

### 2.3 Supuestos y dependencias

- El usuario dispone de una cuenta de Google activa.
- La app opera sobre una moneda implícita (sin selector de moneda en v1).
- El usuario registra sus movimientos manualmente — no hay integración bancaria.
- Los movimientos fijos y cuotas se calculan on-the-fly al consultar un mes; no se generan filas individuales por instancia mensual.

### 2.4 Restricciones de diseño

- Los montos se almacenan en **centavos** (entero sin decimales) para evitar errores de punto flotante.
- Todos los recursos están **aislados por usuario**: el backend filtra siempre por el `userId` del JWT activo.
- La `date` de un movimiento único es la fecha elegida por el usuario, no el timestamp de creación.
- No se implementa `currency` en v1, pero el modelo lo permite agregar sin romper datos existentes.

---

## 3. Requerimientos funcionales

---

### 3.1 Módulo: Autenticación

---

#### RF-AUTH-001 — Inicio de sesión con Google OAuth

| Campo | Detalle |
|---|---|
| **Descripción** | El sistema permite iniciar sesión mediante Google OAuth 2.0. |
| **Actor** | Usuario no autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario no tiene sesión activa. Tiene una cuenta de Google válida. |

**Flujo principal:**
1. El usuario accede a la aplicación.
2. El sistema detecta que no hay sesión y muestra la pantalla de login.
3. El usuario hace clic en "Iniciar sesión con Google".
4. El sistema redirige al flujo OAuth de Google.
5. El usuario autoriza el acceso.
6. Google redirige al sistema con el código de autorización.
7. El sistema crea o actualiza el registro del usuario (email, nombre, avatar).
8. El sistema crea una sesión y redirige al dashboard.

**Flujos alternativos:**
- *A1 — El usuario cancela en Google:* el sistema vuelve a mostrar la pantalla de login.
- *A2 — Error en el flujo OAuth:* el sistema muestra un mensaje de error y permite reintentar.

**Criterios de aceptación:**
- [ ] Completar el flujo OAuth exitosamente redirige al dashboard con sesión activa.
- [ ] Si es la primera vez que el usuario ingresa, el sistema crea su registro automáticamente.
- [ ] Si el usuario ya existe, el sistema actualiza nombre e imagen si cambiaron.
- [ ] Al crear la cuenta por primera vez, el sistema genera las categorías por defecto (ver RF-CAT-001).

---

#### RF-AUTH-002 — Protección de rutas

| Campo | Detalle |
|---|---|
| **Descripción** | Ninguna ruta protegida es accesible sin sesión activa. |
| **Actor** | Sistema |
| **Prioridad** | Alta |
| **Precondiciones** | — |

**Flujo principal:**
1. Un usuario sin sesión intenta acceder a una URL protegida.
2. El sistema redirige a la pantalla de login.
3. Tras autenticarse, el sistema redirige a la URL original solicitada.

**Criterios de aceptación:**
- [ ] Acceder sin sesión a cualquier ruta protegida redirige a `/login`.
- [ ] Tras autenticarse, el usuario llega a la ruta que intentaba visitar.
- [ ] La pantalla de login es la única accesible sin autenticación.

---

#### RF-AUTH-003 — Sesión persistente

| Campo | Detalle |
|---|---|
| **Descripción** | La sesión persiste entre visitas. No se solicita login en cada apertura de la app. |
| **Actor** | Sistema |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario inició sesión previamente. |

**Criterios de aceptación:**
- [ ] Cerrar el navegador y volver a abrir la app no requiere hacer login nuevamente.
- [ ] La sesión expira pasado el período de inactividad configurado en Auth.js.

---

#### RF-AUTH-004 — Cierre de sesión

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede cerrar su sesión en cualquier momento. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa. |

**Flujo principal:**
1. El usuario selecciona la opción "Cerrar sesión".
2. El sistema invalida la sesión.
3. El sistema redirige a la pantalla de login.

**Criterios de aceptación:**
- [ ] La opción de cerrar sesión está disponible desde cualquier pantalla.
- [ ] Tras cerrar sesión, las rutas protegidas redirigen a login.
- [ ] El token queda invalidado — no se puede reutilizar.

---

### 3.2 Módulo: Dashboard

---

#### RF-DASH-001 — Pantalla principal

| Campo | Detalle |
|---|---|
| **Descripción** | El dashboard es la pantalla de inicio. Se muestra al autenticarse y centraliza el acceso a las funciones principales. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] Al iniciar sesión, el sistema redirige automáticamente al dashboard.
- [ ] El dashboard muestra siempre el mes actual — no tiene navegación entre meses.
- [ ] El dashboard contiene acceso directo para cargar un nuevo movimiento (RF-DASH-003).
- [ ] El dashboard incluye acceso a la vista del mes completa (RF-DASH-005).

---

#### RF-DASH-002 — Resumen financiero del mes actual

| Campo | Detalle |
|---|---|
| **Descripción** | El dashboard muestra los totales del mes en curso: total de gastos, total de ingresos y balance. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] Se muestra el total de gastos del mes actual.
- [ ] Se muestra el total de ingresos del mes actual.
- [ ] Se muestra el balance del mes (ingresos − gastos).
- [ ] Los totales incluyen movimientos únicos, fijos activos en el mes y cuotas que caen en el mes.
- [ ] Si no hay movimientos, los totales se muestran en cero.

---

#### RF-DASH-003 — Acceso rápido a nuevo movimiento

| Campo | Detalle |
|---|---|
| **Descripción** | El dashboard expone un acceso directo y visible para cargar un nuevo movimiento. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] Existe un botón claramente visible para iniciar la carga de un movimiento.
- [ ] La acción abre el formulario de carga sin pasos intermedios.
- [ ] La acción está disponible en un máximo de 2 interacciones desde cualquier pantalla.

---

#### RF-DASH-004 — Últimos movimientos del mes

| Campo | Detalle |
|---|---|
| **Descripción** | El dashboard muestra los últimos movimientos registrados en el mes actual. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] Se muestran los últimos 5 movimientos del mes (ordenados por fecha, más reciente primero).
- [ ] Cada ítem muestra: tipo (gasto/ingreso), monto y categoría.
- [ ] Si no hay movimientos, el área se muestra vacía sin error.

---

#### RF-DASH-005 — Acceso a la vista del mes completa

| Campo | Detalle |
|---|---|
| **Descripción** | El dashboard ofrece un enlace para acceder a la vista del mes con todos los movimientos. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] Existe un enlace "Ver todos" (o equivalente) que lleva a la vista del mes.
- [ ] La vista del mes se abre mostrando el mes actual.

---

### 3.3 Módulo: Movimientos únicos

Un movimiento único es un gasto o ingreso que ocurrió una sola vez en una fecha específica. Es el tipo de movimiento más simple.

> Al crear un movimiento, el usuario elige primero el tipo de registro: **único**, **fijo** o **cuotas**. Los módulos 3.3, 3.4 y 3.5 cubren cada tipo por separado.

---

#### RF-CM-001 — Formulario de carga de movimiento

| Campo | Detalle |
|---|---|
| **Descripción** | La carga de un movimiento se realiza mediante un formulario con tabs, uno por tipo. El contenido cambia según el tab activo. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario activó la acción "nuevo movimiento" (desde el dashboard u otra pantalla). |

**Flujo principal:**
1. El sistema presenta un formulario (modal o pantalla) con tres tabs: **Único**, **Fijo**, **Cuotas**.
2. El tab **Único** está activo por defecto.
3. El usuario selecciona el tab que corresponde al tipo de movimiento a cargar.
4. El formulario muestra los campos del tipo seleccionado.
5. El usuario completa el formulario y confirma (ver RF-MU-001, RF-MF-001, RF-MC-001 según el tipo).

**Criterios de aceptación:**
- [ ] El formulario presenta exactamente tres tabs: Único, Fijo, Cuotas.
- [ ] El tab Único está activo por defecto al abrir el formulario.
- [ ] Cambiar de tab limpia el formulario — no se conservan datos del tab anterior.
- [ ] El formulario es accesible desde el dashboard y desde la vista del mes.
- [ ] El usuario puede cancelar y cerrar el formulario desde cualquier tab sin guardar nada.

---

#### RF-MU-001 — Crear movimiento único

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario registra un movimiento único con tipo (gasto/ingreso), monto, categoría, fecha y descripción opcional. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa. Existe al menos una categoría disponible. |

**Flujo principal:**
1. El usuario inicia la carga de un movimiento y selecciona el tipo **Único**.
2. El usuario selecciona: **Gasto** o **Ingreso**.
3. El usuario ingresa el monto (obligatorio).
4. El usuario selecciona una categoría (obligatorio).
5. El usuario confirma o modifica la fecha (default: hoy).
6. El usuario ingresa una descripción (opcional).
7. El usuario confirma.
8. El sistema guarda el movimiento y lo muestra en la vista del mes correspondiente.

**Flujos alternativos:**
- *A1 — Monto inválido (cero, negativo, no numérico):* el sistema muestra error de validación y no guarda.
- *A2 — Sin categoría seleccionada:* el sistema muestra error de validación y no guarda.
- *A3 — El usuario cancela:* no se guarda nada y se vuelve a la pantalla anterior.

**Criterios de aceptación:**
- [ ] Tipo, monto y categoría son obligatorios. Descripción es opcional.
- [ ] La fecha tiene como valor por defecto el día actual y es editable.
- [ ] No se puede guardar un movimiento con monto igual a cero o negativo.
- [ ] El movimiento aparece inmediatamente en la vista del mes correspondiente a su fecha.
- [ ] El monto se almacena en centavos (entero).
- [ ] Las categorías con soft delete no aparecen en el selector.

---

#### RF-MU-002 — Editar movimiento único

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
- [ ] Todos los campos son editables: tipo, monto, categoría, fecha, descripción.
- [ ] Las validaciones de RF-MU-001 aplican en la edición.
- [ ] Si se cambia la fecha a otro mes, el movimiento deja de aparecer en el mes original y aparece en el nuevo mes.
- [ ] Solo se pueden editar movimientos propios.

---

#### RF-MU-003 — Eliminar movimiento único

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede eliminar un movimiento único. La eliminación es permanente. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El movimiento existe y pertenece al usuario autenticado. |

**Flujo principal:**
1. El usuario selecciona la opción eliminar sobre un movimiento único.
2. El sistema solicita confirmación.
3. El usuario confirma.
4. El sistema elimina el movimiento permanentemente.
5. El movimiento desaparece de la lista inmediatamente.

**Flujos alternativos:**
- *A1 — El usuario cancela la confirmación:* el movimiento no se elimina.

**Criterios de aceptación:**
- [ ] El sistema solicita confirmación antes de eliminar.
- [ ] Tras confirmar, el movimiento desaparece de la lista.
- [ ] La eliminación es permanente (no hay opción de deshacer).
- [ ] Solo se pueden eliminar movimientos propios.

---

### 3.4 Módulo: Movimientos fijos

Un movimiento fijo es una plantilla recurrente mensual: sueldo, alquiler, Netflix. Aparece automáticamente en cada mes desde su inicio hasta que el usuario lo elimina. No tiene día específico dentro del mes.

---

#### RF-MF-001 — Crear movimiento fijo

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario registra un movimiento fijo que se repetirá en todos los meses desde el mes actual en adelante. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. Existe al menos una categoría disponible. |

**Flujo principal:**
1. El usuario inicia la carga de un movimiento y selecciona el tipo **Fijo**.
2. El usuario selecciona: **Gasto** o **Ingreso**.
3. El usuario ingresa el monto (obligatorio).
4. El usuario selecciona una categoría (obligatorio).
5. El usuario ingresa una descripción (opcional).
6. El usuario confirma.
7. El sistema crea el movimiento fijo con `startMonth` igual al mes actual.

**Criterios de aceptación:**
- [ ] Un movimiento fijo creado en junio aparece en junio, julio, agosto, y todos los meses siguientes.
- [ ] El movimiento fijo no tiene fecha de día — aparece como ítem mensual sin día específico.
- [ ] Las validaciones de monto (> 0) aplican igual que en RF-MU-001.
- [ ] Las categorías con soft delete no aparecen en el selector.

---

#### RF-MF-002 — Visualización de movimiento fijo en el mes

| Campo | Detalle |
|---|---|
| **Descripción** | El sistema incluye automáticamente los movimientos fijos activos en cada mes consultado, sin acción del usuario. |
| **Actor** | Sistema |
| **Prioridad** | Media |
| **Precondiciones** | Existe al menos un movimiento fijo activo. |

**Criterios de aceptación:**
- [ ] Un fijo activo aparece en todos los meses desde `startMonth` inclusive.
- [ ] Un fijo con `deletedFrom` definido no aparece en ese mes ni en los siguientes.
- [ ] Si `deletedFrom` es el mes siguiente al actual, el fijo aún aparece en el mes actual.
- [ ] El movimiento fijo se distingue visualmente como "fijo" en la lista del mes.

---

#### RF-MF-003 — Editar movimiento fijo

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede editar monto, categoría o descripción de un movimiento fijo. Los cambios aplican desde el mes actual en adelante; los meses pasados no se tocan. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El movimiento fijo existe, está activo y pertenece al usuario autenticado. |

**Flujo principal:**
1. El usuario selecciona un movimiento fijo desde la vista del mes.
2. El sistema presenta el formulario de edición con los datos actuales.
3. El usuario modifica monto, categoría o descripción.
4. El usuario confirma.
5. El sistema actualiza el movimiento fijo.

**Criterios de aceptación:**
- [ ] Los campos editables son: monto, categoría, descripción.
- [ ] Los cambios se reflejan en el mes actual y en todos los meses futuros.
- [ ] Los meses anteriores al actual no sufren ningún cambio.
- [ ] Las validaciones de monto (> 0) aplican en la edición.

**Notas:**
- La edición retroactiva de un mes pasado específico de un fijo está fuera de scope en v1.

---

#### RF-MF-004 — Eliminar movimiento fijo

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede eliminar un movimiento fijo con la opción de que aplique desde el mes siguiente (default) o desde el mes actual. Los meses pasados nunca se modifican. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El movimiento fijo existe, está activo y pertenece al usuario autenticado. |

**Flujo principal:**
1. El usuario selecciona la opción eliminar sobre un movimiento fijo.
2. El sistema muestra una confirmación con un checkbox:
   - ☐ *"Eliminar también desde este mes"* — desmarcado por defecto.
3. El usuario decide si marcar el checkbox y confirma.
4. **Checkbox desmarcado:** el fijo deja de aparecer desde el mes siguiente. Sigue visible en el mes actual.
5. **Checkbox marcado:** el fijo deja de aparecer desde el mes actual inclusive.
6. En ambos casos, los meses anteriores al actual no cambian.

**Flujos alternativos:**
- *A1 — El usuario cancela:* el movimiento fijo sigue sin cambios.

**Criterios de aceptación:**
- [ ] La confirmación muestra el checkbox "Eliminar también desde este mes", desmarcado por defecto.
- [ ] Con checkbox desmarcado: el fijo aparece en el mes actual y desaparece en el siguiente.
- [ ] Con checkbox marcado: el fijo no aparece en el mes actual ni en los siguientes.
- [ ] En ningún caso se modifican meses anteriores al actual.
- [ ] Solo se pueden eliminar movimientos fijos propios.

---

### 3.5 Módulo: Movimientos en cuotas

Una compra o cobro dividido en N pagos mensuales iguales. El usuario ingresa el monto de cada cuota, la cantidad de cuotas y el mes de inicio.

---

#### RF-MC-001 — Crear movimiento en cuotas

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario registra una compra en cuotas. El sistema genera una cuota por mes durante N meses consecutivos desde el mes de inicio. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. Existe al menos una categoría disponible. |

**Flujo principal:**
1. El usuario inicia la carga de un movimiento y selecciona el tipo **Cuotas**.
2. El usuario selecciona: **Gasto** o **Ingreso**.
3. El usuario ingresa el **monto de cada cuota** (no el total de la compra).
4. El usuario ingresa la **cantidad de cuotas** (entero > 0).
5. El usuario selecciona el **mes de inicio** (default: mes actual).
6. El usuario selecciona una categoría (obligatorio).
7. El usuario ingresa una descripción (opcional).
8. El usuario confirma.
9. El sistema crea el grupo de cuotas y genera una cuota por mes durante N meses.

**Flujos alternativos:**
- *A1 — Monto inválido:* el sistema muestra error de validación y no guarda.
- *A2 — Cantidad de cuotas = 0 o negativa:* el sistema muestra error de validación y no guarda.

**Criterios de aceptación:**
- [ ] El campo monto corresponde al monto de cada cuota, no al total.
- [ ] La cantidad de cuotas debe ser un entero mayor a cero.
- [ ] El mes de inicio tiene como default el mes actual y es editable.
- [ ] Aparece exactamente una cuota por mes durante exactamente N meses consecutivos.
- [ ] Todas las cuotas tienen el mismo monto (no hay cuotas variables).
- [ ] Cada cuota en la lista muestra el número de cuota y el total (ej: "3/12").

---

#### RF-MC-002 — Eliminar grupo de cuotas

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede eliminar el grupo de cuotas completo. Se eliminan todas las instancias (pasadas y futuras). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El grupo de cuotas existe y pertenece al usuario autenticado. |

**Flujo principal:**
1. El usuario selecciona la opción eliminar sobre una cuota en la lista del mes.
2. El sistema advierte que se eliminará el **grupo completo** (todas las cuotas).
3. El usuario confirma.
4. El sistema elimina el grupo de cuotas.

**Criterios de aceptación:**
- [ ] Al eliminar desde cualquier cuota del grupo, se elimina el grupo completo.
- [ ] La confirmación informa explícitamente que se eliminarán todas las cuotas (no solo la del mes visible).
- [ ] La eliminación es permanente.
- [ ] Solo se pueden eliminar grupos propios.

**Notas:**
- La cancelación parcial de cuotas (eliminar solo las cuotas restantes) está fuera de scope en v1.

---

### 3.6 Módulo: Categorías

Las categorías clasifican los movimientos. Son personalizables por usuario y tienen un scope que define a qué tipo de movimiento aplican.

---

#### RF-CAT-001 — Categorías por defecto al crear cuenta

| Campo | Detalle |
|---|---|
| **Descripción** | Al registrarse por primera vez, el sistema crea automáticamente un conjunto de categorías por defecto. |
| **Actor** | Sistema |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario inicia sesión por primera vez (cuenta nueva). |

**Criterios de aceptación:**
- [ ] Al crear la cuenta, el sistema genera las siguientes categorías con `scope: BOTH`:
  - Consumibles
  - Tarjeta de crédito
  - Gastos fijos
  - Servicios
- [ ] Estas categorías son propiedad del usuario y se pueden editar o eliminar como cualquier otra.
- [ ] No se generan categorías duplicadas si el usuario ya existe.

---

#### RF-CAT-002 — Crear categoría

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede crear nuevas categorías personalizadas. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Flujo principal:**
1. El usuario accede a la gestión de categorías.
2. El usuario ingresa el nombre de la nueva categoría (obligatorio).
3. El usuario selecciona el scope (default: AMBOS).
4. El usuario confirma.
5. La categoría queda disponible para asignar a movimientos.

**Criterios de aceptación:**
- [ ] El nombre es obligatorio y no puede estar vacío.
- [ ] No pueden existir dos categorías activas con el mismo nombre para el mismo usuario.
- [ ] El scope puede ser: AMBOS, GASTO, INGRESO. Default: AMBOS.
- [ ] La categoría creada está disponible inmediatamente en los selectores de movimientos.

---

#### RF-CAT-003 — Editar categoría

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede modificar el nombre y el scope de una categoría existente. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | La categoría existe y pertenece al usuario autenticado. |

**Criterios de aceptación:**
- [ ] El nombre y el scope son editables.
- [ ] No puede quedar con el mismo nombre que otra categoría activa del mismo usuario.
- [ ] Los movimientos ya cargados con esa categoría reflejan automáticamente el nuevo nombre.

---

#### RF-CAT-004 — Eliminar categoría

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede eliminar una categoría. La eliminación es lógica (soft delete): desaparece de los selectores pero los movimientos históricos conservan la referencia. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | La categoría existe y pertenece al usuario autenticado. |

**Flujo principal:**
1. El usuario selecciona la opción eliminar sobre una categoría.
2. El sistema solicita confirmación.
3. El usuario confirma.
4. El sistema marca la categoría como eliminada (`deletedAt = now`).
5. La categoría deja de aparecer en los selectores de nuevos movimientos.

**Flujos alternativos:**
- *A1 — El usuario cancela:* la categoría no se modifica.

**Criterios de aceptación:**
- [ ] La categoría eliminada no aparece en los selectores al crear o editar movimientos.
- [ ] Los movimientos históricos que tenían esa categoría siguen mostrando su nombre.
- [ ] La eliminación es lógica — los datos no se borran de la base de datos.
- [ ] El sistema solicita confirmación antes de eliminar.

---

### 3.7 Módulo: Vista del mes

La vista del mes muestra todos los movimientos del mes seleccionado (únicos, fijos activos y cuotas) con sus totales.

---

#### RF-VM-001 — Listar movimientos del mes

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
- [ ] Cada ítem muestra: tipo (gasto/ingreso), monto, categoría, descripción (si la tiene) y su origen (único / fijo / cuota X/N).
- [ ] Si no hay movimientos en el mes, la lista se muestra vacía sin mostrar error.

---

#### RF-VM-002 — Totales del mes

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

---

#### RF-VM-003 — Acceso a edición y eliminación desde la lista

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede iniciar la edición o eliminación de cualquier movimiento directamente desde la lista del mes. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | Existe al menos un movimiento en la lista. |

**Criterios de aceptación:**
- [ ] Cada ítem de la lista tiene acceso a las acciones editar y eliminar.
- [ ] Al seleccionar editar, se abre el formulario correspondiente (RF-MU-002 o RF-MF-003 según el tipo).
- [ ] Al seleccionar eliminar, se ejecuta el flujo correspondiente (RF-MU-003, RF-MF-004 o RF-MC-002 según el tipo).

---

#### RF-VM-004 — Navegación entre meses

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede navegar al mes anterior o siguiente desde la vista del mes. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario está en la vista del mes. |
| **Estado** | Decidido — aplica a la vista del mes. El dashboard siempre muestra el mes actual. |

**Criterios de aceptación:**
- [ ] Existen controles para avanzar al mes siguiente y retroceder al mes anterior.
- [ ] La lista y los totales se actualizan para reflejar el mes seleccionado.
- [ ] Se muestra el nombre del mes y el año del mes activo.

---

## 4. Reglas de negocio

| ID | Regla |
|---|---|
| RN-001 | El monto de todo movimiento es un entero positivo mayor a cero. El tipo (`EXPENSE` / `INCOME`) define el signo semántico. Nunca se almacenan montos negativos ni cero. |
| RN-002 | Los montos se almacenan en centavos (entero). No se usan números de punto flotante para representar dinero. |
| RN-003 | Todos los recursos (movimientos, categorías) están aislados por `userId`. El backend filtra siempre por el usuario del JWT. Un usuario nunca puede ver ni modificar datos de otro. |
| RN-004 | La `date` de una transacción única es la fecha elegida por el usuario, no el `createdAt`. |
| RN-005 | Editar o eliminar un movimiento fijo no modifica los datos de meses ya pasados. El historial es inmutable. |
| RN-006 | Los movimientos fijos y los grupos de cuotas no generan filas individuales por mes. Se calculan on-the-fly al consultar un período. |
| RN-007 | Una categoría eliminada (soft delete) no aparece en selectores de nuevos movimientos, pero los movimientos históricos conservan la referencia a ella. |
| RN-008 | No pueden coexistir dos categorías activas con el mismo nombre para el mismo usuario. |
| RN-009 | En v1 no hay campo de moneda. El sistema opera sobre una moneda implícita. El diseño permite agregar `currency` en el futuro sin romper datos existentes. |
| RN-010 | El selector de categorías se filtra según el tipo del movimiento en curso: para `EXPENSE` se muestran categorías con scope `EXPENSE` o `BOTH`; para `INCOME` se muestran categorías con scope `INCOME` o `BOTH`. |

---

## 5. Requerimientos no funcionales

| ID | Categoría | Requerimiento |
|---|---|---|
| RNF-001 | Seguridad | Toda request al backend debe incluir un JWT válido. Sin token válido el backend retorna `401 Unauthorized`. |
| RNF-002 | Seguridad | El backend filtra todos los recursos por el `userId` del JWT. No existe endpoint que devuelva datos de otro usuario. |
| RNF-003 | Usabilidad | La acción de cargar un nuevo movimiento debe ser accesible en máximo 2 interacciones desde cualquier pantalla. |
| RNF-004 | Usabilidad | El formulario de carga de movimiento debe poder completarse y guardarse en menos de 30 segundos en condiciones normales. |
| RNF-005 | Performance | La vista del mes debe cargar y mostrar los movimientos en menos de 2 segundos en conexión normal. |
| RNF-006 | Compatibilidad | La aplicación debe funcionar correctamente en las últimas dos versiones de Chrome, Firefox y Safari. |
| RNF-007 | Disponibilidad | La aplicación es web-first. No hay requerimiento de funcionamiento offline en v1. |

---

## 6. Fuera de alcance — v1

Los siguientes features están explícitamente excluidos de v1. Implementar alguno sin decisión explícita rompe el scope.

| Feature | Motivo de exclusión |
|---|---|
| Gráficos (torta, barras, línea) | Requiere definición de UX; no es bloqueante para v1 |
| Vista de historial anual | No es prioridad inicial |
| Tarjetas con fecha de corte | Requiere flujo propio; demasiado complejo para v1 |
| Edición retroactiva de mes pasado de un fijo | Complejidad en el modelo de datos |
| Cancelación parcial de cuotas restantes | Pendiente de definición |
| Ingreso en cuotas | Existe en la realidad; pendiente de definición |
| Multi-moneda | Diseñado para venir después; no hardcodear en v1 |
| Multi-usuario (roles, workspaces) | Sin fecha |
| Importación desde extracto bancario | Sin decisión |
| Filtro por categoría en vista del mes | Sin decisión para v1 |

---

## 7. Glosario

| Término | Definición |
|---|---|
| Balance | Resultado de ingresos − gastos en un período. Puede ser positivo o negativo. |
| Categoría | Clasificador asignado a cada movimiento. Personalizable por usuario. |
| Cuota | Instancia mensual de un grupo de cuotas. Representa un pago parcial de una compra dividida. |
| `deletedFrom` | Primer día del mes desde el cual un movimiento fijo deja de aparecer. Si es `null`, el fijo sigue activo. |
| Gasto (`EXPENSE`) | Egreso de dinero. Reduce el balance del mes. |
| Grupo de cuotas | Registro padre que define monto por cuota, cantidad total de cuotas y mes de inicio. |
| Ingreso (`INCOME`) | Entrada de dinero. Aumenta el balance del mes. |
| Mes activo | Mes actualmente visualizado en la vista del mes. Por defecto, el mes corriente. |
| Movimiento | Registro de una transacción económica. Puede ser único, fijo o una cuota. |
| Movimiento fijo | Plantilla recurrente mensual activa hasta que el usuario la elimina. Sin día específico dentro del mes. |
| Movimiento único | Movimiento que ocurrió en una fecha específica, una sola vez. |
| Scope de categoría | Indica a qué tipo de movimiento aplica la categoría: `BOTH`, `EXPENSE`, o `INCOME`. |
| Soft delete | Eliminación lógica: el registro se marca con `deletedAt` pero no se borra físicamente. |
| `startMonth` | Primer día del mes a partir del cual un movimiento fijo o grupo de cuotas comienza a aparecer. |

---

## 8. Bitácora de decisiones

> Registro cronológico de decisiones cerradas, con fecha y motivo.

**2026-06-03 — Auth en v1 con Google OAuth.** La app requiere login desde el inicio vía Google. Auth.js (NextAuth v5) en Next.js maneja el flujo OAuth; NestJS valida el JWT en cada request. Motivo: uso personal, sin fricción de contraseñas, fácil de mantener.

**2026-06-03 — Gastos e ingresos.** La app registra ambos tipos de movimientos. Motivo: el objetivo es previsibilidad completa del flujo de dinero, no solo de los egresos.

**2026-06-03 — Moneda: no tocar en v1.** No se implementa selección de moneda. En el futuro será 100% switcheable. Motivo: scope acotado para v1; no hardcodear símbolos en la UI de forma difícil de cambiar después.

**2026-06-03 — Categorías personalizables.** El usuario puede crear, editar y eliminar sus propias categorías. Hay categorías por defecto al crear la cuenta. Motivo: cada persona tiene una estructura de gastos distinta.
