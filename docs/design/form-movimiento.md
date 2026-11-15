# Form de movimiento — total del plan de cuotas, calculado, mes del monto base

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Superficie del modal de carga: `captura.md` / `overlays-modales.md`. Pertenece al grupo *Patrones de componentes vigentes*.

### Total del plan de cuotas — las tres superficies

Una compra en cuotas se registra por su **monto por cuota** (`InstallmentGroup.amountCents` es por cuota; las N cuotas son iguales). El total es **derivado y exacto** (`monto por cuota × cantidad de cuotas`, aritmética entera de centavos — sin redondeo, sin contrato nuevo) y se muestra en **tres superficies**: card de detalle de `/mes`, tooltip del gantt de Cuotas en `/reportes` y preview en vivo del form de cuotas. **La fila compacta de `/mes` NO lo muestra** (vistazo: `Cuota X/N` + monto de esa cuota).

**Reglas transversales:**

1. **El total nunca es la cifra dominante.** En cada superficie la protagonista es el **monto por cuota** (hero 30px de la card, cifra 13px/600 del tooltip, input 20px del form). El total entra **subordinado por tamaño y peso**.
2. **Rótulo único: "Total del plan"** — literal en las tres superficies. Descartados: "Total" a secas (ambiguo junto a "Progreso"), "Total del plan de cuotas" (redundante), "Total financiado" (registro contable; el modelo no tiene interés).
3. **Se omite cuando `total === 1`** en las superficies de **lectura** (card y tooltip). En el **form** el preview **no** se omite (aparecer/desaparecer mientras se tipea sería salto de layout).
4. **Sin línea de derivación en las superficies de lectura** (el `N` ya está en la fila vecina). En el **form sí** va la derivación (auditar la cuenta en vivo; antídoto contra "creí que el monto era el total").
5. **Moneda — el total NO se convierte.** Decisión de producto cerrada: en cross-rate el total va en la **moneda original** (`amountCents × total`), sin extrapolar la cotización del mes a todo el plan. Si la cifra **no está en la moneda default**, lleva el **chip neutro del código** (`--panel-3` / `--muted` / `--r-chip` / 11px·600·`.04em` / `mono`) a la derecha, con `aria-label="Total del plan en {código}"`. En el **tooltip del gantt no aplica** (la barra ya viene en la moneda de display).
6. **Reglas duras:** **mono tabular** siempre; **neutro** (`--ink` / `--ink-2`), **nunca** `--expense-ink`; **nunca** índigo.
7. **Informativo, no validado.** No bloquea guardar ni dispara error aunque supere `MAX_AMOUNT_CENTS` (el tope vive sobre el monto por cuota).

#### 1. Card de detalle de `/mes` — fila propia de la ficha

- **Forma: `DetailRow` propio.** (Descartados: sumarlo a "Plan de cuotas" — amontona tres hechos; sublínea muted bajo el valor — es para atributos del mismo dato y sub-pondera una cifra.)
- **Ubicación:** inmediatamente **debajo** de "Plan de cuotas", última fila de la ficha.
- **Rótulo:** `Total del plan` — rol *Meta*, 12.5px/500 `--muted`.
- **Valor:** `formatCurrency(Math.abs(amountCents) × installment.total, movement.currency)` — **mono tabular**, 13px, `--ink-2`, **sin signo**.
- **Cross-rate:** símbolo de su moneda (`US$240,00`) + **chip neutro `USD`** a la derecha. Sin nota extra.
- **`skipped` (anulado):** el total **no** lleva `line-through` (anular afecta *esa* cuota, no el plan).
- **Sin estados de carga/vacío/error:** si `origin !== "cuota"` o `installment === null` la fila no existe.

#### 2. Tooltip del gantt de Cuotas (`/reportes`)

