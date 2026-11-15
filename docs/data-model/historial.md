# Historial de cambios (`HistoryEntry` + `GET /history` · `POST /history/:id/undo`)

> Parte del modelo de datos de Control. Índice: `docs/data-model.md`. Destino canónico del modelo y del contrato de API del historial. Reglas funcionales en el módulo 3.14 (`docs/requirements/historial.md`, RF-HIST-001..007) y RN-024/025/026; mecánica de captura, undo y purga en `docs/backend/historial.md`.

### Modelo — `HistoryEntry`

```
HistoryEntry = {
  id, userId,
  targetKind: "UNICO" | "FIJO" | "CUOTA",    // enum HistoryTargetKind
  targetId:   string,                        // clave estable del objetivo (ver abajo)
  action:     "EDIT" | "DELETE" | "REOPEN",  // enum HistoryAction
  snapshot:   Json,                          // estado PREVIO completo del objetivo
  createdAt:  DateTime
}
```

- **`targetId` es la clave estable de agrupación por objetivo (RN-024)**, no el id de la fila mutada: `UNICO` → `Transaction.id`; `FIJO` → **`Recurring.chainId`**; `CUOTA` → `InstallmentGroup.id`. En fijos y calculados **tiene que ser el `chainId`**: el split de edición (RN-005) crea una fila nueva y cambia el id de fila, así que agrupar por `Recurring.id` partiría la pila LIFO de un mismo fijo lógico en varias pilas inconexas. El `chainId` sobrevive al split.
- **`REOPEN`** — entradas de reapertura de fijos (RF-MF-008).
- **`snapshot` no está tipado en Prisma** (`Json`): cada combinación `targetKind × action` tiene una forma distinta. El contrato de aplicación —el shape de cada variante— vive en `backend/src/history/history.types.ts`, que es su destino canónico; lo escriben los services de dominio al capturar y lo lee `HistoryService` para armar el diff y para deshacer.
- **`userId` con `onDelete: Cascade`:** borrar la cuenta borra su historial.
- **Índices** (los tres sostienen operaciones distintas, ninguno es redundante):
  - `(userId, createdAt)` — listar el historial del usuario en orden cronológico descendente (`GET /history`).
  - `(userId, targetKind, targetId, createdAt)` — resolver el **stack LIFO de un movimiento**: el bloqueo de RF-HIST-004, el undo en cadena y la retención por cantidad (5 por movimiento).
  - `(createdAt)` — **barrido por antigüedad** para la purga de los 31 días, transversal a todos los usuarios.

### `GET /history`

Sin params. Devuelve, dentro del sobre `{ success, statusCode, data }`, el array de entradas **vigentes** del usuario autenticado, la más reciente primero.

```
HistoryEntryDto = {
  id: string,
  targetKind: "UNICO" | "FIJO" | "CUOTA",
  targetId: string,                          // clave estable del objetivo (RN-024)
  action: "EDIT" | "DELETE" | "REOPEN",
  createdAt: string,                         // ISO 8601 — momento del cambio
  description: string | null,                // identidad del movimiento al momento de la entrada
  category: { id, name, color, scope } | null,
  type: "EXPENSE" | "INCOME",
  amount: { amountCents, currency, type } | null,   // null en calculados
  isCalculated: boolean,
  changes: HistoryChange[],                  // bloque "Qué cambió", en orden fijo
  canUndo: boolean,                          // false = entrada bloqueada (RF-HIST-004)
  blockingCount: number,                     // entradas posteriores del mismo movimiento que la bloquean
  reopen: ReopenInfo | null                  // null salvo action === "REOPEN"
}

ReopenInfo = {
  endMonth: string,                          // fin previo E ("YYYY-MM" exclusivo)
  reopenMonth: string,                       // X
  skippedCount: number,                      // anulaciones de relleno CREADAS en el origen (no suma las de los espejos)
  skippedFrom: string | null,                // primera / última de esas anulaciones; null si skippedCount === 0
  skippedTo: string | null,
  reopenedCalculated: Array<{ chainId: string, description: string }>   // espejos reabiertos
}

HistoryChange = {
  field: HistoryFieldId,
  previous: <valor según field>,
  next?: <valor según field>                 // AUSENTE en entradas de eliminación
}
```

