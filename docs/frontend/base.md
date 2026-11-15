# Frontend — base

> Lo transversal del frontend: se lee siempre. Cada feature tiene su archivo en `docs/frontend/` (índice en `docs/frontend.md`; mapa general en `docs/README.md`).

## Stack

- Next.js 15 (App Router) + Tailwind CSS v4
- TypeScript strict (`noUnusedLocals`, `noUnusedParameters`)

## Tipos

El frontend define sus propios tipos, que reflejan el contrato de la API del backend (formato de respuesta en `docs/technical.md`). No hay paquete de tipos compartido con el backend.

## Estructura de carpetas

Organización **por tipo de archivo**:

```
frontend/src/
├── app/            (rutas del App Router)
│   ├── login/, registro/   (públicas, sin sidebar)
│   └── (app)/              (route group autenticado con layout+sidebar compartido: /, /mes, /reportes, /historial, /configuracion/*)
├── components/     (todos los componentes de UI)
├── hooks/          (todos los hooks: useToast, hooks de datos, etc.)
├── lib/            (capa de API centralizada, config, helpers)
└── types/          (tipos que reflejan el contrato de la API)
```

Dentro de cada carpeta se pueden agrupar archivos por dominio (ej: `components/movements/`) si el volumen lo justifica, pero la división de primer nivel es por tipo.

## Convenciones

