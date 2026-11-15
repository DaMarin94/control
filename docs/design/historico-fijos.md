# Card "Detalle histórico de fijos" (`fixed-evolution`)

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Encuadre común de card: `card-grafico.md`. Leyenda-filtro, tabs y chips reusados: `graficos.md`. Variante acotada dentro de la card de detalle de `/mes`: `card-detalle.md` (*Vista evolución*). Pertenece al grupo *Patrones de componentes vigentes*.

### Reporte "Detalle histórico de fijos" — gráfico de líneas por fijo (`fixed-evolution`)

> **Nombre: "Detalle histórico de fijos".** La card incluye **fijos de ingreso** junto a los de gasto (RF-REP-013): la dirección de cada línea se distingue por el tratamiento de **§3.1**, y todo copy de la card nombra al **"fijo(s)"**, sin dirección (tabla de copys en §3.1). Además la card tiene una **variante acotada a un solo fijo** que se monta en la vista evolución de la card de detalle de `/mes` (RF-VM-009) — ver **§15** y *Card de detalle de movimiento → Vista evolución*.

Tipo de card de reporte `fixed-evolution`. Misma familia que las otras cards (panel, `--line`, `--r-card` 14px, `--shadow-sm`, `--card-pad` 22px; título editable; `CardControls` a la derecha; canvas 300px en `/reportes` / 220px en `< --bp-wide`; widget autónomo con rango, selección, modo y moneda propios). El canvas es un **gráfico de líneas sobre un rango de meses corridos anclado al presente** (Recharts `LineChart`, eje X = **3 a 60 posiciones**, la última siempre el mes en curso) con **una línea por fijo, de gasto o de ingreso** — sin total, sin suma, sin agregación de ningún tipo (RF-REP-013). **En `/reportes`** y, en su variante acotada (§15), **en la vista evolución de la card de detalle de `/mes`**. Nunca en el dashboard.

Lo que esta card aporta al lenguaje visual: (1) una **clave de color por fijo** (paleta categórica propia `FX`, asignada por `ordinal`, estable entre rangos); (2) el **hueco como dato** (la ausencia no se grafica en cero) resuelto con un **puente atenuado** que sobrevive a cualquier densidad, con su motivo alcanzable; (3) un **eje X de largo variable** con cadencia de rótulos por tramo y **frontera de año marcada**; (4) el **destacado por hover** como respuesta a un canvas de 20–30 líneas; (5) la **leyenda-selector de fijos**, que es el filtro y reemplaza al filtro por categoría, más su **superficie de excluidos**.

> **Reglas duras reafirmadas para esta card.** (1) Conviven **gastos e ingresos** fijos, pero **el trazo nunca se tiñe por dirección**: las líneas **no** van en `--expense` ni en `--income` — el color de la línea es un **identificador de fijo** (paleta `FX`, §3), cuyos hues evitan los arcos del rojo, el verde y el índigo. La dirección la llevan canales que no son el color del trazo (forma del punto, glifo `ArrowUp` en leyenda/tooltip, color por tipo de la cifra de dinero del tooltip — §3.1); donde aparece verde, es **exclusivamente** para decir "ingreso". (2) **Toda cifra** —eje Y de montos, montos del tooltip, ticks y valores % de los modos de variación— va en **IBM Plex Mono `tnum`**; los puntos porcentuales llevan mono por ser cifra pero **nunca** color income/expense por no ser dinero (mismo criterio que *Inflación vs Ingresos*). (3) El **índigo** aparece **solo** como focus ring. (4) Identidad visual en **ambos modos de color**: las claridades de la paleta `FX` se eligen para funcionar en claro y en oscuro (§3).

#### 1. Librería — Recharts `LineChart` (sí, a diferencia de `unique-grid` y del gantt)

Esta card **sí** usa Recharts: es un trazo de series continuas sobre ejes, el mismo motor de *Inflación vs Ingresos* (`LineChart`, `connectNulls`, `activeDot`, `ReferenceLine`, tick custom). Se reusa el andamiaje de `inflation-income-card` (tooltip portaled, tick mono del eje Y), con las líneas **sin animación de dibujado** (`isAnimationActive={false}`, §10).

#### 2. Eje X — el rango de meses corridos, con cadencia de rótulos y frontera de año

El **eje X** es idéntico en los tres modos: **una posición por cada mes corrido del rango visible**, de `startMonth` a `endMonth`, con `endMonth` = **siempre el mes en curso** en el borde derecho. **3 a 60 posiciones**. **Todas las posiciones se dibujan siempre**, las ocupe o no una línea. Sin rotación de rótulos, `axisLine`/`tickLine` ocultos.

**No todas las posiciones se rotulan.** La densidad de rótulos sigue al largo del rango **y al ancho de contenido**:

| Posiciones | Cadencia en amplio (`≥ --bp-wide`) | Cadencia en compacto (`< --bp-wide`) |
|---|---|---|
| **3–6** | cada mes | cada mes |
| **7–12** | cada mes | 1 de cada 2 |
| **13–24** | 1 de cada 2 | 1 de cada 3 |
| **25–36** | 1 de cada 3 | 1 de cada 6 |
| **37–60** | 1 de cada 6 | 1 de cada 12 (solo los eneros) |

- **La cadencia se ancla a enero, no al borde.** Todos los pasos (1, 2, 3, 6, 12) dividen 12, así que los meses rotulados son **siempre los mismos del calendario** y **enero siempre cae rotulado**. (Anclar al borde derecho fue descartado: rótulos en meses arbitrarios.)
- **Dos posiciones llevan rótulo siempre:** la **primera** y la **última** (el mes en curso). Si una queda a **menos de un paso** de un tick de cadencia, se suprime **el de cadencia**, nunca el del borde.
- **Anatomía del rótulo:** mes corto es-AR en **UI 12px/500 `--muted`**. Los rótulos de **enero**, el **primero** y el **último** llevan una **segunda línea con el año** —`2025`— en **mono `tnum` 10.5px `--faint`**, centrada. Ningún otro rótulo lleva año.
- **Frontera de año — una vertical `--hair` por cada enero interior.** `ReferenceLine` vertical, **`--hair` 1px sólida**, en **cada enero del rango salvo el de la posición 0**, **por debajo de las líneas**. Es la **única** vertical del canvas (marca estructural, a lo sumo 4 en 60 meses). Sin enero interior, no se dibuja ninguna.

#### 2.1 Eje Y, gridlines y unidad — cambian con el modo

| Modo | Eje Y | Dominio | Baseline |
|---|---|---|---|
| **Montos** | moneda de display, **mono `tnum`** 11.5px `--muted`, **formato abreviado** (`$0`, `$50k`, `$120k`, `$2,5M`, coma es-AR) — mismo formato del eje Y de la Forma 1 | `[0, dataMax + pad]`; el piso es **cero real** (un calculado puede valer 0, RN-018) | ninguna especial: el cero es el piso del eje |
| **Variación % (nominal o ajustada)** | **puntos porcentuales con signo**, mono `tnum` 11.5px `--muted` (`+10%`, `0%`, `−5%`; menos `U+2212`), 4–6 ticks "lindos" simétricos | `[dataMin − pad, dataMax + pad]`, **cruza el cero** | **baseline `y=0` obligatoria y marcada**: `ReferenceLine` `--line` 1px sólida, un escalón sobre los gridlines; reemplaza al gridline de su altura |

- **La moneda de display incide en los tres modos** (§9). En Montos define la unidad del eje Y; en variación los valores salen de montos ya convertidos.
- **Gridlines:** solo horizontales, `--hair` 1px. **Sin retícula vertical**; las únicas verticales son las fronteras de año de §2.
- **El cambio de unidad no anima:** el eje Y se reescribe de una y las líneas aparecen enteras en la nueva unidad (§10).

#### 3. La clave de color — un color por fijo, de una paleta categórica propia

**El problema:** 20–30 líneas simultáneas y la pregunta **"cómo evolucionó cada fijo"**. Derivar el color de la categoría hace que los fijos de una misma categoría (el caso común) difieran solo en claridad.

**Regla — cada fijo toma un color de la paleta `FX` (12 colores), por su `ordinal`.** El color del trazo es **identificador de fijo**; **no** codifica categoría ni dirección. La categoría se nombra en palabras, con su punto de color de categoría, en el tooltip modo línea (§7B) y en la sublínea de los excluidos (§8.1).

**1. La paleta `FX` — 6 hues × 2 claridades, valores fijos en los dos modos de color.** Los hues quedan a **≥ 35°** del rojo del gasto (hue OKLCH ≈ 30), del verde del ingreso (≈ 160) y del índigo de marca (≈ 281). Las dos claridades (**L 0.70** y **L 0.50**) caen dentro de la **banda de trazo legible L ∈ [0.46, 0.74]** (un trazo de 2px se separa de `--panel` en claro y en oscuro) y están separadas **0.20 L**. Cromas conservadores para caer en gamut sRGB. Se emiten como `oklch()` literal; **no** son tokens de tema.

| Índice | Nombre | Valor | | Índice | Nombre | Valor |
|---|---|---|---|---|---|---|
| **0** | azul profundo | `oklch(0.50 0.11 240)` | | **6** | celeste | `oklch(0.70 0.12 240)` |
| **1** | naranja | `oklch(0.70 0.15 66)` | | **7** | marrón | `oklch(0.50 0.09 66)` |
| **2** | violeta profundo | `oklch(0.50 0.16 320)` | | **8** | lila | `oklch(0.70 0.14 320)` |
| **3** | aguamarina | `oklch(0.70 0.11 205)` | | **9** | petróleo | `oklch(0.50 0.08 205)` |
| **4** | ciruela | `oklch(0.50 0.16 350)` | | **10** | rosa | `oklch(0.70 0.15 350)` |
| **5** | oro | `oklch(0.72 0.13 90)` | | **11** | oliva | `oklch(0.52 0.10 90)` |

- **El orden alterna hue y claridad.** Índices consecutivos nunca comparten hue ni claridad; los dos colores de un mismo hue están a **6 posiciones**.
- **Por qué 12 y no más:** más allá de ~12 colores categóricos en un trazo de 2px empiezan a confundirse; con los arcos reservados excluidos, 6 hues bien separados es el techo honesto.
- **Por qué no la matriz de categorías:** contiene el rojo C1 y el verde C4 (leídos como gasto/ingreso en una card que mezcla direcciones), y sus filas L1/L5 caen fuera de la banda de trazo.

**2. Asignación — `FX[ordinal mod 12]`.** `ordinal` viene del backend, 0-based, computado sobre **todas** las cadenas del usuario (gasto, ingreso y calculados de fijo): el color de un fijo es **estable entre rangos** (cambiar rango, moneda, modo o selección **nunca** le cambia el color). **Nunca** se usa el índice del array `lines`.

**3. Más fijos que colores — se recicla por `ordinal mod 12`.** Límite asumido: el color identifica de un vistazo **dentro de una docena**; por encima, la identidad la cierran el **destacado por hover** (§6), la **leyenda** y el **tooltip**. *(Descartado: asignar por rango entre las líneas visibles — rompe la estabilidad entre rangos.)*

