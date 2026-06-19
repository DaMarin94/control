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
| Fijos extendidos — anular por mes (P1) + periodicidad (P2) | RF-MF-005..006, RN-016 | Implementado (fase 1.1.1) |
| Movimiento en cuotas — crear, visualizar, editar, eliminar | RF-MC-001..003 | Implementado (solo Gasto en v1) |
| Categorías — defaults + CRUD + soft delete | RF-CAT-001..006 | Implementado |
| Color de categoría editable — matriz de 70 colores | RF-CAT-005, RN-013 | Implementado (fase 1.1.2) |
| Vista del mes — lista + totales + navegación | RF-VM-001..004 | Implementado |
| Vista del mes — secciones colapsables + reordenables (persistidas) | RF-VM-005 | Implementado (fase 1.1.4) |
| Vista del mes — filtro por categoría (por pantalla, persistido) | RF-VM-006 | Implementado (fase 1.1.6) |
| Navegación global — sidebar persistente | RF-NAV-001 | Implementado |
| Crear categoría desde el formulario de movimiento | RF-MU-004 | Implementado (los tres tabs) |
| Reportes — pantalla configurable por cards + widget en dashboard | RF-REP-001..005 | Implementado (fase 1.1.5) |
| Preferencias de usuario — cimiento (blob JSON + sesión) | — (fase 1.1.0, ST1) | Implementado (sin UI de producto) |

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
- **Color de categoría editable desde una matriz (RF-CAT-005):** **reabierto en la fase 1.1.2.** En Fase 3 el color era automático y no editable (pool fijo de 10, asignación "menos usado"). Desde 1.1.2 el usuario **elige y edita** el color, al crear y al editar, desde una **matriz de 70 colores** (7 tonalidades × 10 hues); **sin hex libre**. Default al crear: el color **"menos usado"** pre-seleccionado (calculado sobre los 10 colores base, que son la fila base de la matriz y coinciden con el pool de v1.0), más un botón **"aleatorio"**. Ver nota "Color de categoría editable" más abajo.
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
- **Visualización en la Vista del mes:** los fijos activos aparecen en su sección "Fijos", con badge de origen "Fijo" y la etiqueta de **frecuencia** en vez de fecha (en Fase 6 era siempre "Mensual"; desde la fase 1.1.1 refleja la frecuencia real del fijo — ver nota "Fijos extendidos"). Cada ítem expone Editar y Eliminar (y, desde 1.1.1, Anular / Des-anular este mes).
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

### Crear categoría desde el formulario de movimiento (RF-MU-004)

- **Feature 100% frontend.** No agrega ni modifica endpoints ni contrato de API: reutiliza el modal de creación de categoría (`category-form-modal.tsx`, RF-CAT-002), el hook de categorías (cuyo `create` ya devuelve la categoría creada) y el prompt de reactivación (`reactivation-prompt.tsx`, RF-CAT-002 A3). Ver bitácora 2026-06-13.
- **Disparador (opción B):** botón "+ Nueva" junto al selector de categoría del formulario de carga (`transaction-form`), presente en los tres tabs. No es un ítem dentro del desplegable.
- **Comportamiento:** abre el modal de categoría por encima del formulario, conservando los datos ya cargados; el scope arranca pre-seleccionado en el tipo exacto del movimiento en curso (Gasto/Ingreso) y solo ofrece ese tipo + "Ambos" (oculta el tipo opuesto); al crear/reactivar con éxito, la categoría queda autoseleccionada en el formulario.
- **Detalles de implementación no obvios** (uso dual de `CategoryFormModal`, apilado de modales/z-index) en `docs/frontend.md`, sección Crear categoría desde el formulario de movimiento.
- **Caso borde resuelto (scope incompatible):** el conflicto de crear una categoría con scope incompatible con el tipo del movimiento se previene en origen restringiendo las opciones de scope en modo inline (el modal ofrece solo el tipo del movimiento + "Ambos", oculta el tipo opuesto y preselecciona el tipo exacto), por lo que nunca se crea una categoría incompatible. Desde `/categorias` el modal sigue mostrando las tres opciones (Gasto / Ingreso / Ambos). Resuelto el 2026-06-13; ver detalle en RF-MU-004 (`docs/requirements.md`).

