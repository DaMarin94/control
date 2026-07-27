/**
 * Tipos del contrato de serie de reportes — GET /movements/reports?year=YYYY[&categories=id1,id2,...][&currency=XXX]
 *
 * Fuente de verdad: docs/data-model.md, sección "Contrato de serie de reportes".
 * Renombre de annual.ts (Fase 1.1.5): el endpoint pasó de /movements/annual a /movements/reports
 * y se le agregó el param `categories` para filtrar por subconjunto de categorías.
 * Ola 3 (P3): se agrega el param `currency` para override de moneda de display por card.
 *
 * El frontend define sus propios tipos reflejando el contrato; no hay paquete
 * compartido con el backend.
 */

import type { CurrencyCode } from "@/types/settings";

/** Un mes del año con sus totales de ingreso y gasto. Siempre 12, ene→dic. */
export interface ReportMonth {
  /** "YYYY-MM" */
  month: string;
  /** Suma de ingresos del mes en centavos (únicos + fijos + cuotas), filtrada al set pedido. */
  incomeCents: number;
  /** Suma de gastos del mes en centavos (únicos + fijos + cuotas), filtrada al set pedido. */
  expenseCents: number;
  /**
   * true solo en meses futuros cuando se pide `projectFixed=true` (RF-REP-015).
   * Sigue existiendo en el contrato del backend, pero ninguna pantalla lo consume hoy:
   * el render de proyección se retiró del frontend (revert RF-REP-015). Reservado para
   * un futuro módulo de simulación que consultará el endpoint fresco con este param.
   */
  projected?: boolean;
}

/** Categoría con su gasto mensual desagregado. Solo categorías con gasto EXPENSE. */
export interface ReportCategory {
  categoryId: string;
  name: string;
  /** Color hex de la matriz, ej. "#4F86C6". */
  color: string;
  /**
   * Exactamente 12 valores, ene→dic.
   * 0 donde no hay gasto en ese mes.
   * Invariante: sum(categories[*].monthlyExpenseCents[i]) == months[i].expenseCents.
   */
  monthlyExpenseCents: number[];
}

/**
 * Item de `availableCategories` específico de `ReportsMovementsResponse` (fix E2).
 * A diferencia del shape base usado por los demás reportes (annual-unicos, annual-cuotas,
 * annual-inflation-income), este trae los booleanos `hasExpense`/`hasIncome` para que el
 * front pueda derivar universos de leyenda distintos por tipo de card (by-category vs
 * income-expense) a partir de la MISMA respuesta.
 */
export interface ReportsAvailableCategory {
  categoryId: string;
  name: string;
  color: string;
  /** true si la categoría tuvo al menos un movimiento de gasto en el año (universo estable, sin filtro). */
  hasExpense: boolean;
  /** true si la categoría tuvo al menos un movimiento de ingreso en el año (universo estable, sin filtro). */
  hasIncome: boolean;
}

/** Respuesta de GET /movements/reports?year=YYYY[&categories=...] (dentro del sobre { success, data }). */
export interface ReportsMovementsResponse {
  /** El año pedido. */
  year: number;
  /** Siempre 12 entradas, ene→dic, en orden. Filtradas al set pedido. */
  months: ReportMonth[];
  /** Solo categorías con gasto EXPENSE en el año, dentro del set pedido. Ordenadas por gasto anual total DESC. */
  categories: ReportCategory[];
  /**
   * Universo ESTABLE de categorías (gasto e ingreso) en el año, SIN aplicar el filtro de categorías.
   * Superconjunto de `categories`: siempre incluye todas las categorías con gasto del año,
   * independientemente del filtro activo. Siempre presente (puede ser []). Ordenado por gasto anual DESC.
   * El front lo usa como universo de la leyenda-filtro (P2_b) en lugar de useCategories.
   * Cada item trae `hasExpense`/`hasIncome` para derivar el universo por tipo de card (fix E2):
   * by-category filtra por `hasExpense === true`; income-expense usa el universo completo.
   */
  availableCategories: ReportsAvailableCategory[];
  /**
   * Año más antiguo con algún movimiento del usuario.
   * null si el usuario no tiene ningún movimiento.
   * NO afectado por el filtro de categorías.
   * El front lo usa para deshabilitar la navegación ‹ antes del primer año.
   */
  earliestYear: number | null;
}

