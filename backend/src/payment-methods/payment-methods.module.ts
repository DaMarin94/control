import { Module } from '@nestjs/common';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentMethodsRepository } from './payment-methods.repository';
import { PaymentMethodValidatorService } from './payment-method-validator.service';

/**
 * PaymentMethodsModule — CRUD de métodos de pago por usuario (P4).
 * Espejo de CategoriesModule.
 *
 * PrismaService ya está disponible globalmente (PrismaModule global).
 * Logger (nestjs-pino) también está disponible globalmente vía LoggerModule.
 *
 * Exporta PaymentMethodValidatorService para que los módulos de movimientos
 * (transactions, recurring, installments) puedan validar el paymentMethodId
 * opcional sin duplicar la lógica.
 */
@Module({
  controllers: [PaymentMethodsController],
  providers: [
    PaymentMethodsService,
    PaymentMethodsRepository,
    PaymentMethodValidatorService,
  ],
  exports: [PaymentMethodsService, PaymentMethodValidatorService],
})
export class PaymentMethodsModule {}
