# Data Model

> Documento conceptual — describe qué entidades existen y las decisiones de negocio sobre cómo se almacenan los datos.
> El schema de Prisma ya está **implementado** en `backend/prisma/schema.prisma` (fuente de verdad para tipos, campos y constraints); las decisiones de modelado a nivel DB están en `docs/backend.md`, sección Capa de datos. Los tipos TypeScript y los contratos de API se documentan cuando se implementen.

---

## Entidades

| Entidad | Descripción |
|---------|-------------|
| **Usuario** | Puede autenticarse por **Google** o por **email + contraseña** (dos métodos que coexisten en v1). El email identifica al usuario. Las cuentas con email + contraseña almacenan un hash de la contraseña (`passwordHash`); las cuentas creadas solo con Google pueden no tener contraseña. Se crea al hacer login con Google por primera vez o al registrarse con email + contraseña. Todos los demás recursos le pertenecen. Tiene un campo `timezone` (zona horaria default / "de casa"). |
| **Categoría** | Clasifica los movimientos. Personalizable por usuario. Tiene un color que el usuario **elige y edita** desde una matriz de colores predefinidos. Se elimina con soft delete. |
| **Movimiento único** | Gasto o ingreso que ocurrió una sola vez en un instante específico (fecha y hora). Se guarda como timestamp UTC (`occurredAt`) más la zona horaria original del registro (`timezone`, nombre IANA). No es solo una fecha de calendario. |
| **Movimiento fijo** | Plantilla recurrente activa desde un mes de inicio hasta que el usuario la elimina. Tiene una **frecuencia** (`frequency`) de un set cerrado —mensual (default), bimestral, trimestral, semestral, anual— que define en qué meses aparece, anclada al mes de inicio (RF-MF-006). |
| **Anulación de fijo (RecurringSkip)** | Marca que **anula una aparición** de un movimiento fijo en un **mes puntual** (`(recurringId, month)`), sin eliminar el fijo. Reversible (toggle). El mes anulado se sigue mostrando pero no suma a los totales ni a la proyección anual (RF-MF-005). Distinta de `deletedFrom`. |
| **Movimiento calculado** | Caso de **movimiento fijo** cuyo monto **no se ingresa**: se deriva del monto de **otro fijo de origen** mediante una **fórmula** (operador + operando), mes a mes y al vuelo (on-the-fly, no se persiste). Es un fijo a todos los efectos (cadena de filas `Recurring`, frecuencia, split, skip), con dos datos extra: el **vínculo a la identidad de cadena del fijo de origen** y la **fórmula** (operador + operando + signo). Su categoría y descripción son propias; su **tipo se deriva del signo del monto** (no es elegible — RN-018), no se toma del origen. Lo único que toma del origen es el monto. Su `amountCents` puede ser **negativo o cero** (excepción a "monto > 0"). Ver `requirements.md`, submódulo 3.4.b (RF-MCALC-001..007) y RN-017/018/019. |
| **Grupo de cuotas** | Compra o cobro dividido en N pagos mensuales iguales desde un mes de inicio. |
| **Preferencias de usuario** | Conjunto de preferencias del usuario (estado de UI que sobrevive a la navegación y al cierre de sesión). Una fila por usuario (1:1 con Usuario), con el contenido guardado como **blob JSON** en lugar de una columna por preferencia. La consumen las secciones colapsadas / orden de `/mes`, la config de reportes y el filtro por categoría. |
| **Cotización de referencia (`ReferenceRate`)** | Tabla **global** (sin `userId`), **interna y no editable por UI**, de cotizaciones de referencia por `(moneda, mes)`. Sirve de **default por copia (no FK)** para pre-cargar la cotización de un movimiento según su mes; el movimiento conserva su propia cotización editable. Sembrada por seed idempotente. Ver §Tabla de cotizaciones de referencia. |

---

## Decisiones de negocio sobre los datos