**4. La categoría no va en el trazo — dónde se lee.** Tooltip modo línea (§7B): `● Categoría` en la sublínea del encabezado. Excluidos (§8.1): `● Categoría · desde {Mmm AAAA}`. El `●` es el **punto de categoría del producto** (6px `rounded-full`, `category.color` tal cual, sin re-anclar), el mismo de la sublínea de `/mes` y de la ficha de detalle. El color de categoría aparece **solo** con forma de punto redondo pegado a su nombre; el color de fijo **solo** con forma de trazo / swatch cuadrado / mini-línea: las dos claves nunca comparten forma.

- **Descartados:** (a) color de categoría re-anclado a tres claridades con desempate por `ordinal`; (b) `category.color` tal cual; (c) hue de categoría + claridad por fijo.
- **El swatch de la leyenda es el color de la LÍNEA** (`FX[ordinal mod 12]`).

**5. Excepción — variante acotada (§15): color de categoría re-anclado.** La variante acotada **no** usa `FX`: su única línea va en **el color de su categoría**, calculado desde `category.color` en OKLCH — conserva hue y croma y **sustituye la claridad** por un peldaño de la banda de trazo. Opera sobre **cualquier** hex:

- **Banda de trazo, tres peldaños:** T-claro **L 0.74**, T-medio **L 0.60**, T-oscuro **L 0.46**.
- **Ancla — el peldaño más cercano a la L propia:** **L ≥ 0.67 → T-claro; 0.53 ≤ L < 0.67 → T-medio; L < 0.53 → T-oscuro.** Se conserva el **hue**.
- **Croma — se conserva, con piso `0.07`** para colores con hue definido (croma de origen `≥ 0.015`); los **deliberadamente neutros** (croma `< 0.015`) conservan su croma sin hue inventado. Se emite como `oklch()`.
- **Sin desempate ni escalera:** una sola línea.

**Estilo del trazo:**

| Línea | Stroke | Estilo | Dots en reposo |
|---|---|---|---|
| **Fijo normal** (gasto o ingreso) | **2px**, opacidad 1 | **sólida** | según densidad (§4); **forma del punto según dirección** (§3.1) |
| **Calculado derivado de un fijo** | **2px**, opacidad 1, el color de **su propio `ordinal`** (`FX[ordinal mod 12]`; no hereda el de su origen) | **dasheada `6 4`** | según densidad (§4) |
| **Tramo que cruza un hueco** (cualquiera de las dos, modo Montos) | **2px**, **opacidad 0.35**, mismo color | el de su línea (sólido o dash) | — |

- **Por qué dash para el calculado:** el dash `6 4` ya significa en el DS **"versión derivada/procesada de otra serie"** (*Inflación vs Ingresos*), y **no compite con el color**. *(Descartado: un gris común para todos los calculados — los agruparía entre sí.)*
- **Curva: `linear`. No `monotone`, no `step`.** Un aumento debe leerse como **escalón**: `monotone` inventa valores intermedios; `step` duplica quiebres con 20–30 líneas.
- **Orden de pintado:** el orden canónico de la leyenda (**mayor total del rango visible primero**, sin importar la dirección — §3.1) se pinta **primero**, así las líneas chicas quedan **encima**. La línea **destacada** (§6) se repinta por encima de todas.

#### 3.1 Dirección — ingresos y gastos en el mismo canvas

**Lo cerrado por el usuario:** ingresos y gastos fijos comparten **el mismo eje Y**, ambos como **magnitud positiva**; la dirección se distingue **solo visualmente**; la leyenda es **una sola lista** ordenada por total, **sin agrupar por dirección**.

**El problema de canales.** El trazo tiene cuatro canales tomados: **color** = identidad del fijo, **patrón** dash = calculado, **opacidad** = puente de hueco y contexto de hover, **grosor** = destacado. Descartados: teñir el trazo de `--income`/`--expense` (destruye la clave por fijo); otro dash para ingresos (confunde con el calculado); swatch hueco para ingresos ("hueco" = destildado); separar por dirección (contradice la decisión cerrada).

**Decisión — tres capas, cada una en un canal libre:**

1. **Canvas — la forma del punto dice la dirección.** **Gasto = círculo**; **ingreso = cuadrado**. Aplica a **todos** los puntos que la línea dibuje según §4 y §6, lado del cuadrado = **2 × el radio** del círculo, mismo relleno y anillo `--panel`:

   | Punto (§4 / §6) | Gasto (círculo) | Ingreso (cuadrado, esquinas rectas) |
   |---|---|---|
   | De mes, `slot ≥ 26px` | r 2 | 4×4 |
   | De mes, `slot` 12–26px | r 1.5 | 3×3 |
   | Terminal de vigencia | r 3 + anillo `--panel` 1.5px (r 2.5 / 1px con `slot < 12`) | 6×6 + anillo 1.5px (5×5 / 1px con `slot < 12`) |
   | Aislado | r 2 | 4×4 |
   | Línea destacada (§6) | r 2.5 + anillo 1.5px | 5×5 + anillo 1.5px |
   | `activeDot` | r 4 + borde `--panel` 2px | 8×8 + borde `--panel` 2px |

   - **Por qué la forma:** único canal libre, independiente de color, patrón, opacidad y grosor (un calculado es siempre `EXPENSE`, nunca lleva cuadrados). **Sobrevive a cualquier densidad**: los **terminales de vigencia se dibujan siempre** (§4C).
   - **Esquinas rectas** (sin `rx`): a 3–6px un cuadrado redondeado se lee como círculo.
   - **Límite honesto:** en un canvas denso la forma del punto es señal **de confirmación**; el vistazo lo resuelve la escala y, ante la duda, el **destacado + tooltip** (capa 3).

2. **Leyenda y superficies de lista — glifo `ArrowUp` solo en los ingresos.** En el ítem de leyenda (§8) y en el ítem del popover de excluidos (§8.1), un fijo de ingreso lleva **`ArrowUp` 11px `--income-ink`** (stroke 2.2) **inmediatamente antes de la etiqueta**, después del swatch (`[swatch] [↑] Sueldo`). Los gastos **no llevan glifo**.
   - **Es el glifo con el que el producto ya dice "ingreso"** (ícono de la fila de `/mes` y del hero de la card de detalle).
   - **Marcado asimétrico, deliberado:** se marca la **excepción** (ingreso), igual criterio que `CornerDownRight` para el calculado.
   - **En el ítem destildado** el glifo baja con el conjunto (opacidad 0.7) pero **conserva su color**.
   - Un calculado nunca es ingreso: `↑` y `↳` **nunca** aparecen juntos.
   - **El swatch no cambia** (cuadrado 10px `rounded-[3px]` del color de la línea, para las dos direcciones).

3. **Tooltip — la dirección en palabras y la cifra con color por tipo.**
   - **Modo mes (§7A):** las filas de ingreso llevan **`ArrowUp` 11px `--income-ink`** entre el swatch y la descripción. **En Montos**, la cifra de ingreso va en **`--income-ink`** y la de gasto en **`--ink`** (convención del producto: el color de un monto lo da el TIPO). **En variación** todas las cifras en `--ink`. Filas **ordenadas por valor desc**, mezcladas.
   - **Modo línea (§7B):** en la sublínea del encabezado, tras la categoría, `· ` + **badge de dirección** — **`Ingreso`** (`--income-ink` / `--income-soft`) o **`Gasto`** (`--expense-ink` / `--expense-soft`) — con la anatomía del badge de tipo derivado del bloque *Fórmula* (`--r-chip`, 11px/600, `px-[6px] py-[1px]`). Acá se rotulan **las dos** direcciones. Un calculado muestra `↳ desde {Origen}` y su badge dice `Gasto`. La **cifra dominante** en Montos lleva color por tipo; en variación, `--ink`.

**Orden — una sola lista por total del rango, sin agrupar.** **Total del rango visible (magnitud), descendente**, sin importar la dirección; desempate `chainId` ASC. Es el orden de la leyenda, de pintado (§3) y de las filas del tooltip modo mes.

**Copys que nombran al fijo** — dicen **"fijo(s)"**, sin dirección:

| Superficie | Copy |
|---|---|
| Overlay rango vacío (§10) | **"Sin fijos en el rango."** |
| Overlay sin evolución (§10) | **"Ningún fijo tiene dos apariciones en el rango."** |
| Overlay sin selección (§10) | **"Ningún fijo seleccionado."** |
| Overlay solo calculados con el toggle apagado (§10) | **"En el rango solo hay calculados."** |
| Toggle de calculados (§5.1) | **"Mostrar calculados"** |
| Leyenda `role="group"` (§8) | **"Elegir fijos"** |
| Contador `N / M` (§8) | **"N de M fijos seleccionados"** |
| Disparador de excluidos (§8.1) | **"{N} fijos con una sola aparición en el rango"** |
| Popover de excluidos (§8.1) | `aria-label` **"Fijos sin evolución en el rango"** |
| Menú `[+]` y mini de reorden (§10, §12) | **"Detalle histórico de fijos"** |

**El eje Y no cambia:** magnitud compartida, piso cero, formato abreviado. Sin marca de signo ni de dirección en el eje.

#### 4. Huecos — el puente atenuado los nombra; el punto los confirma cuando hay lugar

**El hueco es dato** (RF-REP-013: la ausencia es hueco, nunca cero) y una línea **puede valer 0 de verdad** (RN-018). El portador de esa distinción **no puede depender de la cantidad de posiciones** (60 meses × 30 líneas = hasta 1800 puntos): el portador principal es **el trazo**; el punto es apoyo.

**A. El puente atenuado — el portador permanente del hueco.** En modo Montos la línea **cruza el hueco sin partirse** (`connectNulls` true), pero el tramo que une los dos flancos se dibuja con **el mismo color y grosor a opacidad 0.35**. Un mes con **0 real** se dibuja con **trazo pleno** bajando al piso del eje: inconfundibles **a cualquier densidad**.

- **Opacidad, no dash:** el puente de un calculado es **dash al 35%**, el de un fijo normal **sólido al 35%**.
- **El puente solo existe en modo Montos.** En variación `connectNulls` es `false`: la línea se corta.
- **Qué tramos cubre:** exactamente de flanco a flanco de cada **hueco interno**. Nunca antes del alta ni después de la baja. El mecanismo lo resuelve `control-frontend`; el resultado visible: **mismo color, mismo grosor, 35% de opacidad, por debajo del trazo pleno**.

**B. Los puntos son densidad-adaptativos.** Umbral por **ancho por posición** (`slot` = ancho del plot ÷ posiciones), medido en vivo:

| `slot` | Puntos de los meses con dato |
|---|---|
| **≥ 26px** | círculo **r 2**, relleno del color, sin borde (el punto de cada mes se lee) |
| **12 – 26px** | **r 1.5** — el punto sigue, más discreto |
| **< 12px** | **sin puntos de mes**: a esa escala se tocarían entre sí y engordarían la línea sin aportar lectura |

**C. Tres puntos que se dibujan SIEMPRE, en cualquier densidad:**

