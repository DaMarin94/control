# Contratos de reportes

> Parte del modelo de datos de Control. Índice: `docs/data-model.md`. Reglas funcionales: módulo 3.9 (`docs/requirements/informes.md`). Config persistida de las cards (clave `reports`): `preferencias.md`. Filtro `categories`: `filtro-categorias.md`.

## Contrato de serie de reportes (respuesta de `GET /movements/reports`)

`GET /movements/reports?year=YYYY&categories=<id1,id2,...>` devuelve, dentro del sobre `{ success, statusCode, data }`, la serie **anual agregada** del usuario para los reportes (RF-REP-001/002): ingreso/gasto por mes y el gasto mensual desglosado por categoría (`categories`). **No** devuelve movimientos individuales. Reutiliza el mismo criterio de bucketeo que el contrato mensual (RN-015), sin reglas de zona propias. Detalle de implementación en `docs/backend/graficos.md` §Serie de reportes.

**Query params:**

- **`year`** (requerido) — el año a graficar.
- **`categories`** (opcional) — filtro por categoría, **tres estados** (tabla en `filtro-categorias.md`, compartida con `GET /movements`): **ausente = todas**, **`categories=` (presente y vacío) = ninguna** (serie en cero), **lista `id1,id2` = subconjunto**. Lista de `categoryId`s **separados por comas, sin URL-encode** (ej. `categories=abc,def`). El front lo deriva del `categoryIds` de la card (`null` → omite el param; `[]` → `categories=` vacío; lista → la serializa). El filtro afecta **ambos tipos**: en `income-expense`, qué categorías cuentan en `incomeCents`/`expenseCents` por mes; en `by-category`, qué categorías se desglosan.
- **`currency`** (opcional) — override de la moneda de display de la serie (RF-REP-007), una de las 4 monedas (RF-CUR-001), **case-sensitive**. **Ausente → la serie se convierte a la `defaultCurrency` del usuario** (comportamiento por defecto). **Presente y válido → la serie se convierte a esa moneda** (override del display). **Presente vacío o valor fuera del set → `400`.** Es **capa de display** (misma semántica que cambiar la default: no toca ningún movimiento guardado). El **shape de la respuesta no varía con el param**: la serie viene convertida a la moneda pedida; el cliente conoce la moneda que envió. El front lo deriva del campo `currency` de la card (omite el param cuando la card no tiene moneda propia).
- **`types`** (opcional, CSV) — filtro por **tipo de movimiento** (RF-REP-014), **tres estados** (análogo a `categories`): **ausente = todos los tipos**; **`types=` (presente y vacío) = ninguno** (totales en cero); **lista `fijo,cuota` = subconjunto**. Valores válidos: `fijo` | `cuota` | `unico`, separados por comas **sin URL-encode**; cualquier otro valor → `400`. Acota qué tipos suman a `incomeCents`/`expenseCents` por mes. Combina **(AND)** con `categories` y `direction`. Lo usa solo la card `income-expense`.
- **`direction`** (opcional) — filtro de **dirección** (RF-REP-014): `expense` | `income` | `both`. **Ausente = `both`** (sin filtro). `expense` computa solo gastos; `income`, solo ingresos. Valor fuera del set → `400`. Combina **(AND)** con `categories` y `types`. Lo usa solo la card `income-expense`.
- **`projectFixed`** (opcional) — proyección de **fijos a futuro** (RF-REP-015): `"true"` activa la proyección; **ausente o cualquier otro valor = off** (respuesta idéntica a la de sin el param). Con `projectFixed=true` los meses futuros (posteriores a `today`) extienden las series proyectando solo los fijos (regla de cálculo en `docs/backend/graficos.md` §Proyección de fijos a futuro). **Capacidad retenida del backend: ningún consumidor la manda** (ninguna pantalla monta control de proyección).
- **`today`** (`YYYY-MM-DD`, opcional) — fecha "hoy" que marca qué meses son futuros. **Ausente = ahora UTC.** Solo es relevante con `projectFixed=true` y/o `includeSimulated=true`; sin ninguno de los dos no afecta la respuesta. Es el **único** insumo de "qué mes es futuro" para ambas capacidades: no hay param propio por capacidad.
- **`includeSimulated`** (opcional) — aporte de **movimientos simulados** (RF-REP-017): `"true"` lo activa; **ausente o cualquier otro valor = off** (respuesta **idéntica** a la de sin el param: la clave `simulated` ni siquiera aparece). Con el flag, la respuesta suma la clave `simulated` (abajo), **amplía `availableCategories`** y puede **extender `yearRange`** (ver §Rango de años navegable). Es **independiente de `projectFixed`**: ni se implican ni se excluyen, y ninguno cambia el efecto del otro.
- **`availableCategories` y `earliestYear` son inmunes a los tres filtros** (`categories`, `types`, `direction`): se computan sobre todos los movimientos del año/usuario, para que la leyenda-filtro no se achique al filtrar. **`yearRange`, en cambio, sí respeta los tres** (ver §Rango de años navegable).
- **Mapeo persistencia→query** (el front deriva los params del blob de la card, `preferencias.md`): `movementTypes` ausente **o** los tres tipos → se **omite** `types`; `[]` → `types=` vacío; subconjunto → CSV. `direction` ausente **o** `both` → se **omite** `direction`; `expense`/`income` → el valor literal. `includeSimulated` `true` en el blob → `includeSimulated=true`; ausente/`false` → se **omite** el param. El front **no manda `projectFixed` ni `today`** (ninguna pantalla consume la proyección; `projectFixed` del blob queda inerte). (`categoryIds` → `categories` como se describe arriba.)

