# Control — Contexto del proyecto

## Estructura

```
control/
├── backend/          NestJS + TypeScript + PostgreSQL + Prisma  (puerto 3001)
└── frontend/
    ├── shared/       Tipos y helpers compartidos (@control/shared)
    └── web/          Next.js 15 + Tailwind CSS v4  (puerto 3000)
```

Ver `docs/` para documentación detallada de arquitectura, pipeline de datos y features.

## Stack y configuración

- TypeScript strict en ambos lados: `noUnusedLocals`, `noUnusedParameters` activos
- Si algo se comenta o desactiva en la UI, limpiar el estado/funciones asociadas para que el build no falle
- El frontend lee la URL del backend desde `NEXT_PUBLIC_API_URL` (`.env.local`)
- `@control/shared` se resuelve via path alias de Next.js/TypeScript hacia `frontend/shared/src/`

## Comandos frecuentes

```bash
# Dev
cd backend && npm run dev          # http://localhost:3001
cd frontend/web && npm run dev     # http://localhost:3000

# Build
cd frontend/web && npm run build
cd backend && npm run build
```

## Agentes

El workflow de este proyecto está manejado por agentes en `.claude/agents/`:

- **`control-orchestrator`** — agente por defecto. Analiza, propone, delega y maneja git.
- **`control-frontend`** — implementa cambios en `frontend/`. Invocado por el orquestador.
- **`control-backend`** — implementa cambios en `backend/`. Invocado por el orquestador.
_(Mobile no aplica en v1)_

## Decisiones de diseño

- **Control es un diario de gastos, no un sistema contable.** No agregar flujos de conciliación, libros mayores, ni múltiples monedas sin discutir antes.
- **Backend separado (NestJS).** No mover la lógica de datos a API Routes de Next.js — el backend independiente mantiene la puerta abierta para mobile.
- **Sin APIs externas en v1.** Todo se ingresa manualmente. No agregar integraciones bancarias sin decisión explícita.
- **`@control/shared`**: solo tipos y helpers puros. Sin DOM, sin framework, sin side effects.
