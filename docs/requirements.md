# Requerimientos Funcionales — Control

> Requerimientos funcionales de Control: qué hace el sistema, bajo qué condiciones, y los criterios verificables de cada requerimiento. Para el modelo de datos ver `data-model.md`; para el estado de implementación ver `features.md`; para las pantallas, `screens.md`.
> Aplica a la plataforma **web**; mobile está fuera de scope.

---

## 1. Definiciones

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

---

## 2. Descripción general del sistema

Control es una aplicación web de uso personal para registrar y visualizar movimientos de dinero organizados por mes. No es un sistema contable: su foco es la **previsibilidad** — ver en qué se va el dinero y detectar patrones mes a mes.

**Actor único:** el usuario autenticado (por Google o por email + contraseña). No hay roles, administradores ni invitados; cada usuario accede solo a sus propios datos.

**Supuestos:**

- El usuario dispone de una cuenta de Google, o se registra con email + contraseña.
- Cada movimiento lleva moneda **explícita** sobre un **set curado de 4 monedas (ARS / USD / EUR / BRL)**, con totales en la moneda default del usuario (módulo 3.10).
- El usuario registra sus movimientos manualmente — no hay integración bancaria.
- Los movimientos fijos y cuotas se calculan on-the-fly al consultar un mes; no se generan filas por instancia mensual.

**Restricciones de diseño:**

- Los montos se almacenan en **centavos** (entero sin decimales) para evitar errores de punto flotante (la cotización es la excepción — ver `data-model.md`).
- Todos los recursos están **aislados por usuario**: el backend filtra siempre por el `userId` del JWT activo.
- El instante de un movimiento único (`occurredAt`) es el momento elegido por el usuario (default "ahora"), no el timestamp de creación (`createdAt`).

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

#### RF-AUTH-007 — Cierre de sesión automático ante token inválido o expirado

| Campo | Detalle |
|---|---|
| **Descripción** | Cuando el backend responde `401` (token del backend inválido o expirado), la app cierra la sesión y lleva al usuario al login con un aviso: "Tu sesión expiró, volvé a entrar." |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa y realiza una llamada al backend. |

**Flujo principal:**
1. La app hace una llamada al backend con el token de sesión.
2. El backend responde `401` (token inválido o expirado).
3. El sistema cierra la sesión y redirige a `/login`.
4. El sistema muestra el aviso "Tu sesión expiró, volvé a entrar."

**Criterios de aceptación:**
- [ ] Un `401` del backend cierra la sesión y redirige a `/login` con el aviso "Tu sesión expiró, volvé a entrar."
- [ ] Solo el `401` dispara el cierre de sesión automático. `403`, `400`, `500` y los errores de red (`503`) no cierran sesión: se manejan localmente como cualquier error.
- [ ] Cuando varias llamadas fallan con `401` a la vez, el cierre de sesión y el aviso se disparan una sola vez (sin loop ni avisos duplicados).
- [ ] Estando ya en `/login`, un `401` no vuelve a disparar el flujo.

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
- [ ] El **resumen financiero del dashboard** (tarjetas Gastos/Ingresos + balance, RF-DASH-002) muestra **siempre el mes actual** — no tiene navegación entre meses.
- [ ] La **única navegación de período del dashboard** vive en el **widget de reporte Ingresos vs. Gastos** que monta (RF-REP-002): ese widget navega **año** de forma independiente y activa, sin afectar el resumen mensual, que sigue fijo en el mes en curso.
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
- [ ] El resumen mensual **permanece fijo en el mes en curso** aun cuando el usuario navegue años en el widget de reporte del dashboard (RF-REP-002): la navegación del widget es por **año** y **no** mueve estas tarjetas.

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

#### RF-MU-004 — Crear categoría desde el formulario de carga de movimiento

| Campo | Detalle |
|---|---|
| **Descripción** | Desde el formulario de carga de movimiento, el usuario puede crear una categoría nueva sin abandonar el formulario ni perder los datos ya cargados. La categoría recién creada queda autoseleccionada en el campo categoría del movimiento. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El formulario de carga de movimiento está abierto (en cualquiera de sus tabs: Único, Fijo o Cuotas). |

**Alcance:** Aplica al formulario de carga de movimiento (el formulario único `transaction-form` compartido por los tres tabs), tanto en modo creación como en modo edición, ya que el campo categoría está presente en los tres tipos (RF-MU-001/RF-MU-002, RF-MF-001/RF-MF-003, RF-MC-001/RF-MC-003). Reutiliza el modal de creación de categorías ya existente (RF-CAT-002), incluyendo la validación de unicidad (RN-008) y el flujo crear-o-reactivar (RF-CAT-002 A3). **No** crea un flujo de alta de categoría nuevo ni paralelo: es un nuevo punto de entrada al mismo modal.

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
- *A3 — Colisión con una categoría eliminada (reactivable):* el sistema propone reactivar la categoría eliminada mediante el prompt de reactivación existente (RF-CAT-002 A3). Si el usuario reactiva, el modal se cierra y la categoría **reactivada** queda autoseleccionada en el campo categoría del formulario de carga, igual que en el alta exitosa. Si cancela el prompt, vuelve al modal de categoría sin crear ni reactivar nada.
- *A4 — Error del backend al crear/reactivar:* el modal informa el error y permite reintentar sin perder lo tipeado; el formulario de carga conserva sus datos por debajo.

**Criterios de aceptación:**
- [ ] El disparador es un botón **"+ Nueva"** ubicado **junto al selector de categoría** dentro del formulario de carga (no un ítem dentro del desplegable de categorías).
- [ ] El botón abre el modal de creación de categoría ya existente (RF-CAT-002), superpuesto al formulario de carga.
- [ ] Los datos ya cargados en el formulario de carga (monto, fecha, hora, descripción, mes de inicio, cantidad de cuotas, según el tipo) se conservan al abrir el modal y al volver de él.
- [ ] Al abrir el modal desde el formulario de carga (modo inline), el campo "Tipo" (scope) **solo ofrece las opciones compatibles** con el tipo del movimiento en curso: Gasto → "Gasto" y "Ambos" (se oculta "Ingreso"); Ingreso → "Ingreso" y "Ambos" (se oculta "Gasto"). La opción pre-seleccionada es el tipo exacto del movimiento. El usuario puede cambiar a "Ambos" pero no puede elegir el tipo opuesto.
- [ ] La restricción de opciones de scope aplica **únicamente** en modo inline (modal abierto desde el formulario de carga). Cuando el modal se abre desde su lugar normal en la sección Categorías de Configuración (`/configuracion/categorias`), sigue ofreciendo las tres opciones (Gasto / Ingreso / Ambos) con default "Ambos".
- [ ] Al crear la categoría con éxito, el modal se cierra y la categoría recién creada queda autoseleccionada en el campo categoría del formulario de carga.
- [ ] Si la creación choca con una categoría eliminada, se reutiliza el prompt de reactivación (RF-CAT-002 A3); al reactivar, la categoría reactivada queda autoseleccionada en el campo categoría.
- [ ] Cancelar el modal de categoría no crea ni reactiva nada y devuelve el foco al formulario de carga sin alterar sus datos ni su categoría seleccionada.
- [ ] La autoselección respeta el filtrado por scope del selector de categorías (RN-010): el selector del formulario solo ofrece categorías compatibles con el tipo del movimiento en curso. Como en modo inline el scope nunca puede quedar en el tipo opuesto, la categoría creada/reactivada siempre es compatible y la autoselección siempre funciona; no existe el caso de una categoría "fantasma" que el selector filtre.

**Notas:**
- Es un cambio **solo de frontend**. No se agrega ni modifica ningún endpoint ni contrato de API: se reutilizan el modal de creación de categoría (RF-CAT-002), el flujo crear-o-reactivar y la validación de unicidad ya existentes. La categoría creada/reactivada ya está disponible en el listado de categorías que alimenta el selector del formulario (RF-CAT-002: "disponible inmediatamente en los selectores").
- **Caso borde — scope incompatible (RESUELTO 2026-06-13):** se elimina de raíz restringiendo las opciones de scope en modo inline. El campo "Tipo" del modal, cuando se abre desde el formulario de carga, **no ofrece el tipo opuesto** al del movimiento en curso (solo el tipo exacto y "Ambos"). Así el usuario no puede crear una categoría incompatible y la autoselección posterior siempre es válida; no hace falta lógica de aviso, bloqueo ni manejo del caso "fantasma". Esta restricción aplica **solo** en modo inline; el modal abierto desde `/configuracion/categorias` mantiene las tres opciones con default "Ambos".

---

#### RF-MU-005 — Anular un movimiento único (skip)

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
- El flag de anulación del único vive en la propia fila (`Transaction.skipped`), a diferencia del fijo y de la cuota, que anulan **una** aparición mensual con un registro aparte. Ver `docs/data-model.md`, entidad Movimiento único, y RN-020.

---

### 3.4 Módulo: Movimientos fijos

Un movimiento fijo es una plantilla recurrente mensual: sueldo, alquiler, Netflix. Aparece automáticamente en cada mes desde su inicio hasta que el usuario lo elimina. No tiene día específico dentro del mes.

---

#### RF-MF-001 — Crear movimiento fijo

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
- [ ] Un movimiento fijo con mes de inicio en junio aparece en junio, julio, agosto, y todos los meses siguientes.
- [ ] El movimiento fijo no tiene fecha de día — aparece como ítem mensual sin día específico.
- [ ] Las validaciones de monto (> 0) aplican igual que en RF-MU-001.
- [ ] Al guardar, el formulario se cierra y aparece un toast de confirmación.
- [ ] El toast incluye una acción "Ir a ver" que navega a la vista del mes de inicio del fijo.
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
- [ ] Un fijo activo aparece en todos los meses desde `startMonth` inclusive **que caen en su frecuencia** (RF-MF-006 / RN-016). Un fijo mensual aparece en todos los meses del rango; uno de frecuencia mayor solo en los meses que dicta su paso anclado al `startMonth`.
- [ ] Un fijo con `deletedFrom` definido no aparece en ese mes ni en los siguientes.
- [ ] Si `deletedFrom` es el mes siguiente al actual, el fijo aún aparece en el mes actual.
- [ ] El movimiento fijo se distingue visualmente como "fijo" en la lista del mes.
- [ ] Un fijo **anulado** para el mes (RF-MF-005) se sigue mostrando con su diferenciación visual, pero no suma a los totales.

---

#### RF-MF-003 — Editar movimiento fijo

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

#### RF-MF-004 — Eliminar movimiento fijo

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

---

#### RF-MF-005 — Anular un movimiento fijo en un mes puntual (skip)

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede **anular** la aparición de un movimiento fijo en un **mes puntual**, sin eliminar el fijo. Es una acción **reversible** (toggle anular / des-anular). El mes anulado se sigue mostrando en la lista, pero **no suma a los totales** de ese mes ni a la proyección anual. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El movimiento fijo existe, está activo, aparece en el mes visualizado según su frecuencia (RF-MF-006) y pertenece al usuario autenticado. |

**Flujo principal:**
1. El usuario, parado en un mes en la Vista del mes (`/mes`), abre el menú de acciones del ítem de un movimiento fijo.
2. El usuario selecciona la acción **"Anular este mes"**.
3. El sistema marca esa aparición del fijo como anulada para el mes visualizado.
4. El ítem **se sigue mostrando** en la lista con su diferenciación visual de anulado, **deja de sumar** a los totales del mes y a la proyección anual.

**Flujos alternativos:**
- *A1 — Des-anular (toggle):* sobre un fijo ya anulado en ese mes, la acción se rotula **"Des-anular este mes"**; al activarla, la aparición vuelve a contar y el ítem pierde la diferenciación visual de anulado.

**Criterios de aceptación:**
- [ ] La acción de anular / des-anular vive en el **menú de acciones (kebab)** del ítem del **fijo**, sin ícono ni control adicional. Los **calculados** (de fijo, único o cuota) **no ofrecen la acción**: no tienen skip propio, **heredan** el estado de anulación de su origen para el mes (RF-MCALC-005). Los movimientos **únicos** (RF-MU-005) y las **cuotas** (RF-MC-004) tienen su propia acción de anulación, con la misma mecánica de exclusión de totales y reportes (RN-016, RN-020).
- [ ] La acción es un **toggle reversible**: anular crea la anulación del mes; des-anular la quita. Sobre el mismo fijo y mes se puede ir y volver indefinidamente.
- [ ] El mes anulado se distingue de los demás (`deletedFrom`, RF-MF-004): anular **no** elimina el fijo ni afecta otros meses — solo esa única aparición. El fijo sigue vivo y aparece en las demás apariciones que dicta su frecuencia.
- [ ] Un fijo anulado para un mes **se sigue mostrando** en la lista de ese mes, con diferenciación visual.
- [ ] El monto de un fijo anulado **no suma** a los totales del mes (RF-VM-002, RF-DASH-002) **ni** a la serie anual de los reportes (RF-REP-001).
- [ ] La anulación es por mes puntual: anular un mes no afecta los meses anteriores ni posteriores.
- [ ] Solo se pueden anular movimientos fijos propios.

**Notas:**
- El detalle visual del ítem anulado y del control de la acción lo define `control-design` (`docs/design.md`).
- La anulación se modela como un registro aparte `(fijo, mes)`, **distinto** de `deletedFrom`: `deletedFrom` significa "el fijo deja de existir de ahí en adelante"; la anulación significa "esta única aparición no cuenta, pero el fijo sigue vivo" (ver `docs/data-model.md`, entidad RecurringSkip, y RN-016).

---

#### RF-MF-006 — Periodicidad del movimiento fijo (frecuencia)

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
- [ ] La frecuencia está **anclada al mes de inicio**: un fijo con frecuencia 2 que arranca en marzo aparece en marzo, mayo, julio, etc.; uno con frecuencia 3 que arranca en enero aparece en enero, abril, julio, octubre; y así con cualquier N (aparece cada N meses desde el mes de inicio).
- [ ] Un fijo aparece en un mes solo si, además de estar activo en el rango (RF-MF-002), ese mes cae en su frecuencia respecto del mes de inicio.
- [ ] La frecuencia **es inmutable** tras crearse (igual que el tipo): el selector aparece **solo al crear**; en el formulario de edición se muestra de **solo lectura**. Cambiar la cadencia de un fijo equivale a crear otro.
- [ ] El cálculo de qué fijo cae en cada mes sigue siendo **on-the-fly** (RN-006): no se generan filas por instancia mensual.

**Notas:**
- El detalle visual del selector de frecuencia y de la etiqueta de frecuencia en el ítem del mes lo define `control-design` (`docs/design.md`).
- La regla de cálculo de la frecuencia está formalizada en RN-016. La anulación de un mes puntual (RF-MF-005) opera sobre **una** de las apariciones que dicta la frecuencia.

---

#### RF-MF-007 — Arranque y vigencia del fijo en la card de detalle

| Campo | Detalle |
|---|---|
| **Descripción** | La **card de detalle** (RF-VM-007) de un ítem fijo muestra su **vigencia**: el **mes de arranque** del fijo lógico y su **mes de fin** cuando lo tiene. Ambos son del **fijo lógico**, independientes del mes visualizado. La **fila de `/mes` no muestra el arranque** — se consulta en la card. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Baja |
| **Precondiciones** | La card de detalle de un ítem fijo está abierta. |

**Criterios de aceptación:**
- [ ] La card muestra el arranque del **fijo lógico**, no el de la fila vigente: un fijo creado en marzo 2024 y editado luego sigue mostrando marzo 2024 como arranque, aunque la edición haya partido la cadena (ver RN-005 y `docs/data-model.md`, §Identidad de cadena estable).
- [ ] La card muestra el **fin (vigencia)** del fijo cuando tiene una terminación programada (`endMonth`); un fijo sin fin programado se muestra como **activo indefinidamente**.
- [ ] Un **calculado de origen fijo** muestra su **propio** arranque y su **propio** fin (los de su cadena), no los del origen: un calculado creado en enero 2026 sobre un fijo de marzo 2024 muestra enero 2026.
- [ ] El arranque **no** aparece en la fila de `/mes` (RF-VM-001); vive solo en la card.
- [ ] La ubicación y forma visual del dato en la card la define `control-design` (`docs/design.md`).

**Notas:**
- El backend expone arranque y fin en `MovementItem.startMonth` / `MovementItem.endMonth` para fijos (ver `docs/data-model.md`, §Contrato de movimientos del mes); la resolución por cadena vive en `docs/backend.md`, §Movimientos fijos.

---

### 3.4.b Submódulo: Movimientos calculados

Un **movimiento calculado** es un movimiento **fijo** cuyo monto **no se ingresa**: se **deriva** del monto de un **movimiento de origen** mediante una **fórmula**, **en vivo**. Tiene categoría y descripción **propias**; su **tipo** (Gasto/Ingreso) **no se elige**: se **deriva** del signo del monto resultante (RF-MCALC-003). Lo único que toma del origen es el **monto**. El **origen puede ser un fijo, un único o un grupo de cuotas** (RF-MCALC-008); el calculado **espeja la cadencia** del origen. Es un fijo a todos los demás efectos (se edita y elimina con la misma mecánica de split del calculado de fijo, salvo el borrado total del calculado de único/cuota — RF-MCALC-006). No es un tipo nuevo en el formulario de carga: su **único** punto de creación es la acción **"Crear movimiento calculado"** sobre un fijo, único o cuota en `/mes` (RF-MCALC-001).

---

#### RF-MCALC-001 — Crear movimiento calculado desde un movimiento de origen

| Campo | Detalle |
|---|---|
| **Descripción** | Desde la Vista del mes (`/mes`), un ítem **fijo, único o cuota** ofrece —además de editar y eliminar— la acción **"Crear movimiento calculado"**. Es la **única** forma de crear un movimiento calculado: define el movimiento de origen, su categoría/descripción propias y la fórmula (con su signo) que deriva el monto; el **tipo** queda determinado por el signo del resultado (RF-MCALC-003). El **tipo de origen** (fijo / único / cuota) determina la cadencia del calculado (RF-MCALC-008). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe un movimiento **fijo, único o de cuotas** en el mes visualizado, propio del usuario. El origen **no** es a su vez un movimiento calculado (sin encadenamiento). |

**Flujo principal:**
1. El usuario, parado en un mes en `/mes`, abre el menú de acciones de un ítem **fijo, único o cuota** y elige **"Crear movimiento calculado"**.
2. El sistema abre el formulario del calculado, con el movimiento de origen ya fijado (el ítem desde el que se disparó).
3. El usuario elige **categoría** y **descripción** propias del calculado (independientes del origen). **No** elige tipo: se deriva del signo del resultado (RF-MCALC-003).
4. El usuario define la **fórmula**: un **operador** (`+`, `−`, `×`, `÷`, `%`) y un **operando** numérico común (RN-017).
5. El usuario elige el **signo del resultado** (positivo o negativo) mediante el switch de signo (RN-018).
6. El usuario confirma. El sistema crea el movimiento calculado como un fijo vinculado al **origen** (RF-MCALC-004), con su monto ya derivado para cada mes en que el origen aparece y su **tipo derivado** del signo de ese monto, siguiendo la **cadencia del origen** (RF-MCALC-008).

**Flujos alternativos:**
- *A1 — El usuario cancela:* no se crea nada.

**Criterios de aceptación:**
- [ ] La acción **"Crear movimiento calculado"** está disponible en los ítems **fijo, único y cuota** de `/mes`.
- [ ] El origen es un **fijo, un único o un grupo de cuotas**. Un movimiento **calculado no puede ser origen** de otro calculado (sin encadenamiento): la acción **no** se ofrece sobre un ítem que ya es calculado.
- [ ] Un mismo origen puede tener **varios** movimientos calculados derivados.
- [ ] El calculado se crea como un **fijo** (es a la vez fijo y calculado): aparece en `/mes` con la misma mecánica de listado de los fijos.
- [ ] La categoría y la descripción del calculado son **propias** y se eligen al crearlo; pueden diferir del origen. El **tipo no se elige**: se deriva del signo del monto resultante (RF-MCALC-003), de modo que un calculado puede tener distinto tipo que el origen (ej.: origen = sueldo/Ingreso; "ahorro = 10% del sueldo" con signo `−` → monto negativo → tipo derivado **Gasto**).
- [ ] La fórmula (operador + operando) y el signo son obligatorios; el **monto no se ingresa** (se deriva — RN-017) y el **tipo tampoco** (se deriva — RF-MCALC-003).
- [ ] No existe un tab "calculado" en el formulario de carga (RF-CM-001): el único punto de creación es esta acción.

---

#### RF-MCALC-002 — Fórmula del movimiento calculado

| Campo | Detalle |
|---|---|
| **Descripción** | El monto del calculado se obtiene aplicando una **fórmula** —un operador y un operando numérico— sobre el monto del fijo de origen **en ese mes**. Operadores soportados: suma, resta, multiplicación, división y porcentaje. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El calculado está en creación o edición (RF-MCALC-001 / RF-MCALC-006). |

**Operadores (los cinco):**
- **Suma (`+`)** — `origen + operando`.
- **Resta (`−`)** — `origen − operando`.
- **Multiplicación (`×`)** — `origen × operando`.
- **División (`÷`)** — `origen ÷ operando` (operando ≠ 0).
- **Porcentaje (`%`)** — `origen × operando ÷ 100` (ej.: operando `10` = 10% del origen).

**Criterios de aceptación:**
- [ ] La fórmula es **una sola operación**: un operador de los cinco más un **operando** numérico común (se ingresa como número, ej. `5000`, `1.5`, `10`).
- [ ] El operando se valida según RN-017: **división y porcentaje con operando 0 no se permiten** (división por cero); el resto acepta cualquier operando numérico.
- [ ] El resultado de la fórmula se aplica sobre el monto del origen **del mes en cuestión** y se **redondea a centavos enteros** (RN-017): no se persiste precisión sub-centavo.
- [ ] El signo final del resultado lo determina el switch de signo (RN-018), no la fórmula.

---

#### RF-MCALC-003 — Signo del resultado y tipo derivado

| Campo | Detalle |
|---|---|
| **Descripción** | El movimiento calculado tiene un **switch de signo** que fuerza el resultado final a **positivo** o **negativo**. A diferencia del resto de los movimientos (monto siempre > 0), el monto de un calculado **puede ser negativo o cero** (RN-018). El **tipo** (Gasto/Ingreso) **no se elige**: se **deriva del signo del monto resultante** —monto negativo → **Gasto (`EXPENSE`)**; monto positivo → **Ingreso (`INCOME`)**—, de modo que signo y tipo quedan siempre consistentes (positivo = ingreso, negativo = gasto). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El calculado está en creación o edición. |

