# Control — Contexto del proyecto

## Stack

- **Frontend:** Next.js 15 (App Router) + Tailwind CSS v4
- **Backend:** NestJS + TypeScript + PostgreSQL + Prisma
- **Auth:** Auth.js (NextAuth v5) + Google OAuth

## Regla de oro — No escaparse de lo definido

Implementá / documentá **EXACTAMENTE** lo que está definido en la documentación del proyecto (`docs/requirements/`, `docs/screens.md`, `docs/data-model/`, `docs/technical.md` y las decisiones ya cerradas). No inventes, no agregues alcance, no cambies rutas, nombres, comportamientos ni decisiones por tu cuenta, ni "para destrabar".

Si aparece un conflicto entre la spec y el código existente, una ambigüedad, una decisión no tomada, o cualquier duda → **FRENÁ TODO y preguntá** (al orquestador) antes de continuar. Nunca improvises una solución ni asumas un default no escrito.

**Ante la duda, se pregunta; no se inventa.**

## Documentación

Entrada única: **`docs/README.md`** — qué leer según la tarea y dónde se documenta cada cosa. Cada `docs/<x>.md` es el índice de su carpeta `docs/<x>/`; se lee solo el archivo que hace falta. Las referencias entre docs van por archivo + título de sección, nunca por número de línea.

## Agentes

El workflow de este proyecto está manejado por agentes en `.claude/agents/`:

- **`control-orchestrator`** — agente por defecto. Analiza, propone, delega y maneja git.
- **`control-analyst`** — análisis funcional, requerimientos y definición de pantallas; escriba de la documentación funcional y técnica (`docs/` y `.claude/agents/`), excepto la documentación de diseño. Invocado por el orquestador cuando: (a) un pedido agrega o cambia un requerimiento funcional o una pantalla (antes de cerrar la decisión), o (b) hay que escribir/actualizar documentación.
- **`control-design`** — diseño visual: define el lenguaje visual (color, tipografía, ubicación, tamaño, jerarquía, comportamiento visual) y produce especificaciones de diseño que `control-frontend` implementa. Único escriba de `docs/design.md` y `docs/design/` (specs visuales). No escribe código de la app, no toca implementación, no hace git. Invocado por el orquestador.
- **`control-frontend`** — implementa cambios en el frontend. Invocado por el orquestador.
- **`control-backend`** — implementa cambios en el backend. Invocado por el orquestador.

## Decisiones de diseño

- **Control es un diario de gastos, no un sistema contable.** No agregar flujos de conciliación ni libros mayores. La multi-moneda tiene un alcance acotado —moneda y cotización por movimiento + moneda de display del usuario (ver `docs/requirements/multi-moneda.md`)—; ampliarlo se discute antes.
- **Backend separado (NestJS).** No mover la lógica de datos a API Routes de Next.js — el backend independiente mantiene la puerta abierta para mobile.
- **Movimientos de carga manual.** Los movimientos se ingresan a mano; no agregar integraciones bancarias sin decisión explícita. La única integración externa es la ingesta de cotizaciones FX e IPC desde fuentes oficiales (ver `docs/requirements/sincronizacion.md`).
- **El diseño visual tiene su propio agente (`control-design`).** El workflow para features visuales/UI es **design → frontend**: `control-design` produce el spec visual (color, tipografía, tamaño, ubicación, jerarquía) y `control-frontend` lo implementa. La guía viva del lenguaje visual vive en `docs/design/` (índice `docs/design.md`), de la que `control-design` es el único escriba.
- **QA visual al cierre de tareas con UI.** Para toda tarea con superficie visual/UI, el orquestador corre un QA visual per-feature como parte del cierre (skill `finalizar-tarea`): lo ejecuta él directo contra el navegador conectado vía `/chrome`, con hand-off del prompt al usuario en la extensión Claude para Chrome como fallback si el navegador no está disponible. Prompt genérico y plantilla per-feature: skill `qa-visual` (`.claude/skills/qa-visual/SKILL.md`).
