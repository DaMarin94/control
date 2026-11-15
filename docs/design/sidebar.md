# Sidebar y marca

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. El selector de modo de color del bloque inferior vive en `fundamentos.md` §Selector de modo de color (chrome global). El ítem "Historial" del nav: `historial.md` §8.

## Sidebar — mostrar/ocultar (chrome toggleable)

Implementa **RF-NAV-002**. El sidebar (`AppSidebar`, 248px) no auto-colapsa por breakpoint: es **chrome que el usuario muestra u oculta a voluntad en todo el régimen de app** (`≥ 600px` en ambos ejes). Un solo elemento, dos estados (**abierto** / **cerrado**). No hay drawer, no hay overlay, no hay rail de íconos, no hay hamburguesa por breakpoint. El estado persiste en la preferencia `sidebarOpen` (default **abierto**).

### Estado abierto (default)

- El sidebar es el de RF-NAV-001: **248px de ancho, `fixed inset-y-0 left-0`, `bg-panel`, `border-r border-line`, `px-4 py-[22px]`**. Contenido: logo, label "Menú", nav, spacer, CTA "Nuevo movimiento", fila de Tema, `UserMenu`.
- **Empuja el contenido:** el `<main>` está corrido 248px; su ancho es `viewport − 248px`. (El offset es `margin-left`, no `padding-left`, para no inflar el `inline-size` que miden las container queries.)
- **Control de colapsar (vive dentro del sidebar):** un botón **al extremo derecho de la fila del logo**, alineado con el gem (`items-center`, el logo a la izquierda, el botón `ml-auto`). No es un ítem de nav; es chrome del propio sidebar.
  - **Ícono:** `PanelLeftClose` (lucide), 18px, `strokeWidth` default. Comunica "plegar el panel lateral" mejor que un hamburguesa (que lee "abrir menú"). `aria-label="Ocultar menú"`, `aria-expanded="true"`.
  - **Caja:** botón `~32px` (`p-1.5`), `rounded-ctl`. Glifo en reposo `text-muted`.
  - **Estados:** hover `bg-panel-2` + glifo `text-ink`; active `bg-panel-3`; focus-visible `shadow-[0_0_0_3px_var(--accent-soft)]` (anillo DS); transición `duration-[140ms] motion-reduce:transition-none`. Mismo vocabulario que el resto de los controles de chrome.

### Estado cerrado

- El sidebar **desaparece por completo**: no queda rail de íconos ni franja. **Decisión deliberada:** un rail parcial obligaría a diseñar una tercera variante del sidebar (¿dónde van la CTA, el Tema, el `UserMenu`?) y contradice el objetivo del cierre, que es **dar todo el ancho al contenido**.
- El `<main>` pasa a offset 0: el contenido ocupa el **ancho completo del viewport** (menos su `px-10` propio), respetando el mismo contrato de ancho de contenido (llena hasta 1120, después capea y centra).
- **Control de abrir (vive sobre el contenido):** un **botón flotante fijo arriba-izquierda** (`fixed top-4 left-4 z-40`).
  - **Ícono:** `PanelLeft` (lucide), 20px. `aria-label="Mostrar menú"`, `aria-expanded="false"`.
  - **Caja como chip de chrome:** a diferencia del botón de colapsar (que vive sobre el `bg-panel` del sidebar), este flota **sobre contenido arbitrario de la página**, así que necesita cuerpo propio para leerse: `bg-panel`, `border border-line`, `rounded-ctl`, `shadow-[var(--shadow-sm)]`, caja `~40px` (`p-2.5`) para target táctil holgado (~44px con el área de toque). Glifo `text-ink-2` en reposo.
  - **Estados:** hover `bg-panel-2` + glifo `text-ink`; active `bg-panel-3`; focus-visible anillo `--accent-soft`; misma transición 140ms.
  - **No tapa la acción de la página:** el chip **manda** (es chrome persistente, no puede quedar tapado; invariante 3), así que **lo que se corre es el contenido, y se corre a nivel app** — ver "Banda reservada" abajo.

#### Banda reservada del chip flotante (sidebar cerrado)

**Regla:** con el sidebar **cerrado**, `<main>` reserva una **banda superior de 36px** (`padding-top: 36px`; con el sidebar **abierto** es `0`). Sumada al `py-[34px]` que aportan todas las pantallas de la app autenticada, **el primer píxel de contenido de página queda a 70px del borde superior del viewport**: 12px de aire por debajo del chip, que ocupa 58px de alto (`top-4` = 16px + caja de 42px = glifo 20 + `p-2.5` ×2 + borde 1px ×2).