**Criterios de aceptación:**
- [ ] Hay un control de signo (positivo / negativo) que multiplica el resultado de la fórmula por `+1` o `−1`. **No** hay selector de tipo en el calculado.
- [ ] El monto resultante del calculado **puede ser negativo o cero** — excepción explícita a la regla de monto > 0 (RN-001), válida **solo** para movimientos calculados (RN-018).
- [ ] El **tipo se deriva del signo del monto final**: `final < 0` → **Gasto (`EXPENSE`)**; `final > 0` → **Ingreso (`INCOME`)**.
- [ ] **Caso borde `final == 0`:** se **permite guardar**; el tipo derivado por defecto es **Gasto (`EXPENSE`)**. Es solo una convención de borde: un monto 0 no aporta a ningún bucket de totales (RN-019), así que el tipo asignado no altera totales ni balance.
- [ ] El signo es un campo **propio** del calculado, editable como la fórmula (RF-MCALC-006). El tipo se recalcula al cambiar el signo o la fórmula (cambia el signo del resultado).
- [ ] La imputación del monto (con signo) a los totales del mes y a los reportes sigue RN-019: la **magnitud** del monto suma al bucket del tipo derivado.

---

#### RF-MCALC-004 — Vínculo vivo con el origen y monto sincronizado

| Campo | Detalle |
|---|---|
| **Descripción** | El vínculo con el origen es **vivo**: el monto del calculado **no se persiste**, se **deriva al vuelo** del monto del origen en cada lectura (on-the-fly, RN-006, igual que fijos, únicos y cuotas; aplica a los tres tipos de origen — RF-MCALC-008). El calculado **espeja la estructura del origen** mes a mes: si el origen vale distinto en distintos meses (por su cadena de fijo), el monto del calculado sigue esa variación automáticamente, sin re-guardar nada. Para un origen de **cuota**, la base de la fórmula es el **monto por cuota** del grupo (no el total). **No** es un valor congelado. |
| **Actor** | Sistema |
| **Prioridad** | Media |
| **Precondiciones** | Existe un movimiento calculado vinculado a un fijo de origen. |

**Criterios de aceptación:**
- [ ] El monto del calculado en un mes es `signo × redondear(fórmula(montoDelOrigenEseMes))` (RN-017 / RN-018). Para origen de **cuota**, `montoDelOrigenEseMes` es el **monto por cuota** del grupo.
- [ ] Para origen **fijo**, el vínculo es a la **identidad de cadena** del origen, no a una fila puntual (`docs/data-model.md`, §Identidad de cadena estable): sobrevive a los splits del origen. Para origen **único** o **cuota**, el vínculo es al `Transaction` / `InstallmentGroup` de origen (RF-MCALC-008).
- [ ] Si el monto del origen cambia (edición del origen, o variación mes a mes propia de su cadena), el monto del calculado **refleja el nuevo valor** en la próxima lectura, sin re-guardar nada ni acción del usuario (se deriva al vuelo). Aplica a los tres tipos de origen.
- [ ] El calculado aparece **en cada mes donde aparece el origen** según la **cadencia del origen** (RF-MCALC-008), y solo en esos meses.
- [ ] **No congelado:** se descarta cualquier interpretación de monto estático fijado al crear.

---

#### RF-MCALC-005 — Ciclo de vida atado al origen

| Campo | Detalle |
|---|---|
| **Descripción** | El movimiento calculado sigue el **ciclo de vida del origen**: nace, aparece y desaparece con él. |
| **Actor** | Sistema |
| **Prioridad** | Media |
| **Precondiciones** | Existe un movimiento calculado vinculado a un fijo de origen. |

**Criterios de aceptación:**
- [ ] Si el origen **fijo** se **elimina** (RF-MF-004), el calculado **se elimina** (con la misma semántica de pivote/split del fijo: desaparece desde el mes en que desaparece el origen, preservando el pasado).
- [ ] Si el origen **único** o de **cuota** se **elimina**, su(s) calculado(s) se **eliminan por completo** (cascada total, RF-MCALC-008): un único/cuota no tiene split, así que al borrarlo desaparece toda su derivación.
- [ ] Si el origen (**fijo**, **único** o **cuota**) está **anulado** en un mes (skip — RF-MF-005 / RF-MU-005 / RF-MC-004), el calculado **se anula ese mes**: se sigue listando pero no suma a los totales ni a la serie anual, igual que el origen. El calculado **no tiene skip propio** (el toggle no aparece en su kebab): su estado de anulación es siempre el del origen para ese mes.
- [ ] Si el origen **fijo** cambia de **frecuencia** —que en el modelo equivale a recrearlo (RF-MF-006)— el calculado **matchea la presencia** del origen vigente.
- [ ] El calculado nunca aparece en un mes donde el origen no aparece.

---

#### RF-MCALC-006 — Editar y eliminar un movimiento calculado

| Campo | Detalle |
|---|---|
| **Descripción** | El movimiento calculado se edita y elimina **por su cuenta**, como cualquier fijo: categoría, descripción, fórmula y signo son editables; el **tipo no es editable** (se deriva del signo del resultado, RF-MCALC-003). La eliminación es independiente de la del origen. La edición usa la **misma mecánica de split del pasado** que los fijos (RF-MF-003 / RF-MF-004, RN-005). El **borrado** del calculado **espeja cómo se borra su origen**: calculado de **fijo** → borrado por boundary (split del pasado); calculado de **único o cuota** → **borrado total directo** (un solo confirmar, sin opciones "desde este mes / mes siguiente"), porque un único/cuota tampoco se borra por mes (RF-MCALC-008). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El movimiento calculado existe y pertenece al usuario. |

**Criterios de aceptación:**
- [ ] Son editables: **categoría, descripción, fórmula (operador + operando) y signo**. El **tipo no es editable** (se deriva del signo del resultado). El vínculo al origen (la cadena origen) **no** se cambia editando: para derivar de otro fijo se crea un calculado nuevo.
- [ ] La edición aplica **desde el mes visualizado inclusive en adelante** (split de fijos, RN-005); el pasado del calculado es inmutable. Aplica a los tres tipos de origen.
- [ ] La eliminación del calculado es **independiente** de la del origen: borrar el calculado no toca el origen ni a otros calculados del mismo origen.
- [ ] Borrado de un calculado de **fijo**: aplica **desde el mes visualizado** (boundary/split, RF-MF-004). Borrado de un calculado de **único o cuota**: **borrado total directo** (una sola confirmación, sin elegir mes — RF-MCALC-008).
- [ ] Eliminar el **origen** sí arrastra al calculado (RF-MCALC-005); eliminar el **calculado** no arrastra al origen.

---

#### RF-MCALC-007 — Indicación visual de la relación padre/hijo

| Campo | Detalle |
|---|---|
| **Descripción** | En `/mes` se distingue cuándo un movimiento **tiene** un calculado derivado (es origen/padre) y cuándo un movimiento **es** un calculado de otro (es hijo). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Baja |
| **Precondiciones** | El usuario está en la Vista del mes. |

**Criterios de aceptación:**
- [ ] En `/mes` se ve que un ítem fijo **tiene al menos un calculado derivado** (es padre).
- [ ] En `/mes` se ve que un ítem **es un calculado** de un fijo de origen (es hijo).

**Notas:**
- El **detalle visual** de esta indicación (cómo se representa la relación padre/hijo, ubicación, jerarquía) lo define `control-design` (`docs/design.md`). Este RF fija únicamente el requerimiento funcional de que la relación sea visible.

---

#### RF-MCALC-008 — Origen único o cuota; cadencia espejo del origen

| Campo | Detalle |
|---|---|
| **Descripción** | El **origen** de un calculado puede ser un **fijo**, un **único** o un **grupo de cuotas**. El calculado **espeja la cadencia del origen**: aparece en los mismos meses que el origen, derivando del monto del origen en cada uno. La derivación es **en vivo** para los tres tipos (RF-MCALC-004): editar el monto del origen recalcula el calculado en la próxima lectura, sin persistir el monto. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe un movimiento fijo, único o de cuotas, propio del usuario, que no es a su vez un calculado. |

**Cadencia espejo por tipo de origen:**
- **Fijo:** una aparición por cada mes en que el fijo aparece según su frecuencia (RF-MCALC-004/005). Base de la fórmula: el monto del fijo en ese mes.
- **Único:** **un solo** calculado, presente **únicamente en el mes del único** (RN-011). Base: el monto del único. El calculado **hereda la fecha del único** (`occurredAt`/`timezone` del origen), ya que ocurre junto con él y la sección Únicos muestra día/hora (contrato en `docs/data-model.md`, §`MovementItem`); los calculados de fijo y de cuota no tienen fecha.
- **Cuota:** **un calculado por cada mes/cuota del grupo** (`startMonth ≤ mes < startMonth + totalInstallments`). Base: el **monto por cuota** del grupo (NO el total).

**Criterios de aceptación:**
- [ ] Un origen **único** produce un calculado presente solo en su mes; un origen **cuota** produce un calculado por cada mes del grupo.
- [ ] El calculado de **cuota** deriva del **monto por cuota** del grupo, no del total de la compra.
- [ ] La derivación en vivo (RF-MCALC-004) aplica también a único y cuota: editar el monto del origen recalcula el calculado en la próxima lectura (no se persiste el monto).
- [ ] El calculado se **lista en la sección de su origen**: calculado de único → sección **Únicos**; de cuota → sección **Cuotas**; de fijo → sección **Fijos**.
- [ ] El calculado de **cuota NO arrastra la etiqueta "X/N"** (no es una cuota real del grupo, solo deriva su monto).
- [ ] El calculado de **único hereda `occurredAt`/`timezone` del origen** (muestra día/hora como el resto de la sección Únicos); los de fijo y cuota quedan sin fecha (`null`).

---

#### RF-MCALC-009 — Borrado total del calculado de único o cuota

| Campo | Detalle |
|---|---|
| **Descripción** | Un único y un grupo de cuotas **no se borran por mes** (no tienen split del pasado); por eso, el **borrado del propio calculado** de un origen único o cuota es **total y directo** —una sola confirmación, sin las opciones "desde este mes / desde el mes siguiente" del calculado de fijo—, espejando cómo se borra su origen. La **cascada** del borrado del origen (RF-MCALC-005) hacia su(s) calculado(s) es también **total**. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe un calculado de origen único o cuota. |

**Criterios de aceptación:**
- [ ] Borrar el **propio calculado** de un único/cuota: confirmación directa, borra el calculado **entero** (todas sus apariciones). No se ofrece elegir mes.
- [ ] Borrar el **origen** único/cuota: cascada **total** a su(s) calculado(s) (los borra enteros).
- [ ] El calculado de **fijo** conserva su borrado por **boundary** sobre la cadena (RF-MCALC-006).

---

#### RF-MCALC-010 — Calculados de único y cuota en reportes

| Campo | Detalle |
|---|---|
| **Descripción** | Los calculados de origen **único** y **cuota** se **incluyen en la proyección anual** de `/reportes`, igual que los de fijo, con la **imputación por magnitud al bucket de su tipo derivado** (RN-019). |
| **Actor** | Sistema |
| **Prioridad** | Media |
| **Precondiciones** | Existen calculados de único/cuota y el usuario consulta `/reportes`. |

**Criterios de aceptación:**
- [ ] Un calculado de único/cuota imputa su **magnitud** (`\|amountCents\|`) al bucket de su **tipo derivado** (RN-018/019) en cada mes en que aparece (el mes del único; cada mes del grupo de cuotas).
- [ ] Conserva el tipo derivado del signo: `final > 0` → `INCOME`, `final ≤ 0` → `EXPENSE` (default `0 = EXPENSE`).
- [ ] Se preserva la invariante de reportes (suma de bandas de gasto del mes = `expenseCents`), igual que con los calculados de fijo.

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

> **Nota:** En v1, las cuotas son **solo Gasto (`EXPENSE`)**. El "Ingreso en cuotas" está **fuera de alcance v1** (ver sección 6). Por lo tanto, donde el paso 2 del flujo dice "selecciona Gasto o Ingreso", en v1 aplica únicamente Gasto: el selector de tipo **no se ofrece** en el tab Cuotas. El texto del flujo se conserva tal cual para una versión futura que incorpore "Ingreso en cuotas".
4. El usuario ingresa la **cantidad de cuotas** (entero > 0).
5. El usuario selecciona el **mes de inicio**. Default: el **mes contexto** si el formulario se abrió desde la Vista del mes (`/mes`); en cualquier otro origen (dashboard, sidebar), el **mes actual**. Es editable y admite meses pasados.
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
- [ ] El mes de inicio tiene como default el mes contexto cuando el formulario se abre desde la Vista del mes, y el mes actual en cualquier otro origen. Es editable y admite meses pasados.
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

> **Nota:** El tipo (Gasto/Ingreso) no es editable: en v1 las cuotas son **solo Gasto** (ver nota en RF-MC-001).

---

#### RF-MC-004 — Anular una cuota en un mes puntual (skip)

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
- [ ] La acción de anular / des-anular vive en el **menú de acciones (kebab)** del ítem de la cuota, con rótulo **"Anular este mes"** / **"Des-anular este mes"** (igual que el fijo: anula **una** instancia mensual, no el grupo entero).
- [ ] La acción es un **toggle reversible**: anular crea la anulación de ese mes; des-anular la quita. Se puede ir y volver indefinidamente.
- [ ] Anular una cuota en un mes **no** afecta las demás cuotas del grupo ni las anula: solo esa instancia mensual.
- [ ] Aplica a cualquier dirección de la cuota (gasto o ingreso; en v1 las cuotas son solo Gasto, ver RF-MC-001).
- [ ] Una cuota anulada **se sigue mostrando** en la lista con diferenciación visual, y su monto **no suma** a los totales del mes (RF-VM-002, RF-DASH-002) **ni** a los reportes (RF-REP-001) — mismo efecto que la anulación de un fijo (RN-016), formalizado en RN-020.
- [ ] Los **calculados** derivados de una cuota anulada **heredan** su estado de anulación para ese mes: no tienen skip propio (RF-MCALC-005).
- [ ] Solo se pueden anular cuotas de grupos propios.

**Notas:**
- El detalle visual del ítem anulado y del control de la acción lo define `control-design` (`docs/design.md`).
- La anulación de una cuota se modela como un registro aparte `(grupo, mes)` —espejo de la anulación de un fijo—, distinto de eliminar el grupo (RF-MC-002). Ver `docs/data-model.md`, entidad Anulación de cuota (InstallmentSkip), y RN-020.

---

#### RF-MC-005 — Total del plan de cuotas

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

**Moneda:** cuando la moneda del movimiento difiere de la default, el total del plan se expresa en la **moneda original del movimiento** y **no se convierte**. La cotización guardada del grupo (RF-CUR-004) es la del momento de la carga; extrapolarla a todas las cuotas del plan produciría una cifra que no corresponde a plata real de ningún mes. En el reporte anual de Cuotas la ambigüedad no se presenta: el monto de la barra ya viene en la **moneda de display de la card** (RF-REP-007) y el total se expresa en esa misma moneda.

**Criterios de aceptación:**
- [ ] El total es `monto por cuota × cantidad de cuotas`, calculado en el frontend con datos que la superficie ya tiene; no hay campo persistido ni provisto por el backend.
- [ ] Se muestra en la card de detalle de `/mes`, en el tooltip de barra del reporte anual de Cuotas y en el formulario de alta/edición de cuotas.
- [ ] En la **card** y en el **tooltip** se **omite** cuando el plan tiene **una sola cuota** (sería idéntico a la cifra ya mostrada).
- [ ] En el **formulario** se actualiza en vivo al editar monto por cuota o cantidad de cuotas, antes de guardar.
- [ ] Con moneda distinta de la default, el total va en la **moneda original del movimiento**, sin convertir; en el reporte, en la moneda de display de la card.
- [ ] El total es **informativo**: no valida, no bloquea el guardado y no tiene tope propio. El tope de monto (RN-023) sigue aplicando **solo** al monto por cuota.

**Notas:**
- La presentación visual del total en cada superficie la define `control-design` (`docs/design.md`).

---

### 3.6 Módulo: Categorías

Las categorías clasifican los movimientos. Son personalizables por usuario y tienen un scope que define a qué tipo de movimiento aplican, y un color que el usuario elige y edita desde una matriz de colores predefinidos.

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
- [ ] El usuario **elige el color** de la categoría desde la matriz de colores (RF-CAT-005). El sistema **pre-selecciona** el color "menos usado" como default, pero el usuario puede cambiarlo (incluye un botón "aleatorio").
- [ ] La categoría creada está disponible inmediatamente en los selectores de movimientos.
- [ ] La gestión de categorías (crear, editar, eliminar y listar) vive en la **sección Categorías del hub de Configuración**, accesible en `/configuracion/categorias` (RF-NAV-001; ver `screens.md`, §6). Es una superficie de gestión dedicada, no un modal.

**Notas:**
- La unicidad de nombre de categoría activa se valida en **lógica de aplicación**, no con un constraint `@@unique` de base de datos. Motivo: la comparación normalizada (trim + insensible a mayúsculas y acentos) y el flujo "crear-o-reactivar" no caben en un constraint de DB. Ver `docs/data-model.md`.

---

#### RF-CAT-003 — Editar categoría

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede modificar el nombre, el scope y el color de una categoría existente. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | La categoría existe y pertenece al usuario autenticado. |

**Criterios de aceptación:**
- [ ] El nombre, el scope y el **color** son editables (color: ver RF-CAT-005).
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
- [ ] La categoría eliminada desaparece de la sección de gestión de categorías (`/configuracion/categorias`): mientras está eliminada no se ve su fila ni su contador (RF-CAT-006).
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
| **Descripción** | Cada categoría tiene un color que el usuario **elige y puede editar**, tanto al crear como al editar la categoría, desde una **matriz de colores predefinidos**. El color identifica visualmente a la categoría en la UI. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Baja |
| **Precondiciones** | Se crea o edita una categoría. |

**Matriz de colores:** el color se elige de una **matriz fija de 40 colores** (8 hues × 5 tonalidades). **No** hay ingreso de hex libre: solo colores que pertenezcan a la matriz. (Definición de la matriz y del pool base en `docs/data-model.md`, "Pool de colores".)

**Criterios de aceptación:**
- [ ] Al **crear** una categoría, el usuario puede elegir su color de la matriz de 40 colores.
- [ ] El sistema **pre-selecciona** un color por defecto al abrir el alta: el color **"menos usado"** entre las categorías activas del usuario, calculado sobre los 8 colores base (RN-013). El usuario puede dejar ese default o elegir otro de la matriz.
- [ ] Existe un botón **"aleatorio"** que selecciona un color al azar de la matriz.
- [ ] Al **editar** una categoría, el color es modificable: el picker abre con el color actual de la categoría seleccionado.
- [ ] Solo se aceptan colores que pertenezcan a la matriz; no hay hex libre.
- [ ] Las categorías por defecto del alta de cuenta (RF-CAT-001) se siguen asignando automáticamente (el alta no tiene UI de elección).
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

### 3.6.b Submódulo: Métodos de pago

Un método de pago clasifica **con qué se pagó o cobró** un movimiento (tarjeta de crédito, débito, efectivo). Es una entidad **espejo de Categoría**: propia del usuario, con soft delete (el histórico conserva la referencia), gestor dedicado como **sección del hub de Configuración** (`/configuracion/metodos-pago`) y contador de movimientos. La asociación de un movimiento a un método es **opcional**. La identidad visual del método es un **ícono** (no un color); el set de íconos y su cromo los define `control-design` (ver `docs/design.md`, §Métodos de pago — identificador de ícono). La regla de negocio compacta vive en RN-021; el modelo en `data-model.md`, §Métodos de pago.

> La cuenta nueva **nace sin métodos de pago**: la feature es 100% opcional (a diferencia de las categorías por defecto, RF-CAT-001).

---

#### RF-PM-001 — Crear método de pago

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

#### RF-PM-002 — Editar método de pago

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

#### RF-PM-003 — Eliminar método de pago

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

#### RF-PM-004 — Ícono identificador del método

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

#### RF-PM-005 — Contador de movimientos por método

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

#### RF-PM-006 — Asociar un método de pago a un movimiento

| Campo | Detalle |
|---|---|
| **Descripción** | El formulario de carga permite asociar, **opcionalmente**, un método de pago a cualquier movimiento. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] El formulario de carga suma un **selector de método de pago opcional** en los tres tabs (Único / Fijo / Cuotas), análogo al selector de categoría, con opción **"(ninguno)"** / vacío y **default = ninguno**. **Sin botón "+ Nueva" inline** (a diferencia de categorías, RF-MU-004).
- [ ] El método es **opcional**: un movimiento puede guardarse sin método (no es error).
- [ ] El selector lista solo métodos **activos** (los soft-deleted no aparecen).
- [ ] Un movimiento **calculado** **hereda** el método de pago de su origen y **no lo puede editar ni tener uno propio** —no se elige ni se persiste propio; se deriva al vuelo del origen—. Mismo patrón que la moneda/cotización del calculado (RF-CUR-004).
- [ ] **Débito automático — atributo del movimiento.** El formulario suma un **checkbox "débito automático"** que aparece **solo cuando el método elegido para ese movimiento es de tipo `DEBIT`**. Es un flag **del movimiento**, no del método. Aplica a único / fijo / cuota; el **calculado no lo muestra** (lo hereda del origen, no editable). La regla de persistencia está en RN-021.
- [ ] El método asociado se expone en `GET /movements` (nombre + ícono + tipo) para que la Vista del mes lo muestre, y cada movimiento expone `autoDebit` (`boolean | null`) **a nivel del ítem** (fuera del objeto `paymentMethod` embebido); contrato en `data-model.md`, §Contrato de movimientos del mes.

---

#### RF-PM-007 — Método de pago predeterminado por estructura de movimiento

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
- Persistencia en el blob `UserPreferences` (clave `defaultPaymentMethods`), sin cambios de backend; shape y semántica en `data-model.md`, §Claves del blob → `defaultPaymentMethods`.
- El detalle visual de la sección "Predeterminado para" del modal y del indicador de lectura en la fila lo define `control-design`.

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
- [ ] Cada fila muestra **lo glanceable**: tipo (gasto/ingreso), nombre, categoría, frecuencia (fijos), un **discriminador** (fecha del único / "Cuota X/N"), monto y los estados (Anulado, marcas de límite). El **detalle secundario** (método de pago, moneda/cotización, débito automático, hora del único, vigencia del fijo, plan de la cuota, fórmula del calculado) **no** vive en la fila: se consulta en la **card de detalle** (RF-VM-007).
- [ ] La lista está agrupada por tipo en tres secciones separadas y rotuladas, **Únicos**, **Fijos**, **Cuotas** (orden default; reordenable por el usuario, RF-VM-005). Dentro de cada sección, los movimientos se ordenan por **monto descendente** (`amountCents` DESC: el monto más alto primero, por magnitud, sin distinguir gasto de ingreso). Ante montos iguales, el desempate estable es por sección: Únicos por instante (fecha y hora) descendente; Fijos por fecha de creación descendente; Cuotas por identificador ascendente. El reordenamiento de secciones entre sí (RF-VM-005) aplica **solo a las secciones**, nunca a los ítems dentro de una sección.
- [ ] **Orden de la sección Únicos — alternable por el usuario.** La sección **Únicos** permite alternar el orden de sus movimientos entre **por monto** (descendente, default) y **por fecha** (más reciente primero; desempate por monto descendente). El control vive en la cabecera de la sección Únicos. El orden elegido se **persiste por usuario** (clave `unicosSort`, default `"amount"`; shape en `docs/data-model.md`). Aplica **solo a Únicos**: Fijos y Cuotas no tienen fecha y conservan el orden por monto descendente. El orden de los ítems en Fijos y Cuotas **no** es alterable por el usuario.
- [ ] Las **tres secciones se muestran siempre**, aunque estén vacías. Una sección sin movimientos muestra su cabecera completa (rótulo, contador en 0, subtotal en $0) y un mensaje de estado vacío inline propio ("Sin movimientos únicos" / "Sin fijos" / "Sin cuotas").
- [ ] Si no hay movimientos en el mes, no se muestra un mensaje de estado vacío global: las tres secciones aparecen vacías con su empty inline propio y los totales del mes en cero, sin error.

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
| **Descripción** | El usuario puede navegar al mes anterior o siguiente desde la vista del mes, y saltar directamente a cualquier mes/año. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario está en la vista del mes. |
| **Estado** | Decidido — aplica a la vista del mes. El dashboard siempre muestra el mes actual. |

