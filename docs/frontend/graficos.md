# Frontend — Pantalla de gráficos `/reportes` (RF-REP-001..017)

Cards de `/reportes` (ingresos/gastos, apilado por categoría, grilla anual de Únicos, gantt anual de Cuotas, Inflación vs Ingresos, detalle histórico de fijos) y widget del dashboard. Spec visual en `docs/design.md`; acá arquitectura y gotchas técnicos.

## Arquitectura en dos capas (enfoque shadcn charts)

El gráfico se separa en una **primitiva reutilizable** (motor de charting) y **tarjetas de feature** que la componen.

- **Primitiva `components/ui/chart.tsx`** — estilo shadcn charts sobre **Recharts v3**, themeada con los tokens del DS (CSS vars `oklch`). Exporta `ChartContainer` (wrapper de `ResponsiveContainer` + theming), `ChartTooltipContent` y `ChartLegend`.
- **Dos tarjetas autónomas en `components/charts/report-card.tsx`**, cada una con su cabecera, gráfico, leyenda, tooltip y estados (skeleton / con datos / vacío / meses futuros / error):
  - **`IncomeExpenseCard`** (`income-expense`, "Ingresos vs Gastos") — **Total-only**: `AreaChart` con ingresos y gastos superpuestos. Sin sub-vista por categoría ni tabs, **sin** leyenda interactiva de series: la **dirección** es el único control de cuántas líneas dibuja (ambos = 2; solo gastos / solo ingresos = 1). En `/reportes` monta los **filtros de cómputo** (RF-REP-014) y su footer es la **leyenda-filtro de categorías**; ver §Filtros de la card income-expense.
  - **`ByCategoryCard`** (`by-category`, "Gastos por categoría") — apilado por categoría con `category.color`, con **toggle de representación** `categoryChartMode`: `"bar"` (default) = `BarChart` apilado; `"line"` = áreas apiladas con línea de contorno `--expense` = total de gasto. El backend no distingue barra de línea (mismo array `categories`). Config de la card en `docs/data-model/preferencias.md` §`reports`.
  - **La leyenda-filtro de categorías ES el filtro (RF-REP-002).** `by-category` e `income-expense` usan la **leyenda interactiva del footer** (`ChartLegend`) como filtro de **categorías** (`categoryIds`, 3 estados); ninguna tiene `CategoryFilterPopover` propio. El stepper de año (pill `‹ año ›`) va embebido. El componente recibe el estado (`year`, `categoryIds`, `categoryChartMode`) y los callbacks por props; el anfitrión decide si es **persistido** (`/reportes`) o **efímero** (dashboard).

- **`ChartLegend` (`components/ui/chart.tsx`) tiene dos modos:**
  - **Decorativo** — solo color + label.
  - **Interactivo** — con `hiddenIds` / `onToggle` / `groupLabel`: ítems como `<button aria-pressed>` dentro de un `role="group"`, con estado apagado para el oculto.
  - Para la leyenda-filtro de categorías acepta **`scrollable`** (región de alto máximo ≈3 renglones con scroll interno y fade) y **`commandSlot`** (control en un carril fijo debajo del scroll — el atajo "Todas/Ninguna", `LegendAllChip`). El `role="group"` envuelve solo los chips.
  - La leyenda de **series** Ingresos/Gastos sobrevive solo en la **card del dashboard**, decorativa (fila plana sin `scrollable` ni `commandSlot`).

## Stepper de año — rango del endpoint y corrección automática (gotcha estructural)

El estado de las flechas ‹ › y la corrección del año fuera de rango viven en **`components/ui/chart.tsx`** (`getYearStepperState` + `useYearRangeAutoCorrect`), compartidos por las cards con stepper. Se alimentan del **`yearRange` del propio endpoint** (contrato en `docs/data-model/informes.md` §Rango de años navegable; regla en RF-REP-002): el front **no** deriva límites por su cuenta. `yearRange === null` → ambas flechas deshabilitadas.

El hook **no aplica** la corrección: la **emite** por el callback de cambio de año del padre.

**Gotcha — bucle infinito de updates si el efecto depende de la identidad del callback.** En `/reportes` el padre aplica el año de forma **asíncrona** (lo persiste) y pasa un callback **recreado en cada render**. Un efecto que dependa de esa identidad se re-dispara con cada re-render que la persistencia provoca, re-emite la corrección y tumba la página (`Maximum update depth exceeded`). Por eso el hook:

- guarda el callback en un **ref** y depende **solo de primitivos** (`year`, `minYear`, `maxYear`) — cada respuesta trae un objeto `yearRange` nuevo aunque los límites no cambien;
- **no re-emite la misma corrección** mientras no se refleje en la prop `year`.

En el dashboard la condición no se da (setter local estable y síncrono).

## Datos (`use-reports`)

- **`useReports(year, categoryIds, currency, movementTypes, direction, includeSimulated)`** sobre `GET /movements/reports`. Solo lectura; **`enabled: isAuthenticated`**. **No recibe `projectFixed`/`today`**: ninguna pantalla consume la proyección de fijos (RF-REP-015); el corte de "mes futuro" del aporte simulado lo resuelve el backend con su propio `today`.
- **`REPORTS_QUERY_KEY` tiene 7 elementos:** `["reports", year, categoriesKey, currency, movementTypesKey, direction, includeSimulated]` (`includeSimulated` normalizado: `undefined` → `false`). Cada dimensión que altera la respuesta va en la key.
- **`includeSimulated` solo se manda cuando es `true`**; `false`/`undefined` omiten el param (request byte-idéntica a la de una card sin la feature).
- **`placeholderData: keepPreviousData`:** al cambiar filtro o año el gráfico mantiene los datos previos; el skeleton aparece solo en la primera carga.
- **GOTCHA — el query param `categories` se construye por concatenación de string, NO con `URLSearchParams`.** El backend espera la coma **literal** (`categories=id1,id2`); `URLSearchParams` la encodea a `%2C`. Patrón para **cualquier endpoint que acepte listas separadas por coma**.
- Tipos en **`types/reports.ts`**: `ReportMovementsResponse` / `ReportMonth` / `ReportCategory`.
- **GOTCHA — las query keys de reportes no comparten un primer segmento.** Comparten el **prefijo de string** `reports*` (`reports`, `reports-unico-grid`, `reports-fixed-evolution`, …): `invalidateQueries({ queryKey: ["reports"] })` solo alcanza a `useReports`. Una mutación que invalida reportes usa el predicado **`isReportsQuery`** (`src/lib/reports-query.ts`): `invalidateQueries({ predicate: isReportsQuery })`.
- **Dedupe por query key:** varias invocaciones simultáneas de `useReports` con los mismos argumentos son **una sola request**.

## Filtros de la card income-expense (RF-REP-014)

Solo en `/reportes`. Filtros de **cómputo** —acotan qué movimientos alimentan las series, no son un desglose— persistidos en la entrada del blob `reports` (`movementTypes`, `direction`, `categoryIds`; shape en `docs/data-model/preferencias.md` §`reports`):

- **Dirección** — segmented (gastos / ingresos / ambos) → `direction`. Único control de cuántas líneas dibuja el canvas.
- **Tipo** — chips multi-selección (fijo / cuota / único) → `movementTypes`.
- **Categoría** — **leyenda-filtro tildable en el footer** (`ChartLegend` interactiva con `scrollable` + `commandSlot`) → `categoryIds` (`null` / `[]` / lista). Recibe las **categorías con actividad en el año** (`availableCategories`), no el universo completo.
  - **Las categorías no son de gasto ni de ingreso.** Una categoría puede participar en **ambas** líneas; cada ítem de `availableCategories` trae `hasExpense`/`hasIncome` (ver `docs/data-model/informes.md`).
  - **Universo por tipo de card:** `income-expense` muestra **todas** las categorías con movimiento en el año; `by-category`, **solo** las con gasto (`hasExpense === true`).
  - **El filtro restringe cada línea por sus propias categorías:** ocultar una categoría resta solo de la(s) línea(s) donde participa.
- **Gate `/reportes` vs. dashboard por `onDirectionChange`.** La presencia del callback distingue la card configurable (monta filtros y leyenda-filtro) de la del dashboard (sin filtros; leyenda decorativa de 2 series).
- **Sin `hiddenSeries`:** la dirección sola gobierna qué líneas se ven. El campo `hiddenSeries` está deprecado y la normalización del blob lo descarta en runtime para `income-expense` (ver `docs/data-model/preferencias.md` §`reports`).

## Aporte simulado en las cards (RF-REP-017)

Toggle por card en `income-expense` y `by-category`, persistido en `includeSimulated` de su entrada del blob `reports`. El backend devuelve el aporte **separado** del dato real (clave `simulated`); el front lo **apila/suma** al renderizar.