| Punto | Geometría | Por qué es irrenunciable |
|---|---|---|
| **Terminales de vigencia** (primer y último punto con dato de cada línea) | **r 3**, relleno del color, **anillo `--panel` 1.5px** (r 2.5 / anillo 1px con `slot < 12px`) | son "acá empieza / acá termina": el dato de vigencia del fijo |
| **Punto aislado** — mes con dato cuyos **dos meses contiguos no tienen dato** | **r 2**, relleno pleno | sin él, una línea de puntos sueltos (un bimestral en modo Variación, con `connectNulls` false) **no dibujaría nada** |
| **`activeDot`** (mes bajo el cursor) | **r 4**, relleno del color, borde `--panel` 2px | es el foco de inspección |

- **Línea destacada (§6):** recupera **todos** sus puntos de mes (**r 2.5**, anillo `--panel` 1.5px) mientras `slot ≥ 6px`; por debajo quedan solo terminales, aislados y `activeDot`.
- **Excepción del DS, acotada a esta card:** el patrón general (*Gráficos — Forma 1 y Forma 2*: dots "ocultos en reposo") no rige acá; los puntos en reposo existen **mientras haya lugar**.

**Hueco interno vs. extremo:**

- **Hueco interno** (frecuencia > 1, mes anulado, mes en que un calculado resulta `INCOME`): la línea **no se parte** y el tramo va **al 35%**; con `slot ≥ 12px` además se ve el hueco entre dos puntos.
- **Extremo** (antes del alta, después de la baja): la línea **no existe ahí**. Empieza y termina con el punto terminal anillado. Nunca se prolonga en cero ni se dibuja puente.
- **`connectNulls` en variación: `false`.** El hueco significa "no se pudo computar"; **tampoco hay puente atenuado**. Mismo criterio que *Inflación vs Ingresos* §6 (cero ≠ ausencia para una tasa).
- **Nunca se dibuja un cero que no existe.** Excepción explícita a "mes sin datos = cero" de RF-REP-001. Un 0 real **sí** lleva punto, sobre el piso del eje.

**El motivo del hueco es alcanzable** en el **tooltip modo línea** (§7): con una línea destacada, pasar por un mes sin punto muestra la fila de motivo:

| Causa | Copy |
|---|---|
| Frecuencia > 1 | **"No corresponde este mes — {frecuencia}."** (`bimestral`, `cada 5 meses`, `anual` — etiquetas de *Frecuencia del fijo*, columna sublínea) |
| Mes anulado (`RecurringSkip`) | **"Mes anulado."** |
| Antes del alta | **"Todavía no arrancaba — desde {Mmm AAAA}."** |
| Después de la baja | **"Dado de baja — hasta {Mmm AAAA}."** |
| Calculado que ese mes resulta `INCOME` | **"Este mes resultó ingreso."** |
| Variación sin pago anterior | **"Sin variación computable — no hay un pago anterior con el que comparar."** |
| Variación ajustada sin dato de inflación | **"Sin ajuste por inflación — falta el dato de algún mes desde el pago anterior."** |

- **Por qué la fila del ajuste no nombra el mes faltante:** el contrato **no lo identifica** (`adjustedPct: null` y nada más, §14); una inflación parcial no se descuenta y se invalida el tramo entero. Un copy con un mes concreto sería falso.
- **El copy informa, no pide una acción:** el dato de inflación lo publica una fuente externa y se sincroniza solo.
- **Estado parcial y por punto:** el modo **Variación nominal no se ve afectado** (ese mismo mes ahí **sí** dibuja punto y cifra). "Sin ajuste por inflación" mapea contra el chip **"Ajustada por inflación"**.

#### 5. Modo de visualización — dos tabs + un chip modificador (no tres opciones planas)

**"Montos / Variación" con sub-toggle de ajuste**, no tres opciones planas: el ajuste por inflación es un **modificador de la variación** (nunca aplica a montos). Tres tabs planas mentirían sobre la estructura y pondrían dos etiquetas casi idénticas una al lado de la otra. Dos tabs + un chip reusan **dos patrones vigentes**: los `ViewTabs` underline de `by-category` y el chip-toggle neutro de *Tipo de movimiento* / *Simulados*.

**Qué compara la variación.** Cada punto compara ese pago con **el pago anterior de la misma línea**, esté a un mes o a doce. Un **mes anulado no corta la cadena** y el **pago anterior puede quedar fuera del rango visible** y se usa igual. En **Ajustada** se descuenta el **IPC acumulado del tramo** entre los dos pagos. Consecuencia: **un fijo de frecuencia > 1 dibuja puntos en variación** (aislados — §4C), y el vocabulario de los copys es **"pago anterior"**, nunca "mes anterior".

**Forma exacta:**

- **`ViewTabs` "Montos" / "Variación"** — patrón underline neutro (*Toggle Barra ↔ Línea* §1): 13px/600, `py-[6px]`, `gap-[18px]`; activa `--ink` + underline 2px `--ink` deslizante (0.18s; instantáneo con `prefers-reduced-motion`); inactiva `--muted`, hover `--ink-2` + underline `--line-strong`. Default **"Montos"**. `role="tablist"` `aria-label="Modo de visualización"`, tabs con `aria-selected`, canvas como `tabpanel`.
- **Chip "Ajustada por inflación"** — chip-toggle neutro (*Filtros … RF-REP-014* §3): `px-[10px] py-[5px]`, `--r-chip` 7px, 12.5px/600. **Encendido** = elevado (`--panel`, borde `--line-strong`, `--shadow-sm`, `--ink`); **apagado** = plano (`--panel-2`, borde `--line`, sin sombra, `--muted`). `aria-pressed`. **Sin glifo** y **sin color semántico**.
- **En modo Montos el chip NO se oculta: se deshabilita con motivo.** `aria-disabled="true"` (nunca el `disabled` nativo, que dejaría el motivo inalcanzable), `opacity-45`, `cursor-default`, sin hover, click sin efecto; `title` + `aria-describedby`: **"El ajuste por inflación solo aplica a la variación."** Mismo mecanismo que *Movimientos simulados en cards de reporte* §1.3. *(Descartado: ocultarlo — salta el layout y esconde una capacidad.)*
- **El valor persistido del chip no se toca al deshabilitarse:** recupera su estado encendido al volver a Variación.
- **Ubicación:** cluster izquierdo de la **línea 2** de la cabecera (§9), `[ Montos | Variación ] |hair| [ Ajustada por inflación ]`, con el mini-divisor vertical (`h-[16px] w-px bg-hair`, `self-center`). El chip vive **fuera** del `role="tablist"` (no entra al recorrido por flechas; el underline nunca se extiende bajo él).

#### 5.1 Toggle "Mostrar calculados" — chip de alcance, último del cluster izquierdo

Decide si los **calculados de fijo** entran a la card (RF-REP-013). Es un control de **alcance del cómputo**, la misma familia que el chip "Simulados" de `income-expense` / `by-category` (`simulados-en-cards.md` §1): se reusa **ese** molde, no se inventa control.

**Forma — chip-toggle neutro con glifo** (molde de `simulados-en-cards.md` §1.1):

- `<button type="button">` con **`aria-pressed`**. Caja `inline-flex items-center gap-[6px]`, `px-[10px] py-[5px]`, `--r-chip` 7px, UI **12.5px/600**, `select-none`, transición 0.14s.
- **Contenido:** **`CornerDownRight` 13px** (`aria-hidden="true"`) + **"Mostrar calculados"**. El glifo es **el mismo `↳`** con el que la card ya marca al calculado en leyenda, excluidos y tooltip: el chip nombra lo que agrega con la marca que el usuario va a ver aparecer. Además lo separa a ojo del chip "Ajustada por inflación" (sin glifo), que es **otra dimensión** (modo, no alcance).
- **Apagado (default, también sin `fixedShowCalculated` persistido):** `--panel-2`, borde `1px --line`, sin sombra, texto y glifo `--muted`.
- **Encendido:** `--panel`, borde `1px --line-strong`, `--shadow-sm`, texto `--ink`, glifo `--ink-2`.
- **Hover** (sobre apagado): texto → `--ink-2`, borde → `--line-strong`; (sobre encendido) sin cambio. **Active:** `--panel-3`. **Focus:** ring `--accent-soft` 3px, `--r-chip`.
- **a11y:** el nombre accesible es el texto visible ("Mostrar calculados") + `aria-pressed`. Sin `aria-label` extra.
- **Sin color semántico ni índigo** en ningún estado.
- **Nunca se deshabilita.** Cuando no aplica, **no se renderiza** (abajo); no hay estado `aria-disabled` para este chip.

**Ubicación — último del cluster izquierdo de la línea 2 (§9):** `[ Montos | Variación ] |hair| [ Ajustada por inflación ] |hair| [ ↳ Mostrar calculados ]`. Mini-divisor `h-[16px] w-px bg-hair shrink-0`, `self-center`. **Divisor y chip forman un subgrupo** (`inline-flex items-center gap-x-[10px] shrink-0`) que aparece, desaparece y envuelve **como unidad**. *(Descartado: ponerlo en el carril del comando — el carril no existe en el estado "solo calculados" (§10), justo cuando el toggle tiene que estar a la vista; y en la cabecera es consistente con dónde viven los chips de alcance en las otras cards.)*

**Visibilidad — se evalúa sobre lo que trae el rango, no sobre lo que queda tras el toggle.** Se renderiza si `lines` **o** `excluded` traen al menos un ítem con `isCalculated: true`. Si no hay ninguno, el subgrupo (divisor + chip) **no se renderiza** — cero impacto: el cluster queda como hoy. Mientras está oculto, el valor persistido **no se toca** y vuelve a aplicar cuando otro rango trae calculados.

**Feedback al accionar:** el chip cambia **en el acto**; sin skeleton, sin spinner propio, sin toast. Si el cambio implica traer datos, la única señal es la del botón de refrescar (`isFetching`), igual que `simulados-en-cards.md` §1.5. Prender/apagar **agrega o quita** líneas, ítems de leyenda, ítems de excluidos (y el disparador de excluidos si queda vacío / deja de estarlo) y ajusta el contador `N / M`. **Colores y orden relativo de los demás ítems no cambian**; el estado de tilde de cada calculado vuelve como estaba.

**Variante acotada (§15):** **no** lleva el toggle.

#### 6. Destacado por hover — la respuesta al canvas de 30 líneas

La card **nace** con todos los fijos seleccionados. La salida **no** es agrupar (el RF lo prohíbe) ni bajar el default: es **poder aislar una línea sin cambiar la selección**.

- **Qué lo dispara:** puntero sobre una línea o su `activeDot`; puntero sobre su **ítem de leyenda**; **foco de teclado** sobre el ítem de leyenda.
- **Efecto:** la línea destacada pasa a **2.5px, opacidad 1**, **recupera sus puntos de mes** (§4) y **se repinta por encima**. Sus **tramos de puente** siguen atenuados (el 35% sobre la línea destacada). El resto baja a **opacidad 0.18** y **pierde sus puntos**. El ítem de leyenda toma fondo `--panel-2`.
- **Efímero, no toca la selección.** Transición 0.14s sobre opacidad/grosor; **instantánea con `prefers-reduced-motion`**.
- **Aislar de verdad son dos clics con chrome existente:** `LegendAllChip` → **"Ninguna"**, y clic en el fijo. No hay botón "Solo este" ni doble-clic oculto.

#### 7. Tooltip — un solo tooltip, dos contenidos

