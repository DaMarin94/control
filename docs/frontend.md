# Frontend

> Estructura y decisiones técnicas del frontend. Se completa a medida que el código se construye.

## Stack

- Next.js 15 (App Router) + Tailwind CSS v4
- TypeScript strict (`noUnusedLocals`, `noUnusedParameters`)

## Tipos

El frontend define sus propios tipos, que reflejan el contrato de la API del backend (ver formato de respuesta en `docs/technical.md`). No hay paquete de tipos compartido con el backend.

## Estructura de carpetas

Organización **por tipo de archivo**:

```
frontend/src/
├── app/            (rutas del App Router)
│   ├── login/, registro/   (públicas, sin sidebar)
│   └── (app)/              (route group autenticado con layout+sidebar compartido: /, /mes, /categorias)
├── components/     (todos los componentes de UI)
├── hooks/          (todos los hooks: useToast, hooks de datos, etc.)
├── lib/            (capa de API centralizada, config, helpers)
└── types/          (tipos que reflejan el contrato de la API)
```

Dentro de cada carpeta se pueden agrupar archivos por dominio (ej: `components/movements/`) si el volumen lo justifica, pero la división de primer nivel es por tipo.

## Convenciones

- **Server vs Client Components:** por defecto Server Components (App Router de Next 15). Se marca `"use client"` solo cuando hace falta interactividad, estado o hooks. Páginas y layouts arrancan server; formularios, toasts y data-fetching con React Query van en client.
- **`@/lib/env` es un módulo server-only.** Corre `validateEnv()` a nivel de módulo y valida secretos **sin** prefijo `NEXT_PUBLIC_` (`AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). En el browser esas vars son `undefined`, así que un client component (`"use client"`) que lo importe **crashea en runtime** con un error de Zod ("AUTH_SECRET: Required") aunque la var esté correctamente seteada en `.env.local`. **Patrón obligatorio:** ningún client component importa `@/lib/env`; si necesita un valor derivado de env, el **Server Component padre lo lee y lo pasa como prop**. Ejemplo aplicado: `src/app/login/page.tsx` (server) lee `isGoogleConfigured` y lo pasa a `<LoginForm isGoogleConfigured={...} />` (client).
- **Capa de llamadas al backend en `lib/`:** un único lugar centraliza las llamadas (ver Error handling en `docs/technical.md`). Ningún componente llama a `fetch` directo.
- **Hooks de datos:** envuelven esa capa con React Query (ver Convenciones de hooks en `docs/technical.md`).

## Sistema de componentes (UI primitives)

Lo visual se define **una sola vez**. Stack: **shadcn/ui + cva** sobre Tailwind v4.

- **Una sola primitiva por elemento:** un `Button`, una `Table`, un `Link`, un `Input`, etc. Viven en `components/ui/`.
- **Las variantes son parámetros, no componentes nuevos.** "Botón redondo", "botón enorme", "botón fantasma" son el mismo `Button` con props: `<Button variant="ghost" size="lg" />`. Si hace falta una variante nueva, se agrega a la primitiva — no se crea otro botón.
- **Las features componen primitivas.** Nunca se reestiliza desde cero ni se usa un `<button>` HTML crudo. Todo elemento visual sale de su primitiva.
- **Variantes tipadas con `cva` (class-variance-authority):** cada primitiva declara sus `variant`/`size`/etc. en un solo lugar, con autocompletado de TypeScript.
- **Primitivas headless y accesibles:** shadcn se apoya en Radix UI — comportamiento y accesibilidad ya resueltos.
- **El código es propio:** los componentes de shadcn se copian al repo y se controlan desde acá; no es una dependencia black-box.

**Límite con el diseño visual:** acá se define la regla arquitectónica (primitivas únicas, variantes por parámetro). El aspecto concreto (colores, tamaños, qué se ve como "primary") lo define el diseño sobre estas primitivas.

- **Las primitivas usan los tokens del design system "Precise Ledger"** (ver sección Design system). Detalle operativo del re-estilado (variantes de Button, patrones Tailwind v4, toast) en `.claude/agents/control-frontend.md`.
- **Íconos: `lucide-react`** (no SVG inline). Es la librería de íconos del proyecto.
- **`PeriodNav` (`components/ui/period-nav.tsx`)** — primitiva **genérica de navegación de período**: envuelve un contenido y le pone **flechas gigantes a los costados** (`‹ contenido ›`). La usa **`/mes`** para navegar el mes. (Reportes **no** la usa: navega el año con un stepper pill embebido per-card — ver sección Reportes.) El spec visual vive en `docs/design.md`. API y gotcha de uso en la sección Navegación de período (`PeriodNav`).
- **`KebabMenu` (`components/ui/kebab-menu.tsx`)** — menú de tres puntos para las acciones de fila **editar / eliminar** en listas. Es el **componente estándar para esas acciones**: toda lista nueva que las necesite lo usa, en lugar de botones inline en la fila. Se renderiza **por portal a `document.body` con posición `fixed`** (coordenadas tomadas del `getBoundingClientRect()` del trigger) por DOS razones estructurales: (a) las tarjetas de lista tienen `overflow-hidden`, que recortaría un menú `absolute`; (b) el portal lo saca del ancestro transformado (ver "Modales y diálogos: portal a `body`"). API: `ariaLabel`, `items` (`{ label, icon?, onSelect, danger? }`), `className`. El ítem `danger: true` se pinta en `text-expense-ink`. El trigger se mantiene visible mientras el menú está abierto; el menú se cierra en select / click afuera / Escape / scroll / resize (no recalcula posición en movimiento: cierra limpio).

### Estados de carga: skeletons (regla)

**Todo estado de carga del frontend se renderiza con un skeleton** construido con las primitivas del sistema, **imitando el layout real** del contenido que reemplaza (mismas medidas y posiciones, sin saltos al cargar). Aplica también a desarrollos futuros: no se usan spinners genéricos ni placeholders ad-hoc.

- **Primitivas en `components/ui/skeleton.tsx`:** `SkeletonLine` / `SkeletonBlock` / `SkeletonCircle` / `SkeletonPill`. Una feature compone estas primitivas para reconstruir su propio layout de carga.
- **Animación:** utilidad `.animate-shimmer` (en `globals.css`), desactivada bajo `prefers-reduced-motion`.
- **Accesibilidad:** el contenedor de carga lleva `role="status"` + `aria-label`; los placeholders internos van `aria-hidden`.
- El detalle visual (tokens, medidas, animación, mapeo por pantalla) vive en `docs/design.md` §Skeletons — referenciar, no duplicar.

### Modales y diálogos: portal a `body` (regla)

**Todo componente con scrim `fixed inset-0` (modales, diálogos de confirmación) se monta vía `createPortal(<scrim/>, document.body)`.** Los contenedores de página usan `animate-screen-fade`, cuyo keyframe aplica `transform`; un ancestro con `transform` (también `filter` o `will-change`) crea un containing block que atrapa a los descendientes `position: fixed` — el scrim deja de medirse contra el viewport y queda confinado al contenedor, corrido y sin cubrir la pantalla. El portal extrae el modal de ese árbol y lo monta directo en `body`. **No alcanza con `fixed inset-0` solo.**

- **Guard SSR obligatorio:** `document` no existe en el servidor → `const [mounted, setMounted] = useState(false)` + `useEffect(() => setMounted(true), [])` + `if (!mounted) return null` antes del `createPortal`. Todos los hooks se llaman incondicionalmente antes de ese guard (reglas de hooks).
- Aplica a todos los modales (movimiento, borrado, categoría) y al `KebabMenu`.
- **`AccordionSection` (`components/ui/accordion-section.tsx`)** — sección de acordeón **genérica**: cabecera-disclosure (`aria-expanded` / `aria-controls`, chevron rotatorio), **handle de drag opcional** y cuerpo colapsable animado. Reutilizable en cualquier pantalla con secciones plegables. **Animación sin JS** (ver gotcha grid-rows abajo). Lo usan las secciones de `/mes` (RF-VM-005).
  - **Patrón `filterSlot`:** slot opcional que `AccordionSection` renderiza como **hermano** del `<button>` disclosure, **no como hijo** — por a11y, un control interactivo no puede anidarse dentro de un `<button>`. Se **oculta en `isOrderMode`**. Patrón reutilizable para colgar controles propios de una sección (en `/mes`: el disparador de filtro tipo+categoría).
- **`SectionFilterPopover` (`components/ui/section-filter-popover.tsx`)** — disparador + popover que combina un **triple switch de tipo** (Gasto / Ingreso / Ambos) y un **bloque de categorías embebido** (tres estados, igual que el resto). Es el control de filtro por sección de `/mes` (RF-VM-006), montado vía el `filterSlot` de `AccordionSection`. **El universo de categorías que ofrece se deriva de los movimientos crudos de su sección** (tipo compartido `CategoryOption`), **no** del hook de catálogo de categorías: cada sección lista solo las categorías presentes en sus propios movimientos (RF-VM-006).
- **`SectionSortButton`** — control de orden de la sección **Únicos** de `/mes`: alterna `unicosSort` entre `"amount"` y `"date"` (RF-VM-001), montado en la cabecera junto al disparador de filtro. Solo en Únicos.
- **`SortableSection` (`components/ui/sortable-section.tsx`)** — envuelve `AccordionSection` con `useSortable` de **dnd-kit**; el sortable se activa **solo en modo orden**. Es el patrón estándar para "lista de bloques reordenables por drag". **Sin `DragOverlay`:** el ítem arrastrado se mueve **in-place**, restringido al **eje vertical y al contenedor** con los modifiers `restrictToVerticalAxis` + `restrictToParentElement` de **`@dnd-kit/modifiers`**. El original no se oculta; el "activo" lo computa el padre vía `activeId` y se pasa por prop (`isActive`).
- **dnd-kit** (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@dnd-kit/modifiers`) es el **motor de drag estándar del proyecto**. Todo drag nuevo (reordenar listas, etc.) lo usa, no se implementa drag a mano. Gotchas de uso (sensor `distance:8` con elementos clickeables, `role=region` en jsdom) en `.claude/agents/control-frontend.md`.