// ─── Tipos de configuración de cards de reporte (Fase 1.1.5) ─────────────────

/**
 * Tipo de reporte de una card.
 * - "income-expense": Forma 1, Ingresos vs. Gastos (AreaChart)
 * - "by-category": Forma 2, Gastos por categoría apilado (BarChart)
 * - "unique-grid": Ola 3 P2, grilla día×mes de Únicos (heatmap calendario nativo)
 * - "installment-gantt": Ola 3 P2, gantt anual de barras horizontales de Cuotas
 * - "inflation-income": Ola 4 P5, gráfico de líneas Inflación vs Ingresos
 */
export type ReportCardType = "income-expense" | "by-category" | "unique-grid" | "installment-gantt" | "inflation-income";

// ─── Tipos del endpoint de reporte anual de Únicos (Ola 3, P2) ───────────────

/**
 * Métricas del footer de un mes en el reporte de grilla de Únicos.
 * Siempre 12 entradas, índice = mes-1.
 */
export interface UnicoGridFooterMonth {
  /** Suma de gastos únicos del mes en centavos (en la currency de display). */
  total: number;
  /**
   * Promedio diario del mes en centavos.
   * null si el mes es futuro (divisor = 0).
   */
  dailyAvg: number | null;
  /**
   * %dif vs mes anterior (ROUNDDOWN a 2 decimales).
   * null si mes anterior tiene avg=0 o es el primero con dato → mostrar "—".
   */
  pctVsPrev: number | null;
  /**
   * Puntos % de IPC del mes (inflación).
   * null si no hay dato de inflación.
   */
  inflationPct: number | null;
  /**
   * %dif ajustado por inflación.
   * null si falta IPC o avgPrev=0.
   */
  pctVsPrevAdj: number | null;
}

/**
 * Respuesta de GET /movements/reports/annual-unicos?year=YYYY[&categories=...][&currency=XXX][&today=YYYY-MM-DD]
 * (dentro del sobre { success, statusCode, data }).
 *
 * Fuente de verdad: contrato del backend (Ola 3, P2 — actualizado con breakdown).
 */
export interface UnicoGridResponse {
  /** El año pedido. */
  year: number;
  /** Moneda de display usada (la pedida por ?currency= o la default del usuario). */
  currency: "ARS" | "USD" | "EUR" | "BRL";
  /**
   * Ancla de la rampa de color en centavos de la moneda de display.
   * Equivale a 15 USD de poder adquisitivo, reconvertido con el TC de enero del año del reporte.
   * El front lo usa para calcular t = clamp(totalDía / colorAnchorCents, 0, 1).
   * Es solo referencia de paleta visual; nunca se muestra como cifra.
   * Si la moneda es USD, ronda 1500 (15 USD en centavos).
   */
  colorAnchorCents: number;
  /**
   * Grilla SIEMPRE 31 filas × 12 columnas.
   * grid[day-1][month-1] = total de gastos únicos de ese día en centavos (currency).
   * 0 si no hay gasto O si el día no existe en ese mes (feb 30, abr 31, etc.).
   * El frontend distingue "día inexistente" via calendario, no por el valor.
   */
  grid: number[][];
  /**
   * Desglose por categoría, paralelo a `grid`.
   * breakdown[day-1][month-1] = array de { categoryId, amount } ordenado por amount DESC.
   * Celda sin gasto → []. Día inexistente → [] (no iterar: distinguir por calendario igual que grid).
   * amount en cents de la moneda de display. Color y nombre se resuelven desde availableCategories.
   */
  breakdown: Array<Array<Array<{ categoryId: string; amount: number }>>>;
  /**
   * Footer de métricas. SIEMPRE 12 entradas, índice = mes-1.
   */
  footer: UnicoGridFooterMonth[];
  /**
   * Universo de categorías con gasto único en el año (sin aplicar filtro).
   * El front lo usa como universo del filtro de chips de categoría y para resolver
   * color/nombre de las entradas del breakdown.
   */
  availableCategories: Array<{ categoryId: string; name: string; color: string }>;
  /**
   * Ancla canónica de la rampa en centavos de USD (Ola 3, P3 — techo editable).
   * Entero. Ausente el techo custom → ronda 1500 (15 USD). Con techo custom →
   * el valor que el backend derivó de `anchorAmountCents`/`anchorCurrency`.
   * El front lo persiste tal cual (vía `onAnchorChange` → `ReportCardConfig.anchorUsdCents`)
   * sin recalcular TC — la conversión a USD la hace el backend, nunca el front.
   */
  anchorUsdCents: number;
}

