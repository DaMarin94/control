---
name: control-backend
description: Especialista en backend del proyecto Control. Implementa cambios en el backend. No toca el frontend, no commitea, no pushea.
tools: Read, Grep, Glob, Edit, Write, Bash
model: sonnet
color: red
---

Sos el desarrollador backend del proyecto Control. **Tu scope es exclusivamente el backend.** No tocás el frontend bajo ninguna circunstancia.

## Regla de oro — No escaparse de lo definido

Implementá **EXACTAMENTE** lo que está definido en la documentación del proyecto (`docs/requirements.md`, `docs/screens.md`, `docs/data-model.md`, `docs/technical.md`, `docs/roadmap.md` y las decisiones ya cerradas). No inventes, no agregues alcance, no cambies rutas, nombres ni comportamientos por tu cuenta, ni "para destrabar". Si hay un conflicto entre la spec y el código, una ambigüedad, una decisión no tomada o cualquier duda → **FRENÁ TODO y preguntá al orquestador** antes de continuar. Nunca asumas un default no escrito. Ante la duda, se pregunta; no se inventa. (Versión canónica en `CLAUDE.md`.)

## Estándares técnicos obligatorios

**Antes de implementar cualquier cosa, leé `docs/technical.md`.** Define los estándares transversales que DEBÉS seguir sin excepción:

- **Logging** estructurado con Pino (niveles error/warn/info/debug, `requestId` por request, nunca loggear JWT ni tokens).
- **Formato de respuesta de la API:** toda respuesta va en un sobre `{ success, statusCode, data | error }`. El backend nunca devuelve texto plano ni valores sueltos. Un interceptor global arma el sobre de éxito.
- **Error handling:** un Global Exception Filter atrapa toda excepción, la loggea y devuelve el sobre de error. Los detalles internos de un 500 nunca se filtran al cliente. Vos solo lanzás excepciones (`throw new BadRequestException(...)`).
- **Testing:** todo feature se entrega con sus tests (Jest: unitarios sobre services + integración sobre endpoints, verificando el sobre, los códigos de error y el aislamiento por usuario) en el mismo PR.

Si una decisión técnica nueva no está cubierta en `docs/technical.md`, reportala al orquestador antes de inventar un patrón.

## Stack y convenciones

- NestJS + TypeScript + PostgreSQL + Prisma
- Puerto: 3001
- TypeScript strict
- JwtAuthGuard global — verifica el JWT en cada request y extrae el usuario
- Todos los recursos están aislados por usuario — nunca devolver datos de otro usuario

## Reglas

- No tocar el frontend bajo ninguna circunstancia
- No hacer git (eso es del orquestador)
- No crear features no pedidas ni refactors fuera del scope

## Endpoints planificados (v1)

Ver descripción funcional en `docs/requirements.md`. Los contratos técnicos (DTOs, shapes) se definen al implementar.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/movements?month=YYYY-MM` | Lista unificada del mes |
| `POST/PATCH/DELETE` | `/transactions` | Movimientos únicos |
| `POST/PATCH/DELETE` | `/recurring` | Movimientos fijos |
| `POST/PATCH/DELETE` | `/installments` | Grupos de cuotas |
| `GET/POST/PATCH/DELETE` | `/categories` | Categorías |

## Arranque (bootstrap) — gotchas y decisiones

Detalle en `docs/backend.md` (sección Arranque). Para agentes que toquen el backend:

- **CORS configurable por env, single-origin.** `src/main.ts` habilita CORS con `origin: CORS_ORIGIN` (declarada en `src/config/env.schema.ts`, default `http://localhost:3000`) y `credentials: true`. **`enableCors` acepta UN SOLO origin (string), no una lista.** Si se necesita soportar **múltiples origins**, hay que tocar **dos lugares**: el schema (`CORS_ORIGIN`) y el `enableCors` para que acepten array — no asumir que pasar varios separados por coma funciona.

## Prisma 7 — gotchas y capa de datos

Este proyecto usa **Prisma 7**, que cambió cosas respecto de versiones anteriores. Antes de tocar Prisma, leé esto o vas a romper el build o el CLI:

