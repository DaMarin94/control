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
| Movimiento único | Movimiento que ocurrió una sola vez en un instante específico (fecha y hora) |
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
- **Auth:** Auth.js (NextAuth v5) con dos métodos que coexisten: Google OAuth y email + contraseña

### 2.2 Usuarios del sistema

| Actor | Descripción |
|---|---|
| Usuario autenticado | Persona que inició sesión, sea con su cuenta de Google o con email + contraseña. Es el único actor del sistema en v1. |

No hay roles, administradores ni usuarios invitados. Un usuario accede exclusivamente a sus propios datos.

### 2.3 Supuestos y dependencias

- El usuario dispone de una cuenta de Google activa, o bien se registra con email + contraseña.
- La app opera sobre una moneda implícita (sin selector de moneda en v1).
- El usuario registra sus movimientos manualmente — no hay integración bancaria.
- Los movimientos fijos y cuotas se calculan on-the-fly al consultar un mes; no se generan filas individuales por instancia mensual.

### 2.4 Restricciones de diseño

- Los montos se almacenan en **centavos** (entero sin decimales) para evitar errores de punto flotante.
- Todos los recursos están **aislados por usuario**: el backend filtra siempre por el `userId` del JWT activo.
- El instante de un movimiento único (`occurredAt`) es el momento elegido por el usuario (con default "ahora"), no el timestamp de creación del registro (`createdAt`).
- No se implementa `currency` en v1, pero el modelo lo permite agregar sin romper datos existentes.

---

## 3. Requerimientos funcionales

---

### 3.1 Módulo: Autenticación

En v1 coexisten **dos métodos de autenticación**: Google OAuth (RF-AUTH-001) y email + contraseña (login en RF-AUTH-005, registro en RF-AUTH-006). La protección de rutas (RF-AUTH-002), la sesión persistente (RF-AUTH-003) y el cierre de sesión (RF-AUTH-004) son **agnósticos del método**: una vez que el usuario tiene sesión activa, se comportan igual sin importar cómo inició sesión.

La recuperación de contraseña ("olvidé mi contraseña"), la verificación de email y el account linking (una misma cuenta accesible por Google y por email/contraseña) están **fuera de alcance en v1** (ver sección 6).

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
- [ ] Un usuario ya autenticado que navega a `/login` es redirigido automáticamente al dashboard, sin volver a mostrar la pantalla de login.

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

#### RF-AUTH-005 — Inicio de sesión con email y contraseña

| Campo | Detalle |
|---|---|
| **Descripción** | El sistema permite iniciar sesión con email y contraseña. El backend verifica la contraseña contra el hash almacenado. |
| **Actor** | Usuario no autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario no tiene sesión activa. Existe una cuenta registrada con ese email y contraseña (ver RF-AUTH-006). |

**Flujo principal:**
1. El usuario accede a la pantalla de login.
2. El usuario ingresa su email y su contraseña.
3. El usuario confirma ("Iniciar sesión").
4. El sistema envía las credenciales al backend.
5. El backend busca el usuario por email y verifica la contraseña contra el hash almacenado.
6. Las credenciales son válidas: el sistema crea una sesión y redirige al dashboard.

**Flujos alternativos:**
- *A1 — Credenciales inválidas (email inexistente o contraseña incorrecta):* el sistema muestra un mensaje de error genérico que **no revela** si falló el email o la contraseña, y permite reintentar.
- *A2 — Campos incompletos o email con formato inválido:* el sistema muestra error de validación y no envía la request.
- *A3 — Error del backend:* el sistema informa el error y permite reintentar sin perder el email ingresado.

**Criterios de aceptación:**
- [ ] El login con credenciales válidas redirige al dashboard con sesión activa.
- [ ] Ante credenciales inválidas, el mensaje de error es genérico y no distingue entre email inexistente y contraseña incorrecta.
- [ ] La verificación de la contraseña contra el hash ocurre en el backend; el frontend nunca compara contraseñas.
- [ ] La contraseña nunca se almacena ni se transmite en texto plano fuera del envío de la credencial al backend para su verificación.
- [ ] Un usuario ya autenticado que navega a `/login` es redirigido al dashboard (igual que RF-AUTH-001).

---

#### RF-AUTH-006 — Registro con email y contraseña

| Campo | Detalle |
|---|---|
| **Descripción** | El sistema permite crear una cuenta nueva con email y contraseña. El backend hashea la contraseña, crea el usuario y genera las categorías por defecto. |
| **Actor** | Usuario no autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario no tiene sesión activa. No existe una cuenta previa con ese email. |

**Flujo principal:**
1. El usuario accede a la pantalla de registro.
2. El usuario ingresa su email y una contraseña (y la confirmación de contraseña).
3. El usuario confirma ("Registrarme").
4. El sistema valida el formato del email y la longitud mínima de la contraseña (mínimo 8 caracteres).
5. El sistema envía los datos al backend.
6. El backend verifica que el email no esté en uso, hashea la contraseña (bcrypt/argon2) y crea el registro del usuario.
7. El backend genera las categorías por defecto de la cuenta nueva (ver RF-CAT-001).
8. El sistema crea una sesión y redirige al dashboard con el usuario ya logueado.

