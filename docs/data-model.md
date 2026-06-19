# Data Model

> Documento conceptual — describe qué entidades existen y las decisiones de negocio sobre cómo se almacenan los datos.
> El schema de Prisma ya está **implementado** en `backend/prisma/schema.prisma` (fuente de verdad para tipos, campos y constraints); las decisiones de modelado a nivel DB están en `docs/backend.md`, sección Capa de datos. Los tipos TypeScript y los contratos de API se documentan cuando se implementen.

---

## Entidades

| Entidad | Descripción |
|---------|-------------|
| **Usuario** | Puede autenticarse por **Google** o por **email + contraseña** (dos métodos que coexisten en v1). El email identifica al usuario. Las cuentas con email + contraseña almacenan un hash de la contraseña (`passwordHash`); las cuentas creadas solo con Google pueden no tener contraseña. Se crea al hacer login con Google por primera vez o al registrarse con email + contraseña. Todos los demás recursos le pertenecen. Tiene un campo `timezone` (zona horaria default / "de casa"). |
| **Categoría** | Clasifica los movimientos. Personalizable por usuario. Tiene un color que el usuario **elige y edita** desde una matriz de colores predefinidos (v1.1, fase 1.1.2; en v1.0 era no editable). Se elimina con soft delete. |
| **Movimiento único** | Gasto o ingreso que ocurrió una sola vez en un instante específico (fecha y hora). Se guarda como timestamp UTC (`occurredAt`) más la zona horaria original del registro (`timezone`, nombre IANA). No es solo una fecha de calendario. |
| **Movimiento fijo** | Plantilla recurrente activa desde un mes de inicio hasta que el usuario la elimina. Tiene una **frecuencia** (`frequency`) de un set cerrado —mensual (default), bimestral, trimestral, semestral, anual— que define en qué meses aparece, anclada al mes de inicio (Fase 1.1.1, RF-MF-006). |
| **Anulación de fijo (RecurringSkip)** | Marca que **anula una aparición** de un movimiento fijo en un **mes puntual** (`(recurringId, month)`), sin eliminar el fijo. Reversible (toggle). El mes anulado se sigue mostrando pero no suma a los totales ni a la proyección anual. Cimiento de P1 (Fase 1.1.1, RF-MF-005). Distinta de `deletedFrom`. |
| **Movimiento calculado** | Caso de **movimiento fijo** cuyo monto **no se ingresa**: se deriva del monto de **otro fijo de origen** mediante una **fórmula** (operador + operando), mes a mes y al vuelo (on-the-fly, no se persiste). Es un fijo a todos los efectos (cadena de filas `Recurring`, frecuencia, split, skip), con dos datos extra: el **vínculo a la identidad de cadena del fijo de origen** y la **fórmula** (operador + operando + signo). Su categoría y descripción son propias; su **tipo se deriva del signo del monto** (no es elegible — RN-018), no se toma del origen. Lo único que toma del origen es el monto. Su `amountCents` puede ser **negativo o cero** (excepción a "monto > 0"). Fase 1.1.7; ver `requirements.md`, submódulo 3.4.b (RF-MCALC-001..007) y RN-017/018/019. |
| **Grupo de cuotas** | Compra o cobro dividido en N pagos mensuales iguales desde un mes de inicio. |
| **Preferencias de usuario** | Conjunto de preferencias del usuario (estado de UI que sobrevive a la navegación y al cierre de sesión). Una fila por usuario (1:1 con Usuario), con el contenido guardado como **blob JSON** en lugar de una columna por preferencia. Cimiento introducido en la fase 1.1.0, sin UI de producto en esa fase; lo consumen 1.1.4 (secciones colapsadas / orden), 1.1.5 (config de reportes) y 1.1.6 (filtro por categoría). |

---

## Decisiones de negocio sobre los datos

