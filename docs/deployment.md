# Deployment

## Entornos

| Entorno | Backend URL | Frontend URL | Rama |
|---------|-------------|--------------|------|
| Producción | <!-- ej: https://api.miapp.com --> | <!-- ej: https://miapp.com --> | `main` |
| Staging | <!-- ej: https://api-staging.miapp.com --> | <!-- ej: https://staging.miapp.com --> | `staging` |
| Local | `http://localhost:3001` | `http://localhost:3000` | cualquier rama |

## Plataformas de deploy

| Servicio | Plataforma | Rama de deploy | URL |
|----------|------------|----------------|-----|
| Backend | <!-- Render / Railway / Fly.io --> | `main` | |
| Frontend web | <!-- Vercel / Netlify --> | `main` | |
| Extension | Chrome Web Store / Firefox Add-ons | manual | |

## Variables de entorno por entorno

### Backend

| Variable | Local | Staging | Producción |
|----------|-------|---------|------------|
| `PORT` | `3001` | `3001` | `3001` |
| `NODE_ENV` | `development` | `staging` | `production` |
| `[API_KEY]` | (dev key) | (staging key) | (prod key) |

### Frontend web

| Variable | Local | Staging | Producción |
|----------|-------|---------|------------|
| `VITE_API_URL` | `http://localhost:3001` | [staging URL] | [prod URL] |

### Mobile

| Variable | Local | Producción |
|----------|-------|------------|
| `EXPO_PUBLIC_API_URL` | `http://localhost:3001` | [prod URL] |

## Proceso de deploy

### Backend

<!-- Descripción del proceso de deploy del backend. Ej:
1. Push a `main` → Render hace deploy automático
2. El deploy tarda ~2 minutos
3. Verificar health: `curl https://api.miapp.com/health`
-->

### Frontend web

<!-- Descripción del proceso de deploy del frontend. Ej:
1. Push a `main` → Vercel hace deploy automático
2. Preview deployments en cada PR (URL única por PR)
3. Promote a producción: merge a `main`
-->

### Extension

<!-- Proceso de publicación en stores. Ej:
1. `cd frontend/extension && npm run build`
2. Subir el zip generado en Chrome Web Store Developer Dashboard
3. Para Firefox: subir en addons.mozilla.org
-->

### Mobile

<!-- Proceso de release de la app mobile. Ej:
1. `eas build --platform all`
2. `eas submit` para subir a App Store / Play Store
-->

## Rollback

<!-- Cómo revertir un deploy roto. Ej:
- **Render**: Dashboard → Deploys → seleccionar deploy anterior → Rollback
- **Vercel**: Dashboard → Deployments → seleccionar deployment anterior → Promote to production
-->

## Checklist de deploy a producción

- [ ] CI pasa en la rama (`Actions` en GitHub)
- [ ] Build local sin errores (`npm run build` en backend y frontend)
- [ ] Variables de entorno de producción configuradas
- [ ] Testeado en staging (si existe)
- [ ] Documentación actualizada
- [ ] PR aprobado y mergeado a `main`
