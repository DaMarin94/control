# `/reportes` — movimientos simulados en cards (`income-expense`, `by-category`)

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Vocabulario de lo simulado en `/mes`: `simulacion-categoria.md`. Encuadre de card: `card-grafico.md`. Formas de gráfico y filtros: `graficos.md`. Marcas de límite: `limites.md`, `limites-by-category.md`.

## Movimientos simulados en cards de reporte (`/reportes`) — RF-REP-017

> **Toggle por card** que incorpora los movimientos simulados al **tramo alcanzado por el horizonte** —**desde el mes en curso** hasta el fin del horizonte— de las cards `income-expense` y `by-category`, y **tratamiento de la porción simulada dentro del gráfico**. La regla funcional (qué entra, en qué meses, filtros, persistencia) es canónica en `requirements.md` RF-REP-017.
>
> **No inventa cromo nuevo.** El control reusa el **chip-toggle neutro** de *Filtros … RF-REP-014 §3*; el gráfico reusa el **vocabulario de lo simulado de `/mes`** (`simulacion-categoria.md` §1): **relleno hueco + contorno punteado en el color propio + prefijo `≈` en la cifra**.

### 0. Encuadre — una sola idea, tres geometrías

**El tramo que dibuja la capa es el *tramo alcanzado*, y arranca como mínimo en el MES EN CURSO.** Es la **unión** de los horizontes de las simulaciones activas: cada una se ancla al mes desde el que se la creó, nunca a un mes pasado. Un mes puede recibir el aporte de **algunas** simulaciones y no de otras; la capa es la suma de lo que ese mes tiene. *(Decisión funcional cerrada por el usuario.)*

**El mes en curso es un mes MIXTO:** su parte real es lo ya ocurrido (únicos cargados) más fijos y cuotas del mes (RN-006); su parte simulada es el **remanente** de cada simulación activa —lo que falta para llegar a lo proyectado—, la misma cifra de la fila simulada de `/mes`.

**Lo simulado se apila encima de lo real, hueco y punteado.** En las tres geometrías:

1. **La parte real se dibuja idéntica a como se dibuja sin el toggle** — mismo color, relleno, trazo y orden. El toggle **no recolorea nada de lo real**.
2. **El aporte simulado es una capa apilada por encima**, con el **mismo color** que le corresponde (semántico en `income-expense`, `category.color` en `by-category`), **relleno bajado** (hueco) y **trazo punteado**.
3. **El borde entre las dos capas es el total real; el borde exterior es el total con simulados.** La distancia entre ambos *es* el aporte.

Es lo que `/mes` hace con la fila simulada, trasladado a una banda del stack. *(Consistencia.)*

**El mes en curso NO lleva tratamiento propio:**

- **El eje real ↔ simulado SÍ se mantiene dentro del mes en curso** (real sólido abajo, aporte hueco y punteado encima).
- **El eje "mes en curso" ↔ "resto del tramo" NO se dibuja.** Sin sombreado, sin marcador "hoy" en el eje X, sin otro punteado ni otra opacidad.

**Por qué:** (1) consistencia con `/mes`, donde la fila simulada del mes en curso es idéntica a la de un mes posterior (alternativas descartadas por el usuario, `simulacion-categoria.md` §1 y §9); (2) carga cognitiva (sería un quinto significado en el canvas); (3) no es accionable; (4) el carril del eje X lo ocupa el **cartucho de mes** de las marcas de límite (`limites-by-category.md` §2).

**La frontera de lo real queda en el último mes cerrado (`A−1`):** el punto donde el contorno punteado se despega del sólido es el borde entre "ya pasó entero" y "se está formando". **No se refuerza con nada** (sin línea vertical, dot ni etiqueta).

**Alcance de la capa:** **no es un indicador de completitud del mes**. Cubre solo las categorías con simulación activa: el tope punteado del mes en curso es *"lo real a la fecha + el remanente de lo simulado"*, **no** *"el total proyectado del mes"*. Marcar la parcialidad del mes en curso con el toggle apagado sería una feature aparte (§5).

**Por qué apilar arriba y no intercalar por categoría** (`[real cat1][sim cat1][real cat2]…`): intercalar desplaza verticalmente los segmentos reales y **rompe la comparación mes a mes de lo real**. Con el bloque simulado **al tope**, la composición real queda idéntica a la del toggle apagado (salvo el reescalado del eje Y), y aparece un borde con significado (el total real). La pertenencia la sostiene el **color** (RN-013) y el **mismo orden** dentro del bloque simulado.