- **Fila `label ⟷ valor`** **entre `Cuotas` y `Progreso`**. (Descartados: colgarlo de la cifra dominante; fusionarlo en `Cuotas`.)
- **Rótulo:** `Total del plan`, UI 11.5px/500 `--ink-2`, `flex-1 min-w-0`.
- **Valor:** `formatCurrency(bar.amountCents × bar.totalInstallments, currency)`, **mono `tnum` 11px/500 `--ink-2`**, `shrink-0 whitespace-nowrap`. La única cifra jerarquizada sigue siendo "por cuota" (13px/600 `--ink`).
- **Ancho:** `min-width: 200px` aguanta el caso normal; con cifras muy largas el tooltip **crece** — la cifra **nunca** se trunca ni se abrevia; cede el rótulo.
- **Omisión:** si `totalInstallments === 1`, la fila no se renderiza.
- **A11y:** el `aria-label` de la barra lleva `· total {monto}` cuando `totalInstallments > 1` (`frontend/src/components/charts/cuotas-gantt-card.tsx`).

#### 3. Form de cuotas — preview en vivo

- **Forma: tira read-only** con el molde del preview del *form de calculado* (`rounded-ctl border border-line bg-panel-2`), **sin `<Label>` propio arriba** (el rótulo va adentro). Padding `px-[13px] py-[10px]`.
- **Ubicación:** **después** del grid `Cant. de cuotas + Mes de inicio` y de su bloque de errores, **antes** de "Categoría". Ritmo `space-y-[14px]`.
- **Layout:** `flex flex-wrap items-center justify-between gap-x-[16px] gap-y-[4px]`.
  - **Izquierda — rótulo:** `Total del plan`, 12.5px/600 `--ink-2` `tracking-[0.01em]`.
  - **Derecha — bloque apilado** (`flex flex-col items-end gap-[2px] shrink-0`):
    - **Cifra:** `formatCurrency(montoCents × cantidad, currency)`, **mono tabular 16px/600 `--ink`**, `whitespace-nowrap`.
    - **Derivación:** `{N} × {monto por cuota}` (ej. `12 × $10.000,00`), mono 11.5px `--muted`.
  - **Cross-rate:** cifra y derivación con el **símbolo de la moneda elegida** + **chip neutro del código**. Sin equivalente en la default.
- **Estados:**
  - **Completo y válido** (monto > 0 **y** cantidad entera > 0): cifra + derivación.
  - **Vacío / parcial / inválido:** la tira **se mantiene visible** con **`—`** (mono 16px `--muted`), **sin** derivación. Cero salto de layout.
  - **Campo en error (zod):** igual que inválido (`—`). La tira **nunca** se tiñe (borde `--line`, sin rojo ni ring).
  - **`cantidad === 1`:** se muestra igual (`1 × $10.000,00` / `$10.000,00`). Asimetría deliberada con card/tooltip.
  - **Editar / duplicar:** refleja los valores precargados desde el montaje.
  - Sin skeleton: cálculo local instantáneo.

#### 4. Contención responsive (obligatoria)

Umbral `--bp-wide`; todo el régimen de app, checkpoint a 640px (392px de contenido con sidebar abierto).

- **Card:** `DetailRow` `flex-wrap` → si cifra + chip no entran, **envuelven** (inv. 4). Valor `inline-flex items-center gap-[6px] justify-end flex-wrap`, chip `shrink-0`, cifra `whitespace-nowrap` **nunca truncada**. Sin scroll horizontal (inv. 1); card completa por el `ModalShell` (inv. 2).
- **Tooltip:** portal `fixed`; rótulo `flex-1 min-w-0`, cifra `shrink-0 whitespace-nowrap`. Crece antes que romper la cifra.
- **Form:** la tira vive en el cuerpo scrolleable → **no empuja el footer** (inv. 3). En ancho mínimo, rótulo arriba y cifra abajo alineada a la derecha.

#### Checklist de aceptación visual — Total del plan de cuotas