## Autenticación (Auth.js / NextAuth v5)

NextAuth **orquesta el login** en el front pero **no emite un token de identidad propio**: el JWT que importa lo emite NestJS (ver `docs/architecture.md`). NextAuth solo lo persiste y lo expone para reenviarlo al backend.

### Providers

- **Credentials provider:** su `authorize` llama a `POST /auth/login` del backend y devuelve el `accessToken` y el `user` que el backend emite.
- **Google provider:** scaffolded, condicional a que existan las credenciales. Hoy diferido — no está activo. `isGoogleConfigured` depende de `GOOGLE_CLIENT_ID` (**sin** prefijo `NEXT_PUBLIC_`), así que solo se evalúa en el servidor: la página de login (server) lo lee y lo pasa por prop al `LoginForm` (client) — ver el patrón server-only de `@/lib/env` en Convenciones. Para activarlo de verdad hace falta exponer un flag con prefijo `NEXT_PUBLIC_`; no exponerlo mientras Google esté deshabilitado a propósito.

### Callbacks y sesión

Los callbacks `jwt` y `session` persisten el **`accessToken` de NestJS** y el **`userId`** dentro de la sesión de Auth.js. `session.accessToken` queda disponible para las llamadas al backend.

> La sesión de Auth.js es un JWE propio (encriptado por NextAuth); el `accessToken` que viaja dentro es el JWT de NestJS, opaco para el front. Son dos tokens distintos (ver `docs/data-model.md`).

### Adjuntar el Bearer al backend (patrón obligatorio)

**No hay interceptor global.** Toda fase que consuma el backend debe usar uno de estos dos caminos:

- **Client Components** → hook **`useApi`**, que toma `session.accessToken` de `useSession()`.
- **Server Components** → llamar **`auth()`** directamente y pasar el token a **`apiRequest({ token })`**.

### Queries de lectura gate-adas con `isAuthenticated` (patrón obligatorio)

`useApi()` expone un flag **`isAuthenticated = status === "authenticated" && Boolean(token)`**, derivado del `status` de `useSession()`. **Toda query de lectura de React Query que se monta al cargar una pantalla autenticada DEBE incluir `enabled: isAuthenticated`** (o `enabled: <condición> && isAuthenticated`).

- **Por qué:** durante el ciclo `status === "loading"` de Auth.js la sesión es `null` y el `accessToken` aún no está disponible. Sin el guard, React Query dispara la request **sin** header `Authorization`, el backend responde `401`, y el retry genera un **doble fetch** en cada carga (401 espurio + refetch).
- **El criterio se centraliza en `useApi()`** — todos los hooks de lectura lo consumen de ahí; no reimplementar la condición.
- **Las mutaciones NO necesitan el guard:** las dispara el usuario ya autenticado.
- **Aplicado en:** `useMovements` (`enabled: Boolean(month) && isAuthenticated`) y `useCategories` (`enabled: isAuthenticated`).

### Pantallas y protección de rutas

- Pantallas `/login` y `/registro`; dashboard en `/` (ver sección Vista del mes y Dashboard).
- **Protección de rutas** vía `src/middleware.ts`: una ruta privada sin sesión redirige a `/login`; un usuario autenticado que entra a `/login` o `/registro` es redirigido a `/`.
- **Auto-login tras registro:** un registro exitoso deja al usuario logueado sin pasar por la pantalla de login (RF-AUTH-006).

## Preferencias de usuario

Mecanismo de persistencia de preferencias del usuario (estado de UI que sobrevive a la navegación y al cierre de sesión). Lo consumen las secciones colapsadas/orden de `/mes`, los reportes y el filtro por categoría. Contrato del backend en `docs/data-model.md` ("Contrato de preferencias de usuario").

### Preferencias en la sesión de Auth.js

El blob de preferencias viaja **dentro de la sesión de Auth.js**, junto al `accessToken` y el `userId`. Tipado en **`next-auth.d.ts`**: `preferences` está declarado en `Session`, `User` y `JWT`.

- **Carga al loguear:** el blob llega en el `AuthResponse` (`data.preferences`) de los flujos Credentials y Google, y los callbacks de Auth.js lo persisten en el token y lo exponen en **`session.preferences`**. No se pide aparte; viaja con el login (igual que el `accessToken`).
- **Refresh sin re-login:** el callback **`jwt` maneja `trigger === "update"`** para refrescar el blob del token cuando una mutación llama a `useSession().update()`, sin que el usuario tenga que volver a loguearse.

### Hook `usePreferences` (`src/hooks/use-preferences.ts`)

API para las fases consumidoras. Expone:

```
const { preferences, isLoading, isSaving, setPreferences } = usePreferences()
// setPreferences(newBlob): Promise<{ success, preferences?, error? }>
```

- **`preferences`** — el blob actual. La query usa **`initialData: session?.preferences ?? {}`** para evitar el flash de `undefined` en el primer render de la consumidora.
- **`setPreferences(newBlob)`** — persiste con **`PUT /preferences`** y, al confirmar, actualiza la sesión con **`useSession().update()`** (dispara el `trigger === "update"` del callback `jwt`). Devuelve `{ success, preferences?, error? }`.
- **El llamador hace el merge.** Como la semántica del backend es **reemplazo total** (no merge), para cambiar una sola clave el consumidor parte del blob actual y manda el objeto completo: `setPreferences({ ...preferences, clave: valor })`. Omitir una clave la **borra**.

## Categorías (`/categorias`)

CRUD de categorías. Se accede desde el **link "Categorías" del sidebar** (RF-NAV-001) y por URL. Vive bajo el route group `app/(app)/categorias/` (ver sección Navegación global).

### Pantalla

Lista de categorías **activas**: por fila el color, el nombre, el scope legible (`AMBOS` / `GASTO` / `INGRESO`) y el contador `"N movimientos"`. Botón "Nueva categoría". Acciones por fila: **Editar**, **Eliminar**. Estados: Cargando, Con datos, Vacío.

- **Modal único crear/editar:** "Nueva categoría" lo abre vacío; "Editar" lo abre pre-cargado. Campos: nombre, scope y **color** (`ColorPicker`).
- **`ColorPicker` (grid 10×7).** Selector de color con la matriz de 70 colores, presente en crear y editar. En **crear** arranca con el **menos-usado** pre-seleccionado (`getLeastUsedBaseColor()`, replica el criterio de `assignColor` del backend sobre la fila base); en **editar**, con el color actual. Tiene botón **"aleatorio"**. El front siempre envía `color` al backend.
- **Eliminar:** diálogo de confirmación antes del soft delete.

### Flujo de reactivación (409 reactivable)

Al crear, si el backend responde `409` con `error.data.reactivable`, el modal **no muestra un error de duplicado**: muestra un prompt "Ya tenés una categoría 'X' eliminada. ¿Querés reactivarla?" con **Reactivar / Cancelar**. El prompt aclara explícitamente que la categoría vuelve con su **configuración original (scope y color)**, no con lo tipeado en el form — los valores del form se ignoran. Reactivar llama a `POST /categories/:id/reactivate` con el `id` que vino en `error.data.category`.

