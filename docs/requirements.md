# Requerimientos — Control

> Documento vivo. Separa lo **decidido** de lo **abierto**.
> Para el detalle técnico ver `architecture.md`, `data-model.md`.
> Para el estado de implementación ver `features.md`.

---

## 1. Visión general

Control es una app web personal para registrar gastos e ingresos diarios. El objetivo central es **previsibilidad**: ver de un vistazo en qué se va la plata, cuánto entra, y detectar patrones mes a mes.

**Principios que guían cada decisión:**
- Registro rápido — cargar un movimiento tiene que ser la acción más fácil.
- Visualización clara — totales y agrupaciones legibles sin analizar tablas.
- Un solo flujo — no es un sistema contable. Rechazar complejidad que no aporte previsibilidad.

---

## 2. Módulos

---

### 2.1 Auth

| # | Requerimiento | Estado |
|---|---|---|
| A1 | Login con Google OAuth | Decidido |
| A2 | Sin login no se puede ver ni hacer nada | Decidido |
| A3 | Sesión persistente — no pide login en cada visita | Decidido |
| A4 | Logout disponible | Decidido |

**Reglas:**
- Un usuario = una cuenta Google.
- Los datos de un usuario nunca son visibles para otro.

---

### 2.2 Dashboard / Home

> **Estado: a definir en detalle.** La pantalla existe y muestra un resumen del mes, pero el contenido exacto está abierto.

| # | Requerimiento | Estado |
|---|---|---|
| D1 | Pantalla principal al abrir la app | Decidido |
| D2 | Muestra resumen del mes actual | Decidido |
| D3 | Botón / acceso rápido para cargar un nuevo movimiento | Decidido |
| D4 | Contenido exacto del resumen (qué números, qué gráfico) | **Abierto** |
| D5 | ¿Navegación entre meses desde el dashboard? | **Abierto** |

---

### 2.3 Movimientos

Un movimiento puede ser un **gasto** (`EXPENSE`) o un **ingreso** (`INCOME`).
Todo movimiento pertenece a una categoría.

#### 2.3.1 Movimiento común (único)

El caso más simple: algo que pasó una vez, en una fecha.

| # | Requerimiento | Estado |
|---|---|---|
| M1 | Cargar un movimiento con: tipo (gasto/ingreso), monto, categoría, fecha | Decidido |
| M2 | Descripción opcional | Decidido |
| M3 | Fecha default: hoy. El usuario puede cambiarla | Decidido |
| M4 | Editar un movimiento ya cargado (monto, categoría, descripción, fecha, tipo) | Decidido |
| M5 | Eliminar un movimiento | Decidido |

**Reglas:**
- El monto siempre es positivo. El tipo (EXPENSE/INCOME) define el signo.
- Monto en centavos internamente — nunca floats.

---

#### 2.3.2 Movimiento fijo (recurrente mensual)

Un movimiento que se repite automáticamente todos los meses: sueldo, alquiler, Netflix, etc.

| # | Requerimiento | Estado |
|---|---|---|
| F1 | Cargar un movimiento fijo con: tipo, monto, categoría, descripción opcional | Decidido |
| F2 | Aparece automáticamente en el mes actual y en todos los siguientes | Decidido |
| F3 | No tiene día de mes — es mensual (sin fecha específica dentro del mes) | Decidido |
| F4 | Dura indefinidamente hasta que el usuario lo elimina | Decidido |
| F5 | Al editar (monto, categoría, descripción): aplica a todos los meses futuros | Decidido |
| F6 | Al editar o eliminar: los meses pasados no se tocan | Decidido |
| F7 | Al eliminar: deja de aparecer — ¿desde el mes actual o el siguiente? | **Abierto** |
| F8 | Edición de un mes pasado específico de un fijo | Fuera de v1 |

**Reglas:**
- Un movimiento fijo no es una instancia de mes — es una "plantilla" activa.
- El historial de meses anteriores es inmutable una vez pasados.

