# `/mes` — card de detalle de movimiento (y vista evolución)

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Fila y sublínea: `mes-listado.md`. Variante acotada del gráfico: `historico-fijos.md` §15. Pertenece al grupo *Patrones de componentes vigentes*.

### Card de detalle de movimiento (`/mes`) — apertura, contenido read-only y fila adelgazada

La **fila de `/mes`** (`MovementItemRow`) es un **vistazo** (identidad + monto + un discriminador) y todo el dato secundario se lee en una **card de detalle read-only** que se abre al clickear la fila. La card es **read-only pura**: solo consulta, **no edita nada** ni lleva botón de acción. Editar vive en el **kebab "⋮" de la fila**. La card se abre para "espiar" y se cierra con ✕/Esc/scrim.

#### Forma — modal centrado sobre `ModalShell` (variante `dialog`), NO panel lateral

Modal centrado sobre el **`ModalShell`** (variante `dialog`, `max-w-[440px]`, radio 18px, `--shadow-lg`, scrim con blur, tres zonas header/cuerpo/footer). **Por qué no un side-sheet:** (a) el contenido es una **ficha compacta read-only** (pares rótulo·valor), no una superficie de trabajo persistente; (b) `ModalShell` ya resuelve los cuatro invariantes de contención (`max-h: calc(100dvh − 48px)`, cuerpo scrolleable, footer pineado, body-lock, portal, clipping al radio 18px); (c) consistencia de overlays.

- **Sin estado de carga / vacío / error en la vista detalle:** **no dispara fetch** — renderiza el `MovementItem` que la lista **ya tiene en memoria**. **La vista evolución (RF-VM-009) sí carga** y tiene sus estados, contenidos en su canvas.
- **Ancho:** `max-w-[440px]` en vista detalle; **`max-w-[640px]` en vista evolución**.
- **Cierre (excepción justificada a la regla de modales):** la card es **read-only y auxiliar** — se cierra con **✕, `Esc` Y clic en el scrim** (cierre tipo popover), a diferencia de los modales de decisión. El chrome es de modal, el **cierre** es de popover (`overlays-modales.md` *Cierre de overlays*). **Excepción en la vista evolución:** `Esc` **vuelve a la vista detalle**; ✕ y scrim siguen cerrando.
- **Animación:** `animate-modal-pop` del shell (respeta `prefers-reduced-motion`).

#### Conflicto de invocación — cuerpo abre card, kebab abre menú

La fila tiene **dos zonas de clic**: el **cuerpo** (cols 1–4) abre la card; el **"⋮" (kebab, col 5)** abre su menú de acciones (ver `mes-listado.md` *Ítem anulado y acciones del KebabMenu*).

- **Cuerpo de la fila:** clickeable → abre la card. `role="button"`, `tabIndex=0`, `onKeyDown` con `Enter`/`Espacio`, `aria-label="Ver detalle de {nombre}"`, `cursor-pointer`. El hover `--panel-2` (o el fill de límite) comunica interactividad.
- **Kebab:** `<button>` real; su `onClick`/`onKeyDown` hace **`stopPropagation`** (no abre la card). Cada ítem del menú también corta la propagación. Orden de tab: fila → kebab.
- **A11y (caveat de anidado):** la fila usa `role="button"` sobre un `div` (no `<button>` nativo) y el kebab queda como botón hermano. El mecanismo exacto lo cierra `control-frontend`.
- **Editar vive solo en el kebab.** La card **no** ofrece camino a editar.

#### Qué QUEDA en la fila adelgazada (vistazo)

Grid `40px 1fr auto auto auto`. **Solo** lo glanceable:

- **Col 1:** ícono 40×40 tintado por tipo.
- **Col 2 — nombre + sublínea de identidad:** `[Anulado] [badge de límite] ● Categoría · [Repeat frecuencia] (solo fijos y calculados de origen fijo) · [↳ desde {Origen}] (solo calculados)`. **Zona de estados:** `[glifo de límite]` + `[GitBranch padre]`. Ver `mes-listado.md` *Sublínea del ítem — dos zonas*.
- **Col 3 — un solo discriminador:** fecha `DD Mmm` del único **(solo la fecha; la hora vive en la card)** · `Cuota X/N` de la cuota · **vacía** para el fijo.
- **Col 4 — monto convertido dominante:** mono 15.5px, color por tipo, signo. **Siempre una sola línea** (sin badge de moneda ni segunda línea de valor original). El efecto `bold`/`fill` de límite se conserva.
- **Col 5 — kebab.**
- **Estados en la fila:** badge **"Anulado"** (con `line-through` + `opacity-0.55`) y las **marcas de límite** (badge/glyph/fill).

