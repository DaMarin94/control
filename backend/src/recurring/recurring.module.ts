import { Module } from '@nestjs/common';
import { RecurringController } from './recurring.controller';
import { RecurringService } from './recurring.service';
import { RecurringRepository } from './recurring.repository';

/**
 * RecurringModule — CRUD de movimientos fijos (RF-MF-001 a RF-MF-004).
 *
 * PrismaService ya está disponible globalmente (PrismaModule global).
 * Logger (nestjs-pino) también está disponible globalmente via LoggerModule.
 *
 * El service inyecta tanto el Repository (para queries de Recurring)
 * como PrismaService directamente (para validar categorías en RN-010).
 *
 * No existe GET /recurring/:id — el front prefilea desde el ítem del mes
 * (el listado unificado GET /movements ya provee el prefill necesario).
 */
@Module({
  controllers: [RecurringController],
  providers: [RecurringService, RecurringRepository],
  exports: [RecurringService],
})
export class RecurringModule {}
