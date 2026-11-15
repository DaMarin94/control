# 3.2 Módulo: Dashboard

> Parte de los requerimientos funcionales de Control. Índice e ID → archivo: `docs/requirements.md`.

---

## RF-DASH-001 — Pantalla principal

| Campo | Detalle |
|---|---|
| **Descripción** | El dashboard es la pantalla de inicio. Se muestra al autenticarse y centraliza el acceso a las funciones principales. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] Al iniciar sesión, el sistema redirige automáticamente al dashboard.
- [ ] El **resumen financiero del dashboard** (tarjetas Gastos/Ingresos + balance, RF-DASH-002) muestra **siempre el mes actual** — no tiene navegación entre meses.
- [ ] La **única navegación de período del dashboard** vive en el **widget de reporte Ingresos vs. Gastos** que monta (RF-REP-002): ese widget navega **año** de forma independiente y activa, sin afectar el resumen mensual, que sigue fijo en el mes en curso.
- [ ] El dashboard contiene acceso directo para cargar un nuevo movimiento (RF-DASH-003).
- [ ] El dashboard incluye acceso a la vista del mes completa (RF-DASH-005).

---

## RF-DASH-002 — Resumen financiero del mes actual

| Campo | Detalle |
|---|---|
| **Descripción** | El dashboard muestra los totales del mes en curso: total de gastos, total de ingresos y balance. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] Se muestra el total de gastos del mes actual.
- [ ] Se muestra el total de ingresos del mes actual.
- [ ] Se muestra el balance del mes (ingresos − gastos).
- [ ] Los totales incluyen movimientos únicos, fijos activos en el mes y cuotas que caen en el mes.
- [ ] Si no hay movimientos, los totales se muestran en cero.
- [ ] El resumen mensual **permanece fijo en el mes en curso** aun cuando el usuario navegue años en el widget de reporte del dashboard (RF-REP-002): la navegación del widget es por **año** y **no** mueve estas tarjetas.

---

## RF-DASH-003 — Acceso rápido a nuevo movimiento

| Campo | Detalle |
|---|---|
| **Descripción** | El dashboard expone un acceso directo y visible para cargar un nuevo movimiento. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] Existe un botón claramente visible para iniciar la carga de un movimiento.
- [ ] La acción abre el formulario de carga sin pasos intermedios.
- [ ] La acción está disponible en un máximo de 2 interacciones desde cualquier pantalla.

---

## RF-DASH-005 — Acceso a la vista del mes completa

| Campo | Detalle |
|---|---|
| **Descripción** | El dashboard ofrece un enlace para acceder a la vista del mes con todos los movimientos. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] Existe un enlace "Ver todos" (o equivalente) que lleva a la vista del mes.
- [ ] La vista del mes se abre mostrando el mes actual.