#### Qué vive solo en la card

Datos que **no** están en la fila (todos en el contrato `MovementItem`): **método de pago** (icono + nombre + tipo) · **badge de moneda + monto original + cotización** (cross-rate) · **débito automático** (glifo `Zap`) · **vigencia del fijo** (`startMonth` + `endMonth: string | null`, "YYYY-MM" exclusivo; null = activo indefinido) · **fórmula completa del calculado** (la fila conserva solo `↳ desde {Origen}`) · **hora exacta** del único (`occurredAt`).

#### Anatomía de la card (read-only)

**Título + ✕ + hero + ficha**, **sin footer ni botón de acción**. Cierra con ✕/Esc/scrim.

**Header (pineado):** `flex items-center justify-between px-[22px] pt-5 pb-4`. **Nombre** del movimiento (rol *Título de diálogo*, 18px/700 `-.01em`, `--ink`, `truncate`) + botón **✕** del DS. Nunca scrollea.

**Cuerpo (única zona scrolleable):** `px-[22px] py-[18px] space-y-[16px]`. De arriba a abajo:

1. **Badge "Anulado"** (solo si `skipped`) — chip neutro (`--panel-3`/`--muted`/`--r-chip`/11px·600·`.04em`), primera línea; el hero va con `line-through`.
2. **Bloque hero del monto** — `flex items-center gap-[14px]`:
   - **Ícono 40×40 tintado** por tipo (idéntico a col 1: continuidad fila↔card).
   - **Cifra convertida** dominante: mono, rol *Stat valor* (**30px/600 `-.02em`**), **color por tipo** (`--ink` gasto / `--income-ink` ingreso — regla del signo), con signo y símbolo de la default. `line-through` si `skipped`. **El tipo NO se rotula en texto** (sí en el bloque de fórmula del calculado, donde el tipo es derivado).
   - Si **cross-rate** (`currency ≠ default`): a la derecha, el **badge de código** de moneda original (chip neutro `--panel-3`/`--muted`/`mono`, ej. `USD`).
3. **Divisor `--hair`** full-width.
4. **Ficha de detalle — pares rótulo·valor.** Fila: `flex flex-wrap items-start justify-between gap-x-[16px] gap-y-[2px]`, ritmo `space-y-[10px]`. **Rótulo** izquierda (rol *Meta*, 12.5px/500, `--muted`). **Valor** derecha (`text-right`, `--ink-2`; cifras, fechas y horas en **mono tabular**). Filas (omitiendo las que no apliquen):
   - **Categoría** — `● category.color` (punto 6px) + `category.name`.
   - **Método de pago** (solo si `paymentMethod ≠ null`) — `PaymentMethodIcon` 14px `--ink-2` + nombre (`--ink-2`) + **chip de tipo neutro** (`Crédito`/`Débito`/`Efectivo`, `--panel-3`/`--muted`/`--r-chip`). Sin método → **se omite**.
     - **Sublínea de días del crédito** (solo si `type === "CREDIT"` **y** al menos uno de `closingDay`/`paymentDay` tiene valor) — **segunda línea muted** bajo el nombre, **alineada a la derecha** (gap `2px`). **`--muted`, 11.5px, mono tabular**. Formato: `Cierre día {closingDay} · Cobro día {paymentDay}`, **orden fijo cierre → cobro**, separador `·`. Con un solo día, **solo ese segmento**. Para Débito/Efectivo **no se renderiza**.
   - **Débito automático** (solo si `autoDebit === true`) — `Zap` 14px `--muted` + **"Sí"**. Se omite si `false`/`null`.
   - **Cross-rate (solo si `currency ≠ default`)** — **"Monto original"** = `formatCurrency(|amountCents|, currency)` (ej. `US$20,00`, mono `--ink-2`, sin signo); **"Cotización"** = `1 {currency} = {símbolo default}{cotización}` (ej. `1 USD = $1.100,00`, mono `--muted`).
   - **Único → "Fecha"** — `formatDate(occurredAt, timezone)` + `·` + `formatTime(occurredAt, timezone)` (ej. `02/06/2026 · 14:30`, mono `--ink-2`).
   - **Fijo → "Frecuencia"** — etiqueta **capitalizada** (ver `fijos-frecuencia.md`).
   - **Fijo → "Vigencia"** — arranque + fin en una línea:
     - `endMonth === null`: **`Desde {formatMonthShort(startMonth)} · activo`** ("activo" en `--muted`).
     - `endMonth` presente: **rango** `{formatMonthShort(startMonth)} – {formatMonthShort(último mes activo)}` con "–". **`endMonth` es exclusivo** → último mes activo = `prevMonth(endMonth)` (ej. `endMonth = "2026-07"` ⇒ `Mar 2024 – Jun 2026`). Si arranque == último mes activo, un solo mes (`Mar 2024`).
   - **Cuota → "Plan de cuotas"** — `Cuota {number} de {total}` + `·` + `desde {formatMonthShort(installment.startMonth)}` (números en mono).
   - **Cuota → "Total del plan"** (fila propia, debajo de "Plan de cuotas"; se omite si `installment.total === 1`) — `|amountCents| × installment.total` en la **moneda original**. Ver `form-movimiento.md` *Total del plan de cuotas*.
