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
- **`KebabMenu` (`components/ui/kebab-menu.tsx`)** — menú de tres puntos para las acciones de fila **editar / eliminar** en listas. Es el **componente estándar para esas acciones**: toda lista nueva que las necesite lo usa, en lugar de botones inline en la fila. Se renderiza **por portal a `document.body` con posición `fixed`** (coordenadas tomadas del trigger) porque las tarjetas de lista tienen `overflow-hidden` y el `transform` de los contenedores de página atraparía un `position: fixed` no portaleado — mismo motivo que los modales. Detalle operativo (API, comportamiento de apertura/cierre) en `.claude/agents/control-frontend.md`.

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

## Preferencias de usuario (cimiento — fase 1.1.0)

Mecanismo de persistencia de preferencias del usuario (estado de UI que sobrevive a la navegación y al cierre de sesión). Es el **cimiento** que consumirán fases posteriores (1.1.4 secciones colapsadas/orden, 1.1.5 reportes, 1.1.6 filtro por categoría); en la fase 1.1.0 **no hay UI de producto**. Contrato del backend en `docs/data-model.md` ("Contrato de preferencias de usuario").

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

- **Modal único crear/editar:** "Nueva categoría" lo abre vacío; "Editar" lo abre pre-cargado. Campos: nombre y scope. El **color no se edita** (lo asigna el backend).
- **Eliminar:** diálogo de confirmación antes del soft delete.

### Flujo de reactivación (409 reactivable)

Al crear, si el backend responde `409` con `error.data.reactivable`, el modal **no muestra un error de duplicado**: muestra un prompt "Ya tenés una categoría 'X' eliminada. ¿Querés reactivarla?" con **Reactivar / Cancelar**. El prompt aclara explícitamente que la categoría vuelve con su **configuración original (scope y color)**, no con lo tipeado en el form — los valores del form se ignoran. Reactivar llama a `POST /categories/:id/reactivate` con el `id` que vino en `error.data.category`.

- **`isReactivableError`** — type guard sobre el `ApiError` para discriminar este caso del `409` de colisión-con-activa (que sí es un error de duplicado común). El `ApiError` porta `data?: unknown` que fluye desde la capa `apiRequest`.

### Datos

- **`use-categories`** — hook con React Query, clave **`["categories"]`** (constante `CATEGORIES_QUERY_KEY`). Todas las mutaciones (crear, editar, eliminar, reactivar) invalidan esa clave.
- El **futuro selector de categorías** del formulario de movimientos **debe reusar `CATEGORIES_QUERY_KEY`** para compartir caché.

> **Nota — `Select` primitivo:** el scope se elige con un `Select` que es un `<select>` **nativo** (no Radix). Es un primitivo mínimo, reemplazable a futuro en un solo lugar.

### Uso dual de `CategoryFormModal` (standalone vs inline)

El mismo `CategoryFormModal` se usa en **dos modos**, diferenciados **solo por props opcionales** — no hay flag explícito de modo:

- **Standalone (desde `/categorias`):** comportamiento normal. El selector de scope ofrece las tres opciones (`AMBOS` / `GASTO` / `INGRESO`) con default **"Ambos"**.
- **Inline (desde los formularios de movimiento, RF-MU-004):** se activa pasando las props **`lockScopeToType`** y **`onCreated`**:
  - `lockScopeToType` (el tipo del movimiento en curso, `EXPENSE` / `INCOME`) **restringe el selector de scope** a ese tipo + "Ambos" y **preselecciona el tipo exacto**.
  - Al crear o reactivar con éxito, el modal **devuelve la categoría al padre vía `onCreated`** para que el formulario de movimiento la **autoseleccione**.
  - **Cuotas pasan `lockScopeToType="EXPENSE"` fijo** (las cuotas son siempre Gasto en v1).
