# Cotizaciones externas y sincronización

> Parte del modelo de datos de Control. Índice: `docs/data-model.md`. Reglas funcionales: módulo 3.12 (`docs/requirements/sincronizacion.md`, RF-FX-001, RF-IPC-001, RF-SYNC-001/002). Tabla `ReferenceRate`: `settings.md`.

Captura de cotizaciones FX y de IPC desde fuentes oficiales externas, vía un trigger sin datos en el body (`POST /settings/reference-rates/sync`). FX captura **un solo mes** por corrida (el **mes en curso**); IPC completa los meses faltantes hasta el último publicado por la fuente (regla en RF-IPC-001). El histórico de IPC viene sembrado por una data migration (`20260623000000_seed_historical_ipc`, ver §`InflationRate`). Tres tablas —`CurrencyQuote` (variantes FX), `InflationRate` (IPC), `RateSyncLog` (auditoría)— **globales** (sin `userId`), internas, no editables por UI. Seguridad de la ingesta en §Seguridad de la ingesta (abajo).

### `CurrencyQuote` — variantes de cotización FX (tabla relacional)

Tabla **global**, **interna y no editable por UI**, que guarda **una fila por variante de cotización** capturada de las fuentes externas. Desacoplada de `ReferenceRate`: `ReferenceRate` guarda **el** valor que usa la conversión interna (el oficial); `CurrencyQuote` guarda **todas** las variantes publicadas (oficial, blue, y cualquiera futura) como histórico crudo de fuente.

- **Modelo: tabla relacional, NO blob JSON.** Una fila por `(currency, variant, yearMonth)`, no un objeto de variantes embebido. **Por qué tabla y no JSON:** (1) la unidad de escritura del sync es una variante puntual (upsert idempotente por clave única, circuit breaker por variante) — un blob obligaría a leer-modificar-reescribir el objeto entero en cada sync; (2) cada variante necesita sus propios `source` / `fetchedAt` / `compra` / `venta`, que en JSON quedarían como sub-objetos sin tipado ni constraint; (3) el histórico se consulta por `(moneda, variante, mes)`, patrón natural de fila+índice. El blob `UserPreferences` usa JSON porque es **estado de UI por usuario sin consulta relacional**; esto es lo opuesto (dato de dominio global, consultable, escrito por variante).
- **`variant` es string libre, NO enum.** Decisión deliberada de "mente abierta a variantes futuras" (RF-FX-001): Argentina publica cotizaciones nuevas sin aviso (blue, MEP, CCL, tarjeta…) y un enum obligaría una migración por cada una. Se valida en el borde contra una **allowlist hardcodeada de variantes conocidas** (`"oficial"`, `"blue"`) en el código del sync, no con un constraint de DB: agregar una variante es editar la allowlist, sin migración. La columna admite cualquier string; el control de qué se escribe vive en la capa de aplicación.
- **Campos:**

| Campo | Tipo | Notas |
|---|---|---|
| `currency` | `Currency` | una de las 4 monedas (en la práctica las que tienen fuente: ARS, EUR, BRL) |
| `variant` | `String` | identificador de variante, minúsculas (`"oficial"`, `"blue"`, …). String libre; allowlist en código |
| `yearMonth` | `String` | `"YYYY-MM"` |
| `compra` | `Decimal` | precio de compra (bid). Unidades de la moneda por 1 USD, igual semántica de pivote que `ReferenceRate` |
| `venta` | `Decimal` | precio de venta (ask). Para fuentes con un único valor (Frankfurter), `compra == venta` |
| `source` | `String` | host de origen (`"dolarapi.com"`, `"api.frankfurter.dev"`) |
| `fetchedAt` | `DateTime` | instante de captura (UTC) |

- **Clave única `(currency, variant, yearMonth)`.** Un solo registro por moneda/variante/mes; el sync hace **upsert** sobre esta clave (idempotente). Índice por `(currency, yearMonth)` para listar variantes de un mes.
- **Relación con `ReferenceRate`.** El sync, además de escribir la variante en `CurrencyQuote`, **propaga la variante `oficial` a `ReferenceRate.rate`** del mismo `(currency, yearMonth)` (upsert), porque es la que consume la conversión interna. EUR/BRL (Frankfurter, valor único) se guardan como `variant: "oficial"` y propagan igual. **USD nunca tiene fila** (pivote implícito = 1), en ninguna de las dos tablas.

### `InflationRate` — IPC argentino

Tabla **global**, **interna y no editable por UI**, que guarda el IPC nacional (INDEC) por mes. Fuente: `apis.datos.gob.ar` (series de tiempo INDEC).

