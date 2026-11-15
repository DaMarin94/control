# Features

> Estado de implementación de cada feature. Descripción funcional y criterios de aceptación en `docs/requirements.md`; implementación en `docs/backend.md` y `docs/frontend.md` (índices).

| Feature | ID req. | Estado |
|---------|---------|--------|
| Auth — email/contraseña (login + registro) | RF-AUTH-005..006, 002..004 | Implementado |
| Auth — Google OAuth | RF-AUTH-001 | Scaffolded (diferido) |
| Auth — cierre de sesión automático ante token expirado/inválido (redirect a login) | RF-AUTH-007 | Implementado |
| Dashboard — resumen del mes (en `/`) | RF-DASH-001..003, 005 | Implementado |
| Formulario de carga (tabs único/fijo/cuotas) | RF-CM-001 | Implementado |
| Movimiento único — crear, editar, eliminar | RF-MU-001..003 | Implementado |
| Movimiento fijo — crear, visualizar, editar, eliminar | RF-MF-001..004 | Implementado |
| Fijos — periodicidad (entero 1..12) + arranque del fijo lógico visible en `/mes` | RF-MF-006..007, RN-016 | Implementado |
| Fijos — anular / des-anular con alcance: modal en el kebab con "este mes" (preseleccionado) o un rango de meses (solo apariciones reales, hasta 24 meses) | RF-MF-005 | Implementado |
| Fijos — reabrir un fijo terminado: acción "Reabrir" del kebab, mes de reapertura + monto, relleno anulado, reemplazo de categoría/método dados de baja, calculados en espejo, entrada "Reabierto" deshacible | RF-MF-008 | Implementado |
| Anulación de únicos y cuotas | RF-MU-005, RF-MC-004, RN-020 | Implementado |
| Movimiento en cuotas — crear, visualizar, editar, eliminar | RF-MC-001..003 | Implementado (solo Gasto en v1) |
| Cuotas — total del plan derivado (card de detalle, tooltip del reporte de Cuotas, preview en el form) | RF-MC-005 | Implementado |
| Movimientos calculados — fijo/único/cuota de origen | RF-MCALC-001..011, RN-017..019 | Implementado |
| Categorías — defaults + CRUD + soft delete | RF-CAT-001..006 | Implementado |
| Métodos de pago — entidad + CRUD (sección `/configuracion/metodos-pago` del hub) + selector opcional en el form + asociación por movimiento | RF-PM-001..006, RN-021 | Implementado |
| Métodos de pago — predeterminado por estructura (único/fijo/cuota): config en el modal de crear/editar método (sección "Predeterminado para", exclusividad al guardar) + indicador de lectura en la fila + prefill editable al crear (egreso e ingreso), blob `defaultPaymentMethods` | RF-PM-007 | Implementado |
| Color de categoría editable — matriz de 40 colores | RF-CAT-005, RN-013 | Implementado |
| Vista del mes — lista + totales + navegación | RF-VM-001..004 | Implementado |
| Vista del mes — salto rápido mes/año (popover de dos ruedas) + navegación ilimitada | RF-VM-004 | Implementado |
| Vista del mes — acceso directo al mes en curso (visible solo fuera del mes actual, dirección derivada) | RF-VM-004 | Implementado |
| Skeletons — sistema unificado de estados de carga (primitivas `Skeleton*` + regla) | — | Implementado |
| Vista del mes — secciones colapsables + reordenables (persistidas) | RF-VM-005 | Implementado |
| Vista del mes — filtros por listado (tipo + categoría por sección, filtrado en front) | RF-VM-006 | Implementado |
| Vista del mes — duplicar movimiento (kebab de la fila; único/fijo/cuota no calculados; alta nueva precargada con los valores del original) | RF-VM-008 | Implementado |
| Vista del mes — evolución de un fijo en la card de detalle | RF-VM-009 | Implementado |
| Reportes + listado — filtro vía leyenda interactiva en cards y orden configurable de Únicos | RF-REP-002/006, RF-VM-001 | Implementado |
| Navegación global — sidebar persistente (5 entradas: Dashboard, Vista del mes, Reportes, Historial, Configuración) | RF-NAV-001 | Implementado |
| Configuración — hub con 4 secciones deep-linkables (General, Categorías, Métodos de pago, Límites) bajo `/configuracion/*`; Categorías y Métodos de pago no son entradas del sidebar (ver `docs/frontend/configuracion.md`) | RF-NAV-001 | Implementado |
| Navegación global — sidebar mostrable/ocultable por el usuario en todos los anchos, estado persistido (blob `sidebarOpen`, default abierto) | RF-NAV-002 | Implementado |
| Crear categoría desde el formulario de movimiento | RF-MU-004 | Implementado |
| Reportes — pantalla configurable por cards + widget en dashboard | RF-REP-001..005 | Implementado |
| Reportes — navegación de año acotada al rango de datos propio de cada card (respeta el filtro vigente, años futuros incluidos donde el dato existe) | RF-REP-002 | Implementado |
| Reportes — toggle de representación Barra / Línea en la card Gastos por categoría | RF-REP-006 | Implementado |
| Reportes — moneda de display por card (selector por card, nace con la default global) | RF-REP-007 | Implementado |
| Reportes — título editable por card (placeholder "Reporte N" si vacío) | RF-REP-008 | Implementado |
| Reportes — cards reordenables por drag & drop (modo orden, ≥2 cards) | RF-REP-009 | Implementado |
| Reportes — card "Reporte anual de Únicos" (grilla día × mes + footer de métricas mensuales) | RF-REP-010 | Implementado |
| Reportes — Únicos: techo editable de la escala de color de la card (monto + moneda, persistido en USD, default 15 USD) | RF-REP-010 | Implementado |
| Reportes — card "Reporte anual de gastos en Cuotas" (gantt de barras horizontales por mes) | RF-REP-011 | Implementado |
| Reportes — card "Inflación vs Ingresos" (líneas anuales: inflación, variación de ingresos y ajustada + tendencias OLS) | RF-REP-012 | Implementado |
| Reportes — card "Detalle histórico de fijos" (fijos de gasto e ingreso; rango de 3 meses a 5 años anclado al mes en curso, una línea por fijo, selección por fijo, modos montos/variación/ajustada, toggle "Mostrar calculados", origen del calculado en la leyenda) | RF-REP-013 | Implementado |
| Reportes — Ingresos vs Gastos: filtros de tipo de movimiento, dirección y categoría (acotan las 2 series, no es desglose) | RF-REP-014 | Implementado |
| Reportes — Ingresos vs Gastos: proyección de fijos a futuro (capacidad retenida en el backend, sin UI que la consuma) | RF-REP-015 | Backend disponible, no expuesto en UI |
| Reportes — botón de refrescar per-card (los 6 tipos + widget del Dashboard; refetch independiente, feedback solo-spinner) | RF-REP-016 | Implementado |
| Reportes — movimientos simulados desde el mes en curso (toggle opt-in por card en Ingresos vs Gastos y Gastos por categoría, persistido, off por defecto) | RF-REP-017 | Implementado |
| Multi-moneda — set curado 4 (ARS/USD/EUR/BRL) + tabla de cotizaciones de referencia + pantalla `/configuracion` | RF-CUR-001..006, RN-009 | Implementado |
| Modo de color — toggle Sistema/Claro/Oscuro en el chrome global (sidebar), persistido (blob `theme`) | RF-APP-001 | Implementado |
| Superficie de captura — única superficie en régimen de captura (`min(ancho, alto) < 600px`): crear un movimiento con el formulario completo (Único/Fijo/Cuotas), identidad de la sesión y cierre de sesión | RF-APP-003 | Implementado |
| Acceso en régimen de captura — login (email + contraseña, Google condicional) sin registro | RF-APP-004 | Implementado |
| Pantalla de espera de arranque del backend — overlay a pantalla completa sobre toda la app (incluido el acceso), con estado de error + Reintentar a los 3 min, salida automática y refetch de las lecturas caídas | RF-APP-005 | Implementado |
| Límites — marca visual pasiva (todas las superficies: `/mes`, dashboard y los 5 reportes de `/reportes`) + alerta activa (aviso no bloqueante al guardar en los 4 forms de movimiento, keys `mes.*`) + panel en la sección Límites del hub (`/configuracion/limites`, blob `limits`, client-side) | RF-LIM-001..004, RN-022 | Implementado |
| Límites — popover informativo por superficie (ícono `Info` + listado read-only agrupado por naturaleza; en las 5 cards de `/reportes` y en `/mes`, nunca en el Dashboard; incluye deshabilitados atenuados y refleja el alcance temporal) | RF-LIM-005 | Implementado |
| Sincronización de cotizaciones externas — FX (dolarapi/Frankfurter) + IPC (datos.gob.ar) vía trigger sin datos, protegido por `CRON_SECRET` | RF-FX-001, RF-IPC-001, RF-SYNC-001 | Implementado |
| Datos externos en `/configuracion` → General — vista de solo lectura del IPC (último dato + historial) y las cotizaciones del mes + disparo manual de la ingesta autenticado por sesión (tres desenlaces distinguibles por toast) | RF-SYNC-002 | Implementado |
| Historial de cambios (`/historial`) — registro de ediciones y eliminaciones de movimientos + deshacer LIFO por movimiento (simple y en cadena), borrado lógico reversible, retención 5 por movimiento / 31 días | RF-HIST-001..006, RN-024..026 | Implementado |
| Historial — deshacer inmediato desde el toast de éxito de editar/eliminar (4 formas, sin confirmación) | RF-HIST-007 | Implementado |
| Simulación de categoría — alta múltiple / extensión del `endMonth` (1, 3, 6 o 12 meses) / baja desde el filtro de Únicos de `/mes` + movimiento simulado (remanente por regresión lineal) en los meses del tramo propio de cada simulación, desde el mes en curso | RF-SIM-001..005, RN-028/029 | Implementado |
| Preferencias de usuario — cimiento (blob JSON + sesión) | — | Implementado (sin UI de producto) |