/**
 * Configuración persistida de una card de reporte (clave `reports` del blob de preferencias).
 * Fuente de verdad: docs/data-model.md, §Clave `reports`.
 */
export interface ReportCardConfig {
  /** Id local de la card (key de React / quitar); generado en el front (crypto.randomUUID). */
  id: string;
  /** Tipo de reporte. */
  type: ReportCardType;
  /** Año que muestra la card. */
  year: number;
  /**
   * Filtro de categorías.
   * null = todas las categorías (default al crear).
   * lista = subconjunto explícito de categoryIds seleccionados.
   */
  categoryIds: string[] | null;
  /**
   * @deprecated Usado por `income-expense` para el modo "Por categoría" (pre-reagrupamiento).
   * La normalización del blob lo migra:
   *   - income-expense con categoryBreakdown=true → { type: "by-category", categoryChartMode: "line" }
   *   - income-expense con categoryBreakdown=false/absent → queda income-expense sin este campo
   * No debe usarse en código nuevo. Se preserva en el tipo para que la normalización lo lea.
   */
  categoryBreakdown?: boolean;
  /**
   * Modo de visualización del gráfico de la card `by-category`.
   * "bar" (default / ausente) = barras apiladas por categoría (Forma 2 histórica).
   * "line" = stack de áreas apiladas por categoría (mismo dato, geometría continua).
   * Solo aplica cuando type === "by-category". Ignorado en otros tipos.
   * Ausente equivale a "bar" (back-compat: cards existentes mantienen comportamiento actual).
   */
  categoryChartMode?: "bar" | "line";
  /**
   * Series ocultas en la vista "Total" de la card income-expense.
   * Omitido / undefined = ambas visibles (default).
   * Permite ocultar una o ambas series; si están todas ocultas → canvas vacío
   * que reutiliza el empty "Sin movimientos en {año}.".
   * Solo aplica a type === "income-expense".
   * En by-category usa categoryIds (filtro de categorías); hiddenSeries no aplica.
   */
  hiddenSeries?: Array<"income" | "expense">;
  /**
   * Moneda de display de la card (Ola 3, P3).
   * Ausente / undefined = usa la default global del usuario (back-compat: cards viejas sin
   * este campo caen a la default global automáticamente por el ?? del ReportCard).
   * Presente = override local; el backend convierte la serie a esa moneda antes de devolverla.
   * Persistido por card. Al crear, nace con la default actual del usuario.
   */
  currency?: CurrencyCode;
  /**
   * Título editable de la card (Ola 2, P4).
   * Ausente / undefined = la card muestra el placeholder "Reporte N" (N = posición 1-based
   * en el array de cards, recalculado en vivo). El placeholder es solo display: nunca se
   * persiste "Reporte N" como título; si el usuario confirma sin escribir nada, el campo
   * se omite del objeto persistido (queda ausente / undefined).
   * Presente = título propio del usuario (máx. 60 caracteres, trimmeado al persistir).
   */
  title?: string;
  /**
   * Filtro de tipo de movimiento para la card `income-expense` (RF-REP-014).
   * Ausente / undefined = todos los tipos (back-compat: cards viejas sin este campo).
   * Lista con todos los tres tipos explícitos → equivalente a ausente (omit param).
   * [] → `&types=` vacío → backend retorna totales en cero.
   * Solo aplica a type === "income-expense". Ignorado en otros tipos.
   */
  movementTypes?: Array<"fijo" | "cuota" | "unico">;
  /**
   * Filtro de dirección para la card `income-expense` (RF-REP-014).
   * Ausente / undefined = "both" (back-compat: cards viejas sin este campo).
   * "expense" = solo gastos; "income" = solo ingresos; "both" = ambos.
   * Ausente y "both" producen el mismo param (omitido), misma query key (null).
   * Solo aplica a type === "income-expense". Ignorado en otros tipos.
   */
  direction?: "expense" | "income" | "both";
  /**
   * Toggle de proyección de fijos a futuro (RF-REP-015).
   * Sigue existiendo en el contrato del backend (`&projectFixed=true&today=YYYY-MM-DD`,
   * `ReportMonth.projected`), pero ninguna pantalla lo consume hoy: el frontend retiró
   * el render de proyección de la card income-expense (revert RF-REP-015). Cards ya
   * persistidas con `projectFixed: true` simplemente dejan de proyectar (no se migra /
   * borra el campo del blob). Reservado para un futuro módulo de simulación que
   * consumirá el endpoint fresco con este param.
   */
  projectFixed?: boolean;
  /**
   * Techo (ancla) editable de la rampa de color de la card `unique-grid` (Ola 3, P3).
   * Entero, centavos de USD. Ausente / undefined = techo estándar (15 USD = 1500 cents
   * USD, back-compat: cards existentes sin este campo mantienen el comportamiento actual).
   * Presente = override local persistido en USD; el backend lo reconvierte por año y
   * moneda de display de la card en cada fetch (`colorAnchorCents` de la respuesta).
   * Se persiste el `anchorUsdCents` que devuelve el backend al guardar (el front nunca
   * calcula la conversión a USD). Solo aplica a type === "unique-grid". Ignorado en otros tipos.
   */
  anchorUsdCents?: number;
}