- [ ] **Card — fila:** en un movimiento de origen cuota con `total > 1` aparece **"Total del plan"** justo debajo de "Plan de cuotas", valor mono tabular `--ink-2`, sin signo, y el número **coincide** con `monto por cuota × cantidad`.
- [ ] **Card — jerarquía:** el hero (monto de *esa* cuota) sigue siendo la única cifra grande; el total no está en verde/rojo ni en índigo ni en negrita grande.
- [ ] **Card — cross-rate:** el total sale en la **moneda original** (`US$240,00`) con **chip neutro `USD`**, y **no** es el resultado de multiplicar el monto convertido (comparar contra "Monto original" × cantidad).
- [ ] **Card — anulado:** con el movimiento anulado, el hero tiene `line-through` y el total **no**.
- [ ] **Card — `total === 1`:** la fila "Total del plan" **no** aparece.
- [ ] **Tooltip — orden:** las filas quedan `Período` → `Cuotas` → `Total del plan` → `Progreso`.
- [ ] **Tooltip — registro:** el total va en mono tabular 11px/500 `--ink-2`, igual que sus filas vecinas; la cifra "por cuota" sigue siendo la única dominante (13px/600).
- [ ] **Tooltip — ancho:** con montos largos el tooltip crece sin cortar la cifra ni desbordar; con `totalInstallments === 1` la fila no aparece.
- [ ] **Form — ubicación:** la tira "Total del plan" está entre el grid `Cant. de cuotas / Mes de inicio` y el bloque "Categoría".
- [ ] **Form — en vivo:** al tipear monto y cantidad, la cifra y la derivación `N × monto` se actualizan en cada pulsación y coinciden con la cuenta.
- [ ] **Form — parcial:** con solo el monto (o solo la cantidad) la tira muestra `—` en `--muted`, sin derivación, **sin** cambiar de alto ni desaparecer.
- [ ] **Form — error:** con el campo de monto o de cuotas en error, la tira sigue **neutra** (borde `--line`, sin rojo) y muestra `—`.
- [ ] **Form — cross-rate:** eligiendo USD en "Más opciones", la cifra pasa a `US$…` + chip `USD`, sin equivalente convertido.
- [ ] **Compacto (hasta 640/392px):** en las tres superficies la cifra del total **nunca** se trunca ni se abrevia; envuelve a su propia línea si hace falta; sin scroll horizontal del body; el footer del form sigue pineado.
- [ ] **Reglas duras:** total siempre en mono tabular, neutro (nunca `--expense-ink` ni índigo); moneda como cromo neutro.

### Form de movimiento calculado

El calculado **no es un tab** del modal: se abre en modo propio (sin tabs de tipo), título **"Nuevo / Editar movimiento calculado"**, reusando el chrome del modal (radio 18px, `--shadow-lg`, bloques `space-y-[14px]`). Orden de bloques: **Origen** (read-only) → **Fórmula** (operador + operando) → **Signo del resultado** → **Resultado** (preview read-only) → Categoría → Descripción. **No hay bloque "Tipo" ni "Monto"**: el monto se deriva y el tipo se deriva del signo del monto final (ver `fundamentos.md` *Paleta y uso de tokens* → tipo derivado del signo).

