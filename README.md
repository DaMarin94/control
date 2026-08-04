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

P1 - Historial: extender el registro a las creaciones de movimientos.
P1 - Historial: extender el registro a las anulaciones (skip).
P1 - Historial: extender el registro al ABM de categorías y de métodos de pago.
P1 - Toast de éxito con botón "Deshacer" para revertir la acción de forma inmediata, sin ir a `/historial`.
P1 - Analizar si hay una forma mejor de almacenar los movimientos fijos: la cadena de splits con `chainId` obliga a que el historial agrupe por cadena y no por fila.
P1 - Historial: la expresión de `Fórmula` formatea el operando de sumas y restas con la moneda default del usuario como aproximación, porque la entrada no expone la moneda propia del calculado. Afecta solo el símbolo mostrado, no el dato guardado.
P1 - `backend/src/recurring/recurring.repository.ts` expone tres métodos sin callers (`findActiveRowByChainId`, `findSkipsForRecurring`, `findAllSkipsForUser`): evaluar si se eliminan.

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
