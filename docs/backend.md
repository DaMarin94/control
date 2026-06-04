# Backend

## Stack

- **NestJS + TypeScript + PostgreSQL + Prisma**
- Puerto: `3001`
- JwtAuthGuard global — valida token y extrae `userId` para scopear todos los recursos

## Módulos

| Módulo | Ruta base | Descripción |
|--------|-----------|-------------|
| `movements` | `GET /movements` | Lista unificada del mes (transacciones + recurrentes + cuotas) |
| `transactions` | `/transactions` | Movimientos únicos (CRUD) |
| `recurring` | `/recurring` | Movimientos fijos (crear, editar, eliminar) |
| `installments` | `/installments` | Grupos de cuotas (crear, eliminar) |
| `categories` | `/categories` | Categorías (CRUD + soft delete) |
| `users` | — | Creación de cuenta + categorías por defecto |
| `auth` | — | JwtAuthGuard, extracción de userId del token |
| `prisma` | — | PrismaService |

## Endpoints

Ver contratos completos de request/response (DTOs, shapes) en `docs/data-model.md`.

### `GET /movements?month=YYYY-MM`
Devuelve todos los movimientos del mes: transacciones únicas, recurrentes activos y cuotas que caen en el mes. Los recurrentes y cuotas se calculan on-the-fly — no hay filas generadas por instancia mensual.

### `POST /transactions` · `PATCH /transactions/:id` · `DELETE /transactions/:id`
CRUD de movimientos únicos. El monto siempre en centavos (entero > 0).

### `POST /recurring` · `PATCH /recurring/:id` · `DELETE /recurring/:id`
Gestión de movimientos fijos. El DELETE acepta `{ deleteFromCurrentMonth: boolean }` para controlar desde cuándo deja de aparecer el fijo.

### `POST /installments` · `DELETE /installments/:id`
Gestión de grupos de cuotas. El DELETE elimina el grupo completo (todas las cuotas, pasadas y futuras).

### `GET /categories` · `POST /categories` · `PATCH /categories/:id` · `DELETE /categories/:id`
CRUD de categorías. El DELETE es soft delete (`deletedAt`). El GET excluye categorías eliminadas por defecto; acepta `?includeDeleted=true` para incluirlas.

## Reglas de negocio implementadas

<!-- Documentar reglas no obvias a medida que se implementen. -->
<!-- Ejemplo:
- El endpoint GET /movements filtra recurrentes donde startMonth <= mes consultado y (deletedFrom es null o deletedFrom > mes consultado)
-->
