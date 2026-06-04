# Arquitectura

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend (web) | Next.js 15 (App Router) + Tailwind CSS v4 |
| Código compartido | `@control/shared` — tipos y helpers puros |
| Backend | NestJS + TypeScript |
| ORM | Prisma |
| Base de datos | PostgreSQL |
| Auth | Auth.js (NextAuth v5) + Google OAuth |
| APIs externas | Google OAuth (solo para auth) |
| Deploy frontend | Vercel (pendiente) |
| Deploy backend | Render (pendiente) |

## Monorepo

`frontend/` es un workspace de npm con dos paquetes (web + shared); `backend/` es independiente.

```
control/
├── docs/                         ← esta carpeta
├── backend/                      ← NestJS app
│   └── src/
│       ├── main.ts               ← bootstrap NestJS
│       ├── app.module.ts         ← módulo raíz
│       ├── expenses/             ← módulo de gastos (controller + service + dto)
│       ├── categories/           ← módulo de categorías
│       └── prisma/               ← PrismaService + schema
│
└── frontend/                     ← npm workspaces: shared, web
    ├── shared/src/
    │   ├── types/                ← tipos compartidos (Expense, Category, etc.)
    │   └── helpers/              ← lógica pura, sin DOM ni framework
    └── web/                      ← Next.js 15 App Router
        └── src/
            ├── app/              ← rutas (page.tsx, layout.tsx)
            ├── components/       ← componentes UI
            ├── hooks/            ← hooks de datos
            └── lib/              ← api.ts (HTTP client)
```

## Diagrama de capas

```
Browser
  └── Next.js App (App Router)
        ├── Auth.js — Google OAuth flow + sesión JWT
        ├── UI (componentes React)
        ├── Estado (hooks + fetch)
        └── HTTP con Authorization: Bearer <jwt> (→ NEXT_PUBLIC_API_URL)
              │
              ▼
        NestJS API (:3001)
          ├── JwtAuthGuard — verifica JWT con AUTH_SECRET
          └── ExpensesModule / CategoriesModule / UsersModule
                └── PrismaService
                      └── PostgreSQL
```

## Patrón de auth

1. El usuario hace login en Next.js vía Google OAuth (Auth.js maneja el redirect y callback).
2. Auth.js crea una sesión JWT firmada con `AUTH_SECRET`.
3. El frontend adjunta el JWT en `Authorization: Bearer <token>` en cada llamada a NestJS.
4. NestJS tiene un `JwtAuthGuard` global que verifica la firma y extrae el `userId`.
5. Todos los recursos (movimientos, categorías) están scoped al `userId` del token — un usuario nunca ve datos de otro.

## Decisiones estructurales

- **Backend separado (NestJS) en vez de API Routes de Next.js.** Motivo: mantener la puerta abierta para mobile u otros clientes sin reescribir la API.
- **PostgreSQL + Prisma.** Los datos son del usuario y deben persistir de forma confiable. Prisma da migrations y type-safety en el ORM.
- **JWT compartido entre Next.js y NestJS.** Ambos usan el mismo `AUTH_SECRET`. Simple, sin servidor de auth externo.
- **Sin integración bancaria en v1.** Todos los datos los ingresa el usuario manualmente.
