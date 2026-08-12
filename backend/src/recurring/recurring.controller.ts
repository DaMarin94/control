import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { RecurringService } from './recurring.service';
import { CreateRecurringDto } from './dto/create-recurring.dto';
import { UpdateRecurringDto } from './dto/update-recurring.dto';
import { ToggleSkipRecurringDto } from './dto/toggle-skip-recurring.dto';
import { CreateCalculatedRecurringDto } from './dto/create-calculated-recurring.dto';
import { UpdateCalculatedRecurringDto } from './dto/update-calculated-recurring.dto';

interface AuthRequest extends Request {
  user: { userId: string };
}

/**
 * RecurringController — CRUD de movimientos fijos.
 *
 * Todas las rutas están protegidas por JwtAuthGuard (global).
 * El userId se extrae SIEMPRE de request.user.userId (nunca del body/query).
 * Filtrado por userId en todo momento (RN-003).
 *
 * No existe GET /recurring/:id — el front prefilea desde el ítem del mes.
 */
@Controller('recurring')
export class RecurringController {
  constructor(private readonly recurringService: RecurringService) {}

  /**
   * POST /recurring
   * Crea un movimiento fijo (RF-MF-001).
   * 201 + sobre con Recurring (incluye categoría embebida).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: AuthRequest, @Body() dto: CreateRecurringDto) {
    return this.recurringService.create(req.user.userId, dto);
  }

  /**
   * POST /recurring/:id/calculated
   * Crea un movimiento calculado derivado del fijo con id = :id (RF-MCALC-001).
   *
   * El fijo con :id es el "origen". El calculado es un fijo nuevo cuyo monto
   * se deriva on-the-fly en GET /movements via la fórmula (operador + operando + signo).
   *
   * 201 + sobre con Recurring del calculado (incluye sourceChainId, formulaOperator,
   *   formulaOperand, formulaSign y categoría embebida).
   * 400 si el origen es a su vez un calculado (sin encadenamiento).
   * 400 si operando=0 para DIV o PCT.
   * 400 si la categoría es inválida (inexistente/ajena/eliminada/scope incompatible).
   * 404 si el fijo de origen no existe o no es del usuario.
   *
   * Nota: no existe un tab "calculado" en el formulario de carga; este endpoint
   * es el único punto de creación (RF-MCALC-001).
   */
  @Post(':id/calculated')
  @HttpCode(HttpStatus.CREATED)
  createCalculated(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateCalculatedRecurringDto,
  ) {
    return this.recurringService.createCalculated(req.user.userId, id, dto);
  }

