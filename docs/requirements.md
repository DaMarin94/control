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
| 1.1.1 | 2026-06-16 | Fijos extendidos: anulación por mes puntual (RF-MF-005) y periodicidad (RF-MF-006); nueva RN-016. Fase 1.1.1. |
| 1.1.2 | 2026-06-16 | Color de categoría editable: el usuario elige/edita el color desde una matriz de 70 colores (reabre RF-CAT-005, RN-013; ajusta RF-CAT-002/003). Fase 1.1.2. |
| 1.1.4 | 2026-06-16 | Vista del mes: secciones colapsables + reordenables, persistidas por usuario; las 3 secciones siempre visibles con empty inline (nuevo RF-VM-005; ajusta RF-VM-001). Fase 1.1.4. |
| 1.1.5 | 2026-06-16 | Reportes configurables: módulo "Gráfico anual" → "Reportes" (RF-GRA-001/002/003 → RF-REP-001..005); pantalla `/reportes` configurable por cards; widget de reporte autónomo con año y filtro de categorías embebidos; reapertura de la navegación del dashboard (ajusta RF-DASH-001/002, RF-NAV-001, RN-015). Fase 1.1.5. |
| 1.1.6 | 2026-06-17 | Filtro por categoría en la Vista del mes: control por pantalla, persistido por usuario, default todas, tres estados (nuevo RF-VM-006). Unifica el estado "ninguna" del filtro: destildar todas = lista/serie en cero, en `/mes` y en `/reportes` (ajusta RF-REP-002/005). Fase 1.1.6. |

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
- [ ] El **resumen financiero del dashboard** (tarjetas Gastos/Ingresos + balance, RF-DASH-002) muestra **siempre el mes actual** — no tiene navegación entre meses.
- [ ] La **única navegación de período del dashboard** vive en el **widget de reporte Ingresos vs. Gastos** que monta (RF-REP-002): ese widget navega **año** de forma independiente y activa, sin afectar el resumen mensual, que sigue fijo en el mes en curso. (Reabre la decisión de v1.0 "el dashboard no navega" — ver bitácora 2026-06-16.)
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
- [ ] El resumen mensual **permanece fijo en el mes en curso** aun cuando el usuario navegue años en el widget de reporte del dashboard (RF-REP-002): la navegación del widget es por **año** y **no** mueve estas tarjetas (ver bitácora 2026-06-16).

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
- [ ] La restricción de opciones de scope aplica **únicamente** en modo inline (modal abierto desde el formulario de carga). Cuando el modal se abre desde su lugar normal en `/categorias`, sigue ofreciendo las tres opciones (Gasto / Ingreso / Ambos) con default "Ambos".
- [ ] Al crear la categoría con éxito, el modal se cierra y la categoría recién creada queda autoseleccionada en el campo categoría del formulario de carga.
- [ ] Si la creación choca con una categoría eliminada, se reutiliza el prompt de reactivación (RF-CAT-002 A3); al reactivar, la categoría reactivada queda autoseleccionada en el campo categoría.
- [ ] Cancelar el modal de categoría no crea ni reactiva nada y devuelve el foco al formulario de carga sin alterar sus datos ni su categoría seleccionada.
- [ ] La autoselección respeta el filtrado por scope del selector de categorías (RN-010): el selector del formulario solo ofrece categorías compatibles con el tipo del movimiento en curso. Como en modo inline el scope nunca puede quedar en el tipo opuesto, la categoría creada/reactivada siempre es compatible y la autoselección siempre funciona; no existe el caso de una categoría "fantasma" que el selector filtre.

**Notas:**
- Es un cambio **solo de frontend**. No se agrega ni modifica ningún endpoint ni contrato de API: se reutilizan el modal de creación de categoría (RF-CAT-002), el flujo crear-o-reactivar y la validación de unicidad ya existentes. La categoría creada/reactivada ya está disponible en el listado de categorías que alimenta el selector del formulario (RF-CAT-002: "disponible inmediatamente en los selectores").
- **Caso borde — scope incompatible (RESUELTO 2026-06-13):** se elimina de raíz restringiendo las opciones de scope en modo inline. El campo "Tipo" del modal, cuando se abre desde el formulario de carga, **no ofrece el tipo opuesto** al del movimiento en curso (solo el tipo exacto y "Ambos"). Así el usuario no puede crear una categoría incompatible y la autoselección posterior siempre es válida; no hace falta lógica de aviso, bloqueo ni manejo del caso "fantasma". Esta restricción aplica **solo** en modo inline; el modal abierto desde `/categorias` mantiene las tres opciones con default "Ambos".

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
- [ ] La acción de anular / des-anular está disponible **solo en los ítems fijos** de `/mes`; los movimientos únicos y las cuotas no la tienen.
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
| **Descripción** | Al crear un movimiento fijo, el usuario elige su **frecuencia** de aparición de un set cerrado: **mensual (default), bimestral, trimestral, semestral, anual**. La frecuencia está **anclada al mes de inicio** y define en qué meses aparece el fijo. No se puede cambiar después de creado. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. Existe al menos una categoría disponible. |

**Flujo principal:**
1. El usuario carga un movimiento fijo (RF-MF-001) y, además del mes de inicio, selecciona una **frecuencia**.
2. El sistema crea el fijo con esa frecuencia.
3. El fijo aparece en su mes de inicio y luego en cada mes que dicta la frecuencia, anclada al mes de inicio.

**Criterios de aceptación:**
- [ ] La frecuencia es un **set cerrado** de 5 valores: **mensual, bimestral, trimestral, semestral, anual**. No hay frecuencias libres ni personalizadas.
- [ ] El **default** al crear es **mensual**.
- [ ] La frecuencia está **anclada al mes de inicio**: un fijo bimestral que arranca en marzo aparece en marzo, mayo, julio, etc.; uno trimestral que arranca en enero aparece en enero, abril, julio, octubre; y así con los demás pasos (mensual = cada mes, bimestral = cada 2 meses, trimestral = cada 3, semestral = cada 6, anual = cada 12).
- [ ] Un fijo aparece en un mes solo si, además de estar activo en el rango (RF-MF-002), ese mes cae en su frecuencia respecto del mes de inicio.
- [ ] La frecuencia **no es editable** después de creado el fijo (igual que el tipo): el formulario de edición la muestra de solo lectura. Cambiar la cadencia de un fijo equivale a crear otro.
- [ ] **Back-compat:** todos los movimientos fijos existentes antes de esta capacidad quedan como **mensuales**.
- [ ] El cálculo de qué fijo cae en cada mes sigue siendo **on-the-fly** (RN-006): no se generan filas por instancia mensual.

**Notas:**
- El detalle visual del selector de frecuencia y de la etiqueta de frecuencia en el ítem del mes lo define `control-design` (`docs/design.md`).
- La regla de cálculo de la frecuencia está formalizada en RN-016. La anulación de un mes puntual (RF-MF-005) opera sobre **una** de las apariciones que dicta la frecuencia.

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

> **Nota:** En v1, las cuotas son **solo Gasto (`EXPENSE`)**. El "Ingreso en cuotas" está **fuera de alcance v1** (ver sección 6) — ver bitácora 2026-06-09 (resolución del conflicto de la spec, opción A). Por lo tanto, donde el paso 2 del flujo dice "selecciona Gasto o Ingreso", en v1 aplica únicamente Gasto: el selector de tipo **no se ofrece** en el tab Cuotas. El texto del flujo se conserva tal cual para una versión futura que incorpore "Ingreso en cuotas".
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

> **Nota:** El tipo (Gasto/Ingreso) no es editable: en v1 las cuotas son **solo Gasto** (ver nota en RF-MC-001 y bitácora 2026-06-09).

---

### 3.6 Módulo: Categorías

Las categorías clasifican los movimientos. Son personalizables por usuario y tienen un scope que define a qué tipo de movimiento aplican, y un color que el usuario elige y edita desde una matriz de colores predefinidos (v1.1, fase 1.1.2).

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
- [ ] La gestión de categorías (crear, editar, eliminar y listar) vive en una pantalla separada y dedicada, accesible desde el link "Categorías" del sidebar (RF-NAV-001). No es un modal ni una sección embebida en otra pantalla.

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
- [ ] El nombre, el scope y el **color** son editables (color: ver RF-CAT-005; editable desde v1.1, fase 1.1.2).
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

> **REABIERTO en v1.1 (Fase 1.1.2, 2026-06-16).** En v1.0 este RF definía el color como **asignado automáticamente y NO editable**. v1.1 lo reabre: el usuario **elige y edita** el color desde una matriz de colores. Lo que sigue es la definición vigente; el criterio v1.0 (no editable) queda derogado (ver bitácora 2026-06-16).

| Campo | Detalle |
|---|---|
| **Descripción** | Cada categoría tiene un color que el usuario **elige y puede editar**, tanto al crear como al editar la categoría, desde una **matriz de colores predefinidos**. El color identifica visualmente a la categoría en la UI. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Baja |
| **Precondiciones** | Se crea o edita una categoría. |

**Matriz de colores:** el color se elige de una **matriz fija de 70 colores** (7 tonalidades × 10 hues, estilo Office). **No** hay ingreso de hex libre: solo colores que pertenezcan a la matriz. (Definición de la matriz y de la fila base en `docs/data-model.md`, "Pool de colores".)

**Criterios de aceptación:**
- [ ] Al **crear** una categoría, el usuario puede elegir su color de la matriz de 70 colores.
- [ ] El sistema **pre-selecciona** un color por defecto al abrir el alta: el color **"menos usado"** entre las categorías activas del usuario, calculado sobre los 10 colores base (RN-013). El usuario puede dejar ese default o elegir otro de la matriz.
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
- [ ] La lista está agrupada por tipo en tres secciones separadas y rotuladas, **Únicos**, **Fijos**, **Cuotas** (orden default; reordenable por el usuario, RF-VM-005). Dentro de cada sección, los movimientos se ordenan por **monto descendente** (`amountCents` DESC: el monto más alto primero, por magnitud, sin distinguir gasto de ingreso). Ante montos iguales, el desempate estable es por sección: Únicos por instante (fecha y hora) descendente; Fijos por fecha de creación descendente; Cuotas por identificador ascendente. El reordenamiento aplica **solo a las secciones entre sí**, nunca a los ítems dentro de una sección (RF-VM-005).
- [ ] Las **tres secciones se muestran siempre**, aunque estén vacías (cambio respecto de v1.0 — ver bitácora 2026-06-16). Una sección sin movimientos muestra su cabecera completa (rótulo, contador en 0, subtotal en $0) y un mensaje de estado vacío inline propio ("Sin movimientos únicos" / "Sin fijos" / "Sin cuotas").
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
- [ ] Los ítems **dentro** de cada sección NO se reordenan: siguen el orden por monto descendente de RF-VM-001.
- [ ] El estado colapsado/expandido de cada sección y el orden de las secciones se **persisten por usuario** vía las preferencias (1.1.0); sobreviven a la navegación y al cierre de sesión. Shape de la clave de preferencias en `docs/data-model.md` (`monthSections`).
- [ ] En modo orden, el botón "+ Nuevo movimiento" se deshabilita y el colapsar/expandir queda suspendido (la cabecera arrastra en lugar de colapsar). No hay acción de "cancelar": el orden se aplica en vivo.

---