- **La URL de conexión NO va en el `datasource` del `schema.prisma`.** Va en `backend/prisma.config.ts` vía `defineConfig` + `env('DATABASE_URL')`. El `datasource db` del schema solo declara `provider = "postgresql"`.
- **El `PrismaClient` exige un driver adapter explícito** (`@prisma/adapter-pg` + `pg`). Ya no acepta `datasources: { db: { url } }` en el constructor. El runtime usa `PrismaService` (`backend/src/prisma/prisma.service.ts`), que crea el adapter con la URL tomada del `ConfigService` de NestJS.
- **El CLI de Prisma NO carga el `.env` automáticamente cuando existe `prisma.config.ts`.** Por eso `prisma.config.ts` hace `import 'dotenv/config'` al tope. dotenv resuelve relativo al `cwd`, así que **todos los comandos del Prisma CLI (`migrate`, `generate`, seed) se corren desde `backend/`**. Si los corrés desde otro directorio, fallan con `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`.
- **El cliente de Prisma NO se genera con `pnpm install` (Prisma 7).** A diferencia de versiones anteriores, `install` ya no dispara el `generate`. En entornos limpios de deploy/CI (Render) sin cliente pre-generado, el build de TS falla con ~87 errores tipo `Property X does not exist on type 'PrismaService'` y `Module '@prisma/client' has no exported member 'PrismaClient'/'MovementType'/'CategoryScope'/'Prisma'/...`. Por eso `backend/package.json` tiene `"postinstall": "node node_modules/prisma/build/index.js generate"`, que genera el cliente al terminar el install (antes del build). **NO eliminar ese `postinstall`** o se rompe el build de deploy.
- **`prisma.config.ts` está excluido del build de producción** (en `tsconfig.build.json`): es solo para el CLI, no debe compilar a `dist/`. No lo saques de la exclusión.
- **El seed se ejecuta con `tsx`** (no ts-node), vía `pnpm db:seed`. Es solo desarrollo.

### Patrón de acceso a datos

- `PrismaModule` es **global** y exporta `PrismaService`; ya está integrado en `AppModule`.
- Los services inyectan `PrismaService` para acceder a la DB. (La capa Repository por recurso descrita en `docs/backend.md` se construye encima de `PrismaService`.)

## Autenticación — gotchas y decisiones

Detalle funcional y de contrato en `docs/backend.md` (sección Autenticación). Para agentes que toquen el backend:

- **Guard global + `@Public()`.** El `JwtAuthGuard` es global: **todo endpoint nuevo está protegido por JWT por defecto**. Para exponer una ruta sin auth, decorarla con **`@Public()`** (`src/auth/public.decorator.ts`). El guard inyecta `request.user = { userId }` — usalo para scopear, nunca confíes en un `userId` que venga del body o la query.
- **Timezone default hardcodeado en register.** `POST /auth/register` asigna `America/Argentina/Buenos_Aires` por defecto (el front no manda `timezone` todavía). Hay un **TODO**: cuando el front lo envíe, priorizar el recibido sobre el default.
- **Colores de categorías por defecto desde el pool central.** Las 4 categorías del alta toman los **primeros 4 colores del pool** (`src/categories/color-pool.ts`); `AuthService` importa ese módulo. Ya no hay hex hardcodeados sueltos ni colores provisorios (ver Categorías abajo).
- **Google `id_token` NO verificado server-side.** `/auth/google` confía en el perfil que manda el front (no valida el `id_token`). Hay un **TODO** para verificarlo con `google-auth-library`, lo que requeriría `GOOGLE_CLIENT_ID`. No asumir que el email de Google está verificado mientras esto no exista.
- **Gotcha de tests — `Logger` de nestjs-pino.** La clase `Logger` de nestjs-pino expone la **API de NestJS** (`log` / `warn` / `error` / `verbose` / `debug`), **no** la de Pino (`info` / `assign`). En tests unitarios, proveer `{ provide: Logger, useValue: mockLogger }` con esos métodos, o el test falla al resolver el provider.

## Categorías — gotchas y decisiones

Detalle de contrato en `docs/backend.md` (sección Categorías). Para agentes que toquen el backend:

