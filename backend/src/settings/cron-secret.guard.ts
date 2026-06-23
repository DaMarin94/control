import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { EnvConfig } from '../config/env.schema';

/**
 * Guard para el endpoint POST /settings/reference-rates/sync.
 *
 * Valida el CRON_SECRET enviado en el header `Authorization: Bearer <secret>`.
 * La comparación es de tiempo constante (timingSafeEqual) para prevenir timing attacks.
 *
 * El secret NUNCA se loguea (ni en errores, ni en logs de contexto).
 *
 * No usa JWT de usuario — es un secret de operación para cron jobs.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const authHeader = request.headers['authorization'];
    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('CRON_SECRET requerido');
    }

    // Aceptar "Bearer <secret>" o solo "<secret>"
    const provided = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    const expected = this.config.get('CRON_SECRET', { infer: true });

    // Comparación de tiempo constante para prevenir timing attacks
    // timingSafeEqual exige buffers del mismo largo
    let valid = false;
    try {
      const providedBuf = Buffer.from(provided, 'utf8');
      const expectedBuf = Buffer.from(expected, 'utf8');

      if (providedBuf.length === expectedBuf.length) {
        valid = timingSafeEqual(providedBuf, expectedBuf);
      } else {
        // Mismo largo simulado para no filtrar longitud por timing
        timingSafeEqual(expectedBuf, expectedBuf);
        valid = false;
      }
    } catch {
      valid = false;
    }

    if (!valid) {
      // NO loggear el secret ni el valor provided
      throw new UnauthorizedException('CRON_SECRET inválido');
    }

    return true;
  }
}
