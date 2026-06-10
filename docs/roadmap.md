# Roadmap de desarrollo — Control v1.0

> Documento de referencia con el orden de construcción del proyecto, fase por fase, respetando las dependencias reales entre módulos.
>
> Cada fase equivale a una rama. Cada fase pasa por su propio ciclo **plan → aprobación → delegación** antes de implementar; este roadmap define **qué** se construye y en **qué orden**, no reemplaza ese ciclo.
>
> El repo arranca **greenfield**: hoy solo existen `docs/` y `.claude/`. No hay carpetas `backend/` ni `frontend/` todavía — la Fase 0 las crea.

## Documentos relacionados

- **Requerimientos funcionales:** `requirements.md`
- **Definiciones de pantalla:** `screens.md`
- **Modelo de datos:** `data-model.md`
- **Estándares técnicos:** `technical.md`

---

## Convenciones del roadmap

- **Una rama por fase.** Cada fase trabaja en su propia rama; nunca se commitea directamente a `main`.
- **Backend primero.** Donde una fase toca backend y frontend, el backend va primero para fijar el contrato (DTOs / shapes de respuesta) y luego el frontend lo consume.
- **Tests en el mismo PR.** Los tests viajan en el mismo PR que el feature que cubren (política de `technical.md`).
- **Docs en el mismo commit.** La documentación (`features.md` y lo que aplique) se actualiza en el mismo commit que el código que la motiva.

---

## Resumen de fases

| Fase | Nombre | Apps | Rama | Depende de |
|---|---|---|---|---|
| 0 | Cimientos / scaffolding | Backend + Frontend (paralelo) | `chore/scaffolding` | — |
| 1 | Modelo de datos | Backend | `feat/data-model` | Fase 0 |
| 2 | Autenticación | Backend → Frontend | `feat/auth` | Fase 1 |
| 3 | Categorías | Backend → Frontend | `feat/categories` | Fase 2 |
| 4 | Movimientos únicos | Backend → Frontend | `feat/transactions` | Fase 3 |
| 5 | Vista del mes + Dashboard | Backend → Frontend | `feat/month-view-dashboard` | Fase 4 |
| 6 | Movimientos fijos | Backend → Frontend | `feat/recurring` | Fase 5 |
| 7 | Movimientos en cuotas | Backend → Frontend | `feat/installments` | Fase 6 |

---

## Fase 0 — Cimientos (scaffolding)

**Objetivo:** dejar los dos proyectos inicializados y con la infraestructura transversal lista (sobre de API, capa de datos centralizada, validación de entorno, logging). No es un feature de producto; es la base sobre la que se apoya todo lo demás.

Backend y frontend se trabajan **en paralelo** porque en esta fase son independientes: ninguno consume todavía endpoints del otro.

**Qué hace el backend (`control-backend`):**
- Inicialización de NestJS con **pnpm**.
- `ConfigModule` con validación de entorno vía **Zod**, con comportamiento **fail-fast** (si falta o es inválida una variable, el proceso no arranca).
- Logging con **Pino**, incluyendo `requestId` por request.
- Interceptor global del **sobre de respuesta**: `{ success, statusCode, data }`.
- Exception filter global que produce el **sobre de error** consistente.
- `ValidationPipe` global.
- Esqueleto de `JwtAuthGuard` (sin lógica de validación todavía; se completa en la Fase 2).
- `.env.example`.

**Qué hace el frontend (`control-frontend`):**
- Inicialización de **Next.js 15** + **Tailwind CSS v4**.
- **shadcn/ui** + **cva**.
- Capa **centralizada de API** sobre `fetch`.
- **React Query**.
- Validación de entorno con **Zod**.
- Wrapper de logging.
- Hook `useToast`.
- `.env.example`.

**Pantallas involucradas:** ninguna (scaffolding).

**Rama:** `chore/scaffolding`
**Depende de:** —

---

## Fase 1 — Modelo de datos

