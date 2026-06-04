# Arquitectura

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend (web) | Next.js 15 (App Router) + Tailwind CSS v4 |
| Código compartido | `@control/shared` — tipos y helpers puros |
| Backend | NestJS + TypeScript |
| ORM | Prisma |
| Base de datos | PostgreSQL |
| APIs externas | Ninguna (v1) |
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
        ├── UI (componentes React)
        ├── Estado (hooks + React Query / fetch)
        └── HTTP (→ NEXT_PUBLIC_API_URL)
              │
              ▼
        NestJS API (:3001)
          └── ExpensesModule / CategoriesModule
                └── PrismaService
                      └── PostgreSQL
```

## Decisiones estructurales

- **Backend separado (NestJS) en vez de API Routes de Next.js.** Motivo: mantener la puerta abierta para mobile u otros clientes en el futuro sin reescribir la API.
- **PostgreSQL + Prisma.** Los datos son del usuario y deben persistir de forma confiable. Prisma da migrations y type-safety en el ORM.
- **Sin APIs externas en v1.** Todos los datos los ingresa el usuario manualmente. No hay integración bancaria.