| Campo | Tipo | Notas |
|---|---|---|
| `yearMonth` | `String` | `"YYYY-MM"`. **Clave única.** |
| `monthlyVariation` | `Decimal` | variación mensual del IPC, en puntos porcentuales (serie `145.3_INGNACUAL_DICI_M_38`) |
| `indexValue` | `Decimal` | nivel del índice IPC (serie `148.3_INIVELNAL_DICI_M_26`) |
| `source` | `String` | host de origen (`"apis.datos.gob.ar"`) |
| `fetchedAt` | `DateTime` | instante de captura (UTC) |

- **Clave única `yearMonth`.** El IPC nacional es un único valor por mes (sin moneda ni variante). Upsert idempotente por esta clave.
- **Consumo.** No alimenta la conversión de monedas ni los totales del mes. Lo consumen el reporte anual de gastos Únicos (RF-REP-010, footer de inflación y % ajustado; ver `informes.md`, §Contrato de reporte anual de Únicos), el reporte anual de Inflación vs Ingresos (RF-REP-012, serie de inflación y ajuste del ingreso; ver `informes.md`, §Contrato de reporte anual de Inflación vs Ingresos), el Detalle histórico de fijos (RF-REP-013, variación ajustada) y la superficie de datos externos de `/configuracion` (RF-SYNC-002).
- **Histórico sembrado por data migration (`20260623000000_seed_historical_ipc`).** **113 meses (2017-01 … 2026-05)** de la serie completa de INDEC (`apis.datos.gob.ar`, variación e índice) insertados con `ON CONFLICT ("yearMonth") DO NOTHING`. Idempotente y convive con el sync sin pisarse: la migración no sobrescribe filas existentes, y el sync completa los meses faltantes (mes de arranque en RF-IPC-001).

### `RateSyncLog` — auditoría de la sincronización

Tabla **global** que registra **cada intento** de sync (aceptado o rechazado), para auditar la ingesta externa y diagnosticar anomalías (circuit breaker, dato malformado, fuente caída).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `source` | `String` | host consultado |
| `target` | `String` | qué se intentó escribir, con la clave afectada: FX = `"CurrencyQuote:{CURRENCY}:{variant}:{YYYY-MM}"` (ej. `CurrencyQuote:ARS:oficial:2026-06`); IPC = `"InflationRate:{YYYY-MM}"` |
| `rawPayload` | `Json` | respuesta cruda de la fuente (o el fragmento relevante), para reproducir el caso |
| `accepted` | `Boolean` | `true` si pasó validación y se escribió; `false` si se rechazó |
| `reason` | `String?` | motivo del rechazo (`"circuit-breaker"`, `"schema"`, `"out-of-range"`, `"http-error"`, …); `null` si `accepted` |
| `createdAt` | `DateTime` | instante del intento (UTC) |

- **Una fila por intento de escritura.** Un sync que toca varias monedas/variantes deja **varias** filas (una por target). El **secret nunca se loguea** acá ni en ningún campo.
- **No expuesta por UI.** Solo lectura interna / operación.

### Contrato — `POST /settings/reference-rates/sync`

Dispara el fetch server-side a las fuentes oficiales y persiste lo capturado. **El body NO lleva valores de cotización** (el caller no puede inyectar números): el endpoint solo gatilla la ingesta.

| Endpoint | Auth | Body | Éxito | Errores |
|---|---|---|---|---|
| `POST /settings/reference-rates/sync` | **`CRON_SECRET`** vía `Authorization: Bearer <CRON_SECRET>` (no el JWT de usuario) | sin datos de cotización (a lo sumo un selector de scope, abajo) | `200` · `data: SyncResult` | `400` · `401` · `422` · `429` · `502` |

- **Auth por `CRON_SECRET`, no por JWT de usuario.** El secret viaja en el header `Authorization: Bearer <CRON_SECRET>`. Endpoint de operación/cron, no de usuario final. Secret de 256 bits, comparación de **tiempo constante**, rate-limit (`429` si se excede, ver abajo), solo HTTPS. **`401`** si el secret falta o no coincide. Detalle completo en §Seguridad de la ingesta.
- **`429` — rate-limit.** Tope de **10 req/min por IP**; al excederlo el endpoint responde `429`.
- **Body sin datos de cotización.** No acepta `rate`/`compra`/`venta`/valores de IPC. Opcionalmente puede aceptar un **selector de scope** (`{ scope?: "fx" | "ipc" | "all" }`, default `"all"`) para correr solo FX o solo IPC; **nunca** valores. Cualquier campo de valor que llegue se descarta (whitelist).
- **`200` + `SyncResult`** — resumen de lo procesado. Shape:

  ```
  SyncResult = {
    scope: "fx" | "ipc" | "all",
    results: Array<{ target: string, accepted: boolean, reason?: string }>,
    acceptedCount: number,
    rejectedCount: number
  }
  ```

  Un elemento de `results` por intento (`target`/`accepted`/`reason?`), más los agregados `acceptedCount`/`rejectedCount`. Formato de `target`: FX = `"CurrencyQuote:{CURRENCY}:{variant}:{YYYY-MM}"` (ej. `CurrencyQuote:ARS:oficial:2026-06`); IPC = `"InflationRate:{YYYY-MM}"`. **El éxito HTTP del endpoint no implica que todo se escribió**: una variante puede haber sido rechazada por el circuit breaker y aun así el endpoint responde `200` con ese detalle en `SyncResult` (rechazo *parcial*, esperado).
