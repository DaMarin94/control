# Backend — Reportes (MovementsModule, `/movements/reports*`)

Endpoints agregados de la pantalla `/reportes` (RF-REP-001..017) y de la vista evolución de un fijo (RF-VM-009), scopeados por `userId` del JWT (RN-003). Contratos (params y shapes) en `docs/data-model/informes.md`; acá, cómo se calcula. Frontend en `docs/frontend/graficos.md`.

**Transversal a todos los reportes:**
- **Bucketeo RN-015**, mismo criterio que `GET /movements` (`docs/backend/movimientos-mes.md`): únicos por su mes local (`AT TIME ZONE` de su zona propia); fijos por actividad + `isOnFrequency` (`docs/backend/fijos.md` §Cálculo de aparición); cuotas por `startMonth <= mes < addMonths(startMonth, totalInstallments)`.
- **Conversión a la moneda de display** (`currency` del param, o la default del usuario) con re-ruteo por pivote USD y la tabla de referencia del mes (`pivotRatesForYear` / `deriveExchangeRate`).
- **Exclusión de anulados.** Un movimiento `skipped` queda fuera de **todas** las agregaciones (totales del mes, `income-expense`, `by-category`, reportes anuales), para únicos, cuotas, fijos y sus calculados (heredan el skip del origen; RN-020). Única excepción: el gantt de Cuotas (§Reporte anual de Cuotas).
- **Unidad de inflación.** `InflationRate.monthlyVariation` es la **unidad canónica: puntos porcentuales** (`3.5` = 3,5 %). La serie de INDEC (`apis.datos.gob.ar`) entrega **fracción** (`0.035`); la ingesta la convierte **×100 al persistir**, antes de cotas y circuit breaker, así DB, validaciones y comparaciones quedan en puntos %. Los cálculos ajustados usan `inflationPct/100`.

## Serie de reportes (`GET /movements/reports`)

Totales por mes y gasto mensual por categoría para un año (RF-REP-001/002/005) — **no** devuelve movimientos individuales. Shape (`ReportMovementsResponse` / `ReportMonth` / `ReportCategory`), invariante de consistencia y reglas de `months` / `categories` / `earliestYear` en `docs/data-model/informes.md` §Contrato de serie de reportes.

- **`year` (`YYYY`) obligatorio:** exactamente **4 dígitos**, rango **1900–2200**; si no → `400`.
- **`categories`** (CSV de `categoryId`s) opcional: **omitido = todas**. El front manda la **coma literal** (`categories=id1,id2`).
- **`currency`** opcional (override de display, RF-REP-007): una de las 4 monedas, **case-sensitive**. `displayCurrency = currencyOverride ?? userSettings.defaultCurrency`. **Presente vacío o fuera del set → `400`.**
- **`types` y `direction`** opcionales (RF-REP-014): `types` (CSV de `fijo`/`cuota`/`unico`, 3 estados igual que `categories`; fuera del set → `400`) y `direction` (`expense`/`income`/`both`, default `both`; fuera del set → `400`). Mapeo persistencia→query en `docs/data-model/informes.md`.
- **`includeSimulated`** opcional (RF-REP-017): §Aporte simulado.
- **`projectFixed` y `today`** opcionales (RF-REP-015): `projectFixed=true` activa la proyección; cualquier otro valor = off. `today` (`YYYY-MM-DD`) fija el corte real/proyectado (ausente = ahora UTC). **Capacidad retenida: ningún consumidor del frontend manda estos params.**

### Cómo se computa cada parte