5. **Bloque del calculado** (solo si `calculated ≠ null`) — precedido por **divisor `--hair`**:
   - **"Origen"** — caja read-only estilo *form de calculado* (`rounded-ctl border-line bg-panel-2`, glifo por tipo de origen `Repeat`/`Receipt`/`CreditCard` 15px `--accent-ink` + `sourceDescription`; a la derecha su tipo/frecuencia si aplica).
   - **"Fórmula"** — la **expresión legible completa**, **reusando el builder del preview del form de calculado**: expresión en `--muted` mono (ej. `10% de $5.000`) + `=` + **resultado** (mono, color por tipo y signo, ej. `= $500`), más el **badge de tipo derivado** (`Gasto` `--expense-ink/-soft` / `Ingreso` `--income-ink/-soft`). Si `sourceAmountCents === null`, fórmula abstracta (operador + operando + origen) sin la cifra del origen. **Con desfasaje de mes base (`> 0`)**, la celda izquierda apila bajo la expresión `Monto base: {Mmm AAAA}` (11.5px `--muted`, no mono) — ver `form-movimiento.md` *Mes del monto base del calculado*.
6. **Bloque "Calculados" — derivados del origen** (solo si `MovementItem.calculatedChildren.length >= 1` **en el mes**) — precedido por **divisor `--hair`**. **Espejo del bloque "Origen"**: read-only, no clickeable; una **lista** de cajas, una por derivado (`id`, `description`, `type`, `convertedAmountCents` — magnitud; signo derivado del `type`).
   - **Rótulo: "Calculados"** — mismo estilo que "Origen"/"Fórmula" (12.5px/600 `--ink-2` `tracking-[0.01em]`). Sin contador. (Evaluados "Derivados" / "Calculados derivados": más largos y menos concretos.)
   - **Layout — `flex flex-col gap-[7px]`**; cada caja espeja "Origen": `flex items-center gap-2 rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px]`.
     - **Ícono de tipo (izq):** `ArrowUpRight` ingreso (`--income-ink`) / `ArrowDownRight` gasto (`--expense-ink`), 15px, `shrink-0`. Mismo slot que el ícono de "Origen". **Tintado por tipo** (no `--accent-ink`) porque lo que varía y conviene discriminar es gasto/ingreso; uso legítimo de la regla dura 1.
     - **Nombre:** `child.description`, `text-[14px] font-semibold text-ink-2 flex-1 min-w-0 truncate`.
     - **Monto (der.):** `child.convertedAmountCents` en **mono tabular**, color por tipo (gasto `--ink`, ingreso `--income-ink`), con signo (`formatSignedAmount`), `shrink-0 whitespace-nowrap`, ~13.5px/600. (Cada derivado es otro movimiento cuyo monto no aparece en ninguna otra parte de la card.)
   - **Read-only, no clickeable:** sin hover, sin `role="button"`, sin `cursor-pointer`. (Un "saltar al derivado" sería alcance nuevo.)
   - **Sin fórmula por derivado.**
   - **Relación con el bloque del calculado:** mutuamente excluyentes en la práctica; si ambos aplicaran, "Calculados" va **después**. Es el último bloque **de contenido** (debajo solo el acceso del item 7).
