# Gate de arranque del backend — pantalla de espera

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Régimen de captura: `captura.md`.

## Gate de arranque del backend — pantalla de espera a pantalla completa

> Superficie que **tapa toda la app** mientras el backend está despertando (plan free de Render: suspende tras ~15 min de inactividad, el primer request tarda ~50s). Sin ella, la app se lee como colgada. Es una superficie **pre-app**: el telón que se corre antes de que el producto exista.
>
> **Timing (insumo, no se decide acá):** aparece recién a los **~800ms** sin respuesta de `GET /health`; una vez visible permanece un **mínimo de ~1s**; a los **3 minutos** sin respuesta pasa al **estado de error** con botón *Reintentar*.

### 0. Encuadre — qué es y qué no

- **Dos estados, uno a la vez:** `despertando` (default) y `error` (a los 3 min). `oculto` es la ausencia de la superficie.
- **Tapa absolutamente todo:** `position: fixed; inset: 0`, alto `100dvh` (nunca `vh`), la **capa más alta de la app** — por encima de modales, popovers, toasts y sidebar. Nada de abajo se ve ni se toca, **incluida la pantalla de login**.
- **Un solo control en toda la superficie** (y solo en `error`): *Reintentar*. Sin cerrar, sin "seguir igual". El gate no se descarta: se resuelve.
- **Cero-impacto con el backend despierto.** Si `/health` responde antes de los 800ms, el gate **no se pinta nunca**: no reserva layout, no hace flash, no intercepta un clic.
- **Sin progreso falso.** Sin barra, porcentaje, cuenta regresiva ni spinner: el GIF es el único portador de "esto sigue pasando".

### 1. Fondo negro fijo — excepción declarada a la regla dura 4