- **`months[*]` (12 meses).** `incomeCents` / `expenseCents` suman **únicos + fijos activos + cuotas activas** con el bucketeo RN-015, excluyendo anulados (`Transaction.skipped`, `skippedMonths.has(mes)`, `InstallmentSkip` del mes).
- **`categories[*]`.** **No filtra por `Category.deletedAt`** (incluye soft-deleted con gasto histórico). Orden por gasto anual DESC, desempate `categoryId` ASC.
- **`earliestYear`.** Mínimo entre el año local de cualquier único y el año del `startMonth` de cualquier fijo o cuota; `null` sin movimientos.
- **`availableCategories`.** Universo de categorías con gasto `EXPENSE` del año, **independiente del filtro `categories`**: superconjunto estable para la leyenda-filtro. Incluye soft-deleted; orden por gasto anual DESC, desempate `categoryId` ASC.

### Filtro de categorías (RF-REP-005)

- **Afecta Forma 1 y Forma 2:** `months[*]` (`incomeCents`/`expenseCents`) **y** `categories[*]` (bandas apiladas).
- **`earliestYear` y `availableCategories` lo IGNORAN** (la leyenda-filtro no se achica). **`yearRange` sí lo respeta.**
- **Filtrado in-memory, NO en SQL/ORM:** se trae el universo del año y se filtra en JS con un **`Set` de `categoryId`s**. El invariante `SUM(bandas por categoría) == expenseCents del mes` **se mantiene con el filtro activo**.

### Filtros de tipo y dirección (RF-REP-014)

Sobre los **totales mensuales**, combinables (AND) con el de categorías, con el criterio de imputación de RN-015:

- **Tipo** — `Set` de `["fijo","cuota","unico"]` (`null` = todos, `Set` vacío = ninguno → totales en cero, subconjunto = los pedidos).
- **Dirección** — `both` (sin filtro) / `expense` / `income`.
- **Solo totales.** Afectan `months[*]`; `categories[*]`, `availableCategories` y `earliestYear` los **ignoran**. **`yearRange` sí los respeta.**
- **Gotcha — dirección y tipo de un calculado se resuelven al vuelo, no por la fila origen:**
  - La **dirección** la fija su `derivedType` (signo tras `formulaSign`), no el `type` del origen: un calculado puede **invertir** el signo.
  - El **tipo** se **hereda de la fuente**: calculado-de-fijo cuenta como `fijo`, de cuota como `cuota`, de único como `unico`.

### Aporte simulado (RF-REP-017)

Con `includeSimulated=true` se agrega el bloque `simulated`, delegando en `SimulationsService` (`docs/backend/simulacion.md` §Los reportes ven simulaciones solo si se las piden). **Ortogonal** a la proyección de fijos: comparten solo el `today` que decide qué mes es futuro.

### Proyección de fijos a futuro (RF-REP-015) — capacidad retenida, no consumida por el frontend

Motor en `src/common/projection.helper.ts` (`computeFixedBasketProjection`; ver `docs/backend/simulacion.md` §Infraestructura de proyección compartida). Con `projectFixed=true`, los meses **posteriores a `today`** se marcan `projected: true` y suman la proyección de fijos. Sin el param, todos `projected: false`.