  /**
   * PATCH /recurring/:id
   * Edita un fijo NORMAL con lógica de split (RF-MF-003, D1).
   * Solo aplica a fijos normales (sourceChainId = null).
   * Para editar un calculado usar PATCH /recurring/:id/calculated.
   *
   * Body incluye currentMonth (REQUERIDO) + campos opcionales amountCents/categoryId/description.
   * 200 + sobre con Recurring (fila resultante — R2 en split, R actualizado in-place).
   * 400 si el fijo es un calculado (usar el endpoint específico).
   * 404 si no existe o no es del usuario.
   */
  @Patch(':id')
  update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringDto,
  ) {
    return this.recurringService.update(req.user.userId, id, dto);
  }

  /**
   * PATCH /recurring/:id/calculated
   * Edita un movimiento calculado (RF-MCALC-006).
   *
   * Campos editables: type, categoryId, description, formulaOperator, formulaOperand, formulaSign.
   * El vínculo al origen (sourceChainId) NO es editable.
   *
   * Sigue la misma mecánica de split que PATCH /recurring/:id (preserva el pasado).
   * currentMonth es REQUERIDO.
   *
   * 200 + sobre con Recurring del calculado resultante.
   * 400 si el fijo no es un calculado.
   * 400 si operando=0 para DIV/PCT.
   * 404 si no existe o no es del usuario.
   */
  @Patch(':id/calculated')
  updateCalculated(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCalculatedRecurringDto,
  ) {
    return this.recurringService.updateCalculated(req.user.userId, id, dto);
  }

  /**
   * POST /recurring/:id/skip
   * Anula / des-anula apariciones de un fijo (RF-MF-005). Dos alcances
   * mutuamente excluyentes, según qué campos trae el body:
   *
   * - Puntual: { month: "YYYY-MM" } → TOGGLE (comportamiento sin cambios,
   *   P1 — Fase 1.1.1). Respuesta: { skipped: boolean, month: string }.
   * - Rango: { from: "YYYY-MM", to: "YYYY-MM", action: "skip" | "unskip" } →
   *   operación EXPLÍCITA (no toggle, el sentido lo declara el cliente),
   *   idempotente en los dos sentidos, sobre el **fijo lógico completo**
   *   (la cadena — RF-MF-007), no sobre la fila `:id`. Respuesta:
   *   { action, from, to, affectedCount } — affectedCount es la cantidad
   *   de apariciones REALES del fijo (según su frecuencia) dentro del rango,
   *   para que el modal informe esa cuenta.
   *
   * 400 si el body no trae ninguno de los dos shapes completos, si mezcla
   * campos de los dos, o si el rango viola sus límites (piso = arranque del
   * fijo lógico, techo = último mes de aparición cuando tiene fin de
   * vigencia, largo máximo 24 meses, from > to).
   * 404 si el fijo no existe o no pertenece al usuario.
   */
  @Post(':id/skip')
  toggleSkip(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: ToggleSkipRecurringDto,
  ) {
    const hasMonth = dto.month !== undefined;
    const hasRangeField =
      dto.from !== undefined || dto.to !== undefined || dto.action !== undefined;

    if (hasMonth && hasRangeField) {
      throw new BadRequestException(
        'El body debe incluir "month" (alcance puntual) o "from" + "to" + "action" (alcance de rango), no ambos',
      );
    }

    if (hasMonth) {
      return this.recurringService.toggleSkip(req.user.userId, id, dto.month!);
    }

    if (dto.from !== undefined && dto.to !== undefined && dto.action !== undefined) {
      return this.recurringService.applySkipRange(req.user.userId, id, {
        from: dto.from,
        to: dto.to,
        action: dto.action,
      });
    }

    throw new BadRequestException(
      'El body debe incluir "month" (alcance puntual) o "from" + "to" + "action" (alcance de rango)',
    );
  }

  /**
   * DELETE /recurring/:id
   * Elimina un fijo (RF-MF-004) o un calculado (RF-MCALC-006).
   *
   * Query params:
   * - currentMonth (YYYY-MM, requerido): el mes actual desde el front (D2)
   * - fromCurrentMonth (boolean, requerido): si true, elimina desde currentMonth inclusive;
   *   si false (default UI), elimina desde el mes siguiente.
   *
   * Lógica:
   * - boundary = fromCurrentMonth ? currentMonth : nextMonth(currentMonth)
   * - Si boundary <= R.startMonth → borrado lógico (RF-HIST-006): marca deletedAt,
   *   reversible desde /historial (RF-HIST-003) hasta que la entrada se purgue.
   * - Si no → set R.deletedFrom = boundary
   *
   * Si es un fijo de ORIGEN (no calculado), la eliminación se propaga (RF-MCALC-005)
   * a todos los calculados de su cadena con el mismo boundary.
   *
   * 200 + sobre con { historyEntryId } (id de la entrada de historial creada,
   * para que el frontend pueda ofrecer "Deshacer" pegándole a POST /history/:id/undo).
   * 404 si no existe o no es del usuario.
   */
  @Delete(':id')
  remove(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Query('currentMonth') currentMonth: string | undefined,
    @Query('fromCurrentMonth') fromCurrentMonth: string | undefined,
  ) {
    if (!currentMonth) {
      throw new BadRequestException(
        'El query param "currentMonth" es obligatorio (formato YYYY-MM)',
      );
    }

    if (fromCurrentMonth === undefined) {
      throw new BadRequestException(
        'El query param "fromCurrentMonth" es obligatorio (true o false)',
      );
    }

    // Parsear fromCurrentMonth como boolean
    const fromCurrentMonthBool = fromCurrentMonth === 'true';

    return this.recurringService.remove(
      req.user.userId,
      id,
      currentMonth,
      fromCurrentMonthBool,
    );
  }
}