**Flujos alternativos:**
- *A1 — Email ya registrado:* el sistema muestra un error indicando que el email ya está en uso y no crea la cuenta.
- *A2 — Email con formato inválido:* el sistema muestra error de validación y no envía la request.
- *A3 — Contraseña menor a 8 caracteres:* el sistema muestra error de validación y no crea la cuenta (no envía la request).
- *A4 — Contraseña y confirmación no coinciden:* el sistema muestra error de validación y no envía la request.
- *A5 — Error del backend:* el sistema informa el error y permite reintentar sin perder el email ingresado.

**Criterios de aceptación:**
- [ ] El email y la contraseña son obligatorios; el email debe tener formato válido.
- [ ] La contraseña debe tener un mínimo de 8 caracteres. No se exige complejidad obligatoria (mayúscula, número ni símbolo) por ahora.
- [ ] Una contraseña de menos de 8 caracteres produce error de validación y no registra la cuenta.
- [ ] Si se incluye confirmación de contraseña, debe coincidir con la contraseña para poder registrarse.
- [ ] Si el email ya está registrado, el sistema no crea la cuenta e informa el error.
- [ ] El backend almacena la contraseña siempre hasheada (bcrypt/argon2), nunca en texto plano (RN-012).
- [ ] Al crear la cuenta, el backend genera las categorías por defecto (RF-CAT-001), igual que en el alta por Google.
- [ ] Tras un registro exitoso, el usuario queda logueado y es redirigido al dashboard sin pasar por el login.

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

#### RF-MU-001 — Crear movimiento único

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
- [ ] Todos los campos son editables: tipo, monto, categoría, fecha, hora, descripción.
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
7. El sistema crea el movimiento fijo con `startMonth` igual al mes actual, cierra el formulario y muestra un toast de confirmación con la acción "Ir a ver". El toast permite navegar a la vista del mes en el que el fijo comienza a aparecer (mes actual). Si el usuario no interactúa con el toast, este desaparece y el usuario permanece en la pantalla en la que estaba.

**Flujos alternativos:**
- *A1 — El usuario hace clic en "Ir a ver" del toast:* el sistema navega a la vista del mes en el que el fijo comienza a aparecer (mes actual).

**Criterios de aceptación:**
- [ ] Un movimiento fijo creado en junio aparece en junio, julio, agosto, y todos los meses siguientes.
- [ ] El movimiento fijo no tiene fecha de día — aparece como ítem mensual sin día específico.
- [ ] Las validaciones de monto (> 0) aplican igual que en RF-MU-001.
- [ ] Al guardar, el formulario se cierra y aparece un toast de confirmación.
- [ ] El toast incluye una acción "Ir a ver" que navega a la vista del mes en el que el fijo comienza a aparecer (mes actual).
- [ ] Si el usuario no interactúa con el toast, este desaparece automáticamente y el usuario permanece en la pantalla actual.
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
9. El sistema crea el grupo de cuotas, genera una cuota por mes durante N meses, cierra el formulario y muestra un toast de confirmación con la acción "Ir a ver". El toast permite navegar a la vista del mes de inicio de las cuotas. Si el usuario no interactúa con el toast, este desaparece y el usuario permanece en la pantalla en la que estaba.

**Flujos alternativos:**
- *A1 — Monto inválido:* el sistema muestra error de validación y no guarda.
- *A2 — Cantidad de cuotas = 0 o negativa:* el sistema muestra error de validación y no guarda.
- *A3 — El usuario hace clic en "Ir a ver" del toast:* el sistema navega a la vista del mes de inicio de las cuotas.

**Criterios de aceptación:**
- [ ] El campo monto corresponde al monto de cada cuota, no al total.
- [ ] La cantidad de cuotas debe ser un entero mayor a cero.
- [ ] El mes de inicio tiene como default el mes actual y es editable.
- [ ] Aparece exactamente una cuota por mes durante exactamente N meses consecutivos.
- [ ] Todas las cuotas tienen el mismo monto (no hay cuotas variables).
- [ ] Cada cuota en la lista muestra el número de cuota y el total (ej: "3/12").
- [ ] Al guardar, el formulario se cierra y aparece un toast de confirmación.
- [ ] El toast incluye una acción "Ir a ver" que navega a la vista del mes de inicio de las cuotas.
- [ ] Si el usuario no interactúa con el toast, este desaparece automáticamente y el usuario permanece en la pantalla actual.

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

#### RF-MC-003 — Editar grupo de cuotas

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
- [ ] Los campos editables son: monto por cuota, cantidad de cuotas, mes de inicio, categoría y descripción.
- [ ] La edición aplica al grupo completo, no a una cuota individual.
- [ ] El monto por cuota debe ser mayor a cero (misma validación que RF-MC-001).
- [ ] La cantidad de cuotas debe ser un entero mayor a cero (misma validación que RF-MC-001).
- [ ] Al cambiar la cantidad de cuotas o el mes de inicio, el sistema recalcula en qué meses aparecen las cuotas.
- [ ] Solo se pueden editar grupos propios.