Caja estándar: portaled a `body`, `--panel`, borde `--line`, `--r-ctl` 10px, `--shadow-lg`, padding `10px 12px`, `pointer-events-none`, `role="tooltip"`, `min-width` 220px / `max-width` 320px. **Cursor de hover:** guía vertical `--hair` 1px.

**A. Modo mes (sin línea destacada) — la lectura comparativa.**
- **Encabezado:** mes y año, UI 12.5px/600 `--ink` ("Marzo 2026").
- **Filas:** una por línea visible **con punto ese mes**, ordenadas por valor desc. Cada fila: swatch **8px `rounded-[3px]`** del color de la línea (o **mini-línea dasheada 14px** si es calculado) + (solo ingresos) `ArrowUp` 11px `--income-ink` + descripción UI 12.5px `--ink-2` `truncate` + valor **mono `tnum`** a la derecha — en Montos `--ink` gasto / `--income-ink` ingreso, en variación `--ink` —, sin abreviar.
- **Tope de 8 filas + `+N más`** (11.5px `--faint`, sin swatch).
- **Sin fila de total.**

**B. Modo línea (con línea destacada) — la ficha del fijo-mes.**
- **Encabezado:** swatch/mini-línea + **descripción completa** UI 12px/600 `--ink` (o `Sin descripción` en `--muted`); debajo, **punto de categoría** (6px `rounded-full`, `category.color` tal cual) + **nombre de la categoría** UI 11.5px/500 `--ink-2` (`gap-[5px]`) + `· ` + **badge de dirección** (§3.1), y si es calculado `· ` + **`CornerDownRight` 12px `--muted`** + `desde {Origen}` (mismo segmento que la sublínea de `/mes`).
- **Cifra dominante:** valor del mes bajo el cursor, **mono `tnum` 13px/600**, con micro-rótulo del mes (`Mar 2026`) en `--faint` 9px uppercase tracking. Color: Montos por tipo; variación `--ink`.
- **Fila `Frecuencia`:** label UI 11.5px/500 `--ink-2` ⟷ glifo `Repeat` 12px `--muted` + etiqueta en minúscula de *Frecuencia del fijo*.
- **Mes sin punto:** en lugar de la cifra dominante, **`—`** (`--faint`, mono) y, bajo un divisor `--hair`, la **fila de motivo** (UI 11.5px/500 `--ink-2`, copy de §4).

#### 8. La leyenda-selector de fijos — es el filtro, y es el riesgo principal de la card

Reemplaza al filtro por categoría: selección **por fijo individual**, un ítem por fijo, **sin agrupar ni "Otros"**, universo **estable** (no se achica al destildar), la card **nace con todos seleccionados**. Reusa **literal** el stack de dos partes de *Escalado de la leyenda con muchas categorías* (`graficos.md`), con tres ajustes:

- **Alto máximo: 4 renglones ≈ `112px`** (vs. 3 / 84px). Esta card tiene **un solo bloque bajo el canvas** y ese bloque **es el control principal**. Umbral **por alto, no por conteo**.
- **Etiqueta truncada** — `max-width: 180px` + `truncate` + `title` con el texto completo. Diferencia deliberada con la leyenda de categorías: la descripción de un fijo es **texto libre del usuario**.
- **Orden canónico: total del rango visible, mayor → menor, sin importar la dirección** (§3.1). **Estable dentro de un mismo rango**, se recalcula al cambiarlo y **no se reordena al destildar**. **No** es el orden que asigna el color (ese es `ordinal`).
- **El universo son las líneas que dibujan evolución** (≥2 apariciones en el rango). Los de **una sola aparición** viven en la **superficie de excluidos** (§8.1). **La selección persistida nunca se reescribe**: un fijo que sale del universo **vuelve tildado** si el rango lo reincorpora.

**Anatomía del ítem** (`<button type="button">` con `aria-pressed`, caja `inline-flex items-center gap-[6px] px-[6px] py-[4px]`, `--r-chip` 7px):

- **Fijo normal:** swatch cuadrado **10px `rounded-[3px]`** del color de la línea. **Si es de ingreso**, glifo **`ArrowUp` 11px `--income-ink`** entre swatch y etiqueta.
- **Calculado:** **mini-línea dasheada de 14px** (`stroke` 2px, `dasharray 6 4`) en el color de la línea + glifo **`CornerDownRight` 11px `--muted`** antes de la etiqueta. **La etiqueta lleva el origen** (RF-REP-013): `↳ {descripción} · desde {Origen}`.

**Etiqueta con origen del calculado — dos segmentos con jerarquía propia:**

- **Segmento 1 — descripción:** UI **12.5px/500**, color del estado del ítem (tabla de abajo), **`max-width: 140px`** + `truncate`. Sin descripción → **"Sin descripción"**.
- **Segmento 2 — origen:** **` · desde {Origen}`** en UI **12.5px/400 `--muted`** (el `·` y "desde" incluidos), con `{Origen}` = `originDescription` **`max-width: 100px`** + `truncate`. El "` · desde `" es `shrink-0`: nunca se corta, así que el corte siempre cae **dentro** de un nombre, nunca entre los dos.
- **Por qué dos topes y no uno de 180px sobre todo el texto:** con un solo tope el corte cae siempre al final y se come **el origen** — justo el dato que el requerimiento pide visible. Dos topes garantizan que se vea el arranque de los dos nombres. Ancho máximo del ítem calculado ≈ 12 (padding) + 14 (mini-línea) + 11 (`↳`) + 12 (gaps) + 140 + ~50 (` · desde `) + 100 ≈ **340px**: entra en un renglón a 352px de contenido (checkpoint crítico, §11).
- **Por qué el origen en `--muted`/400:** es identidad secundaria (de quién deriva), no el nombre del ítem; mismo peso relativo que `desde {Origen}` en la sublínea del tooltip (§7B). Sin `--faint`: tiene que leerse sin hover.
- **Estados:** **destildado** → los **dos** segmentos en `--muted` con `line-through` (el ítem entero está fuera del gráfico); **sin trazo** → descripción `--muted` sin tachado, origen igual que siempre.
- **`title`** (en la etiqueta): texto completo **`{descripción} · desde {Origen}`**. En el estado *sin trazo* el `title` del botón sigue siendo el motivo (tabla de abajo).
- **Origen sin descripción** (`originDescription: null`): el segmento 2 **no se renderiza** — mismo criterio que la sublínea del tooltip, que lo omite.
- **Nombre accesible:** el texto visible completo ("{descripción} · desde {Origen}"); el `↳` es `aria-hidden`.
- **Fijo normal:** sin cambios — una sola etiqueta con `max-width: 180px`.

**Tres estados de ítem:**

| Estado | Swatch | Etiqueta | Conjunto |
|---|---|---|---|
| **Seleccionado** (default de todos) | pleno / dash pleno | `--ink-2` | opacidad 1 |
| **Destildado** | **hueco**: borde 1.5px del color, interior `--panel` (el dash baja a opacidad 0.45 conservando su patrón) | `--muted` + **`line-through`** | opacidad **0.7** |
| **Sin trazo en el modo actual** (seleccionado, pero su línea no tiene ningún punto computable — se da sobre todo en **Ajustada por inflación**, cuando falta el dato de inflación de los tramos, y en Variación cuando ningún pago del rango tiene un pago anterior conocido) | **pleno** (sigue seleccionado) | **`--muted`, sin tachado** | opacidad 1, `title` con el motivo, **del mismo par que el overlay de §10**: con el chip de ajuste **encendido**, **"Sin variación ajustada en el rango — falta el dato de inflación entre sus pagos."**; con el chip **apagado**, **"Sin variación computable en el rango — ningún pago de este fijo se pudo comparar con el anterior."** |

- **Hover:** fondo `--panel-2`, etiqueta sube un escalón, **y destaca su línea** (§6). **Pressed:** `--panel-3`. **Focus:** ring `--accent-soft` 3px, `--r-chip` 7px — y también destaca la línea.
- **Carril fijo del comando** (fuera del scroll): divisor horizontal `--hair` 1px (`my-[8px]`) + a la izquierda `LegendAllChip` "Todas / Ninguna" (`Eye`/`EyeOff` 13px, 12px/600, fondo `--panel-2`→`--panel-3`, sin `aria-pressed`, fuera del `role="group"`), **mini-divisor `--hair` vertical** y el **disparador de excluidos** (§8.1, solo si hay excluidos); **a la derecha, el contador `N / M`** en mono `tnum` 11.5px `--muted` (`aria-label`/`title`: "N de M fijos seleccionados"). Sin el contador, con la ventana de 4 renglones el estado del filtro sería invisible.
- **`role="group"` `aria-label="Elegir fijos"`**, envolviendo **solo** los chips; `LegendAllChip`, divisor, disparador de excluidos y contador son hermanos del group, en el carril fijo.
- **Fade inferior** de 16px vía `mask-image`, atado a `data-overflow="true"`. Sin caja ni borde.

#### 8.1 Superficie de fijos excluidos — disparador en el carril + popover-lista

Los fijos con **menos de 2 apariciones en el rango** (`excluded`) no dibujan evolución, pero **siguen alcanzables** con su **mes de inicio** (RF-REP-013). La superficie **puede ser larga** (con rango de 3 meses puede caer casi todo el historial).

**Forma elegida: disparador en el carril del comando que abre un popover-lista.** (a) **Costo vertical cero**; (b) **separa lo tildable de lo informativo** (chips no-tildables en la leyenda parecerían destildados); (c) el carril ya es el lugar del **meta-estado** de la leyenda. *(Descartadas: sección colapsable bajo la leyenda — crece sin techo; chips atenuados dentro de la leyenda — afordancia falsa.)*

**El disparador** — chip plano, familia del `LegendAllChip`:

- `<button type="button">` con `aria-haspopup="dialog"` / `aria-expanded`. Caja `inline-flex items-center gap-[5px]`, `px-[8px] py-[4px]`, `--r-chip` 7px, fondo `--panel-2` → hover `--panel-3`, focus ring `--accent-soft` 3px.
- Contenido: **`Info` 13px `--muted`** + **UI 12px/600 `--muted`**: **"{N} sin evolución"** (el número en **mono `tnum`**). `title`/`aria-label`: **"{N} fijos con una sola aparición en el rango"**.
- **No se renderiza si `excluded` está vacío** (cero impacto).

**El popover:**