#### RF-VM-006 — Filtro por categoría de la vista del mes

| Campo | Detalle |
|---|---|
| **Descripción** | La vista del mes ofrece un filtro por categoría que restringe la lista y los totales del mes a las categorías seleccionadas. Es un control **por pantalla** (no por mes): la selección se mantiene al navegar entre meses y se persiste por usuario. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario está en la vista del mes. |

**Flujo principal:**
1. La vista del mes expone un control de filtro de categorías (mismo control que el widget de reporte, RF-REP-002).
2. El usuario abre el filtro y selecciona el subconjunto de categorías que quiere ver.
3. La lista y los totales del mes se recalculan al instante para reflejar solo las categorías seleccionadas.

**Tres estados del filtro:**
- **Todas** (default): sin filtro; se muestran todos los movimientos del mes.
- **Subconjunto:** solo se muestran (y suman a los totales) los movimientos de las categorías tildadas.
- **Ninguna** (todas destildadas): la lista queda **vacía** y los totales en **cero**.

**Criterios de aceptación:**
- [ ] El filtro afecta **tanto la lista como los totales** del mes: ambos se recalculan según la selección.
- [ ] El default es **todas las categorías** (sin filtro).
- [ ] La selección **se mantiene al navegar entre meses** (es por pantalla, no por mes) y se **persiste por usuario** vía las preferencias (1.1.0), clave `monthCategoryFilter` (shape en `docs/data-model.md`); sobrevive a la navegación y al cierre de sesión.
- [ ] El estado **"ninguna"** (todas destildadas) deja la **lista vacía y los totales en cero** (igual que el filtro de `/reportes`, RF-REP-002).
- [ ] Con "todas" (sin filtro) se siguen mostrando movimientos cuya categoría fue eliminada (soft delete, RF-CAT-004 / RF-VM-002); con un subconjunto, solo entran las categorías seleccionadas.
- [ ] El filtro **no es global:** no afecta a otras pantallas (dashboard ni reportes tienen su propio estado de filtro, independiente de este).
- [ ] El filtro reutiliza el control de categorías del widget de reporte (RF-REP-002), sin un control visual nuevo.

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
- **Links de navegación** (en este orden):
  - **Dashboard** — lleva al dashboard (RF-DASH-001).
  - **Vista del mes** — lleva a la vista del mes (RF-VM-001), abierta en el mes actual.
  - **Reportes** — lleva a la pantalla de reportes configurable (`/reportes`, RF-REP-003).
  - **Categorías** — lleva a la gestión de categorías (módulo 3.6).
- **Botón "Nuevo movimiento"** (acción primaria): abre el formulario de carga de movimiento (RF-CM-001).
- **Menú de usuario** (parte inferior): representado por el avatar del usuario. Al activarlo, despliega la opción **"Cerrar sesión"** (RF-AUTH-004).

**Criterios de aceptación:**
- [ ] El sidebar está presente en todas las pantallas accesibles con sesión activa.
- [ ] El sidebar no se muestra en la pantalla de login ni en otras pantallas no autenticadas.
- [ ] El logo/nombre "Control" lleva al dashboard.
- [ ] Los links Dashboard, Vista del mes, Reportes y Categorías navegan a sus respectivas pantallas, en ese orden.
- [ ] El link "Vista del mes" abre la vista en el mes actual.
- [ ] El link "Reportes" lleva a `/reportes` (RF-REP-003) y se ubica entre "Vista del mes" y "Categorías".
- [ ] El botón "Nuevo movimiento" abre el formulario de carga (RF-CM-001) desde cualquier pantalla, cumpliendo el límite de 2 interacciones (RNF-003).
- [ ] El sidebar indica visualmente cuál es la sección activa.
- [ ] El menú de usuario se ubica en la parte inferior del sidebar y muestra el avatar del usuario.
- [ ] La opción "Cerrar sesión" vive dentro del menú de usuario y dispara el flujo de RF-AUTH-004.

**Notas:**
- Este RF cubre la decisión sobre RF-AUTH-004 (cierre de sesión disponible "desde cualquier pantalla"): el punto de acceso al cierre de sesión es el menú de usuario del sidebar.

---

### 3.9 Módulo: Reportes

El módulo de Reportes visualiza los movimientos del usuario a lo largo de un año, mes a mes. El eje X son los 12 meses del año; el eje Y es el monto. Ofrece **dos tipos de reporte** —ingresos vs. gastos por mes, y gastos por categoría apilados— implementados como un **widget de reporte autónomo, configurable por props**, que lleva embebidos su propia navegación de año y su propio filtro de categorías. La pantalla `/reportes` es **configurable**: el usuario arma su vista agregando y quitando **cards de reporte**; el dashboard monta una sola instancia del widget (ver RF-DASH-001/002).

> **Nota de renombre (fase 1.1.5):** este módulo era "Gráfico anual" (RF-GRA-001/002/003) en v1.0. Se renombró a "Reportes" (RF-REP-001..005) y la pantalla dedicada `/anual` pasó a ser la pantalla configurable `/reportes`. La **mecánica de datos no cambió** (serie de 12 meses de un año, Forma 1 = ingresos vs. gastos, Forma 2 = gastos por categoría apilado). Las bitácoras 2026-06-14 y 2026-06-15 que mencionan RF-GRA / `/anual` son registro histórico de v1.0; el estado vigente es el de esta sección. Ver bitácora 2026-06-16.

> **Alcance v1.1:** solo los dos tipos de reporte descritos en RF-REP-001 (ingresos/gastos y apilado por categoría de gastos). Otros tipos de reporte/gráfico (torta, barras, línea) quedan fuera de alcance (ver sección 6) y se evalúan como mini-fase futura.

---

#### RF-REP-001 — Tipos de reporte disponibles

| Campo | Detalle |
|---|---|
| **Descripción** | El módulo ofrece **dos tipos de reporte** sobre los 12 meses de un año (eje X: los meses del año; eje Y: monto): (Forma 1) ingresos vs. gastos por mes, y (Forma 2) gastos del mes descompuestos por categoría. Son los únicos tipos de v1.1; sumar tipos nuevos es una mini-fase futura, fuera de alcance. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Tipos de reporte:**

- **Forma 1 — Ingresos vs. Gastos** (`income-expense`). Dos series por mes a lo largo del año: el **total de ingresos** del mes y el **total de gastos** del mes. Cada mes del eje X tiene su par de valores (ingresos, gastos). Los totales por mes suman los tres tipos de movimiento que caen en el mes (únicos + fijos activos + cuotas), con el mismo criterio que los totales de la Vista del mes (RF-VM-002) y el Dashboard (RF-DASH-002).
- **Forma 2 — Gastos por categoría (apilado)** (`by-category`). Toma el **total de gastos** de cada mes y lo descompone en bandas apiladas, una por **categoría**, cada una con el **color propio de su categoría** (RF-CAT-005 / RN-013). Las bandas de un mes se apilan y suman exactamente el total de gastos de ese mes (el mismo valor que la serie "gastos" de la Forma 1). **La Forma 2 es solo de gastos** (`EXPENSE`): los ingresos no se descomponen por categoría en este reporte; viven únicamente en la Forma 1.

**Criterios de aceptación:**
- [ ] El módulo ofrece exactamente **dos tipos de reporte**: `income-expense` (Forma 1) y `by-category` (Forma 2). No hay tipos adicionales en v1.1.
- [ ] El eje X representa los 12 meses del año configurado; el eje Y representa el monto.
- [ ] Los **12 meses están siempre presentes** en el eje X; un mes sin datos se grafica en **cero** (no se omite ni deja hueco). Esto incluye los meses futuros del año en curso, que también se muestran en cero salvo lo que proyecten los fijos activos y las cuotas en tramo (RN-006). La representación visual concreta de un mes en cero la define `control-design`.
- [ ] La Forma 1 muestra, por mes, el total de ingresos y el total de gastos del mes; ambos totales suman únicos + fijos activos + cuotas del mes (mismo criterio que RF-VM-002).
- [ ] La Forma 2 muestra, por mes, el total de gastos del mes descompuesto en bandas apiladas por categoría, cada banda con el color de su categoría; la suma de las bandas de un mes iguala el total de gastos de ese mes.
- [ ] La Forma 2 considera **solo gastos** (`EXPENSE`); los ingresos no aparecen descompuestos por categoría.
- [ ] En v1.1 la Forma 2 muestra **una banda por cada categoría con gasto, sin agrupar ni colapsar** ninguna en una banda "Otras"; no hay tope de categorías visibles. La agrupación "Otras" para la cola de categorías queda como candidato futuro.
- [ ] Los colores de las bandas de la Forma 2 son los colores ya asignados a cada categoría (RF-CAT-005); el reporte no inventa ni reasigna colores.
- [ ] El mes al que pertenece cada movimiento, para la agregación anual, se determina con el mismo criterio de zona horaria ya definido (RN-015): la zona propia de cada registro para los únicos, y el `startMonth` `YYYY-MM` para fijos y cuotas.
- [ ] Un movimiento cuya categoría fue eliminada (soft delete) sigue contando en los totales y, en la Forma 2, sigue apareciendo bajo su categoría con su color (consistente con RF-CAT-004 / RF-VM-002).

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

- **Tipo de reporte.** `income-expense` (Forma 1) o `by-category` (Forma 2). Define qué visualización monta la instancia.
- **Año a mostrar.** Define el año cuyos 12 meses se grafican. La navegación de año (flechas de 1.1.3, embebidas en el widget) está **siempre activa** e **independiente por instancia**: cambiar el año de un widget no afecta a ningún otro. Límites de navegación: hacia atrás el control ‹ se deshabilita antes del **primer año con CUALQUIER movimiento del usuario** (`earliestYear`, no afectado por el filtro de categorías — ver RF-REP-005); hacia adelante se **bloquean los años futuros** (máximo navegable: el año en curso).
- **Categorías seleccionadas (filtro).** Subconjunto de categorías del usuario que el reporte considera; default **todas**. El checklist ofrece el **universo de categorías del usuario** (no solo las que tienen gasto), porque el filtro aplica también a la Forma 1 (a qué categorías cuentan los totales de ingresos y de gastos). En la Forma 2 además determina qué bandas se apilan. El filtro tiene **tres estados**: **todas** (default, sin filtro), **subconjunto** (solo las tildadas) y **ninguna** (todas destildadas) → la serie se grafica en **cero** (igual que el filtro de `/mes`, RF-VM-006). *(Ajuste 1.1.6: hasta 1.1.5 destildar todas se colapsaba a "sin filtro" y mostraba todas; ahora "ninguna" muestra la serie en cero — ver bitácora 2026-06-17.)*
- **Persistencia (modo).** Define qué hace la instancia con sus cambios de año y de filtro:
  - **Persistida** — en `/reportes`: cada cambio de año y de filtro de la card se persiste en la clave `reports` de preferencias (RF-REP-004).
  - **Efímera** — en el dashboard: el año y el filtro son de sesión; **no** se persisten (al recargar, el widget vuelve a su estado inicial — año en curso, todas las categorías). Ver RF-DASH-001/002.