- **Invariante:** *con el sidebar cerrado, ningún contenido de página se pinta por encima de los 70px superiores del viewport en el arranque de la pantalla.* Ese es el contrato; los 36px son su implementación dado el `py-[34px]` común. Si alguna pantalla cambiara su padding superior, se recalcula la banda para sostener el invariante — no se parchea la pantalla.
- **Por qué a nivel app y no por pantalla.** El chip flota en coordenadas de **viewport**: la colisión no depende de la pantalla sino del **ancho**. Cuando el viewport baja de ~1200px el bloque de contenido deja de estar centrado y queda pegado a su `px-10` (x = 40px), justo debajo del chip (x = 16..58). **Ninguna pantalla se defiende sola, y el eyebrow no es una defensa:** a anchos apretados el chip invade el arranque de la primera línea haya o no eyebrow. La banda a nivel app cubre a **todas** las pantallas, con eyebrow o sin él.
- **Reserva vertical, nunca horizontal.** Correr el contenido a la derecha (más `padding-left`) desalinearía el header respecto del cuerpo de la página, rompería el centrado del cap de 1120px y —si se hiciera con `padding` sobre `<main>`— inflaría el `inline-size` que miden las container queries. La banda vertical no toca ninguno de los tres ejes.
- **Anima con el resto:** la banda entra y sale dentro de la **misma transición coordinada** del offset del sidebar (0.24s `cubic-bezier(0.4,0,0.2,1)`; instantánea con `prefers-reduced-motion`). Cerrar el sidebar es un solo movimiento: el contenido se corre a la izquierda y baja lo que ocupa el chip.
- **Alcance explícito:** la banda protege el **arranque** de la pantalla. Con scroll > 0 el chip sigue flotando sobre contenido arbitrario — es inherente a un chip fijo y **no** se resuelve acá.

> **Un control lógico, dos encarnaciones.** No hay dos botones simultáneos: cuando el sidebar está **abierto**, se ve solo el botón de **colapsar** (dentro del sidebar); cuando está **cerrado**, se ve solo el botón **flotante de abrir**. No hay lógica por breakpoint.

### Borde crítico — sidebar abierto a ancho apretado: empuja, no overlay

Con el sidebar **abierto** a un viewport chico (ej. 700px → contenido ~452px), el sidebar **empuja y estrecha el contenido**; **nunca** pasa a overlay por encima del contenido. Razón: el overlay abriría una **segunda variante del sidebar** y rompería el modelo de "un elemento, dos estados" válido en todo el régimen de app. La consecuencia (contenido angosto a viewport chico con sidebar abierto) se absorbe con los mecanismos de contención ya definidos: **la disposición sigue al ancho de contenido** (colapsa a compacto/1-columna) y las superficies anchas **scrollean dentro de sí** (invariante 4). No se promete buena experiencia a 452px, se promete que **no se rompe**. Si el usuario quiere más ancho, cierra el sidebar — es su decisión, no la del breakpoint.

### Transición de abrir/cerrar

- **Qué se mueve:** el sidebar se desliza horizontalmente (entra/sale por el borde izquierdo) y, **en sincronía**, el `<main>` reajusta su offset izquierdo (248→0 al cerrar, 0→248 al abrir), como un solo movimiento coordinado.
- **Duración y easing:** **0.24s** con `cubic-bezier(0.4, 0, 0.2, 1)`. Cae entre el modal `pop` (.22s) y la entrada de pantalla (.32s); es chrome, no una entrada dramática.
- **Sin fades de contenido:** el contenido de la página no hace fade; solo se reacomoda su posición/ancho. El sidebar puede acompañar su deslizamiento con un fade sutil de opacidad, pero no es requisito.
- **`prefers-reduced-motion`:** sin transición — el cambio de estado es instantáneo.

### Carga inicial sin flash

El estado inicial (`sidebarOpen`) viene de la preferencia del usuario (blob, server-rendered, igual que `theme`). **No debe haber flash de estado incorrecto al montar:** la app no puede pintar el sidebar abierto y luego cerrarlo (ni al revés) al hidratar. El primer paint ya refleja el `sidebarOpen` correcto. El mecanismo lo resuelve `control-frontend`, análogo al anti-FOUC del modo de color. Es un requisito de **comportamiento visual**, no una sugerencia.

### Sidebar de navegación global — padding superior del logo

La sidebar (`<aside>`, 248px) tiene padding vertical propio `py-[22px]` (de la escala de espaciado). El **logo** (bloque `<Link>` con el gem + wordmark "Control / Finanzas del mes") es el primer elemento del contenido; abre la columna con un aire superior **consistente** con el resto del espaciado, no pegado arriba.

