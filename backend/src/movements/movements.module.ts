import { Module } from '@nestjs/common';
import { MovementsController } from './movements.controller';
import { MovementsService } from './movements.service';
import { MovementsRepository } from './movements.repository';
import { SettingsModule } from '../settings/settings.module';

/**
 * MovementsModule — endpoint unificado GET /movements?month=YYYY-MM.
 *
 * Importa SettingsModule para leer el defaultCurrency del usuario y aplicar
 * la conversión de moneda en MovementsService (Fase 1.2.3).
 *
 * PrismaService está disponible globalmente (PrismaModule global).
 * Logger (nestjs-pino) también está disponible globalmente.
 */
@Module({
  imports: [SettingsModule],
  controllers: [MovementsController],
  providers: [MovementsService, MovementsRepository],
})
export class MovementsModule {}