- **Montos en centavos.** Todos los montos se guardan como enteros en centavos (ej: $1.500 → `150000`). Sin decimales flotantes.
- **Soft delete en categorías.** Eliminar una categoría la marca como eliminada (`deletedAt`) pero no borra el registro. Los movimientos históricos conservan la referencia y siguen sumando en los totales del mes (el soft delete no excluye movimientos de los cálculos). Una categoría eliminada puede **reactivarse**: al crear una categoría cuyo nombre normalizado colisiona con una eliminada, el sistema propone reactivar la original en lugar de duplicarla (mismo `id`, scope y color); ver `requirements.md`, RF-CAT-002 / RF-CAT-004.
- **Unicidad de nombre de categoría: app-level, no DB.** La unicidad de nombre entre categorías **activas** de un mismo usuario se valida en lógica de aplicación, no con un constraint `@@unique` de Prisma/DB. Motivo: la comparación es **normalizada** (trim + insensible a mayúsculas y acentos) y el flujo "crear-o-reactivar" frente a una categoría soft-deleted homónima no caben en un constraint de base de datos.
- **Color de categoría elegible por el usuario (v1.1, fase 1.1.2).** Cada categoría tiene un color tomado de una **matriz de colores predefinidos** (70 colores; ver "Matriz de colores" más abajo). Desde la fase 1.1.2 el usuario lo elige y edita, con default "menos usado" al crear; la regla funcional completa vive en RN-013 (`requirements.md`). El color es solo presentación y no afecta el cálculo de montos ni el scope.
- **Movimientos fijos: el pasado es inmutable.** Editar o eliminar un fijo no modifica los meses ya pasados. El fijo tiene un mes de inicio (`startMonth`) y opcionalmente un mes desde el cual deja de aparecer (`deletedFrom`, **exclusivo**: "mes desde el cual ya no aparece").
- **El movimiento fijo se modela como una _cadena_ de filas `Recurring`, no una sola.** Un "fijo lógico" puede estar compuesto por varias filas en el tiempo. Cada edición que afecta meses ya corridos **cierra la fila vigente** (le setea `deletedFrom = mes actual`) y **abre una fila nueva** (`startMonth = mes actual`) con los valores nuevos; así los meses pasados conservan los valores viejos y el actual/futuro toman los nuevos, sin generar filas por instancia mensual. Si el fijo todavía no corrió ningún mes, la edición es en su lugar (no se parte la cadena). Esto materializa "el pasado es inmutable". Detalle de la mecánica (split al editar, boundary de eliminación) en `docs/backend.md`, sección Movimientos fijos.
- **Identidad de cadena estable del fijo (Fase 1.1.7).** Hoy un "fijo lógico" es una **cadena de filas `Recurring` sin identidad compartida**: al editar con pasado, el split cierra la fila vigente y abre **otra con un `id` nuevo**, de modo que no hay un identificador que persista a través de los splits. La fase 1.1.7 introduce un **id de cadena estable** —conceptualmente un `chainId` compartido por **todas** las filas de un mismo fijo lógico— que **sobrevive a los splits**: la fila R2 que abre el split **hereda** el `chainId` de R1. Es independiente del `id` de fila (el `id` de fila sigue cambiando en cada split; el `chainId` no). **Por qué:** un movimiento calculado se vincula a **esa identidad de cadena del origen**, no a un `Recurring.id` puntual, para que el vínculo **no se rompa** cuando el origen se edita y se parte (RF-MCALC-004). Los fijos preexistentes obtienen su `chainId` en la migración (uno por cadena ya existente). El nombre y la forma concreta del campo los fija el backend al implementar; este documento fija el concepto y la invariante "el split preserva el `chainId`".
- **Movimiento calculado: fijo + vínculo a cadena origen + fórmula (Fase 1.1.7).** El movimiento calculado **es un movimiento fijo** (misma entidad/cadena `Recurring`, misma frecuencia, mismo split, mismos skips) más dos datos conceptuales: (1) un **vínculo a la identidad de cadena del fijo de origen** (`chainId` del origen — ver decisión anterior), y (2) una **fórmula**. El **monto NO se persiste**: es un campo **derivado al vuelo en lectura** (on-the-fly, RN-006, igual que fijos y cuotas), recalculado del monto del origen en cada consulta, por lo que **espeja la estructura de cadena del origen mes a mes** (si el origen vale distinto en distintos meses por su cadena, el calculado replica esa variación) y sigue cualquier cambio del origen sin re-guardar nada. **No** es un valor congelado al crear (RF-MCALC-004). El monto en un mes es `signo × round(fórmula(montoOrigenEseMes))`. El **tipo (`EXPENSE`/`INCOME`) no se persiste como dato elegible: se deriva del signo de ese monto** (negativo → `EXPENSE`, positivo → `INCOME`, cero → `EXPENSE` por convención de borde; RN-018), también al vuelo. El vínculo es a la **cadena**, no a una fila: sobrevive a los splits del origen. **Sin encadenamiento:** un calculado no puede ser origen de otro (solo un fijo "normal" puede ser cadena origen); un fijo puede tener varios calculados derivados. **Ciclo de vida atado al origen** (eliminación, skip mensual, cambio de frecuencia se propagan; RF-MCALC-005). El detalle de cómo el backend modela el vínculo (FK a `chainId`, propagación, derivación on-the-fly) se documenta cuando backend implemente.
- **Fórmula del calculado: operador + operando + signo (Fase 1.1.7, RF-MCALC-002/003).** La fórmula se persiste conceptualmente como **tres datos**: un **operador** de un set cerrado `{ ADD, SUB, MUL, DIV, PCT }` (corresponde a `+ − × ÷ %`), un **operando** numérico común, y un **signo** (`+1` / `−1`). El operando es un número común ingresado por el usuario (ej. `5000`, `1.5`, `10`); su unidad de persistencia (centavos para operandos monetarios de `±`, factor crudo para `× ÷ %`) la fija el backend al implementar, de forma coherente con que el **resultado** se redondea a centavos enteros (`round`, RN-002/RN-017). **Validación de borde:** operando `0` **rechazado** en `DIV` y `PCT` (división por cero); aceptado en el resto. El **signo** del calculado fuerza el resultado a positivo o negativo y es la razón por la que su `amountCents` puede ser **negativo o cero** (RN-018), excepción a "monto > 0" válida solo para calculados.
- **Frecuencia del movimiento fijo (Fase 1.1.1, RF-MF-006).** Cada fijo tiene un campo `frequency` (enum `RecurringFrequency`, default `MONTHLY`) de un **set cerrado**: `MONTHLY`, `BIMONTHLY`, `QUARTERLY`, `BIANNUAL`, `ANNUAL` (sin frecuencias libres ni custom). La frecuencia está **anclada al `startMonth`** y define en qué meses aparece el fijo según la regla de cálculo de RN-016. Es **inmutable** (como `type`): no se acepta en PATCH; en el split de edición la fila nueva la hereda del original. **Back-compat:** la migración asigna `MONTHLY` por default, así que todos los fijos anteriores quedan mensuales. El cálculo sigue siendo on-the-fly (RN-006).
- **Anulación de un fijo en un mes puntual como registro aparte (`RecurringSkip`, Fase 1.1.1, RF-MF-005).** Anular la aparición de un fijo en un mes puntual se modela con una fila `RecurringSkip(recurringId, month)` —**no** con un flag en `Recurring`—, con `month` en formato `"YYYY-MM"` y **unicidad `(recurringId, month)`** (un solo skip por fijo y mes). `onDelete: Cascade` desde `Recurring`: al borrar el fijo se borran sus skips. Es **distinto de `deletedFrom`**: `deletedFrom` corta el fijo de ahí en adelante; el skip cancela **una** aparición puntual dejando el fijo vivo. La acción de anular/des-anular es un **toggle** (si existe el skip se borra, si no se crea). Un fijo anulado para un mes **se sigue listando** en `GET /movements` (marcado con `skipped: true`) pero su monto **no suma** a los totales del mes ni a la proyección anual. El backend **no valida** que el mes del skip sea una aparición real del fijo según su frecuencia (solo formato `YYYY-MM` y ownership); esa validación semántica es del frontend, que ya tiene el ítem del mes.
- **Moneda implícita en v1.** No hay campo de moneda. El modelo está diseñado para que se pueda agregar en el futuro sin romper datos existentes.
- **Aislamiento por usuario.** Todos los recursos (movimientos, categorías, preferencias) pertenecen a un usuario y nunca son visibles para otro.
- **Preferencias de usuario como blob JSON (1:1 con Usuario).** Las preferencias se guardan en una **fila por usuario** (`UserPreferences`, `userId` único, `onDelete: Cascade` — borrar el usuario borra sus preferencias) con el contenido en un único campo `data` de tipo JSON (default `{}`). **Motivo del blob:** poder **agregar preferencias futuras sin migraciones** de esquema — cada fase consumidora suma sus propias claves al objeto sin tocar la DB. Es un objeto **abierto / extensible**; en la fase 1.1.0 (cimiento) está **vacío**: las claves las agregan las fases que lo consumen (1.1.4, 1.1.5, 1.1.6). Una fila se crea solo cuando el usuario muta una preferencia por primera vez (o al dar de alta la cuenta); ver back-compat en `docs/backend.md`.
- **Contraseñas hasheadas.** Las cuentas con email + contraseña guardan únicamente un hash de la contraseña (`passwordHash`, bcrypt/argon2), nunca el texto plano. El hash y la verificación viven en el backend. Las cuentas creadas solo con Google pueden no tener `passwordHash`. El caso de account linking (mismo email por ambos métodos) queda **pendiente sin resolver en v1** (ver `requirements.md`, sección 6).
- **Fechas y zonas horarias (movimiento único).** El movimiento único se almacena como timestamp en UTC (`occurredAt`) junto con la zona horaria original del registro (`timezone`, nombre IANA, ej. `America/Argentina/Buenos_Aires`). El Usuario tiene además un campo `timezone` (zona default / "de casa") que se usa para calcular "hoy" / "mes actual" al crear movimientos y en el dashboard. Los movimientos fijos y las cuotas no aplican esto: operan a nivel mes, sin día ni hora. La regla de presentación y de imputación del mes vive en RN-011 (`requirements.md`); el detalle técnico, en `docs/technical.md` (sección "Fechas y zonas horarias").

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
  },
  preferences: { ... }      // blob JSON de preferencias del usuario; {} si no tiene fila
}
```

- **`accessToken`** es el JWT que **emite NestJS** (HS256). Sus claims son: `sub` (el `userId`, cuid del usuario), `iat` y `exp` (expira a los **30 días**). El frontend lo trata como **opaco**: lo guarda y lo reenvía como `Authorization: Bearer`, no lo decodifica.
- **Dos tokens distintos.** El `accessToken` (JWT de NestJS) viaja **dentro** de la sesión de Auth.js, que es un **JWE separado** encriptado por NextAuth. No confundirlos: el backend solo valida el JWT de NestJS; nunca ve el JWE de Auth.js. Detalle del flujo en `docs/architecture.md`.
- **`preferences` — blob JSON cargado al loguear (fase 1.1.0).** Los tres flujos (`/auth/login`, `/auth/register`, `/auth/google`) incluyen el blob de preferencias del usuario en `data`, para que el frontend lo cargue **una sola vez** en la sesión de Auth.js al iniciar sesión y no tenga que pedirlo aparte. Es **`{}`** si el usuario no tiene fila de preferencias (usuarios viejos; ver back-compat en `docs/backend.md`). Mutaciones posteriores se hacen contra `PUT /preferences` (abajo), no re-logueando.

---

## Contrato de preferencias de usuario (preferences)

Endpoints de lectura y escritura del blob de preferencias del usuario autenticado. **JWT requerido** en ambos (scope por `userId` del token); `401` global si falta o es inválido. Detalle de implementación y reglas de back-compat en `docs/backend.md`, sección Preferencias de usuario.

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `GET /preferences` | — | `200` · `data: <blob>` | `401` |
| `PUT /preferences` | `{ data: { ...objeto plano... } }` | `200` · `data: <blob persistido>` | `400` · `401` |

- **`GET /preferences`** — sin body. El `data` del sobre es el **blob** de preferencias del usuario, o **`{}`** si no tiene fila (no la crea).
- **`PUT /preferences`** — body `{ data: <objeto plano> }`. El `data` de la respuesta es el blob **persistido**. Hace **upsert** (crea la fila si no existía). `400` si `data` falta o **no es un objeto**.
- **Semántica de reemplazo completo (no merge).** El server **NO** mergea: guarda el `data` recibido **tal cual**, reemplazando el blob entero. **El frontend manda el blob completo** en cada `PUT` — para cambiar una sola clave, el llamador parte del blob actual y reescribe todo (`{ ...preferences, clave: valor }`). Consecuencia: omitir una clave en el `PUT` la **borra**.

### Claves del blob

El blob es un objeto **abierto/extensible**: cada fase consumidora agrega su(s) propia(s) clave(s) sin tocar la DB (ver decisión "Preferencias de usuario como blob JSON"). Las claves vivas hoy:

#### `monthSections` — estado de las secciones de la Vista del mes (Fase 1.1.4, RF-VM-005)

Primer consumidor real del blob. Persiste el estado colapsado/expandido y el orden de las tres secciones de `/mes`.

```
monthSections: {
  order: MonthSectionKey[],        // p.ej. ["unicos","fijos","cuotas"]
  collapsed: MonthSectionKey[]     // claves de las secciones colapsadas
}

