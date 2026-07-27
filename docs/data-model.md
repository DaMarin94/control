# Data Model

> Documento conceptual — describe qué entidades existen y las decisiones de negocio sobre cómo se almacenan los datos.
> El schema de Prisma ya está **implementado** en `backend/prisma/schema.prisma` (fuente de verdad para tipos, campos y constraints); las decisiones de modelado a nivel DB están en `docs/backend.md`, sección Capa de datos. Los tipos TypeScript y los contratos de API se documentan cuando se implementen.

---

## Entidades

| Entidad | Descripción |
|---------|-------------|
| **Usuario** | Puede autenticarse por **Google** o por **email + contraseña** (dos métodos que coexisten en v1). El email identifica al usuario. Las cuentas con email + contraseña almacenan un hash de la contraseña (`passwordHash`); las cuentas creadas solo con Google pueden no tener contraseña. Se crea al hacer login con Google por primera vez o al registrarse con email + contraseña. Todos los demás recursos le pertenecen. Tiene un campo `timezone` (zona horaria default / "de casa"). |
| **Categoría** | Clasifica los movimientos. Personalizable por usuario. Tiene un color que el usuario **elige y edita** desde una matriz de colores predefinidos. Se elimina con soft delete. |
| **Método de pago (`PaymentMethod`)** | Metadato **opcional** de un movimiento: con qué se pagó/cobró. Espejo de Categoría (del usuario, soft delete, pantalla propia, contador de movimientos), pero su identidad visual es un **ícono** (`icon`, string con allowlist en código; **no hay color**). Tiene un **tipo** (`type`, string con allowlist `CREDIT`/`DEBIT`/`CASH`, **no enum**) y campos condicionales por tipo: crédito → `closingDay`/`paymentDay` (día del mes 1-31, informativos); débito y efectivo → ninguno. El **débito automático** no vive acá: es un atributo **del movimiento** (ver decisión más abajo). Ver `requirements.md`, submódulo 3.6.b (RF-PM-001..006) y RN-021. |
| **Movimiento único** | Gasto o ingreso que ocurrió una sola vez en un instante específico (fecha y hora). Se guarda como timestamp UTC (`occurredAt`) más la zona horaria original del registro (`timezone`, nombre IANA). No es solo una fecha de calendario. Tiene un flag `skipped` de **anulación** (RF-MU-005): `true` = anulado; se sigue listando pero no suma a totales ni reportes. Reversible (toggle). |
| **Movimiento fijo** | Plantilla recurrente activa desde un mes de inicio hasta que el usuario la elimina. Tiene una **frecuencia** (`frequency`) que es un **entero 1..12** = meses entre apariciones (1 = mensual, default; 12 = anual) y define en qué meses aparece, anclada al mes de inicio (RF-MF-006). |
| **Anulación de fijo (RecurringSkip)** | Marca que **anula una aparición** de un movimiento fijo en un **mes puntual** (`(recurringId, month)`), sin eliminar el fijo. Reversible (toggle). El mes anulado se sigue mostrando pero no suma a los totales ni a la proyección anual (RF-MF-005). Distinta de `deletedFrom`. |
| **Anulación de cuota (InstallmentSkip)** | Marca que **anula una instancia mensual** de un grupo de cuotas en un **mes puntual** (`(installmentGroupId, month)`), sin eliminar el grupo. Reversible (toggle). El mes anulado se sigue mostrando pero no suma a los totales ni a los reportes (RF-MC-004). Espejo de `RecurringSkip` para cuotas. |
| **Movimiento calculado** | Caso de **movimiento fijo** cuyo monto **no se ingresa**: se deriva del monto de **otro fijo de origen** mediante una **fórmula** (operador + operando), mes a mes y al vuelo (on-the-fly, no se persiste). Es un fijo a todos los efectos (cadena de filas `Recurring`, frecuencia, split, skip), con dos datos extra: el **vínculo a la identidad de cadena del fijo de origen** y la **fórmula** (operador + operando + signo). Su categoría y descripción son propias; su **tipo se deriva del signo del monto** (no es elegible — RN-018), no se toma del origen. Lo único que toma del origen es el monto. Su `amountCents` puede ser **negativo o cero** (excepción a "monto > 0"). Ver `requirements.md`, submódulo 3.4.b (RF-MCALC-001..007) y RN-017/018/019. |
| **Grupo de cuotas** | Compra o cobro dividido en N pagos mensuales iguales desde un mes de inicio. |
| **Preferencias de usuario** | Conjunto de preferencias del usuario (estado de UI que sobrevive a la navegación y al cierre de sesión). Una fila por usuario (1:1 con Usuario), con el contenido guardado como **blob JSON** en lugar de una columna por preferencia. La consumen las secciones colapsadas / orden de `/mes`, la config de reportes y el filtro por categoría. |
| **Cotización de referencia (`ReferenceRate`)** | Tabla **global** (sin `userId`), **interna y no editable por UI**, de cotizaciones de referencia por `(moneda, mes)`. Sirve de **default por copia (no FK)** para pre-cargar la cotización de un movimiento según su mes; el movimiento conserva su propia cotización editable. Sembrada por seed idempotente y alimentada por el sync externo con la variante oficial. Ver §Tabla de cotizaciones de referencia. |
| **Cotización externa por variante (`CurrencyQuote`)** | Tabla **global**, interna, no editable por UI. Histórico crudo de **variantes** de cotización FX capturadas de fuentes externas (oficial, blue, …) por `(moneda, variante, mes)`. `variant` es **string libre** (no enum), por mente abierta a variantes futuras. La conversión interna no la consume todavía. Ver §Cotizaciones externas y sincronización. |
| **Inflación (`InflationRate`)** | Tabla **global**, interna, no editable por UI. IPC nacional (INDEC) por mes (variación mensual + nivel del índice). La consumen el **reporte anual de gastos Únicos** (RF-REP-010, métricas de inflación y % ajustado del footer) y el **reporte anual de Inflación vs Ingresos** (RF-REP-012, serie de inflación y ajuste del ingreso). Ver §Cotizaciones externas y sincronización. |
| **Log de sincronización (`RateSyncLog`)** | Tabla **global** de auditoría: una fila por intento de ingesta externa (aceptado/rechazado + motivo + payload crudo). El secret nunca se loguea. Ver §Cotizaciones externas y sincronización. |

---

## Decisiones de negocio sobre los datos

- **Montos en centavos.** Todos los montos se guardan como enteros en centavos (ej: $1.500 → `150000`). Sin decimales flotantes. **Excepción:** la **cotización** (`exchangeRate` / `User.lastExchangeRate` / `ReferenceRate.rate`) **no** va en centavos: es un `Decimal` de Prisma con decimales; ver "Moneda explícita, set curado" más abajo.
- **Tope de monto por movimiento.** `amountCents` se persiste como **entero de 32 bits** (Postgres `int4`): el máximo aceptado por la API es **2.147.483.647 centavos** ($21.474.836,47 por movimiento). Aplica a los tres tipos que persisten `amountCents` — únicos (`transactions`), fijos (`recurring`) y cuotas (`installments`, donde el tope es sobre el monto **por cuota**, no el total del plan). Al excederlo la API responde **400** con el mensaje `"El monto es demasiado grande"`.
- **Soft delete en categorías.** Eliminar una categoría la marca como eliminada (`deletedAt`) pero no borra el registro. Los movimientos históricos conservan la referencia y siguen sumando en los totales del mes (el soft delete no excluye movimientos de los cálculos). Una categoría eliminada puede **reactivarse**: al crear una categoría cuyo nombre normalizado colisiona con una eliminada, el sistema propone reactivar la original en lugar de duplicarla (mismo `id`, scope y color); ver `requirements.md`, RF-CAT-002 / RF-CAT-004.
- **Unicidad de nombre de categoría: app-level, no DB.** La unicidad de nombre entre categorías **activas** de un mismo usuario se valida en lógica de aplicación, no con un constraint `@@unique` de Prisma/DB. Motivo: la comparación es **normalizada** (trim + insensible a mayúsculas y acentos) y el flujo "crear-o-reactivar" frente a una categoría soft-deleted homónima no caben en un constraint de base de datos.
- **Color de categoría elegible por el usuario.** Cada categoría tiene un color tomado de una **matriz de colores predefinidos** (40 colores; ver "Matriz de colores" más abajo). El usuario lo elige y edita, con default "menos usado" al crear; la regla funcional completa vive en RN-013 (`requirements.md`). El color es solo presentación y no afecta el cálculo de montos ni el scope.
- **Métodos de pago — espejo de Categoría, identidad por ícono.** `PaymentMethod` reproduce el patrón de `Category` (del usuario, `deletedAt` soft delete, unicidad de nombre **app-level** con normalización RN-014 y flujo crear-o-reactivar, contador `movementCount` derivado). Diferencias de modelado: (1) la identidad visual es **`icon`** (string, allowlist en código, default `card`), **sin campo `color`**; (2) **`type`** es **string con allowlist en código** (`CREDIT`/`DEBIT`/`CASH`), **no un enum de Prisma**, para sumar tipos futuros sin migración (mismo criterio que `CurrencyQuote.variant`); (3) campos **condicionales por tipo, nullable**: `closingDay Int?` / `paymentDay Int?` (1-31, solo crédito) — al cambiar de tipo, los que no aplican quedan en `null`. `@@index([userId])`. Días de cierre/cobro son **informativos** en v1 (no mueven la imputación; RN-021). Contrato de respuesta en §Métodos de pago.
- **`paymentMethodId` opcional en las tres tablas de movimiento.** `Transaction`, `Recurring` (incluye calculados) e `InstallmentGroup` llevan `paymentMethodId String?` (nullable = movimiento sin método) con **FK `onDelete: Restrict`** hacia `PaymentMethod` (igual criterio que `categoryId`: un método con movimientos no se hard-deletea; la baja es soft delete). Un **calculado** (fila `Recurring`) **no persiste `paymentMethodId` propio ni editable**: **hereda** el método de pago del origen, derivado al vuelo en lectura (mismo tratamiento que `currency`/`exchangeRate` y `autoDebit`; RF-PM-006, RN-021).
- **`autoDebit` es atributo del movimiento, no del método.** `Transaction`, `Recurring` e `InstallmentGroup` llevan `autoDebit Boolean?` (nullable). Semántica: `true`/`false` = método efectivo del movimiento de tipo `DEBIT`; `null` = sin método o método `CREDIT`/`CASH`. **Persistencia (RN-021):** se guarda `true`/`false` **solo si** el método efectivo es `DEBIT`; en cualquier otro caso se fuerza a `null` aunque el body pida `true`. El **calculado no persiste `autoDebit` propio**: lo hereda del origen, derivado al vuelo (mismo tratamiento que `currency`/`exchangeRate`). El flag es metadato: no afecta totales, balance ni reportes.
- **Movimientos fijos: el pasado es inmutable.** Editar o eliminar un fijo no modifica los meses ya pasados. El fijo tiene un mes de inicio (`startMonth`) y opcionalmente un mes desde el cual deja de aparecer (`deletedFrom`, **exclusivo**: "mes desde el cual ya no aparece").
- **El movimiento fijo se modela como una _cadena_ de filas `Recurring`, no una sola.** Un "fijo lógico" puede estar compuesto por varias filas en el tiempo. Cada edición que afecta meses ya corridos **cierra la fila vigente** (le setea `deletedFrom = mes actual`) y **abre una fila nueva** (`startMonth = mes actual`) con los valores nuevos; así los meses pasados conservan los valores viejos y el actual/futuro toman los nuevos, sin generar filas por instancia mensual. Si el fijo todavía no corrió ningún mes, la edición es en su lugar (no se parte la cadena). Esto materializa "el pasado es inmutable". Detalle de la mecánica (split al editar, boundary de eliminación) en `docs/backend.md`, sección Movimientos fijos.
- **Identidad de cadena estable del fijo.** Un "fijo lógico" es una **cadena de filas `Recurring`** que comparten un **id de cadena estable** —conceptualmente un `chainId` compartido por **todas** las filas de un mismo fijo lógico— que **sobrevive a los splits**: la fila R2 que abre el split **hereda** el `chainId` de R1. Es independiente del `id` de fila (el `id` de fila cambia en cada split; el `chainId` no). **Por qué:** un movimiento calculado se vincula a **esa identidad de cadena del origen**, no a un `Recurring.id` puntual, para que el vínculo **no se rompa** cuando el origen se edita y se parte (RF-MCALC-004). El nombre y la forma concreta del campo los fija el backend; este documento fija el concepto y la invariante "el split preserva el `chainId`". Las cadenas legacy fragmentadas por splits previos a la migración de `chainId` se re-unen con un script de mantenimiento de una sola vez (ver `docs/backend.md`, §`chainId` — identidad de cadena estable).
- **Movimiento calculado: fijo + vínculo a cadena origen + fórmula.** El movimiento calculado **es un movimiento fijo** (misma entidad/cadena `Recurring`, misma frecuencia, mismo split, mismos skips) más dos datos conceptuales: (1) un **vínculo a la identidad de cadena del fijo de origen** (`chainId` del origen — ver decisión anterior), y (2) una **fórmula**. El **monto NO se persiste**: es un campo **derivado al vuelo en lectura** (on-the-fly, RN-006, igual que fijos y cuotas), recalculado del monto del origen en cada consulta, por lo que **espeja la estructura de cadena del origen mes a mes** (si el origen vale distinto en distintos meses por su cadena, el calculado replica esa variación) y sigue cualquier cambio del origen sin re-guardar nada. **No** es un valor congelado al crear (RF-MCALC-004). El monto en un mes es `signo × round(fórmula(montoOrigenEseMes))`. El **tipo (`EXPENSE`/`INCOME`) no se persiste como dato elegible: se deriva del signo de ese monto** (negativo → `EXPENSE`, positivo → `INCOME`, cero → `EXPENSE` por convención de borde; RN-018), también al vuelo. El vínculo es a la **cadena**, no a una fila: sobrevive a los splits del origen. **Sin encadenamiento:** un calculado no puede ser origen de otro (solo un fijo "normal" puede ser cadena origen); un fijo puede tener varios calculados derivados. **Ciclo de vida atado al origen** (eliminación, skip mensual, cambio de frecuencia se propagan; RF-MCALC-005). El detalle de cómo el backend modela el vínculo (FK a `chainId`, propagación, derivación on-the-fly) vive en `docs/backend.md`.
- **Fórmula del calculado: operador + operando + signo (RF-MCALC-002/003).** La fórmula se persiste conceptualmente como **tres datos**: un **operador** de un set cerrado `{ ADD, SUB, MUL, DIV, PCT }` (corresponde a `+ − × ÷ %`), un **operando** numérico común, y un **signo** (`+1` / `−1`). El operando es un número común ingresado por el usuario (ej. `5000`, `1.5`, `10`); su unidad de persistencia (centavos para operandos monetarios de `±`, factor crudo para `× ÷ %`) la fija el backend al implementar, de forma coherente con que el **resultado** se redondea a centavos enteros (`round`, RN-002/RN-017). **Validación de borde:** operando `0` **rechazado** en `DIV` y `PCT` (división por cero); aceptado en el resto. El **signo** del calculado fuerza el resultado a positivo o negativo y es la razón por la que su `amountCents` puede ser **negativo o cero** (RN-018), excepción a "monto > 0" válida solo para calculados.
- **Frecuencia del movimiento fijo (RF-MF-006).** Cada fijo tiene un campo `frequency` **entero 1..12** (`Int @default(1)`) = meses entre apariciones (1 = mensual … 12 = anual; sin frecuencias fuera del rango ni custom). El rango 1..12 es **lógico**, validado en el DTO; **no** hay CHECK en la DB. La frecuencia está **anclada al `startMonth`** y define en qué meses aparece el fijo según la regla de cálculo de RN-016. Es **inmutable** (como `type`): no se acepta en PATCH; en el split de edición la fila nueva la hereda del original. El cálculo es on-the-fly (RN-006).
- **Anulación de un fijo en un mes puntual como registro aparte (`RecurringSkip`, RF-MF-005).** Anular la aparición de un fijo en un mes puntual se modela con una fila `RecurringSkip(recurringId, month)` —**no** con un flag en `Recurring`—, con `month` en formato `"YYYY-MM"` y **unicidad `(recurringId, month)`** (un solo skip por fijo y mes). `onDelete: Cascade` desde `Recurring`: al borrar el fijo se borran sus skips. Es **distinto de `deletedFrom`**: `deletedFrom` corta el fijo de ahí en adelante; el skip cancela **una** aparición puntual dejando el fijo vivo. La acción de anular/des-anular es un **toggle** (si existe el skip se borra, si no se crea). Un fijo anulado para un mes **se sigue listando** en `GET /movements` (marcado con `skipped: true`) pero su monto **no suma** a los totales del mes ni a la proyección anual. El backend **no valida** que el mes del skip sea una aparición real del fijo según su frecuencia (solo formato `YYYY-MM` y ownership); esa validación semántica es del frontend, que ya tiene el ítem del mes.
- **Anulación de un único (flag) y de una cuota (`InstallmentSkip`) — RF-MU-005 / RF-MC-004.** El **único** se anula con un **flag booleano en la propia fila**: `Transaction.skipped Boolean @default(false)` (toggle; **sin alcance temporal**, anula la fila entera). La **cuota** se anula con un registro aparte **`InstallmentSkip(id, installmentGroupId, month, createdAt)`** —espejo de `RecurringSkip`—, con `month` en formato `"YYYY-MM"`, **unicidad `(installmentGroupId, month)`**, índice por `installmentGroupId` y `onDelete: Cascade` desde `InstallmentGroup` (al borrar el grupo se borran sus skips). Anula **solo** esa instancia mensual, dejando vivo el resto del grupo. En ambos casos la anulación es un **toggle** (si existe se quita, si no se crea) y el ítem anulado **se sigue listando** en `GET /movements` (marcado con `skipped: true`) pero su monto **no suma** a los totales del mes ni a los reportes anuales. Los calculados de único/cuota **heredan** el estado del origen (no tienen skip propio; RF-MCALC-005). Regla funcional en `requirements.md`, RN-020.
- **Moneda explícita, set curado.** La moneda es **explícita** (enum `Currency`): un **set curado de 4 monedas — `ARS`, `USD`, `EUR`, `BRL`**, enum cerrado, **sin alta de monedas por UI**. Cada movimiento (único / fijo / cuota) guarda su **`currency`** (default `ARS`) y una **cotización `exchangeRate`** (ver granularidad abajo). El **`User`** guarda su **`defaultCurrency`** (default `ARS`, configurable en `/configuracion`, una de las 4) y el **`lastExchangeRate`** (último cambio real ingresado; ver "fallback" abajo). Reglas funcionales en `requirements.md`, módulo 3.10 (RF-CUR-001..006).
  - **`anchorCurrency` — ancla interna de la cotización.** Cada movimiento (único / fijo / cuota) guarda, además de `currency` y `exchangeRate`, una columna **`anchorCurrency`** (`Currency`, NOT NULL, default `ARS`) que fija **respecto de qué moneda está expresada su `exchangeRate`**. Es **interna a la capa de datos**: **no** está en los DTOs de create/edit ni en la respuesta de `GET /movements` (el front no la envía ni la recibe). Se persiste `anchorCurrency` = la `defaultCurrency` del usuario al momento de **crear** el movimiento; al **editar** `currency`/`exchangeRate` se **re-ancla** a la `defaultCurrency` vigente. Migración `20260620000001_add_anchor_currency`. Esta columna es la que permite que la conversión sea correcta cuando el usuario **cambia su `defaultCurrency`** (ver "Conversión = capa de display").
  - **Semántica de `exchangeRate` per-movimiento (Opción A).** `exchangeRate` = **unidades de `anchorCurrency` por 1 unidad de `currency`** (la moneda del movimiento) — **no** de la default *vigente*. No puede interpretarse sin su `anchorCurrency`. Tipo Prisma **`Decimal`** (con decimales, **no** centavos — excepción a "Montos en centavos"). Default `1`; `1` cuando `currency == anchorCurrency`. Como al crear/editar `anchorCurrency` toma la default de ese momento, **en el momento de la carga** la lectura coincide con "default por 1 unidad de `currency`" — pero la default puede cambiar después, y entonces solo `anchorCurrency` deja interpretable la cotización guardada. Los **cruces no triviales** (p. ej. EUR↔BRL, o cuando la default no es ni `anchorCurrency` ni `currency`) se **derivan vía el pivote `USD`** usando la tabla `ReferenceRate` (ver §Tabla de cotizaciones de referencia); **no se guardan pares**.
  - **`amountCents` se resignifica = centavos de la moneda original del movimiento** (no de la default). Un gasto de US$10 con `currency: "USD"` guarda `amountCents: 1000` (10 USD en centavos), no su equivalente en ARS.
  - **Calculados heredan** moneda y cotización del **origen** (no persisten `currency` ni `exchangeRate` propios): se derivan al vuelo junto con el monto, igual que el resto de sus datos derivados.
  - **Back-compat:** todos los registros existentes quedan `currency: "ARS"` + `exchangeRate: 1`. **`lastExchangeRate` solo se actualiza cuando el usuario ingresa una cotización real** (≠ `1`): el default de back-compat **no** lo pisa, para no contaminar el fallback con un `1` espurio.
  - **`lastExchangeRate` como fallback.** La pre-carga del campo de cotización del formulario se sirve desde la **tabla de referencia del mes** vía `GET /settings/reference-rate` (ver §Contrato de configuración → reference-rate). `lastExchangeRate` queda como **fallback** del frontend cuando ese endpoint devuelve `exchangeRate: null` (mes/moneda sin dato de referencia).
  - **Granularidad de la cotización por tipo:** **únicos** → cotización **por movimiento**; **fijos** → cotización **por mes de aparición** (vive en la fila de la cadena `Recurring`; editar la cotización de un mes en adelante usa la **misma mecánica de split del pasado** que cualquier edición de fijo, ver "El movimiento fijo se modela como una cadena…"); **cuotas** → **una** cotización por **grupo**; **calculados** → heredan del origen (no propia).
  - **El display de fijos y cuotas NO usa el `exchangeRate` guardado.** El `exchangeRate`/`anchorCurrency` de `Recurring`/`InstallmentGroup` **se persisten** (el formulario los guarda con la granularidad de arriba), pero la **conversión de display** de **fijos, cuotas y sus calculados** (calculado-de-fijo, calculado-de-cuota) se **deriva al vuelo del TC oficial del mes de cada instancia** (`ReferenceRate` del mes, vía el pivote `USD`), **ignorando** la fila guardada. **Únicos** y **calculados-de-único** sí usan su `exchangeRate`/`anchorCurrency` guardado (TC fecha-específico, dato propio del movimiento). El `exchangeRate` guardado de fijos/cuotas solo se consume como **fallback de último recurso** (ver "Fallback sin cotización de referencia"). Ver "Conversión = capa de display" para la mecánica.