- **`isReactivableError`** — type guard sobre el `ApiError` para discriminar este caso del `409` de colisión-con-activa (que sí es un error de duplicado común). El `ApiError` porta `data?: unknown` que fluye desde la capa `apiRequest`.

### Datos

- **`use-categories`** — hook con React Query, clave **`["categories"]`** (constante `CATEGORIES_QUERY_KEY`). Todas las mutaciones (crear, editar, eliminar, reactivar) invalidan esa clave.
- El **futuro selector de categorías** del formulario de movimientos **debe reusar `CATEGORIES_QUERY_KEY`** para compartir caché.

> **Nota — `Select` primitivo:** el scope se elige con un `Select` que es un `<select>` **nativo** (no Radix). Es un primitivo mínimo, reemplazable a futuro en un solo lugar.

### Paleta de colores — espejo del backend (gotcha)

La matriz de colores vive como **constante propia del front** en `types/category.ts` (`CATEGORY_COLOR_PALETTE` = los 70; `CATEGORY_BASE_COLORS` = la fila base de 10). Es un **espejo de la matriz del backend** (`COLOR_MATRIX` / `COLOR_POOL` en `backend/src/categories/color-pool.ts`) — **no hay paquete compartido** (consistente con el patrón general del proyecto). **Gotcha:** si se cambia la paleta hay que actualizar **ambos lados**. Además, `getLeastUsedBaseColor()` **replica el criterio de `assignColor` del backend** (menos-usado sobre la fila base) para el default en crear; también vive en los dos lados.

### Uso dual de `CategoryFormModal` (standalone vs inline)

El mismo `CategoryFormModal` se usa en **dos modos**, diferenciados **solo por props opcionales** — no hay flag explícito de modo:

- **Standalone (desde `/categorias`):** comportamiento normal. El selector de scope ofrece las tres opciones (`AMBOS` / `GASTO` / `INGRESO`) con default **"Ambos"**.
- **Inline (desde los formularios de movimiento, RF-MU-004):** se activa pasando las props **`lockScopeToType`** y **`onCreated`**:
  - `lockScopeToType` (el tipo del movimiento en curso, `EXPENSE` / `INCOME`) **restringe el selector de scope** a ese tipo + "Ambos" y **preselecciona el tipo exacto**.
  - Al crear o reactivar con éxito, el modal **devuelve la categoría al padre vía `onCreated`** para que el formulario de movimiento la **autoseleccione**.
  - **Cuotas pasan `lockScopeToType="EXPENSE"` fijo** (las cuotas son siempre Gasto en v1).
- **`ReactivationPrompt.onReactivated` propaga la categoría reactivada hacia arriba:** para soportar la autoselección inline, el prompt de reactivación pasa la categoría reactivada al padre (no solo cierra). El `CategoryFormModal` la reenvía por `onCreated`.

### Apilado de modales — gotcha de z-index

Cuando `CategoryFormModal` se abre **inline** (por encima del modal de movimiento), hay tres capas con una escala fija:

- **`TransactionModal`** (modal de movimiento): **`z-40`**.
- **`CategoryFormModal`** abierto por encima: **`z-50`**.
- **`ReactivationPrompt`**: también **`z-50`** — **reemplaza** al `CategoryFormModal` en el DOM, **no se apila** sobre él.

> Si en el futuro se agregan más modales apilados, hay que **respetar/extender esta escala** de z-index (no reusar `z-50` para un nivel que deba quedar por encima del `CategoryFormModal`).

## Movimientos únicos

Carga de movimientos. El modal de carga se invoca desde el dashboard (`/`); **editar y eliminar quedan cableados desde la Vista del mes** (`/mes`) — ver sección Vista del mes y Dashboard.

### Modal de carga (`components/movements/transaction-modal.tsx`)

- **Props como discriminated union por `mode`** (4 variantes) — el modal se comporta distinto según el modo y TypeScript fuerza el shape correcto en cada caso:
  - **`"create"`** — abre con tabs **Único / Fijo / Cuotas**, los tres funcionales. Renderiza `TransactionForm`, `RecurringForm` o `InstallmentForm` según el tab.
  - **`"edit-single"`** — sin tabs; `TransactionForm` precargado con un `Transaction` (RF-MU-002).
  - **`"edit-fixed"`** — sin tabs; `RecurringForm` precargado con un `Recurring` (RF-MF-003).
  - **`"edit-installment"`** — sin tabs; `InstallmentForm` precargado con el grupo de cuotas (RF-MC-003).
- En modo edición no muestra los tabs de selección de tipo (RF-CM-001): el tipo de un movimiento no se cambia por edición.

### transaction-form

- Tipo **Gasto** (default) / **Ingreso**; monto **en pesos** (se convierte a centavos al enviar); selector de categoría **filtrado por scope** (RN-010) que **reusa `["categories"]`** (`CATEGORIES_QUERY_KEY`); fecha + hora (default: ahora); descripción opcional.
- **Estados:** Guardando; **Sin categorías disponibles** (link a `/categorias`); **Error backend** — el modal **queda abierto y conserva los datos** ingresados (RNF-008).

### Moneda y cotización en los forms de movimiento (multi-moneda)

Aplica a los **tres** forms (`transaction-form`, `recurring-form`, `installment-form`). Regla funcional en `docs/requirements.md` (§cotización); acá solo el gotcha de implementación.

- **`onSubmit` con `currency === defaultCurrency` envía `exchangeRate = 1` hardcodeado** — **no parsea el input de cotización**, porque ese input está **fuera del DOM** en ese caso (solo se renderiza cuando `currency !== defaultCurrency`). El backend ya ignora `exchangeRate` cuando `currency === anchorCurrency`, así que el `1` es seguro y no afecta cálculos. **Gotcha:** un cambio futuro no debe volver a parsear el input oculto en ese caso — el `1` es deliberado.

### Crear desde el dashboard

- Botón **"Nuevo movimiento"** en `/` abre el modal. Al guardar → toast con acción **"Ir a ver"** que navega a `/mes?month=YYYY-MM`.

### Editar / eliminar — cableados desde la Vista del mes

- `TransactionModal` selecciona el flujo de único por `mode` (`"create"` / `"edit-single"`); ver la discriminated union por `mode` arriba.
- `DeleteTransactionDialog` acepta `transaction` (diálogo de confirmación antes del hard delete).
- La Vista del mes pasa a estos componentes el movimiento de la lista (ver mapeo `MovementItem → Transaction` en la sección Vista del mes y Dashboard).

### Datos (`use-transactions`)

- Hook **`useTransactions()`** expone las mutaciones: `createTransaction`, `updateTransaction(id, data)`, `deleteTransaction(id, month)`.
- **La lista del mes no vive acá:** se lee con `useMovements(month)` (ver sección Vista del mes y Dashboard).
- **Invalidación al mutar:** las mutaciones de `useTransactions` invalidan **`MOVEMENTS_QUERY_KEY(month) = ["movements", month]`** (la clave de `useMovements`).
- **Gotcha — `deleteTransaction` recibe `month` explícito:** el `DELETE` devuelve `204` sin cuerpo, así que no se puede derivar del recurso qué mes invalidar. El llamador deriva el `month` del `occurredAt` del movimiento de la lista y lo pasa.

### Helpers (`lib/format.ts`)

Reusarlos, no reimplementar:

- **`parseCurrencyInput`** — pesos → centavos vía `Math.round(parsed * 100)`; acepta punto o coma decimal. **`formatCurrency`** — centavos → string en pesos.
- **`localToUtcIso` / `utcToLocalDate` / `utcToLocalTime`** — conversión local ↔ UTC con `Intl.DateTimeFormat` de doble pasada; **maneja DST** correctamente.
- **`getBrowserTimezone`** — IANA del navegador.
- **Helpers de mes:** **`getCurrentMonth`** — mes actual `YYYY-MM` en la zona del navegador; **`formatMonthLabel`** — `YYYY-MM` → rótulo legible (nombre de mes + año); **`prevMonth` / `nextMonth`** — desplazan un `YYYY-MM` un mes hacia atrás / adelante. Reusarlos para la navegación del mes; no reimplementar aritmética de meses.

## Movimientos fijos

Carga, edición y eliminación de movimientos fijos. Se crean desde el tab **Fijo** del modal de carga; editar y eliminar se cablean desde la Vista del mes, igual que los únicos.

### `recurring-form.tsx`