MonthSectionKey = "unicos" | "fijos" | "cuotas"
```

- **`order`** — orden en que se muestran las tres secciones (RF-VM-005). Default `["unicos","fijos","cuotas"]`.
- **`collapsed`** — claves de las secciones actualmente colapsadas. Default `[]` (todas expandidas).
- **Back-compat / normalización.** Si `monthSections` **no existe** en el blob → se usa el default (`order: ["unicos","fijos","cuotas"]`, `collapsed: []`). Si `order` trae **claves desconocidas o le faltan**, se **normaliza**: se filtran las desconocidas y se agregan al final las faltantes, preservando el orden válido recibido. Así un blob viejo o parcial nunca rompe la pantalla.
- **El back NO valida ni conoce esta clave:** `PUT /preferences` guarda el blob tal cual (reemplazo total). La normalización y los defaults son responsabilidad del frontend consumidor (ver `docs/frontend.md`, §Vista del mes).

#### `reports` — config de las cards de la pantalla de Reportes (Fase 1.1.5, RF-REP-003/004)

Persiste la vista configurable de `/reportes`: una entrada por **card de reporte**, en el orden en que se muestran. Cada card es un widget de reporte autónomo (RF-REP-002).

```
reports: ReportCardConfig[]

ReportCardConfig = {
  id: string,                                   // id local de la card (key de React / quitar); generado en el front
  type: "income-expense" | "by-category",       // tipo de reporte (RF-REP-001)
  year: number,                                 // año que muestra la card
  categoryIds: string[] | null,                 // null = todas las categorías; lista = subconjunto explícito de categoryIds
  categoryBreakdown?: boolean                    // modo de vista de la card income-expense (Fase 1.2.2, RF-REP-006)
}
```

- **`type`** — `"income-expense"` (Forma 1, Ingresos vs. Gastos) o `"by-category"` (Forma 2, Gastos por categoría apilado). Son los dos únicos tipos (RF-REP-001).
- **`year`** — el año que la card grafica; lo cambia la navegación de año embebida del widget.
- **`categoryIds`** — filtro de categorías de la card. **`null` = todas** (default al crear); una **lista** = subconjunto explícito de `categoryId`s seleccionados. Aplica a ambos tipos (en `income-expense` restringe qué categorías cuentan en los totales; en `by-category`, qué bandas se apilan). Lo que el front manda al endpoint como `categories` deriva de este campo (ver contrato `GET /movements/reports`).
- **`categoryBreakdown`** (Fase 1.2.2, RF-REP-006) — modo de vista **solo de las cards `income-expense`**: `true` = vista "Por categoría" (gastos descompuestos por categoría apilada, reutilizando el array `categories`); `false`/ausente = vista "Total" (dos series agregadas). **Default `false`; ausencia = `false`** (las cards previas arrancan en "Total" — sin migración). Irrelevante para `by-category` (que no tiene toggle). En el dashboard el modo es **efímero** (estado local) y no usa este campo.
- **Orden del array = orden de despliegue** de las cards en pantalla.
- **Ausente / vacío = pantalla vacía.** Clave ausente o `reports: []` → `/reportes` muestra solo el recuadro "[+]" (estado vacío inicial, RF-REP-003).
- **Back-compat / normalización.** Un blob previo **sin** `reports` se interpreta como `[]` (pantalla vacía). La normalización (entradas malformadas, `type` desconocido, `categoryIds` que apunten a categorías inexistentes/eliminadas) es responsabilidad del front; un blob viejo o parcial nunca rompe la pantalla.
- **El back NO valida ni conoce esta clave** (igual que `monthSections`): `PUT /preferences` guarda el blob tal cual. La normalización y los defaults son del frontend consumidor.

#### `monthListFilters` — filtros por listado de la Vista del mes (Fase 1.2.1, RF-VM-006)

Filtros **por sección** de `/mes` (tipo + categoría por cada una de Únicos/Fijos/Cuotas), persistidos por usuario. Reemplaza a `monthCategoryFilter`. Shape, semántica y back-compat en §Filtro de categorías → `monthListFilters` (más abajo).

#### `monthCategoryFilter` — filtro de categorías de la Vista del mes (Fase 1.1.6, RF-VM-006) — **DEPRECADA (1.2.1)**

**Deprecada en 1.2.1**: reemplazada por `monthListFilters`. Ya no se lee ni se escribe desde `/mes`; se conserva en el tipo para no romper blobs viejos y **no se migra**. Detalle en §Filtro de categorías → `monthCategoryFilter` (más abajo).

---

## Contrato de categoría (respuesta de la API)

Toda respuesta exitosa de los endpoints de categorías devuelve, dentro del sobre `{ success, statusCode, data }`, este shape:

```
Categoria = {
  id: string,
  userId: string,
  name: string,                          // tal cual lo tipeó el usuario
  scope: "BOTH" | "EXPENSE" | "INCOME",
  color: string,                         // "#HEX" de la matriz, en mayúsculas; editable (fase 1.1.2)
  deletedAt: null,                       // las respuestas solo traen activas
  createdAt: string,
  updatedAt: string,
  movementCount: number
}
```

- **`movementCount` — derivado de solo lectura.** Es la suma de las **tres relaciones de movimiento** que referencian la categoría: movimientos únicos + fijos + grupos de cuotas. No es un campo almacenado ni editable; el backend lo calcula al responder. Cero si la categoría no tiene movimientos. Alimenta el contador "N movimientos" de la pantalla de categorías (RF-CAT-006) y **no** se confunde con los totales de dinero del mes (ver `requirements.md`, RF-VM-002).
- **`color` — editable, de la matriz (fase 1.1.2).** `POST /categories` y `PATCH /categories/:id` aceptan `color?: string` **opcional**. Validación: debe **pertenecer a la matriz de 70** (case-insensitive; se **almacena en mayúsculas**); un color fuera de la matriz → **`400`**. En `POST`, si **no** llega `color`, el backend asigna el "menos usado" como **red de seguridad** — pero el frontend **siempre lo envía**. Detalle de la validación en `docs/backend.md`, sección Pool de colores.

### Payload reactivable en errores (409)

Cuando se intenta crear una categoría cuyo nombre normalizado colisiona con una **eliminada** (RF-CAT-002, A3), el backend responde `409` y adjunta, dentro del sobre de error, un `data` estructurado:

```
error.data = {
  reactivable: true,
  category: { id, name, scope, color }
}
```

- Es el **único** caso en que el sobre de error lleva `data`; el resto de los errores no lo incluyen. El front usa `category.id` para ofrecer reactivar (`POST /categories/:id/reactivate`) sin un endpoint extra de búsqueda. La colisión con una categoría **activa** (RN-008) responde `409` **sin** `data`.

### Matriz de colores (dato del dominio)

El set **elegible** por el usuario es una **matriz de 70 colores** (`COLOR_MATRIX`: 7 tonalidades × 10 hues, estilo Office), única en el backend. Desde la fase 1.1.2 el color **es editable** por el usuario, tanto al crear como al editar; solo se aceptan colores de la matriz (sin hex libre).

- **Pool de 10 (fila base T4) conservado como base del "menos usado".** Los **10 colores base** son la fila T4 de la matriz —que coincide con el pool fijo de 10 de v1.0—. Sobre esos 10 base se calcula el default "menos usado" al crear (regla en RN-013); las categorías por defecto del alta toman los primeros 4 en orden. Es solo un default: el usuario puede elegir cualquiera de los 70.
- **Back-compat:** los colores preexistentes son todos de T4 (los 10 de v1.0), que es un subconjunto de la matriz de 70 — ya pertenecen a ella, sin migración.
- El color es solo presentación. Detalle de `COLOR_MATRIX` / `COLOR_POOL` (T4) y la estrategia en `docs/backend.md`, sección Pool de colores.

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

---

## Contrato de movimientos del mes (respuesta de `GET /movements`)

`GET /movements?month=YYYY-MM` devuelve, dentro del sobre `{ success, statusCode, data }`, los movimientos del mes agrupados por origen **más los totales**. Es el endpoint unificado de la Vista del mes y el Dashboard (detalle de implementación en `docs/backend.md`, sección Movimientos del mes).

**Query params:**

- **`month`** (requerido) — el mes a listar, `YYYY-MM`.
- **`categories`** (opcional, Fase 1.1.6) — filtro por categoría. Lista de `categoryId`s **separados por comas, sin URL-encode** (ej. `categories=abc,def`). **Distingue "ausente" de "presente y vacío"** (ver tabla del filtro de categorías más abajo): ausente = todas; `categories=` (vacío) = ninguna (listas vacías + totales en cero); lista = solo esas categorías. Afecta **gastos e ingresos** y recalcula **listas y totales**. **El param sigue vigente pero `/mes` ya NO lo usa (Fase 1.2.1):** el filtrado de la Vista del mes se movió al frontend (filtros por listado, RF-VM-006), así que `/mes` trae todo el mes sin `categories`. El param lo sigue consumiendo `GET /movements/reports` (filtro de reportes).

```
data = {
  month: "YYYY-MM",
  totals: {
    expenseCents: number,   // suma de gastos del mes
    incomeCents: number,    // suma de ingresos del mes
    balanceCents: number    // incomeCents - expenseCents (puede ser negativo)
  },
  movements: {
    unicos: MovementItem[],   // ordenados por amountCents DESC (desempate: occurredAt DESC)
    fijos:  MovementItem[],   // ordenados por amountCents DESC (desempate: createdAt DESC)
    cuotas: MovementItem[]    // ordenados por amountCents DESC (desempate: id ASC)
  }
}
```

```
MovementItem = {
  id: string,
  origin: "unico" | "fijo" | "cuota",        // discriminador del tipo de movimiento
  type: "EXPENSE" | "INCOME",
  amountCents: number,
  description: string | null,
  occurredAt: string | null,                 // ISO 8601 en UTC; null en fijos y cuotas (sin día/hora)
  timezone: string | null,                   // IANA del registro; null en fijos y cuotas
  installment: {                             // presente solo en cuotas; null en únicos y fijos
    number: number,                          //   nro de cuota del mes (1-based)
    total: number,                           //   cantidad total de cuotas del grupo
    startMonth: string                       //   "YYYY-MM", mes de inicio del grupo
  } | null,
  frequency: RecurringFrequency | null,      // fijos: su frecuencia; únicos y cuotas: null (P2 — 1.1.1)
  skipped: boolean,                          // fijos: true si está anulado para el mes; únicos y cuotas: false (P1 — 1.1.1)
  category: { id, name, color, scope },      // embebida
  calculated: CalculatedInfo | null,         // presente si el ítem ES un calculado (hijo); null si no (1.1.7)
  hasCalculated: boolean                     // true si el ítem es un ORIGEN (fijo/único/cuota) con ≥1 calculado en el mes (padre); false en el resto (1.1.7; 1.1.8 lo extiende a único/cuota)
}