- **Montos en centavos.** Todos los montos se guardan como enteros en centavos (ej: $1.500 → `150000`). Sin decimales flotantes. **Excepción:** la **cotización** (`exchangeRate` / `User.lastExchangeRate` / `ReferenceRate.rate`) **no** va en centavos: es un `Decimal` de Prisma con decimales; ver "Moneda explícita, set curado" más abajo.
- **Soft delete en categorías.** Eliminar una categoría la marca como eliminada (`deletedAt`) pero no borra el registro. Los movimientos históricos conservan la referencia y siguen sumando en los totales del mes (el soft delete no excluye movimientos de los cálculos). Una categoría eliminada puede **reactivarse**: al crear una categoría cuyo nombre normalizado colisiona con una eliminada, el sistema propone reactivar la original en lugar de duplicarla (mismo `id`, scope y color); ver `requirements.md`, RF-CAT-002 / RF-CAT-004.
- **Unicidad de nombre de categoría: app-level, no DB.** La unicidad de nombre entre categorías **activas** de un mismo usuario se valida en lógica de aplicación, no con un constraint `@@unique` de Prisma/DB. Motivo: la comparación es **normalizada** (trim + insensible a mayúsculas y acentos) y el flujo "crear-o-reactivar" frente a una categoría soft-deleted homónima no caben en un constraint de base de datos.
- **Color de categoría elegible por el usuario.** Cada categoría tiene un color tomado de una **matriz de colores predefinidos** (70 colores; ver "Matriz de colores" más abajo). El usuario lo elige y edita, con default "menos usado" al crear; la regla funcional completa vive en RN-013 (`requirements.md`). El color es solo presentación y no afecta el cálculo de montos ni el scope.
- **Movimientos fijos: el pasado es inmutable.** Editar o eliminar un fijo no modifica los meses ya pasados. El fijo tiene un mes de inicio (`startMonth`) y opcionalmente un mes desde el cual deja de aparecer (`deletedFrom`, **exclusivo**: "mes desde el cual ya no aparece").
- **El movimiento fijo se modela como una _cadena_ de filas `Recurring`, no una sola.** Un "fijo lógico" puede estar compuesto por varias filas en el tiempo. Cada edición que afecta meses ya corridos **cierra la fila vigente** (le setea `deletedFrom = mes actual`) y **abre una fila nueva** (`startMonth = mes actual`) con los valores nuevos; así los meses pasados conservan los valores viejos y el actual/futuro toman los nuevos, sin generar filas por instancia mensual. Si el fijo todavía no corrió ningún mes, la edición es en su lugar (no se parte la cadena). Esto materializa "el pasado es inmutable". Detalle de la mecánica (split al editar, boundary de eliminación) en `docs/backend.md`, sección Movimientos fijos.
- **Identidad de cadena estable del fijo.** Un "fijo lógico" es una **cadena de filas `Recurring`** que comparten un **id de cadena estable** —conceptualmente un `chainId` compartido por **todas** las filas de un mismo fijo lógico— que **sobrevive a los splits**: la fila R2 que abre el split **hereda** el `chainId` de R1. Es independiente del `id` de fila (el `id` de fila cambia en cada split; el `chainId` no). **Por qué:** un movimiento calculado se vincula a **esa identidad de cadena del origen**, no a un `Recurring.id` puntual, para que el vínculo **no se rompa** cuando el origen se edita y se parte (RF-MCALC-004). El nombre y la forma concreta del campo los fija el backend; este documento fija el concepto y la invariante "el split preserva el `chainId`".
- **Movimiento calculado: fijo + vínculo a cadena origen + fórmula.** El movimiento calculado **es un movimiento fijo** (misma entidad/cadena `Recurring`, misma frecuencia, mismo split, mismos skips) más dos datos conceptuales: (1) un **vínculo a la identidad de cadena del fijo de origen** (`chainId` del origen — ver decisión anterior), y (2) una **fórmula**. El **monto NO se persiste**: es un campo **derivado al vuelo en lectura** (on-the-fly, RN-006, igual que fijos y cuotas), recalculado del monto del origen en cada consulta, por lo que **espeja la estructura de cadena del origen mes a mes** (si el origen vale distinto en distintos meses por su cadena, el calculado replica esa variación) y sigue cualquier cambio del origen sin re-guardar nada. **No** es un valor congelado al crear (RF-MCALC-004). El monto en un mes es `signo × round(fórmula(montoOrigenEseMes))`. El **tipo (`EXPENSE`/`INCOME`) no se persiste como dato elegible: se deriva del signo de ese monto** (negativo → `EXPENSE`, positivo → `INCOME`, cero → `EXPENSE` por convención de borde; RN-018), también al vuelo. El vínculo es a la **cadena**, no a una fila: sobrevive a los splits del origen. **Sin encadenamiento:** un calculado no puede ser origen de otro (solo un fijo "normal" puede ser cadena origen); un fijo puede tener varios calculados derivados. **Ciclo de vida atado al origen** (eliminación, skip mensual, cambio de frecuencia se propagan; RF-MCALC-005). El detalle de cómo el backend modela el vínculo (FK a `chainId`, propagación, derivación on-the-fly) vive en `docs/backend.md`.
- **Fórmula del calculado: operador + operando + signo (RF-MCALC-002/003).** La fórmula se persiste conceptualmente como **tres datos**: un **operador** de un set cerrado `{ ADD, SUB, MUL, DIV, PCT }` (corresponde a `+ − × ÷ %`), un **operando** numérico común, y un **signo** (`+1` / `−1`). El operando es un número común ingresado por el usuario (ej. `5000`, `1.5`, `10`); su unidad de persistencia (centavos para operandos monetarios de `±`, factor crudo para `× ÷ %`) la fija el backend al implementar, de forma coherente con que el **resultado** se redondea a centavos enteros (`round`, RN-002/RN-017). **Validación de borde:** operando `0` **rechazado** en `DIV` y `PCT` (división por cero); aceptado en el resto. El **signo** del calculado fuerza el resultado a positivo o negativo y es la razón por la que su `amountCents` puede ser **negativo o cero** (RN-018), excepción a "monto > 0" válida solo para calculados.
- **Frecuencia del movimiento fijo (RF-MF-006).** Cada fijo tiene un campo `frequency` (enum `RecurringFrequency`, default `MONTHLY`) de un **set cerrado**: `MONTHLY`, `BIMONTHLY`, `QUARTERLY`, `BIANNUAL`, `ANNUAL` (sin frecuencias libres ni custom). La frecuencia está **anclada al `startMonth`** y define en qué meses aparece el fijo según la regla de cálculo de RN-016. Es **inmutable** (como `type`): no se acepta en PATCH; en el split de edición la fila nueva la hereda del original. El cálculo es on-the-fly (RN-006).
- **Anulación de un fijo en un mes puntual como registro aparte (`RecurringSkip`, RF-MF-005).** Anular la aparición de un fijo en un mes puntual se modela con una fila `RecurringSkip(recurringId, month)` —**no** con un flag en `Recurring`—, con `month` en formato `"YYYY-MM"` y **unicidad `(recurringId, month)`** (un solo skip por fijo y mes). `onDelete: Cascade` desde `Recurring`: al borrar el fijo se borran sus skips. Es **distinto de `deletedFrom`**: `deletedFrom` corta el fijo de ahí en adelante; el skip cancela **una** aparición puntual dejando el fijo vivo. La acción de anular/des-anular es un **toggle** (si existe el skip se borra, si no se crea). Un fijo anulado para un mes **se sigue listando** en `GET /movements` (marcado con `skipped: true`) pero su monto **no suma** a los totales del mes ni a la proyección anual. El backend **no valida** que el mes del skip sea una aparición real del fijo según su frecuencia (solo formato `YYYY-MM` y ownership); esa validación semántica es del frontend, que ya tiene el ítem del mes.
- **Moneda explícita, set curado.** La moneda es **explícita** (enum `Currency`): un **set curado de 4 monedas — `ARS`, `USD`, `EUR`, `BRL`**, enum cerrado, **sin alta de monedas por UI**. Cada movimiento (único / fijo / cuota) guarda su **`currency`** (default `ARS`) y una **cotización `exchangeRate`** (ver granularidad abajo). El **`User`** guarda su **`defaultCurrency`** (default `ARS`, configurable en `/configuracion`, una de las 4) y el **`lastExchangeRate`** (último cambio real ingresado; ver "fallback" abajo). Reglas funcionales en `requirements.md`, módulo 3.10 (RF-CUR-001..006).
  - **`anchorCurrency` — ancla interna de la cotización.** Cada movimiento (único / fijo / cuota) guarda, además de `currency` y `exchangeRate`, una columna **`anchorCurrency`** (`Currency`, NOT NULL, default `ARS`) que fija **respecto de qué moneda está expresada su `exchangeRate`**. Es **interna a la capa de datos**: **no** está en los DTOs de create/edit ni en la respuesta de `GET /movements` (el front no la envía ni la recibe). Se persiste `anchorCurrency` = la `defaultCurrency` del usuario al momento de **crear** el movimiento; al **editar** `currency`/`exchangeRate` se **re-ancla** a la `defaultCurrency` vigente. Migración `20260620000001_add_anchor_currency`. Esta columna es la que permite que la conversión sea correcta cuando el usuario **cambia su `defaultCurrency`** (ver "Conversión = capa de display").
  - **Semántica de `exchangeRate` per-movimiento (Opción A).** `exchangeRate` = **unidades de `anchorCurrency` por 1 unidad de `currency`** (la moneda del movimiento) — **no** de la default *vigente*. No puede interpretarse sin su `anchorCurrency`. Tipo Prisma **`Decimal`** (con decimales, **no** centavos — excepción a "Montos en centavos"). Default `1`; `1` cuando `currency == anchorCurrency`. Como al crear/editar `anchorCurrency` toma la default de ese momento, **en el momento de la carga** la lectura coincide con "default por 1 unidad de `currency`" — pero la default puede cambiar después, y entonces solo `anchorCurrency` deja interpretable la cotización guardada. Los **cruces no triviales** (p. ej. EUR↔BRL, o cuando la default no es ni `anchorCurrency` ni `currency`) se **derivan vía el pivote `USD`** usando la tabla `ReferenceRate` (ver §Tabla de cotizaciones de referencia); **no se guardan pares**.
  - **`amountCents` se resignifica = centavos de la moneda original del movimiento** (no de la default). Un gasto de US$10 con `currency: "USD"` guarda `amountCents: 1000` (10 USD en centavos), no su equivalente en ARS.
  - **Calculados heredan** moneda y cotización del **origen** (no persisten `currency` ni `exchangeRate` propios): se derivan al vuelo junto con el monto, igual que el resto de sus datos derivados.
  - **Back-compat:** todos los registros existentes quedan `currency: "ARS"` + `exchangeRate: 1`. **`lastExchangeRate` solo se actualiza cuando el usuario ingresa una cotización real** (≠ `1`): el default de back-compat **no** lo pisa, para no contaminar el fallback con un `1` espurio.
  - **`lastExchangeRate` como fallback.** La pre-carga del campo de cotización del formulario se sirve desde la **tabla de referencia del mes** vía `GET /settings/reference-rate` (ver §Contrato de configuración → reference-rate). `lastExchangeRate` queda como **fallback** del frontend cuando ese endpoint devuelve `exchangeRate: null` (mes/moneda sin dato de referencia).
  - **Granularidad de la cotización por tipo:** **únicos** → cotización **por movimiento**; **fijos** → cotización **por mes de aparición** (vive en la fila de la cadena `Recurring`; editar la cotización de un mes en adelante usa la **misma mecánica de split del pasado** que cualquier edición de fijo, ver "El movimiento fijo se modela como una cadena…"); **cuotas** → **una** cotización por **grupo**; **calculados** → heredan del origen (no propia).