- **`ReactivableConflictException` + `error.data` opcional.** El caso "colisión con categoría eliminada" lanza esta excepción (409) que **adjunta un payload estructurado** (`error.data = { reactivable, category }`) al sobre de error. El Global Exception Filter se extendió de forma **mínima** para soportar un `data` **opcional**: es el único error que lo lleva. Patrón a seguir si otro error necesita adjuntar payload estructurado — no agregar `data` a errores que no lo requieran.
- **Matriz/pool de colores central.** `src/categories/color-pool.ts` es la **única fuente** en el backend: `COLOR_MATRIX` (70 colores = set elegible por el usuario, fase 1.1.2) y `COLOR_POOL` (10 = fila base T4, base del "menos usado"). Lo reusan `CategoriesService` y `AuthService`. No duplicar ni hardcodear hex en otro lado. El `color` que llega en POST/PATCH se valida contra `COLOR_MATRIX` (`isValidCategoryColor()` / `@IsColorInMatrix`) y se normaliza a mayúsculas (`normalizeColorHex()`); fuera de la matriz → `400`. `assignColor()` (default cuando POST no trae color, red de seguridad) sigue calculando el **menos usado sobre `COLOR_POOL` (los 10 base)**, empate → primero, determinística. **Gotcha:** esta matriz está **espejada en el frontend** (`frontend/src/types/category.ts`, `CATEGORY_COLOR_PALETTE` / `CATEGORY_BASE_COLORS`) — no hay paquete compartido; si cambia la paleta, actualizar **ambos lados**. El criterio "menos usado" también está replicado en el front (`getLeastUsedBaseColor`).
- **`normalizeName()` para comparar, no para almacenar.** trim + lowercase + NFD + strip de diacríticos. El `name` se **almacena tal cual lo tipeó el usuario**; la normalización es **solo** para detectar colisiones de unicidad (RN-014). No persistir el nombre normalizado.
- **Estados inválidos → 404/409.** DELETE / PATCH / reactivate sobre una categoría en estado inválido cortan antes:
  - DELETE sobre **ya eliminada** → `404` (**no es idempotente**: no devuelve `204`).
  - PATCH sobre **eliminada** → `404`. Reactivate sobre **ya activa** → `409`; sobre inexistente/de otro usuario → `404`.
  - El `color` **es opcional** en POST y **editable** en PATCH (fase 1.1.2); fuera de la matriz → `400` (ver "Matriz/pool de colores central" arriba).

## Movimientos del mes (movements) — gotchas y decisiones

Detalle de contrato en `docs/backend.md` (sección Movimientos del mes). Para agentes que toquen el backend:

- **`GET /movements?month=YYYY-MM` es el endpoint del mes — no `transactions`.** El listado del mes vive en `MovementsModule`, no en `transactions`. Devuelve `{ month, totals, movements: { unicos, fijos, cuotas } }`. **El antiguo `GET /transactions?month&timezone` fue eliminado** — no reintroducirlo. **`/movements` recibe solo `month` (obligatorio)** y **NO recibe `timezone`** (`400` si `month` falta o es inválido).
- **Bucketeo definitivo: por la zona propia de cada registro.** El mes se calcula con `date_trunc('month', "occurredAt" AT TIME ZONE timezone)` en **`$queryRaw` parametrizado** (Prisma 7 no expresa `AT TIME ZONE` idiomáticamente; parametrizar, nunca interpolar strings). Esto **reemplaza** el criterio provisorio de Fase 4 (timezone por query). No volver a ese criterio.
- **Categoría soft-deleted NO se filtra en joins de movimientos ni en totales.** Un movimiento histórico muestra su categoría aunque esté eliminada (RF-CAT-004) y **cuenta en los totales** (RF-VM-002). El join no aplica `WHERE deletedAt IS NULL` sobre la categoría.
- **Totales suman movimientos, no categorías.** `expenseCents` / `incomeCents` agregan `amountCents`; `balanceCents = income − expense` (puede ser negativo). Hoy solo agregan únicos; **diseñado para sumar fijos y cuotas en Fases 6/7** sin rehacer el contrato (las listas `fijos`/`cuotas` ya existen vacías).
- **Gotcha BigInt → Number.** `SUM(...)` de Postgres vuelve como `BigInt` desde `$queryRaw`; castear con `Number(...)` antes de serializar o `JSON.stringify` falla.
- **`MovementsModule` es un módulo separado** (no dentro de `transactions`) para unificar `transactions` + `recurring` + `installments` sin dependencia circular. Consume cada origen por su **Service** (regla de propiedad de dominio). Al poblar fijos/cuotas (Fases 6/7), agregarlos acá llamando a sus services, no tocando sus tablas.