**Por qué punteado y no rayado:** el hatch no existe en este DS (exigiría un `pattern` SVG por categoría); el punteado **ya es el idioma de lo simulado**.

### 1. El toggle — chip "Simulados" en el cluster de cómputo

#### 1.1 Forma — chip-toggle neutro con glifo (molde de los chips de Tipo)

`<button type="button">` con **`aria-pressed`**. Caja del chip-toggle de *Filtros … RF-REP-014 §3*: `inline-flex items-center gap-[6px]`, `px-[10px] py-[5px]`, radio `--r-chip` 7px, UI **12.5px / 600**, `select-none`, transición 0.14s.

- **Contenido:** `[ChartSpline 13px] Simulados`. **El mismo `ChartSpline`** que `/mes` usa para señalar que un subtotal incluye simulados (`simulacion-categoria.md` §5). `aria-hidden="true"`.
  - **Por qué lleva glifo:** en `income-expense` queda al lado de "Fijos / Cuotas / Únicos"; sin diferenciador se leería como **un cuarto tipo de movimiento**. Glifo + divisor `--hair` lo declaran **otra dimensión**.
- **Etiqueta:** **"Simulados"**. No "Simulación" (config de `/mes`) ni "Proyección" (proyección de fijos, RF-REP-015).
- **Encendido (`aria-pressed="true"`):** `--panel` + borde `1px --line-strong` + `--shadow-sm`, texto `--ink`, glifo `--ink-2`.
- **Apagado (default):** `--panel-2`, borde `1px --line`, **sin sombra**, texto y glifo `--muted`.
- **Hover (sobre apagado):** texto → `--ink-2`, borde → `--line-strong`. **(sobre encendido):** sin cambio. **Active:** `--panel-3`.
- **Focus:** ring `--accent-soft` 3px (`focus-visible`), radio `--r-chip`.
- **a11y:** `aria-label="Incluir movimientos simulados"` + `aria-pressed`.
- **Sin color semántico, ámbar ni índigo** en ningún estado. Lo simulado **no tiene hue propio** en ninguna superficie: su señal es la forma.

> **El chip encendido es la única declaración permanente de que la card incluye simulados.** Sin aviso textual de composición (decisión funcional cerrada, RF-REP-017); por eso el estado encendido debe leerse a la primera.

#### 1.2 Ubicación exacta — última pieza del cluster izquierdo de la línea 2

Control de **alcance del cómputo**: **cluster izquierdo de la línea 2**. **Nunca** en el cluster derecho (nav + utilidad).

- **`income-expense`:** `[ Dirección (segmented) ] |hair| [ Fijos ][ Cuotas ][ Únicos ] |hair| [ ⌁ Simulados ]`
- **`by-category`:** `[ Barra | Línea (ViewTabs) ] |hair| [ ⌁ Simulados ]`

- **Divisor:** mini-divisor vertical (`h-[16px] w-px bg-hair shrink-0`, `self-center`).
- **Va último:** se toca menos y es el primero en envolver en angosto (§4).
- **`by-category` — el chip vive FUERA del `role="tablist"`** (no recibe flechas; el underline nunca se extiende bajo él). Alineado al centro del texto de las tabs; la fila 2 conserva `items-start`.
- **Solo en `/reportes`.** El **Dashboard nunca monta el chip**. En **modo orden** no se renderiza.
- **`unique-grid`, `installment-gantt`, `fixed-evolution` e `inflation-vs-income` no lo exponen.**

#### 1.3 Deshabilitado con motivo — `aria-disabled`, no `disabled`

El chip está **siempre presente**. Se deshabilita en dos casos (RF-REP-017), con motivo **a demanda**:

- **Visual:** `opacity-45`, `cursor-default`, **sin hover**, click sin efecto (mismo tratamiento que los chevrones del `YearStepper` y el `[+]` en modo orden). **No cambia la etiqueta ni el glifo.**
- **Mecanismo — `aria-disabled="true"`, sin `disabled` nativo:** un `<button disabled>` no dispara `title` ni recibe foco, y el motivo quedaría inalcanzable.
- **Portador del motivo:** `title` nativo + `aria-describedby`. Sin tooltip estilizado nuevo.
- **Las dos causas:**
  1. **No hay ninguna simulación creada.**
  2. **El año no tiene ni un mes alcanzado por el horizonte** — condición: **`year < currentYear`**, y nada más. El año en curso siempre tiene al menos un mes simulable (el actual, incluido diciembre); los años futuros están habilitados.