- **`ReactivationPrompt.onReactivated` propaga la categoría reactivada hacia arriba:** para soportar la autoselección inline, el prompt de reactivación ahora pasa la categoría reactivada al padre (no solo cierra). El `CategoryFormModal` la reenvía por `onCreated`.

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
  - **`"create"`** — abre con tabs **Único / Fijo / Cuotas**, los tres funcionales (ya no queda ningún "Próximamente"). Renderiza `TransactionForm`, `RecurringForm` o `InstallmentForm` según el tab.
  - **`"edit-single"`** — sin tabs; `TransactionForm` precargado con un `Transaction` (RF-MU-002).
  - **`"edit-fixed"`** — sin tabs; `RecurringForm` precargado con un `Recurring` (RF-MF-003).
  - **`"edit-installment"`** — sin tabs; `InstallmentForm` precargado con el grupo de cuotas (RF-MC-003).
- En modo edición no muestra los tabs de selección de tipo (RF-CM-001): el tipo de un movimiento no se cambia por edición.

### transaction-form

- Tipo **Gasto** (default) / **Ingreso**; monto **en pesos** (se convierte a centavos al enviar); selector de categoría **filtrado por scope** (RN-010) que **reusa `["categories"]`** (`CATEGORIES_QUERY_KEY`); fecha + hora (default: ahora); descripción opcional.
- **Estados:** Guardando; **Sin categorías disponibles** (link a `/categorias`); **Error backend** — el modal **queda abierto y conserva los datos** ingresados (RNF-008).

### Crear desde el dashboard

- Botón **"Nuevo movimiento"** en `/` abre el modal. Al guardar → toast con acción **"Ir a ver"** que navega a `/mes?month=YYYY-MM`.

### Editar / eliminar — cableados desde la Vista del mes

- `TransactionModal` selecciona el flujo de único por `mode` (`"create"` / `"edit-single"`); ver la discriminated union por `mode` arriba.
- `DeleteTransactionDialog` acepta `transaction` (diálogo de confirmación antes del hard delete).
- La Vista del mes pasa a estos componentes el movimiento de la lista (ver mapeo `MovementItem → Transaction` en la sección Vista del mes y Dashboard).

### Datos (`use-transactions`)

- Hook **`useTransactions()`** expone las mutaciones: `createTransaction`, `updateTransaction(id, data)`, `deleteTransaction(id, month)`.
- **La lista del mes ya no vive acá:** se lee con `useMovements(month)` (ver sección Vista del mes y Dashboard). Se eliminó el hook `useTransactionsByMonth` y la query key legacy `["transactions", month]` — apuntaban al endpoint eliminado `GET /transactions?month&timezone`.
- **Invalidación al mutar:** las mutaciones de `useTransactions` invalidan **`MOVEMENTS_QUERY_KEY(month) = ["movements", month]`** (la clave de `useMovements`).
- **Gotcha — `deleteTransaction` recibe `month` explícito:** el `DELETE` devuelve `204` sin cuerpo, así que no se puede derivar del recurso qué mes invalidar. El llamador deriva el `month` del `occurredAt` del movimiento de la lista y lo pasa.

### Helpers (`lib/format.ts`)

Reusarlos, no reimplementar:

- **`parseCurrencyInput`** — pesos → centavos vía `Math.round(parsed * 100)`; acepta punto o coma decimal. **`formatCurrency`** — centavos → string en pesos.
- **`localToUtcIso` / `utcToLocalDate` / `utcToLocalTime`** — conversión local ↔ UTC con `Intl.DateTimeFormat` de doble pasada; **maneja DST** correctamente.
- **`getBrowserTimezone`** — IANA del navegador.
- **Helpers de mes (Fase 5):** **`getCurrentMonth`** — mes actual `YYYY-MM` en la zona del navegador; **`formatMonthLabel`** — `YYYY-MM` → rótulo legible (nombre de mes + año); **`prevMonth` / `nextMonth`** — desplazan un `YYYY-MM` un mes hacia atrás / adelante. Reusarlos para la navegación del mes; no reimplementar aritmética de meses.

## Movimientos fijos

Carga, edición y eliminación de movimientos fijos. Se crean desde el tab **Fijo** del modal de carga; editar y eliminar se cablean desde la Vista del mes, igual que los únicos.

### `recurring-form.tsx`

- Tipo **Gasto** (default) / **Ingreso**; monto en pesos; selector de categoría filtrado por scope (reusa `CATEGORIES_QUERY_KEY`); descripción opcional. **No tiene fecha ni hora** — el fijo opera a nivel mes (RF-MF-001).
- **En edición el tipo es read-only** (RF-MF-003: el tipo no se edita). **Gotcha:** un campo `type` deshabilitado no lo registra react-hook-form; hay que mantener un `<input type="hidden">` con el valor para que RHF lo registre y Zod lo valide.

