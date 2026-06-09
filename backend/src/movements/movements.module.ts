import { Module } from '@nestjs/common';
import { MovementsController } from './movements.controller';
import { MovementsService } from './movements.service';
import { MovementsRepository } from './movements.repository';

/**
 * MovementsModule — endpoint unificado GET /movements?month=YYYY-MM.
 *
 * Hoy sirve movimientos únicos (Fase 5). Está diseñado para incorporar
 * fijos (Fase 6) y cuotas (Fase 7) sin cambiar el contrato con el frontend:
 * la respuesta ya estructura movements.fijos y movements.cuotas (vacíos hoy).
 *
 * PrismaService está disponible globalmente (PrismaModule global).
 * Logger (nestjs-pino) también está disponible globalmente.
 *
 * El movementsModule NO importa TransactionsModule — accede directamente
 * a la DB via MovementsRepository (que usa PrismaService global).
 * Esto sigue el patrón de "cada módulo con su propio repository", y evita
 * una dependencia circular o acoplamiento innecesario.
 */
@Module({
  controllers: [MovementsController],
  providers: [MovementsService, MovementsRepository],
})
export class MovementsModule {}