- **Conversión = capa de display, en vivo.** Los totales de `/mes` y de los reportes se computan en la **moneda default vigente** del usuario, convirtiendo cada movimiento desde su moneda original. **La conversión nunca toca lo guardado:** cambiar la `defaultCurrency` re-expresa los totales al vuelo pero no reescribe ningún movimiento. Los endpoints (`GET /movements`, `GET /movements/reports`) **sirven los totales/series ya convertidos** a la default vigente (ver shapes de `MovementItem` y de la serie de reportes, que suman `convertedAmountCents`).
  - **Re-ruteo por el pivote `USD` con la tabla de referencia del mes.** La conversión re-rutea por el **pivote `USD`** usando las **cotizaciones de referencia del MES del movimiento** (`ReferenceRate`): `amount_display = amountCents × exchangeRate × (rate_display / rate_anchor)`, donde `rate_X` = unidades de la moneda `X` por 1 USD en ese mes (USD = 1 implícito). Casos directos: si `currency == displayCurrency` → sin conversión (`convertedAmountCents == amountCents`); si `anchorCurrency == displayCurrency` → se usa `exchangeRate` directo (no hace falta pivote). Conceptualmente: `exchangeRate` lleva el monto de `currency` a `anchorCurrency`, y el factor `rate_display / rate_anchor` lo re-expresa de `anchorCurrency` a la default vigente. Esto es lo que hace que los totales sean **correctos al cambiar la `defaultCurrency`**. La función vive en el helper de conversión del backend (`convertToDisplayCurrency(amountCents, currency, exchangeRate, anchorCurrency, displayCurrency, pivotRates)`).
  - **Fallback sin cotización de referencia para el mes (gotcha).** Si **no hay filas de `ReferenceRate`** para el mes del movimiento y `anchorCurrency ≠ displayCurrency`, no se puede armar el factor de pivote: se aplica **`exchangeRate` directo**. Es **exacto cuando `anchorCurrency == displayCurrency`** (no hace falta pivote); es un **aproximado** cuando el usuario cambió su default y el mes del movimiento **no tiene cobertura de referencia** (se reusa la cotización anclada al momento de la carga en lugar de re-rutear). Es la única vía por la que la conversión puede quedar aproximada.
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
  type: "income-expense" | "by-category",       // tipo de reporte (RF-REP-001)
  year: number,                                 // año que muestra la card
  categoryIds: string[] | null,                 // null = todas las categorías; lista = subconjunto explícito de categoryIds
  categoryBreakdown?: boolean,                   // modo de vista de la card income-expense (RF-REP-006)
  hiddenSeries?: Array<"income" | "expense">,    // series ocultas en modo Total (income-expense); omitido = ambas visibles
  currency?: "ARS" | "USD" | "EUR" | "BRL"       // moneda de display de la card (RF-REP-007); ausente = default global vigente
}
```

- **`type`** — `"income-expense"` (Forma 1, Ingresos vs. Gastos) o `"by-category"` (Forma 2, Gastos por categoría apilado). Son los dos únicos tipos (RF-REP-001).
- **`year`** — el año que la card grafica; lo cambia la navegación de año embebida del widget.
- **`categoryIds`** — filtro de categorías de la card. **`null` = todas** (default al crear); una **lista** = subconjunto explícito de `categoryId`s seleccionados. Aplica a ambos tipos (en `income-expense` restringe qué categorías cuentan en los totales; en `by-category`, qué bandas se apilan). Lo que el front manda al endpoint como `categories` deriva de este campo (ver contrato `GET /movements/reports`).
- **`categoryBreakdown`** (RF-REP-006) — modo de vista **solo de las cards `income-expense`**: `true` = vista "Por categoría" (gastos descompuestos por categoría apilada, reutilizando el array `categories`); `false`/ausente = vista "Total" (dos series agregadas). **Default `false`; ausencia = `false`**. Irrelevante para `by-category` (que no tiene toggle). En el dashboard el modo es **efímero** (estado local) y no usa este campo.
- **`hiddenSeries`** — series de la card ocultas por la leyenda-filtro: subconjunto de `["income", "expense"]`. **Omitido = ambas visibles.** Solo aplica a `type: "income-expense"` en **modo Total** (`categoryBreakdown` false/ausente); en modo "Por categoría" y en `by-category` la leyenda togglea categorías (`categoryIds`), no series. Puede ocultar **ambas** (canvas vacío). Persistido por card.
- **`currency`** (RF-REP-007) — moneda de display de la card: una de las 4 monedas (RF-CUR-001). **Ausente = la moneda default global vigente** del usuario (back-compat: una card sin el campo cae a la default; el blob **no se migra**). Al crear una card se persiste con la default actual. El front la manda al endpoint como el query param `currency` de `GET /movements/reports` (override de display; ver contrato más abajo); cambiarla re-expresa la serie al vuelo, sin tocar lo guardado. La card del dashboard no usa este campo (siempre default).
- **Orden del array = orden de despliegue** de las cards en pantalla.
- **Ausente / vacío = pantalla vacía.** Clave ausente o `reports: []` → `/reportes` muestra solo el recuadro "[+]" (estado vacío inicial, RF-REP-003).
- **Back-compat / normalización.** Un blob previo **sin** `reports` se interpreta como `[]` (pantalla vacía). La normalización (entradas malformadas, `type` desconocido, `categoryIds` que apunten a categorías inexistentes/eliminadas) es responsabilidad del front; un blob viejo o parcial nunca rompe la pantalla.
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
- **`color` — editable, de la matriz.** `POST /categories` y `PATCH /categories/:id` aceptan `color?: string` **opcional**. Validación: debe **pertenecer a la matriz de 70** (case-insensitive; se **almacena en mayúsculas**); un color fuera de la matriz → **`400`**. En `POST`, si **no** llega `color`, el backend asigna el "menos usado" como **red de seguridad** — pero el frontend **siempre lo envía**. Detalle de la validación en `docs/backend.md`, sección Pool de colores.

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

El set **elegible** por el usuario es una **matriz de 70 colores** (`COLOR_MATRIX`: 7 tonalidades × 10 hues, estilo Office), única en el backend. El color **es editable** por el usuario, tanto al crear como al editar; solo se aceptan colores de la matriz (sin hex libre).

- **Pool de 10 (fila base T4) como base del "menos usado".** Los **10 colores base** son la fila T4 de la matriz. Sobre esos 10 base se calcula el default "menos usado" al crear (regla en RN-013); las categorías por defecto del alta toman los primeros 4 en orden. Es solo un default: el usuario puede elegir cualquiera de los 70.
- El color es solo presentación. Detalle de `COLOR_MATRIX` / `COLOR_POOL` (T4) y la estrategia en `docs/backend.md`, sección Pool de colores.

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
  category: { id, name, color, scope }       // categoría embebida
}
```

