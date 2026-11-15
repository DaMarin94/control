# Frontend — Hub de Configuración (`/configuracion`)

`/configuracion` es un **hub de administración** con **layout compartido** y **cuatro secciones deep-linkables**, no una pantalla tabificada. Contenido funcional en `docs/screens.md` y en el módulo de cada sección en `docs/requirements/` (índice en `docs/requirements.md`).

**Layout compartido (`app/(app)/configuracion/layout.tsx`, Client Component):** contiene lo **persistente** entre secciones (no se re-monta al navegar entre rutas hijas):
- La **cabecera de página** (eyebrow "Ajustes" + **único H1 "Configuración"** + bajada).
- La **columna de navegación vertical**: landmark **`<nav>`** con **`<Link>`** por sección y **`aria-current="page"`** en la activa, derivada de **`usePathname()` por comparación exacta** (las 4 rutas son hojas). **NO es un tablist** ni estado efímero: son URLs reales.

**Cuatro secciones = cuatro rutas anidadas**, en orden fijo, cada una una page hoja que renderiza su gestor bajo un `h2`:

| Sección | Ruta | Contenido |
| --- | --- | --- |
| General | `/configuracion` | preferencias de la cuenta (moneda por defecto), datos externos (IPC, cotizaciones) |
| Categorías | `/configuracion/categorias` | gestor de categorías (`docs/frontend/categorias.md`) |
| Métodos de pago | `/configuracion/metodos-pago` | gestor de métodos de pago (`docs/frontend/metodos-pago.md`) |
| Límites | `/configuracion/limites` | gestor de límites (`docs/frontend/limites.md`) |

- **Gestores co-ubicados:** los componentes de Categorías y Métodos de pago viven bajo `app/(app)/configuracion/categorias/` y `app/(app)/configuracion/metodos-pago/`, junto a su `page.tsx`.
- **Bloque de ancho canónico una sola vez:** el layout del hub aplica `max-w-280 mx-auto` + `px-10`; las pages hijas solo devuelven su contenido.
- **Jerarquía de cabecera de 3 niveles:** H1 (layout) · `h2` de sección (por ruta) · títulos de card. Los gestores no tienen eyebrow ni H1 propio.
- **`/categorias` y `/metodos-pago` redirigen (308)** a las rutas anidadas, vía `redirects()` en `next.config.ts`.
- **No son links del sidebar** (ver `docs/frontend/navegacion.md`).