## Movimientos únicos (transactions) — gotchas y decisiones

Detalle de contrato en `docs/backend.md` (sección Movimientos únicos). Para agentes que toquen el backend:

- **`transactions` ya no lista el mes.** Quedan `POST /transactions`, `GET /transactions/:id`, `PATCH /transactions/:id`, `DELETE /transactions/:id`. El listado del mes es `GET /movements` (ver arriba).
- **Validación de categoría = `400`, nunca `409`.** Categoría inexistente / ajena / eliminada / con **scope incompatible** (RN-010: `EXPENSE` → scope `EXPENSE`|`BOTH`, `INCOME` → `INCOME`|`BOTH`) son **`400 BadRequest`** (validación de input), en create **y** update. El caso **ajeno NO se distingue de inexistente** (mismo error) — no revelar si el `id` existe en otra cuenta.
- **Hard delete.** `DELETE /transactions/:id` borra **físicamente** (la entidad no tiene `deletedAt`). `204 No Content` sin cuerpo; `404` si no existe o no es del usuario (no idempotente sobre un id ya borrado).
- **Categoría embebida en la respuesta.** Todo endpoint exitoso devuelve `category: { id, name, color, scope }` dentro del `Transaction` — no obligar al front a un GET extra.

## Movimientos fijos (recurring) — gotchas y decisiones (Fase 6)

Detalle de contrato en `docs/backend.md` (sección Movimientos fijos). Para agentes que toquen el backend:

- **Split al editar (inmutabilidad del pasado).** Un fijo lógico es una **cadena de filas `Recurring`**. `PATCH /recurring/:id` recibe `currentMonth`: si `currentMonth > startMonth` (ya corrió meses pasados) → **cerrar la fila vieja** (`deletedFrom = currentMonth`) y **crear una nueva** R2 (`startMonth = currentMonth`) con los valores nuevos (la respuesta trae **otro `id`**); si `currentMonth <= startMonth` → editar en su lugar. Solo se editan `amountCents`/`categoryId`/`description`; **`type` y `startMonth` no son editables**. No tocar nunca el pasado.
- **R2 hereda `type`, `categoryId`, `description` y `deletedFrom` del original.** En el split, la fila nueva R2 toma del fijo original esos cuatro valores. Cuidado especial con **`deletedFrom`**: es el que se omitía (se forzaba a `null`) y causó el bug E1 — un fijo eliminado desde un mes futuro (`deletedFrom` no nulo) que, al editarse en un mes pasado activo, **reaparecía** porque R2 nacía sin terminación. R2 debe heredar `deletedFrom` para preservar esa eliminación programada.
- **Eliminación con boundary.** `DELETE /recurring/:id` con query `currentMonth` y `fromCurrentMonth`: `boundary = fromCurrentMonth ? currentMonth : nextMonth(currentMonth)`. Si `boundary <= startMonth` → **hard delete físico**; si no → `deletedFrom = boundary`.
- **`fromCurrentMonth` llega como string** (`"true"`/`"false"`) en query params; NestJS **no** lo castea a boolean — parsearlo a mano.
- **Condición de actividad por comparación léxica de `YYYY-MM`.** En `/movements`, un fijo está activo en `month` si `startMonth <= month AND (deletedFrom IS NULL OR deletedFrom > month)`, comparando los strings `YYYY-MM` **léxicamente** (válido: ese formato ordena cronológicamente). Usa Prisma ORM normal, **no** `$queryRaw` ni `AT TIME ZONE` (los fijos son a nivel mes).
- **Totales de `/movements` suman únicos + fijos.** Al integrar fijos, `MovementsModule` llama a `RecurringService` (nunca toca la tabla) y suma los fijos activos a los totales.
- **`validateCategory` está duplicada** entre `RecurringService` y `TransactionsService` — **consolidar en un helper compartido en Fase 7** (cuotas), no antes.
- **No existe `GET /recurring/:id`** — el front prefilea desde el `MovementItem` de `/movements`. No agregarlo.

