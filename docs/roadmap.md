# Roadmap — plan de trabajo

> **Doc de trabajo descartable.** Se borra al cerrar la versión; **no es registro histórico**.
> Es la única excepción a "documentar estado presente": acá SÍ se lista lo planificado (lo que se va a hacer).
> La documentación de cada cambio (`requirements.md`, `screens.md`, `data-model.md`, `design.md`, archivos de agente) se escribe **al implementar esa ola**, no acá.

## Convenciones

- **Impacto**: FE (frontend) · BE (backend) · CONTRATO (cambia el contrato de API) · DISEÑO (necesita spec de `control-design`).
- Cada ola = uno o pocos commits.

---

## Ola 0 — Bugs (bajo riesgo)

| Ítem | Qué | Impacto |
|---|---|---|
| **E1** | En `/mes`, con todas las secciones del acordeón colapsadas la página se ve vacía y se genera scroll sobre espacio vacío. | FE (+ mini-spec DISEÑO si hace falta) |
| **E2** | En `/reportes`, el popover del `[+]` (elegir tipo de reporte) se corta abajo en la 3ª card porque siempre abre hacia abajo. | FE (+ mini-spec DISEÑO) |
| **P6** | Los modales NO deben cerrarse al hacer click afuera. | FE |

**Decisiones cerradas:**
- E1 — Causa probable: secuela del `min-height` de viewport que pide el PeriodNav lateral para anclar las flechas.
- E2 — El popover debe "flipear" hacia arriba cuando no hay lugar abajo.
- P6 — Aplica a **TODOS** los modales. Es una **regla nueva**; el analista define su destino canónico (entre `technical.md` / `design.md`) al implementarse.

**Dependencias:** ninguna.

---

## Ola 1 — UX autocontenido

| Ítem | Qué | Impacto |
|---|---|---|
| **P4** | El título del mes en `/mes` (o un ícono cercano) se vuelve interactivo y abre un selector mes/año tipo "rueda" (2 inputs: subir/bajar o escribir) para saltar rápido entre meses. | DISEÑO-led → FE |
| **P5** | Skeletons uniformes en TODOS los procesos de carga + **regla nueva** para desarrollos futuros (siempre incluir skeletons según lineamientos). | DISEÑO-led → FE (+ regla la escribe el analista) |

**Decisiones cerradas:**
- P4 — La acción funcional **reusa** la navegación existente (RF-VM-004); es solo UI nueva. Design define el patrón visual.
- P5 — Design define el sistema/lineamientos de skeletons; frontend lo despliega; el analista escribe la regla.

**Dependencias:** ninguna.

---

## Ola 2 — Filtros / listado

> Ítems **interdependientes**: tocan el contrato de reportes + el widget/card + `/mes`.

| Ítem | Qué | Impacto |
|---|---|---|
| **P2_b** | El filtro de categorías (checklist/leyenda) lista **solo** las categorías que cambian lo que se ve en ese reporte. Si tildar/destildar una categoría no altera la info mostrada, no se lista. **Custom por card.** | FE (en `/mes`) · BE + CONTRATO (en reportes) |
| **P1** | La **leyenda** de los reportes pasa a funcionar como el filtro: clic en un ítem la activa/desactiva. **Reemplaza** el checklist embebido actual. | FE + DISEÑO |
| **P0** | En `/mes`, control de orden **ligero/disimulado** (estilo el disparador de filtro por sección) que ordena por **fecha**, solo en la sección **Únicos**. Toggle entre orden actual (monto desc) y por fecha. | FE + DISEÑO (evaluación) · CONTRATO (convención de ordering, ver abajo) |

**Decisiones cerradas:**
- P2_b — **Reemplaza** la decisión anterior (que listaba el universo completo de categorías del usuario "porque el filtro aplica también a la Forma 1").
  - En `/mes`: **solo FE** — el front ya tiene los movimientos cargados y deriva las categorías presentes por sección.
  - En reportes: el BE debe informar el **set de categorías relevante por forma**:
    - **Forma 1 modo "Total"** = categorías con **cualquier** movimiento (ingreso o gasto) del año.
    - **Forma 2 / modo "Por categoría"** = categorías con **gasto**.
  - Aplica a **todo** lugar con filtro de categoría.
