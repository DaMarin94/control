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

Divergencias abiertas entre la escala de texto de [`docs/design.md`](docs/design.md) (§ Tipografía → *Escala de texto (roles)*) y el código.

- **Eyebrow del login fuera de escala.** El rol *Eyebrow / labels* es **12px / .1em**, pero el eyebrow "Bienvenido" usa **13px** en `frontend/src/app/login/page.tsx:31` y en `frontend/src/app/registro/page.tsx`. El dashboard sí cumple los 12px (`frontend/src/components/dashboard/dashboard-client.tsx:131`); falta alinear login y registro.

- **Peso del rol *Meta / subtítulos*.** La escala pide **12.5px / peso 500**; el código usa 12.5px con **peso 400** en las metas de las stat-cards del dashboard (`frontend/src/components/dashboard/dashboard-client.tsx:195` y `:222`) y en la tercera columna de la fila de movimiento (`frontend/src/components/movements/movement-item-row.tsx:396`).

- **Rol de facto sin definir en la escala** (hay que decidirlo, no solo corregir una cifra). Las etiquetas de las stat-cards usan **11.5px / .08em en `/mes`** (`frontend/src/components/movements/month-view-client.tsx:1202` y `:1227`) y **12.5px / .08em en el dashboard** (`frontend/src/components/dashboard/dashboard-client.tsx:179`, `:207`, `:251`). Ninguno de los dos cae en un rol existente —ni *Eyebrow / labels* (12px / .1em) ni *Meta / subtítulos* (12.5px / 500)—: es un rol tipográfico en uso que la escala nunca definió, y encima con dos tamaños distintos para el mismo propósito. Resolverlo implica definir el rol en la escala y unificar el código.

## Tests

Cada app guarda sus tests en una carpeta `tests/` separada de `src/` (`src/` solo contiene código; ver `docs/technical.md`).

- **Backend (Jest):**
  - `pnpm test` — tests unitarios (`tests/unit/`)
  - `pnpm test:e2e` — tests de endpoint con DB de test (`tests/e2e/`)
- **Frontend (Vitest + React Testing Library):**
  - `pnpm test` — modo watch
  - `pnpm test:run` — corrida única
  - `pnpm test:coverage` — con cobertura

## Documentación

| Documento | Qué contiene |
|---|---|
| [`docs/requirements.md`](docs/requirements.md) | Requerimientos funcionales (RF, RN, RNF) |
| [`docs/architecture.md`](docs/architecture.md) | Stack y decisiones estructurales del repo |
| [`docs/technical.md`](docs/technical.md) | Estándares técnicos transversales (logging, auth, testing, env, etc.) |
| [`docs/data-model.md`](docs/data-model.md) | Entidades y decisiones del modelo de datos |
| [`docs/screens.md`](docs/screens.md) | Definiciones funcionales de cada pantalla |