```
ReportsMovementsResponse = {
  year: number,                       // el año pedido
  months: ReportMonth[],              // SIEMPRE 12 entradas, ene→dic, en orden; filtradas al set pedido
  categories: ReportCategory[],       // desglose de GASTOS: solo categorías con gasto EXPENSE en el año, dentro del set pedido
  availableCategories: ReportsAvailableCategory[],  // universo de categorías con algún movimiento (gasto O ingreso) del año, SIN el filtro; cada ítem con hasExpense/hasIncome
  earliestYear: number | null,        // año más antiguo con algún movimiento del usuario; NO afectado por el filtro
  yearRange: YearRange | null,        // rango de años navegable de la card; SÍ respeta el filtro — ver §Rango de años navegable
  simulated?: ReportsSimulatedBlock   // SOLO con includeSimulated=true (RF-REP-017); ausente si no
}

// Rango de años navegable — mismo shape en los 4 endpoints de reportes con stepper de año.
YearRange = {
  minYear: number,
  maxYear: number
}

// RF-REP-017 — aporte simulado, SEPARADO del dato real: no está sumado en `months`/`categories`.
ReportsSimulatedBlock = {
  months: ReportSimulatedMonth[],       // SIEMPRE 12 entradas, mismo índice/orden que `months`
  categories: ReportSimulatedCategory[] // desglose de GASTO simulado; solo categorías con aporte
}

ReportSimulatedMonth = {
  month: string,                      // "YYYY-MM"
  incomeCents: number,                // aporte simulado de ingreso del mes; 0 = sin aporte
  expenseCents: number                // aporte simulado de gasto del mes; 0 = sin aporte
}

ReportSimulatedCategory = {
  categoryId: string,
  name: string,
  color: string,                      // "#rrggbb"
  monthlyExpenseCents: (number | null)[]  // 12 valores ene→dic; null = SIN aporte ese mes (≠ 0)
}

// Shape base de categoría disponible, compartido por los reportes anuales (annual-unicos, annual-cuotas, annual-inflation-income).
AvailableCategory = {
  categoryId: string,
  name: string,
  color: string                       // "#rrggbb"
}

// Extensión ESPECÍFICA de GET /movements/reports: el shape base + los dos flags de línea (no-opcionales).
ReportsAvailableCategory = AvailableCategory & {
  hasExpense: boolean,                // true si la categoría tuvo ≥1 gasto (EXPENSE) en el año; universo SIN el filtro `categories`
  hasIncome: boolean                  // true si tuvo ≥1 ingreso (INCOME) en el año; universo SIN el filtro `categories`
}

ReportMonth = {
  month: string,                      // "YYYY-MM"
  incomeCents: number,                // ingresos del mes CONVERTIDOS a la default vigente; únicos + fijos + cuotas, filtrado al set pedido
  expenseCents: number,               // gastos del mes CONVERTIDOS a la default vigente; ídem
  projected: boolean                  // true SOLO en meses futuros (> today) con projectFixed=true; sin la proyección, false en todos
}

ReportCategory = {
  categoryId: string,
  name: string,
  color: string,                      // "#rrggbb"
  monthlyExpenseCents: number[]       // 12 valores ene→dic CONVERTIDOS a la default vigente; 0 donde no hay gasto
}
```

> **Serie servida ya convertida.** Todos los `*Cents` de la serie de reportes vienen agregados con el **monto convertido** (`convertedAmountCents`) de cada movimiento a la **moneda de display** del request — el query param `currency` si está presente, o la **moneda default vigente** del usuario si no (RF-REP-007). Misma capa de display que `GET /movements` (ver `movimientos.md`). El endpoint **no** expone montos originales ni cotizaciones por movimiento (la serie es agregada, no trae ítems): la conversión se hace antes de sumar. Cambiar la `defaultCurrency` (o la moneda de la card) re-expresa toda la serie al vuelo, sin tocar lo guardado.

- **`months` — siempre 12, ene→dic.** Los meses sin datos (incluidos los **futuros** del año en curso) vienen con `incomeCents` / `expenseCents` en **cero**, nunca omitidos. Con filtro de categorías, los totales mensuales suman **solo los movimientos de las categorías pedidas** (un mes sin movimientos en el set queda en cero). El mes de cada movimiento se determina con el mismo bucketeo que el mensual (RN-015): únicos por la zona propia del registro (`AT TIME ZONE`), fijos y cuotas a nivel mes. Para los **fijos**, la serie respeta la **frecuencia** (un fijo solo se imputa a los meses que dicta su `frequency`, RF-MF-006 / RN-016) y **excluye los meses anulados** (RF-MF-005): un mes con skip no suma a ese mes del año.
- **`projected` — corte real vs. proyectado a futuro (RF-REP-015).** Con `projectFixed=true`, los meses posteriores a `today` vienen con `projected: true` y sus totales suman, además del dato real, la **proyección de los fijos a futuro** (solo fijos; cuotas y únicos no se extienden — regla de cálculo en `docs/backend/graficos.md` §Proyección de fijos a futuro). Los meses ≤ `today` vienen `projected: false`. Como ningún consumidor manda `projectFixed`, la respuesta trae `projected: false` en los 12 meses; el campo es parte del contrato retenido.
- **`categories` — desglose de gasto (`EXPENSE`), dentro del filtro.** Es el **único** desglose por categoría del contrato y es **solo de gastos** (`EXPENSE`). Una categoría aparece si tuvo gasto en algún mes del año, **está dentro del set pedido** (si hay filtro) e **incluye categorías soft-deleted** con gasto histórico (RF-CAT-004; el desglose no filtra por `deletedAt`). Orden: por **gasto anual total DESC**, desempate por `categoryId` ASC. Alimenta la card `by-category` (RF-REP-006) en **ambas representaciones** (barra y línea): mismo dato, distinta geometría de render.
- **`availableCategories` — universo estable de la leyenda-filtro, SIN el filtro, con flags por línea.** Universo de categorías con **algún movimiento (gasto `EXPENSE` o ingreso `INCOME`)** en el año, computado **ignorando el filtro `categories`** (es un **superconjunto** de `categories`). Cada ítem lleva **`hasExpense`/`hasIncome`** (no-opcionales), que indican si esa categoría tuvo al menos un movimiento de **esa línea** en el año, sobre el mismo universo estable (sin filtro). Una categoría puede tener ambos `true` (participa en gasto e ingreso). **Siempre presente**; `[]` si no hay ningún movimiento en el año. Incluye categorías **soft-deleted** con actividad histórica (no filtra por `deletedAt`). Orden: por **gasto anual DESC**, desempate por `categoryId` ASC. Es el universo que consumen las leyendas-filtro de las cards que sirve el endpoint (`income-expense` usa los dos flags; `by-category` filtra a `hasExpense === true` — ver `docs/frontend/graficos.md` §Filtros de la card income-expense): no se achica al filtrar, de modo que destildar una categoría no la quita de la leyenda. Los otros reportes anuales (`annual-unicos`, `annual-cuotas`, `annual-inflation-income`) devuelven el shape base `AvailableCategory` (`{ categoryId, name, color }`), **sin** estos flags. **Con `includeSimulated=true` el universo se amplía** (ver `simulated` abajo).
- **Invariante de consistencia.** Para cada mes `i`, la suma de `categories[*].monthlyExpenseCents[i]` **es igual a** `months[i].expenseCents`. El front puede confiar en que las bandas de gasto apiladas por categoría suman exactamente el total de gastos del mes (dentro del set filtrado). **Calculados:** la suma respeta la imputación por **magnitud al bucket del tipo derivado** de RN-019 — un movimiento calculado tiene `type` derivado del signo de su `amountCents` (RN-018), así que un calculado de monto negativo es `EXPENSE` y suma su **magnitud** (`\|amountCents\|`) tanto a `months[i].expenseCents` como a la banda `monthlyExpenseCents[i]` de su categoría, conservando la invariante. Como cada movimiento suma magnitud (nunca resta) al bucket que le corresponde, los totales y las bandas **no pueden quedar negativos** por la presencia de calculados.
- **`earliestYear` — NO afectado por el filtro.** Año más antiguo con **cualquier** movimiento del usuario (mínimo entre el año del mes local de cualquier único y el año del `startMonth` de cualquier fijo/cuota), **calculado sobre todos los movimientos, ignorando el filtro `categories`**; `null` si el usuario no tiene ningún movimiento. **No gobierna la navegación de año** —eso es `yearRange`— y **no tiene consumidor en el frontend**.
- **`yearRange`** — ver §Rango de años navegable (destino canónico, compartido con los tres reportes anuales).