---

### 3.6 Módulo: Categorías

Las categorías clasifican los movimientos. Son personalizables por usuario y tienen un scope que define a qué tipo de movimiento aplican, y un color asignado automáticamente desde un pool fijo (no editable en v1).

---

#### RF-CAT-001 — Categorías por defecto al crear cuenta

| Campo | Detalle |
|---|---|
| **Descripción** | Al crear la cuenta por primera vez —por cualquiera de los dos métodos: Google OAuth (RF-AUTH-001) o registro con email + contraseña (RF-AUTH-006)— el sistema crea automáticamente un conjunto de categorías por defecto. |
| **Actor** | Sistema |
| **Prioridad** | Alta |
| **Precondiciones** | Se crea una cuenta nueva (primer ingreso por Google o registro con email + contraseña). |

**Criterios de aceptación:**
- [ ] Al crear la cuenta por cualquiera de los dos métodos, el sistema genera las siguientes categorías con `scope: BOTH`:
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
5. El sistema verifica que el nombre **normalizado** (RN-014) no colisione con otra categoría del mismo usuario.
6. Sin colisión: la categoría queda creada y disponible para asignar a movimientos.

**Flujos alternativos:**
- *A1 — Nombre vacío:* el sistema muestra error de validación y no crea la categoría.
- *A2 — Colisión con una categoría activa del mismo nombre normalizado:* el sistema bloquea la creación e informa que ya existe una categoría con ese nombre. No crea un duplicado (RN-008).
- *A3 — Colisión con una categoría eliminada (soft delete) del mismo nombre normalizado:* el sistema **no crea un duplicado**. En su lugar **propone reactivar** la categoría eliminada mediante un prompt — *"Ya tenés una categoría 'X' eliminada. ¿Querés reactivarla?"* — con las acciones **Reactivar** y **Cancelar**. El prompt aclara explícitamente que la categoría se reactivará **con su configuración original** (mismo scope y color), de modo que el usuario no se sorprenda si el scope que tipeó no se aplica.
  - *A3.1 — El usuario elige Reactivar:* el sistema restaura la categoría eliminada **exactamente como estaba** — mismo `id`, mismo `scope`, mismo color — y sus movimientos históricos vuelven a quedar bajo la categoría activa. Los valores que el usuario haya tipeado en el formulario de alta (nombre, scope) **se ignoran**: prevalece la configuración original de la categoría reactivada. No se crea una categoría nueva.
  - *A3.2 — El usuario elige Cancelar:* no se crea ni se reactiva nada. El usuario vuelve al formulario.

**Criterios de aceptación:**
- [ ] El nombre es obligatorio y no puede estar vacío.
- [ ] No pueden existir dos categorías activas con el mismo nombre para el mismo usuario.
- [ ] La comparación de nombres para detectar colisiones usa la **normalización definida en RN-014** (trim, insensible a mayúsculas e insensible a acentos), aplicada tanto contra categorías activas como eliminadas.
- [ ] Una colisión con una categoría **activa** del mismo nombre normalizado bloquea la creación como duplicado (RN-008).
- [ ] Una colisión con una categoría **eliminada (soft delete)** del mismo nombre normalizado no crea un duplicado: el sistema propone reactivar la eliminada mediante un prompt con acciones Reactivar / Cancelar.
- [ ] El prompt de reactivación aclara explícitamente que la categoría se reactivará con su configuración original (scope y color), no con lo tipeado en el formulario.
- [ ] Al reactivar, la categoría vuelve **exactamente como estaba** (mismo `id`, scope y color) y sus movimientos históricos vuelven a quedar bajo la categoría activa; los datos tipeados en el alta se ignoran.
- [ ] Al cancelar el prompt de reactivación, no se crea ni se reactiva ninguna categoría.
- [ ] El scope puede ser: AMBOS, GASTO, INGRESO. Default: AMBOS.
- [ ] El sistema asigna automáticamente un color a la categoría desde el pool fijo (RF-CAT-005); el usuario no lo elige.
- [ ] La categoría creada está disponible inmediatamente en los selectores de movimientos.
- [ ] La gestión de categorías (crear, editar, eliminar y listar) vive en una pantalla separada y dedicada, accesible desde el link "Categorías" del sidebar (RF-NAV-001). No es un modal ni una sección embebida en otra pantalla.