- Caja `--panel`, borde `--line`, `--r-ctl` 10px, `--shadow-lg`, `p-[4px]`, **`min-w 260px` / `max-w min(340px, calc(100vw − 32px))`**, portaled a `body`, anclado al disparador, **flip** si no hay lugar abajo. Cierra por **Esc, click fuera y re-clic en el disparador**, foco vuelve al disparador (popovers de lectura, `overlays-modales.md`).
- **Encabezado fijo**, `px-[8px] pt-[6px] pb-[8px]`: **"Sin evolución en el rango"** UI 12px/600 `--ink` + UI 11.5px `--faint`: **"Con menos de dos apariciones no hay evolución que dibujar."** Divisor `--hair`.
- **Lista:** `max-h 240px` con **scroll propio** y **fade inferior 16px** (`mask-image`, `data-overflow`). `role="list"`, ítems `role="listitem"`, **no interactivos** (sin hover de selección, `cursor: default`, sin foco). No destacan nada en el canvas.
- **Ítem** (`flex items-start gap-[8px] px-[8px] py-[6px]`):
  - **Sin swatch ni mini-línea** (un excluido no dibuja línea). **Calculado:** **`CornerDownRight` 11px `--muted`** antes de la descripción. **Ingreso:** **`ArrowUp` 11px `--income-ink`** antes de la descripción. Gasto normal sin glifo.
  - **Descripción** UI 12.5px/500 `--ink-2`, `max-w 180px` + `truncate` + `title`. Sin descripción → **"Sin descripción"** en `--muted`.
  - **Sublínea** UI 11.5px `--faint`: **`● {Categoría} · desde {Mmm AAAA}`**, con el **punto de categoría** (6px `rounded-full`, `category.color` tal cual, `gap-[5px]`).
  - **El origen del calculado NO va en esta superficie.** El requerimiento lo pide en el ítem de **leyenda**; acá (a) el contrato de `excluded` **no trae** `originDescription` y (b) la sublínea ya usa "desde" para el **mes de inicio**: un segundo "desde {Origen}" en el mismo ítem haría ambiguo cuál es cuál. El calculado excluido se sigue distinguiendo por el `↳`.
  - **Con el toggle "Mostrar calculados" apagado (§5.1)** los calculados no figuran en la lista ni en el `{N}` del disparador; si los únicos excluidos eran calculados, el disparador **no se renderiza**.
- **Orden: por mes de inicio, más reciente primero**; desempate descripción A→Z (la pregunta típica: *"¿por qué no veo el fijo que acabo de crear?"*).
- **A11y:** `role="dialog"` `aria-label="Fijos sin evolución en el rango"`. Lectura, no formulario; `Esc` siempre cierra.

#### 9. Cabecera — molde de dos líneas

Molde de `by-category` / `income-expense` con filtros (identidad arriba, controles debajo):

- **Línea 1** (`mb-[8px]`): **título editable** (16px/600 `--ink`, placeholder "Reporte N" en `--faint`, lápiz on-hover, truncado).
- **Línea 2** (`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-[18px]`):
  - **Cluster izquierdo** (`flex flex-wrap items-center gap-x-[10px] gap-y-2`): `[ Montos | Variación ] |hair| [ Ajustada por inflación ] |hair| [ ↳ Mostrar calculados ]` (§5, §5.1). El último subgrupo solo existe si el rango trae algún calculado de fijo.
  - **Cluster derecho — `CardControls`:** `[ Rango ▾ ] (nota de recorte) |hair| [ CardCurrencySelect ] |hair| [ RefreshCw ] [ X ]`.

**Selector de rango (`RangeSelect`) — chip-dropdown, primer elemento del cluster derecho.** Control de **mayor jerarquía** del cluster → **tratamiento de pill**: caja `--panel`, borde `--line`, `--shadow-sm`, `--r-ctl` 10px, `px-[10px] py-[5px]`. Jerarquía **rango > moneda > utilidades** (la moneda sigue siendo chip plano `--panel-3`).

- **Disparador:** `<button type="button">` con `aria-haspopup="listbox"` / `aria-expanded` / `aria-label="Rango del reporte"`. **Rótulo de la opción elegida** en **UI 12.5px/600 `--ink-2`** + **`ChevronDown` 12px `--faint`** que rota a ▲ (`-180°`, 0.14s) abierto. Hover: borde `--line-strong`, rótulo `--ink`. Focus: ring `--accent-soft` 3px.
- **El rótulo va en texto UI, no en mono.** "3 años" es una **etiqueta de período**, no una cifra de dinero ni una fecha. (Decisión explícita, para que no se "corrija".)
- **Popover:** `--panel`, borde `--line`, `--r-ctl` 10px, `--shadow-lg`, `p-[4px]`, `min-w 132px`, alineado al **borde izquierdo** del disparador, flip. `role="listbox"` `aria-label="Rango del reporte"`; ítems `role="option"` + `aria-selected`; ↑/↓ recorren, Enter/Espacio eligen, Esc cierra y devuelve foco. Mismas reglas de cierre que el selector de moneda.
- **Las 8 opciones, en este orden:** **`3 meses` · `6 meses` · `9 meses` · `1 año` · `2 años` · `3 años` · `4 años` · `5 años`**. Ítem UI 12.5px/600 `--ink-2`, `px-[10px] py-[6px]`, `--r-chip` 7px; **seleccionado** = `--ink` + `Check` 14px `--ink-2` a la derecha (sin fondo de acento); hover `--panel-2`.
- **Un divisor `--hair` horizontal entre "9 meses" y "1 año"**. **Default: `3 años`** (incluidas las cards persistidas sin el campo).
- **No hay navegación de período**: ni stepper, ni año, ni flechas. El borde derecho es siempre el mes en curso. Cambiar el rango **no** reescribe la selección de fijos.
- **Nota de rango recortado — solo cuando el rango efectivo es menor al pedido.** Si `rangeMonths` de la respuesta es menor al elegido, a la **derecha del disparador**, texto plano **UI 11.5px `--faint`**: **"Desde {Mmm AAAA} — es todo tu historial."** **El disparador sigue mostrando la opción elegida.** Sin recorte, la nota **no se renderiza**. En compacto viaja con el select por el `flex-wrap`.
- **Por qué un select:** 8 valores discretos y no contiguos (3…60); un stepper obligaría hasta 7 clics y un slider sugeriría continuidad. El chip-dropdown es el patrón del DS para "pocas opciones discretas en una cabecera densa".
- **Selector de moneda:** presente y **siempre habilitado**. **La moneda de display incide en los tres modos**: los valores se calculan sobre montos **ya convertidos**, cada aparición con la cotización de **su propio mes**. Nunca se deshabilita.
- **Lo que esta cabecera NO lleva:** **`YearStepper`** ni navegación de período, **chip de Simulados** (RF-REP-017 la excluye), **`LimitsInfoPopover` ni marcas de límite**, **filtro de categorías**.

#### 10. Estados

- **Loading (skeleton):** cabecera presente e inerte (en la **primera carga** el chip "Mostrar calculados" **no se renderiza**: su visibilidad depende del dato; en un refetch conserva su presencia hasta que llega la respuesta); canvas → `SkeletonBlock` del alto del canvas + **5 chips fantasma en 2 renglones** + un chip fantasma corto en el carril (ver `skeletons.md`; 2–3 chips subestimarían el alto). Sin spinner.
- **Rango sin ningún fijo (empty):** **eje X con las posiciones del rango y eje Y en su unidad** (baseline en cero si es variación) + **overlay en dos líneas**: "Sin fijos en el rango." (UI 14px `--muted`) + "Probá un rango más largo." (UI 12.5px `--faint`). El **bloque de leyenda no se renderiza**.
- **Ningún fijo con evolución, pero sí excluidos** (`lines` vacío, `excluded` con ítems): ejes completos, sin líneas, overlay: **"Ningún fijo tiene dos apariciones en el rango."** + **"Alargá el rango para ver su evolución."**. Sin leyenda-filtro, pero **sí el carril con el disparador de excluidos** (§8.1), **sin** `LegendAllChip` ni contador.
- **Solo calculados en el rango, con el toggle apagado** (el rango trae ítems en `lines`/`excluded` y **todos** son calculados de fijo): ejes completos, sin líneas, overlay: **"En el rango solo hay calculados."** (UI 14px `--muted`) + **"Prendé «Mostrar calculados» para verlos."** (UI 12.5px `--faint`). **Sin leyenda ni carril** (no hay ningún ítem que mostrar). **El chip "Mostrar calculados" sigue visible** en la cabecera: es la salida que el copy nombra, a un clic. *(Descartado: reusar "Sin fijos en el rango." + "Probá un rango más largo." — es falso, sí hay datos, y manda a una acción que no los muestra.)*
  - **Precedencia:** este estado se evalúa **antes** que los de abajo. Si tras quitar los calculados quedan solo excluidos no calculados, rige "Ningún fijo tiene dos apariciones…" (el toggle sigue visible porque el rango trae calculados).
- **Ningún fijo seleccionado (`[]`):** ejes completos, sin líneas, overlay: "Ningún fijo seleccionado." + "Elegí uno en la lista de abajo.". La leyenda **no se bloquea**.
- **Modo Variación sin ninguna línea computable** — dos variantes según el chip de ajuste:
  - **Chip encendido:** **"Sin variación ajustada en el rango."** + **"Probá sin el ajuste por inflación."** (la salida existe y está a un clic).
  - **Chip apagado:** **"Sin variación computable en el rango."** + **"Faltan datos para comparar cada pago con el anterior."**
- **Error:** `AlertTriangle` 20px `--warning-ink` + "No se pudo cargar el reporte." + ghost "Reintentar".
- **Modo orden:** mismo mini-ítem; **no renderiza ningún control interno**. **Ícono: `Repeat`** (§12). **Etiqueta: "Detalle histórico de fijos"** (12px/600 `--muted`) — el **título es el que trunca**, nunca la etiqueta.
- **Render de las líneas — completo e inmediato (`isAnimationActive={false}`):** cada línea se dibuja entera desde el primer frame. Vale para **todo** render: al montar, al cambiar rango, moneda, modo y selección. En ningún momento una línea seleccionada queda a medio trazar o invisible. Sigue vigente el resto del movimiento (underline de tabs, transición del destacado, aparición del tooltip).
- **`prefers-reduced-motion`:** underline sin deslizar; destacado instantáneo; tooltip sin transición.

#### 11. Contención responsive (obligatoria)

Régimen de app (`≥ 600px` en los dos ejes), en **los dos estados del sidebar**. La disposición sigue al **ancho de contenido**.

**Checkpoint crítico: "rango de 5 años en 352px de contenido"** (60 posiciones sobre ~260px de plot, canvas de 220px). Lo sostienen la **cadencia de rótulos** (§2: en compacto **solo los eneros**, 5 rótulos con año) y el **umbral de `slot`** (§4: ningún punto de mes; el hueco lo dice el **puente atenuado**).

- **`< --bp-wide` (compacto):** canvas **220px**. La **línea 2 envuelve** por su `flex-wrap`: tabs + chip arriba, `CardControls` abajo. Las **tabs nunca colapsan**; el chip de ajuste **nunca se oculta**; el **select de rango nunca se reduce a un ícono**.
- **Toggle "Mostrar calculados" (§5.1):** es **el primero en bajar** dentro del cluster izquierdo; **divisor y chip bajan juntos** (subgrupo `shrink-0`): nunca un divisor colgando al final de un renglón ni al inicio del siguiente sin chip. La etiqueta **nunca se abrevia** ni el chip se reduce al glifo.
- **Ítem de leyenda de calculado con origen (§8):** topes 140px + 100px → ≈ 340px, entra en un renglón a 352px de contenido; los topes no cambian con la disposición.
- **El eje X nunca rota ni scrollea:** el canvas **se comprime**; los rótulos se ralean por §2. Las **fronteras de año se dibujan siempre**, a cualquier ancho.
- **La leyenda no cambia de forma:** el `max-h` de 4 renglones la acota. `LegendAllChip`, disparador de excluidos y contador siguen en el carril fijo; si no entran en un renglón, el carril **envuelve** (el contador baja), nunca se oculta ninguno.
- **Los cuatro invariantes:**
  1. **Sin scroll horizontal del `body`:** el canvas es `ResponsiveContainer`; los rótulos se ralean; el popover de excluidos capado a `min(340px, 100vw − 32px)`.
  2. **Overlays completos:** tooltip, popover del select de rango y popover de excluidos **portaled a `body`** con **flip**; el de excluidos scrollea dentro de sí.
  3. **Ninguna acción inalcanzable:** todos los controles visibles en todos los checkpoints; los únicos scrolls son el **vertical interno de la región de chips** y el del popover de excluidos.
  4. **Superficies anchas scrollean dentro de sí:** el canvas **se comprime**, no scrollea.