**`simulated` — aporte simulado (RF-REP-017), solo con `includeSimulated=true`:**

- **Aditivo, no incorporado.** `months` y `categories` traen **solo lo real**: el bloque `simulated` es un segundo juego de series que el consumidor **suma o apila** sobre el real (`months[i] + simulated.months[i]`, banda real + banda simulada de la misma categoría). Lo real nunca se altera por el flag.
- **`null` ≠ `0` en `monthlyExpenseCents`.** `null` = **sin aporte simulado ese mes** (el consumidor no dibuja banda). El `0` no llega por esa vía: un aporte que redondea a exactamente 0 —o que se cancela por cambio de signo (RN-028)— se descarta aguas arriba y queda como ausencia.
- **`simulated.months` — siempre 12 entradas**, mismo índice y orden que `months`. `incomeCents`/`expenseCents` en **0** donde no hay aporte (mes pasado, fuera del tramo de todas las simulaciones, simulación pausada, remanente cancelado o dirección opuesta). El **mes en curso sí puede traer aporte**: es el arranque mínimo de cualquier tramo, y su aporte es el **remanente** del mes (RN-028), con lo que ese mes queda **mixto** (real a la fecha + remanente).
- **`simulated.categories` es solo `EXPENSE`.** Un simulado que resulta ingreso aporta a `simulated.months[i].incomeCents` y **no** genera entrada de categoría. Puede **incluir categorías ausentes de `categories[*]`** (una categoría sin gasto real en el año pero con aporte simulado). Orden: gasto simulado anual DESC, desempate por `categoryId` ASC.
- **`availableCategories` se amplía con el flag.** Una categoría con aporte **solo simulado** entra al universo/leyenda aunque no tenga movimientos reales en el año, con `hasExpense`/`hasIncome` según la **dirección derivada** de sus aportes. La ampliación **ignora los filtros** (`categories`, `types`, `direction`), igual que el universo real: es un superconjunto estable.
- **Los filtros de la card sí acotan `simulated`.** El simulado es un **único**: lo alcanzan `types` (entra con `unico`), `direction` (por su dirección derivada del mes) y `categories` (por su categoría simulada) — misma semántica que cualquier movimiento real.
- **Moneda de display.** El aporte simulado viene convertido a la **misma** moneda de display que el resto de la respuesta (el query param `currency`, o la default del usuario si no se manda).

---

## Rango de años navegable (`yearRange`)

> **Destino canónico** del campo. Lo devuelven, con el **mismo shape**, los **4 endpoints de reportes que alimentan cards con stepper de año**: `GET /movements/reports` (`income-expense` y `by-category`), `GET /movements/reports/annual-unicos`, `GET /movements/reports/annual-cuotas` y `GET /movements/reports/annual-inflation-income`. `GET /movements/reports/fijos-historico` **no** lo trae (esa card no navega años). Regla funcional en RF-REP-002, §Límites de navegación de año (`docs/requirements/informes.md`); cómputo en `docs/backend/graficos.md` §Rango de años navegable por card.

```
yearRange: YearRange | null

YearRange = {
  minYear: number,
  maxYear: number
}
```

- **Es el rango propio del dato que sirve cada endpoint**, no el universo de movimientos del usuario: cada card queda acotada a su propia información.
- **`null` = sin dato** con el filtro vigente (incluido el filtro de categorías en estado "ninguna"). El front congela el stepper —ambas flechas deshabilitadas— y **sigue graficando en cero**: el `null` no es un error ni cambia qué se dibuja.
- **Respeta el filtro** que recibe cada endpoint: `categories` en los tres reportes anuales; `categories` + `types` + `direction` en `GET /movements/reports`. Cambiar el filtro cambia el rango.
- **`includeSimulated` es otro insumo del rango, solo en `GET /movements/reports`** (el único endpoint que expone el flag, RF-REP-017; los otros tres no lo tienen y su rango no lo contempla). Con `includeSimulated=true`, los **tramos de las simulaciones activas** entran como una fuente de dato más, junto a únicos, fijos y cuotas, y **respetando el filtro vigente** (el simulado es un **único**: lo alcanzan `categories` por su categoría simulada, `types` —sin `unico` no aporta— y `direction`). Una simulación **pausada no aporta** (no deriva movimientos). Solo puede **extender `maxYear`**: una simulación nunca alcanza meses pasados, así que `minYear` no se mueve. Si **no hay dato real** con el filtro vigente pero alguna simulación aporta, el rango **no es `null`** — cubre el tramo simulado; es `null` cuando ninguna fuente aporta. Con el flag off, el rango se computa solo sobre dato real. El **shape no cambia**. Criterio de dirección del aporte en `docs/backend/graficos.md` §Rango de años navegable por card.
- **Rango continuo:** `[minYear, maxYear]` de punta a punta. Los años **sin dato propio dentro** del rango no se reportan como huecos y son navegables.
- **`maxYear` nunca supera el año en curso** en `annual-unicos` (los únicos no se repiten) y en `annual-inflation-income` (no hay IPC futuro). En `GET /movements/reports` y `annual-cuotas` **sí puede ser futuro** (un fijo activo sin fin y una cuota en tramo son dato real a futuro). Si ese recorte dejara el rango invertido, el campo vale **`null`**.
- **Cota técnica `[añoEnCurso − 100, añoEnCurso + 100]`**, derivada en runtime (nunca años literales): es lo que acota el extremo de un fijo activo sin fecha de fin, cuyo dato no termina nunca.

