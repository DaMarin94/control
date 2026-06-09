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
  constructor(private readonly installmentsService: InstallmentsService) {}

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
   * Hard delete permanente del grupo completo (RF-MC-002).
   * Elimina todas las instancias (pasadas y futuras).
   * 204 No Content. 404 si no existe o no es del usuario.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.installmentsService.remove(req.user.userId, id);
  }
}
