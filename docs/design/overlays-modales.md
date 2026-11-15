# Overlays y modales — cierre, posicionamiento, shell

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Pertenece al grupo *Patrones de componentes vigentes*.

### Cierre de overlays — modales vs. popovers

Dos comportamientos de cierre, según el tipo de overlay:

- **Modales / diálogos** (transaction-modal, category-form-modal y los diálogos de confirmación de borrado — transaction / recurring / installment / category): se cierran **únicamente con el botón ✕ y con `Esc`**. El click en el scrim/backdrop **no** cierra. Son superficies que demandan una decisión explícita; no se descartan por click accidental afuera.
- **Popovers** (filtro de categorías, filtro de sección, menú de tipo de reporte): se cierran por **clic fuera / `Esc` / re-clic**. Son auxiliares y livianos; descartarlos al tocar fuera es lo esperado.

#### Posicionamiento de popovers/listbox por portal — flip vertical y comportamiento ante scroll

Todo overlay auxiliar que se monta **por portal a `document.body`** con `position: fixed` anclado a un disparador (los selectores custom tipo listbox — método de pago, categoría de límite, ancla de límite — y los popovers de filtro/menú) comparte **un único contrato de posicionamiento y scroll**. No se resuelve archivo por archivo: la referencia canónica es `reportes/page.tsx` (`calcPosition`) y `card-currency-select.tsx`. Constantes canónicas: **`POPOVER_GAP = 6px`** (separación disparador↔panel) y **`VIEWPORT_MARGIN = 12px`** (respiro mínimo a cualquier borde del viewport).

**1 · Anclaje y flip vertical (nunca fuera del viewport).** El panel se ancla al disparador y **elige lado según el espacio disponible**, no siempre hacia abajo:

- **Preferencia: abajo.** Si el panel entra por debajo (`alto + GAP ≤ espacioAbajo`), va abajo: `top = rect.bottom + GAP`.
- **Flip: arriba.** Si no entra abajo pero sí arriba, se voltea: `top = rect.top − alto − GAP`.
- **No entra en ningún lado:** se elige el lado con más espacio y se **clampea** al `VIEWPORT_MARGIN`; el **`maxHeight` del panel se recorta al espacio disponible** de ese lado (`espacioDisponible − GAP − VIEWPORT_MARGIN`), de modo que la lista **scrollea internamente** en vez de desbordar el viewport. El tope intrínseco (≈260–280px de lista) es la cota superior; el clamp solo lo baja cuando el espacio obliga.
- **Horizontal:** ancho = ancho del disparador (listbox) o su ancho intrínseco (popover); `left`/`right` anclado al disparador y **clampeado** a `[VIEWPORT_MARGIN, viewport − ancho − VIEWPORT_MARGIN]`.
- **Medición en dos pasadas** (estimado antes del paint → alto real tras montar) para que el flip no produzca salto visible. Caso límite: el disparador cerca del borde inferior dentro de un modal alto centrado (`max-h-[calc(100dvh−48px)]`) — sin flip el panel abriría por debajo del viewport y quedaría invisible (la opción existe pero es inalcanzable).

**2 · Scroll EXTERNO al panel (incluye el cuerpo del modal `overflow-y-auto`) → cierra.** El listener de scroll va en **captura** sobre `window` para atrapar también el scroll de contenedores intermedios (el cuerpo del modal). Si el usuario mueve la superficie de fondo, el overlay se descarta en vez de quedar "despegado" de su disparador. Cerrar —no reposicionar-siguiendo— es la regla.

**3 · Scroll INTERNO del panel → NUNCA cierra.** El handler de scroll **debe ignorar los eventos originados dentro del panel** (`if (panelRef.current?.contains(e.target)) return;`). Este guard es obligatorio: sin él, el listener en captura cierra el panel al rodar la rueda sobre la propia lista y la vuelve **imposible de scrollear**.

**4 · Resize → cierra** (mismo criterio que scroll externo; el anclaje quedaría stale).

**5 · Foco e interacción.** Cierra además por **clic fuera / `Esc` / re-clic**. Al cerrar con `Esc`, **el foco vuelve al disparador**. Se conservan los roles y estados ARIA del listbox (`aria-haspopup="listbox"`, `aria-expanded`, `role="listbox"`/`option`, `aria-selected`) y el foco visible del disparador. Ni el color ni la tipografía del panel cambian por esta regla: es puro comportamiento de overlay + su criterio de ubicación.

### Overflow de modales y bloqueo del fondo (contrato de shell)

