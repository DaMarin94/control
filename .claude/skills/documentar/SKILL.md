---
name: documentar
description: Usar cuando hay que escribir o actualizar documentación del proyecto Control (`docs/` o `.claude/agents/`) — típicamente `control-analyst` al recibir una delegación de doc, y el orquestador al curar qué se documenta.
---

# Documentar

## Reglas vivas
- **Estado actual, en presente**, como si siempre hubiera sido así. Documentar el resultado, no la transición.
- **Prohibido registrar cuándo o por qué cambió algo** — eso es git:
  - etiquetas de fase/versión ("Fase 6", "corregido 1.2.4")
  - narrativa de cambio ("antes era X / ahora Y", "ya no", "se revirtió")
  - causalidad histórica ("fue la causa del bug E1", "para destrabar")
  - prohibiciones que solo existen por historia ("no reintroducir GET viejo")
- **Sí se queda:** el por qué técnico-estructural (cómo funciona hoy, informa decisiones futuras). "Deprecado" solo si sigue vivo en el código y un agente puede toparse con ello, en presente.
- **Destinos mínimos:** un destino canónico por faceta (decisión, regla o contrato escrito completo en un solo doc). Los demás referencian por archivo + título de sección ("ver RF-XXX", "ver `docs/data-model/movimientos.md` §…"), sin números de línea; no repiten.
- **Archivo nuevo ⇒ fila en el índice de su carpeta** (`requirements.md`, `data-model.md`, `frontend.md`, `backend.md`).
- **Archivos de agente sin gotchas por feature.** El gotcha estructural va a `docs/`; el agente solo apunta dónde leerlo.
- **Nada de changelog** ni de lo que se sabe abriendo el código o el propio archivo. No repetir estándares que viven en otro doc.
- **Roadmap descartable:** doc de trabajo, se borra al cerrar la versión; no es fuente de verdad.
- Tablas y bullets sobre prosa.
- Sustancia ambigua o incompleta → preguntar al orquestador; no inventar.
- `docs/design.md` y specs visuales son de `control-design`: no se escriben acá.

## Dónde va cada cosa
Tabla "Dónde se documenta cada cosa" de `docs/README.md` (un destino canónico por faceta). Faceta sin destino claro → preguntar al orquestador.