- **`amountCents` — entero en centavos** (RN-002): el front recibe centavos y formatea a pesos para mostrar.
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
  convertedAmountCents: number,              // amountCents convertido a la default vigente vía re-ruteo por pivote USD; == amountCents si currency == default
  description: string | null,
  occurredAt: string | null,                 // ISO 8601 en UTC; null en fijos y cuotas (sin día/hora)
  timezone: string | null,                   // IANA del registro; null en fijos y cuotas
  installment: {                             // presente solo en cuotas; null en únicos y fijos
    number: number,                          //   nro de cuota del mes (1-based)
    total: number,                           //   cantidad total de cuotas del grupo
    startMonth: string                       //   "YYYY-MM", mes de inicio del grupo
  } | null,
  frequency: RecurringFrequency | null,      // fijos: su frecuencia; únicos y cuotas: null
  skipped: boolean,                          // fijos: true si está anulado para el mes; únicos y cuotas: false
  category: { id, name, color, scope },      // embebida
  calculated: CalculatedInfo | null,         // presente si el ítem ES un calculado (hijo); null si no
  hasCalculated: boolean                     // true si el ítem es un ORIGEN (fijo/único/cuota) con ≥1 calculado en el mes (padre); false en el resto
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

donde `RecurringFrequency = "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "BIANNUAL" | "ANNUAL"`.

