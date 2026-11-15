---
name: spec-visual
description: Usar cuando control-design tiene que producir un spec visual (modo spec) para que control-frontend lo implemente sin tomar decisiones visuales — una feature, pantalla o patrón nuevo, o un cambio a uno vigente. Da la plantilla del spec, la del "Checklist de aceptación visual" y dónde escribirlo en la guía viva.
---

# Spec visual

## Antes de escribir

1. Leé `docs/design/fundamentos.md` (reglas duras, tokens, contención responsive) y el archivo del patrón que tocás (buscalo en el índice `docs/design.md`).
2. Leé el estado real (componentes involucrados) y el brief funcional. Si hay ambigüedad o conflicto con lo vigente: frená y preguntá al orquestador.
3. Reusá patrones existentes. Una pieza nueva justifica por qué no reusa uno vigente.

## Dónde se escribe

- **Patrón/feature nuevo:** archivo nuevo `docs/design/<nombre-kebab-en-español>.md`, con el encabezado:
  `> Parte de la guía viva de diseño (índice: docs/design.md). Base obligatoria: fundamentos.md.`
- **Cambio a uno vigente:** editá su archivo en el lugar. Reemplazá lo viejo; no dejes "Actualizado:", "antes/ahora", etiquetas de fase ni el spec reemplazado.
- **Siempre:** agregá/actualizá la fila en la tabla **"sección → archivo"** de `docs/design.md`, con el título textual (`##`/`###`). Los títulos son estables: el código los cita como `docs/design.md §<Título>`.
- Lo funcional/técnico (requirements, screens, frontend) no es tuyo: reportalo como señal al orquestador.

## Plantilla de spec

```markdown
### <Título estable del patrón/feature>

<Qué es y qué problema del usuario resuelve, en 2–4 líneas. Qué reusa.>

#### 0. Encuadre — qué cambia y qué no
<Alcance; invariante de cero impacto si aplica.>

#### 1. <Elemento>
- **Forma:** token/escala/espaciado concretos (p. ej. `--panel-2`, 12.5px/500 `--muted`, `--r-ctl`).
- **Por qué:** principio de la Lente UX + objetivo del usuario. Opciones descartadas y motivo.
- **Estados:** reposo · hover · focus (`--accent-soft` 3px) · activo · deshabilitado · cargando · vacío · error · éxito (los que apliquen).
- **A11y:** rol/aria, foco, nunca solo color, target ~44px.

#### N. Contención responsive (obligatoria)
Disposición compacta (`< --bp-wide`) y amplia; checkpoints (600 sidebar cerrado/abierto, 941, 1288). Cómo se cumplen en este elemento:
1. Sin scroll horizontal del `body`.
2. Overlays/modales completos y scrolleables.
3. Ninguna acción inalcanzable.
4. Superficies anchas scrollean dentro de sí.

#### N+1. Agregados más allá del brief — estado
- <pieza> — *agregado no solicitado, confirmar*.

#### N+2. Reglas duras reafirmadas
- Verde = ingreso, rojo = gasto (nada más).
- Índigo solo marca / focus; nunca en cifras.
- Toda cifra de dinero en IBM Plex Mono `tnum`.
- Identidad en claro y oscuro.

### Checklist de aceptación visual — <Título>
```

## Plantilla de "Checklist de aceptación visual"

Va al final de cada spec. Ítems breves, **verificables a ojo o con medición** (no "se ve bien"). El orquestador lo reusa en el QA visual (skill `qa-visual`).

```markdown
### Checklist de aceptación visual — <Título>

> Escenario recomendado: <datos/estado necesarios para probar>.

*<Grupo, p. ej. Estados>:*
- [ ] <Elemento> muestra <token/valor esperado> en <estado>.
- [ ] Cero impacto: sin <condición>, <superficie> se ve igual (delta 0px en `getBoundingClientRect`).
- [ ] Foco con teclado: ring `--accent-soft` 3px; orden de Tab <a → b → c>.
- [ ] Ninguna pieza usa verde/rojo fuera de su significado, ni índigo fuera del focus; cifras en mono tabular.

*Contención y modos de color:*
- [ ] 600px sidebar abierto (352 de contenido): sin scroll horizontal del `body`; <overlay> entero; acciones alcanzables.
- [ ] 941px y 1288px: <disposición amplia esperada>.
- [ ] Claro y oscuro: <qué verificar>.
```
