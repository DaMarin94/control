import { Module } from '@nestjs/common';
import { HistoryController } from './history.controller';
import { HistoryService } from './history.service';
import { HistoryRepository } from './history.repository';

/**
 * HistoryModule — Módulo 3.14 (Historial de cambios), RF-HIST-001..006.
 *
 * Sin dependencia de TransactionsModule/RecurringModule/InstallmentsModule:
 * la captura (record) es llamada POR esos módulos (que importan HistoryModule,
 * dependencia unidireccional); el undo/reaper de HistoryService accede a
 * Transaction/Recurring/InstallmentGroup directo por Prisma (ver el comment
 * de arquitectura en history.service.ts). Esto evita una dependencia circular
 * de módulos.
 *
 * PrismaService está disponible globalmente (PrismaModule global).
 */
@Module({
  controllers: [HistoryController],
  providers: [HistoryService, HistoryRepository],
  exports: [HistoryService],
})
export class HistoryModule {}
