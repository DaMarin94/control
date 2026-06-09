# Control — Contexto del proyecto

## Stack

- **Frontend:** Next.js 15 (App Router) + Tailwind CSS v4
- **Backend:** NestJS + TypeScript + PostgreSQL + Prisma
- **Auth:** Auth.js (NextAuth v5) + Google OAuth

## Regla de oro — No escaparse de lo definido

Implementá / documentá **EXACTAMENTE** lo que está definido en la documentación del proyecto (`docs/requirements.md`, `docs/screens.md`, `docs/data-model.md`, `docs/technical.md`, `docs/roadmap.md` y las decisiones ya cerradas). No inventes, no agregues alcance, no cambies rutas, nombres, comportamientos ni decisiones por tu cuenta, ni "para destrabar".

Si aparece un conflicto entre la spec y el código existente, una ambigüedad, una decisión no tomada, o cualquier duda → **FRENÁ TODO y preguntá** (al orquestador) antes de continuar. Nunca improvises una solución ni asumas un default no escrito.

**Ante la duda, se pregunta; no se inventa.**

## Agentes

El workflow de este proyecto está manejado por agentes en `.claude/agents/`:

- **`control-orchestrator`** — agente por defecto. Analiza, propone, delega y maneja git.
- **`control-frontend`** — implementa cambios en el frontend. Invocado por el orquestador.
- **`control-backend`** — implementa cambios en el backend. Invocado por el orquestador.

## Decisiones de diseño

- **Control es un diario de gastos, no un sistema contable.** No agregar flujos de conciliación, libros mayores, ni múltiples monedas sin discutir antes.
- **Backend separado (NestJS).** No mover la lógica de datos a API Routes de Next.js — el backend independiente mantiene la puerta abierta para mobile.
- **Sin APIs externas en v1.** Todo se ingresa manualmente. No agregar integraciones bancarias sin decisión explícita.
