import { IsIn, IsInt } from 'class-validator';

/**
 * Body de PATCH /simulations/:id/extend (RF-SIM). Corre `endMonth` hacia
 * adelante `months` meses; `startMonth` no se toca nunca (ver
 * `SimulationsService.extend`).
 *
 * `months` solo admite el set cerrado {1, 3, 6, 12} — cualquier otro valor
 * es 400 (mismo tono legible que el resto del módulo).
 */
export class ExtendSimulationDto {
  @IsInt()
  @IsIn([1, 3, 6, 12], { message: 'months debe ser 1, 3, 6 o 12' })
  months!: number;
}
