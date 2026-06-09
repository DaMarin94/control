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
   * PATCH /recurring/:id
   * Edita un fijo con lógica de split (RF-MF-003, D1).
   * Body incluye currentMonth (REQUERIDO) + campos opcionales amountCents/categoryId/description.
   * 200 + sobre con Recurring (fila resultante — R2 en split, R actualizado in-place).
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
   * DELETE /recurring/:id
   * Elimina un fijo (RF-MF-004).
   *
   * Query params:
   * - currentMonth (YYYY-MM, requerido): el mes actual desde el front (D2)
   * - fromCurrentMonth (boolean, requerido): si true, elimina desde currentMonth inclusive;
   *   si false (default UI), elimina desde el mes siguiente.
   *
   * Lógica:
   * - boundary = fromCurrentMonth ? currentMonth : nextMonth(currentMonth)
   * - Si boundary <= R.startMonth → hard delete
   * - Si no → set R.deletedFrom = boundary
   *
   * 204 No Content. 404 si no existe o no es del usuario.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
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