- **Semántica de anomalía — falla ruidosa.** Si la **fuente** está caída, devuelve no-JSON, o el dato no pasa el schema/cotas de cordura, el endpoint responde **no-2xx** (`422` dato inválido / `502` fuente inalcanzable o respuesta no-JSON) y **no escribe** ese target. El **circuit breaker** (desvío > 15% del último valor guardado) **no sobrescribe**, marca la anomalía en `RateSyncLog` (`accepted: false`, `reason: "circuit-breaker"`) y se refleja en `SyncResult`; si **toda** la corrida queda bloqueada por anomalías, el endpoint **falla con no-2xx** (no devuelve un `200` silencioso). El criterio: un rechazo aislado entre varios targets → `200` con detalle; una corrida sin ningún target aceptado → no-2xx.
- **Idempotente.** Re-disparar el sync para un mes ya capturado hace upsert por la clave única, sin duplicar (y vuelve a loguear el intento).

### Seguridad de la ingesta

Reglas duras del endpoint de sync y del fetch server-side. Es el borde de confianza entre las fuentes externas y la DB: nada de lo que llega de afuera se escribe sin validar.

- **Auth por `CRON_SECRET`, no por JWT.** El endpoint es `@Public()` respecto del `JwtAuthGuard`, protegido por un secret de **256 bits** en env (`CRON_SECRET`). La comparación es de **tiempo constante** (no `===` de strings). Hay **rate-limit** sobre el endpoint y solo se acepta **HTTPS**. El secret **nunca** se loguea: ni en `RateSyncLog`, ni en logs de error, ni en el `rawPayload`.
- **Fetch saliente blindado.** **Allowlist de hosts hardcodeada** (`dolarapi.com`, `api.frankfurter.dev`, `apis.datos.gob.ar`) — ningún host fuera de la lista se consulta. **TLS verificado**, **timeout corto**, **sin seguir redirects**, y se **valida `Content-Type: application/json`** antes de parsear (respuesta no-JSON → `502`).
- **Validación del dato externo.** Schema **estricto**: se rechaza si falta un campo o el tipo no coincide. **Cotas de cordura**: se rechaza `≤ 0`, `NaN`, infinito y magnitudes implausibles. **Circuit breaker al 15%**: si el valor nuevo se desvía **> 15%** del último guardado para esa clave, **no** se sobrescribe — se marca anomalía en `RateSyncLog` (`accepted: false`, `reason: "circuit-breaker"`) y se refleja en la respuesta; una corrida sin ningún target aceptado responde **no-2xx** (no `200` silencioso).
- **Escritura.** **Prisma tipado**; `$queryRawUnsafe` **prohibido** acá. Se valida en el borde **antes** de tocar la DB. **Upsert transaccional todo-o-nada** por target, **idempotente** por la clave única (`CurrencyQuote(currency,variant,yearMonth)` / `InflationRate(yearMonth)` / `ReferenceRate(currency,yearMonth)`). La variante `oficial` de FX se propaga a `ReferenceRate` **en la misma transacción**.
- **Variante = string libre con allowlist en código.** Ver §`CurrencyQuote`.
- **Auditoría.** `RateSyncLog` guarda una fila por intento de escritura (timestamp, fuente, target, payload crudo, aceptado/rechazado, motivo). El body del request **no** acepta valores de cotización (la whitelist de class-validator los descarta); a lo sumo un selector de scope `fx`/`ipc`/`all`.
- **Rate-limiter en memoria (gotcha).** El tope de **10 req/min por IP** del endpoint es **en memoria** del proceso — no usa `@nestjs/throttler` ni Redis. En un deploy **multi-instancia** el límite **no es global**: cada instancia cuenta por separado. Para un límite realmente global haría falta un store compartido (Redis).
