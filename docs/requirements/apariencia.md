# 3.11 Módulo: Apariencia

> Parte de los requerimientos funcionales de Control. Índice e ID → archivo: `docs/requirements.md`. Clave `theme`: `docs/data-model/preferencias.md`, §`theme`. Arquitectura de aplicación (override de tokens, anti-flash) en `docs/frontend/base.md` §Modo de color (theming).

El usuario elige el **modo de color** de la app (Sistema / Claro / Oscuro) desde un control en el **chrome global** (sidebar, RF-NAV-001). Persiste por usuario en el blob de preferencias (`theme`).

El módulo define además **qué superficie corresponde a cada tamaño de viewport**: en **régimen de captura** (criterio canónico en RF-APP-003), la única superficie es la **captura de movimiento** (RF-APP-003) y, sin sesión, su **acceso** (RF-APP-004); en **régimen de app**, la app completa. Y define la **pantalla de espera de arranque del backend** (RF-APP-005), que tapa cualquiera de esas superficies mientras el backend no responde.

---

## RF-APP-001 — Modo de color (Sistema / Claro / Oscuro)

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

## RF-APP-003 — Superficie de captura de movimiento

| Campo | Detalle |
|---|---|
| **Descripción** | En **régimen de captura**, Control es **una sola superficie: cargar un movimiento**. La superficie muestra **de qué cuenta es la sesión activa** y permite **cerrar sesión**; fuera de eso, ninguna otra pantalla, sección ni acción de la app es alcanzable. |
| **Actor** | Usuario autenticado, en régimen de captura |
| **Prioridad** | Alta |
| **Precondiciones** | El viewport cumple el criterio de régimen de captura. El usuario tiene sesión activa (sin sesión, RF-APP-004). |

**Criterio de régimen** (canónico; lo referencia RF-APP-004): se está en **régimen de captura** cuando la **dimensión menor del viewport es `< 600px`** —es decir, `ancho < 600px` **o** `alto < 600px`—. En cualquier otro caso se está en **régimen de app** y la superficie es la app completa.

El criterio mira **el tamaño del viewport y nada más**: qué aparato sea (teléfono, tablet, computadora) no interviene. Una ventana de escritorio angostada por debajo del umbral está en régimen de captura; un viewport con **las dos** dimensiones `≥ 600px` está en régimen de app.

**Criterios de aceptación:**
- [ ] La capacidad de la superficie es **crear un movimiento**, con el **formulario de creación completo**: los tres tipos (**Único / Fijo / Cuotas**), el selector **Gasto / Ingreso** y **todos** sus campos, incluido el bloque "Más opciones" (moneda, cotización, método de pago, débito automático). No es un formulario reducido ni un subconjunto de campos; el contenido, las validaciones y los defaults son los del modo creación de `docs/screens.md`, §5.
- [ ] **La identidad de la sesión activa es visible** en la superficie: el usuario ve **con qué cuenta** está cargando, sin ninguna acción de su parte. En régimen de captura no hay ninguna otra pantalla donde verificarlo después, así que un movimiento cargado en la cuenta equivocada sería un error silencioso e irreversible. **Qué dato** se muestra (nombre, email, avatar) y su tratamiento visual lo define `control-design`.
- [ ] **Cerrar sesión está disponible** (RF-AUTH-004). Es la **única** capacidad además de crear un movimiento: no habilita navegación, ni configuración, ni ninguna otra pantalla. Al cerrar sesión, el destino es el **acceso** (RF-APP-004). **Dónde vive el control** y cómo se ve lo define `control-design`.
- [ ] **Nada más de la app es alcanzable en régimen de captura**: ni dashboard, ni vista del mes, ni reportes, ni historial, ni configuración y sus secciones, ni el registro. Cualquier ruta de la app abierta en régimen de captura resuelve en esta superficie (o en el acceso, RF-APP-004, si no hay sesión).
- [ ] Sobre movimientos, la superficie **solo crea**: no hay edición, duplicado, eliminación ni movimiento calculado (esos modos parten de un movimiento existente, que solo se alcanza desde `/mes`).
- [ ] **Defaults de mes:** en **Fijo** y **Cuotas**, el mes de inicio arranca en el **mes actual** (en régimen de captura no existe mes contexto; `docs/screens.md`, §5). En **Único**, fecha y hora del momento actual.
- [ ] **La orientación no cambia nada:** como el criterio mira la dimensión **menor** del viewport, rotar la pantalla intercambia ancho y alto sin cambiar de régimen. La superficie de captura es la misma en cualquier orientación, y rotar **no** da acceso a la app.
- [ ] **El cambio de régimen es continuo y en los dos sentidos:** cruzar la frontera —redimensionando la ventana o rotando— conmuta de superficie **en vivo**, sin recargar la página, sin pantalla intermedia y sin parpadeo. El estado en memoria de la sesión de navegación sobrevive al cruce, tantas veces como se cruce.
- [ ] **El aviso de límite activo se conserva** (RF-LIM-004): si el movimiento que se está por guardar cruzaría uno o más límites activos, antes de persistir aparece el diálogo no bloqueante con **"Guardar igual"** y **"Cancelar"**, igual que en régimen de app.
- [ ] **Al guardar con éxito: solo una confirmación.** La superficie informa que el movimiento se guardó y queda lista para cargar otro. La confirmación **no ofrece navegación posterior** — no existe "Ir a ver" (RF-MU-001, RF-MF-001, RF-MC-001) porque no hay ninguna otra pantalla a la que ir.
- [ ] Los estados de validación, de guardado en curso y de error del backend son los del formulario (`docs/screens.md`, §5; RNF-008): ante un error el formulario conserva lo ingresado y permite reintentar.
- [ ] El movimiento creado en régimen de captura es **idéntico** a uno creado en régimen de app: mismas reglas y mismos datos. No queda marcado ni diferenciado por la superficie de carga.

