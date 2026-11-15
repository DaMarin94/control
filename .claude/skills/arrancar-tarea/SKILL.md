---
name: arrancar-tarea
description: Usar cuando el orquestador recibe un pedido nuevo del usuario (feature, fix, refactor, cambio de doc) y todavía no delegó nada — guía lectura, análisis de impacto, plan, aprobación y delegación a los especialistas.
---

# Arrancar tarea

## 1. Leer quirúrgico
- Entrar por `docs/README.md` (índice) → leer **solo** el archivo que hace falta.
- Grep para ubicar; Read solo de los rangos relevantes. No leer entero lo que el especialista va a releer igual.
- Reads/Greps independientes en un mismo bloque, en paralelo.
- No proponer sin haber leído.

## 2. Analizar impacto
- Toca: frontend / backend / ambos.
- Revisar: arquitectura, tipos, build, features existentes, archivos afectados.
- Contratos: ¿cambia endpoint, shape de request/response, campo, tipo?
- ¿Tiene superficie visual/UI? → pasa por `control-design`.

## 3. Proponer plan
- Listar archivos a tocar, por qué, y qué agente implementa cada uno.
- Separar explícitamente:
  - **Lo definido** — requerimientos, pantallas, pedido del usuario.
  - **Lo que agrega el orquestador** — elementos, acciones, capacidades o defaults no triviales.
- Heurística: agrega **capacidad/alcance nuevo** → decisión abierta, se pregunta al usuario (no se enuncia como hecho ni se delega). **Ejecución visual** de algo ya acordado (ícono, color, tamaño, tono, ubicación) → `control-design`, sin fricción.
- Pedido que agrega/cambia requerimiento funcional o pantalla → `control-analyst` antes de cerrar la decisión.
- **Esperar aprobación explícita. No delegar nada antes.**

## 4. Delegar
| Caso | Orden |
|------|-------|
| Solo frontend | `control-frontend` |
| Solo backend | `control-backend` |
| Ambos con dependencia de contrato | `control-backend` → `control-frontend` |
| Feature visual / UI | `control-design` (spec visual) → `control-frontend` |
| Independientes | en paralelo |

- **Backend → frontend por contrato:** si backend agregó/modificó un endpoint (shape, campo, tipo), pasarle a frontend el detalle exacto antes de que implemente lo que lo consume. Tipos alineados.
- **Design → frontend por spec:** color, tipografía, tamaño, ubicación, jerarquía y estados los define `control-design`, no el frontend.

## Prompts magros
- Apuntar a `archivo:líneas`; no pegar ni re-describir código que el agente puede leer.
- Incluir lo que agrega valor: contrato, gotchas, alcance exacto.
- Pedir **señales terse**: bullets (contrato + decisiones + gotchas), sin tablas ni prosa larga.

Al terminar la implementación: skill `finalizar-tarea`.