**Criterios de aceptación:**
- [ ] El widget es un componente reutilizable; tipo, año, categorías seleccionadas y modo de persistencia se controlan por props, no por lógica interna distinta en cada pantalla.
- [ ] La navegación de año está **embebida en el widget** y es **independiente por instancia**: mover el año de una instancia no mueve el de ninguna otra (no hay control de año compartido).
- [ ] El filtro de categorías está **embebido en el widget** y ofrece el **universo de categorías del usuario** (no solo las que tienen gasto); el default es **todas seleccionadas**.
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
- [ ] La pantalla es accesible desde el sidebar (RF-NAV-001) con el link **"Reportes"**, ubicado **debajo de "Vista del mes"** (orden: Dashboard → Vista del mes → Reportes → Categorías).
- [ ] La definición funcional completa (contenido, acciones, navegación y estados) vive en `docs/screens.md`. El detalle visual (layout, tamaños, colores, comportamiento de las flechas embebidas) lo define `control-design`.

---

#### RF-REP-004 — Persistencia de las cards de reporte

| Campo | Detalle |
|---|---|
| **Descripción** | La configuración de las cards de `/reportes` se persiste por usuario mediante el mecanismo de preferencias (fase 1.1.0), en una clave nueva `reports`. Cada card persiste su **tipo + año + categorías seleccionadas**; el **orden del array es el orden de despliegue**. La normalización y el shape concreto los define el front (igual que `monthSections`): el backend no conoce ni valida esta clave. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. El mecanismo de preferencias (1.1.0) está disponible. |

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
- [ ] Acepta el año y un **filtro de categorías** como query param que distingue **tres estados**: **ausente = todas**, **presente y vacío = ninguna** (serie en cero), **lista = subconjunto** (contrato exacto en `docs/data-model.md`). *(Ajuste 1.1.6: el estado "presente y vacío = ninguna" reemplaza el colapso previo de vacío → todas — ver bitácora 2026-06-17.)*
- [ ] El filtro afecta a **ambas formas**: en la Forma 1, qué categorías cuentan en los totales de ingresos y de gastos por mes; en la Forma 2, qué bandas por categoría se incluyen.
- [ ] El campo **`earliestYear` NO se ve afectado por el filtro**: siempre refleja el primer año con CUALQUIER movimiento del usuario, para que los límites de navegación de año (RF-REP-002) no salten al filtrar.
- [ ] La respuesta mantiene el shape `{ year, months, categories, earliestYear }`, con `months` y `categories` filtrados al set pedido (`earliestYear` no).
- [ ] El endpoint filtra siempre por el `userId` del JWT (RNF-002).

---

## 4. Reglas de negocio

| ID | Regla |
|---|---|
| RN-001 | El monto de todo movimiento es un entero positivo mayor a cero. El tipo (`EXPENSE` / `INCOME`) define el signo semántico. Nunca se almacenan montos negativos ni cero. |
| RN-002 | Los montos se almacenan en centavos (entero). No se usan números de punto flotante para representar dinero. |
| RN-003 | Todos los recursos (movimientos, categorías) están aislados por `userId`. El backend filtra siempre por el usuario del JWT. Un usuario nunca puede ver ni modificar datos de otro. |
| RN-004 | El instante de un movimiento único (`occurredAt`) es el momento elegido por el usuario, con default "ahora". Define a qué momento/mes pertenece el movimiento. No se confunde con `createdAt` (timestamp de sistema de cuándo se creó el registro): el usuario puede elegir un instante distinto al de creación. |
| RN-005 | Editar o eliminar un movimiento fijo no modifica los meses anteriores al **mes pivote** de la operación; esos meses son inmutables. El pivote es, en ambos casos, el **mes visualizado** en la Vista del mes (`/mes`) desde el que se opera, **inclusive**: el cambio aplica desde ese mes en adelante y preserva todo mes previo a él (ver bitácora 2026-06-13). |
| RN-006 | Los movimientos fijos y los grupos de cuotas no generan filas individuales por mes. Se calculan on-the-fly al consultar un período. |
| RN-007 | Una categoría eliminada (soft delete) no aparece en selectores de nuevos movimientos, pero los movimientos históricos conservan la referencia a ella. |
| RN-008 | No pueden coexistir dos categorías activas con el mismo nombre para el mismo usuario. |
| RN-009 | En v1 no hay campo de moneda. El sistema opera sobre una moneda implícita. El diseño permite agregar `currency` en el futuro sin romper datos existentes. |
| RN-010 | El selector de categorías se filtra según el tipo del movimiento en curso: para `EXPENSE` se muestran categorías con scope `EXPENSE` o `BOTH`; para `INCOME` se muestran categorías con scope `INCOME` o `BOTH`. |
| RN-011 | El movimiento único representa un instante (fecha y hora). Se almacena como timestamp en UTC junto con la zona horaria original del registro (nombre IANA). Se muestra siempre en esa zona horaria original, sin importar dónde se encuentre el usuario después. El mes al que pertenece el movimiento se determina en la zona del propio registro, de forma estable. Los movimientos fijos y las cuotas no aplican esta regla: operan a nivel mes, sin día ni hora. Ver `docs/technical.md` (sección "Fechas y zonas horarias") para el detalle técnico. |
| RN-012 | Las contraseñas de las cuentas con email + contraseña se almacenan siempre **hasheadas** (bcrypt/argon2), nunca en texto plano. El hash y la verificación ocurren en el backend; el frontend nunca almacena ni compara contraseñas. Las cuentas creadas solo con Google pueden no tener contraseña. |
| RN-013 | Cada categoría tiene un color tomado de una **matriz de colores predefinidos** (70 colores). Desde v1.1 (fase 1.1.2) el usuario lo **elige y edita** al crear o editar la categoría; solo se aceptan colores de la matriz (sin hex libre). Al **crear**, el sistema pre-selecciona como default el color "menos usado" entre las categorías activas del usuario, calculado sobre los **10 colores base** (la fila base de la matriz). Las categorías por defecto del alta se asignan automáticamente. El color es de presentación únicamente: no afecta montos, scope ni ninguna regla de negocio. (En v1.0 el color era no editable; reabierto en la fase 1.1.2 — ver bitácora 2026-06-16.) |
| RN-014 | Para comparar nombres de categoría a efectos de unicidad, el nombre se **normaliza**: trim de espacios, insensible a mayúsculas/minúsculas e insensible a acentos/tildes. Ej: "comida", "Comida" y "Cómida" se consideran el mismo nombre. Esta normalización aplica tanto a la detección de duplicado contra categorías **activas** (bloqueo, RN-008) como contra categorías **eliminadas** (soft delete) para proponer reactivarla (RF-CAT-002). La regla se valida en **ambas capas** —backend como fuente de verdad y frontend para UX— y ambas deben mantenerse alineadas (ver `docs/technical.md`). |
| RN-015 | Para la agregación anual de los reportes (RF-REP-001), el mes al que se imputa cada movimiento se determina con el **mismo criterio ya definido** para la Vista del mes, sin introducir una regla de zona horaria nueva: para los movimientos **únicos**, el mes se calcula en la **zona horaria propia de cada registro** (RN-011, igual que el bucketeo de `GET /movements`); para los **fijos** y las **cuotas**, que operan a nivel mes (RN-006), el mes es el de su `startMonth` `YYYY-MM` (los fijos caen en cada mes donde están activos; las cuotas, en cada mes de su tramo). Un movimiento se imputa a un año determinado solo si su mes resuelto pertenece a ese año. |
| RN-016 | **Frecuencia y anulación de movimientos fijos (RF-MF-005, RF-MF-006).** Un movimiento fijo con mes de inicio `S` y frecuencia `F` aparece en el mes `M` si y solo si: `S <= M` **y** (`deletedFrom` es null **o** `deletedFrom > M`) **y** `monthDiff(S, M) % step(F) === 0`, donde el paso por frecuencia es `MONTHLY=1`, `BIMONTHLY=2`, `QUARTERLY=3`, `BIANNUAL=6`, `ANNUAL=12`. La frecuencia está **anclada al mes de inicio** (no al mes consultado). Una **anulación** `(fijo, mes)` no cambia si el fijo aparece o no según esta regla: un fijo anulado para un mes **se sigue listando** en `GET /movements` con la marca de anulado, pero su monto **no suma** a los totales del mes ni a la serie anual de los reportes. La anulación es **reversible** (toggle) y solo tiene sentido sobre meses donde el fijo efectivamente aparece según `F`. El cálculo sigue siendo on-the-fly (RN-006): no se generan filas por instancia mensual. |

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
| Reportes: otros tipos (torta, barras de comparación, etc.) | Los dos tipos de reporte (ingresos/gastos y apilado por categoría de gastos) **sí** entran (RF-REP-001). Sumar nuevos tipos de reporte queda fuera de alcance: es una mini-fase futura que requiere definición de UX y no es bloqueante |
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
| Anulación (skip) de un fijo | Marca que cancela la aparición de un movimiento fijo en un **mes puntual**, sin eliminar el fijo. Reversible (toggle). El mes anulado se sigue mostrando pero no suma a los totales. Distinta de `deletedFrom`. Ver RF-MF-005, RN-016. |
| Balance | Resultado de ingresos − gastos en un período. Puede ser positivo o negativo. |
| Categoría | Clasificador asignado a cada movimiento. Personalizable por usuario. |
| Cuota | Instancia mensual de un grupo de cuotas. Representa un pago parcial de una compra dividida. |
| `deletedFrom` | Primer día del mes desde el cual un movimiento fijo deja de aparecer. Si es `null`, el fijo sigue activo. |
| Frecuencia (de un fijo) | Periodicidad de aparición de un movimiento fijo, de un set cerrado: mensual, bimestral, trimestral, semestral, anual. Anclada al mes de inicio. Default mensual. No editable tras crearse. Ver RF-MF-006, RN-016. |
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

**2026-06-14 — Gráfico anual de movimientos como widget reutilizable (RF-GRA-001..003).** Se incorpora a v1 un **gráfico anual** que muestra, por mes a lo largo de un año (eje X: los 12 meses; eje Y: monto), los movimientos del usuario, con **dos formas de visualización alternables**: (Forma 1) **ingresos vs. gastos** por mes —dos series de totales mensuales—, y (Forma 2) **gastos por categoría apilados** —el total de gastos de cada mes descompuesto en bandas por categoría, cada una con su color propio (RF-CAT-005); la Forma 2 es **solo de gastos**, los ingresos viven en la Forma 1; el gráfico no inventa colores—. Se implementa como **widget reutilizable configurable por props** (año a mostrar + navegación de año habilitada/deshabilitada) y se usa en **dos lugares**: el **dashboard** (`/`) con año actual fijo y sin navegación, y una **pantalla dedicada nueva** con navegación de año habilitada. El mes de cada movimiento para la agregación anual reutiliza el criterio de zona horaria ya definido, sin regla nueva (RN-015 → RN-011 para únicos; `startMonth` para fijos y cuotas). **Alcance v1: solo estas dos formas**; torta y otros tipos de gráfico quedan para una iteración futura (sección 6). Impacta el nuevo módulo 3.9 (RF-GRA-001, RF-GRA-002, RF-GRA-003), la sección 4 (RN-015), la sección 6 y `docs/screens.md` (nueva pantalla). **Necesidad de datos para el backend (funcional, sin diseñar endpoint):** totales mensuales de ingresos y de gastos para los 12 meses de un año (Forma 1) y el desglose de gastos por categoría por mes (Forma 2) — hoy el backend solo expone totales de un único mes (`GET /movements?month=YYYY-MM`). **Decisiones de producto pendientes de confirmar con el usuario** (quedan anotadas en RF-GRA-003, sin cerrar): (1) nombre de la pantalla nueva y de su link en el sidebar y su ubicación/orden; (2) forma por defecto al abrir (Forma 1 o Forma 2); (3) límites de la navegación de año (año mínimo hacia atrás y si se permiten años futuros); (4) comportamiento de los meses sin datos dentro de un año (mostrar en cero vs. otro). Motivo: el usuario quiere poder ver y "jugar" con la evolución anual de sus movimientos —comparar ingresos contra gastos y ver en qué categorías se va la plata mes a mes—, reutilizando un mismo componente en el panorama del dashboard y en una pantalla de exploración con navegación de años.

