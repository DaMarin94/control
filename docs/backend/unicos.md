# Backend — Movimientos únicos (TransactionsModule)

CRUD **scopeado por `userId` del JWT** (un usuario nunca ve ni toca movimientos de otro). Las respuestas exitosas devuelven el shape de Transaction con la **categoría embebida**. Shape en `docs/data-model/movimientos.md` §Contrato de movimiento único. El listado del mes no vive acá: es `GET /movements` (`docs/backend/movimientos-mes.md`).

## Endpoints

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `POST /transactions` | `{ type, amountCents, categoryId, occurredAt, timezone, description? }` | `201` · `data: Transaction` | `400` |
| `GET /transactions/:id` | — | `200` · `data: Transaction` | `404` |
| `PATCH /transactions/:id` | parcial (cualquier campo de POST) | `200` · `data: Transaction & { historyEntryId }` | `400` · `404` |
| `DELETE /transactions/:id` | — | `200` · `data: { historyEntryId }` | `404` |
| `POST /transactions/:id/skip` | — (sin body) | `200` · `data: { skipped }` | `404` |
| `POST /transactions/:id/calculated` | calculado desde el único `:id` | `201` · `data: Recurring` | `400` · `404` |
| `PATCH /transactions/:id/calculated` | edita el calculado de único `:id` | `200` · `data: Recurring` | `400` · `404` |

- **`POST /transactions`** — `amountCents` entero **en centavos** (`> 0`); `occurredAt` ISO 8601 en **UTC**; `timezone` IANA (ver `docs/technical.md` §Fechas y zonas horarias). `400` por validación de DTO o por categoría inválida (abajo).
- **`GET /transactions/:id`** — `404` si no existe o no es del usuario.
- **`PATCH /transactions/:id`** — body parcial. **Reaplica todas las validaciones** (RN-002 monto, RN-010 scope). `404` si no existe o no es del usuario.
- **`DELETE /transactions/:id`** — **borrado lógico** (`deletedAt`, RF-MU-003 / RF-HIST-006; reversible desde `/historial`). **`200` con `{ historyEntryId }`** (excepción a la convención de DELETE; ver `docs/backend/base.md` §Endpoints). `404` si no existe o no es del usuario. Si el único tiene calculados derivados (`sourceMovementId`), **cascada lógica** vía `RecurringService.cascadeSoftDeleteBySourceMovement` (`docs/backend/calculados.md` §Eliminación).
- **`POST /transactions/:id/skip` — toggle de anulación (RF-MU-005):** sin body; togglea `Transaction.skipped` y devuelve el nuevo valor. Sin alcance temporal (anula la fila entera). `404` si no existe o no es del usuario. Un único anulado **se sigue listando** en `GET /movements` con `skipped: true` pero **no suma** a totales ni reportes.
- **`POST|PATCH /transactions/:id/calculated`** — calculado de origen único; contrato en `docs/data-model/calculados.md`; mecánica en `docs/backend/calculados.md`.
- Método de pago y `autoDebit`: `docs/backend/metodos-pago.md` §Método y débito automático en movimientos.

## Validación de categoría (RN-010) — siempre 400, nunca 409

Se valida en **create y update**, vía `CategoryValidatorService` (`docs/backend/categorias.md`). El movimiento exige una categoría **propia, activa y con scope compatible**:

- **Scope (RN-010):** `EXPENSE` requiere scope `EXPENSE` o `BOTH`; `INCOME` requiere `INCOME` o `BOTH`.
- Categoría **inexistente, ajena, eliminada (soft delete) o con scope incompatible** → **`400 BadRequest`** (validación de input, **no `409`**).
- **No revela ajenidad:** categoría de otro usuario da el error **idéntico** a "inexistente".