---

## Contrato de reporte anual de Únicos (respuesta de `GET /movements/reports/annual-unicos`)

`GET /movements/reports/annual-unicos?year=YYYY&categories=<...>&currency=XXX&today=YYYY-MM-DD&anchorAmountCents=N&anchorCurrency=XXX` devuelve, dentro del sobre `{ success, statusCode, data }`, la **grilla anual día × mes de gastos Únicos** y el **footer de métricas mensuales** que alimentan la card `unique-grid` (RF-REP-010). Solo agrega **movimientos Únicos de tipo gasto (`EXPENSE`)**: fijos, cuotas y calculados no entran. Es un endpoint **distinto** de `GET /movements/reports` (no comparte shape). Reglas de cálculo (divisor del promedio, fórmulas de %, ajuste por inflación) en `docs/backend/graficos.md` §Reporte anual de Únicos.

**Query params:**

- **`year`** (`YYYY`, requerido) — el año a graficar.
- **`categories`** (opcional) — filtro por categoría, **tres estados** (`filtro-categorias.md`): **ausente = todas**, **`categories=` (presente y vacío) = ninguna** (grilla en cero), **lista `id1,id2` = subconjunto**. Comas **sin URL-encode**. El front lo deriva del `categoryIds` de la card.
- **`currency`** (opcional) — override de la moneda de display de la grilla (RF-REP-007), una de las 4 monedas, **case-sensitive**. **Ausente → la default global del usuario**; **presente y válido → esa moneda**; **vacío o fuera del set → `400`**. Misma capa de display que el resto (no toca lo guardado).
- **`today`** (opcional, `YYYY-MM-DD`) — la **fecha local del usuario**, que el front envía para que el backend calcule el **divisor del promedio diario del mes en curso** (día actual) en la zona del usuario. **Si falta, el backend cae a `new Date()` (UTC).**
- **`anchorAmountCents`** + **`anchorCurrency`** (opcionales, **all-or-nothing**) — override del techo de la escala de color (RF-REP-010). `anchorAmountCents` = entero **> 0**, centavos de `anchorCurrency`; `anchorCurrency` = una de las 4 monedas (`ARS|USD|EUR|BRL`), **independiente del param `currency`** (que es la moneda de *display*). **Uno sin el otro → `400`.** **Ausentes ambos → default 15 USD.** El backend convierte `(anchorAmountCents, anchorCurrency) → USD cents` con el TC de enero del año pedido (ver `docs/backend/graficos.md` §Reporte anual de Únicos) y devuelve el resultado en `anchorUsdCents`.

```
AnnualUnicosResponse = {
  year: number,
  currency: "ARS" | "USD" | "EUR" | "BRL",   // moneda de display usada
  grid: number[][],                          // SIEMPRE 31 filas × 12 columnas; grid[day-1][month-1]
  breakdown: BreakdownCell[][][],            // misma indexación que grid: breakdown[day-1][month-1]
  footer: AnnualUnicosFooter[],              // SIEMPRE 12 entradas; índice = mes-1
  availableCategories: AvailableCategory[],  // universo del filtro (igual shape que en §Contrato de serie de reportes)
  anchorUsdCents: number,                    // ancla canónica en centavos de USD efectivamente usada (nunca null; default 1500)
  colorAnchorCents: number,                  // tope de la escala de color de las celdas, en centavos de display; ver abajo (nunca null)
  yearRange: YearRange | null                // rango de años navegable; ver §Rango de años navegable
}

BreakdownCell = { categoryId: string, amount: number }

AnnualUnicosFooter = {
  total: number,                  // total de gastos Únicos del mes, en centavos de `currency`
  dailyAvg: number | null,        // promedio diario; null si el mes es futuro
  pctVsPrev: number | null,       // % de diferencia del promedio diario vs. el mes anterior
  inflationPct: number | null,    // variación IPC (puntos %) del mes; null si no hay dato
  pctVsPrevAdj: number | null     // % vs. mes anterior ajustado por la inflación del mes en curso
}
```

donde `AvailableCategory = { categoryId, name, color }` (mismo shape que en §Contrato de serie de reportes).

