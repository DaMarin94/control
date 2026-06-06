import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validateEnv } from './env.schema';

/**
 * Módulo de configuración global.
 * Usa @nestjs/config con validación Zod fail-fast al arrancar.
 * El ConfigService queda disponible en toda la app sin necesidad de importar este módulo en cada feature.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // En test, no falla si no existe .env
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
  ],
})
export class AppConfigModule {}
