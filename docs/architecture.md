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
- **Autenticación con JWT firmado.** Auth.js maneja el login (Google OAuth y email/contraseña) en el frontend. El token de sesión de Auth.js está encriptado y es propio de Auth.js; el backend **no** lo valida directamente. En su lugar, Auth.js firma un JWT corto (HS256, secret compartido) que el frontend adjunta como `Bearer` en cada request, y que el backend valida para extraer el `userId`. El detalle completo está en `docs/technical.md` (sección Autenticación).