CalculatedInfo = {                           // Fase 1.1.7 — solo en ítems que son calculados
  sourceType: "fijo" | "unico" | "cuota",    // tipo del origen del calculado (1.1.8)
  sourceId: string,                          // id del origen: chainId (fijo) / Transaction.id (único) / InstallmentGroup.id (cuota) (1.1.8)
  sourceChainId: string | null,              // chainId del fijo de origen (fijo); null para único/cuota (1.1.8)
  sourceDescription: string | null,          // descripción del origen en el mes (para el preview / "desde {Origen}")
  formulaOperator: "ADD"|"SUB"|"MUL"|"DIV"|"PCT",
  formulaOperand: number,                    // operando ESCALADO (entero) — ver "Escalado del operando" abajo
  formulaSign: 1 | -1,                       // signo del resultado
  sourceAmountCents: number                  // monto del origen en el mes (centavos, > 0); base de la fórmula. Para CUOTA = monto por cuota del grupo (1.1.8)
}
```

donde `RecurringFrequency = "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "BIANNUAL" | "ANNUAL"`.

- **Discriminador `origin`.** Cada ítem declara su tipo de movimiento (`unico` / `fijo` / `cuota`), además de venir ya agrupado en su lista. El front lo usa para rotular el origen y elegir el flujo de edición/eliminación. `origin: "fijo"` se puebla desde Fase 6; `"cuota"`, desde Fase 7.
- **Orden de las listas.** Los tres grupos vienen ordenados por **magnitud del monto descendente** = `\|amountCents\|` DESC (monto más grande primero, por tamaño, sin distinguir `EXPENSE` de `INCOME`). Para únicos, fijos normales y cuotas `amountCents > 0`, así que la magnitud coincide con el valor; para un **movimiento calculado** (en `fijos`) el `amountCents` puede ser **negativo** (RN-018), por lo que se ordena por su **valor absoluto** — un calculado de `−5000` se ubica entre los demás por su tamaño (5000), no al final por ser negativo. Desempate estable por grupo: `unicos` por `occurredAt` DESC, `fijos` por `createdAt` DESC, `cuotas` por `id` ascendente.
- **`occurredAt` / `timezone` son nullable.** Para **únicos** vienen presentes (instante + zona). Para **fijos** y **cuotas** vienen **`null`**: operan a nivel mes, no tienen día/hora/zona. El front no debe pasar estos campos a `formatDate` / `formatTime` sin chequear null. **Calculados (Fase 1.1.8):** un calculado **hereda `occurredAt`/`timezone` del origen** — el de **único** los trae **poblados** (los del `Transaction` de origen), consistente con que todos los ítems de la sección Únicos muestran día/hora y con que el calculado ocurre "junto con" su origen; el de **fijo** y el de **cuota** quedan en **`null`** (su origen tampoco tiene día/hora). No cambia el contrato HTTP: el shape ya admitía ambos como `string | null`.
- **`installment` solo en cuotas.** Para una cuota trae `{ number, total, startMonth }`: `number` es el número de cuota del mes (1-based), `total` es el `totalInstallments` del grupo y `startMonth` es el mes de inicio del grupo. Para **únicos** y **fijos** es **`null`**. El front lo usa para la etiqueta "Cuota X/N" y para prefilear la edición del grupo.
- **`frequency` / `skipped` — solo significativos en fijos (Fase 1.1.1).** Para un **fijo**, `frequency` es su periodicidad (`MONTHLY`…`ANNUAL`, RF-MF-006) y `skipped` indica si esa aparición está **anulada para el mes consultado** (RF-MF-005). Para **únicos** y **cuotas**, `frequency` es **`null`** y `skipped` es **`false`** (no aplican). Un fijo con `skipped: true` **viene igual en la lista** (no se omite) pero **no está incluido en `totals`** — el front lo muestra con su diferenciación visual de anulado. El front usa `frequency` para rotular la cadencia y `skipped` para el estado y el toggle de la acción anular/des-anular.
- **Los totales suman movimientos, no categorías.** `expenseCents` / `incomeCents` agregan la **magnitud** (`\|amountCents\|`) de los movimientos del mes **en el bucket de su `type`** (RN-019): un `INCOME` suma a `incomeCents`, un `EXPENSE` a `expenseCents`. Para movimientos normales `amountCents > 0` y el `type` es fijo. Para un **movimiento calculado** (Fase 1.1.7) el `amountCents` puede ser **negativo o cero** (RN-018) y su `type` se **deriva del signo** (negativo → `EXPENSE`, positivo → `INCOME`); como signo y tipo siempre coinciden, suma su magnitud al bucket correcto —un calculado de `−2000` es `EXPENSE` y suma 2000 a `expenseCents`; uno de `+2000` es `INCOME` y suma 2000 a `incomeCents`; un monto 0 no aporta a ningún bucket—. No hay restas ni reasignación de bucket. `balanceCents = incomeCents - expenseCents`, sin piso (negativo si los gastos superan los ingresos). No se confunden con el contador `movementCount` de la pantalla de categorías (ver más arriba y `requirements.md`, RF-VM-002 / RF-CAT-006). **Un fijo anulado para el mes (`skipped: true`, RF-MF-005) aparece en la lista pero NO suma a los totales.**
- **Movimientos calculados — `origin` espeja el tipo del origen (Fase 1.1.7 / 1.1.8).** Un movimiento calculado viaja en la lista de **su tipo de origen** (`origin: "fijo" | "unico" | "cuota"` según `calculated.sourceType`): calculado de fijo → lista `fijos`; de único → lista `unicos`; de cuota → lista `cuotas`. En 1.1.7 el origen era solo fijo; 1.1.8 suma único y cuota. Su `amountCents` ya viene **derivado al vuelo y con signo** para el mes (`signo × round(fórmula(montoOrigenEseMes))`, RN-017/018) y puede ser **≤ 0**; su `type` viene **derivado de ese signo** (negativo → `EXPENSE`, positivo → `INCOME`, cero → `EXPENSE`; RN-018), no es un dato elegible. Para un calculado de **cuota**, `calculated.sourceAmountCents` es el **monto por cuota** del grupo, y el ítem **no** trae la etiqueta `installment` "X/N" (RF-MCALC-008). La **relación padre/hijo** (RF-MCALC-007) se expone con dos campos del `MovementItem`: **`calculated`** (objeto `CalculatedInfo` si el ítem **es** un calculado / hijo, `null` si no) y **`hasCalculated`** (`true` si el ítem es un **origen** —fijo, único o cuota— con ≥1 calculado derivado en ese mes / padre). Un calculado nunca es padre (`hasCalculated: false` siempre — sin encadenamiento). El **orden** de cada lista usa la **magnitud** = `\|amountCents\|` DESC (ver "Orden de las listas"): un calculado negativo ordena por su tamaño, no al final.
- **La categoría embebida puede estar soft-deleted.** Un movimiento histórico muestra su categoría aunque haya sido eliminada (`deletedAt`), y **sigue contando en los totales** (RF-CAT-004 / RF-VM-002; el join de movimientos no filtra por `deletedAt`).
- **Listas de fijos y cuotas pobladas.** La lista `fijos` se puebla desde Fase 6 y `cuotas` desde **Fase 7**; los totales del mes suman únicos + fijos + cuotas. El **grupo de cuotas no genera filas por instancia**: se calcula on-the-fly (RN-006) — una cuota cae en `startMonth ≤ mes < startMonth + totalInstallments`. Detalle del cálculo en `docs/backend.md`, sección Movimientos en cuotas.