La navegación de meses es **ilimitada**: no hay rango de año (sin mínimo ni máximo de negocio), por lo que ningún control de navegación se deshabilita por tope. Además del avance secuencial ±1 mes, el rótulo de período actúa como **disparador de salto rápido**: abre un selector de dos ruedas (mes y año) para saltar a cualquier mes/año; al confirmar navega con el mismo mecanismo que el avance secuencial. El único feedback de validación del selector es el botón "Ir" deshabilitado hasta que el año tenga 4 dígitos. El disparador sigue accionable durante el modo orden de secciones (RF-VM-005). El detalle visual del selector vive en `docs/design.md`.

Existe además un **acceso directo al mes en curso** disponible desde cualquier mes navegado. Se muestra **únicamente cuando el mes visualizado no es el mes en curso**; estando en el mes en curso no se renderiza. Lleva un indicador de dirección que se **deriva de la comparación entre el mes visualizado y el mes en curso**: apunta hacia adelante cuando el mes visualizado es anterior al actual y hacia atrás cuando es posterior, coincidiendo con el control de avance secuencial que llevaría al mes en curso. Es navegación pura del frontend: no cambia el modelo de datos ni ningún contrato. El detalle visual vive en `docs/design.md`.

**Criterios de aceptación:**
- [ ] Existen controles para avanzar al mes siguiente y retroceder al mes anterior.
- [ ] El rótulo de período abre un selector de dos ruedas que permite saltar a cualquier mes/año; al confirmar, la lista y los totales reflejan el mes elegido.
- [ ] La navegación no tiene tope de año: ningún control se deshabilita por rango. El botón "Ir" del selector se deshabilita solo mientras el año no tenga 4 dígitos.
- [ ] La lista y los totales se actualizan para reflejar el mes seleccionado.
- [ ] Se muestra el nombre del mes y el año del mes activo.
- [ ] Existe un acceso directo al mes en curso que se muestra únicamente cuando el mes visualizado no es el mes en curso; su indicador de dirección se deriva de comparar el mes visualizado con el mes en curso.

---

#### RF-VM-005 — Colapsar y reordenar las secciones de la vista del mes

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
- [ ] El estado colapsado/expandido de cada sección y el orden de las secciones se **persisten por usuario** vía las preferencias; sobreviven a la navegación y al cierre de sesión. Shape de la clave de preferencias en `docs/data-model.md` (`monthSections`).
- [ ] En modo orden, el botón "+ Nuevo movimiento" se deshabilita y el colapsar/expandir queda suspendido (la cabecera arrastra en lugar de colapsar). No hay acción de "cancelar": el orden se aplica en vivo.

---

#### RF-VM-006 — Filtros por listado de la vista del mes

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
- [ ] La selección **se mantiene al navegar entre meses** (es por pantalla, no por mes) y se **persiste por usuario** vía las preferencias, clave `monthListFilters` (shape en `docs/data-model.md`); sobrevive a la navegación y al cierre de sesión.
- [ ] **Relevancia del filtro de categoría:** el filtro de categoría de cada sección lista **solo las categorías presentes en los movimientos de esa sección** del mes (no el catálogo completo del usuario). Cada sección deriva su universo de categorías de sus propios movimientos.
- [ ] Con categoría "todas" (sin filtro) se siguen mostrando movimientos cuya categoría fue eliminada (soft delete, RF-CAT-004 / RF-VM-002); con un subconjunto, solo entran las categorías seleccionadas.
- [ ] El filtro **no es global:** no afecta a otras pantallas (dashboard ni reportes tienen su propio estado de filtro, independiente de este).
- [ ] **Arranque fresco:** cada lista arranca en su default (Ambos + todas). La preferencia `monthCategoryFilter` **no se migra** ni se lee desde `/mes`.

**Notas:**
- El **filtrado es 100% en el frontend**: `/mes` trae todo el mes en una sola llamada y filtra cada lista en cliente; los totales del mes se recalculan en cliente sobre lo visible. El query param `categories` de `GET /movements` **no se usa desde `/mes`** (lo usa `/reportes`); ver `docs/data-model.md`, §Filtro de categorías.

---

#### RF-VM-007 — Card de detalle de movimiento

| Campo | Detalle |
|---|---|
| **Descripción** | Al hacer clic en el **cuerpo** de una fila de la Vista del mes (`/mes`) se abre una **card de detalle read-only** del movimiento. Muestra los datos que la fila no muestra; no tiene acciones ni edita nada in-situ. La edición y demás acciones viven en el **kebab (⋮)** de la fila. |
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
- **Cerrar** — la card se cierra con **✕**, con **Esc** y con **clic en el scrim** (fondo). Es su única acción: la card no tiene footer de acción ni botón "Editar". Editar, anular, duplicar, crear movimiento calculado y eliminar viven en el **kebab (⋮)** de la fila.

**Criterios de aceptación:**
- [ ] El clic en el **cuerpo** de la fila (o Enter/Espacio) abre la card; el clic en el **kebab (⋮)** abre su menú de acciones rápidas y **no** abre la card. El kebab concentra todas las acciones del movimiento (Editar / Anular-Des-anular / Duplicar / Crear movimiento calculado / Eliminar).
- [ ] La card es **solo lectura pura**: no tiene footer de acción ni botón "Editar"; su único control es cerrar. No modifica el movimiento in-situ.
- [ ] La card muestra las filas de contenido definidas arriba, mostrando **solo las que aplican** al tipo y omitiendo las que no (ej.: método de pago solo si el movimiento tiene uno; cross-rate solo si la moneda del ítem difiere de la default).
- [ ] Si el movimiento es **origen** de calculados, la card lista sus **derivados del mes** (nombre + monto, read-only, no clickeable); si no tiene derivados, esa sección se omite.
- [ ] Para un método de pago de tipo **Crédito**, la card muestra su **día de cierre** y su **día de cobro**; para Débito/Efectivo esos datos no existen y no se muestran.
- [ ] La card cierra con ✕, Esc y clic en el scrim.
- [ ] La card **no dispara una carga propia**: presenta el `MovementItem` que la lista del mes ya tiene en memoria; no tiene estados de carga, vacío ni error propios.

**Notas:**
- La anatomía visual de la card, el reparto exacto fila/card y el comportamiento de apertura/cierre los define `control-design` (`docs/design.md`).

---

#### RF-VM-008 — Duplicar un movimiento

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
- **Links de navegación** (cinco, en este orden):
  - **Dashboard** — lleva al dashboard (RF-DASH-001).
  - **Vista del mes** — lleva a la vista del mes (RF-VM-001), abierta en el mes actual.
  - **Reportes** — lleva a la pantalla de reportes configurable (`/reportes`, RF-REP-003).
  - **Historial** — lleva al historial de cambios (`/historial`, RF-HIST-002), debajo de "Reportes".
  - **Configuración** — lleva al hub de administración de la cuenta (`/configuracion`, RF-CUR-002), debajo de "Historial".
- **Categorías y Métodos de pago no son links del sidebar.** Se administran como **secciones del hub de Configuración**, cada una con su ruta anidada deep-linkable (`/configuracion/categorias`, `/configuracion/metodos-pago`). Ver `screens.md`, §9.
- **Botón "Nuevo movimiento"** (acción primaria): abre el formulario de carga de movimiento (RF-CM-001).
- **Control de modo de color** (parte inferior, en su propia fila encima del menú de usuario): toggle de iconos Sistema / Claro / Oscuro que aplica y persiste el modo de color de la app (RF-APP-001).
- **Menú de usuario** (parte inferior): representado por el avatar del usuario. Al activarlo, despliega la opción **"Cerrar sesión"** (RF-AUTH-004).

**Criterios de aceptación:**
- [ ] El sidebar está presente en todas las pantallas accesibles con sesión activa.
- [ ] El sidebar no se muestra en la pantalla de login ni en otras pantallas no autenticadas.
- [ ] El logo/nombre "Control" lleva al dashboard.
- [ ] Los cinco links Dashboard, Vista del mes, Reportes, Historial y Configuración navegan a sus respectivas pantallas, en ese orden.
- [ ] El link "Vista del mes" abre la vista en el mes actual.
- [ ] El link "Reportes" lleva a `/reportes` (RF-REP-003) y se ubica entre "Vista del mes" e "Historial".
- [ ] El link "Historial" lleva a `/historial` (RF-HIST-002) y se ubica entre "Reportes" y "Configuración", que es el **quinto y último** de la lista.
- [ ] El sidebar **no** tiene links "Categorías" ni "Métodos de pago": ambos se administran como secciones del hub de Configuración, por ruta anidada deep-linkable (`/configuracion/categorias`, `/configuracion/metodos-pago`).
- [ ] El botón "Nuevo movimiento" abre el formulario de carga (RF-CM-001) desde cualquier pantalla, cumpliendo el límite de 2 interacciones (RNF-003).
- [ ] El sidebar indica visualmente cuál es la sección activa.
- [ ] El control de modo de color (toggle Sistema / Claro / Oscuro) vive en la parte inferior del sidebar, en su propia fila encima del menú de usuario, y dispara RF-APP-001.
- [ ] El menú de usuario se ubica en la parte inferior del sidebar y muestra el avatar del usuario.
- [ ] La opción "Cerrar sesión" vive dentro del menú de usuario y dispara el flujo de RF-AUTH-004.

**Notas:**
- Este RF cubre la decisión sobre RF-AUTH-004 (cierre de sesión disponible "desde cualquier pantalla"): el punto de acceso al cierre de sesión es el menú de usuario del sidebar.

---

#### RF-NAV-002 — Mostrar/ocultar el sidebar

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario **muestra u oculta** el sidebar (RF-NAV-001) con un control manual, disponible en **todos los anchos de viewport**. Abierto, el sidebar ocupa su ancho y empuja el contenido; cerrado, se oculta y el contenido ocupa el ancho completo. El estado persiste por usuario en el blob de preferencias (clave `sidebarOpen`). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] Existe un control manual que **alterna** entre sidebar abierto y cerrado, accesible en **cualquier ancho de viewport soportado** (≥ 640px, RF-APP-002).
- [ ] **Abierto** (estado por defecto): el sidebar se comporta como en RF-NAV-001 — ocupa su ancho y **empuja** el contenido de la pantalla.
- [ ] **Cerrado**: el sidebar queda **oculto** y el contenido de la pantalla ocupa el **ancho completo**.
- [ ] El estado abierto/cerrado **no depende del breakpoint**: el sidebar **no auto-colapsa** por ancho de viewport. La única causa del cambio de estado es la acción del usuario sobre el control.
- [ ] El estado **persiste por usuario** en el blob de preferencias (clave `sidebarOpen`): sobrevive al cierre de sesión, al cambio de dispositivo y a limpiar el navegador. Si la clave falta, el default es **abierto**. Modelo de datos en `data-model.md`, §Claves del blob → `sidebarOpen`.

**Notas:**
- La ubicación, el ícono, el rótulo y el comportamiento visual del control (incluida la animación de apertura/cierre) los define `control-design` (`docs/design.md`). Este RF solo fija el comportamiento funcional.
- **Interacción con RNF-003 (acceso a "Nuevo movimiento" en ≤2 interacciones):** con el sidebar **cerrado**, la CTA "Nuevo movimiento" (que vive en el sidebar, RF-NAV-001) **no está visible**. Crear un movimiento cuesta abrir el sidebar (1) + click en la CTA (2) = **2 interacciones**, dentro del límite de RNF-003. Es aceptable por decisión de producto: no se agrega un acceso alternativo a la carga.

---

### 3.9 Módulo: Reportes

El módulo de Reportes visualiza los movimientos del usuario a lo largo de un año, mes a mes. El eje X son los 12 meses del año; el eje Y es el monto. Ofrece **dos tipos de reporte** —ingresos vs. gastos por mes, y gastos por categoría apilados— implementados como un **widget de reporte autónomo, configurable por props**, que lleva embebidos su propia navegación de año y su propio filtro de categorías. La pantalla `/reportes` es **configurable**: el usuario arma su vista agregando y quitando **cards de reporte**; el dashboard monta una sola instancia del widget (ver RF-DASH-001/002).

> **Alcance:** los tipos de reporte descritos en RF-REP-001 (ingresos/gastos y apilado por categoría de gastos), RF-REP-010 (grilla anual de gastos Únicos día × mes), RF-REP-011 (gantt anual de gastos en Cuotas), RF-REP-012 (líneas de Inflación vs Ingresos) y RF-REP-013 (Evolución de gastos fijos). La card de Ingresos vs Gastos admite además filtros por tipo / dirección / categoría (RF-REP-014). Otros tipos de reporte/gráfico (torta, barras de comparación) quedan fuera de alcance (ver sección 6).

---

#### RF-REP-001 — Tipos de reporte disponibles

| Campo | Detalle |
|---|---|
| **Descripción** | El módulo ofrece **dos tipos de reporte** sobre los 12 meses de un año (eje X: los meses del año; eje Y: monto): **Ingresos vs Gastos** por mes, y **Gastos por categoría** (gastos del mes descompuestos por categoría). Son los únicos tipos disponibles; sumar tipos nuevos queda fuera de alcance. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Tipos de reporte:**

- **Ingresos vs Gastos** (`income-expense`). Dos series por mes a lo largo del año: el **total de ingresos** del mes y el **total de gastos** del mes. Cada mes del eje X tiene su par de valores (ingresos, gastos). Los totales por mes suman los tres tipos de movimiento que caen en el mes (únicos + fijos activos + cuotas), con el mismo criterio que los totales de la Vista del mes (RF-VM-002) y el Dashboard (RF-DASH-002). Es **Total-only**: muestra únicamente las dos series agregadas, sin sub-vista por categoría ni toggle.
- **Gastos por categoría** (`by-category`). Toma el **total de gastos** de cada mes y lo descompone, una porción por **categoría**, cada una con el **color propio de su categoría** (RF-CAT-005 / RN-013). Las porciones de un mes suman exactamente el total de gastos de ese mes (el mismo valor que la serie "gastos" de Ingresos vs Gastos). Es **solo de gastos** (`EXPENSE`): los ingresos no se descomponen por categoría en este reporte. La card ofrece un **toggle de representación Barra ↔ Línea** (RF-REP-006): mismo dato, geometría distinta.

**Criterios de aceptación:**
- [ ] El módulo ofrece exactamente **dos tipos de reporte**: `income-expense` (Ingresos vs Gastos) y `by-category` (Gastos por categoría). No hay tipos adicionales.
- [ ] El eje X representa los 12 meses del año configurado; el eje Y representa el monto.
- [ ] Los **12 meses están siempre presentes** en el eje X; un mes sin datos se grafica en **cero** (no se omite ni deja hueco). Esto incluye los meses futuros del año en curso, que también se muestran en cero salvo lo que proyecten los fijos activos y las cuotas en tramo (RN-006). La representación visual concreta de un mes en cero la define `control-design`.
- [ ] Ingresos vs Gastos muestra, por mes, el total de ingresos y el total de gastos del mes; ambos totales suman únicos + fijos activos + cuotas del mes (mismo criterio que RF-VM-002).
- [ ] Gastos por categoría muestra, por mes, el total de gastos del mes descompuesto por categoría, cada porción con el color de su categoría; la suma de las porciones de un mes iguala el total de gastos de ese mes.
- [ ] Gastos por categoría considera **solo gastos** (`EXPENSE`); los ingresos no aparecen descompuestos por categoría.
- [ ] Gastos por categoría muestra **una porción por cada categoría con gasto, sin agrupar ni colapsar** ninguna en una porción "Otras"; no hay tope de categorías visibles. La agrupación "Otras" para la cola de categorías queda como candidato futuro.
- [ ] Los colores de las porciones de Gastos por categoría son los colores ya asignados a cada categoría (RF-CAT-005); el reporte no inventa ni reasigna colores.
- [ ] El mes al que pertenece cada movimiento, para la agregación anual, se determina con el mismo criterio de zona horaria ya definido (RN-015): la zona propia de cada registro para los únicos, y el `startMonth` `YYYY-MM` para fijos y cuotas.
- [ ] Un movimiento cuya categoría fue eliminada (soft delete) sigue contando en los totales y, en `by-category`, sigue apareciendo bajo su categoría con su color (consistente con RF-CAT-004 / RF-VM-002).

**Notas:**
- Las decisiones de presentación visual del reporte (tipo de trazo, relleno de áreas, leyenda, ejes, interacción de hover/tooltip, comportamiento responsivo) son responsabilidad de `control-design` (`docs/design.md`), no de este RF.

---

#### RF-REP-002 — Widget de reporte autónomo

| Campo | Detalle |
|---|---|
| **Descripción** | Cada reporte (RF-REP-001) se implementa como un **widget de reporte autónomo**: un componente reutilizable, configurable por props, que lleva **embebidos** su propia **navegación de año** (independiente por instancia) y su propio **filtro de categorías**. Se inyecta tanto en cada card de `/reportes` (RF-REP-003) como en el dashboard (RF-DASH-001/002). No hay control de año ni filtro compartidos entre instancias: cada widget gobierna su propio año y su propio set de categorías. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Props funcionales:**

- **Tipo de reporte.** `income-expense` (Ingresos vs Gastos) o `by-category` (Gastos por categoría). Define qué visualización monta la instancia.
- **Año a mostrar.** Define el año cuyos 12 meses se grafican. La navegación de año (flechas embebidas en el widget) está **siempre activa** e **independiente por instancia**: cambiar el año de un widget no afecta a ningún otro. Límites de navegación: hacia atrás el control ‹ se deshabilita antes del **primer año con CUALQUIER movimiento del usuario** (`earliestYear`, no afectado por el filtro de categorías — ver RF-REP-005); hacia adelante se **bloquean los años futuros** (máximo navegable: el año en curso).
- **Categorías seleccionadas (filtro).** Subconjunto de categorías que el reporte considera; default **todas**. El filtro tiene **tres estados**: **todas** (default, sin filtro), **subconjunto** (solo las tildadas) y **ninguna** (todas destildadas) → la serie/bandas se grafican en **cero** (igual que el filtro de `/mes`, RF-VM-006). El universo de categorías ofrecido es **solo las categorías con gasto del año** (no el catálogo completo del usuario): cualquier filtro de categorías de un reporte lista únicamente las categorías que aportan a lo que se muestra ahí. Ese universo es **estable**: no se achica al destildar categorías (igual criterio que `earliestYear`).
- **La leyenda del gráfico ES el filtro.** Para `by-category` (y para la card `income-expense` del dashboard) el widget **no** tiene un control de filtro separado: la **leyenda interactiva** es el único disparador. Clic en un ítem de la leyenda lo activa/desactiva. Qué togglea depende del tipo:
  - **Ingresos vs Gastos** (`income-expense`): la leyenda togglea las **series Ingresos / Gastos** (estado `hiddenSeries`, persistido por card).
  - **Gastos por categoría** (`by-category`): la leyenda togglea **categorías** (usa el filtro de categorías persistido de la card, con su lógica de tres estados — todas / subconjunto / ninguna).
  - **Excepción — card `income-expense` de `/reportes`:** suma controles de filtro **dedicados** de tipo de movimiento, dirección y categoría (RF-REP-014), separados de la leyenda (que ahí togglea solo las series).
- **Persistencia (modo).** Define qué hace la instancia con sus cambios de año y de filtro:
  - **Persistida** — en `/reportes`: cada cambio de año y de filtro de la card se persiste en la clave `reports` de preferencias (RF-REP-004).
  - **Efímera** — en el dashboard: el año y el filtro son de sesión; **no** se persisten (al recargar, el widget vuelve a su estado inicial — año en curso, todas las categorías). Ver RF-DASH-001/002.

**Criterios de aceptación:**
- [ ] El widget es un componente reutilizable; tipo, año, categorías seleccionadas y modo de persistencia se controlan por props, no por lógica interna distinta en cada pantalla.
- [ ] La navegación de año está **embebida en el widget** y es **independiente por instancia**: mover el año de una instancia no mueve el de ninguna otra (no hay control de año compartido).
- [ ] El filtro de categorías está **embebido en el widget** y ofrece **solo las categorías con gasto del año** (las que aportan a lo que se muestra), con default **todas seleccionadas**; el universo es estable (no se achica al destildar).
- [ ] La **leyenda del gráfico es el filtro**: no hay un control de filtro separado (excepto en la card `income-expense` de `/reportes`, que suma controles dedicados de tipo / dirección / categoría — RF-REP-014). Clic en un ítem de la leyenda lo activa/desactiva. En `income-expense` togglea las series Ingresos/Gastos; en `by-category` togglea categorías. La lógica de tres estados del filtro de categorías (todas / subconjunto / ninguna) se mantiene.
- [ ] El filtro aplica a ambos tipos: en `income-expense` restringe qué categorías cuentan en los totales de ingresos y de gastos; en `by-category` restringe qué bandas se apilan (ver contrato del endpoint en data-model.md).
- [ ] Los límites de navegación de año respetan `earliestYear` (primer año con cualquier movimiento del usuario, **independiente del filtro**) hacia atrás y el año en curso hacia adelante.
- [ ] En modo **persistido** (cards de `/reportes`), los cambios de año y de filtro de la instancia se persisten vía clave `reports` (RF-REP-004).
- [ ] En modo **efímero** (dashboard), los cambios de año y de filtro de la instancia **no** se persisten: al recargar vuelve al año en curso con todas las categorías.

---

#### RF-REP-003 — Pantalla de reportes configurable

