import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { ReferenceRatesService } from './reference-rates.service';
import { RateSyncService } from './rate-sync.service';
import { CronSecretGuard } from './cron-secret.guard';
import { SyncRateLimitGuard } from './sync-rate-limit.guard';

/**
 * Módulo de settings del usuario.
 *
 * Expone:
 *   GET  /settings                         — lee defaultCurrency + lastExchangeRate.
 *   PATCH /settings                        — actualiza defaultCurrency y/o lastExchangeRate.
 *   GET  /settings/reference-rate          — pre-fill de cotización (Fase 1.2.4).
 *   POST /settings/reference-rates/sync    — ingesta FX + IPC desde fuentes externas (P7).
 *
 * PrismaModule es global → PrismaService disponible sin importarlo.
 */
@Module({
  controllers: [SettingsController],
  providers: [
    SettingsService,
    ReferenceRatesService,
    RateSyncService,
    CronSecretGuard,
    SyncRateLimitGuard,
  ],
  exports: [SettingsService, ReferenceRatesService],
})
export class SettingsModule {}