---

## Contrato de movimientos calculados (Fase 1.1.7 / 1.1.8)

Endpoints propios del calculado, en el `RecurringModule` (el calculado **es** un fijo). Desde 1.1.8 el **origen** puede ser fijo, único o cuota: cada tipo de origen tiene su par `POST`/`PATCH` propio, según desde dónde se dispara la acción. **JWT requerido**; scope por `userId` del token. Mecánica de implementación (cadena, derivación, cascada) en `docs/backend.md`, §Movimientos calculados; reglas funcionales en `requirements.md`, RF-MCALC-001..010 y RN-017/018/019.

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `POST /recurring/:id/calculated` | `{ categoryId, startMonth, formulaOperator, formulaOperand, formulaSign, description? }` | `201` · `data: Recurring` | `400` · `404` |
| `PATCH /recurring/:id/calculated` | `{ currentMonth, categoryId?, description?, formulaOperator?, formulaOperand?, formulaSign? }` | `200` · `data: Recurring` | `400` · `404` |
| `POST /transactions/:id/calculated` | `{ categoryId, formulaOperator, formulaOperand, formulaSign, description? }` (sin `startMonth`) | `201` · `data: Recurring` | `400` · `404` |
| `PATCH /transactions/:id/calculated` | `{ currentMonth, categoryId?, description?, formulaOperator?, formulaOperand?, formulaSign? }` | `200` · `data: Recurring` | `400` · `404` |
| `POST /installments/:id/calculated` | `{ categoryId, formulaOperator, formulaOperand, formulaSign, description? }` (sin `startMonth`) | `201` · `data: Recurring` | `400` · `404` |
| `PATCH /installments/:id/calculated` | `{ currentMonth, categoryId?, description?, formulaOperator?, formulaOperand?, formulaSign? }` | `200` · `data: Recurring` | `400` · `404` |

