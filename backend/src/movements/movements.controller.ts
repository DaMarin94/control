import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Request,
} from '@nestjs/common';
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
   * GET /movements?month=YYYY-MM
   *
   * Devuelve los movimientos del mes agrupados por origen (unicos/fijos/cuotas)
   * más los totales del mes (RF-VM-001, RF-VM-002, RF-DASH-002).
   *
   * Parámetros:
   * - month (obligatorio): mes en formato YYYY-MM
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
   * IMPORTANTE: este handler debe registrarse DESPUÉS de /annual para que NestJS
   * no intente matchear "annual" como valor del query param "month".
   * (No hay problema porque ambos usan query params distintos, no path params.)
   */
  @Get()
  getMonth(
    @Request() req: AuthRequest,
    @Query('month') month: string | undefined,
  ) {
    if (!month) {
      throw new BadRequestException(
        'El parámetro "month" es obligatorio (formato YYYY-MM)',
      );
    }
    return this.movementsService.getMonthMovements(req.user.userId, month);
  }

  /**
   * GET /movements/annual?year=YYYY
   *
   * Devuelve la agregación anual de movimientos del usuario (RF-GRA-001/002/003).
   * Responde con los 12 meses del año (siempre presentes, en cero si no hay datos),
   * el desglose de gastos por categoría y el año más antiguo con datos.
   *
   * Parámetros:
   * - year (obligatorio): año en formato YYYY (4 dígitos exactos)
   *
   * Criterio de imputación por mes (RN-015):
   * - Únicos: mes local (AT TIME ZONE propia del registro)
   * - Fijos y cuotas: por startMonth (comparación léxica YYYY-MM)
   *
   * 200 + sobre con AnnualMovementsResponse.
   * 400 si "year" falta, no es exactamente 4 dígitos, o no es un año razonable.
   */
  @Get('annual')
  getAnnual(
    @Request() req: AuthRequest,
    @Query('year') yearParam: string | undefined,
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

    return this.movementsService.getAnnualMovements(req.user.userId, year);
  }
}
