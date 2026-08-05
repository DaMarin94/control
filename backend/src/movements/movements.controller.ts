import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Request,
} from '@nestjs/common';
import { Currency } from '@prisma/client';
import { MovementsService } from './movements.service';

interface AuthRequest extends Request {
  user: { userId: string };
}

/** Año mínimo aceptado por el endpoint anual (sano, no artificial). */
const YEAR_MIN = 1900;
/** Año máximo aceptado: el actual + 1 para no bloquear tests futuros cercanos. */
const YEAR_MAX = 2200;

/**
 * MovementsController — endpoint unificado de movimientos del mes y del año.
 *
 * Todas las rutas están protegidas por JwtAuthGuard (global).
 * El userId se extrae SIEMPRE de request.user.userId (nunca del body/query).
 * Filtrado por userId en todo momento (RN-003).
 */
@Controller('movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  /**
   * GET /movements/reports/annual-inflation-income?year=YYYY[&categories=<id1,id2,...>][&currency=<ARS|USD|EUR|BRL>][&today=YYYY-MM-DD]
   *
   * Devuelve el reporte anual de inflación vs ingresos del usuario para el año dado.
   * Por cada mes emite:
   *   inflationPct  — variación IPC mensual (puntos %); null si sin dato.
   *   incomePct     — variación MoM del ingreso total del mes (truncada 2 dec);
   *                   null si mes futuro del año en curso o si ingreso anterior == 0.
   *   incomePctAdj  — igual pero ajustado por IPC; null si falta IPC, mes futuro o anterior == 0.
   * Además: tendencias lineales (slope, intercept, points) para incomePct e incomePctAdj,
   * earliestYear y availableCategories (universo de categorías con INCOME en el año).
   *
   * Parámetros:
   * - year (obligatorio): año en formato YYYY.
   * - categories (opcional): filtro de categorías, 3 estados (misma semántica que /reports).
   * - currency (opcional): override de moneda de display (ARS|USD|EUR|BRL).
   * - today (opcional): fecha local del usuario YYYY-MM-DD para determinar meses futuros.
   *
   * Respuesta: AnnualInflationIncomeResponse dentro del sobre { success, statusCode, data }.
   * 400 si year falta, formato inválido, fuera de rango, o currency inválido.
   */
  @Get('reports/annual-inflation-income')
  getAnnualInflationIncomeReport(
    @Request() req: AuthRequest,
    @Query('year') yearParam: string | undefined,
    @Query('categories') categoriesParam: string | undefined,
    @Query('currency') currencyParam: string | undefined,
    @Query('today') todayParam: string | undefined,
  ) {
    if (!yearParam || !/^\d{4}$/.test(yearParam)) {
      throw new BadRequestException(
        'El parámetro "year" es obligatorio y debe tener exactamente 4 dígitos (ej: 2026)',
      );
    }

    const year = parseInt(yearParam, 10);

    if (year < YEAR_MIN || year > YEAR_MAX) {
      throw new BadRequestException(
        `El año debe estar entre ${YEAR_MIN} y ${YEAR_MAX}`,
      );
    }

    let currencyOverride: Currency | undefined;
    if (currencyParam !== undefined) {
      const validCurrencies: string[] = Object.values(Currency);
      if (!validCurrencies.includes(currencyParam)) {
        throw new BadRequestException(
          `El parámetro "currency" debe ser uno de: ${validCurrencies.join(', ')}`,
        );
      }
      currencyOverride = currencyParam as Currency;
    }

    let todayStr: string | undefined;
    if (todayParam !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(todayParam)) {
        throw new BadRequestException(
          'El parámetro "today" debe tener formato YYYY-MM-DD (ej: 2026-06-25)',
        );
      }
      todayStr = todayParam;
    }

    const categoryIds: string[] | null =
      categoriesParam === undefined
        ? null
        : categoriesParam.trim().length === 0
          ? []
          : categoriesParam
              .split(',')
              .map((id) => id.trim())
              .filter((id) => id.length > 0);

    return this.movementsService.getAnnualInflationIncomeReport(
      req.user.userId,
      year,
      categoryIds,
      currencyOverride,
      todayStr,
    );
  }

  /**
   * GET /movements/reports/annual-cuotas?year=YYYY[&categories=<id1,id2,...>][&currency=<ARS|USD|EUR|BRL>]
   *
   * Devuelve el gantt anual de cuotas EXPENSE del usuario para el año dado.
   * Solo InstallmentGroups de tipo EXPENSE. Fijos, únicos y cuotas INCOME NO entran.
   *
   * Parámetros:
   * - year (obligatorio): año en formato YYYY.
   * - categories (opcional): lista de categoryIds separados por comas.
   *   Misma semántica de 3 estados que /movements/reports.
   *   El filtro se aplica ANTES del packing; el packing devuelto refleja el subconjunto filtrado.
   * - currency (opcional): override de moneda de display (ARS|USD|EUR|BRL).
   *   Ausente → usa la default del usuario.
   *
   * Respuesta: AnnualCuotasResponse dentro del sobre { success, statusCode, data }.
   * 200 con las barras del gantt, rowCount y availableCategories.
   * 400 si year falta, formato inválido, fuera de rango, o currency inválido.
   */
  @Get('reports/annual-cuotas')
  getAnnualCuotasReport(
    @Request() req: AuthRequest,
    @Query('year') yearParam: string | undefined,
    @Query('categories') categoriesParam: string | undefined,
    @Query('currency') currencyParam: string | undefined,
  ) {
    // Validar presencia y formato exacto YYYY
    if (!yearParam || !/^\d{4}$/.test(yearParam)) {
      throw new BadRequestException(
        'El parámetro "year" es obligatorio y debe tener exactamente 4 dígitos (ej: 2026)',
      );
    }

    const year = parseInt(yearParam, 10);

    if (year < YEAR_MIN || year > YEAR_MAX) {
      throw new BadRequestException(
        `El año debe estar entre ${YEAR_MIN} y ${YEAR_MAX}`,
      );
    }

    // Validar currency (solo si está presente)
    let currencyOverride: Currency | undefined;
    if (currencyParam !== undefined) {
      const validCurrencies: string[] = Object.values(Currency);
      if (!validCurrencies.includes(currencyParam)) {
        throw new BadRequestException(
          `El parámetro "currency" debe ser uno de: ${validCurrencies.join(', ')}`,
        );
      }
      currencyOverride = currencyParam as Currency;
    }

    // Parseo de categorías con semántica de 3 estados
    const categoryIds: string[] | null =
      categoriesParam === undefined
        ? null
        : categoriesParam.trim().length === 0
          ? []
          : categoriesParam
              .split(',')
              .map((id) => id.trim())
              .filter((id) => id.length > 0);

    return this.movementsService.getAnnualCuotasReport(
      req.user.userId,
      year,
      categoryIds,
      currencyOverride,
    );
  }

  /**
   * GET /movements/reports/annual-unicos?year=YYYY[&categories=<id1,id2,...>][&currency=<ARS|USD|EUR|BRL>][&today=YYYY-MM-DD][&anchorAmountCents=<int>&anchorCurrency=<ARS|USD|EUR|BRL>]
   *
   * Devuelve la grilla día×mes de gastos únicos EXPENSE del año y el footer por mes.
   * Solo movimientos Únicos de tipo EXPENSE. Fijos y cuotas NO entran.
   *
   * Parámetros:
   * - year (obligatorio): año en formato YYYY.
   * - categories (opcional): lista de categoryIds separados por comas.
   *   Misma semántica de 3 estados que /movements/reports.
   * - currency (opcional): override de moneda de display (ARS|USD|EUR|BRL).
   *   Ausente → usa la default del usuario.
   * - today (opcional): fecha actual en formato YYYY-MM-DD, para determinar
   *   el divisor del promedio del mes en curso. Ausente → se usa la fecha UTC
   *   del sistema (new Date()).
   * - anchorAmountCents / anchorCurrency (opcionales, van SIEMPRE juntos): ancla
   *   editable de la escala de color de las celdas, como par (monto en centavos,
   *   moneda). anchorCurrency es un parámetro INDEPENDIENTE de `currency` (la
   *   moneda de display). Ausentes → default actual (15 USD = 1500 centavos).
   *   Si viene uno sin el otro → 400.
   *
   * Respuesta: AnnualUnicosResponse dentro del sobre { success, statusCode, data }.
   * 200 con la grilla y el footer.
   * 400 si year falta, formato inválido, fuera de rango, currency inválido,
   * anchorAmountCents no es un entero positivo, anchorCurrency inválido, o si
   * solo uno de los dos parámetros del ancla está presente.
   */
  @Get('reports/annual-unicos')
  getAnnualUnicosReport(
    @Request() req: AuthRequest,
    @Query('year') yearParam: string | undefined,
    @Query('categories') categoriesParam: string | undefined,
    @Query('currency') currencyParam: string | undefined,
    @Query('today') todayParam: string | undefined,
    @Query('anchorAmountCents') anchorAmountCentsParam: string | undefined,
    @Query('anchorCurrency') anchorCurrencyParam: string | undefined,
  ) {
    // Validar presencia y formato exacto YYYY
    if (!yearParam || !/^\d{4}$/.test(yearParam)) {
      throw new BadRequestException(
        'El parámetro "year" es obligatorio y debe tener exactamente 4 dígitos (ej: 2026)',
      );
    }

    const year = parseInt(yearParam, 10);

    if (year < YEAR_MIN || year > YEAR_MAX) {
      throw new BadRequestException(
        `El año debe estar entre ${YEAR_MIN} y ${YEAR_MAX}`,
      );
    }

    // Validar currency (solo si está presente)
    let currencyOverride: Currency | undefined;
    if (currencyParam !== undefined) {
      const validCurrencies: string[] = Object.values(Currency);
      if (!validCurrencies.includes(currencyParam)) {
        throw new BadRequestException(
          `El parámetro "currency" debe ser uno de: ${validCurrencies.join(', ')}`,
        );
      }
      currencyOverride = currencyParam as Currency;
    }

    // Validar today (solo si está presente)
    let todayStr: string | undefined;
    if (todayParam !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(todayParam)) {
        throw new BadRequestException(
          'El parámetro "today" debe tener formato YYYY-MM-DD (ej: 2026-06-24)',
        );
      }
      todayStr = todayParam;
    }

    // Parseo de categorías con semántica de 3 estados
    const categoryIds: string[] | null =
      categoriesParam === undefined
        ? null
        : categoriesParam.trim().length === 0
          ? []
          : categoriesParam
              .split(',')
              .map((id) => id.trim())
              .filter((id) => id.length > 0);

    // Validar ancla editable de la escala de color (anchorAmountCents + anchorCurrency).
    // Los dos parámetros van siempre juntos: uno sin el otro es 400.
    const anchorAmountPresent = anchorAmountCentsParam !== undefined;
    const anchorCurrencyPresent = anchorCurrencyParam !== undefined;
    if (anchorAmountPresent !== anchorCurrencyPresent) {
      throw new BadRequestException(
        'Los parámetros "anchorAmountCents" y "anchorCurrency" deben venir juntos',
      );
    }

    let anchorAmountCents: number | undefined;
    let anchorCurrency: Currency | undefined;
    if (anchorAmountPresent && anchorCurrencyPresent) {
      if (!/^\d+$/.test(anchorAmountCentsParam!) || parseInt(anchorAmountCentsParam!, 10) <= 0) {
        throw new BadRequestException(
          'El parámetro "anchorAmountCents" debe ser un entero positivo (centavos)',
        );
      }
      anchorAmountCents = parseInt(anchorAmountCentsParam!, 10);

      const validCurrencies: string[] = Object.values(Currency);
      if (!validCurrencies.includes(anchorCurrencyParam!)) {
        throw new BadRequestException(
          `El parámetro "anchorCurrency" debe ser uno de: ${validCurrencies.join(', ')}`,
        );
      }
      anchorCurrency = anchorCurrencyParam as Currency;
    }

    return this.movementsService.getAnnualUnicosReport(
      req.user.userId,
      year,
      categoryIds,
      currencyOverride,
      todayStr,
      anchorAmountCents,
      anchorCurrency,
    );
  }

  /**
   * GET /movements?month=YYYY-MM[&categories=<id1,id2,...>]
   *
   * Devuelve los movimientos del mes agrupados por origen (unicos/fijos/cuotas)
   * más los totales del mes (RF-VM-001, RF-VM-002, RF-DASH-002).
   *
   * Parámetros:
   * - month (obligatorio): mes en formato YYYY-MM
   * - categories (opcional): filtro de categorías.
   *   - Ausente (undefined) → todas las categorías (sin filtro).
   *   - Presente y vacío ("categories=") → ninguna categoría → listas vacías y totales en cero.
   *   - "id1,id2,..." → solo esas categorías.
   *
   * El bucketeo se hace por la timezone PROPIA de cada registro (AT TIME ZONE t.timezone),
   * no por una timezone de query. Ver MovementsService / MovementsRepository.
   *
   * Orden de "unicos": occurredAt descendente (más reciente primero, RF-VM-001).
   * La categoría se incluye AUNQUE esté soft-deleted (RF-CAT-004 / RF-VM-002).
   *
   * 200 + sobre con MonthMovementsResponse.
   * 400 si "month" falta o tiene formato inválido.
   *
   * IMPORTANTE: este handler debe registrarse DESPUÉS de /reports para que NestJS
   * no intente matchear "reports" como valor del query param "month".
   * (No hay problema porque ambos usan query params distintos, no path params.)
   */
  @Get()
  getMonth(
    @Request() req: AuthRequest,
    @Query('month') month: string | undefined,
    @Query('categories') categoriesParam: string | undefined,
    @Query('today') todayParam: string | undefined,
  ) {
    if (!month) {
      throw new BadRequestException(
        'El parámetro "month" es obligatorio (formato YYYY-MM)',
      );
    }

    // Parseo de categorías con semántica de 3 estados:
    // - undefined (ausente) → null = todas las categorías
    // - "" (presente y vacío) → [] = ninguna categoría
    // - "id1,id2,..." → ["id1","id2"] = subconjunto
    const categoryIds: string[] | null =
      categoriesParam === undefined
        ? null
        : categoriesParam.trim().length === 0
          ? []
          : categoriesParam
              .split(',')
              .map((id) => id.trim())
              .filter((id) => id.length > 0);

    // RF-SIM-002 (contrato nuevo, opcional): fecha local del usuario YYYY-MM-DD,
    // para resolver "el mes en curso" del que dependen los movimientos simulados
    // de una simulación de categoría activa. Ausente → fecha UTC del sistema
    // (mismo criterio que el resto de los endpoints con este param).
    let todayStr: string | undefined;
    if (todayParam !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(todayParam)) {
        throw new BadRequestException(
          'El parámetro "today" debe tener formato YYYY-MM-DD (ej: 2026-06-25)',
        );
      }
      todayStr = todayParam;
    }

    return this.movementsService.getMonthMovements(
      req.user.userId,
      month,
      categoryIds,
      todayStr,
    );
  }

  /**
   * GET /movements/reports?year=YYYY[&categories=<id1,id2,...>][&currency=<ARS|USD|EUR|BRL>][&types=<fijo,cuota,unico>][&direction=<both|expense|income>][&projectFixed=true][&today=YYYY-MM-DD]
   *
   * Devuelve la serie anual de reportes de movimientos del usuario (RF-REP-001/002/005/015).
   * Responde con los 12 meses del año (siempre presentes, en cero si no hay datos),
   * el desglose de gastos por categoría y el año más antiguo con datos.
   *
   * Parámetros:
   * - year (obligatorio): año en formato YYYY (4 dígitos exactos)
   * - categories (opcional): lista de categoryIds separados por comas.
   *   Omitido o vacío = todas las categorías. El filtro afecta ambas formas
   *   (totales mensuales y desglose por categoría). earliestYear IGNORA el filtro.
   * - currency (opcional): override de moneda de display para la serie.
   *   Valores: ARS | USD | EUR | BRL.
   *   Ausente (omitido) → usa la moneda default vigente del usuario.
   *   Presente → usa esa moneda como displayCurrency para todas las conversiones del reporte.
   *   Inválido (valor fuera del enum) → 400.
   * - types (opcional): filtro de tipos. Semántica de 3 estados (RF-REP-014).
   * - direction (opcional): filtro de dirección: both | expense | income. Default: both.
   * - projectFixed (opcional, RF-REP-015): "true" activa la proyección de fijos a futuro.
   *   Default: false. Con projectFixed=true los meses futuros proyectan solo fijos normales
   *   (con tasa de crecimiento compuesta); cuotas, únicos y calculados se excluyen.
   *   Cada mes incluye "projected: boolean" en la respuesta para distinguir el tramo proyectado.
   *   Back-compat dura: ausente o false → comportamiento idéntico al actual.
   * - today (opcional): fecha actual del usuario YYYY-MM-DD para determinar meses futuros.
   *   Ausente → fecha UTC del sistema. Solo relevante con projectFixed=true.
   *
   * Criterio de imputación por mes (RN-015):
   * - Únicos: mes local (AT TIME ZONE propia del registro)
   * - Fijos y cuotas: por startMonth (comparación léxica YYYY-MM)
   *
   * 200 + sobre con ReportsMovementsResponse.
   * 400 si "year" falta, no es exactamente 4 dígitos, o no es un año razonable.
   * 400 si "currency" está presente pero no es un valor válido del enum.
   * 400 si "today" está presente pero no tiene formato YYYY-MM-DD.
   */
  @Get('reports')
  getReports(
    @Request() req: AuthRequest,
    @Query('year') yearParam: string | undefined,
    @Query('categories') categoriesParam: string | undefined,
    @Query('currency') currencyParam: string | undefined,
    @Query('types') typesParam: string | undefined,
    @Query('direction') directionParam: string | undefined,
    @Query('projectFixed') projectFixedParam: string | undefined,
    @Query('today') todayParam: string | undefined,
  ) {
    // Validar presencia y formato exacto YYYY
    if (!yearParam || !/^\d{4}$/.test(yearParam)) {
      throw new BadRequestException(
        'El parámetro "year" es obligatorio y debe tener exactamente 4 dígitos (ej: 2026)',
      );
    }

    const year = parseInt(yearParam, 10);

    if (year < YEAR_MIN || year > YEAR_MAX) {
      throw new BadRequestException(
        `El año debe estar entre ${YEAR_MIN} y ${YEAR_MAX}`,
      );
    }

    // Validar currency (solo si está presente)
    let currencyOverride: Currency | undefined;
    if (currencyParam !== undefined) {
      const validCurrencies: string[] = Object.values(Currency);
      if (!validCurrencies.includes(currencyParam)) {
        throw new BadRequestException(
          `El parámetro "currency" debe ser uno de: ${validCurrencies.join(', ')}`,
        );
      }
      currencyOverride = currencyParam as Currency;
    }

    // Parseo de categorías con semántica de 3 estados:
    // - undefined (ausente) → null = todas las categorías
    // - "" (presente y vacío) → [] = ninguna categoría
    // - "id1,id2,..." → ["id1","id2"] = subconjunto
    // Ids vacíos intermedios (ej: ",,") se filtran — no son ids válidos.
    const categoryIds: string[] | null =
      categoriesParam === undefined
        ? null
        : categoriesParam.trim().length === 0
          ? []
          : categoriesParam
              .split(',')
              .map((id) => id.trim())
              .filter((id) => id.length > 0);

    // RF-REP-014 — Parseo de types con semántica de 3 estados (análoga a categories):
    // - undefined (ausente) → null = todos los tipos (fijo, cuota, unico)
    // - "" (presente y vacío) → [] = ningún tipo → resultado en cero
    // - "fijo,cuota" → ["fijo","cuota"] = subconjunto
    const VALID_MOVEMENT_TYPES = new Set(['fijo', 'cuota', 'unico']);

    let typesFilter: string[] | null;
    if (typesParam === undefined) {
      typesFilter = null;
    } else if (typesParam.trim().length === 0) {
      typesFilter = [];
    } else {
      typesFilter = typesParam
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      for (const t of typesFilter) {
        if (!VALID_MOVEMENT_TYPES.has(t)) {
          throw new BadRequestException(
            `El parámetro "types" acepta solo los valores: fijo, cuota, unico`,
          );
        }
      }
    }

    // RF-REP-014 — Parseo de direction:
    // - undefined / ausente → 'both' (default; comportamiento histórico sin cambio)
    // - 'expense' / 'income' / 'both' → válido
    // - cualquier otro valor → 400
    const VALID_DIRECTIONS = ['expense', 'income', 'both'];
    let direction: 'both' | 'expense' | 'income' = 'both';
    if (directionParam !== undefined) {
      if (!VALID_DIRECTIONS.includes(directionParam)) {
        throw new BadRequestException(
          `El parámetro "direction" debe ser uno de: expense, income, both`,
        );
      }
      direction = directionParam as 'both' | 'expense' | 'income';
    }

    // RF-REP-015 — Parseo de projectFixed:
    // - ausente o cualquier valor distinto de "true" → false (back-compat dura)
    // - "true" → true (activa la proyección de fijos a futuro)
    const projectFixed: boolean = projectFixedParam === 'true';

    // RF-REP-015 — Parseo de today (fecha local del usuario YYYY-MM-DD):
    // - ausente → undefined → el service usa la fecha UTC del sistema
    // - presente con formato inválido → 400
    let todayStr: string | undefined;
    if (todayParam !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(todayParam)) {
        throw new BadRequestException(
          'El parámetro "today" debe tener formato YYYY-MM-DD (ej: 2026-06-25)',
        );
      }
      todayStr = todayParam;
    }

    return this.movementsService.getReportsMovements(
      req.user.userId,
      year,
      categoryIds,
      currencyOverride,
      typesFilter,
      direction,
      projectFixed,
      todayStr,
    );
  }
}