---

## RF-APP-004 — Acceso (login) en régimen de captura

| Campo | Detalle |
|---|---|
| **Descripción** | Sin sesión activa, el **régimen de captura** muestra el **acceso**: la puerta a la superficie de captura (RF-APP-003). Se inicia sesión con los mismos métodos que en régimen de app. **No se crean cuentas desde esta superficie.** |
| **Actor** | Usuario no autenticado, en régimen de captura |
| **Prioridad** | Alta |
| **Precondiciones** | El viewport cumple el criterio de régimen de captura (RF-APP-003). El usuario no tiene sesión activa. |

**Criterios de aceptación:**
- [ ] Sin sesión, **cualquier** ruta abierta en régimen de captura resuelve en el acceso; con sesión activa, en la superficie de captura (RF-APP-003). También se llega acá al **cerrar sesión** desde esa superficie (RF-APP-003, RF-AUTH-004).
- [ ] **Métodos disponibles:** **email + contraseña** (RF-AUTH-005) como camino principal y **Google**, este último sujeto a que el proveedor esté configurado (condición y comportamiento en RF-AUTH-001). Son los mismos métodos del login en régimen de app (`docs/screens.md`, §1).
- [ ] **El registro no es alcanzable en régimen de captura** (RF-AUTH-006): no hay enlace de creación de cuenta y la ruta `/registro` abierta en régimen de captura resuelve en el acceso. Crear una cuenta requiere el régimen de app.
- [ ] Tras iniciar sesión con éxito, el usuario llega a la **superficie de captura** (RF-APP-003), no al dashboard.
- [ ] Los errores y validaciones son los de cada método: RF-AUTH-005 (A1 credenciales inválidas con mensaje genérico, A2 validación, A3 error del backend) y RF-AUTH-001 (A1 cancelación, A2 error del flujo OAuth).
- [ ] La sesión resultante es **la misma** en cualquier régimen: persiste entre visitas (RF-AUTH-003) y sirve para entrar a la app completa en régimen de app, sin volver a autenticarse.

---

## RF-APP-005 — Pantalla de espera de arranque del backend

| Campo | Detalle |
|---|---|
| **Descripción** | Mientras el backend no responde, la app entera queda cubierta por una **pantalla de espera a pantalla completa**. La espera **se resuelve sola** cuando el backend vuelve; si se estira demasiado, ofrece **Reintentar**. |
| **Actor** | Cualquier usuario, con o sin sesión |
| **Prioridad** | Alta |
| **Precondiciones** | Ninguna. |

**Criterios de aceptación:**
- [ ] **Cobertura total:** mientras la pantalla de espera está visible, **nada del fondo es alcanzable ni scrolleable**. Cubre todas las superficies de la app en cualquier régimen (RF-APP-003), **incluida la pantalla de acceso** (`docs/screens.md`, §1; RF-APP-004): sin backend, iniciar sesión tampoco es posible.
- [ ] **Umbral de aparición:** la pantalla aparece recién tras **~800 ms** sin respuesta del backend. Si el backend responde antes, **no se muestra nunca** — una demora corta no genera una pantalla intermedia.
- [ ] **Permanencia mínima:** una vez visible, permanece **~1 s como mínimo**, de modo que nunca aparezca y desaparezca en un parpadeo.
- [ ] **Estado de error a los 3 minutos:** si a los **3 minutos** el backend sigue sin responder, la espera pasa a un **estado de error** con un botón **Reintentar**.
- [ ] **Reintentar** devuelve la pantalla al **estado de espera** y **reinicia el reloj de los 3 minutos**.
- [ ] **Resolución automática:** si el backend vuelve, la pantalla desaparece **sin que el usuario toque nada**. Reintentar es un atajo, no la única salida.
- [ ] **Recuperación de datos:** al recuperarse el backend, **los datos que no habían podido cargarse se vuelven a pedir solos**. El usuario nunca tiene que recargar la página a mano para ver la pantalla en la que estaba.
- [ ] **La recuperación solo reintenta lecturas:** una operación de guardado que falló por backend caído **no se re-ejecuta sola** (reintentarla es del usuario), para que la recuperación no pueda duplicar un movimiento. Sustento estructural en `docs/frontend/gate-arranque.md`.
- [ ] El tratamiento visual de la pantalla (fondo, pieza gráfica, texto, estado de error) lo define `control-design` (`docs/design.md`).
