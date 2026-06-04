# Development

## Requisitos

- Node.js 20+
- npm
- PostgreSQL (local o Docker)

## Setup inicial

```bash
# Backend
cd backend
npm install
cp .env.example .env       # completar DATABASE_URL

# Correr migrations y generar client
npx prisma migrate dev
npx prisma generate

# Frontend
cd frontend
npm install
cp web/.env.local.example web/.env.local    # completar NEXT_PUBLIC_API_URL
```

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `PORT` | Puerto del servidor | `3001` |
| `DATABASE_URL` | Connection string de PostgreSQL | `postgresql://user:pass@localhost:5432/control` |

### Frontend web (`frontend/web/.env.local`)

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `NEXT_PUBLIC_API_URL` | URL del backend NestJS | `http://localhost:3001` |

## Dev local

```bash
# Terminal 1 — backend
cd backend && npm run dev
# → http://localhost:3001

# Terminal 2 — web
cd frontend/web && npm run dev
# → http://localhost:3000
```

## Scripts

### Backend

| Script | Comando | Descripción |
|--------|---------|-------------|
| `dev` | `npm run dev` | Dev con hot reload |
| `build` | `npm run build` | Compilar TypeScript |
| `start` | `npm run start` | Producción (post-build) |

### Frontend web

| Script | Comando | Descripción |
|--------|---------|-------------|
| `dev` | `npm run dev` | Dev server con HMR |
| `build` | `npm run build` | Build de producción |
| `preview` | `npm run preview` | Preview del build |
| `lint` | `npm run lint` | ESLint |

### Prisma

| Script | Comando | Descripción |
|--------|---------|-------------|
| `migrate` | `npx prisma migrate dev` | Crear y correr migration |
| `generate` | `npx prisma generate` | Regenerar Prisma client |
| `studio` | `npx prisma studio` | UI para inspeccionar la DB |

## Deploy

- **Backend**: Render — URL pendiente
- **Frontend**: Vercel — URL pendiente
- **DB**: PostgreSQL en Render (mismo servicio) o Supabase — pendiente de decisión
- **¿Deploy automático en push a main?**: Sí (Vercel y Render soportan autodeploy)
- **¿GitHub Actions CI?**: Pendiente de configurar

## Checklist antes de mergear

- [ ] `cd backend && npm run build` sin errores
- [ ] `cd frontend/web && npm run build` sin errores
- [ ] Migrations en orden: `npx prisma migrate dev` corre sin conflictos
- [ ] Docs actualizados en el mismo commit
