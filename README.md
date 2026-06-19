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

Los pendientes **F1, F3, F4** y los dos fixes de **1.1.3 / 1.1.4** están **planificados en [`docs/roadmap-v1.2.md`](docs/roadmap-v1.2.md)** (multi-moneda, toggle por categoría en reportes, filtros por listado y los polish de `/mes`).

- **F2 — convención global de _ordering_ en los query params del API** queda **diferido, fuera de v1.2**: sigue sin haber un listado paginado o grande que lo justifique. Se diseñará cuando aparezca el primer listado que lo amerite, definiendo formato de los params, campos ordenables y dirección, de forma reutilizable entre endpoints.


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

**v1.0 (Fases 0–7) y v1.1 (Fases 1.1.0–1.1.8) completas.** v1.2 está **planificada** en [`docs/roadmap-v1.2.md`](docs/roadmap-v1.2.md). El plan histórico vive en [`docs/roadmap.md`](docs/roadmap.md) (v1.0) y [`docs/roadmap-v1.1.md`](docs/roadmap-v1.1.md) (v1.1).

## Documentación

| Documento | Qué contiene |
|---|---|
| [`docs/roadmap.md`](docs/roadmap.md) | Plan de construcción de v1.0 fase por fase (histórico) |
| [`docs/roadmap-v1.1.md`](docs/roadmap-v1.1.md) | Plan de construcción de v1.1 (histórico) |
| [`docs/roadmap-v1.2.md`](docs/roadmap-v1.2.md) | Plan de construcción de v1.2 (planificado) |
| [`docs/requirements.md`](docs/requirements.md) | Requerimientos funcionales (RF, RN, RNF) |
| [`docs/architecture.md`](docs/architecture.md) | Stack y decisiones estructurales del repo |
| [`docs/technical.md`](docs/technical.md) | Estándares técnicos transversales (logging, auth, testing, env, etc.) |
| [`docs/data-model.md`](docs/data-model.md) | Entidades y decisiones del modelo de datos |
| [`docs/screens.md`](docs/screens.md) | Definiciones funcionales de cada pantalla |