### Reportes — pantalla configurable + widget (fase 1.1.5)

- **Estado:** implementado end-to-end (front + back). **Renombra el módulo "Gráfico anual" → "Reportes"** (ruta `/anual` → `/reportes`, endpoint `GET /movements/annual` → `GET /movements/reports`, link sidebar "Anual" → "Reportes"); el legado "anual" se eliminó por completo (sin redirect ni componentes duplicados). Regla funcional en RF-REP-001..005 (`docs/requirements.md`) + bitácora 2026-06-16 (`docs/decisions.md`); pantallas en `docs/screens.md`; spec visual en `docs/design.md`.
- **Pantalla `/reportes` configurable por cards:** vacía al inicio (solo "[+]"); el usuario agrega cards (de los 2 tipos: Ingresos vs. Gastos / Por categoría) y las quita. Cada card es un **widget de reporte autónomo** con navegación de año independiente + filtro de categorías, y persiste tipo+año+categorías en la clave `reports` de preferencias (RF-REP-003/004).
- **Widget en el dashboard:** monta el reporte Ingresos vs. Gastos con navegación de año **activa** y filtro de categorías **efímero** (no persiste); el resumen mensual sigue fijo en el mes en curso (RF-DASH-001/002, RF-REP-002).
- **Backend:** `GET /movements/reports?year=&categories=` (filtro de categorías opcional, omitido = todas). Contrato en `docs/data-model.md`, §Contrato de serie de reportes; implementación en `docs/backend.md`, §Serie de reportes.
- **Frontend (arquitectura en dos capas, heredada del anual):** primitiva de charting `components/ui/chart.tsx` + tarjetas autónomas en `components/charts/report-card.tsx`, hook `useReports`. Detalles y gotchas en `docs/frontend.md`, §Reportes.

### Fijos extendidos — anular por mes + periodicidad (fase 1.1.1)

- **Estado:** implementado end-to-end (front + back). Dos capacidades nuevas sobre los fijos, independientes del resto de v1.1 (no consumen preferencias): **P1** anular un fijo en un mes puntual (toggle, modelado con `RecurringSkip`) y **P2** periodicidad (selector de frecuencia, set cerrado, inmutable). Reglas funcionales en RF-MF-005 / RF-MF-006 / RN-016 (`docs/requirements.md`); modelado (`RecurringSkip`, `frequency`) en `docs/data-model.md`; bitácora 2026-06-16; spec visual en `docs/design.md`.
- **Backend (`RecurringModule` + `MovementsModule`):** endpoint nuevo `POST /recurring/:id/skip`; helpers `isOnFrequency` / `frequencyStep` centralizados, carga de skips anuales sin N+1. Detalle en `docs/backend.md`, §Movimientos fijos y §Serie anual.
- **Migración (Prisma 7 sin shadow DB):** patrón `migrate diff` → `db push` → `migrate resolve --applied`, documentado en `docs/technical.md`, §Migraciones.

### Color de categoría editable — matriz de 70 colores (fase 1.1.2)

- **Estado:** implementado end-to-end (front + back). Reabre una decisión cerrada de v1.0: el color pasa de auto-asignado/no editable a **elegible y editable** desde una matriz de 70 colores. Regla funcional en RF-CAT-005 / RN-013 (`docs/requirements.md`); matriz, "menos usado" y back-compat en `docs/data-model.md`, §Contrato de categoría y §Matriz de colores; bitácora 2026-06-16; spec visual del picker en `docs/design.md`.
- **Backend (`CategoriesModule`):** `POST`/`PATCH` aceptan `color` con validación contra la matriz vía `@IsColorInMatrix`; detalle en `docs/backend.md`, §Pool de colores.
- **Frontend:** componente `ColorPicker` (grid 10×7) en crear/editar; detalle en `docs/frontend.md`.

