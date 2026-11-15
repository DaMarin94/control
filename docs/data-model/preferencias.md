# Contrato de preferencias de usuario (preferences)

> Parte del modelo de datos de Control. Índice: `docs/data-model.md`. Decisión de modelado (blob JSON 1:1 con Usuario): `entidades.md`.

Endpoints de lectura y escritura del blob de preferencias del usuario autenticado. **JWT requerido** en ambos (scope por `userId` del token); `401` global si falta o es inválido. Detalle de implementación en `docs/backend/preferencias.md`.

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `GET /preferences` | — | `200` · `data: <blob>` | `401` |
| `PUT /preferences` | `{ data: { ...objeto plano... } }` | `200` · `data: <blob persistido>` | `400` · `401` |

- **`GET /preferences`** — sin body. El `data` del sobre es el **blob** de preferencias del usuario, o **`{}`** si no tiene fila (no la crea).
- **`PUT /preferences`** — body `{ data: <objeto plano> }`. El `data` de la respuesta es el blob **persistido**. Hace **upsert** (crea la fila si no existía). `400` si `data` falta o **no es un objeto**.
- **Semántica de reemplazo completo (no merge).** El server **NO** mergea: guarda el `data` recibido **tal cual**, reemplazando el blob entero. **El frontend manda el blob completo** en cada `PUT` — para cambiar una sola clave, el llamador parte del blob actual y reescribe todo (`{ ...preferences, clave: valor }`). Consecuencia: omitir una clave en el `PUT` la **borra**.
- **El back NO valida ni conoce ninguna clave del blob.** `PUT /preferences` guarda el blob tal cual. La normalización y los defaults de cada clave son responsabilidad del frontend consumidor, en la **lectura** del blob: un blob parcial o con claves ausentes nunca rompe la pantalla.

## Claves del blob

El blob es un objeto **abierto/extensible**: cada consumidor agrega su(s) propia(s) clave(s) sin tocar la DB. Claves:

### `monthSections` — estado de las secciones de la Vista del mes (RF-VM-005)

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
- **Normalización.** Si `monthSections` **no existe** en el blob → se usa el default (`order: ["unicos","fijos","cuotas"]`, `collapsed: []`). Si `order` trae **claves desconocidas o le faltan**, se **normaliza**: se filtran las desconocidas y se agregan al final las faltantes, preservando el orden válido recibido (ver `docs/frontend/vista-mes-y-dashboard.md` §Vista del mes).

### `reports` — config de las cards de la pantalla de Reportes (RF-REP-003/004)

Persiste la vista configurable de `/reportes`: una entrada por **card de reporte**, en el orden en que se muestran. Cada card es un widget de reporte autónomo (RF-REP-002).

```
reports: ReportCardConfig[]

ReportCardConfig = {
  id: string,                                   // id local de la card (key de React / quitar); generado en el front
  title?: string,                               // título de la card (RF-REP-008); ausente = placeholder "Reporte N" (display)
  type: ReportCardType,                          // tipo de reporte (RF-REP-001 / RF-REP-010..013)
  year: number,                                 // año que muestra la card
  categoryIds: string[] | null,                 // null = todas las categorías; lista = subconjunto explícito de categoryIds
  categoryChartMode?: "bar" | "line",            // solo by-category: representación barra vs línea (RF-REP-006); ausente = "bar"
  categoryBreakdown?: boolean,                   // DEPRECADO — ver normalización (solo se lee para convertir)
  hiddenSeries?: Array<"income" | "expense">,    // DEPRECADO — no usado por income-expense; la normalización lo strip en lectura
  movementTypes?: Array<"fijo" | "cuota" | "unico">,  // filtro por tipo (income-expense, RF-REP-014); ausente = todos
  direction?: "expense" | "income" | "both",     // filtro de dirección (income-expense, RF-REP-014); ausente = "both"
  projectFixed?: boolean,                        // INERTE — proyección de fijos (RF-REP-015); retenido en el tipo, ninguna pantalla lo setea/consume
  includeSimulated?: boolean,                    // solo income-expense / by-category: movimientos simulados en el tramo futuro (RF-REP-017); ausente = apagado
  currency?: "ARS" | "USD" | "EUR" | "BRL",       // moneda de display de la card (RF-REP-007); ausente = default global vigente
  anchorUsdCents?: number,                       // solo unique-grid: techo de la escala de color en centavos de USD (RF-REP-010); ausente = default 15 USD (1500)
  fixedMode?: "amounts" | "variation",           // solo fixed-evolution: modo de visualización (RF-REP-013); ausente = "amounts"
  fixedAdjusted?: boolean,                       // solo fixed-evolution: ajuste por inflación de la variación; ausente = false
  fixedSelectedIds?: string[] | null,            // solo fixed-evolution: selección de fijos por chainId; null = todos
  fixedRangeMonths?: 3 | 6 | 9 | 12 | 24 | 36 | 48 | 60, // solo fixed-evolution: largo del rango en meses (RF-REP-013); ausente = 36
  fixedShowCalculated?: boolean                  // solo fixed-evolution: toggle "Mostrar calculados" (RF-REP-013); ausente = false
}

ReportCardType = "income-expense" | "by-category" | "unique-grid" | "installment-gantt" | "inflation-income" | "fixed-evolution"
```