- P1 — Estado apagado = tachada/subrayada (lo define DISEÑO). La lógica de filtro de **tres estados** (todas / subconjunto / ninguna) **no cambia** — solo cambia la piel/uso.
  - Caso definido (opción a): en **Forma 1 modo "Total"** la leyenda es solo Ingresos/Gastos y togglea esas series; el **filtro por categoría aparece solo cuando el gráfico muestra categorías** (Forma 2 y modo "Por categoría").
  - DISEÑO define el tratamiento visual del estado apagado.
- P0 — Solo sección **Únicos** (Fijos/Cuotas no tienen día).
  - DISEÑO debe **evaluar y recomendar**: (1) el tratamiento visual ligero del control y su default asc/desc; (2) si conviene pasar `/mes` a **tablas** en vez de listados (**solo evaluación + recomendación**, sin implementar hasta decidir).
  - Es el **disparador** de la convención global de _ordering_ en query params del API (ítem **F2** diferido en el README): al definir el orden por fecha se diseña esa convención reutilizable (formato de params, campos ordenables, dirección).
  - **Rompe** la decisión actual de "orden de ítems no alterable por el usuario" — aceptado.

**Dependencias:** Olas 2 y 3 tocan el mismo endpoint (`GET /movements/reports`) y la misma card → van **consecutivas**, cuidando no pisarse.

---

## Ola 3 — Moneda por reporte

> Toca el contrato de reportes + la card. Va **consecutiva** a la Ola 2 (mismo endpoint / misma card).

| Ítem | Qué | Impacto |
|---|---|---|
| **P3** | Cada card de reporte puede tener su **propia moneda**, independiente y persistida (como el resto de su config). | FE · BE + CONTRATO |

**Decisiones cerradas:**
- Nuevo campo `currency` en `ReportCardConfig` (clave `reports` del blob).
- `GET /movements/reports` pasa a aceptar un **override de `currency`** (hoy convierte siempre a la default vigente del usuario).
- Al crear una card nace con la **moneda default actual**, sin preguntar ni ofrecer.
- El chip de moneda del header de `/reportes` sigue reflejando la **default global**; cada card muestra/usa su propia moneda.

**Dependencias:** consecutiva a Ola 2 (mismo endpoint y card).

---

## Ola 4 — Modo oscuro

| Ítem | Qué | Impacto |
|---|---|---|
| **P2** | Dark mode con selector **Sistema / Claro / Oscuro**. | FE · BE (persistencia) · DISEÑO (paleta completa) |

**Decisiones cerradas:**
- **Default = Sistema** (preferencia del SO/navegador).
- Selector **Sistema / Claro / Oscuro** en **`/configuracion`**.
- Persistencia: **nueva clave en el blob `preferences`** (es estado de UI; vive en DB junto a `reports`/`monthSections`; sobrevive a logout/dispositivo/limpiar navegador). **NO** va en `Settings` (eso es solo para valores que el backend lee para calcular, como `defaultCurrency`).
- **Regla dura nueva**: compatibilidad visual total en cualquier tipo de dispositivo.
- DISEÑO produce la **paleta dark completa** (todos los tokens del DS en su variante oscura) **antes** de implementar.

**Dependencias:** ninguna.

---

## Backlog diferido (NO en el plan activo)

| Ítem | Qué | Estado |
|---|---|---|
| **P7** | Integrar fuente externa de tipo de cambio (idea: Frankfurter; FX definitiva por investigar porque Frankfurter no cubre ARS confiablemente) para actualizar la tabla de cotizaciones + fuente de **IPC argentino** (por definir) para inflación. | Diferido |
| **P8** | Al crear un movimiento, la cotización por defecto pasa a ser la **del día** (vía FX integrada) en vez del valor de la tabla de referencia. | Diferido — **depende de P7** |

**Notas P7:**
- Pendiente de: (a) investigación de la fuente FX, (b) recursos en Render (jobs programados), (c) fuente de IPC.
- **Rompe** la decisión "sin APIs externas en v1" — aceptado para estos casos puntuales.
- El IPC alimentará una **feature futura** de ajuste de precios por inflación en reportes.

---

## Notas de secuencia

- Olas 2 y 3 tocan el mismo endpoint (`GET /movements/reports`) y la misma card → **consecutivas**, sin pisarse.
- P8 depende de P7.
- Cada ola = uno o pocos commits; la documentación de cada cambio se escribe **al implementar esa ola**, no ahora.
