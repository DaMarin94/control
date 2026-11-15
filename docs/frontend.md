# Frontend — índice

La documentación del frontend vive en `docs/frontend/`. **`base.md` se lee siempre** (lo transversal); el resto es un archivo por feature. Cada título de sección se conserva en su archivo destino.

| Sección | Archivo | Incluye |
|---|---|---|
| Stack | `frontend/base.md` | |
| Tipos | `frontend/base.md` | |
| Estructura de carpetas | `frontend/base.md` | |
| Convenciones | `frontend/base.md` | Hidratación y SSR; Helpers (`lib/format.ts`) |
| Sistema de componentes (UI primitives) | `frontend/base.md` | Primitivas de formulario — `min-w-0`; Estados de carga: skeletons; Modales y diálogos: portal a `body`; Shell de modales — `ModalShell`; Modal portado con `closeOnScrimClick` dentro de un trigger clickeable; Foco inicial dentro de un modal; `useScrollShadow`; Portal para overlays anclados; Posicionamiento + cierre de listbox/popover por portal — `use-listbox-popover`; Overlay portaleado en dos pasadas; Breakpoint — `wide:` / `max-wide:`; Régimen de superficie — `capture:` / `app-regime:` |
| Dos regímenes de superficie (RF-APP-003/004) | `frontend/base.md` | Una lógica, dos composiciones; Footer como slot del envase; ids del DOM — prefijo `useId()`; Viewport meta; Toasts — `--toast-inset-bottom` |
| Autenticación (Auth.js / NextAuth v5) | `frontend/base.md` | Providers; Callbacks y sesión; Seeding de la sesión; Adjuntar el Bearer; Queries gate-adas con `isAuthenticated`; Pantallas y protección de rutas; Manejo centralizado del 401 |
| Gate de arranque del backend (RF-APP-005) | `frontend/gate-arranque.md` | |
| Preferencias de usuario | `frontend/base.md` | Preferencias en la sesión de Auth.js; Hook `usePreferences` |
| Hub de Configuración (`/configuracion`) — destino canónico | `frontend/configuracion.md` | |
| Categorías (`/configuracion/categorias`) | `frontend/categorias.md` | Flujo de reactivación; Paleta de colores; Uso dual de `CategoryFormModal`; Apilado de modales — z-index |
| Métodos de pago (íconos) | `frontend/metodos-pago.md` | Allowlist de íconos; selector listbox; Default por estructura — prefill one-shot |
| Movimientos únicos | `frontend/unicos.md` | Modal de carga; `transaction-form`; Moneda y cotización; Duplicar; `use-transactions`. *Helpers (`lib/format.ts`)* → `frontend/base.md` |
| Movimientos fijos | `frontend/fijos.md` | `recurring-form.tsx`; `delete-recurring-dialog.tsx`; `use-recurring`; Reapertura. *`movement-item-row.tsx` y `MovementDetailCard`* → `frontend/vista-mes-y-dashboard.md` |
| Movimientos calculados | `frontend/calculados.md` | |
| Movimientos en cuotas | `frontend/cuotas.md` | |
| Navegación de período (`PeriodNav`) | `frontend/period-nav.md` | |
| Vista del mes y Dashboard | `frontend/vista-mes-y-dashboard.md` | `movement-item-row.tsx`; `MovementDetailCard`; `use-movements`; Mapeo `MovementItem → Transaction`; `<Suspense>` + `useSearchParams`; Animación de acordeón grid-rows; Navegación entre pantallas |
| Navegación global (sidebar — RF-NAV-001/002) | `frontend/navegacion.md` | |
| Reportes (RF-REP-001..012) | `frontend/graficos.md` | Arquitectura en dos capas; Stepper de año; `use-reports`; Filtros de la card income-expense; Aporte simulado; Puntos de uso; Gotchas Recharts; Cards `unique-grid`, `installment-gantt`, `inflation-income`, `fixed-evolution`; Gotchas de las cards de gráficos |
| Simulación de categoría (`/mes` — RF-SIM-001..005) | `frontend/simulacion.md` | |
| Historial de cambios (`/historial` — RF-HIST-001..006) | `frontend/historial.md` | Deshacer desde el toast — invariante del `groupId` |
| Límites (RF-LIM-001..004) | `frontend/limites.md` | |
| Design system "Precise Ledger" — tokens | `frontend/base.md` | |
| Modo de color (theming) | `frontend/base.md` | |
| Tailwind v4 — convenciones y gotcha | `frontend/base.md` | |
| Íconos de la app y PWA manifest | `frontend/base.md` | Logo de marca in-app |
| Testing — gotchas | `frontend/base.md` | |
