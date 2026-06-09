import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { MovementsModule } from './movements/movements.module';
import { RecurringModule } from './recurring/recurring.module';
import { InstallmentsModule } from './installments/installments.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { IncomingMessage } from 'http';

/**
 * Módulo raíz de la aplicación.
 *
 * Registra:
 * - AppConfigModule: configuración global con validación Zod fail-fast
 * - LoggerModule (Pino): logging estructurado JSON con requestId por request
 * - HealthModule: endpoint GET /health (marcado como @Public())
 * - PrismaModule: acceso a DB (global)
 * - AuthModule: endpoints POST /auth/register, /auth/login, /auth/google
 * - JwtAuthGuard: guard global — toda request requiere JWT válido (RNF-001)
 *   excepto las rutas marcadas con @Public()
 */
@Module({
  imports: [
    AppConfigModule,

    // Pino — logging estructurado JSON
    // Genera un requestId por request para correlacionar todos los logs de esa request
    LoggerModule.forRoot({
      pinoHttp: {
        // En desarrollo: pretty print para legibilidad
        // En producción: JSON puro
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,

        // Genera requestId único por request
        genReqId: (req: IncomingMessage) => {
          const existingId = req.headers['x-request-id'];
          if (existingId) return existingId as string;
          return uuidv4();
        },

        // Forma del log: { timestamp, level, context, message, ...datos }
        // NUNCA loggear Authorization header completo ni JWT
        customProps: () => ({
          context: 'HTTP',
        }),

        serializers: {
          req(req: {
            headers: Record<string, string>;
            [key: string]: unknown;
          }) {
            // Excluir Authorization header del log para no exponer JWT
            const { authorization: _auth, ...safeHeaders } = req.headers;
            return {
              method: req['method'],
              url: req['url'],
              headers: safeHeaders,
            };
          },
          res(res: { statusCode: number }) {
            return { statusCode: res.statusCode };
          },
        },
      },
    }),

    HealthModule,
    PrismaModule,
    AuthModule,
    CategoriesModule,
    TransactionsModule,
    MovementsModule,
    RecurringModule,
    InstallmentsModule,
  ],
  providers: [
    // Guard global: toda request requiere JWT válido (RNF-001).
    // Las rutas públicas se marcan con @Public() en el controller.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
