# Features

> Estado de implementación de cada feature.
> Para la descripción funcional completa y criterios de aceptación ver `docs/requirements.md`.

---

## Estado general

| Feature | ID req. | Estado |
|---------|---------|--------|
| Auth — email/contraseña (login + registro) | RF-AUTH-005..006, 002..004 | Implementado |
| Auth — Google OAuth | RF-AUTH-001 | Scaffolded (diferido) |
| Dashboard — resumen del mes (en `/`) | RF-DASH-001..003, 005 | Implementado |
| Formulario de carga (tabs único/fijo/cuotas) | RF-CM-001 | Implementado (los tres tabs funcionales) |
| Movimiento único — crear, editar, eliminar | RF-MU-001..003 | Implementado (editar/eliminar cableados desde la vista del mes) |
| Movimiento fijo — crear, visualizar, editar, eliminar | RF-MF-001..004 | Implementado |
| Movimiento en cuotas — crear, visualizar, editar, eliminar | RF-MC-001..003 | Implementado (solo Gasto en v1) |
| Categorías — defaults + CRUD + soft delete | RF-CAT-001..006 | Implementado |
| Vista del mes — lista + totales + navegación | RF-VM-001..004 | Implementado |
| Navegación global — sidebar persistente | RF-NAV-001 | Implementado |

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
- **Acceso a `/categorias`:** en Fase 3 era solo por URL (sin sidebar). El sidebar de navegación global (RF-NAV-001) **ya se implementó** post-Fase 7; ver nota "Navegación global" más abajo.

### Movimientos únicos (Fase 4)

- **Crear operativo** end-to-end (backend `TransactionsModule` + modal de carga), scopeado por `userId` del JWT. Acceso desde el botón "Nuevo movimiento" del dashboard; al guardar, toast con acción "Ir a ver" → `/mes?month=YYYY-MM` (ruta de Fase 5).
- **Editar y eliminar implementados** como componentes/hooks reutilizables (`TransactionModal`, `DeleteTransactionDialog`, `useTransactions`), pero **sin acceso visible todavía**: quedan listos para que la Vista del mes (Fase 5) los cablee. No hay lista ni Vista del mes en esta fase.
- **Modal con tabs Único / Fijo / Cuotas:** solo Único es funcional; **Fijo y Cuotas están deshabilitados con badge "Próximamente"** (Fases 6/7).
- Contrato de API y bucketeo por mes en `docs/backend.md`; patrón de datos y helpers en `docs/frontend.md`.

### Vista del mes y Dashboard (Fase 5)

- **Endpoint unificado `GET /movements?month=YYYY-MM`** (backend `MovementsModule`): totales del mes + movimientos agrupados por origen (únicos / fijos / cuotas). Hoy solo únicos trae datos; fijos y cuotas vienen vacíos, con el shape ya previsto para Fases 6/7. Contrato en `docs/backend.md` y `docs/data-model.md`.
- **Bucketeo de mes definitivo:** el mes de cada movimiento se calcula con la **zona propia del registro** (`AT TIME ZONE` en raw SQL parametrizado), saldando la deuda técnica de Fase 4. `GET /movements` ya **no** recibe `timezone`. Se eliminó `GET /transactions?month&timezone`.
- **Dashboard movido a `/`** (antes `/dashboard`, desviación de Fase 2 corregida): resumen del mes actual, "Nuevo movimiento", "Ver todos" → `/mes`, estado vacío con CTA. No lista movimientos.
- **Vista del mes `/mes`:** lista por secciones (las vacías no se muestran), navegación prev/next del mes, totales que se actualizan al mutar. **Editar y eliminar de movimientos únicos quedan ahora cableados** desde acá (modales de Fase 4).
- **Sidebar (RF-NAV-001):** en Fase 5 se difirió y la navegación entre `/`, `/mes` y `/categorias` usaba los accesos definidos en cada pantalla. **Ya implementado** post-Fase 7 (ver nota "Navegación global" más abajo); esos accesos por pantalla se conservan y conviven con el sidebar.

### Movimientos fijos (Fase 6)

- **CRUD operativo** end-to-end (backend `RecurringModule` + tab Fijo del modal de carga), scopeado por `userId` del JWT. Crear desde el botón "Nuevo movimiento" (tab **Fijo**): tipo, monto, categoría, **mes de inicio** y descripción; **sin día ni hora**. El mes de inicio es editable y admite meses pasados; su default es el **mes contexto** si el modal se abrió desde `/mes`, o el mes actual en otro origen (ver nota "Mes contexto" más abajo).
- **Visualización en la Vista del mes:** los fijos activos aparecen en su sección "Fijos", con badge de origen "Fijo" y la etiqueta "Mensual" en vez de fecha (RF-MF-002). Cada ítem expone Editar y Eliminar.
- **Editar (RF-MF-003):** solo monto, categoría y descripción. **El tipo no se edita.** Los cambios aplican desde el mes actual en adelante; los meses ya corridos no se tocan (ver decisión del split más abajo).
- **Eliminar (RF-MF-004):** diálogo con checkbox "Eliminar también desde este mes" (desmarcado por default → deja de aparecer desde el mes siguiente; marcado → desde el mes actual inclusive). El pasado nunca se modifica.
- **Totales del mes ahora incluyen los fijos activos:** tanto la Vista del mes como el Dashboard suman únicos + fijos del mes (RF-DASH-002 / RF-VM-002).
- **Inmutabilidad del pasado vía "split":** un fijo lógico es una **cadena de filas `Recurring`**; editar un fijo que ya corrió meses pasados cierra la fila vigente y abre una nueva. Detalle en `docs/backend.md` (sección Movimientos fijos) y bitácora 2026-06-09.

