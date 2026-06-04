# Data Model

> Documento conceptual — describe qué entidades existen y las decisiones de negocio sobre cómo se almacenan los datos.
> Los tipos TypeScript, el schema de Prisma y los contratos de API se documentan cuando se implementen.

---

## Entidades

| Entidad | Descripción |
|---------|-------------|
| **Usuario** | Creado automáticamente al hacer login con Google. Todos los demás recursos le pertenecen. |
| **Categoría** | Clasifica los movimientos. Personalizable por usuario. Se elimina con soft delete. |
| **Movimiento único** | Gasto o ingreso que ocurrió una sola vez en una fecha específica. |
| **Movimiento fijo** | Plantilla recurrente mensual activa desde un mes de inicio hasta que el usuario la elimina. |
| **Grupo de cuotas** | Compra o cobro dividido en N pagos mensuales iguales desde un mes de inicio. |

---

## Decisiones de negocio sobre los datos

- **Montos en centavos.** Todos los montos se guardan como enteros en centavos (ej: $1.500 → `150000`). Sin decimales flotantes.
- **Soft delete en categorías.** Eliminar una categoría la marca como eliminada pero no borra el registro. Los movimientos históricos conservan la referencia.
- **Movimientos fijos: el pasado es inmutable.** Editar o eliminar un fijo no modifica los meses ya pasados. El fijo tiene un mes de inicio y opcionalmente un mes desde el cual deja de aparecer.
- **Moneda implícita en v1.** No hay campo de moneda. El modelo está diseñado para que se pueda agregar en el futuro sin romper datos existentes.
- **Aislamiento por usuario.** Todos los recursos (movimientos, categorías) pertenecen a un usuario y nunca son visibles para otro.
