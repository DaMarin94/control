import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionsRepository } from './transactions.repository';
import { CategoriesModule } from '../categories/categories.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';
import { RecurringModule } from '../recurring/recurring.module';
import { SettingsModule } from '../settings/settings.module';
import { HistoryModule } from '../history/history.module';

/**
 * TransactionsModule — CRUD de movimientos únicos (RF-MU-001 a RF-MU-003).
 *
 * PrismaService ya está disponible globalmente (PrismaModule global).
 * Logger (nestjs-pino) también está disponible globalmente via LoggerModule.
 *
 * Importa CategoriesModule para acceder a CategoryValidatorService (D3 — Fase 7):
 * la validación de categoría está consolidada en un servicio compartido.
 *
 * Importa RecurringModule para acceder a RecurringService (endpoints de calculados
 * derivados de únicos: POST/PATCH /transactions/:id/calculated — Fase 1.1.7.ext).
 *
 * Importa SettingsModule para actualizar lastExchangeRate al guardar movimientos
 * con cotización (Fase 1.2.3).
 */
@Module({
  imports: [CategoriesModule, PaymentMethodsModule, RecurringModule, SettingsModule, HistoryModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionsRepository],
  exports: [TransactionsService],
})
export class TransactionsModule {}