- **Conversión = capa de display, en vivo.** Los totales de `/mes` y de los reportes se computan en la **moneda default vigente** del usuario, convirtiendo cada movimiento desde su moneda original. **La conversión nunca toca lo guardado:** cambiar la `defaultCurrency` re-expresa los totales al vuelo pero no reescribe ningún movimiento. Los endpoints (`GET /movements`, `GET /movements/reports`) **sirven los totales/series ya convertidos** a la default vigente (ver shapes de `MovementItem` y de la serie de reportes, que suman `convertedAmountCents`).
  - **Re-ruteo por el pivote `USD` con la tabla de referencia del mes.** La conversión re-rutea por el **pivote `USD`** usando las **cotizaciones de referencia del MES del movimiento** (`ReferenceRate`): `amount_display = amountCents × exchangeRate × (rate_display / rate_anchor)`, donde `rate_X` = unidades de la moneda `X` por 1 USD en ese mes (USD = 1 implícito). Casos directos: si `currency == displayCurrency` → sin conversión (`convertedAmountCents == amountCents`); si `anchorCurrency == displayCurrency` → se usa `exchangeRate` directo (no hace falta pivote). Conceptualmente: `exchangeRate` lleva el monto de `currency` a `anchorCurrency`, y el factor `rate_display / rate_anchor` lo re-expresa de `anchorCurrency` a la default vigente. Esto es lo que hace que los totales sean **correctos al cambiar la `defaultCurrency`**. La función vive en el helper de conversión del backend (`convertToDisplayCurrency(amountCents, currency, exchangeRate, anchorCurrency, displayCurrency, pivotRates)`).
  - **Derivación por mes para fijos y cuotas (`convertToDisplayCurrencyByMonth`).** El display de **fijos, cuotas, calculados-de-fijo y calculados-de-cuota** **no** usa el `exchangeRate`/`anchorCurrency` guardado en su fila: deriva el TC del **mes de cada instancia** con `deriveExchangeRate(currency, displayCurrency, pivotRates)` sobre las filas `ReferenceRate` del mes (vía el pivote `USD`) y aplica ese TC. La función `convertToDisplayCurrencyByMonth` del helper encapsula esto; delega en `convertToDisplayCurrency(..., null)` (sin `exchangeRate`/`anchorCurrency`) salvo en el fallback. Se invoca en los call-sites del repositorio mensual y del service de reportes. **Únicos** y **calculados-de-único** siguen usando `convertToDisplayCurrency` con su `exchangeRate`/`anchorCurrency` guardado (TC fecha-específico, propio del movimiento). Esto cambia solo el **valor** de `convertedAmountCents` de fijos/cuotas en moneda extranjera; `amountCents` (monto original) y el shape de API no cambian.
  - **Fallback sin cotización de referencia para el mes (gotcha).** Si **no hay filas de `ReferenceRate`** para el mes del movimiento y `anchorCurrency ≠ displayCurrency`, no se puede armar el factor de pivote: se aplica **`exchangeRate` directo**. Es **exacto cuando `anchorCurrency == displayCurrency`** (no hace falta pivote); es un **aproximado** cuando el usuario cambió su default y el mes del movimiento **no tiene cobertura de referencia** (se reusa la cotización anclada al momento de la carga en lugar de re-rutear). Es la única vía por la que la conversión puede quedar aproximada. Para **fijos y cuotas**, donde el TC se deriva del mes (no del rate guardado), este fallback es además la **única vía** por la que su `exchangeRate`/`anchorCurrency` guardado vuelve a consumirse: `convertToDisplayCurrencyByMonth` delega en `convertToDisplayCurrency` con el rate guardado solo cuando el mes no tiene fila de referencia o falta la moneda. Es **casi inalcanzable** porque la resolución del mes de referencia clampa el mes pedido (`resolveNearestYearMonth`) al rango cubierto por la tabla.
- **Aislamiento por usuario.** Todos los recursos (movimientos, categorías, preferencias) pertenecen a un usuario y nunca son visibles para otro.
- **Preferencias de usuario como blob JSON (1:1 con Usuario).** Las preferencias se guardan en una **fila por usuario** (`UserPreferences`, `userId` único, `onDelete: Cascade` — borrar el usuario borra sus preferencias) con el contenido en un único campo `data` de tipo JSON (default `{}`). **Motivo del blob:** poder **agregar preferencias futuras sin migraciones** de esquema — cada consumidor suma sus propias claves al objeto sin tocar la DB. Es un objeto **abierto / extensible**. Una fila se crea solo cuando el usuario muta una preferencia por primera vez (o al dar de alta la cuenta); ver back-compat en `docs/backend.md`.
- **Contraseñas hasheadas.** Las cuentas con email + contraseña guardan únicamente un hash de la contraseña (`passwordHash`, bcrypt/argon2), nunca el texto plano. El hash y la verificación viven en el backend. Las cuentas creadas solo con Google pueden no tener `passwordHash`. El caso de account linking (mismo email por ambos métodos) queda **pendiente sin resolver en v1** (ver `requirements.md`, sección 6).
- **Fechas y zonas horarias (movimiento único).** El movimiento único se almacena como timestamp en UTC (`occurredAt`) junto con la zona horaria original del registro (`timezone`, nombre IANA, ej. `America/Argentina/Buenos_Aires`). El Usuario tiene además un campo `timezone` (zona default / "de casa") que se usa para calcular "hoy" / "mes actual" al crear movimientos y en el dashboard. Los movimientos fijos y las cuotas no aplican esto: operan a nivel mes, sin día ni hora. La regla de presentación y de imputación del mes vive en RN-011 (`requirements.md`); el detalle técnico, en `docs/technical.md` (sección "Fechas y zonas horarias").

---

## Contrato de autenticación (auth / JWT)

Los tres endpoints de auth (`/auth/register`, `/auth/login`, `/auth/google`) devuelven, dentro del sobre `{ success, statusCode, data }`, el mismo shape en `data`:

```
AuthResponse = {
  accessToken: string,
  user: {
    id: string,
    email: string,
    name: string | null,
    image: string | null
  },
  preferences: { ... }      // blob JSON de preferencias del usuario; {} si no tiene fila
}
```

- **`accessToken`** es el JWT que **emite NestJS** (HS256). Sus claims son: `sub` (el `userId`, cuid del usuario), `iat` y `exp` (expira a los **30 días**). El frontend lo trata como **opaco**: lo guarda y lo reenvía como `Authorization: Bearer`, no lo decodifica.
- **Dos tokens distintos.** El `accessToken` (JWT de NestJS) viaja **dentro** de la sesión de Auth.js, que es un **JWE separado** encriptado por NextAuth. No confundirlos: el backend solo valida el JWT de NestJS; nunca ve el JWE de Auth.js. Detalle del flujo en `docs/architecture.md`.
- **`preferences` — blob JSON cargado al loguear.** Los tres flujos (`/auth/login`, `/auth/register`, `/auth/google`) incluyen el blob de preferencias del usuario en `data`, para que el frontend lo cargue **una sola vez** en la sesión de Auth.js al iniciar sesión y no tenga que pedirlo aparte. Es **`{}`** si el usuario no tiene fila de preferencias (usuarios viejos; ver back-compat en `docs/backend.md`). Mutaciones posteriores se hacen contra `PUT /preferences` (abajo), no re-logueando.

---

## Contrato de preferencias de usuario (preferences)

Endpoints de lectura y escritura del blob de preferencias del usuario autenticado. **JWT requerido** en ambos (scope por `userId` del token); `401` global si falta o es inválido. Detalle de implementación y reglas de back-compat en `docs/backend.md`, sección Preferencias de usuario.

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `GET /preferences` | — | `200` · `data: <blob>` | `401` |
| `PUT /preferences` | `{ data: { ...objeto plano... } }` | `200` · `data: <blob persistido>` | `400` · `401` |