- **`grid` — siempre 31 × 12.** `grid[day-1][month-1]` = total de gastos Únicos imputados a ese día y mes, en **centavos enteros** de `currency` (convertidos a la moneda de display). Vale **0** tanto si no hubo gasto **como** si el día **no existe** en el mes (ej. `grid[30][1]` = 30 de febrero): el contrato **no** distingue ambos casos — el front lo resuelve por calendario (ver `docs/frontend/graficos.md` §Card `unique-grid`). El bucketeo del día/mes usa la **zona propia de cada registro** (RN-015), igual que el resto de los reportes.
- **`breakdown` — desglose por categoría de cada celda.** Misma forma y misma indexación que `grid` (`breakdown[day-1][month-1]`): por cada celda, el detalle del gasto de **ese día** repartido por categoría. Cada ítem es `{ categoryId, amount }`, con `amount` en **centavos de `currency`** (misma conversión que `grid`/`total`), **ordenado por `amount` DESC**. Celda sin gasto y día inexistente → `[]`. **No trae `name` ni `color`:** el front resuelve la paleta y el nombre por `categoryId` contra `availableCategories`, que los expone; duplicarlos por celda repetiría la misma paleta N veces sin agregar información.
- **`footer` — siempre 12, índice = mes-1.** Una entrada por mes:
  - **`total`** — suma de gastos Únicos del mes (centavos de `currency`).
  - **`dailyAvg`** — `total` dividido por el divisor de días (día en curso si es el mes corriente del año en curso; días del mes si ya terminó; ver `docs/backend/graficos.md` §Reporte anual de Únicos). **`null` para un mes futuro.**
  - **`pctVsPrev`** — % de diferencia del promedio diario respecto del mes anterior (el de **enero** es **diciembre del año previo**). **`null`** si el promedio del mes anterior es cero.
  - **`inflationPct`** — `InflationRate.monthlyVariation` (puntos %) del mes. **`null`** si no hay dato de IPC.
  - **`pctVsPrevAdj`** — `pctVsPrev` ajustado: el promedio del mes anterior se infla por la variación IPC **del mes en curso** antes de comparar. **`null`** si falta el IPC, si el promedio anterior es cero, o si el mes en curso no tiene dato.
- **`availableCategories`** — universo del filtro: categorías con **gasto Único** del año, computado **sin** aplicar el filtro `categories` (superconjunto estable). Mismo criterio de estabilidad que en la serie de reportes; alimenta la leyenda-filtro de la card.
- **`anchorUsdCents`** — entero, **centavos de USD**. El ancla canónica en USD efectivamente usada para el cálculo: el override `(anchorAmountCents, anchorCurrency)` convertido a USD, o **`1500` (15 USD)** si no se pidió override. **Nunca `null`.** El front lo persiste tal cual en `anchorUsdCents` de la card (ver `docs/frontend/graficos.md` §Card `unique-grid`): es el valor que el back devuelve, no lo calcula el front.
- **`colorAnchorCents`** — entero, **centavos de `currency`**. Es `anchorUsdCents` reconvertido a la moneda de display con el TC de **enero del año del reporte** (mecanismo `pivotRatesForYear`, con clamp al mes disponible más cercano; si `currency` es USD, coincide con `anchorUsdCents`). **Nunca `null`.** Es el **tope de la escala de color** de las celdas de la grilla: el front pinta cada celda con `t = clamp(total / colorAnchorCents, 0, 1)`. Es referencia de **paleta visual**, **no** una cotización de negocio (no entra en totales ni conversiones).
- **`yearRange`** — rango navegable de la card, calculado sobre sus **gastos Únicos ya filtrados** (§Rango de años navegable). **`maxYear` nunca supera el año en curso.**
- **NO incluye `earliestYear`** (a diferencia de `GET /movements/reports`): este contrato no expone el primer año con movimientos del usuario, y no lo necesita.

---

## Contrato de reporte anual de Cuotas (respuesta de `GET /movements/reports/annual-cuotas`)

`GET /movements/reports/annual-cuotas?year=YYYY&categories=<...>&currency=XXX` devuelve, dentro del sobre `{ success, statusCode, data }`, el **gantt anual de gastos en Cuotas**: una barra horizontal por compra en cuotas que intersecta el año, ubicada en su rango de meses y empaquetada en renglones. Alimenta la card `installment-gantt` (RF-REP-011). Solo agrega **cuotas de tipo gasto (`EXPENSE`)**; es un endpoint **distinto** de `GET /movements/reports` y de `GET /movements/reports/annual-unicos` (no comparte shape). Reglas de cálculo (qué entra, packing, conversión del monto por cuota) en `docs/backend/graficos.md` §Reporte anual de Cuotas.

**Query params:**

- **`year`** (`YYYY`, requerido) — el año a graficar.
- **`categories`** (opcional) — filtro por categoría, **tres estados** (`filtro-categorias.md`): **ausente = todas**, **`categories=` = ninguna** (gantt vacío), **lista `id1,id2` = subconjunto**. Comas **sin URL-encode**. El front lo deriva del `categoryIds` de la card. **El filtro se aplica ANTES del packing** (los renglones se calculan sobre el subconjunto ya filtrado).
- **`currency`** (opcional) — override de la moneda de display (RF-REP-007), una de las 4 monedas, **case-sensitive**. **Ausente → la default global del usuario**; **presente y válido → esa moneda**; **vacío o fuera del set → `400`**.
- **NO usa `today`** (a diferencia de `annual-unicos`): el gantt no tiene métricas dependientes de la fecha local del usuario.

```
CuotasGanttResponse = {
  year: number,
  currency: "ARS" | "USD" | "EUR" | "BRL",   // moneda de display usada
  bars: CuotasGanttBar[],                     // ordenadas por rowIndex ASC, dentro por startMonthIndex ASC
  rowCount: number,                           // total de renglones; 0 si no hay barras
  availableCategories: AvailableCategory[],   // universo del filtro (igual shape que §Contrato de serie de reportes)
  yearRange: YearRange | null                 // rango de años navegable; ver §Rango de años navegable
}

CuotasGanttBar = {
  id: string,                  // id del movimiento de cuota
  description: string | null,  // descripción de la compra
  categoryId: string,          // para resolver name/color desde availableCategories
  amountCents: number,         // monto POR CUOTA, en centavos de `currency`
  startMonthIndex: number,     // mes de inicio visible en el año (0–11, 0 = enero)
  endMonthIndex: number,       // mes de fin visible en el año (0–11, INCLUSIVO)
  realStartMonth: string,      // "YYYY-MM" de la primera cuota del plan (período REAL, sin recortar al año)
  realEndMonth: string,        // "YYYY-MM" de la última cuota (= realStartMonth + totalInstallments - 1; sin recortar al año)
  continuesBefore: boolean,    // la compra empezó antes de enero del año (chevron ‹)
  continuesAfter: boolean,     // la compra termina después de diciembre del año (chevron ›)
  installmentFrom: number,     // nº de cuota (1-based) que cae en startMonthIndex
  installmentTo: number,       // nº de cuota (1-based) que cae en endMonthIndex
  totalInstallments: number,   // total de cuotas del plan
  rowIndex: number             // renglón asignado por el packing; 0 = pegado al eje, crece hacia arriba
}
```

