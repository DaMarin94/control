import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import { HistoryService } from './history.service';

interface AuthenticatedRequest {
  user: { userId: string };
}

/**
 * HistoryController — Módulo 3.14 (Historial de cambios).
 *
 * GET  /history            — RF-HIST-002: lista de entradas del usuario.
 * POST /history/:id/undo   — RF-HIST-003/004: deshace una entrada (y sus
 *                             posteriores del mismo movimiento, si las hay).
 *
 * Protegido por el JwtAuthGuard global (sin @Public()); scopeado por
 * request.user.userId — nunca por un id que llegue en el body/query (RN-003).
 */
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.historyService.findAllForUser(req.user.userId);
  }

  @Post(':id/undo')
  async undo(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.historyService.undo(req.user.userId, id);
    return { undone: true };
  }
}
