# Contratos de movimientos (único y movimientos del mes)

> Parte del modelo de datos de Control. Índice: `docs/data-model.md`. Decisiones de modelado (moneda, conversión, anulación, borrado lógico, calculados): `entidades.md`. Contratos propios del calculado: `calculados.md`.

## Contrato de movimiento único (respuesta de la API)

Toda respuesta exitosa de los endpoints de movimientos únicos devuelve, dentro del sobre `{ success, statusCode, data }`, este shape (el modelo Prisma está documentado en `docs/backend/base.md` §Capa de datos):

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

`GET /movements?month=YYYY-MM` devuelve, dentro del sobre `{ success, statusCode, data }`, los movimientos del mes agrupados por origen **más los totales**. Es el endpoint unificado de la Vista del mes y el Dashboard (detalle de implementación en `docs/backend/movimientos-mes.md`).

**Query params:**

- **`month`** (requerido) — el mes a listar, `YYYY-MM`.
- **`today`** (opcional) — fecha local del usuario, `YYYY-MM-DD`; formato inválido → `400`. Fija el **mes en curso** con el que se resuelven el tramo (por simulación) y la ventana histórica de las simulaciones (RN-028) y, por lo tanto, qué meses traen movimientos simulados. **El frontend lo manda siempre** con la fecha local del navegador (ver `docs/frontend/vista-mes-y-dashboard.md` §Datos (`use-movements`)); **ausente** el backend cae a la **fecha UTC del sistema** (mismo criterio que el resto de los endpoints con este param), que en zonas UTC−N adelanta el mes en curso y hace aparecer movimientos simulados sobre el mes en curso real. Fija también el mes en curso hasta el que se cuentan las apariciones de `evolutionAvailable`. Irrelevante para el resto de la respuesta.
- **`categories`** (opcional) — filtro por categoría. Lista de `categoryId`s **separados por comas, sin URL-encode** (ej. `categories=abc,def`). **Distingue "ausente" de "presente y vacío"** (tabla en `filtro-categorias.md`): ausente = todas; `categories=` (vacío) = ninguna (listas vacías + totales en cero); lista = solo esas categorías. Afecta **gastos e ingresos** y recalcula **listas y totales**. **`/mes` no usa este param:** el filtrado de la Vista del mes ocurre en el frontend (filtros por listado, RF-VM-006), así que `/mes` trae todo el mes sin `categories`. El param lo consume `GET /movements/reports` (filtro de reportes).

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
  chainId: string | null,                    // identidad de cadena PROPIA del ítem; solo origin==="fijo" (incluye calculado de fijo); null en único y cuota
  skipped: boolean,                          // true = anulado (excluido de totales/reportes). fijo: RecurringSkip del mes; único: flag Transaction.skipped; cuota: InstallmentSkip del mes visualizado; calculado: skip propio (solo de fijo) OR skip del origen del mes
  category: { id, name, color, scope },      // embebida
  paymentMethod: { id, name, icon, type, closingDay, paymentDay } | null,  // método embebido; null si el movimiento no tiene (RF-PM-006). closingDay/paymentDay: día del mes 1-31, poblados solo si type==="CREDIT" (null en DEBIT/CASH)
  autoDebit: boolean | null,                 // flag débito automático DEL movimiento (fuera de paymentMethod); null salvo método DEBIT (RN-021)
  calculated: CalculatedInfo | null,         // presente si el ítem ES un calculado (hijo); null si no
  hasCalculated: boolean,                    // == calculatedChildren.length > 0: true si el ítem es un ORIGEN (fijo/único/cuota) con ≥1 calculado en el mes (padre); false en el resto
  calculatedChildren: CalculatedChild[],     // los calculados derivados de ESTE ítem en el mes consultado; [] si no tiene, o si el ítem ES un calculado (nunca es padre)
  simulated: boolean,                        // true = movimiento SIMULADO (RF-SIM-003), sin fila en ninguna tabla; false en TODO ítem real
  evolutionAvailable: boolean                // true = fijo NO calculado cuya cadena tiene ≥2 apariciones graficables hasta el mes en curso (RF-VM-009); false en el resto
}

CalculatedChild = {                          // un calculado derivado del ítem padre, en el mes consultado
  id: string,                                //   id del calculado (fila Recurring)
  description: string | null,                //   descripción propia del calculado
  type: "EXPENSE" | "INCOME",                //   tipo derivado del signo del monto del calculado (RN-018)
  convertedAmountCents: number,              //   MAGNITUD (≥ 0) del monto convertido a la default vigente — sin signo; el signo se lee de `type`
  formulaOperator: "ADD"|"SUB"|"MUL"|"DIV"|"PCT",
  formulaOperand: number,                    //   operando ESCALADO (entero) — ver calculados.md, "Escalado del operando"
  formulaSign: 1 | -1                        //   signo del resultado
}

