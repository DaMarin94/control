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

0 - Historial: extender el registro a las creaciones de movimientos.
1 - Historial: extender el registro a las anulaciones (skip).
2 - Historial: extender el registro al ABM de categorías y de métodos de pago.
3 - Toast de éxito con botón "Deshacer" para revertir la acción de forma inmediata, sin ir a `/historial`.
4 - Analizar si hay una forma mejor de almacenar los movimientos fijos: la cadena de splits con `chainId` obliga a que el historial agrupe por cadena y no por fila.
5 - Historial: la expresión de `Fórmula` formatea el operando de sumas y restas con la moneda default del usuario como aproximación, porque la entrada no expone la moneda propia del calculado. Afecta solo el símbolo mostrado, no el dato guardado.
6 - `backend/src/recurring/recurring.repository.ts` expone tres métodos sin callers (`findActiveRowByChainId`, `findSkipsForRecurring`, `findAllSkipsForUser`): evaluar si se eliminan.
7 - El `DATABASE_URL` del backend usa el endpoint pooler de Neon, pero Neon recomienda el endpoint directo (sin `-pooler`) para migraciones porque el pooler puede fallar con los advisory locks de Prisma: evaluar separar la URL de migraciones de la de runtime.
8 - La función que deriva la fecha local en `YYYY-MM-DD` (getters locales de `Date`, nunca `toISOString()`) está duplicada en cinco archivos del frontend (`use-movements.ts`, `use-simulations.ts`, `use-reports.ts`, `unique-grid-card.tsx`, `inflation-income-card.tsx`), cada copia con un comentario cruzado al resto. El riesgo: alcanza con que un consumidor nuevo se olvide de mandar `today` para reabrir un borde de fin de mes en UTC−N, y ningún test lo detecta. Evaluar extraerla a un helper compartido en `lib/`.
9 - Cinco archivos de test del frontend tienen errores de `tsc` propios del archivo de test (`inflation-income-card.test.tsx`, `month-jump-popover.test.tsx`, `use-default-payment-method-prefill.test.tsx`, `use-preferences.test.tsx`, `use-reports.test.tsx`). No rompen la suite ni el build —los tests corren verdes—: evaluar si se corrigen los tipos o se acepta la deuda.

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