- **Solo fijos** (cuotas y únicos no se extienden). Fijos de gasto → `expenseCents`; de ingreso → `incomeCents`. El mes futuro de cada línea vale **solo** el proyectado de fijos.
- **Método — por línea:** `valor_línea(m) = canasta_conocida(m) × (1 + tasa_precio)^m` (m = meses hacia adelante desde hoy), compuesto, sin truncar intermedios; redondeo solo al final.
- **`canasta_conocida(m)`** — suma de los fijos en alcance **activos en `m`** (RN-016), cada uno a su **último monto conocido** (segmento vigente de su cadena, RN-005). Fijos normales y calculados-de-fijo. Altas futuras, bajas (`deletedFrom`) y cadencia entran acá de forma determinista, **no** vía la tasa.
- **`tasa_precio`** — por línea, sobre las cadenas **activas hoy**. Por cadena `i`: `old_i` = su **monto más viejo en `[hoy-12 .. hoy-1]`** a `n_i` meses, `today_i` = monto de hoy; `growth_i = (today_i / old_i)^(1/n_i) − 1`. `tasa_precio = Σ(today_i · growth_i) / Σ(today_i)` sobre las cadenas con historia previa. Sin monto previo en la ventana o con `old_i <= 0` → **excluida de la tasa** (sigue en la canasta).
- **Piso en 0:** `max(0, tasa_precio)`. Sin cadenas con historia previa, `tasa_precio = 0`.
- **Racional:** mide el crecimiento real de cada fijo sobre su propia historia, ponderado por tamaño; los planos aportan ~0 y las altas no inflan la tasa.
- **Sin IPC:** no usa `InflationRate` en ningún caso.
- **Skips:** no cuentan para la tasa; sí afectan la canasta (mes skippeado aporta 0).
- **Moneda:** todo sobre la serie en **moneda de display** (montos convertidos con el TC de sus meses); el crecimiento no reconvierte (no hay TC futuros).
- **Horizonte ilimitado:** un año completamente futuro ⇒ 12 meses proyectados.
- **Respeta `direction` / `types` / `categories`** en canasta y tasa.
- **Gotcha:** con `projectFixed=true`, `categories[*]` **no** recibe contribución de fijos en meses proyectados (solo los totales de línea).

## Rango de años navegable por card (`yearRange`)

Compartido por los **4 endpoints con stepper de año** (`/movements/reports`, `annual-unicos`, `annual-cuotas`, `annual-inflation-income`). Regla en RF-REP-002; contrato en `docs/data-model/informes.md` §Rango de años navegable. Lo no obvio:

- **Se combinan INTERVALOS por fuente, no sets de años.** Un **único** aporta 1 año (local, RN-015); una **fila de fijo/calculado**, de su `startMonth` a su cierre (**sin fin** si sigue activa); un **grupo de cuotas**, su tramo. Rango final = unión de punta a punta, clampeada a la cota técnica.
- **No hace falta resolver bordes de cadena:** el split cierra la fila vieja, cada fila `Recurring` es un **tramo contiguo y no solapado**.
- **Los skips NO se descuentan:** el rango mide **existencia de dato**, no si suma.
- **El aporte simulado es una fuente más, solo en `/movements/reports`** con `includeSimulated=true`: cada simulación aporta su tramo vía `SimulationsService`. **No aportan** las **pausadas** ni las que el filtro excluye (categoría fuera de `categories`, o `types` sin `unico`). Tramo clampeado al **mismo tope técnico** (extender una simulación no tiene tope propio).
- **Dirección del aporte simulado:** con `both`, cada simulación aporta su **tramo completo**; con `expense` / `income` se derivan los simulados y aportan **solo los años de meses cuya dirección derivada** (RN-019) coincide. Con `both` un año puede quedar navegable aunque su remanente dé cero.
- **La dirección de un calculado se aproxima por el signo de su fórmula**, no por el monto mes a mes: deliberado para límites de navegación. Caso borde no cubierto: una **resta cuyo operando cruza cero** en el tiempo.
- **La query de la historia de años de únicos usa el ORM, NO SQL crudo.** Los e2e consumen las llamadas crudas como una **cola ordenada compartida**: una cruda más desalinea las secuencias de los otros endpoints. El año local se resuelve en JS, con el mismo resultado que `AT TIME ZONE`.

## Reporte anual de Únicos (`GET /movements/reports/annual-unicos`)

Grilla día × mes y footer mensual para la card `unique-grid` (RF-REP-010). Contrato (`AnnualUnicosResponse` / `AnnualUnicosFooter`) en `docs/data-model/informes.md` §Contrato de reporte anual de Únicos.