- **Origen (read-only):** caja `rounded-ctl border-line bg-panel-2`, glifo por tipo de origen (`Repeat`/`Receipt`/`CreditCard` 15px `--accent-ink`, ver `mes-listado.md` *Relación padre/calculado*) + nombre del origen (UI 14px/600 `--ink-2`) + a la derecha su tipo·frecuencia y, si está, el monto del origen del mes contexto (mono `--muted`). No editable.
- **Fórmula:** una fila `[Origen] [operador] [operando]` bajo un único `Label`. Operador = **segmented neutro de 5 celdas** (`+ − × ÷ %`, glifos 15px, thumb elevado `--panel`+`--shadow-sm`, **sin** color semántico). Operando = input numérico mono tabular, alineado a la derecha, `flex-1`; affordance según operador (prefijo `$` para `+`/`−`, sufijo `%` para `%`, factor para `×`/`÷`). El bloque puede llevar una **sub-fila subordinada** — *Mes del monto base* — **solo** con origen **fijo**.
- **Signo del resultado:** **segmented neutro de 2 celdas** (Positivo `Plus` / Negativo `Minus`), **sin** color semántico.
- **Resultado (preview read-only, en vivo):** caja `rounded-ctl border-line bg-panel-2`. Izquierda: expresión legible (`--muted` mono). Derecha, apiladas: **cifra** mono tabular (16–18px/600) con color por tipo y signo (`−$…` / `$0,00`), y debajo el **badge de tipo derivado** ("Gasto" `--expense-ink`/`--expense-soft`, "Ingreso" `--income-ink`/`--income-soft`). Cifra y badge concuerdan siempre; recalculan en vivo.
- **Validación operando 0 con `÷`/`%`:** input en error (borde `--expense` + ring `--expense-soft` + mensaje `--expense-ink`), Guardar deshabilitado y Resultado muestra "Operando inválido" sin cifra ni badge. Con `+`/`−`/`×` el 0 es válido. El `--expense` acá es color de error de UI, no monto.
- **Editar:** Origen read-only (vínculo inmutable); Operador, Operando, Signo, Categoría, Descripción editables, precargados.

### Mes del monto base del calculado (desfasaje 0..12) — las tres superficies

Por defecto la **base** de un calculado es el monto de su origen **del mismo mes**; el desfasaje (entero **0..12**, `0` = mismo mes, `1` = mes anterior) permite que la base salga de **N meses atrás** (ej.: aguinaldo de diciembre sobre el sueldo de noviembre). **Solo calculados de origen fijo.**

**Invariante rector — cero impacto con desfasaje `0`.** Con `0` (el default) **ninguna superficie de lectura cambia**: fila de `/mes`, card de detalle y preview del form. El único elemento que existe siempre —solo en origen fijo— es la sub-fila del form, que en default se lee como un ajuste en reposo.

**Por qué el dato es visible cuando `> 0`.** Un calculado con base desfasada muestra un monto que **no se explica** mirando el origen de ese mes (parece un error de cálculo). Aparece en las dos superficies donde la contradicción es visible (fila y card) y en ninguna más.

**Vocabulario único.** El concepto es **"monto base"** y el dato es **un mes**. Meses con `formatMonthShort` (`Nov 2026`), **no en mono**:

| N | Opción del selector | Ayuda del form | Fila de `/mes` / card |
|---|---|---|---|
| 0 | El mismo mes | Usa el monto del origen del mismo mes. | *(no se muestra)* |
| 1 | El mes anterior | En {Mmm AAAA} usa el monto de {Mmm AAAA}. | `de {Mmm AAAA}` / `Monto base: {Mmm AAAA}` |
| 2..12 | `{N} meses antes` | ídem | ídem |

Registro híbrido, mismo criterio que *Frecuencia del fijo*. **Orden estricto 0→12**, sin opción vacía. **No** se enumera con el número crudo.

#### 1. Form de calculado — sub-fila subordinada del bloque Fórmula