7. **Acceso "Ver evolución"** (solo **fijo no calculado**, gasto o ingreso — `origin === "fijo"` y `calculated === null`; nunca en único, cuota, calculado ni simulado, RF-VM-009) — precedido por **divisor `--hair`**, **siempre el último elemento del cuerpo**. Es **navegación interna**: una **fila de navegación "drill-in"**, no un botón de acción.
   - **Anatomía:** `<button type="button">` a **ancho completo**, `flex items-center gap-[10px] min-h-[44px] rounded-ctl border border-line bg-panel px-[13px] py-[10px] text-left`. Izquierda: **`LineChart`** 15px `--ink-2` `shrink-0`. Centro (`flex-1 min-w-0`): **"Ver evolución"** UI **14px/600 `--ink-2`**. Derecha: **`ChevronRight` 16px `--faint`** `shrink-0`.
   - **Por qué esta forma:** caja con borde + chevron = "esto te lleva a otra página", distinta de las cajas read-only (`bg-panel-2`, sin chevron, sin hover). *Descartadas:* botón icónico en el header (poco descubrible), link dentro de "Vigencia" (se confunde con dato, <44px), botón en un footer (leería como acción).
   - **Por qué al final:** "qué es → cuánto → sus datos → sus relaciones → ir a otra vista".
   - **Habilitado (`evolutionAvailable === true`):** **Hover** fondo `--panel-2`, borde `--line-strong`, rótulo `--ink`, chevron `--muted`. **Pressed** `--panel-3`. **Focus** ring `--accent-soft` 3px sobre `--r-ctl`. Transición de color 0.14s.
   - **Deshabilitado (`evolutionAvailable === false`) — grisado con tooltip (decisión del usuario):** misma caja y lugar, `aria-disabled="true"` (**nunca** `disabled` nativo), `opacity-45`, `cursor-default`, sin hover ni pressed, clic sin efecto. `title` + `aria-describedby`: **"Hacen falta al menos dos meses con monto para ver la evolución."** Sigue en el orden de tab.
   - **A11y:** al activarlo, el foco pasa al **select de rango** de la vista evolución.

**Sin footer ni botón de acción.** El acceso "Ver evolución" es navegación dentro del cuerpo, no un footer.

#### Vista evolución (RF-VM-009) — la "segunda página" de la card

La card tiene **dos vistas**: **detalle** (con la que **siempre** abre) y **evolución**. Se nombra como su acceso ("Ver evolución"), no "historial" (que es `/historial`). La vista evolución **reemplaza todo el contenido** del cuerpo por el gráfico del fijo; el **header se conserva idéntico** y la vuelta va **al pie del cuerpo** (decisión del usuario). Es la misma card (mismo modal, scrim, `role="dialog"`), no un segundo modal apilado.

**Header (pineado) — idéntico al de la vista detalle:**
- **Izquierda: el nombre del fijo** — mismo título (18px/700, `--ink`, `truncate`, `flex-1 min-w-0`) y mismo `id` de `aria-labelledby`. La identidad no cambia al pasar de vista.
- **Derecha: ✕** — **cierra la card entera**. **Único control del header**.

**Cuerpo — fila de controles + canvas + volver:**
- **Fila de controles** (`flex items-center justify-end mb-[14px]`): **solo** el **`RangeSelect`** de la variante acotada (`historico-fijos.md` §15) — pill, las 8 opciones estándar, **default `1 año`**, no persistido — **alineado a la derecha** (mismo lugar relativo que en la card de `/reportes`; el borde izquierdo queda libre para bajar del título al canvas).
- **Canvas** — `fixed-evolution` en **variante acotada** (§15): **sin envase de card**, **alto 240px**, una sola línea en Montos y moneda default, destacado permanente, tooltip modo línea sin encabezado. Estados dentro de esos 240px, con los copys de §15.
- **Volver — fila de navegación al pie, espejo del acceso "Ver evolución":** precedida por el **mismo divisor `--hair`** y separación, **siempre el último elemento del cuerpo**, debajo del canvas **en cualquier estado** (el canvas mide 240px en todos: la fila no salta).
  - **Anatomía:** `<button type="button">` a **ancho completo**, la **misma caja** que el acceso. Izquierda: **`ChevronLeft` 16px `--faint`** `shrink-0`. Centro (`flex-1 min-w-0`): **"Volver al detalle"** UI **14px/600 `--ink-2`**. **Sin glifo a la derecha.** Nombre accesible = rótulo visible.
  - **Estados:** hover `--panel-2`, borde `--line-strong`, rótulo `--ink`, chevron `--muted`; pressed `--panel-3`; focus ring `--accent-soft` 3px sobre `--r-ctl`; 0.14s. **Nunca deshabilitado**.
  - **Por qué así:** ida y vuelta son **un par simétrico** — misma caja, mismo lugar, chevron que cambia de lado. "Al detalle" porque "Volver" a secas en un modal puede leerse como cerrar. *(Descartado: link ghost `‹ Volver` sin caja — rompe la simetría y queda <44px.)*
