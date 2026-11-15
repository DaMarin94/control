# Frontend — Navegación global (sidebar — RF-NAV-001/002)

Feature 100% frontend: navegación entre secciones, acción primaria de nuevo movimiento y menú de usuario, persistente en pantallas autenticadas.

## Punto único de montaje: route group `app/(app)/`

Las pantallas autenticadas (`/`, `/mes`, `/reportes`, `/historial` y el hub `/configuracion` con sus secciones) viven en el **route group `app/(app)/`**, con un `layout.tsx` compartido que monta el sidebar **una sola vez**.

- **Los route groups no alteran las URLs.**
- **`login` y `registro` quedan FUERA del grupo** → no muestran sidebar (RF-NAV-001).
- **Regla: toda pantalla nueva con sesión vive bajo `app/(app)/`**. No remontar el sidebar por pantalla.
- El `<main>` lo monta **`AppShell`** (no `layout.tsx`) y es el **`@container`** de la app autenticada; **las páginas hijas solo devuelven su contenido** con su bloque de ancho (`max-w-280 mx-auto` + `px-10`), sin `<main>` propio. En el hub `/configuracion` ese bloque lo aporta el layout del hub (ver `docs/frontend/configuracion.md`).

## Componentes

- **`app/(app)/layout.tsx`** — Server Component. En una sola pasada de **`auth()`** obtiene el email **y** la preferencia `sidebarOpen`, y delega a `AppShell` con `email` + `initialSidebarOpen`.
- **`components/layout/app-shell.tsx`** — Client Component. **Dueño del estado abierto/cerrado** (`useSidebarOpen`); monta `AppSidebar` + el `<main>` (`@container`) hermanos y ajusta el offset de `<main>`.
- **`components/layout/app-sidebar.tsx`** — Client Component **controlado** (`open`/`onToggle`); `usePathname()` para la sección activa.
- **`components/layout/user-menu.tsx`** — avatar + desplegable con "Cerrar sesión" (RF-AUTH-004).

## Contenido

Logo/nombre "Control" → `/`; **cinco links** en orden: **Dashboard** (`/`), **Vista del mes** (`/mes`, abre en el mes actual porque la página defaultea a `getCurrentMonth`), **Reportes** (`/reportes`), **Historial** (`/historial`), **Configuración** (`/configuracion`); botón **"Nuevo movimiento"** que reusa `NewTransactionButton` y abre `TransactionModal` en `create` (1 clic, RNF-003); **menú de usuario** abajo con avatar = **inicial del email en mayúscula**. Categorías y Métodos de pago **no** son links del sidebar: son secciones del hub.

## Decisiones y gotchas

- **Mostrar/ocultar por el usuario (RF-NAV-002):** un control manual alterna abierto (empuja el contenido) / oculto, en **todos los anchos**. **No auto-colapsa por breakpoint.**
  - **Estado en `app-shell.tsx`, persistido en la preferencia `sidebarOpen` (boolean).** `useSidebarOpen` guarda el estado optimista y persiste con el blob completo; default **abierto** (`true`) si la clave falta. Shape en `docs/data-model/preferencias.md` → `sidebarOpen`.
  - **Estado inicial server-rendered, sin script anti-FOUC.** `initialSidebarOpen` se lee de `session.preferences` en el layout y baja como prop; el primer HTML ya es correcto y la hidratación coincide.
  - Ubicación, ícono y animación del control en `docs/design.md`.
- **El umbral compacto/amplio del área autenticada se mide contra el ancho de `<main>`, NO del viewport.** Todo lo que vive bajo `<main>` usa `@wide:`/`@max-wide:` (mismo 941px que `--breakpoint-wide`) sobre el ancho real disponible. Con el sidebar abierto a viewport 1000px el contenido mide ~712px → **compacto**. Fuera del área autenticada (login/registro) no hay `@container`: se usan `wide:`/`max-wide:` de viewport.
- **El offset de `<main>` según el sidebar va por `margin-left` (248↔0), NO `padding-left`.** Una container query `inline-size` mide el tamaño propio **incluyendo su padding**: offsetear con padding haría que `<main>` se "creyera" más ancho y montara régimen amplio. `margin-left` no participa del tamaño propio.
- **Banda reservada del chip flotante (`app-shell.tsx`).** Con el sidebar **cerrado**, `<main>` reserva **36px de `padding-top`** (`0` abierto); el chip que reabre el sidebar vive en coordenadas de viewport y sin la banda se superpone al contenido. Es **global**: **ningún contenido de página se pinta sobre los 70px superiores del viewport en el arranque** — toda pantalla la hereda del shell y no la compensa por su cuenta.
  - **La reserva es vertical y NUNCA horizontal:** un `padding-left` desalinearía el header e inflaría el `inline-size` de las container queries.
- **El `@container` de `<main>` es el containing block de sus descendientes `position:fixed`/`sticky`.** Un control que debe posicionarse respecto del viewport desde dentro de `<main>` se **porta a `document.body`** y calcula su posición por medición JS. Caso: las flechas de `PeriodNav` (`docs/frontend/period-nav.md`).
- **Avatar = inicial del email** (no hay imagen para usuarios de email).
- **Email via prop drilling desde el Server layout, NO `useSession()` en el sidebar.** Si el email es `null`, fallback a string vacío.
- **Sección activa — match EXACTO para `/`:** Dashboard compara `pathname === "/"` (con `startsWith("/")` quedaría activo siempre). `/mes`, `/reportes`, `/historial` y `/configuracion` usan `startsWith` (Configuración queda activo en las cuatro secciones del hub).
- **`<Suspense>` en `(app)/mes/page.tsx`:** ver `docs/frontend/vista-mes-y-dashboard.md` §Gotcha — `<Suspense>` + `useSearchParams`.