- **`GET /preferences`** — sin body. El `data` del sobre es el **blob** de preferencias del usuario, o **`{}`** si no tiene fila (no la crea).
- **`PUT /preferences`** — body `{ data: <objeto plano> }`. El `data` de la respuesta es el blob **persistido**. Hace **upsert** (crea la fila si no existía). `400` si `data` falta o **no es un objeto**.
- **Semántica de reemplazo completo (no merge).** El server **NO** mergea: guarda el `data` recibido **tal cual**, reemplazando el blob entero. **El frontend manda el blob completo** en cada `PUT` — para cambiar una sola clave, el llamador parte del blob actual y reescribe todo (`{ ...preferences, clave: valor }`). Consecuencia: omitir una clave en el `PUT` la **borra**.

### Claves del blob

El blob es un objeto **abierto/extensible**: cada consumidor agrega su(s) propia(s) clave(s) sin tocar la DB (ver decisión "Preferencias de usuario como blob JSON"). Las claves vivas hoy:

#### `monthSections` — estado de las secciones de la Vista del mes (RF-VM-005)

Persiste el estado colapsado/expandido y el orden de las tres secciones de `/mes`.

```
monthSections: {
  order: MonthSectionKey[],        // p.ej. ["unicos","fijos","cuotas"]
  collapsed: MonthSectionKey[]     // claves de las secciones colapsadas
}

MonthSectionKey = "unicos" | "fijos" | "cuotas"
```

- **`order`** — orden en que se muestran las tres secciones (RF-VM-005). Default `["unicos","fijos","cuotas"]`.
- **`collapsed`** — claves de las secciones actualmente colapsadas. Default `[]` (todas expandidas).
- **Back-compat / normalización.** Si `monthSections` **no existe** en el blob → se usa el default (`order: ["unicos","fijos","cuotas"]`, `collapsed: []`). Si `order` trae **claves desconocidas o le faltan**, se **normaliza**: se filtran las desconocidas y se agregan al final las faltantes, preservando el orden válido recibido. Así un blob viejo o parcial nunca rompe la pantalla.
- **El back NO valida ni conoce esta clave:** `PUT /preferences` guarda el blob tal cual (reemplazo total). La normalización y los defaults son responsabilidad del frontend consumidor (ver `docs/frontend.md`, §Vista del mes).

#### `reports` — config de las cards de la pantalla de Reportes (RF-REP-003/004)

Persiste la vista configurable de `/reportes`: una entrada por **card de reporte**, en el orden en que se muestran. Cada card es un widget de reporte autónomo (RF-REP-002).

```
reports: ReportCardConfig[]

ReportCardConfig = {
  id: string,                                   // id local de la card (key de React / quitar); generado en el front
  title?: string,                               // título de la card (RF-REP-008); ausente = placeholder "Reporte N" (display)
  type: ReportCardType,                          // tipo de reporte (RF-REP-001 / RF-REP-010)
  year: number,                                 // año que muestra la card
  categoryIds: string[] | null,                 // null = todas las categorías; lista = subconjunto explícito de categoryIds
  categoryChartMode?: "bar" | "line",            // solo by-category: representación barra vs línea (RF-REP-006); ausente = "bar"
  categoryBreakdown?: boolean,                   // DEPRECADO — ver normalización (solo se lee para migrar)
  hiddenSeries?: Array<"income" | "expense">,    // DEPRECADO — no usado por income-expense; la normalización lo strip en lectura
  movementTypes?: Array<"fijo" | "cuota" | "unico">,  // filtro por tipo (income-expense, RF-REP-014); ausente = todos
  direction?: "expense" | "income" | "both",     // filtro de dirección (income-expense, RF-REP-014); ausente = "both"
  projectFixed?: boolean,                        // INERTE — proyección de fijos (RF-REP-015); retenido en el tipo, ninguna pantalla lo setea/consume
  currency?: "ARS" | "USD" | "EUR" | "BRL",       // moneda de display de la card (RF-REP-007); ausente = default global vigente
  anchorUsdCents?: number                        // solo unique-grid: techo de la escala de color en centavos de USD (RF-REP-010); ausente = default 15 USD (1500)
}

ReportCardType = "income-expense" | "by-category" | "unique-grid" | "installment-gantt" | "inflation-income"
```

Nombres de display de cada tipo (menú "[+]" y mini de reorden): `income-expense` = **"Ingresos vs Gastos"**, `by-category` = **"Gastos por categoría"**, `unique-grid` = **"Gastos Únicos"**, `installment-gantt` = **"Gastos en Cuotas"**, `inflation-income` = **"Inflación vs Ingresos"**.

- **`title`** (RF-REP-008) — título de la card, máx. 60 caracteres, trimmeado al confirmar. Aplica a ambos `type`. **Ausente o vacío** → la card muestra el placeholder **"Reporte N"** (N = posición 1-based de la card en la columna, contando todas las cards; **display puro, no se persiste** y se recalcula en vivo al quitar/reordenar). Si el usuario confirma un título vacío, el campo se **omite** del objeto (back-compat: cards sin `title` muestran el placeholder).
- **`type`** (`ReportCardType`) — `"income-expense"` (Ingresos vs Gastos, RF-REP-001), `"by-category"` (Gastos por categoría, RF-REP-001), `"unique-grid"` (grilla anual de gastos Únicos día × mes, RF-REP-010), `"installment-gantt"` (gantt anual de gastos en Cuotas, RF-REP-011) o `"inflation-income"` (líneas de Inflación vs Ingresos del año, RF-REP-012). La card `income-expense` es **Total-only**: muestra únicamente las dos series agregadas (ingresos vs gastos), sin sub-vista por categoría ni tabs. Las cards `unique-grid`, `installment-gantt` e `inflation-income` persisten los mismos campos base que las otras (`year`, `categoryIds`, `currency`, `title`) y **no** usan `categoryChartMode` ni `hiddenSeries`. La `unique-grid` **sí agrega un campo propio**, `anchorUsdCents` (techo de su escala de color, RF-REP-010); las demás cards anuales lo ignoran. Su fuente de datos es un endpoint propio (`GET /movements/reports/annual-unicos`, `GET /movements/reports/annual-cuotas` y `GET /movements/reports/annual-inflation-income` respectivamente; ver §Contrato de reporte anual de Únicos, §Contrato de reporte anual de Cuotas y §Contrato de reporte anual de Inflación vs Ingresos), distinto de `GET /movements/reports`.
  - **`inflation-income` — toggle de series efímero.** La card grafica tres series (inflación, variación % de ingreso, ingreso ajustado) cuya **visibilidad se togglea por la leyenda**, pero ese toggle es **estado local efímero de la card**: **no** se persiste en el blob (default = las tres visibles; al recargar vuelven todas). Lo que sí se persiste (como en las demás cards anuales) es el filtro de categorías (`categoryIds`) y la moneda (`currency`).
- **`year`** — el año que la card grafica; lo cambia la navegación de año embebida del widget.
- **`categoryIds`** — filtro de categorías de la card. **`null` = todas** (default al crear); una **lista** = subconjunto explícito de `categoryId`s seleccionados. Aplica a ambos tipos (en `income-expense` restringe qué categorías cuentan en los totales; en `by-category`, qué bandas se apilan). Lo que el front manda al endpoint como `categories` deriva de este campo (ver contrato `GET /movements/reports`).
- **`categoryChartMode`** (RF-REP-006) — representación **solo de las cards `by-category`**: `"bar"` = barras apiladas por categoría (default); `"line"` = áreas apiladas por categoría (mismo dato, geometría continua, con línea de contorno = total de gasto). **Ausente = `"bar"`** (back-compat: cards existentes mantienen barras). Irrelevante para los demás tipos. En el dashboard solo se monta `income-expense`, que no usa este campo.
- **`categoryBreakdown`** — **DEPRECADO.** Sigue declarado en el tipo porque la normalización en lectura lo lee para migrar (ver Back-compat). Código nuevo **no** lo escribe ni lo lee; ninguna card nueva lo persiste.
- **`hiddenSeries`** — **DEPRECADO.** Sigue declarado en el tipo porque un blob viejo puede traerlo, pero **income-expense no lo usa**: la **dirección** (`direction`) es el único control de qué líneas se ven (ver RF-REP-014 y `docs/frontend.md`, §Filtros de la card income-expense). La normalización en lectura lo **strip** para las cards `income-expense`; código nuevo no lo escribe ni lo lee.
- **`movementTypes`** (RF-REP-014) — filtro por **tipo de movimiento** de la card `income-expense`: subconjunto de `["fijo", "cuota", "unico"]`. **Ausente = todos los tipos** (back-compat: una card sin el campo computa los tres). `[]` = ninguno (totales en cero). Acota qué tipos alimentan las series Ingresos/Gastos; es un **filtro**, no un desglose. Solo aplica a `type: "income-expense"`. Persistido por card.
- **`direction`** (RF-REP-014) — filtro de **dirección** de la card `income-expense`: `"expense"` (solo gastos), `"income"` (solo ingresos) o `"both"` (ambas). **Ausente = `"both"`** (back-compat). Solo aplica a `type: "income-expense"`. Persistido por card.
- **`projectFixed`** (RF-REP-015) — **INERTE.** Sigue declarado en el tipo (retención de la capacidad de proyección de fijos del backend), pero **ninguna pantalla lo setea ni lo consume**: no hay control de proyección en ninguna card. Una card vieja que traiga `projectFixed: true` simplemente **no renderiza proyección** (el front no manda el param), y el campo **no se migra ni se borra** del blob. Su efecto en la respuesta del endpoint, cuando se pide, está en §Contrato de serie de reportes.
- **Filtro de categoría de `income-expense`** — reusa el campo `categoryIds` ya existente (`null` = todas, lista = subconjunto, `[]` = ninguna); RF-REP-014 **no** agrega un campo nuevo para categoría.
- **`currency`** (RF-REP-007) — moneda de display de la card: una de las 4 monedas (RF-CUR-001). **Ausente = la moneda default global vigente** del usuario (back-compat: una card sin el campo cae a la default; el blob **no se migra**). Al crear una card se persiste con la default actual. El front la manda al endpoint como el query param `currency` de `GET /movements/reports` (override de display; ver contrato más abajo); cambiarla re-expresa la serie al vuelo, sin tocar lo guardado. La card del dashboard no usa este campo (siempre default).
- **`anchorUsdCents`** (RF-REP-010) — **solo `unique-grid`**: techo (ancla) de la escala de color de la grilla, entero, **centavos de USD**, persistido por card. **Ausente/`undefined` = default 15 USD (`1500`)** = comportamiento estándar (back-compat: el blob **no se migra**). Se guarda en USD para ser constante en términos reales; el backend lo reconvierte a la moneda de display con el TC del año de la card (ver §Contrato de reporte anual de Únicos y RF-REP-010). Las demás cards anuales lo ignoran.
- **Orden del array = orden de despliegue** de las cards en pantalla.
- **Ausente / vacío = pantalla vacía.** Clave ausente o `reports: []` → `/reportes` muestra solo el recuadro "[+]" (estado vacío inicial, RF-REP-003).
- **Back-compat / normalización.** Un blob previo **sin** `reports` se interpreta como `[]` (pantalla vacía). La normalización (entradas malformadas, `type` desconocido, `categoryIds` que apunten a categorías inexistentes/eliminadas) es responsabilidad del front (en la **lectura** del blob); un blob viejo o parcial nunca rompe la pantalla. La migración del `categoryBreakdown` deprecado corre acá:
  - `income-expense` + `categoryBreakdown: true` → se convierte en `{ type: "by-category", categoryChartMode: "line" }`, conservando `id`/`title`/`year`/`categoryIds`/`currency` y descartando `categoryBreakdown` e `hiddenSeries`.
  - `income-expense` + `categoryBreakdown` `false`/ausente → queda `income-expense` sin el campo.
  - `income-expense` con `hiddenSeries` → se **strip** el campo (deprecado; la dirección gobierna las líneas).
  - `by-category` sin `categoryChartMode` → se trata como `"bar"`.
- **El back NO valida ni conoce esta clave** (igual que `monthSections`): `PUT /preferences` guarda el blob tal cual. La normalización y los defaults son del frontend consumidor.

#### `monthListFilters` — filtros por listado de la Vista del mes (RF-VM-006)

Filtros **por sección** de `/mes` (tipo + categoría por cada una de Únicos/Fijos/Cuotas), persistidos por usuario. Shape, semántica y back-compat en §Filtro de categorías → `monthListFilters` (más abajo).

#### `unicosSort` — orden de la sección Únicos (RF-VM-001)

Orden de los movimientos únicos de `/mes` (`"amount"` / `"date"`, default `"amount"`). Estado de UI frontend-puro; el backend no lo interpreta. Detalle en §`unicosSort` (más abajo).

#### `unicosSort` — orden de la sección Únicos de la Vista del mes (RF-VM-001)

```
unicosSort: "amount" | "date"
```

- Orden de los movimientos de la sección **Únicos** de `/mes`: `"amount"` (por monto descendente) o `"date"` (por fecha, más reciente primero). **Default `"amount"`** (clave ausente = `"amount"`). Solo aplica a Únicos (Fijos y Cuotas no tienen fecha). Estado de **UI frontend-puro**: el backend **NO lo interpreta** (blob opaco, igual que el resto de las claves). Regla funcional en `requirements.md`, RF-VM-001.

#### `theme` — modo de color de la app (RF-APP-001)

```
theme: "system" | "light" | "dark"
```

- Modo de color elegido desde el chrome global (sidebar, RF-NAV-001): `"system"` (sigue `prefers-color-scheme` del dispositivo), `"light"` o `"dark"`. **Default por ausencia = `"system"`** (la clave ausente se interpreta como Sistema); si el usuario elige "Sistema" explícitamente se persiste `"system"`. Estado de **UI frontend-puro**: el backend **NO lo interpreta** (blob abierto/opaco, igual que el resto de las claves) — el frontend lo mergea sobre el blob en el `PUT /preferences`. Regla funcional en `requirements.md`, RF-APP-001; arquitectura de aplicación (override de tokens, anti-flash) en `docs/frontend.md`, §Modo de color (theming).

#### `sidebarOpen` — estado mostrar/ocultar del sidebar (RF-NAV-002)

```
sidebarOpen: boolean
```

- Sidebar (RF-NAV-001) abierto (`true`) u oculto (`false`). **Default por ausencia = `true`** (abierto). Estado de **UI frontend-puro**: el backend **NO lo interpreta** (blob abierto/opaco, igual que el resto de las claves) — el frontend lo mergea sobre el blob en el `PUT /preferences`. Regla funcional en `requirements.md`, RF-NAV-002.

#### `limits` — límites del usuario (RF-LIM-001..004)

Persiste los **límites**: un array de reglas declarativas. Evaluación **100% client-side**; el backend **NO valida ni conoce** esta clave (blob opaco, igual que `theme` / `reports`).

```
limits: LimitConfig[]

LimitConfig = {
  id: string,                       // id local, generado en el front (key de React / borrar)
  label?: string,                   // nombre del usuario; ausente = placeholder derivado (key + condición)
  enabled: boolean,                 // toggle on/off sin borrar la regla
  anchorKey: string,                // key del catálogo hardcodeado que el límite observa
  refinement?: {                    // acota la key cuando emite muchas instancias
    section?: "unicos" | "fijos" | "cuotas",   // keys de sección de /mes
    categoryId?: string                        // keys por categoría
  },
  temporalScope?: "all" | "current", // (SOLO passive) a qué meses aplica la marca: todos (default) | solo el mes en curso. Inaplicable/ausente en active
  operator: "gt" | "gte" | "lt" | "lte" | "eq",
  threshold: number,                // número puro, sin moneda (RN-022); su unidad la fija el `unit` de la key
  nature: "passive" | "active",     // passive = marca visual; active = aviso al guardar (solo keys mes.*)
  effect?: string                   // (SOLO passive) id del efecto visual; debe pertenecer al subset de la key. Ausente en active
}
```

