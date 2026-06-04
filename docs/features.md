# Features

> Descripción funcional de cada feature: qué hace, cómo funciona, y su estado actual.
> Para detalle técnico de implementación ver `frontend.md`, `backend.md`, o `mobile.md`.

---

## Cargar gasto

**Qué hace:** El usuario registra un gasto indicando monto, categoría, descripción opcional y fecha.

**Cómo funciona:**
- Formulario rápido accesible desde cualquier pantalla (botón fijo o página de entrada)
- Campos: monto (numérico, obligatorio), categoría (selector, obligatorio), descripción (texto, opcional), fecha (default: hoy)
- Al guardar, el gasto aparece inmediatamente en las vistas de lista

**Estado:** Planeado

---

## Ver gastos del mes

**Qué hace:** Muestra todos los gastos del mes actual (o el mes seleccionado) con el total acumulado.

**Cómo funciona:**
- Lista cronológica de gastos del mes, con navegación a mes anterior/siguiente
- Total del mes visible de forma prominente
- Posible desglose por semana o día

**Estado:** Planeado

---

## Ver gastos por categoría

**Qué hace:** Muestra cuánto se gastó en cada categoría en un período dado (mes/año).

**Cómo funciona:**
- Vista agrupada por categoría con subtotales
- Categorías iniciales: Consumibles, Tarjeta de crédito, Gastos fijos, Servicios
- Filtrable por mes o año

**Estado:** Planeado

---

## Features ocultas / deshabilitadas

_(Sin features ocultas por ahora)_

---

## Roadmap / Features planeadas (post v1)

| Feature | Estado | Notas |
|---------|--------|-------|
| Ver gastos del año | Planeado | Vista anual con totales por mes |
| Registro de ingresos | Planeado | El brief menciona "ganancias" — pendiente de decisión |
| Auth / multi-usuario | Planeado | Sin fecha |
| Importación desde extracto | Idea | Sin decisión |