### `delete-recurring-dialog.tsx`

- Diálogo de confirmación **sin opciones** (RF-MF-004, reescrito en Bitácora 2026-06-13): la eliminación aplica **siempre desde el mes visualizado inclusive en adelante**. El cliente fija `fromCurrentMonth = true` y `currentMonth` = mes visualizado (`viewMonth`, fallback `getCurrentMonth()`). El checkbox "Eliminar también desde este mes" que existió en versiones previas fue **quitado** — no reintroducirlo (ver gotcha en `.claude/agents/control-frontend.md`, Fase 3).

### `movement-item-row.tsx`

- Fila de la lista del mes (compartida por únicos, fijos y cuotas). Muestra un **badge de origen** ("Único" / "Fijo" / "Cuotas"). Para fijos muestra **"Mensual"** y para cuotas la etiqueta **"Cuota X/N"** (de `installment.number` / `installment.total`) en lugar de fecha. **Null-safety:** `occurredAt` / `timezone` pueden venir `null` (fijos y cuotas) — no pasarlos a `formatDate` / `formatTime` sin chequear.

### Datos (`use-recurring`)

- Hook con las mutaciones `createRecurring`, `updateRecurring`, `deleteRecurring`.
- **Invalida toda la familia `["movements"]` (por prefijo), no una sola key de mes:** un fijo afecta muchos meses (mes actual + futuros), así que invalidar solo `["movements", month]` dejaría meses desactualizados en caché.
- **El front calcula `currentMonth` / `startMonth` con `getCurrentMonth()`** (zona del navegador) y los manda al backend — editar/eliminar son relativos al **mes actual real**, no al mes visualizado.
- **Gotchas:**
  - En `updateRecurring`, para **limpiar** la descripción se envía `description: null` **explícito** (no `undefined`, que el backend interpretaría como "no cambiar").
  - El mapeo `MovementItem → Recurring` para precargar el form de edición sigue el mismo patrón que el de únicos (el ítem no trae todos los campos del recurso).

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

## Vista del mes y Dashboard

Las dos pantallas de visualización (Fase 5), sobre el endpoint unificado `GET /movements?month=YYYY-MM` (contrato en `docs/backend.md`, sección Movimientos del mes).

### Dashboard movido a `/`

El dashboard vive en **`/`** (`src/app/page.tsx`). Antes era `/dashboard` — una desviación de `screens.md` introducida en Fase 2 que se corrigió acá. La carpeta `/dashboard` se eliminó. Redirects actualizados a `/`:

- `src/middleware.ts`: un usuario autenticado que entra a `/login` o `/registro` se redirige a `/`.
- `callbackUrl` / `redirectTo` por defecto del login, el registro y `use-register` apuntan a `/`.
- **Sign-out sigue yendo a `/login`** (sin cambios).

### Dashboard (`/`)

- **Encabezado con el mes actual** (sin navegación entre meses — siempre el mes en curso).
- **Resumen financiero** del mes (gastos / ingresos / balance) leído de `data.totals`.
- Botón **"Nuevo movimiento"** (abre el modal de carga) y enlace **"Ver todos"** → `/mes`.
- **Estado vacío** (sin movimientos en el mes): totales en cero y CTA **"Cargá tu primer movimiento"** que abre el modal.
- **No lista movimientos** (decisión de producto; la lista vive en `/mes`).

### Vista del mes (`/mes`)

- Lee el mes de **`?month=YYYY-MM`** (default: mes actual en la zona del navegador, vía `getCurrentMonth`).
- **Encabezado + navegación prev / next** que cambian `?month=` (con `prevMonth` / `nextMonth`); rótulo con `formatMonthLabel`.
- **Totales del mes** (de `data.totals`).
- **Lista agrupada en secciones Únicos / Fijos / Cuotas.** Una sección **sin movimientos no se muestra**; los tres orígenes traen datos. Cada ítem (`movement-item-row`) muestra tipo, monto, categoría, descripción y badge de origen, con acciones **Editar** y **Eliminar** que abren el flujo según el origen: únicos → `TransactionModal` (`edit-single`) / `DeleteTransactionDialog`; fijos → `TransactionModal` (`edit-fixed`) / `delete-recurring-dialog`; cuotas → `TransactionModal` (`edit-installment`) / `delete-installment-dialog`.
- **Se actualiza al mutar** (crear / editar / eliminar) por invalidación de la query del mes.

