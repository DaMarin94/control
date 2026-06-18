# Control

Diario de gastos personal: registrá gastos e ingresos organizados por mes para ver en qué se te va el dinero. No es un sistema contable — su foco es la **previsibilidad**, no la conciliación ni los libros mayores.

## Stack

- **Frontend:** Next.js 15 (App Router) + Tailwind CSS v4
- **Backend:** NestJS + TypeScript + Prisma + PostgreSQL
- **Auth:** Auth.js (NextAuth v5) — Google OAuth + email/contraseña

## Estructura del repo

```
control/
├── backend/    NestJS + Prisma — API y lógica de datos
├── frontend/   Next.js 15 — interfaz web
├── docs/       documentación del proyecto (requerimientos, arquitectura, etc.)
└── .claude/    agentes y workflow del proyecto
```

`backend/` y `frontend/` son **dos proyectos independientes**: cada uno tiene su propio `package.json` y se gestiona por separado con **pnpm**. No hay workspaces ni código compartido — el contrato entre ambos es la API HTTP.

## Puesta en marcha (desarrollo)

### Requisitos

- Node.js
- pnpm (v11)
- PostgreSQL

### Backend (puerto 3001)

```bash
cd backend
cp .env.example .env          # completá los valores
pnpm install
pnpm approve-builds --all     # pnpm 11: aprueba los builds nativos
pnpm start:dev
```

### Frontend (puerto 3000)

```bash
cd frontend
cp .env.example .env.local    # completá los valores
pnpm install
pnpm approve-builds --all     # pnpm 11: aprueba los builds nativos
pnpm dev
```

> En Windows, los scripts del backend apuntan directo al binario en `node_modules` en lugar de los shims de `.bin/` (los shims son scripts bash que Node no ejecuta en Windows). Es la convención del proyecto; ver `docs/technical.md`.

## TODO
.F1 - La posibilidad de manejar diferentes monedas, el resultado final deberia ser que cada movimiento se pueda crear en una moneda en particular y con un cambio particular, osea:
yo tengo pesos y dolares, actualmente mis gastos son todos pesos SALVO algunos dolares, entonces deberia ser posible cargar un movimiento seleccionando la moneda (por defecto se setea en la moneda configurada como por defecto para ese usuario) y el valor de cambio (ya que distintos meses pueden tener distintos valores de cambio segun se vaya devaluando el peso) y sumar asi al total siempre en la misma moneda.

.F2 - Una convencion global de "ordering" en los query params del API, para que los listados se puedan pedir ya ordenados desde el backend. Hoy no hace falta para el orden de secciones de `/mes` (Fase 1.1.4) porque las preferencias del usuario ya viajan en la sesion y el orden se resuelve en el front sin round trip, pero un listado paginado o grande a futuro si se beneficiaria de ordenar server-side (no se puede reordenar en el cliente lo que no se trajo); se diseñaria cuando aparezca el primer listado que lo justifique, definiendo formato de los params, campos ordenables y direccion, de forma reutilizable entre endpoints.

.F3 - el reporte de gastos contra ingresos deberia tener un modo para que se vean por separado los datos segun las categorias

.F4 en la vista de mes, que se pueda filtrar por gastos (imagino un triple switch o similar) y que esto se pueda aplicar en cada tipo de listado junto con el filtro de categorias (que tambien deberia pasar a ser por listado)

. 1.1.3 - fix - que las flechas meses sean estaticas en eje vertical centradas como cuando el listado ocupa todo el largo.
. 1.1.4 - fix - el reordenamiento tiene que colapsar todas las columnas. El reordenamiento tiene que mantener los items en el box, no deberian flotar con el mouse, solo subir o bajar.


## Tests

Cada app guarda sus tests en una carpeta `tests/` separada de `src/` (`src/` solo contiene código; ver `docs/technical.md`).

- **Backend (Jest):**
  - `pnpm test` — tests unitarios (`tests/unit/`)
  - `pnpm test:e2e` — tests de endpoint con DB de test (`tests/e2e/`)
- **Frontend (Vitest + React Testing Library):**
  - `pnpm test` — modo watch
  - `pnpm test:run` — corrida única
  - `pnpm test:coverage` — con cobertura

## Estado del proyecto

**Fase 0 (cimientos / scaffolding) completa.** Los dos proyectos están inicializados con la infraestructura transversal lista. El plan completo de fases está en [`docs/roadmap.md`](docs/roadmap.md).

## Documentación

| Documento | Qué contiene |
|---|---|
| [`docs/roadmap.md`](docs/roadmap.md) | Plan de construcción fase por fase y su estado |
| [`docs/requirements.md`](docs/requirements.md) | Requerimientos funcionales (RF, RN, RNF) |
| [`docs/architecture.md`](docs/architecture.md) | Stack y decisiones estructurales del repo |
| [`docs/technical.md`](docs/technical.md) | Estándares técnicos transversales (logging, auth, testing, env, etc.) |
| [`docs/data-model.md`](docs/data-model.md) | Entidades y decisiones del modelo de datos |
| [`docs/screens.md`](docs/screens.md) | Definiciones funcionales de cada pantalla |
</content>
</invoke>
