import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
} from '@nestjs/common';
import { InstallmentsService } from './installments.service';
import { CreateInstallmentDto } from './dto/create-installment.dto';
import { UpdateInstallmentDto } from './dto/update-installment.dto';
import { ToggleSkipInstallmentDto } from './dto/toggle-skip-installment.dto';
import { RecurringService } from '../recurring/recurring.service';
import { CreateCalculatedFromInstallmentDto } from '../recurring/dto/create-calculated-from-installment.dto';
import { UpdateCalculatedFromInstallmentDto } from '../recurring/dto/update-calculated-from-installment.dto';

interface AuthRequest extends Request {
  user: { userId: string };
}

/**
 * InstallmentsController — CRUD de grupos de cuotas.
 *
 * Todas las rutas están protegidas por JwtAuthGuard (global).
 * El userId se extrae SIEMPRE de request.user.userId (nunca del body/query).
 * Filtrado por userId en todo momento (RN-003).
 *
 * No existe GET /installments/:id — el front prefilea desde el MovementItem
 * de /movements, que ya trae todos los datos necesarios para edición.
 */
@Controller('installments')
export class InstallmentsController {
  constructor(
    private readonly installmentsService: InstallmentsService,
    private readonly recurringService: RecurringService,
  ) {}

  /**
   * POST /installments
   * Crea un grupo de cuotas (RF-MC-001).
   * Solo acepta type EXPENSE en v1 (cuotas de ingreso fuera de scope).
   * 201 + sobre con InstallmentGroup (incluye categoría embebida).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: AuthRequest, @Body() dto: CreateInstallmentDto) {
    return this.installmentsService.create(req.user.userId, dto);
  }

  /**
   * PATCH /installments/:id
   * Edita el grupo de cuotas completo (RF-MC-003).
   * La edición aplica al grupo entero sin split (D2 — cuotas no tienen inmutabilidad del pasado).
   * Body: amountCents?, totalInstallments?, startMonth?, categoryId?, description?.
   * 200 + sobre con InstallmentGroup actualizado.
   * 404 si no existe o no es del usuario.
   */
  @Patch(':id')
  update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateInstallmentDto,
  ) {
    return this.installmentsService.update(req.user.userId, id, dto);
  }

  /**
   * DELETE /installments/:id
   * Borrado lógico del grupo completo (RF-MC-002, RF-HIST-006): marca deletedAt,
   * reversible desde /historial (RF-HIST-003) hasta que la entrada se purgue
   * (RF-HIST-005). Deja de aparecer todas las instancias (pasadas y futuras).
   * 204 No Content. 404 si no existe o no es del usuario.
   * Nota: el calculado vinculado (si existe) también se marca como eliminado
   * en cascada (RN-024/026), vía RecurringService.cascadeSoftDeleteBySourceInstallmentGroup.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.installmentsService.remove(req.user.userId, id);
  }

  /**
   * POST /installments/:id/calculated
   * Crea un movimiento calculado derivado del InstallmentGroup con id = :id (Fase 1.1.7.ext).
   *
   * El calculado aparece en cada mes del grupo (rango = rango del grupo).
   * Deriva del monto por cuota (amountCents del InstallmentGroup).
   *
   * 201 + sobre con Recurring del calculado.
   * 400 si operando=0 para DIV o PCT.
   * 400 si la categoría es inválida.
   * 404 si el InstallmentGroup no existe o no es del usuario.
   */
  @Post(':id/calculated')
  @HttpCode(HttpStatus.CREATED)
  createCalculated(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateCalculatedFromInstallmentDto,
  ) {
    return this.recurringService.createCalculatedFromInstallment(req.user.userId, id, dto);
  }

  /**
   * PATCH /installments/:id/calculated
   * Edita el movimiento calculado derivado del InstallmentGroup con id = :id (Fase 1.1.7.ext).
   *
   * Edición in-place siempre (sin split).
   *
   * 200 + sobre con Recurring actualizado.
   * 400 si operando=0 para DIV o PCT.
   * 400 si la categoría es inválida.
   * 404 si el InstallmentGroup no existe o no es del usuario.
   * 404 si no existe calculado vinculado a ese InstallmentGroup.
   */
  @Patch(':id/calculated')
  updateCalculated(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCalculatedFromInstallmentDto,
  ) {
    return this.recurringService.updateCalculatedFromInstallment(req.user.userId, id, dto);
  }

  /**
   * POST /installments/:id/skip
   * Toglea el skip de una cuota puntual del grupo con id = :id, para un mes puntual
   * (P3 — Fase 1.1.1.ext). Espejo exacto de POST /recurring/:id/skip.
   *
   * Body: { month: "YYYY-MM" }
   *
   * Respuesta + sobre:
   * { skipped: boolean, month: string }
   * - skipped=true: la cuota de ese mes quedó anulada (no suma a totales, aparece
   *   con skipped=true en /movements)
   * - skipped=false: la cuota de ese mes fue des-anulada (vuelve a contar)
   *
   * Anula SOLO la instancia de ese mes, no el grupo entero.
   *
   * 404 si el grupo no existe o no pertenece al usuario.
   * 400 si month tiene formato inválido.
   */
  @Post(':id/skip')
  toggleSkip(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: ToggleSkipInstallmentDto,
  ) {
    return this.installmentsService.toggleSkip(req.user.userId, id, dto.month);
  }
}