- **Ubicación: dentro del bloque "Fórmula"**, **sub-fila** debajo de `[Origen][operador][operando]` y **debajo del mensaje de error del operando**, antes de "Signo del resultado". (Descartados: bloque propio con `Label` — le da rango de Signo/Categoría; chip "Origen" convertido en dropdown — target diminuto.)
- **La subordinación se construye con el rótulo, no escondiendo el campo.** Rótulo en registro **Meta** (12.5px/500 **`--muted`**), **no** `Label` de bloque (12.5px/600 `--ink-2`). (Descartado: disclosure progresivo — esconde el control que explica el concepto.)
- **Rótulo: "Mes del monto base"** (`min-w-0 truncate`). (Descartados: "Mes de referencia", "Desfasaje"/"Offset".)
- **Control: `Select` nativo, variante compacta**, alineado a la derecha. Molde `.input.select` (fondo `--panel`, borde `1.5px --line-strong`, `--r-ctl`, caret del DS, focus ring `--accent-soft` 3px) con **alto ~36px**, **texto 13px/500 `--ink`** Space Grotesk (**no mono**), y **ancho intrínseco** (`w-auto max-w-full`). **13 `<option>`**, orden 0→12, default **0 / "El mismo mes"**, sin placeholder. (Select nativo por el mismo motivo que la frecuencia.)
- **Ayuda — línea siempre presente, debajo de la sub-fila.** 12px `leading-snug` `--muted`, **sin glifo**. Una sola línea en los dos estados → **cero salto de layout**.
  - **`N = 0`:** `Usa el monto del origen del mismo mes.`
  - **`N ≥ 1`:** `En {mes del calculado} usa el monto de {mes base}.` con **meses reales** y el **mes base en `--ink-2`** (resto `--muted`).
- **Visibilidad: solo origen fijo.** Con origen **único** o **cuota** la sub-fila y su ayuda **no se renderizan** (ni deshabilitadas). En crear y en editar.
- **Estados.** *Default (`0`)*: cromo neutro, sin badge ni acento. *`> 0`*: **ninguna decoración extra sobre el control** — la señal la dan la ayuda y el preview. *Focus/hover/disabled*: los del `Select` del DS.
- **Validación: no existe estado de error propio** (13 opciones fijas: el inválido es inconstruible). El único rojo del form sigue siendo el operando `0` con `÷`/`%`.
- **Preview "Resultado" — no puede mentir.** Con `N ≥ 1` la celda izquierda pasa a `flex flex-col items-start min-w-0`:
  - **Línea 1:** la expresión legible (`--muted`, mono, `truncate`).
  - **Línea 2 (solo `N ≥ 1`):** `Monto base: {Mmm AAAA}` — 11.5px `--muted`, no mono.
  - **Si el monto base de ese mes no está disponible**, el preview cae en su **estado `—`** (cifra `—` `--muted`, sin badge) y la expresión en forma abstracta (`10% del monto de Nov 2026`). **Nunca** una cifra calculada sobre el mes equivocado.

#### 2. Fila de `/mes` — cola del segmento "↳ desde {Origen}"

**Va en la zona de identidad**, no en el cluster de estados (las banderas son binarias y esconderían el mes tras un hover) ni en la col 3 (se leería como "cuándo ocurrió").

- **Forma: cola del segmento 5** de identidad, **solo si el desfasaje es `> 0`**: `↳ desde {Origen} de {Mmm AAAA}` — `de ` en `--muted`, el mes en `--ink-2`, 12px, **no mono**, `shrink-0 whitespace-nowrap`.
- **Año siempre presente** (`Nov 2026`): con desfasaje 12 el nombre del mes coincide con el del mes en curso.
- **Contención:** el mes es `shrink-0` y **nunca trunca**; el **nombre del origen** `min-w-0 truncate` cede primero.
- **Con desfasaje `0` la fila no cambia.**

#### 3. Card de detalle — sublínea del bloque "Fórmula"

- **Solo si el desfasaje es `> 0`:** en la caja de **Fórmula**, la celda izquierda apila expresión + **sublínea** `Monto base: {Mmm AAAA}` (11.5px `--muted`, no mono, `min-w-0`). Mismo par del preview del form.
- **La caja "Origen" no cambia.**
- **El bloque "Calculados" de la card del origen no cambia.**
- **La cifra del resultado y el badge de tipo derivado no se tocan.**

#### 4. Contención responsive (obligatoria)

Umbral `--bp-wide`; todo el régimen de app, checkpoint a 640px (392px con sidebar abierto) y piso de 600px. **Este form no existe en régimen de captura** (se abre desde el kebab de `/mes`).