- **Solo Únicos `EXPENSE`.** Fijos, cuotas y calculados **no entran**.
- **Bucketeo día/mes por la zona propia del registro** (RN-015).
- **Grilla 31 × 12 (`grid[day-1][month-1]`)** en centavos de `currency`. Un día inexistente (30/feb) queda en **0** (el front lo resuelve por calendario).
- **`breakdown[day-1][month-1]`** — desglose por categoría (`{ categoryId, amount }`, DESC) de cada día; sin `name`/`color` (los resuelve el front por `availableCategories`).
- **Divisor de `dailyAvg`:** mes **en curso** → **día actual** (de `today`; sin `today`, `new Date()` UTC); mes **terminado** → días del mes; mes **futuro** → `null`.
- **`pctVsPrev`:** `ROUNDDOWN((promDiarioActual × 100 / promDiarioPrevio) − 100, 2)` — **trunca hacia cero**. El previo de **enero es diciembre del año anterior** (consulta fuera del año pedido). `promDiarioPrevio == 0` → `null`.
- **`inflationPct`:** `InflationRate.monthlyVariation` del mes (puntos %); `null` sin fila de IPC.
- **`pctVsPrevAdj`:** como `pctVsPrev`, con el promedio previo **inflado por el IPC del mes en curso**. `null` si falta el IPC o el promedio previo es 0.
- **Ancla de la escala de color (`anchorUsdCents` / `colorAnchorCents`).** Editable por card (RF-REP-010) vía `anchorAmountCents` + `anchorCurrency` (all-or-nothing). `getAnnualUnicosReport`: (1) convierte `(anchorAmountCents, anchorCurrency) → USD cents` con el TC de **enero del año pedido** (`pivotRatesForYear` + `deriveExchangeRate`; USD passthrough; **`Math.round`**; **sin `ReferenceRate` de enero → `1500`**). Sin override, `1500` (15 USD). Se emite en `anchorUsdCents`. (2) Reconvierte a `currency` con el mismo TC → `colorAnchorCents`. Es tope de la rampa de color, no una cotización de negocio.

## Reporte anual de Cuotas (`GET /movements/reports/annual-cuotas`)

Gantt anual para la card `installment-gantt` (RF-REP-011). **No usa `today`.** Contrato (`CuotasGanttResponse` / `CuotasGanttBar`) en `docs/data-model/informes.md` §Contrato de reporte anual de Cuotas.

- **Solo cuotas `EXPENSE` que intersectan el año** (empiezan antes y siguen dentro, o empiezan dentro). Fijos, únicos y calculados no entran.
- **Filtro de categorías antes del packing** (3 estados, RF-REP-002).
- **Packing:** barras ordenadas por `startMonth` ASC (desempate `createdAt` ASC); `rowIndex` desde `0` (pegado al eje). Una barra **reusa** un renglón si **no entra en conflicto con ninguno** de sus intervalos —conflicto = menos de 1 mes de descanso a cualquier lado—, **aprovechando huecos intermedios**. Se elige el renglón **más bajo** que la admita; si ninguno, uno nuevo. El front invierte el eje al renderizar (`docs/frontend/graficos.md` §Card `installment-gantt`).
- **Rango real:** `realStartMonth`/`realEndMonth` (`YYYY-MM`) = período **completo** del plan, **sin recortar al año** (≠ `startMonthIndex`/`endMonthIndex`, clampeados a 0–11); lo usa el tooltip.
- **Conversión del monto por cuota — TC del primer mes visible:** `startMonth` dentro del año → TC de ese mes; anterior → TC de `YYYY-01`. Vía `pivotRatesForYear` con clamp al mes disponible.
- **Gotcha estructural — el gantt NO considera los skips de cuotas.** Una barra por plan con monto estático por cuota: la anulación de una instancia (`InstallmentSkip`, RF-MC-004) no mapea. Deliberado, no es un bug: el gantt muestra la estructura del plan, no la imputación mensual.

## Reporte anual de Inflación vs Ingresos (`GET /movements/reports/annual-inflation-income`)

Series en **puntos porcentuales** para la card `inflation-income` (RF-REP-012). Contrato (`AnnualInflationIncomeResponse` / `InflationIncomeMonth` / `TrendLine`) en `docs/data-model/informes.md` §Contrato de reporte anual de Inflación vs Ingresos.