- **Server vs Client Components:** por defecto Server Components. Se marca `"use client"` solo cuando hace falta interactividad, estado o hooks. Páginas y layouts arrancan server; formularios, toasts y data-fetching con React Query van en client.
- **`@/lib/env` es un módulo server-only.** Corre `validateEnv()` a nivel de módulo y valida secretos **sin** prefijo `NEXT_PUBLIC_` (`AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). En el browser esas vars son `undefined`, así que un client component que lo importe **crashea en runtime** con un error de Zod ("AUTH_SECRET: Required") aunque la var esté seteada en `.env.local`. **Patrón obligatorio:** ningún client component importa `@/lib/env`; si necesita un valor derivado de env, el **Server Component padre lo lee y lo pasa como prop**. Ejemplo: `src/app/login/page.tsx` (server) lee `isGoogleConfigured` y lo pasa a `<LoginForm isGoogleConfigured={...} />` (client).
- **Capa de llamadas al backend en `lib/`:** un único lugar centraliza las llamadas (ver Error handling en `docs/technical.md`). Ningún componente llama a `fetch` directo.
- **Hooks de datos:** envuelven esa capa con React Query (ver Convenciones de hooks en `docs/technical.md`).

### Hidratación y SSR

El primer render del cliente tiene que coincidir con el markup del SSR.

- **Gates sobre `data` de React Query incluyen `!hydrated`.** `useHydrated()` (`src/hooks/use-hydrated.ts`) usa `useSyncExternalStore` con snapshot de servidor `false` y de cliente `true`. Todo gate que elige entre skeleton y contenido según `data` lleva `!hydrated`: la caché del cliente puede tener datos antes de que hidrate un boundary de Suspense (p. ej. el de `MonthViewWrapper` por `useSearchParams`). En navegación client-side el hook vale `true` desde el primer render (sin flash). Lo usan los skeletons de totales de `month-view-client.tsx` y `dashboard-client.tsx`.
- **Valores derivados de APIs del navegador se renderizan después de montar.** Todo valor que sale de `matchMedia` u otra API del navegador (p. ej. `resolvedTheme` de `useTheme`) y llega al markup usa el patrón `mounted`; antes de montar se renderiza la variante neutra. Ej.: `ThemeIconToggle` muestra "Tema del sistema" sin "(ahora: …)" hasta montar.
- **Forms con credenciales llevan `method="post"`.** Aplica a login y registro (`capture-access-shell` reusa `LoginForm`). Un submit anterior a la hidratación hace el envío nativo del navegador; con GET los campos irían en la query string. Un POST nativo a esas rutas devuelve la misma página.

### Helpers (`lib/format.ts`)

Reusarlos, no reimplementar:

- **`parseCurrencyInput`** — pesos → centavos vía `Math.round(parsed * 100)`; acepta punto o coma decimal. **`formatCurrency`** — centavos → string en pesos.
- **`localToUtcIso` / `utcToLocalDate` / `utcToLocalTime`** — conversión local ↔ UTC con `Intl.DateTimeFormat` de doble pasada; **maneja DST** correctamente.
- **`getBrowserTimezone`** — IANA del navegador.
- **`getLocalTodayString`** — fecha local de hoy en `YYYY-MM-DD` con getters locales de `Date` (**nunca `toISOString()`**, que devuelve UTC). Es la **única** fuente del `today` que las superficies mandan al backend; el porqué detallado está en su JSDoc.
- **Helpers de mes:** **`getCurrentMonth`** — mes actual `YYYY-MM` en la zona del navegador; **`formatMonthLabel`** — `YYYY-MM` → rótulo legible (nombre de mes + año); **`formatMonthShort`** — `YYYY-MM` → mes abreviado + año (`"Mar 2024"`), para el arranque y la vigencia del fijo en la card de detalle (RF-MF-007 / RF-VM-007); **`prevMonth` / `nextMonth`** — desplazan un `YYYY-MM` un mes. Reusarlos para la navegación del mes; no reimplementar aritmética de meses.

Formato de presentación (locale, símbolos de moneda): `docs/technical.md` §Formato de presentación.

## Sistema de componentes (UI primitives)

Lo visual se define **una sola vez**. Stack: **shadcn/ui + cva** sobre Tailwind v4.

- **Una sola primitiva por elemento:** un `Button`, una `Table`, un `Link`, un `Input`, etc. Viven en `components/ui/`.
- **Las variantes son parámetros, no componentes nuevos.** "Botón redondo", "botón enorme", "botón fantasma" son el mismo `Button` con props: `<Button variant="ghost" size="lg" />`. Si hace falta una variante nueva, se agrega a la primitiva — no se crea otro botón.
- **Las features componen primitivas.** Nunca se reestiliza desde cero ni se usa un `<button>` HTML crudo.
- **Variantes tipadas con `cva`:** cada primitiva declara sus `variant`/`size`/etc. en un solo lugar, con autocompletado de TypeScript.
- **Primitivas headless y accesibles:** shadcn se apoya en Radix UI.
- **El código es propio:** los componentes de shadcn se copian al repo y se controlan desde acá.

**Límite con el diseño visual:** acá se define la regla arquitectónica (primitivas únicas, variantes por parámetro). El aspecto concreto lo define `docs/design.md` sobre estas primitivas.

- **Las primitivas usan los tokens del design system "Precise Ledger"** (ver §Design system y §Tailwind v4 — convenciones y gotcha).
- **Íconos: `lucide-react`** (no SVG inline).
- **`PeriodNav` (`components/ui/period-nav.tsx`)** — primitiva genérica de navegación de período (`‹ contenido ›`). La usa `/mes`. API y gotchas en `docs/frontend/period-nav.md`.
- **`KebabMenu` (`components/ui/kebab-menu.tsx`)** — menú de tres puntos para las acciones de fila **editar / eliminar** en listas. Es el **componente estándar para esas acciones**: toda lista nueva que las necesite lo usa, en lugar de botones inline. Se renderiza **por portal a `document.body` con posición `fixed`** (coordenadas del `getBoundingClientRect()` del trigger) por dos razones: (a) las tarjetas de lista tienen `overflow-hidden`, que recortaría un menú `absolute`; (b) el portal lo saca del ancestro transformado (ver §Modales y diálogos: portal a `body`). API: `ariaLabel`, `items` (`{ label, icon?, onSelect, danger? }`), `className`. El ítem `danger: true` se pinta en `text-expense-ink`. El trigger se mantiene visible mientras el menú está abierto; el menú se cierra en select / click afuera / Escape / scroll / resize (no recalcula posición en movimiento: cierra limpio).
  - **Gotcha — la altura del panel se deriva de la cantidad de ítems, no de una constante fija.** La decisión de abrir hacia abajo o hacia arriba se calcula con la **altura real** del menú (`items.length × alto de ítem + padding`). El **contrato es que el panel entra entero en el viewport con cualquier cantidad de ítems**: agregar un ítem no puede apoyarse en una estimación fija de alto (el flip se decidiría tarde y el panel quedaría cortado).
- **`AccordionSection` (`components/ui/accordion-section.tsx`)** — sección de acordeón **genérica**: cabecera-disclosure (`aria-expanded` / `aria-controls`, chevron rotatorio), **handle de drag opcional** y cuerpo colapsable animado sin JS (técnica grid-rows, ver `docs/frontend/vista-mes-y-dashboard.md` §Animación de acordeón sin JS). Lo usan las secciones de `/mes` (RF-VM-005).
  - **Patrón `filterSlot`:** slot opcional que `AccordionSection` renderiza como **hermano** del `<button>` disclosure, **no como hijo** — un control interactivo no puede anidarse dentro de un `<button>`. Se **oculta en `isOrderMode`**. En `/mes` cuelga el disparador de filtro tipo+categoría.
- **`SectionFilterPopover` (`components/ui/section-filter-popover.tsx`)** — disparador + popover que combina un **triple switch de tipo** (Gasto / Ingreso / Ambos) y un **bloque de categorías embebido** (tres estados). Es el control de filtro por sección de `/mes` (RF-VM-006), montado vía `filterSlot`. **El universo de categorías se deriva de los movimientos crudos de su sección** (tipo `CategoryOption`), **no** del hook de catálogo: cada sección lista solo las categorías presentes en sus movimientos. `footerSlot` y anclaje: `docs/frontend/simulacion.md` §`SectionFilterPanel`.
- **`SectionSortButton`** — control de orden de la sección **Únicos** de `/mes`: alterna `unicosSort` entre `"amount"` y `"date"` (RF-VM-001), en la cabecera junto al disparador de filtro.
- **`SortableSection` (`components/ui/sortable-section.tsx`)** — envuelve `AccordionSection` con `useSortable` de **dnd-kit**; activo **solo en modo orden**. Patrón estándar para "lista de bloques reordenables por drag". **Sin `DragOverlay`:** el ítem arrastrado se mueve **in-place**, restringido con `restrictToVerticalAxis` + `restrictToParentElement` (`@dnd-kit/modifiers`). El original no se oculta; el "activo" lo computa el padre vía `activeId` y se pasa por prop (`isActive`).
- **dnd-kit** (`@dnd-kit/core`, `/sortable`, `/utilities`, `/modifiers`) es el **motor de drag estándar**. Todo drag nuevo lo usa, con el sensor `activationConstraint: { distance: 8 }` (como `/mes` y `/reportes`). Gotcha de `role=region` en jsdom: §Testing — gotchas.

### Primitivas de formulario — `min-w-0` en toda la cadena (gotcha)

`Input` (`components/ui/input.tsx`) y `Select` (`components/ui/select.tsx`) llevan **`min-w-0` en toda su cadena de contenedores** —el wrapper externo (`w-full`), el `div.relative` del `Select` y el control mismo—. Los hijos de `grid`/`flex` tienen `min-width: auto`: **no pueden achicarse por debajo del min-content**, y `w-full` no lo evita. WebKit (iOS Safari) le asigna a los controles nativos —`input[type=date|time|month|number]` y `<select>`— un ancho intrínseco **mayor** que Blink; sin `min-w-0` el track del grid crece por encima del viewport y el formulario gana scroll horizontal. (Referencia: en Chrome el min-content es 173px para `type=date` y 109px para `type=time`.)

- **Consecuencia operativa:** en una fila de dos columnas (`grid-cols-2`) con campos, **los grid items también necesitan `min-w-0`**. Aplicado en `capture-transaction-form.tsx` (Fecha + Hora), `capture-installment-form.tsx` (Cant. de cuotas + Mes de inicio) y `capture-more-options.tsx` (Moneda + Cotización).
- **`Select` es un `<select>` nativo** (no Radix): primitivo mínimo, reemplazable en un solo lugar.

### Estados de carga: skeletons (regla)

**Todo estado de carga se renderiza con un skeleton** construido con las primitivas del sistema, **imitando el layout real** del contenido que reemplaza (sin saltos al cargar). No se usan spinners genéricos ni placeholders ad-hoc.

- **Primitivas en `components/ui/skeleton.tsx`:** `SkeletonLine` / `SkeletonBlock` / `SkeletonCircle` / `SkeletonPill`.
- **Animación:** utilidad `.animate-shimmer` (en `globals.css`), desactivada bajo `prefers-reduced-motion`.
- **Accesibilidad:** el contenedor lleva `role="status"` + `aria-label`; los placeholders internos van `aria-hidden`.
- Detalle visual en `docs/design/skeletons.md`.

### Modales y diálogos: portal a `body` (regla)

**Todo componente con scrim `fixed inset-0` se monta vía `createPortal(<scrim/>, document.body)`.** Los contenedores de página usan `animate-screen-fade`, cuyo keyframe aplica `transform`; un ancestro con `transform` (también `filter` o `will-change`) crea un containing block que atrapa a los descendientes `position: fixed` — el scrim queda confinado al contenedor. **No alcanza con `fixed inset-0` solo.**

- **Guard SSR obligatorio:** `document` no existe en el servidor → `const [mounted, setMounted] = useState(false)` + `useEffect(() => setMounted(true), [])` + `if (!mounted) return null` antes del `createPortal`. Todos los hooks se llaman antes de ese guard.
- Aplica a todos los modales y al `KebabMenu`.

### Shell de modales — `ModalShell` (componente compartido)

`ModalShell` (`components/ui/modal-shell.tsx`) es el **componente único de shell** que consumen todos los modales/diálogos. Encapsula scrim, panel, anatomía de 3 zonas, `max-height`, clipping y bloqueo del fondo; el modal aporta solo **contenido** y **acciones**. Subcomponentes: **`ModalShellHeader`** (pineado), **`ModalShellBody`** (scrolleable, `flex-1 min-h-0 overflow-y-auto`) y **`ModalShellFooter`** (pineado, `shrink-0`). El panel es una columna flex con `max-height: calc(100dvh - 48px)`: solo el cuerpo scrollea.

- **Ningún modal arma su propio scrim ni llama `useBodyScrollLock`:** lo hace el shell. Todo modal nuevo consume `ModalShell`.
- **Dos variantes** (`dialog` / `form`), que difieren en ancho y densidad, no en anatomía (ver `docs/design.md`).
- **Bloqueo del scroll del fondo:** con ≥1 modal abierto, `useBodyScrollLock` (`hooks/use-body-scroll-lock.ts`), **ref-counted** para modales apilados (el fondo se libera al cerrar el último). Usa `scrollbar-gutter: stable`.
- **Cierre por clic en el scrim — opt-in (`closeOnScrimClick`, default `false`).** Por defecto los modales no cierran al clickear el fondo (son de decisión). Un modal auxiliar/read-only pasa `closeOnScrimClick`; hoy solo `MovementDetailCard` (RF-VM-007). Ver el gotcha de burbujeo abajo.
- **`onEscape?`** — handler de Esc; default `onClose`. Un modal con navegación interna lo sobreescribe (caso: `MovementDetailCard` en vista evolución, RF-VM-009). **`wide?`** — panel de `max-w` 640px.
- Criterio visual en `docs/design/overlays-modales.md` §Overflow de modales y bloqueo del fondo (contrato de shell).

### Modal portado con `closeOnScrimClick` dentro de un trigger clickeable — `stopPropagation` en el scrim (gotcha)

**Un modal portado a `document.body` con `closeOnScrimClick`, montado dentro de una fila/trigger clickeable, DEBE hacer `stopPropagation()` en el handler de clic del scrim.** React propaga los eventos sintéticos **por el árbol de React**, no por el del DOM: el clic en el scrim **burbujea hasta el `onClick` del trigger** y **reabriría el modal** en el mismo gesto. Mismo patrón que `KebabMenu`. Caso vivo: `MovementDetailCard` montado desde el cuerpo clickeable de `MovementItemRow` (RF-VM-007).

### Foco inicial dentro de un modal — ref callback, no `useEffect` (gotcha)

**`ModalShell` monta sus hijos detrás de un `useEffect`** (portal SSR-safe): en el commit en que el modal se abre, su contenido todavía no está en el DOM. Un `useEffect(() => ref.current?.focus(), [])` dentro del modal **nunca enfoca nada** (`ref.current` es `null` y no vuelve a correr). El foco inicial sale de un **ref callback** que enfoca la primera vez que React attachea el nodo (con un flag para no re-enfocar). Precedente: `ActiveLimitDialog` (`focusCancelOnMount`).

### Sombra de corte en carriles con scroll interno — `useScrollShadow`

`useScrollShadow` (`hooks/use-scroll-shadow.ts`) marca el corte en superficies con scroll interno (grillas, tablas, gantt) con un **`box-shadow`** en el borde del carril. **No usa `mask` / fade:** un degradado sobre las celdas taparía una cifra de dinero.

### Portal para overlays anclados dentro de superficies con overflow (regla)

Todo **popover / kebab / tooltip / confirmación** anclado dentro de una superficie con `overflow` se monta por **`createPortal` a `document.body`**, posicionado `fixed` a partir del `getBoundingClientRect()` de su anclaje. Sostiene el **invariante 3** (ninguna acción inalcanzable) de `docs/design/fundamentos.md` §Contención responsive. Los `<select>` nativos no lo necesitan. Casos: `KebabMenu`, el listbox de método de pago, `SectionFilterPopover`.

### Posicionamiento + cierre de listbox/popover por portal — `use-listbox-popover` (hook canónico)

`hooks/use-listbox-popover.ts` es el **hook compartido** para posicionamiento y cierre de todo listbox/popover por portal. Regla visual en `docs/design/overlays-modales.md` §Cierre de overlays.

**Regla estructural:** todo popover/listbox por portal **consume este hook** en vez de duplicar el cálculo. Lo usan `payment-method-select`, `limit-category-select` y `limit-anchor-picker`.

- **`useListboxPosition(open, triggerRef, panelRef, intrinsicMaxHeight)`** — posición `fixed` del panel:
  - **Flip vertical:** abre **abajo** si entra; si no, **arriba**; si no entra en ningún lado, el lado con **más espacio** y recorta `maxHeight` (la lista scrollea internamente).
  - **Clamp horizontal** al viewport; el panel toma el ancho del disparador.
  - **Medición en dos pasadas:** estimada con `intrinsicMaxHeight` antes de pintar, real una vez montado.
- **`useListboxDismiss(open, close, triggerRef, panelRef)`** — cierra por clic-fuera / `Esc` (con **retorno de foco al disparador**) / **scroll externo en captura** / resize. El listener de scroll **ignora el scroll originado dentro del panel** (`panelRef.contains(e.target)`).
- **Constantes:** `POPOVER_GAP = 6`, `VIEWPORT_MARGIN = 12`.

### Overlay portaleado con posicionamiento en dos pasadas — dos trampas (gotcha)

1. **El efecto de la segunda pasada depende del `mounted` del panel.** Si el panel tiene su **propio guard SSR** independiente del `open`, ese `mounted` va en las dependencias del efecto; si no, nunca se re-ejecuta una vez que el nodo existe y la posición queda atada a la estimación.
2. **La segunda pasada mide `scrollHeight`, no `getBoundingClientRect()` ni `offsetHeight`.** Con un `maxHeight` clampeado por la primera pasada, la caja devuelve el alto **recortado**: medirla hace concluir "entra", libera el clamp y el contenido se desborda. `scrollHeight` es inmune al `maxHeight`.
3. **El clamp horizontal de `useListboxPosition` usa el ancho del DISPARADOR.** Un panel con `minWidth` mayor que su trigger necesita su propio clamp: si no entra alineado a la izquierda, se alinea al borde derecho del trigger y se clampea a `VIEWPORT_MARGIN`. Referencia: `RangeSelect`.

Cumplen el punto 1: `month-jump-popover.tsx` y `limits-info-popover.tsx`. `section-filter-popover.tsx` cumple los dos primeros.

### Breakpoint — variantes `wide:` / `max-wide:`

La disposición responsive se decide con **`wide:`** (`width ≥ 941px`) y **`max-wide:`** (`width < 941px`), habilitadas por `--breakpoint-wide: 941px` en `@theme` (`app/globals.css`). **El número `941` no se repite en ningún `.tsx`** y no se escriben media queries a mano para la disposición general (política en `docs/design/fundamentos.md` §Contención responsive). Dentro del área autenticada se usan las variantes de container query `@wide:`/`@max-wide:` (ver `docs/frontend/navegacion.md`).

### Régimen de superficie — variantes `capture:` / `app-regime:`

Qué superficie se pinta lo decide **CSS puro**, con dos `@custom-variant` en `globals.css`: **`capture:`** (régimen de captura) y **`app-regime:`** (su complemento). La condición evalúa **los dos ejes** —`width < 600px` **o** `height < 600px`—; rotar no cambia de régimen. Criterio funcional en `docs/requirements/apariencia.md`, RF-APP-003. **El número no se escribe en ningún `.tsx`**.

- **`--bp-capture: 600px` vive en `@theme` como token de referencia, fuera del namespace `--breakpoint-*`.** Ese prefijo haría que Tailwind v4 genere una variante `capture:` de un solo eje que colisionaría con el `@custom-variant`. Como la sintaxis de rango de Media Queries L4 no admite `var()`, el literal `600` está en los dos lugares: se cambian juntos.
- **Gotcha de build — el operador es el textual `or`, no una lista por comas.** `@custom-variant capture (@media (width < 600px), (height < 600px))` genera CSS roto ("Invalid empty selector"). La forma válida es `(@media (width < 600px) or (height < 600px))`.
- **`short:`** (`@media (max-height: 480px)`) es un umbral del eje vertical, exclusivo de la superficie de captura; el `480` vive solo en esa declaración. En `docs/design/captura.md` se lo nombra `--bp-short`.

## Dos regímenes de superficie (RF-APP-003/004)

El root layout (`app/layout.tsx`) monta **las dos ramas a la vez**: el árbol de la app (`<div className="capture:hidden">{children}</div>`) y `CaptureSurfaceRoot` (`components/capture/`, raíz `hidden capture:block`). Ninguna decisión de superficie pasa por JS: se resuelve antes del primer paint, así que cruzar la frontera conmuta sin recarga y sin flash. Contrapartida: **el documento siempre contiene los dos árboles** (ver §ids del DOM).

`CaptureSurfaceRoot` recibe `isAuthenticated` / `email` **resueltos en el servidor** (el layout ya corre `auth()`), no de `useSession()`: no hay estado "loading" intermedio. Entrar y salir de la sesión navegan, así que esas props se recalculan en cada respuesta.

### Una lógica, dos composiciones (patrón)

**La lógica de una feature vive en un hook agnóstico de UI; cada superficie aporta su propia composición.** Hooks: `use-transaction-form-logic.ts`, `use-recurring-form-logic.ts`, `use-installment-form-logic.ts` y `useLoginFormLogic` (`app/login/login-form.tsx`). Los consumen el modal de escritorio (`components/movements/`) y la superficie de captura (`components/capture/`).

- **Ninguna deriva de la otra.** No hay composición "base" con overrides de CSS ni props de densidad.
- **El hook nunca sabe en qué superficie se renderiza.** Lo que varía (qué botones hay, qué pasa después de guardar) entra como opción de quien lo instancia (p. ej. `onCreateSuccess`).
- **Regla:** una feature que deba existir en los dos regímenes se parte así.

### Footer como slot del envase

**Los forms de movimiento no dibujan sus botones.** El hook reporta el estado del footer —`MovementFormFooterState` (`components/movements/movement-form-footer.ts`): `formId`, `isLoading`, `disabled`, `submitLabel`— vía `onFooterStateChange`, y el **envase** dibuja los botones.

- El reporte va en **`useLayoutEffect`**: el envase necesita el estado **antes** del primer paint del botón externo.
- El botón se asocia con **`<button type="submit" form={formId}>`** — funciona aunque el botón no sea descendiente del `<form>` (el footer es **hermano** del cuerpo scrolleable).
- Permite que el modal de escritorio tenga **Cancelar + Guardar** y la captura solo **Guardar**, sin condicional de superficie en el form.

### ids del DOM — prefijo `useId()` (regla)

**Todo componente que pueda estar montado más de una vez simultáneamente genera sus ids con un prefijo de `useId()`** (en los forms de movimiento es el `formId`: ``id={`${formId}-amount`}`` y su `htmlFor` en espejo). Con ids literales hay **ids duplicados**: un `<label for="amount">` resuelve al **primer** nodo con ese id —que puede ser el del árbol oculto por CSS— y clickear la etiqueta enfoca un input invisible. Como las dos superficies están montadas a la vez, el caso es permanente.

### Viewport meta — `interactive-widget: overlays-content`

`app/layout.tsx` declara `interactiveWidget: "overlays-content"` **deliberadamente**. Con `resizes-content`, el teclado virtual **encoge el viewport de layout** y altera toda media query de alto: puede cruzar `short:` (480px) o el umbral de régimen **mientras el usuario tipea**. Con `overlays-content` el viewport de layout (y `dvh`) queda estable. Mantener **Guardar** visible sobre el teclado lo resuelve `useVisualViewportInset` (`hooks/use-visual-viewport-inset.ts`), consumido solo por `CaptureShell`.

### Toasts por encima del footer pineado — `--toast-inset-bottom`

`ToastViewport` ancla la pila con `--toast-inset-bottom`; en régimen de captura `globals.css` la sobreescribe con el alto del footer pineado (más safe-area), de modo que un toast nunca tapa **Guardar**. Valores en `docs/design/captura.md`.

## Autenticación (Auth.js / NextAuth v5)

NextAuth **orquesta el login** pero **no emite un token de identidad propio**: el JWT lo emite NestJS (ver `docs/architecture.md`; emisión en `docs/backend/base.md` §Autenticación). NextAuth lo persiste y lo expone para reenviarlo al backend.

### Providers

- **Credentials provider:** su `authorize` llama a `POST /auth/login` y devuelve el `accessToken` y el `user` que emite el backend.
- **Google provider:** scaffolded, condicional a que existan las credenciales; inactivo. `isGoogleConfigured` depende de `GOOGLE_CLIENT_ID` (sin prefijo `NEXT_PUBLIC_`), así que solo se evalúa en el servidor (ver patrón server-only de `@/lib/env` en §Convenciones). Para activarlo hace falta exponer un flag con prefijo `NEXT_PUBLIC_`; no exponerlo mientras Google esté deshabilitado a propósito.

### Callbacks y sesión

Los callbacks `jwt` y `session` persisten el **`accessToken` de NestJS** y el **`userId`** dentro de la sesión. `session.accessToken` queda disponible para las llamadas al backend.

> La sesión de Auth.js es un JWE propio; el `accessToken` que viaja dentro es el JWT de NestJS, opaco para el front. Son dos tokens distintos (ver `docs/data-model/auth.md`).

### Seeding de la sesión en el root layout

El root layout (`app/layout.tsx`) es un Server Component `async` que ejecuta `auth()` en cada request y **siembra la sesión** pasándola como prop `session` a `SessionProvider` (`lib/session-provider.tsx`).

- **Efecto:** en el primer render del cliente `useSession()` ya está `authenticated`, así que `usePreferences` arranca con el blob real en vez de `{}` (sin flash de defaults).
- **Trade-off:** desencriptar la cookie se paga en cada navegación de página completa; en navegación SPA no.
- **Gotcha:** `auth()` devuelve `null` en rutas no autenticadas y `SessionProvider` acepta `null`; no hay lógica condicional en el layout.
- **Relación con el tema:** el flash del modo de color lo cubre el script anti-FOUC (ver §Modo de color); el seeding resuelve el del resto de las preferencias.

### Adjuntar el Bearer al backend (patrón obligatorio)

**No hay interceptor global.** Toda llamada al backend usa uno de estos dos caminos:

- **Client Components** → hook **`useApi`**, que toma `session.accessToken` de `useSession()`.
- **Server Components** → **`auth()`** y pasar el token a **`apiRequest({ token })`**.

### Queries de lectura gate-adas con `isAuthenticated` (patrón obligatorio)

`useApi()` expone **`isAuthenticated = status === "authenticated" && Boolean(token)`**. **Toda query de lectura que se monta al cargar una pantalla autenticada DEBE incluir `enabled: isAuthenticated`** (o `enabled: <condición> && isAuthenticated`).

- **Por qué:** durante `status === "loading"` la sesión es `null`. Sin el guard, React Query dispara la request **sin** `Authorization`, el backend responde `401` y el retry genera un **doble fetch** en cada carga.
- **El criterio se centraliza en `useApi()`**; no reimplementar la condición.
- **Las mutaciones NO necesitan el guard.**
- Ej.: `useMovements` (`enabled: Boolean(month) && isAuthenticated`), `useCategories` (`enabled: isAuthenticated`).

### Pantallas y protección de rutas

- Pantallas `/login` y `/registro`; dashboard en `/` (ver `docs/frontend/vista-mes-y-dashboard.md`).
- **Protección de rutas** vía `src/middleware.ts`: una ruta privada sin sesión redirige a `/login`; un usuario autenticado que entra a `/login` o `/registro` va a `/`.
- `callbackUrl` / `redirectTo` por defecto del login, el registro y `use-register` apuntan a `/`. **Sign-out va a `/login`.**
- **Auto-login tras registro** (RF-AUTH-006).

### Manejo centralizado del 401 del backend (RF-AUTH-007)

El cierre de sesión ante un `401` es **centralizado**: vive en `lib/react-query.tsx` en los `onError` de **`QueryCache`** y **`MutationCache`**, que detectan un `ApiError` con `statusCode === 401`, emiten el toast "Tu sesión expiró, volvé a entrar." y llaman `signOut({ callbackUrl: "/login" })`. **No** reimplementar el 401 en cada hook.

- **Solo el `401`** dispara este flujo; `403`/`400`/`500`/red se manejan en cada consumidor (el `503` de red además alimenta el gate de arranque, ver `docs/frontend/gate-arranque.md`).
- **Guard anti-duplicados a nivel de módulo:** un solo `signOut` y un solo toast; no se dispara si ya se está en `/login`.
- **Toast desde fuera del árbol de React:** el emisor imperativo `emitToast` (`components/ui/toast.tsx`) lo registra `ToastProvider` al montar. Si se toca `ToastProvider`, mantener ese registro.

## Preferencias de usuario

Persistencia de estado de UI que sobrevive a la navegación y al cierre de sesión. Contrato y claves del blob en `docs/data-model/preferencias.md`.

### Preferencias en la sesión de Auth.js

El blob viaja **dentro de la sesión de Auth.js**, junto al `accessToken` y el `userId`. Tipado en **`next-auth.d.ts`** (`Session`, `User` y `JWT`).

- **Carga al loguear:** llega en el `AuthResponse` (`data.preferences`) de Credentials y Google; los callbacks lo persisten en el token y lo exponen en **`session.preferences`**.
- **Refresh sin re-login:** el callback **`jwt` maneja `trigger === "update"`** cuando una mutación llama a `useSession().update()`.

### Hook `usePreferences` (`src/hooks/use-preferences.ts`)

```
const { preferences, isLoading, isSaving, setPreferences } = usePreferences()
// setPreferences(newBlob): Promise<{ success, preferences?, error? }>
```

- **`preferences`** — blob actual. La query usa **`initialData: session?.preferences ?? {}`** para evitar el flash de `undefined`.
  - El `initialData` se siembra con **`initialDataUpdatedAt: 0`** (stale de entrada): apenas `enabled: isAuthenticated` pasa a `true`, React Query dispara **`GET /preferences`** en background y reemplaza el blob sembrado. Sin esto, con `staleTime` de 5 min el `initialData` se trataría como fresco y quedaría el valor del primer render (que tras un refresh es `{}`). `initialDataUpdatedAt: 0` no toca la actualización optimista de `setPreferences` (`setQueryData`).
- **`setPreferences(newBlob)`** — `PUT /preferences` y, al confirmar, `useSession().update()`. Devuelve `{ success, preferences?, error? }`.
- **El llamador hace el merge.** La semántica del backend es **reemplazo total**: `setPreferences({ ...preferences, clave: valor })`. Omitir una clave la **borra**.
- **Patrón de consumo optimista** (lo usan `monthSections`, `monthListFilters`, `sidebarOpen`, `reports`): el estado local cambia inmediato y `setPreferences` persiste en background, sin bloquear la interacción con `isSaving`.

## Design system "Precise Ledger" — tokens

Lo esencial para no romper tokens:

- **Fuente de verdad de los valores:** `docs/design/control.css`. Implementación: tokens en `app/globals.css`, fuentes en `app/layout.tsx`. Preset Medio, acento Índigo. Modo claro y oscuro (ver §Modo de color).
- **Tokens en dos lugares por diseño de Tailwind v4:** `@theme` (valores literales que generan utilidades `bg-paper`/`text-accent`/`rounded-card`/`font-ui`) y `:root` (CSS vars `var(--accent)`… + sombras compuestas, densidad y fuentes). Cambiar un color implica mantener **ambos** alias.
- **Acento:** hue por `var(--accent-h)` (264) en `:root`, **hardcodeado a `264` en `@theme`** porque Tailwind v4 no resuelve CSS vars dentro de `@theme` en build.
- **Sin utilidad `shadow-*` del DS:** las sombras compuestas viven solo en `:root` (`var(--shadow-sm|md|lg)`).
- **Densidad fija** (`--row-pad`/`--card-pad`/`--gap`).
- **Cifras de dinero:** helper `.mono` (IBM Plex Mono + `tnum`).
- **Token semántico `warning`** (ámbar, hue 75) con la misma dualidad `@theme`/`:root` que income/expense, con variante oscura.
- **Token semántico `--rate`** (grafito, hue 270) — línea de inflación del reporte Inflación vs Ingresos (RF-REP-012). Claro `oklch(0.45 0.03 270)`, oscuro `oklch(0.72 0.025 270)`; utilidades `bg-rate` / `text-rate` vía `--color-rate`.
- **Todas las pantallas y modales usan el DS y `lucide-react`**; no hay SVG inline ni estilos fuera del DS. Compartidos: **`components/ui/auth-brand-side.tsx`** (panel de marca de login y registro) y la animación **`animate-modal-pop`** (`globals.css`).

## Modo de color (theming)

Modo Sistema / Claro / Oscuro (RF-APP-001), resuelto **por override de los alias CSS de `:root`** y aplicado a `<html>`. Spec visual en `docs/design/fundamentos.md` §Modo de color — claro / oscuro.

- **El override va sobre `:root`, no sobre `@theme`.** El modo oscuro redefine los alias de `:root` bajo **`[data-theme="dark"]`**. **`@theme` NO se toca** (sus valores se hornean en build). El atributo **`data-theme` se setea en `<html>`**.
- **Fuente canónica = blob `preferences` (clave `theme`).** Flujo **DB → mirror localStorage → DOM**; la aplicación al DOM es **optimista**. El mirror (`"control:theme"`) **no es fuente de verdad**: existe solo para el boot sin flash.
- **Anti-flash (FOUC) — script inline síncrono en el `<head>` del root layout.** Un IIFE **clásico** (`dangerouslySetInnerHTML`, **sin** `type="module"`) aplica el tema **antes del primer paint** leyendo el mirror; si vale `"system"` resuelve con `matchMedia("(prefers-color-scheme: dark)")`. **Gotcha:** los módulos ES son diferidos y correrían post-paint. `<html>` lleva **`suppressHydrationWarning`**.
- **Reacción en vivo en "Sistema":** un listener de `matchMedia` repinta al cambiar el `prefers-color-scheme` del SO.
- **Transición de flip a nivel `html`** (~0.18–0.20s, solo color, nunca layout); instantánea bajo `prefers-reduced-motion`. El panel de marca de auth (`.auth-grid-bg` / `.auth-glow`) es invariante.

## Tailwind v4 — convenciones y gotcha

- **Clases en forma canónica.** Toda clase se escribe en la forma que sugiere el diagnóstico de Tailwind IntelliSense v4 (`designSystem.canonicalizeCandidates(c, { rem: 16 })`): escala de spacing en vez de arbitrario (`max-w-280`, `py-8.5`; 1 unidad = 4px), token del tema si coincide (`rounded-chip`), shorthand `shadow-(--shadow-sm)` en vez de `shadow-[var(--shadow-sm)]`. Los px de `docs/design.md` son la especificación del valor, no la clase a escribir. Arbitrario solo si no hay equivalente (p. ej. `grid-rows-[0fr]`).
- No usar `@apply` con clases que referencian tokens custom (ej: `border-border`). En `@layer base` referenciar las CSS variables directo con `var(--color-border)`; si no, el build da un error poco claro.

## Íconos de la app y PWA manifest

Los íconos se cablean por **file conventions de Next.js 15** — no hay `<link>` manuales en `layout.tsx`:

| Archivo | Rol |
| --- | --- |
| `src/app/icon.svg` | Favicon escalable. |
| `src/app/favicon.ico` | Fallback legacy multi-res (16/32/48). |
| `src/app/apple-icon.png` | iOS home-screen, 180×180. |
| `src/app/manifest.ts` | Genera `/manifest.webmanifest` (PWA). |
| `public/web-app-manifest-192x192.png` / `-512x512.png` | Íconos referenciados por el manifest. |

- **Fuente de los assets:** `docs/design/icon-export/`. Para cambiar el ícono se reemplazan esos fuentes y se regeneran los derivados.
- **Color del manifest:** `theme_color: "#1b46b4"`, `background_color: "#ffffff"`.
- **Gotcha — `purpose` no combinado:** `MetadataRoute.Manifest` de Next 15 no acepta `purpose: "any maskable"`. El manifest lista **4 entradas**: 192 y 512, cada una en `any` y en `maskable`.
- **Gotcha — `sharp` no es dep declarada:** vive en `node_modules/.pnpm/sharp@.../`. Un script de generación de assets debe referenciarlo por path o instalarlo explícito.

### Logo de marca in-app (≠ favicon)

El logo dentro de la app (gem del sidebar, chip del login) usa `public/brand-icon.svg`, **no** `src/app/icon.svg`. Detalle visual en `docs/design/sidebar.md` §Logo de marca.

- **Dos copias del mismo SVG, a propósito:** `src/app/icon.svg` es file-convention de Next (su URL no es estable) y `public/brand-icon.svg` es el asset addressable como `/brand-icon.svg` para `<img src>`. **No deduplicar.**
- **`<img>` nativo** (no `next/image`), con `eslint-disable-next-line @next/next/no-img-element`: los SVG no se optimizan. Migrar a `next/image` requiere `unoptimized` + `fill` con contenedor `relative`.
- **Consumidores:** `app-sidebar.tsx` (gem 34×34) y `auth-brand-side.tsx` (chip 44×44 con el ícono 34×34).

## Testing — gotchas

- Tests en `tests/` (hermana de `src/`), espejando `src/`. Convención completa en `docs/technical.md` §Testing.
- Con `vi.useFakeTimers()` activo: `waitFor` no funciona (usa `setInterval`). Disparar con `fireEvent`, avanzar con `act(() => vi.advanceTimersByTime(...))` y afirmar síncrono. En `afterEach`, `vi.clearAllTimers()` (no `runAllTimers()`) antes de `vi.useRealTimers()` para evitar warnings de act() de React 19.
- **jsdom no ejecuta CSS:** los elementos ocultos por CSS (`hidden`, `grid-rows-[0fr]` colapsado) **siguen en el árbol**:
  - **Dos variantes responsive del mismo contenido** quedan ambas → `getByText`/`getByLabelText` fallan por duplicado. Patrón: `aria-hidden="true"` en la variante que no debe estar en el árbol de accesibilidad, y `getAllByText` cuando el texto se comparte. Aplica a `/mes` (flechas ≥1288px vs stepper ≤1287px).
  - **Container queries (`@wide:`/`@max-wide:`) tampoco se evalúan:** los dos regímenes conviven en el DOM. Acotar con **`within(dialog)`** (o el contenedor) o usar **`getAllByRole`**.
  - **Disclosure colapsable (grid-rows):** afirmar contra render / no-render del nodo, no contra visibilidad. Ej. "Moneda y cotización": el selector de moneda siempre está en el DOM; el input de cotización solo se renderiza cuando `currency !== defaultCurrency`.
  - **`role="region"` duplicado:** si el `<section>` padre del acordeón ya provee `role=region` vía `aria-labelledby`, no poner otro con el mismo nombre en el `<div>` interno.
  - **`getByRole("button", { name })` ambiguo** (disclosure del acordeón + disparador `aria-label="Filtrar {sección}"`): diferenciarlos por `aria-expanded` + `aria-controls` (helper `getDisclosureButton`).
- **Mock global de `matchMedia` en `tests/setup.ts`:** jsdom no implementa `window.matchMedia`; lo necesitan los componentes que detectan `prefers-reduced-motion`.
- **Mockear hooks de datos: usar los fixtures de `tests/utils/query-result.ts`.** `mockQuerySuccess(data)`, `mockQueryLoading()` y `mockQueryError(error)` (con `overrides` parcial) arman un `UseQueryResult<T, E>` **completo**. Un parcial casteado **no compila** (TS2352) y taparlo con `as unknown as` deja el mock mintiendo. **Regla: reusar estos helpers.** `tests/utils/` es la carpeta de utilidades transversales, fuera del árbol que espeja `src/`.
- **`renderHook` infiere `TProps` solo de `options.initialProps`.** Si `initialProps` va inline sin anotar, TS infiere tipos demasiado angostos (literal `"ARS"`, o `null`/`undefined`) y un `rerender({...})` posterior falla con TS2322. **Patrón:** declarar `initialProps` como variable con **tipo explícito** (el tipo de dominio de `src/types/`).
- **`ChartResponsiveArea` y Recharts en tests:** ver `docs/frontend/graficos.md` §Gotchas de las cards de gráficos.