- **`nature: "active"`** solo es válida sobre las 7 keys `mes.*` (RF-LIM-004). Un límite activo **no lleva `effect`** (avisa, no marca) **ni `temporalScope`** (siempre proyecta sobre el mes destino del movimiento); su `operator` queda restringido por la polaridad del anclaje (techo `gt`/`gte`, piso `lt`/`lte`). `nature: "passive"` es la única válida sobre keys de dashboard/reportes y usa `effect` + `temporalScope`.

- **El catálogo de keys es un registro hardcodeado del frontend**, no un contrato de DB: es el "lenguaje común" entre los datos que emiten cada key (anclajes) y los consumidores (panel + evaluador). La fuente de verdad del registro (keys, unidades, refinamientos, subset de efectos y default por anclaje) vive en el frontend (`lib/limits/catalog.ts`, ver `docs/frontend.md`, §Límites); el catálogo de **efectos visuales** y su mapeo por anclaje vive en `docs/design.md`. Reglas funcionales en `requirements.md`, módulo 3.13.
- **`threshold` es un número puro sin moneda** (RN-022): su tipo (money / signed-money / percent / count) lo determina el `unit` de la key en el registro, no el límite.
- **Back-compat / normalización.** Clave ausente o `limits: []` → sin límites (cero-impacto, cada superficie idéntica a sin la feature, RN-022). La normalización (entradas malformadas, `anchorKey` desconocida, `effect` fuera del subset de la key) es responsabilidad del front en la lectura del blob; un blob viejo o parcial nunca rompe la pantalla.
- **El back NO valida ni conoce esta clave** (igual que `monthSections` / `reports` / `theme`): `PUT /preferences` guarda el blob tal cual (reemplazo total). La normalización y los defaults son del frontend consumidor.

#### `defaultPaymentMethods` — método de pago predeterminado por estructura (RF-PM-007)

Método de pago que **prellena** el selector del formulario al **crear** un movimiento, por estructura. Evaluación **100% client-side**; el backend **NO valida ni conoce** esta clave (blob opaco, igual que `theme` / `reports` / `limits`).

```
defaultPaymentMethods?: {
  unico: string | null;   // id de método de pago activo, o null (ninguno)
  fijo:  string | null;
  cuota: string | null;
}
```

- **Tres slots independientes** (`unico` / `fijo` / `cuota`), uno por estructura de movimiento. Cada uno guarda el `id` de un método de pago o `null`.
- **Ausente ≡ los tres en `null`** (ningún default).
- **Exclusividad por estructura:** cada slot apunta a lo sumo a un `id`; un mismo `id` puede repetirse en varios slots (un método default de varias estructuras). Escribir un slot reemplaza su valor previo (RF-PM-007).
- **Validación en lectura (fallback):** un slot cuyo `id` no corresponde a un método de pago **activo** se trata como `null`. Es la fuente de verdad ante un método eliminado: el blob **no se limpia** al borrar el método (RF-PM-007).
- **El back NO valida ni conoce esta clave:** `PUT /preferences` guarda el blob tal cual (reemplazo total). La normalización, el prefill (solo en creación, editable; no en edición ni en calculados) y los defaults son del frontend consumidor. Regla funcional en `requirements.md`, RF-PM-007.

#### `monthCategoryFilter` — filtro de categorías de la Vista del mes (RF-VM-006) — **DEPRECADA**

Deprecada. No se lee ni se escribe desde `/mes`; se conserva en el tipo para no romper blobs viejos y **no se migra**. Detalle en §Filtro de categorías → `monthCategoryFilter` (más abajo).

---

## Contrato de configuración del usuario (settings)

Lectura y escritura de los ajustes de cuenta del usuario autenticado: la **moneda por defecto** y el **último cambio usado**. Alimenta la pantalla `/configuracion` (ver `screens.md`) y el fallback de cotización de los formularios. **JWT requerido** (scope por `userId` del token); `401` global si falta o es inválido. Reglas funcionales en `requirements.md`, módulo 3.10 (RF-CUR-002/003/006).

| Endpoint | Body / Query | Éxito | Errores |
|----------|------|-------|---------|
| `GET /settings` | — | `200` · `data: Settings` | `401` |
| `PATCH /settings` | `{ defaultCurrency?, lastExchangeRate? }` | `200` · `data: Settings` (persistido) | `400` · `401` |
| `GET /settings/reference-rate` | `?month=YYYY-MM&currency=XXX` | `200` · `data: ReferenceRateResponse` | `400` · `401` |

```
Settings = {
  defaultCurrency: "ARS" | "USD" | "EUR" | "BRL",   // moneda en la que se expresan los totales/reportes (default ARS)
  lastExchangeRate: number | null                   // último cambio real ingresado (default por 1 unidad de la otra moneda); null si nunca ingresó una cotización ≠ 1
}
```

- **`GET /settings`** — sin body. Devuelve la moneda default y el último cambio del usuario. `lastExchangeRate` es **`null`** mientras el usuario no haya ingresado una cotización real (el default `1` de los movimientos no lo setea — ver "Moneda explícita, set curado").
- **`PATCH /settings`** — body parcial: `defaultCurrency` (una de las 4 monedas) y/o `lastExchangeRate` (número > 0). Devuelve el `Settings` persistido. `400` si algún campo es inválido (moneda fuera del set, cotización ≤ 0).
- **Cambiar `defaultCurrency` no toca ningún movimiento** (RF-CUR-005): solo cambia la moneda en la que `GET /movements` y `GET /movements/reports` sirven los totales convertidos. Es la contraparte de "Conversión = capa de display".

#### `GET /settings/reference-rate` — pre-fill de cotización del mes

Devuelve la cotización de referencia a usar como **pre-fill** del campo de cotización del formulario, para un mes y una moneda de movimiento. Query: `month` (`YYYY-MM`) y `currency` (una de las 4 monedas), ambos requeridos.

```
ReferenceRateResponse = {
  currency: "ARS" | "USD" | "EUR" | "BRL",          // la moneda del movimiento pedida
  defaultCurrency: "ARS" | "USD" | "EUR" | "BRL",   // la default vigente del usuario
  yearMonth: "YYYY-MM",                             // el mes pedido
  exchangeRate: number | null                       // unidades de la default por 1 unidad de `currency`, derivado de la tabla del mes
}
```

- **`exchangeRate`** = unidades de la **default** por 1 unidad de `currency`, **derivado del pivote `USD`** sobre las filas `ReferenceRate` del `yearMonth` (ver §Tabla de cotizaciones de referencia). Es **`1`** si `currency == defaultCurrency`; es **`null`** si el mes no tiene dato de referencia para derivar el cruce (el front cae al fallback `lastExchangeRate`).
- **`400`** si `month` o `currency` faltan o son inválidos (formato / fuera del set).

### Tabla de cotizaciones de referencia (`ReferenceRate`)

Tabla **global** (sin `userId`), **interna y no editable por UI**, que guarda una cotización de referencia por `(currency, yearMonth)`. Es **valor por copia, no FK**: solo alimenta el pre-fill de la cotización del movimiento (`GET /settings/reference-rate`); el movimiento conserva su propia `exchangeRate` editable.

- **Clave única `(currency, yearMonth)`.** `currency` es una de las 4 monedas; `yearMonth` en formato `"YYYY-MM"`. Global: una sola tabla compartida por todos los usuarios.
- **`rate` (`Decimal`) = unidades de la moneda por 1 `USD`.** El **pivote es `USD`**: cada fila expresa cuántas unidades de esa moneda vale 1 USD en ese mes. **`USD` NO tiene fila** (pivote implícito, `rate = 1`).
- **Derivación de cualquier cruce vía el pivote `USD`.** Para obtener "unidades de A por 1 unidad de B" en un mes, se combinan `rate(A)` y `rate(B)` del mes (con `USD` = 1 implícito). De ahí salen tanto los pares triviales (los que tocan USD) como los no triviales (EUR↔BRL, etc.). Si falta alguna de las filas necesarias del mes → el cruce no se puede derivar → `null`.
- **Sembrada por seed idempotente** (`backend/prisma/seed-reference-rates.ts`): **54 filas** = 3 monedas (ARS, EUR, BRL; USD no lleva fila) × 18 meses (2025-01 … 2026-06). Idempotente (upsert por la clave única). En **producción** se corre con `pnpm seed:rates` (directo, sin gate ni dry-run). En **desarrollo** ya queda incluido en `pnpm db:seed` (y en `prisma migrate dev`), porque `prisma/seed.ts` invoca `seedReferenceRates`. Ver agente backend.
- **`ReferenceRate` se alimenta del oficial.** La sincronización externa (`POST /settings/reference-rates/sync`, RF-FX-001) escribe `ReferenceRate.rate` con la cotización **oficial** del mes (ARS oficial de dolarapi; EUR/BRL de Frankfurter). La conversión interna del producto sigue usando **solo** `ReferenceRate` (sin tocar su semántica ni su clave única); las **variantes** (blue, etc.) se guardan aparte en `CurrencyQuote` (abajo) y **no** alimentan la conversión todavía (no hay UI para elegir variante). Ver §Cotizaciones externas y sincronización.

---

## Cotizaciones externas y sincronización (P7a / P7b)

> Captura de cotizaciones FX y de IPC desde fuentes oficiales externas, vía un trigger sin datos en el body (`POST /settings/reference-rates/sync`). El sync captura **solo el mes corriente** (FX e IPC); no puebla histórico. El histórico de IPC viene sembrado por una data migration (`20260623000000_seed_historical_ipc`, ver §`InflationRate`). Tres tablas nuevas —`CurrencyQuote` (variantes FX), `InflationRate` (IPC), `RateSyncLog` (auditoría)— **globales** (sin `userId`), internas, no editables por UI. Reglas funcionales en `requirements.md`, módulo 3.12 (RF-FX-001, RF-IPC-001). Decisiones técnicas de seguridad de la ingesta en `.claude/agents/control-backend.md`, §Sincronización de cotizaciones externas.

### `CurrencyQuote` — variantes de cotización FX (tabla relacional)

Tabla **global**, **interna y no editable por UI**, que guarda **una fila por variante de cotización** capturada de las fuentes externas. Desacoplada de `ReferenceRate`: `ReferenceRate` guarda **el** valor que usa la conversión interna (el oficial); `CurrencyQuote` guarda **todas** las variantes publicadas (oficial, blue, y cualquiera futura) como histórico crudo de fuente.

- **Modelo elegido: tabla relacional, NO blob JSON.** Una fila por `(currency, variant, yearMonth)`, no un objeto de variantes embebido. **Por qué tabla y no JSON:** (1) la unidad de escritura del sync es una variante puntual (upsert idempotente por clave única, circuit breaker por variante) — un blob obligaría a leer-modificar-reescribir el objeto entero en cada sync; (2) cada variante necesita sus propios `source` / `fetchedAt` / `compra` / `venta`, que en JSON quedarían como sub-objetos sin tipado ni constraint; (3) el histórico se consulta por `(moneda, variante, mes)`, patrón natural de fila+índice. El blob `UserPreferences` usa JSON porque es **estado de UI por usuario sin consulta relacional**; esto es lo opuesto (dato de dominio global, consultable, escrito por variante).
- **`variant` es string libre, NO enum.** Decisión deliberada de "mente abierta a variantes futuras" (RF-FX-001): Argentina publica cotizaciones nuevas sin aviso (blue, MEP, CCL, tarjeta…) y un enum obligaría una migración por cada una. Se valida en el borde contra una **allowlist hardcodeada de variantes conocidas** (`"oficial"`, `"blue"` hoy) en el código del sync, no con un constraint de DB: agregar una variante es editar la allowlist, sin migración. La columna admite cualquier string; el control de qué se escribe vive en la capa de aplicación.
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

### `InflationRate` — IPC argentino (P7b)

Tabla **global**, **interna y no editable por UI**, que guarda el IPC nacional (INDEC) por mes. La consume el **reporte anual de gastos Únicos** (RF-REP-010): el footer de la grilla usa `monthlyVariation` del mes para la métrica de inflación y para el % de diferencia ajustado por inflación. Fuente: `apis.datos.gob.ar` (series de tiempo INDEC).

| Campo | Tipo | Notas |
|---|---|---|
| `yearMonth` | `String` | `"YYYY-MM"`. **Clave única.** |
| `monthlyVariation` | `Decimal` | variación mensual del IPC, en puntos porcentuales (serie `145.3_INGNACUAL_DICI_M_38`) |
| `indexValue` | `Decimal` | nivel del índice IPC (serie `148.3_INIVELNAL_DICI_M_26`) |
| `source` | `String` | host de origen (`"apis.datos.gob.ar"`) |
| `fetchedAt` | `DateTime` | instante de captura (UTC) |

- **Clave única `yearMonth`.** El IPC nacional es un único valor por mes (sin moneda ni variante). Upsert idempotente por esta clave.
- **Consumo.** No alimenta la conversión de monedas ni los totales del mes. La consumen el reporte anual de gastos Únicos (RF-REP-010, footer de inflación y % ajustado; ver §Contrato de reporte anual de Únicos) y el reporte anual de Inflación vs Ingresos (RF-REP-012, serie de inflación y ajuste del ingreso; ver §Contrato de reporte anual de Inflación vs Ingresos).
- **Histórico sembrado por data migration (`20260623000000_seed_historical_ipc`).** El histórico de IPC viene horneado por esta migración de Prisma: **113 meses (2017-01 … 2026-05)** de la serie completa de INDEC (`apis.datos.gob.ar`, variación e índice) insertados con `ON CONFLICT ("yearMonth") DO NOTHING`. Idempotente y convive con el sync diario sin pisarse: el sync solo cubre el **mes corriente**, la migración cubre el pasado.

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
- **Variante = string libre con allowlist en código.** `CurrencyQuote.variant` no es enum (mente abierta a variantes futuras): la allowlist de variantes aceptadas (`"oficial"`, `"blue"`) vive en el código del sync, no en la DB. Agregar una variante = editar la allowlist, sin migración.
- **Auditoría.** `RateSyncLog` guarda una fila por intento de escritura (timestamp, fuente, target, payload crudo, aceptado/rechazado, motivo). El body del request **no** acepta valores de cotización (la whitelist de class-validator los descarta); a lo sumo un selector de scope `fx`/`ipc`/`all`.
- **Rate-limiter en memoria (gotcha).** El tope de **10 req/min por IP** del endpoint es **en memoria** del proceso — no usa `@nestjs/throttler` ni Redis. En un deploy **multi-instancia** el límite **no es global**: cada instancia cuenta por separado. Para un límite realmente global haría falta un store compartido (Redis).

---

Toda respuesta exitosa de los endpoints de categorías devuelve, dentro del sobre `{ success, statusCode, data }`, este shape:

```
Categoria = {
  id: string,
  userId: string,
  name: string,                          // tal cual lo tipeó el usuario
  scope: "BOTH" | "EXPENSE" | "INCOME",
  color: string,                         // "#HEX" de la matriz, en mayúsculas; editable
  deletedAt: null,                       // las respuestas solo traen activas
  createdAt: string,
  updatedAt: string,
  movementCount: number
}
```