- **Ingreso del mes (insumo):** movimientos **`INCOME`** del mes (únicos por mes local + fijos/cuotas a nivel mes), convertidos a display. El **mes en curso** usa el total **a la fecha** (`today`); los **futuros** no se computan (`incomePct`/`incomePctAdj` → `null`). El repo expone **`getUnicosIncomeForMonth`** para únicos; fijos y cuotas vía sus services.
- **`incomePct`:** `ROUNDDOWN((ingresoActual × 100 / ingresoPrevio) − 100, 2)`, **trunca hacia cero**. El previo de **enero es diciembre del año anterior**. `null` si `ingresoPrevio == 0` o mes futuro.
- **`incomePctAdj`:** como `incomePct`, con el ingreso previo **inflado por el IPC del mes en curso**. `null` si falta el IPC, `ingresoPrevio == 0` o mes futuro.
- **`inflationPct`:** `InflationRate.monthlyVariation` del mes; `null` sin fila.
- **Tendencias OLS (`incomeTrend` / `incomeAdjTrend`):** mínimos cuadrados sobre los **puntos no nulos** (x = mes 0–11). `{ slope, intercept, points }`; `points` = recta en los 12 meses, **`null` con < 2 puntos no nulos**. Helper exportado **`computeLinearTrend`** — reusarlo.
- **`earliestYear` y `availableCategories` ignoran `categories`**. `availableCategories` = categorías con **ingreso** del año (no gasto). `categories` sí restringe las series y `yearRange`.

## Detalle histórico de Fijos (`GET /movements/reports/fijos-historico`)

Serie de **los últimos `rangeMonths` meses hasta el mes en curso**, **por fijo**, para la card `fixed-evolution` (RF-REP-013) y su variante acotada (RF-VM-009). **No acepta `categories`.** Contrato (`FijosHistoricoResponse` / `FixedEvolutionLine` / `FixedEvolutionMonthPoint` / `FixedEvolutionExcludedLine`) en `docs/data-model/informes.md` §Contrato del detalle histórico de Fijos.

- **Alcance:** tipo Fijo de ambas direcciones, excluyendo `deletedAt`. Sin únicos ni cuotas. Cada línea y excluido lleva el `type` de su cadena; un calculado de fijo es siempre `EXPENSE`.
- **`chainId` — se computa el universo completo y recién después se filtra** sobre `lines` / `excluded`, para que `ordinal` y el recorte izquierdo sean los mismos que sin `chainId`. El `404` (cadena inexistente, ajena, eliminada o calculado de único/cuota) se resuelve contra la carga de fijos ya hecha, sin query extra.
- **El rango se ancla al presente y solo se estira hacia atrás:** `endMonth` = mes en curso (con `today`); izquierdo = ese mes − (`rangeMonths` − 1). Sin navegación.
- **Ningún punto posterior al mes en curso**, aunque sea conocido o proyectable: el reporte es **histórico**. Es una decisión — no extender la serie a futuro.
- **Recorte izquierdo contra el primer mes con aparición del universo completo** (fijos de ambas direcciones + calculados de fijo), también con `chainId`. Si se pide más rango que historia, el rango sale **más corto**; el borde derecho no se corre. La respuesta devuelve el rango **efectivo** (`startMonth`, `endMonth`, `rangeMonths`), contra el que se dimensionan los `months`.
- **La unidad es la CADENA (`chainId`), no la fila.** Los splits (RN-005) se recomponen en **una serie**: cada mes toma el monto de la fila que lo cubre; el cambio entre splits es el **escalón**. Aparición con el criterio único (`docs/backend/fijos.md` §Cálculo de aparición).
- **Huecos con causa:** sin aparición → `amountCents: null` + `reason` (`frequency`, `skipped`, `beforeStart`, `afterEnd`, `resultedIncome`). Un **`0` con `reason: null` es un punto real** (RN-018); la ausencia nunca se emite como cero.
- **Calculados de fijo como líneas propias** (`isCalculated: true`): solo los meses en que resultan `EXPENSE` (RN-018), por su **magnitud** (RN-019); un mes `INCOME` va como hueco `resultedIncome`. Calculados de único y de cuota **no** entran.
- **Origen de un calculado sin queries extra:** `originDescription` / `originChainId` se resuelven contra el **universo completo de `Recurring`** ya cargado, no contra `lines` (el `sourceChainId` puede apuntar a una cadena ausente de `lines`). Fallback a la categoría del origen: `docs/data-model/informes.md` §Contrato del detalle histórico de Fijos.
  - **Gotcha estructural:** si el origen es totalmente irresoluble (cadena eliminada por completo), el calculado queda **sin monto en ningún mes** y sale por **`excluded`**. Por eso **una línea de `lines` nunca tiene `originDescription: null`**.