- **`targetKind` mapea a la TABLA de almacenamiento, no al tipo conceptual del movimiento.** `UNICO` → `Transaction`, `FIJO` → `Recurring`, `CUOTA` → `InstallmentGroup`. Como un **calculado** se persiste siempre como fila `Recurring` —sea su origen un fijo, un único o una cuota—, su `targetKind` es **`FIJO` siempre**. Por eso existe **`isCalculated`** como flag aparte: es información adicional sobre la fila, **no reemplaza** al `targetKind`. `isCalculated: true` solo puede darse con `targetKind: "FIJO"`.
- **`amount` es `null` en calculados.** El monto de un calculado **es su fórmula** (no persiste una cifra propia; se deriva al vuelo del origen): la identidad del movimiento en la entrada se lee del cambio con `field: "formula"`, no de `amount`.
- **`canUndo` / `blockingCount` implementan RF-HIST-004.** `canUndo: false` con `blockingCount: N` = hay N entradas posteriores del **mismo `targetId`** que hay que deshacer antes. La entrada bloqueada **igual se lista** y su acción es operable (dispara el undo en cadena, ver abajo).
- **Entradas `REOPEN` (RF-MF-008):** `targetKind: "FIJO"`, `targetId` = `chainId` del origen (los espejos no tienen entrada propia). `changes` es un **diff** (`next` presente) con el set de edición del fijo normal: solo los campos que cambiaron al reabrir —monto y, si hubo reemplazo, categoría, método de pago y débito automático—; puede venir **vacío** (reapertura con el mismo monto y sin reemplazos). El fin anterior, X, el relleno y los espejos viajan en `reopen`, no en `changes`.
- **Solo entradas vigentes.** Las purgadas por retención (RF-HIST-005) no se devuelven; la lectura además dispara la purga (ver `docs/backend/historial.md` §Retención y purga).

### Campos del bloque "Qué cambió" — set cerrado de 12

`HistoryFieldId` es un set **cerrado** de 12 identificadores, con **orden de presentación fijo** (el mismo para toda la pantalla). El backend emite las filas ordenadas; el frontend no reordena ni completa el set.

| Orden | `field` | Shape del valor (`previous` / `next`) |
|---|---|---|
| 1 | `amount` | `{ amountCents: number, currency: Currency, type: MovementType }` |
| 2 | `formula` | `{ operator: "ADD"\|"SUB"\|"MUL"\|"DIV"\|"PCT", operand: number, sign: 1 \| -1, currency: Currency }` — operando **escalado** (ver `calculados.md`, §Escalado del operando) |
| 3 | `currency` | `"ARS" \| "USD" \| "EUR" \| "BRL"` |
| 4 | `exchangeRate` | `number` |
| 5 | `type` | `"EXPENSE" \| "INCOME"` |
| 6 | `category` | `{ id: string, name: string, color: string }` |
| 7 | `description` | `string \| null` |
| 8 | `date` | `{ occurredAt: string (ISO 8601), timezone: string (IANA) }` — instante + zona, juntos |
| 9 | `startMonth` | `string` `"YYYY-MM"` |
| 10 | `installments` | `number` (cantidad total de cuotas del grupo) |
| 11 | `paymentMethod` | `{ id: string, name: string } \| null` |
| 12 | `autoDebit` | `boolean` |

- **Qué campos aparecen depende del `targetKind`, de `isCalculated` y de la `action`.** En una **edición** solo viajan los campos realmente editables de ese tipo de movimiento y que efectivamente cambiaron; en una **eliminación** viaja el **estado** del movimiento tal como estaba, que es un set más amplio (incluye campos no editables que hacen a su identidad, como el `startMonth` de un fijo). El mapeo completo de aplicabilidad vive en `backend/src/history/history.service.ts`.
- **`formula` reemplaza a `amount` en calculados**, por el mismo motivo por el que `amount` viene `null` a nivel entrada.
- **`formula.currency` es la moneda del ORIGEN del calculado**, resuelta por `sourceChainId` (origen fijo), `sourceMovementId` (origen único) o `sourceInstallmentGroupId` (origen grupo de cuotas). **No** sale de la fila del calculado: sus columnas de moneda son placeholders (ver `calculados.md`, §Columnas placeholder de un calculado). Da el símbolo con el que se formatea el operando **solo en `ADD` y `SUB`**, los únicos operadores donde el operando es un monto; en `MUL`, `DIV` y `PCT` el operando es un factor/porcentaje y se formatea como número plano, sin símbolo. La `currency` viaja igual en los cinco operadores.
- **Si el origen no se puede resolver, el backend omite el campo `formula` entero del diff** (no lo emite) en vez de mandar un default. Para el consumidor: **si llega `formula`, su `currency` es confiable** — no corresponde ningún fallback del lado del cliente.

