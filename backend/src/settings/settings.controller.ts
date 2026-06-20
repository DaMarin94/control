import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

/**
 * Controlador de settings del usuario.
 *
 * Todos los endpoints requieren JWT (guard global — JwtAuthGuard).
 * El userId se extrae de request.user.userId (inyectado por el guard).
 *
 * Endpoints:
 *   GET  /settings  — devuelve defaultCurrency + lastExchangeRate del usuario.
 *   PATCH /settings — actualiza defaultCurrency y/o lastExchangeRate.
 */
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

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
}
