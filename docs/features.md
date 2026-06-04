# Features

> Descripción funcional de cada feature: qué hace, cómo funciona, y su estado actual.
> Para detalle técnico de implementación ver `frontend.md`, `backend.md`, o `mobile.md`.

---

## Auth

**Qué hace:** El usuario inicia sesión para acceder a sus datos. Sin login, la app no muestra nada.

**Cómo funciona:**
- Página de login como punto de entrada
- Proveedor: pendiente de decisión (ver decisiones abiertas)
- Sesión persistente — no pedir login en cada visita

**Estado:** Planeado

---

## Cargar movimiento (gasto o ingreso)

**Qué hace:** El usuario registra un movimiento de dinero: puede ser un egreso (gasto) o un ingreso.

**Cómo funciona:**
- Formulario rápido accesible desde cualquier pantalla
- Campos: tipo (gasto / ingreso), monto (numérico, obligatorio), categoría (selector, obligatorio), descripción (texto, opcional), fecha (default: hoy)
- Al guardar, el movimiento aparece inmediatamente en las vistas de lista

**Estado:** Planeado

---

## Ver movimientos del mes

**Qué hace:** Muestra todos los movimientos del mes actual (o el mes seleccionado) con totales de gastos, ingresos y balance.

**Cómo funciona:**
- Lista cronológica de movimientos del mes, con navegación a mes anterior/siguiente
- Balance del mes (ingresos − gastos) visible de forma prominente
- Subtotales separados de gastos e ingresos

**Estado:** Planeado

---

## Ver movimientos por categoría

**Qué hace:** Muestra cuánto se gastó (o ingresó) en cada categoría en un período dado.

**Cómo funciona:**
- Vista agrupada por categoría con subtotales
- Filtrable por mes o año
- Solo muestra categorías que tienen al menos un movimiento en el período

**Estado:** Planeado

---

## Gestión de categorías

**Qué hace:** El usuario puede crear, renombrar y eliminar sus categorías.

**Cómo funciona:**
- CRUD completo de categorías (nombre, tipo opcional: gasto/ingreso/ambos — TBD)
- Categorías default al crear la cuenta: Consumibles, Tarjeta de crédito, Gastos fijos, Servicios
- No se puede eliminar una categoría que tenga movimientos asociados (o pide reasignar primero — TBD)

**Estado:** Planeado

---

## Features ocultas / deshabilitadas

_(Sin features ocultas por ahora)_

---

## Roadmap / Features planeadas (post v1)

| Feature | Estado | Notas |
|---------|--------|-------|
| Vista anual | Planeado | Totales por mes en el año |
| Selección de moneda | Planeado | 100% switcheable — no tocar en v1 |
| Tarjeta de crédito (flujo específico) | Abierto | Demasiado complejo para v1 |
| Importación desde extracto | Idea | Sin decisión |