- **Sub-fila del form:** `flex flex-wrap items-center justify-between gap-x-[10px] gap-y-[6px]`. Si no entran en una línea, el **selector envuelve** a su propia línea, a la derecha, `max-w-full`. El rótulo cede primero. El `<select>` nativo despliega con el mecanismo del sistema.
- **Ayuda:** envuelve a dos líneas si hace falta; no trunca.
- **Modal:** sub-fila + ayuda suman ~46px al cuerpo **scrolleable**; footer **pineado**.
- **Fila de `/mes`:** mes `shrink-0 whitespace-nowrap`; el nombre del origen trunca antes.
- **Card:** la sublínea vive en la celda izquierda `min-w-0`; la **cifra del resultado** sigue `shrink-0` y **nunca se trunca**.

#### 5. Cumplimiento de reglas duras

- **R1:** el desfasaje **no** usa verde/rojo — no es tipo.
- **R2:** índigo solo como focus ring del selector.
- **R3:** el desfasaje **no es dinero** → meses en Space Grotesk, **no** mono. Las cifras siguen en mono tabular.

#### Checklist de aceptación visual — Mes del monto base

- [ ] **Cero impacto con `0`:** un calculado con desfasaje `0` se ve **igual** que sin la feature en la fila de `/mes`, en la card de detalle y en el preview del form (sin sublínea, sin cola de mes).
- [ ] **Solo origen fijo:** en el form de un calculado de origen **único** o **cuota** la sub-fila "Mes del monto base" **no aparece** (ni deshabilitada); en uno de origen **fijo** aparece siempre, en crear y en editar.
- [ ] **Ubicación:** la sub-fila está **dentro del bloque "Fórmula"**, debajo del operador/operando (y de su mensaje de error), **antes** de "Signo del resultado".
- [ ] **Subordinación:** el rótulo va en `--muted` 12.5px/500 (más liviano que los `Label` "Fórmula"/"Signo"/"Categoría", que son `--ink-2` 600) y el selector es **compacto y de ancho intrínseco**, no full-width.
- [ ] **Opciones:** 13 en orden `El mismo mes` → `El mes anterior` → `2 meses antes` → … → `12 meses antes`, sin opción vacía, con `El mismo mes` preseleccionado al crear.
- [ ] **Ayuda en vivo:** con `0` dice "Usa el monto del origen del mismo mes."; al elegir "El mes anterior" pasa a "En {mes visualizado} usa el monto de {mes anterior}" con **meses reales**, y el alto de la línea **no cambia** (sin salto de layout).
- [ ] **Sin estado de error:** no hay forma de dejar el campo inválido; nunca aparece borde rojo, mensaje ni Guardar deshabilitado por este campo.
- [ ] **Preview honesto:** con desfasaje `> 0` la caja "Resultado" muestra la sublínea `Monto base: {Mmm AAAA}`; si el monto base de ese mes no está disponible, muestra `—` y **no** una cifra calculada sobre el mes en curso.
- [ ] **Fila de `/mes`:** un calculado con desfasaje `> 0` lee `↳ desde {Origen} de {Mmm AAAA}` (con **año**), mes en `--ink-2`, no mono; al angostar, el **nombre del origen trunca antes** y el mes queda entero.
- [ ] **Card de detalle:** el bloque "Fórmula" muestra `Monto base: {Mmm AAAA}` bajo la expresión; la caja "Origen" y el bloque "Calculados" **no cambian**.
- [ ] **Reglas duras:** los meses **no** van en mono ni en verde/rojo/índigo; todas las cifras siguen en mono tabular con su color por tipo.
- [ ] **Compacto (940 → 640/392px, y piso 600px):** el selector envuelve a su propia línea sin desbordar, la ayuda envuelve sin truncar, el footer del modal sigue pineado y no hay scroll horizontal del `body`.
