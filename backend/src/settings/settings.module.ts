import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

/**
 * Módulo de settings del usuario.
 *
 * Expone GET /settings y PATCH /settings para leer y actualizar
 * la configuración de moneda (defaultCurrency + lastExchangeRate).
 *
 * PrismaModule es global → PrismaService disponible sin importarlo.
 */
@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