### Datos (`use-movements`)

- Hook **`useMovements(month)`** sobre `GET /movements?month=`. **Query key como función:** **`MOVEMENTS_QUERY_KEY(month) = ["movements", month]`** — varía por mes.
- Las mutaciones de `useTransactions` invalidan `["movements", month]` (ver sección Movimientos únicos). Reusar esta clave para invalidar — no inventar otra.

### Mapeo `MovementItem → Transaction` (para editar)

- El ítem de la lista (`MovementItem`) **no trae `userId` / `createdAt` / `updatedAt`** (los modales de edición no los usan) y **`categoryId` se deriva de `category.id`**. La Vista del mes arma el `Transaction` que esperan `TransactionModal` / `DeleteTransactionDialog` a partir del `MovementItem`.

### Gotcha — `<Suspense>` + `useSearchParams`

- `/mes` usa **`useSearchParams()`**, que en el App Router de Next.js 15 **obliga a envolver el componente en `<Suspense>`** (si no, el build falla). Ya resuelto con un wrapper que provee el límite de Suspense.

### Navegación entre pantallas

La navegación entre `/`, `/mes` y `/categorias` se hace por el **sidebar global** (ver sección siguiente) y, en paralelo, por los **accesos definidos en cada pantalla** (enlace "Ver todos" del dashboard, acción "Ir a ver" del toast post-guardado, URL). Ambos conviven.

## Navegación global (sidebar — RF-NAV-001)

Feature 100% frontend, construida **fuera de la secuencia de fases** (post-Fase 7). Resuelve la navegación entre secciones, la acción primaria de nuevo movimiento y el menú de usuario, persistente en pantallas autenticadas. Ver bitácora 2026-06-10 en `docs/requirements.md`.

### Punto único de montaje: route group `app/(app)/`

Las tres pantallas autenticadas (`/` dashboard, `/mes`, `/categorias`) viven dentro del **route group `app/(app)/`**, con un `layout.tsx` compartido que monta el sidebar **una sola vez**.

- **Los route groups de Next.js no alteran las URLs:** `/`, `/mes` y `/categorias` siguen siendo idénticas — `(app)` es solo organización de archivos.
- **`login` y `registro` quedan FUERA del grupo** → no heredan el layout, por eso no muestran sidebar (cumple el criterio de RF-NAV-001 "no se muestra en pantallas no autenticadas").
- **Regla para pantallas futuras: toda pantalla nueva con sesión debe vivir bajo `app/(app)/`** para heredar el sidebar. No remontar el sidebar por pantalla.
- El `<main className="min-h-screen ...">` con el contenedor `mx-auto max-w-2xl` vive ahora en este layout; **las páginas hijas solo devuelven su contenido**, no su propio `<main>` ni contenedor.
- Los componentes co-ubicados de categorías (`categories-list`, `category-form-modal`, `delete-category-dialog`, `reactivation-prompt`) se movieron junto a su `page.tsx` dentro de `(app)/categorias/`.

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

## Gráfico anual (RF-GRA-001..003)

Visualización anual de ingresos/gastos. El spec visual completo (color, alturas, jerarquía, comportamiento de transición) vive en `docs/design.md` — acá se documenta solo la arquitectura y los gotchas técnicos.

### Arquitectura en dos capas (enfoque shadcn charts)

El gráfico se separa en una **primitiva reutilizable** (motor de charting, agnóstica de la feature) y **tarjetas de feature** que la componen. Cualquier gráfico futuro reusa la primitiva.

- **Primitiva `components/ui/chart.tsx`** — primitiva estilo shadcn charts sobre **Recharts v3** (el motor; instalado con `pnpm add`, no npm), themeada con los tokens del DS (CSS vars `oklch`). Es una **primitiva nueva de `components/ui/`**, pensada para reusarse en futuros gráficos, no solo en el anual. Exporta:
  - **`ChartContainer`** — wrapper de `ResponsiveContainer` de Recharts + theming del DS.
  - **`ChartTooltipContent`** — tooltip themeado con el DS.
  - **`ChartLegend`** — leyenda themeada con el DS.
