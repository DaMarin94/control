# Data Model

> Documento conceptual — describe qué entidades existen y las decisiones de negocio sobre cómo se almacenan los datos.
> El schema de Prisma ya está **implementado** en `backend/prisma/schema.prisma` (fuente de verdad para tipos, campos y constraints); las decisiones de modelado a nivel DB están en `docs/backend.md`, sección Capa de datos. Los tipos TypeScript y los contratos de API se documentan cuando se implementen.

---

## Entidades

| Entidad | Descripción |
|---------|-------------|
| **Usuario** | Puede autenticarse por **Google** o por **email + contraseña** (dos métodos que coexisten en v1). El email identifica al usuario. Las cuentas con email + contraseña almacenan un hash de la contraseña (`passwordHash`); las cuentas creadas solo con Google pueden no tener contraseña. Se crea al hacer login con Google por primera vez o al registrarse con email + contraseña. Todos los demás recursos le pertenecen. Tiene un campo `timezone` (zona horaria default / "de casa"). |
| **Categoría** | Clasifica los movimientos. Personalizable por usuario. Tiene un color asignado automáticamente desde un pool fijo de colores predefinidos (no editable por el usuario en v1). Se elimina con soft delete. |
| **Movimiento único** | Gasto o ingreso que ocurrió una sola vez en un instante específico (fecha y hora). Se guarda como timestamp UTC (`occurredAt`) más la zona horaria original del registro (`timezone`, nombre IANA). No es solo una fecha de calendario. |
| **Movimiento fijo** | Plantilla recurrente mensual activa desde un mes de inicio hasta que el usuario la elimina. |
| **Grupo de cuotas** | Compra o cobro dividido en N pagos mensuales iguales desde un mes de inicio. |

---

## Decisiones de negocio sobre los datos

- **Montos en centavos.** Todos los montos se guardan como enteros en centavos (ej: $1.500 → `150000`). Sin decimales flotantes.
- **Soft delete en categorías.** Eliminar una categoría la marca como eliminada (`deletedAt`) pero no borra el registro. Los movimientos históricos conservan la referencia y siguen sumando en los totales del mes (el soft delete no excluye movimientos de los cálculos). Una categoría eliminada puede **reactivarse**: al crear una categoría cuyo nombre normalizado colisiona con una eliminada, el sistema propone reactivar la original en lugar de duplicarla (mismo `id`, scope y color); ver `requirements.md`, RF-CAT-002 / RF-CAT-004.
- **Unicidad de nombre de categoría: app-level, no DB.** La unicidad de nombre entre categorías **activas** de un mismo usuario se valida en lógica de aplicación, no con un constraint `@@unique` de Prisma/DB. Motivo: la comparación es **normalizada** (trim + insensible a mayúsculas y acentos) y el flujo "crear-o-reactivar" frente a una categoría soft-deleted homónima no caben en un constraint de base de datos.
- **Color de categoría asignado automáticamente.** Cada categoría tiene un color tomado de un **pool fijo de colores predefinidos**. El sistema lo asigna al crear la categoría (incluidas las categorías por defecto de la cuenta nueva); el usuario **no** elige ni edita el color en v1, ni al crear ni al editar. El color es solo presentación (identificar visualmente la categoría en la UI) y no afecta el cálculo de montos ni el scope.
- **Movimientos fijos: el pasado es inmutable.** Editar o eliminar un fijo no modifica los meses ya pasados. El fijo tiene un mes de inicio y opcionalmente un mes desde el cual deja de aparecer.
- **Moneda implícita en v1.** No hay campo de moneda. El modelo está diseñado para que se pueda agregar en el futuro sin romper datos existentes.
- **Aislamiento por usuario.** Todos los recursos (movimientos, categorías) pertenecen a un usuario y nunca son visibles para otro.
- **Contraseñas hasheadas.** Las cuentas con email + contraseña guardan únicamente un hash de la contraseña (`passwordHash`, bcrypt/argon2), nunca el texto plano. El hash y la verificación viven en el backend. Las cuentas creadas solo con Google pueden no tener `passwordHash`. El caso de account linking (mismo email por ambos métodos) queda **pendiente sin resolver en v1** (ver `requirements.md`, sección 6).
- **Fechas y zonas horarias (movimiento único).** El movimiento único es un instante (fecha y hora), no una fecha de calendario. Se almacena como timestamp en UTC (`occurredAt`) junto con la zona horaria original del registro (`timezone`, nombre IANA, ej. `America/Argentina/Buenos_Aires`). Se muestra siempre en esa zona original, aunque el usuario después cambie de zona o viaje. El mes al que pertenece se determina en la zona del propio registro. El Usuario tiene un campo `timezone` (zona default / "de casa") que se usa para calcular "hoy" / "mes actual" al crear movimientos y en el dashboard. Los movimientos fijos y las cuotas no aplican esto: operan a nivel mes, sin día ni hora. Ver `docs/technical.md` (sección "Fechas y zonas horarias") para el detalle técnico.