- **Valor:** el logo lleva `pt` de **`10px`**. Sumado al `py-[22px]` del `<aside>`, da un aire superior total de **32px** (22 + 10) por encima del gem — un valor de la escala que equilibra contra el `pb-[18px]` inferior del logo y el ritmo de la lista de nav que sigue.
- **Dónde se aplica:** en el **`pt` del `<Link>` del logo** (10px), **no** en el `py` del `<aside>`. El `py-[22px]` del `<aside>` es el padding estructural de la columna (vale igual arriba y abajo, y en los dos estados del sidebar); el aire fino del logo es responsabilidad del propio bloque del logo. El `pb-[18px]` del logo no cambia.

### Logo de marca — ícono real (gem) en sidebar y login

El logo es el **ícono de marca real** exportado. El glifo es una **rueda/timón** (círculo con 6 radios + nodos, blanco sobre fondo azul con gradiente). Vive en **dos contextos**: el gem del sidebar y el chip del login.

**Asset canónico.**

- **Imagen del gem (con su fondo azul):** `frontend/src/app/icon.svg` (= `docs/design/icon-export/Control-icon.svg`, idénticos). SVG cuadrado *full-bleed*: `rect` con gradiente azul `#5080eb` (arriba-izq) → `#1b46b4` (abajo-der), glifo blanco centrado con ~18% de padding interno, **esquinas rectas** (el redondeo lo da el contenedor, no el asset).
- **Intención de marca = esquinas redondeadas.** Los `preview-rounded-*.png` muestran la marca como se quiere ver. Por eso, en producto, el ícono se monta **siempre dentro de un contenedor con su propio radio** (`rounded-[…]` + `overflow-hidden`), **nunca a borde recto**.
- **Por qué la imagen y no un SVG inline en el componente:** un solo asset es la fuente de verdad (el mismo que alimenta favicon/PWA, ver `docs/frontend.md`). Se monta como `<img>`/`next/image` con `alt=""` decorativo (el wordmark/`aria-label` adyacente ya nombra la marca), nunca redibujando el glifo a mano.

**El azul del ícono convive con el índigo de marca, no lo reemplaza.** El gem tiene su **azul propio** (`#5080eb`→`#1b46b4`, `theme_color` del manifest). El **acento del DS es índigo** (`--accent`, hue 264) para todo lo demás (nav activo, botones primarios, focus ring). Son dos azules-violáceos de la **misma familia de marca**: el azul vive **encerrado dentro del recuadro del gem**; fuera del gem, manda el índigo. **No** se retiñe el ícono al índigo ni se cambia el `--accent` al azul del ícono. La convivencia es **deliberada**.

**Contexto 1 — gem del sidebar.**

- Contenedor: **34×34px**, `rounded-[10px]` (radio gem del DS), `overflow-hidden`, `shrink-0`.
- Relleno: el ícono `frontend/src/app/icon.svg` a `100%` (`object-cover`), `alt=""`, `aria-hidden="true"`.
- **Elevación:** `shadow-[var(--shadow-sm),inset_0_1px_0_oklch(1_0_0_/_0.25)]`. La `--shadow-sm` lo asienta sobre la columna; el **inset highlight** blanco arriba lee bien sobre el azul del gem. El fondo lo trae el asset (sin gradiente CSS ni texto "C").
- El wordmark adyacente ("Control" / "Finanzas del mes") y el `pt-[10px]` del bloque logo según la sección anterior.

**Contexto 2 — chip del login (`BrandSide`).** Acá el gem va **sobre fondo índigo degradado**. Un gem azul directo sobre índigo "ensucia" el contraste (dos azules pegados). El chip lleva un **marco/halo blanco** como **passe-partout** del ícono: el blanco separa el azul del gem del índigo del fondo.

- Contenedor exterior (chip blanco): **44×44px**, `rounded-[13px]`, `background: #fff`, `shadow-[0_6px_18px_oklch(0.2_0.05_270_/_0.3)]`. `grid place-items-center`, `shrink-0`, `aria-label="Control"`.
- Ícono dentro del chip: **34×34px**, `rounded-[9px]`, `overflow-hidden`. Deja un **marco blanco de ~5px** alrededor del gem (44 − 34 = 10 → 5px por lado). El ícono a `object-cover`, `alt=""`, `aria-hidden="true"`.
- El wordmark "Control" (`<b>` 22px) a la derecha y el resto del `BrandSide` no cambian.
- La versión compacta del chip en el acceso de régimen de captura: `captura.md` §13.

> Regla derivada: **el gem de marca siempre se monta dentro de un contenedor con radio + `overflow-hidden`** (10px en sidebar, 13px de chip / 9px de gem interior en login). Sobre superficies **claras** (sidebar `--panel`) el gem va **directo**. Sobre superficies **de marca índigo** (login) el gem va **con marco blanco** para no encimar dos azules. El azul del asset nunca sale del recuadro del gem; el índigo del DS sigue siendo el acento de todo lo demás.