- **Universo de categorías fusionado.** Las bandas de `by-category` se arman sobre `data.categories` ∪ `data.simulated.categories` (el bloque simulado puede traer categorías sin gasto real en el año). La leyenda-filtro suma esas categorías al conjunto de `hasExpense` con el toggle encendido.
- **`null` vs `0` al mapear al chart.** Al volcar al `chartData` el `null` se traduce a `0` (la geometría necesita un número) y el `null` original se conserva aparte para decidir **si esa capa se dibuja**. Perder la distinción produce bandas fantasma de altura cero con contorno visible.

**Gotcha estructural — orden de pintado en las áreas apiladas (modo Línea de `by-category`).**

El bloque real y el simulado comparten `stackId`: **el simulado se pinta entero después del real**. En la **costura entre bloques**, la primera capa simulada tiene su baseline sobre el contorno del tope real; cuando esa categoría no aporta simulación, su curva **degenera a esa posición** y su separador `--panel` **ocluye** el trazo `--expense`.

Por eso el contorno del total real se dibuja **como serie propia, sin `stackId`, y como último hijo del chart**: queda siempre por encima de cualquier separador del bloque simulado. Usa el mismo `dataKey` del total de gasto real y `fill="none"`, y **solo se monta con el toggle encendido**.

- Un separador `--panel` intermedio es inocuo **dentro** de un bloque, pero **no** en la costura entre bloques.
- **Un test de atributos no detecta este defecto**: hay que verificar el **orden de pintado en el DOM**.

## Puntos de uso

- **Pantalla `/reportes` configurable por cards — `app/(app)/reportes/page.tsx`.** Arranca **vacía** (solo el recuadro "[+]"); el usuario agrega cards eligiendo el tipo y las quita. Año, filtros y demás config de cada card son **estado persistido**. El orden de las cards es el del array. **El año NO va en la URL** → sin `useSearchParams()` ni `<Suspense>`.
  - **Persistencia en la preferencia `reports`** (read-modify-write del blob, idéntico a `monthSections`): `setPreferences({ ...preferences, reports: ... })`. Shape (`ReportCardConfig[]`, `categoryIds: null = todas`) y normalización en `docs/data-model/preferencias.md` §`reports`; replicarla.
- **Dashboard (`dashboard-client.tsx`)** — monta **solo `IncomeExpenseCard`** con navegación de año **activa** y **sin filtros** (no pasa `onDirectionChange`). El año es **estado local** que **no persiste**. El resumen mensual sigue fijo en el mes en curso.
- **Sidebar** — link **"Reportes"** (`/reportes`), activo por `startsWith("/reportes")`, entre "Vista del mes" e "Historial".

## Gotchas técnicos (Recharts v3 + Tailwind v4 + DS)

- **CSS vars `oklch` directas en el SVG de Recharts:** `var(--token)` funciona en `stroke`, `fill` y `stopColor` de `<stop>`. No hace falta `getComputedStyle`.
- **Cifras tabulares (`tnum`):** `fontFeatureSettings` **no existe** en el tipo de tick SVG; el `tnum` se delega a la CSS var **`--mono`** (IBM Plex Mono).
- **Recharts 3.x + TypeScript strict:** `TooltipPayload` es **`readonly`** → el tooltip custom requiere **doble cast** (`as unknown as Array<...>`). El prop `label` es `string | number | undefined`.
- **`dot` de `<Area>` con render custom — cast obligatorio:** el tipo TS lo declara `boolean`; un renderer custom exige **`as unknown as boolean`**.
- **Alto responsive — por prop `height`, no CSS var:** Recharts necesita el alto numérico en `height`. Se resuelve con **dos `<div>` + media queries** (`[@media(max-width:940px)]:hidden` / `[@media(min-width:941px)]:hidden`).
- **`prefers-reduced-motion`:** las tarjetas usan un detector interno; en tests requiere el mock de `matchMedia` (`docs/frontend/base.md` §Testing — gotchas).

## Card `unique-grid` — grilla anual de gastos Únicos (RF-REP-010)

`ReportCardType = "unique-grid"`. Grilla anual día × mes sobre `GET /movements/reports/annual-unicos` (contrato en `docs/data-model/informes.md` §Contrato de reporte anual de Únicos).

