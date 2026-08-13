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
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { RecurringService } from '../recurring/recurring.service';
import { CreateCalculatedFromTransactionDto } from '../recurring/dto/create-calculated-from-transaction.dto';
import { UpdateCalculatedFromTransactionDto } from '../recurring/dto/update-calculated-from-transaction.dto';

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
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly recurringService: RecurringService,
  ) {}

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
   * 200 + sobre con Transaction + historyEntryId (id de la entrada de historial
   * creada, para el "Deshacer" del toast). 404 si no existe o es de otro usuario.
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
   * Borrado lógico (RF-MU-003, RF-HIST-006): marca deletedAt, reversible desde
   * /historial (RF-HIST-003) hasta que la entrada se purgue (RF-HIST-005).
   * 200 + sobre con { historyEntryId } (id de la entrada de historial creada,
   * para que el frontend pueda ofrecer "Deshacer" pegándole a POST /history/:id/undo).
   * 404 si no existe o es de otro usuario.
   * Nota: el calculado vinculado (si existe) también se marca como eliminado
   * en cascada (RN-024/026), vía RecurringService.cascadeSoftDeleteBySourceMovement.
   */
  @Delete(':id')
  remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.transactionsService.remove(req.user.userId, id);
  }

  /**
   * POST /transactions/:id/calculated
   * Crea un movimiento calculado derivado del Transaction con id = :id (Fase 1.1.7.ext).
   *
   * El calculado aparece en el mismo mes que el único (1 mes, autolimitado).
   * Deriva del amountCents del Transaction.
   *
   * 201 + sobre con Recurring del calculado.
   * 400 si operando=0 para DIV o PCT.
   * 400 si la categoría es inválida.
   * 404 si el Transaction no existe o no es del usuario.
   */
  @Post(':id/calculated')
  @HttpCode(HttpStatus.CREATED)
  createCalculated(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateCalculatedFromTransactionDto,
  ) {
    return this.recurringService.createCalculatedFromTransaction(req.user.userId, id, dto);
  }

  /**
   * PATCH /transactions/:id/calculated
   * Edita el movimiento calculado derivado del Transaction con id = :id (Fase 1.1.7.ext).
   *
   * Edición in-place siempre (sin split).
   *
   * 200 + sobre con Recurring actualizado.
   * 400 si operando=0 para DIV o PCT.
   * 400 si la categoría es inválida.
   * 404 si el Transaction no existe o no es del usuario.
   * 404 si no existe calculado vinculado a ese Transaction.
   */
  @Patch(':id/calculated')
  updateCalculated(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCalculatedFromTransactionDto,
  ) {
    return this.recurringService.updateCalculatedFromTransaction(req.user.userId, id, dto);
  }

  /**
   * POST /transactions/:id/skip
   * Toglea la anulación de un movimiento único (P3 — Fase 1.1.1.ext).
   *
   * Sin body: el único es una sola fila, el skip es un flag booleano (sin noción de mes).
   *
   * Respuesta + sobre:
   * { skipped: boolean }
   * - skipped=true: el único quedó anulado (no suma a totales, aparece con skipped=true en /movements)
   * - skipped=false: el único fue des-anulado (vuelve a contar)
   *
   * 404 si la transacción no existe o no pertenece al usuario.
   */
  @Post(':id/skip')
  @HttpCode(HttpStatus.OK)
  toggleSkip(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.transactionsService.toggleSkip(req.user.userId, id);
  }
}