Nombres de display de cada tipo (menú "[+]" y mini de reorden): `income-expense` = **"Ingresos vs Gastos"**, `by-category` = **"Gastos por categoría"**, `unique-grid` = **"Gastos Únicos"**, `installment-gantt` = **"Gastos en Cuotas"**, `inflation-income` = **"Inflación vs Ingresos"**, `fixed-evolution` = **"Detalle histórico de fijos"**.

- **`title`** (RF-REP-008) — título de la card, máx. 60 caracteres, trimmeado al confirmar. Aplica a todos los `type`. **Ausente o vacío** → la card muestra el placeholder **"Reporte N"** (N = posición 1-based de la card en la columna, contando todas las cards; **display puro, no se persiste** y se recalcula en vivo al quitar/reordenar). Si el usuario confirma un título vacío, el campo se **omite** del objeto.
- **`type`** (`ReportCardType`) — `"income-expense"` (Ingresos vs Gastos, RF-REP-001), `"by-category"` (Gastos por categoría, RF-REP-001), `"unique-grid"` (grilla anual de gastos Únicos día × mes, RF-REP-010), `"installment-gantt"` (gantt anual de gastos en Cuotas, RF-REP-011), `"inflation-income"` (líneas de Inflación vs Ingresos del año, RF-REP-012) o `"fixed-evolution"` (Detalle histórico de fijos, RF-REP-013). La card `income-expense` es **Total-only**: muestra únicamente las dos series agregadas (ingresos vs gastos), sin sub-vista por categoría ni tabs. Las cards `unique-grid`, `installment-gantt` e `inflation-income` persisten los mismos campos base que las otras (`year`, `categoryIds`, `currency`, `title`) y **no** usan `categoryChartMode` ni `hiddenSeries`. La `unique-grid` **sí agrega un campo propio**, `anchorUsdCents` (techo de su escala de color, RF-REP-010); las demás cards anuales lo ignoran. Su fuente de datos es un endpoint propio (`GET /movements/reports/annual-unicos`, `GET /movements/reports/annual-cuotas` y `GET /movements/reports/annual-inflation-income` respectivamente; ver `informes.md`), distinto de `GET /movements/reports`. La card **`fixed-evolution`** sigue el mismo patrón —endpoint propio `GET /movements/reports/fijos-historico` (`informes.md`, §Contrato del detalle histórico de Fijos)— pero **no usa `categoryIds`**: su selección va por `fixedSelectedIds`, y suma además `fixedMode`, `fixedAdjusted`, `fixedRangeMonths` y `fixedShowCalculated`.
  - **`inflation-income` — toggle de series efímero.** La card grafica tres series (inflación, variación % de ingreso, ingreso ajustado) cuya **visibilidad se togglea por la leyenda**, pero ese toggle es **estado local efímero de la card**: **no** se persiste en el blob (default = las tres visibles; al recargar vuelven todas). Lo que sí se persiste (como en las demás cards anuales) es el filtro de categorías (`categoryIds`) y la moneda (`currency`).