### Gotcha — la ausencia de `next` es el discriminador, no `next === null`

En una entrada de **eliminación** el bloque "Qué cambió" opera en **modo de valor único**: cada `HistoryChange` trae `previous` y **omite la propiedad `next`** (está **ausente**, no en `null`). En una entrada de **edición** o de **reapertura**, `next` siempre está presente.

**El consumidor debe discriminar con `'next' in change`, nunca con `next === null` ni `next === undefined`:** `description` y `paymentMethod` tienen `null` como **valor legítimo** (movimiento sin descripción / sin método de pago), así que un chequeo por `null` leería "se borró la descripción" como "esto es una eliminación", y viceversa.

### `POST /history/:id/undo`

| Endpoint | Body | Éxito | Errores |
|---|---|---|---|
| `POST /history/:id/undo` | — | `200` · `data: { undone: true }` | `404` (no existe o es de otro usuario) |

- **Un solo endpoint para el undo simple y el undo en cadena.** Deshacer una entrada bloqueada deshace **también** todas las entradas posteriores de ese mismo `targetId`, de la más reciente a la más antigua, en la misma operación (RF-HIST-004). No hay flag ni endpoint aparte: el backend resuelve la cadena a partir del `id` recibido.
- **Todo o nada.** La cadena completa se aplica en una sola transacción de DB: o se deshace todo, o no se deshace nada.
- **Deshacer borra las entradas y no crea ninguna** (RF-HIST-003): la operación no deja rastro. El consumidor debe invalidar el historial **y** los datos de movimientos (el undo muta movimientos reales).

### `historyEntryId` — id de la entrada en las respuestas de edición, eliminación y reapertura

Todo endpoint que **edita**, **elimina** o **reabre** un movimiento devuelve el **id de la entrada de historial que esa operación generó**. Es lo que habilita deshacer sin consultar `GET /history`: el id se le pasa directo a `POST /history/:id/undo` (RF-HIST-007).

| Endpoint | Éxito |
|---|---|
| `PATCH /transactions/:id` | `200` · `data: Transaction & { historyEntryId }` |
| `PATCH /recurring/:id` | `200` · `data: Recurring & { historyEntryId }` |
| `PATCH /recurring/:id/calculated` | `200` · `data: Recurring & { historyEntryId }` |
| `PATCH /transactions/:id/calculated` | `200` · `data: Recurring & { historyEntryId }` |
| `PATCH /installments/:id/calculated` | `200` · `data: Recurring & { historyEntryId }` |
| `PATCH /installments/:id` | `200` · `data: InstallmentGroup & { historyEntryId }` |
| `DELETE /transactions/:id` | `200` · `data: { historyEntryId }` |
| `DELETE /recurring/:id` | `200` · `data: { historyEntryId }` |
| `DELETE /installments/:id` | `200` · `data: { historyEntryId }` |
| `POST /recurring/:id/reopen` | `200` · `data: ReopenResult` (incluye `historyEntryId`; ver `reapertura.md`) |

- **En los `PATCH` el merge es plano:** `historyEntryId` es una propiedad más al lado de los campos de la entidad, no un objeto anidado ni un sobre extra.
- **Los `DELETE` de movimientos responden `200` con cuerpo, no `204`:** un `204 No Content` **no puede llevar body por spec HTTP**, y la respuesta tiene que traer el id de la entrada. Son la excepción a la convención de DELETE del backend (ver `docs/backend/base.md` §DELETE → `204 No Content`).
- **Los `POST` de creación no lo devuelven:** crear no genera entrada de historial (RF-HIST-001).