- **Nada más.** Ni hero, ni ficha, ni leyenda, ni nota de recorte, ni moneda.

**Color de la única línea:** el de **la categoría del fijo, re-anclado** (`historico-fijos.md` §3 punto 5). **No** `--income`/`--expense` (el trazo nunca lleva dirección; la repiten la **forma del punto** y el **color por tipo de la cifra del tooltip**). **No** índigo.

**Ancho del panel — se ensancha en la vista evolución.** Detalle: `max-w-[440px]`. Evolución: **`max-w-[640px]`** (con 440 el plot quedaría en ~350px; con 640 el rango por defecto tiene ~45px por mes). 640 no es un token nuevo: es un ancho de panel de esta vista. Sigue siendo `w-full`.

**Transición ida/vuelta — sin animar geometría, con fundido del contenido entrante.**
- Cambio de ancho (440 ↔ 640) y alto **instantáneo** (animar `max-width` con el alto saltando desde `auto` se lee como tironeo).
- **Contenido entrante** con **fade 0 → 1 en 140ms ease-out**; el saliente desaparece sin transición. **Sin slide horizontal**. El header **no** hace fade. "Volver al detalle" aparece con el fundido del cuerpo.
- **No** se re-dispara `animate-modal-pop`.
- **`prefers-reduced-motion`:** instantáneo, sin fade.

**Teclado, foco y cierre:**
- **`Esc` en vista evolución → vuelve al detalle** (no cierra). **`Esc` en detalle → cierra**. Con el listbox del `RangeSelect` abierto, el primer `Esc` **solo cierra el popover** y devuelve el foco al select. Nunca un `Esc` hace dos cosas.
- **✕ y clic en el scrim → cierran la card** desde cualquier vista.
- **Volver al detalle:** la fila al pie y `Esc` hacen lo mismo.
- **Foco:** al entrar a la vista evolución, el foco va al **disparador del select de rango**. Orden de `Tab`: select → (Reintentar, solo en error) → **Volver al detalle** → ✕. Al volver, el foco regresa al **acceso "Ver evolución"**.
- **Reapertura:** cerrar y reabrir **siempre** abre en detalle; entrar de nuevo a evolución arranca en `1 año`.

#### Reglas duras en la vista evolución

- **R1:** el trazo va en el color de la categoría; el verde aparece solo en la cifra del tooltip de un fijo de ingreso (`--income-ink`). Nada se tiñe de rojo/verde por decoración.
- **R2:** índigo solo en focus rings (Volver al detalle, ✕, acceso, select).
- **R3:** eje Y, año bajo los rótulos de enero/borde y cifra del tooltip en **mono `tnum`**. Los rótulos del select son texto UI.

#### Reglas duras en la card

- **R1:** el color de la cifra hero y del resultado del calculado lo da el **tipo**; el punto de categoría usa la paleta de categorías (identidad); el badge de tipo del calculado y el **ícono de tipo + monto de cada derivado** usan income/expense por su significado. Método, moneda, cotización y chips de tipo en **neutros**.
- **R2:** el único índigo es el focus. Ninguna cifra se tiñe de índigo.
- **R3:** hero, monto original, cotización, resultado de fórmula, números de cuota y **monto de cada derivado** en **mono tabular**.

#### Comportamiento en pantalla chica (compacto, `< --bp-wide`, hasta el piso del régimen de app, sidebar abierto o cerrado)