Regla **transversal a TODOS los modales/diálogos** de la app: transaction-modal, category-form-modal, el modal de método de pago, crear/editar límite, active-limit-dialog y los diálogos de confirmación/borrado. Todos comparten el mismo **contrato de shell** para que se comporten igual cuando el contenido es alto y para que el fondo nunca se mueva. Los diálogos chicos (confirmaciones) casi nunca desbordan, pero **acatan el mismo contrato**.

**Anatomía en tres zonas — header pineado · cuerpo scrolleable · footer pineado.** El diálogo es una **columna flex** con tres regiones:

- **Header (pineado arriba):** la fila de título + botón ✕, y —cuando existen— las tabs `.dtabs`. No scrollea: el título, el cierre y la navegación de tabs están **siempre alcanzables**. `shrink-0`.
- **Cuerpo (única región que scrollea):** el formulario / contenido. Toma el alto sobrante y scrollea internamente cuando desborda (`flex-1`, `min-h-0`, `overflow-y-auto`). Conserva el **padding horizontal del contenido** (`px-[22px]`) como **carril del scrollbar**, para que la barra viva en el gutter y no se monte sobre los inputs.
- **Footer de acciones (pineado abajo):** los botones Guardar/Cancelar (y sus equivalentes) quedan **fijos al borde inferior del diálogo, FUERA de la región de scroll**. `shrink-0`, fondo **opaco `--panel`**. *El footer es **hermano** de la región de scroll, nunca hijo de ella* — un footer dentro del cuerpo scrolleable se va con el scroll y deja la acción primaria fuera de alcance.

> **Por qué footer pineado (no "alcanzable por scroll"):** la acción primaria (Guardar) es el objetivo del modal; no debe exigir scroll para aparecer. Pinearlo da un blanco estable y refuerza el carácter de "decisión explícita" del modal. Pinear también el header mantiene el ✕ y las tabs siempre a mano. El precio —el cuerpo pierde unos px de alto útil— es despreciable frente a botones inalcanzables.

**Max-height del diálogo (contemplando el padding del scrim).** El scrim es `fixed inset-0 flex items-center justify-center p-6` (padding **24px**). El diálogo lleva:

- `max-height: calc(100dvh - 48px)` — **48px = 2 × 24px** de padding del scrim. Se usa **`dvh`**, no `vh`, para respetar la barra dinámica del navegador. Si el padding del scrim cambia, el `calc` lo sigue (siempre `100dvh − 2×padding`).
- Mientras el contenido **cabe**, el diálogo se dimensiona por su contenido y no aparece scroll ni footer "flotando"; el `max-height` solo entra en juego cuando el contenido supera el alto disponible.

**Tratamiento de la scrollbar interna, radios y clipping.**

- El diálogo mantiene **`overflow-hidden` + radio 18px**: la región de scroll queda **clippeada a las esquinas redondeadas**. El header abraza las esquinas superiores, el footer las inferiores.
- **Scrollbar fina y discreta** (la del SO / overlay alcanza; no se especifica scrollbar custom). Vive en el gutter del padding horizontal del cuerpo, sin comerse los inputs.
- **Divisores de corte (señal de "hay más"):** cuando el cuerpo desborda, aparece una **hairline `--hair` 1px** entre header↔cuerpo y entre cuerpo↔footer. Cuando **no** hay overflow, **no** hay divisores: el modal se lee como una sola superficie continua. Se usa **divisor de línea, no fade con `mask`**: un fade sobre un input o un label lo volvería ilegible.

**Bloqueo de scroll del fondo (body lock).**

- Mientras haya **al menos un modal abierto**, el fondo **no scrollea**: rueda del mouse / touch sobre el scrim o sobre el diálogo **no** mueven la página de atrás. El fondo que se desplaza mientras se decide en un modal rompe el punto de referencia del usuario.
- **Sin salto de layout por la scrollbar:** al bloquear, la desaparición de la scrollbar del documento **no debe correr el contenido de fondo** horizontalmente (p. ej. `scrollbar-gutter: stable` en el documento, o compensación equivalente).
- **Apilamiento:** el scrim/diálogo vive en su capa (`z-40`); si un segundo modal o confirmación se abre encima, monta su propio scrim en una capa superior y el body lock **persiste mientras quede algún modal abierto**.

**Animación.** El `animate-modal-pop` corre sobre el diálogo al entrar; la región de scroll **no** anima. Respeta `prefers-reduced-motion`.

#### Shell de modal compartido (`ModalShell`) — pieza única, no convención copiada

El contrato de arriba **no se cumple copiando el mismo markup a mano en cada modal**. Se cumple con **un único componente de shell** —`ModalShell`— que **todos** los modales/diálogos de la app consumen. El modal concreto aporta solo su **contenido** y sus **acciones**; el shell aporta el scrim, el panel, las tres zonas, el `max-height`, el clipping, el body-lock y los divisores de corte. Ningún modal escribe el scrim ni llama `useBodyScrollLock` por su cuenta. **Prohibido el parche por archivo:** todo modal nuevo consume el shell.

