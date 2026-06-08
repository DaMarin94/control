# Backend

## Stack

- **NestJS + TypeScript + PostgreSQL + Prisma**
- Puerto: `3001`
- JwtAuthGuard global — valida token y extrae `userId` para scopear todos los recursos

## Estructura y capas

Organización **por módulo/recurso**: un módulo NestJS por entidad.

```
backend/src/
├── movements/      (lista unificada del mes)
├── transactions/   (movimientos únicos)
├── recurring/      (fijos)
├── installments/   (cuotas)
├── categories/
├── users/
├── auth/
└── prisma/
```

### Capas dentro de cada módulo

- **Controller** — solo HTTP. Recibe la request, valida (DTOs), llama al service y devuelve. Cero lógica de negocio.
- **Service** — la lógica de negocio del recurso. Es la **API pública del módulo**: lo que otros módulos pueden llamar.
- **Repository** — encapsula todas las queries Prisma del recurso. El service nunca esparce queries crudas; siempre pasa por el repositorio.
- **DTOs** — definen el shape de entrada/salida de cada endpoint y su validación.

### Propiedad de dominio (cada módulo es dueño de lo suyo)

- **La lógica de un recurso vive únicamente en su módulo.** Guardar, editar o calcular un installment es responsabilidad exclusiva del módulo `installments`. Existe **un solo** método para cada operación, y vive en `InstallmentsService`.
- **Ningún módulo accede a los datos de otro por su cuenta.** Si un módulo necesita operar sobre installments, **llama a `InstallmentsService`** (la API pública del módulo). Nunca toca el repositorio ni la tabla de installments directamente, ni reimplementa esa lógica.
- **Una sola fuente de verdad por operación.** No se duplica la lógica de un recurso en otro módulo. Si la regla de guardado de un installment cambia, cambia en un solo lugar y todos los que lo usan quedan correctos automáticamente.
- **Regla de oro:** un módulo le habla a otro solo a través de su **Service**, nunca a través de su Repository ni de su tabla.

## Capa de datos (Prisma)

El acceso a la DB pasa por **Prisma 7**. `PrismaModule` es **global** y exporta `PrismaService` (integrado en `AppModule`); los services lo inyectan y los repositorios de cada módulo se construyen encima. El detalle de Prisma 7 (URL en `prisma.config.ts`, driver adapter obligatorio, carga de `.env`) está en `docs/technical.md`, sección Migraciones.

### Entidades

La fuente de verdad de tipos, campos y constraints es `backend/prisma/schema.prisma`. Acá se resume qué representa cada una y las decisiones de modelado, no el schema completo.

| Entidad | Representa |
|---------|-----------|
| `User` | Cuenta. Tiene `passwordHash` nullable (cuentas solo-Google no lo tienen) y `timezone` IANA "de casa". |
| `Category` | Clasificación de movimientos, por usuario. Soft delete. |
| `Transaction` | Movimiento único (gasto o ingreso en un instante). Hard delete. |
| `Recurring` | Movimiento fijo mensual (plantilla activa desde un mes). |
| `InstallmentGroup` | Grupo de cuotas. `amountCents` es el monto **por cuota**, no el total; `totalInstallments` es la cantidad. |

**Enums:** `MovementType` (`EXPENSE` | `INCOME`) y `CategoryScope` (`BOTH` | `EXPENSE` | `INCOME`).

### Decisiones de modelado (no obvias)

- **`onDelete`:**
  - `Cascade` en las FK `userId` — borrar un usuario borra todos sus movimientos y categorías.
  - `Restrict` en las FK `categoryId` — impide borrar físicamente una categoría mientras la referencien movimientos. Como las categorías usan soft delete, el caso no debería ocurrir; el `Restrict` es el último firewall a nivel DB.