- **Contención del `ModalShell`:** `max-h: calc(100dvh − 48px)`, cuerpo `overflow-y-auto`, header pineado, body-lock, portal, clipping al radio 18px. **Invariante 2** cubierto por el shell.
- **Panel `w-full max-w-[440px]`:** en contenido angosto (392px con sidebar abierto a 640px de viewport) encoge a `viewport − 2×24px`. Las **filas rótulo·valor son `flex-wrap`:** si el valor no entra al lado del rótulo, **envuelve debajo** — el rótulo nunca empuja ni trunca la cifra.
- **Ninguna cifra se trunca (regla dura).** Si en el ancho mínimo una cifra no entra, su bloque **scrollea dentro de sí** (invariante 4); **nunca** desborda el body.
- **Bloque "Calculados":** ícono `shrink-0`, **nombre `truncate min-w-0`** (cede primero), **monto `shrink-0 whitespace-nowrap` mono nunca truncado**. Cajas apiladas; sin scroll horizontal.
- **Acceso "Ver evolución":** ancho completo, `min-h 44px`; rótulo corto que no trunca; glifo y chevron `shrink-0`.
- **Vista evolución (su ancho lo fija el viewport, no el área de contenido):** `w-full max-w-[640px]` dentro del scrim de 24px; en el piso del régimen de app (600px de viewport) mide **552px** y el plot ~460px. El **título trunca** contra el ✕ (`shrink-0`). "Volver al detalle" a ancho completo, `min-h 44px`. La **fila de controles** tiene un solo elemento: el select a la derecha con su rótulo completo, nunca ícono. El **canvas se comprime** (alto fijo 240px); rótulos del eje X en la columna amplia de §2; nunca rota ni scrollea.
  1. **Sin scroll horizontal del `body`:** panel `w-full` acotado al viewport; canvas sin ancho mínimo.
  2. **Overlays completos:** tooltip y listbox del `RangeSelect` portaled a `body`, con flip; modal ≈ 470px en el peor caso: entra en 600px de alto sin scroll.
  3. **Ninguna acción inalcanzable:** ✕, select y **Volver al detalle** visibles sin scroll; si un alto menor obligara a scrollear, la fila queda en el cuerpo scrolleable y `Esc` vuelve igual.
  4. **Superficies anchas:** el canvas se comprime, no scrollea.
- **La fila adelgazada:** col 4 en una sola línea; col 2 (identidad) trunca con `min-w-0`; col 4 nunca trunca; la lista sigue el mecanismo de contención de `/mes`. El clic para abrir la card funciona igual en compacto.

#### Checklist de aceptación visual — card de detalle + fila adelgazada

- [ ] **Fila adelgazada — col 2:** la sublínea **no** muestra método de pago ni el glifo `Zap` de autodébito; quedan `● Categoría`, la frecuencia (fijos) y `↳ desde {Origen}` (calculados). El cluster de estados solo muestra límite y `GitBranch` (padre).
- [ ] **Fila — col 3:** único = fecha `DD Mmm` (sin hora); cuota = `Cuota X/N`; **fijo = vacía** (no dice "desde Mmm AAAA").
- [ ] **Fila — col 4:** una sola línea siempre; sin badge de código de moneda ni segunda línea de valor original (aun en cross-rate).
- [ ] **Apertura por cuerpo:** clic (o `Enter`/`Espacio`) en el cuerpo de la fila abre la card; clic en el **⋮** abre el menú y **no** abre la card.
- [ ] **Cierre:** la card cierra con **✕, `Esc` y clic en el scrim** (a diferencia del modal de edición, que no cierra por clic afuera).
- [ ] **Hero:** ícono 40×40 tintado + cifra convertida grande (mono, color por tipo, signo); en cross-rate aparece el badge `USD` junto a la cifra.
- [ ] **Ficha:** filas Categoría / Método (+chip tipo) / Débito automático ("Sí", solo si aplica) / y las condicionales por tipo con los rótulos correctos.
- [ ] **Método — sublínea de crédito:** para un método **Crédito** con días cargados aparece una **segunda línea muted (11.5px, mono), alineada a la derecha bajo el nombre**, con `Cierre día {n} · Cobro día {n}` (orden cierre → cobro). Con un solo día cargado se muestra solo ese segmento; para **Débito/Efectivo** (o crédito sin días) la sublínea **no aparece**.
- [ ] **Único:** fila "Fecha" muestra **fecha + hora** (`02/06/2026 · 14:30`).
- [ ] **Fijo:** "Frecuencia" capitalizada + "Vigencia" (`Desde Mar 2024 · activo` cuando `endMonth` null; rango `Mar 2024 – Jun 2026` con fin = mes anterior a `endMonth` cuando presente).
- [ ] **Cuota:** "Plan de cuotas" = `Cuota 3 de 12 · desde Mar 2024`, y debajo **"Total del plan"** = `$120.000,00` (mono `--ink-2`, sin signo). Con `total === 1` la fila **no** aparece. En cross-rate el total va en la **moneda original** con su símbolo + chip neutro del código (`USD`), y **no** se convierte.
- [ ] **Calculado:** bloque Origen (caja read-only) + Fórmula legible con resultado y badge de tipo derivado.
- [ ] **Origen de calculados:** si el movimiento es origen de ≥1 derivado **en el mes**, aparece el bloque **"Calculados"** (último bloque, tras la ficha, precedido por `--hair`) con **una caja por derivado**, espejo de "Origen": ícono de tipo tintado (↗ ingreso `--income-ink` / ↘ gasto `--expense-ink`) + nombre truncable + **monto por tipo**. Las cajas son **read-only, no clickeables** (sin hover ni cursor de interacción). Si el movimiento **no** tiene derivados, el bloque **no aparece**.
- [ ] **Derivados — monto:** cada caja muestra `convertedAmountCents` en **mono tabular**, color por tipo (gasto `--ink` / ingreso `--income-ink`), con signo; en compacto el nombre trunca antes y el monto **nunca** se trunca.
- [ ] **Anulado:** badge "Anulado" en la card y hero con `line-through`.
- [ ] **Read-only pura:** la card **no** tiene footer, botón "Editar" ni ninguna acción sobre el movimiento — es solo consulta (el acceso "Ver evolución" de los fijos es navegación interna, no acción); se cierra con ✕/Esc/scrim. Editar se accede desde el kebab "⋮" de la fila, no desde la card.
- [ ] **Reglas duras:** todas las cifras en mono tabular; ningún monto teñido de índigo; color de cifra = tipo.
- [ ] **Compacto (≤940px, hasta 640/392px):** card completa y scrolleable, filas rótulo·valor que envuelven, ninguna cifra truncada, sin scroll horizontal del `body`.

