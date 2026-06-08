# Arquitectura

> La arquitectura interna se documenta a medida que se construye.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 15 (App Router) + Tailwind CSS v4 |
| Backend | NestJS + TypeScript |
| ORM | Prisma |
| Base de datos | PostgreSQL |
| Auth | Auth.js (NextAuth v5) — Google OAuth + email/contraseña |

## Estructura del repositorio

Dos proyectos independientes dentro del mismo repositorio, sin workspaces ni paquetes compartidos:

```
control/
├── backend/    (NestJS)
└── frontend/   (Next.js)
```

Cada app tiene su propio `package.json` y se gestiona con **pnpm** de forma aislada.

## Decisiones estructurales

- **Backend separado (NestJS), no API Routes de Next.js.** Mantiene la puerta abierta para mobile u otros clientes sin reescribir la API.
- **Front y back independientes, sin código compartido.** Cada app es autónoma y define sus propios tipos. El contrato entre ambas es la API HTTP (ver formato de respuesta en `docs/technical.md`). No hay paquete de tipos compartido.
- **Autenticación con JWT emitido por NestJS.** El **backend es la autoridad de identidad**: NestJS emite el JWT (HS256, claim `sub = userId`). Auth.js (NextAuth v5) en el frontend **orquesta** el login (Google OAuth y email/contraseña) pero **no emite un token de identidad propio**: guarda el JWT de NestJS dentro de su sesión (un JWE separado) y lo reenvía como `Authorization: Bearer` en cada request. El backend lo valida con un guard global y extrae el `userId`. Hay **un solo `userId`** (cuid de Postgres) compartido por front y back. Motivo: que la identidad viva en el backend mantiene la puerta abierta a mobile u otros clientes, que pueden autenticarse contra los mismos endpoints sin depender de Auth.js. El detalle completo está en `docs/technical.md` (sección Autenticación) y `docs/backend.md` (sección Autenticación).