| Campo | Detalle |
|---|---|
| **Descripción** | La pantalla `/reportes` es **configurable por el usuario**: arma su propia vista agregando y quitando **cards de reporte**, cada una de las cuales monta un widget de reporte autónomo (RF-REP-002). La pantalla siempre expone un recuadro **"[+]"** para agregar una card nueva. La **primera vez la pantalla está vacía** (solo el "[+]"); la configuración persistida (clave `reports`, RF-REP-004) **es** su pantalla. Es el lugar donde el usuario explora sus movimientos a lo largo de los años con las visualizaciones que le interesan. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Flujo principal:**
1. El usuario abre `/reportes`. El sistema lee la clave `reports` de preferencias (RF-REP-004) y monta una card por cada entrada, en el orden del array.
2. Si no hay cards (clave ausente o array vacío), la pantalla muestra solo el recuadro **"[+]"** (estado vacío inicial).
3. El usuario activa el **"[+]"** para agregar una card; elige el tipo de reporte (RF-REP-001). El sistema agrega la card al final con su tipo, el **año en curso** y **todas las categorías** por defecto, y persiste el cambio (RF-REP-004).
4. Cada card monta un widget autónomo (RF-REP-002): navega su propio año y filtra sus propias categorías; cada cambio se persiste.
5. El usuario puede **quitar** una card; el sistema la elimina de la vista y de la clave `reports`.

**Criterios de aceptación:**
- [ ] La ruta de la pantalla es **`/reportes`** y su link en el sidebar se rotula **"Reportes"**.
- [ ] La pantalla siempre expone un recuadro **"[+]"** para agregar una card de reporte.
- [ ] Al agregar una card, el usuario elige el **tipo de reporte** (RF-REP-001); la card nace con el año en curso y todas las categorías seleccionadas.
- [ ] El usuario puede **quitar** cualquier card; quitarla la elimina de la vista y de la persistencia (RF-REP-004).
- [ ] Cada card monta un **widget de reporte autónomo** (RF-REP-002) en **modo persistido**: navega su año y filtra sus categorías de forma independiente, y persiste cada cambio.
- [ ] El **orden de las cards** en pantalla es el orden del array `reports` (RF-REP-004).
- [ ] **Estado vacío inicial:** la primera vez (clave ausente o array vacío), la pantalla muestra solo el "[+]".
- [ ] La pantalla es accesible desde el sidebar (RF-NAV-001) con el link **"Reportes"**, ubicado **debajo de "Vista del mes"** (orden: Dashboard → Vista del mes → Reportes → Historial → Configuración).
- [ ] La definición funcional completa (contenido, acciones, navegación y estados) vive en `docs/screens.md`. El detalle visual (layout, tamaños, colores, comportamiento de las flechas embebidas) lo define `control-design`.

---

#### RF-REP-004 — Persistencia de las cards de reporte

| Campo | Detalle |
|---|---|
| **Descripción** | La configuración de las cards de `/reportes` se persiste por usuario mediante el mecanismo de preferencias, en la clave `reports`. Cada card persiste su **tipo + año + categorías seleccionadas**; el **orden del array es el orden de despliegue**. La normalización y el shape concreto los define el front (igual que `monthSections`): el backend no conoce ni valida esta clave. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. El mecanismo de preferencias está disponible. |

**Criterios de aceptación:**
- [ ] La clave es `reports`, un array de configuraciones de card (shape concreto en `docs/data-model.md`).
- [ ] Cada entrada persiste **tipo de reporte, año y categorías seleccionadas**; "todas las categorías" se representa como `categoryIds: null` (ver data-model.md).
- [ ] El **orden del array = orden de despliegue** de las cards.
- [ ] **Array vacío o clave ausente = pantalla vacía** (solo "[+]"). Un blob de preferencias previo sin la clave `reports` se interpreta como vacío (back-compat).
- [ ] La persistencia aplica **solo** a las cards de `/reportes` (modo persistido). El widget del dashboard es **efímero** y no toca esta clave (RF-DASH-001/002).
- [ ] El backend **no** valida ni conoce la clave `reports`; la normalización es responsabilidad del front, igual que con `monthSections`.

---

#### RF-REP-005 — Endpoint de datos de reporte

| Campo | Detalle |
|---|---|
| **Descripción** | El backend expone los datos de reporte mediante `GET /movements/reports` (renombre de `GET /movements/annual`). Acepta el **año** más un **filtro de categorías** opcional por query param; devuelve la serie de 12 meses del año, filtrada al set de categorías pedido. El shape de respuesta no cambia respecto del endpoint anterior. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa (JWT válido). |

**Criterios de aceptación:**
- [ ] El endpoint es `GET /movements/reports` (renombre de `GET /movements/annual`); la mecánica de agregación anual no cambia.
- [ ] Acepta el año y un **filtro de categorías** como query param que distingue **tres estados**: **ausente = todas**, **presente y vacío = ninguna** (serie en cero), **lista = subconjunto** (contrato exacto en `docs/data-model.md`).
- [ ] El filtro afecta a **ambos tipos**: en `income-expense`, qué categorías cuentan en los totales de ingresos y de gastos por mes; en `by-category`, qué porciones por categoría se incluyen.
- [ ] El campo **`earliestYear` NO se ve afectado por el filtro**: siempre refleja el primer año con CUALQUIER movimiento del usuario, para que los límites de navegación de año (RF-REP-002) no salten al filtrar.
- [ ] La respuesta mantiene el shape `{ year, months, categories, earliestYear }`, con `months` y `categories` filtrados al set pedido (`earliestYear` no).
- [ ] El endpoint filtra siempre por el `userId` del JWT (RNF-002).
- [ ] El array `categories` (desglose de gastos `EXPENSE`) alimenta la card `by-category` en **ambas representaciones** (barra y línea, RF-REP-006): es el mismo dato, distinta geometría de render. El backend no distingue barra de línea; eso es solo render del front.

---

#### RF-REP-006 — Toggle de representación Barra / Línea en la card Gastos por categoría

| Campo | Detalle |
|---|---|
| **Descripción** | La card de reporte de tipo `by-category` (Gastos por categoría) ofrece un **toggle de representación**: **Barra** y **Línea**. Es la **misma data** (gastos del mes descompuestos por categoría) graficada con **geometría distinta**; no cambia el tipo, el año ni el filtro de categorías de la card. La card `income-expense` (Ingresos vs Gastos) **no** tiene este toggle (es Total-only). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe una card de tipo `by-category` (en `/reportes`). |

**Representaciones:**

- **Barra** (default). Barras **apiladas** por categoría: una porción por categoría con gasto, cada una con el color propio de su categoría (RF-CAT-005 / RN-013). La suma de las porciones de un mes iguala el total de gastos de ese mes.
- **Línea.** Áreas **apiladas** por categoría (mismo apilado que Barra, geometría continua): las mismas categorías con los mismos colores, más una **línea de contorno = total de gasto** del mes.

**Criterios de aceptación:**
- [ ] La card `by-category` expone un toggle de dos opciones: **Barra** (default) y **Línea**.
- [ ] La card `income-expense` **no** expone este toggle.
- [ ] Ambas representaciones grafican el **mismo dato** (gastos por categoría apilados); solo difiere la geometría de render. La suma de las porciones/áreas de un mes iguala el total de gastos del mes.
- [ ] El toggle **no** cambia el tipo, el año ni el filtro de categorías de la card.
- [ ] **Persistencia:** en `/reportes` la representación elegida se **persiste por card** (clave `reports`, campo `categoryChartMode`; **ausente = "bar"**, ver `docs/data-model.md`).
- [ ] El desglose de gastos por categoría se sirve mediante el array **`categories`** de `GET /movements/reports` (RF-REP-005); barra vs línea es solo render del front (sin cambio de backend).

**Notas:**
- El detalle visual del toggle y de cada representación lo define `control-design` (`docs/design.md`).

---

#### RF-REP-007 — Moneda por card de reporte

| Campo | Detalle |
|---|---|
| **Descripción** | Cada card de `/reportes` tiene su **propia moneda de display**, independiente de las demás y persistida junto al resto de su config (clave `reports`, RF-REP-004). La card re-expresa sus cifras a esa moneda **al vuelo** (capa de display, igual que la moneda default; no toca ningún movimiento guardado, RF-CUR-005). La card de reporte del **dashboard** no tiene esta opción: queda siempre en la moneda default global del usuario. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe una card de reporte en `/reportes`. |

**Criterios de aceptación:**
- [ ] Cada card de `/reportes` expone un **selector de moneda** en su cabecera, con las 4 monedas del set (RF-CUR-001).
- [ ] Al **crear** una card, su moneda nace con la **moneda default global vigente** del usuario (RF-CUR-002), sin preguntar ni ofrecer elección.
- [ ] Cambiar la moneda de una card **re-expresa sus cifras al vuelo** y **no afecta a las demás cards** ni a la moneda default global; no toca ningún movimiento guardado.
- [ ] La moneda elegida se **persiste por card** (clave `reports`, campo `currency`, RF-REP-004; shape en `docs/data-model.md`). Una card sin el campo usa la **default global vigente** del usuario.
- [ ] El **chip de moneda del header** de `/reportes` refleja la **moneda default global** del usuario (RF-CUR-002), no la de ninguna card en particular.
- [ ] La card de reporte del **dashboard** **no** expone selector de moneda: muestra siempre la moneda default global.

**Notas:**
- El detalle visual del selector lo define `control-design` (`docs/design.md`).

#### RF-REP-008 — Título editable por card de reporte

| Campo | Detalle |
|---|---|
| **Descripción** | Cada card de `/reportes` tiene un **título editable** en su cabecera, persistido junto al resto de su config (clave `reports`, campo `title`, RF-REP-004). Aplica a **ambos** tipos de card (`income-expense` y `by-category`). Una card sin título muestra el placeholder **"Reporte N"**. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe una card de reporte en `/reportes`. |

**Criterios de aceptación:**
- [ ] Cada card de `/reportes` expone un **título editable** en su cabecera.
- [ ] Una card **sin título** (campo ausente o vacío) muestra el placeholder **"Reporte N"**, donde **N = posición 1-based de la card en la columna**, contando **todas** las cards (tengan título o no). El N se **recalcula en vivo** según las cards existentes: al quitar o reordenar cards, el placeholder de las demás cambia (es **no monotónico**). Este "Reporte N" es **display, no dato**: no se persiste.
- [ ] La edición admite **máximo 60 caracteres**. **Enter** o **blur** confirman (se persiste el título trimmeado); **Esc** cancela y descarta el cambio en curso.
- [ ] El título confirmado se **persiste por card** (clave `reports`, campo `title`, RF-REP-004; shape en `docs/data-model.md`). Si el usuario confirma un título **vacío**, el campo se **omite** del objeto (la card vuelve a mostrar el placeholder).

**Notas:**
- El detalle visual del título y su modo de edición lo define `control-design` (`docs/design.md`).

---

#### RF-REP-009 — Reordenar las cards de reporte

| Campo | Detalle |
|---|---|
| **Descripción** | Las cards de `/reportes` son reordenables entre sí mediante drag & drop, con el **mismo mecanismo que el "modo orden" de las secciones de `/mes`** (RF-VM-005). El orden de las cards es el orden del array de la clave `reports` de preferencias (RF-REP-004): se persiste por usuario y se aplica en vivo. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario está en `/reportes` con **2 o más** cards de reporte. |

**Flujo principal:**
1. El usuario activa el **"modo orden"** desde el header ("Ordenar reportes"); en ese modo cada card colapsa a una representación **mini** y se arrastra para reordenarla entre las demás.
2. El usuario sale del modo orden ("Listo"). El nuevo orden ya quedó aplicado en vivo.

**Criterios de aceptación:**
- [ ] El usuario puede reordenar **las cards entre sí** mediante drag, dentro de un **modo orden** explícito que se activa/desactiva con un botón del header ("Ordenar reportes" / "Listo").
- [ ] El botón "Ordenar reportes" se muestra **solo cuando hay 2 o más cards** (con 0 o 1 no hay nada que reordenar).
- [ ] En modo orden, cada card colapsa a su representación **mini** y se arrastra como una unidad; los controles internos de cada card (navegación de año, moneda, refrescar, quitar, título editable) y el recuadro **"[+]"** quedan **deshabilitados**.
- [ ] El **orden de las cards** es el orden del array `reports`; se **persiste por usuario** (clave `reports`, RF-REP-004; shape en `docs/data-model.md`) y se **aplica en vivo**. No hay acción de "cancelar" (espejo de RF-VM-005).
- [ ] Al reordenar, el placeholder **"Reporte N"** de las cards sin título se recalcula en vivo según la nueva posición (RF-REP-008).

---

#### RF-REP-010 — Reporte anual de gastos Únicos (grilla día × mes)

| Campo | Detalle |
|---|---|
| **Descripción** | Tercer tipo de card de reporte (`unique-grid`): una **grilla de gastos Únicos del año**, con un **día por fila (1–31)** y un **mes por columna (ene–dic)**. Cada celda muestra el total de **gastos Únicos** (`EXPENSE`) imputados a ese día y mes, en la moneda de display de la card. Bajo la grilla, un **footer de métricas mensuales** por columna. Solo considera **movimientos Únicos de tipo gasto**: fijos, cuotas y calculados no entran. Es un widget de reporte autónomo (RF-REP-002) con su año, su filtro de categorías y su moneda propios, persistidos en la clave `reports` (RF-REP-004). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Contenido de la grilla:**

- **31 filas × 12 columnas, siempre.** Fila = día del mes (1–31), columna = mes (ene–dic). Una celda agrega los gastos Únicos del usuario cuyo día y mes (en la zona propia de cada registro, RN-015) caen en esa posición.
- **Días inexistentes del mes** (ej. 30/31 de febrero) se distinguen de un día sin gasto: la celda de un día que no existe en ese mes **no aplica**, distinta de un día existente con **$0** de gasto.
- El **filtro de categorías** (RF-REP-002) restringe qué gastos Únicos entran en la grilla y en el footer; el universo ofrecido es **solo las categorías con gasto Único del año** (estable, no se achica al destildar).
- **Hover de celda de día** — revela, además de fecha y total, el **desglose por categoría** del gasto de ese día. **Hover del footer de un mes** — revela las cinco métricas mensuales en detalle. Spec visual de ambos tooltips en `docs/design.md` (§4b y §8).

**Footer de métricas mensuales** (una entrada por mes/columna):

- **Total del mes** — suma de los gastos Únicos del mes (la columna).
- **Promedio diario** — total del mes dividido por el divisor de días: el **día en curso** si la columna es el mes corriente del año en curso; los **días del mes** si el mes ya terminó (incluye meses de años pasados); **no aplica** (sin valor) para un mes **futuro**.
- **% de diferencia vs. mes anterior** — variación del promedio diario respecto del mes anterior. El mes anterior de **enero es diciembre del año previo** (continuidad temporal). Sin valor si el promedio del mes anterior es cero.
- **Inflación del mes** — variación mensual del IPC nacional (RF-IPC-001) de ese mes; sin valor si no hay dato de IPC.
- **% de diferencia ajustado por inflación** — el mismo % vs. mes anterior, pero descontando la inflación del mes en curso del promedio del mes anterior antes de comparar; sin valor si falta el IPC, si el promedio anterior es cero o si el mes en curso no tiene dato.

**Techo de la escala de color (editable por card):**

- El **techo** (ancla) de la escala de color de la grilla es **editable por card**, desde un editor dentro de la propia card (junto a año, moneda y filtro de categorías; **no** en `/configuracion`). Entrada = **monto + selector de moneda**. Un monto **≤ 0 no es guardable**. Default = **15 USD**.
- El techo se **persiste en USD** (constante en términos reales) y se **reconvierte** según el año y la moneda de la card. La rampa de color y la fórmula `t = clamp(total / techo, 0, 1)` no cambian: solo cambia el ancla. La representación visual de la rampa es de `control-design`.
- **Naturaleza del sistema** (consecuencias intencionales de anclar en dólares):
  1. El monto tipeado **no reingresa exacto**: al guardarse en USD y reconvertirse, al reabrir el editor puede diferir en centavos (intrascendente para una escala de color).
  2. El techo es **constante en términos reales**: al cambiar el año de la card se reconvierte con el TC de enero de ese año, y el número en pesos cambia.
  3. El monto tipeado se interpreta con el TC del **año que la card muestra**: el mismo monto en ARS en una card de 2024 y otra de 2026 produce anclas en USD distintas.

**Criterios de aceptación:**
- [ ] La card `unique-grid` muestra una grilla de **31 filas (días 1–31) × 12 columnas (meses ene–dic)** con el total de gastos **Únicos** (`EXPENSE`) por día y mes, en la moneda de display de la card (RF-REP-007).
- [ ] El techo de la escala de color es **editable por card** (monto + moneda), se persiste en USD, default 15 USD; un monto ≤ 0 no es guardable.
- [ ] **Solo** gastos Únicos de tipo `EXPENSE` entran en la grilla y el footer: fijos, cuotas y calculados se excluyen.
- [ ] Un día que **no existe** en un mes se muestra distinto de un día existente con **$0** de gasto.
- [ ] El footer muestra, por mes: total, promedio diario, % vs. mes anterior, inflación del mes y % ajustado por inflación, con la semántica de divisor y de "sin valor" descrita arriba.
- [ ] El **promedio diario** usa como divisor el día en curso (mes corriente), los días del mes (mes terminado) o no aplica (mes futuro).
- [ ] El **% vs. mes anterior** trata diciembre del año previo como anterior de enero; queda sin valor si el promedio anterior es cero.
- [ ] La card es un widget autónomo (RF-REP-002): año, filtro de categorías y moneda propios, persistidos en la clave `reports` (RF-REP-004). El universo del filtro son **solo las categorías con gasto Único del año**.
- [ ] La navegación de año hacia atrás del widget **no tiene tope** en esta card (la fuente de datos no expone `earliestYear`); hacia adelante se bloquean los años futuros (RF-REP-002).

**Notas:**
- Las decisiones de presentación visual (escala de color de las celdas, tipografía, layout del footer) son responsabilidad de `control-design` (`docs/design.md`), no de este RF.
- Las fórmulas exactas de cada métrica del footer (truncado, ajuste por inflación) y el contrato del endpoint viven en `docs/backend.md` §Serie de reportes y `docs/data-model.md` §Contrato de reporte anual de Únicos.

---

#### RF-REP-011 — Reporte anual de gastos en Cuotas (gantt de barras horizontales)

| Campo | Detalle |
|---|---|
| **Descripción** | Cuarto tipo de card de reporte (`installment-gantt`): un **gantt de gastos en Cuotas del año**. El eje X son los 12 meses (ene–dic); cada **gasto en cuotas** se dibuja como una **barra horizontal** que abarca los meses que ocupa la cuota (desde su mes de inicio por su cantidad de cuotas). Solo considera **gastos en cuotas** (`EXPENSE` en cuotas); los ingresos en cuotas no se muestran. Es un widget de reporte autónomo (RF-REP-002) con su año, su filtro de categorías y su moneda propios, persistidos en la clave `reports` (RF-REP-004). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Contenido del gantt:**

- **Una barra por gasto en cuotas** que toca el año, sobre un eje X de los 12 meses (ene–dic). La barra abarca desde el mes de inicio de la cuota por su cantidad de cuotas.
- **Solo gastos en cuotas** (`EXPENSE` en cuotas). Únicos, fijos, calculados e **ingresos en cuotas** no entran.
- **Monto mostrado** — el **monto por cuota** (no el total de la compra), en la moneda de display de la card (RF-REP-007).
- **Disposición en renglones (packing)** — las barras se ordenan por **mes de origen de la cuota** (las que arrancan antes en el tiempo, más cerca del eje). Una barra reusa un renglón existente si no entra en conflicto con ninguna de las barras ya colocadas ahí —**al menos 1 mes de descanso** a cada lado—, **aprovechando huecos intermedios**; si ningún renglón la admite, sube a uno nuevo por encima.
- **Barras que cruzan el borde del año** — se recortan a los 12 meses visibles y muestran un **indicador de continuación**: `‹` si la cuota empezó antes del año, `›` si sigue después.
- El **filtro de categorías** (RF-REP-002) restringe qué gastos en cuotas entran y, por lo tanto, también el packing; el universo ofrecido es **solo las categorías con gasto en cuotas del año** (estable, no se achica al destildar).
- **Hover de barra** — revela descripción, categoría, monto por cuota, **total del plan** (RF-MC-005), rango de meses que ocupa, cantidad de cuotas y progreso (qué cuotas caen en el año). El rango del tooltip es el **período real** de la cuota con mes + año (ej. "nov 2025 – feb 2027"), aunque empiece antes o termine después del año visible (`realStartMonth`/`realEndMonth`, ver `docs/data-model.md`). Spec visual del tooltip en `docs/design.md`.
- **Etiqueta dentro de la barra** — prioriza el **monto por cuota** (pieza primaria); el nombre es secundario y se omite antes que el monto; en barras de 1 mes se muestra solo el monto. Degradación visual en `docs/design.md` §4.

**Criterios de aceptación:**
- [ ] La card `installment-gantt` muestra, para el año configurado, una **barra horizontal por gasto en cuotas** sobre el eje X de los 12 meses (ene–dic), con el **monto por cuota** en la moneda de display de la card (RF-REP-007).
- [ ] **Solo** gastos en cuotas de tipo `EXPENSE` entran: Únicos, fijos, calculados e ingresos en cuotas se excluyen.
- [ ] Las barras se disponen en renglones por **mes de origen de la cuota** (las que arrancan antes en el tiempo, pegadas al eje); una barra reusa un renglón solo si deja **al menos 1 mes de descanso** a cada lado respecto de todas las barras ya colocadas ahí (aprovechando huecos intermedios), y sube a un renglón nuevo si ninguno la admite.
- [ ] Una barra que **cruza el borde del año** se recorta a los 12 meses visibles y muestra el indicador de continuación (`‹` antes del año, `›` después).
- [ ] El **hover de barra** revela descripción, categoría, monto por cuota, total del plan (RF-MC-005), rango de meses, cantidad de cuotas y progreso de cuotas del año; el rango mostrado es el **período real** con mes + año, aunque caiga fuera del año visible.
- [ ] La **etiqueta dentro de la barra** prioriza el monto por cuota: el nombre se omite antes que el monto y, en barras de 1 mes, se muestra solo el monto (degradación visual en `docs/design.md` §4).
- [ ] La card es un widget autónomo (RF-REP-002): año, filtro de categorías y moneda propios, persistidos en la clave `reports` (RF-REP-004). El filtro afecta el set de barras y el packing; su universo son **solo las categorías con gasto en cuotas del año**.
- [ ] La navegación de año (RF-REP-002) cambia el set de barras visibles; un año **sin gastos en cuotas** muestra el estado **empty** de la card.

**Notas:**
- Las decisiones de presentación visual (alto y color de las barras, indicador de continuación, layout del eje) son responsabilidad de `control-design` (`docs/design.md`), no de este RF.
- Las reglas de negocio del packing en renglones y la conversión de moneda, y el contrato del endpoint, viven en `docs/backend.md` y `docs/data-model.md` §Contrato de reporte anual de Cuotas.
- **Fuera de alcance (futuro):** alertas de renglón.