#### Checklist de aceptación visual — vista evolución (RF-VM-009)

> Escenario: un **fijo de gasto mensual** con historia de más de 2 años y un aumento de monto; un **fijo de ingreso** (sueldo); un **fijo bimestral**; un fijo con **un mes anulado**; un fijo **dado de alta este mes** (una sola aparición); un fijo de **alta hace ~6 meses** en un usuario con otros fijos más viejos (meses previos al alta dentro de "1 año"); un **calculado de fijo**; un **único** y una **cuota**. Probar en claro y oscuro.

*Acceso:*
- [ ] En la card de un fijo de **gasto** y de uno de **ingreso** no calculados aparece, como **último elemento del cuerpo** tras un divisor `--hair`, la fila **`[LineChart] Ver evolución … ›`** a ancho completo, con borde y fondo `--panel` (se distingue de las cajas grises read-only de "Origen"/"Calculados").
- [ ] En la card de un **calculado**, un **único**, una **cuota** y un **simulado** la fila **no existe**.
- [ ] Hover: fondo `--panel-2`, borde más marcado; foco con `Tab`: ring `--accent-soft`.
- [ ] En el fijo **dado de alta este mes**, la fila se ve **grisada** (`opacity-45`), sin hover, el clic **no hace nada**, recibe foco con `Tab`, y su `title` dice **"Hacen falta al menos dos meses con monto para ver la evolución."**

*Ida y vuelta:*
- [ ] Activar el acceso **reemplaza todo el cuerpo** (no queda hero, ficha ni bloques) por la fila de controles + el gráfico; el panel **se ensancha** (≈ 640px) de una, sin morph, y el contenido nuevo **aparece con un fundido breve**; sin slide.
- [ ] El header es **idéntico al de la vista detalle**: **el nombre del fijo** a la izquierda y **solo el ✕** a la derecha; **no** hay botón `‹` ni ningún otro control arriba.
- [ ] Al pie del cuerpo, **debajo del gráfico** (en todos sus estados) y tras un divisor `--hair`, está la fila **`‹ Volver al detalle`** a ancho completo: misma caja que "Ver evolución" (borde, fondo `--panel`, ≥44px de alto), chevron a la **izquierda**, sin glifo a la derecha; hover `--panel-2`, foco con ring `--accent-soft`.
- [ ] Al entrar a la vista, el **foco queda en el select de rango**; `Tab` recorre select → (Reintentar en error) → Volver al detalle → ✕.
- [ ] **"Volver al detalle" vuelve** a la vista detalle (panel a 440px, foco en "Ver evolución"). **`Esc` en la vista evolución vuelve** al detalle; **`Esc` en detalle cierra**. Con el listbox del rango abierto, el primer `Esc` **solo lo cierra**.
- [ ] **✕ y clic en el scrim cierran** la card desde la vista evolución.
- [ ] Cerrar y reabrir la card abre **siempre en detalle**; volver a entrar a la vista evolución arranca en **"1 año"** aunque antes se haya elegido otro rango.
- [ ] Con `prefers-reduced-motion`, el cambio de vista es **instantáneo** (sin fundido).

