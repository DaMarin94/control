# Requerimientos Funcionales — Control (índice)

> Requerimientos funcionales de Control: qué hace el sistema, bajo qué condiciones, y los criterios verificables de cada requerimiento. Se dividen en un archivo por módulo dentro de `docs/requirements/`. Para el modelo de datos ver `docs/data-model.md`; para el estado de implementación, `docs/features.md`; para las pantallas, `docs/screens.md`.
> Aplica a la plataforma **web**; no hay aplicación nativa.

## Archivos

| Archivo | Contenido |
|---|---|
| `requirements/definiciones-y-alcance.md` | §1 Definiciones (abreviaturas), §2 Descripción general del sistema, §5 Requerimientos no funcionales (RNF), §6 Fuera de alcance v1 |
| `requirements/auth.md` | §3.1 Autenticación |
| `requirements/dashboard.md` | §3.2 Dashboard |
| `requirements/unicos.md` | §3.3 Movimientos únicos (incluye el formulario de carga RF-CM-001) |
| `requirements/fijos.md` | §3.4 Movimientos fijos |
| `requirements/calculados.md` | §3.4.b Movimientos calculados |
| `requirements/cuotas.md` | §3.5 Movimientos en cuotas |
| `requirements/categorias.md` | §3.6 Categorías |
| `requirements/metodos-pago.md` | §3.6.b Métodos de pago |
| `requirements/vista-mes.md` | §3.7 Vista del mes |
| `requirements/navegacion.md` | §3.8 Navegación |
| `requirements/informes.md` | §3.9 Reportes |
| `requirements/multi-moneda.md` | §3.10 Multi-moneda |
| `requirements/apariencia.md` | §3.11 Apariencia (modo de color, régimen de captura, espera de arranque) |
| `requirements/sincronizacion.md` | §3.12 Sincronización de cotizaciones externas (FX, IPC) |
| `requirements/limites.md` | §3.13 Límites |
| `requirements/historial.md` | §3.14 Historial de cambios |
| `requirements/simulacion.md` | §3.15 Simulación de categoría |
| `requirements/reglas-de-negocio.md` | §4 Reglas de negocio (RN) |
| `requirements/glosario.md` | §7 Glosario |

## ID → archivo

