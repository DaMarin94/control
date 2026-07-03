import { Module } from '@nestjs/common';
import { RecurringController } from './recurring.controller';
import { RecurringService } from './recurring.service';
import { RecurringRepository } from './recurring.repository';
import { CategoriesModule } from '../categories/categories.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';
import { SettingsModule } from '../settings/settings.module';

/**
 * RecurringModule — CRUD de movimientos fijos (RF-MF-001 a RF-MF-004).
 *
 * PrismaService ya está disponible globalmente (PrismaModule global).
 * Logger (nestjs-pino) también está disponible globalmente via LoggerModule.
 *
 * Importa CategoriesModule para acceder a CategoryValidatorService (D3 — Fase 7):
 * la validación de categoría está consolidada en un servicio compartido.
 *
 * Importa SettingsModule para actualizar lastExchangeRate al guardar fijos
 * con cotización (Fase 1.2.3).
 *
 * No existe GET /recurring/:id — el front prefilea desde el ítem del mes
 * (el listado unificado GET /movements ya provee el prefill necesario).
 */
@Module({
  imports: [CategoriesModule, PaymentMethodsModule, SettingsModule],
  controllers: [RecurringController],
  providers: [RecurringService, RecurringRepository],
  exports: [RecurringService],
})
export class RecurringModule {}
