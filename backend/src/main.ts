import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { EnvConfig } from './config/env.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Deshabilitar el logger por defecto de NestJS — usamos Pino
    bufferLogs: true,
  });

  // Reemplazar logger de NestJS por Pino
  const logger = app.get(Logger);
  app.useLogger(logger);

  // ConfigService con tipos de EnvConfig
  const config = app.get<ConfigService<EnvConfig, true>>(ConfigService);

  // ValidationPipe global: valida todos los DTOs entrantes
  // whitelist: descarta propiedades no declaradas en el DTO
  // forbidNonWhitelisted: lanza error si hay propiedades extra
  // transform: convierte tipos automáticamente (ej. string → number)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Interceptor global: envuelve respuestas exitosas en { success, statusCode, data }
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Exception filter global: captura toda excepción y responde { success, statusCode, error }
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  const port = config.get('PORT', { infer: true });

  await app.listen(port);

  logger.log(`Backend corriendo en http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