**Objetivo:** definir el esquema de datos completo en Prisma. Es la base de todos los endpoints posteriores: ningún módulo de backend puede construirse sin él, por lo que **bloquea todas las fases siguientes**.

**Qué hace el backend:**
- `schema.prisma` con las entidades `User`, `Category`, `Transaction`, `Recurring` e `InstallmentGroup`.
- Decisiones de modelado ya acordadas en `data-model.md`:
  - Instante de los movimientos como `occurredAt` (timestamp UTC) + `timezone` (nombre IANA).
  - Montos en **centavos** (entero).
  - **Soft delete** donde corresponde.
  - **Pool de colores** para categorías.
- Primera **migración**.
- `seed.ts` de desarrollo.

**Qué hace el frontend:** nada en esta fase.

**Pantallas involucradas:** ninguna.

**Rama:** `feat/data-model`
**Depende de:** Fase 0.

---

## Fase 2 — Autenticación

**Objetivo:** habilitar el ingreso al sistema por los dos métodos que coexisten en v1 (Google OAuth y email + contraseña), la protección de rutas y la sesión persistente. A partir de aquí toda ruta es privada y está scopeada por `userId`.

**Qué hace el backend:**
- Endpoints `POST /auth/register`, `POST /auth/login`, `POST /auth/google`.
- Emisión y validación de **JWT HS256** con secret compartido entre backend y frontend.
- Hashing de contraseñas con **argon2id**.
- `JwtAuthGuard` global (completa el esqueleto de la Fase 0).
- El alta de cuenta (por cualquiera de los dos métodos) genera las **categorías por defecto** (RF-CAT-001).

**Qué hace el frontend:**
- **Auth.js (NextAuth v5)** con los dos providers.
- Pantallas de **Login** (`/login`) y **Registro** (`/registro`).
- Protección de rutas.
- Sesión persistente.

**Pantallas involucradas:**
- Login — `/login`
- Registro — `/registro`

**Rama:** `feat/auth`
**Depende de:** Fase 1.

---

## Fase 3 — Categorías

**Objetivo:** gestión de categorías. Va **antes** que los movimientos porque todo movimiento exige una categoría, y porque el alta de cuenta (Fase 2) ya genera las 4 categorías por defecto.

**Qué hace el backend:**
- CRUD de categorías.
- **Soft delete**.
- **Scope** por usuario (aislamiento por `userId`).
- Asignación **automática de color** desde el pool fijo.
- **Contador de movimientos** por categoría.

**Qué hace el frontend:**
- Pantalla de gestión de categorías (`/categorias`).
- Modal de crear / editar categoría.

**Pantallas involucradas:**
- Gestión de categorías — `/categorias`

**Rama:** `feat/categories`
**Depende de:** Fase 2.

---

## Fase 4 — Movimientos únicos

**Objetivo:** el tipo de movimiento más simple y el corazón de la app. Una vez resuelto, el resto de los tipos (fijos y cuotas) reutiliza buena parte del modelo de carga.

**Qué hace el backend:**
- Módulo `transactions` con CRUD.
- Validación de **monto en centavos > 0**.
- Persistencia del **instante UTC** (`occurredAt`) + `timezone`.

**Qué hace el frontend:**
- Modal de carga de movimiento (tab **Único**, **Gasto** por default, fecha/hora con default "ahora", toast de confirmación con acción "Ir a ver").
- Editar movimiento único.
- Eliminar movimiento único.

**Pantallas involucradas:**
- Formulario de carga de movimiento (modal, sin ruta propia).

**Rama:** `feat/transactions`
**Depende de:** Fase 3.

---

## Fase 5 — Vista del mes + Dashboard

**Objetivo:** las pantallas de visualización. Se construyen después de los únicos porque ya hay datos reales para poblarlas. El endpoint unificado `GET /movements` se diseña **contemplando fijos y cuotas** desde el inicio, aunque esos tipos todavía no existan, para no rehacerlo después.

**Qué hace el backend:**
- `GET /movements?month=YYYY-MM` unificado, con la estructura preparada para incorporar fijos y cuotas en las fases siguientes.
- Cálculo de **totales** del mes.