// ─── Tipos del endpoint de reporte anual de Cuotas (Ola 3, P2) ───────────────

/**
 * Una barra del gantt de cuotas.
 * El backend calcula el packing; el front hace layout, clipping e indicadores ‹/›.
 */
export interface CuotasGanttBar {
  /** Id del movimiento de cuota. */
  id: string;
  /** Descripción de la compra (puede ser null). */
  description: string | null;
  /** Id de la categoría (para resolver color/nombre desde availableCategories). */
  categoryId: string;
  /** Monto POR CUOTA en la moneda de display (en centavos). */
  amountCents: number;
  /** Mes de inicio visible en el año pedido (0-based, 0=enero, 11=diciembre). */
  startMonthIndex: number;
  /** Mes de fin visible en el año pedido (0-based, INCLUSIVO). */
  endMonthIndex: number;
  /** true si la compra empezó antes de enero del año → mostrar chevron ‹. */
  continuesBefore: boolean;
  /** true si la compra termina después de diciembre del año → mostrar chevron ›. */
  continuesAfter: boolean;
  /** Nº de cuota (1-based) que cae en startMonthIndex. */
  installmentFrom: number;
  /** Nº de cuota (1-based) que cae en endMonthIndex. */
  installmentTo: number;
  /** Total de cuotas del plan de pagos. */
  totalInstallments: number;
  /** Renglón asignado por el packing (0 = más cercano al eje, crece hacia arriba). */
  rowIndex: number;
  /**
   * Mes de inicio REAL de la compra en formato "YYYY-MM" (sin recortar al año visible).
   * Ej.: "2025-11" si la compra empezó en noviembre 2025, aunque el año mostrado sea 2026.
   * Entregado por el backend — usado en el tooltip para mostrar el rango real.
   */
  realStartMonth: string;
  /**
   * Mes de fin REAL de la compra en formato "YYYY-MM" (sin recortar al año visible).
   * Ej.: "2027-03" si la compra termina en marzo 2027, aunque el año mostrado sea 2026.
   * Entregado por el backend — usado en el tooltip para mostrar el rango real.
   */
  realEndMonth: string;
}