- **`:id` del POST** identifica el **origen** según la ruta: fijo (`/recurring/:id`, id de la fila activa del fijo), único (`/transactions/:id`) o grupo de cuotas (`/installments/:id`). El calculado se crea como una cadena `Recurring` nueva vinculada al origen (1.1.8).
- **`startMonth` solo en el POST de fijo.** Para **único** y **cuota** el backend lo **deriva del origen**: único → `startMonth = mes del Transaction`; cuota → `startMonth = grupo.startMonth`. El body de único/cuota **no** lleva `startMonth`.
- **El body NO acepta `type`** (en ninguno): el tipo se **deriva del signo** del monto al vuelo (RF-MCALC-003); si el front lo envía, la whitelist de class-validator lo descarta.
- **`formulaOperator`** ∈ `{ ADD, SUB, MUL, DIV, PCT }`. **`formulaSign`** ∈ `{ 1, -1 }`. **`formulaOperand`** es un **entero escalado** (ver "Escalado del operando" abajo).
- **`POST` — errores (los tres):** `400` si el origen es **a su vez un calculado** (sin encadenamiento — solo aplica al de fijo), si `formulaOperand = 0` con `DIV`/`PCT` (RN-017), o si la categoría es inválida (inexistente/ajena/eliminada). `404` si el origen no existe o no es del usuario. La categoría se valida con scope `BOTH` (`skipScopeCheck`) porque el tipo del calculado es derivado.
- **`PATCH` — split y errores:** `currentMonth` (`YYYY-MM`) **requerido** en los tres; usa la **misma mecánica de split del pasado** que `PATCH /recurring/:id`. Editables: `categoryId`, `description`, `formulaOperator`, `formulaOperand`, `formulaSign`. **No** editable el vínculo al origen. `400` si el `:id` **no es un calculado** del tipo esperado, o `formulaOperand = 0` con `DIV`/`PCT`. `404` si no existe o no es del usuario.
- **`PATCH /recurring/:id` (fijo normal) rechaza con `400` si el `:id` es un calculado** (y los `PATCH .../calculated` exigen que lo sea): cada tipo se edita por su endpoint.
- **Acotamiento de cadencia (1.1.8).** Calculado de **único:** el backend fija `deletedFrom = nextMonth` para acotar la cadena a **un solo mes** (el del único). Calculado de **cuota:** `deletedFrom = null`; el rango lo determina **on-the-fly** el `totalInstallments` del grupo (`startMonth ≤ mes < startMonth + totalInstallments`).
- **`DELETE /recurring/:id` — tres caminos (1.1.8).** El endpoint es **uniforme** (los query `currentMonth` y `fromCurrentMonth` siguen siendo requeridos por contrato), pero el comportamiento depende del calculado:
  - **(a) Calculado de único o cuota** → **hard-delete total** del calculado (ignora `currentMonth`/`fromCurrentMonth`): no hay split, espejando que su origen tampoco se borra por mes (RF-MCALC-009).
  - **(b) Calculado de fijo** → `boundary` sobre su cadena (split del pasado), sin tocar el origen ni otros calculados (RF-MCALC-006).
  - **(c) Fijo normal** → `boundary` sobre su cadena y **cascada** del mismo `boundary` a sus calculados de fijo. La cascada origen→calculado de **único/cuota** la resuelve la **DB por FK `onDelete: Cascade`** (no pasa por este endpoint: el origen se borra desde `/transactions` o `/installments`).

