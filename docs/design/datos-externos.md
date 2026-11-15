# `/configuracion` — Datos externos (inflación IPC + cotizaciones)

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Hub de `/configuracion`: `limites.md` §1.

## Sección "Datos externos" de `/configuracion` — ver y actualizar inflación (IPC) + cotizaciones

> Sección donde el usuario **lee** los datos macro que Control usa para convertir y contextualizar montos (inflación INDEC + cotizaciones dólar/euro/real) y los **actualiza** con una sola acción. **Reutilización total, cero token nuevo:** `.card` de `/configuracion`, la jerarquía de cabecera del hub (`limites.md` §1.b), el botón `RefreshCw` (mismo ícono y spinner que el *Botón de refrescar por reporte*), el sistema de toasts, `SkeletonPill`, el patrón de error inline de la card de Moneda, y las reglas duras de cifra.

### 0. Ubicación estructural — bloque dentro de General

"Datos externos" es un **bloque dentro de la sección General** de `/configuracion`, **debajo** de la card "Moneda por defecto". **No** es una entrada de nav ni una ruta propia; el track del hub sigue con sus cuatro entradas. (`frontend/src/app/(app)/configuracion/settings-client.tsx` monta `<ExternalRatesSection />` como segundo bloque de General; `external-rates-section.tsx`.)

- **Por qué el hub no crece.** Las entradas del track son **superficies de administración** (crear/editar/borrar). Datos externos es **lectura de referencia con una sola acción de refresco**: una ruta hermana prometería un gestor que no hay.
- **La spec es agnóstica a la ubicación**: si algún día se rutea aparte, heredaría el track y el ítem activo.

### 1. Cabecera de sección (nivel 2 del hub) + botón "Actualizar datos"

Fila `flex items-center justify-between gap-5 flex-wrap`, `mb-4`:

- **Izquierda (identidad):**
  - **`h2`** "Datos externos": `text-[18px] font-bold tracking-[-0.01em] text-ink`.
  - **Bajada** (13px/500 `--muted`, `mt-[3px]`): *"Inflación y cotizaciones que Control usa para convertir y ajustar tus montos."*
- **Derecha — botón "Actualizar datos":**
  - **Ubicación:** en par con el `h2`, slot de acción de sección. **Única** acción; refresca **ambos** bloques.
  - **Jerarquía — secundario, no primario.** `Button` **`variant=outline`** `size=default` con **`RefreshCw` 16px a la izquierda + "Actualizar datos"**. El slot lleva primario cuando la acción **crea** algo; acá el foco es **leer** y actualizar es mantenimiento ocasional. `outline` (borde `--line-strong`, fondo `--panel`, hover `--panel-2` + translateY) sin acento — índigo **solo** como focus ring.
  - **Normal:** `RefreshCw` 16px `--ink` estático + "Actualizar datos". Habilitado salvo durante su propio fetch.
  - **"Actualizando…" (loading):** el ícono **rota** (`animate-spin`; `motion-reduce:animate-none`), label **"Actualizando…"**, `disabled` + **`opacity-60`**, sin hover, `aria-busy="true"`. Bajo reduced-motion el cue es atenuación + `disabled`. Se ata al fetch de actualización (no al skeleton de carga inicial).
  - **Post-acción:** vuelve al normal; **el resultado se comunica por TOAST** (§4). Los bloques re-renderizan y el pie (§6) refleja la corrida.
  - **A11y:** `type="button"`, `aria-label="Actualizar datos externos"`, ícono `aria-hidden`.
  - **Responsive:** por el `flex-wrap`, en angosto **envuelve bajo la identidad**, alineado a la izquierda.

Debajo: **dos cards apiladas** (`space-y-4`) — Inflación, luego Cotizaciones — y el **pie discreto** (§6).

### 2. Card "Inflación (IPC)"

`.card` del DS: `rounded-[14px] border border-line bg-panel shadow-[var(--shadow-sm)]`, `padding var(--card-pad)`. Tres bandas separadas por `--hair`: **destacado → historial → ver más**.

**2.a Destacado (último dato).** Fila `flex items-center justify-between gap-6`:
- **Izquierda:**
  - **Eyebrow** "Último dato": `text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint`.
  - **Mes** ej. "Junio 2026": `text-[14.5px] font-semibold text-ink mt-[2px]`.
  - **Sub-rótulo** "Variación mensual": `text-[12.5px] font-medium text-muted mt-[2px]`.
- **Derecha (la cifra):** ej. "1,6%" — `font-mono tnum text-[22px] font-semibold text-ink leading-none`, sufijo `%` incluido. `shrink-0`.
  - **Neutral, jamás semántica:** **`--ink`**, **nunca** verde ni rojo, aunque "más inflación" tenga connotación negativa.
  - **Mono tabular** para alinear con el historial.

