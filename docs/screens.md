# Definiciones de pantalla — Control v1.0

> Documento funcional de pantallas. Describe qué muestra cada pantalla, qué acciones expone y cómo se conecta con el resto. **No incluye diseño visual** (colores, tipografías, layouts, breakpoints) — eso es responsabilidad de `control-design` (ver `docs/design.md`).
>
> Para los requerimientos funcionales completos ver `requirements.md`. Para el modelo de datos ver `data-model.md`.

---

## Índice

1. [Login (`/login`)](#1-login-login)
2. [Registro (`/registro`)](#2-registro-registro)
3. [Dashboard (`/`)](#3-dashboard-)
4. [Vista del mes (`/mes`)](#4-vista-del-mes-mes)
5. [Formulario de carga de movimiento (modal)](#5-formulario-de-carga-de-movimiento-modal)
6. [Gestión de categorías (`/categorias`)](#6-gestión-de-categorías-categorias)

---

## Convenciones

- El **sidebar** (RF-NAV-001) está presente en todas las pantallas autenticadas (Dashboard, Vista del mes, Categorías) y **no** se muestra en las pantallas no autenticadas (Login, Registro). Su definición vive en RF-NAV-001 y no se repite en cada pantalla; solo se indica qué link queda marcado como activo.
  - **Estado de implementación (2026-06-09): pendiente / diferido.** El sidebar **todavía no está implementado** — su construcción se difirió a una fase posterior (ver bitácora de `requirements.md`, 2026-06-09). La definición de abajo describe el estado objetivo y **no cambia**. Mientras tanto, la navegación entre Dashboard (`/`), Vista del mes (`/mes`) y Categorías (`/categorias`) se hace por los **accesos definidos en cada pantalla** (enlace "Ver todos" del dashboard, acción "Ir a ver" del toast post-guardado, URL directa). Donde una pantalla menciona el "Sidebar" en su contenido o acciones, léase como pendiente hasta que RF-NAV-001 se implemente.
- El **formulario de carga** (pantalla 5) es un modal sin ruta propia. Se invoca desde el sidebar y desde el dashboard, y se superpone a la pantalla actual.

---

## 1. Login (`/login`)

**RF relacionados:** RF-AUTH-001, RF-AUTH-002, RF-AUTH-005

### Propósito

Punto de entrada de la aplicación para usuarios sin sesión. Permite iniciar sesión por cualquiera de los dos métodos: email + contraseña, o Google. Da acceso a la pantalla de registro para quienes no tienen cuenta. Junto con Registro, es una de las pantallas accesibles sin autenticación.

### Contenido

- Logo / nombre "Control".
- **Formulario de email + contraseña:** campo email, campo contraseña y botón "Iniciar sesión" (RF-AUTH-005).
- **Botón "Iniciar sesión con Google"** (RF-AUTH-001).
- **Enlace a la pantalla de registro** ("Crear cuenta" o equivalente) hacia `/registro`.

No muestra el sidebar.

### Acciones disponibles

- **Iniciar sesión con email y contraseña** — valida los campos y envía las credenciales al backend para verificación (RF-AUTH-005).
- **Iniciar sesión con Google** — dispara el flujo OAuth de Google (RF-AUTH-001).
- **Ir a registro** — navega a `/registro` (RF-AUTH-006).

### Navegación

- **Llega desde:** acceso directo a `/login`; redirección automática cuando un usuario sin sesión intenta entrar a una ruta protegida (RF-AUTH-002); enlace "Volver al login" desde la pantalla de registro.
- **Lleva a:** Dashboard (`/`) tras autenticarse con éxito por cualquiera de los dos métodos. Si el ingreso se originó por intentar acceder a una ruta protegida, lleva a la ruta original solicitada. Pantalla de registro (`/registro`) vía el enlace de creación de cuenta.
- **Redirección de usuario ya autenticado:** si un usuario con sesión activa navega a `/login`, el sistema lo redirige automáticamente al Dashboard sin mostrar esta pantalla.

### Estados

- **Inicial:** logo, formulario de email + contraseña, botón de Google y enlace a registro.
- **Validación con error (email/contraseña):** email con formato inválido o campos incompletos — se muestra el error y no se envía la request (RF-AUTH-005, A2).
- **Credenciales inválidas (A1):** se muestra un mensaje de error **genérico** que no revela si falló el email o la contraseña; permite reintentar conservando el email ingresado.
- **Cargando / en proceso:** el sistema está verificando las credenciales contra el backend, o redirigiendo/procesando la respuesta de Google.
- **Cancelado por el usuario en Google (RF-AUTH-001 A1):** vuelve a mostrar la pantalla de login.
- **Error en el flujo OAuth (RF-AUTH-001 A2):** se muestra un mensaje de error y se permite reintentar.
- **Error del backend en login con credenciales (RF-AUTH-005 A3):** se informa el error y se permite reintentar sin perder el email ingresado.

---

## 2. Registro (`/registro`)

**RF relacionados:** RF-AUTH-006, RF-AUTH-002, RF-CAT-001

### Propósito

Pantalla de alta de cuenta con email + contraseña para usuarios sin sesión. Crea una cuenta nueva y, tras el registro exitoso, deja al usuario logueado en el dashboard. Junto con Login, es una de las pantallas accesibles sin autenticación.

### Contenido

- Logo / nombre "Control".
- **Formulario de registro:** campo email, campo contraseña y campo de confirmación de contraseña.
- **Botón "Registrarme"** (o equivalente).
- **Enlace de vuelta al login** ("Ya tengo cuenta" o equivalente) hacia `/login`.

No muestra el sidebar.

### Acciones disponibles

- **Registrarme** — valida los campos (email válido, contraseña de mínimo 8 caracteres, confirmación coincidente) y envía los datos al backend, que crea el usuario con la contraseña hasheada y genera las categorías por defecto (RF-AUTH-006, RF-CAT-001).
- **Volver al login** — navega a `/login`.

### Navegación

- **Llega desde:** enlace de creación de cuenta desde la pantalla de login; acceso directo a `/registro`.
- **Lleva a:** Dashboard (`/`) tras un registro exitoso, con el usuario ya logueado y sin pasar por el login. Login (`/login`) vía el enlace de vuelta.
- **Redirección de usuario ya autenticado:** un usuario con sesión activa que navega a `/registro` es redirigido al Dashboard (mismo criterio que `/login`).

### Estados

- **Inicial:** formulario de registro vacío.
- **Validación con error:** email con formato inválido, campos incompletos, contraseña de menos de 8 caracteres, o confirmación que no coincide — se muestra el error y no se envía la request (RF-AUTH-006, A2/A3/A4).
- **Email duplicado (A1):** el backend rechaza el alta porque el email ya está registrado; se muestra el error indicando que el email ya está en uso y no se crea la cuenta.
- **Registrando:** el sistema está creando la cuenta en el backend.
- **Error del backend (A5):** se informa el error y se permite reintentar sin perder el email ingresado.

---

## 3. Dashboard (`/`)

**RF relacionados:** RF-DASH-001, RF-DASH-002, RF-DASH-003, RF-DASH-005

### Propósito

Pantalla de inicio tras autenticarse. Da el panorama financiero del mes actual y centraliza el acceso a la carga de movimientos y a la vista del mes. No reemplaza la vista del mes: no lista movimientos individuales.

### Contenido

- **Sidebar** con el link "Dashboard" marcado como activo.
- **Encabezado con el mes actual** (nombre del mes y año). Sin controles de navegación entre meses — el dashboard siempre muestra el mes en curso.
- **Resumen financiero del mes actual** (RF-DASH-002):
  - Total de gastos del mes.
  - Total de ingresos del mes.
  - Balance del mes (ingresos − gastos), con el positivo y el negativo diferenciables.
  - Los totales incluyen movimientos únicos, fijos activos en el mes y cuotas que caen en el mes.
- **Enlace "Ver todos"** (o equivalente) hacia la vista del mes (RF-DASH-005).

No muestra lista de movimientos (decisión 2026-06-03, ex RF-DASH-004 fuera de alcance).

### Acciones disponibles

- **Nuevo movimiento** — abre el modal de carga (pantalla 5). El acceso primario es el botón "Nuevo movimiento" del sidebar (RF-NAV-001); el dashboard también ofrece este acceso de carga.
- **Ver todos** — navega a la vista del mes, abierta en el mes actual.
- Acciones globales del sidebar (navegación entre secciones, menú de usuario, cerrar sesión).

### Navegación

- **Llega desde:** login exitoso; link "Dashboard" o logo "Control" del sidebar; redirección automática al autenticarse.
- **Lleva a:** Vista del mes (`/mes`) vía "Ver todos" o link del sidebar; modal de carga; Gestión de categorías y demás secciones vía sidebar.

### Estados

- **Cargando:** mientras se obtienen los totales del mes.
- **Con datos:** resumen financiero con totales calculados.
- **Vacío (sin movimientos en el mes):** los totales se muestran en cero. Se muestra un mensaje de estado vacío con un CTA "Cargá tu primer movimiento" que abre el modal de carga.
- **Error:** si falla la carga de los totales, se informa el error sin romper la pantalla.

---

## 4. Vista del mes (`/mes`)

**RF relacionados:** RF-VM-001, RF-VM-002, RF-VM-003, RF-VM-004

### Propósito

Lista completa de todos los movimientos del mes activo (únicos, fijos activos y cuotas que caen en el mes) con sus totales, y punto de acceso a editar y eliminar cada movimiento.

### Contenido

- **Sidebar** con el link "Vista del mes" marcado como activo.
- **Encabezado con el mes activo** (nombre del mes y año) y **controles de navegación** para ir al mes anterior y al mes siguiente (RF-VM-004).
- **Totales del mes** (RF-VM-002): total de gastos, total de ingresos y balance (ingresos − gastos), con positivo y negativo diferenciables. Se actualizan al agregar, editar o eliminar un movimiento.
- **Lista de movimientos agrupada por tipo** en tres secciones rotuladas, en este orden (RF-VM-001). Dentro de cada sección, los movimientos se ordenan por **monto descendente** (el monto más alto primero, por magnitud, sin distinguir gasto de ingreso). Ante montos iguales, el desempate por sección es: Únicos por fecha descendente; Fijos por fecha de creación descendente; Cuotas por identificador ascendente.
  1. **Únicos**.
  2. **Fijos** — sin día específico.
  3. **Cuotas** — sin día específico; cada cuota muestra su número y total (ej: "3/12").
  - Cada ítem muestra: tipo (gasto/ingreso), monto, categoría, descripción (si la tiene) y su origen (único / fijo / cuota X/N).
  - Una sección sin movimientos en el mes no se muestra (no aparece su rótulo vacío).

### Acciones disponibles

- **Navegar al mes anterior / siguiente** — actualiza lista y totales (RF-VM-004).
- **Editar** un ítem — abre el modal de carga en modo edición, en el tipo del movimiento (RF-VM-003 → RF-MU-002, RF-MF-003 o RF-MC-003 según el tipo). Al editar un **fijo**, el cambio se aplica **desde el mes activo (el mes que se está visualizando) en adelante**, preservando los meses anteriores: el mes activo es el pivote del split, no el mes actual real (RF-MF-003, RN-005; ver bitácora 2026-06-13).
- **Eliminar** un ítem — dispara el flujo de eliminación correspondiente al tipo (RF-MU-003 único, RF-MF-004 fijo, RF-MC-002 grupo de cuotas), con su confirmación específica. Al eliminar un **fijo**, la confirmación **no ofrece opciones** (ya no existe el checkbox "Eliminar también desde este mes"): la eliminación aplica siempre **desde el mes activo (el mes visualizado) inclusive en adelante**, preservando los meses anteriores — mismo pivote que la edición de fijos (RF-MF-004, RN-005; ver bitácora 2026-06-13). Si el mes activo es anterior o igual al mes de inicio del fijo, este se elimina por completo.
- **Nuevo movimiento** — abre el modal de carga (pantalla 5). Al abrirlo desde `/mes`, el **mes activo** se propaga al modal como **mes contexto**: es el default del "mes de inicio" en los tabs Fijo y Cuotas. No afecta al tab Único (ver pantalla 5).
- Acciones globales del sidebar.

### Navegación

- **Llega desde:** link "Vista del mes" del sidebar (siempre abre en el mes actual); enlace "Ver todos" del dashboard; acción "Ir a ver" del toast post-guardado (abre en el mes del movimiento recién cargado).
- **Lleva a:** modal de carga en modo edición; permanece en `/mes` tras editar/eliminar.
- **Mes de apertura:** al entrar desde el sidebar o el dashboard, siempre abre en el mes actual. La navegación prev/next cambia el mes activo dentro de la pantalla.

### Estados

- **Cargando:** mientras se obtienen movimientos y totales del mes activo.
- **Con datos:** secciones pobladas según el contenido del mes (solo se muestran las secciones con movimientos).
- **Vacío (sin movimientos en el mes):** la lista se muestra con un mensaje de estado vacío, sin error. Los totales se muestran en cero.
- **Error:** si falla la carga del mes, se informa el error sin romper la pantalla.

---

## 5. Formulario de carga de movimiento (modal)

**RF relacionados:** RF-CM-001, RF-MU-001, RF-MU-002, RF-MU-004, RF-MF-001, RF-MF-003, RF-MC-001, RF-MC-003, RF-CAT-002; RNF-008

### Propósito

Modal para crear o editar un movimiento. No tiene ruta propia: se superpone a la pantalla desde la que se invoca. Cubre los tres tipos de movimiento (único, fijo, cuotas).

### Contenido

**Modo creación:**

- Tres **tabs**: **Único**, **Fijo**, **Cuotas**. El tab **Único** está activo por defecto.
- Dentro del tipo seleccionado, el tipo de movimiento **Gasto** está seleccionado por defecto (frente a Ingreso).
- Campos según el tab activo:
  - **Único** (RF-MU-001): tipo (Gasto/Ingreso), monto, categoría, fecha y hora (default: el momento actual — fecha de hoy y hora actual al abrir el formulario en modo creación), descripción (opcional). El mes contexto **no** aplica al único: su default es siempre hoy/ahora, sin importar desde dónde se abra el modal.
  - **Fijo** (RF-MF-001): tipo (Gasto/Ingreso), monto, categoría, mes de inicio, descripción (opcional). Sin fecha de día. El mes de inicio tiene como default el **mes contexto** si el modal se abrió desde la Vista del mes (`/mes`), o el **mes actual** en cualquier otro origen (dashboard, sidebar). Es editable y admite meses pasados.
  - **Cuotas** (RF-MC-001): tipo (Gasto/Ingreso), monto por cuota, cantidad de cuotas, mes de inicio, categoría, descripción (opcional). El mes de inicio tiene como default el **mes contexto** si el modal se abrió desde la Vista del mes (`/mes`), o el **mes actual** en cualquier otro origen. Es editable y admite meses pasados.
- El selector de categorías se filtra según el tipo: para Gasto se muestran categorías con scope `EXPENSE` o `BOTH`; para Ingreso, scope `INCOME` o `BOTH` (RN-010). Las categorías con soft delete no aparecen.
- **Botón "+ Nueva" junto al selector de categoría** (RF-MU-004): abre el modal de creación de categoría (pantalla 6, RF-CAT-002) por encima del formulario, sin cerrar el formulario ni perder los datos ya cargados. Presente en los tres tabs (el campo categoría existe en todos). Ver "Acciones disponibles".

**Modo edición:**

- **No muestra los tabs de selección de tipo.** Abre directamente en el tipo del movimiento editado y solo expone los campos de ese tipo.
- Campos pre-cargados con los valores actuales del movimiento.
  - Único (RF-MU-002): todos los campos editables.
  - Fijo (RF-MF-003): monto, categoría, descripción. La edición aplica **desde el mes desde el que se abrió** (el mes activo de la Vista del mes) en adelante, sin tocar los meses anteriores a él (ver bitácora 2026-06-13).
  - Cuotas (RF-MC-003): monto por cuota, cantidad de cuotas, mes de inicio, categoría, descripción. La edición aplica al grupo completo.

### Acciones disponibles

- **Cambiar de tab** (solo en creación) — limpia el formulario; no conserva datos del tab anterior.
- **Seleccionar tipo** Gasto / Ingreso.
- **Guardar / Confirmar** — valida y persiste. Al guardar con éxito, el modal se cierra y aparece un toast de confirmación con la acción "Ir a ver" (RF-MU-001, RF-MF-001, RF-MC-001).
- **Crear categoría con "+ Nueva"** (RF-MU-004) — abre el modal de creación de categoría (RF-CAT-002) superpuesto al formulario, en **modo inline**. El formulario de carga queda montado por debajo y conserva los datos ya cargados. En este modo inline, el campo "Tipo" (scope) del modal **solo ofrece las opciones compatibles** con el tipo del movimiento en curso y **oculta el tipo opuesto**: Gasto → "Gasto" + "Ambos" (oculta "Ingreso"); Ingreso → "Ingreso" + "Ambos" (oculta "Gasto"). La opción pre-seleccionada es el tipo exacto del movimiento; el usuario puede cambiar a "Ambos" pero no al tipo opuesto. Al crear con éxito, el modal se cierra y la categoría recién creada queda **autoseleccionada** en el campo categoría (siempre es compatible, por la restricción anterior). Si el nombre choca con una categoría eliminada, se reutiliza el prompt de reactivación (RF-CAT-002 A3); al reactivar, la categoría reactivada también queda autoseleccionada. Cancelar el modal no crea ni reactiva nada y devuelve al formulario sin alterar sus datos ni la categoría seleccionada.
- **Cancelar / Cerrar** — cierra el modal sin guardar, desde cualquier tab.

### Navegación

- **Se invoca desde:** botón "Nuevo movimiento" del sidebar (cualquier pantalla autenticada); acceso de carga del dashboard; estado vacío del dashboard (CTA "Cargá tu primer movimiento"); acción editar de la vista del mes (modo edición).
- **Tras guardar:** el modal se cierra y el usuario permanece en la pantalla en la que estaba. El toast de confirmación ofrece "Ir a ver", que navega a la vista del mes del movimiento guardado (mes de la fecha en únicos; mes de inicio en fijos y cuotas). Si el usuario no interactúa con el toast, este desaparece y el usuario sigue en su pantalla.
- **Sin categorías disponibles:** si no existe ninguna categoría aplicable al tipo seleccionado, el formulario bloquea el guardado y ofrece un enlace a la pantalla de Gestión de categorías (`/categorias`) para crear una. (Independientemente de este caso, el botón "+ Nueva" junto al selector de categoría permite crear una categoría sin salir del formulario — RF-MU-004.)

### Estados

- **Creación inicial:** tab Único activo, tipo Gasto, fecha y hora en el momento actual, resto vacío.
- **Edición:** sin tabs, campos pre-cargados con los valores actuales.
- **Validación con error:** monto en cero/negativo/no numérico, cantidad de cuotas en cero/negativa, o categoría no seleccionada — se muestra el error y no se guarda.
- **Sin categorías disponibles:** estado de bloqueo con enlace a `/categorias`.
- **Modal de categoría superpuesto (RF-MU-004):** el modal de creación de categoría (pantalla 6) se muestra por encima del formulario de carga, que permanece montado y con sus datos intactos por debajo. Al cerrarse (por crear, reactivar o cancelar), el formulario vuelve a primer plano.
- **Guardando:** el modal indica que la operación está en curso.
- **Error del backend al guardar (RNF-008):** el modal permanece abierto, conserva los datos ingresados y permite reintentar sin perder información.

---

## 6. Gestión de categorías (`/categorias`)

**RF relacionados:** RF-CAT-001, RF-CAT-002, RF-CAT-003, RF-CAT-004, RF-CAT-005, RF-CAT-006, RF-MU-004

### Propósito

Pantalla dedicada para administrar las categorías del usuario: listar, crear, editar y eliminar. La creación y edición se resuelven mediante un modal dentro de esta pantalla.

### Contenido

- **Sidebar** con el link "Categorías" marcado como activo.
- **Lista de categorías activas** del usuario. Cada ítem muestra:
  - Color de la categoría (indicador visual, no editable; asignado automáticamente desde el pool fijo — RF-CAT-005).
  - Nombre de la categoría.
  - Scope (AMBOS / GASTO / INGRESO).
  - Contador **"N movimientos"** — cantidad de movimientos asociados a la categoría. Es un dato derivado de solo lectura (RF-CAT-006).
- Las categorías con soft delete (`deletedAt`) no aparecen en la lista.
- **Botón "Nueva categoría"** que abre el modal de creación.

### Acciones disponibles

- **Nueva categoría** — abre un modal vacío para crear (RF-CAT-002). Campos: nombre (obligatorio) y scope (default: AMBOS).
- **Editar** una categoría — abre el mismo modal pre-cargado con los valores actuales (RF-CAT-003). Campos editables: nombre y scope.
- **Eliminar** una categoría — solicita confirmación; al confirmar, aplica soft delete (`deletedAt = now`) y la categoría desaparece de la lista y de los selectores de nuevos movimientos (RF-CAT-004). Los movimientos históricos conservan la referencia.
- Acciones globales del sidebar.

### Modal de creación / edición

- **Creación (origen `/categorias`):** modal con campos vacíos; el campo "Tipo" (scope) ofrece las **tres** opciones (Gasto / Ingreso / Ambos) con **default "Ambos"**.
- **Creación desde el formulario de carga de movimiento — modo inline (RF-MU-004):** el mismo modal se abre también desde el botón "+ Nueva" del formulario de carga (pantalla 5). En este origen el campo "Tipo" (scope) se comporta **distinto**: **solo ofrece las opciones compatibles** con el tipo del movimiento en curso y **oculta el tipo opuesto** — Gasto → "Gasto" + "Ambos" (oculta "Ingreso"); Ingreso → "Ingreso" + "Ambos" (oculta "Gasto"). La opción **pre-seleccionada** es el tipo exacto del movimiento (no "Ambos"); el usuario puede pasar a "Ambos" pero no elegir el tipo opuesto. Al crear/reactivar con éxito el modal se cierra y la categoría queda autoseleccionada en el formulario de carga. El resto del comportamiento del modal (validaciones, prompt de reactivación) es idéntico. Esta diferencia de opciones aplica **solo** en modo inline; abierto desde `/categorias`, el scope conserva las tres opciones con default "Ambos".
- **Edición:** el mismo modal pre-cargado con nombre y scope actuales.
- **Validaciones:** el nombre es obligatorio y no puede estar vacío; no pueden coexistir dos categorías activas con el mismo nombre para el mismo usuario (RN-008).
- **Acciones:** Guardar (valida y persiste, cierra el modal) y Cancelar (cierra sin guardar).

### Navegación

- **Llega desde:** link "Categorías" del sidebar; enlace desde el formulario de carga cuando no hay categorías disponibles para el tipo en curso.
- **Modal invocado desde otra pantalla:** el modal de creación de categoría también se abre desde el botón "+ Nueva" del formulario de carga de movimiento (pantalla 5, RF-MU-004), superpuesto a ese formulario y **sin** navegar a `/categorias`.
- **Lleva a:** permanece en `/categorias` tras crear, editar o eliminar.

### Estados

- **Cargando:** mientras se obtiene la lista de categorías.
- **Con datos:** lista de categorías activas con su color, nombre, scope y contador de movimientos.
- **Vacío (sin categorías activas):** se muestra un mensaje de estado vacío. (Nota: una cuenta nueva nace con categorías por defecto — RF-CAT-001 — por lo que el vacío total ocurre solo si el usuario eliminó todas).
- **Modal con error de validación:** nombre vacío o nombre duplicado — se muestra el error y no se guarda.
- **Error del backend al guardar (RNF-008):** el modal permanece abierto, conserva los datos y permite reintentar.
- **Confirmación de eliminación:** se pide confirmar antes de aplicar el soft delete; cancelar deja la categoría sin cambios.
