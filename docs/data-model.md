# Data Model

> Documento conceptual — describe qué entidades existen y las decisiones de negocio sobre cómo se almacenan los datos.
> Los tipos TypeScript, el schema de Prisma y los contratos de API se documentan cuando se implementen.

---

## Entidades

| Entidad | Descripción |
|---------|-------------|
| **Usuario** | Puede autenticarse por **Google** o por **email + contraseña** (dos métodos que coexisten en v1). El email identifica al usuario. Las cuentas con email + contraseña almacenan un hash de la contraseña (`passwordHash`); las cuentas creadas solo con Google pueden no tener contraseña. Se crea al hacer login con Google por primera vez o al registrarse con email + contraseña. Todos los demás recursos le pertenecen. Tiene un campo `timezone` (zona horaria default / "de casa"). |
| **Categoría** | Clasifica los movimientos. Personalizable por usuario. Se elimina con soft delete. |
| **Movimiento único** | Gasto o ingreso que ocurrió una sola vez en un instante específico (fecha y hora). Se guarda como timestamp UTC (`occurredAt`) más la zona horaria original del registro (`timezone`, nombre IANA). No es solo una fecha de calendario. |
| **Movimiento fijo** | Plantilla recurrente mensual activa desde un mes de inicio hasta que el usuario la elimina. |
| **Grupo de cuotas** | Compra o cobro dividido en N pagos mensuales iguales desde un mes de inicio. |

---

## Decisiones de negocio sobre los datos

- **Montos en centavos.** Todos los montos se guardan como enteros en centavos (ej: $1.500 → `150000`). Sin decimales flotantes.
- **Soft delete en categorías.** Eliminar una categoría la marca como eliminada pero no borra el registro. Los movimientos históricos conservan la referencia.
- **Movimientos fijos: el pasado es inmutable.** Editar o eliminar un fijo no modifica los meses ya pasados. El fijo tiene un mes de inicio y opcionalmente un mes desde el cual deja de aparecer.
- **Moneda implícita en v1.** No hay campo de moneda. El modelo está diseñado para que se pueda agregar en el futuro sin romper datos existentes.
- **Aislamiento por usuario.** Todos los recursos (movimientos, categorías) pertenecen a un usuario y nunca son visibles para otro.
- **Contraseñas hasheadas.** Las cuentas con email + contraseña guardan únicamente un hash de la contraseña (`passwordHash`, bcrypt/argon2), nunca el texto plano. El hash y la verificación viven en el backend. Las cuentas creadas solo con Google pueden no tener `passwordHash`. El caso de account linking (mismo email por ambos métodos) queda **pendiente sin resolver en v1** (ver `requirements.md`, sección 6).
- **Fechas y zonas horarias (movimiento único).** El movimiento único es un instante (fecha y hora), no una fecha de calendario. Se almacena como timestamp en UTC (`occurredAt`) junto con la zona horaria original del registro (`timezone`, nombre IANA, ej. `America/Argentina/Buenos_Aires`). Se muestra siempre en esa zona original, aunque el usuario después cambie de zona o viaje. El mes al que pertenece se determina en la zona del propio registro. El Usuario tiene un campo `timezone` (zona default / "de casa") que se usa para calcular "hoy" / "mes actual" al crear movimientos y en el dashboard. Los movimientos fijos y las cuotas no aplican esto: operan a nivel mes, sin día ni hora. Ver `docs/technical.md` (sección "Fechas y zonas horarias") para el detalle técnico.
