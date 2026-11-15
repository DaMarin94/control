# Frontend — Navegación de período (`PeriodNav`)

Componente reutilizable **`components/ui/period-nav.tsx`**: navegación genérica de período con **flechas gigantes a los costados** del contenido (`‹ contenido ›`; ‹ = anterior, › = siguiente). Lo usa **`/mes`**. **Reportes no lo usa**: navega el año con un stepper pill embebido en cada card (ver `docs/frontend/graficos.md`). Spec visual en `docs/design.md`.

## Props

| Prop | Tipo | Descripción |
| --- | --- | --- |
| `children` | `ReactNode` | El contenido del período que envuelve. |
| `prevLabel` / `nextLabel` | `string` | `aria-label` de cada flecha (en `/mes`: "Mes anterior" / "Mes siguiente"). |
| `onPrev` / `onNext` | `() => void` | Handlers de navegación. |
| `canGoPrev` / `canGoNext` | `boolean` (default `true`) | `false` → flecha `aria-disabled`, sin hover, no dispara el handler. En `/mes` siempre `true` (sin topes). |

## Estructura: bloque canónico + flechas portadas al `body`

`PeriodNav` **no es un grid**. Son dos piezas dentro de un wrapper raíz `relative` que ocupa el **100% del ancho de `<main>`** (sin padding propio), sistema de referencia de las flechas:

- **Bloque de contenido** — mismo mecanismo canónico que las demás pantallas: `max-w-280 mx-auto` (llena el ancho de `<main>` y capea a 1120px centrado). El `px-10` y el padding vertical los aporta el **consumidor** sobre `children`.
- **Flechas ‹ ›** — el botón visible se monta vía `createPortal` a **`document.body`**, con `position: fixed; top: 50%; translateY(-50%)`, centrado respecto del **viewport real**. **No reservan ancho**. Tamaño único **64×64** (glifo 46px).

**Por qué portal a `document.body`.** `<main>` es `@container` (`container-type: inline-size`), containing block de sus descendientes `position:fixed`/`sticky`: un botón fijado dentro de `<main>` resolvería contra `<main>` y scrollearía con la página (ver `docs/frontend/navegacion.md`, gotcha del `@container`).

**Posicionamiento por medición JS.** Dentro del wrapper quedan dos **anclas `absolute` invisibles** (`aria-hidden`, `pointer-events-none`) que funcionan como **sondas**. `useArrowGeometry` mide con `getBoundingClientRect` + `ResizeObserver` (+ resize de ventana): (a) el ancho del wrapper contra **1288px** para decidir el régimen, y (b) el `left` resuelto de cada ancla, que da la coordenada horizontal del botón portado (~20px de aire respecto del bloque de 1120px). Una medición de ancho 0 (frame inicial sin layout, o jsdom) conserva el último estado conocido (default visible).

**Sin scroll fantasma con listas cortas:** al vivir en `document.body` con `position:fixed`, el botón nunca aporta alto al documento.

## Dos regímenes

| Ancho de contenido | Régimen |
| --- | --- |
| ≥1288px | Flechas overlay ‹ › a los costados + título grande en el header. |
| ≤1287px | Flechas `hidden`; el consumidor renderiza el **stepper compacto** en el header. |

El umbral es **1288px** (`--container-arrows`, variant `@arrows:`/`@max-arrows:`), independiente del `941px` (`@wide:`) que rige el colapso de grillas de stat-cards. `1288 = 1120 + 2×84` (botón de 64 + 20px de aire por lado).

Se mide por **container query sobre `<main>`** (`@arrows:`), **no** contra el viewport: con el sidebar abierto a viewport 1400px el contenido mide ~1112px → régimen compacto.