**2026-06-14 — Cierre de las 5 decisiones de producto pendientes del gráfico anual (RF-GRA-001..003).** Se confirman, con los valores recomendados, las cinco decisiones que la entrada anterior de esta fecha había dejado abiertas. Con esto **RF-GRA-001..003 dejan de tener pendientes** y la feature queda lista para implementar:

1. **Pantalla dedicada nueva: link "Anual", ruta `/anual`.** El link en el sidebar (RF-NAV-001) se rotula **"Anual"** y se ubica **debajo de "Vista del mes"** → orden final del sidebar: Dashboard → Vista del mes → Anual → Categorías. La ruta de la pantalla es **`/anual`**.
2. **Forma por defecto al abrir: Forma 1 (Ingresos vs. Gastos).** Tanto el widget del dashboard como la pantalla dedicada abren mostrando la **Forma 1** (dos series por mes: ingresos y gastos). El usuario puede alternar a la Forma 2 con el toggle del widget.
3. **Límites de navegación de año.** Hacia atrás, **sin tope artificial**, pero el control ‹ se **deshabilita antes del primer año con movimientos** del usuario (no se navega a años previos al primer dato). Hacia adelante, **los años futuros quedan bloqueados**: el máximo navegable es el **año en curso**.
4. **Meses sin datos: los 12 meses siempre presentes, en cero.** El eje X muestra siempre los 12 meses; un mes sin datos se grafica en **cero** (sin huecos ni omisiones). Los meses futuros del año en curso también van en cero, salvo lo que proyecten los fijos activos y las cuotas en tramo (RN-006). La representación visual concreta de un mes en cero la define `control-design`.
5. **Drill-down (clic en un mes → Vista del mes): fuera de v1.** No se implementa en v1 la navegación desde el gráfico a la Vista del mes; queda como candidato post-v1 (ya anotado en el roadmap, sección 6).

**2026-06-16 — Fijos extendidos: anulación por mes puntual (P1) y periodicidad (P2) — Fase 1.1.1 (RF-MF-005, RF-MF-006, RN-016).** Se extiende el módulo de movimientos fijos con dos capacidades **nuevas** (no reabre ninguna decisión cerrada de v1.0; las reaperturas son las fases 1.1.2 y 1.1.5):

1. **Anular un fijo en un mes puntual (P1 → RF-MF-005).** Desde el ítem del fijo en `/mes`, el usuario puede **anular** (y des-anular) la aparición del fijo en el mes visualizado mediante un **toggle reversible**. El mes anulado **se sigue mostrando** en la lista con diferenciación visual, pero **no suma** a los totales del mes (RF-VM-002, RF-DASH-002) ni a la proyección anual (RF-GRA-001). Se modela como un registro aparte `(fijo, mes)` (entidad **`RecurringSkip`**), **distinto de `deletedFrom`**: `deletedFrom` = "el fijo deja de existir de ahí en adelante"; la anulación = "esta única aparición no cuenta, pero el fijo sigue vivo". La acción es exclusiva de los fijos (únicos y cuotas no la tienen).

2. **Periodicidad del fijo (P2 → RF-MF-006).** Al crear un fijo, el usuario elige su **frecuencia** de un **set cerrado** de 5 valores: **mensual (default), bimestral, trimestral, semestral, anual** (sin frecuencias libres ni custom). La frecuencia está **anclada al mes de inicio** (un bimestral que arranca en marzo cae en marzo, mayo, julio…) y **no es editable** tras crearse (igual que el tipo); en el split de edición, la fila nueva hereda la frecuencia del original. **Back-compat:** todos los fijos preexistentes quedan **mensuales**. El cálculo sigue siendo **on-the-fly** (RN-006), sin generar filas por instancia.

La regla de cálculo de ambos puntos se formaliza en **RN-016**. Impacta el módulo 3.4 (nuevos RF-MF-005 y RF-MF-006, criterios agregados en RF-MF-002), la sección 4 (nueva RN-016), el glosario, `docs/data-model.md` (enum `RecurringFrequency`, campo `frequency`, entidad `RecurringSkip`, contratos de movimientos del mes y serie anual), `docs/backend.md` (RecurringModule + cálculo de fijos por mes), `docs/screens.md` (form tab Fijo y Vista del mes) y `docs/features.md`. Motivo: el usuario necesita fijos que no son siempre mensuales (seguros, impuestos, suscripciones anuales) y poder saltear una aparición puntual (un mes que no se paga) sin matar el fijo ni perder su historial.

Impacta RF-GRA-001 (criterio de los 12 meses en cero), RF-GRA-003 (criterios de ruta, link, forma por defecto y límites de año), RF-NAV-001 (link "Anual" en el orden del sidebar) y `docs/screens.md` (pantallas 7 y 8). **No** impacta `docs/backend.md` ni `docs/data-model.md`. Motivo: el usuario confirmó los valores recomendados; cerrar estas decisiones desbloquea la implementación sin ambigüedades.

**2026-06-15 — Las dos visualizaciones del gráfico anual pasan de "toggle alternable" a "dos recuadros separados que coexisten" (RF-GRA-001..003).** Cambio de **presentación** (cómo se muestran las visualizaciones), no de datos. **Antes:** un único widget con dos formas alternables mediante un **toggle** ("Ingresos y gastos" / "Por categoría"), abriendo en la Forma 1 **por defecto**. **Ahora:** las dos visualizaciones son **dos recuadros (paneles) separados, ambos visibles al mismo tiempo** — se elimina el toggle, no se "switchea", y deja de existir la noción de "forma por defecto". Concretamente: (a) en la **pantalla dedicada `/anual`** los dos recuadros se muestran **apilados** (arriba Ingresos vs. Gastos, debajo Gastos por categoría), ambos siempre visibles, con un **único control de año ‹ › compartido** que mueve a los dos al mismo año a la vez; (b) en el **dashboard (`/`)** se muestra **solo el recuadro de Ingresos vs. Gastos** (año fijo, sin navegación) — el recuadro de gastos por categoría **no** aparece en el dashboard y vive solo en `/anual`. El **contenido de cada visualización no cambia** (Forma 1 = ingresos vs. gastos por mes; Forma 2 = gastos por categoría apilados, solo `EXPENSE`, con el color propio de cada categoría) y todos los criterios sobre los datos se conservan (12 meses siempre presentes y en cero, invariante de suma de bandas, criterio de zona horaria RN-015, sin "Otras", colores de RF-CAT-005). **No impacta el backend ni el contrato de datos:** el endpoint ya devuelve ambos conjuntos de datos (totales mensuales de ingresos/gastos y desglose de gastos por categoría por mes); no cambia `docs/backend.md` ni `docs/data-model.md`. Impacta RF-GRA-001, RF-GRA-002 y RF-GRA-003 y `docs/screens.md` (pantallas 3, 7 y 8). Motivo: decisión del usuario — prefiere ver las dos visualizaciones a la vez en vez de alternarlas con un toggle, y reservar el desglose por categoría a la pantalla de exploración.

**2026-06-16 — Reportes configurables: renombre del módulo "anual" → "reportes" y reapertura de la navegación del dashboard — Fase 1.1.5 (RF-REP-001..005, RF-DASH-001/002, RF-NAV-001).** La pantalla `/anual` de v1.0 se convierte en una pantalla de **reportes configurable** y el módulo entero (3.9) se renombra **"Gráfico anual" → "Reportes"**. La mecánica de datos (agregación anual / serie de 12 meses de un año, Forma 1 y Forma 2) **no cambia**; lo que se renombra es el módulo/pantalla/feature y todo lo que lo refiere (ruta `/anual`→`/reportes`, link del sidebar "Anual"→"Reportes", endpoint `GET /movements/annual`→`GET /movements/reports`, hooks/tipos/componentes/query keys del lado de implementación). Cierres:

1. **Pantalla configurable por cards (RF-REP-003).** El usuario arma su propia vista de `/reportes` agregando **cards de reporte** mediante un recuadro **"[+]"** y quitándolas. La **primera vez la pantalla está vacía** (solo el "[+]"); la configuración persistida (preferencias 1.1.0, clave `reports`) **es** su pantalla.
2. **Dos tipos de reporte (RF-REP-001).** Los 2 de v1.0: **Ingresos vs. Gastos** (Forma 1) y **Gastos por categoría apilado** (Forma 2). Sumar tipos nuevos es una mini-fase futura, fuera de alcance de 1.1.5.
3. **Widget de reporte autónomo (RF-REP-002).** Cada card es un widget autónomo que lleva **embebidos** la navegación de año (flechas de 1.1.3, independiente por card — no chrome de página, no control compartido) y el **filtro de categorías** (check/destildar). El checklist ofrece el **universo de categorías del usuario** (no solo las que tienen gasto), porque aplica también a Forma 1.
4. **Persistencia por card (RF-REP-004).** Cada card persiste **tipo + año + categorías seleccionadas** (default: todas), vía la clave `reports` de preferencias (1.1.0). Representación de "todas las categorías": ver criterio en data-model.md (`categoryIds: null` = todas; lista = subconjunto explícito).
5. **Reapertura del dashboard (RF-DASH-001/002).** El dashboard monta el widget **Ingresos vs. Gastos** con **navegación de año ACTIVA** (independiente, como las cards) y filtro de categorías, pero su selección de categorías es **efímera: NO se persiste** (al recargar vuelve a "todas"). El **resumen mensual del dashboard** (tarjetas Gastos/Ingresos + balance, RF-DASH-002) **sigue fijo en el mes en curso** — NO navega meses; lo único que gana navegación es el widget de reporte (por año). Esto **concreta la reapertura** anunciada en el roadmap v1.1; v1.0 definía el dashboard sin navegación alguna.
6. **Backend (RF-REP-005).** Se renombra `GET /movements/annual` → `GET /movements/reports`, que acepta el año más un **filtro por categorías** (query param). Sin el param = todas. Devuelve los mismos `months`/`categories`/`earliestYear`, filtrados. Detalle del contrato en data-model.md.

Impacta el módulo 3.9 (renombrado a "Reportes": RF-GRA-001/002/003 → RF-REP-001..005), RF-DASH-001/002, RF-NAV-001 (link "Reportes"), RN-015, la sección 6, el glosario, `docs/screens.md` (pantallas 3, 7 y 8) y `docs/data-model.md` (clave de preferencias `reports`, contrato `GET /movements/reports`). Motivo: el usuario quiere armar su propia vista de reportes con las visualizaciones que le interesan, cada una navegando su año y filtrando sus categorías de forma independiente, y traer ese mismo widget interactivo al dashboard sin contaminar el resumen mensual fijo.