- **`year`** — el año que la card grafica; lo cambia la navegación de año embebida del widget. En **`fixed-evolution`** es **inerte**: esa card no navega años, su rango se ancla al **mes en curso** (ver `fixedRangeMonths` y RF-REP-013). El campo se escribe al crear la card por el shape base y la card **no lo lee**.
- **`categoryIds`** — filtro de categorías de la card. **`null` = todas** (default al crear); una **lista** = subconjunto explícito de `categoryId`s seleccionados; `[]` = ninguna. Aplica a `income-expense` (restringe qué categorías cuentan en los totales; RF-REP-014 no agrega un campo propio para categoría) y a `by-category` (qué bandas se apilan). Lo que el front manda al endpoint como `categories` deriva de este campo (ver `informes.md`, contrato `GET /movements/reports`).
- **`categoryChartMode`** (RF-REP-006) — representación **solo de las cards `by-category`**: `"bar"` = barras apiladas por categoría (default); `"line"` = áreas apiladas por categoría (mismo dato, geometría continua, con línea de contorno = total de gasto). **Ausente = `"bar"`**. Irrelevante para los demás tipos. En el dashboard solo se monta `income-expense`, que no usa este campo.
- **`categoryBreakdown`** — **DEPRECADO.** Declarado en el tipo porque la normalización en lectura lo lee para convertir la card (ver Normalización). Código nuevo **no** lo escribe ni lo lee; ninguna card nueva lo persiste.
- **`hiddenSeries`** — **DEPRECADO.** Declarado en el tipo porque un blob puede traerlo, pero **income-expense no lo usa**: la **dirección** (`direction`) es el único control de qué líneas se ven (ver RF-REP-014 y `docs/frontend/graficos.md` §Filtros de la card income-expense). La normalización en lectura lo **strip** para las cards `income-expense`; código nuevo no lo escribe ni lo lee.
- **`movementTypes`** (RF-REP-014) — filtro por **tipo de movimiento** de la card `income-expense`: subconjunto de `["fijo", "cuota", "unico"]`. **Ausente = todos los tipos** (una card sin el campo computa los tres). `[]` = ninguno (totales en cero). Acota qué tipos alimentan las series Ingresos/Gastos; es un **filtro**, no un desglose. Solo aplica a `type: "income-expense"`. Persistido por card.
- **`direction`** (RF-REP-014) — filtro de **dirección** de la card `income-expense`: `"expense"` (solo gastos), `"income"` (solo ingresos) o `"both"` (ambas). **Ausente = `"both"`**. Solo aplica a `type: "income-expense"`. Persistido por card.
- **`projectFixed`** (RF-REP-015) — **INERTE.** Declarado en el tipo (retención de la capacidad de proyección de fijos del backend), pero **ninguna pantalla lo setea ni lo consume**: no hay control de proyección en ninguna card. Una card que traiga `projectFixed: true` **no renderiza proyección** (el front no manda el param), y el campo **no se borra** del blob. Su efecto en la respuesta del endpoint, cuando se pide, está en `informes.md`, §Contrato de serie de reportes.
- **`includeSimulated`** (RF-REP-017) — toggle de **movimientos simulados** de la card, solo en `type: "income-expense"` y `"by-category"`. **Ausente = apagado** (la card grafica solo lo real). Es lo que el front traduce al query param `includeSimulated` de `GET /movements/reports` (ver `informes.md`). Es **independiente** de `projectFixed` y del resto de los filtros. Las demás cards lo ignoran; la card del dashboard no lo usa.
- **`currency`** (RF-REP-007) — moneda de display de la card: una de las 4 monedas (RF-CUR-001). **Ausente = la moneda default global vigente** del usuario. Al crear una card se persiste con la default actual. El front la manda al endpoint como el query param `currency` de `GET /movements/reports` (override de display; ver `informes.md`); cambiarla re-expresa la serie al vuelo, sin tocar lo guardado. La card del dashboard no usa este campo (siempre default).
- **`anchorUsdCents`** (RF-REP-010) — **solo `unique-grid`**: techo (ancla) de la escala de color de la grilla, entero, **centavos de USD**, persistido por card. **Ausente = default 15 USD (`1500`)**. Se guarda en USD para ser constante en términos reales; el backend lo reconvierte a la moneda de display con el TC del año de la card (ver `informes.md`, §Contrato de reporte anual de Únicos, y RF-REP-010). Las demás cards anuales lo ignoran.
- **`fixedMode`** (RF-REP-013) — **solo `fixed-evolution`**: modo de visualización de la card. `"amounts"` = montos en la moneda de display; `"variation"` = variación % por línea. **Ausente = `"amounts"`.** Persistido por card.
- **`fixedAdjusted`** (RF-REP-013) — **solo `fixed-evolution`**: ajuste por inflación de la variación. **Ausente/`false` = variación nominal.** Solo tiene efecto con `fixedMode: "variation"`; el valor se **conserva** al volver a `"amounts"` (el control queda deshabilitado mostrando lo persistido). Persistido por card.
- **`fixedSelectedIds`** (RF-REP-013) — **solo `fixed-evolution`**: selección de fijos (gasto o ingreso) por **`chainId`**. **`null` = todos** los fijos del universo de la leyenda del rango (default al crear); una **lista** = subconjunto explícito (puede ser `[]` = ninguno). **Reemplaza al filtro de categorías** (esta card no lo tiene) y se aplica **client-side** sobre las `lines` del response — no viaja al endpoint. **Sobrevive a los cambios de rango**: un `chainId` que sale del universo se conserva en la lista (no se dibuja, y vuelve a dibujarse si el rango lo reincorpora); la navegación **nunca reescribe** el campo. Con una lista, toda cadena que no está en ella —incluido un fijo de ingreso— aparece **destildada**; con `null`, tildada. Persistido por card.
- **`fixedRangeMonths`** (RF-REP-013) — **solo `fixed-evolution`**: **largo del rango visible en meses**, uno de `3 | 6 | 9 | 12 | 24 | 36 | 48 | 60` (las ocho opciones del select: 3/6/9 meses y 1/2/3/4/5 años). **Ausente = `36`** (3 años). El rango pedido es el que **termina en el mes en curso** y cubre `fixedRangeMonths` meses corridos hacia atrás, antes del recorte del backend contra el primer mes con aparición de un fijo (gasto o ingreso). Las demás cards ignoran el campo. Persistido por card.
- **`fixedShowCalculated`** (RF-REP-013) — **solo `fixed-evolution`**: toggle **"Mostrar calculados"**. **Ausente/`false` = apagado**: los calculados de fijo no aparecen en la card; una card sin el campo no muestra calculados hasta que el usuario lo prende. Se aplica **client-side** sobre `lines` y `excluded` (`isCalculated`) — no viaja al endpoint y el backend no conoce la clave. **No reescribe `fixedSelectedIds`**: la selección de un calculado se conserva con el toggle apagado. Con el toggle **oculto** (rango sin calculados) el valor **no se toca** y vuelve a aplicar en un rango con calculados (RF-REP-013 §Toggle "Mostrar calculados"). La variante acotada de `/mes` (RF-VM-009) no lo usa. Persistido por card.
- **Orden del array = orden de despliegue** de las cards en pantalla.
- **Ausente / vacío = pantalla vacía.** Clave ausente o `reports: []` → `/reportes` muestra solo el recuadro "[+]" (estado vacío inicial, RF-REP-003).
- **Normalización (en lectura, frontend).** Entradas malformadas, `type` desconocido y `categoryIds` que apunten a categorías inexistentes/eliminadas se normalizan al leer el blob. La conversión del `categoryBreakdown` deprecado corre acá:
  - `income-expense` + `categoryBreakdown: true` → se convierte en `{ type: "by-category", categoryChartMode: "line" }`, conservando `id`/`title`/`year`/`categoryIds`/`currency` y descartando `categoryBreakdown` e `hiddenSeries`.
  - `income-expense` + `categoryBreakdown` `false`/ausente → queda `income-expense` sin el campo.
  - `income-expense` con `hiddenSeries` → se **strip** el campo (deprecado; la dirección gobierna las líneas).
  - `by-category` sin `categoryChartMode` → se trata como `"bar"`.