---

#### 2.3.3 Movimiento en cuotas

Una compra o cobro que se distribuye en N meses iguales.

| # | Requerimiento | Estado |
|---|---|---|
| C1 | Cargar cuotas con: tipo, monto de cada cuota, cantidad de meses, mes de inicio | Decidido |
| C2 | Descripción opcional | Decidido |
| C3 | La app muestra una cuota por mes durante N meses consecutivos desde el mes de inicio | Decidido |
| C4 | El monto cargado es el de **cada cuota** (no el total) | Decidido |
| C5 | Cancelación parcial de cuotas restantes | **Abierto** (probablemente fuera de v1) |
| C6 | Ingreso en cuotas (ej: cobrar un trabajo en 3 pagos) | **Abierto** |
| C7 | Integración con fecha de corte de tarjeta de crédito | Fuera de v1 |

**Reglas:**
- Las cuotas son del mismo monto. No hay cuotas variables.
- El mes de inicio lo elige el usuario.

---

### 2.4 Categorías

Las categorías clasifican los movimientos. Aplican tanto a gastos como a ingresos.

| # | Requerimiento | Estado |
|---|---|---|
| CA1 | Crear categoría (nombre) | Decidido |
| CA2 | Editar nombre de categoría | Decidido |
| CA3 | Eliminar categoría | Decidido |
| CA4 | Categorías default al crear cuenta | Decidido |
| CA5 | No se puede eliminar una categoría con movimientos asociados — o sí, con reasignación | **Abierto** |
| CA6 | Categorías separadas para gastos vs. ingresos, o compartidas | **Abierto** |

**Categorías default al crear cuenta:**
- Consumibles
- Tarjeta de crédito
- Gastos fijos
- Servicios

*(El usuario puede crear las suyas y eliminar estas si quiere.)*

---

### 2.5 Vista de movimientos del mes

| # | Requerimiento | Estado |
|---|---|---|
| VM1 | Ver todos los movimientos de un mes | Decidido |
| VM2 | Total de gastos del mes | Decidido |
| VM3 | Total de ingresos del mes | Decidido |
| VM4 | Balance del mes (ingresos − gastos) | Decidido |
| VM5 | Filtrar por categoría dentro del mes | **Abierto** |
| VM6 | Navegación entre meses (ver mayo, abril, etc.) | **Abierto** |
| VM7 | Acceso a edición/eliminación de cada movimiento desde la lista | Decidido |

---

### 2.6 Historial

| # | Requerimiento | Estado |
|---|---|---|
| H1 | Vista de historial de meses anteriores | Fuera de v1 |

---

### 2.7 Gráficos

| # | Requerimiento | Estado |
|---|---|---|
| G1 | Gráficos de gastos/ingresos | Fuera de v1 |
| G2 | Tipo de gráficos (torta, barras, línea) | Sin definir |
| G3 | Personalización de gráficos | Sin definir |

---

### 2.8 Tarjetas de crédito

| # | Requerimiento | Estado |
|---|---|---|
| T1 | Configurar tarjetas con fecha de corte y apertura | Fuera de v1 |
| T2 | Calcular automáticamente en qué mes cae cada cuota según fecha de corte | Fuera de v1 |

---

## 3. Reglas de negocio globales

- **Aislamiento de usuario:** todos los recursos (movimientos, categorías) están filtrados por `userId`. Imposible ver datos de otro usuario.
- **Monto siempre positivo.** El tipo (EXPENSE/INCOME) define el signo. Nunca guardar montos negativos.
- **Moneda implícita en v1.** No hay campo de moneda. El sistema no asume ni muestra símbolo de moneda. Diseñado para poder agregar `currency` después sin romper datos.
- **Fecha de movimiento ≠ fecha de carga.** La `date` es la que el usuario elige, no el timestamp de creación.
- **Movimiento fijo — inmutabilidad del pasado.** Editar o eliminar un fijo no modifica meses ya pasados.