- **`--gate-bg` = `oklch(0 0 0)` (#000 exacto), en los dos modos de color.** No consume tokens neutros del DS y **no reacciona a `[data-theme]`**.
- **Por qué no viola la regla dura 4:** mismo caso que el **panel de marca de auth** (`fundamentos.md` *Panel de marca de auth en oscuro*): **superficie de marca con fondo propio**; el producto todavía no está montado.
- **Negro puro, no casi-negro:** con un GIF de fondo `#000`, un casi-negro dibujaría un rectángulo. **Se materializa como token `--gate-bg`** (el `#000` no se repite suelto en ningún `.tsx`).
- **Tokens propios de la superficie** (fijos en ambos modos):

| Token | Valor | Uso |
|---|---|---|
| `--gate-bg` | `oklch(0 0 0)` | fondo de la superficie, borde a borde |
| `--gate-ink` | `oklch(0.95 0.006 270)` | texto fuerte (título del error) — mismo valor que `--ink` dark |
| `--gate-ink-2` | `oklch(0.78 0.008 270)` | texto de espera y sublínea — mismo valor que `--ink-2` dark |
| `--gate-warning` | `oklch(0.78 0.15 75)` | glifo del estado de error — `--warning` dark |
| `--gate-accent` | `oklch(0.66 0.17 264)` | fondo del botón primario — `--accent` dark |
| `--gate-accent-hover` | `oklch(0.72 0.17 264)` | hover del primario (un escalón más luminoso) |
| `--gate-accent-press` | `oklch(0.58 0.17 264)` | pressed — `--accent-press` dark |
| `--gate-focus` | `oklch(1 0 0 / 0.55)` | anillo de foco de la superficie |

- **Focus ring propio (desvío justificado).** El `--accent-soft` del DS pierde separación sobre negro y desaparece sobre el botón índigo. Se conserva la **geometría** (3px) y cambia el **valor**: `3px --gate-focus` + **2px de offset en `--gate-bg`**. Aplica a **todo** elemento focusable del gate.

### 2. Estado `despertando` — composición

**Bloque central único**, en columna, centrado en los dos ejes (centrado **geométrico**). Ancho: `min(100% − 2×padding, 420px)`.

**El encuadre del GIF — caja cuadrada de lado fijo:**

- **Lado `L` = `max(96px, min(56vw, 44dvh, 320px))`.** El ancho manda en viewports angostos, el alto en viewports bajos, y el cap de **320px** evita pixelar.
- **Caja cuadrada de lado fijo**, no se ajusta al asset: reserva el layout **antes** de que el GIF cargue (el texto no se mueve; mismo principio que `skeletons.md`).
- **`object-fit: contain` + `object-position: center`.** **Nunca `cover`.**
- **Proporción no 1:1:** el GIF entra completo y el sobrante queda en negro (invisible). 16:9 → `L × 0.56L`; vertical → `0.56L × L`.
- **Sin borde ni radio** con asset de fondo negro o transparente. **Con fondo claro/opaco**, `--r-card` (14px) + `overflow: hidden`.
- **Decorativo a nivel a11y:** `alt=""` + `aria-hidden="true"`.

**Proporción y peso ideales del asset:**

| Criterio | Recomendado | Por qué |
|---|---|---|
| **Proporción** | **1:1** (aceptable hasta 4:3 / 3:4) | Es la que llena el encuadre entero; cuanto más se aleja del cuadrado, más chico se ve el GIF a igual `L`. |
| **Resolución nativa** | **640 × 640 px** | 2× del cap de 320px CSS: nítido en pantallas retina sin peso de más. |
| **Fondo** | **transparente o `#000` puro** | Cualquier otro fondo dibuja un rectángulo sobre el negro. Sin halos ni bordes blancos: sobre negro se ve el recorte. |
| **Loop** | continuo, **1–3s**, sin corte visible | Un loop con salto se lee como "se trabó" — justo lo contrario de lo que la pantalla comunica. |
| **Peso** | **≤ 1.2 MB** | Se descarga en el peor momento posible (backend caído, red desconocida): un GIF pesado llegaría después del gate. |
| **Texto embebido** | **ninguno** | No se traduce, no escala y compite con la línea de texto real. |

**Texto acompañante:**

- **Copy exacto: `Despertando el servidor…`** — con **puntos suspensivos reales (`…`, U+2026)**, convención del DS para acción en curso (`Iniciando sesión…`, `captura.md` §13).
- **Tipografía:** `--ui` (Space Grotesk) **16px / 500**, `letter-spacing: .01em`, centrado. **No va en mono.**
- **Color `--gate-ink-2`**: jerarquía **GIF protagonista → texto pie de foto**.
- **Separación GIF → texto: 24px** (16px bajo `--bp-short`).
- **Una sola línea.**

**Accesibilidad del estado:**

- Contenedor con **`role="status"` + `aria-live="polite"` + `aria-label="Despertando el servidor"`**.
- **El fondo queda inerte:** la rama de app y la superficie de captura van `inert` (o `aria-hidden` + bloqueo de foco), y el `body` bloquea scroll. Mismo contrato que `overlays-modales.md` *Overflow de modales y bloqueo del fondo*.
- **`Escape` no hace nada.**

### 3. Entrada y salida — nunca un corte ni un flash

- **Entrada (a los 800ms):** fondo con **fade 0 → 1 en 160ms ease-out**, sin traslación. El **bloque interior** entra con el `pop` del DS (**scale .98 → 1 + fade, 220ms**) y **60ms de delay**.
- **Salida (backend respondió, cumplido el mínimo de 1s):** **fade-out de 220ms ease-in**, sin escala.
- **`pointer-events: none` apenas empieza la salida**, desmontaje al terminar.
- **El mínimo de ~1s se cuenta desde que arranca el fade de entrada.**
- **La app de abajo no se anima.**
- **`prefers-reduced-motion`:** sin `pop` y fades de **100ms**. El cross-fade se conserva (un salto instantáneo a negro es más agresivo que el movimiento).
- **Trade-off aceptado:** entre 0 y 800ms se ve el login/shell y después se tapa; el fade de 160ms lo convierte en "algo se puso encima".

### 4. Estado `error` (a los 3 minutos)

Misma superficie, mismo bloque centrado. **Cambia el contenido, no el encuadre.**

- **El GIF se retira del DOM** (un GIF atenuado sigue animando = "esto está pasando").
- **Glifo estático:** `TriangleAlert` (lucide), **40px**, **`--gate-warning`**. Ámbar, no rojo: no falló nada del usuario y hay salida.
- **Transición entre estados:** contenido de espera **fade-out 120ms** → cambio de alto → contenido de error **fade-in 160ms**. Con reduced-motion, cambio directo.
- **Copy:**
  - **Título:** `El servidor está tardando más de lo normal` — **18px / 700 / `-.01em`**, `--gate-ink`, centrado.
  - **Sublínea:** `Puede estar arrancando todavía. Probá de nuevo en unos segundos.` — **13.5px / 400**, `--gate-ink-2`, centrado, `max-width: 40ch`, `text-wrap: balance`.
- **Ritmo vertical:** glifo → **20px** → título → **8px** → sublínea → **24px** → botón.

**Botón `Reintentar` — primario del DS sobre negro:**

| Aspecto | Valor |
|---|---|
| Fondo / texto | `--gate-accent` / `oklch(0.99 0 0)`, con el **inset highlight** `white/0.12` del primario en oscuro |
| Radio | `--r-ctl` (10px) |
| Tipografía | 15px / 600 (**16px / 600** en régimen de captura) |
| Alto | **44px** en régimen de app (piso de target tocable) · **52px** en régimen de captura |
| Ancho | `auto` con `padding` horizontal **20px**; en captura **`w-full`** con cap **280px** |
| **Hover** | fondo `--gate-accent-hover`, 140ms (el hover del DS) |
| **Pressed** | fondo `--gate-accent-press`, sin desplazamiento |
| **Focus visible** | anillo **3px `--gate-focus` + 2px de offset en `--gate-bg`** (§1) |
| **Disabled** | `opacity: .55`, `cursor: not-allowed`, sin hover ni pressed |

- **Es el primario:** la única acción de la pantalla.
- **Al presionar, el gate vuelve a `despertando`** y el reloj de 3 minutos **se reinicia**. Sin spinner ni `Reintentando…`; el `disabled` solo blinda el instante del swap y el doble clic.
- **A11y:** contenedor pasa a **`role="alert"`**; el **foco se mueve al botón** al entrar en `error`. No depende solo del color: glifo + título + sublínea.

### 5. Régimen de captura y contención responsive (obligatoria)

**Una sola superficie para los dos regímenes.**

- **Montaje:** **fuera** de la rama `capture:hidden` y **fuera** de `CaptureSurfaceRoot` (`src/app/layout.tsx`), como hermano de ambos y por encima. **Sin variante `capture:` ni `max-wide:` de visibilidad.**
- **Adaptación continua, no por breakpoint:** `L = max(96px, min(56vw, 44dvh, 320px))` — 320px en desktop, ~218px a 390px de ancho, ~189px en `932 × 430`. **Sin breakpoint nuevo.**
- **Único ajuste por umbral — `--bp-short` (alto < 480px):** gap GIF→texto **24 → 16px**; botón de error a **48px** (espeja `captura.md` §12).
- **Safe areas:** padding `max(24px, env(safe-area-inset-*))` en los cuatro lados. **El negro pinta hasta el borde físico**; el contenido respeta el inset (`captura.md` §2).
- **Alto:** `100dvh`. `overflow: hidden`; `body` bloqueado.

**Los cuatro invariantes:**

1. **Sin scroll del `body`** — la superficie es `fixed inset-0` y su contenido cabe por construcción.
2. **Nada cortado ni atrapante** — el bloque entero entra siempre; se resuelve solo o con *Reintentar*.
3. **Ninguna acción inalcanzable** — *Reintentar* centrado, ≥44px (≥52px en captura).
4. **Superficies anchas** — no aplica.

### 6. Reglas duras reafirmadas

- **Regla 1:** ningún semántico income/expense; el error va en **ámbar**.
- **Regla 2:** índigo **solo** en el botón primario.
- **Regla 3:** sin cifras de dinero; todo en `--ui`.
- **Regla 4:** **excepción declarada y acotada** — fondo negro fijo en ambos modos (precedente del panel de marca de auth). Idéntica en los dos modos, a propósito.

### Checklist de aceptación visual — Gate de arranque

**Cero-impacto (backend despierto)**

1. Con el backend ya despierto (recarga inmediata tras una navegación), **no se ve ningún destello negro**: la app pinta directo, sin gate.
2. La página es interactiva de inmediato: ningún clic queda "comido" por una capa invisible.

**Estado `despertando`**

3. A los ~800ms sin respuesta aparece una superficie **negra a pantalla completa** que tapa todo: sidebar, contenido, toasts y modales. Nada de la app se ve por ningún borde.
4. El mismo negro se ve **idéntico en tema claro y en tema oscuro** (togglear el tema no cambia el gate).
5. El **GIF está centrado** en los dos ejes, completo (no recortado), y el texto queda **24px debajo**.
6. Copy exacto: **`Despertando el servidor…`**, con puntos suspensivos de un solo carácter, en Space Grotesk, **no** en mono, color gris claro (no blanco pleno).
7. El GIF **no supera 320px** de lado en desktop y no está pixelado.
8. El texto **no se mueve** cuando el GIF termina de cargar (el encuadre reservó el espacio).
9. Con el gate arriba, **Tab no alcanza nada de abajo** y el fondo no scrollea.

**Entrada y salida**

10. La aparición es un **fade**, no un corte: no hay parpadeo blanco ni salto de layout.
11. Cuando el backend responde, el gate **se disuelve** (~220ms) y la app queda debajo ya pintada; no hay flash blanco entre medio.
12. El gate **nunca dura menos de ~1s** visible (no titila).
13. Con `prefers-reduced-motion` activo: sin escala/`pop`, fades muy cortos, sin salto instantáneo a negro.

**Estado `error` (a los 3 min)**

14. El **GIF desaparece** (no queda animando atenuado) y en su lugar hay un **triángulo ámbar de 40px**.
15. Título `El servidor está tardando más de lo normal` (18px/700, blanco) + sublínea `Puede estar arrancando todavía. Probá de nuevo en unos segundos.` (gris, centrada, máximo ~40 caracteres por línea).
16. El paso de `despertando` a `error` **no se ve saltar**: el contenido cruza con fade y el bloque queda recentrado.
17. **`Reintentar`** es un botón índigo sólido, radio 10px, de **44px** de alto (52px en pantalla chica), claramente clickeable sobre el negro.
18. **Hover** aclara el índigo; **pressed** lo oscurece; **Tab** muestra un **anillo blanco de 3px con 2px de aire negro** perfectamente visible (no un halo índigo que se funde con el botón).
19. Al entrar en `error`, el **foco ya está en el botón** (Enter lo dispara sin tocar Tab).
20. Al presionar `Reintentar`, la pantalla **vuelve al GIF + `Despertando el servidor…`**.

**Régimen de captura y tamaños**

21. En un viewport `< 600px` (ancho u alto) el gate se ve **igual de completo**: GIF centrado, texto legible, nada cortado.
22. En `932 × 430` (apaisado bajo): el GIF **achica** y todo el bloque entra sin scroll.
23. Con alto `< 480px`: gap GIF↔texto más corto y botón de error de 48px; nada se superpone.
24. Con notch / barra de gestos: **el negro llega al borde físico** de la pantalla y ningún texto ni el botón quedan bajo un inset del sistema.
25. En **ningún** tamaño aparece scroll del `body`, horizontal o vertical, con el gate arriba.