**Notas:**
- La unicidad de nombre de categoría activa se valida en **lógica de aplicación**, no con un constraint `@@unique` de base de datos. Motivo: la comparación normalizada (trim + insensible a mayúsculas y acentos) y el flujo "crear-o-reactivar" no caben en un constraint de DB. Ver `docs/data-model.md`.

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
- [ ] El color de la categoría no es editable en v1 (RF-CAT-005).
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
- [ ] La categoría eliminada desaparece de la pantalla de gestión de categorías (`/categorias`): mientras está eliminada no se ve su fila ni su contador (RF-CAT-006).
- [ ] Los movimientos históricos que tenían esa categoría siguen mostrando su nombre.
- [ ] La eliminación es lógica — los datos no se borran de la base de datos.
- [ ] El sistema solicita confirmación antes de eliminar.
- [ ] Una categoría eliminada puede **reactivarse** más adelante: al crear una categoría nueva cuyo nombre normalizado colisiona con una eliminada, el sistema propone reactivarla (ver RF-CAT-002, flujo alternativo A3). Al reactivarla, vuelve a aparecer en la pantalla de categorías y en los selectores.

**Notas:**
- *Aclaración (totales de dinero):* eliminar una categoría con soft delete **no** saca sus movimientos de los totales del mes ni del balance. La eliminación marca la categoría, no toca los movimientos: un movimiento sigue contando en los totales (RF-VM-002, RF-DASH-002) **siempre**, sin importar si su categoría fue eliminada. El único conteo que se ve afectado es el contador informativo "N movimientos" de la pantalla de categorías (RF-CAT-006), que desaparece junto con la fila de la categoría eliminada y es independiente de los totales de plata.

---

#### RF-CAT-005 — Color de categoría

| Campo | Detalle |
|---|---|
| **Descripción** | Cada categoría tiene un color asignado automáticamente desde un pool fijo de colores predefinidos. El color identifica visualmente a la categoría en la UI. En v1 el usuario no elige ni edita el color. |
| **Actor** | Sistema |
| **Prioridad** | Baja |
| **Precondiciones** | Se crea una categoría (por defecto, manual, o por cualquiera de los métodos de alta de cuenta). |

**Criterios de aceptación:**
- [ ] El sistema asigna un color a cada categoría al crearla, tomado de un pool fijo de colores predefinidos.
- [ ] La asignación aplica tanto a las categorías por defecto (RF-CAT-001) como a las creadas manualmente (RF-CAT-002).
- [ ] El usuario no puede elegir ni modificar el color en v1 (ni al crear ni al editar la categoría).
- [ ] El color es solo de presentación: no afecta el cálculo de montos, el scope ni ninguna regla de negocio.

---

#### RF-CAT-006 — Contador de movimientos por categoría

| Campo | Detalle |
|---|---|
| **Descripción** | En la pantalla de gestión de categorías, cada categoría muestra la cantidad de movimientos asociados a ella. Es un dato derivado de solo lectura. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Baja |
| **Precondiciones** | El usuario tiene sesión activa y accede a la pantalla de categorías. |

**Criterios de aceptación:**
- [ ] Cada categoría de la lista muestra un contador "N movimientos" con la cantidad de movimientos asociados.
- [ ] El contador es de solo lectura — el usuario no puede editarlo.
- [ ] El contador refleja el estado vigente de los movimientos del usuario; una categoría sin movimientos asociados muestra cero.

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
- [ ] La lista está agrupada por tipo en tres secciones separadas y rotuladas, en este orden: **Únicos**, **Fijos**, **Cuotas**. Dentro de la sección Únicos, los movimientos se ordenan por instante (fecha y hora) descendente (más reciente primero). Las secciones Fijos y Cuotas no tienen día ni hora específicos, por lo que su ordenamiento interno no se rige por instante.
- [ ] Una sección sin movimientos en el mes no se muestra (no aparece su rótulo vacío).
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
- [ ] Los totales suman **movimientos**, no categorías: un movimiento cuenta en los totales aunque su categoría haya sido eliminada (soft delete). Eliminar una categoría no afecta los totales (ver nota en RF-CAT-004).

**Notas:**
- *Aclaración (categoría eliminada):* los totales y el balance suman `amountCents` de los movimientos del mes, sin importar el estado de su categoría. El soft delete de una categoría (RF-CAT-004) no remueve ni excluye ningún movimiento del cálculo. No confundir con el contador "N movimientos" de la pantalla de categorías (RF-CAT-006), que es un dato informativo por categoría e independiente de los totales de dinero.

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
- [ ] Al seleccionar editar, se abre el formulario correspondiente (RF-MU-002, RF-MF-003 o RF-MC-003 según el tipo).
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

### 3.8 Módulo: Navegación

La navegación global de la app se resuelve con un **sidebar lateral** persistente, presente en todas las pantallas autenticadas. Centraliza el acceso a las secciones principales, la acción primaria de carga y el menú de usuario.

---

#### RF-NAV-001 — Sidebar de navegación global

| Campo | Detalle |
|---|---|
| **Descripción** | La app presenta un sidebar lateral persistente que está visible en todas las pantallas autenticadas. Contiene la navegación entre secciones, la acción primaria de nuevo movimiento y el menú de usuario con el cierre de sesión. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa. |

**Contenido:**

