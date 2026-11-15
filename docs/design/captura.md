# Superficie de captura

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`.

## Superficie de captura

> Spec visual de **la única superficie que Control ofrece en régimen de captura** (`min(ancho, alto) < 600px`, ver `fundamentos.md` §Contención responsive → *Dos regímenes de superficie*): cargar un movimiento. Requerimiento y alcance funcional: `requirements.md` RF-APP-003 (captura, con el criterio canónico de tamaño) y RF-APP-004 (acceso); pantalla: `screens.md` §12 y §1 "Variante en régimen de captura".
>
> **Qué hay acá y qué no.** En régimen de captura hay **una** capacidad —crear un movimiento— más **ver de qué cuenta es la sesión** y **cerrarla**. No hay navegación, no hay dashboard, no hay `/mes`, no hay configuración, no hay edición ni duplicado. Esta sección define cómo se ve y cómo se toca eso; **no** habilita nada más.

### 0. Encuadre — una lógica, dos composiciones

**Modelo de tres capas.** Cada superficie que captura un movimiento se construye así:

1. **Lógica de feature — compartida, agnóstica de UI.** Estado del formulario, defaults, validación y sus mensajes, mutaciones, conversión de monedas, proyección de límites, comportamiento post-guardado. No sabe qué superficie la consume ni pinta nada. **Fuente única de verdad funcional:** una regla de negocio cambia una vez y cambia en todas las superficies.
2. **Primitivas del design system — compartidas.** `Input`, `Select`, `Button`, `ModalShell`, tokens de color, tipografía, radios, sombras, focus ring, estados. Las dos superficies hablan **el mismo idioma visual**.
3. **Composición por superficie — propia.** Cada superficie arma su propia UI consumiendo el hook. El **modal de escritorio** (`ModalShell` variante `form`) y la **superficie de captura** son **composiciones hermanas**: ninguna es una variante ni un caso especial de la otra.

**Regla general — vale para toda superficie de captura futura, no solo para esta.** La lógica se comparte **hacia arriba** (un hook común); la presentación **no se comparte de costado**. Una superficie nueva no hereda el markup de otra ni lo corrige con CSS de cascada o overrides de utilidades: consume el mismo hook y compone lo suyo. Si dos superficies se ven distinto, es porque **cada composición lo declara**, no porque una le esté pisando estilos a la otra.

**La frontera — qué comparte y qué es propio:**

| Compartido (idéntico, sin excepción) | Propio de cada superficie |
|---|---|
| Reglas de negocio, validación y sus mensajes | Estructura del DOM y agrupación de bloques |
| El **conjunto de campos** y sus defaults | Ritmo vertical y espaciados |
| Copys de label, error, vacío y toast | Tamaños de control, tipografía de campo y alto de fila |
| Paleta, tipografía, radios, sombras, focus ring | Qué zona queda fija y cuál scrollea |
| **Semántica de color** (verde ingreso · rojo gasto · índigo solo marca) y **dinero en mono tabular** | Composición de la zona de acción (qué botones, con qué ancho) |
| Primitivas del DS | Orden visual de los bloques |
| Los cuatro invariantes de contención | Densidad (puntero fino vs. dedo) |

- **El orden visual es propio, pero coincide.** La superficie de captura respeta el mismo orden que el modo creación (`screens.md` §5) porque no hay motivo para divergir; cualquier divergencia futura se declara **acá**, no se descubre en el navegador.
- **Alcance cerrado: composición libre, capacidades no.** El contenido funcional es **idéntico** al del modal de creación (RF-APP-003): mismos tres tipos, mismos campos, mismo "Más opciones". La libertad de esta sección es de **forma**, nunca de alcance — ningún campo nuevo, ninguna acción nueva, ningún destino nuevo.

**Diferencias de envase, en una tabla:**

| | Modal de escritorio | Superficie de captura |
|---|---|---|
| Pieza | `ModalShell` (variante `form`) | **Envase de captura** (pantalla completa) |
| Fondo | scrim oscurecido + panel flotante `max-w-[460px]` | **sin scrim, sin panel**: la superficie *es* la pantalla |
| Cierre | ✕ y `Esc` | **no existe**: no hay pantalla debajo a la que volver |
| Zona de acción | `Cancelar` + `Guardar` | **solo `Guardar`**, a ancho de columna |
| Densidad | puntero fino | **dedo** (§4) |

**La zona de acción es un slot del envase, no del form.** El form aporta sus campos y su submit; **quién dibuja los botones y con qué composición lo decide el envase**. Por eso acá no hay "Cancelar" huérfano ni un footer de modal recortado: el envase monta una sola acción. Ningún form declara su propia barra de acciones por su cuenta.

### 1. Envase de captura — anatomía y zonas

Columna flex a **alto completo del viewport dinámico**, con **tres zonas** y **una sola región que scrollea** — mismo contrato conceptual que `ModalShell`, distinta encarnación:

- **Raíz:** `flex flex-col`, `height: 100dvh` (**`dvh`, nunca `vh`**), `overflow-hidden`, fondo `--paper`. El **`body` no scrollea nunca** (ni vertical ni horizontal): todo el scroll vive en la zona 2.
- **Zona 1 — Cabecera (`shrink-0`, pineada).** Fondo `--panel`, `border-b border-hair`. Contiene, en este orden: la **fila de sesión** (§5) y la **barra de tabs** (§6). No scrollea: la identidad de la cuenta y el cambio de tipo están **siempre a la vista**. Padding horizontal `max(16px, env(safe-area-inset-left/right))`; padding superior `max(10px, env(safe-area-inset-top))`; `padding-bottom: 12px`.
- **Zona 2 — Cuerpo (`flex-1 min-h-0 overflow-y-auto overscroll-contain`).** El form activo. `padding: 16px 16px 20px` (los laterales, otra vez, `max(16px, safe-area)`), con el **ritmo vertical propio de §4**. Es la **única** región con scroll.
- **Zona 3 — Footer de acción (`shrink-0`, pineado, hermano del cuerpo — nunca hijo).** Fondo `--panel`, `border-t border-hair`, `padding: 12px 16px`, `padding-bottom: max(14px, env(safe-area-inset-bottom))`. Aloja **un solo control**: `Guardar` a ancho de columna (§8).

**Columna de contenido — `min(100%, 480px)`, centrada.** Las tres zonas **pintan su fondo y sus hairlines a ancho completo del viewport** (incluida la banda de safe area), pero **su contenido se alinea a una misma columna** de `min(ancho disponible, 480px)`, centrada horizontalmente. Consecuencias:

- En un viewport angosto (el caso más común) la columna **es** el ancho disponible y la regla es inerte: nada cambia.
- En un viewport **ancho y bajo** —que también es régimen de captura— la columna evita que el form se estire. Una fila de campos de 51px estirada a 900px pierde el ritmo vertical, aleja el label de su valor y convertiría a `Guardar` en un blanco absurdo de 900px de ancho.
- **480px** no es arbitrario: es el panel del modal de escritorio (460px) más el aire que la densidad táctil necesita. Mantiene las dos superficies en la misma familia de medida sin copiar su estructura.
- **El chrome sí corre de borde a borde:** las hairlines de cabecera y footer son cortes estructurales de la pantalla, no bordes de una tarjeta. Cortarlas a 480px haría leer el envase como un panel flotante, que es exactamente lo que no es.

**Las hairlines de corte son permanentes**, no condicionales al overflow. A diferencia del modal —un panel flotante que se lee como una sola superficie cuando el contenido entra—, acá cabecera y footer son **chrome estructural** de la pantalla: su línea los separa del cuerpo siempre, y así el usuario sabe desde el primer vistazo que hay una zona que se mueve y dos que no.

**Sin ✕, sin scrim, sin `Esc`.** No hay nada que cerrar. El envase tampoco toma body-lock: no hay fondo que bloquear.

### 2. Safe areas y alto real

- **`dvh`, nunca `vh`.** El alto del envase sigue el **viewport dinámico**: con la barra del navegador entrando y saliendo, ni el footer ni la cabecera se cortan.
- **Safe areas en los cuatro lados.** Toda la cadena de padding del envase usa `max(valor-de-diseño, env(safe-area-inset-*))`: arriba por el notch / isla, abajo por la barra de gestos del sistema, y **a los costados** cuando el inset lateral existe. Ningún control queda bajo un inset del sistema.
- **El fondo llega hasta el borde; el contenido no.** `--panel` de la cabecera y del footer pinta **hasta el borde físico** de la pantalla (incluida la banda del inset), mientras que sus controles respetan el inset. Sin esto, la barra de gestos queda sobre una franja de `--paper` que se lee como un corte.

### 3. Teclado virtual abierto

**Contrato (verificable a ojo):** con el teclado abierto, (a) el **campo con foco queda visible**, y (b) el botón **Guardar sigue alcanzable** — nunca queda tapado por el teclado ni "atrapado" debajo de él.

- **El envase sigue al viewport visual.** Cuando el teclado se abre, el alto útil del envase es el que queda **por encima del teclado**: la cabecera se mantiene arriba, el cuerpo se achica y el footer con Guardar se apoya **sobre el borde superior del teclado**. Cómo se consigue (declaración de `interactive-widget` en el viewport meta y/o seguimiento del viewport visual) lo resuelve `control-frontend`; **el contrato es visual y no negociable**: el footer no se hunde bajo el teclado.
- **Aire de scroll alrededor del campo enfocado.** Todo control del cuerpo declara `scroll-margin-top: 16px` y `scroll-margin-bottom: 88px`, de modo que el auto-scroll del navegador nunca deje el campo pegado al filo de la cabecera ni debajo del footer pineado.
- **Sin `autofocus` al entrar.** La superficie **no** abre el teclado sola. Si lo hiciera, el teclado taparía la mitad inferior antes de que el usuario pueda elegir tab o tipo. El primer toque lo da el usuario.

### 4. Densidad táctil y ritmo — la escala propia de esta superficie

Los valores del DS están dimensionados para puntero fino. La superficie de captura **compone su propia escala**, no ajusta la del modal: **misma paleta, misma tipografía, mismos radios, mismos estados**: cambia el tamaño del blanco y el aire, no el lenguaje. Nada de esto se logra pisando estilos del modal — cada valor es de la composición de esta superficie.

**Tamaños de control:**

| Elemento | Valor en la superficie de captura | Alto resultante |
|---|---|---|
| **Target mínimo de cualquier control** | `44 × 44px` de área tocable | — |
| **Separación entre targets adyacentes** | `≥ 8px` | — |
| **Input de texto / select** (`Input`, `Select`) | `px-[14px] py-[13px]`, texto **16px** | 51px |
| **Campo Monto** | ver *Campo Monto* abajo | **64px** |
| **Segmento Gasto / Ingreso** | `py-[14px]`, texto 15px/600, grilla 2 col `gap-2` | 52px |
| **Pestaña Único/Fijo/Cuotas** | `py-[13px]`, texto 14px/600 | 46px |
| **Fila de checkbox** (débito automático) | fila entera tocable, `min-h-[44px]`, caja 20px, label 15px | 44px |
| **Disparador "Más opciones"** | fila entera tocable, `min-h-[44px]` con `py-[12px]` | 44px |
| **Botón de texto "+ Nueva"** | `min-h-[44px]`, márgenes negativos para no engordar la fila del label | 44px |
| **Acción primaria (Guardar)** | `h-[52px]`, texto 16px/600 | 52px |

**Cómo se lee la columna "Alto resultante":** es el alto **medido de la caja ya renderizada** —incluye el renglón del texto al `line-height` del cuerpo del DS (1.45) y el borde del control—, no la suma nominal del padding. **El alto es el contrato y el padding es la variable de ajuste:** si un cambio de tipografía corre el renglón, se recalcula el padding para sostener el alto, nunca al revés. Los controles de alto fijo (`h-[52px]`, `min-h-[44px]`) lo fijan directo.

**Ritmo vertical (propio de esta superficie, no el del modal):**

| Relación | Separación | Por qué |
|---|---|---|
| Entre **bloques de campo** consecutivos | **16px** | El modal usa 14; con controles de 51–52px y targets de 44 el aire sube un escalón de la escala, o los blancos se leen como una masa continua. |
| **Label → su control** | **6px** | Suficiente para que el par se lea como una unidad y no como dos líneas sueltas. Es la mitad justa del aire entre bloques: la proximidad hace el agrupamiento, no una caja. |
| **Control → su mensaje de error** | **6px** | El error pertenece al campo; se agrupa con él, no con el bloque siguiente. |
| **Debajo del bloque Monto** | **20px** | Un escalón extra: el protagonista se separa del resto del form en vez de formar fila con él. |
| Dentro de un **par en dos columnas** (Fecha · Hora) | **14px** horizontal | Mismo gap que el par de escritorio: horizontalmente el aire ya alcanza. |
| Antes del disparador **"Más opciones"** | **16px** + hairline `--line` de ancho de columna arriba | Separa el núcleo obligatorio del cajón opcional con la primitiva más barata del DS. |
| Último bloque → borde inferior del cuerpo | **20px** | Colchón para que el último campo no quede lamiendo la hairline del footer al final del scroll. |

**Campo Monto — dimensiones propias:**

- **Ancho: el 100% de la columna de contenido.** No lleva ancho intrínseco, `size`, ni caja angosta: `w-full min-w-0`. Un campo de importe más angosto que sus vecinos se lee como "acá va poco"; el protagonista es el más grande **en los dos ejes**.
- **Alto total 64px**, con caja `px-[14px] py-[10.5px]` alrededor de una cifra de 28px — cuyo renglón, al `line-height` del DS, se lleva ~41px de esos 64: el padding vertical es lo que queda. Es el control más alto del cuerpo —**12px por encima del siguiente**, el toggle de 52px— y esa jerarquía es intencional: se distingue de un input común **antes de leerlo**. El número de contrato es el **alto**.
- Composición interna: prefijo `$` **20px mono `--muted`**, `shrink-0`, 8px de separación, y la cifra ocupando el resto (`flex-1 min-w-0`), alineada a la izquierda contra el prefijo. Tipografía, color, borde y estados: §7.

**Otras reglas de la escala:**

- **16px es el piso tipográfico de todo campo de texto, y es funcional, no estético.** Por debajo de 16px el navegador **hace zoom al enfocar** el campo: la pantalla salta, el layout se corre y el usuario pierde el contexto. El texto de campo sube de 15 → **16px** en esta superficie.
- **Labels y textos de apoyo no cambian** (12.5px/600 `--ink-2` el label, 12px `--expense-ink` el error): el label no es un blanco de toque y agrandarlo solo robaría alto.
- **Sin estados hover.** El vocabulario visible es **reposo · presionado · foco · deshabilitado**. El estado presionado usa el mismo escalón que el `active` del DS (`--panel-3` en superficies neutras, `--accent-press` en el primario). El **focus ring de 3px `--accent-soft` se conserva** (teclado externo y accesibilidad).
- **Los `Select` conservan su chevron y su geometría del DS**: la primitiva es la misma, solo cambian su padding y su tipografía por composición. El glifo no se reubica ni se recorta.

### 5. Cabecera A — chrome de la sesión (identidad + cierre)

**Identidad y cierre de sesión son una sola unidad conceptual: quién sos / cómo dejás de serlo.** No son navegación y su tratamiento visual lo tiene que dejar obvio.

**Chip de sesión (siempre visible, sin acción del usuario).** A la izquierda de la fila, alineado al inicio, `max-w-full`:

- **Avatar** — círculo 30px con el gradiente de acento y la inicial del email, **idéntico al del `UserMenu`** de la app (`linear-gradient(140deg, oklch(0.7 0.1 264), oklch(0.55 0.13 304))`, texto blanco 12.5px/700).
- **Email** — 13px/500 `--ink-2`, `truncate`. **El dato de identidad es el email**, no el nombre: es único, siempre existe, y es lo único que distingue dos cuentas de la misma persona. El truncado corta el final (el dominio), nunca el inicio, que es lo que discrimina.
- **Chevron** `ChevronDown` 14px `--muted`, `shrink-0`, rota 180° al abrir.
- Caja: `rounded-ctl`, `px-2 py-[7px]`, alto total 44px, presionado `bg-panel-2`, foco ring `--accent-soft`. `aria-haspopup="menu"`, `aria-expanded`.

**Popover de cierre de sesión.** Se abre **hacia abajo**, anclado al borde inferior del chip, alineado a su izquierda: panel `bg-panel`, `border border-line`, `rounded-ctl`, `shadow-[var(--shadow-md)]`, ancho `min(240px, calc(100vw - 32px))`, `gap` de 6px con el disparador. Un **único ítem**: `LogOut` 16px `--muted` + **"Cerrar sesión"** 15px/500 `--ink-2`, fila de 48px, presionado `bg-panel-2`. Cierra por toque afuera / `Esc` / re-toque (regla de popovers del DS).

- **Por qué dos pasos y no un botón directo.** El cierre de sesión es **inmediato y sin confirmación** (hereda el comportamiento de la app). Su protección contra el toque accidental **no** es un diálogo: es que vive **detrás de la identidad**, a dos toques deliberados. Un botón de logout suelto en la cabecera se toca sin querer, y un logout accidental a mitad de carga **pierde todo lo tipeado**.
- **Por qué arriba y por qué a la izquierda.** El extremo superior es la zona **más difícil de alcanzar con el pulgar** — exactamente lo que se quiere para la única acción irreversible de la pantalla. Y queda a más de media pantalla de distancia del botón Guardar: **el ítem "Cerrar sesión" y el botón Guardar nunca conviven en la misma mitad vertical.**
- **Esto no es un menú de navegación, y se ve.** Un ítem, en infinitivo, sin destino, sin separadores, sin íconos en fila, anclado a la cara del usuario. **Regla dura de esta superficie: el popover aloja exactamente un ítem.** Agregarle un segundo requiere decisión explícita (RF-APP-003: cerrar sesión es la **única** capacidad además de crear).

**Título accesible.** La superficie declara un `<h1>` **"Nuevo movimiento"** visualmente oculto (`sr-only`): la pantalla no lleva título visible (las tabs ya dicen qué es y el alto es escaso), pero el documento necesita encabezado para lectores de pantalla.

### 6. Cabecera B — barra de tabs (Único / Fijo / Cuotas)

Mismo molde `.dtabs` de la app, **a ancho de columna**:

- Track: `flex gap-1 p-1 rounded-ctl bg-panel-3`, ancho completo de la columna de contenido; los tres segmentos `flex-1` (tercios exactos).
- Segmento activo: `bg-panel text-ink shadow-[var(--shadow-sm)]`; inactivo: `text-muted`. Texto **14px/600** (13.5 en la app), `py-[13px]`.
- `role="tablist"` / `role="tab"` con `aria-selected`, igual que en la app.
- **Pineada:** cambiar de tipo no exige scrollear. Es la decisión que reencuadra todo el form, y en una pantalla donde el 70% del contenido está fuera de vista tiene que estar anclada.
- Cambiar de tab **limpia el formulario** y **devuelve el scroll del cuerpo al tope**.

### 7. Cuerpo — el form, con el Monto de protagonista

El **conjunto de campos**, los defaults y las validaciones son los del modo creación (`screens.md` §5) — compartidos, capa 1. Lo que esta sección fija es la **composición propia**: qué tan grande es cada cosa y en qué orden se lee. Todos los bloques ocupan el **ancho de la columna de contenido** (§1) y respetan el ritmo de §4.

- **Toggle Gasto / Ingreso** — primer bloque, dos segmentos al 50%, `py-[14px]`, 15px/600, con `ArrowDown` / `ArrowUp` 16px. Colores semánticos (`--expense` / `--income` con sus `-soft` / `-ink`): son la única cosa **más grande y más coloreada** que el resto arriba del Monto, porque son la decisión que cambia el signo de todo.
- **Monto — el campo protagonista.** Es el dato por el que existe la pantalla:
  - Cifra en **mono tabular** (`tnum`) **28px/600**, `tracking-[-0.01em]`, color `--ink`. Es la tipografía de dinero más grande del producto después del balance hero — deliberado: en esta superficie el monto es *el* dato.
  - Prefijo `$` **20px `--muted` mono**, `shrink-0`, separado 8px; la cifra toma el resto de la caja (`flex-1 min-w-0`).
  - Caja: **ancho completo de la columna**, alto **64px**, `rounded-ctl`, `border-[1.5px] border-line-strong bg-panel`, `px-[14px] py-[10.5px]`; foco `border-accent` + ring 3px `--accent-soft`; error `border-expense` + ring `--expense-soft`.
  - **`inputMode="decimal"`**: el teclado que aparece es el **numérico con separador decimal**, no el alfanumérico.
  - **El monto en el campo nunca se tiñe** de verde ni de rojo: el color de tipo vive en el toggle de arriba (regla dura 1: el color comunica ingreso/gasto, y ya lo está comunicando el control que lo decide).
  - **20px de aire debajo** (§4): el protagonista no forma fila con los campos que siguen.
- **Categoría** — label + botón de texto **"+ Nueva"** a la derecha de la misma fila (44px de alto, `--accent-ink`), select a 51px debajo.
- **Fecha y Hora** — dos columnas (`grid-cols-2 gap-[14px]`). Si a 16px el control nativo no entra, la grilla cae a **una columna** antes que recortar el control: un date-picker cortado es un dato que no se puede ingresar.
- **Descripción** — campo estándar, 51px.
- **"Más opciones"** — el mismo disclosure colapsado por default, precedido de la hairline y el aire de §4, con su resumen a la derecha (moneda · cotización · método). La fila del disparador es tocable entera, 44px. Expandido, su contenido hereda la escala y el ritmo de §4 — sin excepciones ni densidades intermedias.

### 8. Footer — la acción primaria

- **Un solo control: `Guardar`.** `Button variant=default`, **`w-full` de la columna de contenido** (§1), `h-[52px]`, texto 16px/600, ícono `Check` 16px. Ancho completo de columna porque es la única acción; el cap de 480px evita el extremo opuesto (un botón desmesurado en un viewport ancho y bajo).
- **Alcanzabilidad con el pulgar:** pineado al borde inferior, es el **blanco más fácil de la pantalla**, sobre el eje natural del pulgar en cualquiera de las dos manos. Es la contracara exacta del cierre de sesión (§5), que vive en el vértice más difícil.
- **Estados:** cargando → rótulo **"Guardando…"**, `disabled`, sin spinner (patrón de la app). Deshabilitado también cuando no hay categorías disponibles para el tipo elegido.
- **No hay "Cancelar", y su ausencia no deja hueco:** el botón ocupa el ancho entero de la columna. Cancelar significaría "volver a la pantalla anterior" y esa pantalla no existe.
- **Los toasts no se montan sobre él.** La pila de toasts se ancla **por encima del footer**, no al borde del viewport: el envase publica su alto de footer y el viewport de toasts lo respeta (`--toast-inset-bottom`, default 26px en el resto de la app). Un toast tapando el botón Guardar dejaría la acción primaria inalcanzable justo cuando el usuario quiere cargar el siguiente movimiento.

### 9. Guardado con éxito — confirmación y estado posterior

**Copy exacto** (`toast.success`, sin acción, duración estándar de 5000 ms):

> **Movimiento guardado correctamente.**

- **Es el mismo copy que la app usa al crear un movimiento.** Guardar es la misma acción con el mismo resultado en las dos superficies; darle un mensaje propio obligaría a mantener dos acuses para un solo hecho.
- **Sin acción y sin navegación.** Acá el toast **no lleva "Ir a ver"**: en esta superficie no existe destino al que ir. Es un toast de éxito puro acuse — esa es la única diferencia con el de la app.
- **Sin monto y sin nombre en el copy.** Una cifra en el pill obligaría a mono tabular sin truncado, y a 360px de ancho cualquier dato variable compite por espacio con la frase y termina recortado.
- El tick conserva el mapeo por tipo de toast.

**Qué queda en pantalla después** — la superficie **queda lista para el siguiente movimiento**:

1. El formulario **se resetea al estado inicial de la tab activa**: monto vacío, descripción vacía, tipo de vuelta en **Gasto**, categoría en su default, fecha y hora **recalculadas al momento actual**, "Más opciones" colapsado.
2. La **tab activa no cambia**. Cambiarla sería mover el suelo bajo el usuario; y quien acaba de cargar una cuota es probable que cargue otra.
3. El **scroll del cuerpo vuelve al tope** y el **teclado se cierra** (ningún campo queda enfocado). Con el teclado abierto y el scroll a mitad de camino, el usuario no vería el toast ni sabría si quedó algo cargado.
4. El **foco se mueve al contenedor del formulario** (no a un campo): el lector de pantalla anuncia el comienzo del form y el teclado virtual no se reabre solo.

### 10. Overlays sobre la superficie

Los dos overlays que esta superficie puede montar —**aviso de límite activo** (`ActiveLimitDialog`) y **modal de nueva categoría**— **consumen `ModalShell`**. `ModalShell` es una **primitiva del DS** (capa 2): se comparte tal cual, no se duplica ni se reencarna para esta superficie. La libertad de composición aplica a lo que esta superficie **arma**, no a las primitivas que **consume**.

- **Sin modal debajo, el aviso deja de ser apilado.** En la app el aviso se monta *encima* del modal de movimiento (`stacked`, `z-50`). Acá la superficie de captura **es la base**: el aviso monta su scrim en la capa normal (`z-40`) sobre la superficie completa, que queda oscurecida y bloqueada detrás. Todo lo demás del aviso —variante `dialog`, callout ámbar, enumeración de cruces, copy, jerarquía de botones, foco inicial en "Cancelar", `role="alertdialog"`— **no cambia**.
- **Ancho real en régimen de captura:** en un viewport angosto `max-w-[440px]` no llega a aplicarse y el diálogo ocupa el ancho disponible menos el padding del scrim; en uno ancho y bajo, capea en 440px y se centra. **El padding del scrim respeta las safe areas**: `max(24px, env(safe-area-inset-*))` por lado (en el resto del producto los insets valen 0, así que la regla es inerte ahí). El `max-height` sigue atado al padding por construcción.
- **Botones del diálogo con densidad de esta superficie:** la fila se conserva (Cancelar ghost a la izquierda, "Guardar igual" primario a la derecha), con los dos a `flex-1` y **48px de alto**. Misma composición que en la app; solo crece el blanco.
- **"Cancelar" devuelve a la superficie de captura con el form intacto**, igual que devuelve al modal en la app.
- El **modal de nueva categoría** hereda exactamente lo mismo: `ModalShell`, safe areas en el scrim, escala y ritmo de §4 en sus campos y botones.

### 11. Errores, validación y estados

- **Validación:** mismos casos y mensajes que en la app. Al fallar el submit, el cuerpo **scrollea automáticamente al primer campo con error** y ese campo recibe el foco. En una pantalla donde la mayor parte del form está fuera de vista, un error silencioso arriba del scroll es un callejón.
- **Error del backend:** `toast.error` con el mensaje de la app; el formulario **conserva todo lo ingresado** y permite reintentar. Nada se limpia ante un error.
- **Sin categorías para el tipo elegido:** el bloque de aviso (fondo `--expense-soft`, `AlertTriangle`, texto `--expense-ink`) se conserva, pero **sin el enlace a Configuración → Categorías**: esa pantalla no es alcanzable desde este régimen. El copy en esta superficie es: **"Sin categorías para este tipo. Usá el botón "+ Nueva" de arriba."** — la única salida real, y está a la vista, justo encima.
- **Carga inicial:** la cabecera se pinta **completa desde el primer paint** (la identidad viene de la sesión, no espera a nada). Lo que puede llegar tarde son los datos de los selects: ahí se usa el sistema de skeletons (`skeletons.md`), en el cuerpo.

### 12. Disposición corta — `--bp-short`

**Esta superficie no tiene disposición por ancho:** la columna de contenido de §1 ya resuelve los dos extremos (angosto = fluido, ancho = capea a 480 y se centra). Su **única disposición alternativa es por alto**, porque el alto es lo que el chrome pineado consume y el cuerpo no puede recuperar.

**Umbral nombrado:** `--bp-short` = **480px de alto de viewport**. Es un umbral del **eje vertical**, ortogonal a `--bp-wide` (que es de ancho) y **exclusivo de esta superficie**. Se materializa como token para que el número no se repita.

Por debajo de `--bp-short`:

- **La fila de sesión y la barra de tabs se funden en una sola fila.** El chip de sesión queda a la izquierda (`max-w-[45%]`, el email sigue truncando), la barra de tabs toma el resto (`flex-1`). Se ahorran ~54px de alto sin esconder nada: **la identidad sigue visible sin acción del usuario** y las tabs siguen pineadas.
- **El footer baja a `h-[48px]`** de botón con `padding: 10px`.
- **El cuerpo conserva todo**: mismos campos, mismo orden, misma densidad; simplemente scrollea más. Nada se recorta ni se esconde detrás de un acordeón.
- **Safe areas laterales activas:** con un inset del sistema a un costado, la cabecera, el cuerpo y el footer respetan `env(safe-area-inset-left/right)`.
- Presupuesto de alto a 360px de alto: cabecera 70 + footer 68 → **~222px de cuerpo**, suficiente para 3–4 campos por vista.
- **La fila fundida se alinea a la columna de contenido**, igual que el resto: en un viewport ancho y bajo, identidad y tabs quedan juntas en el centro.

### 13. Acceso (login) en régimen de captura

Una sola columna, centrada, **sin el panel de marca** (`BrandSide`): a este tamaño un panel decorativo se comería la pantalla y empujaría el formulario abajo del pliegue.

- **Envase:** `min-height: 100dvh`, fondo `--paper`, contenido en columna centrada verticalmente cuando entra y **scrolleable cuando no** (viewport bajo). Padding `24px` + safe areas en los cuatro lados. Ancho de la columna: `min(360px, 100% - 48px)`.
- **Marca (arriba, centrada):** el **chip de gem** del DS —contenedor blanco 44×44 `rounded-[13px]` con el ícono 34×34 `rounded-[9px]`— acompañado del wordmark **"Control"** 20px/700 `--ink` debajo. Misma construcción de marca que el login en grande, en su versión compacta.
- **Título:** `<h1>` **"Ingresá a Control"** 24px/700 `--ink`, `tracking-[-0.02em]`, centrado, con 20px de aire respecto de la marca. **Sin eyebrow y sin subtítulo:** el alto es el recurso escaso y ninguno de los dos aporta información que el usuario necesite para entrar.
- **Orden de los controles** (el email + contraseña es el camino principal, RF-APP-004):
  1. **Email** — label + campo 51px (la misma caja de §4: `px-[14px] py-[13px]`, texto 16px), `inputMode="email"`, `autocomplete="email"`.
  2. **Contraseña** — label + campo 51px, `autocomplete="current-password"`.
  3. **"Iniciar sesión"** — primario, `w-full`, `h-[52px]`, 16px/600. Cargando: **"Iniciando sesión…"**, `disabled`.
  4. **Separador** — hairline `--line` de lado a lado con un rótulo centrado sobre fondo `--paper`: **"o"**, 12px `--faint`, uppercase, `tracking-[.08em]`. El rótulo es una sola letra porque acá el camino principal va **primero** (credenciales) y Google es la alternativa.
  5. **Botón de Google** — `w-full`, `h-[52px]`, molde `.gbtn` (panel + `border-line-strong` + gmark 22px). **Siempre presente**; deshabilitado (`opacity-50`, rótulo "Google (no disponible)") si el proveedor no está configurado.
- **Sin enlace a registro.** No se crea cuenta desde este régimen: no hay "¿No tenés cuenta?" ni ninguna otra salida.
- **Fine print** (Términos / Política de privacidad) al pie, 12.5px `--faint`, centrado, `mt-[22px]`. *(Dudoso: contradice "`--faint` no es un color de prosa" de `fundamentos.md`, que manda la letra chica legal a `--muted`.)*
- **Errores:** el bloque de error genérico sobre el formulario (`--expense-soft` / `--expense-ink`, `role="alert"`), con el mismo copy genérico de la app; el email ingresado se conserva.
- Tras entrar, el destino es la **superficie de captura**.

### 14. Invariantes de la superficie

Los cuatro invariantes de contención, leídos en este régimen:

1. **Sin scroll del `body` — ni horizontal ni vertical.** La raíz es `100dvh` + `overflow-hidden`; el único scroll es el del cuerpo. Ningún elemento excede el ancho disponible: los campos son fluidos dentro de la columna, el email trunca y las cifras nunca se recortan.
2. **Overlays completos y escapables:** el aviso de límite y el modal de categoría entran enteros, scrollean adentro si hace falta y siempre ofrecen su salida (Cancelar / ✕).
3. **Ninguna acción inalcanzable:** Guardar está pineado y nunca queda bajo el teclado ni bajo un toast; las tabs y la identidad están pineadas; el primer error se trae a la vista solo.
4. **Las superficies anchas scrollean dentro de sí:** no aplica — en esta superficie no hay tablas ni gráficos. La contención del cuerpo es scroll vertical propio.

Y los específicos de este régimen:

5. **Ninguna puerta fuera de la superficie.** No hay enlaces a `/mes`, `/configuracion`, `/registro` ni a ninguna otra ruta: ni en el form, ni en los estados vacíos, ni en los avisos, ni en el popover de sesión.
6. **Todo control es tocable con el dedo:** ≥44px, con ≥8px de separación.
7. **El cierre de sesión nunca comparte mitad de pantalla con Guardar.**
8. **El contenido nunca se estira:** ningún bloque del cuerpo, la cabecera o el footer supera los 480px de la columna, por ancho de viewport que sobre.

### 15. Agregados más allá del brief — estado

1. **Popover de un solo ítem para el cierre de sesión** (en vez de un botón suelto): preserva los dos pasos que la app ya exige y protege contra el toque accidental. **No agrega capacidad**: el ítem sigue siendo uno solo.
2. **`<h1>` `sr-only` "Nuevo movimiento"**: agregado de accesibilidad, sin superficie visual.
3. **Auto-scroll al primer campo con error**: agregado de flujo, sin elemento nuevo.
4. **Token `--bp-short` (480px de alto)**: umbral justificado en §12 (eje vertical, exclusivo de esta superficie).
5. **Piso tipográfico de 16px en campos de texto**: desviación deliberada del cuerpo de 15px del DS, justificada por el zoom forzado al enfocar (§4).
6. **Safe areas en el padding del scrim de `ModalShell`**: regla global e inerte en régimen de app (los `env()` valen 0), no un caso especial.
7. **Anclaje de la pila de toasts por encima del footer pineado** (`--toast-inset-bottom`): una variable en el sistema de toasts, no un caso especial por pantalla.
8. **Retiro del enlace a Configuración → Categorías** en el bloque de "sin categorías" dentro de esta superficie: es cumplimiento de RF-APP-003 (nada más de la app es alcanzable), no un agregado.
9. **Columna de contenido capeada en 480px** (§1): regla de composición propia, sin elemento ni capacidad nueva.

### 16. Reglas duras reafirmadas

- **Regla 1 (verde = ingreso · rojo = gasto):** los únicos verdes y rojos de la superficie son el toggle Gasto/Ingreso y los estados de error (rojo `--expense`). El campo Monto **no se tiñe** por tipo ni por signo.
- **Regla 2 (índigo solo marca / interacción):** el índigo vive en Guardar, en el avatar, en "+ Nueva" y en el focus ring. **Ninguna cifra es índigo.**
- **Regla 3 (dinero en mono tabular):** el Monto va en mono `tnum` a 28px; la cotización y todo importe del bloque "Más opciones", igual. Ninguna cifra se trunca.
- **Regla 4 (ambos modos de color):** toda la superficie consume tokens semánticos; se ve correcta en claro y en oscuro, incluida la banda de safe area (que pinta con el mismo `--panel` de su zona).

### Checklist de aceptación visual — Superficie de captura

**Tamaños de verificación** (los mismos en cualquier aparato: teléfono, tablet o ventana de escritorio redimensionada):
**A** `375 × 812` (angosto y alto) · **B** `932 × 430` (ancho y bajo) · **C** `1200 × 540` (ancho grande, alto por debajo del umbral) · **D** `599 × 900` (justo por debajo del umbral de ancho) · **E** `600 × 600` (justo en régimen de app).

*Frontera de superficie (es tamaño, no aparato):*
- [ ] En **A, B, C y D**, con sesión activa, cualquier ruta muestra **la superficie de captura**; sin sesión, **el acceso**. Nunca el dashboard, `/mes`, `/reportes`, `/configuracion` ni `/registro`.
- [ ] En **E** (600×600) se muestra **la app completa**, con sidebar y navegación.
- [ ] **Achicar una ventana de escritorio** por debajo de 600px de ancho **o** de alto entra en la superficie de captura; agrandarla vuelve a la app. En los dos sentidos: **sin recarga, sin parpadeo y sin pantalla de bloqueo intermedia**.
- [ ] **En ningún tamaño** aparece un aviso de "agrandá la ventana", una pantalla de bloqueo ni un mensaje de tamaño no soportado.
- [ ] **Rotar** (o invertir ancho y alto) no produce una superficie distinta de la que corresponde al nuevo tamaño, y no parpadea.
- [ ] Al cargar directo en **A**, **no hay flash**: no se ve la app ni por un instante.

*Envase, zonas y columna:*
- [ ] La pantalla **no scrollea como página**: solo scrollea el cuerpo. Cabecera (identidad + tabs) y footer (Guardar) quedan quietos.
- [ ] **Sin scroll horizontal** en ningún estado ni tamaño, con cualquier email largo y cualquier categoría de nombre largo.
- [ ] **Sin scrim, sin panel flotante, sin ✕**: la superficie ocupa la pantalla entera.
- [ ] En **C** (1200px de ancho): el contenido —tabs, campos, Monto y Guardar— **queda capeado en 480px y centrado**; nada se estira de borde a borde. Las **hairlines** de cabecera y footer **sí** corren de borde a borde.
- [ ] En **A** la columna es fluida: los campos llegan al padding lateral, sin banda muerta a los costados.
- [ ] Con la barra del navegador entrando/saliendo, ni el footer ni la cabecera se cortan (**`dvh`**).
- [ ] Con insets del sistema (notch / barra de gestos), **ningún control queda debajo** de ellos, y el fondo de cabecera y footer **llega hasta el borde** físico.

*Teclado:*
- [ ] Al enfocar cualquier campo, **el botón Guardar sigue visible** y tocable por encima del teclado.
- [ ] El campo enfocado **no queda tapado** por la cabecera ni por el footer.
- [ ] Al enfocar un campo de texto **la pantalla no hace zoom** (piso de 16px).
- [ ] Al abrir la superficie **el teclado no aparece solo**.

*Densidad, ritmo y contenido:*
- [ ] Tabs **Único / Fijo / Cuotas** ocupan el ancho de la columna en tres tercios iguales y están **pineadas**.
- [ ] Toggle **Gasto/Ingreso**, campos, selects, checkbox de débito automático, "Más opciones" y "+ Nueva": todos se tocan cómodo (**≥44px**), sin toques fallidos entre vecinos.
- [ ] **Ritmo:** el aire entre bloques de campo es **visiblemente mayor** que el que hay entre un label y su control (16 vs. 6): cada label se lee pegado a su campo, no flotando entre dos.
- [ ] El campo **Monto** ocupa **todo el ancho de la columna**, es el control **más alto** del form (64px, contra 52 del toggle y 51 de los campos de texto: la diferencia se ve a ojo), va en **mono tabular** y abre el **teclado numérico con decimal**.
- [ ] Debajo del Monto hay **más aire** que entre los demás campos.
- [ ] Los **selects** muestran su chevron completo, sin recortes ni desalineación entre label y control, en todos los tamaños.
- [ ] "Más opciones" está precedido por una **hairline** de ancho de columna; expandido, sus campos tienen **la misma altura y el mismo ritmo** que los de arriba.
- [ ] El monto tipeado **no se pinta de verde ni de rojo** al cambiar Gasto/Ingreso.
- [ ] El form está **completo**: los tres tipos, todos los campos y "Más opciones" con moneda, cotización, método de pago y débito automático. **Ningún campo ni acción extra** respecto del modal de creación.

*Coherencia con el modal de escritorio:*
- [ ] Abriendo el mismo form en la app (modal de creación) y en la superficie de captura: **mismos campos, mismos labels, mismos mensajes de error, mismos colores semánticos** y misma familia tipográfica. Solo cambian tamaños, aire y disposición.
- [ ] Tocar la superficie de captura **no altera** el modal de escritorio: chevrons de los selects, alineación label/input y footer del modal quedan **exactamente como estaban**.

*Sesión:*
- [ ] El **email de la cuenta activa se ve al entrar**, sin tocar nada.
- [ ] Tocar el chip abre un popover con **un solo ítem: "Cerrar sesión"**. No hay ningún otro destino en toda la pantalla.
- [ ] El ítem de cierre de sesión queda **lejos del botón Guardar** (mitad superior vs. borde inferior).
- [ ] "Cerrar sesión" lleva al **acceso de esta superficie**, sin diálogo de confirmación.

*Guardar:*
- [ ] **Guardar** es el único botón del footer, a **ancho de columna**, pineado abajo (en **C** no mide más de 480px).
- [ ] Al guardar aparece el toast **"Movimiento guardado correctamente."** — **sin botón "Ir a ver"** ni ninguna otra acción, y **sin tapar el botón Guardar**.
- [ ] Después de guardar: form **limpio**, tab **sin cambiar**, scroll **arriba**, teclado **cerrado**, fecha/hora **recalculadas**.
- [ ] Con un **límite activo cruzado**, aparece el aviso ámbar con "Cancelar" / "Guardar igual" (botones de 48px); "Cancelar" devuelve el form **intacto**.
- [ ] En **C**, el aviso de límite y el modal de nueva categoría **capean en 440px y quedan centrados**, no estirados.
- [ ] Un error de validación **trae el primer campo con error a la vista**; un error del backend **no borra nada** de lo cargado.
- [ ] Sin categorías para el tipo: el aviso ofrece **solo "+ Nueva"** — **no hay enlace a Configuración**.

*Alto por debajo de 480px (`--bp-short`, tamaños B y C):*
- [ ] Identidad y tabs comparten **una sola fila**, ambas visibles; Guardar sigue pineado abajo; el cuerpo scrollea con **todos** los campos, sin recortes ni acordeones nuevos.
- [ ] En **C**, esa fila fundida también queda **dentro de la columna de 480px**, centrada.
- [ ] Con un inset del sistema a un costado, nada queda debajo de él.

*Acceso:*
- [ ] El acceso es **una columna**: marca, "Ingresá a Control", email, contraseña, "Iniciar sesión", separador, botón de Google.
- [ ] **No hay enlace a "Crear cuenta"**; abrir `/registro` en régimen de captura muestra el acceso.
- [ ] Con Google sin configurar, el botón se ve **deshabilitado y rotulado** como no disponible, y el ingreso con email + contraseña funciona igual.
- [ ] En **B** y **C**, la columna del acceso **scrollea** en vez de recortarse, y sigue **centrada** (no estirada) a 1200px de ancho.

*Modo de color:*
- [ ] Toda la superficie (captura y acceso) se ve correcta en **claro y en oscuro**, incluidas las bandas de safe area.