- **Copys:**
  - Sin ninguna simulación: **"No tenés ninguna simulación. Se crean desde la sección Únicos de la vista del mes."**
  - Año pasado (`year < currentYear`): **"{Año} ya pasó. Las simulaciones no alcanzan meses pasados."** (enuncia la causa del deshabilitado, válida para todas las simulaciones).
    - *Descartados:* "{Año} no tiene meses futuros." (nombra un corte que no es el vigente); "…solo alcanza desde este mes en adelante." (cada simulación arranca en su propio mes); "{Año} ya pasó. Cada simulación arranca en el mes en que la creaste." (irrelevante a la pregunta); "{Año} no tiene meses simulables." (sin la regla); "La simulación no alcanza años pasados." (pierde el `{Año}`).
  - **Precedencia si aplican las dos:** gana **"No tenés ninguna simulación…"** (causa de fondo).
- **El valor persistido no se toca.** Deshabilitado con valor "encendido" se muestra **apagado visual** y **recupera el estado elevado** al volver a un año alcanzado.

#### 1.4 Jerarquía dentro de la cabecera

**Dirección / tabs Barra-Línea** → **Tipo** (chips) → **Simulados** (chip, último). Nunca segmented, borde de acento ni sombra mayor que `--shadow-sm`. El `YearStepper` sigue siendo la pieza dominante.

#### 1.5 Feedback al accionar

- **Sin skeleton** (refetch sobre dato presente, `skeletons.md`). El chip cambia **en el acto**; el canvas al llegar la respuesta.
- **La señal de "trayendo datos":** el botón de refrescar de la card gira y se atenúa (`isFetching`). **Sin spinner propio en el chip.**
- **Sin toast.**
- **Error:** estado de error de la card ("No se pudo cargar el gráfico." + Reintentar). El chip conserva su valor.

### 2. La capa simulada dentro del gráfico

**El punteado marca el límite de lo simulado, y se dibuja donde la geometría ya tiene un borde.** Forma 1 y modo Línea **duplican su contorno en punteado**; el modo Barra da a la porción simulada **su propio contorno punteado** en el color de su categoría.

#### 2.1 `income-expense` (Forma 1 — áreas superpuestas)

Siguen siendo **dos áreas independientes**, cada una desde cero. **Cada dirección es un stack de dos capas**:

| Capa | Relleno | Trazo |
|---|---|---|
| **Real** (base) | el gradiente vigente de su serie (`--income` / `--expense`, 0.18 → 0.02) — **sin cambios** | 2px **sólido**, `--income` / `--expense`, opacidad 1 — **sin cambios** |
| **Aporte simulado** (encima) | **plano a 0.10** del color de la serie (hueco: por debajo del pico del gradiente real, nunca pesa más que lo real) | 2px **punteado `5 4`**, mismo color y opacidad que el trazo real |

- **Lectura:** en el tramo alcanzado el trazo **sólido** queda en el nivel real y el **punteado** se despega por encima. La cuña es el aporte.
- **El mes en curso se dibuja igual que los demás** del tramo: vértice sólido = real a la fecha (+ fijos y cuotas); vértice punteado = + remanente.
- **La divergencia arranca en el segmento `A−1 → A`** (curva `monotone`). **Sin corte forzado**, sin trazo vertical, dot ni etiqueta.
- **El punteado se autoanula donde no hay aporte:** las dos capas coinciden y el sólido rellena los huecos del punteado → **una línea sólida**. Sin "doble trazo" ni línea agrisada en meses pasados. Incluye el mes en curso con remanente cero (correcto, no bug).
- **Un simulado que resulta ingreso** apila sobre ingresos; gasto, sobre gastos (RN-019).
- **Con la Dirección en "solo gastos" / "solo ingresos"** solo se dibuja el stack de esa dirección.
- **Dots:** ocultos en reposo; el `activeDot` se ancla en el vértice del **contorno con simulados**.

#### 2.2 `by-category` — modo Barra (Forma 2, barras apiladas)

El stack de cada mes tiene **dos bloques**, desde la base:

```
[ real: cat1 · cat2 · … · catN ]   ← idéntico al toggle apagado, mismo orden mayor→menor
[ simulado: cat1 · cat2 · … · catN ]  ← mismo orden, solo las que aportan
```

- **Bloque real:** sin cambios — `category.color` sólido, separadores 1px `stroke="var(--panel)"`, orden por gasto anual DESC.
- **Bloque simulado — cada banda:** `category.color` a **opacidad 0.30** + **contorno punteado `4 3`, 1.5px, en `category.color`** en todo su perímetro (ese contorno **es** el separador; sin `--panel` 1px).
  - El **borde inferior** del bloque simulado marca el **total real**; el **tope**, el **total con simulados**.
  - **El color no se reasigna nunca** (RN-013): cambian relleno y contorno, jamás el hue.