- **Tabla semántica + CSS Grid, NO Recharts.** En `/reportes` conviven varias formas de render; no asumir que toda card pasa por `components/ui/chart.tsx`.
- **Días inexistentes — distinguir por calendario, no por valor.** El contrato envía `0` tanto para un día sin gasto como para uno inexistente (30/feb). El front los separa con `getDaysInMonth(year, month)`: el inexistente se pinta **nulo**, distinto de un `$0` real (tinte de piso).
- **Escala de color anclada a `colorAnchorCents` del response:** `t = clamp(total / colorAnchorCents, 0, 1)`. El front no calcula ni hardcodea el ancla.
- **Techo editable por card — el front NUNCA calcula TC (gotcha estructural).** Editable desde la card (RF-REP-010), vía `ColorAnchorTrigger` + `ColorAnchorPopover` en `unique-grid-card.tsx`. El front persiste `anchorUsdCents` en la card y en **cada** fetch manda `anchorAmountCents=<anchorUsdCents>&anchorCurrency=USD`. Al editar, manda el `(monto, moneda)` **tipeado** y **persiste el `anchorUsdCents` que devuelve el backend**. Prellenado del editor = `colorAnchorCents`. **No** hay "Restablecer al estándar": el default (15 USD) es la ausencia de `anchorUsdCents` en el blob.
- **`today`** con la fecha local del usuario (`YYYY-MM-DD`), para el divisor del promedio del mes en curso.
- **Tooltip de celda — desglose por categoría** desde `breakdown[day-1][month-1]`. El breakdown llega **sin `name`/`color`**: se resuelven por `categoryId` contra `availableCategories`. El hover del footer despliega las cinco métricas del mes.

## Card `installment-gantt` — gantt anual de gastos en Cuotas (RF-REP-011)

`ReportCardType = "installment-gantt"`. Gantt sobre `GET /movements/reports/annual-cuotas` (contrato en `docs/data-model/informes.md` §Contrato de reporte anual de Cuotas).

- **CSS nativo, NO Recharts.** Barras con **`position: absolute`** (`left`/`width` en % por mes) sobre una grilla de 12 columnas.
- **Inversión del eje.** `rowIndex = 0` es el renglón **pegado al eje**; se renderiza **abajo** con `visualRowIndex = rowCount - 1 - rowIndex`. No reordenar `bars`.
- **Packing resuelto en el backend.** El front no recalcula colisiones; hace layout, clipping al borde del año y los indicadores ‹ / › (`continuesBefore`/`continuesAfter`).
- **Color/nombre por `categoryId`** contra `availableCategories`.
- **Tooltip con rango real:** `realStartMonth`/`realEndMonth`, **no** los índices clampeados del layout.
- **No manda `today`.**

## Card `inflation-income` — líneas de Inflación vs Ingresos (RF-REP-012)

`ReportCardType = "inflation-income"`. **`components/charts/inflation-income-card.tsx`**; hook **`useInflationIncome`** (`hooks/use-reports.ts`) sobre `GET /movements/reports/annual-inflation-income` (contrato en `docs/data-model/informes.md` §Contrato de reporte anual de Inflación vs Ingresos).

- **Recharts (líneas).** **Solo en `/reportes`.**
- **Tres series + dos tendencias.** `inflationPct`, `incomePct`, `incomePctAdj` en **puntos %**. Las tendencias se dibujan desde `incomeTrend.points` / `incomeAdjTrend.points` (el front no ajusta la recta; `points` `null` = sin tendencia). Cada tendencia **sigue la visibilidad de su serie madre** y no es ítem de la leyenda.
- **Toggle de series efímero** (estado local, default las tres visibles). `categoryIds` y `currency` sí se persisten.
- **Cabecera estándar de card anual:** título editable + stepper de año + filtro de categorías + selector de moneda. El universo del filtro es de **ingreso**.
- **Línea cortada en meses futuros:** `connectNulls={false}`.
- **Color de la inflación = token `--rate`** (ver `docs/frontend/base.md` §Design system).

## Card `fixed-evolution` — Detalle histórico de fijos (RF-REP-013)

`ReportCardType = "fixed-evolution"`. **`components/charts/fixed-evolution-card.tsx`**; hook **`useFixedEvolution`** (`hooks/use-reports.ts`) sobre `GET /movements/reports/fijos-historico` (contrato en `docs/data-model/informes.md` §Contrato del detalle histórico de Fijos).

- **En `/reportes` y, acotada, en la vista evolución de `MovementDetailCard`; no en el dashboard.**
- **Variante acotada — prop `chainId` (RF-VM-009).** Con `chainId`:
  - se ignoran `currency`, `title`, `mode`, `adjusted`, `selectedIds`, `chartHeight` y `removable`;
  - el rango es **controlado por el padre** (`EvolutionView`), no persistido;
  - canvas fijo de **240px**, **sin `ChartResponsiveArea`**; cadencia de rótulos fija en "amplio";
  - la única línea va en destacado permanente.