- Tipo **Gasto** (default) / **Ingreso**; monto en pesos; selector de categoría filtrado por scope (reusa `CATEGORIES_QUERY_KEY`); descripción opcional. **No tiene fecha ni hora** — el fijo opera a nivel mes (RF-MF-001).
- **En edición el tipo es read-only** (RF-MF-003: el tipo no se edita). **Gotcha:** un campo `type` deshabilitado no lo registra react-hook-form; hay que mantener un `<input type="hidden">` con el valor para que RHF lo registre y Zod lo valide.
- **Gotcha — schema Zod compartido entre crear/editar: TODO campo del schema necesita un `defaultValue` que valide, aunque no se renderice en ese modo.** Si un form usa un único schema Zod para crear y editar y algún `defaultValue` no pasa la validación, `handleSubmit` bloquea el submit **en silencio** (sin excepción, log ni error en la UI; síntoma: "Guardar no hace nada"). Caso real: `startMonth` solo se renderiza en crear pero está en el schema; en edición se inicializa con relleno válido (`getCurrentMonth()`) **solo para satisfacer el schema** — NO se envía en el PATCH (el contrato de edición de fijos no incluye `startMonth`). Defensa: pasar a `handleSubmit` un `onInvalid` que loguee los errores de validación.

### `delete-recurring-dialog.tsx`

- Diálogo de confirmación **sin opciones** (RF-MF-004): la eliminación aplica **siempre desde el mes visualizado inclusive en adelante**. El cliente fija `fromCurrentMonth = true` y `currentMonth` = mes visualizado (`viewMonth`, fallback `getCurrentMonth()`). **No hay checkbox de opciones** en el diálogo (ver gotcha en `.claude/agents/control-frontend.md`).

### `movement-item-row.tsx`

- Fila de la lista del mes (compartida por únicos, fijos y cuotas). Muestra un **badge de origen** ("Único" / "Fijo" / "Cuotas"). Para fijos muestra **"Mensual"** y para cuotas la etiqueta **"Cuota X/N"** (de `installment.number` / `installment.total`) en lugar de fecha. **Null-safety:** `occurredAt` / `timezone` pueden venir `null` (fijos y cuotas) — no pasarlos a `formatDate` / `formatTime` sin chequear.

### Datos (`use-recurring`)

- Hook con las mutaciones `createRecurring`, `updateRecurring`, `deleteRecurring`.
- **Invalida toda la familia `["movements"]` (por prefijo), no una sola key de mes:** un fijo afecta muchos meses (mes actual + futuros), así que invalidar solo `["movements", month]` dejaría meses desactualizados en caché.
- **El front calcula `currentMonth` / `startMonth` con `getCurrentMonth()`** (zona del navegador) y los manda al backend — editar/eliminar son relativos al **mes actual real**, no al mes visualizado.
- **Gotchas:**
  - En `updateRecurring`, para **limpiar** la descripción se envía `description: null` **explícito** (no `undefined`, que el backend interpretaría como "no cambiar").
  - El mapeo `MovementItem → Recurring` para precargar el form de edición sigue el mismo patrón que el de únicos (el ítem no trae todos los campos del recurso).

## Movimientos calculados

Un calculado es un fijo cuyo monto/tipo se derivan; el front solo construye la fórmula y muestra el resultado derivado que ya viene en el `MovementItem` (`calculated` / `hasCalculated` / `amountCents` con signo). El origen puede ser fijo, único o cuota: el front **enruta siempre por `calculated.sourceType`**. Contrato en `docs/data-model.md`, §Contrato de movimientos calculados; reglas en RF-MCALC-001..010. Lo no obvio:

### Creación — desde fijo, único o cuota

- **No hay tab "calculado"** en el modal de carga (RF-MCALC-001). El único disparador es la acción **"crear movimiento desde este"** del kebab de un ítem **fijo, único o cuota** en `/mes` (ícono en `docs/design.md`). `movement-item-row.tsx` la ofrece en cualquier origen **no** calculado (`!movement.calculated`); sigue **sin** aparecer sobre un ítem que ya es calculado (no hay calculado-de-calculado).

### `calculated-form.tsx`

- **Sin selector Gasto/Ingreso:** el tipo se **deriva** del signo+monto final (`final > 0 → INCOME`, `≤ 0 → EXPENSE`). El form tiene segmented de **operador** (`+ − × ÷ %`), input de **operando** con affordance (`$` para ADD/SUB, `%` para PCT, factor para MUL/DIV), segmented de **signo** (Positivo/Negativo), y un **preview en vivo**: expresión legible + cifra + **badge de tipo derivado**.
- **Escalado del operando:** el form escala el float del usuario al entero que espera el backend según el operador (ADD/SUB `×100`, MUL/DIV `×1_000_000`, PCT `×100`) y desescala al editar. Misma escala que `docs/data-model.md`, §Escalado del operando.
- **Modo edición — preview con `sourceAmountCents`:** el preview usa `movement.calculated.sourceAmountCents` (monto del origen en el mes; para origen **cuota** = monto por cuota) como base; si viene `null`, muestra `—` sin romper.
- **Operando 0 con DIV/PCT** se bloquea en el front (deshabilita submit + error) además de la validación del backend (RN-017).
- **Categorías filtradas por el tipo derivado** en vivo (cambia al cambiar signo/fórmula).

### Indicación padre/hijo (RF-MCALC-007)

- En `movement-item-row.tsx`: si el ítem **es** calculado → chip **"Calculado"** (`Link2`) + segmento **"desde {Origen}"** (de `calculated.sourceDescription`); si **es padre** (`hasCalculated`) → ícono `GitBranch`.
- **Borrado — enrutado por `sourceType`.** `handleDelete` en `month-view-client.tsx` decide según el calculado: origen **fijo** → `DeleteRecurringDialog` con opciones de mes (boundary/split); origen **único o cuota** → `DeleteRecurringDialog variant="calculated-simple"`, **confirmación directa** sin opciones de mes (borrado total, RF-MCALC-009). `delete-recurring-dialog.tsx` muestra además un **callout de advertencia** cuando `movement.hasCalculated` (los calculados asociados también se eliminarán — cascada, RF-MCALC-005).

### Datos (`use-calculated`)

- **Enrutado por `sourceType`.** `useCalculated` recibe el `sourceType` y elige el endpoint: `fijo` → `/recurring/:id/calculated`, `unico` → `/transactions/:id/calculated`, `cuota` → `/installments/:id/calculated` (POST y PATCH). El borrado del calculado **reutiliza `deleteRecurring`** (`DELETE /recurring/:id`) en los tres casos.
- **`CreateCalculatedRequest` es una unión:** con `startMonth` para origen **fijo**, **sin** `startMonth` para único/cuota (lo deriva el backend del origen — RF-MCALC-008). `CalculatedInfo` trae `sourceType`/`sourceId` y `sourceChainId` **nullable** (null en único/cuota).
- Invalida toda la familia `["movements"]` por prefijo (un calculado afecta muchos meses, igual que un fijo).
- **`type` NO se envía** en ningún body (lo deriva el backend). Editar un calculado va **siempre** por este hook: `PATCH /recurring/:id` rechaza calculados con `400`.

## Movimientos en cuotas

Carga, edición y eliminación de grupos de cuotas. Se crean desde el tab **Cuotas** del modal de carga; editar y eliminar se cablean desde la Vista del mes, igual que únicos y fijos. **Solo Gasto en v1.**

### `installment-form.tsx`

- Cubre el **tab Cuotas** (crear) y la **edición** del grupo. **No tiene selector de tipo** — siempre Gasto (RF-MC-001, solo Gasto en v1). Campos: **monto por cuota** (no el total; en pesos, se convierte a centavos), **cantidad de cuotas**, **mes de inicio** (`<input type="month">`, default mes actual), categoría (filtrada por scope, reusa `CATEGORIES_QUERY_KEY`) y descripción opcional. **No tiene fecha ni hora** — las cuotas operan a nivel mes.
- **Gotcha:** el input de cantidad de cuotas (`type="number"`) devuelve **string**; se parsea con `parseInt` en el schema Zod antes de validar.
- **Prefill de edición:** `totalInstallments` y `startMonth` salen de `MovementItem.installment`; el resto del propio ítem. El `type` va hardcodeado en `EXPENSE`.

### `delete-installment-dialog.tsx`

- Diálogo de confirmación que **avisa que elimina el grupo completo** (todas las cuotas, pasadas y futuras), **sin checkbox** (RF-MC-002). A diferencia de los fijos, no hay opción de "desde este mes": la eliminación es del grupo entero.

### Datos (`use-installments`)