- **La barra del mes en curso** lleva su bloque simulado como cualquier otra del tramo (real a la fecha + remanente). **Sin distintivo.**
  - **Frontera con `A−1` limpia:** el mes anterior es 100% real y **no tiene bloque simulado** (la banda no existe).
  - **Trade-off aceptado:** la barra del mes en curso puede verse más alta que la de `A−1`; el desambiguador es el borde punteado (total real) vs. el tope.
- **Meses sin aporte de una categoría: la banda no existe** (dato **ausente**, no `0`), incluido el mes en curso con remanente cero o invertido.
- **Una simulación que resulta ingreso no aporta banda** y su ausencia no se señala.
- **Redondeo de la esquina superior:** regla vigente (la última serie del stack); cantos rectos sigue siendo aceptable.
- **Ancho de barra, `barCategoryGap`, eje X:** sin cambios.

#### 2.3 `by-category` — modo Línea (stack de áreas)

El modo Línea **ya tiene un contorno con semántica** (la firma del gasto), así que el punteado va **ahí**, no en cada banda.

| Serie | Relleno | Trazo |
|---|---|---|
| Áreas **reales** intermedias | `category.color` a **0.55** — sin cambios | `--panel` 1px — sin cambios |
| Área **real** del tope | `category.color` a **0.55** — sin cambios | **`--expense` 2px sólido** — sin cambios. **Es la firma del gasto real.** |
| Áreas **simuladas** intermedias | `category.color` a **0.18** (hueca) | `--panel` 1px (mismo separador que en el bloque real) |
| Área **simulada** del tope | `category.color` a **0.18** | **`--expense` 2px punteado `5 4`.** Es la firma del gasto **con simulados**. |

- **Lectura:** línea roja **sólida** (gasto real) y, en el tramo alcanzado, línea roja **punteada** (con simulados); entre las dos, la cuña subdividida por categoría en bandas huecas. Misma lectura que la Forma 1.
- **El mes en curso** sin distintivo; las líneas se separan desde el vértice de `A−1`.
- **Se autoanula igual** donde no hay aporte.
- **Las bandas simuladas intermedias NO llevan punteado propio** (en un área apilada las bandas de altura cero siguen existiendo y el punteado ensuciaría el contorno rojo).
- **Dots de hover:** `activeDot` solo en la serie tope (la simulada).

#### 2.4 Tooltip — la cifra lleva `≈`, la estructura no cambia

El tooltip conserva su anatomía (encabezado mes+año, una fila por serie/categoría con valor > 0, monto en **mono tabular**, "Total gastos" en `--expense-ink` en `by-category`). **Sin fila de desglose real/simulado ni "incluye N simulados".**

- **Único cambio:** cuando la cifra de una fila **incluye aporte simulado**, lleva el **prefijo `≈`**, pegado y **dentro del mismo span mono**. Mismo prefijo que la fila simulada de `/mes`.
  - Aplica a la fila de la serie (Forma 1), a la fila de la categoría que aporta (`by-category`) y a **"Total gastos"** cuando incluye simulados.
- **Ninguna cifra cambia de color, peso ni opacidad** por incluir simulados.
- **El mes en curso sigue la misma regla:** con aporte, `≈`; sin aporte, nada. Sin aclaración de "mes en curso" ni de parcialidad.
- **En meses sin aporte el tooltip es carácter por carácter el del toggle apagado** (sin `≈`).

#### 2.5 Lo que NO cambia (y no se puede agregar sin decisión)

- **La leyenda no gana ítems.** Una categoría solo simulada entra al universo del filtro con el toggle encendido (RF-REP-017) como **una categoría más**, sin distintivo.
- **Ni el tramo alcanzado ni el mes en curso se sombrean.** Sin banda de fondo, gridline especial, etiqueta "futuro", marcador "hoy" ni tick destacado. El carril del eje X queda para el **cartucho de mes** de las marcas de límite.
- **El eje Y reescala** si el total con simulados supera el máximo real. La composición del bloque real no cambia.
- **Sin animación propia.** La capa entra con el *grow* del canvas (~0.4s ease-out) y respeta `prefers-reduced-motion` (`isAnimationActive={false}`). Sin morph al prender/apagar.
- **El overlay "Sin movimientos en {año}."** no aparece en un año cuyo único dato son simulados con el toggle encendido: el vacío se evalúa sobre **el dato que la card muestra**.