### Escalado del operando (entero, sin floats)

El `formulaOperand` se persiste y viaja como **entero escalado**, distinto por operador, para no propagar floats (RN-002/RN-017). El front escala al enviar y desescala al editar; el backend aplica la fórmula con la escala correspondiente. Constantes en `backend/src/recurring/formula.helper.ts`.

| Operador | Significado del operando | Escala | Ejemplo |
|---|---|---|---|
| `ADD` / `SUB` | monto en **centavos** | `× 100` (igual que `amountCents`) | `$500` → `50000` |
| `MUL` / `DIV` | **factor** crudo | `× FACTOR_SCALE` (`1_000_000`) | `1.5` → `1_500_000` |
| `PCT` | **porcentaje** | `× PCT_SCALE` (`100`) | `10%` → `1000`; `1.5%` → `150` |

El **resultado** de la fórmula se redondea a centavos enteros y se multiplica por `formulaSign` (RN-017/018).

### Campos de `Recurring` para calculados (shape de respuesta)

El `Recurring` que devuelven los endpoints (y que el front recibe) incluye, además de los campos del fijo normal, los de cadena y calculado (`backend/prisma/schema.prisma`):

- **`chainId`** — identidad estable de la cadena del fijo lógico; la comparten todas las filas del fijo a través de los splits (ver §Identidad de cadena estable). Presente en **todo** `Recurring`.
- **`sourceChainId`** — `null` en fijos normales y en calculados de único/cuota; el **`chainId` del origen** en calculados de **fijo** (vínculo a la cadena, no a una fila).
- **`sourceMovementId`** (Fase 1.1.8) — FK nullable a `Transaction`, `onDelete: Cascade`. No-null **solo** en calculados de **único** (vínculo al único de origen).
- **`sourceInstallmentGroupId`** (Fase 1.1.8) — FK nullable a `InstallmentGroup`, `onDelete: Cascade`. No-null **solo** en calculados de **cuota** (vínculo al grupo de origen).
- **Invariante de origen (1.1.8):** en un **calculado**, exactamente **uno** de `{ sourceChainId, sourceMovementId, sourceInstallmentGroupId }` es no-null (el resto null). Los **tres null** = fijo normal. La exclusión mutua la valida el service. Borrar el `Transaction` / `InstallmentGroup` de origen **cascadea** (FK `onDelete: Cascade`) y borra entero el calculado.
- **`formulaOperator` / `formulaOperand` / `formulaSign`** — `null` en fijos normales; la fórmula (con operando escalado) en calculados.

> En los calculados, el `amountCents` y el `type` que persiste la fila son **placeholders** (`0` y `EXPENSE`) que **nunca** se usan para mostrar: el monto y el tipo reales se derivan al vuelo en `GET /movements` (ver `MovementItem.amountCents` / `type` y `docs/backend.md`, §Movimientos calculados).

---

## Contrato de serie de reportes (respuesta de `GET /movements/reports`)

> **Renombre (fase 1.1.5):** este endpoint era `GET /movements/annual`. Se renombró a `GET /movements/reports` (RF-REP-005) y se le sumó el filtro de categorías por query param; la mecánica de agregación anual no cambia. El shape de respuesta se conserva.

`GET /movements/reports?year=YYYY&categories=<id1,id2,...>` devuelve, dentro del sobre `{ success, statusCode, data }`, la serie **anual agregada** del usuario para los reportes (RF-REP-001/002): ingreso/gasto por mes y el gasto mensual desglosado por categoría (`categories`). **No** devuelve movimientos individuales. Reutiliza el mismo criterio de bucketeo que el contrato mensual (RN-015), sin introducir reglas de zona nuevas. Detalle de implementación en `docs/backend.md`, sección Movimientos del mes (subsección Serie anual).

**Query params:**

- **`year`** (requerido) — el año a graficar.
- **`categories`** (opcional) — filtro por categoría, **tres estados** (ver tabla "Filtro de categorías" más abajo, compartida con `GET /movements`): **ausente = todas**, **`categories=` (presente y vacío) = ninguna** (serie en cero), **lista `id1,id2` = subconjunto**. Lista de `categoryId`s **separados por comas, sin URL-encode** (ej. `categories=abc,def`). El front lo deriva del `categoryIds` de la card (`null` → omite el param; `[]` → `categories=` vacío; lista → la serializa). El filtro afecta **ambas formas**: en la Forma 1, qué categorías cuentan en `incomeCents`/`expenseCents` por mes; en la Forma 2, qué categorías se desglosan. *(Ajuste 1.1.6: el estado "presente y vacío = ninguna" reemplaza el colapso previo de vacío → todas; ver `docs/decisions.md`, bitácora 2026-06-17.)*

```
ReportsMovementsResponse = {
  year: number,                       // el año pedido
  months: ReportMonth[],              // SIEMPRE 12 entradas, ene→dic, en orden; filtradas al set pedido
  categories: ReportCategory[],       // desglose de GASTOS: solo categorías con gasto EXPENSE en el año, dentro del set pedido
  earliestYear: number | null         // año más antiguo con algún movimiento del usuario; NO afectado por el filtro
}

ReportMonth = {
  month: string,                      // "YYYY-MM"
  incomeCents: number,                // suma de ingresos del mes (únicos + fijos + cuotas), filtrada al set pedido
  expenseCents: number                // suma de gastos del mes (únicos + fijos + cuotas), filtrada al set pedido
}

ReportCategory = {
  categoryId: string,
  name: string,
  color: string,                      // "#rrggbb"
  monthlyExpenseCents: number[]       // EXACTAMENTE 12 valores, ene→dic, 0 donde no hay gasto
}
```