**2026-06-17 — Filtro por categoría en la Vista del mes + unificación del estado "ninguna" — Fase 1.1.6 (RF-VM-006, ajusta RF-REP-002/005).** Se agrega un **filtro por categoría a `/mes`** y se **unifica** el comportamiento del estado "ninguna" entre `/mes` y `/reportes`. Cierres:

1. **Filtro de `/mes` (RF-VM-006).** Control **por pantalla** (no por mes): la selección se mantiene al navegar entre meses. **Persistido por usuario** (preferencias 1.1.0, clave nueva `monthCategoryFilter`). **Default: todas.** Afecta **lista y totales** del mes (recalcula ambos). **No es global:** dashboard y reportes tienen su propio estado de filtro. Reutiliza el control visual de categorías de 1.1.5 (mismo popover/botón) — sin spec de diseño nuevo.
2. **Tres estados del filtro** (válidos para `/mes` y `/reportes`): **todas** (default, sin filtro), **subconjunto** (solo las tildadas), **ninguna** (todas destildadas) → **lista vacía y totales/serie en cero**.
3. **Cambio de comportamiento en `/reportes` (reabre 1.1.5, RF-REP-002/005).** Hasta 1.1.5 destildar todas las categorías se colapsaba a "sin filtro" y mostraba **todas**; ahora destildar todas muestra **ninguna** (serie en cero), igual que `/mes`. Excepción intacta: el límite de navegación de año en reportes (`earliestYear`) **ignora el filtro siempre**.
4. **Contrato del param `categories` (ambos endpoints, `GET /movements` y `GET /movements/reports`).** Distingue **ausente** (todas) de **presente y vacío** (`categories=`, ninguna) de **lista** (`categories=id1,id2`, subconjunto). Detalle en `docs/data-model.md`. Nueva clave de preferencias `monthCategoryFilter` (`null`/ausente = todas, `[]` = ninguna, lista = subconjunto), set único por `/mes`.

Impacta el nuevo RF-VM-006, RF-REP-002/005, `docs/screens.md` (pantallas 4 y 8), `docs/data-model.md` (param `categories` en `GET /movements`, clave `monthCategoryFilter`), `docs/features.md` y los gotchas de los agentes back/front. **No** introduce reglas de zona ni cambia el cálculo de totales/serie más allá del filtrado. Motivo: el usuario quiere filtrar la Vista del mes por categoría con la preferencia persistida, y que destildar todo signifique "nada" de forma consistente en toda la app.

**2026-06-08 — NestJS como emisor del JWT (Fase 2).** El backend es la autoridad de identidad y **emite** el JWT (HS256, claim `sub = userId`, `exp` 30 días). NextAuth (frontend) **no emite un token de identidad propio**: orquesta el login y guarda el JWT de NestJS dentro de su sesión (un JWE separado) para reenviarlo como `Authorization: Bearer` en cada request, que el backend valida con un guard global. Hay **un solo `userId`** (cuid de Postgres) compartido por front y back. Esto reemplaza la idea previa (entrada 2026-06-03) de que Auth.js firmaba el JWT. Impacta `docs/architecture.md`, `docs/backend.md`, `docs/frontend.md` y `docs/data-model.md`. Motivo: que la identidad viva en el backend deja la puerta abierta a mobile u otros clientes, que se autentican contra los mismos endpoints sin depender de Auth.js.

**2026-06-08 — Google OAuth diferido a otra instancia (Fase 2).** El método **email + contraseña** se valida end-to-end ahora (login RF-AUTH-005, registro RF-AUTH-006). **Google** (RF-AUTH-001) queda scaffolded y funcional pero **sin activarse**: faltan las credenciales y la verificación server-side del `id_token`. No bloquea v1 del flujo de auth. Impacta `docs/features.md` (Google: "Scaffolded / diferido"). Motivo: priorizar el camino email+contraseña completo sin frenar por la activación de Google, que requiere credenciales y validación del token de Google.

**2026-06-08 — Timezone default en el registro (Fase 2).** `POST /auth/register` **no recibe `timezone`** todavía (el front no lo envía); el backend asigna `America/Argentina/Buenos_Aires` por defecto al crear la cuenta. **Pendiente:** cuando el front envíe la zona del usuario, el backend debe **priorizar la recibida** sobre el default. Impacta el `timezone` del Usuario (`docs/data-model.md`). Motivo: el campo `timezone` "de casa" ya es necesario para calcular "hoy"/"mes actual" (entrada 2026-06-04), y se cubre con un default razonable hasta que el front lo capture.

**2026-06-08 — Colores provisorios de las categorías por defecto (Fase 2).** Las 4 categorías que se crean al alta (RF-CAT-001) usan **colores hex fijos provisorios** (Consumibles `#4F86C6`, Tarjeta de crédito `#E07B54`, Gastos fijos `#6DBF67`, Servicios `#A98BD6`) hasta que **Fase 3** implemente el pool de colores predefinidos y la asignación automática (RF-CAT-005). Impacta `docs/backend.md` y `docs/data-model.md`. Motivo: las categorías por defecto necesitan un color al crearse, y se fija uno provisorio sin esperar el pool, que llega con el módulo de Categorías.

**2026-06-08 — JWT con expiración de 30 días (Fase 2).** El JWT que emite NestJS expira a los **30 días**. Motivo: Control es una app personal de bajo riesgo; se prioriza la comodidad (no re-loguear seguido) por sobre la rotación frecuente del token.

**2026-06-04 — Movimiento único con fecha y hora, almacenamiento UTC + zona original.** El movimiento único pasa a capturar fecha **y hora** (antes solo fecha). Al crear, la fecha y la hora tienen como default el momento de creación ("ahora") y ambas son editables. Cada movimiento se almacena como instante en UTC junto con la zona horaria original del registro (nombre IANA, ej. `America/Argentina/Buenos_Aires`), y se muestra siempre en esa zona original aunque el usuario viaje. El mes al que pertenece se calcula en la zona del registro, de forma estable. El Usuario incorpora un campo `timezone` (su zona "de casa"/default), usado para determinar "hoy"/"mes actual" al crear movimientos y en el dashboard. Los movimientos fijos y las cuotas no cambian: siguen a nivel mes, sin día ni hora. Impacta RF-MU-001, RF-MU-002, RF-VM-001 y RN-011. La mecánica técnica completa vive en `docs/technical.md` (sección "Fechas y zonas horarias"). Motivo: registrar el instante real del gasto y conservar la hora local del lugar donde ocurrió hace la información más precisa y estable frente a viajes o cambios de zona.

**2026-06-08 — Pool de colores definido (10 colores) con asignación "menos usado" (Fase 3, RF-CAT-005).** Se cierra el pool concreto: 10 colores fijos viven en el backend (`backend/src/categories/color-pool.ts`, única fuente). Al crear una categoría, el sistema asigna el color del pool **menos usado** entre las categorías activas del usuario; en empate, el primero en orden de definición (determinístico). Las 4 categorías por defecto del alta toman los primeros 4 colores en orden. Los 4 colores antes provisorios de las categorías por defecto (entrada 2026-06-08, "Colores provisorios...") quedan **integrados al pool oficial** — dejan de ser provisorios. `AuthService` y `CategoriesService` importan el pool del mismo módulo central. Impacta `docs/backend.md`, `docs/data-model.md`. Motivo: dar identidad visual estable a las categorías sin que el usuario elija color, con una asignación que distribuye los colores en lugar de repetir siempre el primero.

**2026-06-08 — Contrato del 409 reactivable vía `error.data` (Fase 3, RF-CAT-002 / RF-CAT-004).** El caso "colisión con categoría eliminada" se resuelve devolviendo `409` con `error.data = { reactivable: true, category: { id, name, scope, color } }` dentro del sobre de error; el front usa ese `id` para llamar a `POST /categories/:id/reactivate`. Es el **único** error que adjunta `data`: el resto de los errores no lo llevan, y la colisión con una categoría **activa** (RN-008) responde `409` **sin** `data`. Se implementa con una `ReactivableConflictException` y una extensión mínima del Global Exception Filter (campo `data` opcional en el sobre de error). Permite al front ofrecer Reactivar/Cancelar sin un endpoint extra de búsqueda. Impacta `docs/backend.md`, `docs/frontend.md`, `docs/data-model.md`. Motivo: resolver el flujo crear-o-reactivar con la información necesaria en la misma respuesta de error, sin un round-trip adicional.

**2026-06-08 — Orden de listado de categorías: nombre ascendente (Fase 3).** `GET /categories` devuelve las categorías activas ordenadas por **nombre ascendente**. Impacta `docs/backend.md`. Motivo: orden estable y predecible para la pantalla de gestión, independiente de la fecha de creación.

**2026-06-08 — Alcance: `/categorias` sin sidebar (opción B, Fase 3).** El CRUD de categorías se entrega como pantalla accesible **por URL** (`/categorias`), **sin** construir el sidebar/nav todavía. El sidebar de navegación global (RF-NAV-001) queda para una fase posterior. Impacta `docs/frontend.md`, `docs/features.md`. Motivo: acotar la Fase 3 al módulo de Categorías sin acoplar la entrega a la navegación global, que tiene su propio alcance.

**2026-06-16 — Vista del mes: secciones colapsables + reordenables, las 3 siempre visibles — Fase 1.1.4 (RF-VM-005).** Las tres secciones de `/mes` (Únicos / Fijos / Cuotas) pasan a ser **colapsables tipo acordeón** (expandir/colapsar individual; la cabecera completa es el disclosure) y **reordenables solo entre sí** mediante drag dentro de un **"modo orden"** explícito (botón "Ordenar secciones" / "Listo" en el header). Los ítems **dentro** de cada sección no se reordenan: siguen por monto descendente (RF-VM-001). Tanto el **estado colapsado/expandido** como el **orden de secciones** se **persisten por usuario** vía las preferencias (1.1.0) — es el **primer consumidor real del blob** (clave `monthSections`; shape en `docs/data-model.md`). **Cambio de comportamiento respecto de v1.0:** (1) las **3 secciones se muestran siempre**, aunque estén vacías (antes una sección sin movimientos se ocultaba) — una sección vacía muestra cabecera completa (contador 0, subtotal $0) + un empty inline propio ("Sin movimientos únicos" / "Sin fijos" / "Sin cuotas"); (2) se **elimina el empty global** de `/mes` ("No hay movimientos en {mes}" con CTA, que aparecía con las 3 secciones vacías): con las 3 secciones siempre visibles y su empty propio, quedaba redundante. En modo orden, "+ Nuevo movimiento" se deshabilita y el colapsar/expandir queda suspendido; no hay "cancelar" (el orden se aplica en vivo). **Solo frontend:** no toca el backend ni el contrato de API; consume el cimiento de preferencias (1.1.0). Impacta RF-VM-001 (empties) y el nuevo RF-VM-005, `docs/screens.md` (pantalla 4), `docs/data-model.md` (clave `monthSections`), `docs/frontend.md` y `docs/features.md`. Motivo: el usuario quiere plegar las secciones que no le interesan en un mes y ordenarlas a su gusto, con esa preferencia persistida entre sesiones.