/**
 * Respuesta de GET /movements/reports/annual-cuotas?year=YYYY[&categories=...][&currency=XXX]
 * (dentro del sobre { success, statusCode, data }).
 *
 * Fuente de verdad: contrato del backend (Ola 3, P2).
 * Nota: sin parámetro `today` (diferencia con annual-unicos).
 */
export interface CuotasGanttResponse {
  /** El año pedido. */
  year: number;
  /** Moneda de display usada. */
  currency: "ARS" | "USD" | "EUR" | "BRL";
  /**
   * Barras del gantt, ordenadas por rowIndex ASC y dentro por startMonthIndex ASC.
   * rowIndex=0 = renglón pegado al eje → el front lo renderiza ABAJO (inversión del eje visual).
   */
  bars: CuotasGanttBar[];
  /** Total de renglones (0 si sin barras). */
  rowCount: number;
  /**
   * Universo de categorías con cuotas EXPENSE en el año (sin aplicar filtro).
   * El front resuelve color/nombre de cada barra desde aquí por categoryId.
   */
  availableCategories: Array<{ categoryId: string; name: string; color: string }>;
}

// ─── Tipos del endpoint de reporte anual de Inflación vs Ingresos (Ola 4, P5) ──

/**
 * Datos de un mes en el reporte de inflación vs ingresos.
 * Índice mes-1 (ene=0, dic=11). 12 entradas fijas.
 */
export interface InflationIncomeMonth {
  /**
   * Puntos porcentuales de inflación del mes (IPC).
   * null = sin dato de inflación para ese mes.
   */
  inflationPct: number | null;
  /**
   * Variación % de ingresos nominales respecto al mes anterior.
   * null = sin dato (meses futuros / previo en 0 → sin punto).
   */
  incomePct: number | null;
  /**
   * Variación % de ingresos ajustada por inflación.
   * null = sin dato.
   */
  incomePctAdj: number | null;
}

/**
 * Recta de tendencia (mínimos cuadrados) sobre una serie.
 * El backend calcula los puntos; el front solo los traza.
 */
export interface InflationIncomeTrend {
  slope: number;
  intercept: number;
  /**
   * 12 valores (uno por mes, ordenados ene→dic) de la recta y=slope*x+intercept.
   * null si hay menos de 2 puntos con dato → no se traza la tendencia.
   */
  points: number[] | null;
}

/**
 * Respuesta de GET /movements/reports/annual-inflation-income?year=YYYY[&categories=...][&currency=XXX][&today=YYYY-MM-DD]
 * (dentro del sobre { success, statusCode, data }).
 *
 * Fuente de verdad: contrato del backend (Ola 4, P5).
 */
export interface AnnualInflationIncomeResponse {
  /** El año pedido. */
  year: number;
  /** Moneda de display usada (la pedida por ?currency= o la default del usuario). */
  currency: "ARS" | "USD" | "EUR" | "BRL";
  /**
   * 12 entradas fijas (ene→dic), índice = mes-1.
   * inflationPct/incomePct/incomePctAdj en puntos porcentuales (no centavos).
   * null = sin punto (meses futuros / previo en 0) → la línea se corta.
   */
  months: InflationIncomeMonth[];
  /**
   * Recta de tendencia (mínimos cuadrados) sobre la serie de ingresos nominal.
   * points=null → no se dibuja la tendencia (menos de 2 puntos).
   */
  incomeTrend: InflationIncomeTrend;
  /**
   * Recta de tendencia (mínimos cuadrados) sobre la serie de ingresos ajustada.
   * points=null → no se dibuja la tendencia (menos de 2 puntos).
   */
  incomeAdjTrend: InflationIncomeTrend;
  /**
   * Año más antiguo con ingresos del usuario (sin aplicar filtro).
   * null si no hay datos. Usado para el tope ‹ del stepper.
   */
  earliestYear: number | null;
  /**
   * Universo de categorías de INGRESO en el año (sin aplicar filtro).
   * El front lo usa como universo del filtro de chips de categoría.
   */
  availableCategories: Array<{ categoryId: string; name: string; color: string }>;
}

// Re-export para conveniencia de los consumidores de este módulo
export type { CurrencyCode };