- **Checkpoints, con `5 años` y con `3 meses`:** **600px sidebar cerrado**, **600px sidebar abierto** (352 de contenido), **941px** y **1288px**. Ningún monto ni % del tooltip se trunca (lo que trunca es la **descripción**).

#### 12. Menú "[+]" (6ª entrada) y nomenclatura del tipo

- **Nombre de display:** **"Detalle histórico de fijos"** — sin dirección. Mismo texto en `AddCardMenu` y en la etiqueta del mini de reorden. Un título editable que el usuario haya escrito no se toca.
- **Ícono: `Repeat`** (lucide, 16px `--muted`) — el glifo con el que el producto ya nombra al fijo. Distinto de `AreaChart`, `BarChart3`, `CalendarDays`, `CalendarRange`, `TrendingUp`.
- **Sub-descripción:** **"Cada gasto e ingreso fijo por separado, mes a mes: cuánto valía y cuándo cambió."** UI 12px `--muted`.

#### 13. Agregados más allá del brief — estado

Piezas que **no** venían en el brief:

- **Contador `N / M` en el carril del comando** — vigente.
- **Tercer estado de ítem "sin trazo en el modo actual"** — vigente.
- **Tope de 8 filas + `+N más` en el tooltip de modo mes** — vigente.
- **Segunda línea de copy en los overlays de estado vacío** — vigente.
- **Nota de rango recortado** ("Desde {Mmm AAAA} — es todo tu historial.") — vigente.
- **Glifo `CornerDownRight` en el chip "Mostrar calculados"** (§5.1) — vigente; el brief pedía el toggle, el glifo es decisión de diseño.
- **Fronteras de año como verticales `--hair`** — vigente.
- **Puente atenuado del hueco (opacidad 0.35)** — vigente; es el portador del requisito funcional "hueco ≠ cero" (un punto por mes no escala a 60 posiciones, §4).
- **Puntos en reposo densidad-adaptativos** — vigente; excepción al patrón de dots del DS, acotada por `slot` y a esta card.
- **Forma del punto por dirección (círculo gasto / cuadrado ingreso)** (§3.1) — vigente; forma de punto propia de esta card.
- **Color por tipo de la cifra de dinero en el tooltip (Montos)** (§3.1) — vigente; no es pieza nueva: es la regla de dinero llegando a esta card.

#### 14. De dónde sale cada cosa en el contrato

Contrato: `GET /movements/reports/fijos-historico?rangeMonths=<3|6|9|12|24|36|48|60>[&currency][&today]`.

- **El eje X sale de `startMonth` / `endMonth` / `rangeMonths`** (efectivos, post-recorte); cada punto trae su `month` (`"YYYY-MM"`).
- **El recorte se detecta comparando `rangeMonths` de la respuesta contra el pedido** (el persistido): si el efectivo es menor, nota de §9 con `startMonth`. El valor persistido **no se reescribe**.
- **`lines` viene en el orden canónico** (total del rango DESC). **El color NO usa ese orden**: usa `ordinal`.
- **El hueco y su motivo** salen de `amountCents: null` + `reason` (`frequency` / `skipped` / `beforeStart` / `afterEnd` / `resultedIncome`): `amountCents: 0` con `reason: null` es un **punto real** (RN-018). Los tramos de **puente atenuado** van de flanco a flanco de cada `reason` **interno** (nunca `beforeStart` / `afterEnd`).
- **Variación: `nominalPct` / `adjustedPct` de cada punto**, ya calculados **contra el pago anterior**. `null` = **sin punto** (la línea se corta, sin puente). El contrato **no identifica qué mes de inflación falta**. El pago anterior puede estar fuera del rango: el valor llega y **se dibuja en el primer punto visible**.
- **`excluded` alimenta §8.1** (`description`, `categoryName`, `categoryColor`, `startMonth`, `isCalculated`). **No trae `ordinal`** (un excluido no lleva color de fijo).
- **Sin campos de año** con rol visual: las 8 opciones del select están siempre habilitadas y el recorte lo resuelve el backend.
- **La dirección sale de `type`** (`'EXPENSE'` / `'INCOME'`) de cada `FixedEvolutionLine` y `FixedEvolutionExcludedLine`: decide forma del punto, `ArrowUp`, badge y color de la cifra del tooltip. `amountCents` llega como **magnitud**; el front no le cambia el signo.

#### 15. Variante acotada a un fijo — la card dentro de la vista evolución de `/mes` (RF-VM-009)

La misma card, montada **dentro** de la card de detalle de `/mes` para **un solo fijo** (`chainId`). La anatomía del contenedor vive en *Card de detalle de movimiento → Vista evolución* (`card-detalle.md`). Regla rectora: **mismo canvas, sin chrome de reporte**.

**Se apaga (no se renderiza):** el **envase de card de reporte** (panel, borde, `--r-card`, sombra, `--card-pad`), el **título editable**, las **tabs de modo** y el **chip de ajuste**, el **toggle "Mostrar calculados"** (el calculado se ve siempre), el **selector de moneda**, el **refrescar**, el **quitar (`X`)**, la **leyenda-selector** completa, el **disparador y popover de excluidos**, la **nota de rango recortado** y el **modo orden**.

**Se conserva tal cual:** eje X (§2), eje Y de **Montos** (§2.1), forma del punto por dirección (§3.1), huecos y puente atenuado (§4), terminales anillados, `isAnimationActive={false}`, tooltip portaled y su caja.

**Lo que cambia:**

- **Selector de rango — único control, idéntico al de la card.** Mismo `RangeSelect`, mismas 8 opciones y rótulos (**`3 meses` · `6 meses` · `9 meses` | `1 año` · `2 años` · `3 años` · `4 años` · `5 años`**).
  - **Default `1 año`**, **no persistido** (no escribe en `reports`). (A ~45px por mes en el ancho del panel, ver *Vista evolución → Ancho del panel*.)
  - **Posición:** solo en la fila de controles, alineado a la derecha. El listbox se alinea al **borde derecho** del disparador cuando al izquierdo no entra, con margen de 12px.
- **Eje X con el rango efectivo completo; los meses previos al alta son hueco de extremo.** El recorte izquierdo es el del contrato (primer mes con aparición de **cualquier** fijo del usuario): si este fijo arrancó después, los meses anteriores **son eje sin línea** (caso "Extremo" de §4). El recorte no se comunica.
- **Cadencia de rótulos: siempre la columna "amplio" de §2.** El plot mide **~460px** (panel a 552px) a **~548px** (panel a 640px). No se usa la medición `@wide` de `/reportes`.
- **Alto del canvas: 240px fijo**, en las dos disposiciones. El modal compite por **alto de viewport**; 240 deja el modal (≈ 400px) dentro del piso de 600px de alto.
- **La única línea se dibuja permanentemente en tratamiento de destacado (§6):** **2.5px**, opacidad 1, **todos sus puntos de mes** mientras `slot ≥ 6px` (círculos r 2.5 / cuadrados 5×5, anillo `--panel` 1.5px), terminales y `activeDot`. El hover sobre la línea **no cambia nada**.
- **Color de la línea: el de su categoría, re-anclado con §3 punto 5** — **no** `FX`. (Consecuencia asumida: el fijo no tiene el mismo color acá que en `/reportes`.) **No** `--income`/`--expense` ni índigo.
- **Tooltip — siempre "modo línea", sin encabezado de identidad** (sin descripción/categoría/badge ni fila `Frecuencia`). Queda: **micro-rótulo del mes** (`Mar 2026`, `--faint` 9px uppercase tracking) **arriba, siempre** + **cifra dominante** mono `tnum` 13px/600 con **color por tipo** (gasto `--ink`, ingreso `--income-ink`), o en un mes sin punto **`—`** + **fila de motivo** (copys de §4). `min-width` **160px**.
- **Estados:**
  - **Cargando:** `SkeletonBlock` de **240px** de alto; **sin** chips fantasma. La fila de controles presente y el select **sigue operable**. Mismo skeleton en la primera carga y al cambiar de rango.
  - **Vacío** (menos de 2 apariciones en el rango): ejes completos y overlay en dos líneas: **"Este fijo no tiene dos meses con monto en el rango."** (UI 14px `--muted`) + **"Alargá el rango para ver su evolución."** (UI 12.5px `--faint`). La segunda línea **no se muestra** con `5 años` elegido.
  - **Error:** `AlertTriangle` 20px `--warning-ink` + **"No se pudo cargar la evolución."** + ghost **"Reintentar"**, centrado en el área de 240px.
  - **Con datos:** la línea del fijo.

#### Restricciones duras reafirmadas

- **Verde = ingreso, rojo = gasto:** ninguno tiñe **trazos**. Las líneas van por **clave de color de fijo** (`FX` por `ordinal`; en la variante acotada, color de categoría re-anclado). Ningún color de `FX` cae en el arco del rojo ni del verde. La dirección va por canales propios (§3.1). Ningún valor se recolorea por su signo; ningún % lleva color de dirección.
- **Índigo solo como focus ring.** Ningún color de `FX` cae en su arco (hue ≈ 281 ± 35°). Underline de tab activa `--ink`, baseline `--line`, gridlines `--hair`.
- **Mono tabular:** eje Y, el año bajo los rótulos de enero/borde, cifra dominante y valores del tooltip, código de moneda, contador `N / M` y número del disparador de excluidos. **Descripción, categoría, frecuencia, copys de motivo, rótulos de mes y rótulo del select de rango** son texto UI.
- **Ambos modos de color:** `FX` (L 0.70 / 0.50) y el re-anclado se limitan a la **banda L 0.46–0.74**. Verificar el canvas con ≥12 líneas en claro y en oscuro.
- **Nada de totales, nada de agregación, en ningún modo.**

### Checklist de aceptación visual — Detalle histórico de fijos (`fixed-evolution`)

> Insumo directo del QA visual per-feature (skill `qa-visual`, `.claude/skills/qa-visual/SKILL.md`). Escenario recomendado: usuario con **al menos 14 gastos fijos** (para ver el reciclado de los 12 colores) repartidos en **5+ categorías**, entre ellos **tres o más de la misma categoría**, **uno con frecuencia > 1**, **uno con un mes anulado**, **uno dado de baja hace unos meses**, **uno de alta el mes pasado**, **uno con un aumento de monto**, **uno con historia de más de 3 años** y **un calculado derivado de un fijo**; más **al menos dos fijos de ingreso** (uno grande tipo sueldo y uno chico, de categorías distintas) y **un calculado cuyo origen es un fijo de ingreso**. Verificar con el rango en **3 años** (default), **5 años** y **3 meses**. Los ítems que verifican calculados se corren con el toggle **"Mostrar calculados" prendido**; para el estado "solo calculados" hace falta además un usuario (o rango) cuyos únicos fijos con aparición sean calculados.