donde `AvailableCategory = { categoryId, name, color }` (mismo shape que en §Contrato de serie de reportes).

- **`bars` — una barra por compra en cuotas que intersecta el año.** Cada barra es el tramo **visible** de un plan de cuotas dentro del año pedido: `startMonthIndex`/`endMonthIndex` son los meses (0–11) de inicio y fin **dentro del año** (clamp a ene/dic si el plan se extiende fuera), con `endMonthIndex` **inclusivo**. `continuesBefore`/`continuesAfter` marcan que el plan se prolonga fuera del año (el front pinta los chevrons ‹ / ›). `installmentFrom`/`installmentTo` son los números de cuota (1-based) que caen en el primer y último mes visible; `totalInstallments`, el largo del plan. `realStartMonth`/`realEndMonth` (`YYYY-MM`) son el **período REAL completo** de la compra —primera y última cuota del plan, **sin recortar al año pedido** (a diferencia de `startMonthIndex`/`endMonthIndex`, que sí se clampean a 0–11); pueden caer fuera del año visible y alimentan el rango del tooltip. **La barra NO trae `name` ni `color`:** el front los resuelve por `categoryId` contra `availableCategories`.
- **`amountCents` — monto por cuota, no total del plan.** En centavos de `currency`, convertido. La conversión usa el TC del **primer mes visible de la barra** (ver `docs/backend/graficos.md` §Reporte anual de Cuotas).
- **`rowIndex` y orden.** El backend resuelve el **packing** (asignación de renglones) y emite `bars` ordenado por `rowIndex` ASC y, dentro de cada renglón, por `startMonthIndex` ASC. `rowIndex = 0` es el renglón **pegado al eje**; crece hacia arriba. La **inversión visual** (renglón 0 abajo) la hace el front (ver `docs/frontend/graficos.md` §Card `installment-gantt`).
- **`rowCount`** — total de renglones ocupados; **0** si no hay barras (gantt vacío).
- **`availableCategories`** — universo del filtro: categorías con **cuota gasto** del año, computado **sin** aplicar el filtro `categories` (superconjunto estable). Mismo criterio que en la serie de reportes; alimenta la leyenda-filtro de la card.
- **`yearRange`** — rango navegable de la card, calculado sobre sus **cuotas gasto ya filtradas** (§Rango de años navegable). **`maxYear` puede ser futuro:** un plan en tramo ocupa meses de años por venir.
- **NO incluye `earliestYear`** (igual que `annual-unicos`): este contrato no expone el primer año con movimientos del usuario, y no lo necesita.

---

## Contrato de reporte anual de Inflación vs Ingresos (respuesta de `GET /movements/reports/annual-inflation-income`)

`GET /movements/reports/annual-inflation-income?year=YYYY&categories=<...>&currency=XXX&today=YYYY-MM-DD` devuelve, dentro del sobre `{ success, statusCode, data }`, las **series anuales de Inflación vs Ingresos** (12 meses) que alimentan la card `inflation-income` (RF-REP-012): la inflación IPC del mes, la variación mensual del total de **ingreso** (`INCOME`) y esa misma variación **ajustada por inflación**, más las **dos rectas de tendencia** (OLS) de las series de ingreso. Solo agrega movimientos de tipo **ingreso (`INCOME`)**. Es un endpoint **distinto** de `GET /movements/reports` y de los otros dos reportes anuales (no comparte shape). Reglas de cálculo (fórmulas de variación, ajuste por inflación, enero vs diciembre previo, tendencia OLS) en `docs/backend/graficos.md` §Reporte anual de Inflación vs Ingresos.

**Query params:**

- **`year`** (`YYYY`, requerido) — el año a graficar.
- **`categories`** (opcional) — filtro por categoría, **tres estados** (`filtro-categorias.md`): **ausente = todas**, **`categories=` = ninguna**, **lista `id1,id2` = subconjunto**. Comas **sin URL-encode**. El front lo deriva del `categoryIds` de la card. Restringe **qué ingresos cuentan** en las series y en `yearRange`; **`earliestYear` y `availableCategories` lo ignoran** (superconjunto estable).
- **`currency`** (opcional) — override de la moneda de display (RF-REP-007), una de las 4 monedas, **case-sensitive**. **Ausente → la default global del usuario**; **presente y válido → esa moneda**; **vacío o fuera del set → `400`**. La moneda solo define en qué moneda se computa el **total de ingreso** del mes (insumo de la variación %); las series resultantes están en **puntos porcentuales**, no en moneda.
- **`today`** (opcional, `YYYY-MM-DD`) — la **fecha local del usuario**: define el **mes en curso** (su total de ingreso se computa a la fecha) y a partir de qué mes los meses son **futuros** (series en `null`). Si falta, el backend cae a `new Date()` (UTC).

```
AnnualInflationIncomeResponse = {
  year: number,
  currency: "ARS" | "USD" | "EUR" | "BRL",   // moneda de display usada para el total de ingreso
  months: InflationIncomeMonth[],            // SIEMPRE 12 entradas; índice = mes-1
  incomeTrend: TrendLine,                     // recta OLS sobre la serie de ingreso nominal (incomePct)
  incomeAdjTrend: TrendLine,                  // recta OLS sobre la serie de ingreso ajustada (incomePctAdj)
  earliestYear: number | null,               // año más antiguo con algún movimiento del usuario; NO afectado por el filtro
  availableCategories: AvailableCategory[],   // universo de categorías con INGRESO del año, SIN el filtro
  yearRange: YearRange | null                 // rango de años navegable; ver §Rango de años navegable
}

InflationIncomeMonth = {
  inflationPct: number | null,   // variación IPC (puntos %) del mes; null si no hay dato de IPC
  incomePct: number | null,      // variación % MoM del total de ingreso (puntos %); null si previo 0 o mes futuro
  incomePctAdj: number | null    // incomePct con el ingreso previo inflado por el IPC del mes; null si falta IPC / previo 0 / mes futuro
}

TrendLine = {
  slope: number,                 // pendiente de la recta y = slope·x + intercept (x = índice de mes 0–11)
  intercept: number,
  points: number[] | null        // 12 valores de la recta evaluada en cada mes; null si la serie madre tiene < 2 puntos no nulos
}
```