---

## Contrato de autenticación (auth / JWT)

Los tres endpoints de auth (`/auth/register`, `/auth/login`, `/auth/google`) devuelven, dentro del sobre `{ success, statusCode, data }`, el mismo shape en `data`:

```
AuthResponse = {
  accessToken: string,
  user: {
    id: string,
    email: string,
    name: string | null,
    image: string | null
  }
}
```

- **`accessToken`** es el JWT que **emite NestJS** (HS256). Sus claims son: `sub` (el `userId`, cuid del usuario), `iat` y `exp` (expira a los **30 días**). El frontend lo trata como **opaco**: lo guarda y lo reenvía como `Authorization: Bearer`, no lo decodifica.
- **Dos tokens distintos.** El `accessToken` (JWT de NestJS) viaja **dentro** de la sesión de Auth.js, que es un **JWE separado** encriptado por NextAuth. No confundirlos: el backend solo valida el JWT de NestJS; nunca ve el JWE de Auth.js. Detalle del flujo en `docs/architecture.md`.

---

## Contrato de categoría (respuesta de la API)

Toda respuesta exitosa de los endpoints de categorías devuelve, dentro del sobre `{ success, statusCode, data }`, este shape:

```
Categoria = {
  id: string,
  userId: string,
  name: string,                          // tal cual lo tipeó el usuario
  scope: "BOTH" | "EXPENSE" | "INCOME",
  color: string,                         // "#hex" del pool, no editable
  deletedAt: null,                       // las respuestas solo traen activas
  createdAt: string,
  updatedAt: string,
  movementCount: number
}
```

- **`movementCount` — derivado de solo lectura.** Es la suma de las **tres relaciones de movimiento** que referencian la categoría: movimientos únicos + fijos + grupos de cuotas. No es un campo almacenado ni editable; el backend lo calcula al responder. Cero si la categoría no tiene movimientos. Alimenta el contador "N movimientos" de la pantalla de categorías (RF-CAT-006) y **no** se confunde con los totales de dinero del mes (ver `requirements.md`, RF-VM-002).

### Payload reactivable en errores (409)

Cuando se intenta crear una categoría cuyo nombre normalizado colisiona con una **eliminada** (RF-CAT-002, A3), el backend responde `409` y adjunta, dentro del sobre de error, un `data` estructurado:

```
error.data = {
  reactivable: true,
  category: { id, name, scope, color }
}
```

- Es el **único** caso en que el sobre de error lleva `data`; el resto de los errores no lo incluyen. El front usa `category.id` para ofrecer reactivar (`POST /categories/:id/reactivate`) sin un endpoint extra de búsqueda. La colisión con una categoría **activa** (RN-008) responde `409` **sin** `data`.

### Pool de colores (dato del dominio)

El color de categoría sale de un **pool fijo de 10 colores** predefinidos, único en el backend. El sistema asigna el **menos usado** entre las categorías activas del usuario al crear cada categoría (en empate, el primero del pool); las 4 por defecto toman los primeros 4 en orden. El color **no es editable** por el usuario (ni al crear ni al editar) y es solo presentación. Detalle de los 10 valores y la estrategia en `docs/backend.md`, sección Pool de colores.

---

## Contrato de movimiento único (respuesta de la API)

Toda respuesta exitosa de los endpoints de movimientos únicos devuelve, dentro del sobre `{ success, statusCode, data }`, este shape (el modelo Prisma ya está documentado en `docs/backend.md`, sección Capa de datos):

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
  category: { id, name, color, scope }       // categoría embebida
}
```

- **`amountCents` — entero en centavos** (RN-002): el front recibe centavos y formatea a pesos para mostrar.
- **`occurredAt` + `timezone` — instante, no fecha de calendario** (RN-004): `occurredAt` es el momento en UTC y `timezone` (IANA) es la zona original del registro, en la que siempre se muestra. El mes al que pertenece se determina en esa zona. Detalle técnico en `docs/technical.md` (Fechas y zonas horarias).
- **Categoría embebida.** Cada movimiento trae `category: { id, name, color, scope }` — el front no necesita un GET extra de categorías para mostrar nombre y color.
