# Control — Contexto del proyecto

## Stack

- **Frontend:** Next.js 15 (App Router) + Tailwind CSS v4
- **Backend:** NestJS + TypeScript + PostgreSQL + Prisma
- **Auth:** Auth.js (NextAuth v5) + Google OAuth

## Agentes

El workflow de este proyecto está manejado por agentes en `.claude/agents/`:

- **`control-orchestrator`** — agente por defecto. Analiza, propone, delega y maneja git.
- **`control-frontend`** — implementa cambios en el frontend. Invocado por el orquestador.
- **`control-backend`** — implementa cambios en el backend. Invocado por el orquestador.

## Decisiones de diseño

- **Control es un diario de gastos, no un sistema contable.** No agregar flujos de conciliación, libros mayores, ni múltiples monedas sin discutir antes.
- **Backend separado (NestJS).** No mover la lógica de datos a API Routes de Next.js — el backend independiente mantiene la puerta abierta para mobile.
- **Sin APIs externas en v1.** Todo se ingresa manualmente. No agregar integraciones bancarias sin decisión explícita.
- **Módulo compartido de tipos:** solo tipos y helpers puros. Sin DOM, sin framework, sin side effects.