### 3. Convivencia con las marcas pasivas de límite

Con el toggle encendido, las marcas evalúan el valor **con** simulados (RF-REP-017). Se reparten propiedades **ortogonales**:

| Dimensión | Propiedad que la porta | Valores |
|---|---|---|
| **Real vs. simulado** | **relleno** (sólido ↔ hueco) + **patrón del trazo** (continuo ↔ punteado) | nunca introduce un hue nuevo |
| **Límite cruzado** | **color del trazo / marcador ámbar** (`--warning`) | nunca cambia el patrón del trazo ni el relleno |

- **Lo simulado nunca es ámbar. El límite nunca puntea.** *Ámbar = "cruzó un umbral"*; *punteado y hueco = "esto es estimado"*.
- **Forma 1 — `income-expense` (`reporte.ie.*`):** el **`dot` ámbar** (`r=4`, `fill --warning`, `stroke --panel` 1.5px) — o el `ring` si es el `effect` —, anclado en el vértice del **contorno con simulados**.
- **`by-category` — marca de una categoría (`reporte.cat.gastoMesCategoria`), Barra:** **contorno ámbar** sobre la celda de esa banda. Sobre una banda **simulada**: `--warning` 2px **manteniendo el punteado** (`4 3`) y el relleno hueco. Sobre una **real**: `--warning` 2px **sólido**. En **Línea**, anillo ámbar en el vértice del borde superior.
- **`by-category` — marca del total del mes (`reporte.cat.gastoMesTotal`): NO cuelga de ninguna banda.** Su portador es el **cartucho del mes** en el carril del eje X (`limites-by-category.md`). La capa simulada de la última categoría solo lleva su propia marca.
- **Portador de a11y:** el **tooltip del chart** enumera los límites cruzados (`warningNote`), y su cifra lleva `≈` si incluye simulados.
- **El mes en curso entra al juego de las marcas:** puede cruzar un límite **por su remanente simulado**. Visualmente no requiere nada nuevo (*la marca evalúa el dato que la card muestra*, RF-REP-017).
- **Cero-impacto del subsistema de límites intacto:** con `limits: []` no se monta ninguna marca.

### 4. Contención responsive (obligatoria)

Umbral `--bp-wide` **941px**, sobre el **ancho de contenido** (`<main>`). Todo el régimen de app (`≥ 600px` en ambos ejes).

- **El chip envuelve, no comprime.** Línea 2 y cluster izquierdo son `flex flex-wrap`; el chip es **el primero en bajar**.
- **El divisor `--hair` viaja con el chip:** subgrupo que envuelve como unidad (`shrink-0`); nunca un divisor colgando ni un chip huérfano.
- **El chip no tiene ancho mínimo propio** más allá de su contenido (≈105px) y **no fuerza ancho al canvas**. El eje Y conserva `width` 64px.
- **Canvas en compacto:** **220px**. Si una banda simulada queda por debajo de ~3px de alto, el portador pasa a ser el **tooltip** (cifra con `≈`). Degradación declarada: **nunca** se compensa engordando el trazo ni tiñendo la banda.
- **Alto de toque:** el chip mide ~27px (molde de todo el cromo de cabecera de card); se acepta por consistencia.
- **Los cuatro invariantes:**
  1. *Sin scroll horizontal del `body`:* el chip envuelve con su divisor; canvas `ResponsiveContainer` al 100%. A **392px de contenido** la línea 2 queda en varios renglones sin desbordar.
  2. *Modales completos:* sin modal ni overlay nuevo.
  3. *Ninguna acción inalcanzable:* el chip siempre entra al envolver. **Deshabilitado sigue siendo enfocable** (`aria-disabled`).
  4. *Superficies anchas:* el gráfico escala dentro de la card; la leyenda conserva su scroll interno.
- **Checkpoints obligatorios del QA:** `640px` sidebar cerrado, `640px` sidebar abierto (392px de contenido), `941px` cerrado, `1288px` cerrado.

### 5. Agregados más allá del brief — estado

