import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionsRepository } from './transactions.repository';

/**
 * TransactionsModule — CRUD de movimientos únicos (RF-MU-001 a RF-MU-003).
 *
 * PrismaService ya está disponible globalmente (PrismaModule global).
 * Logger (nestjs-pino) también está disponible globalmente via LoggerModule.
 *
 * El service inyecta tanto el Repository (para queries de Transaction)
 * como PrismaService directamente (para validar categorías en RN-010,
 * manteniendo la regla de que la lógica de una entidad vive en su propio módulo).
 */
@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionsRepository],
  exports: [TransactionsService],
})
export class TransactionsModule {}
