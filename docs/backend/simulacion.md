# Backend — Simulación de categoría (SimulationsModule)

Crea, lista, extiende y elimina simulaciones (RF-SIM-001..005) y **deriva los movimientos simulados** que `GET /movements` embebe en Únicos. Contrato de API (`POST /simulations`, `GET /simulations`, `GET /simulations/candidates`, `PATCH /simulations/:id/extend`, `DELETE /simulations/:id`, el param `today` y el gotcha del fallback UTC) y modelo en `docs/data-model/simulacion.md` §Simulación de categoría; reglas de cálculo en `docs/requirements/reglas-de-negocio.md` RN-028/029.

- El `DELETE` es **borrado físico** (`204`), no registra historial y no es deshacible (RF-SIM-004).

## Dependencia unidireccional `Movements → Simulations`

`MovementsService` inyecta `SimulationsService` y le pide los simulados; **nunca al revés**. El sentido **no se puede invertir ni volver bidireccional**: sería un ciclo de módulos de Nest.

**Consecuencia:** la serie de ajuste de la regresión necesita agregaciones de `Transaction` por mes y categoría, y `SimulationsService` las lee **por su propio repositorio** en vez de pedírselas a `TransactionsService`. Mismo precedente que `MovementsRepository` (`docs/backend/movimientos-mes.md` §Por qué un módulo propio). Excepción documentada a la regla de propiedad de dominio (`docs/backend/base.md`).

## Dos consumidores, una API de derivación

| Método | Consumidor | Devuelve |
|---|---|---|
| `getSimulatedItemsForMonth(userId, month, today?, displayCurrencyOverride?)` | `GET /movements` (Únicos del mes) | `MovementItem[]` del mes |
| `getSimulatedItemsForMonths(userId, months[], today?, displayCurrencyOverride?)` | `GET /movements/reports` con `includeSimulated=true` (RF-REP-017) | `Map<month, MovementItem[]>` con **todas** las claves pedidas (`[]` las que no califican) |

- **La variante de un mes es un wrapper de la batch.** Una sola lógica de cálculo.
- **La batch hace DOS cargas por llamada**, no una por mes ni por simulación: la **ventana histórica `[A-12..A-1]`** (serie de ajuste + `monthsWithData`/`paused`) y los **únicos reales que el remanente descuenta** (RN-028), sobre la **unión de los tramos vigentes** de todas las simulaciones (cada uno de su `effectiveStartMonth` a su `endMonth`), intersecada con los meses pedidos y **reducida a un rango contiguo** (min/max; `loadCategoryMonthlyData` solo necesita los extremos). Cada carga es **una query**: **O(1) por llamada**.
- **Si ninguna simulación cubre ninguno de los meses pedidos, la batch corta antes de tocar la DB** (`Map` de `[]` sin queries).
- **Las dos cargas no se fusionan.** El helper acumula en `monthsWithData` **todo** lo que devuelve la query; mezclar los rangos inflaría los "meses con dato" de la ventana histórica y falsearía el mínimo de 3 meses.
- **`displayCurrencyOverride`** — sin él, la derivación usa la **moneda default del usuario** (`GET /movements`); con él, la serie de ajuste se re-expresa en la **moneda de display de la card**, para que el aporte simulado venga en la misma moneda que el resto de la respuesta.
- Los endpoints `/movements/reports/annual-*` y `fijos-historico` **no** tocan `SimulationsService`: analizan solo lo real.

## Los reportes ven simulaciones solo si se las piden

`GET /movements/reports` consulta `SimulationsService` de forma **opt-in** (`includeSimulated=true`); sin el param la respuesta es real pura. No agrega flecha nueva ni ciclo.

El bloque `simulated` se arma **aparte** de las series reales (contrato en `docs/data-model/informes.md` §Contrato de serie de reportes): **no se suma** dentro de `months`/`categories`. El **universo** (`availableCategories`) se amplía **ignorando** los filtros de la card; las series simuladas **sí** los respetan — el simulado se filtra como un único (tipo `unico`, dirección derivada del mes, categoría simulada). Su aporte a `yearRange`: `docs/backend/graficos.md` §Rango de años navegable por card.

## Infraestructura de proyección compartida (`src/common/projection.helper.ts`)

Las dos proyecciones a futuro viven en el **mismo módulo** como **funciones puras exportadas** (no una clase `@Injectable`): se importan desde `MovementsService` y `SimulationsService` sin tocar los providers de los specs unitarios.

| Función | Consumidor | Método |
|---|---|---|
| `computeFixedBasketProjection` | RF-REP-015 (`docs/backend/graficos.md` §Proyección de fijos a futuro) | esqueleto determinista × tasa de encarecimiento por cadena |
| `fitCategoryRegression` + `evaluateRegressionAt` | RF-SIM-002 | regresión lineal por mínimos cuadrados |

