import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionsRepository } from './transactions.repository';
import { CategoriesModule } from '../categories/categories.module';

/**
 * TransactionsModule — CRUD de movimientos únicos (RF-MU-001 a RF-MU-003).
 *
 * PrismaService ya está disponible globalmente (PrismaModule global).
 * Logger (nestjs-pino) también está disponible globalmente via LoggerModule.
 *
 * Importa CategoriesModule para acceder a CategoryValidatorService (D3 — Fase 7):
 * la validación de categoría está consolidada en un servicio compartido.
 */
@Module({
  imports: [CategoriesModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionsRepository],
  exports: [TransactionsService],
})
export class TransactionsModule {}