- Que el back no conozca la clave es lo que permite que cada tipo de card sume **campos propios** (`anchorUsdCents`, `fixedMode`, `fixedAdjusted`, `fixedSelectedIds`, `fixedRangeMonths`) sin tocar el servidor ni migrar blobs.

### `monthListFilters` — filtros por listado de la Vista del mes (RF-VM-006)

Filtros **por sección** de `/mes` (tipo + categoría por cada una de Únicos/Fijos/Cuotas), persistidos por usuario. Shape y semántica en `filtro-categorias.md`, §Preferencia `monthListFilters`.

### `unicosSort` — orden de la sección Únicos de la Vista del mes (RF-VM-001)

```
unicosSort: "amount" | "date"
```

- Orden de los movimientos de la sección **Únicos** de `/mes`: `"amount"` (por monto descendente) o `"date"` (por fecha, más reciente primero). **Default `"amount"`** (clave ausente = `"amount"`). Solo aplica a Únicos (Fijos y Cuotas no tienen fecha). Estado de **UI frontend-puro**. Regla funcional en RF-VM-001.

### `theme` — modo de color de la app (RF-APP-001)

```
theme: "system" | "light" | "dark"
```

- Modo de color elegido desde el chrome global (sidebar, RF-NAV-001): `"system"` (sigue `prefers-color-scheme` del dispositivo), `"light"` o `"dark"`. **Default por ausencia = `"system"`** (la clave ausente se interpreta como Sistema); si el usuario elige "Sistema" explícitamente se persiste `"system"`. Estado de **UI frontend-puro** — el frontend lo mergea sobre el blob en el `PUT /preferences`. Regla funcional en RF-APP-001; arquitectura de aplicación (override de tokens, anti-flash) en `docs/frontend/base.md` §Modo de color (theming).