**Anatomía canónica que encapsula el shell:**

- **Scrim (portal a `document.body`):** `fixed inset-0 z-40 flex items-center justify-center p-6`; fondo `oklch(0.18 0.02 270 / 0.46)` + `backdropFilter: blur(3px)`. El `p-6` (**24px**) es el que define el `48px` del `calc`: **van atados** (`max-height: calc(100dvh − 2 × padding-del-scrim)`), una sola fuente.
- **Panel:** `w-full bg-panel border border-line overflow-hidden animate-modal-pop max-h-[calc(100dvh-48px)] flex flex-col`; `borderRadius: 18px`; `boxShadow: var(--shadow-lg)`. El `flex flex-col` + `overflow-hidden` es lo que hace que las tres zonas funcionen y que la región de scroll quede clippeada al radio 18px.
- **Zona 1 — Header (`shrink-0`):** `flex items-center justify-between px-[22px] pt-5 pb-4`. Título + ✕. Si el modal tiene tabs (`.dtabs`), viven también acá, pineadas. Nunca scrollea.
- **Zona 2 — Cuerpo (`flex-1 min-h-0 overflow-y-auto`):** **única** región que scrollea. Padding horizontal `px-[22px]` como carril del scrollbar. Ritmo interno según el contenido (`space-y-[14px]` en forms).
- **Zona 3 — Footer (`shrink-0`):** `flex justify-end gap-3 px-[22px] py-4`, **fuera** de la región de scroll, hermano del cuerpo. Fondo **opaco**: `--panel` por defecto; una confirmación puede apoyarlo en `--panel-2` (también opaco) — lo que no se admite es footer translúcido. Divisor superior `border-t border-hair` **cuando** el cuerpo desborda.

**Dos variantes del mismo shell** (difieren en tamaño y densidad, **no** en anatomía ni en el contrato):

- **`dialog` — confirmación / diálogo chico** (borrados, reactivación, `active-limit-dialog`): `max-w-[440px]`, sin tabs, cuerpo corto que casi nunca desborda. **Igual acata** las tres zonas y el `max-height`: cuando el contenido entra, no hay scroll, no hay divisores y el footer se apoya al pie natural.
- **`form` — formulario largo** (`transaction-modal`, `category-form-modal`, método de pago, **crear/editar límite**): `max-w-[460px]`, puede llevar tabs en el header, cuerpo alto que **sí** desborda en viewport chico → el cuerpo scrollea y header+footer quedan pineados.

#### Checklist de aceptación visual — overflow y body-lock de modales

- [ ] **Fondo inmóvil:** con un modal abierto, girar la rueda / hacer scroll sobre el scrim y sobre el diálogo **no mueve la página de atrás**.
- [ ] **Sin salto de layout:** al abrir y al cerrar el modal, el contenido de fondo **no se corre** horizontalmente.
- [ ] **Footer siempre visible:** en el modal de movimiento, pestañas **"Cuotas"** y **"Más opciones"** (las más altas), con el viewport chico: los botones **Guardar/Cancelar** quedan **pineados y visibles** al pie.
- [ ] **Header siempre alcanzable:** título + botón **✕** (y las tabs, cuando hay) **no se van** con el scroll.
- [ ] **Solo scrollea el cuerpo:** al desbordar, scrollea la zona central; header y footer quedan quietos.
- [ ] **Sin corte crudo arriba/abajo:** cuando hay overflow, aparece la **hairline** header↔cuerpo y cuerpo↔footer; cuando cabe, **no** hay esas líneas.
- [ ] **Esquinas limpias:** el contenido que scrollea queda **clippeado al radio 18px**.
- [ ] **Scrollbar en el gutter:** la barra de scroll no se monta sobre inputs ni labels.
- [ ] **Cabe sin scroll → se ve normal:** un modal cuyo contenido entra en pantalla se ve sin scroll, sin líneas de corte y con el footer al pie natural.
- [ ] **Apilamiento correcto:** si se abre una confirmación sobre otro modal, el fondo sigue bloqueado; al cerrar la de arriba el lock persiste hasta cerrar el último modal.
- [ ] **`dvh`, no `vh`:** el panel usa `max-h-[calc(100dvh-48px)]`. En un navegador con barra dinámica, el modal **no** queda cortado por debajo de la barra.
- [ ] **Todos sobre `ModalShell`:** en viewport bajo, **crear límite** (el form más alto) pinea footer y scrollea el cuerpo; los dos **`reactivation-prompt`** (categorías y métodos de pago) respetan el `max-height` y las tres zonas. Ningún modal arma su propio scrim.