### Movimientos calculados (fase 1.1.7)

- **Estado:** implementado end-to-end (front + back). Fijo cuyo monto/tipo se **derivan al vuelo** del monto de otro fijo de origen vía fórmula (RF-MCALC-001..007, RN-017/018/019). Reglas funcionales en `docs/requirements.md`, submódulo 3.4.b; conceptos de datos en `docs/data-model.md`, §Identidad de cadena estable y §Movimiento calculado; bitácoras 2026-06-17 y 2026-06-18 (`docs/decisions.md`); spec visual en `docs/design/specs-archive.md`.
- **Backend (`RecurringModule` + `MovementsModule`):** endpoints nuevos `POST /recurring/:id/calculated` y `PATCH /recurring/:id/calculated`; `chainId` estable que sobrevive a los splits; derivación on-the-fly del monto/tipo en `findFijosByMonth`; cascada de eliminación a calculados. Contrato en `docs/data-model.md`; mecánica en `docs/backend.md`, §Movimientos calculados.
- **Frontend:** creación solo vía acción "crear movimiento desde este" (kebab) sobre un fijo; `CalculatedForm` sin selector de tipo (derivado del signo) con preview en vivo; hook `useCalculated`. Detalle y gotchas en `docs/frontend.md`, §Movimientos calculados.
- **Fase 1.1.8 (completada):** el **origen** de un calculado puede ser **único o cuota**, además de fijo (RF-MCALC-008/009/010). Cadencia espejo del origen; calculado de cuota deriva del monto por cuota (sin etiqueta "X/N"); en `/mes` (sección del origen) y en reportes. Endpoints `POST|PATCH /transactions/:id/calculated` y `/installments/:id/calculated`; enganche por FK `sourceMovementId`/`sourceInstallmentGroupId` (`onDelete: Cascade`, exclusión mutua); borrado total del calculado de único/cuota. Contrato en `docs/data-model.md`; mecánica en `docs/backend.md` / `docs/frontend.md`, §Movimientos calculados; bitácora 2026-06-19.

### Preferencias de usuario — cimiento (fase 1.1.0)

- **Estado:** implementado, **sin UI de producto**. Cimiento que persiste preferencias del usuario (sobrevive a navegación y cierre de sesión); lo consumen 1.1.4 / 1.1.5 / 1.1.6. Ver bitácora 2026-06-15.
- **Contrato** (endpoints, semántica de reemplazo total, blob en `AuthResponse`, entidad `UserPreferences`) en `docs/data-model.md`, §Contrato de preferencias de usuario y §Contrato de autenticación.
- **Backend (`PreferencesModule`):** back-compat de usuarios sin fila, `buildAuthResult` async, gotchas Prisma 7 `Json` / mock e2e en `docs/backend.md`, §Preferencias de usuario.
- **Frontend:** blob en la sesión de Auth.js, hook `usePreferences`. Detalle en `docs/frontend.md`, §Preferencias de usuario.

---

## Roadmap post v1

| Feature | Notas |
|---------|-------|
| Reportes: otros tipos (torta, barras de comparación) | Los dos tipos (ingresos/gastos + apilado por categoría) entran en v1 — RF-REP-001. Los demás tipos quedan post-v1, requieren definición de UX |
| Drill-down desde un reporte (clic en un mes → Vista del mes) | Fuera de alcance v1; candidato post-v1 |
| Agrupar la cola de categorías en una banda "Otras" en la Forma 2 (Por categoría) | En v1 la Forma 2 muestra todas las categorías con gasto sin agrupar (RF-REP-001). El colapso "Otras" por legibilidad con muchas categorías queda post-v1, requiere definición de UX |
| Tarjetas con fecha de corte | Requiere flujo propio |
| Multi-moneda | Diseñado para venir después |
| Importación desde extracto bancario | Sin decisión |