---

#### RF-REP-012 — Reporte anual de Inflación vs Ingresos (gráfico de líneas)

| Campo | Detalle |
|---|---|
| **Descripción** | Quinto tipo de card de reporte (`inflation-income`): un **gráfico de líneas anual** (12 meses, ene–dic) que compara, en **puntos porcentuales**, la **inflación** del mes con la evolución de los **ingresos** del usuario. Muestra tres series: (1) la inflación mensual del IPC nacional (RF-IPC-001), (2) la variación mensual del total de **ingresos** respecto del mes anterior, y (3) esa misma variación **ajustada por inflación**. Sobre las dos series de ingreso traza además sus **rectas de tendencia**. Solo considera movimientos de tipo **ingreso (`INCOME`)**. Es un widget de reporte autónomo (RF-REP-002) con su año, su filtro de categorías y su moneda propios, persistidos en la clave `reports` (RF-REP-004). **Solo en `/reportes`; no se monta en el dashboard.** |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Contenido del gráfico:**

- **Eje X:** los 12 meses del año (ene–dic). **Eje Y:** puntos porcentuales (no moneda).
- **Tres series**, todas en puntos %:
  - **Inflación del mes** — variación mensual del IPC nacional (RF-IPC-001) de ese mes; sin punto si no hay dato de IPC.
  - **Variación de ingresos** — variación del total de ingresos del mes respecto del mes anterior. El mes anterior de **enero es diciembre del año previo** (continuidad temporal). Sin punto si el ingreso del mes anterior es cero o si el mes es **futuro**.
  - **Variación de ingresos ajustada por inflación** — la misma variación, descontando la inflación del mes en curso del ingreso del mes anterior antes de comparar; sin punto si falta el IPC, si el ingreso anterior es cero o si el mes es futuro.
- **Dos rectas de tendencia** — una sobre la serie de ingresos nominal y otra sobre la ajustada (ajuste lineal sobre los meses con dato). Cada tendencia **acompaña la visibilidad de su serie de ingreso madre**: no es un ítem propio de la leyenda.
- **Total de ingreso del mes** — suma de los ingresos del mes (únicos + fijos + cuotas aplicables) en la moneda de display de la card; es el insumo de la variación %, no se grafica como moneda. El mes en curso se computa **a la fecha**; los meses futuros no tienen dato.
- **Línea cortada en meses futuros** — la serie no conecta a través de meses sin dato.
- El **filtro de categorías** (RF-REP-002) restringe qué ingresos cuentan en las variaciones; el universo ofrecido es **solo las categorías con ingreso del año** (estable, no se achica al destildar).

**Criterios de aceptación:**
- [ ] La card `inflation-income` muestra un **gráfico de líneas de 12 meses (ene–dic)** con tres series en **puntos porcentuales**: inflación del mes, variación de ingresos y variación de ingresos ajustada por inflación.
- [ ] **Solo** movimientos de tipo `INCOME` alimentan las series de ingreso; gastos no entran.
- [ ] Cada serie queda **sin punto** cuando no se puede computar (sin IPC, ingreso previo cero, mes futuro), y la línea **no conecta** a través de esos meses.
- [ ] El mes anterior de **enero** es **diciembre del año previo** para la variación de ingresos.
- [ ] Se trazan **dos rectas de tendencia** (ingreso nominal y ajustado), cada una **siguiendo la visibilidad de su serie de ingreso madre**; no aparecen como ítems propios de la leyenda.
- [ ] La **leyenda togglea la visibilidad de las tres series** de forma **efímera** (no se persiste; al recargar vuelven las tres visibles).
- [ ] La card es un widget autónomo (RF-REP-002): año, filtro de categorías y moneda propios, persistidos en la clave `reports` (RF-REP-004). El universo del filtro son **solo las categorías con ingreso del año**.
- [ ] La card **solo existe en `/reportes`**; no se ofrece como widget del dashboard.
- [ ] La navegación de año respeta los límites de RF-REP-002 (hacia atrás topa en el primer año con datos; hacia adelante bloquea años futuros).

**Notas:**
- Las decisiones de presentación visual (color de cada serie y de las tendencias, grosor, leyenda) son responsabilidad de `control-design` (`docs/design.md`), no de este RF.
- Las fórmulas exactas (truncado de la variación, ajuste por inflación, ajuste lineal de la tendencia) y el contrato del endpoint viven en `docs/backend.md` §Serie de reportes y `docs/data-model.md` §Contrato de reporte anual de Inflación vs Ingresos.

---

#### RF-REP-013 — Reporte de Evolución de gastos fijos (gráfico de líneas)

| Campo | Detalle |
|---|---|
| **Descripción** | Tipo de card de reporte (`fixed-evolution`) que grafica la evolución a lo largo de un año (12 meses, ene–dic) de un conjunto de **gastos fijos** elegidos por el usuario, como **una sola línea total**. Su alcance son **únicamente** los movimientos de tipo **Fijo** y dirección **Gasto** (`EXPENSE`): no entran cuotas, ni únicos, ni fijos de ingreso. En lugar del filtro por categoría de las demás cards (RF-REP-002), expone una **selección a nivel de gasto fijo individual**: el usuario elige cuáles fijos entran (1, varios o todos) y la línea total se recalcula con esa selección. Ofrece un selector de **modo de visualización** con tres lecturas del mismo dato: montos simples, variación % nominal y variación % ajustada por inflación. Es un widget de reporte autónomo (RF-REP-002) con su año y su moneda propios, persistidos en la clave `reports` (RF-REP-004). **Solo en `/reportes`; no se monta en el dashboard.** |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Contenido del gráfico:**

- **Eje X:** los 12 meses del año (ene–dic). **Eje Y:** monto en el modo "montos simples"; puntos porcentuales en los dos modos de variación.
- **Una sola línea total** = la suma, mes a mes, del monto de los gastos fijos seleccionados que están activos en ese mes (criterio de aparición de fijos por mes: RN-016). Cambiar la selección recalcula esa única línea. Geometría: **línea**.
- **Selección de fijos (reemplaza el filtro por categoría).** El usuario elige a nivel de **gasto fijo individual** cuáles entran en la línea. En esta card **no** hay filtro por categoría: la selección por fijo lo sustituye. El universo ofrecido son **solo los gastos fijos (`EXPENSE`) del año** y es estable (no se achica al destildar). La card nace con **todos** los fijos del universo seleccionados.
- **Modo de visualización (3 lecturas del mismo dato):**
  - **Montos simples** — la línea total en moneda, en la moneda de display de la card (RF-REP-007).
  - **Variación % nominal** — variación del total mensual respecto del mes anterior, en puntos porcentuales. Sin punto si el total del mes anterior es cero o si el mes es futuro.
  - **Variación % ajustada por inflación** — la misma variación descontando la inflación del mes (IPC nacional, RF-IPC-001); sin punto si falta el IPC, si el total anterior es cero o si el mes es futuro.
  - El **ajuste por inflación aplica solo a los modos de variación**, nunca al modo de montos.

**Criterios de aceptación:**
- [ ] La card `fixed-evolution` grafica **una sola línea total** sobre los 12 meses del año, suma mensual de los gastos fijos seleccionados activos en cada mes (RN-016).
- [ ] El alcance es **exclusivamente** movimientos de tipo **Fijo** y dirección **Gasto** (`EXPENSE`): no entran cuotas, únicos ni fijos de ingreso.
- [ ] La selección se hace a nivel de **gasto fijo individual** y **reemplaza** al filtro por categoría: esta card **no** ofrece filtro por categoría. El universo son solo los gastos fijos del año, estable; la card nace con todos seleccionados.
- [ ] Un selector de **modo de visualización** ofrece tres lecturas del mismo dato: montos simples, variación % nominal y variación % ajustada por inflación.
- [ ] El **ajuste por inflación** (RF-IPC-001) aplica **solo** a los modos de variación; el modo de montos nunca se ajusta.
- [ ] La card reusa el **stepper de año** y la **moneda de display por card** del widget de reporte (RF-REP-002, RF-REP-007). La moneda solo incide en el modo de montos.
- [ ] La selección de fijos, el modo de visualización, el año y la moneda se **persisten por card** en la clave `reports` (RF-REP-004); el shape concreto se fija en implementación (`docs/data-model.md`).
- [ ] La card **solo existe en `/reportes`**; no se ofrece como widget del dashboard.

**Notas:**
- La forma concreta del **control de modo** (tres opciones planas, o "Montos / Variación" con un sub-toggle de ajuste por inflación) y la del **selector de fijos** las define `control-design` (`docs/design.md`), no este RF.
- La card necesita el **monto mensual de cada fijo a lo largo del año** (reconstruible de la cadena de splits `Recurring`, RN-005). El contrato del endpoint se fija en implementación (`docs/data-model.md`); este RF no lo prescribe.
- **Relación con Ingresos vs Gastos (RF-REP-014):** ambas son miradas sobre los fijos. Esta card es la mirada de **variación / inflación con selección por fijo**; Ingresos vs Gastos es la mirada de **montos con filtros por tipo / dirección / categoría**.

---

#### RF-REP-014 — Filtros por tipo de movimiento y dirección en Ingresos vs Gastos

| Campo | Detalle |
|---|---|
| **Descripción** | La card de tipo `income-expense` (Ingresos vs Gastos, RF-REP-001) admite acotar qué movimientos entran en sus series mediante tres dimensiones de filtro **combinables**: **tipo de movimiento** (fijo / cuota / único, multi-selección), **dirección** (solo gastos / solo ingresos / ambos) y **categoría** (ya soportado vía RF-REP-002). El default reproduce el comportamiento histórico de la card —todos los tipos, ambas direcciones, todas las categorías—, por lo que una card sin filtros configurados muestra exactamente lo de siempre (back-compat). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe una card de tipo `income-expense` (en `/reportes`). |

**Dimensiones de filtro (combinables):**

- **Tipo de movimiento** — `fijo` / `cuota` / `único`, **multi-selección**; default **los tres**. Acota qué tipos de movimiento aportan a los totales mensuales de ingresos y de gastos.
- **Dirección** — `solo gastos` / `solo ingresos` / `ambos`; default **ambos**. Acota qué dirección se computa en la serie.
- **Categoría** — el filtro de categorías ya existente del widget (RF-REP-002), con su lógica de tres estados (todas / subconjunto / ninguna), expuesto como la **leyenda-filtro de categorías tildables del footer** (igual que `by-category`).

Las tres dimensiones se combinan libremente (ej. "solo gastos fijos de la categoría X"; "todas las categorías pero solo gastos fijos"; "solo ingresos únicos").

**Criterios de aceptación:**
- [ ] La card `income-expense` admite filtrar por **tipo de movimiento** (fijo / cuota / único, multi-selección), **dirección** (solo gastos / solo ingresos / ambos) y **categoría** (RF-REP-002), de forma **combinable**.
- [ ] El **default** es **todos los tipos**, **ambas direcciones** y **todas las categorías**; ese default = el comportamiento actual de la card.
- [ ] **Back-compat obligatoria:** una card `income-expense` ya existente, sin estos filtros configurados, sigue mostrando **todo** (todos los tipos, ambas direcciones) sin cambio de comportamiento.
- [ ] El filtro acota **qué movimientos se computan** en los totales mensuales de ingresos y de gastos (mismo criterio de imputación mensual de RN-015).
- [ ] La configuración de filtros se **persiste por card** en la clave `reports` (RF-REP-004); el shape concreto se fija en implementación (`docs/data-model.md`).

**Notas:**
- La **forma de los controles** (cómo se exponen tipo y dirección, y la leyenda-filtro de categorías del footer) la define `control-design` (`docs/design.md`). La card **no** tiene leyenda interactiva de las series Ingresos/Gastos: la **dirección** es el único control de cuántas líneas dibuja el canvas (ambos = 2 líneas; solo gastos / solo ingresos = 1).

---

#### RF-REP-015 — Proyección de gastos fijos a futuro (capacidad de backend, sin UI que la consuma)

| Campo | Detalle |
|---|---|
| **Descripción** | El backend sabe **proyectar los fijos hacia meses futuros**: el endpoint `GET /movements/reports` acepta pedir la proyección y, cuando se pide, extiende las series por **línea** (gasto e ingreso por separado) combinando (1) un **esqueleto determinista** que reconstruye, mes a mes, la canasta de fijos conocida que estará activa en el futuro, y (2) una **tasa de encarecimiento** medida sobre el crecimiento de precio propio de cada fijo activo. Solo se proyectan **fijos**: cuotas y únicos no entran en el tramo futuro. El **horizonte es ilimitado**: la proyección se calcula para cualquier año futuro. **Ninguna pantalla consume hoy esta capacidad** —ni `/reportes` ni el dashboard—: no hay toggle ni control de proyección en ninguna card. Es una **capacidad retenida** del backend; la regla de cálculo se documenta acá porque es la parte valiosa y estable. |
| **Actor** | — (capacidad de backend, no expuesta a usuario) |
| **Prioridad** | Baja |
| **Precondiciones** | — |

**Regla de cálculo de la proyección:**

- **Método — esqueleto determinista × tasa de crecimiento de fijos, por línea.** La proyección se calcula por **línea** (gasto e ingreso por separado). Para cada mes futuro `m` (meses hacia adelante desde hoy):

  `valor_línea(m) = canasta_conocida(m) × (1 + tasa_precio)^m`

  compuesto, sin truncar decimales intermedios; el redondeo se aplica solo al valor final. El mes futuro de la línea vale **solo** este valor proyectado de fijos (cuotas y únicos no aportan al futuro).
- **`canasta_conocida(m)` — esqueleto determinista.** Suma, para el mes futuro `m`, del monto de los movimientos **fijos** en alcance que estarán **activos ese mes** según RN-016 (frecuencia, altas con `startMonth` futuro ya cargadas, `deletedFrom`, skips), cada uno a su **último monto conocido**, respetando los filtros de RF-REP-014 (dirección, tipos con `fijo` incluido, categorías tildadas). Solo entran fijos —normales y calculados-de-fijo—; cuotas y únicos no. Es **determinista**: la composición futura conocida (altas programadas, bajas, cadencia de un fijo anual/bimestral) se reconstruye acá, **no** se estima con la tasa. Un fijo con alta futura aparece en su mes; uno dado de baja deja de sumar; un anual reaparece solo en el mes que le toca.
- **`tasa_precio` — crecimiento propio de cada fijo, ponderado por tamaño.** Tasa mensual medida **por línea**, sobre las **cadenas de fijo activas hoy** en alcance (filtros de RF-REP-014, solo fijos). Para cada cadena `i`:
  - Se busca su **monto más viejo dentro de la ventana `[hoy-12 .. hoy-1]`**: el mes más antiguo —hasta 12 atrás— en que esa misma cadena estaba activa (`old_i`, a `n_i` meses de hoy); `today_i` es su monto hoy.
  - Una cadena **sin monto previo en la ventana** (alta reciente) o con `old_i <= 0` queda **excluida de la tasa** —pero sigue en `canasta_conocida`, para que un alta no infle la tasa.
  - `growth_i = (today_i / old_i)^(1/n_i) − 1` (CAGR mensual propio de esa cadena sobre su ventana disponible).
  - `tasa_precio` = promedio de los `growth_i` **ponderado por tamaño** (peso = `today_i`): `Σ(today_i · growth_i) / Σ(today_i)`, sobre las cadenas con historia previa.
- **Piso en 0 — nunca se proyectan bajas.** Se aplica `max(0, tasa_precio)` sobre el **agregado final** (nunca proyecta bajas). Si ninguna cadena tiene historia previa en la ventana, `tasa_precio = 0` (proyección plana al esqueleto).
- **Racional.** Se mide el crecimiento **real de cada fijo sobre su propia historia**, ponderado por tamaño, en vez de anclar en un único mes común de la ventana: así los fijos que varían cuentan aunque tengan pocos meses de historia, los planos aportan ~0, y las altas no inflan la tasa (las absorbe la canasta determinista).
- **Sin IPC.** El pronóstico **no** usa la inflación nacional (IPC) en ningún caso: ni como motor, ni como mezcla, ni como fallback. Un fijo nunca editado (monto constante, sin historial de precio) no aporta señal y contribuye plano a su monto real.
- **Skips.** Un skip es ausencia puntual, no cambio de precio: **no** cuenta para la tasa; sí afecta `canasta_conocida(m)` (un mes skippeado aporta 0 de ese fijo ese mes).
- **Moneda — serie de display.** La proyección se calcula sobre la serie en la **moneda de display** (montos ya convertidos con el TC de sus propios meses). Es una limitación conocida: mezcla parte de la variación de tipo de cambio en la tasa. Proyectar en moneda propia sería inviable sin tipos de cambio futuros.
- **Ventana 12 meses; horizonte ilimitado; solo fijos.** La ventana de la tasa es de 12 meses; el tramo proyectado no se corta a fin de año (se calcula para cualquier año futuro pedido) y solo extiende fijos.

**Criterios de aceptación:**
- [ ] El endpoint `GET /movements/reports` acepta pedir la proyección de fijos; sin pedirla, la respuesta no agrega tramo proyectado (comportamiento por defecto).
- [ ] Con la proyección pedida, las series se **extienden a los meses futuros** proyectando **solo los fijos**; cuotas y únicos **no** entran en el tramo proyectado.
- [ ] Cada mes futuro de cada línea vale `canasta_conocida(m) × (1 + tasa_precio)^m`, aplicado **compuesto** hacia adelante; el redondeo va solo al valor final.
- [ ] `canasta_conocida(m)` reconstruye de forma **determinista** los fijos activos ese mes según RN-016 (frecuencia, altas futuras, bajas, skips) a su último monto conocido, respetando los filtros de RF-REP-014: un fijo con alta futura aparece en su mes, un fijo dado de baja deja de sumar, un anual reaparece solo cuando le toca.
- [ ] `tasa_precio` es el **promedio ponderado por tamaño** (peso = monto hoy) del **CAGR mensual propio** de cada cadena de fijo activa hoy, medido contra su monto más viejo dentro de la ventana `[hoy-12 .. hoy-1]`; las cadenas sin historia previa en la ventana se **excluyen de la tasa** (pero siguen en la canasta).
- [ ] La tasa tiene **piso en 0** sobre el agregado final: nunca se proyectan bajas. Sin ninguna cadena con historia previa ⇒ proyección plana al esqueleto.
- [ ] La proyección **no usa IPC** en ningún caso (ni motor, ni mezcla, ni fallback).
- [ ] El **horizonte es ilimitado**: la proyección se calcula para cualquier año futuro; no se corta a fin de año.
- [ ] **Ninguna pantalla consume la proyección hoy**: no hay toggle ni control de proyección en ninguna card (ni en `/reportes` ni en el dashboard).

**Notas:**
- La tasa se apoya en que el **historial de montos de cada fijo es reconstruible**: cada edición de monto de un fijo crea un **split en la cadena `Recurring`** (RN-005), de modo que el monto de cada cadena en su punta vieja de la ventana está disponible para medir su crecimiento propio. Las fórmulas exactas y el contrato del endpoint están en `docs/backend.md` y `docs/data-model.md`.
- **Limitación de moneda.** La proyección se calcula sobre la serie en la **moneda de display**, no sobre la moneda propia del fijo; proyectar en moneda propia exigiría tipos de cambio futuros que el sistema no tiene.
- **Límite asumido — salto único vs. periódico.** Un aumento único e irrepetible es indistinguible de uno periódico en el dato disponible: la tasa lo trata igual que a un aumento repetible, por lo que puede **sobreestimar** tras un salto único.
- **Capacidad retenida, no consumida.** El backend conserva el soporte para responder la proyección (params `projectFixed` / `today` → `projected`; contrato en `docs/data-model.md`, cálculo en `docs/backend.md`), pero hoy ningún consumidor la pide.
- **Relación con RF-REP-013:** la proyección de fijos y el reporte de Evolución de gastos fijos (RF-REP-013) son ambas miradas sobre los fijos; aquí es la mirada de **montos** proyectada a futuro, mientras que RF-REP-013 es la mirada de **variación / inflación con selección por fijo**.

---

#### RF-REP-016 — Refrescar una card individualmente

| Campo | Detalle |
|---|---|
| **Descripción** | Cada card de `/reportes` —los cinco tipos: income-expense (RF-REP-005), by-category (RF-REP-006), unique-grid (RF-REP-010), installment-gantt (RF-REP-011), inflation-income (RF-REP-012)— **y** el widget income-expense del Dashboard exponen en su cabecera un botón de **refrescar** que vuelve a pedir al backend **solo los datos de esa card**. El refetch es **independiente por card**: refrescar una no afecta a las demás. **Backend sin cambios**: reusa el mismo endpoint de datos de la card. El detalle visual (forma, ubicación, ícono, estado de carga) está en `docs/design.md`. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Baja |
| **Precondiciones** | El usuario está en `/reportes` (o en el Dashboard, para su widget income-expense). |

**Criterios de aceptación:**
- [ ] Cada uno de los cinco tipos de card de `/reportes` y el widget income-expense del Dashboard exponen un botón de **refrescar** en su cabecera.
- [ ] Al accionarlo, la card **vuelve a pedir sus datos al backend** y **solo esa card** se recarga; las demás no se ven afectadas.
- [ ] El **feedback es solo un spinner** mientras recarga; **no hay toast** (ni de éxito ni de error).
- [ ] Si la recarga **falla**, la card muestra su propio **estado de error** ya existente.
- [ ] En **modo orden** (RF-REP-009) el botón de refrescar, como el resto de los controles internos de la card, **no está disponible**.

---

### 3.10 Módulo: Multi-moneda

> La moneda es **explícita**: cada movimiento lleva su **moneda + cotización**; los totales se expresan en una **única moneda default** del usuario, convertida en vivo. La cotización del movimiento se **pre-carga desde una tabla de cotizaciones de referencia** (interna, no editable por UI). Modelo de datos en `data-model.md`, §Moneda explícita, set curado, §Contrato de configuración del usuario (settings) y §Tabla de cotizaciones de referencia.

El alcance es un **set curado de 4 monedas (ARS / USD / EUR / BRL)**, sin alta de monedas arbitrarias por el usuario. La conversión es **100% de display**: cambiar la moneda default re-expresa los totales sin tocar ningún dato guardado. La **cotización es manual y por movimiento** (Opción A): la tabla de referencia solo pre-carga un valor inicial editable, nunca reescribe lo guardado.

---

#### RF-CUR-001 — Moneda y cotización por movimiento

| Campo | Detalle |
|---|---|
| **Descripción** | Cada movimiento (único, fijo, cuota) se carga en una **moneda** de un **set curado de 4 (ARS / USD / EUR / BRL)** y lleva una **cotización** = unidades de la moneda default del usuario por 1 unidad de la moneda del movimiento (Opción A). El monto se ingresa y se guarda en **centavos de la moneda original** del movimiento. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa. |

