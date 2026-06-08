import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { EnvConfig } from '../config/env.schema';

/**
 * PrismaService — wrapper de PrismaClient para NestJS.
 *
 * En Prisma 7 ya no se soporta `url` en el datasource del schema ni
 * `datasources` en el constructor del cliente. La URL de conexión se
 * pasa a través del adapter de driver (@prisma/adapter-pg).
 *
 * Se conecta al init del módulo y desconecta al destruir para gestión
 * correcta del pool de conexiones.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService<EnvConfig, true>) {
    const databaseUrl = config.get('DATABASE_URL', { infer: true });
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