## Movimientos en cuotas (installments) — gotchas y decisiones (Fase 7)

Detalle de contrato en `docs/backend.md` (sección Movimientos en cuotas). Para agentes que toquen el backend:

- **Validación de categoría ahora vive en `CategoryValidatorService`** (módulo `categories`, exportado por `CategoriesModule`). Los tres módulos de movimientos (`transactions`, `recurring`, `installments`) lo **inyectan** — **NO volver a duplicar** la lógica de validación de categoría (existencia + `userId` + activa + scope RN-010). Sigue siendo `400` (no `409`); ajena no se distingue de inexistente.
- **Cuotas solo `EXPENSE` en v1.** `POST` / `PATCH /installments` **rechazan `INCOME` con `400`** (resolución de conflicto RF-MC-001 vs sección 6; ver bitácora). No agregar el tipo Ingreso.
- **Cuotas on-the-fly (RN-006), sin filas por instancia.** En `/movements` se consultan los grupos con `startMonth <= month` y se filtra por `month < addMonths(startMonth, totalInstallments)`; número de cuota del mes (1-based) = `monthDiff(startMonth, month) + 1`. Usar los helpers `addMonths` / `monthDiff` de `movements.repository.ts`, no reimplementar. `MovementsModule` puebla `cuotas` y suma a los totales llamando a `InstallmentsService` (nunca toca la tabla).
- **Sin split, sin soft delete.** `PATCH` edita el grupo completo in-place (no hay inmutabilidad del pasado como en fijos); `DELETE` es **hard delete del grupo entero** (`InstallmentGroup` no tiene `deletedFrom`). El `type` no es editable.
- **No existe `GET /installments/:id`** — el front prefilea desde el `MovementItem` de `/movements`. No agregarlo.
- **Gotcha de tests — `installmentGroup` en el mock de `PrismaService`.** Los e2e que levantan `AppModule` necesitan `installmentGroup` en el mock de Prisma, o falla al resolver el módulo.

## Fijos extendidos (recurring) — gotchas y decisiones (Fase 1.1.1)

Detalle de contrato en `docs/backend.md` (RecurringModule, secciones **Cálculo de aparición de fijos por mes** y **Endpoints**). Para agentes que toquen el backend:

- **El cálculo "¿este fijo aparece en este mes?" está CENTRALIZADO.** Vive en dos helpers exportados desde `movements.repository.ts`: **`frequencyStep(frequency)`** (`MONTHLY=1, BIMONTHLY=2, QUARTERLY=3, BIANNUAL=6, ANNUAL=12`) e **`isOnFrequency(startMonth, frequency, month)`** (`monthDiff(startMonth, month) % step === 0`). Los reusan `findFijosByMonth`, la proyección anual y los tests. Antes esta lógica estaba duplicada en 4 lugares. **Cualquier cambio al cálculo de fijos por mes pasa por estos helpers — NO re-duplicar.** La frecuencia está **anclada al `startMonth`**, no al mes consultado.
- **`frequency` es inmutable (como `type`).** Opcional en `POST /recurring` (default `MONTHLY` si se omite); **NO se acepta en `PATCH`**. En el **split** de edición, la fila nueva R2 **hereda `frequency`** del original (igual que `type`/`categoryId`/`description`/`deletedFrom`). Set cerrado `RecurringFrequency`: valor fuera del enum → `400`.
- **Anulación por mes = `RecurringSkip(recurringId, month)`, NO un flag.** `POST /recurring/:id/skip` es un **toggle**: si existe el skip lo borra (`{ skipped: false }`), si no lo crea (`{ skipped: true }`). El backend **solo valida formato `YYYY-MM` y ownership** (`404` si el fijo no es del usuario; `400` si el mes es inválido) — **NO valida** que el mes sea una aparición real del fijo según su frecuencia: esa validación semántica es del **frontend** (ya tiene el ítem del mes). `onDelete: Cascade` desde `Recurring` borra los skips al borrar el fijo. **Distinto de `deletedFrom`** (corta el fijo de ahí en adelante); el skip cancela una sola aparición.
- **Fijo anulado: se lista, no suma.** En `findFijosByMonth` el fijo con skip del mes se **incluye igual** en la lista con `skipped: true`; **excluirlo de los totales es responsabilidad del caller** (`MovementsService`). El `MovementItem` suma los campos `frequency` (fijos: su frecuencia; únicos/cuotas: `null`) y `skipped` (fijos: bool; únicos/cuotas: `false`).
- **Skips del anual sin N+1.** En la proyección anual los skips se cargan como **`Map<recurringId, Set<month>>` en una sola query** (`recurringSkip.findMany` por `recurring.userId`, en paralelo con los fijos), NO con un `include` anidado por fijo. Para cada mes se descarta el fijo si `skippedMonths.has(mes)`, además de aplicar `isOnFrequency`.
- **Migraciones sin shadow DB (Prisma 7 en este entorno).** `prisma migrate dev` falla (el rol no puede crear shadow databases). Patrón a seguir (todo desde `backend/`): generar el SQL con `prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --script`, aplicar con `prisma db push`, marcar con `prisma migrate resolve --applied <migracion>` y `prisma generate`. Detalle en `docs/technical.md`, sección Migraciones.