**Flujo principal:**
1. En el formulario de carga, debajo del monto, el usuario elige la **moneda** (ARS / USD / EUR / BRL) y, si corresponde, la **cotización**.
2. La cotización viene **pre-cargada** con la **cotización de referencia del mes** (RF-CUR-003) y es **editable**.
3. El usuario confirma; el sistema guarda monto (centavos de la moneda original), moneda y cotización.

**Criterios de aceptación:**
- [ ] El set de monedas es un **set curado de 4: ARS, USD, EUR, BRL**. No hay alta de monedas arbitrarias por el usuario.
- [ ] El monto se guarda en **centavos de la moneda original** del movimiento (no convertido).
- [ ] La cotización son **unidades de la default por 1 unidad de la moneda del movimiento** (Opción A), con decimales (no centavos), y debe ser **> 0** (validación; ver RF-CUR-005 / `data-model.md`). Para un movimiento cuya moneda coincide con la default, la cotización es `1` y el bloque puede ocultarse.
- [ ] El campo de cotización es **editable**; los cruces no triviales (p. ej. EUR con default BRL) se derivan vía el pivote USD para el pre-fill, pero el valor guardado es el que confirma el usuario.
- [ ] La presentación del bloque moneda/cotización en el formulario está en `screens.md` §Formulario y `design.md`.

**Notas:**
- La cotización solo es **semánticamente necesaria** cuando la moneda del movimiento difiere de la default; cuando coinciden, el bloque se **oculta** y la cotización es `1`. El label del par en el formulario es `{moneda del movimiento}→{default}`. Presentación en `screens.md` §Formulario.

---

#### RF-CUR-002 — Moneda por defecto del usuario

| Campo | Detalle |
|---|---|
| **Descripción** | Cada usuario tiene una **moneda por defecto** (una del set curado, default ARS) configurable en `/configuracion`. Es la moneda en la que se expresan los **totales** de `/mes`, del dashboard y de los reportes. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] La moneda default se configura en la pantalla **`/configuracion`** (RF-CUR; ver `screens.md`), eligiendo entre las **4 monedas curadas (ARS / USD / EUR / BRL)** y arrancando en **ARS** para todo usuario.
- [ ] Todos los **totales** (gastos / ingresos / balance del mes, series de reportes) se muestran **en la moneda default vigente**.
- [ ] Cambiar la moneda default **no modifica ningún movimiento guardado** (RF-CUR-005): solo re-expresa los totales (conversión de display, en vivo).
- [ ] Contrato de lectura/escritura en `data-model.md`, §Contrato de configuración del usuario (settings).

---

#### RF-CUR-003 — Pre-carga editable de la cotización de referencia del mes

| Campo | Detalle |
|---|---|
| **Descripción** | El campo de cotización del formulario arranca **pre-cargado** con la **cotización de referencia del mes** del movimiento (derivada de la tabla de referencia, RF-CUR-006), donde el usuario puede aceptarla o editarla. Si la tabla no tiene dato para ese mes/moneda, cae al último cambio usado (`lastExchangeRate`). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] El campo de cotización arranca **pre-cargado** con la cotización de referencia del mes (vía `GET /settings/reference-rate`; ver `data-model.md`).
- [ ] La granularidad del mes que pide el pre-fill sigue la del tipo (RF-CUR-004): en fijos el mes de aparición, en cuotas el `startMonth` del grupo, en únicos el mes del movimiento.
- [ ] Si la tabla de referencia no tiene dato (`exchangeRate: null`), se usa como **fallback** el último cambio real del usuario (`lastExchangeRate`; ≠ el default `1` — ver `data-model.md`).
- [ ] El copy de la nota del campo es **"Cotización de referencia del mes"**.
- [ ] El valor pre-cargado es **editable** en cada carga.

---

#### RF-CUR-004 — Granularidad de la cotización por tipo de movimiento

| Campo | Detalle |
|---|---|
| **Descripción** | La cotización tiene distinta granularidad según el tipo de movimiento: por movimiento en únicos, por mes de aparición en fijos, por grupo en cuotas; los calculados la heredan del origen. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | — |

**Granularidad:**
- **Únicos:** una cotización **por movimiento**.
- **Fijos:** una cotización **por mes de aparición**, editable mes a mes; editar la cotización de un mes en adelante usa la **misma mecánica de split del pasado** que cualquier edición de fijo (RN-005), preservando los meses ya corridos.
- **Cuotas:** **una** cotización por **grupo** (todas las cuotas comparten la del grupo).
- **Calculados:** **heredan** moneda y cotización del **origen** —no se eligen ni se persisten propias—; se derivan al vuelo junto con el monto.

**Criterios de aceptación:**
- [ ] Cada único guarda su propia cotización; cada grupo de cuotas, una sola para todo el grupo.
- [ ] Un fijo puede tener cotizaciones distintas en meses distintos; cambiarla mes-en-adelante no toca los meses pasados.
- [ ] Un calculado muestra y computa con la moneda y cotización **de su origen** en el mes; no expone campos de moneda/cotización propios.
- [ ] Modelado de la granularidad en `data-model.md`, §Moneda explícita ARS/USD.

---

#### RF-CUR-005 — Conversión a la moneda default (capa de display, en vivo)

| Campo | Detalle |
|---|---|
| **Descripción** | Los totales y reportes se computan convirtiendo cada movimiento desde su moneda original (con su cotización) a la **moneda default vigente** del usuario. La conversión es **100% visual y en vivo**: nunca reescribe lo guardado. |
| **Actor** | Sistema |
| **Prioridad** | Alta |
| **Precondiciones** | — |

**Criterios de aceptación:**
- [ ] Los totales de `/mes`, del dashboard y las series de reportes se expresan en la **moneda default vigente**, convirtiendo cada movimiento con su cotización.
- [ ] Cambiar la moneda default **re-expresa** los totales al instante, **sin** modificar ningún movimiento (monto, moneda ni cotización originales quedan intactos).
- [ ] El ítem de `/mes` muestra el **monto original + moneda** y el **valor convertido** que entra a los totales (ver `screens.md` §Vista del mes y `design.md`).
- [ ] **Back-compat:** todos los movimientos existentes quedan en **ARS** con cotización `1`; un usuario que nunca tocó nada ve todo igual que antes (default ARS).
- [ ] Los endpoints sirven los totales/series **ya convertidos** (`convertedAmountCents`); contrato en `data-model.md`, §Contrato de movimientos del mes y §Contrato de serie de reportes.

---

#### RF-CUR-006 — Tabla de cotizaciones de referencia (interna, no editable)

| Campo | Detalle |
|---|---|
| **Descripción** | El sistema mantiene una **tabla de cotizaciones de referencia** por `(moneda, mes)`, **global** (compartida por todos los usuarios), **interna y no editable por la UI**. Sirve de **valor por defecto (copia, no FK)** para pre-cargar la cotización de cada movimiento según su mes (RF-CUR-003); el movimiento conserva su cotización propia y editable. |
| **Actor** | Sistema |
| **Prioridad** | Media |
| **Precondiciones** | — |

**Criterios de aceptación:**
- [ ] La tabla es **global** (no por usuario) e **interna**: **no hay UI** para crear, editar ni ver sus valores. `/configuracion` no la expone (RF-CUR-002).
- [ ] El **pivote es USD**: cada valor expresa unidades de la moneda por 1 USD; **USD no tiene fila** (pivote implícito = 1). Cualquier cruce entre monedas se **deriva vía USD** (p. ej. EUR↔BRL).
- [ ] El pre-fill del formulario consume esta tabla vía `GET /settings/reference-rate?month&currency`, que devuelve la cotización **unidades de la default por 1 unidad de la moneda del movimiento**, o `null` si el mes/moneda no tiene dato (RF-CUR-003 cae al fallback).
- [ ] La tabla es **valor por copia**: pre-carga, no vincula. Cambiar (en una futura carga de datos) un valor de referencia **no** reescribe la cotización de ningún movimiento ya guardado.
- [ ] Modelado, clave única, seed y contrato del endpoint en `data-model.md`, §Tabla de cotizaciones de referencia y §Contrato de configuración del usuario (settings).

---

### 3.11 Módulo: Apariencia

> El usuario elige el **modo de color** de la app (Sistema / Claro / Oscuro) desde un control en el **chrome global** (sidebar, RF-NAV-001). Persiste por usuario en el blob de preferencias (`theme`); modelo de datos en `data-model.md`, §Claves del blob → `theme`. Arquitectura de aplicación (override de tokens, anti-flash) en `docs/frontend.md`, §Modo de color (theming).

---

#### RF-APP-001 — Modo de color (Sistema / Claro / Oscuro)

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario elige el modo de color de la app entre **Sistema**, **Claro** y **Oscuro**, desde un control en el **chrome global** (sidebar, RF-NAV-001). **Sistema** es el default: sigue la preferencia de color del dispositivo y reacciona en vivo a sus cambios. La elección persiste por usuario. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] El control vive en el **chrome global**, en el **sidebar** (RF-NAV-001), como un toggle de iconos (Sistema / Claro / Oscuro), con tres opciones. No vive en `/configuracion`.
- [ ] El **default es Sistema**: la app sigue la preferencia de color del dispositivo (`prefers-color-scheme`) y **reacciona en vivo** a un cambio del modo del sistema operativo mientras está en Sistema.
- [ ] **Claro** y **Oscuro** fuerzan ese modo con independencia del dispositivo.
- [ ] La elección **persiste por usuario** en el blob de preferencias (clave `theme`): sobrevive al cierre de sesión, al cambio de dispositivo y a limpiar el navegador. No vive en `/settings` (la moneda default sí; esto no).
- [ ] **Compatibilidad visual total en ambos modos y en cualquier tipo de dispositivo:** toda pantalla y todo control se ven correctos tanto en claro como en oscuro. Las reglas semánticas son **idénticas** en los dos modos: verde = ingreso, rojo = gasto, índigo solo como color de marca, cifras de dinero en fuente monoespaciada. El detalle visual de cada modo lo define `control-design` (`docs/design.md`).

---

#### RF-APP-002 — Gate por debajo del ancho mínimo soportado (640px)

| Campo | Detalle |
|---|---|
| **Descripción** | Por debajo del ancho mínimo soportado (viewport `< 640px`), la app muestra un **gate**: una pantalla que **impide usarla**. El ancho mínimo soportado (640px) y la política de contención viven en `docs/design.md`, §Contención responsive. |
| **Actor** | Cualquier visitante (autenticado o no) |
| **Prioridad** | Media |
| **Precondiciones** | Viewport `< 640px`. |

**Criterios de aceptación:**
- [ ] El gate se muestra cuando el viewport es **`< 640px`** (por debajo del ancho mínimo soportado) y **cubre toda la app**, incluida la pantalla de login. El login queda gateado porque por debajo del piso la app no se puede usar: ofrecer una puerta a una casa inaccesible no tiene sentido.
- [ ] Es un **bloqueo, no un aviso descartable**: no hay botón "continuar igual" ni forma de saltearlo. Mientras el viewport esté por debajo del piso, no hay acceso a ninguna pantalla de la app.
- [ ] Cuando el viewport vuelve a **`≥ 640px`** (al rotar el dispositivo o redimensionar la ventana), la app aparece **sin recargar** y sin parpadeo. Por eso la condición del gate es **CSS puro** (media query sobre el ancho del viewport): sin listener de `resize`, sin estado en JS, sin depender de hidratación. Es una decisión técnica, no cosmética — cualquier implementación basada en JS reintroduce el parpadeo y la necesidad de recargar.
- [ ] El gate **ocupa el viewport y no genera scroll** (ni vertical ni horizontal).
- [ ] **Copy (es-AR):**
  - Título: **Necesitás una pantalla más grande**
  - Línea: **Control necesita más espacio para mostrarte tus movimientos con claridad. Agrandá la ventana o abrilo en una pantalla más grande.**
- [ ] La composición visual (jerarquía, tamaño, color, tipografía) reusa **tokens y primitivas ya existentes** del design system; no introduce valores nuevos. El detalle visual lo enmarca `control-design` (`docs/design.md`, §Contención responsive).

---

### 3.12 Módulo: Sincronización de cotizaciones externas

> El sistema captura **automáticamente** cotizaciones FX (P7a) e IPC argentino (P7b) desde fuentes oficiales externas, vía un trigger sin datos. Es la única excepción a "sin APIs externas en v1". No tiene UI de producto: alimenta la tabla de cotizaciones de referencia (FX) y guarda IPC para una feature futura. Modelo de datos y seguridad de la ingesta en `data-model.md`, §Cotizaciones externas y sincronización (subsección §Seguridad de la ingesta).

P7 se parte en dos requerimientos independientes (fuentes distintas): **P7a = FX** (RF-FX-001), **P7b = IPC** (RF-IPC-001). Ambos se disparan por el **mismo endpoint** `POST /settings/reference-rates/sync`, que **no recibe valores** en el body —solo gatilla el fetch server-side— y está protegido por un secret de operación (`CRON_SECRET`), no por el JWT de usuario.

---

#### RF-FX-001 — Captura de cotizaciones FX desde fuentes externas (P7a)

| Campo | Detalle |
|---|---|
| **Descripción** | El sistema obtiene de fuentes oficiales las cotizaciones de las monedas del set curado contra USD, las guarda como variantes (`CurrencyQuote`) y propaga la variante **oficial** a la tabla de cotizaciones de referencia (`ReferenceRate`, RF-CUR-006). |
| **Actor** | Sistema (disparado por un proceso de operación / cron) |
| **Prioridad** | Diferida |
| **Precondiciones** | El disparador presenta el secret de operación válido. Hay conectividad con las fuentes. |

**Fuentes:**
- **ARS por USD → `dolarapi.com`** (Frankfurter no cubre ARS de forma confiable). Se guardan **ambas** variantes publicadas, **oficial y blue**; la conversión interna usa **siempre la oficial** (no hay UI para elegir variante todavía).
- **EUR por USD y BRL por USD → `api.frankfurter.dev`** (base USD, valor directo, sin derivar). Valor único por moneda → se guarda como variante `oficial` con `compra == venta`.

**Criterios de aceptación:**
- [ ] El sync escribe cada cotización capturada en `CurrencyQuote` por `(moneda, variante, mes)` (upsert idempotente) y propaga la variante **oficial** a `ReferenceRate.rate` del mismo `(moneda, mes)`.
- [ ] Se guardan **oficial y blue** para ARS; la **conversión interna del producto usa solo la oficial** (la variante no es elegible por UI en v1).
- [ ] El conjunto de variantes es **extensible sin migración**: `variant` es string libre validado contra una allowlist en código (`data-model.md`, §`CurrencyQuote`). Sumar una variante futura es editar la allowlist, no el esquema.
- [ ] La semántica de pivote no cambia: cada valor es **unidades de la moneda por 1 USD**; **USD no tiene fila** (pivote implícito = 1).
- [ ] La conversión interna (`/mes`, dashboard, reportes) **sigue leyendo solo `ReferenceRate`**; las variantes no-oficiales no afectan ningún total en v1.
- [ ] Un dato externo que no pasa validación (schema, cotas de cordura, circuit breaker > 15%) **no sobrescribe** el valor vigente y se registra en `RateSyncLog` (ver RF-SYNC-001 y agente backend).

---

#### RF-IPC-001 — Captura del IPC argentino (P7b)

| Campo | Detalle |
|---|---|
| **Descripción** | El sistema obtiene el IPC nacional (INDEC) por mes desde `apis.datos.gob.ar` y lo guarda en `InflationRate`. El histórico ya está sembrado por data migration; la **captura por sync** del mes corriente es la parte diferida de este RF. El dato de `InflationRate` **lo consume el reporte anual de gastos Únicos** (RF-REP-010, métricas de inflación del footer). |
| **Actor** | Sistema (disparado por un proceso de operación / cron) |
| **Prioridad** | Diferida |
| **Precondiciones** | El disparador presenta el secret de operación válido. Hay conectividad con la fuente. |

**Criterios de aceptación:**
- [ ] La fuente es `apis.datos.gob.ar` (series de tiempo INDEC): variación mensual (`145.3_INGNACUAL_DICI_M_38`) y nivel del índice (`148.3_INIVELNAL_DICI_M_26`).
- [ ] Cada mes se guarda en `InflationRate` por `yearMonth` (clave única, upsert idempotente): variación mensual + nivel del índice + fuente + instante de captura.
- [ ] El IPC **no alimenta** la conversión de monedas ni los totales del mes; sí lo consume el **reporte anual de gastos Únicos** (RF-REP-010) para las métricas de inflación y % ajustado del footer.
- [ ] Mismas garantías de ingesta segura que RF-FX-001 (schema estricto, cotas, log de auditoría).

---

#### RF-SYNC-001 — Trigger de sincronización sin datos

| Campo | Detalle |
|---|---|
| **Descripción** | La ingesta se dispara con `POST /settings/reference-rates/sync`, que **no recibe valores de cotización** en el body —solo gatilla el fetch server-side a las fuentes oficiales— y está protegido por un secret de operación. El caller no puede inyectar números. |
| **Actor** | Sistema (proceso de operación / cron autorizado) |
| **Prioridad** | Diferida |
| **Precondiciones** | El request presenta el secret de operación (`CRON_SECRET`) válido. |

**Criterios de aceptación:**
- [ ] El endpoint **no acepta valores** de cotización ni de IPC en el body (a lo sumo un selector de scope `fx`/`ipc`/`all`); cualquier valor que llegue se descarta.
- [ ] Está protegido por **`CRON_SECRET`** (no por el JWT de usuario): sin secret válido responde `401`. El secret nunca se loguea.
- [ ] El proceso aplica **validación estricta** del dato externo (schema, cotas de cordura) y un **circuit breaker al 15%** (un valor que se desvía > 15% del último guardado **no** sobrescribe, se marca anomalía y se refleja en la respuesta).
- [ ] Cada intento de escritura (aceptado o rechazado) queda registrado en `RateSyncLog` con su motivo.
- [ ] La respuesta es **ruidosa ante la anomalía**: un rechazo aislado entre varios targets devuelve `200` con el detalle; una corrida sin ningún target aceptado (fuente caída, dato inválido) responde **no-2xx** (`422`/`502`). Contrato completo en `data-model.md`, §Contrato — `POST /settings/reference-rates/sync`; detalle de seguridad en `.claude/agents/control-backend.md`.

---

### 3.13 Módulo: Límites

> El usuario configura **límites** sobre datos de la Vista del mes (`/mes`), del dashboard y de los reportes. Se gestionan desde la solapa **Límites** de `/configuracion` (pantalla 9 de `screens.md`). Persisten por usuario en el blob de preferencias (clave `limits`); el backend la trata como blob opaco (igual que `theme` / `reports`). Evaluación 100% client-side. Shape en `data-model.md`, §Claves del blob → `limits`; catálogo de efectos visuales y su mapeo por anclaje en `docs/design.md`; arquitectura en `docs/frontend.md`, §Límites.

Un **límite** observa un dato (identificado por una **key** de un catálogo hardcodeado), lo compara contra un umbral y, si la condición se cumple, dispara un efecto de una de **dos naturalezas**:

- **Marca visual pasiva** (RF-LIM-003) — al renderizar, resalta el dato cuando cruza el umbral. Read-path; sobre datos ya en pantalla. No altera montos, totales ni ningún dato guardado.
- **Alerta activa** (RF-LIM-004) — al guardar un movimiento, si el resultado proyectado cruzaría el umbral, un aviso **no bloqueante** de confirmación. Write-path; proyecta el estado post-movimiento.

**Alcance por naturaleza:** la marca pasiva cubre **todas** las superficies cableadas — la Vista del mes (`/mes`), el dashboard y los 5 reportes de `/reportes` (keys en RF-LIM-003). La alerta activa se acota a las **7 keys de nivel mes** (`mes.*`), las únicas que un movimiento que se está por guardar modifica en el acto (RF-LIM-004).

Además, un **popover informativo de solo lectura** (RF-LIM-005) lista, por superficie, qué límites la observan. No marca ni avisa — informa; es una pieza independiente de las dos naturalezas.

---

#### RF-LIM-001 — Anatomía de un límite

| Campo | Detalle |
|---|---|
| **Descripción** | Un límite es una **condición única** sobre un dato: `dato {operador} umbral`. Al cumplirse dispara su efecto según la naturaleza: una **marca visual** (pasiva, RF-LIM-003) o una **alerta al guardar** (activa, RF-LIM-004). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Composición de un límite:**
- **Anclaje (key):** el dato que observa, elegido de un catálogo hardcodeado de keys (el "lenguaje común" entre los datos que las emiten y la config que las consume). Las keys cableadas abarcan las superficies de `/mes`, dashboard y reportes (ver RF-LIM-003).
- **Naturaleza:** `pasiva` (marca visual) o `activa` (alerta al guardar). La activa solo es elegible sobre las 7 keys `mes.*` (RF-LIM-004); las de dashboard/reportes solo admiten pasiva.
- **Refinamiento (condicional):** algunas keys acotan a una **sección** de `/mes` (Únicos / Fijos / Cuotas) o a una **categoría**. La key de sección exige sección; la de categoría-del-mes exige categoría; la de monto de ítem admite categoría **opcional** (ausente = cualquier ítem).
- **Operador:** uno de `mayor que` / `mayor o igual` / `menor que` / `menor o igual` / `igual a`. En la naturaleza **activa** se restringe por la polaridad del anclaje (RF-LIM-004).
- **Umbral:** un **número puro, sin moneda**. La app es equivalente en cuanto a monedas; no se modela moneda en el umbral ni hay conversión en la evaluación. Su tipo (monto / porcentaje / entero) lo fija la unidad de la key.
- **Alcance temporal** *(solo pasiva)*: `todos los meses` (default) marca cualquier mes navegado que cruce el umbral; `mes en curso` marca solo el mes real de hoy. **No aplica a la activa** (siempre proyecta sobre el mes destino del movimiento, RF-LIM-004).
- **Efecto** *(solo pasiva)*: el estilo visual de la marca, elegido de un subset válido según el anclaje (catálogo de efectos en `docs/design.md`). La activa no lleva efecto (avisa, no marca).
- **Nombre (opcional):** rótulo del usuario; ausente = placeholder derivado de la key + la condición.
- **Estado (`enabled`):** activo / inactivo sin borrar la regla.

**Criterios de aceptación:**
- [ ] Un límite es exactamente **una** condición `dato {operador} umbral`. No hay condiciones compuestas (AND/OR) ni umbrales escalonados; un efecto escalonado se arma con **varios límites** sobre la misma key con distinto umbral/efecto.
- [ ] El umbral es un **número puro**: no lleva moneda y se compara directo contra el número del anclaje en la unidad de la key.
- [ ] El límite es **semántico, no atado a un widget**: se vincula a la key (+ refinamiento), no a una instancia concreta; alcanza todo anclaje que emita esa key.
- [ ] La naturaleza es **pasiva** (marca visual, no altera dato/total/movimiento) o **activa** (aviso no bloqueante al guardar, no altera lo que persiste el usuario).

