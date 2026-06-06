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

## Tailwind v4 — gotcha

- No usar `@apply` con clases que referencian tokens custom (ej: `border-border`). En `@layer base` referenciar las CSS variables directo con `var(--color-border)`. Es un cambio de comportamiento de v3 a v4 que produce un error de build poco claro si se ignora.

## Testing — gotchas

- Tests en `tests/` (carpeta hermana de `src/`), espejando el árbol de `src/`. Ver convención completa en `docs/technical.md`.
- Con `vi.useFakeTimers()` activo: `waitFor` no funciona (usa `setInterval` internamente). Disparar eventos con `fireEvent` y avanzar el tiempo con `act(() => vi.advanceTimersByTime(...))`, luego assertions síncronas. En `afterEach` usar `vi.clearAllTimers()` (no `runAllTimers()`) antes de `vi.useRealTimers()` para evitar warnings de act() de React 19.