- **Dos tarjetas autónomas en `components/charts/annual-chart-widget.tsx`** — el módulo ya **no** exporta un widget único con toggle interno; exporta **dos tarjetas independientes**, cada una con su propia cabecera, gráfico, leyenda, tooltip y estados (skeleton / con datos / vacío / meses futuros / error), y cada una consume `useAnnual(year)` por su cuenta:
  - **`IncomeExpenseCard`** (Forma 1) — `AreaChart` con ingresos y gastos superpuestos. Props: **`year`** (number), **`chartHeight`** (number), **`showYearInHeader`** (boolean — muestra el año fijo en la cabecera de la tarjeta cuando no hay control externo de año).
  - **`ByCategoryCard`** (Forma 2) — `BarChart` apilado por categoría, usando `category.color` de cada categoría. Props: **`year`** (number), **`chartHeight`** (number).
  - **El control de año NO vive en las tarjetas.** Cambiar de año es responsabilidad de la página anfitriona (ver Puntos de uso).

### Datos (`use-annual`)

- Hook **`useAnnual(year)`** sobre `GET /movements/annual?year=`. **Query key como función:** **`ANNUAL_QUERY_KEY(year) = ["annual", year]`** — varía por año. Sin mutaciones (es solo lectura).
- Aplica el patrón obligatorio **`enabled: isAuthenticated`** (igual que `useMovements` / `useCategories`; ver Queries de lectura gate-adas en la sección Autenticación).
- Tipos del contrato en **`types/annual.ts`**: `AnnualMovementsResponse` / `AnnualMonth` / `AnnualCategory`.

### Puntos de uso

- **Pantalla dedicada `app/(app)/anual/page.tsx`** (dentro del route group `(app)`, hereda el sidebar). Monta **`IncomeExpenseCard` + `ByCategoryCard` apiladas**, ambas con el mismo `year`. **El año es estado local de la página** (no de las tarjetas): el control de año `‹ ›` (`YearStepper`) vive en el **`.phead`**, a la derecha del H1 "Anual", y gobierna ambas tarjetas a la vez. La página también lee `earliestYear` (vía `useAnnual`) para deshabilitar el retroceso antes del primer año con movimientos. **El año NO va en la URL** → esta pantalla **no usa `useSearchParams()` ni necesita `<Suspense>`** (a diferencia de `/mes`, que sí lee `?month=`).
- **Dashboard (`dashboard-client.tsx`)** — monta **solo `IncomeExpenseCard`** con **`showYearInHeader=true`** y año fijo (el año en curso), sin control externo de año, ubicado **tras el balance hero y antes del footer**.
- **Sidebar** — link **"Anual"** (`/anual`), activo por `startsWith("/anual")`. Orden de links: Dashboard → Vista del mes → Anual → Categorías.

### Gotchas técnicos (Recharts v3 + Tailwind v4 + DS)

Para que un agente futuro que toque gráficos no los re-tropiece:

- **CSS vars `oklch` directas en el SVG de Recharts:** se pueden pasar `var(--token)` directo en props de color (`stroke`, `fill`, y `stopColor` de `<stop>` dentro de `<defs>`). **No** hace falta `getComputedStyle` en runtime para resolver el token.
- **Cifras tabulares (`tnum`):** la propiedad `fontFeatureSettings` **no existe** en el tipo de tick SVG de Recharts; el `tnum` se delega a la CSS var **`--mono`** (IBM Plex Mono ya trae `tnum`). No intentar setear `fontFeatureSettings` en el tick.
- **Recharts 3.x + TypeScript strict:** `TooltipPayload` es **`readonly`** → el componente custom de tooltip requiere un **doble cast** (`as unknown as Array<...>`). El prop `label` del tooltip es `string | number | undefined` (no solo `string`).
- **Alto responsive — por prop `height`, no CSS var:** Recharts necesita el alto como **valor numérico en el prop `height`** (no acepta una CSS var de altura). Se resuelve con **dos `<div>` + media queries de Tailwind v4** (`[@media(max-width:940px)]:hidden` / `[@media(min-width:941px)]:hidden`): uno con el alto desktop (el `chartHeight` que pasa la página: **280** en dashboard, **340** en `/anual`) y otro con **220** en ≤940px.
- **`prefers-reduced-motion`:** las tarjetas usan un detector interno de reduced-motion. **jsdom no implementa `window.matchMedia`**, así que se agregó un **mock global de `matchMedia` en `tests/setup.ts`** — necesario para cualquier componente futuro que detecte reduced-motion.
- **Dedupe de `useAnnual` por query key — no es doble fetch:** en `/anual`, `useAnnual(year)` se invoca **varias veces a la vez** (cada tarjeta por su cuenta, más la página para leer `earliestYear`). React Query lo resuelve como **una sola request** porque todos comparten la misma key `["annual", year]` (dedupe por key). No es N peticiones simultáneas; que no sorprenda al próximo que vea varios `useAnnual` en el mismo árbol.

