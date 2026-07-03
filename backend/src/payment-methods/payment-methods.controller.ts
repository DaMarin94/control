import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
} from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';

interface AuthRequest extends Request {
  user: { userId: string };
}

/**
 * PaymentMethodsController — endpoints CRUD + reactivate de métodos de pago (P4).
 * Espejo de CategoriesController.
 *
 * Todas las rutas están protegidas por JwtAuthGuard (global).
 * El userId se extrae SIEMPRE de request.user.userId (nunca del body/query).
 */
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  /**
   * GET /payment-methods
   * Lista los métodos de pago ACTIVOS del usuario con contador de movimientos (RF-PM-005).
   * Orden: nombre ascendente.
   */
  @Get()
  findAll(@Request() req: AuthRequest) {
    return this.paymentMethodsService.findAll(req.user.userId);
  }

  /**
   * POST /payment-methods
   * Crea un método de pago nuevo (flujo crear-o-reactivar, RF-PM-001).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: AuthRequest, @Body() dto: CreatePaymentMethodDto) {
    return this.paymentMethodsService.create(req.user.userId, dto);
  }

  /**
   * POST /payment-methods/:id/reactivate
   * Reactiva un método de pago ELIMINADO del usuario (RF-PM-001, A4).
   * No acepta body.
   */
  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivate(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.paymentMethodsService.reactivate(req.user.userId, id);
  }

  /**
   * PATCH /payment-methods/:id
   * Edita nombre, tipo, ícono y/o campos condicionales de un método activo (RF-PM-002).
   */
  @Patch(':id')
  update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    return this.paymentMethodsService.update(req.user.userId, id, dto);
  }

  /**
   * DELETE /payment-methods/:id
   * Soft delete (RF-PM-003). No idempotente: ya eliminado → 404.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.paymentMethodsService.remove(req.user.userId, id);
  }
}