**Comparten infraestructura, no matemática:** cada fórmula es propia. Un cálculo nuevo se suma acá; no se mete en la fórmula ajena.

- **Gotcha — `fitCategoryRegression` NO saltea puntos.** Los 12 valores de la ventana entran siempre, incluidos los ceros (RN-028: la ausencia es dato). Lo contrario de `computeLinearTrend` (Inflación vs Ingresos), que ignora los `null`. Quién decide si hay datos suficientes es el **caller** (mínimo de 3 meses **con únicos**).

## Derivación del movimiento simulado

- **`getSimulatedItemsForMonth` corta temprano con `[]`** si el mes es **anterior** al mes en curso, si cae fuera del **tramo** (`[effectiveStartMonth..endMonth]`), si el usuario no tiene simulaciones o si la simulación está **pausada** (`monthsWithData < 3`). El **mes en curso no corta por sí solo**: es el piso de `effectiveStartMonth`. El consumidor no evalúa ninguna de esas condiciones.
- **El monto emitido es el remanente** (RN-028): proyección del mes menos el total real con signo de los únicos de la categoría en ese mes, con **el mismo criterio y helper** que la serie de ajuste (sin anulados ni eliminados, cada único con el TC de **su** mes). Un remanente que redondea a 0, o de signo distinto al de la proyección, **no emite ítem**.
- **Ventana, tramo y posición del eje viven en `simulation-window.helper.ts`** (`resolveTodayMonthKey` / `buildWindowMonths` / `computeHorizonEndMonth` / `effectiveStartMonth` / `buildMonthRange` / `axisPositionFor`) — reusarlos, no reimplementar la aritmética de RN-028.
- **`computeHorizonEndMonth(baseMonthKey)` toma un mes base genérico, no asume "hoy".** Calcula el `endMonth` de **un** tramo desde su arranque: al crear, `baseMonthKey` es el `startMonth` ya clampeado; en `GET /simulations/candidates`, el `startMonth` hipotético del lote. Cada simulación tiene su propio tramo; no hay horizonte global.
- **Gotcha — el umbral de `computeHorizonEndMonth` mide un tramo distinto del que se simula, y está bien así.** El chequeo de "menos de 6 meses" que dispara la extensión a `base+6` cuenta los meses **estrictamente posteriores** a `baseMonthKey` (`base+1..diciembre`), mientras que el tramo simulable **incluye** `baseMonthKey`. **No es un off-by-one**: "arreglarlo" corre el corte de la extensión un mes.
- **Serie de ajuste convertida por el mes de cada único** (no por el TC de hoy), mismo criterio que `getAnnualUnicosAggregated`. El signo lo pone el `type` del único (ingreso `+`, gasto `−`).
- **Rechazo no revelador al crear.** Reusa `CategoryValidatorService` con `skipScopeCheck`: una simulación **no tiene `type` fijo**, así que cualquier `scope` es válido.
- **El conflicto "ya simulada" está en dos capas.** El chequeo previo cubre el caso normal; el catch del `P2002` del índice único blinda una carrera concurrente.

## Alta múltiple (`POST /simulations`)

Regla funcional en RF-SIM-001.

- **Los `400` del body son tres**: `categoryIds` vacío, con ids duplicados, o `startMonth` (si viene) que no matchea `/^\d{4}-\d{2}$/` — los resuelve el DTO antes de tocar la DB. Un rechazo **por categoría** nunca sale como status de error: viaja en `failed` con `201`.
- **`startMonth` se clampea una vez, contra el mes en curso, para todo el lote.** Ausente = mes en curso. Las categorías creadas en el mismo `POST` comparten ese `startMonth` y derivan de ahí su propio `endMonth` (RN-028/029).
- **Secuencial, no `Promise.all`.** Cada `categoryId` pasa por el **mismo** camino de creación (mismas validaciones y mensajes) y su error se captura en `failed` sin voltear a los demás. En serie el resultado es **determinístico** frente a colisiones dentro del lote.
- **No atómico y sin historial.** Sin transacción que envuelva el lote: lo creado queda creado aunque el resto falle.

## Extender (`PATCH /simulations/:id/extend`)

`{ months: 1|3|6|12 }` corre el `endMonth` hacia adelante sin re-derivarlo ni clampearlo. Regla funcional en RF-SIM-005.

- **Gotcha — el endpoint no valida que el usuario esté parado en el último mes del tramo.** Esa condición (`viewedMonth === endMonth`) es de **UI**, no de integridad: `endMonth + months` es válido sin importar el mes que mire el caller. La restricción de "dónde aparece el botón" vive en el frontend.
