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
├── app/            (rutas del App Router: /login, /, /mes, /categorias)
├── components/     (todos los componentes de UI)
├── hooks/          (todos los hooks: useToast, hooks de datos, etc.)
├── lib/            (capa de API centralizada, config, helpers)
└── types/          (tipos que reflejan el contrato de la API)
```

Dentro de cada carpeta se pueden agrupar archivos por dominio (ej: `components/movements/`) si el volumen lo justifica, pero la división de primer nivel es por tipo.

## Convenciones

- **Server vs Client Components:** por defecto Server Components (App Router de Next 15). Se marca `"use client"` solo cuando hace falta interactividad, estado o hooks. Páginas y layouts arrancan server; formularios, toasts y data-fetching con React Query van en client.
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

## Autenticación (Auth.js / NextAuth v5)

NextAuth **orquesta el login** en el front pero **no emite un token de identidad propio**: el JWT que importa lo emite NestJS (ver `docs/architecture.md`). NextAuth solo lo persiste y lo expone para reenviarlo al backend.

### Providers

- **Credentials provider:** su `authorize` llama a `POST /auth/login` del backend y devuelve el `accessToken` y el `user` que el backend emite.
- **Google provider:** scaffolded, condicional a que existan las credenciales. Hoy diferido — no está activo (ver gotcha en `.claude/agents/control-frontend.md`).

### Callbacks y sesión

Los callbacks `jwt` y `session` persisten el **`accessToken` de NestJS** y el **`userId`** dentro de la sesión de Auth.js. `session.accessToken` queda disponible para las llamadas al backend.

> La sesión de Auth.js es un JWE propio (encriptado por NextAuth); el `accessToken` que viaja dentro es el JWT de NestJS, opaco para el front. Son dos tokens distintos (ver `docs/data-model.md`).

### Adjuntar el Bearer al backend (patrón obligatorio)

**No hay interceptor global.** Toda fase que consuma el backend debe usar uno de estos dos caminos:

- **Client Components** → hook **`useApi`**, que toma `session.accessToken` de `useSession()`.
- **Server Components** → llamar **`auth()`** directamente y pasar el token a **`apiRequest({ token })`**.

### Pantallas y protección de rutas

- Pantallas `/login` y `/registro`; dashboard placeholder en `/dashboard`.
- **Protección de rutas** vía `src/middleware.ts`: una ruta privada sin sesión redirige a `/login`; un usuario autenticado que entra a `/login` o `/registro` es redirigido a `/dashboard`.
- **Auto-login tras registro:** un registro exitoso deja al usuario logueado sin pasar por la pantalla de login (RF-AUTH-006).

## Categorías (`/categorias`)

CRUD de categorías. Se accede **por URL** — todavía no hay sidebar/nav (RF-NAV-001 viene en una fase posterior).

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

## Movimientos únicos

Carga de movimientos. En Fase 4 solo está visible **crear** (desde el dashboard); editar y eliminar quedan implementados como componentes/hooks reutilizables, listos para que la **Vista del mes** (Fase 5) los cablee.

### Modal de carga (`components/movements/transaction-modal.tsx`)

- **Tres tabs: Único, Fijo, Cuotas.** Solo **Único es funcional**; **Fijo y Cuotas van deshabilitados** con badge "Próximamente" (llegan en Fases 6/7).
- **Form único reutilizado** en modo crear y editar. En modo edición no muestra los tabs de selección de tipo (RF-CM-001).

### transaction-form

- Tipo **Gasto** (default) / **Ingreso**; monto **en pesos** (se convierte a centavos al enviar); selector de categoría **filtrado por scope** (RN-010) que **reusa `["categories"]`** (`CATEGORIES_QUERY_KEY`); fecha + hora (default: ahora); descripción opcional.
- **Estados:** Guardando; **Sin categorías disponibles** (link a `/categorias`); **Error backend** — el modal **queda abierto y conserva los datos** ingresados (RNF-008).

### Crear desde el dashboard

- Botón **"Nuevo movimiento"** en `/dashboard` abre el modal. Al guardar → toast con acción **"Ir a ver"** que navega a `/mes?month=YYYY-MM` (ruta real que construye Fase 5; hoy `404` por diseño).

### Editar / eliminar — listos para Fase 5

- `TransactionModal` acepta `transaction: Transaction | null` (null = crear, objeto = editar).
- `DeleteTransactionDialog` acepta `transaction` (diálogo de confirmación antes del hard delete).
- La Vista del mes solo tiene que pasarles el movimiento de la lista y renderizarlos.

### Datos (`use-transactions`)

- Hook **`useTransactions()`** expone las mutaciones: `createTransaction`, `updateTransaction(id, data)`, `deleteTransaction(id, month)`.
- **`useTransactionsByMonth({ month, timezone })`** — lista del mes, listo para la Vista del mes.
- **Query key como función:** `TRANSACTIONS_QUERY_KEY(month) = ["transactions", month]` — **varía por mes**. Invalidar la clave del mes afectado al mutar.
- **Gotcha — `deleteTransaction` recibe `month` explícito:** el `DELETE` devuelve `204` sin cuerpo, así que no se puede derivar del recurso qué mes invalidar. El llamador (Fase 5) deriva el `month` del `occurredAt` del movimiento de la lista y lo pasa.

### Helpers (`lib/format.ts`)

Reusarlos, no reimplementar:

- **`parseCurrencyInput`** — pesos → centavos vía `Math.round(parsed * 100)`; acepta punto o coma decimal. **`formatCurrency`** — centavos → string en pesos.
- **`localToUtcIso` / `utcToLocalDate` / `utcToLocalTime`** — conversión local ↔ UTC con `Intl.DateTimeFormat` de doble pasada; **maneja DST** correctamente.
- **`getBrowserTimezone`** — IANA del navegador.

## Tailwind v4 — gotcha

- No usar `@apply` con clases que referencian tokens custom (ej: `border-border`). En `@layer base` referenciar las CSS variables directo con `var(--color-border)`. Es un cambio de comportamiento de v3 a v4 que produce un error de build poco claro si se ignora.

## Testing — gotchas

- Tests en `tests/` (carpeta hermana de `src/`), espejando el árbol de `src/`. Ver convención completa en `docs/technical.md`.
- Con `vi.useFakeTimers()` activo: `waitFor` no funciona (usa `setInterval` internamente). Disparar eventos con `fireEvent` y avanzar el tiempo con `act(() => vi.advanceTimersByTime(...))`, luego assertions síncronas. En `afterEach` usar `vi.clearAllTimers()` (no `runAllTimers()`) antes de `vi.useRealTimers()` para evitar warnings de act() de React 19.