*Contenido de la vista:*
- [ ] Sobre el gráfico hay **una sola fila de controles** con **únicamente** el **select de rango** (pill) **alineado a la derecha**, mostrando **"1 año"**; a su izquierda no hay texto. **No** hay subtítulo, tabs Montos/Variación, chip de ajuste, selector de moneda, refrescar, quitar, título editable, leyenda, contador ni chip de excluidos.
- [ ] El select lista **exactamente las 8 opciones del report** — **`3 meses` · `6 meses` · `9 meses`** | divisor | **`1 año` · `2 años` · `3 años` · `4 años` · `5 años`** — en texto UI (no mono).
- [ ] Con **"1 año"** el eje X tiene **12 posiciones** que terminan en el **mes en curso** (meses corridos, no arranca en enero salvo que el mes en curso sea diciembre); con **"3 meses"** son los 3 últimos meses; cambiar de opción **mueve solo el borde izquierdo**.
- [ ] Con un usuario de historia corta y **"5 años"**, el eje arranca en el primer mes con aparición de **cualquier** fijo del usuario, **sin nota** de recorte, y el disparador sigue diciendo **"5 años"**.
- [ ] El gráfico **no tiene caja propia** (sin borde ni sombra de card dentro del modal) y mide ~240px de alto.
- [ ] Hay **una sola línea**, en el **color de la categoría** del fijo (comparable al `●` de la ficha; a lo sumo un escalón de claridad de diferencia), **no** el color que ese fijo tiene en la card de `/reportes`, **no** verde/rojo/índigo; 2.5px, con **todos sus puntos** de mes visibles en "1 año". Un fijo de categoría **pastel** o **casi negra** se ve nítido en claro y en oscuro.
- [ ] El fijo de **ingreso** dibuja **puntos cuadrados**; el de gasto, **circulares**.
- [ ] El fijo de **alta hace ~6 meses**: los meses del eje **anteriores al alta están vacíos** (sin línea, sin puente, sin cero); la línea arranca con su **terminal anillado**.
- [ ] El fijo con **aumento** muestra el **escalón**; el **bimestral** muestra tramos **atenuados** entre pagos; el **mes anulado** se ve como tramo atenuado.
- [ ] Tooltip: **mes + cifra** (mono; verde en el ingreso, `--ink` en el gasto), **sin** nombre/categoría/frecuencia; en un mes sin punto, el **micro-rótulo del mes arriba** (igual que en un mes con punto) + **`—` + el motivo** ("No corresponde este mes — bimestral.", "Mes anulado.", "Todavía no arrancaba — desde {Mmm AAAA}.").

*Estados:*
- [ ] **Cargando** (al entrar y al cambiar de rango): bloque gris pulsante de ~240px, **sin chips fantasma**; el select sigue operable.
- [ ] **Vacío** (fijo con sus apariciones fuera del rango elegido, p. ej. "3 meses" en un fijo anual): ejes con las posiciones del rango y overlay **"Este fijo no tiene dos meses con monto en el rango."** + **"Alargá el rango para ver su evolución."**; con la opción más larga elegida, **solo la primera línea**.
- [ ] **Error:** `AlertTriangle` ámbar + **"No se pudo cargar la evolución."** + "Reintentar", centrado en el área del gráfico.

*Contención:*
- [ ] **Viewport de 600px** (sidebar abierto y cerrado — el modal no depende del sidebar): panel ~552px, título truncado contra el ✕, select con rótulo completo, fila "Volver al detalle" completa y visible sin scroll, eje X sin superposición con **"5 años"**, sin scroll horizontal del `body`; el modal entra completo en 600px de alto.
- [ ] **941px y 1288px:** panel a 640px, centrado.
- [ ] El tooltip y el listbox del rango se ven **enteros** (flip si hace falta), por encima del modal.
