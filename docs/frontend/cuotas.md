# Frontend — Movimientos en cuotas

Carga, edición y eliminación de grupos de cuotas. Se crean desde el tab **Cuotas** del modal de carga; editar y eliminar se cablean desde la Vista del mes. **Solo Gasto en v1.**

## `installment-form.tsx`

- Cubre el **tab Cuotas** (crear) y la **edición** del grupo. **Sin selector de tipo** — siempre Gasto (RF-MC-001). Campos: **monto por cuota** (no el total; en pesos), **cantidad de cuotas**, **mes de inicio** (`<input type="month">`, default mes actual o mes contexto), categoría (filtrada por scope, reusa `CATEGORIES_QUERY_KEY`) y descripción opcional. **Sin fecha ni hora.**
- **Gotcha:** el input de cantidad (`type="number"`) devuelve **string**; se parsea con `parseInt` en el schema Zod antes de validar.
- **Prefill de edición:** `totalInstallments` y `startMonth` salen de `MovementItem.installment`; el resto del ítem. `type` hardcodeado en `EXPENSE`.

## `delete-installment-dialog.tsx`

- Confirmación que **avisa que elimina el grupo completo** (todas las cuotas, pasadas y futuras), **sin opciones** (RF-MC-002).

## Datos (`use-installments`)

- Mutaciones `createInstallment`, `updateInstallment`, `deleteInstallment`.
- **Invalida toda la familia `["movements"]` por prefijo** (un grupo abarca varios meses).

> **Gotcha — `MovementItem.installment` es campo requerido del tipo.** En los `MovementItem` de únicos y fijos hay que poner `installment: null` explícito.