- **Logo / nombre "Control"** (parte superior): actúa como enlace al dashboard.
- **Links de navegación:**
  - **Dashboard** — lleva al dashboard (RF-DASH-001).
  - **Vista del mes** — lleva a la vista del mes (RF-VM-001), abierta en el mes actual.
  - **Categorías** — lleva a la gestión de categorías (módulo 3.6).
- **Botón "Nuevo movimiento"** (acción primaria): abre el formulario de carga de movimiento (RF-CM-001).
- **Menú de usuario** (parte inferior): representado por el avatar del usuario. Al activarlo, despliega la opción **"Cerrar sesión"** (RF-AUTH-004).

**Criterios de aceptación:**
- [ ] El sidebar está presente en todas las pantallas accesibles con sesión activa.
- [ ] El sidebar no se muestra en la pantalla de login ni en otras pantallas no autenticadas.
- [ ] El logo/nombre "Control" lleva al dashboard.
- [ ] Los links Dashboard, Vista del mes y Categorías navegan a sus respectivas pantallas.
- [ ] El link "Vista del mes" abre la vista en el mes actual.
- [ ] El botón "Nuevo movimiento" abre el formulario de carga (RF-CM-001) desde cualquier pantalla, cumpliendo el límite de 2 interacciones (RNF-003).
- [ ] El sidebar indica visualmente cuál es la sección activa.
- [ ] El menú de usuario se ubica en la parte inferior del sidebar y muestra el avatar del usuario.
- [ ] La opción "Cerrar sesión" vive dentro del menú de usuario y dispara el flujo de RF-AUTH-004.

**Notas:**
- Este RF cubre la decisión sobre RF-AUTH-004 (cierre de sesión disponible "desde cualquier pantalla"): el punto de acceso al cierre de sesión es el menú de usuario del sidebar.

---

## 4. Reglas de negocio

| ID | Regla |
|---|---|
| RN-001 | El monto de todo movimiento es un entero positivo mayor a cero. El tipo (`EXPENSE` / `INCOME`) define el signo semántico. Nunca se almacenan montos negativos ni cero. |
| RN-002 | Los montos se almacenan en centavos (entero). No se usan números de punto flotante para representar dinero. |
| RN-003 | Todos los recursos (movimientos, categorías) están aislados por `userId`. El backend filtra siempre por el usuario del JWT. Un usuario nunca puede ver ni modificar datos de otro. |
| RN-004 | El instante de un movimiento único (`occurredAt`) es el momento elegido por el usuario, con default "ahora". Define a qué momento/mes pertenece el movimiento. No se confunde con `createdAt` (timestamp de sistema de cuándo se creó el registro): el usuario puede elegir un instante distinto al de creación. |
| RN-005 | Editar o eliminar un movimiento fijo no modifica los datos de meses ya pasados. El historial es inmutable. |
| RN-006 | Los movimientos fijos y los grupos de cuotas no generan filas individuales por mes. Se calculan on-the-fly al consultar un período. |
| RN-007 | Una categoría eliminada (soft delete) no aparece en selectores de nuevos movimientos, pero los movimientos históricos conservan la referencia a ella. |
| RN-008 | No pueden coexistir dos categorías activas con el mismo nombre para el mismo usuario. |
| RN-009 | En v1 no hay campo de moneda. El sistema opera sobre una moneda implícita. El diseño permite agregar `currency` en el futuro sin romper datos existentes. |
| RN-010 | El selector de categorías se filtra según el tipo del movimiento en curso: para `EXPENSE` se muestran categorías con scope `EXPENSE` o `BOTH`; para `INCOME` se muestran categorías con scope `INCOME` o `BOTH`. |
| RN-011 | El movimiento único representa un instante (fecha y hora). Se almacena como timestamp en UTC junto con la zona horaria original del registro (nombre IANA). Se muestra siempre en esa zona horaria original, sin importar dónde se encuentre el usuario después. El mes al que pertenece el movimiento se determina en la zona del propio registro, de forma estable. Los movimientos fijos y las cuotas no aplican esta regla: operan a nivel mes, sin día ni hora. Ver `docs/technical.md` (sección "Fechas y zonas horarias") para el detalle técnico. |
| RN-012 | Las contraseñas de las cuentas con email + contraseña se almacenan siempre **hasheadas** (bcrypt/argon2), nunca en texto plano. El hash y la verificación ocurren en el backend; el frontend nunca almacena ni compara contraseñas. Las cuentas creadas solo con Google pueden no tener contraseña. |
| RN-013 | Cada categoría tiene un color asignado automáticamente desde un pool fijo de colores predefinidos. El color es de presentación únicamente; en v1 el usuario no lo elige ni lo edita. |
| RN-014 | Para comparar nombres de categoría a efectos de unicidad, el nombre se **normaliza**: trim de espacios, insensible a mayúsculas/minúsculas e insensible a acentos/tildes. Ej: "comida", "Comida" y "Cómida" se consideran el mismo nombre. Esta normalización aplica tanto a la detección de duplicado contra categorías **activas** (bloqueo, RN-008) como contra categorías **eliminadas** (soft delete) para proponer reactivarla (RF-CAT-002). La regla se valida en **ambas capas** —backend como fuente de verdad y frontend para UX— y ambas deben mantenerse alineadas (ver `docs/technical.md`). |

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
| RNF-008 | Resiliencia | Resiliencia de formularios — ante un error del backend al guardar, el formulario permanece abierto, conserva los datos ingresados y permite reintentar sin perder información. |

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
| Vista consolidada de movimientos fijos activos | Out of scope v1; candidato para v2 como pantalla propia en el sidebar |
| Lista de últimos movimientos en el dashboard (ex RF-DASH-004) | Dashboard simplificado a resumen financiero + acceso a carga |
| Recuperación de contraseña ("olvidé mi contraseña") | Requiere infraestructura de correo; diferida a post-v1 |
| Verificación de email | Requiere infraestructura de correo; diferida a post-v1 |
| Account linking (misma cuenta por Google y email/contraseña) | Pendiente sin resolver en v1; el caso de mismo email por ambos métodos no se resuelve |

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
| Movimiento único | Movimiento que ocurrió en un instante específico (fecha y hora), una sola vez. Se almacena en UTC junto con su zona horaria original; ver RN-011. |
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

