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
6. [Categorías — sección de Configuración (`/configuracion/categorias`)](#6-categorías--sección-de-configuración-configuracioncategorias)
7. [Reportes (pantalla configurable)](#7-reportes-pantalla-configurable)
8. [Widget de reporte autónomo (componente reutilizable)](#8-widget-de-reporte-autónomo-componente-reutilizable)
9. [Configuración (`/configuracion`)](#9-configuración-configuracion)
10. [Métodos de pago — sección de Configuración (`/configuracion/metodos-pago`)](#10-métodos-de-pago--sección-de-configuración-configuracionmetodos-pago)
11. [Historial de cambios (`/historial`)](#11-historial-de-cambios-historial)

---

## Convenciones

- El **sidebar** (RF-NAV-001) está presente en todas las pantallas autenticadas (Dashboard, Vista del mes, Reportes, Historial, y Configuración y sus secciones —Categorías, Métodos de pago, Límites—) y **no** se muestra en las pantallas no autenticadas (Login, Registro). Su definición vive en RF-NAV-001 y no se repite en cada pantalla; solo se indica qué link queda marcado como activo. **Tiene cinco links**, en este orden: Dashboard → Vista del mes → Reportes → Historial → Configuración. **Categorías y Métodos de pago no son links del sidebar**: se administran como secciones del hub de Configuración (§9), cada una en su ruta anidada deep-linkable (`/configuracion/categorias`, `/configuracion/metodos-pago`); estando en ellas, el link activo del sidebar es "Configuración". Aloja, en su parte inferior, el **control de modo de color** (toggle Sistema / Claro / Oscuro) sobre el menú de usuario (RF-APP-001).
  - **Estado de implementación: implementado.** El sidebar (RF-NAV-001) **ya está implementado** (ver `features.md`). Los accesos definidos en cada pantalla (enlace "Ver todos" del dashboard, acción "Ir a ver" del toast post-guardado, URL directa) se conservan y conviven con el sidebar.
- El **formulario de carga** (pantalla 5) es un modal sin ruta propia. Se invoca desde el sidebar y desde el dashboard, y se superpone a la pantalla actual.
- **Chip de moneda default en el header.** Las pantallas con montos/totales —**Dashboard**, **Vista del mes** y **Reportes**— muestran en su header (fila del eyebrow) un **chip indicador de la moneda default vigente** del usuario (código de la moneda del set curado: ARS / USD / EUR / BRL, RF-CUR-002). Es **informativo**: comunica en qué moneda están expresados los montos y totales de la pantalla y **linkea a `/configuracion`** (no cambia la moneda in-situ). Se muestra **siempre**, también en mono-moneda. **`/configuracion` NO lo lleva** (es donde la moneda se edita). El patrón es común a las tres pantallas y no se repite su definición en cada una; el detalle visual lo define `control-design` (ver `docs/design.md`).

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

**RF relacionados:** RF-DASH-001, RF-DASH-002, RF-DASH-003, RF-DASH-005, RF-REP-001, RF-REP-002

### Propósito

Pantalla de inicio tras autenticarse. Da el panorama financiero del mes actual y centraliza el acceso a la carga de movimientos y a la vista del mes. No reemplaza la vista del mes: no lista movimientos individuales.

### Contenido

- **Sidebar** con el link "Dashboard" marcado como activo.
- **Encabezado con el mes actual** (nombre del mes y año). Sin controles de navegación entre meses — el dashboard siempre muestra el mes en curso. Incluye el **chip de moneda default** del header (ver Convenciones).
- **Resumen financiero del mes actual** (RF-DASH-002):
  - Total de gastos del mes.
  - Total de ingresos del mes.
  - Balance del mes (ingresos − gastos), con el positivo y el negativo diferenciables.
  - Los totales incluyen movimientos únicos, fijos activos en el mes y cuotas que caen en el mes.
- **Enlace "Ver todos"** (o equivalente) hacia la vista del mes (RF-DASH-005).
- **Widget de reporte — Ingresos vs Gastos** (pantalla 8, RF-REP-001/RF-REP-002), montado en **modo efímero** (RF-DASH-001): abre en el **año en curso** con la **navegación de año ACTIVA** e independiente (flechas embebidas) y el **filtro de categorías** activo. Es **Total-only** (no tiene toggle de representación). El año y la selección de categorías del widget **no se persisten** — al recargar vuelve a año en curso + todas las categorías. Muestra, por mes del año seleccionado, el total de ingresos y el total de gastos. El tipo Gastos por categoría (`by-category`) **no** aparece en el dashboard; vive solo en la pantalla `/reportes` (pantalla 7). Navegar el año o filtrar categorías en este widget **no afecta** el resumen financiero mensual de arriba, que sigue fijo en el mes en curso (RF-DASH-002).

El **popover informativo de límites** (RF-LIM-005) **no** se monta en el Dashboard: ni el resumen mensual ni el widget Ingresos vs. Gastos lo exponen (solo vive en las cards de `/reportes` y en `/mes`).

No muestra lista de movimientos (decisión 2026-06-03, ex RF-DASH-004 fuera de alcance).

### Acciones disponibles

- **Nuevo movimiento** — abre el modal de carga (pantalla 5). El acceso primario es el botón "Nuevo movimiento" del sidebar (RF-NAV-001); el dashboard también ofrece este acceso de carga.
- **Ver todos** — navega a la vista del mes, abierta en el mes actual.
- Acciones globales del sidebar (navegación entre secciones, menú de usuario, cerrar sesión).

### Navegación

- **Llega desde:** login exitoso; link "Dashboard" o logo "Control" del sidebar; redirección automática al autenticarse.
- **Lleva a:** Vista del mes (`/mes`) vía "Ver todos" o link del sidebar; modal de carga; Reportes y Configuración vía sidebar.

### Estados

- **Cargando:** mientras se obtienen los totales del mes.
- **Con datos:** resumen financiero con totales calculados.
- **Vacío (sin movimientos en el mes):** los totales se muestran en cero. Se muestra un mensaje de estado vacío con un CTA "Cargá tu primer movimiento" que abre el modal de carga.
- **Error:** si falla la carga de los totales, se informa el error sin romper la pantalla.

---

## 4. Vista del mes (`/mes`)

**RF relacionados:** RF-VM-001, RF-VM-002, RF-VM-003, RF-VM-004, RF-VM-005, RF-VM-006, RF-VM-007, RF-MF-005, RF-MF-006, RF-MF-007, RF-CUR-005, RF-PM-006, RF-LIM-005

### Propósito

Lista completa de todos los movimientos del mes activo (únicos, fijos activos y cuotas que caen en el mes) con sus totales, y punto de acceso a editar y eliminar cada movimiento.

### Contenido

- **Sidebar** con el link "Vista del mes" marcado como activo.
- **Header de la pantalla** con el rótulo del mes activo: eyebrow "Tu mes", título con el nombre del mes y año, y sub-línea de estado ("Mes en curso" / "Histórico"). En la fila del eyebrow va el **chip de moneda default** (ver Convenciones). El botón **"+ Nuevo movimiento"** vive en este header, junto al botón **"Ordenar secciones"** que activa el modo orden (RF-VM-005; ver "Acciones disponibles").
- **Navegación de mes** para ir al mes anterior y al mes siguiente (RF-VM-004), resuelta como **flechas gigantes a los costados del contenido** (`‹ contenido ›`; ‹ = mes anterior, › = mes siguiente). En pantallas angostas/mobile el patrón **colapsa a un control compacto** (pill stepper) ubicado en el header. Es presentacional: la acción funcional (navegar ±1 mes) es la de RF-VM-004 y no cambia. La navegación es **ilimitada** (sin rango de año): las flechas / el stepper no se deshabilitan nunca.
- **Salto rápido de mes/año** (RF-VM-004): el **rótulo del mes** (título en desktop, centro del pill stepper en mobile) es un disparador que abre un **popover de dos ruedas** (mes y año) para saltar a cualquier mes/año; al confirmar con "Ir" navega como el avance secuencial. El "Ir" queda deshabilitado hasta que el año tenga 4 dígitos. El disparador **sigue accionable en modo orden** y el popover respeta la regla de no cerrar por click afuera (cierra por "Ir", "Cancelar", Esc o re-clic en el disparador). El spec visual lo define `control-design` (ver `docs/design.md`).
- **Popover informativo de límites** (RF-LIM-005): junto al rótulo del mes, un **ícono informativo** abre un popover de **solo lectura** que **lista los límites que observan esta vista** (keys `mes.*`), agrupados por naturaleza. El ícono se muestra **solo si hay ≥1 límite** (habilitado o no) sobre alguna key `mes.*`; con cero, no aparece. Cada ítem muestra el nombre del límite (o el rótulo de su anclaje), su condición (operador + umbral) y, si tiene refinamiento, la categoría o la sección que acota. Los límites **deshabilitados** se listan atenuados con la etiqueta **"Desactivado"**; los pasivos de alcance mes en curso llevan el qualifier **"Solo mes en curso"**. **Copy oficial:** caption **"Límites de esta vista"**; encabezados de grupo **"Marcan un dato"** (pasivos, RF-LIM-003) y **"Avisan al guardar"** (activos, RF-LIM-004; presente porque `/mes` es la única superficie con límites activos). No marca ni avisa: informa. El detalle visual lo define `control-design` (`docs/design.md`).
- **Totales del mes** (RF-VM-002): total de gastos, total de ingresos y balance (ingresos − gastos), con positivo y negativo diferenciables. Son la **suma de lo visible** tras aplicar los filtros por listado (RF-VM-006), expresada en la **moneda default vigente** del usuario (cada movimiento entra convertido — RF-CUR-005). Se actualizan al agregar, editar o eliminar un movimiento **y al cambiar cualquier filtro de sección**.
- **Filtros por listado** (RF-VM-006): cada una de las tres secciones tiene **sus propios** controles de filtro —un **filtro de tipo** (Gasto / Ingreso / **Ambos**, default Ambos) y un **filtro de categoría** (tres estados, default todas)— que filtran **solo esa sección**. El pill contador y el subtotal de cada sección reflejan lo filtrado; los totales del mes son la suma de lo visible en las tres. Los controles **no se muestran en modo orden** (RF-VM-005). El estado es **por pantalla** (no por mes): se mantiene al navegar entre meses y se persiste por usuario (clave `monthListFilters`, ver `data-model.md`). No es global: dashboard y reportes tienen su propio filtro. Detalle visual en `docs/design.md`. Ver "Acciones disponibles" y "Estados".
- **Lista de movimientos agrupada por tipo** en **tres secciones colapsables** (acordeón) rotuladas — **Únicos**, **Fijos**, **Cuotas** (RF-VM-001, RF-VM-005). El orden de las secciones es el default salvo que el usuario lo haya reordenado (RF-VM-005). Dentro de cada sección, los movimientos se ordenan por **monto descendente** (el monto más alto primero, por magnitud, sin distinguir gasto de ingreso), con el desempate por sección que define el contrato de `GET /movements` (ver `data-model.md`). En **Únicos**, el usuario puede alternar el orden entre **por monto** (default) y **por fecha** (más reciente primero) desde el control de orden de su cabecera (RF-VM-001); el orden se persiste. En **Fijos** y **Cuotas** el orden de ítems no es alterable.
  - **Las tres secciones se muestran siempre**, aunque estén vacías. Cada sección expone una **cabecera de grupo** (rótulo, contador de ítems, subtotal) que actúa como **disclosure**: clic en la cabecera expande/colapsa esa sección. Junto a la cabecera, fuera del modo orden, vive el disparador de filtro de la sección (tipo + categoría, RF-VM-006). La sección **Únicos** suma en su cabecera un **control de orden** (monto ↔ fecha, RF-VM-001) junto al filtro. Las **Cuotas** muestran, por ítem, su número y total (ej: "3/12"); los **Fijos**, sin día específico.
  - **Fila adelgazada — solo lo glanceable (RF-VM-001, RF-VM-007).** Cada fila muestra: tipo (gasto/ingreso), nombre, categoría, un **discriminador** en columna propia (fecha `DD Mmm` del único / "Cuota X/N" de la cuota / **vacía** para el fijo) y el **monto convertido dominante** en una sola línea. Los **fijos** y los **calculados de origen fijo** muestran además su **frecuencia** (rótulo según su valor 1..12, RF-MF-006) en la sublínea de identidad. Un fijo **anulado** para el mes (RF-MF-005) se sigue mostrando con su **diferenciación visual** de anulado (detalle en `docs/design.md`). El **detalle secundario** —método de pago, moneda/cotización/valor original, débito automático, hora del único, **arranque y vigencia del fijo** (RF-MF-007), plan de la cuota, fórmula del calculado— **no** va en la fila: se consulta en la **card de detalle** (RF-VM-007). El clic en el **cuerpo** de la fila abre esa card; el clic en el **kebab (⋮)** abre el menú de acciones rápidas.
  - **Moneda y conversión (RF-CUR-005):** el monto que domina en la fila es el **convertido a la moneda default vigente** (el que entra a los totales), en una sola línea. El **badge de moneda** (ARS / USD / EUR / BRL) y el **valor original** (monto + cotización de carga) del caso cross-rate (moneda del ítem ≠ default) viven en la **card de detalle** (RF-VM-007), no en la fila. En mono-moneda (moneda del ítem == default) no hay cross-rate que mostrar. Un **calculado** usa la moneda/cotización de su origen. El detalle visual lo define `docs/design.md`.
  - **Sección vacía:** muestra la cabecera completa (contador en 0, subtotal en $0) y un **mensaje de estado vacío inline propio** ("Sin movimientos únicos" / "Sin fijos" / "Sin cuotas"). No hay un mensaje de estado vacío global de la pantalla (ver "Estados"). El detalle visual del acordeón, las cabeceras y el modo orden lo define `control-design` (ver `docs/design.md`).

### Acciones disponibles

- **Navegar al mes anterior / siguiente** — actualiza lista y totales (RF-VM-004).
- **Saltar a un mes/año** — el rótulo del mes abre el popover de dos ruedas y, al confirmar, navega al mes elegido (RF-VM-004).
- **Ver detalle** de un ítem (RF-VM-007) — el clic en el **cuerpo** de una fila (o Enter/Espacio) abre la **card de detalle read-only** del movimiento, que muestra los datos que la fila no muestra (método de pago con días del crédito, moneda/cotización/valor original, débito automático, hora del único, vigencia del fijo, plan de la cuota, origen + fórmula del calculado y, cuando el ítem es **origen** de calculados, la lista de sus **derivados del mes** —nombre + monto, read-only—). La card es bidireccional origen ↔ derivados. Es **solo lectura pura**: no tiene footer de acción ni botón "Editar"; su única acción es cerrar (✕, Esc o clic en el scrim). El clic en el **kebab (⋮)** abre el menú de acciones rápidas y no abre la card.
- **Editar** un ítem — desde el **kebab (⋮)** de la fila; abre el modal de carga en modo edición, en el tipo del movimiento (RF-VM-003 → RF-MU-002, RF-MF-003 o RF-MC-003 según el tipo). Al editar un **fijo**, el cambio se aplica desde el **mes activo (el mes que se está visualizando) inclusive en adelante**, preservando los meses anteriores (pivote = mes visualizado, RF-MF-003 / RN-005).
- **Duplicar** un ítem (RF-VM-008) — desde el **kebab (⋮)**, en ítems **único, fijo y cuota no calculados**; abre el modal de carga en **modo creación**, sin tabs, precargado con los valores del original (editables). Guardar crea un movimiento **nuevo e independiente**; el original no se toca. La **card de detalle no ofrece esta acción** (es read-only pura).
- **Crear movimiento calculado** desde un ítem (RF-MCALC-001) — desde el **kebab (⋮)**, en ítems no calculados; abre el form del calculado con el origen fijado.
- **Eliminar** un ítem — dispara el flujo de eliminación correspondiente al tipo (RF-MU-003 único, RF-MF-004 fijo, RF-MC-002 grupo de cuotas), con su confirmación específica. Al eliminar un **fijo**, la confirmación **no ofrece opciones** y la eliminación aplica desde el **mes activo (el mes visualizado) inclusive en adelante**, mismo pivote que la edición (RF-MF-004 / RN-005). Editar y eliminar quedan registrados en el historial y se pueden **deshacer** desde `/historial` (§11, RF-HIST-001/003); ni el formulario de edición ni la confirmación de borrado exponen control o aviso alguno al respecto.
- **Anular / Des-anular este mes** (solo en ítems **fijos**, RF-MF-005) — en el menú de acciones del ítem fijo, además de Editar y Eliminar, una acción **toggle**: **"Anular este mes"** cancela esa aparición del fijo en el mes visualizado; sobre un fijo ya anulado se rotula **"Des-anular este mes"** y la revierte. El ítem anulado **se sigue mostrando** (no desaparece), deja de sumar a los totales del mes y tiene diferenciación visual. Los movimientos **únicos** y las **cuotas** no tienen esta acción. La anulación es por mes puntual y no afecta otros meses, a diferencia de Eliminar (RF-MF-005 / RN-016).
- **Nuevo movimiento** — abre el modal de carga (pantalla 5). Al abrirlo desde `/mes`, el **mes activo** se propaga al modal como **mes contexto**: es el default del "mes de inicio" en los tabs Fijo y Cuotas. No afecta al tab Único (ver pantalla 5). **En modo orden este botón se deshabilita** (RF-VM-005).
- **Colapsar / expandir una sección** (RF-VM-005) — clic en la cabecera de cualquiera de las tres secciones la expande o colapsa de forma individual. El estado se **persiste por usuario** (preferencias). Fuera del modo orden.
- **Ordenar secciones** (RF-VM-005) — un botón del header ("Ordenar secciones" / "Listo") activa/desactiva el **modo orden**. En modo orden el usuario **arrastra las secciones para reordenarlas entre sí** (no los ítems internos); el colapsar/expandir queda suspendido (la cabecera arrastra) y "+ Nuevo movimiento" se deshabilita. El orden se **aplica en vivo** y se **persiste por usuario**; no hay acción de cancelar. El shape de la preferencia (`monthSections`) está en `data-model.md`.
- **Filtrar una sección** (RF-VM-006) — abre el disparador de filtro de la sección y ajusta su **tipo** (Gasto / Ingreso / Ambos) y/o su **categoría** (tres estados: todas / subconjunto / ninguna); la lista de esa sección, su pill contador y su subtotal se recalculan al instante, y los totales del mes reflejan la suma de lo visible. Cada sección tiene controles independientes. El filtro de categoría de una sección lista **solo las categorías presentes en sus movimientos** (no el catálogo completo). **Ocultos en modo orden.** La selección persiste por usuario (clave `monthListFilters`) y se conserva al navegar de mes.
- **Ordenar la sección Únicos** (RF-VM-001) — el control de orden de la cabecera de **Únicos** alterna entre **por monto** (descendente, default) y **por fecha** (más reciente primero). Solo aplica a Únicos; el orden se persiste por usuario (clave `unicosSort`).
- **Ver los límites que observan la vista** (RF-LIM-005) — el ícono informativo junto al rótulo del mes abre el popover de solo lectura con el listado. Es informativo: no edita ni activa/desactiva límites (eso vive en `/configuracion/limites`).
- Acciones globales del sidebar.

### Navegación

- **Llega desde:** link "Vista del mes" del sidebar (siempre abre en el mes actual); enlace "Ver todos" del dashboard; acción "Ir a ver" del toast post-guardado (abre en el mes del movimiento recién cargado).
- **Lleva a:** modal de carga en modo edición y en modo duplicar; permanece en `/mes` tras editar/duplicar/eliminar.
- **Mes de apertura:** al entrar desde el sidebar o el dashboard, siempre abre en el mes actual. La navegación prev/next cambia el mes activo dentro de la pantalla.

### Estados

- **Cargando:** mientras se obtienen movimientos y totales del mes activo.
- **Con datos:** las **tres secciones siempre presentes** (RF-VM-005); las que tienen movimientos los listan, las vacías muestran su empty inline propio. Cada sección puede estar expandida o colapsada según la preferencia persistida del usuario. Un fijo **anulado** para el mes (RF-MF-005) se muestra con su diferenciación visual de anulado y no suma a los totales.
- **Modo orden activo (RF-VM-005):** las secciones se pueden arrastrar para reordenarlas; el colapsar/expandir queda suspendido y "+ Nuevo movimiento" deshabilitado. El orden se aplica en vivo y se persiste.
- **Vacío (sin movimientos en el mes):** **no hay un mensaje de estado vacío global**. Las tres secciones aparecen vacías, cada una con su empty inline propio ("Sin movimientos únicos" / "Sin fijos" / "Sin cuotas"), y los totales del mes en cero, sin error.
- **Filtros por listado aplicados (RF-VM-006):** cada sección refleja su filtro de tipo y de categoría; su pill y subtotal muestran lo filtrado y los totales del mes suman lo visible en las tres. Una sección cuyo filtro no matchea ningún movimiento (o con categoría en estado **"ninguna"**) queda vacía y no aporta a los totales (sin error). En **modo orden** los controles de filtro no se muestran.
- **Card de detalle abierta (RF-VM-007):** superpuesta a la pantalla, en modo solo lectura puro (sin acciones ni footer), sobre el movimiento clickeado. No tiene estado de carga, vacío ni error propios: presenta el dato que la lista ya tiene. Cierra con ✕, Esc o clic en el scrim.
- **Error:** si falla la carga del mes, se informa el error sin romper la pantalla.

---

## 5. Formulario de carga de movimiento (modal)

**RF relacionados:** RF-CM-001, RF-MU-001, RF-MU-002, RF-MU-004, RF-MF-001, RF-MF-003, RF-MF-006, RF-MC-001, RF-MC-003, RF-CAT-002, RF-CUR-001, RF-CUR-003, RF-CUR-004, RF-PM-006; RNF-008

### Propósito

Modal para crear o editar un movimiento. No tiene ruta propia: se superpone a la pantalla desde la que se invoca. Cubre los tres tipos de movimiento (único, fijo, cuotas).

### Contenido

**Modo creación:**

- Tres **tabs**: **Único**, **Fijo**, **Cuotas**. El tab **Único** está activo por defecto.
- Dentro del tipo seleccionado, el tipo de movimiento **Gasto** está seleccionado por defecto (frente a Ingreso).
- Campos según el tab activo:
  - **Único** (RF-MU-001): tipo (Gasto/Ingreso), monto, categoría, fecha y hora (default: el momento actual — fecha de hoy y hora actual al abrir el formulario en modo creación), descripción (opcional). El mes contexto **no** aplica al único: su default es siempre hoy/ahora, sin importar desde dónde se abra el modal.
  - **Fijo** (RF-MF-001, RF-MF-006): tipo (Gasto/Ingreso), monto, mes de inicio, **frecuencia**, categoría, descripción (opcional). Sin fecha de día. El mes de inicio tiene como default el **mes contexto** si el modal se abrió desde la Vista del mes (`/mes`), o el **mes actual** en cualquier otro origen (dashboard, sidebar). Es editable y admite meses pasados. La **frecuencia** es un selector de un **entero 1..12** (meses entre apariciones; default **1 = Mensual**), con los rótulos de RF-MF-006, y debajo una nota de recurrencia que se ajusta a la frecuencia elegida (ver "Estados"; el detalle visual está en `docs/design.md`). El selector aparece **solo al crear**; en edición la frecuencia es de solo lectura (inmutable, RF-MF-006).
  - **Cuotas** (RF-MC-001): tipo (Gasto/Ingreso), monto por cuota, cantidad de cuotas, mes de inicio, categoría, descripción (opcional). El mes de inicio tiene como default el **mes contexto** si el modal se abrió desde la Vista del mes (`/mes`), o el **mes actual** en cualquier otro origen. Es editable y admite meses pasados.
- El selector de categorías se filtra según el tipo: para Gasto se muestran categorías con scope `EXPENSE` o `BOTH`; para Ingreso, scope `INCOME` o `BOTH` (RN-010). Las categorías con soft delete no aparecen.
- **Botón "+ Nueva" junto al selector de categoría** (RF-MU-004): abre el modal de creación de categoría (pantalla 6, RF-CAT-002) por encima del formulario, sin cerrar el formulario ni perder los datos ya cargados. Presente en los tres tabs (el campo categoría existe en todos). Ver "Acciones disponibles".
- **Disclosure "Más opciones", último bloque del formulario** (después de todos los demás campos, justo antes de la fila de botones de acción) en los tabs **Único / Fijo / Cuotas**: un único bloque colapsable que agrupa **moneda + cotización** y **método de pago** (con su checkbox condicional). **Arranca colapsado** (también en edición); su resumen colapsado muestra la moneda —y la cotización si ≠ default— y, si hay método elegido, el ícono y nombre del método. El cromo lo define `docs/design.md` (§Disclosure "Más opciones" del form). Contenido:
  - **Moneda + cotización (RF-CUR-001/003/004/006):**
    - **Selector de moneda** del set curado: **ARS / USD / EUR / BRL**.
    - **Campo de cotización** (unidades de la default por 1 unidad de la moneda del movimiento): editable. **Se oculta cuando la moneda elegida coincide con la default** del usuario (cotización = 1). El label del par es **`{moneda del movimiento}→{default}`**. **Pre-cargado** con la **cotización de referencia del mes** (RF-CUR-003/006; fallback al último cambio usado si la tabla no tiene dato). Validación: cotización **> 0**.
    - **Copy de la nota del campo:** **"Cotización de referencia del mes"**.
    - **Granularidad del mes del pre-fill** según el tab (RF-CUR-004): en **Fijo**, el mes de aparición; en **Cuotas**, el `startMonth` del grupo; en **Único**, el mes del movimiento.
  - **Selector de método de pago (opcional)** (RF-PM-006): análogo al selector de categoría. Lista los métodos **activos** del usuario, admite **"(ninguno)"** / vacío y su **default es ninguno**. **No** tiene botón "+ Nueva" inline (a diferencia de categoría). Cada opción se identifica por su ícono, nombre y tipo.
  - **Checkbox "débito automático" (condicional)** (RF-PM-006, RN-021): un flag **del movimiento** que aparece **solo cuando el método elegido es de tipo Débito**; oculto para Crédito, Efectivo o sin método.
  - El tab/modo **Calculado** (creación desde el kebab de un movimiento) **no** muestra la sección "Más opciones": el calculado **hereda** del origen la moneda/cotización (RF-CUR-004), el método de pago y el `autoDebit` (RF-PM-006), sin poder editarlos ni tener propios.

**Modo edición:**

- **No muestra los tabs de selección de tipo.** Abre directamente en el tipo del movimiento editado y solo expone los campos de ese tipo.
- Campos pre-cargados con los valores actuales del movimiento.
  - Único (RF-MU-002): todos los campos editables.
  - Fijo (RF-MF-003): monto, categoría, descripción. La edición aplica desde el mes activo de la Vista del mes inclusive en adelante, sin tocar los meses anteriores (pivote = mes visualizado, RN-005). La **frecuencia** se muestra de **solo lectura**: no es editable tras crear el fijo (RF-MF-006).
  - Cuotas (RF-MC-003): monto por cuota, cantidad de cuotas, mes de inicio, categoría, descripción. La edición aplica al grupo completo.

**Modo duplicar (RF-VM-008):**

- Se invoca desde la acción **"Duplicar"** del kebab de `/mes`. **No muestra los tabs**: abre en el tipo del movimiento original con los campos de ese tipo, **precargados con sus valores** (incluidos fecha/hora o mes de inicio originales y la cotización del original) y **todos editables**.
- Es un **alta**, no una edición: al confirmar se crea un movimiento nuevo, con las mismas validaciones y el mismo toast de creación de ese tipo. Detalle de qué se copia, en RF-VM-008.

### Acciones disponibles

- **Cambiar de tab** (solo en creación) — limpia el formulario; no conserva datos del tab anterior.
- **Seleccionar tipo** Gasto / Ingreso.
- **Guardar / Confirmar** — valida y persiste. Al guardar con éxito, el modal se cierra y aparece un toast de confirmación con la acción "Ir a ver" (RF-MU-001, RF-MF-001, RF-MC-001). Si la proyección del movimiento cruzaría uno o más límites **activos** (RF-LIM-004), antes de persistir se intercala un **diálogo de aviso** no bloqueante (ver Estados); aplica a los cuatro forms (único / fijo / cuota / calculado).
- **Crear categoría con "+ Nueva"** (RF-MU-004) — abre el modal de creación de categoría (RF-CAT-002) superpuesto al formulario, en **modo inline**: el formulario de carga queda montado por debajo conservando sus datos, el campo "Tipo" (scope) del modal solo ofrece las opciones compatibles con el tipo del movimiento (oculta el tipo opuesto, pre-selecciona el tipo exacto) y, al crear o reactivar con éxito, la categoría queda **autoseleccionada** en el campo categoría. Detalle del flujo, la restricción de scope y el caso de reactivación (RF-CAT-002 A3) en RF-MU-004. Cancelar no crea ni reactiva nada y devuelve al formulario sin alterar sus datos ni la categoría seleccionada.
- **Cancelar / Cerrar** — cierra el modal sin guardar, desde cualquier tab.

### Navegación

- **Se invoca desde:** botón "Nuevo movimiento" del sidebar (cualquier pantalla autenticada); acceso de carga del dashboard; estado vacío del dashboard (CTA "Cargá tu primer movimiento"); acción editar de la vista del mes (modo edición).
- **Tras guardar:** el modal se cierra y el usuario permanece en la pantalla en la que estaba. El toast de confirmación ofrece "Ir a ver", que navega a la vista del mes del movimiento guardado (mes de la fecha en únicos; mes de inicio en fijos y cuotas). Si el usuario no interactúa con el toast, este desaparece y el usuario sigue en su pantalla.
- **Sin categorías disponibles:** si no existe ninguna categoría aplicable al tipo seleccionado, el formulario bloquea el guardado y ofrece un enlace a la sección Categorías del hub de Configuración (`/configuracion/categorias`) para crear una. (Independientemente de este caso, el botón "+ Nueva" junto al selector de categoría permite crear una categoría sin salir del formulario — RF-MU-004.)

### Estados

- **Creación inicial:** tab Único activo, tipo Gasto, fecha y hora en el momento actual, resto vacío.
- **Tab Fijo, nota de recurrencia (solo en creación):** debajo de la categoría, una nota se ajusta a la frecuencia elegida (1..12 meses) — *"Se registra automáticamente {cada mes / cada N meses / cada año} a partir del mes de inicio."* (RF-MF-006).
- **Edición:** sin tabs, campos pre-cargados con los valores actuales. En el tab Fijo, la **frecuencia** aparece de solo lectura.
- **Validación con error:** monto en cero/negativo/no numérico, cantidad de cuotas en cero/negativa, o categoría no seleccionada — se muestra el error y no se guarda.
- **Sin categorías disponibles:** estado de bloqueo con enlace a la sección Categorías de Configuración (`/configuracion/categorias`).
- **Modal de categoría superpuesto (RF-MU-004):** el modal de creación de categoría (pantalla 6) se muestra por encima del formulario de carga, que permanece montado y con sus datos intactos por debajo. Al cerrarse (por crear, reactivar o cancelar), el formulario vuelve a primer plano.
- **Aviso de límite activo (RF-LIM-004):** al Guardar, si el estado proyectado del mes cruzaría ≥1 límite activo, un **diálogo de confirmación** superpuesto enumera el/los límite(s) que se cruzarían, con **"Guardar igual"** (persiste, no bloquea) y **"Cancelar"** (vuelve al formulario). Sin cruces no aparece y el guardado es directo. El detalle visual del diálogo lo define `docs/design.md`.
- **Guardando:** el modal indica que la operación está en curso.
- **Error del backend al guardar (RNF-008):** el modal permanece abierto, conserva los datos ingresados y permite reintentar sin perder información.

---

## 6. Categorías — sección de Configuración (`/configuracion/categorias`)

**RF relacionados:** RF-CAT-001, RF-CAT-002, RF-CAT-003, RF-CAT-004, RF-CAT-005, RF-CAT-006, RF-MU-004

> **Ruta:** `/configuracion/categorias`. Es una **sección del hub de Configuración** (§9), accesible desde la navegación vertical de secciones y por URL directa (deep-link). No es un link del sidebar.

### Propósito

Sección del hub de Configuración dedicada a administrar las categorías del usuario: listar, crear, editar y eliminar. La creación y edición se resuelven mediante un modal dentro de esta sección.

### Contenido

- **Sidebar** con el link "Configuración" marcado como activo (esta superficie es una sección del hub de Configuración).
- **Lista de categorías activas** del usuario. Cada ítem muestra:
  - Color de la categoría (indicador visual; el usuario lo elige/edita desde el modal — RF-CAT-005).
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

- **Creación (origen `/configuracion/categorias`):** modal con campos vacíos; el campo "Tipo" (scope) ofrece las **tres** opciones (Gasto / Ingreso / Ambos) con **default "Ambos"**.
- **Creación desde el formulario de carga de movimiento — modo inline (RF-MU-004):** el mismo modal se abre también desde el botón "+ Nueva" del formulario de carga (pantalla 5). En este origen el campo "Tipo" (scope) se comporta **distinto** —solo ofrece las opciones compatibles con el tipo del movimiento y oculta el tipo opuesto, con el tipo exacto pre-seleccionado— y al crear/reactivar deja la categoría autoseleccionada en el formulario. Detalle completo de la restricción de scope inline en RF-MU-004. El resto del comportamiento del modal (validaciones, prompt de reactivación) es idéntico. Abierto desde `/configuracion/categorias`, el scope conserva las tres opciones con default "Ambos".
- **Edición:** el mismo modal pre-cargado con nombre, scope y color actuales.
- **Picker de color — matriz (RF-CAT-005), presente en crear y editar.** El modal incluye un selector de color con la **matriz de 70 colores** (7 tonalidades × 10 hues). En **crear**, arranca con el color **"menos usado"** pre-seleccionado como default (calculado sobre los 10 colores base); en **editar**, arranca con el **color actual** de la categoría seleccionado. Incluye un botón **"aleatorio"** que elige un color al azar de la matriz. Solo se puede elegir un color de la matriz (sin hex libre). El detalle visual del picker lo define `control-design` (`docs/design.md`).
- **Validaciones:** el nombre es obligatorio y no puede estar vacío; no pueden coexistir dos categorías activas con el mismo nombre para el mismo usuario (RN-008).
- **Acciones:** Guardar (valida y persiste, cierra el modal) y Cancelar (cierra sin guardar).

### Navegación

- **Llega desde:** la navegación vertical de secciones del hub de Configuración (§9); URL directa a `/configuracion/categorias` (deep-link); enlace desde el formulario de carga cuando no hay categorías disponibles para el tipo en curso.
- **Modal invocado desde otra pantalla:** el modal de creación de categoría también se abre desde el botón "+ Nueva" del formulario de carga de movimiento (pantalla 5, RF-MU-004), superpuesto a ese formulario y **sin** navegar a `/configuracion/categorias`.
- **Lleva a:** permanece en `/configuracion/categorias` tras crear, editar o eliminar.

### Estados

- **Cargando:** mientras se obtiene la lista de categorías.
- **Con datos:** lista de categorías activas con su color, nombre, scope y contador de movimientos.
- **Vacío (sin categorías activas):** se muestra un mensaje de estado vacío. (Nota: una cuenta nueva nace con categorías por defecto — RF-CAT-001 — por lo que el vacío total ocurre solo si el usuario eliminó todas).
- **Modal con error de validación:** nombre vacío o nombre duplicado — se muestra el error y no se guarda.
- **Error del backend al guardar (RNF-008):** el modal permanece abierto, conserva los datos y permite reintentar.
- **Confirmación de eliminación:** se pide confirmar antes de aplicar el soft delete; cancelar deja la categoría sin cambios.

---

## 7. Reportes (pantalla configurable)

**RF relacionados:** RF-REP-001, RF-REP-002, RF-REP-003, RF-REP-004, RF-REP-010, RF-REP-011, RF-REP-012, RF-LIM-005, RF-NAV-001

> **Ruta:** `/reportes`. **Link en el sidebar:** rótulo **"Reportes"**, ubicado **debajo de "Vista del mes"** (orden: Dashboard → Vista del mes → Reportes → Historial → Configuración).

### Propósito

Pantalla **configurable** donde el usuario arma su propia vista de reportes a lo largo de los años. Agrega y quita **cards de reporte** (cada una es un widget de reporte autónomo, pantalla 8) mediante un recuadro **"[+]"**; cada card navega su propio año y filtra sus propias categorías de forma **independiente** y **persistida**. La **primera vez la pantalla está vacía** (solo el "[+]"): la configuración que el usuario va armando (clave `reports`, RF-REP-004) **es** su pantalla.

### Contenido

- **Sidebar** con el link **"Reportes"** marcado como activo.
- **Header** con el **chip de moneda default** en la fila del eyebrow (ver Convenciones).
- **Recuadro "[+]"** — siempre presente; agrega una card de reporte nueva.
- **Cards de reporte** — una por cada entrada de la clave `reports`, en el orden del array. Cada card monta un **widget de reporte autónomo** (pantalla 8) en **modo persistido**, con sus flechas de año y su filtro de categorías embebidos. El tipo de card se elige al agregarla; los rótulos del menú "[+]" (y del mini de reorden) son: **"Ingresos vs Gastos"** (`income-expense`), **"Gastos por categoría"** (`by-category`), **"Gastos Únicos"** (`unique-grid`), **"Gastos en Cuotas"** (`installment-gantt`) y **"Inflación vs Ingresos"** (`inflation-income`, ícono `TrendingUp`), según RF-REP-001/010/011/012.
- **Título de la card** (RF-REP-008) — en la cabecera de cada card, un **título editable**. Si la card no tiene título, muestra el placeholder **"Reporte N"** (N = posición 1-based de la card en la columna, recalculado en vivo).
- **Popover informativo de límites por card** (RF-LIM-005) — junto al título de cada card, un **ícono informativo** abre un popover de **solo lectura** con los límites que observan esa card (las keys de su tipo de reporte). El ícono se muestra **solo si hay ≥1 límite** (habilitado o no) para esa superficie. Misma anatomía y comportamiento que el popover de `/mes` (pantalla 4), con dos diferencias: el caption es **"Límites de este reporte"** y solo aparece el grupo **"Marcan un dato"** (los reportes no admiten límites activos, así que nunca hay grupo "Avisan al guardar").
- El layout, tamaños y disposición de las cards y del "[+]" los define `control-design`.

### Acciones disponibles

- **Agregar card** — desde el "[+]": el usuario elige el tipo de reporte (RF-REP-001); la card nace con el **año en curso** y **todas las categorías**, se agrega al final y se persiste (RF-REP-004).
- **Quitar card** — elimina la card de la vista y de la persistencia.
- **Navegar el año de una card** y **filtrar sus categorías** — embebidos en cada card (widget autónomo, pantalla 8); cada cambio se persiste. Son **independientes por card**: no hay control de año ni filtro compartidos.
- **Editar el título de una card** (RF-REP-008) — desde la cabecera; máx. 60 caracteres, **Enter o blur** confirman, **Esc** cancela. Confirmar un título vacío vuelve a mostrar el placeholder "Reporte N".
- **Refrescar una card** (RF-REP-016) — desde la cabecera; vuelve a pedir al backend **solo los datos de esa card**, con feedback solo-spinner. Es **independiente por card**.
- **Ver los límites que observan una card** (RF-LIM-005) — el ícono informativo junto al título de la card abre el popover de solo lectura con el listado. Es informativo: no edita ni activa/desactiva límites.
- **Ordenar reportes** (RF-REP-009) — un botón del header ("Ordenar reportes" / "Listo") activa/desactiva el **modo orden**, con el mismo mecanismo que "Ordenar secciones" de `/mes`. Se muestra **solo con 2 o más cards**. En modo orden cada card colapsa a su representación **mini** y el usuario la **arrastra para reordenarla** entre las demás; los controles internos de cada card y el "[+]" quedan deshabilitados. El orden se **aplica en vivo** y se **persiste por usuario** (clave `reports`, RF-REP-004); no hay acción de cancelar.
- Acciones globales del sidebar.

### Navegación

- **Llega desde:** link **"Reportes"** del sidebar (RF-NAV-001); acceso directo a `/reportes`.
- **Lleva a:** permanece en la pantalla al agregar/quitar cards o cambiar año/filtro. (No abre el modal de carga ni navega a la Vista del mes desde un reporte; el drill-down clic-en-mes → Vista del mes queda **fuera de alcance**, candidato futuro.)

### Estados

- **Vacío inicial:** clave `reports` ausente o array vacío → la pantalla muestra **solo el "[+]"**. Es el estado de la primera visita.
- **Con cards:** una o más cards montadas, cada una en su año y con su filtro persistidos.
- **Cargando (por card):** mientras cada widget obtiene los datos de su año (ver pantalla 8).
- **Error (por card):** si falla la carga de una card, se informa el error en esa card sin romper el resto de la pantalla.
- **Modo orden activo (RF-REP-009):** disponible solo con 2 o más cards; cada card colapsa a su representación **mini** y se puede arrastrar para reordenarla. Los controles internos de cada card y el "[+]" quedan deshabilitados. El orden se aplica en vivo y se persiste.

---

## 8. Widget de reporte autónomo (componente reutilizable)

**RF relacionados:** RF-REP-001, RF-REP-002

> No es una pantalla con ruta propia: es un **recuadro (panel) reutilizable** que se inyecta dentro de otras pantallas (cada card de `/reportes`, pantalla 7, y el Dashboard, pantalla 3). Se documenta acá por ser una unidad funcional con contenido, acciones y estados propios. Cada instancia es **autónoma**: gobierna su propio año y su propio filtro de categorías; no hay control de año ni filtro compartidos entre instancias.

### Propósito

Visualizar, por mes a lo largo de un año, los movimientos del usuario (eje X: los 12 meses; eje Y: monto), con **navegación de año** y **filtro de categorías** embebidos en el propio recuadro. El tipo de reporte (Ingresos vs Gastos o Gastos por categoría) se elige por props.

### Props funcionales

- **Tipo de reporte** — `income-expense` (Ingresos vs Gastos) o `by-category` (Gastos por categoría). Define qué visualización monta la instancia (RF-REP-001).
- **Año a mostrar** — el año cuyos 12 meses se grafican. La navegación de año está **siempre embebida y activa** (flechas), **independiente por instancia**.
- **Categorías seleccionadas (filtro)** — subconjunto de categorías; default **todas**. El universo ofrecido es **solo las categorías con gasto del año** (las que aportan a lo que se muestra), estable (no se achica al destildar). **Tres estados** (igual que el filtro de `/mes`, RF-VM-006): todas (default), subconjunto y **ninguna** (todas destildadas → serie en cero). En `by-category` (y en la card `income-expense` del Dashboard) **la leyenda del gráfico es el filtro** (ver "Acciones disponibles"), sin control separado; la card `income-expense` de `/reportes` expone el filtro de categoría en un **control dedicado** (popup), junto con los filtros de tipo y dirección de RF-REP-014.
- **Filtros de tipo y dirección (solo `income-expense` de `/reportes`, RF-REP-014)** — además del filtro de categoría, la card acota qué movimientos alimentan sus 2 series por **tipo de movimiento** (fijo / cuota / único, multi-selección; default los tres) y **dirección** (solo gastos / solo ingresos / ambos; default ambos). Son **filtros** que siguen siendo Total-only (no un desglose). La forma de los controles la define `control-design`.
- **Representación (solo `by-category`, RF-REP-006)** — toggle de dos opciones: **Barra** (barras apiladas por categoría, default) y **Línea** (áreas apiladas por categoría, mismo dato, con línea de contorno = total de gasto). El tipo `income-expense` **no** tiene este toggle. La representación no cambia el año ni el filtro. El detalle visual lo define `control-design`.
- **Modo de persistencia** — **persistido** (en `/reportes`: año, filtro **y representación** —`by-category`— se guardan en la clave `reports`, RF-REP-004/006) o **efímero** (en el Dashboard: año y filtro son de sesión, no se persisten — al recargar vuelve a año en curso + todas las categorías).

### Contenido

- **Eje X:** los 12 meses del año configurado. **Eje Y:** monto.
- **Tipo Ingresos vs Gastos (`income-expense`):** por cada mes, el total de ingresos y el total de gastos (cada total suma únicos + fijos activos + cuotas del mes, igual que RF-VM-002), **restringido a las categorías seleccionadas**. Es **Total-only**: solo las dos series agregadas, sin sub-vista por categoría ni toggle de representación.
- **Tipo Gastos por categoría (`by-category`):** por cada mes, el total de gastos descompuesto por categoría apilada —**solo las seleccionadas**—, cada porción con el color propio de su categoría (RF-CAT-005). Solo gastos; los ingresos no se descomponen acá. Se grafica como **Barra** (default) o **Línea** según la representación (RF-REP-006).
- **Flechas de navegación de año** ‹ › embebidas en el recuadro.
- **Leyenda interactiva = filtro** embebida: clic en un ítem lo activa/desactiva. En `income-expense` sus ítems son las **series** (Ingresos / Gastos); en `by-category` sus ítems son las **categorías con gasto del año**. Salvo en la card `income-expense` de `/reportes` —que suma controles de filtro dedicados de tipo / dirección / categoría (RF-REP-014)—, no hay un control de filtro aparte: la leyenda lo cumple.
- **Toggle de representación** Barra / Línea — solo en el tipo `by-category` (RF-REP-006). El detalle visual lo define `control-design`.

### Acciones disponibles

- **Navegar de año** — recalcula el recuadro para el año seleccionado, dentro de los límites: hacia atrás el control ‹ se deshabilita antes del **primer año con CUALQUIER movimiento del usuario** (`earliestYear`, no afectado por el filtro); hacia adelante los años futuros quedan bloqueados (máximo navegable = año en curso).
- **Filtrar vía la leyenda** — clic en un ítem de la leyenda lo activa/desactiva y recalcula el recuadro. En `income-expense` togglea las **series** Ingresos/Gastos (puede ocultar ambas → recuadro vacío); en `by-category` togglea **categorías** (tres estados). En modo persistido, año, series ocultas y filtro de categorías se guardan (RF-REP-004); en modo efímero, no.
- **Cambiar la representación** (solo `by-category`, RF-REP-006) — alternar Barra / Línea recalcula la visualización de la card sin tocar año ni filtro. En modo persistido la representación se guarda por card (clave `reports`, campo `categoryChartMode`).

### Puntos de uso

- **Dashboard (`/`):** se monta **solo el tipo Ingresos vs Gastos** (Total-only), en **modo efímero** — navegación de año **activa** e independiente, filtro de categorías activo pero **no persistido** (al recargar vuelve a año en curso + todas las categorías). El resumen mensual del dashboard (pantalla 3) **no** se ve afectado por este widget.
- **Cards de `/reportes` (pantalla 7):** cada card monta una instancia en **modo persistido**; el tipo, el año, el filtro y la representación (`by-category`) vienen de su entrada en `reports` y cada cambio se persiste.

### Estados

- **Cargando:** mientras se obtienen los datos del año (filtrados al set de categorías seleccionado).
- **Con datos:** recuadro poblado con los 12 meses presentes.
- **Año sin movimientos (vacío):** los 12 meses se muestran en cero; puede acompañarse de un mensaje de estado vacío, sin error. La representación visual concreta la define `control-design`.
- **Filtro que vacía el reporte:** si las categorías seleccionadas no tienen movimientos en el año, **o** si el estado es **"ninguna"** (todas destildadas), los 12 meses se grafican en **cero** (sin error); los límites de navegación de año **no** cambian (siguen basados en `earliestYear`, no en el filtro).
- **Meses sin datos dentro del año:** los meses sin movimientos se grafican en **cero** (sin huecos ni omisiones). Aplica tanto a meses futuros del año en curso como a meses pasados; los meses futuros pueden tener datos proyectados por fijos/cuotas (RN-006).
- **Error:** si falla la carga, se informa el error sin romper la pantalla anfitriona.

---

## 9. Configuración (`/configuracion`)

**RF relacionados:** RF-CUR-002, RF-CUR-005, RF-CUR-006, RF-LIM-001, RF-LIM-002, RF-NAV-001. Las secciones **Categorías** (RF-CAT-*) y **Métodos de pago** (RF-PM-*) montan los gestores documentados en §6 y §10.

> **Ruta:** `/configuracion`. **Link en el sidebar**, debajo de "Historial" (orden: Dashboard → Vista del mes → Reportes → Historial → Configuración).

### Propósito

**Hub de administración de la cuenta.** Concentra los ajustes y gestores de la cuenta en **cuatro secciones** dispuestas con **navegación vertical** (columna de secciones a un lado, contenido de la sección activa al otro; patrón de settings tipo GitHub/Stripe). El **ruteo es anidado y deep-linkable**: cada sección es una **URL propia** a la que se puede entrar directo. Las secciones, en este orden:

1. **General** (`/configuracion`, sección por defecto) — preferencias de la cuenta (moneda por defecto).
2. **Categorías** (`/configuracion/categorias`) — gestor de categorías (§6).
3. **Métodos de pago** (`/configuracion/metodos-pago`) — gestor de métodos de pago (§10).
4. **Límites** (`/configuracion/limites`) — gestor de límites.

### Contenido

- **Sidebar** con el link "Configuración" marcado como activo (en cualquiera de las cuatro secciones).
- **Navegación vertical de secciones:** una columna que lista las cuatro secciones (General, Categorías, Métodos de pago, Límites) y marca la activa; al lado se muestra el contenido de la sección seleccionada.

**Sección General:**
- **Ajuste "Moneda por defecto"** (RF-CUR-002): selector entre las **4 monedas curadas (ARS / USD / EUR / BRL)**. Es la moneda en la que se expresan todos los totales (vista del mes, dashboard, reportes). Se lee/escribe vía el contrato `/settings` (ver `data-model.md`).
- **Sin editor de la tabla de cotizaciones de referencia:** la tabla de referencia es **interna y no editable por UI** (RF-CUR-006), así que General **no** la muestra ni la edita.

**Sección Categorías:** monta el gestor de categorías descrito en **§6**, en `/configuracion/categorias`. Su contenido, acciones, modal y estados son los de §6.

**Sección Métodos de pago:** monta el gestor de métodos de pago descrito en **§10**, en `/configuracion/metodos-pago`. Su contenido, acciones, modal y estados son los de §10.

**Sección Límites** (RF-LIM-001..002): gestor de los límites del usuario (marca visual pasiva sobre `/mes`, dashboard y reportes; alerta activa sobre keys `mes.*`). Gestiona **solo límites** — no re-edita moneda, reportes ni secciones.
- **Lista de límites** del usuario: por fila el nombre (o placeholder derivado), la key legible, su **naturaleza** (pasiva/activa), un chip con la condición (operador + umbral), un **preview del efecto** (solo pasiva), el **switch `enabled`** y la acción **eliminar** (con confirmación inline).
- **Empty-state** cuando el usuario no tiene límites.
- **Botón para crear** un límite → abre el modal de creación.
- **Modal de creación** con formulario progresivo: elegir **key** (agrupada por superficie: `/mes`, dashboard y reportes) → **refinamiento** condicional (selector de sección o de categoría, según la key) → **naturaleza** (pasiva / activa; activa habilitada solo para keys `mes.*`) → **operador + umbral** (input según la unidad de la key, número puro sin moneda; en activa los operadores se restringen por la polaridad del anclaje) → *(rama pasiva)* **alcance temporal** (todos los meses / mes en curso) + **efecto** (solo el subset válido del anclaje, con preview) → **nombre** opcional. La **rama activa omite** el alcance temporal y el efecto.

- El layout del hub y de la navegación vertical, el catálogo de efectos visuales de Límites y su preview, y la rama activa del formulario los define `docs/design.md`.

### Acciones disponibles

- **Navegar entre secciones** — la navegación vertical cambia la sección activa y la **URL anidada** sin salir del hub (deep-linkable).
- **General — cambiar la moneda por defecto** — al elegir una de las 4 monedas, el cambio se persiste (`PATCH /settings`) y **re-expresa los totales en vivo** sin tocar ningún movimiento guardado (RF-CUR-005).
- **Categorías — crear / editar / eliminar** — según §6.
- **Métodos de pago — crear / editar / eliminar / predeterminar por estructura** — según §10.
- **Límites — crear / eliminar / activar-desactivar** un límite (RF-LIM-002). **No hay editar**: para cambiar un límite se elimina y se crea de nuevo. Cada cambio persiste el blob completo vía `PUT /preferences`.
- Acciones globales del sidebar.

### Navegación

- **Llega desde:** link "Configuración" del sidebar (abre en **General**); URL directa a cualquier sección (deep-link); chip de moneda default del header de otras pantallas (abre General); enlace desde el formulario de carga cuando no hay categorías disponibles (abre la sección Categorías).
- **Entre secciones:** la navegación vertical cambia de sección sin salir del hub, actualizando la ruta anidada.
- **Lleva a:** permanece en Configuración; el efecto del cambio de moneda default se ve al volver a `/mes`, dashboard o reportes; el efecto de los límites se ve en `/mes`, el dashboard y los reportes (marcas pasivas, RF-LIM-003).

### Estados

- **Sección activa por URL:** entrar a `/configuracion` abre General; entrar directo a `/configuracion/categorias`, `/configuracion/metodos-pago` o `/configuracion/limites` abre esa sección con su link vertical marcado.
- **Cargando:** cada sección resuelve sus propios datos —General vía `GET /settings`; Categorías y Métodos de pago sus listas (§6, §10); Límites el blob de preferencias.
- **Con datos:** General refleja la moneda default vigente; Categorías y Métodos de pago sus gestores; Límites lista los límites del usuario.
- **Vacío (Límites):** empty-state cuando no hay límites configurados. (Los vacíos de Categorías y Métodos de pago se describen en §6 y §10.)
- **Guardando / error al guardar:** el cambio se confirma al persistir; ante error del backend se informa sin romper la pantalla (RNF-008) y el ajuste queda sin cambios.

---

## 10. Métodos de pago — sección de Configuración (`/configuracion/metodos-pago`)

**RF relacionados:** RF-PM-001, RF-PM-002, RF-PM-003, RF-PM-004, RF-PM-005, RF-PM-006, RF-PM-007, RF-NAV-001

> **Ruta:** `/configuracion/metodos-pago`. Es una **sección del hub de Configuración** (§9), accesible desde la navegación vertical de secciones y por URL directa (deep-link). No es un link del sidebar.

### Propósito

Sección del hub de Configuración dedicada a administrar los métodos de pago del usuario: listar, crear, editar y eliminar. Es **espejo 1:1 de la sección Categorías** (pantalla 6) en estructura, estados, validaciones, empty y confirmación de borrado; lo propio de esta sección es que la identidad visual es un **ícono** (no un color) y que el método tiene un **tipo** con campos condicionales. La creación y edición se resuelven en un modal dentro de la sección.

### Contenido

- **Sidebar** con el link "Configuración" marcado como activo (esta superficie es una sección del hub de Configuración).
- **Lista de métodos de pago activos** del usuario. Cada ítem muestra (ver `docs/design.md`, §Métodos de pago — render en la lista):
  - **Ícono** del método (identidad visual; en el slot del color-swatch de categorías).
  - **Nombre** del método.
  - **Tipo** (Crédito / Débito / Efectivo), como chip neutro.
  - Contador **"N movimientos"** — cantidad de movimientos asociados. Dato derivado de solo lectura (RF-PM-005).
  - **Indicador de predeterminado** — de **solo lectura**: cuando el método es default de ≥1 estructura, la fila muestra una estrella + pill por estructura (único / fijo / cuota); nada cuando no lo es. La edición del default no vive en la fila, sino en el modal (RF-PM-007).
- Los métodos con soft delete (`deletedAt`) no aparecen en la lista.
- **Botón "Nuevo método de pago"** que abre el modal de creación.
- La cuenta nueva **arranca sin métodos** (no hay defaults): el estado inicial habitual es vacío.

### Acciones disponibles

- **Nuevo método de pago** — abre un modal para crear (RF-PM-001). Ver "Modal de creación / edición".
- **Editar** un método — abre el mismo modal pre-cargado con los valores actuales (RF-PM-002). Editable: nombre, tipo, ícono y los campos condicionales del tipo.
- **Eliminar** un método — solicita confirmación; al confirmar aplica soft delete (`deletedAt = now`) y el método desaparece de la lista y del selector del formulario de carga (RF-PM-003). Los movimientos históricos conservan la referencia.
- **Predeterminar por estructura** — se configura **dentro del modal de crear/editar método**, en la sección "Predeterminado para" (checkboxes Únicos / Fijos / Cuotas), exclusivo por estructura, resuelto al guardar (RF-PM-007). El prefill aplica al **crear** un movimiento de esa estructura, como valor inicial editable. La fila de la lista solo muestra el indicador de lectura, no edita.
- Acciones globales del sidebar.

### Modal de creación / edición

- **Abre sin tipo elegido** (creación): el campo **Tipo** (Crédito / Débito / Efectivo) es **obligatorio y sin preselección**; hasta elegir uno no se puede guardar (RF-PM-001).
- **Campos condicionales según el tipo elegido:**
  - **Crédito:** **día de cierre** y **día de cobro** (día del mes 1-31, opcionales; informativos).
  - **Débito:** sin campos extra (el modal es idéntico al de Efectivo). El **débito automático** no vive acá: es un flag del movimiento, en el formulario de carga (ver más abajo).
  - **Efectivo:** sin campos extra.
- **Tipo editable en edición** (RF-PM-002): al cambiar de tipo, los campos condicionales que ya no aplican **se descartan**.
- **Icon-picker** (RF-PM-004), presente en crear y editar: selector de ícono del set curado. En **crear** arranca con `card`; en **editar**, con el ícono actual. **Sin botón "aleatorio"** (a diferencia del color de categorías). El detalle visual del picker lo define `control-design` (`docs/design.md`, §Icon-picker).
- **Sección "Predeterminado para"** (RF-PM-007), presente en crear y editar: tres checkboxes de estructura (Únicos / Fijos / Cuotas) para marcar el método como default de cada una. En **crear** arrancan destildados y la asignación se aplica tras crear el método (con el id nuevo). La exclusividad por estructura se resuelve al guardar; si el método toma una estructura que tenía otro, tras guardar se muestra un toast `info` consolidado además del toast de éxito.
- **Validaciones:** el nombre es obligatorio y no puede estar vacío; no pueden coexistir dos métodos activos con el mismo nombre normalizado del mismo usuario (espejo RN-014 / RN-008). El flujo crear-o-reactivar ante colisión con un método eliminado es idéntico al de categorías (RF-CAT-002 A3 → RF-PM-001 A4).
- **Acciones:** Guardar (valida y persiste, cierra el modal) y Cancelar (cierra sin guardar).

### Navegación

- **Llega desde:** la navegación vertical de secciones del hub de Configuración (§9); URL directa a `/configuracion/metodos-pago` (deep-link).
- **Lleva a:** permanece en `/configuracion/metodos-pago` tras crear, editar o eliminar. (El modal de método de pago **no** se abre desde el formulario de carga: el selector del form no tiene "+ Nueva" inline — RF-PM-006.)

### Estados

- **Cargando:** mientras se obtiene la lista de métodos.
- **Con datos:** lista de métodos activos con ícono, nombre, tipo y contador de movimientos.
- **Vacío (sin métodos activos):** mensaje de estado vacío. Es el estado de la primera visita (la cuenta nace sin métodos) y también tras eliminar todos.
- **Modal con error de validación:** nombre vacío, sin tipo elegido o nombre duplicado — se muestra el error y no se guarda.
- **Prompt de reactivación:** ante colisión de nombre con un método eliminado, se ofrece reactivarlo con su configuración original (RF-PM-001 A4).
- **Error del backend al guardar (RNF-008):** el modal permanece abierto, conserva los datos y permite reintentar.
- **Confirmación de eliminación:** se pide confirmar antes del soft delete; cancelar deja el método sin cambios.

---

## 11. Historial de cambios (`/historial`)

**RF relacionados:** RF-HIST-001, RF-HIST-002, RF-HIST-003, RF-HIST-004, RF-HIST-005, RF-HIST-006, RF-NAV-001

> **Ruta:** `/historial`. **Link en el sidebar:** rótulo **"Historial"**, **cuarto** (orden: Dashboard → Vista del mes → Reportes → Historial → Configuración).

### Propósito

Ver los cambios recientes sobre los movimientos —qué se editó, qué se eliminó— y **deshacerlos**. Es la red de seguridad de la app: el único lugar donde un movimiento eliminado sigue siendo visible y recuperable. No es un log de auditoría ni una pantalla de edición.

### Contenido

- **Sidebar** con el link "Historial" marcado como activo.
- **Header de la pantalla** con el rótulo de la sección. **Sin navegación de período** (el historial no se recorre por mes) y **sin chip de moneda default** (no expone totales; ver Convenciones).
- **Lista de entradas de historial** (RF-HIST-002) de **todos** los movimientos del usuario, en una única lista cronológica con la **más reciente primero**. Cada entrada muestra:
  - **Identidad del movimiento:** nombre, tipo de movimiento (único / fijo / cuotas, y si es calculado) y categoría.
  - **Operación:** **editado** o **eliminado**.
  - **Momento del cambio.**
  - **Qué cambió:** en una **edición**, los campos modificados con su **valor anterior → valor nuevo**; en una **eliminación**, el movimiento tal como estaba antes de borrarse.
  - **Acción Deshacer**, o —si la entrada está bloqueada (RF-HIST-004)— la misma acción **rotulada como bloqueada y con el motivo visible** ("hay N cambios posteriores de este movimiento"). La acción bloqueada **sigue siendo operable**: abre la explicación del bloqueo con la propuesta de desbloqueo en cadena.
- Las entradas **purgadas** por retención (RF-HIST-005: 5 por movimiento o 31 días) ya no figuran.
- Un movimiento **eliminado** figura acá aunque no aparezca en ninguna otra superficie de la app (RF-HIST-006).
- El detalle visual de la lista, de la representación anterior → nuevo y del estado bloqueado lo define `control-design` (`docs/design.md`).

### Acciones disponibles

- **Deshacer una entrada** (RF-HIST-003) — abre la confirmación con el cambio a revertir; al confirmar, el movimiento vuelve al estado previo y la **entrada se borra** del historial. No se registra el deshacer: el cambio deja de figurar por completo.
- **Deshacer en cadena desde una entrada bloqueada** (RF-HIST-004) — abrir una entrada bloqueada explica el motivo y ofrece deshacer **los N cambios posteriores** de ese movimiento junto con ella, en una sola confirmación. Cancelar no deshace nada.
- Acciones globales del sidebar.

La pantalla **no edita movimientos** ni ofrece acceso al formulario de carga desde una entrada.

### Navegación

- **Llega desde:** link "Historial" del sidebar (RF-NAV-001); acceso directo a `/historial`.
- **Lleva a:** permanece en `/historial` tras deshacer. (No navega a `/mes` ni al movimiento afectado; el drill-down a la vista del mes queda fuera de alcance.)

### Estados

- **Cargando:** mientras se obtiene la lista de entradas.
- **Con datos:** entradas listadas, la más reciente primero; la más reciente de cada movimiento con **Deshacer** directo y las anteriores de ese movimiento **bloqueadas** con su motivo (RF-HIST-004).
- **Vacío (sin cambios registrados):** mensaje de estado vacío. Es el estado de una cuenta que nunca editó ni eliminó un movimiento, y también aquel al que se vuelve cuando todas las entradas se purgan o se deshacen.
- **Confirmación de deshacer abierta:** muestra el cambio a revertir; en una entrada bloqueada, además el motivo y la propuesta de deshacer los N posteriores.
- **Deshaciendo:** mientras se aplica la restauración; al terminar, la entrada (y las posteriores, si fue en cadena) desaparecen de la lista.
- **Error:** si falla la carga del historial o el deshacer, se informa el error sin romper la pantalla y sin restaurar nada a medias.