---

#### RF-LIM-002 — Gestión de límites (panel de Configuración)

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario administra sus límites desde la solapa **Límites** de `/configuracion`: los lista, crea, elimina y activa/desactiva. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Operaciones:**
- **Crear** — un formulario progresivo: elegir la key → (si aplica) refinamiento → **naturaleza** (pasiva / activa) → operador + umbral → *(rama pasiva)* alcance temporal + efecto → nombre opcional. La rama **activa** omite el alcance temporal y el efecto.
- **Eliminar** — quita el límite, con confirmación inline.
- **Activar / desactivar** — toggle `enabled` sin borrar la regla.

**Criterios de aceptación:**
- [ ] La solapa Límites lista todos los límites del usuario con su nombre (o placeholder derivado), la key legible, su naturaleza (pasiva/activa), su condición (operador + umbral), el switch `enabled` y —solo en pasiva— un preview del efecto.
- [ ] Crear un límite se hace desde un modal con formulario progresivo; el picker de key ofrece las keys cableadas de **todas** las superficies (`/mes`, dashboard y reportes, RF-LIM-003), agrupadas por superficie con rótulos legibles.
- [ ] El selector de **naturaleza** habilita **activa solo** para las 7 keys `mes.*`; para keys de dashboard/reportes solo ofrece pasiva.
- [ ] En la rama **pasiva** el picker de efecto ofrece **solo el subset válido** del anclaje elegido (con preview) y se pide el alcance temporal; en la rama **activa** ambos se **omiten** y los operadores se restringen por la polaridad del anclaje (RF-LIM-004).
- [ ] El **signo válido del umbral depende de la unidad** del dato observado (catálogo `lib/limits/catalog.ts`): las unidades `money` y `count` exigen umbral **positivo** (`money` > 0; `count` entero ≥ 1); `signed-money` (Balance) y `percent` **admiten valores negativos** (son magnitudes con signo). El panel **bloquea el submit** y avisa en el campo cuando el umbral viola la regla de su unidad.
- [ ] **No se edita** un límite existente: para cambiarlo se elimina y se crea de nuevo (el toggle `enabled` permite desactivar sin borrar).
- [ ] Eliminar pide confirmación inline antes de quitar el límite.
- [ ] Cada cambio persiste el blob completo vía `PUT /preferences` (`{ ...preferences, limits: [...] }`), semántica de reemplazo total.

---

#### RF-LIM-003 — Marca visual pasiva (todas las superficies)

| Campo | Detalle |
|---|---|
| **Descripción** | Al renderizar cualquier superficie cableada (`/mes`, dashboard, reportes), cada dato que emite una key evalúa los límites que la referencian; si un límite habilitado cruza el umbral, el dato recibe su marca visual. |
| **Actor** | Sistema |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene al menos un límite habilitado sobre una key cableada. |

**Anclajes cableados de `/mes`:**

| Key | Dato | Refinamiento |
|---|---|---|
| `mes.total.gasto` | Total de gastos del mes | — |
| `mes.total.ingreso` | Total de ingresos del mes | — |
| `mes.balance` | Balance del mes (ingresos − gastos) | — |
| `mes.seccion.subtotal` | Subtotal de una sección | sección (obligatorio) |
| `mes.seccion.conteo` | Cantidad de ítems de una sección | sección (obligatorio) |
| `mes.item.monto` | Monto de una línea de movimiento | categoría (opcional) |
| `mes.categoria.gastoMes` | Total gastado en una categoría en el mes (derivado) | categoría (obligatorio) |

**Anclajes cableados del dashboard:** el resumen mensual reutiliza las keys `mes.total.gasto` / `mes.total.ingreso` / `mes.balance` (mes en curso); el widget efímero Ingresos vs. Gastos emite las keys `reporte.ie.*` de la tabla siguiente. El dashboard no tiene keys propias.

**Anclajes cableados de los 5 reportes de `/reportes`:**

| Superficie | Key | Dato | Refinamiento |
|---|---|---|---|
| Ingresos vs Gastos | `reporte.ie.gastoMes` | Gasto de un mes (serie anual) | — |
| Ingresos vs Gastos | `reporte.ie.ingresoMes` | Ingreso de un mes (serie anual) | — |
| Gastos por categoría | `reporte.cat.gastoMesCategoria` | Gasto de una categoría en un mes | categoría (obligatorio) |
| Gastos por categoría | `reporte.cat.gastoMesTotal` | Total de gasto apilado del mes | — |
| Gastos Únicos | `reporte.unicos.celda` | Gasto Único de un día (celda) | — |
| Gastos Únicos | `reporte.unicos.mesTotal` | Total mensual de Únicos (footer) | — |
| Gastos Únicos | `reporte.unicos.promedioDiario` | Promedio diario del mes (footer) | — |
| Gastos Únicos | `reporte.unicos.pctVsPrev` | % de diferencia vs. mes anterior (footer) | — |
| Gastos Únicos | `reporte.unicos.inflacionMes` | Inflación IPC del mes (footer) | — |
| Gastos Únicos | `reporte.unicos.pctVsPrevAjustado` | % vs. mes anterior ajustado por inflación (footer) | — |
| Gastos en Cuotas | `reporte.cuotas.montoPorCuota` | Monto por cuota de una compra (barra) | — |
| Gastos en Cuotas | `reporte.cuotas.cantidadCuotas` | Cantidad total de cuotas del plan (barra) | — |
| Inflación vs Ingresos | `reporte.infl.inflacionMes` | Inflación IPC del mes (serie) | — |
| Inflación vs Ingresos | `reporte.infl.ingresoVarMes` | Variación % mensual del ingreso nominal (serie) | — |
| Inflación vs Ingresos | `reporte.infl.ingresoVarAjustado` | Variación % mensual del ingreso ajustada por inflación (serie) | — |

**Criterios de aceptación:**
- [ ] Un dato cruza el umbral → recibe la marca del efecto configurado; si no cruza, no cambia.
- [ ] `mes.categoria.gastoMes` es un **dato derivado** (no hay número propio renderizado): el front lo calcula y marca cada fila de la categoría cruzada.
- [ ] Un dato observado por **varios límites** que cruzan a la vez muestra **una sola marca** (la más fuerte); la descripción accesible enumera todos los límites cruzados.
- [ ] El **alcance temporal** filtra la marca: `mes en curso` solo marca el mes real de hoy; `todos los meses` marca cualquier mes navegado.
- [ ] **Cero impacto con config vacía (regla dura, RN-022):** sin límites configurados (o todos deshabilitados), cada superficie se ve **exactamente igual** que sin la feature. Ningún anclaje cambia de estilo.

---

#### RF-LIM-004 — Alerta activa (aviso al guardar un movimiento)

| Campo | Detalle |
|---|---|
| **Descripción** | Al guardar un movimiento, el sistema **proyecta** el estado resultante del mes y, si cruzaría uno o más límites de naturaleza **activa**, muestra un aviso **no bloqueante** de confirmación que enumera los cruces. El usuario decide continuar o cancelar; el guardado **nunca** se bloquea. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene al menos un límite activo habilitado sobre una key `mes.*`. |

**Alcance:** aplica a los **cuatro** formularios de carga de movimiento — único, fijo, cuota y **calculado** — en creación y edición.

**Flujo principal:**
1. El usuario completa un formulario de movimiento y presiona **Guardar**.
2. El sistema proyecta el dato post-movimiento y evalúa los límites activos.
3. **Sin cruces →** el movimiento se guarda como siempre, sin fricción (no aparece ningún aviso).
4. **Con ≥1 cruce →** el sistema muestra un aviso que enumera el/los límite(s) que se cruzarían, con acciones **"Guardar igual"** y **"Cancelar"**.

**Flujos alternativos:**
- *A1 — "Guardar igual":* el movimiento se persiste (el aviso no bloquea).
- *A2 — "Cancelar":* vuelve al formulario sin guardar.

**Keys admitidas y polaridad del operador:** la activa se acota a las **7 keys `mes.*`**. El operador se ofrece según la **polaridad** del anclaje:

| Key | Polaridad | Operadores |
|---|---|---|
| `mes.total.gasto` | techo (no superar) | `>` / `≥` |
| `mes.seccion.subtotal` | techo | `>` / `≥` |
| `mes.seccion.conteo` | techo | `>` / `≥` |
| `mes.categoria.gastoMes` | techo | `>` / `≥` |
| `mes.item.monto` | techo | `>` / `≥` |
| `mes.balance` | piso (no caer por debajo) | `<` / `≤` |
| `mes.total.ingreso` | piso (no caer por debajo) | `<` / `≤` |

**Reglas de proyección:**
- **Mes de proyección:** un **único** proyecta sobre **su** mes; un **fijo**, **cuota** o **calculado recurrente** se chequea contra el **mes en curso** (mes real de hoy).
- **Qué proyecta cada movimiento:** un **gasto** proyecta `mes.total.gasto`, `mes.balance`, el `mes.seccion.subtotal`+`mes.seccion.conteo` de **su** sección y el `mes.categoria.gastoMes` de **su** categoría (el refinamiento dispara solo si coincide con la sección/categoría del movimiento). Un **ingreso** proyecta `mes.total.ingreso` y `mes.balance`.
- **`mes.item.monto` es chequeo directo** del monto del movimiento (no acumula): aplica a **cualquier** tipo y dirección.
- **`mes.seccion.conteo`** proyecta el conteo actual de la sección **+ 1**.
- **Edición reemplaza, no suma:** se proyecta con el valor **nuevo**, excluyendo la contribución previa del movimiento editado.
- **Movimiento anulado no proyecta:** un movimiento que se guarda/edita ya anulado no dispara ningún cruce.
- **Moneda:** el monto se convierte a la moneda canónica **antes** de comparar (el umbral es número puro).

**Criterios de aceptación:**
- [ ] El aviso aparece **solo** cuando la proyección cruza ≥1 límite activo; sin cruces el guardado es idéntico al de sin la feature (cero fricción).
- [ ] El aviso **no bloquea**: "Guardar igual" persiste el movimiento, "Cancelar" vuelve al formulario.
- [ ] Se enumeran **todos** los límites activos que se cruzarían con el guardado.
- [ ] La activa solo se evalúa sobre las 7 keys `mes.*`; los datos de reportes no la disparan.
- [ ] El operador de un límite activo respeta la polaridad de su anclaje (techo `>`/`≥`, piso `<`/`≤`).
- [ ] Aplica a los cuatro formularios (único / fijo / cuota / calculado), en creación y edición.

---

#### RF-LIM-005 — Popover informativo de límites por superficie

| Campo | Detalle |
|---|---|
| **Descripción** | Cada superficie con límites cableados expone un **ícono informativo** que abre un **popover de solo lectura** con el **listado de los límites que la observan**, agrupados por naturaleza. **No marca ni avisa: informa.** No resalta ningún dato (a diferencia de la marca pasiva, RF-LIM-003) ni interrumpe el guardado (a diferencia del aviso activo, RF-LIM-004); solo enumera qué límites están mirando esa superficie, crucen o no. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene al menos un límite sobre una key cableada de la superficie. |

**Superficies con popover:** las **5 cards de `/reportes`** (una por card, sobre las keys de su tipo de reporte) y la **Vista del mes (`/mes`)** (sobre las keys `mes.*`). **No** aparece en el Dashboard: ni el resumen mensual ni el widget efímero Ingresos vs. Gastos lo montan (asimetría deliberada — el Dashboard es superficie de vistazo, sin chrome de listado).

**Condición de aparición:** el ícono se monta **solo si hay ≥1 límite** —**habilitado o no**— cuya key pertenece a la superficie. Con **cero** límites para la superficie el ícono **no se renderiza** (no reserva espacio). Que el ícono exista es, en sí, la señal de "esta superficie tiene al menos un límite observándola".

**Contenido del popover:**
- **Listado de límites** de la superficie. Cada ítem muestra el **nombre** del límite (el rótulo del usuario o, en su defecto, el rótulo de su anclaje), su **condición** (operador + umbral) y, si tiene refinamiento, la **categoría** (con su punto de color) o la **sección** que acota.
- **Agrupado por naturaleza:** los **pasivos** (marca visual, RF-LIM-003) bajo un grupo y los **activos** (aviso al guardar, RF-LIM-004) bajo otro. Como los activos solo existen sobre keys `mes.*`, el **grupo de activos aparece únicamente en `/mes`**; las cards de `/reportes` solo tienen el grupo de pasivos.
- **Límites deshabilitados incluidos, atenuados:** un límite con `enabled: false` **se lista igual** (el popover informa la config completa), atenuado y etiquetado como desactivado. No produce marca ni aviso, pero el usuario ve que existe y está apagado.
- **Alcance temporal reflejado:** un límite **pasivo** de alcance **mes en curso** se marca como tal; los de alcance "todos los meses" (default) no llevan qualifier; los activos no usan alcance temporal, así que nunca lo llevan.

**Comportamiento:**
- Es **solo lectura**: no edita ni activa/desactiva límites (eso vive en la sección Límites de Configuración, RF-LIM-002). Su única interacción son las vías de apertura y cierre.
- Abre por click/tap (y, en desktop, también por hover); cierra por click-fuera, Esc o re-clic. No bloquea el fondo.

**Criterios de aceptación:**
- [ ] El ícono aparece en las 5 cards de `/reportes` y en `/mes`, y **nunca** en el Dashboard.
- [ ] El ícono se monta **solo** con ≥1 límite (habilitado o no) para la superficie; con cero, no se renderiza.
- [ ] El popover **lista** los límites de la superficie agrupados por naturaleza; no marca ningún dato ni interrumpe ningún guardado.
- [ ] El grupo de activos aparece **solo en `/mes`**; las cards de `/reportes` solo muestran el grupo de pasivos.
- [ ] Los límites deshabilitados se listan atenuados y etiquetados como desactivados.
- [ ] Los límites pasivos de alcance "mes en curso" se marcan con su qualifier; los de "todos los meses" no; los activos nunca.
- [ ] Es solo lectura: no expone acciones de edición ni de toggle.

**Notas:**
- El **copy visible** (caption del popover, encabezados de grupo, etiqueta de deshabilitado y qualifier de alcance temporal) está fijado en `screens.md` (pantallas 4 y 7). El spec visual del ícono y el popover lo define `docs/design.md`, §Popover informativo de límites por superficie.

---

### 3.14 Módulo: Historial de cambios

El historial registra las **ediciones** y **eliminaciones** de movimientos y permite **deshacerlas**. Es una **red de seguridad de corto plazo**, no un log de auditoría: las entradas tienen una vida acotada (RF-HIST-005), deshacer no deja rastro (RF-HIST-003) y ninguna otra operación de la app se registra (RF-HIST-001).

---

#### RF-HIST-001 — Registro automático de cambios de movimientos

| Campo | Detalle |
|---|---|
| **Descripción** | El sistema registra automáticamente una **entrada de historial** por cada **edición** y cada **eliminación** de un movimiento —único, fijo (incluidos los calculados) y grupo de cuotas—. La entrada guarda el estado previo del movimiento, lo suficiente para restaurarlo. El registro es silencioso: no pide confirmación ni agrega ningún control a los flujos de edición y borrado. |
| **Actor** | Sistema |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario edita o elimina un movimiento propio. |

**Alcance — qué se registra:**

| Operación | ¿Genera entrada? |
|---|---|
| Editar un movimiento único (RF-MU-002) | Sí |
| Eliminar un movimiento único (RF-MU-003) | Sí |
| Editar un movimiento fijo o un calculado (RF-MF-003, RF-MCALC-006) | Sí |
| Eliminar un movimiento fijo o un calculado (RF-MF-004, RF-MCALC-006/009) | Sí |
| Editar un grupo de cuotas (RF-MC-003) | Sí |
| Eliminar un grupo de cuotas (RF-MC-002) | Sí |
| Crear un movimiento de cualquier tipo (RF-MU-001, RF-MF-001, RF-MC-001, RF-MCALC-001, RF-VM-008) | No |
| Anular / des-anular (RF-MU-005, RF-MF-005, RF-MC-004) | No |
| ABM de categorías (RF-CAT-*) y de métodos de pago (RF-PM-*) | No |
| Cambios de preferencias (moneda default, apariencia, reportes, límites, orden y filtros) | No |

**Identidad de la entrada — clave de agrupación por movimiento:**

| Tipo de movimiento | Clave |
|---|---|
| Único | `Transaction.id` |
| Fijo, incluido el calculado | **Identidad de cadena** del fijo (`Recurring.chainId`), **no** el id de la fila: editar un fijo parte la cadena y el id de la fila cambia (RN-005; ver `docs/backend.md`, §Movimientos fijos) |
| Cuotas | `InstallmentGroup.id` |

**Criterios de aceptación:**
- [ ] Cada edición y cada eliminación de un movimiento único, fijo (incluidos los calculados) o grupo de cuotas genera **exactamente una** entrada de historial.
- [ ] Las operaciones marcadas "No" en la tabla de alcance **no** generan entrada de ningún tipo.
- [ ] La entrada guarda el estado previo del movimiento, suficiente para restaurarlo por completo al deshacerla (RF-HIST-003), y el instante en que se registró (base del vencimiento, RF-HIST-005).
- [ ] Las entradas se **agrupan por movimiento** con la clave estable de la tabla de identidad. Para un fijo, la clave es la identidad de cadena: las ediciones sucesivas —que parten la cadena— siguen perteneciendo al mismo movimiento.
- [ ] El registro es **automático y silencioso**: el formulario de edición no expone checkbox, aviso ni opción alguna sobre el historial, y el flujo de guardado no suma pasos ni fricción.
- [ ] La **cascada** de un borrado sobre los calculados derivados del movimiento (RF-MCALC-005) **no** genera entradas propias: queda contenida en la entrada del origen y se revierte junto con ella.
- [ ] Un usuario solo registra y ve entradas de sus propios movimientos (RN-003).

---

#### RF-HIST-002 — Pantalla de historial de cambios

| Campo | Detalle |
|---|---|
| **Descripción** | La pantalla `/historial` lista las entradas de historial de **todos** los movimientos del usuario. Por cada entrada muestra de qué movimiento se trata, qué operación fue (edición o eliminación), **qué cambió** —estado anterior → estado nuevo— y expone la acción de **deshacer** (RF-HIST-003). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] La pantalla vive en la ruta `/historial` y es la **cuarta** entrada del sidebar, entre "Reportes" y "Configuración" (RF-NAV-001).
- [ ] Lista las entradas de **todos** los movimientos en una única lista cronológica, la **más reciente primero**. No se navega por mes ni por período.
- [ ] Cada entrada identifica el movimiento (nombre, tipo y categoría), la operación (**editado** / **eliminado**) y el momento del cambio.
- [ ] En una **edición**, la entrada muestra los campos que cambiaron con su **valor anterior y su valor nuevo**. En una **eliminación**, muestra el movimiento tal como estaba antes de borrarse.
- [ ] Cada entrada expone la acción **Deshacer** (RF-HIST-003); las entradas bloqueadas se listan igual, con la acción rotulada como **bloqueada** y el motivo visible (RF-HIST-004).
- [ ] La pantalla solo muestra entradas **vigentes**: las purgadas por retención (RF-HIST-005) no aparecen.
- [ ] Un movimiento **eliminado** aparece en el historial aunque no aparezca en ninguna otra superficie de la app (RF-HIST-006): el historial es la única superficie que lo expone.
- [ ] La pantalla es de **consulta y deshacer**: no edita movimientos ni ofrece acceso a su edición.

**Notas:**
- Contenido, acciones, navegación y estados completos de la pantalla en `screens.md`, §11. El detalle visual lo define `control-design` (`docs/design.md`).

---

#### RF-HIST-003 — Deshacer un cambio

| Campo | Detalle |
|---|---|
| **Descripción** | Deshacer una entrada **restaura el movimiento al estado previo** que la entrada guarda y **borra la entrada del historial**. El deshacer **no genera entrada nueva** ni se registra de ninguna forma: no queda rastro de que el cambio existió. Es deliberado — Control es un diario personal, no un log de auditoría. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | La entrada existe, está vigente y es la **más reciente** de su movimiento (RF-HIST-004). |

**Flujo principal:**
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
- [ ] Deshacer **borra la entrada** del historial y **no crea ninguna entrada nueva**: la operación de deshacer no se registra en ningún lado.
- [ ] Tras deshacer, el historial no conserva ninguna evidencia de que el cambio deshecho haya existido.
- [ ] El deshacer se confirma antes de aplicarse.
- [ ] Solo se pueden deshacer entradas de movimientos propios.

---

#### RF-HIST-004 — Orden de deshacer y entradas bloqueadas

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

#### RF-HIST-005 — Retención y purga de entradas

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

#### RF-HIST-006 — Borrado lógico de movimientos

| Campo | Detalle |
|---|---|
| **Descripción** | Eliminar un movimiento es un **borrado lógico**: el registro queda **marcado como eliminado** y **deja de aparecer en toda la app** —listados, totales, reportes, selectores— sin excepción. Sigue existiendo solo para poder restaurarlo desde el historial. Se borra **físicamente** cuando su entrada de historial se purga (RF-HIST-005). |
| **Actor** | Sistema |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario elimina un movimiento propio. |

**Criterios de aceptación:**
- [ ] Eliminar un **movimiento único** (RF-MU-003) o un **grupo de cuotas** (RF-MC-002) marca el registro como eliminado en lugar de borrarlo.
- [ ] La eliminación de un **movimiento fijo** por boundary (`deletedFrom`, RF-MF-004) ya es reversible sin borrado físico. En el **borde** en que esa eliminación borra el fijo por completo (mes visualizado anterior o igual al mes de inicio), el registro se marca como eliminado en lugar de borrarse, con el mismo tratamiento que el único y el grupo de cuotas.
- [ ] Un movimiento marcado como eliminado **no aparece en ninguna superficie de la app**: ni en la lista del mes (RF-VM-001), ni en los totales del mes y del dashboard (RF-VM-002, RF-DASH-002), ni en ningún reporte (módulo 3.9), ni en los contadores de movimientos por categoría (RF-CAT-006) o por método de pago (RF-PM-005). La **única** superficie que lo expone es `/historial` (RF-HIST-002).
- [ ] Los **movimientos calculados** que dependían del eliminado caen en cascada (RF-MCALC-005) también de forma lógica: nunca se borran físicamente mientras la entrada del origen esté vigente, por lo que **se restauran solos** al deshacerla (RF-HIST-003).
- [ ] El borrado **físico** ocurre solo al purgarse la entrada de historial de la eliminación (RF-HIST-005).
- [ ] Un movimiento marcado como eliminado **no se puede editar, anular, duplicar ni tomar como origen** de un calculado: no existe para el resto de la app.

---

## 4. Reglas de negocio

