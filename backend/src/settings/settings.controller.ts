import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { Currency } from '@prisma/client';
import { Request } from 'express';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { ReferenceRatesService } from './reference-rates.service';

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
 */
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly referenceRatesService: ReferenceRatesService,
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
}
