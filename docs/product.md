# Producto

> Documento vivo de producto. Es el paraguas conceptual de Control: qué es, para quién, qué principios lo guían y hacia dónde va — en todas sus plataformas.
>
> Separa lo **decidido** (hechos del producto hoy) de lo **abierto** (decisiones que vamos tomando). Cuando una decisión abierta se cierra, se mueve a la sección que corresponda.
>
> Es el paraguas conceptual, no el roadmap: el alcance de versiones concretas (ej. v1 de mobile) se documenta junto a cada proyecto, no acá.
>
> Para el detalle técnico de cada capa ver `architecture.md`, `backend.md`, `frontend.md`.

---

## 1. Qué es

Control es una app web para llevar un seguimiento diario de gastos personales. El usuario ingresa cada gasto con su monto, categoría y fecha, y puede visualizarlos agrupados por mes, año o tipo. El foco es la previsibilidad: ver de un vistazo en qué se va la plata y detectar patrones.

## 2. Principios

- **Registro rápido.** Cargar un gasto tiene que ser la acción más fácil de la app — mínimos campos obligatorios, sin fricción.
- **Visualización clara.** Los totales y agrupaciones tienen que ser legibles de un vistazo, sin necesidad de analizar tablas.
- **Un solo flujo.** La app no es un sistema contable — es un diario de gastos. No agregar complejidad que no aporte previsibilidad.

## 3. Qué NO es (anti-features)

Decisiones explícitas de lo que el producto **no** hace, para no desviarse:

- **No es un sistema contable.** Sin libros mayores, sin conciliación bancaria, sin múltiples monedas (por ahora).
- **No es multi-usuario.** No hay roles, permisos, ni workspaces compartidos en v1.

_(Sección a completar a medida que se rechacen ideas concretas)_

## 4. Para quién (público)

**Uso personal, disciplinado.** Control es para personas que quieren registrar sus gastos día a día y tienen la disciplina para hacerlo. No apunta a usuarios casuales que necesitan que la app lo haga sola (sin integración bancaria automática).

**Principio rector — velocidad de carga:** el flujo crítico es "abro la app → cargo el gasto → listo". Tiene que ser instantáneo y sin ambigüedad.

**Contexto de uso:** en el momento del gasto (celular o escritorio), o al final del día para registrar lo del día.

## 5. Plataformas

| Plataforma | Stack | Estado |
|---|---|---|
| Web | Next.js 15 + Tailwind CSS v4 | En desarrollo |
| Mobile | — | No aplica (v1) |
| Extension | — | No aplica (v1) |

### 5.1 Reglas permanentes por plataforma

**Web:**
- Es la única plataforma activa en v1. Todo el esfuerzo va acá.

## 6. Alcance

**Hoy (v1):** uso personal, local, sin auth. Un solo usuario. Los datos viven en PostgreSQL local (o en el servidor de deploy).

**Dirección futura:** multi-usuario con auth, posible mobile, posible importación desde extractos bancarios.

**Decisiones pendientes:** ¿Auth en v1 o después? ¿Un usuario hardcodeado o signup real?

## 7. Estado de features (transversal)

| Feature | Estado |
|---|---|
| Cargar gasto | Planeado |
| Ver gastos del mes | Planeado |
| Ver gastos por categoría | Planeado |

---

## Decisiones de producto abiertas

> Lista viva. Cada item es una conversación pendiente. Cuando se cierra, se documenta arriba.

- **¿Auth en v1?** ¿Hay login o la app arranca directamente sin usuario? Si hay auth, ¿qué proveedor?
- **¿Ingresos o solo gastos?** El brief menciona "ganancias" — ¿se registran también o es solo egresos?
- **¿Moneda fija o configurable?** ¿La app asume una moneda (ARS?) o permite elegir?
- **¿Qué categorías son fijas vs. personalizables?** El brief menciona consumibles, tarjeta, gastos fijos, servicios — ¿el usuario puede agregar las suyas?
- **¿Cómo se maneja la tarjeta de crédito?** ¿Se registra el gasto en el momento o al vencimiento del resumen?

---

## Bitácora de decisiones

> Registro cronológico de decisiones de producto cerradas, con fecha y motivo.

<!-- Formato: **YYYY-MM-DD — Título.** Descripción. Motivo: razón. -->
