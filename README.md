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

Pendientes abiertos, agrupados por naturaleza.

### Diálogos y overlays

- **Líneas de consecuencia y cajas de detalle fuera de la escala.** El rol *Nota / fine print* de [`docs/design.md`](docs/design.md) (§ Tipografía → *Escala de texto (roles)*) es **12.5px**, pero cinco lugares usan `text-[13px]`: `frontend/src/app/(app)/configuracion/categorias/reactivation-prompt.tsx:71`, `frontend/src/app/(app)/configuracion/metodos-pago/reactivation-prompt.tsx:76`, `frontend/src/components/history/undo-confirm-modal.tsx:46`, `frontend/src/components/movements/delete-installment-dialog.tsx:71` y `frontend/src/components/movements/delete-recurring-dialog.tsx:107`. No es un cambio de cifra: son **cajas que contienen dato, no prosa**, así que primero hay que decidir si pertenecen a *Nota / fine print* (12.5/400) o a *Meta / subtítulos* (12.5/500). Requiere relevamiento de `control-design` antes de implementar.

- **Robustez del patrón de popover portaleado.** `frontend/src/components/ui/section-filter-popover.tsx` mide su panel con `scrollHeight`, inmune al `maxHeight` ya aplicado por la primera pasada (ver `docs/frontend.md` § *Overlay portaleado con posicionamiento en dos pasadas*). El hook compartido `frontend/src/hooks/use-listbox-popover.ts` —usado por `PaymentMethodSelect`, `LimitCategorySelect` y `LimitAnchorPicker`— mide con `getBoundingClientRect()`, que tiene la **misma fragilidad latente**: no se manifiesta porque esos paneles tienen contenido corto y nunca llegan al branch de clamp. A evaluar: unificar el hook compartido al mismo criterio.

### Reportes

- **Moneda de cálculo elegible en los modos de variación.** Los modos de variación de la card "Detalle histórico de gastos fijos" se calculan sobre los montos **convertidos a la moneda de display** de la card (RF-REP-013, `docs/requirements.md:2136`), así que un fijo en moneda extranjera mezcla dos efectos: lo que le aumentó el proveedor y lo que se movió el tipo de cambio. Son dos lecturas legítimas y distintas —*"cuánto más plata me salió"* vs. *"cuánto me aumentaron el servicio"*—. A evaluar: ofrecerlas como opción explícita del usuario. Antes de decidir hay que analizar el alcance: si aplica solo a esta card o también a `inflation-income` (RF-REP-012, `docs/requirements.md:2076`) y a cualquier otra lectura porcentual, y qué implica en el contrato del endpoint.

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