donde `AvailableCategory = { categoryId, name, color }` (mismo shape que en §Contrato de serie de reportes).

- **`months` — siempre 12, índice = mes-1.** Las tres series están en **puntos porcentuales** (ej. `3.5` = 3,5 %), no en moneda. Cada métrica es `null` cuando no se puede computar (ver más abajo); el front corta la línea en los meses `null` (no las conecta).
  - **`inflationPct`** — `InflationRate.monthlyVariation` (puntos %) del mes; **`null`** si no hay fila de IPC para ese mes.
  - **`incomePct`** — variación mensual del total de ingreso: `ROUNDDOWN((ingresoActual × 100 / ingresoPrevio) − 100, 2)`, **truncado hacia cero**. El mes previo de **enero es diciembre del año anterior** (requiere consultar ingresos **fuera del año pedido**). **`null`** si `ingresoPrevio == 0` o si el mes es **futuro**.
  - **`incomePctAdj`** — igual que `incomePct`, pero el ingreso del mes previo se **infla por la variación IPC del mes en curso** antes de comparar (misma semántica que `pctVsPrevAdj` del reporte de Únicos). **`null`** si falta el IPC del mes, si `ingresoPrevio == 0` o si el mes es futuro.
- **Total de ingreso del mes — insumo de la variación.** Suma de movimientos **`INCOME`** imputados al mes (únicos por su mes local + fijos/cuotas aplicables, con el mismo bucketeo RN-015 que el resto), en centavos de `currency` (capa de display, re-ruteo por pivote USD). El mes en curso usa el total **a la fecha** (`today`); los meses **futuros** no tienen total → `incomePct`/`incomePctAdj` en `null`.
- **`incomeTrend` / `incomeAdjTrend` — tendencias OLS.** Rectas de mínimos cuadrados ajustadas sobre los **puntos no nulos** de su serie madre (`incomePct` e `incomePctAdj` respectivamente). `points` es la recta evaluada en los 12 meses; **`null` si la serie madre tiene menos de 2 puntos no nulos** (no hay recta posible). No son ítems de la leyenda: en el front cada tendencia sigue la visibilidad de su serie de ingreso madre.
- **`earliestYear`** — año más antiguo con **cualquier** movimiento del usuario, **ignorando el filtro `categories`** (mismo criterio que en §Contrato de serie de reportes); `null` si el usuario no tiene movimientos. **A diferencia de `annual-unicos`/`annual-cuotas`, este contrato lo expone**, pero **no gobierna la navegación de año** y **no tiene consumidor en el frontend**.
- **`yearRange`** — rango navegable de la card, calculado sobre sus **ingresos ya filtrados** (§Rango de años navegable). **`maxYear` nunca supera el año en curso.**
- **`availableCategories`** — universo de categorías con **ingreso (`INCOME`)** del año, computado **sin** aplicar el filtro `categories` (superconjunto estable). Es el universo **de ingreso** (no de gasto, a diferencia de los otros reportes); alimenta la leyenda-filtro de categorías de la card.

---

## Contrato del detalle histórico de Fijos (respuesta de `GET /movements/reports/fijos-historico`)

`GET /movements/reports/fijos-historico?rangeMonths=N[&currency=XXX][&today=YYYY-MM-DD][&chainId=ID]` devuelve, dentro del sobre `{ success, statusCode, data }`, **una serie de meses corridos por cada fijo** (cadena) del rango, con su monto y sus dos variaciones calculados. Alimenta la card `fixed-evolution` (RF-REP-013) y, con `chainId`, su vista acotada a un fijo en la card de detalle de `/mes` (RF-VM-009). Solo agrega movimientos de tipo **Fijo**, de **ambas direcciones** (`EXPENSE` e `INCOME`). Es un endpoint **distinto** de los reportes anuales (no comparte shape ni el anclaje por año). Reglas de cálculo (qué entra, recorte del rango, recomposición de splits, conversión, variaciones) en `docs/backend/graficos.md` §Detalle histórico de Fijos.

**Query params:**

- **`rangeMonths`** (opcional) — largo del rango **pedido**, en meses: una de las **8 opciones** `3 | 6 | 9 | 12 | 24 | 36 | 48 | 60`. **Ausente → `36`**; cualquier otro valor → **`400`**. No hay año ni mes final que pedir: el **borde derecho es siempre el mes en curso**, que el backend resuelve con `today`. El pedido es **previo al recorte** del borde izquierdo.
- **`currency`** (opcional) — override de la moneda de display (RF-REP-007), una de las 4 monedas, **case-sensitive**. **Ausente → la default global del usuario**; **presente y válido → esa moneda**; **vacío o fuera del set → `400`**.
- **`today`** (opcional, `YYYY-MM-DD`) — la **fecha local del usuario**. Si falta, el backend cae a `new Date()` (UTC).
- **`chainId`** (opcional) — acota la respuesta a **esa cadena**: `lines` y `excluded` contienen solo esa cadena (en uno de los dos, según su criterio de ≥2 apariciones). **Ausente → todas las cadenas.** El rango es **el mismo que sin `chainId`**: borde derecho = mes en curso y recorte del borde izquierdo contra el primer mes con aparición de **cualquier** fijo del usuario, no de la cadena; los meses previos al alta de la cadena son hueco (`beforeStart`). `ordinal` no cambia con `chainId`. Un `chainId` válido es el de un fijo del usuario o el de un **calculado de fijo**; uno inexistente, ajeno, eliminado (RN-026) o de un calculado de único/cuota → **`404`**.
- **NO acepta `categories`.** Esta card no filtra por categoría: la selección por fijo la reemplaza (RF-REP-013) y es **client-side** sobre `lines`.

