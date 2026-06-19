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
| 1.1.7 | 2026-06-17 | Movimientos calculados: fijo cuyo monto se deriva en vivo de otro fijo de origen vía fórmula (submódulo 3.4.b, RF-MCALC-001..007). Nuevas RN-017 (fórmula + redondeo), RN-018 (signo; monto ≤ 0 como excepción a RN-001) y RN-019 (imputación con signo a totales/reportes). Fase 1.1.7. |
| 1.1.8 | 2026-06-19 | Calculados con origen único o cuota: el origen de un calculado puede ser un movimiento único o un grupo de cuotas, además de un fijo (RF-MCALC-008/009/010; ajusta RF-MCALC-001/004/005/006). Cadencia espejo del origen; borrado total (no por split) para calculados de único/cuota. Fase 1.1.8. |

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

### 3.4.b Submódulo: Movimientos calculados (Fase 1.1.7)

Un **movimiento calculado** es un movimiento **fijo** cuyo monto **no se ingresa**: se **deriva** del monto de un **movimiento de origen** mediante una **fórmula**, **en vivo**. Tiene categoría y descripción **propias**; su **tipo** (Gasto/Ingreso) **no se elige**: se **deriva** del signo del monto resultante (RF-MCALC-003). Lo único que toma del origen es el **monto**. El **origen puede ser un fijo, un único o un grupo de cuotas** (RF-MCALC-008); el calculado **espeja la cadencia** del origen (Fase 1.1.8). Es un fijo a todos los demás efectos (se edita y elimina con la misma mecánica de split del calculado de fijo, salvo el borrado total del calculado de único/cuota — RF-MCALC-006). No es un tipo nuevo en el formulario de carga: su **único** punto de creación es la acción "crear movimiento desde este" sobre un fijo, único o cuota en `/mes` (RF-MCALC-001).

---

#### RF-MCALC-001 — Crear movimiento calculado desde un movimiento de origen

| Campo | Detalle |
|---|---|
| **Descripción** | Desde la Vista del mes (`/mes`), un ítem **fijo, único o cuota** ofrece —además de editar y eliminar— la acción **"crear movimiento desde este"**. Es la **única** forma de crear un movimiento calculado: define el movimiento de origen, su categoría/descripción propias y la fórmula (con su signo) que deriva el monto; el **tipo** queda determinado por el signo del resultado (RF-MCALC-003). El **tipo de origen** (fijo / único / cuota) determina la cadencia del calculado (RF-MCALC-008). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe un movimiento **fijo, único o de cuotas** en el mes visualizado, propio del usuario. El origen **no** es a su vez un movimiento calculado (sin encadenamiento). |

**Flujo principal:**
1. El usuario, parado en un mes en `/mes`, abre el menú de acciones de un ítem **fijo, único o cuota** y elige **"crear movimiento desde este"**.
2. El sistema abre el formulario del calculado, con el movimiento de origen ya fijado (el ítem desde el que se disparó).
3. El usuario elige **categoría** y **descripción** propias del calculado (independientes del origen). **No** elige tipo: se deriva del signo del resultado (RF-MCALC-003).
4. El usuario define la **fórmula**: un **operador** (`+`, `−`, `×`, `÷`, `%`) y un **operando** numérico común (RN-017).
5. El usuario elige el **signo del resultado** (positivo o negativo) mediante el switch de signo (RN-018).
6. El usuario confirma. El sistema crea el movimiento calculado como un fijo vinculado al **origen** (RF-MCALC-004), con su monto ya derivado para cada mes en que el origen aparece y su **tipo derivado** del signo de ese monto, siguiendo la **cadencia del origen** (RF-MCALC-008).

**Flujos alternativos:**
- *A1 — El usuario cancela:* no se crea nada.

**Criterios de aceptación:**
- [ ] La acción **"crear movimiento desde este"** está disponible en los ítems **fijo, único y cuota** de `/mes` (Fase 1.1.8; hasta 1.1.7 era solo fijos).
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
- [ ] Si el origen **fijo** se **anula en un mes puntual** (skip, RF-MF-005), el calculado **se anula ese mes**: se sigue listando pero no suma a los totales ni a la serie anual, igual que el origen.
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

#### RF-MCALC-008 — Origen único o cuota; cadencia espejo del origen (Fase 1.1.8)

| Campo | Detalle |
|---|---|
| **Descripción** | El **origen** de un calculado puede ser un **fijo**, un **único** o un **grupo de cuotas** (hasta 1.1.7 era solo fijo). El calculado **espeja la cadencia del origen**: aparece en los mismos meses que el origen, derivando del monto del origen en cada uno. La derivación es **en vivo** para los tres tipos (RF-MCALC-004): editar el monto del origen recalcula el calculado en la próxima lectura, sin persistir el monto. |
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

#### RF-MCALC-009 — Borrado total del calculado de único o cuota (Fase 1.1.8)

| Campo | Detalle |
|---|---|
| **Descripción** | Un único y un grupo de cuotas **no se borran por mes** (no tienen split del pasado); por eso, el **borrado del propio calculado** de un origen único o cuota es **total y directo** —una sola confirmación, sin las opciones "desde este mes / desde el mes siguiente" del calculado de fijo—, espejando cómo se borra su origen. La **cascada** del borrado del origen (RF-MCALC-005) hacia su(s) calculado(s) es también **total**. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe un calculado de origen único o cuota. |