- **`movementCount` — derivado de solo lectura.** Es la suma de las **tres relaciones de movimiento** que referencian la categoría: movimientos únicos + fijos + grupos de cuotas. No es un campo almacenado ni editable; el backend lo calcula al responder. Cero si la categoría no tiene movimientos. Alimenta el contador "N movimientos" de la pantalla de categorías (RF-CAT-006) y **no** se confunde con los totales de dinero del mes (ver `requirements.md`, RF-VM-002).
- **`color` — editable, de la matriz.** `POST /categories` y `PATCH /categories/:id` aceptan `color?: string` **opcional**. Validación: debe **pertenecer a la matriz de 40** (case-insensitive; se **almacena en mayúsculas**); un color fuera de la matriz → **`400`**. En `POST`, si **no** llega `color`, el backend asigna el "menos usado" como **red de seguridad** — pero el frontend **siempre lo envía**. Detalle de la validación en `docs/backend.md`, sección Pool de colores.

### Payload reactivable en errores (409)

Cuando se intenta crear una categoría cuyo nombre normalizado colisiona con una **eliminada** (RF-CAT-002, A3), el backend responde `409` y adjunta, dentro del sobre de error, un `data` estructurado:

```
error.data = {
  reactivable: true,
  category: { id, name, scope, color }
}
```

- Es el **único** caso en que el sobre de error lleva `data`; el resto de los errores no lo incluyen. El front usa `category.id` para ofrecer reactivar (`POST /categories/:id/reactivate`) sin un endpoint extra de búsqueda. La colisión con una categoría **activa** (RN-008) responde `409` **sin** `data`.

### Matriz de colores (dato del dominio)

El set **elegible** por el usuario es una **matriz de 40 colores** (`COLOR_MATRIX`: 8 hues × 5 tonalidades), única en el backend. Los 8 hues son rojo, naranja, oro, verde, teal, azul, violeta y magenta; las 5 tonalidades van de L1 (clara) a L5 (oscura). El color **es editable** por el usuario, tanto al crear como al editar; solo se aceptan colores de la matriz (sin hex libre).

- **Pool base de 8 como base del "menos usado".** Los **8 colores base** (`COLOR_POOL`) son un **subconjunto explícito** de la matriz —uno por hue, en su fila vívida— dispuestos en un **orden propio salteado por la rueda cromática**, **no** una fila posicional de la matriz. Por eso el backend lo modela como un **array explícito**, no derivado por posición. Sobre esos 8 base se calcula el default "menos usado" al crear (regla en RN-013); las categorías por defecto del alta toman los primeros 4 en orden. Es solo un default: el usuario puede elegir cualquiera de los 40.
- El color es solo presentación. Detalle de `COLOR_MATRIX` / `COLOR_POOL` y la estrategia en `docs/backend.md`, sección Pool de colores.

---

## Métodos de pago (`PaymentMethod`)

Toda respuesta exitosa de los endpoints de métodos de pago devuelve, dentro del sobre `{ success, statusCode, data }`, este shape (CRUD espejo del de categorías; reglas funcionales en `requirements.md`, §3.6.b y RN-021):

```
PaymentMethod = {
  id: string,
  userId: string,
  name: string,                          // tal cual lo tipeó el usuario
  type: "CREDIT" | "DEBIT" | "CASH",     // allowlist en código (string, no enum)
  icon: string,                          // clave del set curado; "card" default/fallback
  closingDay: number | null,             // día del mes 1-31; solo CREDIT (null en DEBIT/CASH)
  paymentDay: number | null,             // día del mes 1-31; solo CREDIT (null en DEBIT/CASH)
  deletedAt: null,                       // las respuestas solo traen activos
  createdAt: string,
  updatedAt: string,
  movementCount: number
}
```

- **`type` — string con allowlist en código**, no enum de Prisma (extensible sin migración; ver decisión de modelado). Rótulos UI: Crédito / Débito / Efectivo.
- **Campos condicionales nullable.** `closingDay`/`paymentDay` solo tienen valor en `CREDIT`; en `DEBIT`/`CASH` vienen `null` (ningún campo condicional). Días válidos 1-31; si el valor excede el último día del mes se **clampea** a ese último día (informativo, no mueve imputación; RN-021).
- **`icon` — string con allowlist en código**, default/fallback `card`; una marca ausente del set cae a `card`. Es la única identidad visual (no hay `color`). El set concreto vive en `docs/design.md`.
- **`movementCount` — derivado de solo lectura**, suma de las tres relaciones de movimiento (únicos + fijos + grupos de cuotas) que referencian el método vía `paymentMethodId`. Cero si no tiene movimientos. Alimenta el contador "N movimientos" (RF-PM-005). No se confunde con los totales de dinero.
- **Payload reactivable en errores (409).** Igual que categorías, la colisión con un método **eliminado** (RF-PM-001 A4) responde `409` con `error.data = { reactivable: true, paymentMethod: { id, name, type, icon } }`; la colisión con uno **activo** responde `409` sin `data`.

---

## Contrato de movimiento único (respuesta de la API)

Toda respuesta exitosa de los endpoints de movimientos únicos devuelve, dentro del sobre `{ success, statusCode, data }`, este shape (el modelo Prisma ya está documentado en `docs/backend.md`, sección Capa de datos):

```
Transaction = {
  id: string,
  userId: string,
  categoryId: string,
  type: "EXPENSE" | "INCOME",
  amountCents: number,                       // entero en centavos, siempre > 0
  description: string | null,
  occurredAt: string,                        // ISO 8601 en UTC (instante)
  timezone: string,                          // IANA del registro
  createdAt: string,
  updatedAt: string,
  category: { id, name, color, scope },      // categoría embebida
  paymentMethodId: string | null,            // método de pago asociado; null = sin método
  paymentMethod: { id, name, icon, type } | null,  // método embebido; null si no tiene
  autoDebit: boolean | null                  // flag débito automático del movimiento; null salvo método DEBIT (RN-021)
}
```

- **`amountCents` — entero en centavos** (RN-002): el front recibe centavos y formatea a pesos para mostrar.
- **Método de pago embebido (opcional).** `paymentMethodId` es `null` cuando el movimiento no tiene método; cuando lo tiene, `paymentMethod` trae `{ id, name, icon, type }` (RF-PM-006). Metadato: no entra a ningún total.
- **`occurredAt` + `timezone` — instante, no fecha de calendario** (RN-004): `occurredAt` es el momento en UTC y `timezone` (IANA) es la zona original del registro, en la que siempre se muestra. El mes al que pertenece se determina en esa zona. Detalle técnico en `docs/technical.md` (Fechas y zonas horarias).
- **Categoría embebida.** Cada movimiento trae `category: { id, name, color, scope }` — el front no necesita un GET extra de categorías para mostrar nombre y color.

---

## Contrato de movimientos del mes (respuesta de `GET /movements`)

`GET /movements?month=YYYY-MM` devuelve, dentro del sobre `{ success, statusCode, data }`, los movimientos del mes agrupados por origen **más los totales**. Es el endpoint unificado de la Vista del mes y el Dashboard (detalle de implementación en `docs/backend.md`, sección Movimientos del mes).

**Query params:**

- **`month`** (requerido) — el mes a listar, `YYYY-MM`.
- **`categories`** (opcional) — filtro por categoría. Lista de `categoryId`s **separados por comas, sin URL-encode** (ej. `categories=abc,def`). **Distingue "ausente" de "presente y vacío"** (ver tabla del filtro de categorías más abajo): ausente = todas; `categories=` (vacío) = ninguna (listas vacías + totales en cero); lista = solo esas categorías. Afecta **gastos e ingresos** y recalcula **listas y totales**. **`/mes` no usa este param:** el filtrado de la Vista del mes ocurre en el frontend (filtros por listado, RF-VM-006), así que `/mes` trae todo el mes sin `categories`. El param lo consume `GET /movements/reports` (filtro de reportes).

```
data = {
  month: "YYYY-MM",
  totals: {
    expenseCents: number,   // suma de gastos del mes
    incomeCents: number,    // suma de ingresos del mes
    balanceCents: number    // incomeCents - expenseCents (puede ser negativo)
  },
  movements: {
    unicos: MovementItem[],   // ordenados por amountCents DESC (desempate: occurredAt DESC)
    fijos:  MovementItem[],   // ordenados por amountCents DESC (desempate: createdAt DESC)
    cuotas: MovementItem[]    // ordenados por amountCents DESC (desempate: id ASC)
  }
}
```

```
MovementItem = {
  id: string,
  origin: "unico" | "fijo" | "cuota",        // discriminador del tipo de movimiento
  type: "EXPENSE" | "INCOME",
  amountCents: number,                       // centavos de la MONEDA ORIGINAL del ítem
  currency: "ARS" | "USD" | "EUR" | "BRL",   // moneda original del ítem
  exchangeRate: number,                      // unidades de la anchorCurrency (interna) por 1 unidad de currency, del ítem/mes (Decimal serializado)
  convertedAmountCents: number,              // amountCents convertido a la default vigente vía re-ruteo por pivote USD; == amountCents si currency == default. En calculados es MAGNITUD (≥ 0): el signo se lee de amountCents
  description: string | null,
  occurredAt: string | null,                 // ISO 8601 en UTC; null en fijos y cuotas (sin día/hora)
  timezone: string | null,                   // IANA del registro; null en fijos y cuotas
  installment: {                             // presente solo en cuotas; null en únicos y fijos
    number: number,                          //   nro de cuota del mes (1-based)
    total: number,                           //   cantidad total de cuotas del grupo
    startMonth: string                       //   "YYYY-MM", mes de inicio del grupo
  } | null,
  frequency: number | null,                  // fijos: su frecuencia (entero 1..12, meses entre apariciones); únicos y cuotas: null
  startMonth: string | null,                 // "YYYY-MM", arranque del fijo lógico; solo origin==="fijo" (incluye calculado de fijo: su propio arranque); null en único y cuota (la cuota lo trae en installment.startMonth)
  endMonth: string | null,                   // "YYYY-MM" EXCLUSIVO, fin/vigencia del fijo lógico; solo origin==="fijo" (incluye calculado de fijo: su propio fin); null = activo indefinidamente / no aplica (único/cuota)
  skipped: boolean,                          // true = anulado (excluido de totales/reportes). fijo: RecurringSkip del mes; único: flag Transaction.skipped; cuota: InstallmentSkip del mes visualizado; calculado: skip propio (solo de fijo) OR skip del origen del mes
  category: { id, name, color, scope },      // embebida
  paymentMethod: { id, name, icon, type, closingDay, paymentDay } | null,  // método embebido; null si el movimiento no tiene (RF-PM-006). closingDay/paymentDay: día del mes 1-31, poblados solo si type==="CREDIT" (null en DEBIT/CASH)
  autoDebit: boolean | null,                 // flag débito automático DEL movimiento (fuera de paymentMethod); null salvo método DEBIT (RN-021)
  calculated: CalculatedInfo | null,         // presente si el ítem ES un calculado (hijo); null si no
  hasCalculated: boolean,                    // == calculatedChildren.length > 0: true si el ítem es un ORIGEN (fijo/único/cuota) con ≥1 calculado en el mes (padre); false en el resto
  calculatedChildren: CalculatedChild[]      // los calculados derivados de ESTE ítem en el mes consultado; [] si no tiene, o si el ítem ES un calculado (nunca es padre)
}

CalculatedChild = {                          // un calculado derivado del ítem padre, en el mes consultado
  id: string,                                //   id del calculado (fila Recurring)
  description: string | null,                //   descripción propia del calculado
  type: "EXPENSE" | "INCOME",                //   tipo derivado del signo del monto del calculado (RN-018)
  convertedAmountCents: number,              //   MAGNITUD (≥ 0) del monto convertido a la default vigente — sin signo; el signo se lee de `type`
  formulaOperator: "ADD"|"SUB"|"MUL"|"DIV"|"PCT",
  formulaOperand: number,                    //   operando ESCALADO (entero) — ver "Escalado del operando"
  formulaSign: 1 | -1                        //   signo del resultado
}

CalculatedInfo = {                           // solo en ítems que son calculados
  sourceType: "fijo" | "unico" | "cuota",    // tipo del origen del calculado
  sourceId: string,                          // id del origen: chainId (fijo) / Transaction.id (único) / InstallmentGroup.id (cuota)
  sourceChainId: string | null,              // chainId del fijo de origen (fijo); null para único/cuota
  sourceDescription: string | null,          // descripción del origen en el mes (para el preview / "desde {Origen}")
  formulaOperator: "ADD"|"SUB"|"MUL"|"DIV"|"PCT",
  formulaOperand: number,                    // operando ESCALADO (entero) — ver "Escalado del operando" abajo
  formulaSign: 1 | -1,                       // signo del resultado
  sourceAmountCents: number                  // monto del origen en el mes (centavos, > 0); base de la fórmula. Para CUOTA = monto por cuota del grupo
}
```