- **`months` — siempre 12, ene→dic.** Los meses sin datos (incluidos los **futuros** del año en curso) vienen con `incomeCents` / `expenseCents` en **cero**, nunca omitidos. Con filtro de categorías, los totales mensuales suman **solo los movimientos de las categorías pedidas** (un mes sin movimientos en el set queda en cero). El mes de cada movimiento se determina con el mismo bucketeo que el mensual (RN-015): únicos por la zona propia del registro (`AT TIME ZONE`), fijos y cuotas a nivel mes. Para los **fijos**, la proyección respeta la **frecuencia** (un fijo solo se imputa a los meses que dicta su `frequency`, RF-MF-006 / RN-016) y **excluye los meses anulados** (RF-MF-005): un mes con skip no suma a ese mes del año.
- **`categories` — desglose de gasto (`EXPENSE`), dentro del filtro.** Es el **único** desglose por categoría del contrato y es **solo de gastos** (`EXPENSE`). Una categoría aparece si tuvo gasto en algún mes del año, **está dentro del set pedido** (si hay filtro) e **incluye categorías soft-deleted** con gasto histórico (RF-CAT-004; el desglose no filtra por `deletedAt`). Orden: por **gasto anual total DESC**, desempate por `categoryId` ASC. Alimenta tanto la Forma 2 (`by-category`) como el modo "Por categoría" de la card `income-expense` (RF-REP-006), que desglosa **solo gastos**.
- **Invariante de consistencia.** Para cada mes `i`, la suma de `categories[*].monthlyExpenseCents[i]` **es igual a** `months[i].expenseCents`. El front puede confiar en que las bandas de gasto apiladas por categoría suman exactamente el total de gastos del mes (dentro del set filtrado). **Calculados (Fase 1.1.7):** la suma respeta la imputación por **magnitud al bucket del tipo derivado** de RN-019 — un movimiento calculado tiene `type` derivado del signo de su `amountCents` (RN-018), así que un calculado de monto negativo es `EXPENSE` y suma su **magnitud** (`\|amountCents\|`) tanto a `months[i].expenseCents` como a la banda `monthlyExpenseCents[i]` de su categoría, conservando la invariante. Como cada movimiento suma magnitud (nunca resta) al bucket que le corresponde, los totales y las bandas **no pueden quedar negativos** por la presencia de calculados.
- **`earliestYear` — NO afectado por el filtro.** Año más antiguo con **cualquier** movimiento del usuario (mínimo entre el año del mes local de cualquier único y el año del `startMonth` de cualquier fijo/cuota), **calculado sobre todos los movimientos, ignorando el filtro `categories`**; `null` si el usuario no tiene ningún movimiento. El front lo usa para deshabilitar la navegación ‹ antes del primer año con datos (RF-REP-002); que sea independiente del filtro evita que los límites de navegación salten al filtrar categorías.

---

## Filtro de categorías — query param `categories` (Fase 1.1.6)

> Destino canónico del contrato del param `categories`. Lo consume **`GET /movements/reports?year=YYYY`** (filtro de reportes, RF-REP-002). `GET /movements?month=YYYY-MM` lo **acepta** con la misma semántica, pero **`/mes` ya no lo envía** (Fase 1.2.1: el filtro de la Vista del mes se movió al frontend — filtros por listado, RF-VM-006; ver §Preferencia `monthListFilters`).

El param distingue **tres estados** —y, en particular, distingue **"ausente" de "presente y vacío"**:

| Estado | URL | Resultado |
|---|---|---|
| **Todas** (default) | `categories` **ausente** | sin filtro |
| **Ninguna** | `categories=` (**presente, vacío**) | resultado vacío: listas vacías + totales/serie en **cero** |
| **Subconjunto** | `categories=id1,id2` (comas **sin URL-encode**) | solo esas categorías |

- El filtro afecta **gastos e ingresos** (ambos tienen categoría).
- Con **"todas"** (ausente) se siguen incluyendo movimientos cuya categoría está **soft-deleted** (RF-CAT-004). Con **subconjunto**, solo entran los `id`s del set.
- En reportes, **`earliestYear` ignora el filtro siempre** (ver §Contrato de serie de reportes).
- Front: los tres estados derivan de la preferencia/`categoryIds` correspondiente — **`null`/ausente → omitir el param**, **`[]` → `categories=`**, **lista → `categories=id1,id2`**. La coma va **literal** (no `URLSearchParams`).

### Preferencia `monthListFilters` — filtros por listado de la Vista del mes (Fase 1.2.1, RF-VM-006)

> **Destino canónico** del contrato de los filtros de `/mes`. Clave del blob `UserPreferences` (ver §Contrato de preferencias → Claves del blob). Reabre y reemplaza a `monthCategoryFilter` (1.1.6): el filtro pasa de **uno por pantalla** a **uno por sección**, con dos controles propios por sección (tipo + categoría). Persiste **por pantalla** (no por mes). Desde 1.2.1 el filtrado de `/mes` ocurre **100% en el frontend** (ver más abajo).

```
monthListFilters: {
  unicos: { type: "ALL" | "EXPENSE" | "INCOME", categories: string[] | null },
  fijos:  { type: "ALL" | "EXPENSE" | "INCOME", categories: string[] | null },
  cuotas: { type: "ALL" | "EXPENSE" | "INCOME", categories: string[] | null }
}
```

- **`type`** — filtro de tipo de la sección: `"ALL"` (Ambos, default) / `"EXPENSE"` (Gasto) / `"INCOME"` (Ingreso).
- **`categories`** — filtro de categoría de la sección, con la **misma semántica de 3 estados** que el resto del proyecto: **`null` = todas** (default, sin filtro), **`[]` = ninguna** (sección vacía), **lista = subconjunto** de `categoryId`s.
- **Default fresco por sección:** `{ type: "ALL", categories: null }`.
- **Back-compat / normalización** (igual que `monthSections`): si `monthListFilters` **no existe** → default por sección; si falta una sección o trae claves/valores raros → se completa/normaliza esa sección al default. Un blob viejo o parcial nunca rompe la pantalla.
- Es **independiente** del filtro de reportes (clave `reports`) y del filtro efímero del dashboard.
- **El back NO valida ni conoce esta clave** (igual que `monthSections` / `reports`): `PUT /preferences` guarda el blob tal cual. La normalización y los defaults son del frontend consumidor.

### Preferencia `monthCategoryFilter` — filtro de la Vista del mes (Fase 1.1.6, RF-VM-006) — **DEPRECADA (1.2.1)**

> **Deprecada en 1.2.1**, reemplazada por `monthListFilters` (arriba). Se conserva en el tipo para no romper blobs viejos, pero **`/mes` ya no la lee ni la escribe** y su valor **no se migra** a `monthListFilters` (arranque fresco). Documentada acá solo como registro del contrato histórico.

```
monthCategoryFilter: string[] | null
```

- **`null` / ausente = todas** (default, sin filtro). **`[]` = ninguna** (lista/totales en cero). **lista = subconjunto** de `categoryId`s.
- En 1.1.6 mapeaba 1:1 a los tres estados del param `categories` de `GET /movements` (tabla de arriba) y el filtrado lo hacía el backend. Desde 1.2.1 ese filtrado se movió al frontend y esta clave quedó sin uso.