### Movimientos en cuotas (Fase 7)

- **CRUD operativo** end-to-end (backend `InstallmentsModule` + tab Cuotas del modal de carga), scopeado por `userId` del JWT. Con esto quedan completos los **tres tipos de movimiento** (únicos, fijos, cuotas) y el modal de carga ya **no tiene ningún tab "Próximamente"**.
- **Solo Gasto en v1 (RF-MC-001..003):** el tab Cuotas **no ofrece selector de tipo** —siempre Gasto— y el backend rechaza `INCOME` con `400`. Resuelve la contradicción de la spec (RF-MC-001 ofrecía "Gasto o Ingreso", pero la sección 6 excluye "Ingreso en cuotas"); ver bitácora 2026-06-09.
- **Crear (RF-MC-001):** monto **por cuota** (no el total), cantidad de cuotas, mes de inicio, categoría y descripción. El mes de inicio admite meses pasados; su default es el **mes contexto** si el modal se abrió desde `/mes`, o el mes actual en otro origen (ver nota "Mes contexto" más abajo). No hay día ni hora —las cuotas operan a nivel mes.
- **Visualización en la Vista del mes:** las cuotas activas en el mes aparecen en su sección "Cuotas", con badge de origen "Cuotas" y la etiqueta **"Cuota X/N"** en vez de fecha (RF-MC-001). Cada ítem expone Editar y Eliminar.
- **Editar (RF-MC-003):** el grupo completo, in-place (monto por cuota, cantidad, mes de inicio, categoría, descripción; **el tipo no se edita**). A diferencia de los fijos, **no hay split ni inmutabilidad del pasado**: la edición aplica a todas las instancias del grupo.
- **Eliminar (RF-MC-002):** **hard delete del grupo entero** (todas las cuotas, pasadas y futuras); el diálogo avisa que se elimina el grupo completo, sin checkbox.
- **Totales del mes ahora incluyen las cuotas:** Vista del mes y Dashboard suman únicos + fijos + cuotas (RF-DASH-002 / RF-VM-002).
- **Cuotas calculadas on-the-fly (RN-006):** no se crean filas por instancia mensual; una cuota cae en el mes si `startMonth ≤ mes < startMonth + totalInstallments`. Detalle en `docs/backend.md` (sección Movimientos en cuotas).
- **Validación de categoría consolidada:** la validación duplicada en Fases 4/6 se extrajo a `CategoryValidatorService` (módulo `categories`); los tres módulos de movimientos lo reusan. Ver `docs/backend.md`.

### Navegación global — sidebar (post-Fase 7)

- **Feature 100% frontend, fuera de la secuencia de fases.** Resuelve la navegación entre las secciones (Dashboard `/`, Vista del mes `/mes`, Categorías `/categorias`), la **acción primaria de nuevo movimiento** y el **menú de usuario con cierre de sesión** (RF-AUTH-004), todo persistente en las pantallas autenticadas. Revierte las decisiones previas que lo diferían (bitácora 2026-06-08 y 2026-06-09); ver bitácora 2026-06-10.
- **Punto único de montaje vía route group `app/(app)/`:** las tres pantallas autenticadas viven bajo `app/(app)/` con un `layout.tsx` compartido que monta el sidebar una sola vez. Los route groups **no cambian las URLs**. `login` y `registro` quedan fuera del grupo → sin sidebar (cumple "no se muestra en pantallas no autenticadas"). Detalle en `docs/frontend.md`, sección Navegación global.
- **Contenido:** logo/nombre "Control" → `/`; links Dashboard / Vista del mes / Categorías (Vista del mes siempre abre en el mes actual); botón "Nuevo movimiento" (reusa `NewTransactionButton`, abre el modal en modo crear, 1 clic — RNF-003); menú de usuario abajo con avatar = inicial del email.
- **Decisiones de diseño (aprobadas):** sidebar **colapsable** (fijo en desktop, hamburguesa en pantallas chicas) y **avatar por inicial del email** (no hay imagen para usuarios de email).

### Mes contexto + mes de inicio elegible en fijos (post-Fase 7)

- **Feature 100% frontend (UX).** No toca el backend ni el modelo: el backend ya aceptaba cualquier `startMonth` YYYY-MM, incluido pasado. Ver bitácora 2026-06-13. Cubre RF-MF-001 y RF-MC-001.
- **Mes de inicio en el tab Fijo (RF-MF-001):** el fijo deja de arrancar siempre en el mes actual; el tab Fijo suma un campo "mes de inicio" editable (igual que cuotas), que **admite meses pasados** (el fijo aparece retroactivamente y modifica los totales de esos meses).
- **Mes contexto:** al abrir el modal "Nuevo movimiento" **desde la Vista del mes (`/mes`)**, el mes navegado se propaga como default del "mes de inicio" en los tabs **Fijo** y **Cuotas**. Desde el dashboard, el sidebar o cualquier otro origen no hay mes contexto y el default es el **mes actual**.
- **Únicos sin cambios:** el tab Único ignora el mes contexto; su default sigue siendo hoy/ahora siempre (es instante-céntrico, no a nivel mes).

---

## Roadmap post v1

| Feature | Notas |
|---------|-------|
| Gráficos (torta, barras, línea) | Requiere definición de UX |
| Vista de historial anual | — |
| Tarjetas con fecha de corte | Requiere flujo propio |
| Multi-moneda | Diseñado para venir después |
| Importación desde extracto bancario | Sin decisión |
