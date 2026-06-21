import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { ReferenceRatesService } from './reference-rates.service';

/**
 * Módulo de settings del usuario.
 *
 * Expone:
 *   GET  /settings              — lee defaultCurrency + lastExchangeRate.
 *   PATCH /settings             — actualiza defaultCurrency y/o lastExchangeRate.
 *   GET  /settings/reference-rate — pre-fill de cotización desde tabla de referencia (Fase 1.2.4).
 *
 * PrismaModule es global → PrismaService disponible sin importarlo.
 */
@Module({
  controllers: [SettingsController],
  providers: [SettingsService, ReferenceRatesService],
  exports: [SettingsService, ReferenceRatesService],
})
export class SettingsModule {}
