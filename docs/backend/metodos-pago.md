# Backend — Métodos de pago (PaymentMethodsModule)

CRUD **scopeado por `userId` del JWT**. Las respuestas exitosas devuelven el shape de método de pago. Shape, campos condicionales y `movementCount` en `docs/data-model/metodos-pago.md` §Métodos de pago.

## Endpoints

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `GET /payment-methods` | — | `200` · `data: PaymentMethod[]` | — |
| `POST /payment-methods` | `{ name, type, icon?, closingDay?, paymentDay? }` | `201` · `data: PaymentMethod` | `400` · `409` (dos casos) |
| `POST /payment-methods/:id/reactivate` | — (ignora el body) | `200` · `data: PaymentMethod` | `404` · `409` |
| `PATCH /payment-methods/:id` | `{ name?, type?, icon?, closingDay?, paymentDay? }` | `200` · `data: PaymentMethod` | `400` · `404` · `409` |
| `DELETE /payment-methods/:id` | — | `204 No Content` | `404` |

- **`GET /payment-methods`** — solo activos, por **nombre ascendente**, cada uno con `movementCount`.
- **`POST /payment-methods`** — `name` obligatorio y no vacío; `type` obligatorio (allowlist, sin default); `icon` opcional (fallback silencioso a `card`). Dos casos de `409`, análogos a categorías:
  - **Colisión con un activo** (RN-021): `error.message`, **sin** `error.data`.
  - **Colisión con uno eliminado / reactivable** (RF-PM-001 A4): `error.data = { reactivable: true, paymentMethod: { id, name, type, icon } }` (`ReactivableConflictException`, ver `docs/backend/categorias.md`).
  - `400`: nombre vacío o faltante, `type` fuera de la allowlist, o `closingDay`/`paymentDay` fuera de 1-31.
- **`POST /payment-methods/:id/reactivate`** — vuelve **exactamente como estaba** (lo tipeado en el form se ignora). `404` si no existe o no es del usuario; `409` si ya está activo.
- **`PATCH /payment-methods/:id`** — todo opcional. **Al cambiar `type` se descartan los campos condicionales que no aplican** (pasar a `DEBIT` o `CASH` limpia `closingDay`/`paymentDay`). `409` si el nombre colisiona con otro activo. `404` si no existe, no es del usuario o está eliminado.
- **`DELETE /payment-methods/:id`** — soft delete. **`204` sin cuerpo. No es idempotente**: uno ya eliminado devuelve `404`.

## Campos condicionales por tipo

`closingDay`/`paymentDay` solo aplican a `CREDIT`; `DEBIT` y `CASH` no tienen condicionales. Los que no corresponden al `type` se descartan y se persisten `null`. Los días son **1-31 e informativos**: el clamp al último día del mes es del **consumo/display**, no mueve imputación (RN-021). El **débito automático** no es campo del método sino del movimiento (abajo).

## Allowlists en código (`payment-method-constants.ts`)

`type` (`CREDIT`/`DEBIT`/`CASH`) e `icon` (set curado de **12 claves**, default/fallback **`card`**) **no son enums de Prisma**: strings validados contra allowlist en `backend/src/payment-methods/payment-method-constants.ts` (mismo criterio que `CurrencyQuote.variant`, extensible sin migración).

- **Diferencia con el color de categorías:** un `icon` fuera del set **no rechaza con `400`** — cae **silenciosamente a `card`** (`normalizePaymentMethodIcon`). Un `type` fuera de la allowlist **sí** es `400`.
- La allowlist de íconos se **duplica back/front** y se mantiene en sync (`docs/frontend/metodos-pago.md` §Allowlist de íconos).

## Método y débito automático en movimientos + herencia del calculado

`GET /movements` embebe `paymentMethod: { id, name, icon, type, closingDay, paymentDay } | null` en cada ítem y expone `autoDebit: boolean | null` **a nivel del ítem**. `closingDay`/`paymentDay` se pueblan **solo para `CREDIT`** y alimentan la sublínea de crédito de la card de detalle (RF-VM-007). El **calculado hereda método y `autoDebit` de su origen**: se **derivan al vuelo**, nunca persiste unos propios (mismo tratamiento que `currency`/`exchangeRate`). Contrato en `docs/data-model/movimientos.md` §Contrato de movimientos del mes.

**`autoDebit` es campo del movimiento** (RN-021): columna `autoDebit Boolean?` en `Transaction`, `Recurring` e `InstallmentGroup`. Los `POST`/`PATCH` de transactions / recurring / installments aceptan `autoDebit?: boolean` (el **calculado no**). **Regla de persistencia** — `resolveAutoDebit` (`PaymentMethodValidatorService`): solo se guarda `true`/`false` si el **método efectivo es `DEBIT`**; sin método o con `CREDIT`/`CASH` se fuerza `null` aunque el body pida `true`.