- **Discriminador `origin`.** Cada ítem declara su tipo de movimiento (`unico` / `fijo` / `cuota`), además de venir ya agrupado en su lista. El front lo usa para rotular el origen y elegir el flujo de edición/eliminación.
- **Orden de las listas.** Los tres grupos vienen ordenados por **magnitud del monto descendente** = `\|amountCents\|` DESC (monto más grande primero, por tamaño, sin distinguir `EXPENSE` de `INCOME`). Para únicos, fijos normales y cuotas `amountCents > 0`, así que la magnitud coincide con el valor; para un **movimiento calculado** (en `fijos`) el `amountCents` puede ser **negativo** (RN-018), por lo que se ordena por su **valor absoluto** — un calculado de `−5000` se ubica entre los demás por su tamaño (5000), no al final por ser negativo. Desempate estable por grupo: `unicos` por `occurredAt` DESC, `fijos` por `createdAt` DESC, `cuotas` por `id` ascendente.
- **`occurredAt` / `timezone` son nullable.** Para **únicos** vienen presentes (instante + zona). Para **fijos** y **cuotas** vienen **`null`**: operan a nivel mes, no tienen día/hora/zona. El front no debe pasar estos campos a `formatDate` / `formatTime` sin chequear null. **Calculados:** un calculado **hereda `occurredAt`/`timezone` del origen** — el de **único** los trae **poblados** (los del `Transaction` de origen), consistente con que todos los ítems de la sección Únicos muestran día/hora y con que el calculado ocurre "junto con" su origen; el de **fijo** y el de **cuota** quedan en **`null`** (su origen tampoco tiene día/hora). El shape admite ambos como `string | null`.
- **`installment` solo en cuotas.** Para una cuota trae `{ number, total, startMonth }`: `number` es el número de cuota del mes (1-based), `total` es el `totalInstallments` del grupo y `startMonth` es el mes de inicio del grupo. Para **únicos** y **fijos** es **`null`**. El front lo usa para la etiqueta "Cuota X/N" y para prefilear la edición del grupo.
- **`startMonth` en fijos.** Para un **fijo** trae el **arranque del fijo lógico** = `startMonth` de la **primera fila de su cadena** (`chainId`), no el de la fila vigente tras un split de edición (RF-MF-007; resolución por cadena en `docs/backend.md`, §Movimientos fijos). Un **calculado de fijo** trae su **propio** arranque (el de su cadena), no el del origen. Es **`null`** en únicos (usan `occurredAt`) y en cuotas (traen su arranque en `installment.startMonth`).
- **`endMonth` en fijos.** Para un **fijo** trae el **fin del fijo lógico** (vigencia) = el `deletedFrom` de la fila con **mayor `startMonth`** de su cadena (la **fila vigente**), en formato `"YYYY-MM"` **EXCLUSIVO** (mismo criterio que `Recurring.deletedFrom`: el mes indicado ya **no** aparece; el último mes activo es el anterior). **`null` = activo indefinidamente** (sin terminación programada). Un **calculado de fijo** trae el fin de su **propia** cadena, no el del origen. Es **`null`** en únicos y cuotas (no aplica: la cuota tiene fin implícito vía `installment.number`/`total`). Lo consume la card de detalle (RF-MF-007 / RF-VM-007); resolución por cadena en `docs/backend.md`, §Movimientos fijos.
- **`frequency` / `skipped`.** Para un **fijo**, `frequency` es su periodicidad (**entero 1..12** = meses entre apariciones, RF-MF-006) y `skipped` indica si esa aparición está **anulada para el mes consultado** (RF-MF-005). Para un **calculado de fijo**, `frequency` es **`null`** y `skipped = skip propio del calculado **OR** skip del fijo de origen` (RF-MF-005 / RF-MCALC-005): un calculado de fijo se puede anular por su cuenta y además hereda la anulación de su origen. Para un **único**, `frequency` es **`null`** y `skipped` refleja su anulación (flag `Transaction.skipped`, RF-MU-005); para una **cuota**, `frequency` es **`null`** y `skipped` refleja la anulación de esa instancia mensual (`InstallmentSkip` del mes visualizado, RF-MC-004). Un **calculado de único o de cuota** hereda `skipped` del origen del mes (no tiene skip propio, RF-MCALC-005). Un ítem con `skipped: true` **viene igual en la lista** (no se omite) pero **no está incluido en `totals`** — el front lo muestra con su diferenciación visual de anulado. El front usa `frequency` para rotular la cadencia y `skipped` para el estado y el toggle de la acción anular/des-anular.
- **Moneda y conversión por ítem.** Cada `MovementItem` trae su moneda original (`currency`, una de las 4), la cotización guardada (`exchangeRate` = unidades de su **`anchorCurrency` interna** por 1 unidad de `currency` del ítem / del mes en fijos / del grupo en cuotas — ver "Semántica de `exchangeRate`") y `convertedAmountCents` = `amountCents` **convertido a la moneda default vigente** del usuario, vía re-ruteo por el pivote `USD` con la tabla de referencia del mes (ver "Conversión = capa de display"). **Para fijos, cuotas y sus calculados** el `convertedAmountCents` se deriva del **TC oficial del mes de la instancia** (`ReferenceRate`), **no** del `exchangeRate` reportado en este campo (que conserva el valor guardado de la fila); **únicos** y **calculados-de-único** sí lo derivan de su `exchangeRate` guardado (ver "El display de fijos y cuotas NO usa el `exchangeRate` guardado"). Si la moneda del ítem **coincide** con la default, `convertedAmountCents == amountCents`. El `MovementItem` **no expone `anchorCurrency`** (es interna): el front no la necesita, ya recibe el `convertedAmountCents` listo. Un **calculado** hereda `currency`/`exchangeRate` del origen (RF-CUR-004). **`convertedAmountCents` de un calculado es siempre magnitud (`≥ 0`), no un valor con signo:** solo lleva la cifra del monto convertido a la default. El **signo** del calculado —y por ende su `type` (negativo ⇒ `EXPENSE`, positivo ⇒ `INCOME`)— vive únicamente en `amountCents`, que sí lo conserva. El display que necesite el signo de un calculado debe leerlo de `amountCents` y usar `convertedAmountCents` solo para la cifra (en moneda default). El front muestra el monto original (`amountCents` + `currency`) y el convertido; ver `screens.md` §Vista del mes / Formulario y `design.md`.
- **Los totales del mes usan `convertedAmountCents`.** Los `totals` (`expenseCents` / `incomeCents` / `balanceCents`) suman la **magnitud de `convertedAmountCents`** (no de `amountCents`): es la única forma de sumar movimientos de distintas monedas en una sola cifra. La conversión es **capa de display** (no toca lo guardado); cambiar la default re-expresa los totales. La imputación por bucket de tipo sigue RN-019.
- **Los totales suman movimientos, no categorías.** `expenseCents` / `incomeCents` agregan la **magnitud** (`\|convertedAmountCents\|`) de los movimientos del mes **en el bucket de su `type`** (RN-019): un `INCOME` suma a `incomeCents`, un `EXPENSE` a `expenseCents`. Para movimientos normales `amountCents > 0` y el `type` es fijo. Para un **movimiento calculado** el `amountCents` puede ser **negativo o cero** (RN-018) y su `type` se **deriva del signo** (negativo → `EXPENSE`, positivo → `INCOME`); como signo y tipo siempre coinciden, suma su magnitud al bucket correcto —un calculado de `−2000` es `EXPENSE` y suma 2000 a `expenseCents`; uno de `+2000` es `INCOME` y suma 2000 a `incomeCents`; un monto 0 no aporta a ningún bucket—. No hay restas ni reasignación de bucket. `balanceCents = incomeCents - expenseCents`, sin piso (negativo si los gastos superan los ingresos). No se confunden con el contador `movementCount` de la pantalla de categorías (ver más arriba y `requirements.md`, RF-VM-002 / RF-CAT-006). **Un fijo anulado para el mes (`skipped: true`, RF-MF-005) aparece en la lista pero NO suma a los totales.**
- **Movimientos calculados — `origin` espeja el tipo del origen.** Un movimiento calculado viaja en la lista de **su tipo de origen** (`origin: "fijo" | "unico" | "cuota"` según `calculated.sourceType`): calculado de fijo → lista `fijos`; de único → lista `unicos`; de cuota → lista `cuotas`. Su `amountCents` ya viene **derivado al vuelo y con signo** para el mes (`signo × round(fórmula(montoOrigenEseMes))`, RN-017/018) y puede ser **≤ 0**; su `type` viene **derivado de ese signo** (negativo → `EXPENSE`, positivo → `INCOME`, cero → `EXPENSE`; RN-018), no es un dato elegible. Para un calculado de **cuota**, `calculated.sourceAmountCents` es el **monto por cuota** del grupo, y el ítem **no** trae la etiqueta `installment` "X/N" (RF-MCALC-008). La **relación padre/hijo** (RF-MCALC-007) se expone con dos campos del `MovementItem`: **`calculated`** (objeto `CalculatedInfo` si el ítem **es** un calculado / hijo, `null` si no) y **`hasCalculated`** (`true` si el ítem es un **origen** —fijo, único o cuota— con ≥1 calculado derivado en ese mes / padre). Un calculado nunca es padre (`hasCalculated: false` siempre — sin encadenamiento). El **orden** de cada lista usa la **magnitud** = `\|amountCents\|` DESC (ver "Orden de las listas"): un calculado negativo ordena por su tamaño, no al final.
- **`calculatedChildren` — derivados del ítem origen (RF-VM-007).** Cuando el ítem es **origen** de calculados, `calculatedChildren` lista los calculados **derivados de ese ítem en el mes consultado**; los alimenta la card de detalle para mostrar sus derivados (simétrico a `calculated`, que muestra el origen desde un calculado). Es **`[]`** si el ítem no tiene derivados **o si el ítem es un calculado** (nunca es padre — sin encadenamiento, RF-MCALC-001). `hasCalculated == calculatedChildren.length > 0`. El alcance es **estrictamente el mes consultado** (un derivado que no aparece ese mes por su frecuencia/skip no entra). **Gotcha — `CalculatedChild.convertedAmountCents` es MAGNITUD (≥ 0), sin signo:** a diferencia de `CalculatedInfo.sourceAmountCents` (monto del origen) y del `amountCents` con signo del propio calculado, el `CalculatedChild` **no expone un monto con signo** — solo la cifra convertida a la default vigente. El **signo** (y por ende la dirección gasto/ingreso) se deriva de su **`type`** (`EXPENSE` ⇒ negativo, `INCOME` ⇒ positivo). El display que necesite el signo debe leerlo de `type`, no del monto.
- **La categoría embebida puede estar soft-deleted.** Un movimiento histórico muestra su categoría aunque haya sido eliminada (`deletedAt`), y **sigue contando en los totales** (RF-CAT-004 / RF-VM-002; el join de movimientos no filtra por `deletedAt`).
- **Método de pago embebido (opcional).** Cada `MovementItem` trae `paymentMethod: { id, name, icon, type, closingDay, paymentDay } | null` — `null` si el movimiento no tiene método (RF-PM-006). **`closingDay`/`paymentDay`** son el día del mes (1-31) de cierre y de cobro del resumen; vienen **poblados solo para `type === "CREDIT"`** y `null` en `DEBIT`/`CASH` (misma semántica que en `PaymentMethod`, §Métodos de pago). Los consume la card de detalle (RF-VM-007) para la sublínea del crédito. Como en la categoría, el método puede estar soft-deleted y aun así se muestra en el ítem histórico. Es **metadato**: no entra a `totals` ni a los reportes. Un **calculado hereda** el método **del origen** (no persiste uno propio; se deriva al vuelo junto con el resto de sus datos derivados, igual que la moneda/cotización — RF-PM-006 / RF-CUR-004). **Los endpoints de reportes (`GET /movements/reports`, anuales) NO exponen el método**: son series agregadas sin dimensión por método de pago en v1.
- **`autoDebit` — flag del movimiento, fuera del método embebido.** Cada `MovementItem` expone `autoDebit: boolean | null` **a nivel del ítem** (no dentro de `paymentMethod`): `true`/`false` solo cuando el método efectivo es `DEBIT`, `null` en cualquier otro caso (sin método o método `CREDIT`/`CASH`; RN-021). Un **calculado hereda** el `autoDebit` del origen, derivado al vuelo (no persiste uno propio). Metadato: no entra a `totals` ni a los reportes.
- **Listas de fijos y cuotas pobladas.** Las listas `fijos` y `cuotas` traen datos; los totales del mes suman únicos + fijos + cuotas. El **grupo de cuotas no genera filas por instancia**: se calcula on-the-fly (RN-006) — una cuota cae en `startMonth ≤ mes < startMonth + totalInstallments`. Detalle del cálculo en `docs/backend.md`, sección Movimientos en cuotas.

---

## Contrato de movimientos calculados

Endpoints propios del calculado, en el `RecurringModule` (el calculado **es** un fijo). El **origen** puede ser fijo, único o cuota: cada tipo de origen tiene su par `POST`/`PATCH` propio, según desde dónde se dispara la acción. **JWT requerido**; scope por `userId` del token. Mecánica de implementación (cadena, derivación, cascada) en `docs/backend.md`, §Movimientos calculados; reglas funcionales en `requirements.md`, RF-MCALC-001..010 y RN-017/018/019.

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `POST /recurring/:id/calculated` | `{ categoryId, startMonth, formulaOperator, formulaOperand, formulaSign, description? }` | `201` · `data: Recurring` | `400` · `404` |
| `PATCH /recurring/:id/calculated` | `{ currentMonth, categoryId?, description?, formulaOperator?, formulaOperand?, formulaSign? }` | `200` · `data: Recurring` | `400` · `404` |
| `POST /transactions/:id/calculated` | `{ categoryId, formulaOperator, formulaOperand, formulaSign, description? }` (sin `startMonth`) | `201` · `data: Recurring` | `400` · `404` |
| `PATCH /transactions/:id/calculated` | `{ currentMonth, categoryId?, description?, formulaOperator?, formulaOperand?, formulaSign? }` | `200` · `data: Recurring` | `400` · `404` |
| `POST /installments/:id/calculated` | `{ categoryId, formulaOperator, formulaOperand, formulaSign, description? }` (sin `startMonth`) | `201` · `data: Recurring` | `400` · `404` |
| `PATCH /installments/:id/calculated` | `{ currentMonth, categoryId?, description?, formulaOperator?, formulaOperand?, formulaSign? }` | `200` · `data: Recurring` | `400` · `404` |

- **`:id` del POST** identifica el **origen** según la ruta: fijo (`/recurring/:id`, id de la fila activa del fijo), único (`/transactions/:id`) o grupo de cuotas (`/installments/:id`). El calculado se crea como una cadena `Recurring` nueva vinculada al origen.
- **`startMonth` solo en el POST de fijo.** Para **único** y **cuota** el backend lo **deriva del origen**: único → `startMonth = mes del Transaction`; cuota → `startMonth = grupo.startMonth`. El body de único/cuota **no** lleva `startMonth`.
- **El body NO acepta `type`** (en ninguno): el tipo se **deriva del signo** del monto al vuelo (RF-MCALC-003); si el front lo envía, la whitelist de class-validator lo descarta.
- **`formulaOperator`** ∈ `{ ADD, SUB, MUL, DIV, PCT }`. **`formulaSign`** ∈ `{ 1, -1 }`. **`formulaOperand`** es un **entero escalado** (ver "Escalado del operando" abajo).
- **Sin `currency` / `exchangeRate`.** Los `POST`/`PATCH .../calculated` **no** aceptan `currency` ni `exchangeRate`: el calculado **hereda** ambos del origen al vuelo (RF-CUR-004). Si el front los envía, la whitelist de class-validator los descarta. En cambio, los `create`/`edit` de **únicos, fijos y cuotas** sí los aceptan (`currency?: "ARS"|"USD"|"EUR"|"BRL"`, default `ARS`; `exchangeRate?: number > 0`, default `1`) — ver "Moneda explícita, set curado".
- **`POST` — errores (los tres):** `400` si el origen es **a su vez un calculado** (sin encadenamiento — solo aplica al de fijo), si `formulaOperand = 0` con `DIV`/`PCT` (RN-017), o si la categoría es inválida (inexistente/ajena/eliminada). `404` si el origen no existe o no es del usuario. La categoría se valida con scope `BOTH` (`skipScopeCheck`) porque el tipo del calculado es derivado.
- **`PATCH` — split y errores:** `currentMonth` (`YYYY-MM`) **requerido** en los tres; usa la **misma mecánica de split del pasado** que `PATCH /recurring/:id`. Editables: `categoryId`, `description`, `formulaOperator`, `formulaOperand`, `formulaSign`. **No** editable el vínculo al origen. `400` si el `:id` **no es un calculado** del tipo esperado, o `formulaOperand = 0` con `DIV`/`PCT`. `404` si no existe o no es del usuario.
- **`PATCH /recurring/:id` (fijo normal) rechaza con `400` si el `:id` es un calculado** (y los `PATCH .../calculated` exigen que lo sea): cada tipo se edita por su endpoint.
- **Acotamiento de cadencia.** Calculado de **único:** el backend fija `deletedFrom = nextMonth` para acotar la cadena a **un solo mes** (el del único). Calculado de **cuota:** `deletedFrom = null`; el rango lo determina **on-the-fly** el `totalInstallments` del grupo (`startMonth ≤ mes < startMonth + totalInstallments`).
- **`DELETE /recurring/:id` — tres caminos.** El endpoint es **uniforme** (los query `currentMonth` y `fromCurrentMonth` son requeridos por contrato), pero el comportamiento depende del calculado:
  - **(a) Calculado de único o cuota** → **hard-delete total** del calculado (ignora `currentMonth`/`fromCurrentMonth`): no hay split, espejando que su origen tampoco se borra por mes (RF-MCALC-009).
  - **(b) Calculado de fijo** → `boundary` sobre su cadena (split del pasado), sin tocar el origen ni otros calculados (RF-MCALC-006).
  - **(c) Fijo normal** → `boundary` sobre su cadena y **cascada** del mismo `boundary` a sus calculados de fijo. La cascada origen→calculado de **único/cuota** la resuelve la **DB por FK `onDelete: Cascade`** (no pasa por este endpoint: el origen se borra desde `/transactions` o `/installments`).

