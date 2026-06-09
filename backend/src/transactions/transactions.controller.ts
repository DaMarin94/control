import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

interface AuthRequest extends Request {
  user: { userId: string };
}

/**
 * TransactionsController — CRUD de movimientos únicos.
 *
 * Todas las rutas están protegidas por JwtAuthGuard (global).
 * El userId se extrae SIEMPRE de request.user.userId (nunca del body/query).
 * Filtrado por userId en todo momento (RN-003).
 */
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * POST /transactions
   * Crea un movimiento único (RF-MU-001).
   * 201 + sobre con Transaction (incluye categoría embebida).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: AuthRequest, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(req.user.userId, dto);
  }

  /**
   * GET /transactions?month=YYYY-MM&timezone=IANA
   * Lista los movimientos del mes del usuario (RF-VM-001 base).
   *
   * Parámetros:
   * - month (obligatorio): mes en formato YYYY-MM
   * - timezone (obligatorio): zona horaria IANA para calcular el rango UTC del mes
   *
   * Orden: occurredAt descendente (más reciente primero).
   * 200 + sobre con Transaction[].
   */
  @Get()
  findByMonth(
    @Request() req: AuthRequest,
    @Query('month') month: string | undefined,
    @Query('timezone') timezone: string | undefined,
  ) {
    if (!month) {
      throw new BadRequestException(
        'El parámetro "month" es obligatorio (formato YYYY-MM)',
      );
    }
    if (!timezone) {
      throw new BadRequestException(
        'El parámetro "timezone" es obligatorio (ej: "America/Argentina/Buenos_Aires")',
      );
    }
    return this.transactionsService.findByMonth(req.user.userId, month, timezone);
  }

  /**
   * GET /transactions/:id
   * Devuelve una transacción propia para prefill de edición.
   * 200 + sobre con Transaction. 404 si no existe o es de otro usuario.
   */
  @Get(':id')
  findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.transactionsService.findOne(req.user.userId, id);
  }

  /**
   * PATCH /transactions/:id
   * Edita una transacción propia (RF-MU-002).
   * Body parcial: cualquier campo de POST.
   * Reaplica RN-010 si cambia type o categoryId.
   * 200 + sobre con Transaction. 404 si no existe o es de otro usuario.
   */
  @Patch(':id')
  update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(req.user.userId, id, dto);
  }

  /**
   * DELETE /transactions/:id
   * Hard delete permanente (RF-MU-003).
   * 204 No Content. 404 si no existe o es de otro usuario.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.transactionsService.remove(req.user.userId, id);
  }
}
