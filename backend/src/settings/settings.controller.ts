import {
  BadRequestException,
  BadGatewayException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { Currency } from '@prisma/client';
import { Request } from 'express';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { ReferenceRatesService } from './reference-rates.service';
import { RateSyncService, SyncResult } from './rate-sync.service';
import { ExternalRatesService } from './external-rates.service';
import { SyncRatesDto, SyncScope } from './dto/sync-rates.dto';
import { CronSecretGuard } from './cron-secret.guard';
import { SyncRateLimitGuard } from './sync-rate-limit.guard';
import { Public } from '../auth/public.decorator';

/**
 * Controlador de settings del usuario.
 *
 * Todos los endpoints requieren JWT (guard global — JwtAuthGuard).
 * El userId se extrae de request.user.userId (inyectado por el guard).
 *
 * Endpoints:
 *   GET  /settings                            — devuelve defaultCurrency + lastExchangeRate.
 *   PATCH /settings                           — actualiza defaultCurrency y/o lastExchangeRate.
 *   GET  /settings/reference-rate?month=YYYY-MM&currency=XXX
 *                                             — pre-fill de cotización desde la tabla de referencia.
 *   GET  /settings/external-rates?today=YYYY-MM-DD&ipcFrom=YYYY-MM
 *                                             — IPC + cotizaciones FX para la pantalla de configuración.
 *   POST /settings/external-rates/sync        — refresh user-facing de IPC + FX (JWT, rate-limited).
 */
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly referenceRatesService: ReferenceRatesService,
    private readonly rateSyncService: RateSyncService,
    private readonly externalRatesService: ExternalRatesService,
  ) {}

  /**
   * GET /settings
   * Devuelve los settings de moneda del usuario autenticado.
   */
  @Get()
  async getSettings(@Req() req: Request) {
    const userId = (req.user as { userId: string }).userId;
    return this.settingsService.getSettings(userId);
  }

  /**
   * PATCH /settings
   * Actualiza defaultCurrency y/o lastExchangeRate.
   * Body parcial: solo se actualizan los campos presentes.
   */
  @Patch()
  async updateSettings(
    @Req() req: Request,
    @Body() dto: UpdateSettingsDto,
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.settingsService.updateSettings(userId, dto);
  }

  /**
   * POST /settings/reference-rates/sync
   *
   * Dispara la ingesta server-side de cotizaciones FX e IPC desde fuentes externas.
   *
   * Auth: CRON_SECRET en header Authorization (NO JWT de usuario).
   * Body: { scope?: "fx" | "ipc" | "all" } — sin valores de cotización.
   *
   * Respuestas:
   *   200 + SyncResult — con detalle de cada target (incluyendo rechazos parciales)
   *   401 — secret inválido o ausente
   *   422 — dato inválido en fuente (schema/cotas/circuit-breaker; toda la corrida rechazada)
   *   502 — fuente externa caída o respuesta no-JSON (toda la corrida rechazada)
   *   429 — rate limit excedido
   *
   * Una corrida con rechazos PARCIALES responde 200 con el detalle.
   * Una corrida sin NINGÚN target aceptado responde no-2xx.
   */
  @Public() // fuera del JwtAuthGuard global — protegido por CronSecretGuard
  @UseGuards(SyncRateLimitGuard, CronSecretGuard)
  @Post('reference-rates/sync')
  @HttpCode(HttpStatus.OK)
  async syncRates(@Body() dto: SyncRatesDto) {
    const scope = dto.scope ?? SyncScope.ALL;
    const result = await this.rateSyncService.sync(scope);
    this.throwIfFullyRejected(result);
    return result;
  }

  /**
   * Si NINGÚN target fue aceptado → no-2xx (según el motivo predominante).
   * Compartido por el sync de cron y el sync user-facing.
   */
  private throwIfFullyRejected(result: SyncResult): void {
    if (result.acceptedCount === 0 && result.rejectedCount > 0) {
      const hasHttpError = result.results.some(
        (r) => r.reason === 'http-error',
      );
      if (hasHttpError) {
        throw new BadGatewayException({
          message: 'Fuente(s) externa(s) inalcanzable(s) o respuesta no-JSON',
          syncResult: result,
        });
      }
      throw new UnprocessableEntityException({
        message: 'Todos los targets rechazados por validación o circuit breaker',
        syncResult: result,
      });
    }
  }

  /**
   * GET /settings/reference-rate?month=YYYY-MM&currency=XXX
   *
   * Pre-fill de cotización: devuelve el exchangeRate derivado de la tabla de
   * referencia para la moneda y mes dados, respecto a la moneda default del usuario.
   *
   * El exchangeRate devuelto = "unidades de defaultCurrency por 1 unidad de currency".
   * Es el valor que el formulario debe pre-cargar en el campo cotización.
   *
   * Query params:
   *   - month    (requerido): mes YYYY-MM del movimiento
   *   - currency (requerido): moneda del movimiento (ARS | USD | EUR | BRL)
   *
   * Respuesta (dentro del sobre { success, statusCode, data }):
   *   {
   *     currency:        string,   // moneda del movimiento
   *     defaultCurrency: string,   // moneda default del usuario
   *     yearMonth:       string,   // mes consultado
   *     exchangeRate:    number | null  // null si no hay cotización de referencia
   *   }
   *
   * Errores:
   *   400 si month falta o tiene formato inválido, o currency es inválida.
   *   401 si no hay JWT.
   */
  @Get('reference-rate')
  async getReferenceRate(
    @Req() req: Request,
    @Query('month') month: string,
    @Query('currency') currencyParam: string,
  ) {
    const userId = (req.user as { userId: string }).userId;

    // Validar month
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException(
        'El parámetro "month" es obligatorio y debe tener formato YYYY-MM',
      );
    }
    const monthNum = parseInt(month.split('-')[1], 10);
    if (monthNum < 1 || monthNum > 12) {
      throw new BadRequestException('El mes debe estar entre 01 y 12');
    }

    // Validar currency
    const validCurrencies: string[] = Object.values(Currency);
    if (!currencyParam || !validCurrencies.includes(currencyParam)) {
      throw new BadRequestException(
        `El parámetro "currency" es obligatorio y debe ser uno de: ${validCurrencies.join(', ')}`,
      );
    }
    const currency = currencyParam as Currency;

    // Obtener la moneda default del usuario
    const settings = await this.settingsService.getSettings(userId);
    const defaultCurrency = settings.defaultCurrency;

    return this.referenceRatesService.getPreFill(currency, defaultCurrency, month);
  }

  /**
   * GET /settings/external-rates?today=YYYY-MM-DD&ipcFrom=YYYY-MM
   *
   * Datos externos (IPC + cotizaciones FX) para la sección user-facing de
   * `/configuracion`. JWT requerido (guard global); las tablas fuente
   * (InflationRate, CurrencyQuote) son globales, sin scope por usuario.
   *
   * Query params (ambos opcionales):
   *   - today   fecha local del usuario YYYY-MM-DD, para derivar el "mes actual"
   *             de las cotizaciones FX y el año default del historial de IPC.
   *             Ausente → cae a `new Date()` UTC (mismo patrón que los endpoints
   *             de reportes).
   *   - ipcFrom mes YYYY-MM desde el que arranca el historial de IPC devuelto.
   *             Ausente → enero del año derivado de `today` (año en curso).
   *
   * Respuesta (dentro del sobre { success, statusCode, data }): ExternalRatesSnapshot
   * (ver external-rates.service.ts).
   *
   * Errores:
   *   400 si "today" o "ipcFrom" están presentes con formato inválido.
   *   401 si no hay JWT.
   */
  @Get('external-rates')
  async getExternalRates(
    @Query('today') todayParam: string | undefined,
    @Query('ipcFrom') ipcFromParam: string | undefined,
  ) {
    if (todayParam !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(todayParam)) {
      throw new BadRequestException(
        'El parámetro "today" debe tener formato YYYY-MM-DD (ej: 2026-06-25)',
      );
    }
    if (ipcFromParam !== undefined && !/^\d{4}-\d{2}$/.test(ipcFromParam)) {
      throw new BadRequestException(
        'El parámetro "ipcFrom" debe tener formato YYYY-MM',
      );
    }

    return this.externalRatesService.getSnapshot(todayParam, ipcFromParam);
  }

  /**
   * POST /settings/external-rates/sync
   *
   * Refresh user-facing de IPC + FX: dispara la misma ingesta server-side que
   * el endpoint de cron (`RateSyncService.sync(SyncScope.ALL)`), pero autenticado
   * por JWT de usuario (no CRON_SECRET) y expuesto para la pantalla de configuración.
   *
   * Sin body — siempre corre scope "all" (IPC + FX de una).
   *
   * Auth: JWT (guard global) + SyncRateLimitGuard (10 req/min por IP — mismo
   * limiter en memoria que comparte con el endpoint de cron).
   *
   * Respuesta (200 + SyncResult): mismo shape que /settings/reference-rates/sync
   * (`{ scope, results, acceptedCount, rejectedCount }`). El frontend distingue
   * "se actualizó algo" (`acceptedCount > 0`) de una corrida sin cambios aceptados
   * mirando `results[].reason` por target.
   *
   * Errores:
   *   401 si no hay JWT.
   *   429 si se excede el rate limit.
   *   422 si todos los targets fueron rechazados por validación/circuit-breaker.
   *   502 si la(s) fuente(s) externa(s) están caídas o responden no-JSON.
   */
  @UseGuards(SyncRateLimitGuard)
  @Post('external-rates/sync')
  @HttpCode(HttpStatus.OK)
  async refreshExternalRates() {
    const result = await this.rateSyncService.sync(SyncScope.ALL);
    this.throwIfFullyRejected(result);
    return result;
  }
}