**2026-06-03 — Navegación global con sidebar lateral (opción B).** La navegación entre secciones se resuelve con un sidebar lateral persistente en todas las pantallas autenticadas (RF-NAV-001). Contiene el logo/nombre "Control" (enlace al dashboard), los links Dashboard / Vista del mes / Categorías, el botón primario "Nuevo movimiento" y el menú de usuario con "Cerrar sesión" en la parte inferior. Motivo: el usuario prefiere el sidebar desde el inicio y anticipa el crecimiento de secciones, donde un layout lateral escala mejor que una barra superior.

**2026-06-03 — Gestión de categorías en pantalla separada (opción A).** La gestión de categorías (crear, editar, eliminar y listar) se resuelve en una pantalla dedicada accesible desde el link "Categorías" del sidebar (RF-CAT-002, RF-NAV-001), en lugar de un modal o una sección embebida. Motivo: el usuario prefiere una pantalla propia que ofrece más espacio para listar y administrar categorías, y es coherente con el sidebar como punto de acceso a las secciones principales.

**2026-06-03 — Confirmación post-guardado con toast y acción "Ir a ver" (Gap 5).** Al guardar un movimiento (único, fijo o cuotas), el formulario se cierra y aparece un toast de confirmación que incluye la acción "Ir a ver". Esa acción navega a la vista del mes del movimiento guardado (el mes de la fecha en únicos, el mes de inicio en fijos y cuotas). Si el usuario no interactúa con el toast, este desaparece automáticamente y el usuario permanece en la pantalla en la que estaba. Impacta RF-MU-001, RF-MF-001 y RF-MC-001. Motivo: el usuario eligió una variante combinada que confirma el guardado sin interrumpir el flujo, pero ofreciendo un atajo opcional para verificar el movimiento recién cargado en su mes.

**2026-06-03 — Vista consolidada de movimientos fijos activos: fuera de alcance v1 (opción A).** No se incluye en v1 una vista que liste todos los movimientos fijos activos de forma consolidada. Los fijos siguen visibles dentro de cada mes en la vista del mes (RF-MF-002). Queda anotada la opción C como idea para v2: una pantalla propia "Fijos" con su link en el sidebar, dedicada a administrar las plantillas recurrentes (ver sección 6, "Fuera de alcance"). Motivo: el usuario prefiere acotar el scope de v1; la consolidación de fijos no es bloqueante y se evalúa más adelante como pantalla independiente.

**2026-06-03 — Dashboard sin lista de movimientos (opción C).** El dashboard se simplifica a un resumen financiero del mes actual (gastos, ingresos, balance) más el acceso a la carga de movimientos y el enlace a la vista del mes. Se elimina el ex RF-DASH-004 (lista de últimos movimientos), que pasa a "Fuera de alcance" (sección 6). Motivo: la lista detallada vive en la vista del mes; el dashboard queda enfocado en el panorama financiero y en disparar la acción primaria, evitando duplicar la lista.

**2026-06-03 — Formulario de carga como modal con defaults Único + Gasto.** El formulario de carga de movimiento se presenta como un modal (no pantalla propia, no ruta). Al abrirlo para crear, el tab **Único** y el tipo **Gasto** están seleccionados por defecto. Impacta RF-CM-001. Motivo: el caso más frecuente es cargar un gasto único; los defaults reducen los pasos para el flujo más común.

**2026-06-03 — Modo edición del formulario sin tabs.** En modo edición, el modal de carga abre directamente en el tipo del movimiento editado y oculta los tabs de selección de tipo (no se puede cambiar el tipo de un movimiento ya creado vía edición). Impacta RF-CM-001. Motivo: el tipo de un movimiento es estructural; cambiarlo equivale a crear otro, por lo que la edición se acota a los campos del tipo existente.