- **Prefijo `≈` en la cifra del tooltip (§2.4)** — vigente; agregado de diseño (portador no-color; vocabulario ya vigente; no es aviso de composición).
- **Copys del motivo del chip deshabilitado (§1.3)** — vigentes; la condición por año (`year < currentYear`) y su copy están **aprobados por el usuario**.
- **Marca de parcialidad del mes en curso — EVALUADA y NO se agrega.** El mes en curso se dibuja sin señal de que es parcial también con el toggle apagado; marcarlo es una **oportunidad separada** fuera de RF-REP-017 (rompería el cero-impacto; el carril del eje X lo ocupa el cartucho de límites; el brief no lo pidió).
- **Nada más se agrega:** sin leyenda de "simulado", banda de "futuro", marcador "hoy", badge en la cabecera ni entrada nueva en el tooltip.
- **Decisión cerrada por el usuario — el tramo arranca en el mes en curso** (igual que en `/mes`): el chip habilitado en el año en curso (incluso en diciembre) siempre tiene al menos un mes que dibujar. Vocabulario: **"tramo alcanzado"** (no "tramo futuro"). Con el chip apagado, la card es idéntica a sin la feature.

### 6. Reglas duras reafirmadas

- **Regla dura 1:** en `income-expense` la capa simulada usa **el color semántico de su propia dirección**. En `by-category` las bandas van por `category.color` y el rojo aparece **solo** en el contorno del stack (Línea) y en "Total gastos" del tooltip. **Lo simulado no tiene color propio.**
- **Regla dura 2:** sin índigo en el canvas; en el chip solo como **focus ring**.
- **Regla dura 3:** cifras en mono + `tnum`; el `≈` **dentro del mismo span mono**. Eje Y en mono abreviado.
- **Regla dura 4:** relleno bajado + punteado del mismo color heredan los tokens de cada modo. Verificar que 0.30 (Barra) / 0.18 (Línea) / 0.10 (Forma 1) se distinga del bloque real en oscuro.
- **Cero-impacto con el toggle apagado:** la card es **idéntica a sin la feature**. La única huella permanente es el propio chip.

### Checklist de aceptación visual — Movimientos simulados en cards de reporte

> Insumo directo del QA visual per-feature (skill `qa-visual`, `.claude/skills/qa-visual/SKILL.md`). Escenario recomendado: usuario con **al menos 2 simulaciones activas** (una que resulte gasto y una que resulte ingreso), parado en el **año en curso**, y una card de cada tipo en `/reportes`. El mes en curso **sí** lleva capa simulada: si una card deja el mes en curso sin punteado teniendo aporte, es **falla**.

*El control:*
- [ ] En `income-expense` la línea 2 muestra, en el cluster izquierdo y **en este orden**: segmented de Dirección · divisor `--hair` · chips **Fijos/Cuotas/Únicos** · divisor `--hair` · chip **"Simulados"** con glifo. El chip es **el último**.
- [ ] En `by-category` la línea 2 muestra: tabs **Barra | Línea** · divisor `--hair` · chip **"Simulados"**. El **underline de la tab activa no se extiende bajo el chip**, y `Tab`/flechas dentro de las tabs **no** enfocan el chip (está fuera del `tablist`).
- [ ] El chip por defecto está **apagado**: plano (`--panel-2`, borde `--line`, **sin sombra**), texto y glifo `--muted`, `aria-pressed="false"`.
- [ ] Encendido: **elevado** (`--panel`, borde `--line-strong`, `--shadow-sm`), texto `--ink`, `aria-pressed="true"`.
- [ ] Focus por teclado: ring `--accent-soft` 3px. El chip **no** usa verde, rojo, ámbar ni índigo en ningún estado (salvo el ring).
- [ ] **Dashboard:** el widget `income-expense` **no** tiene chip de Simulados en ninguna parte de su cabecera.
- [ ] **Modo orden** ("Ordenar reportes"): las cards colapsan a mini y **no hay chip** en ningún mini.
- [ ] Las cards `unique-grid` ("Gastos Únicos"), `installment-gantt` ("Gastos en Cuotas"), `fixed-evolution` ("Detalle histórico de fijos") e `inflation-income` ("Inflación vs Ingresos") **no** exponen el chip.