### Escalado del operando (entero, sin floats)

El `formulaOperand` se persiste y viaja como **entero escalado**, distinto por operador, para no propagar floats (RN-002/RN-017). El front escala al enviar y desescala al editar; el backend aplica la fórmula con la escala correspondiente. Constantes en `backend/src/recurring/formula.helper.ts`.

| Operador | Significado del operando | Escala | Ejemplo |
|---|---|---|---|
| `ADD` / `SUB` | monto en **centavos** | `× 100` (igual que `amountCents`) | `$500` → `50000` |
| `MUL` / `DIV` | **factor** crudo | `× FACTOR_SCALE` (`1_000_000`) | `1.5` → `1_500_000` |
| `PCT` | **porcentaje** | `× PCT_SCALE` (`100`) | `10%` → `1000`; `1.5%` → `150` |

El **resultado** de la fórmula se redondea a centavos enteros y se multiplica por `formulaSign` (RN-017/018).

### Campos de `Recurring` para calculados (shape de respuesta)

El `Recurring` que devuelven los endpoints (y que el front recibe) incluye, además de los campos del fijo normal, los de cadena y calculado (`backend/prisma/schema.prisma`):

- **`chainId`** — identidad estable de la cadena del fijo lógico; la comparten todas las filas del fijo a través de los splits (ver §Identidad de cadena estable). Presente en **todo** `Recurring`.
- **`sourceChainId`** — `null` en fijos normales y en calculados de único/cuota; el **`chainId` del origen** en calculados de **fijo** (vínculo a la cadena, no a una fila).
- **`sourceMovementId`** — FK nullable a `Transaction`, `onDelete: Cascade`. No-null **solo** en calculados de **único** (vínculo al único de origen).
- **`sourceInstallmentGroupId`** — FK nullable a `InstallmentGroup`, `onDelete: Cascade`. No-null **solo** en calculados de **cuota** (vínculo al grupo de origen).
- **Invariante de origen:** en un **calculado**, exactamente **uno** de `{ sourceChainId, sourceMovementId, sourceInstallmentGroupId }` es no-null (el resto null). Los **tres null** = fijo normal. La exclusión mutua la valida el service. Borrar el `Transaction` / `InstallmentGroup` de origen **cascadea** (FK `onDelete: Cascade`) y borra entero el calculado.
- **`formulaOperator` / `formulaOperand` / `formulaSign`** — `null` en fijos normales; la fórmula (con operando escalado) en calculados.

> En los calculados, el `amountCents` y el `type` que persiste la fila son **placeholders** (`0` y `EXPENSE`) que **nunca** se usan para mostrar: el monto y el tipo reales se derivan al vuelo en `GET /movements` (ver `MovementItem.amountCents` / `type` y `docs/backend.md`, §Movimientos calculados).

---

## Contrato de serie de reportes (respuesta de `GET /movements/reports`)

`GET /movements/reports?year=YYYY&categories=<id1,id2,...>` devuelve, dentro del sobre `{ success, statusCode, data }`, la serie **anual agregada** del usuario para los reportes (RF-REP-001/002): ingreso/gasto por mes y el gasto mensual desglosado por categoría (`categories`). **No** devuelve movimientos individuales. Reutiliza el mismo criterio de bucketeo que el contrato mensual (RN-015), sin introducir reglas de zona nuevas. Detalle de implementación en `docs/backend.md`, sección Movimientos del mes (subsección Serie anual).

**Query params:**

- **`year`** (requerido) — el año a graficar.
- **`categories`** (opcional) — filtro por categoría, **tres estados** (ver tabla "Filtro de categorías" más abajo, compartida con `GET /movements`): **ausente = todas**, **`categories=` (presente y vacío) = ninguna** (serie en cero), **lista `id1,id2` = subconjunto**. Lista de `categoryId`s **separados por comas, sin URL-encode** (ej. `categories=abc,def`). El front lo deriva del `categoryIds` de la card (`null` → omite el param; `[]` → `categories=` vacío; lista → la serializa). El filtro afecta **ambos tipos**: en `income-expense`, qué categorías cuentan en `incomeCents`/`expenseCents` por mes; en `by-category`, qué categorías se desglosan.
- **`currency`** (opcional) — override de la moneda de display de la serie (RF-REP-007), una de las 4 monedas (RF-CUR-001), **case-sensitive**. **Ausente → la serie se convierte a la `defaultCurrency` del usuario** (comportamiento por defecto). **Presente y válido → la serie se convierte a esa moneda** (override del display). **Presente vacío o valor fuera del set → `400`.** Es **capa de display** (misma semántica que cambiar la default: no toca ningún movimiento guardado). El **shape de la respuesta no cambia**: la serie ya viene convertida a la moneda pedida; el cliente conoce la moneda que envió. El front lo deriva del campo `currency` de la card (omite el param cuando la card no tiene moneda propia).
- **`types`** (opcional, CSV) — filtro por **tipo de movimiento** (RF-REP-014), **tres estados** (análogo a `categories`): **ausente = todos los tipos**; **`types=` (presente y vacío) = ninguno** (totales en cero); **lista `fijo,cuota` = subconjunto**. Valores válidos: `fijo` | `cuota` | `unico`, separados por comas **sin URL-encode**; cualquier otro valor → `400`. Acota qué tipos suman a `incomeCents`/`expenseCents` por mes. Combina **(AND)** con `categories` y `direction`. Lo usa solo la card `income-expense`.
- **`direction`** (opcional) — filtro de **dirección** (RF-REP-014): `expense` | `income` | `both`. **Ausente = `both`** (sin filtro). `expense` computa solo gastos; `income`, solo ingresos. Valor fuera del set → `400`. Combina **(AND)** con `categories` y `types`. Lo usa solo la card `income-expense`.
- **`projectFixed`** (opcional) — proyección de **fijos a futuro** (RF-REP-015): `"true"` activa la proyección; **ausente o cualquier otro valor = off** (respuesta idéntica a la de sin el param). Con `projectFixed=true` los meses futuros (posteriores a `today`) extienden las series proyectando solo los fijos (regla de cálculo en `docs/backend.md`). **Capacidad retenida del backend: hoy ningún consumidor la manda** (ninguna pantalla monta control de proyección).
- **`today`** (`YYYY-MM-DD`, opcional) — fecha "hoy" que marca el corte real/proyectado. **Ausente = ahora UTC.** Solo es relevante con `projectFixed=true`; con la proyección off no afecta la respuesta.
- **`availableCategories` y `earliestYear` son inmunes a los tres filtros** (`categories`, `types`, `direction`): se computan sobre todos los movimientos del año/usuario, igual que ante `categories` solo, para que la leyenda-filtro y los límites de navegación no salten al filtrar.
- **Mapeo persistencia→query** (el front deriva los params del blob de la card): `movementTypes` ausente **o** los tres tipos → se **omite** `types`; `[]` → `types=` vacío; subconjunto → CSV. `direction` ausente **o** `both` → se **omite** `direction`; `expense`/`income` → el valor literal. El front **no manda `projectFixed` ni `today`** (ninguna pantalla consume la proyección; `projectFixed` del blob queda inerte). (`categoryIds` → `categories` como ya se describe arriba.)

```
ReportsMovementsResponse = {
  year: number,                       // el año pedido
  months: ReportMonth[],              // SIEMPRE 12 entradas, ene→dic, en orden; filtradas al set pedido
  categories: ReportCategory[],       // desglose de GASTOS: solo categorías con gasto EXPENSE en el año, dentro del set pedido
  availableCategories: ReportsAvailableCategory[],  // universo de categorías con algún movimiento (gasto O ingreso) del año, SIN el filtro; cada ítem con hasExpense/hasIncome
  earliestYear: number | null         // año más antiguo con algún movimiento del usuario; NO afectado por el filtro
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
  projected: boolean                  // true SOLO en meses futuros (> today) con projectFixed=true; sin la proyección (caso actual), false en todos
}

ReportCategory = {
  categoryId: string,
  name: string,
  color: string,                      // "#rrggbb"
  monthlyExpenseCents: number[]       // 12 valores ene→dic CONVERTIDOS a la default vigente; 0 donde no hay gasto
}
```

> **Serie servida ya convertida.** Todos los `*Cents` de la serie de reportes vienen agregados con el **monto convertido** (`convertedAmountCents`) de cada movimiento a la **moneda de display** del request — el query param `currency` si está presente, o la **moneda default vigente** del usuario si no (RF-REP-007). Misma capa de display que `GET /movements` (ver §Contrato de movimientos del mes). El endpoint **no** expone montos originales ni cotizaciones por movimiento (la serie es agregada, no trae ítems): la conversión ya está hecha antes de sumar. Cambiar la `defaultCurrency` (o la moneda de la card) re-expresa toda la serie al vuelo, sin tocar lo guardado.

- **`months` — siempre 12, ene→dic.** Los meses sin datos (incluidos los **futuros** del año en curso) vienen con `incomeCents` / `expenseCents` en **cero**, nunca omitidos. Con filtro de categorías, los totales mensuales suman **solo los movimientos de las categorías pedidas** (un mes sin movimientos en el set queda en cero). El mes de cada movimiento se determina con el mismo bucketeo que el mensual (RN-015): únicos por la zona propia del registro (`AT TIME ZONE`), fijos y cuotas a nivel mes. Para los **fijos**, la proyección respeta la **frecuencia** (un fijo solo se imputa a los meses que dicta su `frequency`, RF-MF-006 / RN-016) y **excluye los meses anulados** (RF-MF-005): un mes con skip no suma a ese mes del año.
- **`projected` — corte real vs. proyectado a futuro (RF-REP-015).** Con `projectFixed=true`, los meses posteriores a `today` vienen con `projected: true` y sus totales suman, además del dato real, la **proyección de los fijos a futuro** (solo fijos; cuotas y únicos no se extienden — regla de cálculo en `docs/backend.md`). Los meses ≤ `today` vienen `projected: false`. **Caso actual: ningún consumidor manda `projectFixed`, así que la respuesta trae `projected: false` en los 12 meses**; el campo es parte del contrato retenido, sin uso hoy.
- **`categories` — desglose de gasto (`EXPENSE`), dentro del filtro.** Es el **único** desglose por categoría del contrato y es **solo de gastos** (`EXPENSE`). Una categoría aparece si tuvo gasto en algún mes del año, **está dentro del set pedido** (si hay filtro) e **incluye categorías soft-deleted** con gasto histórico (RF-CAT-004; el desglose no filtra por `deletedAt`). Orden: por **gasto anual total DESC**, desempate por `categoryId` ASC. Alimenta la card `by-category` (RF-REP-006) en **ambas representaciones** (barra y línea): mismo dato, distinta geometría de render.
- **`availableCategories` — universo estable de la leyenda-filtro, SIN el filtro, con flags por línea.** Universo de categorías con **algún movimiento (gasto `EXPENSE` o ingreso `INCOME`)** en el año, computado **ignorando el filtro `categories`** (es un **superconjunto** de `categories`). Cada ítem lleva **`hasExpense`/`hasIncome`** (no-opcionales), que indican si esa categoría tuvo al menos un movimiento de **esa línea** en el año, sobre el mismo universo estable (sin filtro). Una categoría puede tener ambos `true` (participa en gasto e ingreso). **Siempre presente**; `[]` si no hay ningún movimiento en el año. Incluye categorías **soft-deleted** con actividad histórica (no filtra por `deletedAt`). Orden: por **gasto anual DESC**, desempate por `categoryId` ASC. Es el universo que consumen las leyendas-filtro de las cards que sirve el endpoint (`income-expense` usa los dos flags; `by-category` filtra a `hasExpense === true` — ver `docs/frontend.md`): no se achica al filtrar (mismo criterio de estabilidad que `earliestYear`), de modo que destildar una categoría no la quita de la leyenda. Los otros reportes anuales (`annual-unicos`, `annual-cuotas`, `annual-inflation-income`) devuelven el shape base `AvailableCategory` (`{ categoryId, name, color }`), **sin** estos flags.
- **Invariante de consistencia.** Para cada mes `i`, la suma de `categories[*].monthlyExpenseCents[i]` **es igual a** `months[i].expenseCents`. El front puede confiar en que las bandas de gasto apiladas por categoría suman exactamente el total de gastos del mes (dentro del set filtrado). **Calculados:** la suma respeta la imputación por **magnitud al bucket del tipo derivado** de RN-019 — un movimiento calculado tiene `type` derivado del signo de su `amountCents` (RN-018), así que un calculado de monto negativo es `EXPENSE` y suma su **magnitud** (`\|amountCents\|`) tanto a `months[i].expenseCents` como a la banda `monthlyExpenseCents[i]` de su categoría, conservando la invariante. Como cada movimiento suma magnitud (nunca resta) al bucket que le corresponde, los totales y las bandas **no pueden quedar negativos** por la presencia de calculados.
- **`earliestYear` — NO afectado por el filtro.** Año más antiguo con **cualquier** movimiento del usuario (mínimo entre el año del mes local de cualquier único y el año del `startMonth` de cualquier fijo/cuota), **calculado sobre todos los movimientos, ignorando el filtro `categories`**; `null` si el usuario no tiene ningún movimiento. El front lo usa para deshabilitar la navegación ‹ antes del primer año con datos (RF-REP-002); que sea independiente del filtro evita que los límites de navegación salten al filtrar categorías.

---

## Contrato de reporte anual de Únicos (respuesta de `GET /movements/reports/annual-unicos`)

`GET /movements/reports/annual-unicos?year=YYYY&categories=<...>&currency=XXX&today=YYYY-MM-DD&anchorAmountCents=N&anchorCurrency=XXX` devuelve, dentro del sobre `{ success, statusCode, data }`, la **grilla anual día × mes de gastos Únicos** y el **footer de métricas mensuales** que alimentan la card `unique-grid` (RF-REP-010). Solo agrega **movimientos Únicos de tipo gasto (`EXPENSE`)**: fijos, cuotas y calculados no entran. Es un endpoint **distinto** de `GET /movements/reports` (no comparte shape). Reglas de cálculo (divisor del promedio, fórmulas de %, ajuste por inflación) en `docs/backend.md`, §Serie de reportes → Reporte anual de Únicos.

**Query params:**