**Criterios de aceptación:**
- [ ] Borrar el **propio calculado** de un único/cuota: confirmación directa, borra el calculado **entero** (todas sus apariciones). No se ofrece elegir mes.
- [ ] Borrar el **origen** único/cuota: cascada **total** a su(s) calculado(s) (los borra enteros).
- [ ] El calculado de **fijo** conserva su borrado por **boundary** sobre la cadena (RF-MCALC-006) — sin cambios.

---

#### RF-MCALC-010 — Calculados de único y cuota en reportes (Fase 1.1.8)

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
| RN-017 | **Fórmula y redondeo del movimiento calculado (RF-MCALC-002).** El monto de un movimiento calculado se deriva del monto del fijo de origen **del mes en cuestión** aplicando **una** operación: un operador de `{ +, −, ×, ÷, % }` y un **operando** numérico común. El cálculo por operador es: `+` → `origen + operando`; `−` → `origen − operando`; `×` → `origen × operando`; `÷` → `origen ÷ operando`; `%` → `origen × operando ÷ 100`. El **operando 0 no se acepta** en `÷` ni en `%` (división por cero); el resto acepta cualquier operando numérico. El resultado se **redondea a centavos enteros** (`round`, mantiene RN-002): **no** se persiste ni propaga precisión sub-centavo. La presentación siempre muestra 2 decimales. El signo final lo aplica RN-018, no la fórmula. El cálculo es **on-the-fly por mes** (RN-006): el monto **no se persiste**, se deriva al vuelo del origen en cada lectura, así que sigue automáticamente cualquier cambio del origen (RF-MCALC-004). |
| RN-018 | **Signo, monto y tipo derivado del movimiento calculado — excepción a RN-001 (RF-MCALC-003).** El movimiento calculado tiene un **switch de signo** que multiplica el resultado de la fórmula por `+1` o `−1`. Por eso su `amountCents` **puede ser negativo o cero**, a diferencia de todo otro movimiento (RN-001, monto > 0). Esta excepción aplica **únicamente** a movimientos calculados; únicos, fijos "normales" y cuotas siguen exigiendo monto > 0. El `type` (`EXPENSE`/`INCOME`) **no se elige**: se **deriva del signo del monto final** —`final < 0` → `EXPENSE`; `final > 0` → `INCOME`; `final == 0` → `EXPENSE` por convención de borde (no afecta totales, RN-019)—. Así signo y tipo son siempre consistentes (positivo = ingreso, negativo = gasto). |
| RN-019 | **Imputación a totales y reportes por el tipo derivado (RF-MCALC-003).** Cada movimiento suma su **magnitud** (`\|amountCents\|`) al bucket que le corresponde **según su `type`**: un `INCOME` suma a `incomeCents`; un `EXPENSE`, a `expenseCents`. Para movimientos normales el `type` es fijo y `amountCents > 0`. Para un **calculado**, como el `type` se deriva del signo del monto (RN-018), la imputación queda siempre consistente: un calculado de monto `−2000` es `EXPENSE` (tipo derivado) y suma **2000** a `expenseCents`; uno de `+2000` es `INCOME` y suma **2000** a `incomeCents`; un monto 0 no aporta a ningún bucket. No hay restas a un bucket ni reasignación: signo y tipo nunca se contradicen. El balance del mes (`incomeCents − expenseCents`, RF-VM-002 / RF-DASH-002) y la serie anual de reportes (RF-REP-001, ambas formas) se calculan con esta suma de magnitudes, sin lógica especial. En la Forma 2 de reportes (gastos apilados por categoría) la banda de la categoría de un calculado `EXPENSE` suma su magnitud, preservando la invariante "suma de bandas del mes = `expenseCents` del mes" (`docs/data-model.md`, §Contrato de serie de reportes). |

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
| Movimiento calculado | Movimiento **fijo** cuyo monto no se ingresa: se deriva al vuelo del monto de un movimiento de origen mediante una fórmula (operador + operando) con signo. El **origen puede ser un fijo, un único o un grupo de cuotas** (RF-MCALC-008); el calculado espeja la cadencia del origen (de cuota deriva del monto por cuota). Tiene categoría y descripción propias; su **tipo (Gasto/Ingreso) se deriva del signo del monto** (negativo → Gasto, positivo → Ingreso). Puede tener monto negativo o cero. Sigue el ciclo de vida del origen; el calculado de único/cuota se borra de forma total (RF-MCALC-009). Ver submódulo 3.4.b (RF-MCALC-001..010), RN-017/018/019. |
| Identidad de cadena de un fijo | Identificador estable, compartido por todas las filas `Recurring` de un mismo fijo lógico, que sobrevive a los splits del pasado. Es a lo que se vincula un movimiento calculado (no a una fila puntual). Ver `docs/data-model.md`, §Identidad de cadena estable. |
| Movimiento fijo | Plantilla recurrente mensual activa hasta que el usuario la elimina. Sin día específico dentro del mes. |
| Movimiento único | Movimiento que ocurrió en un instante específico (fecha y hora), una sola vez. Se almacena en UTC junto con su zona horaria original; ver RN-011. |
| Scope de categoría | Indica a qué tipo de movimiento aplica la categoría: `BOTH`, `EXPENSE`, o `INCOME`. |
| Soft delete | Eliminación lógica: el registro se marca con `deletedAt` pero no se borra físicamente. |
| `startMonth` | Primer día del mes a partir del cual un movimiento fijo o grupo de cuotas comienza a aparecer. |

---

## 8. Bitácora de decisiones

El registro histórico de decisiones vive en [`docs/decisions.md`](decisions.md).