- **Discriminador `origin`.** Cada ítem declara su tipo de movimiento (`unico` / `fijo` / `cuota`), además de venir ya agrupado en su lista. El front lo usa para rotular el origen y elegir el flujo de edición/eliminación.
- **Orden de las listas.** Los tres grupos vienen ordenados por **magnitud del monto descendente** = `\|amountCents\|` DESC (monto más grande primero, por tamaño, sin distinguir `EXPENSE` de `INCOME`). Para únicos, fijos normales y cuotas `amountCents > 0`, así que la magnitud coincide con el valor; para un **movimiento calculado** (en `fijos`) el `amountCents` puede ser **negativo** (RN-018), por lo que se ordena por su **valor absoluto** — un calculado de `−5000` se ubica entre los demás por su tamaño (5000), no al final por ser negativo. Desempate estable por grupo: `unicos` por `occurredAt` DESC, `fijos` por `createdAt` DESC, `cuotas` por `id` ascendente.
- **`occurredAt` / `timezone` son nullable.** Para **únicos** vienen presentes (instante + zona). Para **fijos** y **cuotas** vienen **`null`**: operan a nivel mes, no tienen día/hora/zona. El front no debe pasar estos campos a `formatDate` / `formatTime` sin chequear null. **Calculados:** un calculado **hereda `occurredAt`/`timezone` del origen** — el de **único** los trae **poblados** (los del `Transaction` de origen), consistente con que todos los ítems de la sección Únicos muestran día/hora y con que el calculado ocurre "junto con" su origen; el de **fijo** y el de **cuota** quedan en **`null`** (su origen tampoco tiene día/hora). El shape admite ambos como `string | null`.
- **`installment` solo en cuotas.** Para una cuota trae `{ number, total, startMonth }`: `number` es el número de cuota del mes (1-based), `total` es el `totalInstallments` del grupo y `startMonth` es el mes de inicio del grupo. Para **únicos** y **fijos** es **`null`**. El front lo usa para la etiqueta "Cuota X/N" y para prefilear la edición del grupo.
- **`frequency` / `skipped` — solo significativos en fijos.** Para un **fijo**, `frequency` es su periodicidad (`MONTHLY`…`ANNUAL`, RF-MF-006) y `skipped` indica si esa aparición está **anulada para el mes consultado** (RF-MF-005). Para **únicos** y **cuotas**, `frequency` es **`null`** y `skipped` es **`false`** (no aplican). Un fijo con `skipped: true` **viene igual en la lista** (no se omite) pero **no está incluido en `totals`** — el front lo muestra con su diferenciación visual de anulado. El front usa `frequency` para rotular la cadencia y `skipped` para el estado y el toggle de la acción anular/des-anular.
- **Moneda y conversión por ítem.** Cada `MovementItem` trae su moneda original (`currency`, una de las 4), la cotización aplicada (`exchangeRate` = unidades de su **`anchorCurrency` interna** por 1 unidad de `currency` del ítem / del mes en fijos / del grupo en cuotas — ver "Semántica de `exchangeRate`") y `convertedAmountCents` = `amountCents` **convertido a la moneda default vigente** del usuario, vía re-ruteo por el pivote `USD` con la tabla de referencia del mes (ver "Conversión = capa de display"). Si la moneda del ítem **coincide** con la default, `convertedAmountCents == amountCents`. El `MovementItem` **no expone `anchorCurrency`** (es interna): el front no la necesita, ya recibe el `convertedAmountCents` listo. Un **calculado** hereda `currency`/`exchangeRate` del origen (RF-CUR-004). El front muestra el monto original (`amountCents` + `currency`) y el convertido; ver `screens.md` §Vista del mes / Formulario y `design.md`.
- **Los totales del mes usan `convertedAmountCents`.** Los `totals` (`expenseCents` / `incomeCents` / `balanceCents`) suman la **magnitud de `convertedAmountCents`** (no de `amountCents`): es la única forma de sumar movimientos de distintas monedas en una sola cifra. La conversión es **capa de display** (no toca lo guardado); cambiar la default re-expresa los totales. La imputación por bucket de tipo sigue RN-019.
- **Los totales suman movimientos, no categorías.** `expenseCents` / `incomeCents` agregan la **magnitud** (`\|convertedAmountCents\|`) de los movimientos del mes **en el bucket de su `type`** (RN-019): un `INCOME` suma a `incomeCents`, un `EXPENSE` a `expenseCents`. Para movimientos normales `amountCents > 0` y el `type` es fijo. Para un **movimiento calculado** el `amountCents` puede ser **negativo o cero** (RN-018) y su `type` se **deriva del signo** (negativo → `EXPENSE`, positivo → `INCOME`); como signo y tipo siempre coinciden, suma su magnitud al bucket correcto —un calculado de `−2000` es `EXPENSE` y suma 2000 a `expenseCents`; uno de `+2000` es `INCOME` y suma 2000 a `incomeCents`; un monto 0 no aporta a ningún bucket—. No hay restas ni reasignación de bucket. `balanceCents = incomeCents - expenseCents`, sin piso (negativo si los gastos superan los ingresos). No se confunden con el contador `movementCount` de la pantalla de categorías (ver más arriba y `requirements.md`, RF-VM-002 / RF-CAT-006). **Un fijo anulado para el mes (`skipped: true`, RF-MF-005) aparece en la lista pero NO suma a los totales.**
- **Movimientos calculados — `origin` espeja el tipo del origen.** Un movimiento calculado viaja en la lista de **su tipo de origen** (`origin: "fijo" | "unico" | "cuota"` según `calculated.sourceType`): calculado de fijo → lista `fijos`; de único → lista `unicos`; de cuota → lista `cuotas`. Su `amountCents` ya viene **derivado al vuelo y con signo** para el mes (`signo × round(fórmula(montoOrigenEseMes))`, RN-017/018) y puede ser **≤ 0**; su `type` viene **derivado de ese signo** (negativo → `EXPENSE`, positivo → `INCOME`, cero → `EXPENSE`; RN-018), no es un dato elegible. Para un calculado de **cuota**, `calculated.sourceAmountCents` es el **monto por cuota** del grupo, y el ítem **no** trae la etiqueta `installment` "X/N" (RF-MCALC-008). La **relación padre/hijo** (RF-MCALC-007) se expone con dos campos del `MovementItem`: **`calculated`** (objeto `CalculatedInfo` si el ítem **es** un calculado / hijo, `null` si no) y **`hasCalculated`** (`true` si el ítem es un **origen** —fijo, único o cuota— con ≥1 calculado derivado en ese mes / padre). Un calculado nunca es padre (`hasCalculated: false` siempre — sin encadenamiento). El **orden** de cada lista usa la **magnitud** = `\|amountCents\|` DESC (ver "Orden de las listas"): un calculado negativo ordena por su tamaño, no al final.
- **La categoría embebida puede estar soft-deleted.** Un movimiento histórico muestra su categoría aunque haya sido eliminada (`deletedAt`), y **sigue contando en los totales** (RF-CAT-004 / RF-VM-002; el join de movimientos no filtra por `deletedAt`).
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
- **`categories`** (opcional) — filtro por categoría, **tres estados** (ver tabla "Filtro de categorías" más abajo, compartida con `GET /movements`): **ausente = todas**, **`categories=` (presente y vacío) = ninguna** (serie en cero), **lista `id1,id2` = subconjunto**. Lista de `categoryId`s **separados por comas, sin URL-encode** (ej. `categories=abc,def`). El front lo deriva del `categoryIds` de la card (`null` → omite el param; `[]` → `categories=` vacío; lista → la serializa). El filtro afecta **ambas formas**: en la Forma 1, qué categorías cuentan en `incomeCents`/`expenseCents` por mes; en la Forma 2, qué categorías se desglosan.
- **`currency`** (opcional) — override de la moneda de display de la serie (RF-REP-007), una de las 4 monedas (RF-CUR-001), **case-sensitive**. **Ausente → la serie se convierte a la `defaultCurrency` del usuario** (comportamiento por defecto). **Presente y válido → la serie se convierte a esa moneda** (override del display). **Presente vacío o valor fuera del set → `400`.** Es **capa de display** (misma semántica que cambiar la default: no toca ningún movimiento guardado). El **shape de la respuesta no cambia**: la serie ya viene convertida a la moneda pedida; el cliente conoce la moneda que envió. El front lo deriva del campo `currency` de la card (omite el param cuando la card no tiene moneda propia).