**Qué hace el frontend:**
- Pantalla **Vista del mes** (`/mes`): lista agrupada por tipo, navegación mes anterior / mes siguiente, totales que se actualizan al mutar.
- **Dashboard** (`/`): resumen del mes actual, enlace "Ver todos", y estado vacío con CTA "Cargá tu primer movimiento".

**Pantallas involucradas:**
- Vista del mes — `/mes`
- Dashboard — `/`

> **Decisión (2026-06-09) — Sidebar (RF-NAV-001) diferido. → RESUELTO (2026-06-10): implementado.** En esta fase el sidebar de navegación global se difirió; la navegación interina entre `/`, `/mes` y `/categorias` se hacía con los **accesos definidos en cada pantalla** (enlace "Ver todos" del dashboard, acción "Ir a ver" del toast post-guardado, URL directa). **El sidebar ya se implementó** post-Fase 7, como **feature frontend independiente fuera de la secuencia de fases** (no en Fase 5): las tres pantallas autenticadas viven bajo el route group `app/(app)/` con un layout compartido que monta el sidebar. Ver bitácora de `requirements.md` (2026-06-10) y `docs/frontend.md` (sección Navegación global).

**Rama:** `feat/month-view-dashboard`
**Depende de:** Fase 4.

---

## Fase 6 — Movimientos fijos

**Objetivo:** plantillas recurrentes mensuales que se calculan on-the-fly por mes.

**Qué hace el backend:**
- Módulo `recurring`: crear, editar y eliminar.
- Eliminación con opción `deleteFromCurrentMonth`.
- **Inmutabilidad del pasado** (los meses anteriores al actual nunca se modifican).
- **Cálculo on-the-fly** de qué fijos caen en cada mes consultado.

**Qué hace el frontend:**
- Tab **Fijo** del modal de carga.
- Visualización del fijo dentro de la vista del mes.
- Eliminación con checkbox "Eliminar también desde este mes".

**Pantallas involucradas:**
- Formulario de carga de movimiento (modal, tab **Fijo**).
- Vista del mes — `/mes`

**Rama:** `feat/recurring`
**Depende de:** Fase 5.

---

## Fase 7 — Movimientos en cuotas

**Objetivo:** compras divididas en N pagos mensuales iguales. Es el último por ser el más complejo, y porque `GET /movements` ya previó su inclusión desde la Fase 5.

**Qué hace el backend:**
- Módulo `installments`: crear grupo, editar grupo completo, eliminar grupo completo.
- **Cálculo on-the-fly** de en qué meses caen las cuotas.

**Qué hace el frontend:**
- Tab **Cuotas** del modal de carga.
- Ítems "X/N" en la lista del mes.
- Editar / eliminar grupo de cuotas.

**Pantallas involucradas:**
- Formulario de carga de movimiento (modal, tab **Cuotas**).
- Vista del mes — `/mes`

**Rama:** `feat/installments`
**Depende de:** Fase 6.

---

## Criterio del orden

El orden de las fases no es arbitrario; sigue las dependencias reales del sistema:

- **Cimientos primero** porque el repo está vacío y todo lo demás depende de la infraestructura transversal: el sobre de API, la capa de datos centralizada y el auth guard.
- **Modelo de datos** a continuación porque **todo endpoint lo necesita**: sin esquema no hay nada que exponer.
- **Autenticación** antes que cualquier feature porque **toda ruta es privada** y está scopeada por `userId`; sin auth no se puede construir nada aislado por usuario.
- **Categorías antes que movimientos** porque **un movimiento exige una categoría**, y el alta de cuenta ya genera las 4 por defecto.
- **Movimientos únicos antes que la vista del mes y el dashboard** porque esas pantallas necesitan **datos reales** para poblarse y validarse.
- **Fijos y cuotas al final** por ser los tipos **más complejos**, y porque el endpoint `GET /movements` ya los previó desde la Fase 5, evitando rehacerlo.