- Hook con las mutaciones `createInstallment`, `updateInstallment`, `deleteInstallment`.
- **Invalida toda la familia `["movements"]` (por prefijo)**, no una sola key de mes: un grupo de cuotas abarca varios meses, así que invalidar solo `["movements", month]` dejaría meses desactualizados en caché (mismo criterio que `use-recurring`).

> **Gotcha — `MovementItem.installment` es campo requerido del tipo.** En los `MovementItem` de únicos y fijos hay que poner `installment: null` explícito (el tipo no lo hace opcional).

## Navegación de período (`PeriodNav`)

Componente reutilizable **`components/ui/period-nav.tsx`**: navegación genérica de período con **flechas gigantes a los costados** del contenido que envuelve (`‹ contenido ›`; ‹ = anterior, › = siguiente). Genérico por diseño; hoy lo usa **`/mes`** para navegar el mes. **Reportes no lo reutiliza**: navega el año con un stepper pill embebido en cada card (ver sección Reportes). Spec visual en `docs/design.md`.

### Props

| Prop | Tipo | Descripción |
| --- | --- | --- |
| `children` | `ReactNode` | El contenido del período que envuelve. |
| `prevLabel` / `nextLabel` | `string` | `aria-label` de cada flecha (en `/mes`: "Mes anterior" / "Mes siguiente"). |
| `onPrev` / `onNext` | `() => void` | Handlers de navegación. |
| `canGoPrev` / `canGoNext` | `boolean` (default `true`) | `false` → flecha `aria-disabled`, sin hover, no dispara el handler. En `/mes` siempre `true` (no hay topes de navegación). |

### Estructura: grid de 3 columnas

`PeriodNav` es un **grid de 3 columnas** con `mx-auto` dentro de `<main>` y `align-items: stretch`:

| Columna | Ancho | Contenido |
| --- | --- | --- |
| Izquierda | `auto` | Flecha ‹ (anterior). |
| Central | `minmax(0, 1120px)` | Contenido (`children`) con tope **1120px**, `px-10` interno y `min-width: 0`. |
| Derecha | `auto` | Flecha › (siguiente). |

- **`grid-template-columns: auto minmax(0, 1120px) auto`.** Las columnas laterales `auto` hacen las flechas simétricas respecto del contenido. El cap de 1120px + el `px-10` viven en la **columna central** del propio componente — el consumidor (`page.tsx`) ya **no** lleva `max-w-[1120px] mx-auto`.
- **Flechas:** **ancladas al centro vertical del viewport** — el botón usa `sticky top-[50vh]` + `translateY(-50%)`, de modo que permanecen centradas en el viewport al scrollear. Para que el centrado al viewport funcione también con **listas cortas**, las celdas laterales llevan `min-height: 100vh`, que le da al `sticky` recorrido suficiente cuando el contenido es más bajo que el viewport. Tamaño único **64×64** (glifo 46px), sin variantes por breakpoint. Detalle visual fino en `docs/design.md`.

### Dos regímenes

| Ancho | Régimen |
| --- | --- |
| ≥941px | Grid de 3 columnas (flechas a los costados). |
| ≤940px | Colapsa al **pill stepper** en el header (sin flechas laterales). |

### Gotchas técnicos

1. **`grid-template-columns` va por `style` inline, no como clase Tailwind.** `auto minmax(0, 1120px) auto` mezcla `auto` y `minmax()`, y Tailwind v4 no lo resuelve como utilidad `grid-cols-[...]`.
2. **`min-width: 0` en la celda central es obligatorio.** Sin él, `minmax(0, 1120px)` no puede encoger por debajo del ancho intrínseco del contenido (gotcha estándar de grid).

## Vista del mes y Dashboard

Las dos pantallas de visualización, sobre el endpoint unificado `GET /movements?month=YYYY-MM` (contrato en `docs/backend.md`, sección Movimientos del mes).

### El dashboard vive en `/`

El dashboard es `src/app/page.tsx` en **`/`** (no hay `/dashboard`). Redirects:

- `src/middleware.ts`: un usuario autenticado que entra a `/login` o `/registro` se redirige a `/`.
- `callbackUrl` / `redirectTo` por defecto del login, el registro y `use-register` apuntan a `/`.
- **Sign-out va a `/login`.**

### Dashboard (`/`)

- **Encabezado con el mes actual** (sin navegación entre meses — siempre el mes en curso).
- **Resumen financiero** del mes (gastos / ingresos / balance) leído de `data.totals`.
- Botón **"Nuevo movimiento"** (abre el modal de carga) y enlace **"Ver todos"** → `/mes`.
- **Estado vacío** (sin movimientos en el mes): totales en cero y CTA **"Cargá tu primer movimiento"** que abre el modal.
- **No lista movimientos** (decisión de producto; la lista vive en `/mes`).

### Vista del mes (`/mes`)

- Lee el mes de **`?month=YYYY-MM`** (default: mes actual en la zona del navegador, vía `getCurrentMonth`).
- **`month-view-client.tsx` envuelve su contenido en `PeriodNav`** (flechas gigantes ‹ ›) para la navegación prev / next, que cambia `?month=` (con `prevMonth` / `nextMonth`). El rótulo del mes (`formatMonthLabel`) se promueve al **header `.phead`** en ≥941px; en ≤940px el header lleva un **stepper compacto** en lugar de las flechas. Ambos siempre `canGoPrev`/`canGoNext` (en `/mes` no hay topes de navegación). El cap de 1120px y el `px-10` los aporta el propio `PeriodNav` (columna central del grid); `page.tsx` no lleva `max-w-[1120px] mx-auto` (ver sección Navegación de período).
- **Totales del mes** (de `data.totals`).
- **Lista agrupada en secciones colapsables + reordenables Únicos / Fijos / Cuotas** (RF-VM-005). Las **tres secciones se muestran siempre**; una sección vacía muestra cabecera completa + empty inline propio (no hay empty global de la pantalla). Se renderizan con `AccordionSection` / `SortableSection` (ver Sistema de componentes). Cada ítem (`movement-item-row`) muestra tipo, monto, categoría, descripción y badge de origen, con acciones **Editar** y **Eliminar** que abren el flujo según el origen: únicos → `TransactionModal` (`edit-single`) / `DeleteTransactionDialog`; fijos → `TransactionModal` (`edit-fixed`) / `delete-recurring-dialog`; cuotas → `TransactionModal` (`edit-installment`) / `delete-installment-dialog`.
- **Filtros por listado (RF-VM-006) — filtrado y totales en cliente.** Cada sección (Únicos/Fijos/Cuotas) tiene su disparador de filtro de **tipo + categoría** (`components/ui/section-filter-popover.tsx`, ver Sistema de componentes), renderizado como `filterSlot` de `AccordionSection` (oculto en modo orden). **`month-view-client.tsx` filtra cada lista en cliente y recalcula los totales del mes** sobre lo visible: los `data.totals` que devuelve el backend **no se usan en `/mes`** (sí en el dashboard). `useMovements(month)` se llama **sin** `categories` (trae todo el mes en una sola llamada).
- **RN-019 tiene UN único punto de implementación en el frontend: `src/lib/movements.ts`.** Como `/mes` recalcula totales/subtotales en cliente, la regla de imputación a totales (RN-019, en `requirements.md`) está nucleada ahí: `sumMovementTotals(items) → { expense, income }` (magnitud al bucket del `type`) y `groupSubtotalCents(items) → number` (neto con signo de presentación, income − expense; delega en el anterior). **Todo componente que calcule totales o subtotales importa de ahí — no reimplementar la suma inline.**
- **Orden de la sección Únicos (RF-VM-001).** El orden de los ítems de Únicos lo aplica **`sortUnicosBySort` en `lib/movements.ts`**, client-side, sobre el array **ya filtrado** (`"amount"` → magnitud DESC; `"date"` → `occurredAt` DESC, desempate por monto DESC). Lo dispara el control `SectionSortButton` de la cabecera; el valor se persiste vía `usePreferences`, clave `unicosSort` (default `"amount"`, shape en `docs/data-model.md`). Aplica solo a Únicos (Fijos/Cuotas no tienen fecha).
- **`MovementItem.amountCents` puede ser NEGATIVO** (calculados `EXPENSE`). Al bucketear por tipo **siempre `Math.abs()`** (lo hace `sumMovementTotals`); sumar el `amountCents` crudo con signo resta el gasto en vez de sumarlo y diverge del dashboard. El pill contador y el subtotal de cada sección reflejan lo filtrado. Estado persistido vía `usePreferences`, clave `monthListFilters` (mismo patrón optimista que `monthSections`); shape, defaults y back-compat en `docs/data-model.md`, §Preferencia `monthListFilters` — replicarlos, no inventar otra normalización. Es **por pantalla, no por mes** (se conserva al navegar). La preferencia `monthCategoryFilter` está deprecada (no se lee ni migra).
- **Estado de secciones desde `usePreferences` (clave `monthSections`).** El colapsado/expandido y el orden de las secciones se leen y persisten vía `usePreferences` (ver §Preferencias de usuario). Shape de la clave en `docs/data-model.md` (§Contrato de preferencias → `monthSections`); ahí también vive la regla de **back-compat / normalización** (default si falta, filtra desconocidas, agrega faltantes al final) — replicarla en el consumidor, no inventar otra.
  - **Sincronización optimista:** al colapsar/expandir o reordenar, el **estado local cambia inmediato** en la UI y `setPreferences` persiste en **background**; la interacción **no se bloquea** con `isSaving`. El llamador manda el blob completo (`{ ...preferences, monthSections: ... }`), porque la semántica del backend es reemplazo total (ver §Preferencias de usuario).
  - **Gotcha modo orden:** al **entrar** en modo orden todas las secciones se **colapsan de forma transitoria** (estado local, **puramente visual, NO se persiste**); al **salir** se **restaura el estado de colapso previo** del usuario sin pisar su preferencia (`monthSections.collapsed`). Es deliberado — un agente que toque `month-view-client` debe respetarlo.