**2.b Historial del año en curso.** Bajo un `--hair` (`mt-4 pt-4`), meses del **año en curso**, **más reciente arriba**:
- **Fila:** `flex items-center justify-between`, `py-[10px]`, separadas por `--hair`.
  - **Mes:** "Mayo 2026" `text-[13px] font-medium text-ink-2`.
  - **Variación:** `font-mono tnum text-[13px] font-medium text-ink-2`, sufijo `%`. Neutral.
- **Sin duplicar el destacado:** el historial arranca en el mes anterior al destacado.
- **Jerarquía:** destacado 22px `--ink` vs. lista 13px `--ink-2`.
- **Sin más datos del año:** línea `text-[12.5px] font-medium text-muted` centrada: *"Todavía no hay más datos de {año}."*

**2.c "Ver meses anteriores".** Bajo la lista, separado por `--hair`, control **full-width discreto**:
- **Forma:** botón `w-full` `flex items-center justify-center gap-1.5`, `py-2.5`, `rounded-[var(--r-ctl)]`, `text-[13px] font-semibold text-ink-2`, **`ChevronDown` 14px `--muted`** a la derecha. Reposo sin caja; **hover** `bg-panel-2 text-ink`, 140ms. Focus-visible: `--accent-soft` 3px.
- **Label:** "Ver meses anteriores".
- **Cargando más:** label "Cargando…" + `RefreshCw` 16px `animate-spin` (`motion-reduce:animate-none`) en lugar del chevron; `disabled` + `opacity-60`. Al resolver, los meses se **anexan al final**.
- **Sin más historial:** el botón **se desmonta**.

### 3. Card "Cotizaciones"

`.card` del DS. Los **4 valores del mes actual**: dólar oficial, dólar blue, euro, real.

- **Cabecera de card (opcional, ligera):** "Cotizaciones" `text-[14.5px] font-semibold text-ink` + "Valores del mes en curso." `text-[12.5px] font-medium text-muted mt-[2px]`, `mb-4`.
- **Grilla 2×2 de celdas-valor:** `grid grid-cols-2 gap-3`. Cada celda: `bg-panel-2 border border-line rounded-[var(--r-ctl)] px-3.5 py-3`, `flex flex-col gap-1`, `min-w-0`.
  - **Rótulo:** `text-[12.5px] font-medium text-muted` — orden fijo `Dólar oficial · Dólar blue` (fila 1), `Euro · Real` (fila 2).
  - **Valor:** **mono tabular**: `font-mono tnum text-[16px] font-semibold text-ink`, con `$` (ARS) — ej. `$1.100,00`. **Neutral**.
- **Valor faltante — "—":** la celda conserva caja y rótulo; el valor es **`—`** en `font-mono text-[16px] text-faint`. Sin micro-caption.
- **Responsive:** `grid-cols-2` **se mantiene** hasta el piso (~185px por columna a 392px de contenido).

### 4. Feedback de resultado — por TOAST

- **Éxito con cambios** → `toast.success`: **"Datos actualizados."**
- **Sin novedades** → `toast.info`: **"Ya estás al día. No había datos nuevos."** (`info`, no `success`: no hubo cambio).
- **Error** → `toast.error`: **"No se pudieron actualizar los datos. Intentá de nuevo."**

El mapeo de variante (success / info / error) es estructural. (Señal de documentación: la letra exacta se espeja en `screens.md`.)

### 5. Estados de la sección entera

- **Carga inicial (skeleton).** Cada card con su **fantasma** de `SkeletonPill`, bajo `role="status"` `aria-label="Cargando datos externos"`:
  - **Inflación:** textos estáticos reales; **la cifra** es una `SkeletonPill` ~80×24; historial de **3–4 filas** con dos pills (mes ~90×14 / variación ~44×14). Sin "Ver más".
  - **Cotizaciones:** las 4 celdas con rótulo real y una `SkeletonPill` ~90×18 en el valor.
  - "Actualizar datos" **deshabilitado** durante la carga inicial.
- **Error de carga (inline).** Mismo patrón que la card de Moneda: dentro de la card, `mt-3 text-[13px] text-expense-ink`: *"No se pudieron cargar los datos externos. Recargá la página."* Distinto del error de **actualización** (toast). La card muestra solo ese mensaje.

### 6. Pie discreto — última actualización + fuentes

Debajo de las cards, **línea única**: `text-[12px] font-medium text-muted mt-1`, a la izquierda:

- *"Última actualización: {14 jul 2026, 09:32} · Fuentes: INDEC (inflación) · dolarapi (dólar) · frankfurter (euro, real)."*
- Cromo terciario, sin caja ni ícono. El formato de fecha/hora lo define el front según el locale; la estructura (fecha-hora · fuentes) es la de esta spec.