---

## 4. Flujos clave

### Cargar un movimiento (flujo principal)

```
1. Usuario abre la app (o toca el botón "+")
2. Elige: gasto o ingreso
3. Elige tipo de pago: común / fijo / cuotas
4. Completa el formulario según el tipo:
   - Común: monto, categoría, fecha, descripción?
   - Fijo:   monto, categoría, descripción?
   - Cuotas: monto/cuota, cantidad de cuotas, mes de inicio, categoría, descripción?
5. Confirma → movimiento aparece en la vista del mes
```

### Editar un movimiento fijo

```
1. Usuario toca el movimiento fijo en la vista del mes
2. Edita monto / categoría / descripción
3. Confirma → aplica a todos los meses futuros
4. Los meses pasados permanecen igual
```

### Eliminar un movimiento fijo

```
1. Usuario elimina el fijo
2. [ABIERTO] ¿Desaparece desde el mes actual o desde el próximo?
3. Meses anteriores: sin cambios
```

---

## 5. Fuera de scope — v1

Estas features están explícitamente excluidas de v1. Si alguien las "agrega" sin discutirlo, rompe el scope.

| Feature | Por qué fuera |
|---|---|
| Gráficos | Requiere definición de UX, no es bloqueante |
| Vista de historial | No es prioridad inicial |
| Tarjetas con fecha de corte | Complejo, requiere su propia definición |
| Edición de mes pasado de un fijo | Complejidad de modelo de datos |
| Cancelación parcial de cuotas | Pendiente de definición |
| Multi-moneda / selección de moneda | Diseñado para venir después |
| Multi-usuario | Sin fecha |
| Importación desde extracto | Sin decisión |
| Ingreso en cuotas | Existe en la vida real, sin definir aún |

---

## 6. Decisiones abiertas

| # | Decisión | Prioridad para definir |
|---|---|---|
| DA1 | Contenido exacto del dashboard (qué números, qué gráfico) | Alta — bloquea diseño de la home |
| DA2 | ¿Cuándo para un fijo al eliminarlo: mes actual o siguiente? | Alta — afecta UX y modelo |
| DA3 | ¿Se puede eliminar una categoría con movimientos? ¿O requiere reasignación? | Media |
| DA4 | ¿Categorías compartidas entre gastos e ingresos, o separadas? | Media |
| DA5 | ¿Navegación entre meses desde el dashboard? | Media |
| DA6 | ¿Filtro por categoría dentro de la vista del mes? | Media |
| DA7 | ¿Cancelación parcial de cuotas? | Baja — fuera de v1 |
| DA8 | ¿Ingreso en cuotas? | Baja — fuera de v1 |

---

## 7. Backlog priorizado

### P0 — Sin esto la app no existe

| ID | Feature |
|---|---|
| P0-1 | Auth — Google OAuth, sesión persistente |
| P0-2 | Cargar movimiento común (gasto / ingreso) |
| P0-3 | Vista del mes — lista de movimientos + totales |
| P0-4 | Categorías — defaults al crear cuenta |
| P0-5 | Editar y eliminar movimiento |

### P1 — La app es útil pero incompleta sin esto

| ID | Feature |
|---|---|
| P1-1 | Movimiento fijo (recurrente mensual) |
| P1-2 | Movimiento en cuotas |
| P1-3 | ABM de categorías |
| P1-4 | Dashboard / home con resumen |

### P2 — Agrega valor, puede esperar

| ID | Feature |
|---|---|
| P2-1 | Navegación entre meses |
| P2-2 | Filtro por categoría en la vista del mes |
| P2-3 | Vista de historial |

### Futuro — explícitamente fuera de v1

| ID | Feature |
|---|---|
| F-1 | Gráficos |
| F-2 | Tarjetas con fecha de corte |
| F-3 | Multi-moneda |
| F-4 | Importación desde extracto |
