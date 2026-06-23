import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * Rate limiter simple en memoria para el endpoint de sync de cotizaciones.
 *
 * Límite: 10 peticiones por IP por ventana de 60 segundos.
 * Es intencional que sea conservador: este endpoint es para cron jobs,
 * no para uso interactivo. Un cron legítimo solo lo llama una vez por hora.
 *
 * Nota: en escala multi-instancia se necesitaría Redis; para esta app
 * single-instance es suficiente.
 */
@Injectable()
export class SyncRateLimitGuard implements CanActivate {
  private readonly store = new Map<string, RateLimitEntry>();

  /** Máximo de requests por IP por ventana */
  private readonly MAX_REQUESTS = 10;
  /** Duración de la ventana en ms */
  private readonly WINDOW_MS = 60_000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);
    const now = Date.now();

    // Limpiar entradas expiradas periódicamente (cada 100 requests aprox.)
    if (this.store.size > 1000) {
      this.cleanup(now);
    }

    const entry = this.store.get(ip);

    if (!entry || now - entry.windowStart > this.WINDOW_MS) {
      // Nueva ventana
      this.store.set(ip, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= this.MAX_REQUESTS) {
      throw new HttpException(
        'Demasiadas solicitudes. Intentá de nuevo en un minuto.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count++;
    return true;
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return request.socket?.remoteAddress ?? 'unknown';
  }

  private cleanup(now: number): void {
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStart > this.WINDOW_MS) {
        this.store.delete(key);
      }
    }
  }
}