**2026-06-03 — Edición de cuotas en v1 (RF-MC-003).** Se incluye en v1 la edición del grupo de cuotas completo: monto por cuota, cantidad de cuotas, mes de inicio, categoría y descripción, con las mismas validaciones de monto y cantidad que la creación. La edición aplica al grupo entero. Motivo: corregir errores de carga (monto o cantidad equivocados) es una necesidad real y no justifica forzar al usuario a eliminar y recrear el grupo.

**2026-06-03 — Pantalla de categorías: lista dedicada con creación/edición en modal.** Se confirma la pantalla dedicada de categorías (opción A, ya registrada). La creación y edición dentro de esa pantalla se resuelven con un modal (opción B): el botón "Nueva categoría" abre un modal vacío y la acción editar abre el mismo modal pre-cargado. Motivo: la pantalla dedicada da espacio para listar y administrar, y el modal mantiene la creación/edición ligera sin cambiar de contexto.

**2026-06-03 — Redirección de usuario autenticado en /login.** Un usuario con sesión activa que navega a `/login` es redirigido automáticamente al dashboard. Impacta RF-AUTH-001. Motivo: evitar que un usuario logueado vea la pantalla de login, que no tiene utilidad en ese estado.

**2026-06-04 — Dos métodos de autenticación: Google OAuth + email/contraseña.** Se amplía la autenticación de Control. Hasta ahora era solo Google OAuth (alta automática); ahora coexisten **dos métodos**: Google OAuth (RF-AUTH-001) y email + contraseña, con login (RF-AUTH-005) y un flujo de **registro** propio (RF-AUTH-006) que antes no existía. El backend es dueño de la DB: hashea la contraseña (bcrypt/argon2), crea el usuario y genera las categorías por defecto (RF-CAT-001) sin importar el método de alta. Las contraseñas se almacenan siempre hasheadas, nunca en texto plano (RN-012); la verificación ocurre en el backend. La protección de rutas (RF-AUTH-002), la sesión persistente (RF-AUTH-003) y el cierre de sesión (RF-AUTH-004) quedan explícitamente agnósticos del método. **Diferido a post-v1:** recuperación de contraseña y verificación de email (ambas requieren infraestructura de correo). **Pendiente sin resolver en v1:** account linking (misma cuenta accesible por Google y por email/contraseña con el mismo email). La política de contraseña se define en la entrada complementaria de esta misma fecha. Impacta el módulo 3.1, RF-CAT-001, sección 4 (RN-012), sección 6 y las pantallas de login y registro (`docs/screens.md`). Motivo: ofrecer una alternativa de acceso sin depender exclusivamente de Google, sin sumar todavía la infraestructura de correo que requieren la recuperación y la verificación.

**2026-06-04 — Política de contraseña para el registro (RF-AUTH-006).** La contraseña del registro con email + contraseña debe tener un **mínimo de 8 caracteres**, **sin requisitos de complejidad obligatoria** (no se exige mayúscula, número ni símbolo) por el momento. Una contraseña de menos de 8 caracteres produce error de validación y no crea la cuenta. Esto cierra el pendiente de "requisitos mínimos de la contraseña" anotado en la entrada de auth de esta misma fecha. La política es **revisable a futuro** (podría endurecerse con reglas de complejidad). Impacta RF-AUTH-006 y la pantalla de Registro (`docs/screens.md`). Motivo: el usuario optó por una barrera mínima razonable que no fricciona el alta, dejando la puerta abierta a reforzarla más adelante.

**2026-06-04 — Color de categoría desde pool fijo, no editable en v1.** Cada categoría incorpora un color asignado automáticamente desde un **pool fijo de colores predefinidos**. El sistema lo asigna al crear la categoría (tanto las por defecto de RF-CAT-001 como las creadas manualmente en RF-CAT-002); el usuario **no** elige ni edita el color en v1, ni al crear ni al editar. El color es solo de presentación —identifica visualmente la categoría en la UI— y no afecta montos, scope ni reglas de negocio. Se refleja en la pantalla de Categorías (`docs/screens.md`, pantalla 6) como indicador visual de cada ítem. Impacta el módulo 3.6 (nuevo RF-CAT-005, criterio agregado en RF-CAT-002 y RF-CAT-003), la sección 4 (RN-013) y `docs/data-model.md` (entidad Categoría). Motivo: dar identidad visual a las categorías sin sumar fricción de elección de color en v1; la edición de color queda como posible mejora futura.

**2026-06-04 — Contador de movimientos por categoría en la pantalla de Categorías.** La pantalla de gestión de categorías (`docs/screens.md`, pantalla 6) muestra en cada ítem un contador **"N movimientos"** con la cantidad de movimientos asociados a esa categoría. Es un dato **derivado de solo lectura**: el usuario no lo edita. Una categoría sin movimientos muestra cero. Impacta el módulo 3.6 (nuevo RF-CAT-006) y la pantalla 6. Motivo: dar contexto al usuario sobre el uso real de cada categoría antes de editarla o eliminarla, sin agregar acciones nuevas.