### 7. Contención responsive (obligatoria)

Umbral `--bp-wide` (941px). **Sin superficie ancha**.

- **Cabecera:** `flex-wrap` → el botón envuelve bajo la identidad.
- **Card Inflación:** filas `justify-between` cortas; "Ver meses anteriores" full-width.
- **Card Cotizaciones:** `grid-cols-2` hasta el piso.
- **Los cuatro invariantes:**
  1. *Sin scroll horizontal:* filas cortas y grilla de 2 columnas angostas a ~392px.
  2. *Modales completos:* la sección no abre modales.
  3. *Ninguna acción inalcanzable:* "Actualizar datos" siempre visible; "Ver meses anteriores" full-width.
  4. *Superficies anchas:* no hay.

### 8. Reglas duras reafirmadas

- **Regla dura 1:** inflación y cotizaciones **neutras** (`--ink` / `--ink-2`). El único rojo es el **error inline** (estado de error).
- **Regla dura 2:** índigo **únicamente** como focus ring.
- **Regla dura 3:** cotizaciones en `font-mono tnum`; variaciones % también, para alinear columnas.

### Checklist de aceptación visual — Datos externos

*Cabecera y botón:*
- [ ] La sección abre con un `h2` "Datos externos" a **18px/700** (mismo nivel que "General"/"Límites") + bajada 13px/500 `--muted`.
- [ ] El botón **"Actualizar datos"** vive a la **derecha** de esa fila, es **secundario** (`outline`: borde neutro, fondo panel, **sin relleno índigo**), con **ícono `RefreshCw` 16px + label**.
- [ ] Al pulsar: el ícono **gira** (`animate-spin`), el label pasa a **"Actualizando…"**, el botón queda atenuado/`disabled`; bajo *reduce-motion* no gira pero **sí** se atenúa.
- [ ] Un solo botón refresca **ambos** bloques; el resultado no se anuncia en el botón sino por **toast**.

*Toasts:*
- [ ] Con cambios → toast **éxito** "Datos actualizados."
- [ ] Sin novedades → toast **info** (no éxito) "Ya estás al día. No había datos nuevos."
- [ ] Falla → toast **error** "No se pudieron actualizar los datos. Intentá de nuevo."

*Card Inflación:*
- [ ] El **destacado** muestra eyebrow "Último dato" + mes (14.5/600 `--ink`) + "Variación mensual", y la variación como **cifra mono tabular ~22px `--ink`** con `%` — **neutra, ni verde ni roja**.
- [ ] El **historial** del año en curso lista mes + variación (13px `--ink-2`, mono tabular en la cifra), más reciente arriba, **sin repetir** el mes del destacado; las filas se separan por hairline.
- [ ] El destacado se lee claramente **por encima** del historial (tamaño 22 vs 13, tono ink vs ink-2).
- [ ] Existe un control **"Ver meses anteriores"** full-width discreto (texto `--ink-2` + `ChevronDown`, hover `panel-2`); al cargar más, muestra spinner y **anexa** meses viejos; cuando no hay más, **desaparece**.
- [ ] Si no hay más datos del año, en vez de lista aparece "Todavía no hay más datos de {año}.".

*Card Cotizaciones:*
- [ ] Grilla **2×2** de celdas recesadas (`panel-2` + borde + `--r-ctl`); rótulos Dólar oficial · Dólar blue · Euro · Real.
- [ ] Cada valor es **mono tabular con `$`** (ej. `$1.100,00`), **neutro `--ink`**, nunca verde/rojo.
- [ ] Un valor faltante muestra **"—"** (`--faint`, mismo cuerpo mono) conservando rótulo y caja; la grilla no se descuadra.
- [ ] A 640px (y ~392px de contenido con sidebar abierto) la grilla **sigue en 2 columnas** sin scroll horizontal.

*Estados de sección y pie:*
- [ ] **Carga inicial:** cada card muestra `SkeletonPill` en lugar de cifras (bajo `role="status"`); el botón "Actualizar datos" queda deshabilitado durante esa carga.
- [ ] **Error de carga:** dentro de la card, texto `--expense-ink` "No se pudieron cargar los datos externos. Recargá la página." (patrón de la card de Moneda) — distinto del toast de error de actualización.
- [ ] **Pie discreto** debajo de las cards: una línea `--muted` 12px con "Última actualización: … · Fuentes: INDEC · dolarapi · frankfurter", con atribución por fuente.

*Reglas duras:*
- [ ] Ninguna cifra (inflación % ni cotizaciones $) usa verde/rojo; el único rojo es el error inline.
- [ ] El índigo aparece **solo** como focus ring (botones y tiles), en ningún relleno ni texto.
- [ ] Cotizaciones y variaciones de inflación van en **mono tabular** (`tnum`).