- **Conversión mes a mes** con el TC de **su** mes. **Las variaciones se calculan sobre los montos YA convertidos.**
- **Variaciones entre PAGOS CONSECUTIVOS de la cadena, no entre meses consecutivos.** El término de comparación es la **aparición previa** (monto no-null) de la misma línea; meses sin aparición por frecuencia y **anulados no cortan la cadena**. Para un mensual coincide con mes a mes. Racional: contra el mes de calendario anterior, toda cadena con `frequency > 1` quedaría sin puntos.
- **El pago anterior puede caer fuera del rango y se usa igual** (con la cotización de **su** mes); no viaja en la serie.
- **Gotcha — lookback interno de 24 meses (`VARIATION_LOOKBACK_MONTHS`)** hacia atrás del borde izquierdo efectivo, con cotizaciones e IPC de ese tramo. **24 = doble de la frecuencia máxima** (12, RF-MF-006): alcanza aun si el pago anterior de un anual estaba anulado. Interno, no se expone.
- **Cotizaciones e IPC se cargan por LISTA DE MESES** (rango efectivo + lookback), no por año calendario.
- **El mes en curso participa de la variación** (asimetría deliberada con `annual-inflation-income`): un fijo es **determinístico** (RN-016). `nominalPct` / `adjustedPct` solo son `null` por falta de pago anterior (o de IPC, en la ajustada).
- **`adjustedPct` = nominal menos el IPC ACUMULADO COMPUESTO** de los meses entre los dos pagos. **Todo o nada:** falta el IPC de **cualquier** mes del tramo → `null` (no se identifica cuál).
- **`lines` = cadenas con ≥2 apariciones GRAFICABLES** (monto no-null, incluido `0`; ningún hueco con `reason` cuenta). No depende del modo de visualización (del front). Orden por **total del rango** (magnitud) desc, desempate `chainId` asc, sin agrupar por dirección.
- **`excluded` = TODAS las cadenas de fijo** (gasto, ingreso, calculados de fijo) con 0 o 1 apariciones en el rango, con su `startMonth` — incluidas las de vigencia terminada y las de **alta futura**. Así un fijo que existe pero no dibuja sigue alcanzable.
- **`ordinal` se computa sobre el universo COMPLETO**, no sobre el rango: rank por la fila más antigua de cada cadena, **estable entre rangos** porque es la identidad con la que el front asigna color. Incluye ingresos y no cambia con `chainId`.
- **`MovementItem.evolutionAvailable` en `GET /movements` (RF-VM-009) — mismo criterio de aparición**, vía `resolveFixedChainMonth` (función de módulo en `movements.service.ts`), compartida con este reporte. Costo acotado:
  - una carga de fijos + skips por request (`getAllFijosForAnnual`), y **ninguna** si el mes no tiene ítems elegibles (fijo no calculado, no simulado);
  - cache por `chainId` dentro del request;
  - conteo con early-exit al llegar a 2;
  - propiedad **de la cadena**, no del mes consultado: el tope es el mes de `today`, no el mes pedido.