```ts
FijosHistoricoResponse {
  currency: Currency;                 // moneda de display efectiva
  rangeMonths: number;                // largo EFECTIVO del rango (post-recorte); puede ser < al pedido
  startMonth: string;                 // "YYYY-MM" — primer mes del rango efectivo
  endMonth: string;                   // "YYYY-MM" — SIEMPRE el mes en curso
  lines: FixedEvolutionLine[];        // ≥2 apariciones graficables; orden: total del rango DESC, desempate chainId ASC, sin agrupar por dirección
  excluded: FixedEvolutionExcludedLine[]; // cadenas con 0 o 1 apariciones en el rango
}

FixedEvolutionLine {
  chainId: string;
  ordinal: number;                    // rank estable (ver abajo)
  type: 'EXPENSE' | 'INCOME';         // dirección de la línea; calculados: siempre 'EXPENSE'
  isCalculated: boolean;
  description: string | null;
  categoryId: string;
  categoryName: string;
  categoryColor: string;              // "#rrggbb"
  startMonth: string;                 // "YYYY-MM" — arranque de la cadena
  endMonth: string | null;            // "YYYY-MM"; null = sin fin programado
  frequency: number;                  // entero 1..12, compartido por toda la cadena
  originDescription: string | null;   // solo calculados: rótulo del origen (ver abajo); null en líneas normales
  originChainId: string | null;       // ídem
  months: FixedEvolutionMonthPoint[]; // largo VARIABLE = rangeMonths efectivo (3..60)
}

FixedEvolutionMonthPoint {
  month: string;                      // "YYYY-MM" — el punto se ubica por acá, no por su índice
  amountCents: number | null;         // centavos de `currency`; null = hueco
  nominalPct: number | null;          // variación % vs. el PAGO ANTERIOR de ESTA línea
  adjustedPct: number | null;         // la misma variación descontando el IPC acumulado del tramo
  reason: 'frequency' | 'skipped' | 'beforeStart' | 'afterEnd' | 'resultedIncome' | null;
}

FixedEvolutionExcludedLine {
  chainId: string;
  type: 'EXPENSE' | 'INCOME';         // ídem FixedEvolutionLine.type
  isCalculated: boolean;
  description: string | null;
  categoryId: string;
  categoryName: string;
  categoryColor: string;              // "#rrggbb"
  startMonth: string;                 // "YYYY-MM" — único dato adicional del excluido
}
```

- **El rango viaja resuelto: `startMonth`, `endMonth` y `rangeMonths` describen lo que la respuesta REALMENTE cubre.** `rangeMonths` es el largo **efectivo**, después de recortar el borde izquierdo contra el primer mes con aparición de un fijo (gasto o ingreso) del usuario, y puede ser menor al pedido; el borde derecho nunca se corre para compensar. El front rotula el eje y los estados con el rango efectivo, no con lo que pidió. No hay topes de navegación que transportar: hacia adelante no hay nada que topar (`endMonth` es el mes en curso) y el límite hacia atrás está expresado en `startMonth`, con granularidad de mes.
- **`months` es de largo variable y cada punto se identifica por su `month`.** El índice del array no dice de qué mes es un punto. **Ningún punto es posterior a `endMonth`.**
- **`originDescription` — rótulo del origen, con fallback resuelto en el backend.** En un calculado es la descripción de la **última fila** del fijo de origen o, si no tiene descripción (`null` o vacía), el **nombre de su categoría**. Es `null` solo si el origen no es resoluble y en líneas normales. El front lo muestra tal cual, sin fallback propio. `description` de la línea **no** tiene fallback: es `null` si la línea no tiene descripción.
- **Los tres valores del punto vienen calculados del backend** (monto convertido + las dos variaciones, en puntos porcentuales). El front **no** deriva porcentajes ni reconvierte montos.
- **`amountCents: 0` con `reason: null` es un punto REAL, no un hueco.** Un calculado puede dar 0 legítimamente (RN-018). El hueco es **`amountCents: null` + `reason` no-null**; `reason` dice por qué (mes fuera de frecuencia, anulado, previo al alta, posterior a la baja, o mes en que un calculado resulta `INCOME`).
- **`ordinal` — rank ESTABLE entre rangos.** Se calcula por la fila más antigua de cada cadena sobre el **universo completo** de cadenas del usuario (gasto, ingreso y calculados de fijo), no sobre el rango pedido ni sobre el `chainId` pedido. Es lo que permite que un fijo conserve su identidad (y su color) al cambiar lo que la card muestra. **El índice del array NO sirve para eso**: `lines` viene ordenado por el total del tramo mostrado, así que la misma cadena cambia de posición cuando ese tramo cambia.
- **Orden de `lines`** — una sola lista por total del rango (magnitud) DESC, desempate `chainId` ASC; gastos e ingresos intercalados, sin agrupar por `type`.
- **`type` — dirección de la cadena.** El `type` del fijo (`EXPENSE` / `INCOME`); los `amountCents` de ambas direcciones viajan como **magnitud** (≥ 0). Un **calculado** de fijo trae siempre `'EXPENSE'`: solo grafica los meses en que resulta gasto (los que resultan `INCOME` son hueco `resultedIncome`), también cuando su origen es un fijo de ingreso.
- **Universo de `lines`** — las cadenas con **≥2 apariciones graficables** en el rango efectivo (criterio en RF-REP-013): son las que dibujan evolución. `ordinal` se computa sobre el universo completo del usuario.
- **`excluded` — los fijos que no dibujan evolución, emitidos igual.** Toda cadena de fijo del usuario (gasto o ingreso) con **0 o 1** apariciones en el rango viaja acá, con su identidad y su `startMonth`: la card las expone fuera de la leyenda activa para que el usuario vea desde cuándo existe el fijo (RF-REP-013). Omitirlas las volvería inalcanzables.
- **Las dos variaciones comparan contra el PAGO ANTERIOR de la línea**, no contra el mes anterior del calendario: la aparición previa de esa misma cadena, salteando los meses sin pago y los anulados. Ese pago puede caer **fuera de la serie devuelta** (antes de `startMonth`) y se usa igual, así que el punto de `startMonth` también puede traer variación. `nominalPct: null` = no hay pago anterior con el que comparar (o valía 0).
- **`adjustedPct` descuenta el IPC acumulado del tramo entre los dos pagos, y es todo o nada.** Si falta el IPC de **alguno** de los meses del tramo, viaja en `null`. **El contrato no dice cuál mes falta**: `adjustedPct: null` es toda la información que el front recibe, por eso el copy de la UI no puede nombrar un mes. Un punto con `adjustedPct: null` puede tener `nominalPct` no-null.