### `sidebarOpen` — estado mostrar/ocultar del sidebar (RF-NAV-002)

```
sidebarOpen: boolean
```

- Sidebar (RF-NAV-001) abierto (`true`) u oculto (`false`). **Default por ausencia = `true`** (abierto). Estado de **UI frontend-puro** — el frontend lo mergea sobre el blob en el `PUT /preferences`. Regla funcional en RF-NAV-002.

### `limits` — límites del usuario (RF-LIM-001..005)

Persiste los **límites**: un array de reglas declarativas. Evaluación **100% client-side**.

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
- **El catálogo de keys es un registro hardcodeado del frontend**, no un contrato de DB: es el "lenguaje común" entre los datos que emiten cada key (anclajes) y los consumidores (panel + evaluador). La fuente de verdad del registro (keys, unidades, refinamientos, subset de efectos y default por anclaje) vive en el frontend (`lib/limits/catalog.ts`, ver `docs/frontend/limites.md`); el catálogo de **efectos visuales** y su mapeo por anclaje vive en `docs/design/limites.md`. Reglas funcionales en el módulo 3.13 (`docs/requirements/limites.md`).
- **`threshold` es un número puro sin moneda** (RN-022): su tipo (money / signed-money / percent / count) lo determina el `unit` de la key en el registro, no el límite.
- **Ausente / normalización.** Clave ausente o `limits: []` → sin límites (cero-impacto, RN-022). La normalización (entradas malformadas, `anchorKey` desconocida, `effect` fuera del subset de la key) es responsabilidad del front en la lectura del blob.

### `defaultPaymentMethods` — método de pago predeterminado por estructura (RF-PM-007)

Método de pago que **prellena** el selector del formulario al **crear** un movimiento, por estructura. Evaluación **100% client-side**.

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
- La normalización, el prefill (solo en creación, editable; no en edición ni en calculados) y los defaults son del frontend consumidor. Regla funcional en RF-PM-007.

### `monthCategoryFilter` — filtro de categorías de la Vista del mes (RF-VM-006) — **DEPRECADA**

No se lee ni se escribe desde `/mes`; se conserva en el tipo y **no se migra**. Detalle en `filtro-categorias.md`, §Preferencia `monthCategoryFilter`.
