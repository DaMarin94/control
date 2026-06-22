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

    return this.movementsService.getMonthMovements(
      req.user.userId,
      month,
      categoryIds,
    );
  }

  /**
   * GET /movements/reports?year=YYYY[&categories=<id1,id2,...>][&currency=<ARS|USD|EUR|BRL>]
   *
   * Devuelve la serie anual de reportes de movimientos del usuario (RF-REP-001/002/005).
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
   *
   * Criterio de imputación por mes (RN-015):
   * - Únicos: mes local (AT TIME ZONE propia del registro)
   * - Fijos y cuotas: por startMonth (comparación léxica YYYY-MM)
   *
   * 200 + sobre con ReportsMovementsResponse.
   * 400 si "year" falta, no es exactamente 4 dígitos, o no es un año razonable.
   * 400 si "currency" está presente pero no es un valor válido del enum.
   */
  @Get('reports')
  getReports(
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

    return this.movementsService.getReportsMovements(
      req.user.userId,
      year,
      categoryIds,
      currencyOverride,
    );
  }
}