- **Se actualiza al mutar** (crear / editar / eliminar) por invalidación de la query del mes.

### Datos (`use-movements`)

- Hook **`useMovements(month)`** sobre `GET /movements?month=`. **Query key como función:** **`MOVEMENTS_QUERY_KEY(month) = ["movements", month]`** — varía por mes.
- Las mutaciones de `useTransactions` invalidan `["movements", month]` (ver sección Movimientos únicos). Reusar esta clave para invalidar — no inventar otra.

### Mapeo `MovementItem → Transaction` (para editar)

- El ítem de la lista (`MovementItem`) **no trae `userId` / `createdAt` / `updatedAt`** (los modales de edición no los usan) y **`categoryId` se deriva de `category.id`**. La Vista del mes arma el `Transaction` que esperan `TransactionModal` / `DeleteTransactionDialog` a partir del `MovementItem`.

### Gotcha — `<Suspense>` + `useSearchParams`

- `/mes` usa **`useSearchParams()`**, que en el App Router de Next.js 15 **obliga a envolver el componente en `<Suspense>`** (si no, el build falla). Ya resuelto con un wrapper que provee el límite de Suspense.

### Animación de acordeón sin JS — técnica grid-rows (`AccordionSection`)

- **Animar `height:auto` puramente en CSS, sin medir el DOM ni `ResizeObserver`:** el cuerpo colapsable usa **`grid-template-rows: 0fr ↔ 1fr`** en un contenedor `overflow-hidden`, con **`min-h-0`** en el hijo. La transición de `0fr` a `1fr` anima la altura del contenido real sin conocerla de antemano. `prefers-reduced-motion` quita la transición. Patrón reutilizable, vive en `AccordionSection` — reusarlo para cualquier colapsable futuro en vez de medir alturas a mano.
- **Gotcha de testing — `grid-rows-[0fr]` colapsado NO oculta del DOM en jsdom.** La técnica `grid-rows-[0fr]↔[1fr]` oculta **visualmente** pero no aplica `display:none` / `visibility:hidden` ni borra el nodo. **jsdom no ejecuta CSS**, así que ve los elementos colapsados como presentes. Por eso los tests de un disclosure colapsable deben afirmar contra **render / no-render del nodo**, no contra visibilidad. Aplicado al disclosure "Moneda y cotización": el selector de moneda **siempre** está en el DOM; el input de cotización **solo se renderiza cuando `currency !== defaultCurrency`** — testear ese montaje condicional, no si el bloque está visualmente colapsado.

### Navegación entre pantallas

La navegación entre `/`, `/mes` y `/categorias` se hace por el **sidebar global** (ver sección siguiente) y, en paralelo, por los **accesos definidos en cada pantalla** (enlace "Ver todos" del dashboard, acción "Ir a ver" del toast post-guardado, URL). Ambos conviven.

## Navegación global (sidebar — RF-NAV-001)

Feature 100% frontend. Resuelve la navegación entre secciones, la acción primaria de nuevo movimiento y el menú de usuario, persistente en pantallas autenticadas.

### Punto único de montaje: route group `app/(app)/`

Las tres pantallas autenticadas (`/` dashboard, `/mes`, `/categorias`) viven dentro del **route group `app/(app)/`**, con un `layout.tsx` compartido que monta el sidebar **una sola vez**.

- **Los route groups de Next.js no alteran las URLs:** `/`, `/mes` y `/categorias` siguen siendo idénticas — `(app)` es solo organización de archivos.
- **`login` y `registro` quedan FUERA del grupo** → no heredan el layout, por eso no muestran sidebar (cumple el criterio de RF-NAV-001 "no se muestra en pantallas no autenticadas").
- **Regla para pantallas futuras: toda pantalla nueva con sesión debe vivir bajo `app/(app)/`** para heredar el sidebar. No remontar el sidebar por pantalla.
- El `<main className="min-h-screen ...">` con el contenedor `mx-auto max-w-2xl` vive en este layout; **las páginas hijas solo devuelven su contenido**, no su propio `<main>` ni contenedor.
- Los componentes co-ubicados de categorías (`categories-list`, `category-form-modal`, `delete-category-dialog`, `reactivation-prompt`) viven junto a su `page.tsx` dentro de `(app)/categorias/`.

### Componentes

- **`app/(app)/layout.tsx`** — Server Component. Obtiene el email con **`auth()`** y lo pasa como **prop** a `AppSidebar`.
- **`components/layout/app-sidebar.tsx`** — Client Component (usa `usePathname()` para la sección activa y estado de colapsado).
- **`components/layout/user-menu.tsx`** — avatar + desplegable con "Cerrar sesión" (RF-AUTH-004).

### Contenido

Logo/nombre "Control" → `/`; links **Dashboard** (`/`), **Vista del mes** (`/mes`, siempre abre en el mes actual porque la página defaultea a `getCurrentMonth`), **Categorías** (`/categorias`); botón **"Nuevo movimiento"** que reusa `NewTransactionButton` y abre `TransactionModal` en modo `create` (1 clic, RNF-003); **menú de usuario** abajo con avatar = **inicial del email en mayúscula**.

### Decisiones y gotchas

- **Sidebar colapsable:** fijo a la izquierda en desktop; en pantallas chicas se colapsa con botón hamburguesa.
- **Avatar = inicial del email** (no hay imagen para usuarios de email).
- **Email via prop drilling desde el Server layout, NO `useSession()` en el sidebar.** El layout (Server) lo resuelve con `auth()`. Si el email es `null`, fallback a string vacío (inofensivo: el middleware ya redirigió a usuarios sin sesión).
- **Sección activa — match EXACTO para `/`:** el link Dashboard compara `pathname === "/"`. Con `startsWith("/")` quedaría activo en **todas** las rutas. Los links `/mes` y `/categorias` usan `startsWith` (no hay subrutas que colisionen).
- **`<Suspense>` en `(app)/mes/page.tsx`:** se mantiene envolviendo `MonthViewWrapper` (que usa `useSearchParams()`); sin él el build de Next 15 falla. El cambio de carpeta al route group no lo altera (ver gotcha de `<Suspense>` en la sección Vista del mes).

## Reportes (RF-REP-001..005)

Visualización de reportes de ingresos/gastos en `/reportes`. El spec visual (color, alturas, jerarquía, transición) vive en `docs/design.md` — acá solo arquitectura y gotchas técnicos.

### Arquitectura en dos capas (enfoque shadcn charts)

El gráfico se separa en una **primitiva reutilizable** (motor de charting, agnóstica de la feature) y **tarjetas de feature** que la componen. Cualquier gráfico futuro reusa la primitiva.