| ID | Regla |
|---|---|
| RN-001 | El monto de todo movimiento es un entero positivo mayor a cero. El tipo (`EXPENSE` / `INCOME`) define el signo semántico. Nunca se almacenan montos negativos ni cero. |
| RN-002 | Los montos se almacenan en centavos (entero). No se usan números de punto flotante para representar dinero. |
| RN-003 | Todos los recursos (movimientos, categorías) están aislados por `userId`. El backend filtra siempre por el usuario del JWT. Un usuario nunca puede ver ni modificar datos de otro. |
| RN-004 | El instante de un movimiento único (`occurredAt`) es el momento elegido por el usuario, con default "ahora". Define a qué momento/mes pertenece el movimiento. No se confunde con `createdAt` (timestamp de sistema de cuándo se creó el registro): el usuario puede elegir un instante distinto al de creación. |
| RN-005 | Editar o eliminar un movimiento fijo no modifica los meses anteriores al **mes pivote** de la operación; esos meses son inmutables. El pivote es, en ambos casos, el **mes visualizado** en la Vista del mes (`/mes`) desde el que se opera, **inclusive**: el cambio aplica desde ese mes en adelante y preserva todo mes previo a él. |
| RN-006 | Los movimientos fijos y los grupos de cuotas no generan filas individuales por mes. Se calculan on-the-fly al consultar un período. |
| RN-007 | Una categoría eliminada (soft delete) no aparece en selectores de nuevos movimientos, pero los movimientos históricos conservan la referencia a ella. |
| RN-008 | No pueden coexistir dos categorías activas con el mismo nombre para el mismo usuario. |
| RN-009 | **Moneda explícita, set curado.** La moneda es **explícita**, con un **set curado de 4 (ARS / USD / EUR / BRL)**, sin alta arbitraria. Cada movimiento lleva su `currency` (default `ARS`) y una cotización `exchangeRate` = **unidades de la default por 1 unidad de la moneda del movimiento** (Opción A; cruces no triviales derivados vía el pivote USD), `amountCents` significa centavos de la **moneda original**, y los totales se expresan en la **moneda default vigente** del usuario convirtiendo en vivo (capa de display, nunca toca lo guardado). La cotización se pre-carga desde la **tabla de referencia del mes** (RF-CUR-006), editable. Ver módulo 3.10 (RF-CUR-001..006) y `data-model.md`, §Moneda explícita, set curado. |
| RN-010 | El selector de categorías se filtra según el tipo del movimiento en curso: para `EXPENSE` se muestran categorías con scope `EXPENSE` o `BOTH`; para `INCOME` se muestran categorías con scope `INCOME` o `BOTH`. |
| RN-011 | El movimiento único representa un instante (fecha y hora). Se almacena como timestamp en UTC junto con la zona horaria original del registro (nombre IANA). Se muestra siempre en esa zona horaria original, sin importar dónde se encuentre el usuario después. El mes al que pertenece el movimiento se determina en la zona del propio registro, de forma estable. Los movimientos fijos y las cuotas no aplican esta regla: operan a nivel mes, sin día ni hora. Ver `docs/technical.md` (sección "Fechas y zonas horarias") para el detalle técnico. |
| RN-012 | Las contraseñas de las cuentas con email + contraseña se almacenan siempre **hasheadas** (bcrypt/argon2), nunca en texto plano. El hash y la verificación ocurren en el backend; el frontend nunca almacena ni compara contraseñas. Las cuentas creadas solo con Google pueden no tener contraseña. |
| RN-013 | Cada categoría tiene un color tomado de una **matriz de colores predefinidos** (40 colores). El usuario lo **elige y edita** al crear o editar la categoría; solo se aceptan colores de la matriz (sin hex libre). Al **crear**, el sistema pre-selecciona como default el color "menos usado" entre las categorías activas del usuario, calculado sobre los **8 colores base** (un subconjunto de la matriz). Las categorías por defecto del alta se asignan automáticamente. El color es de presentación únicamente: no afecta montos, scope ni ninguna regla de negocio. |
| RN-014 | Para comparar nombres de categoría a efectos de unicidad, el nombre se **normaliza**: trim de espacios, insensible a mayúsculas/minúsculas e insensible a acentos/tildes. Ej: "comida", "Comida" y "Cómida" se consideran el mismo nombre. Esta normalización aplica tanto a la detección de duplicado contra categorías **activas** (bloqueo, RN-008) como contra categorías **eliminadas** (soft delete) para proponer reactivarla (RF-CAT-002). La regla se valida en **ambas capas** —backend como fuente de verdad y frontend para UX— y ambas deben mantenerse alineadas (ver `docs/technical.md`). |
| RN-015 | Para la agregación anual de los reportes (RF-REP-001), el mes al que se imputa cada movimiento se determina con el **mismo criterio ya definido** para la Vista del mes, sin introducir una regla de zona horaria nueva: para los movimientos **únicos**, el mes se calcula en la **zona horaria propia de cada registro** (RN-011, igual que el bucketeo de `GET /movements`); para los **fijos** y las **cuotas**, que operan a nivel mes (RN-006), el mes es el de su `startMonth` `YYYY-MM` (los fijos caen en cada mes donde están activos; las cuotas, en cada mes de su tramo). Un movimiento se imputa a un año determinado solo si su mes resuelto pertenece a ese año. |
| RN-016 | **Frecuencia y anulación de movimientos fijos (RF-MF-005, RF-MF-006).** Un movimiento fijo con mes de inicio `S` y frecuencia `N` (entero 1..12, meses entre apariciones) aparece en el mes `M` si y solo si: `S <= M` **y** (`deletedFrom` es null **o** `deletedFrom > M`) **y** `monthDiff(S, M) % N === 0`. La frecuencia está **anclada al mes de inicio** (no al mes consultado). Una **anulación** `(fijo, mes)` no cambia si el fijo aparece o no según esta regla: un fijo anulado para un mes **se sigue listando** en `GET /movements` con la marca de anulado, pero su monto **no suma** a los totales del mes ni a la serie anual de los reportes. La anulación es **reversible** (toggle) y solo tiene sentido sobre meses donde el fijo efectivamente aparece según `F`. El cálculo sigue siendo on-the-fly (RN-006): no se generan filas por instancia mensual. |
| RN-017 | **Fórmula y redondeo del movimiento calculado (RF-MCALC-002).** El monto de un movimiento calculado se deriva del monto del fijo de origen **del mes en cuestión** aplicando **una** operación: un operador de `{ +, −, ×, ÷, % }` y un **operando** numérico común. El cálculo por operador es: `+` → `origen + operando`; `−` → `origen − operando`; `×` → `origen × operando`; `÷` → `origen ÷ operando`; `%` → `origen × operando ÷ 100`. El **operando 0 no se acepta** en `÷` ni en `%` (división por cero); el resto acepta cualquier operando numérico. El resultado se **redondea a centavos enteros** (`round`, mantiene RN-002): **no** se persiste ni propaga precisión sub-centavo. La presentación siempre muestra 2 decimales. El signo final lo aplica RN-018, no la fórmula. El cálculo es **on-the-fly por mes** (RN-006): el monto **no se persiste**, se deriva al vuelo del origen en cada lectura, así que sigue automáticamente cualquier cambio del origen (RF-MCALC-004). |
| RN-018 | **Signo, monto y tipo derivado del movimiento calculado — excepción a RN-001 (RF-MCALC-003).** El movimiento calculado tiene un **switch de signo** que multiplica el resultado de la fórmula por `+1` o `−1`. Por eso su `amountCents` **puede ser negativo o cero**, a diferencia de todo otro movimiento (RN-001, monto > 0). Esta excepción aplica **únicamente** a movimientos calculados; únicos, fijos "normales" y cuotas siguen exigiendo monto > 0. El `type` (`EXPENSE`/`INCOME`) **no se elige**: se **deriva del signo del monto final** —`final < 0` → `EXPENSE`; `final > 0` → `INCOME`; `final == 0` → `EXPENSE` por convención de borde (no afecta totales, RN-019)—. Así signo y tipo son siempre consistentes (positivo = ingreso, negativo = gasto). |
| RN-019 | **Imputación a totales y reportes por el tipo derivado (RF-MCALC-003).** Cada movimiento suma su **magnitud** (`\|amountCents\|`) al bucket que le corresponde **según su `type`**: un `INCOME` suma a `incomeCents`; un `EXPENSE`, a `expenseCents`. Para movimientos normales el `type` es fijo y `amountCents > 0`. Para un **calculado**, como el `type` se deriva del signo del monto (RN-018), la imputación queda siempre consistente: un calculado de monto `−2000` es `EXPENSE` (tipo derivado) y suma **2000** a `expenseCents`; uno de `+2000` es `INCOME` y suma **2000** a `incomeCents`; un monto 0 no aporta a ningún bucket. No hay restas a un bucket ni reasignación: signo y tipo nunca se contradicen. El balance del mes (`incomeCents − expenseCents`, RF-VM-002 / RF-DASH-002) y la serie anual de reportes (RF-REP-001, ambos tipos) se calculan con esta suma de magnitudes, sin lógica especial. En `by-category` (gastos apilados por categoría) la porción de la categoría de un calculado `EXPENSE` suma su magnitud, preservando la invariante "suma de porciones del mes = `expenseCents` del mes" (`docs/data-model.md`, §Contrato de serie de reportes). |
| RN-021 | **Métodos de pago (RF-PM-001..006).** Un método de pago es propio del usuario (aislado por `userId`), con **nombre**, **tipo** e **ícono**, y soft delete (el histórico conserva la referencia). El **tipo** es una allowlist en código —`CREDIT` / `DEBIT` / `CASH`— modelada como **string, no enum**, para sumar tipos futuros sin migración (estilo `CurrencyQuote.variant`); rótulos UI Crédito / Débito / Efectivo. Es **obligatorio y sin preselección** al crear. **Campos condicionales por tipo:** `CREDIT` → día de cierre y día de cobro (entero **1-31**; si excede el último día del mes se **clampea** a ese último día; **informativos**: no mueven el mes de imputación del gasto en v1); `DEBIT` y `CASH` → sin campos extra. Al **cambiar de tipo** (editable) se descartan los campos que ya no aplican. El **ícono** sale de un set curado (allowlist en código, default `card`) y es la **única identidad visual** (no hay color); una marca ausente cae a `card`. La **unicidad de nombre** es espejo de categorías (normalización RN-014, crear-o-reactivar sobre soft-deleted). La asociación a un movimiento (único / fijo / cuota) es **opcional**; un **calculado** **hereda** el método del origen y **no lo edita ni tiene uno propio** (mismo patrón que la moneda/cotización del calculado, RF-CUR-004). El método es metadato: **no** afecta totales, balance ni reportes. **Débito automático** es un atributo **del movimiento** (no del método): booleano nullable en `Transaction`, `Recurring` e `InstallmentGroup`, editable en el form solo cuando el método efectivo del movimiento es de tipo `DEBIT`. **Persistencia:** `autoDebit` se guarda como `true`/`false` **solo si** el método efectivo del movimiento es `DEBIT`; sin método o con método `CREDIT`/`CASH` se **fuerza a `null`** aunque el body pida `true`. El **calculado** **no** persiste un `autoDebit` propio: lo **hereda** del origen, derivado al vuelo (mismo tratamiento que el método/currency). Modelo en `data-model.md`, §Métodos de pago. |
| RN-022 | **Límites — naturaleza pasiva/activa y cero-impacto (RF-LIM-001..005).** Un límite es una **condición única** (`dato {operador} umbral`) sobre una key hardcodeada (de `/mes`, dashboard o reportes) con umbral **número puro, sin moneda** (no hay conversión en la evaluación), de una de dos naturalezas: **pasiva** — aplica una marca visual al dato cuando cruza el umbral (read-path, sobre datos ya renderizados; superficie cableada = `/mes`, dashboard y los 5 reportes de `/reportes`); **activa** — al guardar un movimiento, si el estado proyectado cruzaría el umbral, un aviso **no bloqueante** que enumera los cruces (write-path; solo sobre las 7 keys `mes.*`; operador por polaridad techo/piso del anclaje; aplica a los 4 forms). Ninguna naturaleza modifica montos, totales, reportes ni lo que el usuario decide persistir. La evaluación es **100% client-side**; la clave `limits` del blob es opaca al backend (igual que `theme` / `reports`). **Cero-impacto (marcas y avisos):** toda **marca pasiva** (RF-LIM-003) y todo **aviso activo** (RF-LIM-004) son **condicionales** al cruce de un límite habilitado; con la config vacía (sin límites o todos deshabilitados) no se produce ninguna marca ni aviso y cada superficie se ve y se comporta **exactamente igual** que sin la feature. El **popover informativo** (RF-LIM-005) **no es marca ni aviso** —enumera qué límites observan la superficie, sin resaltar dato ni interrumpir el guardado— y queda fuera de esta regla: su ícono disparador se monta con **≥1 límite (habilitado o no)** para esa superficie. Un dato observado por varios límites pasivos que cruzan muestra **una** marca (la más fuerte); el texto accesible enumera todos. |
| RN-023 | El monto de un movimiento no puede exceder **2.147.483.647 centavos** ($21.474.836,47), tope del entero de 32 bits con que se persiste `amountCents`. Aplica a únicos, fijos y cuotas (en cuotas, sobre el monto **por cuota**). Excederlo produce `400`. Ver `data-model.md`, §Tope de monto por movimiento. |
| RN-020 | **Anulación (skip) de movimientos únicos y cuotas (RF-MU-005, RF-MC-004).** Un movimiento **único** se anula con un **flag booleano de la propia fila** (`Transaction.skipped`, sin alcance temporal: anula el movimiento entero). Una **cuota** se anula por **mes puntual** con un registro aparte `(grupo, mes)` que cancela **solo** esa instancia mensual, dejando vivo el resto del grupo. En ambos casos la acción es un **toggle reversible** y aplica a cualquier dirección (gasto/ingreso). A efectos de totales y reportes se comportan igual que la anulación de un fijo (RN-016): el ítem anulado **se sigue listando** con marca de anulado pero su monto **no suma** a los totales del mes ni a la serie anual de los reportes. Los **calculados** derivados de un único o cuota anulado **heredan** ese estado (no tienen skip propio; RF-MCALC-005). El cálculo sigue siendo on-the-fly (RN-006). |
| RN-024 | **Alcance e identidad del historial de cambios (RF-HIST-001).** El historial registra **solo** ediciones y eliminaciones de **movimientos** —único, fijo (incluidos los calculados) y grupo de cuotas—, una entrada por operación. **No** registra creaciones, anulaciones (skip), ABM de categorías ni de métodos de pago, ni cambios de preferencias. Las entradas se **agrupan por movimiento** con una **clave estable**: `Transaction.id` para el único, la **identidad de cadena** (`Recurring.chainId`) para el fijo —**no** el id de la fila, porque editar un fijo parte la cadena y el id cambia (RN-005)— e `InstallmentGroup.id` para el grupo de cuotas. La cascada de un borrado sobre los calculados derivados (RF-MCALC-005) no genera entradas propias: viaja dentro de la entrada del origen. |
| RN-025 | **Deshacer: LIFO por movimiento y sin rastro (RF-HIST-003, RF-HIST-004).** Deshacer restaura el estado previo guardado en la entrada y **borra la entrada**. El deshacer **no genera entrada nueva** ni se registra de ninguna forma: no queda rastro de que el cambio existió (Control es un diario personal, no un log de auditoría). El orden es **secuencial LIFO por movimiento**: solo se puede deshacer la entrada **más reciente** de cada movimiento; las anteriores quedan **bloqueadas** hasta que se deshagan las posteriores. El bloqueo no cruza movimientos. Las entradas bloqueadas se listan siempre, deshabilitadas y con el motivo visible; el desbloqueo se ofrece como deshacer en cadena de los N posteriores. |
| RN-026 | **Borrado lógico de movimientos y retención (RF-HIST-005, RF-HIST-006).** Eliminar un movimiento lo **marca como eliminado** en lugar de borrarlo: deja de aparecer en **toda** la app (listados, totales, reportes, selectores y contadores) sin excepción, y su única superficie es `/historial`. Los calculados que caen en cascada con él tampoco se borran físicamente, por lo que se restauran junto con el origen al deshacer. Las entradas de historial se purgan por **dos límites, el que ocurra primero**: máximo **5 entradas por movimiento** (al sexto cambio se descarta la más antigua **de ese movimiento**) y vencimiento a los **31 días** de registrada. Al purgarse la entrada de una eliminación, el movimiento se borra **físicamente** y la eliminación es definitiva. |

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
| Reportes: otros tipos (torta, barras de comparación, etc.) | Los tipos de reporte que **sí** entran son ingresos/gastos y apilado por categoría de gastos (RF-REP-001), la grilla anual de gastos Únicos día × mes (RF-REP-010), el gantt anual de gastos en Cuotas (RF-REP-011), las líneas de Inflación vs Ingresos (RF-REP-012) y la Evolución de gastos fijos (RF-REP-013). Sumar nuevos tipos de reporte queda fuera de alcance: es una mini-fase futura que requiere definición de UX y no es bloqueante |
| Métodos de pago v2 — imputación por cierre de tarjeta, proyección de resúmenes, "cuándo cae el cobro" | En v1 el método de pago es metadato y los días de cierre/cobro son **informativos** (RN-021): no mueven el mes de imputación del gasto. Imputar el gasto de crédito al mes del resumen de la tarjeta, proyectar resúmenes y calcular cuándo cae el cobro quedan fuera de v1 (requieren flujo propio) |
| Edición retroactiva de mes pasado de un fijo | Complejidad en el modelo de datos |
| Cancelación parcial de cuotas restantes | Pendiente de definición |
| Ingreso en cuotas | Existe en la realidad; pendiente de definición |
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
| Anulación (skip) de un fijo | Marca que cancela la aparición de un movimiento fijo en un **mes puntual**, sin eliminar el fijo. Reversible (toggle). El mes anulado se sigue mostrando pero no suma a los totales. Distinta de `deletedFrom`. Ver RF-MF-005, RN-016. |
| Balance | Resultado de ingresos − gastos en un período. Puede ser positivo o negativo. |
| Categoría | Clasificador asignado a cada movimiento. Personalizable por usuario. |
| Cuota | Instancia mensual de un grupo de cuotas. Representa un pago parcial de una compra dividida. |
| `deletedFrom` | Primer día del mes desde el cual un movimiento fijo deja de aparecer. Si es `null`, el fijo sigue activo. |
| Borrado lógico (de un movimiento) | Eliminación que **marca** el movimiento como eliminado sin borrarlo: deja de aparecer en toda la app y solo se expone en `/historial`, desde donde se puede restaurar. El borrado físico ocurre al purgarse su entrada de historial. Ver RF-HIST-006, RN-026. |
| Entrada de historial | Registro de **una** edición o eliminación de un movimiento. Guarda el estado previo, permite deshacerlo y se purga por cantidad (5 por movimiento) o antigüedad (31 días). Ver RF-HIST-001, RF-HIST-005. |
| Frecuencia (de un fijo) | Periodicidad de aparición de un movimiento fijo, un **entero 1..12** = meses entre apariciones (1 Mensual … 12 Anual). Anclada al mes de inicio. Default 1 (mensual). Inmutable tras crearse. Ver RF-MF-006, RN-016. |
| Gasto (`EXPENSE`) | Egreso de dinero. Reduce el balance del mes. |
| Grupo de cuotas | Registro padre que define monto por cuota, cantidad total de cuotas y mes de inicio. |
| Historial de cambios | Registro de corto plazo de las ediciones y eliminaciones de movimientos, con la acción de **deshacer** (LIFO por movimiento, sin dejar rastro). Vive en `/historial`. No es un log de auditoría. Ver módulo 3.14 (RF-HIST-001..006), RN-024/025/026. |
| Ingreso (`INCOME`) | Entrada de dinero. Aumenta el balance del mes. |
| Límite | Preferencia del usuario que observa un dato (de `/mes`, dashboard o reportes, vía una key hardcodeada), lo compara contra un umbral con una condición única y, si se cumple, dispara su efecto: una **marca visual pasiva** o una **alerta activa** (aviso no bloqueante al guardar un movimiento, solo sobre keys `mes.*`). No altera datos, totales ni lo que el usuario persiste. Se gestiona en la solapa Límites de `/configuracion`; persiste en el blob (`limits`), evaluado client-side. Ver módulo 3.13 (RF-LIM-001..004) y RN-022. |
| Mes activo | Mes actualmente visualizado en la vista del mes. Por defecto, el mes corriente. |
| Método de pago | Metadato opcional de un movimiento: con qué se pagó/cobró (tarjeta de crédito, débito, efectivo). Entidad propia del usuario, espejo de Categoría (soft delete, gestor dedicado como sección de Configuración, contador de movimientos), con identidad visual por **ícono** (no color). Días de cierre/cobro (crédito) son informativos en v1. Ver módulo 3.6.b (RF-PM-001..006) y RN-021. |
| Movimiento | Registro de una transacción económica. Puede ser único, fijo o una cuota. |
| Movimiento calculado | Movimiento **fijo** cuyo monto no se ingresa: se deriva al vuelo del monto de un movimiento de origen mediante una fórmula (operador + operando) con signo. El **origen puede ser un fijo, un único o un grupo de cuotas** (RF-MCALC-008); el calculado espeja la cadencia del origen (de cuota deriva del monto por cuota). Tiene categoría y descripción propias; su **tipo (Gasto/Ingreso) se deriva del signo del monto** (negativo → Gasto, positivo → Ingreso). Puede tener monto negativo o cero. Sigue el ciclo de vida del origen; el calculado de único/cuota se borra de forma total (RF-MCALC-009). Ver submódulo 3.4.b (RF-MCALC-001..010), RN-017/018/019. |
| Identidad de cadena de un fijo | Identificador estable, compartido por todas las filas `Recurring` de un mismo fijo lógico, que sobrevive a los splits del pasado. Es a lo que se vincula un movimiento calculado (no a una fila puntual). Ver `docs/data-model.md`, §Identidad de cadena estable. |
| Modo de color | Modo claro u oscuro de la app, elegible desde el chrome global (sidebar) entre **Sistema** (default, sigue al dispositivo), **Claro** y **Oscuro**. Persiste por usuario en el blob de preferencias (`theme`). Ver RF-APP-001. |
| Movimiento fijo | Plantilla recurrente mensual activa hasta que el usuario la elimina. Sin día específico dentro del mes. |
| Movimiento único | Movimiento que ocurrió en un instante específico (fecha y hora), una sola vez. Se almacena en UTC junto con su zona horaria original; ver RN-011. |
| Scope de categoría | Indica a qué tipo de movimiento aplica la categoría: `BOTH`, `EXPENSE`, o `INCOME`. |
| Soft delete | Eliminación lógica: el registro se marca con `deletedAt` pero no se borra físicamente. |
| `startMonth` | Primer día del mes a partir del cual un movimiento fijo o grupo de cuotas comienza a aparecer. |