- **Gotcha — skeleton al cambiar el rango en la variante acotada.** `useFixedEvolution` usa `keepPreviousData`; la variante acotada lee `isPlaceholderData` para mostrar skeleton en vez de la línea del rango anterior.
- **Gotcha — el `ResizeObserver` del `slot` del plot depende de `showMeasuredArea`.** El panel del canvas solo existe después de la carga; con deps vacías el observer se engancha antes y el `slot` queda medido en 0.
- **Recharts (líneas)**, una por cadena de fijo.
- **Sin filtro de categorías:** la **selección por fijo** (`fixedSelectedIds`, por `chainId`) lo reemplaza, aplicada **client-side** sobre `data.lines`.
- **Sin chip de simulados** y **sin marcas ni popover de límites**.
- **Los tres valores de cada punto llegan calculados** (monto, `nominalPct`, `adjustedPct`): el front elige según `fixedMode`/`fixedAdjusted`. Las variaciones son **contra el pago anterior de la línea**; el front no sabe de qué mes es ese pago ni de qué mes falta el IPC, así que los copys de esos huecos no pueden nombrar un mes.
- **El color se ancla en `ordinal`, no en el índice del array** (`lines` se reordena por total del rango). Regla de color en `docs/design.md`.
- **Select de rango en lugar del stepper de año.** Ocho opciones (3/6/9 meses y 1 a 5 años), **default 3 años**, persistidas en **`fixedRangeMonths`** de la clave `reports` (ausente = `36`). Sin `YearStepper`; el campo `year` de su config es inerte.
- **`rangeMonths` de la respuesta es el EFECTIVO y nunca se escribe de vuelta en la preferencia:** se persiste el **pedido**, si no la preferencia se degradaría sola.
- **Eje X de largo variable (3 a 60 posiciones):** cada punto se ubica por su `month`; la serie nunca pasa del mes en curso.
- **`today`** con la fecha local del usuario.
- **Toggle "Mostrar calculados" (RF-REP-013) — filtro client-side, sin refetch.** Se parte de `rawLines`/`rawExcluded` (lo que trae el response):
  - la **visibilidad del chip** se evalúa sobre lo **crudo**, antes de filtrar;
  - gráfico, leyenda, contador `N / M`, excluidos y tooltip usan lo **filtrado**.
- **`fixedSelectedIds` se define sobre el universo completo, incluidos los calculados ocultos.** Por eso destildar/retildar con el toggle apagado conserva la tilde del calculado.
- **"Todas"/"Ninguna" escriben `null`/`[]` sobre todo el universo, incluidos los calculados ocultos** — intencional, ver RF-REP-013 (`docs/requirements/informes.md` §Toggle "Mostrar calculados").
- **`fixedShowCalculated` se omite del config cuando es `false`** (igual que `fixedAdjusted`).
- **`highlightedId` ignora un `hoveredId` que no está entre las líneas visibles.** Si no, al apagar el toggle con hover sobre un calculado el gráfico queda atenuado.
- **Ítem de leyenda de un calculado:** `max-w-full` en el ítem + `min-w-0` en los segmentos truncables; sin eso, con `<main>` angosto desborda la leyenda.

## Gotchas de las cards de gráficos

Valen para **cualquier** card:

- **Rótulo final del eje de categorías — `margin.right` mínimo, vía `CHART_END_LABEL_MARGIN`.** Con `interval={0}` el último tick cae en el borde del área de trazado y, con `textAnchor="middle"`, su mitad derecha se corta. La constante compartida **`CHART_END_LABEL_MARGIN`** (`components/ui/chart.tsx`) la usan todos los charts Recharts de `/reportes`; un chart nuevo la usa, no un `margin.right` ad-hoc.
- **`ChartResponsiveArea` monta DOS canvas en paralelo** (300 px y 220 px; uno oculto por container query). **jsdom no evalúa container queries**: en tests los `data-testid` del gráfico aparecen **DUPLICADOS** → `getAllBy*()[0]`, nunca `getBy*`.
- **Recharts está mockeado en la suite de charts.** Render y animación reales no se ejercitan: los defectos de esa capa se detectan en el **QA visual** (skill `.claude/skills/qa-visual/SKILL.md`).
