import { Module } from '@nestjs/common';
import { MovementsController } from './movements.controller';
import { MovementsService } from './movements.service';
import { MovementsRepository } from './movements.repository';
import { SettingsModule } from '../settings/settings.module';
import { SimulationsModule } from '../simulations/simulations.module';

/**
 * MovementsModule — endpoint unificado GET /movements?month=YYYY-MM.
 *
 * Importa SettingsModule para leer el defaultCurrency del usuario y aplicar
 * la conversión de moneda en MovementsService (Fase 1.2.3).
 *
 * Importa SimulationsModule para embeber los movimientos simulados (RF-SIM-003)
 * en la sección Únicos de GET /movements — dependencia UNIDIRECCIONAL
 * (Movements → Simulations; nunca al revés, ver SimulationsService) para
 * evitar un ciclo de módulos.
 *
 * PrismaService está disponible globalmente (PrismaModule global).
 * Logger (nestjs-pino) también está disponible globalmente.
 */
@Module({
  imports: [SettingsModule, SimulationsModule],
  controllers: [MovementsController],
  providers: [MovementsService, MovementsRepository],
})
export class MovementsModule {}