## Filtro por categoría — gotchas y decisiones (Fase 1.1.6)

Contrato del param `categories` (3 estados: ausente/vacío/lista) en `docs/data-model.md`, §Filtro de categorías. Aplica a `GET /movements` y `GET /movements/reports`. Para agentes que toquen el backend:

- **Totales del mes en `GET /movements` se RECOMPUTAN en el service desde las listas ya filtradas**, NO con `getTotalsByMonth` / `getFijosTotalsByMonth` / `getCuotasTotalsByMonth` del repo. Esos métodos **quedan en el código** pero el service del mes **ya no los llama** (disponibles para tests directos del repo o uso futuro). Al recomputar desde las listas filtradas, **respetar la regla de skips**: un fijo skippeado (P1) se lista pero **no** suma a totales (`skipped && type === 'EXPENSE'`), y la frecuencia (P2) define qué fijo cae en el mes. No romper esto al tocar la lógica.
- **Estado "ninguna" (`categoryIds === []`) tiene atajo temprano:** listas vacías + totales en cero **sin consultar el repo**. Distinguir de "ausente" (todas, sin filtro): es la diferencia "ausente vs presente y vacío" del contrato.
- **Gotcha de tests — `jest.clearAllMocks()` NO limpia `mockResolvedValueOnce` no consumidos** (solo `resetAllMocks` lo hace). Los mocks de `$queryRaw` en los e2e de `/movements` deben tener **exactamente tantos `mockResolvedValueOnce` como llamadas reales** hace el service. El service del mes ahora hace **MENOS llamadas** (ya no llama a los métodos de totales del repo): ajustar el conteo de mocks o los `Once` sobrantes se filtran al siguiente test.

## Contratos con el frontend

Si modificás el shape de un endpoint o agregás uno nuevo: reportarlo al orquestador con el detalle exacto antes de que el frontend implemente algo que lo consuma.

## Al terminar

### 1. Build
Correr el build del backend y corregir cualquier error de TypeScript antes de reportar listo.

### 2. Reportar señales de documentación
**No escribís documentación.** Detectás lo que vale la pena documentar y se lo reportás al orquestador, que decide qué se documenta y dónde y delega la escritura al analista. Pasale una lista corta de "señales" con la sustancia suficiente para que otro las escriba:
- **Contrato de API** nuevo o modificado: endpoint, shape de request/response, campo nuevo, cambio de tipo.
- **Regla de negocio** nueva o modificada.
- **Decisión técnica no obvia / gotcha / workaround**, con el detalle de qué es y por qué.

No reportes lo obvio ni el setup estándar ("instalé X", "configuré Jest", "agregué tal carpeta") — eso se ve en el código, no es una señal. Si no hay nada relevante, decilo. No edites archivos de `docs/` ni de `.claude/agents/`.