**2026-06-08 — Bucketeo por mes de movimientos con la timezone del query param (deuda técnica, Fase 4).** `GET /transactions` filtra el mes por un **rango UTC calculado con la `timezone` enviada en el query param** (`?month=YYYY-MM&timezone=IANA`), **no** con la `timezone` propia de cada registro. **Ambos params son obligatorios:** el backend **no asume "mes actual"** (no conoce la zona del usuario en ese punto) y devuelve `400` si falta `month`. **Limitación conocida:** un movimiento cargado en una zona distinta a la del query puede caer en el mes "equivocado" según este criterio. La alternativa correcta —bucketear por la zona de cada registro vía SQL `AT TIME ZONE`— requiere SQL crudo, no idiomático en Prisma 7; se **difiere a Fase 5** (Vista del mes). Impacta `docs/backend.md`. Motivo: entregar el filtrado por mes sin trabarse en SQL crudo, asumiendo conscientemente la limitación hasta que la Vista del mes lo resuelva bien.

**2026-06-08 — Errores de categoría en movimientos son `400`, no `409` (Fase 4, RN-010).** En `POST` / `PATCH` de movimientos únicos, una categoría **inexistente, ajena (de otro usuario), eliminada (soft delete) o con scope incompatible** (RN-010) se responde como **`400 BadRequest`** —es validación de input— y **nunca como `409`**. El caso de categoría **ajena no se distingue** del de "inexistente": el error es idéntico, para **no revelar** si el `id` existe en la DB de otro usuario. La validación se aplica tanto al crear como al editar. Impacta `docs/backend.md`. Motivo: tratar la referencia de categoría como input a validar (no como conflicto de estado) y evitar filtrar la existencia de ids ajenos.

**2026-06-08 — Alcance Fase 4: solo crear visible; editar/eliminar listos para Fase 5.** Se implementa el CRUD completo de movimientos únicos (backend `TransactionsModule` + modal de carga), pero **solo crear queda visible** (desde el botón "Nuevo movimiento" del dashboard). **Editar y eliminar quedan implementados** como componentes/hooks reutilizables (`TransactionModal`, `DeleteTransactionDialog`, `useTransactions`) **sin acceso visible**, listos para que la **Vista del mes (Fase 5)** los cablee; en esta fase **no hay lista ni Vista del mes**. El modal de carga muestra los 3 tabs, pero **Fijo y Cuotas van deshabilitados con badge "Próximamente"** (llegan en Fases 6/7); solo Único es funcional. El toast "Ir a ver" apunta a la **ruta real `/mes?month=YYYY-MM`** que construye Fase 5 (hoy `404` por diseño). Impacta `docs/backend.md`, `docs/frontend.md`, `docs/features.md`. Motivo: entregar la carga de movimientos cuanto antes y dejar editar/eliminar preparados sin acoplarlos a una Vista del mes que todavía no existe.

**2026-06-09 — Bucketeo de mes definitivo por la zona propia de cada registro (Fase 5).** El mes al que pertenece un movimiento se calcula con la **`timezone` guardada en cada registro**, vía SQL `date_trunc('month', "occurredAt" AT TIME ZONE timezone)` en un `$queryRaw` **parametrizado**. Esto **reemplaza el criterio provisorio de Fase 4** (rango UTC calculado con la `timezone` enviada por query param) y **salda esa deuda técnica**: dos movimientos cargados en zonas distintas caen cada uno en su mes correcto, sin depender de la zona del request. En consecuencia, **`GET /movements` ya no recibe `timezone`** (solo `month`, obligatorio). Impacta `docs/backend.md`, `docs/data-model.md`, RN-011 (mecánica en `docs/technical.md`). Motivo: el mes correcto de un movimiento depende de la zona donde ocurrió, no de la zona en que se lo consulta; la Vista del mes ya no podía cargar la deuda técnica de Fase 4.

**2026-06-09 — `GET /movements` unificado reemplaza `GET /transactions?month` (Fase 5).** El listado del mes pasa a un endpoint único **`GET /movements?month=YYYY-MM`** (módulo `MovementsModule`) que devuelve los movimientos **agrupados por origen** (`unicos` / `fijos` / `cuotas`) **más los totales del mes** (`expenseCents`, `incomeCents`, `balanceCents = income − expense`, que puede ser negativo). Se **elimina** `GET /transactions?month&timezone`; de `transactions` quedan `POST`, `GET /:id`, `PATCH`, `DELETE`. La estructura está **preparada para fijos y cuotas** (Fases 6/7): esas listas existen vacías y los totales están diseñados para sumarlas cuando existan, sin rehacer el contrato. Los totales **suman movimientos, no categorías**, e incluyen movimientos cuya categoría esté soft-deleted (RF-VM-002 / RF-CAT-004). Impacta `docs/backend.md`, `docs/data-model.md`, `docs/frontend.md`, RF-VM-001/002, RF-DASH-002. Motivo: una sola respuesta unificada para la Vista del mes y el Dashboard, diseñada desde el inicio para los tres tipos de movimiento, evita rehacer el contrato en fases posteriores.

**2026-06-09 — Dashboard movido de `/dashboard` a `/` (Fase 5).** El dashboard pasa a vivir en la raíz **`/`**, como define `screens.md` (pantalla 3). En Fase 2 se había dejado en `/dashboard` —una desviación silenciosa de la spec—; acá se corrige aplicando la **Regla de oro** (implementar exactamente lo definido). Se elimina la carpeta `/dashboard` y se actualizan todos los redirects post-autenticación a `/` (`middleware.ts` para usuarios autenticados en `/login`|`/registro`; `callbackUrl`/`redirectTo` por defecto de login, registro y `use-register`). El sign-out sigue a `/login`. Impacta `docs/frontend.md`, `docs/features.md` y los redirects. Motivo: alinear la ruta del dashboard con la definición de pantallas y no arrastrar una desviación no documentada.

**2026-06-09 — Sidebar (RF-NAV-001) diferido formalmente.** Se decide **diferir la implementación del sidebar** (RF-NAV-001) a una fase posterior. `screens.md` lo define como contenido de Dashboard, Vista del mes y Categorías; esa definición **se conserva sin cambios** y solo se marca su **estado de implementación como pendiente**. Mientras tanto, la navegación entre `/`, `/mes` y `/categorias` se hace con los **accesos ya definidos en cada pantalla**: enlace "Ver todos" del dashboard, acción "Ir a ver" del toast post-guardado, y URL directa. Esto formaliza por escrito lo que en Fase 3 (entrada "`/categorias` sin sidebar") ya se venía haciendo de hecho, dejando de ser una desviación silenciosa. Impacta `docs/screens.md`, `docs/roadmap.md`, `docs/frontend.md`, `docs/features.md`. Motivo: las pantallas de Fase 5 son navegables con los accesos existentes; construir el sidebar es un alcance propio que no conviene acoplar a esta fase.

**2026-06-09 — Decisiones de implementación de Movimientos fijos (Fase 6).** Se implementan los movimientos fijos (RF-MF-001..004) **sin cambiar ningún requerimiento**: los RF ya definían el comportamiento (inmutabilidad del pasado, eliminación con checkbox, fijo sin día/hora). Solo se cierran las decisiones del **cómo**:

1. **Inmutabilidad del pasado al editar = "split" (cadena de filas `Recurring`).** Un fijo lógico se representa como **una cadena de filas `Recurring`** en el tiempo, no una sola. Al editar un fijo que ya corrió meses pasados, se **cierra la fila vigente** (`deletedFrom = mes actual`) y se **abre una fila nueva** (`startMonth = mes actual`) con los valores nuevos (la respuesta trae **otro `id`**); si el fijo no corrió ningún mes, se edita en su lugar. Así los meses pasados quedan intactos (RF-MF-003) sin generar filas por instancia mensual. La eliminación funciona análogo, con un `boundary` que define desde qué mes deja de aparecer y un hard delete físico si el fijo no aparecería en ningún mes. Impacta `docs/backend.md`, `docs/data-model.md`, `docs/features.md`.

2. **El "mes actual" lo determina el frontend (zona del navegador) y lo envía al backend.** Editar (`currentMonth`) y eliminar (`currentMonth` + `fromCurrentMonth`) son relativos al **mes actual real** del usuario (vía `getCurrentMonth()`), **no al mes visualizado** en la Vista del mes. El backend no infiere "hoy". Impacta `docs/backend.md`, `docs/frontend.md`.

3. **`MovementItem.occurredAt` / `timezone` pasan a nullable.** Para soportar fijos —que no tienen día/hora/zona— ambos campos del contrato de `GET /movements` admiten `null` (presentes en únicos, `null` en fijos). El front no los pasa a los formateadores de fecha/hora sin chequear null. La lista `movements.fijos` se puebla desde esta fase y los totales del mes (Vista del mes y Dashboard) suman únicos + fijos activos. Impacta `docs/data-model.md`, `docs/backend.md`, `docs/frontend.md`.

Motivo: cerrar la mecánica de implementación de los fijos respetando los RF ya escritos, dejando registrado por qué el modelo es una cadena de filas y por qué el mes actual lo manda el front.

**2026-06-09 — Cuotas solo Gasto en v1: resolución de conflicto de la spec (opción A, Fase 7).** La spec tenía una **contradicción**: RF-MC-001 ofrecía elegir "Gasto o Ingreso" al crear una compra en cuotas, pero la sección 6 ("Fuera de alcance — v1") excluye explícitamente "Ingreso en cuotas". Se resuelve a favor de la sección 6: **las cuotas son solo Gasto en v1**. El backend (`POST` / `PATCH /installments`) **rechaza `INCOME` con `400`** y el front **no ofrece selector de tipo** en el tab Cuotas (siempre Gasto). "Ingreso en cuotas" permanece fuera de alcance v1 (sin cambios en la sección 6). **No se reescribe el texto de los RF** (RF-MC-001..003): es una resolución de conflicto documentada en bitácora; cuando se incorpore "Ingreso en cuotas" en una versión futura, los RF ya lo contemplan. Impacta `docs/backend.md`, `docs/frontend.md`, `docs/features.md`. Motivo: tener un solo criterio coherente para v1, alineado con el alcance ya acotado de la sección 6, sin sumar un tipo de movimiento que estaba excluido.

**2026-06-09 — Decisiones de implementación de Movimientos en cuotas (Fase 7).** Se implementan las cuotas (RF-MC-001..003) **sin cambiar ningún requerimiento** (más allá de la resolución de tipo de la entrada anterior). Se cierran las decisiones del **cómo**:

1. **Cuotas on-the-fly, sin filas por instancia (RN-006).** El grupo (`InstallmentGroup`) no genera una fila por cuota mensual. En `/movements` se consultan los grupos con `startMonth <= month` y se filtra por `month < addMonths(startMonth, totalInstallments)`; el número de cuota del mes (1-based) es `monthDiff(startMonth, month) + 1`. Helpers `addMonths` / `monthDiff` en `movements.repository.ts`. Los totales del mes pasan a sumar únicos + fijos + cuotas. Impacta `docs/backend.md`, `docs/data-model.md`, `docs/features.md`.

2. **Sin split ni soft delete (a diferencia de los fijos).** Editar (`PATCH /installments/:id`) actualiza el grupo completo **in-place** —no hay inmutabilidad del pasado en cuotas—; eliminar (`DELETE /installments/:id`) es **hard delete del grupo entero** (todas las cuotas, pasadas y futuras; `InstallmentGroup` no tiene `deletedFrom`). Campos editables: monto por cuota, cantidad, mes de inicio, categoría, descripción (no el `type`). El diálogo de eliminación avisa que borra el grupo completo, sin checkbox. **No hay `GET /installments/:id`**: el front prefilea desde el `MovementItem` de `/movements`. Impacta `docs/backend.md`, `docs/frontend.md`.

