# Backend — Movimientos en cuotas (InstallmentsModule)

Gestión de grupos de cuotas, **scopeada por `userId` del JWT**. El módulo expone **crear, editar, eliminar y anular**; el listado del mes lo arma `MovementsModule` (`docs/backend/movimientos-mes.md` §Integración de cuotas). **No existe `GET /installments/:id`**: el front prefilea la edición desde el `MovementItem` de `/movements`.

## Endpoints

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `POST /installments` | `{ type, amountCents, totalInstallments, startMonth, categoryId, description? }` | `201` · `data: InstallmentGroup` | `400` |
| `PATCH /installments/:id` | `{ type?, amountCents?, totalInstallments?, startMonth?, categoryId?, description? }` | `200` · `data: InstallmentGroup & { historyEntryId }` | `400` · `404` |
| `DELETE /installments/:id` | — | `200` · `data: { historyEntryId }` | `404` |
| `POST /installments/:id/skip` | `{ month }` (`YYYY-MM`) | `200` · `data: { skipped, month }` | `400` · `404` |
| `POST /installments/:id/calculated` | calculado desde el grupo `:id` | `201` · `data: Recurring` | `400` · `404` |
| `PATCH /installments/:id/calculated` | edita el calculado de cuota `:id` | `200` · `data: Recurring` | `400` · `404` |

- **Solo `EXPENSE` en v1:** rechaza `INCOME` con `400` (ingreso en cuotas fuera de alcance v1: RF-MC-001, `docs/requirements/definiciones-y-alcance.md` §6). `amountCents` es el monto **por cuota** (entero `> 0`, RN-002), no el total. `totalInstallments` entero `> 0`. `startMonth` `YYYY-MM`.
- **`PATCH /installments/:id` — edita el grupo completo in-place (RF-MC-003).** Editables: monto por cuota, cantidad, mes de inicio, categoría, descripción. **El `type` no se edita.** **Sin split ni inmutabilidad del pasado** (a diferencia de los fijos): aplica a todas las instancias. `404` si no existe o no es del usuario.
- **`DELETE /installments/:id` — borrado lógico del grupo entero.** `deletedAt` en el grupo: dejan de aparecer **todas** las cuotas en un paso (`InstallmentGroup` no tiene `deletedFrom`). Reversible desde `/historial` (RF-HIST-003). **`200` con `{ historyEntryId }`** (excepción a la convención de DELETE; `docs/backend/base.md` §Endpoints). `404` si no existe o no es del usuario. Calculados derivados (`sourceInstallmentGroupId`) → **cascada lógica** vía `RecurringService.cascadeSoftDeleteBySourceInstallmentGroup` (`docs/backend/calculados.md` §Eliminación).
- **`POST /installments/:id/skip` — toggle de una instancia mensual (RF-MC-004):** toggle sobre `InstallmentSkip(installmentGroupId, month)`: si existe lo borra (`skipped: false`), si no lo crea (`skipped: true`). Solo esa instancia. `404` si el grupo no existe o no es del usuario; `400` si `month` no cumple `YYYY-MM`. Una cuota anulada **se sigue listando** con `skipped: true` pero **no suma** a totales ni reportes (salvo el gantt: `docs/backend/graficos.md` §Reporte anual de Cuotas).
- **`POST|PATCH /installments/:id/calculated`** — calculado de origen cuota (deriva del **monto por cuota**); contrato en `docs/data-model/calculados.md` §Contrato de movimientos calculados; mecánica en `docs/backend/calculados.md`.
- **Validación de categoría:** idéntica a únicos y fijos (`docs/backend/unicos.md` §Validación de categoría), vía `CategoryValidatorService`.
- Método de pago y `autoDebit`: `docs/backend/metodos-pago.md` §Método y débito automático en movimientos.