- **Borrado por entidad:** `Transaction` es **hard delete** (sin `deletedAt`); `Category` es **soft delete** (`deletedAt`). `Recurring` no se borra físicamente: usa `deletedFrom` para dejar de aparecer desde un mes.
- **Fechas:** `Transaction.occurredAt` es `@db.Timestamptz` (UTC) + `timezone` IANA por registro (ver `docs/technical.md`, Fechas y zonas horarias). El resto de timestamps (`createdAt`, `updatedAt`) son de sistema.
- **Mes como `String "YYYY-MM"`:** `Recurring.startMonth` / `Recurring.deletedFrom` / `InstallmentGroup.startMonth`. Fijos y cuotas operan a nivel mes, sin día ni hora.
- **Montos en centavos (`Int`)** en todas las entidades de movimiento (RN-002). **IDs `cuid()`.**
- **Sin `@@unique([userId, name])` en `Category`** — la unicidad de nombre se valida en lógica de aplicación (comparación normalizada + flujo crear-o-reactivar). Ver `docs/data-model.md` y RN-014.
- **Índices:** `(userId, occurredAt)` en `Transaction` para la consulta de movimientos por mes; `userId` en `Category`, `Recurring` e `InstallmentGroup`.

### Migraciones y seed

- Aplicar con `prisma migrate deploy` (prod/CI) o `prisma migrate dev` (desarrollo). La migración inicial ya está aplicada.
- Seed de desarrollo: `pnpm db:seed` (solo desarrollo). Detalle en `docs/technical.md`.

## Módulos

| Módulo | Ruta base | Descripción |
|--------|-----------|-------------|
| `movements` | `GET /movements` | Lista unificada del mes (transacciones + recurrentes + cuotas) |
| `transactions` | `/transactions` | Movimientos únicos (CRUD) |
| `recurring` | `/recurring` | Movimientos fijos (crear, editar, eliminar) |
| `installments` | `/installments` | Grupos de cuotas (crear, editar, eliminar) |
| `categories` | `/categories` | Categorías (CRUD + soft delete) |
| `users` | — | Creación de cuenta + categorías por defecto |
| `auth` | — | JwtAuthGuard, extracción de userId del token |
| `prisma` | — | PrismaService |

## Endpoints

El formato de toda respuesta (sobre `{ success, statusCode, data | error }`) está definido en `docs/technical.md`. Los DTOs y shapes concretos se definen al implementar cada endpoint.

### `GET /movements?month=YYYY-MM`
Devuelve todos los movimientos del mes: transacciones únicas, recurrentes activos y cuotas que caen en el mes. Los recurrentes y cuotas se calculan on-the-fly — no hay filas generadas por instancia mensual.

### `POST /transactions` · `PATCH /transactions/:id` · `DELETE /transactions/:id`
CRUD de movimientos únicos. El monto siempre en centavos (entero > 0). El instante se guarda en UTC más la zona original del registro (ver fechas/timezone en `docs/technical.md`).

### `POST /recurring` · `PATCH /recurring/:id` · `DELETE /recurring/:id`
Gestión de movimientos fijos. El DELETE acepta `{ deleteFromCurrentMonth: boolean }` para controlar desde cuándo deja de aparecer el fijo.

### `POST /installments` · `PATCH /installments/:id` · `DELETE /installments/:id`
Gestión de grupos de cuotas. El PATCH edita el grupo completo (RF-MC-003). El DELETE elimina el grupo completo (todas las cuotas, pasadas y futuras).

### `GET /categories` · `POST /categories` · `PATCH /categories/:id` · `DELETE /categories/:id`
CRUD de categorías. El DELETE es soft delete (`deletedAt`). El GET excluye categorías eliminadas por defecto; acepta `?includeDeleted=true` para incluirlas.

## Reglas de negocio implementadas

<!-- Documentar reglas no obvias a medida que se implementen. -->
<!-- Ejemplo:
- El endpoint GET /movements filtra recurrentes donde startMonth <= mes consultado y (deletedFrom es null o deletedFrom > mes consultado)
-->