3. **`MovementItem` suma el campo `installment`.** El contrato de `GET /movements` incorpora `installment: { number, total, startMonth } | null` —presente solo en cuotas, `null` en únicos y fijos— para la etiqueta "Cuota X/N" y el prefill de edición. Para cuotas, `occurredAt`/`timezone` vienen `null` (operan a nivel mes). Impacta `docs/data-model.md`, `docs/backend.md`, `docs/frontend.md`.

4. **Validación de categoría consolidada en `CategoryValidatorService`.** La validación duplicada en Fases 4/6 (existencia + `userId` + activa + scope RN-010) se extrae a `CategoryValidatorService` (módulo `categories`), que los tres módulos de movimientos (`transactions`, `recurring`, `installments`) inyectan. Se mantiene el comportamiento: errores de categoría en movimientos son **`400`** (no `409`) y categoría ajena no se distingue de inexistente. Impacta `docs/backend.md`.

Motivo: cerrar la mecánica de implementación de las cuotas respetando los RF, dejando registrado por qué el modelo es on-the-fly sin filas por instancia, por qué la edición/eliminación operan sobre el grupo entero (sin la inmutabilidad del pasado de los fijos) y por qué la validación de categoría se consolidó al sumar el tercer módulo de movimientos.

**2026-06-10 — Sidebar de navegación global (RF-NAV-001) implementado (feature frontend post-Fase 7).** Se construye el sidebar (RF-NAV-001) como feature 100% frontend, fuera de la secuencia de fases. Esto **revierte** las dos decisiones previas que lo diferían: la del 2026-06-08 (`/categorias` sin sidebar, opción B) y la del 2026-06-09 (sidebar diferido formalmente). El sidebar **ya está construido y operativo**; las pantallas autenticadas (`/`, `/mes`, `/categorias`) lo muestran y dejan de depender únicamente de los accesos interinos de cada pantalla. **No se reescribe el texto de RF-NAV-001** (ya describía el comportamiento correcto). Decisiones de implementación cerradas (aprobadas por el usuario):

1. **Punto único de montaje vía route group `app/(app)/`.** Las tres pantallas autenticadas se agrupan bajo `app/(app)/`, que tiene un `layout.tsx` compartido que monta el sidebar **una sola vez**. Los route groups de Next.js **no alteran las URLs** (`/`, `/mes`, `/categorias` siguen idénticas). `login` y `registro` quedan **fuera** del grupo, por lo que no muestran sidebar (cumple "no se muestra en pantallas no autenticadas"). Regla a futuro: **toda pantalla nueva con sesión vive bajo `app/(app)/`** para heredar el sidebar.

2. **Sidebar colapsable; avatar por inicial del email.** En desktop es fijo a la izquierda; en pantallas chicas se colapsa con botón hamburguesa. El avatar del menú de usuario es la **inicial del email en mayúscula** (no hay imagen para usuarios de email). El menú de usuario, abajo, despliega "Cerrar sesión" (RF-AUTH-004).

3. **Email via Server layout → prop (no `useSession()`).** El `layout.tsx` (Server Component) obtiene el email con `auth()` y lo pasa como prop a `AppSidebar` (Client Component). Si el email es null, fallback a string vacío (inofensivo: el middleware ya redirigió).

Impacta `docs/frontend.md`, `docs/features.md`, `docs/roadmap.md`, `.claude/agents/control-frontend.md`. Motivo: la navegación global ya no se justificaba diferir; se entrega como feature frontend independiente una vez completos los tres tipos de movimiento, sin acoplarla a una fase del roadmap.

**2026-06-13 — Mes contexto en fijos y cuotas, y mes de inicio elegible en fijos (permite pasado).** Se cierran tres decisiones de producto sobre el mes de inicio de los movimientos a nivel mes:

1. **Definición de "mes contexto".** El **mes contexto** es el mes que el usuario está navegando en la Vista del mes (`/mes`) al momento de abrir el modal "Nuevo movimiento". Solo existe cuando el modal se abre **desde `/mes`**; abierto desde el dashboard, el sidebar o cualquier otra pantalla, no hay mes contexto y el default es el **mes actual**.

2. **Mes de inicio elegible en fijos (RF-MF-001).** El movimiento fijo deja de arrancar siempre en el mes actual: incorpora un campo **"Mes de inicio"** editable (igual que cuotas). Su default es el mes contexto si el modal se abrió desde `/mes`, o el mes actual en cualquier otro origen. **Se permite elegir un mes pasado:** el fijo aparece retroactivamente en los meses anteriores y modifica sus totales (consecuencia aceptada). El backend ya aceptaba cualquier `startMonth` YYYY-MM sin restricción de pasado, por lo que es solo un cambio de UI/UX; no toca el modelo de datos.

3. **Mes contexto como default en fijos y cuotas, NO en únicos.** Al abrir el modal desde `/mes`, el mes navegado se propaga como default del mes de inicio en **fijos** (RF-MF-001) y **cuotas** (RF-MC-001, antes default = mes actual). Los **movimientos únicos quedan sin cambios** (RF-MU-001): el único es instante-céntrico (fecha + hora exactas) y mantiene su default de hoy/ahora siempre, sin importar el origen.

**Política común fijos/cuotas:** ambos admiten mes de inicio pasado. Impacta RF-MF-001, RF-MC-001, `docs/screens.md` (pantallas 4 y 5) y `docs/features.md`. **No** impacta `docs/data-model.md` (el modelo ya soporta `startMonth` arbitrario). Motivo: al cargar fijos o cuotas mientras se revisa un mes concreto, lo esperable es que arranquen en ese mes; y permitir el mes pasado cubre el alta de fijos/cuotas que vienen corriendo desde antes. El único no sigue esta lógica porque su naturaleza es un instante puntual, no un mes.

**2026-06-13 — Editar un fijo pivota sobre el mes visualizado (AMENDA la decisión 2026-06-09, Fase 6, punto 2).** Se cambia **qué mes se usa como pivote del split al editar un movimiento fijo** (RF-MF-003): pasa de ser el **mes actual real** del usuario a ser el **mes que el usuario está viendo** en la Vista del mes (`/mes`) al abrir la edición. Si el usuario navega a un mes X y edita un fijo, el cambio aplica **desde X en adelante**, preservando solo los meses anteriores a X. Esto **revierte, exclusivamente para editar**, el criterio de la entrada **2026-06-09 (Fase 6, punto 2)**, que fijaba `currentMonth = getCurrentMonth()` (mes real de hoy) tanto para editar como para eliminar.

- **Solo cambia el pivote, no la mecánica.** El "split" del backend (cerrar la fila vigente en el mes pivote con `deletedFrom` y abrir una fila nueva con `startMonth` = mes pivote) **no cambia**; lo único que cambia es el valor de `currentMonth` que envía el frontend al `PATCH /recurring/:id`: pasa de "mes real de hoy" a "mes navegado".
- **Sin cambio de contrato de API.** El backend ya recibe `currentMonth` del frontend y arma el split con ese valor, sin restringir meses pasados. Es un cambio **solo de frontend** (mandar el mes navegado en lugar de `getCurrentMonth()`). No toca el modelo de datos.
- **Efecto en el pasado.** Editar desde un mes pasado ahora **sí** modifica desde ese mes en adelante. La inmutabilidad de RN-005 se reinterpreta para editar como "meses anteriores al mes visualizado", no "meses anteriores a hoy".
- **Eliminar NO cambia.** La eliminación de un fijo (RF-MF-004, `DELETE /recurring/:id`) **sigue pivotando sobre el mes actual real** (`getCurrentMonth()`), tal como la entrada 2026-06-09. La consistencia editar/eliminar quedó marcada como pregunta abierta a relevar con el usuario.

Impacta RF-MF-003, RN-005, `docs/screens.md` (pantallas 4 y 5), `docs/frontend.md` y `docs/features.md`. **No** impacta `docs/backend.md` ni `docs/data-model.md` (sin cambio de contrato ni de modelo). Motivo: al editar un fijo mientras se revisa un mes concreto, lo esperable es que el cambio arranque en ese mes; usar el mes real de hoy resultaba contraintuitivo cuando el usuario estaba parado en otro mes.

**2026-06-13 — Eliminar un fijo pivota sobre el mes visualizado: se quita el checkbox y se REUNIFICA RN-005 (cierra la pregunta abierta de la entrada anterior).** Se cambia el comportamiento de **eliminar un movimiento fijo** (RF-MF-004) para alinearlo con la edición: pasa de pivotar sobre el **mes actual real** del usuario (`getCurrentMonth()`, como fijaba la entrada **2026-06-09**, Fase 6, punto 2) a pivotar sobre el **mes visualizado** en la Vista del mes (`/mes`), **inclusive en adelante**. Con esto se **resuelve la pregunta abierta** que dejó la entrada inmediatamente anterior (consistencia editar/eliminar): editar y eliminar **vuelven a comportarse igual**.

1. **Se elimina la opción / checkbox.** Desaparece el checkbox *"Eliminar también desde este mes"* y las dos variantes ("desde el mes siguiente" como default vs "desde este mes inclusive"). El comportamiento pasa a ser **único y por defecto**: eliminar **desde el mes visualizado inclusive en adelante**, preservando los meses anteriores. "Mes visualizado" = el mes que el usuario está viendo en `/mes`, el mismo pivote que la edición de fijos.

2. **RN-005 se REUNIFICA a un criterio único** para editar Y eliminar: pivote = mes visualizado, inclusive, preserva todo mes previo. Esto cierra la bifurcación que introdujo la entrada anterior de hoy (editar = mes visto / eliminar = mes real), volviendo RN-005 a un único criterio como antes del 2026-06-09.

3. **Sin cambio de contrato de API.** El backend `DELETE /recurring/:id` ya recibe `currentMonth` y `fromCurrentMonth`; el cliente ahora **fija siempre `fromCurrentMonth = true`** y `currentMonth` = mes visualizado. La mecánica de borde no cambia: si el mes visualizado es anterior o igual al `startMonth`, el fijo no aparecería en ningún mes y se hace **hard delete** del fijo completo. Es un cambio **solo de frontend**.

Referencias: amenda RF-MF-004 (se reescribe el flujo, antes con checkbox) y RN-005; se apoya en y completa la entrada **2026-06-13 (editar pivota sobre el mes visualizado)** y revierte, para eliminar, el pivote de la entrada **2026-06-09 (Fase 6, punto 2)**. Impacta RF-MF-004, RN-005, `docs/screens.md` (pantallas 4 y 5), `docs/frontend.md` y `docs/features.md`. **No** impacta `docs/backend.md` ni `docs/data-model.md` (sin cambio de contrato ni de modelo). Motivo: al eliminar un fijo mientras se revisa un mes concreto, lo esperable es el mismo comportamiento que al editarlo —arrancar en ese mes—; mantener dos pivotes distintos para editar y eliminar era incoherente, y el checkbox sumaba una decisión innecesaria.

**2026-06-13 — Crear categoría desde el formulario de carga de movimiento (nuevo RF-MU-004).** Se agrega la posibilidad de crear una categoría **sin salir del formulario de carga de movimiento**, reutilizando el modal de categoría existente. Decisiones de producto cerradas por el usuario:

