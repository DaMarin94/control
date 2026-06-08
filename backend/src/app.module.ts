import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { IncomingMessage } from 'http';

/**
 * Módulo raíz de la aplicación.
 *
 * Registra:
 * - AppConfigModule: configuración global con validación Zod fail-fast
 * - LoggerModule (Pino): logging estructurado JSON con requestId por request
 * - HealthModule: endpoint GET /health
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
  ],
})
export class AppModule {}