## Design system "Precise Ledger" — tokens (Fase 1)

Detalle operativo para no romper tokens en `.claude/agents/control-frontend.md`. Lo esencial:

- **Fuente de verdad de los valores:** `docs/design/control.css`. Implementación: tokens en `frontend/src/app/globals.css`, fuentes en `frontend/src/app/layout.tsx`. Hoy solo modo claro, preset Medio, acento Índigo.
- **Tokens en dos lugares por diseño de Tailwind v4 (no es redundancia):** `@theme` (valores literales que generan utilidades `bg-paper`/`text-accent`/`rounded-card`/`font-ui`) y `:root` (CSS vars directas `var(--accent)`… + sombras compuestas, densidad y fuentes). Cambiar un color implica mantener **ambos** alias.
- **Acento:** hue por `var(--accent-h)` (264) en `:root`, pero **hardcodeado a `264` en `@theme`** porque Tailwind v4 no resuelve CSS vars dentro de `@theme` en build.
- **Sin utilidad `shadow-*` del DS:** las sombras compuestas viven solo en `:root` (`var(--shadow-sm|md|lg)`).
- **Densidad fija** (`--row-pad`/`--card-pad`/`--gap`); sin toggles. **Dark mode no portado** (se hará sobreescribiendo `:root` bajo `[data-theme="dark"]`).
- **Cifras de dinero:** helper `.mono` (IBM Plex Mono + `tnum`).
- **Token semántico `warning`** (ámbar, hue 75) agregado en Fase 2 con la misma dualidad `@theme`/`:root` que income/expense; al portar dark mode necesita su variante oscura. Detalle de valores y del re-estilado de primitivas en `.claude/agents/control-frontend.md`.
- **Todas las pantallas y modales usan el DS y `lucide-react`** (Fase 3): login, registro, sidebar, dashboard, vista del mes, categorías y los modales de movimiento/borrado. No queda SVG inline ni estilos fuera del DS. Nuevos componentes/utilidades compartidos: **`components/ui/auth-brand-side.tsx`** (panel de marca de login y registro) y la animación de modal **`animate-modal-pop`** (utility en `globals.css`). Detalle operativo (grilla/glow con `<div>` absolutos, gradiente hardcodeado, botón Google placeholder, scrim del modal) en `.claude/agents/control-frontend.md`, sección Fase 3.

## Tailwind v4 — gotcha

- No usar `@apply` con clases que referencian tokens custom (ej: `border-border`). En `@layer base` referenciar las CSS variables directo con `var(--color-border)`. Es un cambio de comportamiento de v3 a v4 que produce un error de build poco claro si se ignora.

## Testing — gotchas

- Tests en `tests/` (carpeta hermana de `src/`), espejando el árbol de `src/`. Ver convención completa en `docs/technical.md`.
- Con `vi.useFakeTimers()` activo: `waitFor` no funciona (usa `setInterval` internamente). Disparar eventos con `fireEvent` y avanzar el tiempo con `act(() => vi.advanceTimersByTime(...))`, luego assertions síncronas. En `afterEach` usar `vi.clearAllTimers()` (no `runAllTimers()`) antes de `vi.useRealTimers()` para evitar warnings de act() de React 19.