*Deshabilitado con motivo:*
- [ ] Con **cero simulaciones**: el chip está presente (nunca oculto), atenuado (`opacity-45`), cursor por defecto, sin hover, y su `title`/`aria-describedby` dice **"No tenés ninguna simulación. Se crean desde la sección Únicos de la vista del mes."**
- [ ] Navegando a un **año pasado** (con simulaciones existentes): el chip se atenúa y el motivo es **"{Año} ya pasó. Las simulaciones no alcanzan meses pasados."** — **en ningún lado aparecen los copys "no tiene meses futuros" ni "solo alcanza desde este mes en adelante"**.
- [ ] **El año en curso NUNCA se deshabilita por el año** (habiendo ≥1 simulación): el chip está **activo y accionable** parado en el año en curso, **incluso en diciembre** (verificable moviendo el reloj del sistema a diciembre, o revisando que la condición sea solo `year < currentYear`).
- [ ] Un **año futuro** con simulaciones sigue **habilitado**.
- [ ] El chip deshabilitado **recibe foco con `Tab`** (no tiene el atributo `disabled`) y el motivo se anuncia; clickearlo **no hace nada**.
- [ ] Con las dos causas simultáneas gana el copy de **"No tenés ninguna simulación…"**.
- [ ] Con el toggle **encendido**, navegar a un **año pasado** atenúa el chip; **volver al año en curso lo devuelve encendido** (el valor persistido no se perdió).
- [ ] Recargar la página conserva el estado del chip **por card** (dos cards del mismo tipo pueden estar una encendida y otra apagada).

*Cero-impacto con el toggle apagado:*
- [ ] Con el chip apagado, el canvas de ambas cards es **idéntico** al de sin la feature: mismas series, mismos trazos sólidos, **ninguna línea punteada** en ningún mes.
- [ ] El tooltip de cualquier mes **no muestra `≈`** en ninguna cifra.

*`income-expense` con el toggle encendido:*
- [ ] En los **meses pasados** (incluido `A−1`, el último mes cerrado) se ve **una sola línea sólida** por serie: sin doble trazo, sin tramo agrisado, sin punteado visible.
- [ ] **El MES EN CURSO lleva capa simulada:** con una simulación activa cuyo remanente del mes es ≠ 0, el trazo **punteado** ya está **despegado** del sólido **en el mes en curso**, no recién en el siguiente.
- [ ] **El punto de separación es `A−1`:** las dos capas comparten el vértice del **último mes cerrado** y se despegan progresivamente hacia el mes en curso, **sin trazo vertical de arranque, sin dot y sin etiqueta** en ese punto.
- [ ] **El mes en curso no tiene ningún cromo propio:** comparado contra un mes posterior con aporte, usa el **mismo** `dasharray`, el mismo grosor, el mismo color y el mismo relleno. **No hay** banda de fondo, marcador "hoy", tick destacado ni opacidad distinta en ninguna parte del canvas.
- [ ] Si el remanente del mes en curso da **cero o invertido** (p. ej. cargando únicos reales hasta pasar lo proyectado), ese mes vuelve a mostrar **una sola línea sólida** — es correcto, no una falla.
- [ ] En el resto del **tramo alcanzado** con aporte: el trazo **sólido** se queda en el nivel real y un trazo **punteado (`5 4`, 2px, mismo color)** corre por encima; entre ambos hay un relleno tenue del color de la serie.
- [ ] Un simulado que resulta **ingreso** levanta la línea **verde**; uno que resulta **gasto**, la **roja**. Ninguna serie cambia de color.
- [ ] Con Dirección = **"Solo gastos"** se ve un único stack (rojo) con su punteado; el verde no aparece.
- [ ] Destildar **"Únicos"** en los chips de Tipo **quita el aporte simulado** (el punteado vuelve a pegarse al sólido).

*`by-category` — modo Barra:*
- [ ] En una barra de mes del **tramo alcanzado** con aporte, la porción simulada está **arriba de todo el bloque real**, con `category.color` **atenuado** y **contorno punteado (`4 3`, 1.5px) del mismo color de su categoría**.
- [ ] **La barra del MES EN CURSO tiene bloque simulado** cuando hay remanente ≠ 0: su bloque real es el gasto a la fecha y encima va la banda hueca punteada.
- [ ] **La barra del mes en curso es indistinguible en tratamiento de una posterior:** misma opacidad (0.30), mismo `4 3`, mismo grosor de contorno, mismo orden de categorías. **Ningún** distintivo de "mes en curso" en la barra ni en su tick del eje X.
- [ ] **Frontera limpia con `A−1`:** el mes anterior al en curso **no tiene ninguna banda simulada** ni contorno punteado residual, y **no hay marca de transición** entre `A−1` y el mes en curso.
- [ ] El color de la porción simulada es **exactamente el de su categoría** (comparar contra su porción real y contra su swatch en la leyenda): **no se reasigna ni se recolorea**.
- [ ] La composición del **bloque real** de cualquier mes del tramo —**mes en curso incluido**— es la misma con el toggle prendido que apagado; lo único que cambia es la escala del eje Y.
- [ ] En los **meses sin aporte** el tope de la barra queda donde estaría con el toggle apagado: **ninguna banda de altura cero, ningún contorno punteado residual**. Aplica también al **mes en curso** cuando su remanente dio cero o invertido.
- [ ] Una simulación que resulta **ingreso** **no** produce banda en esta card, y su ausencia **no** se señala de ninguna forma.
- [ ] Un mes con aporte y el siguiente sin aporte de la **misma** simulación se ve normal (sin marca de "faltante").