**2026-06-08 — Reactivar categoría eliminada en vez de duplicar (RF-CAT-002 / RF-CAT-004).** Al crear una categoría cuyo nombre colisiona con una categoría **eliminada (soft delete)** del mismo usuario, el sistema **no crea un duplicado**: propone reactivar la eliminada mediante un prompt ("Ya tenés una categoría 'X' eliminada. ¿Querés reactivarla?") con acciones **Reactivar / Cancelar**. Reactivar restaura la categoría **exactamente como estaba** (mismo `id`, scope y color), y sus movimientos históricos vuelven a quedar bajo la categoría activa; los valores tipeados en el formulario de alta se ignoran. El prompt aclara explícitamente que se reactiva con la configuración original. Cancelar no crea ni reactiva nada. La detección de colisión usa **match normalizado** (ver RN-014: trim + insensible a mayúsculas + insensible a acentos). La colisión contra una categoría **activa** sigue bloqueada como duplicado (RN-008, sin cambios). La unicidad de nombre de categoría activa se valida en **lógica de aplicación, no con un constraint `@@unique` de DB** (gotcha técnico): la comparación normalizada con acentos y el flujo crear-o-reactivar no caben en un constraint de base de datos. Se implementa en **Fase 3 (Categorías)**; ahora solo se documenta. Impacta RF-CAT-002, RF-CAT-004 y `docs/data-model.md` (entidad Categoría). Motivo: evitar categorías duplicadas y recuperar la categoría original (con su historial y configuración) en lugar de forzar una nueva entrada.

**2026-06-08 — Aclaración: el soft delete de categoría no saca movimientos de los totales (RF-VM-002 / RF-CAT-004).** Se documenta explícitamente que hay dos conteos distintos que no deben confundirse. (1) **Totales del mes y balance** (RF-VM-002, RF-DASH-002) suman **movimientos** (`amountCents`), no categorías: un movimiento cuenta en los totales **siempre**, aunque su categoría haya sido eliminada con soft delete; eliminar una categoría no toca el movimiento, así que sigue sumando. (2) El **contador "N movimientos"** de la pantalla `/categorias` (RF-CAT-006) es un dato informativo por categoría, **solo en esa pantalla de gestión**, independiente de los totales de dinero; una categoría eliminada desaparece de esa pantalla (RF-CAT-004) y por lo tanto no muestra su fila ni su contador mientras está eliminada, hasta que se la reactiva. Aclaración documental (no cambia comportamiento). Impacta las notas de RF-VM-002 y RF-CAT-004. Motivo: prevenir el malentendido de que eliminar una categoría altera los totales del mes.

**2026-06-08 — Normalización de nombre de categoría para unicidad como regla explícita (RN-014).** Se formaliza como regla de negocio la normalización del nombre de categoría usada para comparar unicidad: trim de espacios, insensible a mayúsculas/minúsculas e insensible a acentos/tildes ("comida" = "Comida" = "Cómida"). Aplica tanto a la detección de duplicado contra categorías **activas** (bloqueo, RN-008) como contra **eliminadas** para proponer reactivar (RF-CAT-002, A3). La regla se valida en **ambas capas** (backend fuente de verdad, frontend UX) y deben mantenerse alineadas (ver `docs/technical.md`). El detalle de la normalización deja de repetirse en RF-CAT-002 (flujo principal y criterios) y en la bitácora del 2026-06-08 sobre reactivación: ahora referencian RN-014. Aclaración documental (no cambia comportamiento). Impacta la sección 4 (nueva RN-014) y las referencias en RF-CAT-002. Motivo: tener una única fuente de la definición de normalización, referenciada desde los RF en lugar de duplicada, para evitar divergencias entre capas y documentos.

**2026-06-04 — Movimiento único con fecha y hora, almacenamiento UTC + zona original.** El movimiento único pasa a capturar fecha **y hora** (antes solo fecha). Al crear, la fecha y la hora tienen como default el momento de creación ("ahora") y ambas son editables. Cada movimiento se almacena como instante en UTC junto con la zona horaria original del registro (nombre IANA, ej. `America/Argentina/Buenos_Aires`), y se muestra siempre en esa zona original aunque el usuario viaje. El mes al que pertenece se calcula en la zona del registro, de forma estable. El Usuario incorpora un campo `timezone` (su zona "de casa"/default), usado para determinar "hoy"/"mes actual" al crear movimientos y en el dashboard. Los movimientos fijos y las cuotas no cambian: siguen a nivel mes, sin día ni hora. Impacta RF-MU-001, RF-MU-002, RF-VM-001 y RN-011. La mecánica técnica completa vive en `docs/technical.md` (sección "Fechas y zonas horarias"). Motivo: registrar el instante real del gasto y conservar la hora local del lugar donde ocurrió hace la información más precisa y estable frente a viajes o cambios de zona.