- **Primitiva `components/ui/chart.tsx`** — primitiva estilo shadcn charts sobre **Recharts v3** (el motor; instalado con `pnpm add`, no npm), themeada con los tokens del DS (CSS vars `oklch`). Pensada para reusarse en futuros gráficos. Exporta `ChartContainer` (wrapper de `ResponsiveContainer` + theming), `ChartTooltipContent` y `ChartLegend`.
- **Dos tarjetas autónomas en `components/charts/report-card.tsx`** — único dueño del código de charting Forma 1 / Forma 2. Exporta **dos tarjetas independientes**, cada una con su cabecera, gráfico, leyenda, tooltip y estados (skeleton / con datos / vacío / meses futuros / error):
  - **`IncomeExpenseCard`** (Forma 1) — `AreaChart` con ingresos y gastos superpuestos.
  - **`ByCategoryCard`** (Forma 2) — `BarChart` apilado por categoría, usando `category.color` de cada una.
  - **La leyenda interactiva ES el filtro (RF-REP-002).** La card **no** tiene un control de filtro propio (ni `FilterButton` ni popover): la **leyenda interactiva** (`ChartLegend`, abajo) cumple esa función. En modo Total togglea las series Ingresos/Gastos (estado `hiddenSeries`); en modo "Por categoría" y en `by-category` togglea categorías (`categoryIds`). El stepper de año (pill `‹ año ›`) sí va embebido. El componente recibe el estado (`year`, `categoryIds`, `hiddenSeries`) y los callbacks de cambio por props, y deja que el anfitrión decida si ese estado es **persistido** (cards de `/reportes`) o **efímero** (dashboard). El componente `CategoryFilterPopover` sigue vivo, pero **no** lo usa la card de reporte: lo usa el filtro por sección de `/mes`.

- **`ChartLegend` (`components/ui/chart.tsx`) tiene dos modos:**
  - **Decorativo** — solo color + label (leyenda no interactiva).
  - **Interactivo** — con props `hiddenIds` / `onToggle` / `groupLabel`: los ítems se renderizan como `<button aria-pressed>` dentro de un `role="group"`, con estado visual apagado para el ítem oculto. **Reportes usa el modo interactivo** para que la leyenda funcione como filtro (series o categorías según el modo de la card).
  - Acepta además dos props para las leyendas de **categorías** (Forma 1 "Por categoría" y Forma 2): **`scrollable`** confina los chips a una región con alto máximo (≈3 renglones) y **scroll interno**, con un **fade** que señala cuando hay más contenido; **`commandSlot`** inyecta un control en un **carril fijo** debajo del scroll, siempre accesible — lo usa el atajo "Todas/Ninguna" (`LegendAllChip`). El `role="group"` envuelve solo los chips, no el `commandSlot`.
  - La leyenda de **series** Ingresos/Gastos (Forma 1 "Total", 2 ítems) es una fila plana: no usa `scrollable` ni `commandSlot`.

### Datos (`use-reports`)

- Hook **`useReports(year, categoryIds)`** sobre `GET /movements/reports?year=&categories=`. Sin mutaciones (solo lectura). Aplica el patrón obligatorio **`enabled: isAuthenticated`** (ver Queries de lectura gate-adas en Autenticación).
- **Query key varía por año Y por filtro de categorías:** `["reports", year, categoriesKey]`, donde `categoriesKey` es la serialización del filtro (`null` → todas; lista ordenada → subconjunto). Sin incluir el filtro en la key, React Query no refetchearía al cambiar el checklist.
- **`placeholderData: keepPreviousData`.** Al cambiar el filtro de categorías o el año, el gráfico mantiene visibles los datos previos durante el refetch; el skeleton de carga aparece solo en la primera carga (sin caché), no en cada cambio de filtro. Es deliberado para evitar el parpadeo del gráfico.
- **GOTCHA — el query param `categories` se construye por concatenación de string, NO con `URLSearchParams`.** El backend espera la coma **literal** (`categories=id1,id2,id3`); `URLSearchParams` encodea la coma a `%2C` y el filtro deja de matchear. Patrón reusable para **cualquier endpoint que acepte listas separadas por coma**: armar el query string a mano, no con `URLSearchParams`.
- Tipos del contrato en **`types/reports.ts`**: `ReportMovementsResponse` / `ReportMonth` / `ReportCategory`.

### Puntos de uso

- **Pantalla `/reportes` configurable por cards — `app/(app)/reportes/page.tsx`** (bajo el route group `(app)`, hereda el sidebar). Arranca **vacía** (solo el recuadro "[+]"); el usuario agrega cards eligiendo el tipo (popover-menú con los 2 tipos) y las quita. Cada card monta una tarjeta de reporte cuyo año y filtro de categorías son **estado persistido** en preferencias (ver abajo). El orden de las cards es el orden del array. **El año NO va en la URL** → la pantalla **no usa `useSearchParams()` ni `<Suspense>`** (a diferencia de `/mes`).
  - **Persistencia vía clave `reports` de preferencias** (patrón **read-modify-write del blob**, idéntico a `monthSections`): agregar/quitar una card, navegar su año o cambiar su filtro parte del blob actual y manda el objeto completo (`setPreferences({ ...preferences, reports: ... })`), porque la semántica del backend es reemplazo total (ver §Preferencias de usuario). Shape de la clave (`ReportCardConfig[]`, `categoryIds: null = todas`) y la regla de normalización/back-compat en `docs/data-model.md`, §`reports`; replicarla en el consumidor, no inventar otra.
- **Dashboard (`dashboard-client.tsx`)** — monta **solo `IncomeExpenseCard`** con navegación de año **activa** y filtro de categorías **efímero**: año y `categoryIds` son **estado local de React** que **NO persiste** (no toca la clave `reports`). El resumen mensual sigue fijo en el mes en curso. Contraste clave: mismo widget, estado **persistido** en `/reportes` vs. **efímero** en el dashboard.
- **Sidebar** — link **"Reportes"** (`/reportes`), activo por `startsWith("/reportes")`, entre "Vista del mes" y "Categorías".

### Gotchas técnicos (Recharts v3 + Tailwind v4 + DS)

Para que un agente futuro que toque gráficos no los re-tropiece:

- **CSS vars `oklch` directas en el SVG de Recharts:** se pueden pasar `var(--token)` directo en props de color (`stroke`, `fill`, y `stopColor` de `<stop>` dentro de `<defs>`). **No** hace falta `getComputedStyle` en runtime para resolver el token.
- **Cifras tabulares (`tnum`):** la propiedad `fontFeatureSettings` **no existe** en el tipo de tick SVG de Recharts; el `tnum` se delega a la CSS var **`--mono`** (IBM Plex Mono ya trae `tnum`). No intentar setear `fontFeatureSettings` en el tick.
- **Recharts 3.x + TypeScript strict:** `TooltipPayload` es **`readonly`** → el componente custom de tooltip requiere un **doble cast** (`as unknown as Array<...>`). El prop `label` del tooltip es `string | number | undefined` (no solo `string`).
- **Alto responsive — por prop `height`, no CSS var:** Recharts necesita el alto como **valor numérico en el prop `height`** (no acepta una CSS var de altura). Se resuelve con **dos `<div>` + media queries de Tailwind v4** (`[@media(max-width:940px)]:hidden` / `[@media(min-width:941px)]:hidden`).
- **`prefers-reduced-motion`:** las tarjetas usan un detector interno de reduced-motion. **jsdom no implementa `window.matchMedia`**, así que se agregó un **mock global de `matchMedia` en `tests/setup.ts`** — necesario para cualquier componente futuro que detecte reduced-motion.
- **Dedupe de `useReports` por query key — no es doble fetch:** cuando `useReports(year, categoryIds)` se invoca **varias veces a la vez** con los mismos argumentos, React Query lo resuelve como **una sola request** por compartir la misma key (dedupe por key). No es N peticiones simultáneas.

## Design system "Precise Ledger" — tokens

Detalle operativo para no romper tokens en `.claude/agents/control-frontend.md`. Lo esencial:

- **Fuente de verdad de los valores:** `docs/design/control.css`. Implementación: tokens en `frontend/src/app/globals.css`, fuentes en `frontend/src/app/layout.tsx`. Preset Medio, acento Índigo. **Modo claro y oscuro** (ver §Modo de color (theming)).
- **Tokens en dos lugares por diseño de Tailwind v4 (no es redundancia):** `@theme` (valores literales que generan utilidades `bg-paper`/`text-accent`/`rounded-card`/`font-ui`) y `:root` (CSS vars directas `var(--accent)`… + sombras compuestas, densidad y fuentes). Cambiar un color implica mantener **ambos** alias.
- **Acento:** hue por `var(--accent-h)` (264) en `:root`, pero **hardcodeado a `264` en `@theme`** porque Tailwind v4 no resuelve CSS vars dentro de `@theme` en build.
- **Sin utilidad `shadow-*` del DS:** las sombras compuestas viven solo en `:root` (`var(--shadow-sm|md|lg)`).
- **Densidad fija** (`--row-pad`/`--card-pad`/`--gap`); sin toggles.
- **Cifras de dinero:** helper `.mono` (IBM Plex Mono + `tnum`).
- **Token semántico `warning`** (ámbar, hue 75) con la misma dualidad `@theme`/`:root` que income/expense, con su variante oscura. Detalle de valores y del re-estilado de primitivas en `.claude/agents/control-frontend.md`.
- **Todas las pantallas y modales usan el DS y `lucide-react`**: login, registro, sidebar, dashboard, vista del mes, categorías y los modales de movimiento/borrado. No queda SVG inline ni estilos fuera del DS. Componentes/utilidades compartidos: **`components/ui/auth-brand-side.tsx`** (panel de marca de login y registro) y la animación de modal **`animate-modal-pop`** (utility en `globals.css`). Detalle operativo (grilla/glow con `<div>` absolutos, gradiente hardcodeado, botón Google placeholder, scrim del modal) en `.claude/agents/control-frontend.md`.

