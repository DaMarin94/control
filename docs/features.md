# Features

> Estado de implementación de cada feature.
> Para la descripción funcional completa y criterios de aceptación ver `docs/requirements.md`.

---

## Estado general

| Feature | ID req. | Estado |
|---------|---------|--------|
| Auth — email/contraseña (login + registro) | RF-AUTH-005..006, 002..004 | Implementado |
| Auth — Google OAuth | RF-AUTH-001 | Scaffolded (diferido) |
| Dashboard — resumen del mes + últimos movimientos | RF-DASH-001..005 | Pendiente |
| Formulario de carga (tabs único/fijo/cuotas) | RF-CM-001 | Pendiente |
| Movimiento único — crear, editar, eliminar | RF-MU-001..003 | Pendiente |
| Movimiento fijo — crear, visualizar, editar, eliminar | RF-MF-001..004 | Pendiente |
| Movimiento en cuotas — crear, eliminar | RF-MC-001..002 | Pendiente |
| Categorías — defaults + CRUD + soft delete | RF-CAT-001..006 | Implementado |
| Vista del mes — lista + totales + navegación | RF-VM-001..004 | Pendiente |

---

## Notas de implementación

<!-- Documentar decisiones técnicas, workarounds o comportamientos no obvios -->
<!-- a medida que cada feature se implementa.                                 -->

### Autenticación (Fase 2)

- **Email + contraseña operativo end-to-end:** login y registro (`/auth/login`, `/auth/register`) funcionan; el backend emite el JWT y el front lo reenvía como Bearer (ver `docs/backend.md` y `docs/frontend.md`, secciones Autenticación).
- **Google OAuth scaffolded y diferido:** `/auth/google` y el provider de NextAuth existen y funcionan, pero Google no está activo (faltan credenciales y la verificación server-side del `id_token`). No bloquea v1.
- **Sesión persistente y protección de rutas:** vía Auth.js + `src/middleware.ts`; auto-login tras registro.
- **Categorías por defecto al alta:** el backend genera las 4 categorías (RF-CAT-001); no se duplican para usuarios existentes.

### Gestión de categorías (Fase 3)

- **CRUD completo operativo** (backend NestJS + frontend Next.js), scopeado por `userId` del JWT: crear, editar, eliminar (soft delete) y listar con el contador "N movimientos" (RF-CAT-006).
- **Flujo crear-o-reactivar:** crear con un nombre que colisiona con una categoría eliminada propone reactivar la original en vez de duplicar (RF-CAT-002 / RF-CAT-004). El backend lo señala con un `409` que adjunta `error.data` (ver `docs/backend.md` y `docs/data-model.md`).
- **Color automático del pool:** pool fijo de 10 colores en el backend, asignación "menos usado" (RF-CAT-005). El usuario no elige ni edita el color.
- **Acceso por URL `/categorias`:** todavía **sin sidebar** — la navegación global (RF-NAV-001) queda para una fase posterior.

---

## Roadmap post v1

| Feature | Notas |
|---------|-------|
| Gráficos (torta, barras, línea) | Requiere definición de UX |
| Vista de historial anual | — |
| Tarjetas con fecha de corte | Requiere flujo propio |
| Multi-moneda | Diseñado para venir después |
| Importación desde extracto bancario | Sin decisión |