CalculatedInfo = {                           // solo en ítems que son calculados
  sourceType: "fijo" | "unico" | "cuota",    // tipo del origen del calculado
  sourceId: string,                          // id del origen: chainId (fijo) / Transaction.id (único) / InstallmentGroup.id (cuota)
  sourceChainId: string | null,              // chainId del fijo de origen (fijo); null para único/cuota
  sourceDescription: string | null,          // rótulo del origen (para el preview / "desde {Origen}"): su descripción o, si no tiene, el NOMBRE DE SU CATEGORÍA
  formulaOperator: "ADD"|"SUB"|"MUL"|"DIV"|"PCT",
  formulaOperand: number,                    // operando ESCALADO (entero) — ver calculados.md, "Escalado del operando"
  formulaSign: 1 | -1,                       // signo del resultado
  sourceMonthOffset: number,                 // desfasaje del MES DE REFERENCIA (entero 0..12; 0 = mismo mes). Siempre presente: 0 en calculados de único y cuota
  sourceAmountCents: number                  // monto del origen EN EL MES DE REFERENCIA (centavos, > 0); base real de la fórmula. Para CUOTA = monto por cuota del grupo
}
```

- **Discriminador `origin`.** Cada ítem declara su tipo de movimiento (`unico` / `fijo` / `cuota`), además de venir agrupado en su lista. El front lo usa para rotular el origen y elegir el flujo de edición/eliminación.
- **Orden de las listas.** Los tres grupos vienen ordenados por **magnitud del monto descendente** = `\|amountCents\|` DESC (monto más grande primero, por tamaño, sin distinguir `EXPENSE` de `INCOME`). Para únicos, fijos normales y cuotas `amountCents > 0`, así que la magnitud coincide con el valor; para un **movimiento calculado** el `amountCents` puede ser **negativo** (RN-018), por lo que se ordena por su **valor absoluto** — un calculado de `−5000` se ubica entre los demás por su tamaño (5000), no al final por ser negativo. Desempate estable por grupo: `unicos` por `occurredAt` DESC, `fijos` por `createdAt` DESC, `cuotas` por `id` ascendente.
- **`occurredAt` / `timezone` son nullable.** Para **únicos** vienen presentes (instante + zona). Para **fijos** y **cuotas** vienen **`null`**: operan a nivel mes, no tienen día/hora/zona. El front no debe pasar estos campos a `formatDate` / `formatTime` sin chequear null. **Calculados:** un calculado **hereda `occurredAt`/`timezone` del origen** — el de **único** los trae **poblados** (los del `Transaction` de origen), consistente con que todos los ítems de la sección Únicos muestran día/hora y con que el calculado ocurre "junto con" su origen; el de **fijo** y el de **cuota** quedan en **`null`** (su origen tampoco tiene día/hora).
- **`installment` solo en cuotas.** Para una cuota trae `{ number, total, startMonth }`: `number` es el número de cuota del mes (1-based), `total` es el `totalInstallments` del grupo y `startMonth` es el mes de inicio del grupo. Para **únicos** y **fijos** es **`null`**. El front lo usa para la etiqueta "Cuota X/N" y para prefilear la edición del grupo.
- **`startMonth` en fijos.** Para un **fijo** trae el **arranque del fijo lógico** = `startMonth` de la **primera fila de su cadena** (`chainId`), no el de la fila vigente tras un split de edición (RF-MF-007; resolución por cadena en `docs/backend/movimientos-mes.md` §Integración de fijos en `/movements`). Un **calculado de fijo** trae su **propio** arranque (el de su cadena), no el del origen. Es **`null`** en únicos (usan `occurredAt`) y en cuotas (traen su arranque en `installment.startMonth`).
- **`endMonth` en fijos.** Para un **fijo** trae el **fin del fijo lógico** (vigencia) = el `deletedFrom` de la fila con **mayor `startMonth`** de su cadena (la **fila vigente**), en formato `"YYYY-MM"` **EXCLUSIVO** (mismo criterio que `Recurring.deletedFrom`: el mes indicado ya **no** aparece; el último mes activo es el anterior). **`null` = activo indefinidamente** (sin terminación programada). Un **calculado de fijo** trae el fin de su **propia** cadena, no el del origen. Es **`null`** en únicos y cuotas (no aplica: la cuota tiene fin implícito vía `installment.number`/`total`). Lo consume la card de detalle (RF-MF-007 / RF-VM-007); resolución por cadena en `docs/backend/movimientos-mes.md` §Integración de fijos en `/movements`.
- **`chainId` — identidad de cadena propia del ítem.** No-null **solo** con `origin === "fijo"`: fijos normales y calculados de fijo, cada uno con **su propia** cadena — **nunca** el `sourceChainId` del origen (ese viaja en `calculated`). Es **`null`** en únicos y cuotas, **incluidos sus calculados** (que se persisten como `Recurring` pero se editan siempre in-place, sin split) y los ítems **simulados**: esas formas no tienen concepto de cadena y su clave estable es su propio `id`. Es la **clave de agrupación estable de un fijo a través de los splits de edición** —el `id` de fila cambia en cada split, el `chainId` no—, la misma razón por la que el `targetId` de un `HistoryEntry` de fijo es el `chainId` (ver `historial.md`). Consumo en `docs/frontend/historial.md` §Deshacer desde el toast.
- **`frequency` / `skipped`.** Para un **fijo**, `frequency` es su periodicidad (**entero 1..12** = meses entre apariciones, RF-MF-006) y `skipped` indica si esa aparición está **anulada para el mes consultado** (RF-MF-005). Para un **calculado de fijo**, `frequency` es **`null`** y `skipped = skip propio del calculado **OR** skip del fijo de origen` (RF-MF-005 / RF-MCALC-005): un calculado de fijo se puede anular por su cuenta y además hereda la anulación de su origen. Para un **único**, `frequency` es **`null`** y `skipped` refleja su anulación (flag `Transaction.skipped`, RF-MU-005); para una **cuota**, `frequency` es **`null`** y `skipped` refleja la anulación de esa instancia mensual (`InstallmentSkip` del mes visualizado, RF-MC-004). Un **calculado de único o de cuota** hereda `skipped` del origen del mes (no tiene skip propio, RF-MCALC-005). Un ítem con `skipped: true` **viene igual en la lista** (no se omite) pero **no está incluido en `totals`** — el front lo muestra con su diferenciación visual de anulado. El front usa `frequency` para rotular la cadencia y `skipped` para el estado y el toggle de la acción anular/des-anular.
- **Moneda y conversión por ítem.** Cada `MovementItem` trae su moneda original (`currency`, una de las 4), la cotización guardada (`exchangeRate` = unidades de su **`anchorCurrency` interna** por 1 unidad de `currency` del ítem / del mes en fijos / del grupo en cuotas — ver `entidades.md`, "Semántica de `exchangeRate`") y `convertedAmountCents` = `amountCents` **convertido a la moneda default vigente** del usuario, vía re-ruteo por el pivote `USD` con la tabla de referencia del mes (ver `entidades.md`, "Conversión = capa de display"). **Para fijos, cuotas y sus calculados** el `convertedAmountCents` se deriva del **TC oficial del mes de la instancia** (`ReferenceRate`), **no** del `exchangeRate` reportado en este campo (que conserva el valor guardado de la fila); **únicos** y **calculados-de-único** sí lo derivan de su `exchangeRate` guardado. Si la moneda del ítem **coincide** con la default, `convertedAmountCents == amountCents`. El `MovementItem` **no expone `anchorCurrency`** (es interna): el front no la necesita, recibe el `convertedAmountCents` listo. Un **calculado** hereda `currency`/`exchangeRate` del origen (RF-CUR-004). **`convertedAmountCents` de un calculado es siempre magnitud (`≥ 0`), no un valor con signo:** solo lleva la cifra del monto convertido a la default. El **signo** del calculado —y por ende su `type` (negativo ⇒ `EXPENSE`, positivo ⇒ `INCOME`)— vive únicamente en `amountCents`, que sí lo conserva. El display que necesite el signo de un calculado debe leerlo de `amountCents` y usar `convertedAmountCents` solo para la cifra (en moneda default). El front muestra el monto original (`amountCents` + `currency`) y el convertido; ver `docs/screens.md` §Vista del mes / Formulario y `docs/design/moneda.md`.
- **Los totales del mes usan `convertedAmountCents`.** Los `totals` (`expenseCents` / `incomeCents` / `balanceCents`) suman la **magnitud de `convertedAmountCents`** (no de `amountCents`): es la única forma de sumar movimientos de distintas monedas en una sola cifra. La conversión es **capa de display** (no toca lo guardado); cambiar la default re-expresa los totales. La imputación por bucket de tipo sigue RN-019.
- **Los totales suman movimientos, no categorías.** `expenseCents` / `incomeCents` agregan la **magnitud** (`\|convertedAmountCents\|`) de los movimientos del mes **en el bucket de su `type`** (RN-019): un `INCOME` suma a `incomeCents`, un `EXPENSE` a `expenseCents`. Para movimientos normales `amountCents > 0` y el `type` es fijo. Para un **movimiento calculado** el `amountCents` puede ser **negativo o cero** (RN-018) y su `type` se **deriva del signo** (negativo → `EXPENSE`, positivo → `INCOME`); como signo y tipo siempre coinciden, suma su magnitud al bucket correcto —un calculado de `−2000` es `EXPENSE` y suma 2000 a `expenseCents`; uno de `+2000` es `INCOME` y suma 2000 a `incomeCents`; un monto 0 no aporta a ningún bucket—. No hay restas ni reasignación de bucket. `balanceCents = incomeCents - expenseCents`, sin piso (negativo si los gastos superan los ingresos). No se confunden con el contador `movementCount` de la pantalla de categorías (`categorias.md`; RF-VM-002 / RF-CAT-006). **Un ítem anulado (`skipped: true`) aparece en la lista pero NO suma a los totales.**
- **Movimientos calculados — `origin` espeja el tipo del origen.** Un movimiento calculado viaja en la lista de **su tipo de origen** (`origin: "fijo" | "unico" | "cuota"` según `calculated.sourceType`): calculado de fijo → lista `fijos`; de único → lista `unicos`; de cuota → lista `cuotas`. Su `amountCents` viene **derivado al vuelo y con signo** para el mes (`signo × round(fórmula(montoOrigenEseMes))`, RN-017/018) y puede ser **≤ 0**; su `type` viene **derivado de ese signo** (negativo → `EXPENSE`, positivo → `INCOME`, cero → `EXPENSE`; RN-018), no es un dato elegible. Para un calculado de **cuota**, `calculated.sourceAmountCents` es el **monto por cuota** del grupo, y el ítem **no** trae la etiqueta `installment` "X/N" (RF-MCALC-008). La **relación padre/hijo** (RF-MCALC-007) se expone con dos campos del `MovementItem`: **`calculated`** (objeto `CalculatedInfo` si el ítem **es** un calculado / hijo, `null` si no) y **`hasCalculated`** (`true` si el ítem es un **origen** —fijo, único o cuota— con ≥1 calculado derivado en ese mes / padre). Un calculado nunca es padre (`hasCalculated: false` siempre — sin encadenamiento). El **orden** de cada lista usa la **magnitud** = `\|amountCents\|` DESC (ver "Orden de las listas").
- **`calculatedChildren` — derivados del ítem origen (RF-VM-007).** Cuando el ítem es **origen** de calculados, `calculatedChildren` lista los calculados **derivados de ese ítem en el mes consultado**; los alimenta la card de detalle para mostrar sus derivados (simétrico a `calculated`, que muestra el origen desde un calculado). Es **`[]`** si el ítem no tiene derivados **o si el ítem es un calculado** (nunca es padre — sin encadenamiento, RF-MCALC-001). `hasCalculated == calculatedChildren.length > 0`. El alcance es **estrictamente el mes consultado** (un derivado que no aparece ese mes por su frecuencia/skip no entra). **Gotcha — `CalculatedChild.convertedAmountCents` es MAGNITUD (≥ 0), sin signo:** a diferencia de `CalculatedInfo.sourceAmountCents` (monto del origen) y del `amountCents` con signo del propio calculado, el `CalculatedChild` **no expone un monto con signo** — solo la cifra convertida a la default vigente. El **signo** (y por ende la dirección gasto/ingreso) se deriva de su **`type`** (`EXPENSE` ⇒ negativo, `INCOME` ⇒ positivo). El display que necesite el signo debe leerlo de `type`, no del monto.
- **La categoría embebida puede estar soft-deleted.** Un movimiento histórico muestra su categoría aunque haya sido eliminada (`deletedAt`), y **sigue contando en los totales** (RF-CAT-004 / RF-VM-002; el join de movimientos no filtra por `deletedAt` de la categoría).
- **Método de pago embebido (opcional).** Cada `MovementItem` trae `paymentMethod: { id, name, icon, type, closingDay, paymentDay } | null` — `null` si el movimiento no tiene método (RF-PM-006). **`closingDay`/`paymentDay`** son el día del mes (1-31) de cierre y de cobro del resumen; vienen **poblados solo para `type === "CREDIT"`** y `null` en `DEBIT`/`CASH` (misma semántica que en `PaymentMethod`, `metodos-pago.md`). Los consume la card de detalle (RF-VM-007) para la sublínea del crédito. Como en la categoría, el método puede estar soft-deleted y aun así se muestra en el ítem histórico. Es **metadato**: no entra a `totals` ni a los reportes. Un **calculado hereda** el método **del origen** (no persiste uno propio; se deriva al vuelo junto con el resto de sus datos derivados, igual que la moneda/cotización — RF-PM-006 / RF-CUR-004). **Los endpoints de reportes (`GET /movements/reports`, anuales) NO exponen el método**: son series agregadas sin dimensión por método de pago en v1.
- **`evolutionAvailable` — habilita el acceso "Ver evolución" del fijo (RF-VM-009).** `true` solo con `origin === "fijo"`, `calculated === null` y `simulated === false`, cuando la **cadena** del ítem (`chainId`) tiene **≥2 apariciones graficables** entre el arranque de la cadena y el **mes en curso** inclusive (resuelto con `today`). Aparición graficable = mismo criterio que `lines` de `informes.md`, §Contrato del detalle histórico de Fijos (mes con monto; no cuentan meses fuera de frecuencia, anulados, previos al alta ni posteriores a la baja). Es una propiedad **de la cadena**, no del mes consultado: el mismo fijo trae el mismo valor en cualquier mes de `/mes`. `false` en fijos con <2, en calculados (de cualquier origen), únicos, cuotas y simulados. El front lo usa solo para habilitar/deshabilitar el acceso; con `true`, el rango elegido igual puede tener <2 apariciones (la vista muestra el vacío de la card). Cálculo en `docs/backend/graficos.md` §Detalle histórico de Fijos.
- **`autoDebit` — flag del movimiento, fuera del método embebido.** Cada `MovementItem` expone `autoDebit: boolean | null` **a nivel del ítem** (no dentro de `paymentMethod`): `true`/`false` solo cuando el método efectivo es `DEBIT`, `null` en cualquier otro caso (sin método o método `CREDIT`/`CASH`; RN-021). Un **calculado hereda** el `autoDebit` del origen, derivado al vuelo (no persiste uno propio). Metadato: no entra a `totals` ni a los reportes.
- **Fijos y cuotas, on-the-fly.** Los totales del mes suman únicos + fijos + cuotas. El **grupo de cuotas no genera filas por instancia**: se calcula on-the-fly (RN-006) — una cuota cae en `startMonth ≤ mes < startMonth + totalInstallments`. Detalle del cálculo en `docs/backend/movimientos-mes.md` §Integración de cuotas en `/movements`.
- **`simulated` — el movimiento simulado viaja mezclado en `movements.unicos`** (RF-SIM-003). No es una lista aparte: viene **mezclado y reordenado** junto a los únicos reales por el mismo criterio de magnitud DESC (desempate por `occurredAt` DESC, que un simulado no tiene y por eso cede en un empate exacto), participa del filtro `categories` y **suma a `totals`** como cualquier único. Solo puede darse con `origin: "unico"` y `simulated: true`; **todo ítem real trae `simulated: false`**.
  - **`id` sintético y estable: `simulated:{simulationId}:{month}`** — nunca el id de una fila (no existe fila). Sirve de key de render y es idéntico entre lecturas del mismo mes; **no** es dirigible por ningún endpoint.
  - **Campos en `null` / vacíos por definición** (el simulado no tiene esos datos, RF-SIM-003): `occurredAt`, `timezone`, `paymentMethod`, `autoDebit`, `installment`, `frequency`, `startMonth`, `endMonth` y `calculated` en `null`; `hasCalculated: false` y `calculatedChildren: []` (no puede ser origen ni derivado de un calculado); `evolutionAvailable: false`. `skipped` es siempre `false` (no se anula). `currency` es la **default vigente** del usuario con `exchangeRate: 1`, y `amountCents == convertedAmountCents` = **magnitud** (el signo lo lleva el `type`, derivado del cálculo).
  - **El corte de tramo se resuelve server-side, por simulación.** Un mes pasado o fuera del tramo de esa simulación (RN-028) no trae su ítem simulado: el consumidor no filtra por mes ni recalcula el tramo para decidir qué mostrar. El **mes en curso sí** puede traer ítems —es el arranque efectivo mínimo de cualquier tramo— y cada ítem es el **remanente** ya neteado contra los únicos reales de ese mes (RN-028), no un monto a sumar aparte.
