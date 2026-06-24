# Roadmap — plan de trabajo

> Doc de trabajo **descartable**: se borra al cerrar la versión. No es registro histórico ni fuente de verdad permanente. Acá SÍ se lista lo planificado (única excepción a "documentar estado presente").
>
> La documentación de cada cambio (`requirements.md`, `screens.md`, `data-model.md`, `design.md`, archivos de agente) se escribe **al implementar cada ola**, NO acá.

---

## Convenciones

- **Impacto:** FE (frontend) · BE (backend) · CONTRATO (cambia el contrato de API) · DISEÑO (necesita spec de `control-design`).
- Cada ola = uno o pocos commits.

---

## Ola 0 — P6 (bug, primera máxima prioridad) · FE

| Ítem | Qué | Impacto |
|---|---|---|
| P6 | Los montos de movimientos **calculados** negativos no muestran el signo. | FE |

**Decisiones cerradas:**
- Ocurre **solo en `/mes`**, **solo en movimientos calculados** negativos.

**Dependencias:**
- Ninguna (puede ir en paralelo a todo).

---

## Ola 1 — P3 (TC histórico, segunda máxima prioridad) · BE + CONTRATO

| Ítem | Qué | Impacto |
|---|---|---|
| P3 | Ajustar el tipo de cambio correcto según el mes para todos los movimientos (ingresos y gastos). | BE · CONTRATO |

**Decisiones cerradas:**
- Solución **A3**: la conversión de display de **fijos y cuotas** se **deriva al vuelo** desde `CurrencyQuote`, variante **oficial**, usando el TC del **mes que le toca a cada instancia**. NO se guarda TC por cuota — coherente con el modelo on-the-fly (RN-006); recordá que no existen filas por instancia de cuota/fijo (`InstallmentGroup`/`Recurring` son una fila que abarca varios meses).
- **Únicos**: conservan su `exchangeRate` por movimiento (fecha-específico, tipeado por el usuario). El detalle de si se backfillea su TC al oficial del mes queda **abierto, se cierra al implementar la ola**.
- **Borrar `backend/prisma/backfill-rates.ts`** y su script `backfill:rates` en `package.json` (resto de la migración anterior, ya no sirve).
- Migración: **batch único** para los datos existentes.
- Fuente del TC histórico: la tabla `CurrencyQuote` (ingestada en P7).

**Dependencias:**
- Se apoya en la data de FX/IPC ya ingestada (P7).

---

## Ola 2 — P4 → P1 (encadenados) · FE + DISEÑO · CONTRATO (clave `reports` de preferencias)

| Ítem | Qué | Impacto |
|---|---|---|
| P4 | Reportes titulables. | FE · DISEÑO · CONTRATO |
| P1 | Reportes reordenables. | FE · DISEÑO · CONTRATO |

**Decisiones cerradas:**
- P4 — título **editable**, **se muestra en la cabecera** de la card. Sin título → default `"reporte N"`, con N **recalculado según las cards existentes** (no monotónico). Toca la clave `reports` de preferencias.
- P1 — reordenar por **drag & drop, mismo mecanismo que las secciones de `/mes`** (persistido en la clave `reports`, el orden es el del array). La representación "mini" para reordenar cómodamente debe ser **identificable**: **título (P4) + ícono/etiqueta de tipo**; un mini-preview del gráfico solo si resulta barato (lo evalúa `control-design`). **Alertas de renglón no aplican acá** (eso es de P2).
- **P4 va primero**: P1 necesita el título para que cada mini sea identificable.

**Dependencias:**
- P1 depende de P4.

---

## Ola 3 — P2 (tipo nuevo de reporte: vista anual por tipo de movimiento) · DISEÑO + BE + CONTRATO + FE

| Ítem | Qué | Impacto |
|---|---|---|
| P2 | Reporte anual que muestra los detalles de los meses de todo el año; se elige uno de los tres tipos de movimiento y cada uno es un reporte distinto. | DISEÑO · BE · CONTRATO · FE |

**Decisiones cerradas:**
- **Fijos**: no hay reporte por el momento.
- **Únicos**: grilla tipo Excel — eje Y = **días del mes (1–31)** como filas, eje X = los **12 meses** como columnas (28/30/31 filas según el mes). Cada celda = **total de gastos del día**, con **filtro de categorías** (selector de categorías ya existente) que afecta el total diario. **Footer por mes** con: (a) total, (b) promedio por día (total ÷ día del mes en curso, o ÷ días del mes si ya terminó), (c) %dif del total vs mes anterior (referencia Excel: `=ROUNDDOWN((PROMEDIO_DIARIO_MES_ACTUAL*100/PROMEDIO_DIARIO_MES_ANTERIOR)-100,2)`), (d) puntos de inflación del mes, (e) mismo cálculo de (c) pero **ajustado por inflación**. **Escala de color verde→rojo** por celda anclada en **0–13 USD** del total diario; todo **≥13 USD = color máximo**.
- **Cuotas (mensuales)**: gráfico tipo gantt — eje X = meses; cada gasto en cuotas es una **línea horizontal** que se expande según los meses que ocupa. **Packing**: los gastos se ordenan por **orden de creación ascendente desde la base** (el primer movimiento, el más cercano al eje X); se **reusa un renglón** siempre que se pueda, dejando **≥1 mes de "descanso"** entre líneas del mismo renglón; si no entra, se suma un renglón por encima. (Ejemplo: gastos a=mar–may, b=abr–sep, c=ene–feb → renglón 1: c y b; renglón 2: a, porque c necesita un mes de descanso antes de a.) Las **alertas de renglón quedan FUERA** de esta ola (futuro).
- **Librería de charting**: la elige `control-design` (evaluar la librería de reportes actual vs. grilla shadcn u otra opción).

**Dependencias:**
- La parte de inflación se apoya en la data de IPC (P7) y conviene tener P3 resuelto.

---

## Ola 4 — P5 (tipo nuevo de reporte: inflación vs ingresos) · DISEÑO + BE + CONTRATO + FE

| Ítem | Qué | Impacto |
|---|---|---|
| P5 | Reporte de líneas que compara inflación contra ingresos. | DISEÑO · BE · CONTRATO · FE |

**Decisiones cerradas:**
- Eje temporal = **un año** (12 meses), líneas horizontales como los demás reportes.
- **Tres líneas**, todas en puntos porcentuales para comparar visualmente: (1) puntos de inflación, (2) variación % de los ingresos, (3) variación % de los ingresos **ajustada por inflación**.
- **Línea de tendencia recta** sobre **ambas** series de ingresos (la de ingresos y la ajustada por inflación).

**Dependencias:**
- Sinergia con P3 (ajuste por inflación).
