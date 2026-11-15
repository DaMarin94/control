---
name: finalizar-tarea
description: Usar cuando los especialistas terminaron de implementar una tarea y el orquestador tiene que cerrarla — builds/tests, QA visual, documentación, revisión de git, commit, push y limpieza del entorno.
---

# Finalizar tarea

## 1. Builds y tests
- Pedir a cada agente que implementó que corra build + suite y confirme cero errores de TypeScript.
- Errores → re-delegar la corrección antes de seguir.
- No se recortan para ahorrar: son la red de seguridad.

## 2. QA visual
- Tarea con superficie visual/UI (pasó por `control-design`) → skill `qa-visual`.
- Hallazgos → re-delegar y corregir antes de cerrar. No es gate automático.
- Sin superficie visible (backend puro, refactor de lógica) → no aplica.

## 3. Documentación
- Especialistas no escriben doc: reportan señales (contratos, reglas de negocio, decisiones técnicas/gotchas).
- **Editor = orquestador:** junta señales + lo observado; decide por cada una si se documenta y dónde.
- Preguntarse: ¿nuevo patrón, decisión, regla de negocio o excepción relevante? ¿algo que un agente futuro necesita saber? ¿algo que usuarios/devs deban entender?
- **Filtro de relevancia:** solo lo no obvio (decisiones, reglas, gotchas). Nada de changelog de setup, nada que ya vive en `docs/technical.md`, nada que se sabe abriendo `package.json` o el propio archivo.
- Destinos: ver `docs/README.md` → tabla de destinos. Un destino canónico por faceta; otro solo si aporta algo que la referencia no cubre.
- **Escriba = `control-analyst`:** pasarle la sustancia ya curada. **Una sola delegación por cambio** (incluye `features.md` y archivos de agentes). Hacer cumplir la skill `documentar`.
- La documentación va en el **mismo commit** que el código.

## 4. Revisar qué se commitea
```bash
git status
git diff
```
- Correr **ambos**: el diff no muestra archivos nuevos. Incluir untracked que correspondan.
- **`README.md` modificado siempre va en el commit**, aunque traiga cambios del usuario ajenos a la tarea (p. ej. el TODO). Nunca se deja afuera.

## 5. Commit
- Mostrar el diff y proponer mensaje descriptivo.
- **Esperar OK explícito.** Recién ahí stagear los archivos relevantes y commitear.
- Nunca `--no-verify` ni saltear hooks.

## 6. Push
- Proponer el push. **Esperar OK aparte** del commit. Nunca pushear automáticamente.

## 7. Cerrar shells
- Cerrar **todos**: servidores dev (frontend, backend) y cualquier proceso en background (builds, watchers, comandos largos), incluidos los levantados para QA o builds.
- **Verificar, no asumir:** procesos terminados y puertos **3000/3001** libres.
- La tarea no está cerrada hasta que el entorno queda como estaba.
