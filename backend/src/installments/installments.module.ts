import { Module } from '@nestjs/common';
import { InstallmentsController } from './installments.controller';
import { InstallmentsService } from './installments.service';
import { InstallmentsRepository } from './installments.repository';
import { CategoriesModule } from '../categories/categories.module';
import { RecurringModule } from '../recurring/recurring.module';

/**
 * InstallmentsModule — CRUD de grupos de cuotas (RF-MC-001 a RF-MC-003).
 *
 * PrismaService ya está disponible globalmente (PrismaModule global).
 * Logger (nestjs-pino) también está disponible globalmente via LoggerModule.
 *
 * Importa CategoriesModule para acceder a CategoryValidatorService (D3 — Fase 7):
 * la validación de categoría está consolidada en un servicio compartido.
 *
 * Importa RecurringModule para acceder a RecurringService (endpoints de calculados
 * derivados de cuotas: POST/PATCH /installments/:id/calculated — Fase 1.1.7.ext).
 *
 * No existe GET /installments/:id — el front prefilea desde el MovementItem
 * de GET /movements, que ya trae installment.number, installment.total,
 * amountCents, categoryId, etc.
 *
 * El service se exporta para que MovementsModule pueda acceder a los grupos
 * de cuotas sin tocar la tabla directamente (regla de propiedad de dominio).
 */
@Module({
  imports: [CategoriesModule, RecurringModule],
  controllers: [InstallmentsController],
  providers: [InstallmentsService, InstallmentsRepository],
  exports: [InstallmentsService],
})
export class InstallmentsModule {}