1. **Disparador (opción B).** Un botón **"+ Nueva"** ubicado **junto al selector de categoría** dentro del formulario de carga, **no** un ítem dentro del desplegable de categorías.
2. **Comportamiento.** "+ Nueva" abre el modal de creación de categoría **ya existente** (RF-CAT-002) **por encima** del formulario de carga. Los datos ya cargados del movimiento (monto, fecha, hora, descripción, mes de inicio, cantidad de cuotas, según el tipo) **se conservan** al ir al modal y al volver.
3. **Pre-selección de scope.** Al abrir el modal desde el formulario de carga, el campo "Tipo" (scope) arranca **pre-seleccionado** en el tipo exacto del movimiento en curso (Gasto → "Gasto"; Ingreso → "Ingreso"). Ver la resolución del caso borde abajo para las opciones que se ofrecen.
4. **Al crear con éxito.** El modal se cierra y la categoría recién creada queda **autoseleccionada** en el campo categoría del movimiento.
5. **Caso reactivable (409).** Si el nombre choca con una categoría archivada, se reutiliza el **prompt de reactivación** existente (RF-CAT-002 A3); al reactivar, esa categoría también queda autoseleccionada.

**Alcance técnico:** cambio **solo frontend**. **No** se agrega ni modifica ningún endpoint ni contrato de API: se reutilizan el modal de creación de categoría, el hook de categorías (cuyo `create` ya devuelve la categoría creada) y el prompt de reactivación. Impacta RF-MU-004 (nuevo), `docs/screens.md` (pantalla 5 — Formulario de carga) y `docs/features.md`. **No** impacta `docs/backend.md` ni `docs/data-model.md`.

Motivo de la feature: reducir la fricción de cargar un movimiento cuya categoría todavía no existe, sin perder los datos ya tipeados ni obligar a salir del formulario hacia `/categorias`.

**2026-06-13 — Resolución del caso borde de RF-MU-004 (scope incompatible) por restricción de opciones.** El caso borde que había quedado abierto (poder crear, desde el modal inline, una categoría con scope incompatible con el tipo del movimiento) se **resuelve eliminándolo de raíz**, con una variante que no coincide con ninguna de las opciones (a)/(b)/(c) planteadas: en lugar de manejar el conflicto después, se **restringen las opciones de scope** cuando el modal se abre en modo inline desde el formulario de carga. El campo "Tipo" ofrece solo las opciones compatibles y **oculta el tipo opuesto**: movimiento Gasto → "Gasto" + "Ambos" (oculta "Ingreso"); movimiento Ingreso → "Ingreso" + "Ambos" (oculta "Gasto"). La pre-selección es el tipo exacto del movimiento; el usuario puede pasar a "Ambos" pero no al tipo opuesto. Como consecuencia, nunca se crea una categoría incompatible y la autoselección posterior siempre funciona, sin necesidad de avisos, bloqueos ni manejo del caso "fantasma". **Alcance de la restricción:** aplica **únicamente** en modo inline; cuando el modal se abre desde su lugar normal en `/categorias`, sigue mostrando las **tres** opciones (Gasto / Ingreso / Ambos) con default "Ambos", exactamente como hoy. Es un cambio **solo frontend** y no afecta contratos de API ni el modelo de datos. Con esto **RF-MU-004 deja de tener preguntas abiertas**. Impacta RF-MU-004 y `docs/screens.md` (pantallas 5 y 6). Motivo: prevenir el estado inválido en origen es más simple y menos confuso para el usuario que detectarlo y reconciliarlo después de cerrar el modal.

**2026-06-14 — Orden de la lista del mes por monto descendente (RF-VM-001).** El listado de la Vista del mes (`/mes`) y el endpoint `GET /movements?month=YYYY-MM` ordenan los movimientos por **monto descendente** (`amountCents` DESC: el monto más alto primero, por magnitud, sin distinguir `EXPENSE` de `INCOME` porque `amountCents` es siempre positivo), reemplazando el criterio anterior por recencia. Aplica a las tres secciones (`unicos`, `fijos`, `cuotas`). El desempate estable, cuando los montos son iguales, es por sección: **Únicos** por `occurredAt` descendente (más reciente primero); **Fijos** por `createdAt` descendente; **Cuotas** por `id` ascendente (CUID, determinístico). Antes: Únicos ordenaba por `occurredAt` descendente y Fijos / Cuotas no tenían orden garantizado. Impacta RF-VM-001, `docs/screens.md` (pantalla 4), `docs/backend.md` (`GET /movements`) y `docs/data-model.md` (contrato de `/movements`). **No** cambia el bucketeo por mes, los totales ni ningún otro requerimiento. Motivo: ordenar por monto pone primero los movimientos más relevantes para entender en qué se va el dinero del mes.

**2026-06-15 — Mecanismo de preferencias de usuario como cimiento (fase 1.1.0, ST1).** Se introduce un mecanismo de persistencia de **preferencias de usuario** que sobrevive a la navegación y al cierre de sesión, como **cimiento** de v1.1 — **sin UI de producto** en esta fase. Lo consumen fases posteriores: secciones colapsadas / orden de `/mes` (1.1.4), reportes configurables (1.1.5) y filtro por categoría en `/mes` (1.1.6). Decisiones cerradas:

1. **Entidad `UserPreferences`: una fila por usuario, contenido en blob JSON.** 1:1 con `User` (`userId` único, `onDelete: Cascade`), con un único campo `data` (JSON, default `{}`) en lugar de una columna por preferencia. **Motivo del blob:** sumar preferencias futuras **sin migraciones** de esquema. El objeto es **abierto/extensible**; en 1.1.0 está **vacío** (las claves las agregan las fases consumidoras).

2. **Carga en la sesión al loguear; persistencia al mutar.** El blob se incluye en el `AuthResponse` de los tres flujos (`/auth/login`, `/auth/register`, `/auth/google`) como tercer campo `preferences`, y el frontend lo carga **una vez** en la sesión de Auth.js (viaja en `Session` / `User` / `JWT`). Las mutaciones se hacen contra **`PUT /preferences`** (no re-logueando) y refrescan la sesión vía `useSession().update()`.

3. **Endpoints `GET /preferences` / `PUT /preferences` (JWT requerido).** `GET` devuelve el blob (`{}` si no hay fila). `PUT` recibe `{ data: <objeto plano> }` y hace **upsert** con **semántica de reemplazo completo (no merge):** el server guarda el blob entero recibido; **el frontend manda el blob completo** y hace el merge del lado cliente. `400` si `data` falta o no es objeto.

4. **Back-compat de usuarios viejos sin fila.** La fila **no se crea en lectura**: `GET /preferences` y el armado del `AuthResponse` devuelven `{}` sin materializarla. Se crea en el `PUT` (upsert) o en el alta de cuenta nueva (junto a las categorías por defecto).

**Alcance v1.1.0:** exactamente el mecanismo descripto — **no** se definen claves de preferencias ni features de producto (eso llega con 1.1.4 / 1.1.5 / 1.1.6). No se agrega un RF en este punto: la fase es infraestructura de datos/sesión sin comportamiento observable por el usuario (igual criterio que otras piezas de cimiento); los RF correspondientes nacerán con las fases consumidoras, que sí definen comportamiento de pantalla. Impacta `docs/data-model.md` (nueva entidad + contratos + `AuthResponse`), `docs/backend.md` (módulo `preferences`, `buildAuthResult` async, gotchas) y `docs/frontend.md` (preferencias en la sesión, hook `usePreferences`). Motivo: construir primero el cimiento que varias fases de v1.1 consumen evita rehacer esas fases, y el blob JSON deja sumar preferencias sin migraciones.

**2026-06-16 — Color de categoría editable desde una matriz de colores — Fase 1.1.2 (REABRE RF-CAT-005, RN-013).** Se **reabre una decisión cerrada de v1.0**: el color de categoría pasa de **"asignado automáticamente y NO editable"** (entrada 2026-06-04, "Color de categoría desde pool fijo, no editable en v1") a **elegible y editable por el usuario**. Decisiones cerradas:

1. **El usuario elige y edita el color**, tanto al **crear** como al **editar** la categoría, desde una **matriz fija de 70 colores** (7 tonalidades × 10 hues, estilo Office). **No** hay hex libre: solo colores de la matriz.

2. **Default al crear: el color "menos usado".** Al abrir el alta, el sistema **pre-selecciona** el color menos usado entre las categorías activas del usuario, calculado sobre los **10 colores base** (la fila base de la matriz, que coincide con el pool de 10 de v1.0). El usuario puede dejar ese default o elegir otro. Hay además un botón **"aleatorio"** que toma un color al azar de la matriz.

3. **El color sigue siendo solo de presentación** (no afecta montos ni scope). Las **categorías por defecto del alta** (RF-CAT-001) se siguen asignando automáticamente (el alta no tiene UI de elección de color).

4. **Back-compat:** los colores preexistentes son todos de la fila base (los 10 de v1.0), que es un subconjunto de la matriz de 70 — ya pertenecen a ella, sin migración de datos.

**Contrato:** `POST /categories` y `PATCH /categories/:id` ahora **aceptan** `color?: string` opcional, validado contra la matriz de 70 (case-insensitive, se almacena en mayúsculas); fuera de la matriz → `400`. En `POST` sin color, el backend asigna el menos-usado como red de seguridad (el frontend igualmente siempre lo envía). Impacta RF-CAT-005 (reabierto), RF-CAT-002 y RF-CAT-003 (criterios de color), RN-013, `docs/screens.md` (pantalla 6, modal crear/editar con picker de matriz), `docs/data-model.md` (pool/matriz + contrato de categoría), `docs/backend.md` (`COLOR_MATRIX`, validación en DTOs) y `docs/frontend.md` (`ColorPicker`, paleta espejada). `docs/design.md` lo cubre `control-design`. Motivo: el usuario quiere identificar sus categorías con un color propio en vez de aceptar el asignado; la matriz acota la elección a una paleta coherente sin abrir hex libre.

**2026-06-15 — Forma 2 del gráfico anual muestra todas las categorías sin agrupar (RF-GRA-001).** Se cierra una decisión de producto sobre la **Forma 2 (gastos por categoría, apilado)** del gráfico anual: en **v1 se muestran TODAS las categorías con gasto, sin agrupar ni colapsar** ninguna en una banda "Otras", sin tope de categorías visibles. Esto es **fiel a RF-GRA-001**, que ya definía "una banda por categoría" sin límite. La decisión surgió porque `control-design`, por legibilidad cuando hay muchas categorías (más de 8), había propuesto agrupar la cola en una banda "Otras"; el usuario decidió **NO** hacerlo en v1. La agrupación "Otras" / colapso de la cola de categorías queda como **candidato post-v1** (anotado en `docs/features.md`, Roadmap post v1). Se agrega un criterio de aceptación a RF-GRA-001 dejándolo explícito. Impacta RF-GRA-001 y `docs/features.md`. **No** impacta `docs/screens.md`, `docs/design.md`, `docs/backend.md` ni `docs/data-model.md`, ni el código. Motivo: respetar el requerimiento ya escrito (sin tope de bandas) y no introducir en v1 una agrupación que aún no está definida en su UX; la legibilidad con muchas categorías se evaluará después.
