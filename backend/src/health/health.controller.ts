import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';

interface HealthResponse {
  status: string;
}

/**
 * Health check endpoint.
 * GET /health → { status: 'ok' }
 *
 * Marcado como @Public(): no requiere JWT para funcionar.
 * Sirve para verificar que el servidor está vivo y que el sobre de respuesta
 * funciona end-to-end. El ResponseInterceptor lo envuelve en:
 * { success: true, statusCode: 200, data: { status: 'ok' } }
 */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
