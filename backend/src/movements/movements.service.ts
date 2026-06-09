import { BadRequestException, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { MovementsRepository, MovementItem } from './movements.repository';

/**
 * Shape de los totales del mes.
 * Suma movimientos únicos + fijos activos + cuotas (cuotas: Fase 7).
 */
export interface MonthTotals {
  expenseCents: number;
  incomeCents: number;
  balanceCents: number;
}

/**
 * Shape completo de la respuesta de GET /movements.
 *
 * La estructura `movements` está diseñada para incorporar fijos y cuotas
 * en Fases 6 y 7 sin cambiar el shape del contrato con el frontend.
 *
 * - `unicos`: movimientos únicos del mes (poblado desde Fase 5)
 * - `fijos`: fijos activos en el mes (poblado desde Fase 6)
 * - `cuotas`: cuotas que caen en el mes (vacío en Fases 5-6; se puebla en Fase 7)
 */
export interface MonthMovementsResponse {
  month: string;
  totals: MonthTotals;
  movements: {
    unicos: MovementItem[];
    fijos: MovementItem[];
    cuotas: never[];
  };
}

@Injectable()
export class MovementsService {
  constructor(
    private readonly repo: MovementsRepository,
    private readonly logger: Logger,
  ) {}

  /**
   * Devuelve los movimientos del mes YYYY-MM para el usuario dado.
   *
   * Bucketeo de únicos: por la timezone propia de CADA registro (AT TIME ZONE t.timezone),
   * implementado en SQL raw en MovementsRepository.
   * Bucketeo de fijos: comparación léxica de strings YYYY-MM (no requiere timezone).
   *
   * Validación: month obligatorio y con formato YYYY-MM. Si falta o es inválido → 400.
   * Ya no requiere ni acepta timezone en el query param (el criterio la obtiene
   * de cada registro en la DB, o es irrelevante para fijos).
   *
   * Totales: suman movimientos únicos + fijos activos del mes (RF-VM-002, RF-DASH-002).
   *
   * @param userId  userId del JWT (RN-003: aislamiento por usuario)
   * @param month   Mes en formato YYYY-MM
   */
  async getMonthMovements(
    userId: string,
    month: string,
  ): Promise<MonthMovementsResponse> {
    // Validar formato y semántica del mes
    this.validateMonth(month);

    // Obtener movimientos únicos, fijos y totales en paralelo para eficiencia
    const [unicos, fijos, rawTotalsUnicos, rawTotalsFijos] = await Promise.all([
      this.repo.findUnicosByMonth(userId, month),
      this.repo.findFijosByMonth(userId, month),
      this.repo.getTotalsByMonth(userId, month),
      this.repo.getFijosTotalsByMonth(userId, month),
    ]);

    // Combinar totales de únicos + fijos
    const expenseCents =
      rawTotalsUnicos.expenseCents + rawTotalsFijos.expenseCents;
    const incomeCents =
      rawTotalsUnicos.incomeCents + rawTotalsFijos.incomeCents;

    const totals: MonthTotals = {
      expenseCents,
      incomeCents,
      balanceCents: incomeCents - expenseCents,
    };

    this.logger.debug(
      {
        userId,
        month,
        unicosCount: unicos.length,
        fijosCount: fijos.length,
        totals,
      },
      'Movimientos del mes listados',
    );

    return {
      month,
      totals,
      movements: {
        unicos,
        fijos,
        cuotas: [],
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  /**
   * Valida que el mes tenga formato YYYY-MM y un valor de mes entre 01 y 12.
   * @throws BadRequestException si el formato es inválido.
   */
  private validateMonth(month: string): void {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException(
        'El parámetro "month" es obligatorio y debe tener formato YYYY-MM (ej: 2026-06)',
      );
    }

    const monthNum = parseInt(month.split('-')[1], 10);
    if (monthNum < 1 || monthNum > 12) {
      throw new BadRequestException(
        'El mes debe estar entre 01 y 12',
      );
    }
  }
}
