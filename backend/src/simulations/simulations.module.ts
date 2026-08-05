import { Module } from '@nestjs/common';
import { SimulationsController } from './simulations.controller';
import { SimulationsService } from './simulations.service';
import { SimulationsRepository } from './simulations.repository';
import { CategoriesModule } from '../categories/categories.module';
import { SettingsModule } from '../settings/settings.module';

/**
 * SimulationsModule — Módulo 3.15 (Simulación de categoría), RF-SIM-001..004.
 *
 * Importa CategoriesModule (CategoryValidatorService para validar la categoría
 * al crear + CategoriesService.findAll para el universo de RF-SIM-001) y
 * SettingsModule (SettingsService para la moneda default + ReferenceRatesService
 * para las cotizaciones de referencia por mes de la ventana histórica).
 *
 * Sin dependencia de HistoryModule: esta especie no participa del historial de
 * cambios ni es deshacible (RF-SIM-004) — el DELETE borra físicamente.
 *
 * Sin dependencia de MovementsModule: es MovementsModule quien importa este
 * módulo (dependencia UNIDIRECCIONAL Movements → Simulations) para embeber los
 * movimientos simulados en GET /movements sin generar un ciclo — ver el
 * comentario de arquitectura en SimulationsService.
 *
 * PrismaService está disponible globalmente (PrismaModule global).
 */
@Module({
  imports: [CategoriesModule, SettingsModule],
  controllers: [SimulationsController],
  providers: [SimulationsService, SimulationsRepository],
  exports: [SimulationsService],
})
export class SimulationsModule {}
