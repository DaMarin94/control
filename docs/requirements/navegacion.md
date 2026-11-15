# 3.8 Módulo: Navegación

> Parte de los requerimientos funcionales de Control. Índice e ID → archivo: `docs/requirements.md`.

La navegación global de la app se resuelve con un **sidebar lateral** persistente, presente en todas las pantallas autenticadas. Centraliza el acceso a las secciones principales, la acción primaria de carga y el menú de usuario.

---

## RF-NAV-001 — Sidebar de navegación global

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
- **Categorías y Métodos de pago no son links del sidebar.** Se administran como **secciones del hub de Configuración**, cada una con su ruta anidada deep-linkable (`/configuracion/categorias`, `/configuracion/metodos-pago`). Ver `docs/screens.md`, §9.
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
- Para RF-AUTH-004 (cierre de sesión disponible "desde cualquier pantalla") **en la app**, el punto de acceso al cierre de sesión es el menú de usuario del sidebar. En régimen de captura no hay sidebar; el cierre de sesión vive en la superficie de captura (RF-APP-003).

---

## RF-NAV-002 — Mostrar/ocultar el sidebar

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario **muestra u oculta** el sidebar (RF-NAV-001) con un control manual, disponible en **todos los anchos de viewport**. Abierto, el sidebar ocupa su ancho y empuja el contenido; cerrado, se oculta y el contenido ocupa el ancho completo. El estado persiste por usuario en el blob de preferencias (clave `sidebarOpen`). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] Existe un control manual que **alterna** entre sidebar abierto y cerrado, accesible en **cualquier ancho de viewport** del régimen de app (RF-APP-003).
- [ ] **Abierto** (estado por defecto): el sidebar se comporta como en RF-NAV-001 — ocupa su ancho y **empuja** el contenido de la pantalla.
- [ ] **Cerrado**: el sidebar queda **oculto** y el contenido de la pantalla ocupa el **ancho completo**.
- [ ] El estado abierto/cerrado **no depende del breakpoint**: el sidebar **no auto-colapsa** por ancho de viewport. La única causa del cambio de estado es la acción del usuario sobre el control.
- [ ] El estado **persiste por usuario** en el blob de preferencias (clave `sidebarOpen`): sobrevive al cierre de sesión, al cambio de dispositivo y a limpiar el navegador. Si la clave falta, el default es **abierto**. Modelo de datos en `docs/data-model/preferencias.md`, §`sidebarOpen`.

**Notas:**
- La ubicación, el ícono, el rótulo y el comportamiento visual del control (incluida la animación de apertura/cierre) los define `control-design` (`docs/design.md`). Este RF solo fija el comportamiento funcional.
- **Interacción con RNF-003 (acceso a "Nuevo movimiento" en ≤2 interacciones):** con el sidebar **cerrado**, la CTA "Nuevo movimiento" (que vive en el sidebar, RF-NAV-001) **no está visible**. Crear un movimiento cuesta abrir el sidebar (1) + click en la CTA (2) = **2 interacciones**, dentro del límite de RNF-003. Es aceptable por decisión de producto: no hay un acceso alternativo a la carga.
