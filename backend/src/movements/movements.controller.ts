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

/**
 * MovementsController — endpoint unificado de movimientos del mes.
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
}