*`by-category` — modo Línea:*
- [ ] Se ven **dos contornos rojos**: uno **sólido** (gasto real) y uno **punteado (`5 4`, 2px)** por encima en el tramo con aporte; entre ambos, bandas huecas con color de categoría.
- [ ] **La separación de los dos contornos rojos arranca en el vértice de `A−1`**, de modo que el **mes en curso ya está entre las dos líneas**. Sin corte forzado ni marcador en el punto de separación.
- [ ] En los meses sin aporte se ve **una sola línea roja sólida** (el punteado coincide y desaparece), y **ningún** trazo punteado de color de categoría ensucia el contorno. Aplica también al mes en curso con remanente cero o invertido.
- [ ] Las bandas simuladas se separan entre sí con el mismo separador `--panel` 1px que las reales.
- [ ] Alternar **Barra ↔ Línea** conserva el estado del chip y del filtro de categorías; el aporte simulado se ve en los dos modos.

*Tooltip:*
- [ ] En un mes **con** aporte, la cifra de la fila afectada (y el **"Total gastos"** si corresponde) lleva **`≈` pegado al número, dentro del mismo span mono**, y la columna de montos **sigue alineada**.
- [ ] **El tooltip del MES EN CURSO lleva `≈`** cuando su cifra incluye remanente simulado, con la **misma anatomía** que el de cualquier otro mes: **sin** renglón, frase ni aclaración de que el mes está en curso o de que la cifra es parcial.
- [ ] En un mes **sin** aporte, el tooltip es **carácter por carácter el del toggle apagado** (sin `≈`).
- [ ] **No hay ninguna fila, renglón, leyenda ni frase de composición** del tipo "incluye N simulados" en la card ni en el tooltip.
- [ ] **Ninguna cifra** cambia de color, peso u opacidad por incluir simulados.
- [ ] La leyenda **no gana un ítem "Simulados"**; una categoría solo simulada aparece como **una categoría más**, sin distintivo.

*Convivencia con límites:*
- [ ] Con un límite cruzado en un mes del tramo alcanzado **con** simulados en `by-category`/Barra: la banda simulada marcada tiene contorno **ámbar Y punteado** a la vez (color del límite + patrón de lo simulado), y **su relleno sigue hueco**. **Verificar el caso en el MES EN CURSO** — y que un límite pasivo de alcance `mes en curso` marque contra el valor **con** simulados.
- [ ] Una banda **real** marcada tiene contorno **ámbar sólido** (sin punteado).
- [ ] En `income-expense`/Línea el `dot` ámbar se apoya sobre el **trazo punteado** (el nivel con simulados), no sobre el sólido.
- [ ] **Nada de lo simulado es ámbar** y **nada del límite es punteado por sí solo**.
- [ ] Con `limits: []` no aparece **ninguna** marca ámbar, con el toggle encendido o apagado.

*Estados y feedback:*
- [ ] Accionar el chip **no** monta skeleton: el canvas se mantiene y se actualiza al llegar el dato; mientras tanto **el botón de refrescar de esa card gira y se atenúa**.
- [ ] Accionar el chip **no** dispara toast.
- [ ] Si el refetch falla, la card muestra su estado de error vigente y el chip conserva su valor.
- [ ] Un año cuyo **único** dato son simulados **no** muestra el overlay "Sin movimientos en {año}." con el toggle encendido.
- [ ] Simulación **pausada**: la card se ve como con el toggle apagado, **sin error y sin señal** de que falta algo.

*Modos y contención:*
- [ ] En **oscuro**, la banda simulada se sigue distinguiendo de la real en las tres geometrías, y los contornos punteados se leen.
- [ ] `prefers-reduced-motion`: prender/apagar el chip actualiza el canvas **sin animación de grow**.
- [ ] A **640px** (sidebar cerrado y abierto): sin **scroll horizontal del `body`**; el chip **y su divisor bajan juntos** de renglón (nunca un divisor colgando al final de una línea); el chip sigue clickeable y enfocable.
- [ ] A **941px** y **1288px** (sidebar cerrado): la cabecera no rompe, el cluster izquierdo mantiene su orden y `CardControls` sigue alineado al tope a la derecha.