| ID | Archivo |
|---|---|
| RF-AUTH-001 | `requirements/auth.md` |
| RF-AUTH-002 | `requirements/auth.md` |
| RF-AUTH-003 | `requirements/auth.md` |
| RF-AUTH-004 | `requirements/auth.md` |
| RF-AUTH-005 | `requirements/auth.md` |
| RF-AUTH-006 | `requirements/auth.md` |
| RF-AUTH-007 | `requirements/auth.md` |
| RF-DASH-001 | `requirements/dashboard.md` |
| RF-DASH-002 | `requirements/dashboard.md` |
| RF-DASH-003 | `requirements/dashboard.md` |
| RF-DASH-005 | `requirements/dashboard.md` |
| RF-CM-001 | `requirements/unicos.md` |
| RF-MU-001 | `requirements/unicos.md` |
| RF-MU-002 | `requirements/unicos.md` |
| RF-MU-003 | `requirements/unicos.md` |
| RF-MU-004 | `requirements/unicos.md` |
| RF-MU-005 | `requirements/unicos.md` |
| RF-MF-001 | `requirements/fijos.md` |
| RF-MF-002 | `requirements/fijos.md` |
| RF-MF-003 | `requirements/fijos.md` |
| RF-MF-004 | `requirements/fijos.md` |
| RF-MF-005 | `requirements/fijos.md` |
| RF-MF-006 | `requirements/fijos.md` |
| RF-MF-007 | `requirements/fijos.md` |
| RF-MF-008 | `requirements/fijos.md` |
| RF-MCALC-001 | `requirements/calculados.md` |
| RF-MCALC-002 | `requirements/calculados.md` |
| RF-MCALC-003 | `requirements/calculados.md` |
| RF-MCALC-004 | `requirements/calculados.md` |
| RF-MCALC-005 | `requirements/calculados.md` |
| RF-MCALC-006 | `requirements/calculados.md` |
| RF-MCALC-007 | `requirements/calculados.md` |
| RF-MCALC-008 | `requirements/calculados.md` |
| RF-MCALC-009 | `requirements/calculados.md` |
| RF-MCALC-010 | `requirements/calculados.md` |
| RF-MCALC-011 | `requirements/calculados.md` |
| RF-MC-001 | `requirements/cuotas.md` |
| RF-MC-002 | `requirements/cuotas.md` |
| RF-MC-003 | `requirements/cuotas.md` |
| RF-MC-004 | `requirements/cuotas.md` |
| RF-MC-005 | `requirements/cuotas.md` |
| RF-CAT-001 | `requirements/categorias.md` |
| RF-CAT-002 | `requirements/categorias.md` |
| RF-CAT-003 | `requirements/categorias.md` |
| RF-CAT-004 | `requirements/categorias.md` |
| RF-CAT-005 | `requirements/categorias.md` |
| RF-CAT-006 | `requirements/categorias.md` |
| RF-PM-001 | `requirements/metodos-pago.md` |
| RF-PM-002 | `requirements/metodos-pago.md` |
| RF-PM-003 | `requirements/metodos-pago.md` |
| RF-PM-004 | `requirements/metodos-pago.md` |
| RF-PM-005 | `requirements/metodos-pago.md` |
| RF-PM-006 | `requirements/metodos-pago.md` |
| RF-PM-007 | `requirements/metodos-pago.md` |
| RF-VM-001 | `requirements/vista-mes.md` |
| RF-VM-002 | `requirements/vista-mes.md` |
| RF-VM-003 | `requirements/vista-mes.md` |
| RF-VM-004 | `requirements/vista-mes.md` |
| RF-VM-005 | `requirements/vista-mes.md` |
| RF-VM-006 | `requirements/vista-mes.md` |
| RF-VM-007 | `requirements/vista-mes.md` |
| RF-VM-008 | `requirements/vista-mes.md` |
| RF-VM-009 | `requirements/vista-mes.md` |
| RF-NAV-001 | `requirements/navegacion.md` |
| RF-NAV-002 | `requirements/navegacion.md` |
| RF-REP-001 | `requirements/informes.md` |
| RF-REP-002 | `requirements/informes.md` |
| RF-REP-003 | `requirements/informes.md` |
| RF-REP-004 | `requirements/informes.md` |
| RF-REP-005 | `requirements/informes.md` |
| RF-REP-006 | `requirements/informes.md` |
| RF-REP-007 | `requirements/informes.md` |
| RF-REP-008 | `requirements/informes.md` |
| RF-REP-009 | `requirements/informes.md` |
| RF-REP-010 | `requirements/informes.md` |
| RF-REP-011 | `requirements/informes.md` |
| RF-REP-012 | `requirements/informes.md` |
| RF-REP-013 | `requirements/informes.md` |
| RF-REP-014 | `requirements/informes.md` |
| RF-REP-015 | `requirements/informes.md` |
| RF-REP-016 | `requirements/informes.md` |
| RF-REP-017 | `requirements/informes.md` |
| RF-CUR-001 | `requirements/multi-moneda.md` |
| RF-CUR-002 | `requirements/multi-moneda.md` |
| RF-CUR-003 | `requirements/multi-moneda.md` |
| RF-CUR-004 | `requirements/multi-moneda.md` |
| RF-CUR-005 | `requirements/multi-moneda.md` |
| RF-CUR-006 | `requirements/multi-moneda.md` |
| RF-APP-001 | `requirements/apariencia.md` |
| RF-APP-003 | `requirements/apariencia.md` |
| RF-APP-004 | `requirements/apariencia.md` |
| RF-APP-005 | `requirements/apariencia.md` |
| RF-FX-001 | `requirements/sincronizacion.md` |
| RF-IPC-001 | `requirements/sincronizacion.md` |
| RF-SYNC-001 | `requirements/sincronizacion.md` |
| RF-SYNC-002 | `requirements/sincronizacion.md` |
| RF-LIM-001 | `requirements/limites.md` |
| RF-LIM-002 | `requirements/limites.md` |
| RF-LIM-003 | `requirements/limites.md` |
| RF-LIM-004 | `requirements/limites.md` |
| RF-LIM-005 | `requirements/limites.md` |
| RF-HIST-001 | `requirements/historial.md` |
| RF-HIST-002 | `requirements/historial.md` |
| RF-HIST-003 | `requirements/historial.md` |
| RF-HIST-004 | `requirements/historial.md` |
| RF-HIST-005 | `requirements/historial.md` |
| RF-HIST-006 | `requirements/historial.md` |
| RF-HIST-007 | `requirements/historial.md` |
| RF-SIM-001 | `requirements/simulacion.md` |
| RF-SIM-002 | `requirements/simulacion.md` |
| RF-SIM-003 | `requirements/simulacion.md` |
| RF-SIM-004 | `requirements/simulacion.md` |
| RF-SIM-005 | `requirements/simulacion.md` |
| RN-001 | `requirements/reglas-de-negocio.md` |
| RN-002 | `requirements/reglas-de-negocio.md` |
| RN-003 | `requirements/reglas-de-negocio.md` |
| RN-004 | `requirements/reglas-de-negocio.md` |
| RN-005 | `requirements/reglas-de-negocio.md` |
| RN-006 | `requirements/reglas-de-negocio.md` |
| RN-007 | `requirements/reglas-de-negocio.md` |
| RN-008 | `requirements/reglas-de-negocio.md` |
| RN-009 | `requirements/reglas-de-negocio.md` |
| RN-010 | `requirements/reglas-de-negocio.md` |
| RN-011 | `requirements/reglas-de-negocio.md` |
| RN-012 | `requirements/reglas-de-negocio.md` |
| RN-013 | `requirements/reglas-de-negocio.md` |
| RN-014 | `requirements/reglas-de-negocio.md` |
| RN-015 | `requirements/reglas-de-negocio.md` |
| RN-016 | `requirements/reglas-de-negocio.md` |
| RN-017 | `requirements/reglas-de-negocio.md` |
| RN-018 | `requirements/reglas-de-negocio.md` |
| RN-019 | `requirements/reglas-de-negocio.md` |
| RN-020 | `requirements/reglas-de-negocio.md` |
| RN-021 | `requirements/reglas-de-negocio.md` |
| RN-022 | `requirements/reglas-de-negocio.md` |
| RN-023 | `requirements/reglas-de-negocio.md` |
| RN-024 | `requirements/reglas-de-negocio.md` |
| RN-025 | `requirements/reglas-de-negocio.md` |
| RN-026 | `requirements/reglas-de-negocio.md` |
| RN-027 | `requirements/reglas-de-negocio.md` |
| RN-028 | `requirements/reglas-de-negocio.md` |
| RN-029 | `requirements/reglas-de-negocio.md` |
| RN-030 | `requirements/reglas-de-negocio.md` |
| RNF-001 … RNF-008 | `requirements/definiciones-y-alcance.md`, §5 |