## Modo de color (theming)

El modo de color (Sistema / Claro / Oscuro, RF-APP-001) se resuelve **por override de los alias CSS de `:root`** y se aplica a `<html>`. Regla funcional en `requirements.md`, RF-APP-001; spec visual de cada modo en `docs/design.md` (§modo de color). Lo no obvio:

- **El override va sobre `:root`, no sobre `@theme`.** El modo oscuro redefine los alias CSS de `:root` (`var(--paper)`, `var(--accent)`, sombras, etc.) bajo el selector **`[data-theme="dark"]`**. **`@theme` NO se toca**: no soporta theming dinámico (sus valores se hornean a utilidades en build). Como los componentes consumen `var(--token)`, el override de `:root` alcanza para repintar toda la app sin tocar `@theme`. El atributo **`data-theme` se setea en `<html>`** (`document.documentElement`).
- **Fuente canónica = blob `preferences` (clave `theme`, vía DB/sesión).** El flujo de aplicación es **DB → mirror localStorage → DOM**: cuando las preferencias cargan, el modo se sincroniza desde el blob al mirror y al DOM. La aplicación al DOM es **optimista** (se aplica antes de que el `PUT /preferences` resuelva). El mirror en localStorage (`"control:theme"`) **no es fuente de verdad**: existe solo para el boot sin flash.
- **Anti-flash (FOUC) — script inline síncrono en el `<head>` del root layout.** Un IIFE **clásico** (inyectado por `dangerouslySetInnerHTML`, **sin** `type="module"`) resuelve y aplica el tema **antes del primer paint**, leyendo el mirror localStorage; si vale `"system"` resuelve con `matchMedia("(prefers-color-scheme: dark)")`. **Gotcha:** debe ser síncrono y no-módulo — los módulos ES son diferidos y correrían **post-paint**, reintroduciendo el flash. `<html>` lleva **`suppressHydrationWarning`** porque el script muta `data-theme` antes de que hidrate React.
- **Reacción en vivo en "Sistema":** mientras el modo es `"system"`, un listener de `matchMedia` repinta al cambiar el `prefers-color-scheme` del SO.
- **Transición de flip a nivel `html`** (~0.18–0.20s, **solo color, nunca layout**); instantánea bajo `prefers-reduced-motion`. El panel de marca de auth (`.auth-grid-bg` / `.auth-glow`) es **invariante**: no cambia con el modo.

## Tailwind v4 — gotcha

- No usar `@apply` con clases que referencian tokens custom (ej: `border-border`). En `@layer base` referenciar las CSS variables directo con `var(--color-border)`. Es un cambio de comportamiento de v3 a v4 que produce un error de build poco claro si se ignora.

## Íconos de la app y PWA manifest

Los íconos se cablean por **file conventions de Next.js 15 (App Router)** — no hay `<link>` manuales en `layout.tsx`. Next genera los `<head>` a partir de archivos con nombres reservados:

| Archivo | Rol |
| --- | --- |
| `src/app/icon.svg` | Favicon escalable. |
| `src/app/favicon.ico` | Fallback legacy multi-res (16/32/48). |
| `src/app/apple-icon.png` | iOS home-screen, 180×180. |
| `src/app/manifest.ts` | Genera `/manifest.webmanifest` (PWA). |
| `public/web-app-manifest-192x192.png` / `-512x512.png` | Íconos referenciados por el manifest. |

- **Fuente de los assets:** `docs/design/icon-export/` (export del ícono de marca). Para cambiar el ícono se reemplazan esos fuentes y se regeneran los derivados de arriba.
- **Color del manifest:** `theme_color: "#1b46b4"` (azul profundo del gradiente del ícono), `background_color: "#ffffff"`.
- **Gotcha — `purpose` no combinado:** el tipo `MetadataRoute.Manifest` de Next 15 **no acepta** `purpose: "any maskable"` combinado (solo `"any" | "maskable" | "monochrome"`). Por eso el manifest lista **4 entradas** de íconos: 192 y 512, cada una declarada por separado en `any` y en `maskable`.
- **Gotcha — `sharp` no es dep declarada:** vive en `node_modules/.pnpm/sharp@.../`. Cualquier script de generación de assets debe referenciarlo por path o instalarlo explícito.

### Logo de marca in-app (≠ favicon)

El logo de marca que se ve **dentro de la app** (gem del sidebar, chip del login) usa `public/brand-icon.svg`, **no** `src/app/icon.svg`. Para el detalle visual (tamaños, radios, sombras, convivencia de colores) ver `docs/design.md`.

- **Dos copias del mismo SVG, a propósito:** `src/app/icon.svg` es file-convention de Next (favicon/meta; su URL no está garantizada como ruta estable) y `public/brand-icon.svg` es el asset estático addressable como `/brand-icon.svg` para `<img src>` en componentes. Cumplen roles distintos — **no deduplicar borrando uno**.
- **Se referencia con `<img>` nativo** (no `next/image`), con `eslint-disable-next-line @next/next/no-img-element`: es un SVG de marca con contenedor de tamaño fijo + `object-cover`, no necesita la optimización de `next/image` (los SVG no se optimizan). Si a futuro se migra a `next/image`, requiere `unoptimized` + `fill` con contenedor `relative`.
- **Consumidores:** `app-sidebar.tsx` (gem 34×34) y `auth-brand-side.tsx` (chip blanco 44×44 con el ícono 34×34 adentro).

## Testing — gotchas

- Tests en `tests/` (carpeta hermana de `src/`), espejando el árbol de `src/`. Ver convención completa en `docs/technical.md`.
- Con `vi.useFakeTimers()` activo: `waitFor` no funciona (usa `setInterval` internamente). Disparar eventos con `fireEvent` y avanzar el tiempo con `act(() => vi.advanceTimersByTime(...))`, luego assertions síncronas. En `afterEach` usar `vi.clearAllTimers()` (no `runAllTimers()`) antes de `vi.useRealTimers()` para evitar warnings de act() de React 19.
- **jsdom no ejecuta CSS:** los elementos ocultos por CSS (clases `hidden` de Tailwind, `grid-rows-[0fr]` colapsado) **siguen presentes en el árbol**. Consecuencias:
  - **Dos variantes responsive del mismo contenido** (desktop/mobile alternadas con `hidden`) quedan ambas → `getByText`/`getByLabelText` fallan por duplicado. Patrón: `aria-hidden="true"` en la variante que no debe estar en el árbol de accesibilidad, y `getAllByText` cuando el texto se comparte. Aplica a `/mes` (flechas ≥941px vs stepper ≤940px).
  - **Disclosure colapsable (técnica grid-rows):** afirmar contra render / no-render del nodo, no contra visibilidad. Ej. el bloque "Moneda y cotización": el selector de moneda siempre está en el DOM; el input de cotización solo se renderiza cuando `currency !== defaultCurrency` — testear ese montaje condicional.
  - **`role="region"` duplicado:** si el `<section>` padre del acordeón ya provee `role=region` vía `aria-labelledby`, no poner otro `role=region` con el mismo nombre en el `<div>` interno, o `getByRole("region", { name })` falla por duplicado.
  - **`getByRole("button", { name })` ambiguo** cuando más de un botón matchea (disclosure del acordeón + disparador de filtro `aria-label="Filtrar {sección}"`): diferenciarlos por presencia de `aria-expanded` + `aria-controls` (helper `getDisclosureButton`).
- **Mock global de `matchMedia` en `tests/setup.ts`:** jsdom no implementa `window.matchMedia`; necesario para componentes que detectan `prefers-reduced-motion` (tarjetas de reporte).
