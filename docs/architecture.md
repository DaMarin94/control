# Arquitectura

> La arquitectura interna se documenta a medida que se construye.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 15 (App Router) + Tailwind CSS v4 |
| Código compartido | Módulo de tipos y helpers puros (sin DOM, sin framework) |
| Backend | NestJS + TypeScript |
| ORM | Prisma |
| Base de datos | PostgreSQL |
| Auth | Auth.js (NextAuth v5) + Google OAuth |

## Decisiones estructurales

- **Backend separado (NestJS), no API Routes de Next.js.** Mantiene la puerta abierta para mobile u otros clientes sin reescribir la API.
- **Auth con JWT compartido.** Auth.js maneja el flujo OAuth en el frontend; el backend valida el mismo token en cada request.
