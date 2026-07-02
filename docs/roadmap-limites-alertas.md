# Roadmap — Límites y Alertas (P2)

> **Working doc descartable, exclusivo de P2.** Documento de trabajo del sistema de **Límites y Alertas**, en **fase de descubrimiento**. Es el item más grande y transversal del roadmap (`docs/roadmap.md`) y va **último**. Se borra al cerrar la versión; los RF/RN definitivos se escriben en `requirements.md` cuando el item se implemente.

Nombre de trabajo: **Límites y Alertas** (o "Límites"). "Límite" = la configuración que activa las distintas alertas, marcas de línea o cambios de estilo en reportes y pantallas.

---

## Intención completa

Un sistema para que el usuario **configure libremente** límites y alertas sobre **cualquier dato de reportes y de `/mes`**. Objetivo central de la app CONTROL: previsibilidad.

- **Abarcativo y profundo.** La idea es poder poner límites en **CUALQUIER reporte** y sobre **cualquier dato de `/mes`**. Implica ofrecer **múltiples lugares** donde marcar o resaltar objetos, líneas, números, meses — **lo que sea resaltable**. El alcance es **amplísimo**, sin recortes.
- **Aplicación condicional.** Las líneas/palabras/sobreescrituras se muestran o aplican **condicionalmente**: si cierta configuración está activada → cierto límite se muestra / cierta alerta se dispara.
- **Keys hardcodeadas como "lenguaje común".** Un registro de keys hardcodeadas —a propósito hardcodeadas— que son las comunes para disparar cada acción, por consistencia. Actúan como lenguaje compartido entre las partes que las emiten (anclajes en pantalla) y las que las consumen (config del usuario).
- **Dos naturalezas de disparo:**
  - **Marca visual pasiva** — resaltar líneas / números / cambiar estilos al cruzar un límite en `/mes` y reportes.
  - **Alerta activa** — advertencia al intentar hacer **X movimiento**.
- **Panel en Configuración.** Nueva solapa en la pantalla de configuración para **crear / editar / borrar** límites. El panel **carga toda la config del usuario** —vistas, filtros aplicados, paneles ocultos, reportes creados (con sus títulos, sus filtros de categoría) y ahora sus límites— de modo que desde ahí mismo se puedan editar los límites de **toda la app**.

---

## Enfoque acordado

- **Descubrimiento-primero.** control-analyst modela el **concepto completo** antes de cualquier planificación de implementación:
  - qué es un "límite",
  - catálogo de **keys hardcodeadas** y qué dispara cada una,
  - mapa de **todos los anclajes** de `/mes` y de **todos los reportes**,
  - diseño del panel de configuración.

  Con el modelo **aprobado por el usuario** se planifica back / front / design.
- **Alcance entero, sin recortes.** Cubre todos los anclajes posibles; nada acotado.

---

## Semilla del descubrimiento (restricciones acordadas)

1. **Límites por usuario.**
2. **Persistencia.** Arranca en el **blob de preferencias**, clave nueva `limits`, igual que `reports` / `monthSections` ("tu config es tu pantalla"). Se revisa **solo si** el descubrimiento halla necesidad de evaluación server-side.
3. **Dos naturalezas de disparo** (ver arriba): marca visual pasiva + alerta activa al intentar X movimiento. El descubrimiento **prioriza cuál se ataca primero**.
4. **Evaluación client-side en v1.** Se evalúan en el frontend sobre datos que **ya tiene**; el backend queda afuera (blob opaco, como `theme` / `reports`). Las keys hardcodeadas son un **registro compartido front ↔ design** (el "lenguaje común").
