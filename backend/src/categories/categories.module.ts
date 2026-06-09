import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategoriesRepository } from './categories.repository';
import { CategoryValidatorService } from './category-validator.service';

/**
 * CategoriesModule — CRUD de categorías por usuario.
 *
 * PrismaService ya está disponible globalmente (PrismaModule global).
 * Logger (nestjs-pino) también está disponible globalmente via LoggerModule.
 *
 * Exporta CategoryValidatorService para que los módulos de movimientos
 * (transactions, recurring, installments) puedan validar categorías sin
 * duplicar la lógica (D3 — Fase 7).
 */
@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesRepository, CategoryValidatorService],
  exports: [CategoriesService, CategoryValidatorService],
})
export class CategoriesModule {}
