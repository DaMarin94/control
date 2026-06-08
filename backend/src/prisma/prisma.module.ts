import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaModule — módulo global que provee PrismaService a toda la app.
 *
 * @Global: evita tener que importarlo en cada módulo de feature.
 * Los módulos de feature (TransactionsModule, RecurringModule, etc.)
 * pueden inyectar PrismaService directamente.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