*Toggle "Mostrar calculados" (§5.1):*
- [ ] Una card recién creada (o una persistida sin el campo) muestra el chip **"Mostrar calculados"** con glifo **`↳`** **apagado** (plano, `--panel-2`, texto `--muted`), y **ningún calculado** en canvas, leyenda, contador, excluidos ni tooltip.
- [ ] El chip es **el último** del cluster izquierdo: `Montos | Variación` · hair · "Ajustada por inflación" · hair · "↳ Mostrar calculados".
- [ ] Prenderlo lo deja **elevado** (`--panel`, borde `--line-strong`, `--shadow-sm`, texto `--ink`) y **agrega** las líneas dasheadas, sus ítems de leyenda y sus excluidos; el contador `N / M` sube en consecuencia. **Ningún otro fijo cambia de color** ni de tilde.
- [ ] Destildar un calculado, apagar el toggle y volver a prenderlo: el calculado **vuelve destildado**.
- [ ] El estado del toggle **persiste** al recargar la página.
- [ ] Con un rango **sin ningún calculado** (en líneas ni excluidos), el chip **y su divisor no existen** (no queda un hair colgando tras "Ajustada por inflación"); al volver a un rango con calculados, el chip **reaparece con el valor que tenía**.
- [ ] Con `Tab` el chip recibe foco (ring `--accent-soft`) y `Espacio`/`Enter` lo alternan; el lector anuncia "Mostrar calculados" con su estado presionado.
- [ ] Ningún estado del chip usa verde, rojo ni índigo (salvo el focus ring).
- [ ] La **variante acotada** de `/mes` **no** muestra el chip.

*Leyenda — calculado con origen (§8):*
- [ ] El ítem de un calculado se lee **`[mini-línea] ↳ {descripción} · desde {Origen}`**: la descripción en `--ink-2`/500 y **" · desde {Origen}"** más liviano, en `--muted`/400.
- [ ] Con descripción y origen largos, **los dos nombres truncan con elipsis por separado** (se ve el arranque de ambos) y " · desde " nunca se corta; el `title` muestra el texto completo.
- [ ] Destildado, **ambos segmentos** quedan tachados en `--muted`.
- [ ] Los ítems de **fijos normales** no cambian (una sola etiqueta, tope 180px, sin "desde").
- [ ] En el popover de **excluidos**, un calculado sigue mostrando solo `↳` + descripción + `● {Categoría} · desde {Mmm AAAA}` (**sin** origen).

*Estado solo calculados (§10):*
- [ ] Con el toggle **apagado** y un rango donde todo son calculados: ejes completos, overlay **"En el rango solo hay calculados."** + **"Prendé «Mostrar calculados» para verlos."**, **sin** leyenda ni carril, y el chip **visible** en la cabecera. **No** aparece "Sin fijos en el rango.".
- [ ] Prender el chip desde ese estado **dibuja** los calculados (la salida que promete el copy es real).
- [ ] A **600px con sidebar abierto** el chip **y su divisor bajan juntos** de renglón; la etiqueta no se abrevia y no hay scroll horizontal del `body`.

*Dirección — ingresos y gastos (§3.1):*
- [ ] Los fijos de **ingreso aparecen** en el canvas y en la leyenda, **mezclados** con los gastos en **una sola lista** ordenada por total del rango (el sueldo, si es el mayor, es el **primer** ítem); **no** hay sección, encabezado ni separador por dirección.
- [ ] Ingresos y gastos comparten **el mismo eje Y**, ambos **por encima de cero** (ninguna línea de ingreso va hacia abajo ni lleva signo).
- [ ] **Ningún trazo** es verde ni rojo: las líneas de ingreso toman su color de la paleta `FX` igual que las de gasto.
- [ ] Los puntos de una línea de **ingreso son cuadrados** (esquinas rectas) y los de **gasto, círculos** — verificable en los **terminales anillados** con cualquier rango, incluso **5 años** en 352px de contenido; con el rango en **3 meses** también los puntos de mes.
- [ ] El ítem de leyenda de un ingreso lleva **`↑` verde** (`--income-ink`) entre el swatch y el nombre; los de gasto **no llevan glifo**; el `↑` **conserva su color** cuando el ítem está destildado.
- [ ] El **calculado de origen ingreso** se ve como **gasto**: dasheado, `↳`, **sin `↑`**, puntos **circulares**.
- [ ] **Tooltip modo mes en Montos:** la cifra de un ingreso va en **verde (`--income-ink`)** con `↑` delante del nombre, la de un gasto en `--ink`; filas mezcladas por valor. **En Variación** todas las cifras van en `--ink`.
- [ ] **Tooltip modo línea:** la sublínea muestra el badge **`Ingreso`** (verde) o **`Gasto`** (rojo) después de la categoría; la cifra dominante en Montos lleva el color por tipo.
- [ ] En el popover de **excluidos**, un ingreso excluido lleva el **`↑` verde** antes de la descripción.
- [ ] Ningún copy de la card dice "gasto(s) fijo(s)": overlays ("Sin fijos en el rango.", "Ningún fijo tiene dos apariciones en el rango.", "Ningún fijo seleccionado."), `title` del contador ("N de M fijos seleccionados") y del disparador de excluidos ("{N} fijos con una sola aparición en el rango").

*Identidad y cabecera:*
- [ ] El menú `[+]` ofrece **"Detalle histórico de fijos"** con ícono **`Repeat`** y la sub-descripción "Cada gasto e ingreso fijo por separado, mes a mes: cuánto valía y cuándo cambió."
- [ ] La cabecera es de **dos líneas**: título editable arriba; debajo `[ Montos | Variación ] · divisor --hair · chip "Ajustada por inflación"` (+ `· hair · "↳ Mostrar calculados"` si el rango trae calculados) a la izquierda ⟷ `[ Rango ▾ ] · hair · [ moneda ] · hair · [ refrescar ][ X ]` a la derecha.
- [ ] **No hay stepper de año ni flechas de período** en ninguna parte de la card.
- [ ] La card **no** muestra chip de **Simulados**, **ni** ícono/popover de **límites**, **ni** filtro de categorías, en ninguna parte.
- [ ] La card **no** aparece como widget del Dashboard.

*Select de rango:*
- [ ] El disparador es una **pill** (fondo `--panel`, borde `--line`, sombra `--shadow-sm`) con el rótulo de la opción elegida en **texto UI, no mono**, + `ChevronDown` que rota al abrir; se ve **más pesado** que el chip plano de moneda.
- [ ] Una card recién creada nace en **"3 años"**.
- [ ] El popover lista **exactamente 8 opciones** en este orden — `3 meses`, `6 meses`, `9 meses`, `1 año`, `2 años`, `3 años`, `4 años`, `5 años` — con un **divisor `--hair` entre "9 meses" y "1 año"**; la elegida lleva `Check` y color `--ink`.
- [ ] Cambiar el rango **redibuja el canvas** y **mueve solo el borde izquierdo**: el último mes del eje sigue siendo **el mes en curso** en las 8 opciones.
- [ ] **Ningún mes futuro** se grafica, ni siquiera con fijos activos de monto conocido: a la derecha del mes en curso no hay más posiciones.
- [ ] Con un usuario de historia corta y el rango en **5 años**, aparece a la derecha del select la nota **"Desde {Mmm AAAA} — es todo tu historial."** en `--faint`, y el **disparador sigue diciendo "5 años"**. Con historia suficiente, la nota **no existe**.

*Las líneas:*
- [ ] Hay **una línea por fijo seleccionado** (gasto o ingreso) y **ninguna línea total, suma ni promedio** en ningún modo.
- [ ] **Un color distinto por fijo:** con 12 fijos o menos, **no hay dos líneas del mismo color**, y los colores alternan hue y claridad (no es un degradé de un mismo tono). En particular, **tres o más fijos de la misma categoría** se ven en **hues distintos**, no como claro/medio/oscuro de un mismo color.
- [ ] **Ninguna línea** es roja, verde ni índigo: los colores son azul, celeste, naranja, marrón, violeta, lila, aguamarina, petróleo, ciruela, rosa, oro y oliva (valores en §3).
- [ ] **El color es estable:** anotar el color de 3 fijos, cambiar el rango (3 años → 5 años → 1 año), la moneda, el modo y destildar/re-tildar uno: **ninguno cambia de color**.
- [ ] Con **más de 12 fijos**, el 13º (por antigüedad) **repite** el color del 1º: dos líneas del mismo color pueden convivir, y el **destacado por hover** y el swatch de la leyenda las distinguen.
- [ ] El swatch de cada ítem de leyenda es **exactamente el color de su línea**.
- [ ] Las líneas claras (L 0.70) y las profundas (L 0.50) se ven **nítidas** sobre el panel en claro **y** en oscuro: ninguna se funde con el fondo ni con un gridline.
- [ ] El **calculado** se dibuja **dasheado `6 4`** en **su propio** color de fijo (no necesariamente el de su origen), y su ítem de leyenda lleva **mini-línea dasheada + glifo `↳`**.
- [ ] El fijo con **aumento de monto** se ve como **escalón** (diagonal empinada entre dos meses), **no** como curva suavizada.
- [ ] Con rango **3 meses** (y en 1 año a ancho amplio) **se ven los puntos** de cada mes con aparición; el **primer y último punto** de cada línea llevan **anillo `--panel`** en cualquier rango.
- [ ] Con rango **5 años** los puntos de mes **desaparecen o se achican** (el canvas no es una nube de puntos), pero **los terminales anillados siguen visibles** en cada línea.
- [ ] Las líneas se ven **completas y de inmediato**, sin trazado progresivo: al montar la card y al cambiar de **rango**, **moneda**, **modo** (Montos ⇄ Variación ⇄ Ajustada) o **selección de la leyenda**, **ninguna** línea seleccionada queda a medio dibujar ni invisible — ni en el primer frame ni después.

*Eje X, ticks y frontera de año:*
- [ ] El **último rótulo del eje X es el mes en curso** y lleva **el año debajo** en mono; el **primer rótulo** también lleva su año.
- [ ] Con rango **3 meses** se rotulan **los 3 meses**; con **5 años** se rotulan **pocos** (uno cada 6 meses en amplio; **solo los eneros** en compacto) y **ningún rótulo se superpone ni se rota**.
- [ ] **Cada enero del rango lleva rótulo** con su año debajo, en todos los rangos de 12+ meses.
- [ ] En un rango que cruza años hay **una línea vertical `--hair` en cada enero** (salvo si enero es la primera posición), **por detrás de las líneas**; con rango de 3 meses dentro del mismo año **no hay ninguna vertical**.
- [ ] No hay **ninguna otra** vertical: la retícula del canvas sigue siendo solo horizontal.