- **`year`** (`YYYY`, requerido) — el año a graficar.
- **`categories`** (opcional) — filtro por categoría, **tres estados** (tabla "Filtro de categorías" abajo): **ausente = todas**, **`categories=` (presente y vacío) = ninguna** (grilla en cero), **lista `id1,id2` = subconjunto**. Comas **sin URL-encode**. El front lo deriva del `categoryIds` de la card.
- **`currency`** (opcional) — override de la moneda de display de la grilla (RF-REP-007), una de las 4 monedas, **case-sensitive**. **Ausente → la default global del usuario**; **presente y válido → esa moneda**; **vacío o fuera del set → `400`**. Misma capa de display que el resto (no toca lo guardado).
- **`today`** (opcional, `YYYY-MM-DD`) — la **fecha local del usuario**, que el front envía para que el backend calcule el **divisor del promedio diario del mes en curso** (día actual) en la zona del usuario. **Si falta, el backend cae a `new Date()` (UTC).**
- **`anchorAmountCents`** + **`anchorCurrency`** (opcionales, **all-or-nothing**) — override del techo de la escala de color (RF-REP-010). `anchorAmountCents` = entero **> 0**, centavos de `anchorCurrency`; `anchorCurrency` = una de las 4 monedas (`ARS|USD|EUR|BRL`), **independiente del param `currency`** (que es la moneda de *display*). **Uno sin el otro → `400`.** **Ausentes ambos → default 15 USD.** El backend convierte `(anchorAmountCents, anchorCurrency) → USD cents` con el TC de enero del año pedido (ver `docs/backend.md`) y devuelve el resultado en `anchorUsdCents`.

```
AnnualUnicosResponse = {
  year: number,
  currency: "ARS" | "USD" | "EUR" | "BRL",   // moneda de display usada
  grid: number[][],                          // SIEMPRE 31 filas × 12 columnas; grid[day-1][month-1]
  breakdown: BreakdownCell[][][],            // misma indexación que grid: breakdown[day-1][month-1]
  footer: AnnualUnicosFooter[],              // SIEMPRE 12 entradas; índice = mes-1
  availableCategories: AvailableCategory[],  // universo del filtro (igual shape que en §Contrato de serie de reportes)
  anchorUsdCents: number,                    // ancla canónica en centavos de USD efectivamente usada (nunca null; default 1500)
  colorAnchorCents: number                   // tope de la escala de color de las celdas, en centavos de display; ver abajo (nunca null)
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

- **`grid` — siempre 31 × 12.** `grid[day-1][month-1]` = total de gastos Únicos imputados a ese día y mes, en **centavos enteros** de `currency` (ya convertidos a la moneda de display). Vale **0** tanto si no hubo gasto **como** si el día **no existe** en el mes (ej. `grid[30][1]` = 30 de febrero): el contrato **no** distingue ambos casos — el front lo resuelve por calendario (ver `docs/frontend.md`, §Reportes). El bucketeo del día/mes usa la **zona propia de cada registro** (RN-015), igual que el resto de los reportes.
- **`breakdown` — desglose por categoría de cada celda.** Misma forma y misma indexación que `grid` (`breakdown[day-1][month-1]`): por cada celda, el detalle del gasto de **ese día** repartido por categoría. Cada ítem es `{ categoryId, amount }`, con `amount` en **centavos de `currency`** (misma conversión que `grid`/`total`), **ordenado por `amount` DESC**. Celda sin gasto y día inexistente → `[]`. **No trae `name` ni `color`:** el front resuelve la paleta y el nombre por `categoryId` contra `availableCategories`, que ya los expone; duplicarlos por celda repetiría la misma paleta N veces sin agregar información.
- **`footer` — siempre 12, índice = mes-1.** Una entrada por mes:
  - **`total`** — suma de gastos Únicos del mes (centavos de `currency`).
  - **`dailyAvg`** — `total` dividido por el divisor de días (día en curso si es el mes corriente del año en curso; días del mes si ya terminó; ver `docs/backend.md`). **`null` para un mes futuro.**
  - **`pctVsPrev`** — % de diferencia del promedio diario respecto del mes anterior (el de **enero** es **diciembre del año previo**). **`null`** si el promedio del mes anterior es cero.
  - **`inflationPct`** — `InflationRate.monthlyVariation` (puntos %) del mes. **`null`** si no hay dato de IPC.
  - **`pctVsPrevAdj`** — `pctVsPrev` ajustado: el promedio del mes anterior se infla por la variación IPC **del mes en curso** antes de comparar. **`null`** si falta el IPC, si el promedio anterior es cero, o si el mes en curso no tiene dato.
- **`availableCategories`** — universo del filtro: categorías con **gasto Único** del año, computado **sin** aplicar el filtro `categories` (superconjunto estable). Mismo criterio de estabilidad que en la serie de reportes; alimenta la leyenda-filtro de la card.
- **`anchorUsdCents`** — entero, **centavos de USD**. El ancla canónica en USD efectivamente usada para el cálculo: el override `(anchorAmountCents, anchorCurrency)` ya convertido a USD, o **`1500` (15 USD)** si no se pidió override. **Nunca `null`.** El front lo persiste tal cual en `anchorUsdCents` de la card (ver `docs/frontend.md`): es el valor que el back devuelve, no lo calcula el front.
- **`colorAnchorCents`** — entero, **centavos de `currency`**. Es `anchorUsdCents` reconvertido a la moneda de display con el TC de **enero del año del reporte** (mecanismo `pivotRatesForYear`, con clamp al mes disponible más cercano; si `currency` es USD, coincide con `anchorUsdCents`). **Nunca `null`.** Es el **tope de la escala de color** de las celdas de la grilla: el front pinta cada celda con `t = clamp(total / colorAnchorCents, 0, 1)`. Es referencia de **paleta visual**, **no** una cotización de negocio (no entra en totales ni conversiones).
- **NO incluye `earliestYear`** (a diferencia de `GET /movements/reports`): este contrato no expone el primer año con datos. Consecuencia funcional: la card `unique-grid` permite navegación de año hacia atrás **sin tope** (RF-REP-010; ver `docs/frontend.md`, §Reportes).

---

## Contrato de reporte anual de Cuotas (respuesta de `GET /movements/reports/annual-cuotas`)

`GET /movements/reports/annual-cuotas?year=YYYY&categories=<...>&currency=XXX` devuelve, dentro del sobre `{ success, statusCode, data }`, el **gantt anual de gastos en Cuotas**: una barra horizontal por compra en cuotas que intersecta el año, ubicada en su rango de meses y empaquetada en renglones. Alimenta la card `installment-gantt` (RF-REP-011). Solo agrega **cuotas de tipo gasto (`EXPENSE`)**; es un endpoint **distinto** de `GET /movements/reports` y de `GET /movements/reports/annual-unicos` (no comparte shape). Reglas de cálculo (qué entra, packing, conversión del monto por cuota) en `docs/backend.md`, §Serie de reportes → Reporte anual de Cuotas.

**Query params:**

- **`year`** (`YYYY`, requerido) — el año a graficar.
- **`categories`** (opcional) — filtro por categoría, **tres estados** (§Filtro de categorías — query param `categories`): **ausente = todas**, **`categories=` = ninguna** (gantt vacío), **lista `id1,id2` = subconjunto**. Comas **sin URL-encode**. El front lo deriva del `categoryIds` de la card. **El filtro se aplica ANTES del packing** (los renglones se calculan sobre el subconjunto ya filtrado).
- **`currency`** (opcional) — override de la moneda de display (RF-REP-007), una de las 4 monedas, **case-sensitive**. **Ausente → la default global del usuario**; **presente y válido → esa moneda**; **vacío o fuera del set → `400`**.
- **NO usa `today`** (a diferencia de `annual-unicos`): el gantt no tiene métricas dependientes de la fecha local del usuario.

```
CuotasGanttResponse = {
  year: number,
  currency: "ARS" | "USD" | "EUR" | "BRL",   // moneda de display usada
  bars: CuotasGanttBar[],                     // ordenadas por rowIndex ASC, dentro por startMonthIndex ASC
  rowCount: number,                           // total de renglones; 0 si no hay barras
  availableCategories: AvailableCategory[]    // universo del filtro (igual shape que §Contrato de serie de reportes)
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
- **`amountCents` — monto por cuota, no total del plan.** En centavos de `currency`, ya convertido. La conversión usa el TC del **primer mes visible de la barra** (ver `docs/backend.md`).
- **`rowIndex` y orden.** El backend resuelve el **packing** (asignación de renglones) y emite `bars` ordenado por `rowIndex` ASC y, dentro de cada renglón, por `startMonthIndex` ASC. `rowIndex = 0` es el renglón **pegado al eje**; crece hacia arriba. La **inversión visual** (renglón 0 abajo) la hace el front (ver `docs/frontend.md`, §Reportes).
- **`rowCount`** — total de renglones ocupados; **0** si no hay barras (gantt vacío).
- **`availableCategories`** — universo del filtro: categorías con **cuota gasto** del año, computado **sin** aplicar el filtro `categories` (superconjunto estable). Mismo criterio que en la serie de reportes; alimenta la leyenda-filtro de la card.
- **NO incluye `earliestYear`** (igual que `annual-unicos`): la card `installment-gantt` permite navegación de año hacia atrás **sin tope** (RF-REP-011; ver `docs/frontend.md`, §Reportes).

---

## Contrato de reporte anual de Inflación vs Ingresos (respuesta de `GET /movements/reports/annual-inflation-income`)

`GET /movements/reports/annual-inflation-income?year=YYYY&categories=<...>&currency=XXX&today=YYYY-MM-DD` devuelve, dentro del sobre `{ success, statusCode, data }`, las **series anuales de Inflación vs Ingresos** (12 meses) que alimentan la card `inflation-income` (RF-REP-012): la inflación IPC del mes, la variación mensual del total de **ingreso** (`INCOME`) y esa misma variación **ajustada por inflación**, más las **dos rectas de tendencia** (OLS) de las series de ingreso. Solo agrega movimientos de tipo **ingreso (`INCOME`)**. Es un endpoint **distinto** de `GET /movements/reports` y de los otros dos reportes anuales (no comparte shape). Reglas de cálculo (fórmulas de variación, ajuste por inflación, enero vs diciembre previo, tendencia OLS) en `docs/backend.md`, §Serie de reportes → Reporte anual de Inflación vs Ingresos.

**Query params:**

- **`year`** (`YYYY`, requerido) — el año a graficar.
- **`categories`** (opcional) — filtro por categoría, **tres estados** (§Filtro de categorías — query param `categories`): **ausente = todas**, **`categories=` = ninguna**, **lista `id1,id2` = subconjunto**. Comas **sin URL-encode**. El front lo deriva del `categoryIds` de la card. Restringe **qué ingresos cuentan** en las series; **`earliestYear` y `availableCategories` lo ignoran** (superconjunto estable).
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
  availableCategories: AvailableCategory[]    // universo de categorías con INGRESO del año, SIN el filtro
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
- **`earliestYear`** — año más antiguo con **cualquier** movimiento del usuario, **ignorando el filtro `categories`** (mismo criterio que en §Contrato de serie de reportes); `null` si el usuario no tiene movimientos. **A diferencia de `annual-unicos`/`annual-cuotas`, este contrato SÍ lo expone:** la card `inflation-income` topea la navegación de año hacia atrás en el primer año con datos (RF-REP-012).
- **`availableCategories`** — universo de categorías con **ingreso (`INCOME`)** del año, computado **sin** aplicar el filtro `categories` (superconjunto estable). Es el universo **de ingreso** (no de gasto, a diferencia de los otros reportes); alimenta la leyenda-filtro de categorías de la card.

---

## Filtro de categorías — query param `categories`

> Destino canónico del contrato del param `categories`. Lo consumen **`GET /movements/reports?year=YYYY`** (filtro de reportes, RF-REP-002), **`GET /movements/reports/annual-unicos?year=YYYY`** (filtro de la grilla anual de Únicos, RF-REP-010), **`GET /movements/reports/annual-cuotas?year=YYYY`** (filtro del gantt anual de Cuotas, RF-REP-011) y **`GET /movements/reports/annual-inflation-income?year=YYYY`** (filtro del reporte de Inflación vs Ingresos, RF-REP-012), con la misma semántica de tres estados. `GET /movements?month=YYYY-MM` lo **acepta** también, pero **`/mes` no lo envía**: el filtro de la Vista del mes vive en el frontend (filtros por listado, RF-VM-006; ver §Preferencia `monthListFilters`).

El param distingue **tres estados** —y, en particular, distingue **"ausente" de "presente y vacío"**:

| Estado | URL | Resultado |
|---|---|---|
| **Todas** (default) | `categories` **ausente** | sin filtro |
| **Ninguna** | `categories=` (**presente, vacío**) | resultado vacío: listas vacías + totales/serie en **cero** |
| **Subconjunto** | `categories=id1,id2` (comas **sin URL-encode**) | solo esas categorías |

- El filtro afecta **gastos e ingresos** (ambos tienen categoría).
- Con **"todas"** (ausente) se siguen incluyendo movimientos cuya categoría está **soft-deleted** (RF-CAT-004). Con **subconjunto**, solo entran los `id`s del set.
- En reportes, **`earliestYear` ignora el filtro siempre** (ver §Contrato de serie de reportes).
- Front: los tres estados derivan de la preferencia/`categoryIds` correspondiente — **`null`/ausente → omitir el param**, **`[]` → `categories=`**, **lista → `categories=id1,id2`**. La coma va **literal** (no `URLSearchParams`).

### Preferencia `monthListFilters` — filtros por listado de la Vista del mes (RF-VM-006)

> **Destino canónico** del contrato de los filtros de `/mes`. Clave del blob `UserPreferences` (ver §Contrato de preferencias → Claves del blob). El filtro es **uno por sección**, con dos controles propios por sección (tipo + categoría). Persiste **por pantalla** (no por mes). El filtrado de `/mes` ocurre **100% en el frontend** (ver más abajo).

```
monthListFilters: {
  unicos: { type: "ALL" | "EXPENSE" | "INCOME", categories: string[] | null },
  fijos:  { type: "ALL" | "EXPENSE" | "INCOME", categories: string[] | null },
  cuotas: { type: "ALL" | "EXPENSE" | "INCOME", categories: string[] | null }
}
```

- **`type`** — filtro de tipo de la sección: `"ALL"` (Ambos, default) / `"EXPENSE"` (Gasto) / `"INCOME"` (Ingreso).
- **`categories`** — filtro de categoría de la sección, con la **misma semántica de 3 estados** que el resto del proyecto: **`null` = todas** (default, sin filtro), **`[]` = ninguna** (sección vacía), **lista = subconjunto** de `categoryId`s.
- **Default fresco por sección:** `{ type: "ALL", categories: null }`.
- **Back-compat / normalización** (igual que `monthSections`): si `monthListFilters` **no existe** → default por sección; si falta una sección o trae claves/valores raros → se completa/normaliza esa sección al default. Un blob viejo o parcial nunca rompe la pantalla.
- Es **independiente** del filtro de reportes (clave `reports`) y del filtro efímero del dashboard.
- **El back NO valida ni conoce esta clave** (igual que `monthSections` / `reports`): `PUT /preferences` guarda el blob tal cual. La normalización y los defaults son del frontend consumidor.

### Preferencia `monthCategoryFilter` — filtro de la Vista del mes (RF-VM-006) — **DEPRECADA**

> Deprecada, reemplazada por `monthListFilters` (arriba). Se conserva en el tipo para no romper blobs viejos, pero **`/mes` no la lee ni la escribe** y su valor **no se migra** a `monthListFilters` (arranque fresco). Documentada acá solo como registro del contrato.

```
monthCategoryFilter: string[] | null
```

- **`null` / ausente = todas** (default, sin filtro). **`[]` = ninguna** (lista/totales en cero). **lista = subconjunto** de `categoryId`s.
- Mapea 1:1 a los tres estados del param `categories` de `GET /movements` (tabla de arriba). El filtrado de `/mes` vive en el frontend y esta clave quedó sin uso.