```
ReportsMovementsResponse = {
  year: number,                       // el año pedido
  months: ReportMonth[],              // SIEMPRE 12 entradas, ene→dic, en orden; filtradas al set pedido
  categories: ReportCategory[],       // desglose de GASTOS: solo categorías con gasto EXPENSE en el año, dentro del set pedido
  availableCategories: AvailableCategory[],  // universo de categorías con gasto EXPENSE del año, SIN el filtro; superconjunto de `categories`
  earliestYear: number | null         // año más antiguo con algún movimiento del usuario; NO afectado por el filtro
}

AvailableCategory = {
  categoryId: string,
  name: string,
  color: string                       // "#rrggbb"
}

ReportMonth = {
  month: string,                      // "YYYY-MM"
  incomeCents: number,                // ingresos del mes CONVERTIDOS a la default vigente; únicos + fijos + cuotas, filtrado al set pedido
  expenseCents: number                // gastos del mes CONVERTIDOS a la default vigente; ídem
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
- **`categories` — desglose de gasto (`EXPENSE`), dentro del filtro.** Es el **único** desglose por categoría del contrato y es **solo de gastos** (`EXPENSE`). Una categoría aparece si tuvo gasto en algún mes del año, **está dentro del set pedido** (si hay filtro) e **incluye categorías soft-deleted** con gasto histórico (RF-CAT-004; el desglose no filtra por `deletedAt`). Orden: por **gasto anual total DESC**, desempate por `categoryId` ASC. Alimenta tanto la Forma 2 (`by-category`) como el modo "Por categoría" de la card `income-expense` (RF-REP-006), que desglosa **solo gastos**.
- **`availableCategories` — universo estable de la leyenda-filtro, SIN el filtro.** Universo de categorías con gasto (`EXPENSE`) del año, computado **ignorando el filtro `categories`** (es un **superconjunto** de `categories`). **Siempre presente**; `[]` si no hay gasto en el año. Incluye categorías **soft-deleted** con gasto histórico (no filtra por `deletedAt`). Orden: por **gasto anual DESC**, desempate por `categoryId` ASC. Es el universo que consume la **leyenda-filtro** de la card en el frontend: no se achica al filtrar (mismo criterio de estabilidad que `earliestYear`), de modo que destildar una categoría no la quita de la leyenda.
- **Invariante de consistencia.** Para cada mes `i`, la suma de `categories[*].monthlyExpenseCents[i]` **es igual a** `months[i].expenseCents`. El front puede confiar en que las bandas de gasto apiladas por categoría suman exactamente el total de gastos del mes (dentro del set filtrado). **Calculados:** la suma respeta la imputación por **magnitud al bucket del tipo derivado** de RN-019 — un movimiento calculado tiene `type` derivado del signo de su `amountCents` (RN-018), así que un calculado de monto negativo es `EXPENSE` y suma su **magnitud** (`\|amountCents\|`) tanto a `months[i].expenseCents` como a la banda `monthlyExpenseCents[i]` de su categoría, conservando la invariante. Como cada movimiento suma magnitud (nunca resta) al bucket que le corresponde, los totales y las bandas **no pueden quedar negativos** por la presencia de calculados.
- **`earliestYear` — NO afectado por el filtro.** Año más antiguo con **cualquier** movimiento del usuario (mínimo entre el año del mes local de cualquier único y el año del `startMonth` de cualquier fijo/cuota), **calculado sobre todos los movimientos, ignorando el filtro `categories`**; `null` si el usuario no tiene ningún movimiento. El front lo usa para deshabilitar la navegación ‹ antes del primer año con datos (RF-REP-002); que sea independiente del filtro evita que los límites de navegación salten al filtrar categorías.

---

## Filtro de categorías — query param `categories`

> Destino canónico del contrato del param `categories`. Lo consume **`GET /movements/reports?year=YYYY`** (filtro de reportes, RF-REP-002). `GET /movements?month=YYYY-MM` lo **acepta** con la misma semántica, pero **`/mes` no lo envía**: el filtro de la Vista del mes vive en el frontend (filtros por listado, RF-VM-006; ver §Preferencia `monthListFilters`).

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