*Huecos (hueco ≠ cero):*
- [ ] El fijo con **frecuencia > 1** se dibuja como **una sola línea continua** que alterna **tramos plenos y tramos atenuados** (mismo color y grosor, ~35% de opacidad) — la línea **no se parte** y los meses sin aparición **no tienen punto apoyado en cero**.
- [ ] El fijo con **mes anulado** muestra **el tramo que cruza ese mes atenuado**, con la línea continua.
- [ ] Un fijo (o calculado) con **monto 0 real** en un mes baja **con trazo pleno** hasta el piso del eje: se distingue a ojo de un mes sin aparición (que va atenuado). **Esta verificación vale también con el rango en 5 años**, donde no hay puntos de mes.
- [ ] Un **calculado con hueco** muestra el puente **dasheado `6 4` y atenuado** a la vez (las dos señales conviven).
- [ ] El fijo de **alta reciente** **empieza** en su primera aparición (no hay tramo en cero antes) y el **dado de baja** **termina** en la última (no continúa en cero **ni** se le dibuja puente).
- [ ] Con una línea **destacada**, pasar por un mes sin punto muestra la **fila de motivo** en el tooltip, con el copy correcto: "No corresponde este mes — {frecuencia}." / "Mes anulado." / "Todavía no arrancaba — desde {Mmm AAAA}." / "Dado de baja — hasta {Mmm AAAA}."
- [ ] En **modo Variación**, el fijo de **frecuencia > 1** (bimestral/anual) **dibuja puntos**: uno por cada pago que tiene un pago anterior conocido, aunque entre los dos haya meses sin aparición. El modo **nunca queda vacío** para un fijo no mensual.
- [ ] Esos puntos son **aislados** (la línea no los une: `connectNulls` false) y **se siguen viendo con el rango en 5 años** — la línea nunca queda invisible.
- [ ] El fijo con **mes anulado** conserva el punto de variación en su **pago siguiente**: el mes anulado **no corta la comparación** (se compara contra el último pago real previo, no contra el hueco).
- [ ] Un fijo cuyo **pago anterior cae fuera del rango visible** (ej. el anual con rango `1 año`) **igual muestra variación** en su pago visible — no queda sin punto por el borde del rango.
- [ ] Con línea destacada, un punto **sin variación computable** muestra en el tooltip la fila de motivo **"Sin variación computable — no hay un pago anterior con el que comparar."**
- [ ] Con el chip **"Ajustada por inflación"** encendido, un punto sin ajuste muestra la fila **"Sin ajuste por inflación — falta el dato de algún mes desde el pago anterior."** — **no nombra ningún mes** (ni "{Mmm AAAA}", ni un año, ni una cantidad de meses). **Ese mismo mes, con el chip apagado, sí muestra punto y cifra** en Variación nominal: lo que falta es el ajuste, no la variación.

*Modos:*
- [ ] La tab **"Montos"** es el default; el eje Y está en **moneda abreviada mono tabular** y su piso es **cero**.
- [ ] En **"Variación"** el eje Y pasa a **puntos porcentuales con signo** (`+10%` / `0%` / `−5%`, menos `U+2212`), **cruza el cero** y la **baseline `y=0` está marcada** (más fuerte que los gridlines).
- [ ] En **Montos** el chip "Ajustada por inflación" está **presente y atenuado** (`opacity-45`), **recibe foco con `Tab`**, clickearlo no hace nada, y su `title` dice **"El ajuste por inflación solo aplica a la variación."**
- [ ] Pasar a **Variación** habilita el chip; encenderlo lo deja **elevado** (`--panel`, `--line-strong`, `--shadow-sm`); volver a **Montos** lo deshabilita **sin perder** el valor guardado (al volver a Variación sigue encendido).
- [ ] En los modos de variación, un mes **sin valor computable** no tiene punto **y la línea no lo puentea** (no hay tramo atenuado ahí: la línea se corta); en **Montos** los huecos internos **sí** se puentean, atenuados.
- [ ] Ningún valor % lleva color verde ni rojo: los valores del tooltip van en **`--ink`** y los ticks en **`--muted`**.
- [ ] El ítem de leyenda de un fijo **sin trazo en el modo actual** queda en `--muted` **sin tachado**, con `title` **"Sin variación ajustada en el rango — falta el dato de inflación entre sus pagos."** si el chip de ajuste está encendido, y **"Sin variación computable en el rango — ningún pago de este fijo se pudo comparar con el anterior."** si está apagado (los dos dicen *rango*, no un año). **Un fijo de frecuencia > 1 con dos pagos en el rango NO cae en este estado** en modo Variación: dibuja y su ítem se ve normal.
- [ ] Cambiar la **moneda** redibuja el canvas **en los tres modos**: en Montos cambia la unidad del eje Y; en **Variación** (nominal y ajustada) los valores % **también cambian**, porque salen de montos ya convertidos con la cotización de cada mes. El selector **nunca** aparece deshabilitado.

*Leyenda-selector:*
- [ ] La card **nace con todos los fijos seleccionados** y hay **un ítem por fijo**, sin agrupar y **sin ningún ítem "Otros"**.
- [ ] Con **más de ~15 fijos** la región de chips se recorta a **4 renglones** con **scroll interno** y **fade inferior**; la card **no crece a lo alto** sin límite.
- [ ] El **`LegendAllChip` "Todas / Ninguna"**, el **disparador de excluidos** y el **contador `N / M`** quedan **siempre visibles** en su carril, **sin scrollear**, y son alcanzables con `Tab` desde el último chip.
- [ ] Destildar un fijo lo deja **tachado, con swatch hueco y opacidad 0.7**, y **quita su línea** del canvas; el ítem **sigue en la lista** (el universo no se achica).
- [ ] Aislar un fijo se logra con **"Ninguna" + un clic** en su ítem.
- [ ] Una descripción larga **trunca con elipsis** en el chip y su texto completo aparece en el `title`.
- [ ] **Un fijo con una sola aparición en el rango NO aparece en la leyenda ni dibuja línea** (probar con rango 3 meses y un fijo de alta el mes pasado).
- [ ] Destildar un fijo, **cambiar el rango a uno que lo excluya y volver**: el fijo **vuelve tildado/destildado como estaba** — el cambio de rango no reescribe la selección.

*Superficie de excluidos:*
- [ ] Con rango **3 meses** el carril del comando muestra el chip **`Info` + "{N} sin evolución"** con el número en mono; con un rango largo donde todos los fijos tienen ≥2 apariciones, **el chip no existe**.
- [ ] Clickearlo abre un **popover** con encabezado "Sin evolución en el rango" + "Con menos de dos apariciones no hay evolución que dibujar.", y una lista de ítems con **descripción** (sin swatch cuadrado ni mini-línea a la izquierda) + sublínea **`● {Categoría} · desde {Mmm AAAA}`**, con el punto redondo de 6px en el color **de la categoría** tal cual (cotejable con `/categorias`).
- [ ] Los ítems **no son clickeables**: no se tildan, no cambian de aspecto al pasar el puntero y **no destacan nada en el canvas**.
- [ ] Un **calculado excluido** se distingue por el glifo **`↳`** antes de la descripción (sin mini-línea dasheada: no hay línea).
- [ ] La lista está ordenada **del mes de inicio más reciente al más viejo**.
- [ ] Con muchos excluidos (rango 3 meses en un usuario con historial), la lista **scrollea dentro del popover** (tope ~240px) con fade inferior; **la card no crece a lo alto** por tener excluidos.
- [ ] El popover cierra con **Esc**, click fuera y re-clic en el disparador, y **flipea hacia arriba** si no hay lugar abajo.

*Destacado por hover:*
- [ ] Pasar el puntero por un **ítem de leyenda** (o por una línea) **destaca esa línea** (más gruesa, opacidad plena, por encima) y **atenúa el resto a ~0.18**; salir lo revierte y **la selección no cambia**.
- [ ] El destacado también se dispara con **foco de teclado** sobre el ítem.
- [ ] Con `prefers-reduced-motion` el destacado es **instantáneo**.

*Tooltip:*
- [ ] **Sin línea destacada**, el tooltip del mes lista las líneas con punto ese mes (swatch + descripción + cifra mono), ordenadas de mayor a menor, **con tope de 8 filas + "+N más"**, y **sin fila de total**.
- [ ] **Con línea destacada**, el tooltip muestra **descripción, categoría, mes, monto y frecuencia**, y en un calculado además **`↳ desde {Origen}`**. La categoría lleva delante su **punto redondo de 6px en el color de la categoría** (no el de la línea); el swatch/mini-línea del encabezado sí es el color de la línea.
- [ ] **Sin línea destacada**, el swatch de cada fila es el **color de su línea**; las filas no muestran categoría.

*Estados (todos hablan del RANGO, ninguno de un año):*
- [ ] **Rango sin fijos:** se ven las posiciones del eje X y el overlay "Sin fijos en el rango." + "Probá un rango más largo."; **no** queda un carril de leyenda huérfano.
- [ ] **Ningún fijo con dos apariciones** (rango 3 meses en un usuario sin fijos mensuales vigentes): overlay "Ningún fijo tiene dos apariciones en el rango." + "Alargá el rango para ver su evolución.", **sin** leyenda-filtro pero **con** el carril mostrando el **disparador de excluidos** (la información sigue alcanzable).
- [ ] **Ningún fijo seleccionado:** ejes completos, sin líneas, overlay "Ningún fijo seleccionado." + "Elegí uno en la lista de abajo."; la leyenda **no se bloquea**.
- [ ] **Ajustada por inflación sin nada computable** (chip encendido): "Sin variación ajustada en el rango." + "Probá sin el ajuste por inflación." — y **apagar el chip efectivamente dibuja** las líneas en Variación nominal (la salida que promete el copy es real).
- [ ] **Variación nominal sin nada computable** (chip apagado): "Sin variación computable en el rango." + "Faltan datos para comparar cada pago con el anterior."
- [ ] **Carga:** skeleton de canvas + **5 chips fantasma en 2 renglones**; al llegar el dato el layout **no salta**.
- [ ] **Error:** `AlertTriangle` ámbar + "No se pudo cargar el reporte." + "Reintentar".
- [ ] **Modo orden:** la card colapsa al mini con ícono **`Repeat`** y etiqueta **"Detalle histórico de fijos"**; **no** se renderiza ningún control interno (ni tabs, ni chip, ni select de rango, ni leyenda, ni excluidos).

*Contención y modos de color:*
- [ ] **600px con sidebar abierto (352 de contenido) y el rango en `5 años`** — el checkpoint crítico: sin **scroll horizontal del `body`**; el eje X rotula **solo los eneros** sin superponerse ni rotar; las verticales de año siguen ahí; el canvas **no** se ve como una masa de puntos.
- [ ] **600px sidebar cerrado y abierto:** la línea 2 de la cabecera envuelve; el select de rango conserva su **rótulo completo** (no se reduce a ícono); `LegendAllChip`, excluidos y contador siguen visibles; ninguna cifra del tooltip se trunca.
- [ ] **600px sidebar abierto:** el **popover de excluidos** y el **popover del select de rango** se ven **enteros**, no se cortan contra el borde y flipean si hace falta.
- [ ] **941px y 1288px:** canvas a 300px, cabecera en su forma amplia, sin banda muerta al costado; con `5 años` los rótulos van de a 6 meses.
- [ ] **Claro y oscuro:** con ≥12 líneas visibles (los 12 colores de `FX`), **ninguna se funde con el fondo** en ninguno de los dos modos y los colores **son los mismos** en los dos; **los tramos atenuados al 35% siguen siendo visibles** en ambos; ejes, gridlines, verticales de año, baseline y tooltip cambian con sus tokens.
